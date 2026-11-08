import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { assess, projectRoot, readGit } from '../src/recovery.mjs';
import { inspect, snapshot } from '../src/dashboard/engine.mjs';
import { renderReport } from '../src/dashboard/report.mjs';

function fixture(t) {
  const folder = fs.mkdtempSync(path.join(fs.realpathSync.native(os.tmpdir()), 'recovery-report-'));
  t.after(() => fs.rmSync(folder, { recursive: true, force: true }));
  const root = path.join(folder, 'portfolio');
  const repository = path.join(root, 'outer', 'nested');
  fs.mkdirSync(path.join(repository, 'audits'), { recursive: true });
  const git = (...args) => {
    const result = readGit(repository, args);
    assert.equal(result.exitCode, 0, result.stderr);
    return result;
  };
  git('init', '--initial-branch=main');
  fs.writeFileSync(path.join(repository, 'README.md'), '# Disposable fixture\n');
  fs.writeFileSync(path.join(repository, 'package.json'), JSON.stringify({
    version: '1.2.3', scripts: { test: 'node -e "process.exit(77)"', 'type-check': 'node -e "process.exit(78)"' },
  }));
  for (const name of ['missing.txt', 'remove.txt', 'rename.txt']) fs.writeFileSync(path.join(repository, name), `${name}\n`);
  fs.writeFileSync(path.join(repository, 'audits', 'task.md'), '# Audit\n');
  git('add', '.');
  fs.mkdirSync(path.join(folder, 'empty-hooks'));
  git('-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', '-c', 'commit.gpgsign=false',
    '-c', `core.hooksPath=${path.join(folder, 'empty-hooks')}`, 'commit', '-m', 'Disposable baseline');
  git('tag', 'v1.2.3');
  return { folder, root, repository, git };
}

test('inspection distinguishes missing index files, staged deletions and renames without changing bytes', t => {
  const f = fixture(t);
  fs.unlinkSync(path.join(f.repository, 'missing.txt'));
  f.git('rm', 'remove.txt');
  f.git('mv', 'rename.txt', 'renamed space.txt');
  fs.writeFileSync(path.join(f.repository, 'local.txt'), 'untracked\n');
  const before = snapshot(f.repository).fingerprint;
  const inspection = inspect(f.repository);
  const evidence = inspection.recoveryEvidence;
  assert.equal(inspection.state, 'uncommitted-work');
  assert.equal(evidence.hasErrors, false);
  assert.deepEqual(evidence.missingFromIndex, ['missing.txt']);
  assert.deepEqual(evidence.changes.stagedDeletions, ['remove.txt']);
  assert.equal(evidence.changes.stagedRenames, 1);
  assert.equal(evidence.changes.staged, 2);
  assert.equal(evidence.changes.unstaged, 1);
  assert.equal(evidence.changes.untrackedEntries, 1);
  assert.deepEqual(evidence.auditPaths, ['audits/task.md']);
  assert.deepEqual(evidence.tags, ['v1.2.3']);
  assert.equal(evidence.commits, 1);
  assert.equal(evidence.shallow, false);
  assert.equal(evidence.stashes, 0);
  assert.ok(evidence.reflogEntriesSampled > 0);
  assert.deepEqual(inspection.measured.availableChecks, ['test', 'type-check']);
  assert.equal(inspection.measured.packageVersion, '1.2.3');
  assert.equal(snapshot(f.repository).fingerprint, before);
});

