import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import http from 'node:http';
import { discover, snapshot, inspect, preserve, integrity, quality, qualityPreview, validateRecovery, scores, executeTask } from '../src/dashboard/engine.mjs';
import { startDashboard } from '../src/dashboard/server.mjs';
import { openStore } from '../src/dashboard/store.mjs';
import { initialize, updateCase, estimatePairs, lifecycleView, observe } from '../src/dashboard/assessment.mjs';
import { fix } from '../src/dashboard/fixes.mjs';

function fixture(t, node = false) {
  const folder = fs.mkdtempSync(path.join(fs.realpathSync.native(os.tmpdir()), 'moorkyz-medikit-test-'));
  const resources = [];
  t.after(async () => {
    for (const close of resources) await close();
    fs.rmSync(folder, { recursive: true, force: true });
  });
  const root = path.join(folder, 'portfolio');
  const source = path.join(root, 'project');
  fs.mkdirSync(path.join(source, 'docs'), { recursive: true });
  fs.writeFileSync(path.join(source, 'README.md'), '# Fixture\n\n[Guide](docs/guide.md)\n');
  fs.writeFileSync(path.join(source, 'docs', 'guide.md'), '# Guide\n');
  fs.writeFileSync(path.join(source, 'PROJECT_MANIFEST.json'), '{}');
  if (node) fs.writeFileSync(path.join(source, 'package.json'), JSON.stringify({
    private: true, scripts: { test: 'node -e "process.exit(0)"', lint: 'node -e "process.exit(0)"' },
  }));
  const backup = path.join(folder, 'backup');
  const working = path.join(folder, 'working');
  fs.cpSync(source, backup, { recursive: true });
  fs.cpSync(source, working, { recursive: true });
  return { folder, root, source, backup, working, resources };
}

test('discovery excludes ordinary directories and nested components', t => {
  const f = fixture(t);
  fs.mkdirSync(path.join(f.root, 'empty'));
  fs.mkdirSync(path.join(f.source, 'nested'));
  fs.writeFileSync(path.join(f.source, 'nested', 'AGENTS.md'), '# Nested');
  const report = discover(f.root);
  assert.equal(report.repositories.length, 1);
  assert.ok(report.skipped.some(item => item.path === path.join(f.root, 'empty')));
  assert.ok(!report.repositories.some(repo => repo.name === path.join('project', 'nested')));
  for (const repo of report.repositories) {
    assert.equal(scores(repo).condition.status, 'estimate');
    assert.equal(scores(repo).quality.value, null);
    assert.equal(scores(repo).recovery.status, 'locked');
  }
});

test('exact score rubric and prerequisite gates, including a complete documentation case', async t => {
  const f = fixture(t);
  const repo = discover(f.root).repositories[0];
  assert.throws(() => executeTask(repo, 'quality', {}, [f.root]), /inspection first/);
  repo.records.inspection = inspect(f.source);
  assert.equal(scores(repo).condition.value, 23); // (README 20 + docs 25) / 2, rounded.
  assert.equal(scores(repo).condition.status, 'final');
  assert.equal(scores(repo).quality.value, 45);
  assert.equal(scores(repo).quality.status, 'estimate');
  assert.throws(() => executeTask(repo, 'recover', {}, [f.root]), /preservation first/);
  repo.records.preservation = preserve(f.source, f.backup, f.working, [f.root]);
  assert.equal(scores(repo).confidence.value, 40);
  repo.records.integrity = integrity(f.source, repo.records.preservation);
  assert.equal(repo.records.integrity.hasGit, false);
  assert.equal(scores(repo).confidence.value, 60);
  repo.records.quality = await quality(f.source, repo.records.preservation, 'documentation', false);
  assert.equal(scores(repo).quality.status, 'final');
  assert.equal(scores(repo).quality.value, 84); // 45 * .3 + passing links * 70.
  repo.records.recovery = validateRecovery(f.source, repo.records.preservation, repo.records.integrity, repo.records.quality);
  assert.equal(scores(repo).recovery.value, 100);
  assert.equal(scores(repo).confidence.value, 100);
  assert.equal(repo.records.recovery.baselineFiles, 3);
});

