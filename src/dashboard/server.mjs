import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { Worker } from 'node:worker_threads';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { containedBy, projectRoot } from '../recovery.mjs';
import { discover, scores } from './engine.mjs';
import { openStore } from './store.mjs';
import { initialize, changed, observe, updateCase, estimatePairs, lifecycleView } from './assessment.mjs';
import { remedies } from './fixes.mjs';
import { catalog } from './catalog.mjs';
import { sourceArchive } from './source-archive.mjs';
import { renderReport } from './report.mjs';
import { actionNames, recordKey, invalidatedKeys, isPreview } from './procedures.mjs';
import { renderDocumentation } from './documentation.mjs';
import { assessFindings } from './findings.mjs';

// Merge a fresh discovery with saved cases. Saved evidence of projects that are no longer
// discovered is kept (marked unavailable) instead of being silently deleted.
export function reconcile(previousRepositories, discovered, at) {
  const repositories = discovered.repositories.map(repository => {
    const previous = previousRepositories.find(item => item.id === repository.id);
    const merged = initialize(previous ? { ...previous, name: repository.name, markers: repository.markers, hasGit: repository.hasGit, empty: repository.empty } : repository, at);
    delete merged.unavailable;
    return merged;
  });
  for (const previous of previousRepositories) {
    if (repositories.some(item => item.id === previous.id)) continue;
    if (Object.keys(previous.records ?? {}).length || previous.procedures?.length) repositories.push({ ...previous, unavailable: true });
  }
  return repositories.sort((a, b) => a.name.localeCompare(b.name));
}

export function latestInspection(repository) {
  return repository.scan?.inspection ?? repository.records.inspection ?? null;
}

export function scanView(repository) {
  const inspection = latestInspection(repository);
  const error = repository.scan?.error ?? null;
  const at = repository.scan?.at ?? inspection?.at ?? null;
  return {
    at, error, gatesUpdated: repository.scan ? repository.scan.gatesUpdated === true : Boolean(inspection),
    state: inspection?.state ?? null, hasGit: inspection?.hasGit ?? repository.hasGit,
    ...assessFindings(error ? null : inspection, error),
    candidates: error ? null : inspection?.candidates ?? null,
    objects: inspection?.objects ? { ran: inspection.objects.ran, passed: inspection.objects.passed, objectCount: inspection.objects.objectCount,
      skippedReason: inspection.objects.skippedReason ?? null, problems: inspection.objects.problems } : null,
  };
}

const publicRoot = path.join(projectRoot, 'website');
const files = { '/': ['index.html', 'text/html'], '/app.js': ['app.js', 'text/javascript'],
  '/guidance.mjs': ['guidance.mjs', 'text/javascript'], '/guidance-model.mjs': ['guidance-model.mjs', 'text/javascript'],
  '/guidance.css': ['guidance.css', 'text/css'],
  '/list-model.mjs': ['list-model.mjs', 'text/javascript'], '/style.css': ['style.css', 'text/css'],
  '/workspace.mjs': ['workspace.mjs', 'text/javascript'], '/workspace-model.mjs': ['workspace-model.mjs', 'text/javascript'],
  '/diagnostics-model.mjs': ['diagnostics-model.mjs', 'text/javascript'], '/favicon.svg': ['favicon.svg', 'image/svg+xml'],
  '/simple.mjs': ['simple.mjs', 'text/javascript'], '/simple-model.mjs': ['simple-model.mjs', 'text/javascript'], '/simple.css': ['simple.css', 'text/css'],
  '/fonts/DMMono-Regular.ttf': [path.join('fonts', 'DMMono-Regular.ttf'), 'font/ttf'] };
