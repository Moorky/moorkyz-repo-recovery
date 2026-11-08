import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { caseStatus, summaryCounts, scanProgress, candidateView, suggestedCopies, guidedSteps, validMode } from '../website/simple-model.mjs';

const repo = (records = {}, extra = {}) => ({ records, lifecycle: {}, ...extra });

test('case status follows real evidence and never shows a percentage', () => {
  assert.equal(caseStatus(repo()).key, 'not-scanned');
  assert.equal(caseStatus(repo({ inspection: {} }, { scan: { status: 'candidates-found' } })).label, 'Recovery candidates found');
  assert.equal(caseStatus(repo({ inspection: {} }, { scan: { status: 'blocked' } })).tone, 'danger');
  assert.equal(caseStatus(repo({ inspection: {}, preservation: {} }, { scan: { status: 'blocked' } })).key, 'protected', 'case progress outranks the scan label');
  assert.equal(caseStatus(repo({ preservation: {} }, { recoveryTargets: [{}] })).key, 'files-restored');
  assert.equal(caseStatus(repo({ preservation: {}, quality: { passed: false } })).key, 'checks-failed');
  assert.equal(caseStatus(repo({ preservation: {}, quality: { passed: true } })).key, 'checks-passed');
  assert.equal(caseStatus(repo({ recovery: {} })).key, 'validated');
  assert.equal(caseStatus(repo({ recovery: {} }, { lifecycle: { deliveredAt: '2026-11-08T00:00:00Z' } })).key, 'completed');
  assert.equal(caseStatus(repo({}, { unavailable: true })).key, 'unavailable');
  const counts = summaryCounts([repo(), repo(), repo({ inspection: {} }, { scan: { status: 'blocked' } })]);
  assert.deepEqual(counts.map(entry => [entry.key, entry.count]), [['blocked', 1], ['not-scanned', 2]]);
  for (const entry of counts) assert.doesNotMatch(entry.label, /%/);
});

test('scan progress distinguishes running, cancel requested, cancelled, failed and finished', () => {
  assert.equal(scanProgress(null), null);
  assert.equal(scanProgress({ action: 'quality', status: 'running' }), null);
  const running = scanProgress({ action: 'scan', status: 'running', progress: { total: 6, done: 2, failed: 0, current: 'lost-commits' } });
  assert.equal(running.text, 'Scanning 3 of 6: lost-commits…');
  assert.deepEqual([running.value, running.max, running.running], [2, 6, true]);
  assert.match(scanProgress({ action: 'scan', status: 'running', cancelRequested: true, progress: { total: 6, done: 2, current: 'x' } }).text, /Cancel requested — finishing x/);
  assert.match(scanProgress({ action: 'scan', status: 'cancelled', progress: { total: 6, done: 2, failed: 1 } }).text, /Scan cancelled.*2 of 6 projects scanned, 1 could not be read\. Results so far are saved\./);
  const failed = scanProgress({ action: 'scan', status: 'failed', error: 'Worker ended.', progress: { total: 3, done: 1 } });
  assert.equal(failed.error, true);
  assert.match(failed.text, /1 of 3 projects were saved/);
  assert.match(scanProgress({ action: 'scan', status: 'completed', progress: { total: 1, done: 1, failed: 0 } }).text, /1 project scanned\. No files were changed\./);
  assert.equal(scanProgress({ action: 'scan', status: 'completed', progress: { total: 0, done: 0 } }).max, 1, 'empty scans never divide by zero');
});

test('candidate view explains comparisons in words and keeps unknowns', () => {
  const view = candidateView({ commit: 'a'.repeat(40), subject: '', at: null, kinds: ['reflog-only', 'stash'],
    comparison: { onlyInCandidate: 1, changed: 2, onlyInHead: 0, onlyInCandidatePaths: ['src/a.mjs'] }, factors: ['f'], unknowns: ['u'] });
  assert.equal(view.short, 'aaaaaaaaaa');
  assert.equal(view.subject, '(no message)');
  assert.equal(view.when, 'Unknown time');
  assert.deepEqual(view.kinds, ['Only in reflog', 'Stash']);
  assert.equal(view.summary, '1 file missing from current version · 2 changed');
  assert.deepEqual([view.paths, view.factors, view.unknowns], [['src/a.mjs'], ['f'], ['u']]);
  assert.equal(candidateView({ commit: 'b'.repeat(40), kinds: [], comparison: null }).summary, 'Not compared with the current version yet.');
  assert.equal(candidateView({ commit: 'b'.repeat(40), kinds: [], comparison: { onlyInCandidate: 0, changed: 0, onlyInHead: 0 } }).summary, 'Same files as the current version.');
});

