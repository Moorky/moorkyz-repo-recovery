import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { readGit } from '../src/recovery.mjs';
import { inspect, snapshot, integrity, quality, qualityPreview, validateRecovery } from '../src/dashboard/engine.mjs';
import { acquire } from '../src/dashboard/acquisition.mjs';
import { history, compareHistory, restoreHistory, rescueCommit } from '../src/dashboard/history.mjs';
import { remoteRecovery } from '../src/dashboard/remote.mjs';
import { checkPlan, runCheck } from '../src/dashboard/checks.mjs';
import { invalidatedKeys } from '../src/dashboard/procedures.mjs';
import { startDashboard } from '../src/dashboard/server.mjs';

function fixture(t) {
  const folder = fs.mkdtempSync(path.join(fs.realpathSync.native(os.tmpdir()), 'recovery-workflow-'));
  const root = path.join(folder, 'portfolio');
  const source = path.join(root, 'project');
  fs.mkdirSync(path.join(source, 'src'), { recursive: true });
  const hooks = path.join(folder, 'empty-hooks');
  fs.mkdirSync(hooks);
  const gitAt = (cwd, ...args) => {
    const result = readGit(cwd, ['-c', `core.hooksPath=${hooks}`, ...args]);
    assert.equal(result.exitCode, 0, result.stderr);
    return result.stdout.trim();
  };
  const git = (...args) => gitAt(source, ...args);
  git('init', '--initial-branch=main');
  fs.writeFileSync(path.join(source, 'README.md'), '# Original product\n');
  fs.writeFileSync(path.join(source, 'src', 'feature.mjs'), 'export const value = 42;\n');
  fs.writeFileSync(path.join(source, 'check.mjs'), "import { value } from './src/feature.mjs'; if (value !== 42) process.exit(1);\n");
  fs.writeFileSync(path.join(source, 'package.json'), JSON.stringify({ private: true, type: 'module', scripts: { test: 'node check.mjs' } }));
  const commit = message => {
    git('add', '.');
    git('-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', '-c', 'commit.gpgsign=false', 'commit', '-m', message);
    return git('rev-parse', 'HEAD');
  };
  const original = commit('Complete product');
  fs.unlinkSync(path.join(source, 'src', 'feature.mjs'));
  fs.writeFileSync(path.join(source, 'README.md'), '# Reduced product\n');
  const reduced = commit('Removed implementation');
  const repo = { name: 'project', path: source, hasGit: true, records: { inspection: inspect(source) } };
  const destinations = { backup: path.join(folder, 'backup'), workingCopy: path.join(folder, 'working') };
  const secure = () => {
    const preview = acquire(repo, 'acquire-preview', destinations, [root]);
    repo.records.preservation = acquire(repo, 'acquire-apply', { ...destinations, approved: true, planHash: preview.planHash }, [root]);
    return repo.records.preservation;
  };
  t.after(() => fs.rmSync(folder, { recursive: true, force: true }));
  return { folder, root, source, repo, destinations, original, reduced, git, gitAt, commit, secure };
}

test('acquisition previews exact full-copy bytes, requires current approval, and never overwrites', t => {
  const f = fixture(t);
  const before = snapshot(f.source).fingerprint;
  const preview = acquire(f.repo, 'acquire-preview', f.destinations, [f.root]);
  assert.equal(preview.requiredCopyBytes, preview.bytes * 2);
  assert.ok(preview.files > 10);
  assert.equal(fs.existsSync(f.destinations.backup), false);
  assert.throws(() => acquire(f.repo, 'acquire-apply', f.destinations, [f.root]), /Approve/);
  fs.writeFileSync(path.join(f.source, 'new.txt'), 'new owner work');
  assert.throws(() => acquire(f.repo, 'acquire-apply', { ...f.destinations, approved: true, planHash: preview.planHash }, [f.root]), /unchanged/);
  assert.equal(fs.existsSync(f.destinations.backup), false);
  assert.throws(() => acquire(f.repo, 'acquire-preview', { ...f.destinations, backup: path.join(f.source, 'backup') }, [f.root]), /outside/);
  const preserved = f.secure();
  assert.equal(preserved.passed, true);
  assert.equal(snapshot(f.source).fingerprint, preserved.baseline.fingerprint);
  assert.notEqual(preserved.baseline.fingerprint, before);
  assert.equal(snapshot(f.destinations.backup).fingerprint, preserved.baseline.fingerprint);
  assert.throws(() => f.secure(), /already exists/);
});

