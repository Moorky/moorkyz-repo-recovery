import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { readGit } from '../src/recovery.mjs';
import { inspect, snapshot } from '../src/dashboard/engine.mjs';
import { checkObjects, discoverCandidates, rankCandidates } from '../src/dashboard/candidates.mjs';
import { assessFindings, limitations } from '../src/dashboard/findings.mjs';

function sandbox(t) {
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'recovery-candidates-'));
  const hooks = path.join(folder, 'no-hooks');
  fs.mkdirSync(hooks);
  t.after(() => fs.rmSync(folder, { recursive: true, force: true }));
  function repository(name) {
    const root = path.join(folder, name);
    fs.mkdirSync(root, { recursive: true });
    const git = (...args) => {
      const result = readGit(root, ['-c', `core.hooksPath=${hooks}`, '-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid',
        '-c', 'commit.gpgsign=false', '-c', 'core.autocrlf=false', ...args]);
      assert.equal(result.exitCode, 0, `git ${args.join(' ')}: ${result.stderr}`);
      return result.stdout.trim();
    };
    git('init', '--initial-branch=main');
    const write = (file, text) => {
      fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
      fs.writeFileSync(path.join(root, file), text);
    };
    const commit = (message, files = {}) => {
      for (const [file, text] of Object.entries(files)) write(file, text);
      git('add', '-A');
      git('commit', '-m', message);
      return git('rev-parse', 'HEAD');
    };
    return { root, git, write, commit };
  }
  return { folder, repository };
}

function lostHistory(t) {
  const box = sandbox(t);
  const repo = box.repository('lost');
  const base = repo.commit('Base', { 'README.md': '# Lost history fixture\n' });
  const featureA = repo.commit('Add feature A', { 'src/a.mjs': 'export const a = 1;\n' });
  const featureB = repo.commit('Add feature B', { 'src/b.mjs': 'export const b = 2;\n', 'src/c.mjs': 'export const c = 3;\n' });
  repo.git('reset', '--hard', base);
  repo.git('checkout', '-b', 'experiment');
  const deleted = repo.commit('Deleted branch work', { 'notes.md': 'experiment\n' });
  repo.git('checkout', 'main');
  repo.git('branch', '-D', 'experiment');
  repo.write('README.md', '# Edited but stashed\n');
  repo.git('stash', 'push', '-m', 'unfinished readme');
  const stash = repo.git('rev-parse', 'refs/stash');
  repo.write('dangling.txt', 'never referenced\n');
  repo.git('add', 'dangling.txt');
  const tree = repo.git('write-tree');
  const dangling = repo.git('commit-tree', tree, '-p', base, '-m', 'Dangling snapshot');
  repo.git('reset', '-q');
  fs.unlinkSync(path.join(repo.root, 'dangling.txt'));
  repo.git('update-ref', 'refs/heads/recovery/kept', featureA);
  return { ...box, repo, base, featureA, featureB, deleted, stash, dangling };
}

test('candidate discovery finds reflog-only, deleted-branch, stash, dangling and recovery-ref commits read-only', t => {
  const f = lostHistory(t);
  const before = snapshot(f.repo.root).fingerprint;
  const objects = checkObjects(f.repo.root);
  assert.equal(objects.ran, true);
  assert.equal(objects.passed, true, objects.problems.join('\n'));
  assert.ok(objects.dangling.includes(f.dangling), 'connectivity check reports the dangling commit');
  const result = discoverCandidates(f.repo.root, { dangling: objects.dangling });
  const byCommit = new Map(result.candidates.map(item => [item.commit, item]));
  // featureA is now on refs/heads/recovery/kept, so it is reachable and only listed as an existing recovery ref.
  assert.deepEqual(byCommit.get(f.featureA).kinds, ['recovery-ref']);
  assert.deepEqual(byCommit.get(f.featureB).kinds, ['reflog-only']);
  assert.deepEqual(byCommit.get(f.deleted).kinds, ['reflog-only']);
  assert.deepEqual(byCommit.get(f.stash).kinds, ['stash']);
  assert.deepEqual(byCommit.get(f.dangling).kinds, ['unreachable']);
  assert.equal(result.candidates.length, 5, 'stash index commits and the current HEAD are not candidates');
  assert.equal(result.head, f.base);
  assert.equal(byCommit.get(f.featureB).comparison.onlyInCandidate, 3);
  assert.deepEqual(byCommit.get(f.featureB).comparison.onlyInCandidatePaths.sort(), ['src/a.mjs', 'src/b.mjs', 'src/c.mjs']);
  assert.equal(byCommit.get(f.stash).comparison.changed, 1);
  assert.ok(byCommit.get(f.featureB).factors.some(text => /reflog/.test(text)));
  assert.ok(byCommit.get(f.dangling).factors.some(text => /garbage collection/.test(text)));
  assert.ok(result.candidates.every(item => item.unknowns.some(text => /not a probability/.test(text))));
  assert.ok(!JSON.stringify(result).includes('%'), 'no percentages anywhere in candidate output');
  // At-risk sources first, then more files missing from HEAD; recovery refs last.
  assert.equal(result.candidates[0].commit, f.featureB);
  assert.equal(result.candidates.at(-1).commit, f.featureA);
  assert.deepEqual(result.candidates.map(item => item.rank), [1, 2, 3, 4, 5]);
  assert.deepEqual(discoverCandidates(f.repo.root, { dangling: objects.dangling }).candidates.map(item => item.commit),
    result.candidates.map(item => item.commit), 'same input gives the same order');
  assert.equal(snapshot(f.repo.root).fingerprint, before, 'discovery must not change a byte of the original, including .git');
});