const escape = text => text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
function guidePage(title, description, source, markdown) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escape(title)} | Recovery docs</title><link rel="stylesheet" href="/style.css"><link rel="stylesheet" href="/guidance.css"></head><body class="guide-page"><header class="guide-nav"><a href="/">+ Recovery workbench</a><nav><a href="/manual">Step-by-step manual</a><a href="/workflow">Recovery workflow</a><a href="/docs">Reference</a><a href="/setup">Setup</a></nav></header><article><p class="eyebrow">${escape(title)}</p><p>${escape(description)}</p>${source ? `<p><a href="/procedure-source/${source.id}">Read script: ${escape(source.source)}</a></p>` : ''}${renderDocumentation(markdown)}</article></body></html>`;
}

export async function startDashboard({ root, data, port = 4317 }) {
  root = fs.realpathSync(root);
  data = path.resolve(data);
  let ancestor = data;
  while (!fs.existsSync(ancestor)) ancestor = path.dirname(ancestor);
  data = path.join(fs.realpathSync(ancestor), path.relative(ancestor, data));
  if (containedBy(data, root) || containedBy(data, projectRoot) || containedBy(root, data) || containedBy(projectRoot, data)) {
    throw new Error('Dashboard data must be outside the scan directory and project.');
  }
  fs.mkdirSync(data, { recursive: true });
  data = fs.realpathSync(data);
  const discovered = discover(root);
  const attempts = path.join(data, 'attempts');
  fs.mkdirSync(attempts, { recursive: true, mode: 0o700 });
  if (fs.realpathSync(attempts) !== attempts) throw new Error('Attempt archive must not be a linked directory.');
  const store = openStore(data, root);
  let state = store.load() || { schemaVersion: 1, ...discover(root), scannedAt: new Date().toISOString() };
  state.repositories = reconcile(state.repositories, discovered, state.scannedAt);
  state.skipped = discovered.skipped;
  let job = null;
  let worker = null;
  const token = crypto.randomBytes(32).toString('hex');
  let origin;

  function save() {
    store.save(state);
  }
  function send(response, status, payload) {
    response.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
    response.end(JSON.stringify(payload));
  }
  async function body(request) {
    let text = '';
    for await (const chunk of request) {
      text += chunk.toString('utf8');
      if (Buffer.byteLength(text) > 98_304) throw new Error('Request body exceeds 96 KiB.');
    }
    return JSON.parse(text || '{}');
  }
  const server = http.createServer(async (request, response) => {
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('Referrer-Policy', 'no-referrer');
    response.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");
    try {
      if (request.headers.host !== new URL(origin).host ||
        (request.headers.origin && request.headers.origin !== origin) ||
        request.headers['sec-fetch-site'] === 'cross-site') {
        return send(response, 403, { error: 'Only same-origin loopback requests are allowed.' });
      }
      const route = new URL(request.url, origin).pathname;
      if (request.method === 'GET' && files[route]) {
        const [file, type] = files[route];
        response.writeHead(200, { 'Content-Type': type.startsWith('font/') ? type : `${type}; charset=utf-8`, 'Cache-Control': 'no-store' });
        return response.end(fs.readFileSync(path.join(publicRoot, file)));
      }
      if (request.method === 'GET' && ['/docs', '/setup', '/workflow', '/manual'].includes(route)) {
        const setup = route === '/setup';
        const content = fs.readFileSync(path.join(projectRoot, setup ? 'README.md' : 'docs', ...(setup ? [] : [route === '/manual' ? 'USER_GUIDE.md' : route === '/workflow' ? 'GUIDED_RECOVERY.md' : 'DASHBOARD.md'])), 'utf8');
        response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
        return response.end(guidePage(setup ? 'Setup the local workbench' : 'Recovery procedure documentation',
          'Local documentation. Procedure execution still requires its case-specific evidence gates.', null, content));
      }
      if (request.method === 'GET' && (route.startsWith('/guide/') || route.startsWith('/procedure-source/'))) {
        const item = catalog.find(item => item.id === route.split('/').at(-1));
        if (!item) return send(response, 404, { error: 'Unknown procedure.' });
        const source = route.startsWith('/procedure-source/');
        const content = fs.readFileSync(path.join(projectRoot, source ? item.source : item.guide || (item.id === 'inventory' ? 'docs/TOOLING.md' : 'docs/DASHBOARD.md')), 'utf8');
        response.writeHead(200, { 'Content-Type': source ? 'text/plain; charset=utf-8' : 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
        return response.end(source ? content : guidePage(item.name, item.description, item, content));
      }
      if (request.method === 'GET' && route === '/download/source.zip') {
        const archive = sourceArchive(projectRoot);
        response.writeHead(200, { 'Content-Type': 'application/zip', 'Content-Disposition': 'attachment; filename="moorkyz-repo-recovery-source.zip"', 'Cache-Control': 'no-store' });
        return response.end(archive);
      }
      if (request.method === 'GET' && route === '/api/session') return send(response, 200, { token });
      if (request.headers['x-recovery-token'] !== token) return send(response, 403, { error: 'Dashboard session token required.' });
      if (request.method === 'GET' && route === '/api/report.md') {
        if (job?.status === 'running') return send(response, 409, { error: 'Wait for the active job before exporting saved evidence.' });
        const only = new URL(request.url, origin).searchParams.get('repository');
        const selection = only ? state.repositories.filter(item => item.id === only) : state.repositories;
        if (only && !selection.length) return send(response, 404, { error: 'Unknown repository.' });
        response.writeHead(200, {
          'Content-Type': 'text/markdown; charset=utf-8', 'Cache-Control': 'no-store',
          'Content-Disposition': `attachment; filename="${only ? 'recovery-case-report.md' : 'recovery-assessment.md'}"`,
        });
        return response.end(renderReport({ ...state, repositories: selection.map(item => ({ ...item, scanView: scanView(item) })) }));
      }
      if (request.method === 'GET' && route === '/api/state') {
        return send(response, 200, {
          root: state.root, scannedAt: state.scannedAt, skipped: state.skipped, job, remedies, catalog, storage: 'SQLite',
          repositories: state.repositories.map(({ scan, ...repository }) => ({
            ...repository,
            scan: scanView({ ...repository, scan }),
            // Full baseline hashes and process logs stay on disk, not in the overview payload.
            records: Object.fromEntries(Object.entries(repository.records).map(([key, value]) => [key, {
              at: value.at, passed: value.passed, state: value.state, profile: value.profile,
              scope: value.scope, availableChecks: value.measured?.availableChecks,
              matchedFiles: value.matchedFiles, baselineFiles: value.baselineFiles,
              note: value.note, backup: value.backup, workingCopy: value.workingCopy,
              acceptance: value.acceptance, verification: value.verification,
              results: value.results?.map(result => ({ check: result.check, exitCode: result.exitCode, error: result.error })),
              failure: key === 'integrity' && value.passed === false ? (value.command?.stderr || value.command?.error || '').slice(0, 2000) : undefined,
              summary: key === 'inspection' ? {
                trackedFiles: value.recoveryEvidence?.trackedFiles ?? null,
                missingIndexPaths: value.recoveryEvidence?.missingFromIndex?.length ?? null,
                stagedDeletions: value.recoveryEvidence?.changes?.stagedDeletions?.length ?? null,
                auditPaths: value.recoveryEvidence?.auditPaths?.length ?? null,
                tags: value.recoveryEvidence?.tags?.length ?? null, stashes: value.recoveryEvidence?.stashes ?? null,
              } : key === 'preservation' ? {
                files: Object.keys(value.baseline.files).length,
                bytes: Object.values(value.baseline.files).reduce((sum, file) => sum + file.bytes, 0),
                links: Object.keys(value.baseline.links ?? {}).length,
              } : undefined,
            }])),
            scores: scores(repository),
            estimates: estimatePairs(repository),
            lifecycle: lifecycleView(repository),
          })),
        });
      }
      if (request.method === 'GET' && route.startsWith('/api/evidence/')) {
        const repository = state.repositories.find(item => item.id === route.slice('/api/evidence/'.length));
        if (!repository) return send(response, 404, { error: 'Unknown repository.' });
        return send(response, 200, repository.records);
      }
      if (request.method === 'GET' && route.startsWith('/api/attempt/')) {
        const id = route.slice('/api/attempt/'.length);
        if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(id)) return send(response, 400, { error: 'Invalid attempt ID.' });
        const file = path.join(attempts, `${id}.json`);
        if (!fs.existsSync(file)) return send(response, 404, { error: 'No archived evidence for this attempt.' });
        return send(response, 200, JSON.parse(fs.readFileSync(file, 'utf8')));
      }
      if (request.method === 'POST' && route === '/api/case') {
        if (job?.status === 'running') return send(response, 409, { error: 'Wait for the active job.' });
        const input = await body(request);
        const repository = state.repositories.find(item => item.id === input.repositoryId);
        if (!repository) return send(response, 404, { error: 'Unknown repository.' });
        const previous = structuredClone(repository);
        try {
          updateCase(repository, input);
          save();
        } catch (error) {
          Object.assign(repository, previous);
          throw error;
        }
        return send(response, 200, { message: 'Case record saved in SQLite.' });
      }
      if (request.method === 'POST' && route === '/api/rescan') {
        if (job?.status === 'running') return send(response, 409, { error: 'Wait for the active job.' });
        const next = discover(state.root);
        const at = new Date().toISOString();
        state = { schemaVersion: 1, ...next, repositories: next.repositories.map(repository => {
          const previous = state.repositories.find(item => item.id === repository.id);
          const merged = initialize(previous ? { ...previous, ...repository, recoveryTargets: [] } : repository, at);
          return merged;
        }), scannedAt: at };
        save();
        return send(response, 200, { message: 'Directory rescanned; previous score gates reset.' });
      }
      if (request.method === 'POST' && route === '/api/scan') {
        if (job?.status === 'running') return send(response, 409, { error: 'A job is already running. Wait for it to finish or cancel it first.' });
        const at = new Date().toISOString();
        const fresh = discover(state.root);
        state.repositories = reconcile(state.repositories, fresh, at);
        state.skipped = fresh.skipped;
        state.scannedAt = at;
        const targets = state.repositories.filter(repository => !repository.unavailable);
        job = { id: crypto.randomUUID(), action: 'scan', status: 'running', startedAt: at, cancelRequested: false,
          progress: { total: targets.length, done: 0, failed: 0, current: null } };
        save();
        const jobId = job.id;
        const results = [];
        worker = new Worker(new URL('./worker.mjs', import.meta.url), {
          workerData: { action: 'scan', repositories: targets.map(({ id, path: folder }) => ({ id, path: folder })) },
        });
        const scanWorker = worker;
        function finish(status, error) {
          if (job.id !== jobId || job.status !== 'running') return;
          job = { ...job, status, ...(error ? { error } : {}), finishedAt: new Date().toISOString(), progress: { ...job.progress, current: null } };
          try {
            fs.writeFileSync(path.join(attempts, `${jobId}.json`), JSON.stringify({ schemaVersion: 1, action: 'scan',
              startedAt: job.startedAt, finishedAt: job.finishedAt, status, error: error ?? null, results }), { flag: 'wx', mode: 0o600 });
          } catch (archiveError) { job.error = `${job.error ? `${job.error}; ` : ''}scan archive failed: ${archiveError.message}`; }
          try { save(); } catch (saveError) { job = { ...job, status: 'failed', error: `Scan results could not be saved: ${saveError.message}` }; }
        }
        worker.on('message', message => {
          if (job.id !== jobId || job.status !== 'running') return;
          if (message.type === 'progress') {
            job.progress = { ...job.progress, current: state.repositories.find(item => item.id === message.id)?.name ?? null };
          } else if (message.type === 'result') {
            const repository = state.repositories.find(item => item.id === message.id);
            if (!repository) return;
            const finishedAt = message.inspection?.at ?? new Date().toISOString();
            // Cases that already have verified copies keep their gates; the new scan is stored alongside them.
            const gatesUpdated = Boolean(message.inspection) && !repository.records.preservation;
            if (gatesUpdated) {
              for (const key of invalidatedKeys('inspect')) delete repository.records[key];
              repository.recoveryTargets = [];
              repository.records.inspection = message.inspection;
              observe(repository, message.inspection);
              repository.scan = { at: finishedAt, gatesUpdated: true };
            } else {
              repository.scan = { at: finishedAt, gatesUpdated: false, ...(message.error ? { error: message.error } : { inspection: message.inspection }) };
            }
            repository.procedures.push({ id: crypto.randomUUID(), name: 'scan', action: 'scan', at: finishedAt, evidenceId: jobId,
              status: message.error ? 'failed' : 'completed', helpingFactor: null, rationale: '', ...(message.error ? { error: message.error } : {}) });
            results.push({ repositoryId: repository.id, status: message.error ? 'failed' : 'completed', error: message.error ?? null,
              state: message.inspection?.state ?? null, gatesUpdated });
            job.progress = { ...job.progress, done: job.progress.done + 1, failed: job.progress.failed + (message.error ? 1 : 0) };
            try { save(); } catch (error) {
              finish('failed', `Scan result could not be saved: ${error.message}`);
              scanWorker.terminate();
            }
          } else if (message.type === 'done') finish(message.cancelled ? 'cancelled' : 'completed');
          else if (message.error) finish('failed', message.error);
        });
        worker.once('error', error => finish('failed', error.message));
        worker.once('exit', code => {
          if (job.id === jobId && job.status === 'running') {
            finish('failed', `Scan worker ended early (exit ${code}); ${job.progress.done} of ${job.progress.total} repositories were scanned and saved.`);
          }
          if (worker === scanWorker) worker = null;
        });
        return send(response, 202, job);
      }
      if (request.method === 'POST' && route === '/api/cancel') {
        if (job?.status === 'running' && job.action === 'scan' && worker) {
          worker.postMessage({ cancel: true });
          job = { ...job, cancelRequested: true };
          return send(response, 202, { message: 'Cancellation requested. The scan stops after the current repository; finished results stay saved.' });
        }
        if (job?.status !== 'running' || job.action !== 'quality' || !worker) return send(response, 409, { error: 'Only an active validation process can be cancelled. Copy/Git operations finish their current bounded action.' });
        worker.postMessage({ cancel: true });
        return send(response, 202, { message: 'Cancellation requested. Wait for recorded process cleanup results.' });
      }
      if (request.method === 'POST' && route === '/api/task') {
        if (job?.status === 'running') return send(response, 409, { error: 'A medikit job is already running.' });
        const input = await body(request);
        const repository = state.repositories.find(item => item.id === input.repositoryId);
        if (!repository || !actionNames.includes(input.action)) return send(response, 400, { error: 'Unknown repository or medikit action.' });
        if (repository.unavailable) return send(response, 409, { error: 'This project folder is no longer discovered. Its saved evidence is kept read-only.' });
        if (input.action === 'preserve' && (typeof input.backup !== 'string' || typeof input.workingCopy !== 'string')) {
          return send(response, 400, { error: 'Backup and working-copy paths are required.' });
        }
        for (const key of invalidatedKeys(input.action)) delete repository.records[key];
        if (['inspect', 'preserve', 'acquire-apply'].includes(input.action)) repository.recoveryTargets = [];
        save();
        job = { id: crypto.randomUUID(), repositoryId: repository.id, action: input.action, status: 'running', startedAt: new Date().toISOString() };
        const jobId = job.id;
        function archiveAttempt(payload) {
          fs.writeFileSync(path.join(attempts, `${jobId}.json`), JSON.stringify({
            schemaVersion: 1, repositoryId: repository.id, action: input.action, startedAt: job.startedAt,
            finishedAt: new Date().toISOString(), ...payload,
          }), { flag: 'wx', mode: 0o600 });
        }
        worker = new Worker(new URL('./worker.mjs', import.meta.url), {
          workerData: { repository, action: input.action, input, forbiddenRoots: [root, projectRoot, data] },
        });
        const taskWorker = worker;
        function fail(message) {
          if (job.id !== jobId || job.status !== 'running') return;
          job = { ...job, status: 'failed', error: message, finishedAt: new Date().toISOString() };
          repository.failures = [...(repository.failures || []), { ...job }].slice(-50);
          try {
            if (!fs.existsSync(path.join(attempts, `${jobId}.json`))) archiveAttempt({ error: message });
          } catch (error) { job.error += `; attempt archive failed: ${error.message}`; }
          repository.procedures.push({ id: job.id, name: input.remedy || input.action, at: job.finishedAt, action: input.action, evidenceId: jobId, startedAt: job.startedAt, durationMs: Date.parse(job.finishedAt) - Date.parse(job.startedAt),
            status: 'failed', helpingFactor: null, rationale: '', error: message });
          try { save(); } catch (error) {
            job.error += `; failure record could not be saved: ${error.message}`;
            console.error(job.error);
          }
          console.error(`Medikit ${input.action}: ${message}`);
        }
        worker.once('message', message => {
          if (message.error) return fail(message.error);
          try {
            archiveAttempt({ result: message.result });
            const key = recordKey(input.action);
            repository.records[key] = message.result;
            if (input.action === 'inspect') {
              observe(repository, message.result);
              repository.scan = { at: message.result.at, gatesUpdated: true };
            } else if (!isPreview(input.action)) changed(repository, `Procedure: ${input.action}`, message.result.at);
            if (!isPreview(input.action)) repository.procedures.push({
              id: job.id, name: input.remedy || input.action, action: input.action, at: message.result.at, evidenceId: jobId, startedAt: job.startedAt, durationMs: Date.now() - Date.parse(job.startedAt),
              status: message.result.passed === false ? 'failed' : 'completed',
              helpingFactor: null, rationale: '', file: message.result.file || null,
            });
            if (input.action === 'fix-apply') {
              repository.case.cure = `Applied ${input.remedy} to ${message.result.file} in the verified working copy. Revalidation required.`;
              repository.estimates = {};
            }
            if (input.action === 'restore-apply') {
              repository.recoveryTargets = [...(repository.recoveryTargets ?? []).filter(target => target.file !== message.result.file),
                { file: message.result.file, afterHash: message.result.afterHash, sourceCommit: message.result.sourceCommit }];
              repository.case.cure = `Restored ${message.result.file} from ${message.result.sourceCommit} in the working copy. Revalidation required.`;
              repository.estimates = {};
            }
            save();
            job = { ...job, status: message.result.passed === false ? 'failed' : 'completed',
              error: message.result.passed === false ? 'Validation checks failed or were cancelled. See recorded command output.' : undefined,
              finishedAt: new Date().toISOString() };
          } catch (error) {
            const key = recordKey(input.action);
            delete repository.records[key];
            fail(`Evidence persistence failed: ${error.message}`);
          }
        });
        worker.once('error', error => fail(error.message));
        worker.once('exit', code => {
          if (job.id === jobId && job.status === 'running') fail(`Worker ended without evidence (exit ${code}).`);
          if (worker === taskWorker) worker = null;
        });
        return send(response, 202, job);
      }
      return send(response, 404, { error: 'Unknown route.' });
    } catch (error) {
      console.error(`Dashboard request failed: ${error.message}`);
      send(response, 400, { error: error.message });
    }
  });
  try {
    await new Promise((resolve, reject) => {
      server.once('error', reject);
      server.listen(port, '127.0.0.1', resolve);
    });
  } catch (error) {
    store.close();
    throw error;
  }
  origin = `http://127.0.0.1:${server.address().port}`;
  save();
  return { server, origin, close: async () => {
    if (worker) {
      const active = worker;
      if (['quality', 'scan'].includes(job?.action)) active.postMessage({ cancel: true });
      await new Promise(resolve => active.once('exit', resolve));
    }
    await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    store.close();
  } };
}