test('acquisition rejects links and external object databases rather than claiming a complete backup', t => {
  const f = fixture(t);
  fs.writeFileSync(path.join(f.source, '.git', 'objects', 'info', 'alternates'), f.folder);
  assert.throws(() => f.secure(), /alternates/);
  fs.unlinkSync(path.join(f.source, '.git', 'objects', 'info', 'alternates'));
  fs.symlinkSync(f.folder, path.join(f.source, 'linked'), process.platform === 'win32' ? 'junction' : 'dir');
  assert.throws(() => f.secure(), /link\/junction/);
  assert.equal(fs.existsSync(f.destinations.backup), false);
});

test('acquisition preserves contained relative links, including dangling dependencies, without linking copies to originals', t => {
  const f = fixture(t);
  fs.mkdirSync(path.join(f.source, 'packages', 'shared'), { recursive: true });
  fs.writeFileSync(path.join(f.source, 'packages', 'shared', 'index.js'), 'original shared bytes\n');
  fs.mkdirSync(path.join(f.source, 'node_modules'));
  fs.symlinkSync(path.join('..', 'packages', 'shared'), path.join(f.source, 'node_modules', 'shared'), 'dir');
  fs.symlinkSync(path.join('..', 'packages', 'missing'), path.join(f.source, 'node_modules', 'missing'), 'dir');
  const preserved = f.secure();
  assert.equal(Object.keys(preserved.baseline.links).length, 2);
  assert.equal(fs.readlinkSync(path.join(preserved.backup, 'node_modules', 'shared')), path.join('..', 'packages', 'shared'));
  fs.writeFileSync(path.join(preserved.workingCopy, 'node_modules', 'shared', 'index.js'), 'working only\n');
  assert.equal(fs.readFileSync(path.join(f.source, 'packages', 'shared', 'index.js'), 'utf8'), 'original shared bytes\n');
  assert.equal(fs.readFileSync(path.join(preserved.backup, 'packages', 'shared', 'index.js'), 'utf8'), 'original shared bytes\n');
});

test('main-root acquisition retains registered worktree metadata whose common directory stays inside the copy', t => {
  const f = fixture(t);
  const linked = path.join(f.folder, 'other-worktree');
  f.git('worktree', 'add', '--detach', linked, f.original);
  const preserved = f.secure();
  assert.match(preserved.scope, /external worktree directories require separate preservation/);
  assert.equal(f.gitAt(preserved.workingCopy, 'rev-parse', '--show-toplevel').replaceAll('/', path.sep), preserved.workingCopy);
  assert.equal(snapshot(preserved.backup).fingerprint, snapshot(f.source).fingerprint);
});

test('full workflow recovers a missing historical implementation, tests it and verifies exact restored targets', async t => {
  const f = fixture(t);
  const baseline = snapshot(f.source).fingerprint;
  const preserved = f.secure();
  f.repo.records.integrity = integrity(f.source, preserved);
  assert.equal(f.repo.records.integrity.passed, true);
  const candidates = history(f.repo);
  assert.ok(candidates.commits.some(item => item.commit === f.original));
  assert.ok(candidates.reflog.length);
  const comparison = compareHistory(f.repo, { ref: f.original });
  assert.equal(comparison.totals.missing, 1);
  assert.equal(comparison.totals.changed, 1);
  assert.equal(comparison.files.find(item => item.file === 'src/feature.mjs').state, 'missing');
  const input = { ref: f.original, file: 'src/feature.mjs' };
  const preview = restoreHistory(f.repo, 'restore-preview', input);
  assert.match(preview.excerpt, /42/);
  assert.throws(() => restoreHistory(f.repo, 'restore-apply', input), /Approve/);
  const restored = restoreHistory(f.repo, 'restore-apply', { ...input, approved: true, planHash: preview.planHash });
  assert.equal(fs.readFileSync(path.join(preserved.workingCopy, 'src', 'feature.mjs'), 'utf8'), 'export const value = 42;\n');
  const checked = await quality(f.source, preserved, 'node', true, { planHash: qualityPreview(f.source, preserved, { profile: 'node' }).planHash });
  assert.equal(checked.passed, true, JSON.stringify(checked.results));
  const recovered = validateRecovery(f.source, preserved, integrity(f.source, preserved), checked, [restored], 'Original feature returns 42; fixture test passed.');
  assert.equal(recovered.verifiedTargets.length, 1);
  assert.ok(recovered.acceptance);
  assert.equal(snapshot(f.source).fingerprint, baseline);
  assert.equal(snapshot(preserved.backup).fingerprint, baseline);
  fs.writeFileSync(path.join(preserved.workingCopy, 'src', 'feature.mjs'), 'export const value = 99;\n');
  assert.throws(() => validateRecovery(f.source, preserved, f.repo.records.integrity, checked, [restored]), /changed after quality/);
});

