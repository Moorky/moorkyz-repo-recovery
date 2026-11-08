import { readGit } from '../recovery.mjs';

// Read-only discovery of surviving Git history that is not on any current branch or tag.
// Every query uses readGit (optional locks off, no pager, no maintenance); nothing is written.

const good = result => result.exitCode === 0 && result.error === null;
const hash = /^[0-9a-f]{40}([0-9a-f]{24})?$/;
const kindRank = { 'reflog-only': 0, unreachable: 0, stash: 1, 'recovery-ref': 2, 'recent-history': 3 };
export const candidateLimits = { reflog: 200, dangling: 200, listed: 50, compared: 25, samplePaths: 20, maxObjects: 250_000, recentHistory: 10 };

function rows(text) {
  return text.split(/\r?\n/).filter(Boolean).map(line => line.split('\t'));
}

/**
 * Bounded object check for scanning originals: object counts plus `git fsck --connectivity-only`,
 * which reads commits/trees but not blob contents and never writes (no --lost-found).
 * Repositories above `maxObjects` are skipped with an explicit reason instead of a slow scan.
 */
export function checkObjects(folder, { maxObjects = candidateLimits.maxObjects } = {}) {
  const counted = readGit(folder, ['count-objects', '-v']);
  const counts = good(counted) ? Object.fromEntries(rows(counted.stdout.replaceAll(': ', '\t')).map(([key, value]) => [key, Number(value)])) : null;
  const objectCount = counts ? (counts.count ?? 0) + (counts['in-pack'] ?? 0) : null;
  const base = { at: new Date().toISOString(), objectCount, garbage: counts?.garbage ?? null, dangling: [], problems: [] };
  if (!counts) {
    return { ...base, ran: false, passed: null, skippedReason: 'Object counts unavailable.',
      problems: [`count-objects failed: ${(counted.error || counted.stderr || `exit ${counted.exitCode}`).trim()}`] };
  }
  if (objectCount > maxObjects) {
    return { ...base, ran: false, passed: null,
      skippedReason: `${objectCount} objects exceed the ${maxObjects} scan limit; run the full integrity check on a verified working copy.` };
  }
  const fsck = readGit(folder, ['fsck', '--connectivity-only', '--no-progress'], { timeout: 120_000, maxBuffer: 16 * 1024 * 1024 });
  const lines = `${fsck.stdout}\n${fsck.stderr}`.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  const dangling = [...new Set(lines.map(line => /^(?:dangling|unreachable) commit ([0-9a-f]{40,64})$/.exec(line)?.[1]).filter(Boolean))];
  const problems = lines.filter(line => /^(missing|broken link|error|bad|fatal|invalid)/i.test(line));
  if (!good(fsck) && !problems.length) problems.push(`git fsck exited ${fsck.exitCode}${fsck.error ? `: ${fsck.error}` : ''}`);
  return { ...base, ran: true, passed: good(fsck) && problems.length === 0, exitCode: fsck.exitCode,
    dangling: dangling.slice(0, candidateLimits.dangling), danglingTotal: dangling.length, problems: problems.slice(0, 50),
    scope: 'Connectivity-only check of commits and trees (blob contents not read). Full fsck runs later on the verified working copy.' };
}

function compare(folder, head, commit) {
  const result = head
    ? readGit(folder, ['diff', '--name-status', '-z', '--no-renames', '--no-ext-diff', '--no-textconv', head, commit, '--'])
    : readGit(folder, ['ls-tree', '-r', '-z', '--name-only', '--full-tree', commit]);
  if (!good(result)) return { error: (result.error || result.stderr || `exit ${result.exitCode}`).trim() };
  const parts = result.stdout.split('\0').filter(Boolean);
  const totals = { onlyInCandidate: 0, changed: 0, onlyInHead: 0 };
  const onlyInCandidate = [];
  if (!head) {
    totals.onlyInCandidate = parts.length;
    onlyInCandidate.push(...parts.slice(0, candidateLimits.samplePaths));
  } else {
    for (let index = 0; index + 1 < parts.length; index += 2) {
      const [status, file] = [parts[index], parts[index + 1]];
      if (status === 'A') {
        totals.onlyInCandidate++;
        if (onlyInCandidate.length < candidateLimits.samplePaths) onlyInCandidate.push(file);
      } else if (status === 'D') totals.onlyInHead++;
      else totals.changed++;
    }
  }
  return { base: head, ...totals, onlyInCandidatePaths: onlyInCandidate };
}

