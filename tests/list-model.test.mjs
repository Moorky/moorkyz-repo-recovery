import test from 'node:test';
import assert from 'node:assert/strict';
import { defaults, validatePreferences, searchRank, selectRepositories, listWindow, suggestions, procedureExtremes, columns, moveBefore, moveBy } from '../website/list-model.mjs';

function repository(index, options = {}) {
  return {
    id: `repo-${index}`, name: `project-${String(index).padStart(3, '0')}`, path: `C:\\repos\\project-${index}`,
    lifecycle: { status: 'source-only', updatedAt: '2026-10-30T12:00:00Z' },
    case: { owner: 'Reviewer', priority: 'P1', target: 'docs/guide.md', findings: 'broken links', diagnosis: '', report: '' },
    estimates: { current: { condition: index, confidence: index } }, records: {}, procedures: [],
    ...options,
  };
}

test('continuous view is default and pages/batches have exact boundaries', () => {
  const list = Array.from({ length: 53 }, (_, index) => repository(index));
  assert.equal(defaults.mode, 'continuous');
  assert.equal(listWindow(list, defaults).items.length, 20);
  assert.equal(listWindow(list, defaults, 0, 40).items.length, 40);
  assert.equal(listWindow(list, defaults, 0, 60).hasMore, false);
  const paged = { ...defaults, mode: 'pages' };
  const second = listWindow(list, paged, 1);
  assert.equal(second.items.length, 20);
  assert.equal(second.items[0].id, 'repo-20');
  assert.equal(listWindow(list, paged, 99).items.length, 13);
  assert.equal(listWindow([], paged).pages, 1);
  assert.equal(listWindow([], paged).hasMore, false);
});

test('settings validation preserves supported preferences and rejects invalid containers', () => {
  const preferences = { ...defaults, mode: 'pages', pageSize: 50, sort: 'updated', filter: 'dismissed', priority: 'P0', rated: 'rated', targetOnly: true, filtersOpen: true };
  assert.deepEqual(validatePreferences(JSON.parse(JSON.stringify(preferences))), preferences);
  assert.equal(validatePreferences({ mode: 'bad', pageSize: 999 }).mode, 'continuous');
  assert.equal(validatePreferences({ mode: 'bad', pageSize: 999 }).pageSize, 20);
  assert.throws(() => validatePreferences(null), /Invalid/);
  assert.throws(() => validatePreferences([]), /Invalid/);
});

test('smart search handles field terms, multiple terms and fuzzy matches without running expressions', () => {
  const repo = repository(1);
  assert.ok(searchRank(repo, 'state:source-only priority:P1 "broken links"') >= 0);
  assert.ok(searchRank(repo, 'target:guide.md owner:review') >= 0);
  assert.ok(searchRank(repo, 'prjct') >= 0);
  assert.equal(searchRank(repo, 'state:delivered'), -1);
  assert.equal(searchRank(repo, 'missing-pattern'), -1);
  assert.equal(searchRank(repo, '<script>alert(1)</script>'), -1);
});

test('filters/sorting work together; suggestion ranking is bounded and stable', () => {
  const list = Array.from({ length: 30 }, (_, index) => repository(index));
  list[3].procedures.push({ id: 'rated', helpingFactor: 25, at: '2026-10-30T12:00:00Z' });
  assert.equal(selectRepositories(list, '', { ...defaults, rated: 'rated' }).length, 1);
  assert.equal(selectRepositories(list, '', { ...defaults, priority: 'P0' }).length, 0);
  list[1].case.target = '';
  assert.equal(selectRepositories(list, '', { ...defaults, targetOnly: true }).length, 29);
  assert.equal(selectRepositories(list, 'id:repo-3', { ...defaults, rated: 'rated' })[0].id, 'repo-3');
  assert.equal(suggestions(list, 'project').length, 6);
  assert.equal(suggestions(list, '').length, 0);
});

test('best and worst use only reviewed helping factors, include zero, and resolve ties deterministically', () => {
  const procedures = [
    { id: 'unrated', name: 'unrated', helpingFactor: null, at: '2026-10-30T12:00:00Z' },
    { id: 'low', helpingFactor: 0, at: '2026-10-30T12:00:00Z' },
    { id: 'high', helpingFactor: 100, at: '2026-10-30T12:00:00Z' },
  ];
  assert.equal(procedureExtremes(procedures).best.id, 'high');
  assert.equal(procedureExtremes(procedures).worst.id, 'low');
  assert.equal(procedureExtremes([procedures[0]]).best, null);
  assert.equal(procedureExtremes([procedures[1]]).best.id, procedureExtremes([procedures[1]]).worst.id);
  const tied = [
    { id: 'b', helpingFactor: 50, at: '2026-10-30T12:00:00Z' },
    { id: 'a', helpingFactor: 50, at: '2026-10-30T12:00:00Z' },
  ];
  assert.equal(procedureExtremes(tied).best.id, 'a');
});

test('column and row moves are stable and safe for unknown IDs and boundaries', () => {
  assert.deepEqual(moveBefore(['a', 'b', 'c'], 'c', 'a'), ['c', 'a', 'b']);
  assert.deepEqual(moveBefore(['a', 'b', 'c'], 'x', 'a'), ['a', 'b', 'c']);
  assert.deepEqual(moveBy(['a', 'b', 'c'], 'a', -1), ['a', 'b', 'c']);
  assert.deepEqual(moveBy(['a', 'b', 'c'], 'a', 1), ['b', 'a', 'c']);
  const preferences = validatePreferences({ ...defaults, columnOrder: ['state', 'state', 'invalid'],
    columnWidths: { state: 220, bad: 200, findings: 900 }, rowOrder: ['repo-2', 'repo-2', 'repo-0'], sort: 'manual' });
  assert.equal(preferences.columnOrder.length, columns.length);
  assert.equal(preferences.columnOrder[0], 'state');
  assert.deepEqual(preferences.columnWidths, { state: 220 });
  assert.deepEqual(preferences.rowOrder, ['repo-2', 'repo-0']);
  assert.deepEqual(selectRepositories([repository(0), repository(1), repository(2)], '', preferences).map(repo => repo.id), ['repo-2', 'repo-0', 'repo-1']);
});