test('historical previews reject stale targets, Git metadata, traversal and invalid refs', t => {
  const f = fixture(t);
  const preserved = f.secure();
  const input = { ref: f.original, file: 'README.md' };
  const preview = restoreHistory(f.repo, 'restore-preview', input);
  fs.writeFileSync(path.join(preserved.workingCopy, 'README.md'), 'newer working edits\n');
  assert.throws(() => restoreHistory(f.repo, 'restore-apply', { ...input, approved: true, planHash: preview.planHash }), /unchanged/);
  for (const file of ['../outside', '.GIT/config', 'name:stream']) {
    assert.throws(() => restoreHistory(f.repo, 'restore-preview', { ref: f.original, file }), /inside/);
  }
  assert.throws(() => restoreHistory(f.repo, 'restore-preview', { ref: '--help', file: 'README.md' }), /commit hash/);
});

test('reflog-only commits can be anchored without checkout, resets, hook execution or overwritten refs', t => {
  const f = fixture(t);
  fs.writeFileSync(path.join(f.source, 'lost.txt'), 'Recover this unique local work\n');
  const lost = f.commit('Lost branch tip');
  f.git('update-ref', 'refs/heads/main', f.reduced, lost);
  const hook = path.join(f.source, '.git', 'hooks', 'reference-transaction');
  fs.writeFileSync(hook, '#!/bin/sh\nexit 91\n', { mode: 0o755 });
  const preserved = f.secure();
  assert.ok(history(f.repo).reflog.some(item => item.commit === lost));
  const before = f.gitAt(preserved.workingCopy, 'rev-parse', 'HEAD');
  const input = { ref: lost, branch: 'recovery/lost-tip' };
  const preview = rescueCommit(f.repo, 'rescue-preview', input);
  const result = rescueCommit(f.repo, 'rescue-apply', { ...input, approved: true, planHash: preview.planHash });
  assert.equal(result.passed, true);
  assert.equal(f.gitAt(preserved.workingCopy, 'rev-parse', 'recovery/lost-tip'), lost);
  assert.equal(f.gitAt(preserved.workingCopy, 'rev-parse', 'HEAD'), before);
  assert.equal(f.git('branch', '--list', 'recovery/lost-tip'), '');
  assert.throws(() => rescueCommit(f.repo, 'rescue-preview', input), /already exists/);
});

test('remote refs are explicitly approved and imported only into a new working-copy namespace', t => {
  const f = fixture(t);
  const remote = path.join(f.folder, 'remote.git');
  fs.mkdirSync(remote);
  f.gitAt(remote, 'init', '--bare', '--initial-branch=main');
  f.git('remote', 'add', 'origin', remote);
  f.git('push', 'origin', 'main');
  f.gitAt(remote, '--git-dir', remote, 'update-ref', 'refs/tags/survivor', f.original);
  const preserved = f.secure();
  const original = snapshot(f.source).fingerprint;
  assert.throws(() => remoteRecovery(f.repo, 'remote-preview', { remote: 'origin' }), /permission/);
  const input = { remote: 'origin', networkApproved: true };
  const preview = remoteRecovery(f.repo, 'remote-preview', input);
  assert.equal(preview.advertised.length, 2);
  assert.throws(() => remoteRecovery(f.repo, 'remote-fetch', { ...input, approved: true, planHash: 'wrong' }), /current remote preview/);
  const result = remoteRecovery(f.repo, 'remote-fetch', { ...input, approved: true, planHash: preview.planHash });
  assert.equal(result.imported.length, 2);
  assert.ok(result.imported.every(item => item.ref.startsWith(result.namespace)));
  assert.equal(f.gitAt(preserved.workingCopy, 'rev-parse', 'HEAD'), f.reduced);
  assert.equal(fs.existsSync(path.join(preserved.workingCopy, '.git', 'FETCH_HEAD')), false);
  assert.equal(snapshot(f.source).fingerprint, original);
});