export function parseArguments(args, defaults = { root: path.dirname(projectRoot), port: 4317 }) {
  const options = { ...defaults, data: null, open: false };
  for (let index = 0; index < args.length; index++) {
    if (args[index] === '--open') {
      options.open = true;
      continue;
    }
    const key = args[index]?.startsWith('--') ? args[index].slice(2) : null;
    const value = args[index + 1];
    if (!['root', 'data', 'port'].includes(key) || !value || value.startsWith('--')) {
      throw new Error('Use --root <folder-with-repositories> [--data <external-directory>] [--port <number>] [--open].');
    }
    options[key] = key === 'port' ? Number(value) : value;
    index++;
  }
  if (!Number.isInteger(options.port) || options.port < 1 || options.port > 65535) throw new Error('Port must be an integer from 1 to 65535.');
  return options;
}

// Without --data, keep the original default folder for its existing workspace and give every
// other scan root its own folder, so switching roots never fails with a workspace mismatch.
export function defaultDataFolder(root, home = os.homedir()) {
  const legacy = path.join(home, '.moorkyz-recovery', 'dashboard');
  const resolved = fs.realpathSync(root);
  const database = path.join(legacy, 'recovery.sqlite');
  if (!fs.existsSync(database)) return legacy;
  const store = (() => { try { return openStore(legacy, resolved); } catch { return null; } })();
  if (store) {
    store.close();
    return legacy;
  }
  return path.join(home, '.moorkyz-recovery', 'workspaces', crypto.createHash('sha256').update(resolved).digest('hex').slice(0, 16));
}

