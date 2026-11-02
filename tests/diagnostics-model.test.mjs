import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { diagnostics, dateBounds, diagnosticsPdf, sectionGroup } from '../website/diagnostics-model.mjs';
import { workspacePreferences, moveWorkspaceSection } from '../website/workspace-model.mjs';

const repository = (name, at, procedures = []) => ({ name, records: { inspection: { at } },
  procedures, lifecycle: { status: 'source-only' }, case: { owner: 'Moorkyz', priority: 'P1' },
  estimates: { current: { condition: 70 } } });

test('diagnostics uses exact inclusive UTC days and saved timestamps, never discovery dates', () => {
  const cases = [
    repository('before', '2026-10-29T23:59:59.999Z'),
    repository('start', '2026-10-30T00:00:00.000Z'),
    repository('end', '2026-10-30T23:59:59.999Z'),
    repository('after', '2026-10-31T00:00:00.000Z'),
    repository('offset', '2026-10-31T01:00:00+02:00'),
    { ...repository('unknown', null), scannedAt: '2026-10-30T12:00:00Z' },
    repository('invalid', 'not a date'),
  ];
  const result = diagnostics(cases, { from: '2026-10-30', through: '2026-10-30' });
  assert.deepEqual(result.repositories.map(repo => repo.name), ['start', 'end', 'offset']);
  assert.equal(result.unknown, 2);
  assert.equal(result.excluded, 4);
  assert.deepEqual(result.groups, [['source-only', 3]]);
  assert.equal(diagnostics(cases).repositories.length, 7);
  assert.equal(diagnostics(cases, { through: '2026-10-29' }).repositories.length, 1);
  assert.equal(diagnostics(cases, { from: '2026-10-31' }).repositories.length, 1);
  assert.deepEqual(dateBounds('2024-02-29', '2024-02-29'), {
    start: Date.parse('2024-02-29T00:00:00Z'), end: Date.parse('2024-03-01T00:00:00Z'),
  });
  for (const invalid of ['2026-02-29', '2026-13-01', '2026-10-00', 'October 30']) assert.throws(() => dateBounds(invalid), /date/i);
  assert.throws(() => dateBounds('2026-10-31', '2026-10-30'), /Start date/);
});

test('procedure matches group a case once and exclude out-of-range or unknown estimates/attempts', () => {
  const cases = [repository('procedure-only', '2026-09-01T00:00:00Z', [
    { at: '2026-10-30T12:00:00Z', name: 'inspect' },
    { at: '2026-10-30T15:00:00Z', name: 'integrity' },
    { at: '2026-09-01T00:00:00Z', name: 'preserve' }, { name: 'unknown' },
  ]), { ...repository('unassigned', '2026-10-30T12:00:00Z'), case: {} }];
  const selection = diagnostics(cases, { from: '2026-10-30', through: '2026-10-30', group: 'owner' });
  assert.deepEqual(selection.groups, [['Moorkyz', 1], ['unassigned', 1]]);
  assert.equal(selection.repositories[0].procedures.length, 2);
  assert.deepEqual(selection.repositories[0].estimates, {});
  assert.equal(cases[0].procedures.length, 4);
  assert.equal(cases[0].estimates.current.condition, 70);
  assert.deepEqual(diagnostics(cases, { group: 'priority' }).groups, [['P1', 1], ['unassigned', 1]]);
  assert.throws(() => diagnostics(cases, { group: 'invented' }), /grouping/);
});

test('PDF has valid byte offsets, stream lengths, page references and safe escaped text', () => {
  const cases = Array.from({ length: 120 }, (_, i) => repository(`Case ${i} (\\) <script> \u00e4`, '2026-10-30T00:00:00Z'));
  const bytes = diagnosticsPdf(diagnostics(cases));
  const pdf = new TextDecoder().decode(bytes);
  assert.ok(pdf.startsWith('%PDF-1.4\n'));
  assert.ok(pdf.endsWith('%%EOF\n'));
  assert.match(pdf, /\/Type \/Pages \/Count 3 /);
  assert.match(pdf, /\\\(\\\\\\\)/);
  assert.ok(!pdf.includes('\u00e4'));
  const xref = Number(pdf.match(/startxref\n(\d+)/)[1]);
  assert.equal(pdf.slice(xref, xref + 4), 'xref');
  const entries = pdf.slice(xref).split('\n');
  const count = Number(entries[1].split(' ')[1]);
  for (let id = 1; id < count; id++) {
    const offset = Number(entries[id + 2].slice(0, 10));
    assert.ok(pdf.slice(offset).startsWith(`${id} 0 obj\n`));
  }
  for (const match of pdf.matchAll(/\/Length (\d+) >>\nstream\n([\s\S]*?)endstream/g)) {
    assert.equal(new TextEncoder().encode(match[2]).length, Number(match[1]));
  }
  for (const match of pdf.matchAll(/(\d+) 0 R/g)) assert.ok(pdf.includes(`${match[1]} 0 obj\n`));
  assert.match(new TextDecoder().decode(diagnosticsPdf(diagnostics([]))), /\/Count 1 /);
});

test('sidebar order and six panel preferences migrate safely and moves remain inside parent sections', () => {
  const preferences = workspacePreferences({ navOrder: ['diagnostics', 'diagnostics', 'bad'], order: ['cases', 'overview'], sizes: { cases: { width: 80, height: 420 } } });
  assert.deepEqual(preferences.navOrder, ['diagnostics', 'introduction', 'cases']);
  assert.deepEqual(workspacePreferences({ navOrder: null }).navOrder, ['introduction', 'cases', 'diagnostics']);
  assert.deepEqual(workspacePreferences(JSON.parse(JSON.stringify(preferences))), preferences);
  assert.equal(Object.keys(sectionGroup).length, 6);
  const moved = moveWorkspaceSection(preferences.order, 'medkit', null, -1);
  assert.ok(moved.indexOf('medkit') < moved.indexOf('overview'));
  assert.deepEqual(moveWorkspaceSection(moved, 'cases', 'medkit'), moved);
  assert.deepEqual(moveWorkspaceSection(moved, 'cases', null, 1), moved);
});

test('page exposes matching top-level navigation, diagnostics controls, local favicon and six panel handles', () => {
  const html = fs.readFileSync(new URL('../website/index.html', import.meta.url), 'utf8');
  for (const id of ['introduction', 'cases', 'diagnostics']) {
    assert.ok(html.includes(`href="#${id}"`));
    assert.ok(html.includes(`id="${id}"`));
    assert.ok(html.includes(`id="${id}-panels"`));
  }
  assert.equal((html.match(/data-section="/g) || []).length, 6);
  assert.equal((html.match(/data-nav="/g) || []).length, 3);
  assert.ok(html.includes('href="/favicon.svg"'));
  assert.ok(!html.includes('LOCAL WORKSPACE'));
  for (const id of ['diagnostic-from', 'diagnostic-through', 'diagnostic-group', 'download-diagnostics']) assert.ok(html.includes(`id="${id}"`));
});
