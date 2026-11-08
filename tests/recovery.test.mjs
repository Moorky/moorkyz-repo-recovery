import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { inventory, projectRoot } from '../src/recovery.mjs';

function fixture(t) {
  const folder = fs.mkdtempSync(path.join(fs.realpathSync.native(os.tmpdir()), 'moorkyz-recovery-test-'));
  t.after(() => fs.rmSync(folder, { recursive: true, force: true }));
  return folder;
}

function git(root, ...args) {
  const config = path.join(root, '.fixture-gitconfig');
  if (!fs.existsSync(config)) fs.writeFileSync(config, '');
  const result = spawnSync('git', ['-C', root, ...args], {
    encoding: 'utf8', windowsHide: true,
    env: { ...process.env, GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: config },
  });
  assert.equal(result.status, 0, result.stderr);
  return result.stdout;
}

function repository(folder) {
  fs.mkdirSync(folder, { recursive: true });
  git(folder, 'init', '--initial-branch=main');
  fs.writeFileSync(path.join(folder, 'fixture.txt'), 'disposable\n');
  git(folder, 'add', 'fixture.txt');
  const hooks = path.join(folder, '.fixture-hooks');
  fs.mkdirSync(hooks);
  git(folder, '-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid',
    '-c', 'commit.gpgsign=false', '-c', 'core.hooksPath=' + hooks, 'commit', '-m', 'fixture');
}

function hashes(folder) {
  const results = {};
  function visit(current) {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const target = path.join(current, entry.name);
      if (entry.isDirectory()) visit(target);
      else if (entry.isFile()) results[path.relative(folder, target)] =
        crypto.createHash('sha256').update(fs.readFileSync(target)).digest('hex');
    }
  }
  visit(folder);
  return results;
}

test('inventories nested roots and linked worktrees without changing file bytes', t => {
  const folder = fixture(t);
  const root = path.join(folder, 'copies');
  const repo = path.join(root, 'outer', 'inner');
  repository(repo);
  const worktree = path.join(root, 'linked');
  git(repo, 'worktree', 'add', '-b', 'fixture-linked', worktree);
  fs.writeFileSync(path.join(repo, 'untracked.txt'), 'preserve me\n');
  fs.writeFileSync(path.join(repo, 'fixture.txt'), 'dirty\n');
  const before = hashes(root);
  const report = inventory(root, path.join(folder, 'report'));
  assert.equal(report.isBackup, false);
  assert.equal(report.hasErrors, false);
  assert.equal(report.repositories.length, 2);
  assert.ok(report.repositories.some(item => item.path === repo));
  assert.ok(report.repositories.some(item => item.path === worktree));
  assert.deepEqual(hashes(root), before);
  assert.equal(JSON.parse(fs.readFileSync(path.join(folder, 'report', 'git-snapshot.json'))).schemaVersion, 1);
  assert.ok(report.repositories.every(item => item.commands.every(command => command.exitCode === 0)));
});

test('rejects output inside scan root or project and refuses existing output', t => {
  const folder = fixture(t);
  const root = path.join(folder, 'copies');
  fs.mkdirSync(root);
  assert.throws(() => inventory(root, path.join(root, 'report')), /outside/);
  assert.throws(() => inventory(root, path.join(projectRoot, 'test-output')), /outside/);
  assert.throws(() => inventory(root, root), /outside/);
  assert.throws(() => inventory(root, folder), /already exists/);
  assert.throws(() => inventory(root, path.join(folder, 'missing-parent', 'report')), /ENOENT/);
});

test('rejects containment through a symlink or Windows junction', t => {
  const folder = fixture(t);
  const root = path.join(folder, 'copies');
  fs.mkdirSync(root);
  const alias = path.join(folder, 'alias');
  fs.symlinkSync(root, alias, process.platform === 'win32' ? 'junction' : 'dir');
  assert.throws(() => inventory(root, path.join(alias, 'report')), /outside/);
});

test('reports corrupt metadata and unborn HEAD as explicit command failures', t => {
  const folder = fixture(t);
  const root = path.join(folder, 'copies');
  fs.mkdirSync(path.join(root, 'broken', '.git'), { recursive: true });
  fs.mkdirSync(path.join(root, 'unborn'));
  git(path.join(root, 'unborn'), 'init', '--initial-branch=main');
  const report = inventory(root, path.join(folder, 'report'));
  assert.equal(report.hasErrors, true);
  assert.equal(report.repositories.length, 2);
  assert.ok(report.repositories.every(item => item.commands.some(command => command.exitCode !== 0)));
  assert.ok(report.repositories[0].commands.some(command => command.stderr.length > 0));
});

test('empty scan is valid, exclusions and depth boundary are respected', t => {
  const folder = fixture(t);
  const root = path.join(folder, 'copies');
  fs.mkdirSync(path.join(root, 'Data', 'private', '.git'), { recursive: true });
  fs.mkdirSync(path.join(root, 'a', 'b', 'deeper', '.git'), { recursive: true });
  const report = inventory(root, path.join(folder, 'report'));
  assert.equal(report.repositories.length, 0);
  assert.equal(report.hasErrors, false);
  assert.ok(report.skippedPaths.some(item => item.path === path.join(root, 'Data')));
});

test('ignores inherited Git directory overrides and skips linked directories', t => {
  const folder = fixture(t);
  const root = path.join(folder, 'copies');
  const repo = path.join(root, 'repo');
  repository(repo);
  const alias = path.join(root, 'alias');
  fs.symlinkSync(repo, alias, process.platform === 'win32' ? 'junction' : 'dir');
  const previous = process.env.GIT_DIR;
  process.env.GIT_DIR = path.join(folder, 'not-a-repository');
  try {
    const report = inventory(root, path.join(folder, 'report'));
    assert.equal(report.hasErrors, false);
    assert.equal(report.repositories.length, 1);
    assert.ok(report.skippedPaths.some(item => item.path === alias));
  } finally {
    if (previous === undefined) delete process.env.GIT_DIR;
    else process.env.GIT_DIR = previous;
  }
});

test('CLI rejects malformed arguments and exits nonzero on partial reports', t => {
  const folder = fixture(t);
  const cli = path.join(projectRoot, 'src', 'recovery.mjs');
  for (const args of [
    ['unknown'], ['inventory'], ['inventory', '--root', folder, '--root', folder],
    ['inventory', '--root', folder, '--output'], ['inventory', '--surprise', folder],
  ]) {
    const result = spawnSync(process.execPath, [cli, ...args], { encoding: 'utf8' });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /Recovery error/);
  }
  const root = path.join(folder, 'copies');
  fs.mkdirSync(path.join(root, 'broken', '.git'), { recursive: true });
  const result = spawnSync(process.execPath, [
    cli, 'inventory', '--root', root, '--output', path.join(folder, 'report'),
  ], { encoding: 'utf8' });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Partial inventory/);
  assert.throws(() => inventory(path.join(folder, 'absent'), path.join(folder, 'other')), /ENOENT/);
});
