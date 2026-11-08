import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import os from 'node:os';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { inspect, snapshot } from '../src/dashboard/engine.mjs';
import { acquire } from '../src/dashboard/acquisition.mjs';
import { createDemoPortfolio } from '../scripts/demo.mjs';

const server = fileURLToPath(new URL('../src/dashboard/server.mjs', import.meta.url));

function temporary(t) {
  const base = fs.mkdtempSync(path.join(fs.realpathSync.native(os.tmpdir()), 'recovery-interrupt-'));
  t.after(() => fs.rmSync(base, { recursive: true, force: true }));
  return base;
}

test('acquisition races after a preview are refused before any byte is written, and a retry with new destinations verifies', t => {
  const base = temporary(t);
  const demo = createDemoPortfolio(path.join(base, 'demo'));
  const source = path.join(demo.root, 'lost-commits');
  const repo = { path: source, records: { inspection: inspect(source) } };
  const before = snapshot(source).fingerprint;
  const copies = { backup: path.join(base, 'backup'), workingCopy: path.join(base, 'working') };
  const preview = acquire(repo, 'acquire-preview', copies, [demo.root]);
  fs.mkdirSync(copies.workingCopy); // another program claims the second destination after the preview
  assert.throws(() => acquire(repo, 'acquire-apply', { ...copies, approved: true, planHash: preview.planHash }, [demo.root]), /already exists/);
  assert.equal(fs.existsSync(copies.backup), false, 'no partial backup was started');
  fs.rmdirSync(copies.workingCopy);

  fs.mkdirSync(path.join(base, 'parent'));
  const moved = { backup: copies.backup, workingCopy: path.join(base, 'parent', 'working') };
  const movedPreview = acquire(repo, 'acquire-preview', moved, [demo.root]);
  fs.rmdirSync(path.join(base, 'parent')); // destination parent disappears after the preview
  assert.throws(() => acquire(repo, 'acquire-apply', { ...moved, approved: true, planHash: movedPreview.planHash }, [demo.root]), /ENOENT|parent/);
  assert.equal(fs.existsSync(copies.backup), false);
  assert.throws(() => acquire(repo, 'acquire-apply', { ...copies, approved: true, planHash: movedPreview.planHash }, [demo.root]), /Approve the unchanged/,
    'an approval for one plan cannot be replayed for another');

  const retryPreview = acquire(repo, 'acquire-preview', copies, [demo.root]);
  const verified = acquire(repo, 'acquire-apply', { ...copies, approved: true, planHash: retryPreview.planHash }, [demo.root]);
  assert.equal(verified.passed, true);
  assert.equal(snapshot(source).fingerprint, before, 'original unchanged through every refusal and the retry');
});

async function freePort() {
  const probe = net.createServer();
  await new Promise(resolve => probe.listen(0, '127.0.0.1', resolve));
  const { port } = probe.address();
  await new Promise(resolve => probe.close(resolve));
  return port;
}