test('custom nested validation is previewed, hash-bound, uses real scripts and records failures', async t => {
  const f = fixture(t);
  const preserved = f.secure();
  fs.writeFileSync(path.join(preserved.workingCopy, 'src', 'verify.mjs'), "import fs from 'node:fs'; fs.writeFileSync('ran.txt', 'working copy only');\n");
  const input = { profile: 'custom', commands: [{ name: 'nested validation', kind: 'test', runner: 'node', directory: 'src', file: 'verify.mjs' }], timeoutSeconds: 30 };
  const preview = qualityPreview(f.source, preserved, input);
  await assert.rejects(quality(f.source, preserved, 'custom', true, input), /preview/);
  const result = await quality(f.source, preserved, 'custom', true, { ...input, planHash: preview.planHash });
  assert.equal(result.passed, true, JSON.stringify(result.results));
  assert.equal(fs.existsSync(path.join(f.source, 'src', 'ran.txt')), false);
  assert.equal(fs.readFileSync(path.join(preserved.workingCopy, 'src', 'ran.txt'), 'utf8'), 'working copy only');
  await assert.rejects(quality(f.source, preserved, 'custom', true, { ...input, planHash: preview.planHash }), /unchanged/);
  assert.throws(() => checkPlan(preserved.workingCopy, { profile: 'custom', commands: [{ ...input.commands[0], directory: '..' }] }, []), /working-copy directory/);
});

test('validation timeout and cancellation stop the owned process and report failure', async t => {
  const f = fixture(t);
  const script = path.join(f.folder, 'wait.mjs');
  fs.writeFileSync(script, 'setInterval(() => {}, 1000);\n');
  const command = { name: 'bounded child', executable: process.execPath, args: [script], cwd: f.folder };
  const timedOut = await runCheck(command, 1);
  assert.match(timedOut.error, /timed out/);
  const controller = new AbortController();
  const pending = runCheck(command, 30, controller.signal);
  setTimeout(() => controller.abort(), 150);
  const cancelled = await pending;
  assert.match(cancelled.error, /cancelled/);
});

test('mutations invalidate evidence but historical comparisons and previews preserve gates', () => {
  for (const action of ['restore-apply', 'rescue-apply', 'remote-fetch', 'fix-apply']) {
    assert.ok(invalidatedKeys(action).includes('quality'));
    assert.ok(invalidatedKeys(action).includes('recovery'));
    assert.ok(!invalidatedKeys(action).includes('preservation'));
  }
  for (const action of ['acquire-preview', 'restore-preview', 'quality-preview', 'compare', 'history']) assert.deepEqual(invalidatedKeys(action), []);
});

test('multi-stack plans use bounded argument arrays and missing runtimes fail explicitly', async t => {
  const f = fixture(t);
  const cases = [
    { runner: 'python', file: 'check.py', executable: 'python', prefix: [] },
    { runner: 'powershell', file: 'check.ps1', executable: 'pwsh', prefix: ['-NoProfile', '-NonInteractive', '-File'] },
    { runner: 'dotnet', file: 'check.csproj', executable: 'dotnet', prefix: ['test'] },
  ];
  for (const item of cases) {
    fs.writeFileSync(path.join(f.source, item.file), 'disposable planning fixture\n');
    const plan = checkPlan(f.source, { profile: 'custom', commands: [{
      name: item.runner, kind: 'test', runner: item.runner, file: item.file, directory: '.', args: ['argument with spaces'],
    }] }, []);
    assert.equal(plan.commands[0].executable, item.executable);
    assert.deepEqual(plan.commands[0].args.slice(0, item.prefix.length), item.prefix);
    assert.equal(plan.commands[0].args.at(-1), 'argument with spaces');
    if (item.runner === 'dotnet') assert.ok(plan.commands[0].args.includes('--no-restore'));
  }
  const interpreter = path.join('.venv', 'Scripts', 'python.exe');
  fs.mkdirSync(path.join(f.source, '.venv', 'Scripts'), { recursive: true });
  fs.writeFileSync(path.join(f.source, interpreter), 'planning-only interpreter fixture');
  const localPython = { name: 'local Python', kind: 'test', runner: 'python', file: 'check.py', directory: '.', interpreter };
  const localPlan = checkPlan(f.source, { profile: 'custom', commands: [localPython] }, []);
  assert.equal(localPlan.commands[0].executable, path.join(f.source, interpreter));
  assert.throws(() => checkPlan(f.source, { profile: 'custom', commands: [{ ...localPython, interpreter: path.join(f.folder, 'python.exe') }] }, []), /relative/);
  assert.throws(() => checkPlan(f.source, { profile: 'custom', commands: [{ ...localPython, interpreter: '.venv/Scripts/python3.exe' }] }, []), /does not exist/);
  const missing = await runCheck({ name: 'missing runtime', executable: path.join(f.folder, 'nonexistent-runtime'), args: [], cwd: f.folder }, 5);
  assert.equal(missing.exitCode, null);
  assert.match(missing.error, /ENOENT/);
});

