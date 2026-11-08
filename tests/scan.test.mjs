import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { readGit } from '../src/recovery.mjs';
import { snapshot } from '../src/dashboard/engine.mjs';
import { startDashboard } from '../src/dashboard/server.mjs';
import { createDemoPortfolio } from '../scripts/demo.mjs';

function workspace(t) {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'recovery-scan-'));
  const closers = [];
  t.after(async () => {
    for (const close of closers.reverse()) await close();
    fs.rmSync(base, { recursive: true, force: true });
  });
  return { base, closers };
}

async function open(w, root) {
  const app = await startDashboard({ root, data: path.join(w.base, `data-${w.closers.length}`), port: 0 });
  w.closers.push(() => app.close());
  const { token } = await (await fetch(`${app.origin}/api/session`)).json();
  async function raw(route, input) {
    return fetch(app.origin + route, {
      method: input === undefined ? 'GET' : 'POST',
      headers: { 'X-Recovery-Token': token, 'Content-Type': 'application/json' },
      body: input === undefined ? undefined : JSON.stringify(input),
    });
  }
  async function api(route, input, expected = 200) {
    const response = await raw(route, input);
    const text = await response.text();
    assert.equal(response.status, expected, `${route}: ${text}`);
    return text.startsWith('{') ? JSON.parse(text) : text;
  }
  async function settle() {
    const deadline = Date.now() + 120_000;
    let state;
    do {
      await new Promise(resolve => setTimeout(resolve, 40));
      state = await api('/api/state');
    } while (state.job?.status === 'running' && Date.now() < deadline);
    return state;
  }
  async function task(id, action, input = {}) {
    await api('/api/task', { repositoryId: id, action, ...input }, 202);
    const state = await settle();
    assert.equal(state.job.status, 'completed', `${action}: ${state.job.error}`);
    return api(`/api/evidence/${id}`);
  }
  return { app, raw, api, settle, task };
}

const fingerprints = root => Object.fromEntries(fs.readdirSync(root).map(name => [name, snapshot(path.join(root, name)).fingerprint]));