function describe(candidate) {
  const factors = [];
  if (candidate.kinds.includes('unreachable')) factors.push('Not referenced by any branch, tag or reflog (dangling): Git garbage collection may delete it.');
  if (candidate.kinds.includes('reflog-only')) factors.push(`Only reachable through the reflog (${candidate.selectors.slice(0, 3).join(', ') || 'reflog entry'}): it disappears when the reflog expires.`);
  if (candidate.kinds.includes('stash')) factors.push(`Stash entry ${candidate.selectors.find(item => item.startsWith('stash@')) || ''}`.trim() + ': uncommitted work saved by git stash.');
  if (candidate.kinds.includes('recovery-ref')) factors.push(`Already preserved by recovery ref ${candidate.refs.join(', ')}.`);
  if (candidate.kinds.includes('recent-history')) factors.push(`Earlier commit on the current branch (${candidate.selectors.find(item => item.startsWith('HEAD~')) || 'history'}); still reachable, listed so you can compare an older version.`);
  const comparison = candidate.comparison;
  if (comparison && !comparison.error) {
    if (comparison.onlyInCandidate) factors.push(`${comparison.onlyInCandidate} file(s) exist here but not in ${comparison.base ? 'current HEAD' : 'the (unborn) current branch'}.`);
    if (comparison.changed) factors.push(`${comparison.changed} file(s) differ from current HEAD.`);
    if (comparison.onlyInHead) factors.push(`${comparison.onlyInHead} file(s) in current HEAD are absent here.`);
    if (!comparison.onlyInCandidate && !comparison.changed && !comparison.onlyInHead) factors.push('Same file tree as current HEAD.');
  }
  const unknowns = ['Whether this commit contains the work you want needs your review; ordering is not a probability.'];
  if (!comparison) unknowns.push(`Not compared with HEAD (only the first ${candidateLimits.compared} candidates are compared during a scan).`);
  else if (comparison.error) unknowns.push(`Comparison failed: ${comparison.error}`);
  return { factors, unknowns };
}

/** Deterministic order: at-risk sources first, then more files missing from HEAD, then newest, then hash. */
export function rankCandidates(candidates) {
  const rank = candidate => Math.min(...candidate.kinds.map(kind => kindRank[kind] ?? 9));
  return [...candidates].sort((a, b) => rank(a) - rank(b) ||
    (b.comparison?.onlyInCandidate ?? -1) - (a.comparison?.onlyInCandidate ?? -1) ||
    (Date.parse(b.at) || 0) - (Date.parse(a.at) || 0) ||
    a.commit.localeCompare(b.commit));
}

