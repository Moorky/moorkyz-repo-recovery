import test from 'node:test';
import assert from 'node:assert/strict';
import { workspacePreferences, defaultOpen, sectionIds, moveSection, estimateStatistics,
  procedureStatistics, lifecycleStatistics } from '../website/workspace-model.mjs';

test('workspace defaults, saved accordion state and bounded sizes reject malformed preferences', () => {
  assert.deepEqual(workspacePreferences().order, sectionIds);
  assert.deepEqual(workspacePreferences().open, defaultOpen);
  assert.deepEqual(workspacePreferences(null), workspacePreferences());
  const saved = workspacePreferences({ order: ['cases', 'cases', 'unknown'], open: [],
    sizes: { cases: { width: 150, height: 10 }, medkit: { width: NaN, height: 400 } } });
  assert.deepEqual(saved.order, ['cases', ...sectionIds.filter(id => id !== 'cases')]);
  assert.deepEqual(saved.open, []);
  assert.deepEqual(saved.sizes, { cases: { width: 100, height: 220 } });
  assert.equal(workspacePreferences({ statField: 'confidence', statProcedure: 'inspect' }).statField, 'confidence');
  assert.equal(workspacePreferences({ statField: 'unknown', statProcedure: 4 }).statProcedure, '');
});

test('whole-section moves preserve identities and handle boundaries and external targets', () => {
  const order = ['medkit', 'overview', 'cases'];
  assert.deepEqual(moveSection(order, 'cases', 'medkit'), ['cases', 'medkit', 'overview']);
  assert.deepEqual(moveSection(order, 'medkit', null, 1), ['overview', 'medkit', 'cases']);
  assert.deepEqual(moveSection(order, 'medkit', null, -1), order);
  assert.deepEqual(moveSection(order, 'cases', 'external'), order);
  assert.deepEqual(order, ['medkit', 'overview', 'cases']);
});

test('estimate statistics have exact bins, exclude stale/unknown, and preserve over-100 ratios', () => {
  const repositories = [0, 25, 50, 75, 100, 150].map(condition => ({
    estimates: { potential: { condition, quality: condition * 2 }, current: { condition: 100, confidence: 0 } },
  }));
  repositories.push({ estimates: { potential: { condition: 50, stale: true } } }, { estimates: {} });
  const [potential, current] = estimateStatistics(repositories, 'condition');
  assert.deepEqual(potential.buckets.map(bucket => bucket.count), [1, 1, 1, 2, 1]);
  assert.equal(potential.count, 6);
  assert.equal(potential.stale, 1);
  assert.equal(potential.missing, 1);
  assert.equal(potential.average, 400 / 6);
  assert.equal(current.average, 100);
  assert.equal(estimateStatistics(repositories, 'quality')[0].maximum, 300);
  assert.equal(estimateStatistics(repositories, 'confidence')[1].average, 0);
  assert.equal(estimateStatistics([], 'condition')[0].average, null);
  assert.throws(() => estimateStatistics(repositories, 'invented'), /Unknown estimate/);
});

test('procedure aggregates preserve zero ratings, filter names and distinguish failures and unreviewed attempts', () => {
  const repositories = [{ name: 'alpha', procedures: [
    { id: 'a', name: 'inspect', status: 'completed', helpingFactor: 0, at: '2026-01-01' },
    { id: 'b', name: 'preserve', status: 'failed', helpingFactor: null, at: '2026-01-02' },
    { id: 'c', name: 'inspect', status: 'completed', helpingFactor: 100, at: '2026-01-03' },
    { id: 'd', name: 'constructor', status: 'failed', helpingFactor: null, at: '2026-01-04' },
  ] }];
  const all = procedureStatistics(repositories);
  assert.equal(all.total, 4);
  assert.equal(all.reviewed, 2);
  assert.equal(all.unrated, 2);
  assert.equal(all.average, 50);
  assert.equal(all.best.id, 'c');
  assert.equal(all.worst.helpingFactor, 0);
  assert.equal(all.statuses.failed, 2);
  assert.equal(all.names.constructor, 1);
  assert.equal(procedureStatistics(repositories, 'preserve').average, null);
  assert.equal(procedureStatistics(repositories, 'inspect').total, 2);
});

test('lifecycle statistics use observed times, dispositions and focused targets without inventing zeros', () => {
  const repositories = [
    { lifecycle: { deliveredAt: '2026-01-01', status: 'delivered', totalStayMs: 0, unchangedMs: 20 }, case: { priority: 'P0', target: 'file.js' } },
    { lifecycle: { dismissedAt: '2026-01-02', status: 'dismissed', totalStayMs: 100, unchangedMs: 0 }, case: {} },
    { lifecycle: {}, case: {} },
  ];
  const result = lifecycleStatistics(repositories);
  assert.equal(result.active, 1);
  assert.equal(result.delivered, 1);
  assert.equal(result.dismissed, 1);
  assert.equal(result.targets, 1);
  assert.equal(result.averageStay, 50);
  assert.equal(result.averageUnchanged, 10);
  assert.equal(result.priorities.unassigned, 2);
  assert.equal(lifecycleStatistics([]).averageStay, null);
});