async function launch(root, data) {
  const port = await freePort();
  const child = spawn(process.execPath, [server, '--root', root, '--data', data, '--port', String(port)], { stdio: ['ignore', 'pipe', 'pipe'] });
  let output = '';
  child.stdout.on('data', chunk => { output += chunk; });
  child.stderr.on('data', chunk => { output += chunk; });
  const origin = `http://127.0.0.1:${port}`;
  const deadline = Date.now() + 20_000;
  while (!output.includes('Recovery dashboard:')) {
    if (child.exitCode !== null || Date.now() > deadline) throw new Error(`Dashboard did not start: ${output}`);
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  const { token } = await (await fetch(`${origin}/api/session`)).json();
  const api = async (route, input) => {
    const response = await fetch(origin + route, { method: input ? 'POST' : 'GET', headers: { 'X-Recovery-Token': token, 'Content-Type': 'application/json' }, body: input && JSON.stringify(input) });
    return { status: response.status, body: await response.json() };
  };
  const settle = async () => {
    let state;
    do {
      await new Promise(resolve => setTimeout(resolve, 50));
      state = (await api('/api/state')).body;
    } while (state.job?.status === 'running');
    return state;
  };
  const kill = () => new Promise(resolve => {
    if (child.exitCode !== null || child.signalCode !== null) return resolve();
    child.once('exit', resolve);
    child.kill('SIGKILL');
  });
  return { api, settle, kill, child, output: () => output, origin, token };
}

test('killing the server during acquisition never leaves a copy marked verified and the original stays unchanged', { timeout: 180_000 }, async t => {
  const base = temporary(t);
  const demo = createDemoPortfolio(path.join(base, 'demo'));
  const source = path.join(demo.root, 'lost-commits');
  fs.mkdirSync(path.join(source, 'bulk'));
  for (let index = 0; index < 1500; index++) fs.writeFileSync(path.join(source, 'bulk', `file-${index}.txt`), `${index}\n`.repeat(200));
  const before = snapshot(source).fingerprint;
  const data = path.join(base, 'data');
  const copies = { backup: path.join(base, 'backup'), workingCopy: path.join(base, 'working') };
  let app = await launch(demo.root, data);
  t.after(() => app.child.exitCode === null && app.kill());
  const id = (await app.api('/api/state')).body.repositories.find(repo => repo.name === 'lost-commits').id;
  assert.equal((await app.api('/api/task', { repositoryId: id, action: 'inspect' })).status, 202);
  await app.settle();
  assert.equal((await app.api('/api/task', { repositoryId: id, action: 'acquire-preview', ...copies })).status, 202);
  const preview = (await app.settle()).job.status === 'completed' && (await app.api(`/api/evidence/${id}`)).body['acquire-preview'];
  assert.ok(preview?.planHash);
  assert.equal((await app.api('/api/task', { repositoryId: id, action: 'acquire-apply', ...copies, approved: true, planHash: preview.planHash })).status, 202);
  assert.equal((await app.api('/api/task', { repositoryId: id, action: 'acquire-apply', ...copies, approved: true, planHash: preview.planHash })).status, 409,
    'a duplicate submit while running is refused');
  const killDeadline = Date.now() + 20_000;
  while (!fs.existsSync(copies.backup) && app.child.exitCode === null && Date.now() < killDeadline) await new Promise(resolve => setTimeout(resolve, 5));
  await app.kill();

  app = await launch(demo.root, data);
  const restarted = (await app.api('/api/state')).body;
  assert.equal(restarted.job, null, 'no job is resumed or reported as successful after a crash');
  const repo = restarted.repositories.find(item => item.id === id);
  const evidence = (await app.api(`/api/evidence/${id}`)).body;
  t.diagnostic(evidence.preservation ? 'copy completed and was recorded before the kill'
    : `killed mid-acquisition; partial backup ${fs.existsSync(copies.backup) ? 'retained on disk' : 'not started'}`);
  if (evidence.preservation) {
    // The copy finished and was recorded before the kill: it must really verify.
    assert.equal(snapshot(copies.backup).fingerprint, before);
    assert.equal(snapshot(copies.workingCopy).fingerprint, before);
  } else {
    assert.ok(!repo.procedures.some(item => item.action === 'acquire-apply' && item.status === 'completed'));
    const interrupted = repo.procedures.find(item => item.action === 'acquire-apply' && item.status === 'interrupted');
    assert.ok(interrupted, 'the killed acquisition is recorded as interrupted after restart');
    assert.ok(repo.interrupted, 'the case is flagged for review');
    if (fs.existsSync(copies.backup)) assert.ok(repo.interrupted.partial.includes(copies.backup), 'partial folders are named');
    const report = await (await fetch(`${app.origin}/api/report.md?repository=${id}`, { headers: { 'X-Recovery-Token': app.token } })).text();
    assert.match(report, /INTERRUPTED operation/);
    assert.equal((await app.api('/api/task', { repositoryId: id, action: 'acquire-preview', ...copies })).status, 202);
    const retry = await app.settle();
    if (fs.existsSync(copies.backup)) {
      assert.equal(retry.job.status, 'failed');
      assert.match(retry.job.error, /already exists/, 'interrupted partial copies are never reused');
    }
  }
  assert.equal(snapshot(source).fingerprint, before, 'original unchanged after a hard kill');
  await app.kill();
});
