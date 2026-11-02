import { executeTask } from './engine.mjs';
import { acquire } from './acquisition.mjs';
import { fix } from './fixes.mjs';
import { history, compareHistory, restoreHistory, rescueCommit } from './history.mjs';
import { remoteRecovery } from './remote.mjs';

const stages = ['inspection', 'preservation', 'integrity', 'quality', 'recovery'];
export const actionNames = [
  'inspect', 'preserve', 'integrity', 'quality', 'recover', 'quality-preview',
  'fix-preview', 'fix-apply', 'acquire-preview', 'acquire-apply',
  'history', 'compare', 'restore-preview', 'restore-apply', 'rescue-preview', 'rescue-apply',
  'remote-preview', 'remote-fetch',
];
export const recordKey = action => ({
  inspect: 'inspection', preserve: 'preservation', recover: 'recovery', 'acquire-apply': 'preservation',
})[action] || action;
export const isPreview = action => action.endsWith('-preview');

export function invalidatedKeys(action) {
  if (isPreview(action) || ['history', 'compare'].includes(action)) return [];
  const index = stages.indexOf(recordKey(action));
  const core = index < 0 ? stages.slice(2) : stages.slice(index);
  return [...core, 'compare', 'quality-preview', 'fix-preview', 'restore-preview', 'rescue-preview', 'remote-preview', 'acquire-preview',
    ...(index === 0 || index === 1 ? ['history', 'restore-apply', 'rescue-apply', 'remote-fetch'] : [])];
}

export async function runProcedure(repository, action, input, forbiddenRoots, signal) {
  if (action.startsWith('acquire-')) return acquire(repository, action, input, forbiddenRoots);
  if (action.startsWith('fix-')) return fix(repository, action, input);
  if (action === 'history') return history(repository);
  if (action === 'compare') return compareHistory(repository, input);
  if (action.startsWith('restore-')) return restoreHistory(repository, action, input);
  if (action.startsWith('rescue-')) return rescueCommit(repository, action, input);
  if (action.startsWith('remote-')) return remoteRecovery(repository, action, input);
  return executeTask(repository, action, input, forbiddenRoots, signal);
}
