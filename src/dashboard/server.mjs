import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { Worker } from 'node:worker_threads';
import { fileURLToPath } from 'node:url';
import { containedBy, projectRoot } from '../recovery.mjs';
import { discover, scores } from './engine.mjs';

const publicRoot = path.join(projectRoot, 'website');
const actions = ['inspect', 'preserve', 'integrity', 'quality', 'recover'];
const files = { '/': ['index.html', 'text/html'], '/app.js': ['app.js', 'text/javascript'], '/style.css': ['style.css', 'text/css'] };

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
  const stateFile = path.join(data, 'dashboard-state.json');
  let state;
  if (fs.existsSync(stateFile)) {
    state = JSON.parse(fs.readFileSync(stateFile, 'utf8'));
    if (state.schemaVersion !== 1 || state.root !== root || !Array.isArray(state.repositories)) {
      throw new Error('Saved dashboard state does not match this root. Use a separate --data directory.');
    }
  } else {
    state = { schemaVersion: 1, ...discover(root), scannedAt: new Date().toISOString() };
  }
  let job = null;
  let worker = null;
  const token = crypto.randomBytes(32).toString('hex');
  let origin;

  function save() {
    const temporary = path.join(data, `state-${crypto.randomUUID()}.tmp`);
    fs.writeFileSync(temporary, `${JSON.stringify(state, null, 2)}\n`, { flag: 'wx', mode: 0o600 });
    fs.renameSync(temporary, stateFile);
  }
  function send(response, status, payload) {
    response.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
    response.end(JSON.stringify(payload));
  }
  async function body(request) {
    let text = '';
    for await (const chunk of request) {
      text += chunk.toString('utf8');
      if (Buffer.byteLength(text) > 16_384) throw new Error('Request body exceeds 16 KiB.');
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
        response.writeHead(200, { 'Content-Type': `${type}; charset=utf-8`, 'Cache-Control': 'no-store' });
        return response.end(fs.readFileSync(path.join(publicRoot, file)));
      }
      if (request.method === 'GET' && route === '/api/session') return send(response, 200, { token });
      if (request.headers['x-recovery-token'] !== token) return send(response, 403, { error: 'Dashboard session token required.' });
      if (request.method === 'GET' && route === '/api/state') {
        return send(response, 200, {
          root: state.root, scannedAt: state.scannedAt, skipped: state.skipped, job,
          repositories: state.repositories.map(repository => ({
            ...repository,
            // Full baseline hashes and process logs stay on disk, not in the overview payload.
            records: Object.fromEntries(Object.entries(repository.records).map(([key, value]) => [key, {
              at: value.at, passed: value.passed, state: value.state, profile: value.profile,
              scope: value.scope, availableChecks: value.measured?.availableChecks,
              matchedFiles: value.matchedFiles, baselineFiles: value.baselineFiles,
              note: value.note,
            }])),
            scores: scores(repository),
          })),
        });
      }
      if (request.method === 'GET' && route.startsWith('/api/evidence/')) {
        const repository = state.repositories.find(item => item.id === route.slice('/api/evidence/'.length));
        if (!repository) return send(response, 404, { error: 'Unknown repository.' });
        return send(response, 200, repository.records);
      }
      if (request.method === 'POST' && route === '/api/rescan') {
        if (job?.status === 'running') return send(response, 409, { error: 'Wait for the active job.' });
        const next = discover(state.root);
        // Rescan deliberately invalidates previous gates rather than displaying stale final scores.
        state = { schemaVersion: 1, ...next, scannedAt: new Date().toISOString() };
        save();
        return send(response, 200, { message: 'Directory rescanned; previous score gates reset.' });
      }
      if (request.method === 'POST' && route === '/api/task') {
        if (job?.status === 'running') return send(response, 409, { error: 'A medikit job is already running.' });
        const input = await body(request);
        const repository = state.repositories.find(item => item.id === input.repositoryId);
        if (!repository || !actions.includes(input.action)) return send(response, 400, { error: 'Unknown repository or medikit action.' });
        if (input.action === 'preserve' && (typeof input.backup !== 'string' || typeof input.workingCopy !== 'string')) {
          return send(response, 400, { error: 'Backup and working-copy paths are required.' });
        }
        const invalidated = actions.slice(actions.indexOf(input.action)).map(action =>
          action === 'inspect' ? 'inspection' : action === 'preserve' ? 'preservation' : action === 'recover' ? 'recovery' : action);
        for (const key of invalidated) delete repository.records[key];
        save();
        job = { id: crypto.randomUUID(), repositoryId: repository.id, action: input.action, status: 'running', startedAt: new Date().toISOString() };
        const jobId = job.id;
        worker = new Worker(new URL('./worker.mjs', import.meta.url), {
          workerData: { repository, action: input.action, input, forbiddenRoots: [root, projectRoot, data] },
        });
        const taskWorker = worker;
        function fail(message) {
          if (job.id !== jobId) return;
          job = { ...job, status: 'failed', error: message, finishedAt: new Date().toISOString() };
          console.error(`Medikit ${input.action}: ${message}`);
        }
        worker.once('message', message => {
          if (message.error) return fail(message.error);
          try {
            const index = actions.indexOf(input.action);
            for (const later of actions.slice(index + 1)) {
              const key = later === 'inspect' ? 'inspection' : later === 'preserve' ? 'preservation' : later === 'recover' ? 'recovery' : later;
              delete repository.records[key];
            }
            const key = input.action === 'inspect' ? 'inspection' : input.action === 'preserve' ? 'preservation' : input.action === 'recover' ? 'recovery' : input.action;
            repository.records[key] = message.result;
            save();
            job = { ...job, status: 'completed', finishedAt: new Date().toISOString() };
          } catch (error) {
            const key = input.action === 'inspect' ? 'inspection' : input.action === 'preserve' ? 'preservation' : input.action === 'recover' ? 'recovery' : input.action;
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
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', resolve);
  });
  origin = `http://127.0.0.1:${server.address().port}`;
  save();
  return { server, origin, close: async () => {
    if (worker) await worker.terminate();
    await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  } };
}

async function main(args) {
  const options = { root: path.dirname(projectRoot), data: path.join(os.homedir(), '.moorkyz-recovery', 'dashboard'), port: 4317 };
  for (let index = 0; index < args.length; index += 2) {
    const key = args[index]?.slice(2);
    if (!['root', 'data', 'port'].includes(key) || !args[index + 1]) throw new Error('Use --root <directory> --data <external-directory> --port <number>.');
    options[key] = key === 'port' ? Number(args[index + 1]) : args[index + 1];
  }
  if (!Number.isInteger(options.port) || options.port < 1 || options.port > 65535) throw new Error('Port must be an integer from 1 to 65535.');
  const app = await startDashboard(options);
  console.log(`Recovery dashboard: ${app.origin}`);
  console.log(`Directory: ${options.root}`);
  console.log(`Private evidence: ${options.data}`);
  console.log('No repository repairs run automatically. Ctrl+C stops the server.');
  for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => app.close().then(() => process.exit(0)));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2)).catch(error => { console.error(`Dashboard error: ${error.message}`); process.exitCode = 1; });
}
