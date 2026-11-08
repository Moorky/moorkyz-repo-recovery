import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { assess } from '../src/recovery.mjs';
import { inspect, snapshot } from '../src/dashboard/engine.mjs';
import { assessFindings } from '../src/dashboard/findings.mjs';

// Plain Git, with the user's normal config (including any filters), used only to build fixtures.
function rawGit(cwd, ...args) {
  const result = spawnSync('git', ['-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', '-c', 'commit.gpgsign=false',
    '-c', 'core.autocrlf=false', '-c', 'init.defaultBranch=main', '-c', 'protocol.file.allow=always', ...args], { cwd, encoding: 'utf8', windowsHide: true });
  assert.equal(result.status, 0, `git ${args.join(' ')}: ${result.stderr}`);
  return result.stdout.trim();
}
function workspace(t) {
  const base = fs.mkdtempSync(path.join(fs.realpathSync.native(os.tmpdir()), 'recovery-readonly-'));
  t.after(() => fs.rmSync(base, { recursive: true, force: true }));
  return base;
}
const touch = file => fs.utimesSync(file, new Date(), new Date(Date.now() + 10 * 60_000));

test('scanning never runs repository-defined filter drivers or writes into .git', async t => {
  const base = workspace(t);
  const marker = path.join(base, 'marker.txt');
  const script = path.join(base, 'filter.mjs');
  fs.writeFileSync(script, `import fs from 'node:fs'; fs.appendFileSync(${JSON.stringify(marker)}, process.argv[2] + '\\n'); process.stdin.pipe(process.stdout);\n`);
  const command = kind => `node "${script.replaceAll('\\', '/')}" ${kind}`;
  const repo = path.join(base, 'portfolio', 'filtered');
  fs.mkdirSync(repo, { recursive: true });
  rawGit(repo, 'init', '-q');
  fs.writeFileSync(path.join(repo, '.gitattributes'), '*.txt filter=marker\n*.dat filter=a=b\n');
  fs.writeFileSync(path.join(repo, 'notes.txt'), 'notes\n');
  fs.writeFileSync(path.join(repo, 'data.dat'), 'data\n');
  rawGit(repo, 'add', '-A');
  rawGit(repo, 'commit', '-q', '-m', 'content committed before the filters exist');
  rawGit(repo, 'config', 'filter.marker.clean', command('clean'));
  rawGit(repo, 'config', 'filter.marker.process', command('process'));
  rawGit(repo, 'config', 'filter.a=b.clean', command('equals-clean'));
  touch(path.join(repo, 'notes.txt'));
  touch(path.join(repo, 'data.dat'));
  const before = snapshot(repo).fingerprint;

  const inspection = inspect(repo);
  assert.equal(inspection.state, 'clean-checkout');
  await assess(path.join(base, 'portfolio'), path.join(base, 'report'));
  assert.equal(fs.existsSync(marker), false, `filter ran during scan: ${fs.existsSync(marker) ? fs.readFileSync(marker, 'utf8') : ''}`);
  assert.equal(snapshot(repo).fingerprint, before, 'original including .git is byte-identical');

  spawnSync('git', ['status', '--porcelain'], { cwd: repo, windowsHide: true });
  assert.equal(fs.existsSync(marker), true, 'control: an ordinary git status does run the filter, so the fixture is sensitive');
});

const lfs = spawnSync('git', ['lfs', 'version'], { encoding: 'utf8', windowsHide: true });
test('scanning a Git LFS repository leaves .git untouched (no hooks, config or lfs/tmp writes)',
  { skip: lfs.status === 0 ? false : 'git-lfs is not installed' }, t => {
    const base = workspace(t);
    const repo = path.join(base, 'lfs-project');
    fs.mkdirSync(repo);
    rawGit(repo, 'init', '-q');
    fs.writeFileSync(path.join(repo, '.gitattributes'), '*.bin filter=lfs diff=lfs merge=lfs -text\n');
    fs.writeFileSync(path.join(repo, 'asset.bin'), Buffer.alloc(2048, 7));
    rawGit(repo, '-c', 'filter.lfs.clean=git-lfs clean -- %f', '-c', 'filter.lfs.process=git-lfs filter-process', '-c', 'filter.lfs.required=true', 'add', '-A');
    rawGit(repo, 'commit', '-q', '-m', 'LFS asset');
    for (const hook of ['pre-push', 'post-checkout', 'post-commit', 'post-merge']) fs.rmSync(path.join(repo, '.git', 'hooks', hook), { force: true });
    spawnSync('git', ['config', '--remove-section', 'lfs'], { cwd: repo, windowsHide: true });
    fs.rmSync(path.join(repo, '.git', 'lfs', 'tmp'), { recursive: true, force: true });
    touch(path.join(repo, 'asset.bin'));
    const before = snapshot(repo).fingerprint;
    inspect(repo);
    assert.equal(snapshot(repo).fingerprint, before, 'git-lfs must not install hooks or write config/tmp into the original');
    spawnSync('git', ['status', '--porcelain'], { cwd: repo, windowsHide: true });
    t.diagnostic(snapshot(repo).fingerprint === before ? 'control: plain git status did not modify .git with this git-lfs version'
      : 'control: plain git status modifies .git (git-lfs writes), so the fixture is sensitive');
  });

test('submodules are reported explicitly instead of as linked worktrees or "nothing flagged"', t => {
  const base = workspace(t);
  const child = path.join(base, 'child');
  const parent = path.join(base, 'parent');
  for (const folder of [child, parent]) {
    fs.mkdirSync(folder);
    rawGit(folder, 'init', '-q');
    fs.writeFileSync(path.join(folder, 'README.md'), `# ${path.basename(folder)}\n`);
    rawGit(folder, 'add', '-A');
    rawGit(folder, 'commit', '-q', '-m', 'init');
  }
  // Built-in commands only (git-submodule is a shell script): clone with a separate gitdir under .git/modules.
  fs.mkdirSync(path.join(parent, '.git', 'modules'));
  rawGit(parent, 'clone', '-q', '--separate-git-dir', path.join(parent, '.git', 'modules', 'sub'), child, 'sub');
  const head = rawGit(child, 'rev-parse', 'HEAD');
  fs.writeFileSync(path.join(parent, '.gitmodules'), '[submodule "sub"]\n\tpath = sub\n\turl = ../child\n');
  rawGit(parent, 'update-index', '--add', '--cacheinfo', `160000,${head},sub`);
  rawGit(parent, 'add', '.gitmodules');
  rawGit(parent, 'commit', '-q', '-m', 'add submodule');
  const before = snapshot(parent).fingerprint;
  const parentFindings = assessFindings(inspect(parent));
  assert.ok(parentFindings.findings.some(item => item.id === 'contains-submodules'), JSON.stringify(parentFindings.findings));
  assert.notEqual(parentFindings.status, 'no-candidates');
  const subFindings = assessFindings(inspect(path.join(parent, 'sub')));
  assert.ok(subFindings.findings.some(item => item.id === 'submodule'));
  assert.ok(!subFindings.findings.some(item => item.id === 'linked-worktree'));
  assert.deepEqual(snapshot(parent).fingerprint, before);
});