export function discoverCandidates(folder, { dangling = [] } = {}) {
  const errors = [];
  const run = (label, args) => {
    const result = readGit(folder, args, { maxBuffer: 16 * 1024 * 1024 });
    if (!good(result)) errors.push(`${label}: ${(result.error || result.stderr || `exit ${result.exitCode}`).trim()}`);
    return good(result) ? result.stdout : '';
  };
  const headResult = readGit(folder, ['rev-parse', '--verify', '--quiet', 'HEAD^{commit}']);
  const head = good(headResult) && hash.test(headResult.stdout.trim()) ? headResult.stdout.trim() : null;
  const found = new Map();
  const add = (commit, kind, extra = {}) => {
    if (!hash.test(commit ?? '')) return;
    const item = found.get(commit) ?? { commit, at: null, subject: '', kinds: [], selectors: [], refs: [] };
    if (!item.kinds.includes(kind)) item.kinds.push(kind);
    if (extra.selector && !item.selectors.includes(extra.selector)) item.selectors.push(extra.selector);
    if (extra.ref && !item.refs.includes(extra.ref)) item.refs.push(extra.ref);
    item.at ||= extra.at || null;
    item.subject ||= extra.subject || '';
    found.set(commit, item);
  };

  const stashParents = new Set();
  for (const [commit, parents = '', selector, at, ...subject] of rows(run('stash list', ['stash', 'list', '--format=%H%x09%P%x09%gd%x09%cI%x09%s']))) {
    parents.split(' ').slice(1).forEach(parent => stashParents.add(parent));
    add(commit, 'stash', { selector, at, subject: subject.join('\t') });
  }
  const selectors = new Map();
  for (const [commit, selector, ...message] of rows(run('reflog', ['reflog', 'show', '--all', '-n', String(candidateLimits.reflog * 5), '--format=%H%x09%gd%x09%gs']))) {
    if (!selectors.has(commit)) selectors.set(commit, []);
    selectors.get(commit).push(`${selector} (${message.join('\t')})`);
  }
  const reflogOnly = head || selectors.size ? run('reflog-only commits',
    ['log', '--reflog', '--not', '--all', '-n', String(candidateLimits.reflog), '--format=%H%x09%cI%x09%s']) : '';
  for (const [commit, at, ...subject] of rows(reflogOnly)) {
    if (stashParents.has(commit)) continue;
    const entries = selectors.get(commit) ?? [];
    add(commit, 'reflog-only', { at, subject: subject.join('\t') });
    for (const selector of entries.slice(0, 3)) add(commit, 'reflog-only', { selector });
  }
  for (const [commit, ref] of rows(run('recovery refs', ['for-each-ref', '--format=%(objectname)%09%(refname)', 'refs/heads/recovery', 'refs/recovery']))) {
    add(commit, 'recovery-ref', { ref });
  }
  for (const commit of dangling.slice(0, candidateLimits.dangling)) {
    if (!stashParents.has(commit)) add(commit, 'unreachable');
  }
  if (head) {
    const recent = rows(run('recent history', ['log', '--first-parent', '-n', String(candidateLimits.recentHistory + 1), '--format=%H%x09%cI%x09%s', head]));
    for (const [index, [commit, at, ...subject]] of recent.slice(1).entries()) add(commit, 'recent-history', { at, subject: subject.join('\t'), selector: `HEAD~${index + 1}` });
  }
  const missingDetails = [...found.values()].filter(item => !item.at);
  for (const item of missingDetails) {
    const shown = readGit(folder, ['show', '-s', '--format=%cI%x09%s', item.commit]);
    if (good(shown)) [item.at, item.subject] = [shown.stdout.split('\t')[0].trim() || null, shown.stdout.split('\t').slice(1).join('\t').trim()];
    else errors.push(`commit ${item.commit.slice(0, 12)}: object unreadable`);
  }

  const total = found.size;
  const preliminary = rankCandidates([...found.values()]).slice(0, candidateLimits.listed);
  for (const [index, item] of preliminary.entries()) {
    item.comparison = index < candidateLimits.compared ? compare(folder, head, item.commit) : null;
  }
  const candidates = rankCandidates(preliminary).map((item, index) => ({ ...item, rank: index + 1, ...describe(item) }));
  const count = kind => candidates.filter(item => item.kinds.includes(kind)).length;
  return {
    at: new Date().toISOString(), head, candidates, errors,
    totals: { listed: candidates.length, discovered: total, reflogOnly: count('reflog-only'), unreachable: count('unreachable'),
      stashes: count('stash'), recoveryRefs: count('recovery-ref'), recentHistory: count('recent-history'),
      offBranch: candidates.filter(item => item.kinds.some(kind => kind !== 'recent-history')).length },
    scope: `Local refs, reflogs, stashes, dangling commits from the object check and the last ${candidateLimits.recentHistory} commits of the current branch; at most ${candidateLimits.listed} listed and ${candidateLimits.compared} compared with HEAD. No remote contacted. Expired reflogs and garbage-collected objects cannot be found.`,
  };
}
