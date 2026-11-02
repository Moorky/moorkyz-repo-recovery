import { procedureExtremes } from './list-model.mjs';
import { navigationIds, sectionGroup } from './diagnostics-model.mjs';

export const workspaceKey = 'moorkyz-recovery.workspace.v1';
export const sectionIds = ['medkit', 'overview', 'estimates', 'procedures', 'lifecycle', 'cases'];
export const defaultOpen = ['medkit', 'overview', 'estimates', 'cases'];

export function workspacePreferences(input = {}) {
  const value = input && typeof input === 'object' && !Array.isArray(input) ? input : {};
  const order = [...new Set(Array.isArray(value.order) ? value.order.filter(id => sectionIds.includes(id)) : [])];
  for (const id of sectionIds) if (!order.includes(id)) order.push(id);
  const open = Array.isArray(value.open) ? [...new Set(value.open.filter(id => sectionIds.includes(id)))] : [...defaultOpen];
  const sizes = {};
  for (const id of sectionIds) {
    const size = value.sizes?.[id];
    if (size && Number.isFinite(size.width) && Number.isFinite(size.height)) {
      sizes[id] = { width: Math.max(40, Math.min(100, size.width)), height: Math.max(220, Math.min(1200, size.height)) };
    }
  }
  const statField = ['condition', 'quality', 'recovery', 'confidence'].includes(value.statField) ? value.statField : 'condition';
  const statProcedure = typeof value.statProcedure === 'string' && value.statProcedure.length <= 128 ? value.statProcedure : '';
  const navOrder = [...new Set(Array.isArray(value.navOrder) ? value.navOrder.filter(id => navigationIds.includes(id)) : [])];
  for (const id of navigationIds) if (!navOrder.includes(id)) navOrder.push(id);
  return { order, open, sizes, statField, statProcedure, navOrder };
}

export function moveSection(order, id, target, delta) {
  const from = order.indexOf(id);
  if (from < 0) return [...order];
  const next = [...order];
  if (delta !== undefined) {
    const to = Math.max(0, Math.min(order.length - 1, from + delta));
    next.splice(from, 1);
    next.splice(to, 0, id);
  } else {
    if (!order.includes(target) || target === id) return next;
    next.splice(from, 1);
    next.splice(next.indexOf(target), 0, id);
  }

  return next;
}

export function moveWorkspaceSection(order, id, target, delta) {
  if (!sectionGroup[id] || (target && sectionGroup[target] !== sectionGroup[id])) return [...order];
  const siblings = order.filter(value => sectionGroup[value] === sectionGroup[id]);
  const moved = moveSection(siblings, id, target, delta);
  let index = 0;
  return order.map(value => sectionGroup[value] === sectionGroup[id] ? moved[index++] : value);
}

const finite = value => typeof value === 'number' && Number.isFinite(value) && value >= 0;
const mean = values => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
function counts(values) {
  const result = Object.create(null);
  for (const value of values) result[value] = (result[value] || 0) + 1;
  return result;
}

export function estimateStatistics(repositories, field) {
  if (!['condition', 'quality', 'recovery', 'confidence'].includes(field)) throw new Error('Unknown estimate statistic.');
  return ['potential', 'current'].map(pair => {
    const records = repositories.map(repo => repo.estimates?.[pair]);
    const values = records.filter(record => record && !record.stale && finite(record[field])).map(record => record[field]);
    const buckets = [
      { label: '0 - <25%', count: values.filter(value => value < 25).length },
      { label: '25 - <50%', count: values.filter(value => value >= 25 && value < 50).length },
      { label: '50 - <75%', count: values.filter(value => value >= 50 && value < 75).length },
      { label: '75 - 100%', count: values.filter(value => value >= 75 && value <= 100).length },
      { label: '>100%', count: values.filter(value => value > 100).length },
    ];
    const stale = records.filter(record => record?.stale).length;
    return { pair, count: values.length, missing: repositories.length - values.length - stale, stale,
      average: mean(values), minimum: values.length ? Math.min(...values) : null,
      maximum: values.length ? Math.max(...values) : null, buckets };
  });
}

export function procedureStatistics(repositories, name = '') {
  const attempts = repositories.flatMap(repo => (repo.procedures || []).map(procedure => ({ ...procedure, repository: repo.name })))
    .filter(procedure => !name || procedure.name === name);
  const reviewed = attempts.filter(procedure => finite(procedure.helpingFactor));
  const { best, worst } = procedureExtremes(reviewed);
  return { total: attempts.length, reviewed: reviewed.length, unrated: attempts.length - reviewed.length,
    average: mean(reviewed.map(procedure => procedure.helpingFactor)),
    statuses: counts(attempts.map(procedure => procedure.status)), names: counts(attempts.map(procedure => procedure.name)),
    best, worst, attempts };
}

export function lifecycleStatistics(repositories) {
  const delivered = repositories.filter(repo => repo.lifecycle?.deliveredAt).length;
  const dismissed = repositories.filter(repo => repo.lifecycle?.dismissedAt).length;
  return { total: repositories.length, delivered, dismissed, active: repositories.length - delivered - dismissed,
    targets: repositories.filter(repo => repo.case?.target?.trim()).length,
    averageStay: mean(repositories.map(repo => repo.lifecycle?.totalStayMs).filter(finite)),
    averageUnchanged: mean(repositories.map(repo => repo.lifecycle?.unchangedMs).filter(finite)),
    states: counts(repositories.map(repo => repo.lifecycle?.status || 'awaiting-examination')),
    priorities: counts(repositories.map(repo => repo.case?.priority || 'unassigned')) };
}
