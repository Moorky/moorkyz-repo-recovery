import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import http from 'node:http';
import { discover, snapshot, inspect, preserve, integrity, quality, validateRecovery, scores, executeTask } from '../src/dashboard/engine.mjs';
import { startDashboard } from '../src/dashboard/server.mjs';

function fixture(t, node = false) {
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'moorkyz-medikit-test-'));
  t.after(() => fs.rmSync(folder, { recursive: true, force: true }));
  const root = path.join(folder, 'portfolio');
  const source = path.join(root, 'project');
  fs.mkdirSync(path.join(source, 'docs'), { recursive: true });
  fs.writeFileSync(path.join(source, 'README.md'), '# Fixture\n\n[Guide](docs/guide.md)\n');
  fs.writeFileSync(path.join(source, 'docs', 'guide.md'), '# Guide\n');
  if (node) fs.writeFileSync(path.join(source, 'package.json'), JSON.stringify({
    private: true, scripts: { test: 'node -e "process.exit(0)"', lint: 'node -e "process.exit(0)"' },
  }));
  const backup = path.join(folder, 'backup');
  const working = path.join(folder, 'working');
  fs.cpSync(source, backup, { recursive: true });
  fs.cpSync(source, working, { recursive: true });
  return { folder, root, source, backup, working };
}

test('discovery includes empty/source-only folders and nested project roots', t => {
  const f = fixture(t);
  fs.mkdirSync(path.join(f.root, 'empty'));
  fs.mkdirSync(path.join(f.source, 'nested'));
  fs.writeFileSync(path.join(f.source, 'nested', 'AGENTS.md'), '# Nested');
  const report = discover(f.root);
  assert.equal(report.repositories.length, 3);
  assert.ok(report.repositories.some(repo => repo.empty));
  assert.ok(report.repositories.some(repo => repo.name === path.join('project', 'nested')));
  for (const repo of report.repositories) {
    assert.equal(scores(repo).condition.status, 'estimate');
    assert.equal(scores(repo).quality.value, null);
    assert.equal(scores(repo).recovery.status, 'locked');
  }
});

test('exact score rubric and prerequisite gates, including a complete documentation case', t => {
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
  repo.records.quality = quality(f.source, repo.records.preservation, 'documentation', false);
  assert.equal(scores(repo).quality.status, 'final');
  assert.equal(scores(repo).quality.value, 84); // 45 * .3 + passing links * 70.
  repo.records.recovery = validateRecovery(f.source, repo.records.preservation, repo.records.integrity, repo.records.quality);
  assert.equal(scores(repo).recovery.value, 100);
  assert.equal(scores(repo).confidence.value, 100);
  assert.equal(repo.records.recovery.baselineFiles, 2);
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

test('changes to original, backup or validated candidate invalidate later gates', t => {
  const f = fixture(t);
  const preserved = preserve(f.source, f.backup, f.working, [f.root]);
  const objects = integrity(f.source, preserved);
  const checked = quality(f.source, preserved, 'documentation', false);
  fs.writeFileSync(path.join(f.working, 'new.txt'), 'changed after checks');
  assert.throws(() => validateRecovery(f.source, preserved, objects, checked), /changed after quality/);
  fs.writeFileSync(path.join(f.backup, 'new.txt'), 'changed backup');
  assert.throws(() => quality(f.source, preserved, 'documentation', false), /backup changed/);
  fs.writeFileSync(path.join(f.source, 'new.txt'), 'changed original');
  assert.throws(() => integrity(f.source, preserved), /Original changed/);
});

test('quality requires actual tests and explicit approval; scripts run only on the copy', t => {
  const f = fixture(t, true);
  const preserved = preserve(f.source, f.backup, f.working, [f.root]);
  assert.throws(() => quality(f.source, preserved, 'node', false), /approval/);
  assert.throws(() => quality(f.source, preserved, 'documentation', false), /cannot bypass/);
  const before = snapshot(f.source).fingerprint;
  const checked = quality(f.source, preserved, 'node', true);
  assert.equal(checked.passed, true, JSON.stringify(checked.results));
  assert.equal(checked.results.length, 2);
  assert.equal(snapshot(f.source).fingerprint, before);
  fs.writeFileSync(path.join(f.working, 'package.json'), JSON.stringify({ scripts: { lint: 'node -e "process.exit(0)"' } }));
  assert.throws(() => quality(f.source, preserved, 'node', true), /No package.json test/);
});

test('failed checks produce measured lower quality and block recovery', t => {
  const f = fixture(t, true);
  const preserved = preserve(f.source, f.backup, f.working, [f.root]);
  fs.writeFileSync(path.join(f.working, 'package.json'), JSON.stringify({ scripts: { test: 'node -e "process.exit(7)"' } }));
  const checked = quality(f.source, preserved, 'node', true);
  assert.equal(checked.passed, false);
  assert.equal(checked.results[0].exitCode, 7);
  assert.equal(checked.score, 21); // static 70 * .3, failed execution yields zero validation points.
  assert.throws(() => validateRecovery(f.source, preserved, integrity(f.source, preserved), checked), /must pass/);
});

test('recovery score measures baseline retention, not an invented loss percentage', t => {
  const f = fixture(t);
  const preserved = preserve(f.source, f.backup, f.working, [f.root]);
  fs.writeFileSync(path.join(f.working, 'docs', 'guide.md'), '# Revised guide\n');
  const checked = quality(f.source, preserved, 'documentation', false);
  const recovered = validateRecovery(f.source, preserved, integrity(f.source, preserved), checked);
  assert.equal(recovered.recoveryScore, 50);
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
  t.after(() => app.close());
  const api = await session(app);
  assert.equal((await fetch(`${app.origin}/api/state`)).status, 403);
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
  assert.equal((await api('/api/task', { repositoryId: 'unknown', action: 'reset' })).status, 400);
  let { payload } = await api('/api/state');
  const id = payload.repositories[0].id;
  for (const [action, input] of [
    ['inspect', {}], ['preserve', { backup: f.backup, workingCopy: f.working }],
    ['integrity', {}], ['quality', { profile: 'documentation' }], ['recover', {}],
  ]) {
    assert.equal((await api('/api/task', { repositoryId: id, action, ...input })).status, 202);
    payload = await waitJob(api);
    assert.equal(payload.job.status, 'completed', payload.job.error);
  }
  assert.equal(payload.repositories[0].scores.recovery.value, 100);
  assert.equal((await api(`/api/evidence/${id}`)).payload.recovery.recoveryScore, 100);
  assert.equal(JSON.parse(fs.readFileSync(path.join(data, 'dashboard-state.json'))).repositories[0].records.recovery.recoveryScore, 100);
  await api('/api/task', { repositoryId: id, action: 'preserve', backup: 'missing', workingCopy: f.working });
  payload = await waitJob(api);
  assert.equal(payload.job.status, 'failed');
  assert.equal(payload.repositories[0].scores.recovery.status, 'locked');
  await api('/api/rescan', {});
  payload = (await api('/api/state')).payload;
  assert.equal(payload.repositories[0].scores.condition.status, 'estimate');
});

test('rejects private data inside scan root before creating it', async t => {
  const f = fixture(t);
  const data = path.join(f.root, 'forbidden');
  await assert.rejects(startDashboard({ root: f.root, data, port: 0 }), /outside/);
  assert.equal(fs.existsSync(data), false);
});