test('portfolio assess writes Markdown and JSON for nested roots and source-only projects without executing scripts', async t => {
  const f = fixture(t);
  const plain = path.join(f.root, 'source-only');
  fs.mkdirSync(plain);
  fs.writeFileSync(path.join(plain, 'package.json'), '{"version":"0.4.0"}');
  const before = snapshot(f.root).fingerprint;
  const output = path.join(f.folder, 'report');
  const report = await assess(f.root, output);
  assert.equal(report.repositories.length, 2);
  assert.equal(report.hasErrors, false);
  assert.equal(report.isBackup, false);
  assert.equal(snapshot(f.root).fingerprint, before);
  const markdown = fs.readFileSync(path.join(output, 'assessment.md'), 'utf8');
  assert.match(markdown, /Clean does not mean complete/);
  assert.match(markdown, /source-only/);
  assert.match(markdown, /Root package version: 1\.2\.3/);
  assert.match(markdown, /NOT RUN \/ no current evidence/);
  assert.equal(JSON.parse(fs.readFileSync(path.join(output, 'assessment.json'))).schemaVersion, 1);
  await assert.rejects(assess(f.root, output), /already exists/);
  await assert.rejects(assess(f.root, path.join(f.root, 'report')), /outside/);
  const alias = path.join(f.folder, 'alias');
  fs.symlinkSync(f.root, alias, process.platform === 'win32' ? 'junction' : 'dir');
  await assert.rejects(assess(f.root, path.join(alias, 'report')), /outside/);
});

test('partial assessment records failed queries and invalid manifests, continues other cases, and exits nonzero', t => {
  const f = fixture(t);
  fs.mkdirSync(path.join(f.root, 'broken', '.git'), { recursive: true });
  fs.mkdirSync(path.join(f.root, 'invalid'));
  fs.writeFileSync(path.join(f.root, 'invalid', 'package.json'), '{invalid');
  const output = path.join(f.folder, 'partial');
  const result = spawnSync(process.execPath, [
    path.join(projectRoot, 'src', 'recovery.mjs'), 'assess', '--root', f.root, '--output', output,
  ], { encoding: 'utf8', timeout: 60_000 });
  assert.equal(result.status, 1, result.stderr);
  assert.match(result.stderr, /Partial assessment/);
  const report = JSON.parse(fs.readFileSync(path.join(output, 'assessment.json')));
  assert.equal(report.hasErrors, true);
  assert.equal(report.repositories.length, 3);
  assert.ok(report.repositories.find(repo => repo.name === 'invalid').inspectionError);
  assert.equal(report.repositories.find(repo => repo.name === 'broken').records.inspection.recoveryEvidence.trackedFiles, null);
  const markdown = fs.readFileSync(path.join(output, 'assessment.md'), 'utf8');
  assert.match(markdown, /Failed Git query/);
  assert.match(markdown, /inspection-failed/);
  assert.match(markdown, /Unknown/);
});

test('report supports old saved records, unknown cases, and safely displays Markdown/HTML metacharacters', () => {
  const markdown = renderReport({
    root: 'fixture', scannedAt: '2026-11-02T00:00:00Z', skipped: [],
    repositories: [
      { name: '<img>|[link](https://example.invalid)\n# injected', path: 'fixture', records: {} },
      { name: 'legacy', path: 'fixture', records: {
        inspection: { at: '2026-11-01T00:00:00Z', hasGit: true, state: 'clean-checkout', commands: [], measured: {} },
      } },
    ],
  });
  assert.ok(!markdown.includes('<img>'));
  assert.ok(!markdown.includes('[link]('));
  assert.ok(!markdown.includes('\n# injected'));
  assert.match(markdown, /not-inspected/);
  assert.match(markdown, /Re-inspect to collect/);
  assert.match(markdown, /not automatically estimated/);
});

test('handoff report retains reviewed targets, check failures and immutable attempt IDs', () => {
  const markdown = renderReport({ root: 'fixture', scannedAt: '2026-11-02', skipped: [], repositories: [{
    name: 'recovered', path: 'fixture',
    recoveryTargets: [{ file: 'src/feature.mjs', afterHash: 'verified-hash', sourceCommit: 'original-commit' }],
    procedures: [{ name: 'restore-apply', at: '2026-11-02', status: 'completed', evidenceId: 'attempt-id' }],
    records: { recovery: { at: '2026-11-02', acceptance: 'Restored and reviewed feature' },
      quality: { at: '2026-11-02', passed: false, results: [{ check: 'tests', exitCode: 1, error: 'actual failure' }] } },
  }] });
  assert.match(markdown, /verified-hash/);
  assert.match(markdown, /original-commit/);
  assert.match(markdown, /Reviewed acceptance: Restored and reviewed feature/);
  assert.match(markdown, /actual failure/);
  assert.match(markdown, /archived attempt attempt-id/);
});