function openBrowser(url) {
  const [command, args] = process.platform === 'win32' ? ['cmd.exe', ['/d', '/c', 'start', '', url]]
    : process.platform === 'darwin' ? ['open', [url]] : ['xdg-open', [url]];
  try {
    const child = spawn(command, args, { detached: true, stdio: 'ignore', windowsHide: true });
    child.on('error', () => console.log(`Could not open a browser automatically. Open ${url} yourself.`));
    child.unref();
  } catch { console.log(`Could not open a browser automatically. Open ${url} yourself.`); }
}

async function main(args) {
  const options = parseArguments(args);
  if (!fs.existsSync(options.root) || !fs.statSync(options.root).isDirectory()) {
    throw new Error(`Scan folder not found: ${options.root}. Pass the folder that contains your repositories with --root.`);
  }
  options.data ??= defaultDataFolder(options.root);
  const app = await startDashboard(options);
  console.log(`Recovery dashboard: ${app.origin}`);
  console.log(`Scanning folder: ${options.root}`);
  console.log(`Private evidence: ${options.data}`);
  console.log('Open the address above and press "Scan repositories". Nothing is repaired automatically. Ctrl+C stops the server.');
  if (options.open) openBrowser(app.origin);
  for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => app.close().then(() => process.exit(0)));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2)).catch(error => { console.error(`Dashboard error: ${error.message}`); process.exitCode = 1; });
}