test('HTTP workbench completes acquisition, historical restore, validation and reviewed delivery', async t => {
  const f = fixture(t);
  const app = await startDashboard({ root: f.root, data: path.join(f.folder, 'state'), port: 0 });
  try {
    const { token } = await (await fetch(app.origin + '/api/session')).json();
    const api = async (route, input) => {
      const response = await fetch(app.origin + route, {
        method: input ? 'POST' : 'GET', headers: { 'X-Recovery-Token': token, 'Content-Type': 'application/json' },
        body: input ? JSON.stringify(input) : undefined,
      });
      assert.ok(response.ok, await response.clone().text());
      return response.json();
    };
    const state = await api('/api/state');
    const id = state.repositories[0].id;
    async function run(action, input = {}) {
      await api('/api/task', { repositoryId: id, action, ...input });
      const deadline = Date.now() + 30_000;
      let next;
      do {
        await new Promise(resolve => setTimeout(resolve, 30));
        next = await api('/api/state');
      } while (next.job.status === 'running' && Date.now() < deadline);
      assert.equal(next.job.status, 'completed', next.job.error);
      return api(`/api/evidence/${id}`);
    }
    await run('inspect');
    const preview = (await run('acquire-preview', f.destinations))['acquire-preview'];
    await run('acquire-apply', { ...f.destinations, approved: true, planHash: preview.planHash });
    await run('integrity');
    await run('history');
    const compared = (await run('compare', { ref: f.original })).compare;
    assert.equal(compared.totals.missing, 1);
    const selection = { ref: f.original, file: 'src/feature.mjs' };
    const restore = (await run('restore-preview', selection))['restore-preview'];
    await run('restore-apply', { ...selection, approved: true, planHash: restore.planHash });
    await run('integrity');
    const check = (await run('quality-preview', { profile: 'node' }))['quality-preview'];
    await run('quality', { profile: 'node', approved: true, planHash: check.planHash });
    const recovery = (await run('recover', { acceptance: 'Restored feature value 42; fixture test passes. No deployment requested.' })).recovery;
    assert.equal(recovery.verifiedTargets.length, 1);
    const repo = (await api('/api/state')).repositories[0];
    await api('/api/case', { repositoryId: id, type: 'notes', ...repo.case, finalReport: 'Historical feature restored and tested on the independent copy. Originals retained.' });
    await api('/api/case', { repositoryId: id, type: 'deliver' });
    assert.equal((await api('/api/state')).repositories[0].lifecycle.status, 'delivered');
    const restoreAttempt = repo.procedures.find(item => item.action === 'restore-apply');
    assert.ok(restoreAttempt.evidenceId);
    const archived = await api(`/api/attempt/${restoreAttempt.evidenceId}`);
    assert.equal(archived.result.sourceCommit, f.original);
    fs.writeFileSync(path.join(f.destinations.workingCopy, 'wait.mjs'), 'setInterval(() => {}, 1000);\n');
    const checks = { profile: 'custom', commands: [{ name: 'cancel fixture', kind: 'test', runner: 'node', directory: '.', file: 'wait.mjs' }], timeoutSeconds: 30 };
    const pending = (await run('quality-preview', checks))['quality-preview'];
    await api('/api/task', { repositoryId: id, action: 'quality', ...checks, approved: true, planHash: pending.planHash });
    await api('/api/cancel', {});
    let cancelled;
    const cancellationDeadline = Date.now() + 30_000;
    do {
      await new Promise(resolve => setTimeout(resolve, 50));
      cancelled = await api('/api/state');
    } while (cancelled.job.status === 'running' && Date.now() < cancellationDeadline);
    assert.equal(cancelled.job.status, 'failed');
    assert.equal(cancelled.repositories[0].records.quality.passed, false);
    assert.equal(cancelled.repositories[0].records.recovery, undefined);
    await api('/api/rescan', {});
    assert.equal((await api(`/api/attempt/${restoreAttempt.evidenceId}`)).result.afterHash, archived.result.afterHash);
    assert.equal((await fetch(app.origin + `/api/attempt/${restoreAttempt.evidenceId}`)).status, 403);
    assert.equal(fs.existsSync(path.join(f.source, 'src', 'feature.mjs')), false);
  } finally { await app.close(); }
});