test('preservation rejects mismatched copies, overlapping paths and linked metadata', t => {
  const f = fixture(t);
  assert.throws(() => preserve(f.source, f.source, f.working, [f.root]), /overlap/);
  assert.throws(() => preserve(f.source, f.backup, f.backup, [f.root]), /independent/);
  fs.writeFileSync(path.join(f.backup, 'README.md'), 'changed');
  assert.throws(() => preserve(f.source, f.backup, f.working, [f.root]), /Backup differs/);
  fs.writeFileSync(path.join(f.source, '.git'), 'gitdir: elsewhere');
  assert.throws(() => preserve(f.source, f.backup, f.working, [f.root]), /External Git metadata/);
});

test('unknown condition is blocked when Git inspection fails', t => {
  const f = fixture(t);
  fs.mkdirSync(path.join(f.source, '.git'));
  const repo = discover(f.root).repositories[0];
  repo.records.inspection = inspect(f.source);
  assert.equal(scores(repo).condition.status, 'blocked');
  assert.equal(scores(repo).condition.value, null);
  assert.ok(repo.records.inspection.commands.some(result => result.exitCode !== 0));
});

test('changes to original, backup or validated candidate invalidate later gates', async t => {
  const f = fixture(t);
  const preserved = preserve(f.source, f.backup, f.working, [f.root]);
  const objects = integrity(f.source, preserved);
  const checked = await quality(f.source, preserved, 'documentation', false);
  fs.writeFileSync(path.join(f.working, 'new.txt'), 'changed after checks');
  assert.throws(() => validateRecovery(f.source, preserved, objects, checked), /changed after quality/);
  fs.writeFileSync(path.join(f.backup, 'new.txt'), 'changed backup');
  await assert.rejects(quality(f.source, preserved, 'documentation', false), /backup changed/);
  fs.writeFileSync(path.join(f.source, 'new.txt'), 'changed original');
  assert.throws(() => integrity(f.source, preserved), /Original changed/);
});

test('quality requires actual tests and explicit approval; scripts run only on the copy', async t => {
  const f = fixture(t, true);
  const preserved = preserve(f.source, f.backup, f.working, [f.root]);
  await assert.rejects(quality(f.source, preserved, 'node', false), /approval/);
  await assert.rejects(quality(f.source, preserved, 'documentation', false), /cannot bypass/);
  const before = snapshot(f.source).fingerprint;
  const checked = await quality(f.source, preserved, 'node', true, { planHash: qualityPreview(f.source, preserved, { profile: 'node' }).planHash });
  assert.equal(checked.passed, true, JSON.stringify(checked.results));
  assert.equal(checked.results.length, 2);
  assert.equal(snapshot(f.source).fingerprint, before);
  fs.writeFileSync(path.join(f.working, 'package.json'), JSON.stringify({ scripts: { lint: 'node -e "process.exit(0)"' } }));
  await assert.rejects(quality(f.source, preserved, 'node', true), /No package.json test/);
});

test('failed checks produce measured lower quality and block recovery', async t => {
  const f = fixture(t, true);
  const preserved = preserve(f.source, f.backup, f.working, [f.root]);
  fs.writeFileSync(path.join(f.working, 'package.json'), JSON.stringify({ scripts: { test: 'node -e "process.exit(7)"' } }));
  const checked = await quality(f.source, preserved, 'node', true, { planHash: qualityPreview(f.source, preserved, { profile: 'node' }).planHash });
  assert.equal(checked.passed, false);
  assert.equal(checked.results[0].exitCode, 7);
  assert.equal(checked.score, 21); // static 70 * .3, failed execution yields zero validation points.
  assert.throws(() => validateRecovery(f.source, preserved, integrity(f.source, preserved), checked), /must pass/);
});

