export const preferenceKey = 'moorkyz-recovery.list.v1';
export const columns = Object.freeze(['repository', 'state', 'stay', 'findings', 'condition', 'quality', 'recovery', 'outcome', 'procedures', 'extremes', 'medikit']);
export const defaults = Object.freeze({
  mode: 'continuous', pageSize: 20, sort: 'name', filter: 'all',
  priority: 'all', rated: 'all', targetOnly: false, filtersOpen: false,
  columnOrder: columns, columnWidths: {}, rowOrder: [],
});
const states = ['all', 'awaiting-examination', 'clean-checkout', 'uncommitted-work', 'source-only',
  'unborn-or-damaged', 'inspection-errors', 'delivered', 'dismissed', 'recovered'];

export function validatePreferences(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid saved list preferences.');
  return {
    mode: ['continuous', 'pages'].includes(value.mode) ? value.mode : defaults.mode,
    pageSize: [10, 20, 50].includes(value.pageSize) ? value.pageSize : defaults.pageSize,
    sort: ['name', 'condition', 'confidence', 'updated', 'manual'].includes(value.sort) ? value.sort : defaults.sort,
    filter: states.includes(value.filter) ? value.filter : defaults.filter,
    priority: ['all', 'unassigned', 'P0', 'P1', 'P2', 'P3'].includes(value.priority) ? value.priority : defaults.priority,
    rated: ['all', 'rated', 'unrated'].includes(value.rated) ? value.rated : defaults.rated,
    targetOnly: value.targetOnly === true,
    filtersOpen: value.filtersOpen === true,
    columnOrder: [...new Set(Array.isArray(value.columnOrder) ? value.columnOrder.filter(key => columns.includes(key)) : [])]
      .concat(columns.filter(key => !Array.isArray(value.columnOrder) || !value.columnOrder.includes(key))),
    columnWidths: Object.fromEntries(Object.entries(value.columnWidths && typeof value.columnWidths === 'object' ? value.columnWidths : {})
      .filter(([key, width]) => columns.includes(key) && Number.isFinite(width) && width >= 100 && width <= 600)),
    rowOrder: [...new Set(Array.isArray(value.rowOrder) ? value.rowOrder.filter(id => typeof id === 'string' && id.length <= 100) : [])],
  };
}

export function procedureExtremes(procedures) {
  const rated = procedures.filter(procedure => Number.isFinite(procedure.helpingFactor))
    .sort((a, b) => b.helpingFactor - a.helpingFactor || a.at.localeCompare(b.at) || a.id.localeCompare(b.id));
  return { best: rated[0] ?? null, worst: rated.at(-1) ?? null };
}

function fuzzy(text, query) {
  const direct = text.indexOf(query);
  if (direct >= 0) return direct === 0 ? 100 : 80;
  let index = 0;
  for (const character of text) if (character === query[index]) index++;
  return query.length >= 3 && index === query.length ? 40 : 0;
}

export function searchRank(repository, query) {
  const fields = {
    id: repository.id, name: repository.name, path: repository.path,
    state: repository.lifecycle.status,
    owner: repository.case.owner, priority: repository.case.priority,
    target: repository.case.target,
    findings: repository.case.findings, diagnosis: repository.case.diagnosis, report: repository.case.report,
  };
  const terms = query.match(/(?:[^\s"]+|"[^"]*")+/g) || [];
  let rank = 0;
  for (const raw of terms) {
    const term = raw.replaceAll('"', '').toLowerCase();
    const colon = term.indexOf(':');
    if (colon > 0 && Object.hasOwn(fields, term.slice(0, colon))) {
      const value = term.slice(colon + 1);
      if (!String(fields[term.slice(0, colon)] || '').toLowerCase().includes(value)) return -1;
      rank += 100;
    } else {
      const matches = Object.values(fields).map(value => fuzzy(String(value || '').toLowerCase(), term));
      const best = Math.max(...matches);
      if (best === 0) return -1;
      rank += best;
    }
  }
  return rank;
}

export function selectRepositories(repositories, query, preferences) {
  const matches = repositories.filter(repository => {
    const rank = searchRank(repository, query);
    const rated = procedureExtremes(repository.procedures).best !== null;
    return rank >= 0 &&
      (preferences.filter === 'all' || (preferences.filter === 'recovered' ? Boolean(repository.records.recovery) : repository.lifecycle.status === preferences.filter)) &&
      (preferences.priority === 'all' || repository.case.priority === preferences.priority) &&
      (preferences.rated === 'all' || (preferences.rated === 'rated' ? rated : !rated)) &&
      (!preferences.targetOnly || repository.case.target.trim() !== '');
  });
  return matches.sort((a, b) => {
    if (preferences.sort === 'manual') {
      const order = preferences.rowOrder || [];
      const index = id => order.indexOf(id) < 0 ? Number.MAX_SAFE_INTEGER : order.indexOf(id);
      return index(a.id) - index(b.id) || a.name.localeCompare(b.name);
    }
    if (preferences.sort === 'name') return a.name.localeCompare(b.name);
    if (preferences.sort === 'updated') return b.lifecycle.updatedAt.localeCompare(a.lifecycle.updatedAt) || a.name.localeCompare(b.name);
    return (a.estimates.current[preferences.sort] ?? -1) - (b.estimates.current[preferences.sort] ?? -1) || a.name.localeCompare(b.name);
  });
}

export function moveBefore(order, source, target) {
  if (source === target || !order.includes(source) || !order.includes(target)) return [...order];
  const next = order.filter(key => key !== source);
  next.splice(next.indexOf(target), 0, source);
  return next;
}

export function moveBy(order, source, delta) {
  const index = order.indexOf(source);
  if (index < 0) return [...order];
  const destination = Math.max(0, Math.min(order.length - 1, index + delta));
  const next = [...order];
  next.splice(index, 1);
  next.splice(destination, 0, source);
  return next;
}

export function listWindow(list, preferences, page = 0, limit = preferences.pageSize) {
  const pages = Math.max(1, Math.ceil(list.length / preferences.pageSize));
  const safePage = Math.max(0, Math.min(pages - 1, page));
  const start = preferences.mode === 'pages' ? safePage * preferences.pageSize : 0;
  const end = Math.min(list.length, preferences.mode === 'pages' ? start + preferences.pageSize : Math.max(preferences.pageSize, limit));
  return { items: list.slice(start, end), start, end, page: safePage, pages, hasMore: end < list.length, total: list.length };
}

export function suggestions(repositories, query) {
  if (!query.trim()) return [];
  return repositories.map(repository => ({ repository, rank: searchRank(repository, query) }))
    .filter(item => item.rank >= 0).sort((a, b) => b.rank - a.rank || a.repository.name.localeCompare(b.repository.name))
    .slice(0, 6).map(item => item.repository);
}