test('suggested copy folders sit beside the scan folder, never inside it', () => {
  const at = new Date('2026-11-08T01:02:03Z');
  assert.deepEqual(suggestedCopies('C:\\Users\\me\\repos', 'tools/sdk', at),
    { backup: 'C:\\Users\\me\\tools-sdk-backup-20261108-0102', workingCopy: 'C:\\Users\\me\\tools-sdk-working-20261108-0102' });
  assert.deepEqual(suggestedCopies('/home/me/repos/', '..', at),
    { backup: '/home/me/project-backup-20261108-0102', workingCopy: '/home/me/project-working-20261108-0102' });
  assert.equal(suggestedCopies('/repos', 'x', at).backup, '/x-backup-20261108-0102');
  assert.equal(suggestedCopies('D:\\repos', 'x', at).backup, 'D:\\x-backup-20261108-0102');
});

test('guided steps unlock in order, keep optional steps skippable and never jump backwards', () => {
  const ids = steps => steps.filter(step => step.current).map(step => step.id);
  assert.deepEqual(ids(guidedSteps(repo())), ['scan']);
  assert.ok(!guidedSteps(repo()).find(step => step.id === 'protect').available);
  assert.deepEqual(ids(guidedSteps(repo({ inspection: {} }))), ['choose']);
  assert.deepEqual(ids(guidedSteps(repo({ inspection: {} }, { selectedCandidate: { commit: 'a' } }))), ['protect']);
  assert.deepEqual(ids(guidedSteps(repo({ inspection: {}, preservation: {} }))), ['integrity'], 'choosing is optional once copies exist');
  const restore = guidedSteps(repo({ inspection: {}, preservation: {}, integrity: { passed: true } }));
  assert.deepEqual(ids(restore), ['restore']);
  assert.ok(restore.find(step => step.id === 'checks').available, 'checks are reachable without restoring anything');
  assert.deepEqual(ids(guidedSteps(repo({ inspection: {}, preservation: {}, integrity: { passed: true }, quality: { passed: true } }))), ['validate']);
  assert.deepEqual(ids(guidedSteps(repo({ inspection: {}, preservation: {}, integrity: { passed: false } }))), ['integrity']);
  assert.deepEqual(ids(guidedSteps(repo({ inspection: {}, preservation: {}, integrity: { passed: true }, quality: { passed: true }, recovery: {} }))), ['handoff']);
  assert.equal(validMode('advanced'), 'advanced');
  assert.equal(validMode('<script>'), 'simple');
});

test('page exposes Simple mode controls, keeps every advanced section and serves the new modules', () => {
  const html = fs.readFileSync(new URL('../website/index.html', import.meta.url), 'utf8');
  for (const id of ['mode-toggle', 'scan-repositories', 'cancel-scan', 'scan-progress', 'scan-status', 'project-list', 'guided-recovery', 'toggle-case-advanced']) {
    assert.match(html, new RegExp(`id="${id}"`), id);
  }
  for (const id of ['workspace-sections', 'case-tools', 'workflow-editor', 'fix-editor', 'estimate-editor', 'procedure-editor', 'detailed-case-table', 'rescan', 'download-report']) {
    assert.match(html, new RegExp(`id="${id}"`), `advanced capability ${id} retained`);
  }
  assert.match(html, /<aside class="sidebar advanced-only">/);
  assert.match(html, /href="\/simple\.css"/);
  const server = fs.readFileSync(new URL('../src/dashboard/server.mjs', import.meta.url), 'utf8');
  for (const route of ['/simple.mjs', '/simple-model.mjs', '/simple.css']) assert.ok(server.includes(`'${route}'`), route);
});