test('quality executes the declared type-check alias and records its failure', async t => {
  const f = fixture(t, true);
  const manifest = JSON.stringify({ scripts: {
    test: 'node -e "process.exit(0)"',
    'type-check': 'node -e "process.exit(9)"',
  } });
  for (const folder of [f.source, f.backup, f.working]) fs.writeFileSync(path.join(folder, 'package.json'), manifest);
  const preserved = preserve(f.source, f.backup, f.working, [f.root]);
  const checked = await quality(f.source, preserved, 'node', true, { planHash: qualityPreview(f.source, preserved, { profile: 'node' }).planHash });
  assert.equal(checked.passed, false);
  assert.deepEqual(checked.results.map(result => [result.check, result.exitCode]), [['test', 0], ['type-check', 9]]);
});

test('recovery score measures baseline retention, not an invented loss percentage', async t => {
  const f = fixture(t);
  const preserved = preserve(f.source, f.backup, f.working, [f.root]);
  fs.writeFileSync(path.join(f.working, 'docs', 'guide.md'), '# Revised guide\n');
  const checked = await quality(f.source, preserved, 'documentation', false);
  const recovered = validateRecovery(f.source, preserved, integrity(f.source, preserved), checked);
  assert.equal(recovered.recoveryScore, 67);
  assert.equal(recovered.confidenceScore, 100);
  assert.match(recovered.scope, /not a probability/);
});

async function session(app) {
  const response = await fetch(`${app.origin}/api/session`);
  const { token } = await response.json();
  return async (route, input, customHeaders = {}) => {
    const response = await fetch(app.origin + route, {
      method: input === undefined ? 'GET' : 'POST',
      headers: { 'X-Recovery-Token': token, 'Content-Type': 'application/json', ...customHeaders },
      body: input === undefined ? undefined : JSON.stringify(input),
    });
    return { status: response.status, payload: await response.json() };
  };
}
async function waitJob(api) {
  for (let attempt = 0; attempt < 200; attempt++) {
    const { payload } = await api('/api/state');
    if (payload.job.status !== 'running') return payload;
    await new Promise(resolve => setTimeout(resolve, 25));
  }
  throw new Error('Job did not finish within test timeout.');
}

