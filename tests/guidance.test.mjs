import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { measuredStatistics, nextStep, helpTopics } from '../website/guidance-model.mjs';
import { renderDocumentation } from '../src/dashboard/documentation.mjs';

test('measured panels retain zero, separate unknowns and exclude missing duration evidence', () => {
  const repositories = [
    { records: { inspection: { at: '2026-11-02T10:00:00Z', state: 'clean-checkout', summary: { missingIndexPaths: 0, auditPaths: 4, tags: 0, stashes: 0 } },
      preservation: { summary: { bytes: 1024, files: 3, links: 0 } }, quality: { passed: true }, recovery: { matchedFiles: 2, baselineFiles: 3 } },
      lifecycle: { deliveredAt: '2026-11-02T12:00:00Z' }, procedures: [{ status: 'failed' }, { status: 'completed', durationMs: 2000 }] },
    { records: { inspection: { at: 'invalid', state: 'source-only' }, quality: { passed: false } },
      procedures: [{ status: 'failed', durationMs: 0 }, { status: 'completed', durationMs: 4000 }] },
    { records: {}, procedures: [] },
  ];
  const stats = measuredStatistics(repositories, Date.parse('2026-11-02T11:00:00Z'));
  assert.deepEqual(stats.missing, { value: 0, known: 1, unknown: 2 });
  assert.equal(stats.tracked.value, null);
  assert.equal(stats.baselineBytes.value, 1024);
  assert.equal(stats.qualityPassed, 1);
  assert.equal(stats.qualityFailed, 1);
  assert.equal(stats.notValidated, 1);
  assert.equal(stats.sourceOnly, 1);
  assert.equal(stats.failedAttempts, 2);
  assert.equal(stats.medianDurationMs, 2000);
  assert.equal(stats.oldestInspectionAgeMs, 3600000);
  assert.equal(stats.retention.percent, 2 / 3 * 100);
  assert.equal(measuredStatistics([]).retention, null);
  assert.equal(measuredStatistics([]).medianDurationMs, null);
});

test('next safe step respects missing/failed gates and never starts a procedure', () => {
  const records = {};
  const repo = { records };
  assert.equal(nextStep(repo).stage, 0);
  records.inspection = {};
  assert.equal(nextStep(repo).stage, 1);
  records.preservation = {};
  assert.equal(nextStep(repo).stage, 2);
  records.integrity = { passed: false };
  assert.match(nextStep(repo).label, /failure/);
  records.integrity.passed = true;
  assert.equal(nextStep(repo).stage, 3);
  records.quality = { passed: false };
  assert.match(nextStep(repo).label, /failed/);
  records.quality.passed = true;
  assert.equal(nextStep(repo).stage, 4);
  records.recovery = {};
  assert.equal(nextStep(repo).label, 'Review validated result');
});

test('local documentation renders safe readable headings, lists, tables and code without raw HTML', () => {
  const html = renderDocumentation('# Guide\n\n## Copies\n\n**Preserve** `bytes`.\n\n- Backup\n- Working\n\n| A | B |\n|---|---|\n| 0 | Unknown |\n\n```powershell\n<script>alert(1)</script>\n```\n\n[Local](GUIDED_RECOVERY.md) [Bad](javascript:alert) [Remote](https://example.invalid)\n\n<img src=x onerror=alert(1)>');
  assert.match(html, /id="copies"/);
  assert.match(html, /<ul>\s*<li>Backup<\/li>/);
  assert.match(html, /<th scope="col">A/);
  assert.match(html, /<strong>Preserve/);
  assert.match(html, /href="\/workflow"/);
  assert.ok(!html.includes('<script>'));
  assert.ok(!html.includes('<img'));
  assert.ok(!html.includes('href="javascript:'));
  assert.match(html, /&lt;script&gt;/);
});

test('every help topic points to an actual manual section and key controls are discoverable', () => {
  const manual = fs.readFileSync(new URL('../docs/USER_GUIDE.md', import.meta.url), 'utf8');
  const rendered = renderDocumentation(manual);
  for (const topic of Object.values(helpTopics)) {
    const anchor = topic.link.split('#')[1];
    assert.ok(rendered.includes(`id="${anchor}"`), anchor);
  }
  const html = fs.readFileSync(new URL('../website/index.html', import.meta.url), 'utf8');
  for (const id of ['how-to-recover', 'case-cards', 'gate-statistics', 'history-statistics', 'copy-statistics', 'run-statistics', 'refresh-saved']) {
    assert.ok(html.includes(`id="${id}"`), id);
  }
  assert.ok(html.includes('id="detailed-case-table" class="table-wrap" hidden'));
});

test('layout keeps navigation actions and panel controls out of narrow content tracks', () => {
  const css = fs.readFileSync(new URL('../website/guidance.css', import.meta.url), 'utf8');
  assert.match(css, /\.hero-actions \.primary\{width:auto;margin-top:0\}/);
  assert.match(css, /@container workbench \(max-width:760px\)\{\.workspace-panel\{width:100%!important\}/);
  assert.match(css, /\.workspace-panel>\.section-resizer\{position:static;/);
  assert.match(css, /\.sidebar #section-navigation\{gap:8px;grid-template-columns:repeat\(3,minmax\(0,1fr\)\)\}/);
  assert.match(css, /\.help-button\{padding:0;flex:0 0 28px\}/);
});