test('one scan discovers a mixed portfolio, reports evidence-backed findings and changes no original byte', async t => {
  const w = workspace(t);
  const demo = createDemoPortfolio(path.join(w.base, 'demo'));
  const outside = createDemoPortfolio(path.join(w.base, 'outside')).root;
  fs.symlinkSync(path.join(outside, 'lost-commits'), path.join(demo.root, 'linked-project'), process.platform === 'win32' ? 'junction' : 'dir');
  const before = fingerprints(demo.root);
  const outsideBefore = snapshot(path.join(outside, 'lost-commits')).fingerprint;
  const { api, settle } = await open(w, demo.root);

  const initial = await api('/api/state');
  assert.ok(initial.repositories.every(repo => repo.scan.status === 'not-scanned'));
  const started = await api('/api/scan', {}, 202);
  assert.equal(started.action, 'scan');
  assert.equal(started.progress.total, 6);
  const state = await settle();
  assert.equal(state.job.status, 'completed', state.job.error);
  assert.deepEqual(state.job.progress, { total: 6, done: 6, failed: 0, current: null });
  const byName = Object.fromEntries(state.repositories.map(repo => [repo.name, repo]));
  assert.deepEqual(Object.keys(byName).sort(), ['clean-project', 'corrupted-objects', 'deleted-branch', 'lost-commits', 'notes-without-git', 'overwritten-files']);
  assert.ok(state.skipped.some(item => item.path.endsWith('empty-folder')));
  assert.ok(state.skipped.some(item => item.path.endsWith('linked-project') && /link/.test(item.reason)), 'links/junctions are never followed');

  const lost = byName['lost-commits'].scan;
  assert.equal(lost.status, 'candidates-found');
  assert.equal(lost.candidates.candidates[0].commit, demo.expected['lost-commits'].lostCommit);
  assert.deepEqual(lost.candidates.candidates[0].comparison.onlyInCandidatePaths, ['src/feature.mjs']);
  assert.equal(byName['deleted-branch'].scan.candidates.candidates[0].commit, demo.expected['deleted-branch'].lostCommit);
  const overwritten = byName['overwritten-files'].scan;
  assert.equal(overwritten.status, 'no-candidates', 'committed overwrites are not invented as lost work');
  assert.equal(overwritten.candidates.candidates[0].commit, demo.expected['overwritten-files'].goodCommit);
  assert.equal(overwritten.candidates.candidates[0].comparison.changed, 2);
  assert.equal(byName['corrupted-objects'].scan.status, 'blocked');
  assert.match(byName['corrupted-objects'].scan.findings[0].evidence, new RegExp(demo.expected['corrupted-objects'].missingBlob));
  assert.equal(byName['clean-project'].scan.status, 'no-candidates');
  assert.ok(byName['clean-project'].scan.limitations.some(item => /clean Git status does not prove/.test(item)));
  assert.equal(byName['notes-without-git'].scan.status, 'needs-review');
  assert.ok(state.repositories.every(repo => repo.scan.gatesUpdated && repo.records.inspection), 'scan unlocks the next guided step');
  assert.ok(!JSON.stringify(state.repositories.map(repo => repo.scan)).match(/\d%/), 'scan results contain no percentages');

  assert.deepEqual(fingerprints(demo.root), before, 'every original, including .git, is byte-identical after scanning');
  assert.equal(snapshot(path.join(outside, 'lost-commits')).fingerprint, outsideBefore, 'linked target was not touched');

  const report = await api(`/api/report.md?repository=${byName['lost-commits'].id}`);
  assert.match(report, /Scan status: Recovery candidates found/);
  assert.match(report, new RegExp(`Candidate #1: ${demo.expected['lost-commits'].lostCommit}`));
  assert.match(report, /## Remaining limitations/);
  assert.match(report, /not sandboxed/);
  assert.doesNotMatch(report, /## clean-project/, 'single-case report contains only that case');
  await api('/api/report.md?repository=unknown', undefined, 404);
});

test('candidate selection accepts only listed commits and survives a restart', async t => {
  const w = workspace(t);
  const demo = createDemoPortfolio(path.join(w.base, 'demo'));
  const { api, settle } = await open(w, demo.root);
  await api('/api/scan', {}, 202);
  await settle();
  const id = (await api('/api/state')).repositories.find(repo => repo.name === 'lost-commits').id;
  const commit = demo.expected['lost-commits'].lostCommit;
  await api('/api/case', { repositoryId: id, type: 'select-candidate', commit: 'HEAD~1' }, 400);
  await api('/api/case', { repositoryId: id, type: 'select-candidate', commit: '../../etc/passwd' }, 400);
  await api('/api/case', { repositoryId: id, type: 'select-candidate', commit: 'f'.repeat(40) }, 400);
  await api('/api/case', { repositoryId: id, type: 'select-candidate', commit });
  const selected = (await api('/api/state')).repositories.find(repo => repo.id === id).selectedCandidate;
  assert.equal(selected.commit, commit);
  assert.equal(selected.subject, 'Add pricing feature');
  await w.closers.pop()();
  const reopened = await startDashboard({ root: demo.root, data: path.join(w.base, 'data-0'), port: 0 });
  w.closers.push(() => reopened.close());
  const { token } = await (await fetch(`${reopened.origin}/api/session`)).json();
  const state = await (await fetch(`${reopened.origin}/api/state`, { headers: { 'X-Recovery-Token': token } })).json();
  assert.equal(state.repositories.find(repo => repo.id === id).selectedCandidate.commit, commit);
  assert.equal(state.repositories.find(repo => repo.id === id).scan.status, 'candidates-found', 'saved scan results load without rescanning');
});

test('scan cancellation is confirmed, keeps finished results, and a retry completes the rest', async t => {
  const w = workspace(t);
  const root = path.join(w.base, 'many');
  fs.mkdirSync(root);
  for (let index = 0; index < 12; index++) {
    const folder = path.join(root, `repo-${String(index).padStart(2, '0')}`);
    fs.mkdirSync(folder);
    for (const args of [['init', '-q'], ['-c', 'user.name=F', '-c', 'user.email=f@example.invalid', '-c', 'commit.gpgsign=false', 'commit', '-q', '--allow-empty', '-m', 'empty']]) {
      assert.equal(readGit(folder, args).exitCode, 0);
    }
  }
  const before = fingerprints(root);
  const { api, settle } = await open(w, root);
  await api('/api/scan', {}, 202);
  await api('/api/scan', {}, 409);
  await api('/api/task', { repositoryId: (await api('/api/state')).repositories[0].id, action: 'inspect' }, 409);
  const cancel = await api('/api/cancel', {}, 202);
  assert.match(cancel.message, /Cancellation requested/);
  assert.equal((await api('/api/state')).job.cancelRequested, true);
  const cancelled = await settle();
  assert.equal(cancelled.job.status, 'cancelled');
  assert.ok(cancelled.job.progress.done < 12, `cancelled after ${cancelled.job.progress.done} repositories`);
  const scanned = cancelled.repositories.filter(repo => repo.scan.status !== 'not-scanned').length;
  assert.equal(scanned, cancelled.job.progress.done, 'every finished repository is saved; none is reported without evidence');
  await api('/api/cancel', {}, 409);
  await api('/api/scan', {}, 202);
  const retried = await settle();
  assert.equal(retried.job.status, 'completed');
  assert.equal(retried.job.progress.done, 12);
  assert.ok(retried.repositories.every(repo => repo.scan.status !== 'not-scanned'));
  assert.deepEqual(fingerprints(root), before);
});

test('an empty scan root starts cleanly and scans nothing without errors', async t => {
  const w = workspace(t);
  const root = path.join(w.base, 'empty-root');
  fs.mkdirSync(root);
  const { app, api, settle } = await open(w, root);
  const page = await (await fetch(app.origin)).text();
  assert.match(page, /Scan repositories/);
  assert.match(page, /Advanced mode/);
  await api('/api/scan', {}, 202);
  const state = await settle();
  assert.equal(state.job.status, 'completed');
  assert.deepEqual(state.job.progress, { total: 0, done: 0, failed: 0, current: null });
  assert.deepEqual(state.repositories, []);
});

test('guided recovery: scan, choose candidate, protect, compare, restore, test, validate and export without touching the original', async t => {
  const w = workspace(t);
  const demo = createDemoPortfolio(path.join(w.base, 'demo'));
  const expected = demo.expected['lost-commits'];
  const source = path.join(demo.root, 'lost-commits');
  const original = snapshot(source).fingerprint;
  const { api, settle, task } = await open(w, demo.root);
  await api('/api/scan', {}, 202);
  await settle();
  const id = (await api('/api/state')).repositories.find(repo => repo.name === 'lost-commits').id;
  await api('/api/case', { repositoryId: id, type: 'select-candidate', commit: expected.lostCommit });

  const copies = { backup: path.join(w.base, 'copies', 'backup'), workingCopy: path.join(w.base, 'copies', 'working') };
  fs.mkdirSync(path.join(w.base, 'copies'));
  const preview = (await task(id, 'acquire-preview', copies))['acquire-preview'];
  assert.equal(preview.requiredCopyBytes, preview.bytes * 2);
  assert.equal(fs.existsSync(copies.backup), false, 'preview creates nothing');
  await api('/api/task', { repositoryId: id, action: 'acquire-apply', ...copies, approved: true, planHash: 'stale' }, 202);
  assert.equal((await settle()).job.status, 'failed', 'apply with a mismatched preview is refused');
  await task(id, 'acquire-apply', { ...copies, approved: true, planHash: preview.planHash });
  await task(id, 'integrity');
  const history = (await task(id, 'history')).history;
  assert.equal(history.candidates.candidates[0].commit, expected.lostCommit, 'same candidate is found again in the working copy');
  const compared = (await task(id, 'compare', { ref: expected.lostCommit })).compare;
  assert.deepEqual(compared.files.filter(file => file.state === 'missing').map(file => file.file), [expected.file]);
  const selection = { ref: expected.lostCommit, file: expected.file };
  const restore = (await task(id, 'restore-preview', selection))['restore-preview'];
  assert.equal(restore.beforeHash, null);
  assert.equal(fs.existsSync(path.join(copies.workingCopy, expected.file)), false, 'restore preview writes nothing');
  await task(id, 'restore-apply', { ...selection, approved: true, planHash: restore.planHash });
  await task(id, 'integrity');
  const plan = (await task(id, 'quality-preview', { profile: 'node' }))['quality-preview'];
  assert.deepEqual(plan.commands.map(command => command.name), ['test']);
  await api('/api/task', { repositoryId: id, action: 'quality', profile: 'node' }, 202);
  assert.equal((await settle()).job.status, 'failed', 'project code never runs without explicit approval');
  const checks = (await task(id, 'quality', { profile: 'node', approved: true, planHash: plan.planHash })).quality;
  assert.equal(checks.passed, true);
  assert.match(checks.results[0].stdout, /pricing feature works/);
  const recovery = (await task(id, 'recover', { acceptance: 'Restored src/feature.mjs from the reflog-only commit; the project test passes on the working copy.' })).recovery;
  assert.equal(recovery.verifiedTargets[0].file, path.join(...expected.file.split('/')));
  assert.match(recovery.verification.original, /Unchanged/);
  assert.equal(recovery.originalFingerprint, original);

  const report = await api(`/api/report.md?repository=${id}`);
  assert.match(report, /Selected candidate: /);
  assert.match(report, /Restored target: src\\{0,2}.feature\.mjs/);
  assert.match(report, /Final verification \(original\): Unchanged since preservation/);
  assert.match(report, /Validation test: exit 0/);
  assert.equal(snapshot(source).fingerprint, original, 'original is byte-identical, including .git');
  assert.equal(fs.existsSync(path.join(source, expected.file)), false, 'the original still lacks the file; only the working copy was recovered');
  assert.equal(snapshot(copies.backup).fingerprint, original, 'backup is untouched');
  assert.equal(fs.readFileSync(path.join(copies.workingCopy, expected.file), 'utf8'), 'export const price = quantity => quantity * 21;\n');

  await api('/api/scan', {}, 202);
  const rescanned = (await settle()).repositories.find(repo => repo.id === id);
  assert.ok(rescanned.records.preservation && rescanned.records.recovery, 'a later scan keeps the gates of a case with verified copies');
  assert.equal(rescanned.scan.gatesUpdated, false);
  assert.equal(rescanned.scan.status, 'candidates-found');
});