test('loopback API enforces session/origin and persists gated medikit evidence', async t => {
  const f = fixture(t);
  const data = path.join(f.folder, 'private');
  const app = await startDashboard({ root: f.root, data, port: 0 });
  f.resources.push(() => app.close());
  const api = await session(app);
  assert.equal((await fetch(`${app.origin}/api/state`)).status, 403);
  assert.equal((await fetch(`${app.origin}/api/report.md`)).status, 403);
  assert.equal((await api('/api/state', undefined, { Origin: 'https://example.invalid' })).status, 403);
  const rejectedHost = await new Promise((resolve, reject) => {
    const request = http.get(app.origin, { headers: { Host: 'bad.invalid' } }, response => {
      response.resume();
      resolve(response.statusCode);
    });
    request.once('error', reject);
  });
  assert.equal(rejectedHost, 403);
  assert.equal((await fetch(`${app.origin}/`)).status, 200);
  const moduleResponse = await fetch(`${app.origin}/list-model.mjs`);
  assert.equal(moduleResponse.status, 200);
  assert.match(moduleResponse.headers.get('content-type'), /javascript/);
  assert.equal(moduleResponse.headers.get('set-cookie'), null);
  for (const route of ['/workspace.mjs', '/workspace-model.mjs', '/diagnostics-model.mjs', '/guidance.mjs', '/guidance-model.mjs']) {
    const response = await fetch(app.origin + route);
    assert.equal(response.status, 200);
    assert.match(response.headers.get('content-type'), /javascript/);
  }
  const favicon = await fetch(app.origin + '/favicon.svg');
  assert.equal(favicon.status, 200);
  assert.match(favicon.headers.get('content-type'), /image\/svg\+xml/);
  assert.match(await favicon.text(), /<svg/);
  const font = await fetch(app.origin + '/fonts/DMMono-Regular.ttf');
  assert.equal(font.status, 200);
  assert.equal(font.headers.get('content-type'), 'font/ttf');
  assert.equal(Buffer.from(await font.arrayBuffer()).readUInt32BE(0), 0x00010000);
  for (const route of ['/docs', '/setup', '/manual', '/workflow', '/guide/restore-file', '/procedure-source/restore-file']) {
    assert.equal((await fetch(app.origin + route)).status, 200, route);
  }
  const archiveResponse = await fetch(app.origin + '/download/source.zip');
  assert.equal(archiveResponse.status, 200);
  assert.equal(archiveResponse.headers.get('content-type'), 'application/zip');
  assert.ok(archiveResponse.headers.get('content-disposition').includes('attachment'));
  assert.equal((await fetch(app.origin + '/guide/unknown')).status, 404);
  assert.equal((await api('/api/task', { repositoryId: 'unknown', action: 'reset' })).status, 400);
  let { payload } = await api('/api/state');
  const id = payload.repositories[0].id;
  for (const [action, input] of [
    ['inspect', {}], ['preserve', { backup: f.backup, workingCopy: f.working }],
    ['integrity', {}], ['quality', { profile: 'documentation' }], ['recover', { acceptance: 'Fixture documentation is readable and local links pass; no product functionality claimed.' }],
  ]) {
    assert.equal((await api('/api/task', { repositoryId: id, action, ...input })).status, 202);
    payload = await waitJob(api);
    assert.equal(payload.job.status, 'completed', payload.job.error);
  }
  assert.equal(payload.repositories[0].scores.recovery.value, 100);
  const { token } = await (await fetch(`${app.origin}/api/session`)).json();
  const exported = await fetch(`${app.origin}/api/report.md`, { headers: { 'X-Recovery-Token': token } });
  assert.equal(exported.status, 200);
  assert.match(exported.headers.get('content-type'), /text\/markdown/);
  assert.match(exported.headers.get('content-disposition'), /attachment/);
  const markdown = await exported.text();
  assert.match(markdown, /# Local recovery evidence report/);
  assert.match(markdown, /source-only/);
  assert.match(markdown, /recovery: recorded at/);
  assert.equal((await api(`/api/evidence/${id}`)).payload.recovery.recoveryScore, 100);
  assert.equal(fs.readFileSync(path.join(data, 'recovery.sqlite')).subarray(0, 15).toString(), 'SQLite format 3');
  const procedure = payload.repositories[0].procedures[0];
  assert.ok(procedure.durationMs >= 0);
  assert.equal(payload.repositories[0].records.preservation.summary.files, 3);
  assert.equal(payload.repositories[0].records.inspection.summary.missingIndexPaths, null);
  assert.equal((await api('/api/case', { repositoryId: id, type: 'procedure-rating', procedureId: procedure.id,
    helpingFactor: 61, rationale: 'Useful initial diagnosis, not a cure.' })).status, 200);
  assert.equal((await api('/api/state')).payload.repositories[0].procedures[0].helpingFactor, 61);
  assert.equal((await api('/api/case', { repositoryId: id, type: 'estimates', pair: 'potential',
    condition: 50, quality: 150, confidence: 100, rationale: 'Reviewed local target.' })).status, 200);
  assert.equal((await api('/api/state')).payload.repositories[0].estimates.potential.recovery, 75);
  fs.writeFileSync(path.join(f.working, 'docs', 'guide.md'), 'damaged\n');
  const remedyInput = { repositoryId: id, remedy: 'restore-file', file: path.join('docs', 'guide.md') };
  assert.equal((await api('/api/task', { ...remedyInput, action: 'fix-preview' })).status, 202);
  payload = await waitJob(api);
  assert.equal(payload.job.status, 'completed', payload.job.error);
  const preview = (await api(`/api/evidence/${id}`)).payload['fix-preview'];
  assert.equal((await api('/api/task', { ...remedyInput, action: 'fix-apply', approved: true, planHash: preview.planHash })).status, 202);
  payload = await waitJob(api);
  assert.equal(payload.job.status, 'completed', payload.job.error);
  assert.equal(fs.readFileSync(path.join(f.working, 'docs', 'guide.md'), 'utf8'), '# Guide\n');
  assert.equal(payload.repositories[0].records.quality, undefined);
  assert.equal(payload.repositories[0].records.recovery, undefined);
  assert.match(payload.repositories[0].case.cure, /restore-file/);
  await api('/api/task', { repositoryId: id, action: 'preserve', backup: 'missing', workingCopy: f.working });
  payload = await waitJob(api);
  assert.equal(payload.job.status, 'failed');
  assert.equal(payload.repositories[0].scores.recovery.status, 'locked');
  await api('/api/rescan', {});
  payload = (await api('/api/state')).payload;
  assert.equal(payload.repositories[0].scores.condition.status, 'estimate');
});

test('paired estimates support relational values above 100 and do not multiply confidence', t => {
  const f = fixture(t);
  const repo = initialize(discover(f.root).repositories[0], '2026-10-30T10:00:00Z');
  repo.records.inspection = inspect(f.source);
  updateCase(repo, { type: 'estimates', pair: 'potential', condition: 50, quality: 150, confidence: 100, rationale: 'Reviewed target coverage' });
  updateCase(repo, { type: 'estimates', pair: 'current', condition: 50, quality: 100, confidence: 35, rationale: 'Limited evidence' });
  assert.equal(estimatePairs(repo).potential.recovery, 75);
  assert.equal(estimatePairs(repo).current.recovery, 50);
  assert.equal(estimatePairs(repo).current.confidence, 35);
  assert.throws(() => updateCase(repo, { type: 'estimates', pair: 'current', condition: 101, quality: 100, confidence: 50, rationale: 'invalid' }), /0 to 100/);
  assert.throws(() => updateCase(repo, { type: 'estimates', pair: 'current', condition: 50, quality: Infinity, confidence: 50, rationale: 'invalid' }), /finite/);
});

test('lifecycle preserves first-seen and unchanged observation times and requires final reports', t => {
  const f = fixture(t);
  const repo = initialize(discover(f.root).repositories[0], '2026-10-30T10:00:00Z');
  const inspection = inspect(f.source);
  observe(repo, inspection);
  const unchanged = repo.lifecycle.unchangedSince;
  observe(repo, { ...inspection, at: '2026-10-30T12:00:00Z' });
  assert.equal(repo.lifecycle.unchangedSince, unchanged);
  assert.throws(() => updateCase(repo, { type: 'dismiss' }), /final report/);
  repo.case.finalReport = 'Outside recovery scope.';
  updateCase(repo, { type: 'dismiss' }, '2026-10-30T13:00:00Z');
  const life = lifecycleView(repo, Date.parse('2026-10-30T15:00:00Z'));
  assert.equal(life.totalStayMs, 3 * 3600000);
  assert.equal(life.status, 'dismissed');
  assert.throws(() => updateCase(repo, { type: 'deliver' }), /Validate recovery/);
});

test('SQLite restores case, evidence, procedure ratings and transactional records', t => {
  const f = fixture(t);
  const data = path.join(f.folder, 'sqlite');
  fs.mkdirSync(data);
  const store = openStore(data, f.root);
  const state = { schemaVersion: 1, ...discover(f.root), scannedAt: new Date().toISOString() };
  const repo = initialize(state.repositories[0]);
  repo.records.inspection = inspect(f.source);
  repo.procedures.push({ id: 'procedure1', name: 'inspect', at: new Date().toISOString(), helpingFactor: null });
  updateCase(repo, { type: 'procedure-rating', procedureId: 'procedure1', helpingFactor: 72, rationale: 'Resolved uncertainty about source layout.' });
  store.save(state);
  store.close();
  const reopened = openStore(data, f.root);
  const loaded = reopened.load();
  assert.equal(loaded.repositories[0].procedures[0].helpingFactor, 72);
  assert.equal(loaded.repositories[0].records.inspection.state, 'source-only');
  assert.equal(loaded.repositories[0].history.at(-1).reason, 'Procedure helping factor reviewed');
  reopened.close();
});

test('migrates existing JSON evidence into SQLite without altering legacy source', t => {
  const f = fixture(t);
  const data = path.join(f.folder, 'migration');
  fs.mkdirSync(data);
  const state = { schemaVersion: 1, ...discover(f.root), scannedAt: new Date().toISOString() };
  const repository = state.repositories[0];
  repository.records.inspection = inspect(f.source);
  const original = JSON.stringify(state);
  fs.writeFileSync(path.join(data, 'dashboard-state.json'), original);
  const store = openStore(data, f.root);
  assert.equal(store.load().repositories[0].records.inspection.state, 'source-only');
  store.close();
  assert.equal(fs.readFileSync(path.join(data, 'dashboard-state.json'), 'utf8'), original);
});

test('repository-root scan lists no README/package-bearing components unless they own Git metadata', t => {
  const f = fixture(t, true);
  fs.mkdirSync(path.join(f.source, 'packages', 'child'), { recursive: true });
  fs.writeFileSync(path.join(f.source, 'packages', 'child', 'package.json'), '{}');
  assert.equal(discover(f.source).repositories.length, 1);
  fs.mkdirSync(path.join(f.source, 'packages', 'child', '.git'));
  assert.equal(discover(f.source).repositories.length, 2);
});

test('actual fix scripts preview, require exact approval and only modify working copies', t => {
  const f = fixture(t);
  const repo = initialize(discover(f.root).repositories[0]);
  repo.records.preservation = preserve(f.source, f.backup, f.working, [f.root]);
  const originalHash = snapshot(f.source).fingerprint;
  fs.writeFileSync(path.join(f.working, 'docs', 'guide.md'), 'changed\r\n');
  const input = { remedy: 'restore-file', file: path.join('docs', 'guide.md') };
  const preview = fix(repo, 'fix-preview', input);
  assert.equal(preview.changed, true);
  assert.throws(() => fix(repo, 'fix-apply', input), /Approve/);
  const applied = fix(repo, 'fix-apply', { ...input, approved: true, planHash: preview.planHash });
  assert.equal(applied.passed, true);
  assert.equal(snapshot(f.source).fingerprint, originalHash);
  assert.equal(snapshot(f.backup).fingerprint, originalHash);
  fs.writeFileSync(path.join(f.working, 'docs', 'guide.md'), '# Guide\r\n');
  const normalize = { remedy: 'normalize-text', file: path.join('docs', 'guide.md') };
  const next = fix(repo, 'fix-preview', normalize);
  fix(repo, 'fix-apply', { ...normalize, approved: true, planHash: next.planHash });
  assert.equal(fs.readFileSync(path.join(f.working, 'docs', 'guide.md'), 'utf8'), '# Guide\n');
  fs.writeFileSync(path.join(f.working, 'README.md'), '[Guide](broken.md)\n');
  const link = { remedy: 'repair-link', file: 'README.md', oldTarget: 'broken.md', newTarget: 'docs/guide.md' };
  const linkPlan = fix(repo, 'fix-preview', link);
  fix(repo, 'fix-apply', { ...link, approved: true, planHash: linkPlan.planHash });
  assert.match(fs.readFileSync(path.join(f.working, 'README.md'), 'utf8'), /docs\/guide.md/);
  assert.throws(() => fix(repo, 'fix-preview', { ...input, file: '../outside.txt' }), /inside/);
  fs.mkdirSync(path.join(f.working, '.git'));
  assert.throws(() => fix(repo, 'fix-preview', { ...input, file: path.join('.git', 'config') }), /Git metadata/);
});

test('rejects private data inside scan root before creating it', async t => {
  const f = fixture(t);
  const data = path.join(f.root, 'forbidden');
  await assert.rejects(startDashboard({ root: f.root, data, port: 0 }), /outside/);
  assert.equal(fs.existsSync(data), false);
});