test('ranking is deterministic and breaks ties by evidence, then time, then hash', () => {
  const make = (commit, kinds, onlyInCandidate, at) => ({ commit, kinds, at, comparison: onlyInCandidate === null ? null : { onlyInCandidate } });
  const ranked = rankCandidates([
    make('d'.repeat(40), ['recovery-ref'], 9, '2026-01-04T00:00:00Z'),
    make('c'.repeat(40), ['reflog-only'], 1, '2026-01-03T00:00:00Z'),
    make('b'.repeat(40), ['unreachable'], 1, '2026-01-03T00:00:00Z'),
    make('a'.repeat(40), ['reflog-only'], 5, '2026-01-01T00:00:00Z'),
    make('e'.repeat(40), ['stash'], null, '2026-01-05T00:00:00Z'),
  ]);
  assert.deepEqual(ranked.map(item => item.commit[0]), ['a', 'b', 'c', 'e', 'd']);
});

test('inspection carries findings evidence; a clean repository is not reported as complete', t => {
  const box = sandbox(t);
  const repo = box.repository('clean');
  repo.commit('Only commit', { 'README.md': '# Clean\n' });
  const before = snapshot(repo.root).fingerprint;
  const inspection = inspect(repo.root);
  assert.equal(inspection.state, 'clean-checkout');
  assert.equal(inspection.candidates.totals.listed, 0);
  const assessed = assessFindings(inspection);
  assert.equal(assessed.status, 'no-candidates');
  assert.equal(assessed.findings[0].id, 'nothing-flagged');
  assert.ok(assessed.limitations.includes(limitations[0]));
  assert.match(assessed.limitations[0], /clean Git status does not prove/);
  assert.equal(snapshot(repo.root).fingerprint, before);

  const lost = lostHistory(t);
  const found = assessFindings(inspect(lost.repo.root));
  assert.equal(found.status, 'candidates-found');
  assert.match(found.findings.find(item => item.id === 'candidates').title, /5 recovery candidates found/);
});

test('corrupted objects, malformed HEAD, empty and source-only folders produce explicit findings', t => {
  const box = sandbox(t);
  const corrupt = box.repository('corrupt');
  corrupt.commit('Commit', { 'README.md': '# Corrupt\n', 'data.txt': 'payload that will lose its object\n' });
  const blob = corrupt.git('rev-parse', 'HEAD:data.txt');
  fs.rmSync(path.join(corrupt.root, '.git', 'objects', blob.slice(0, 2), blob.slice(2)), { force: true });
  const corruptFindings = assessFindings(inspect(corrupt.root));
  assert.equal(corruptFindings.status, 'blocked');
  const problem = corruptFindings.findings.find(item => item.id === 'object-problems');
  assert.ok(problem, JSON.stringify(corruptFindings.findings));
  assert.match(problem.evidence, new RegExp(blob));

  const malformed = box.repository('malformed');
  malformed.commit('Commit', { 'README.md': '# Malformed\n' });
  fs.writeFileSync(path.join(malformed.root, '.git', 'refs', 'heads', 'main'), 'not-a-hash\n');
  const malformedFindings = assessFindings(inspect(malformed.root));
  assert.equal(malformedFindings.status, 'blocked');
  assert.equal(malformedFindings.findings[0].severity, 'blocker');

  const empty = box.repository('empty');
  const emptyFindings = assessFindings(inspect(empty.root));
  assert.ok(emptyFindings.findings.some(item => item.id === 'unborn'), JSON.stringify(emptyFindings.findings));
  assert.notEqual(emptyFindings.status, 'blocked');

  const source = path.join(box.folder, 'source-only');
  fs.mkdirSync(source);
  fs.writeFileSync(path.join(source, 'package.json'), '{"name":"source-only"}');
  const sourceFindings = assessFindings(inspect(source));
  assert.equal(sourceFindings.status, 'needs-review');
  assert.equal(sourceFindings.findings[0].id, 'source-only');

  const scanError = assessFindings(null, 'Invalid package manifest.');
  assert.equal(scanError.status, 'blocked');
  assert.equal(assessFindings(null).status, 'not-scanned');
});

test('object check skips oversized repositories honestly and linked worktrees are flagged', t => {
  const f = lostHistory(t);
  const skipped = checkObjects(f.repo.root, { maxObjects: 1 });
  assert.equal(skipped.ran, false);
  assert.equal(skipped.passed, null);
  assert.match(skipped.skippedReason, /exceed/);
  const worktree = path.join(f.folder, 'linked-worktree');
  f.repo.git('worktree', 'add', '--detach', worktree, f.base);
  const before = snapshot(f.repo.root).fingerprint;
  const findings = assessFindings(inspect(worktree));
  assert.ok(findings.findings.some(item => item.id === 'linked-worktree'));
  assert.equal(snapshot(f.repo.root).fingerprint, before, 'inspecting the worktree leaves the owning repository unchanged');
});
