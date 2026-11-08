// Pure presentation logic for Simple Mode. No DOM access, so it is unit-tested directly.

export const modeKey = 'moorkyz-recovery-mode';
export const validMode = value => (value === 'advanced' ? 'advanced' : 'simple');

const scanLabels = {
  'not-scanned': ['Not scanned', 'neutral'],
  blocked: ['Blocked: Git problems found', 'danger'],
  'candidates-found': ['Recovery candidates found', 'attention'],
  'needs-review': ['Needs review', 'attention'],
  'no-candidates': ['No local candidates found', 'neutral'],
};

export function caseStatus(repo) {
  const records = repo.records ?? {};
  const make = (key, label, tone) => ({ key, label, tone });
  if (repo.unavailable) return make('unavailable', 'Folder no longer found', 'neutral');
  if (repo.interrupted) return make('interrupted', 'Interrupted: review before continuing', 'danger');
  if (repo.lifecycle?.deliveredAt) return make('completed', 'Completed and handed off', 'success');
  if (repo.lifecycle?.dismissedAt) return make('dismissed', 'Dismissed', 'neutral');
  if (records.recovery) return make('validated', 'Recovery validated', 'success');
  if (records.quality?.passed === false) return make('checks-failed', 'Checks failed', 'danger');
  if (records.quality?.passed === true) return make('checks-passed', 'Checks passed', 'success');
  if (repo.recoveryTargets?.length) return make('files-restored', 'Files restored in working copy', 'progress');
  if (records.preservation) return make('protected', 'Copies verified', 'progress');
  const scan = repo.scan?.status ?? (records.inspection ? 'needs-review' : 'not-scanned');
  const [label, tone] = scanLabels[scan] ?? scanLabels['needs-review'];
  return make(scan, label, tone);
}

export function summaryCounts(repositories) {
  const counts = new Map();
  for (const repo of repositories) {
    const status = caseStatus(repo);
    const entry = counts.get(status.key) ?? { ...status, count: 0 };
    entry.count++;
    counts.set(status.key, entry);
  }
  const order = ['interrupted', 'blocked', 'candidates-found', 'needs-review', 'checks-failed', 'protected', 'files-restored', 'checks-passed', 'validated', 'completed', 'no-candidates', 'not-scanned', 'dismissed', 'unavailable'];
  return [...counts.values()].sort((a, b) => order.indexOf(a.key) - order.indexOf(b.key));
}

export function scanProgress(job) {
  if (!job || job.action !== 'scan') return null;
  const { total = 0, done = 0, failed = 0, current } = job.progress ?? {};
  const unread = failed ? `, ${failed} could not be read` : '';
  if (job.status === 'running') {
    const position = Math.min(done + 1, total);
    return { running: true, value: done, max: Math.max(total, 1),
      text: job.cancelRequested ? `Cancel requested — finishing ${current ?? 'the current project'} (${done} of ${total} done).`
        : total ? `Scanning ${position} of ${total}${current ? `: ${current}` : ''}…` : 'Discovering projects…' };
  }
  const finished = job.finishedAt ? ` at ${new Date(job.finishedAt).toLocaleTimeString()}` : '';
  if (job.status === 'cancelled') return { running: false, value: done, max: Math.max(total, 1), text: `Scan cancelled${finished}: ${done} of ${total} projects scanned${unread}. Results so far are saved.` };
  if (job.status === 'failed') return { running: false, value: done, max: Math.max(total, 1), error: true, text: `Scan stopped: ${job.error} ${done} of ${total} projects were saved.` };
  return { running: false, value: done, max: Math.max(total, 1), text: `Scan finished${finished}: ${total} project${total === 1 ? '' : 's'} scanned${unread}. No files were changed.` };
}

const kindLabels = { 'reflog-only': 'Only in reflog', unreachable: 'Dangling commit', stash: 'Stash', 'recovery-ref': 'Recovery ref', 'recent-history': 'Earlier commit' };
export function candidateView(candidate) {
  const comparison = candidate.comparison;
  let summary = 'Not compared with the current version yet.';
  if (comparison?.error) summary = `Comparison failed: ${comparison.error}`;
  else if (comparison) {
    const parts = [
      comparison.onlyInCandidate && `${comparison.onlyInCandidate} file${comparison.onlyInCandidate === 1 ? '' : 's'} missing from current version`,
      comparison.changed && `${comparison.changed} changed`,
      comparison.onlyInHead && `${comparison.onlyInHead} newer file${comparison.onlyInHead === 1 ? '' : 's'} not in this commit`,
    ].filter(Boolean);
    summary = parts.length ? parts.join(' · ') : 'Same files as the current version.';
  }
  return {
    commit: candidate.commit, short: candidate.commit.slice(0, 10), subject: candidate.subject || '(no message)',
    when: candidate.at ? new Date(candidate.at).toLocaleString() : 'Unknown time',
    kinds: candidate.kinds.map(kind => kindLabels[kind] ?? kind), summary,
    paths: comparison?.onlyInCandidatePaths ?? [], factors: candidate.factors ?? [], unknowns: candidate.unknowns ?? [],
  };
}

export function suggestedCopies(root, name, date = new Date()) {
  const separator = root.includes('\\') ? '\\' : '/';
  const trimmed = root.replace(/[\\/]+$/, '');
  const parent = trimmed.slice(0, Math.max(trimmed.lastIndexOf(separator), trimmed.indexOf(separator) + 1)) || trimmed;
  const safe = name.replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^[.-]+|[.-]+$/g, '') || 'project';
  const stamp = date.toISOString().slice(0, 16).replace(/[-:]/g, '').replace('T', '-');
  const join = leaf => `${parent.replace(/[\\/]+$/, '')}${separator}${leaf}`;
  return { backup: join(`${safe}-backup-${stamp}`), workingCopy: join(`${safe}-working-${stamp}`) };
}

export const guidedStepIds = ['scan', 'choose', 'protect', 'integrity', 'restore', 'checks', 'validate', 'handoff'];
export function guidedSteps(repo) {
  const records = repo.records ?? {};
  const done = {
    scan: Boolean(records.inspection),
    choose: Boolean(repo.selectedCandidate),
    protect: Boolean(records.preservation),
    integrity: records.integrity?.passed === true,
    restore: Boolean(repo.recoveryTargets?.length),
    checks: records.quality?.passed === true,
    validate: Boolean(records.recovery),
    handoff: Boolean(repo.lifecycle?.deliveredAt),
  };
  const titles = {
    scan: 'Scan (read-only)', choose: 'Choose what to recover', protect: 'Protect two copies', integrity: 'Check Git integrity',
    restore: 'Compare and restore files', checks: 'Run approved checks', validate: 'Validate and export', handoff: 'Hand off',
  };
  // "choose" and "restore" are optional: a case can be validated without restoring anything.
  const reachable = {
    scan: true, choose: done.scan, protect: done.scan, integrity: done.protect, restore: done.integrity,
    checks: done.integrity, validate: done.checks && done.integrity, handoff: done.validate,
  };
  const optional = new Set(['choose', 'restore']);
  const laterDone = id => guidedStepIds.slice(guidedStepIds.indexOf(id) + 1).some(next => done[next]);
  const current = guidedStepIds.find(id => !done[id] && reachable[id] && !(optional.has(id) && laterDone(id))) ?? 'handoff';
  return guidedStepIds.map(id => ({ id, title: titles[id], done: done[id], available: reachable[id], optional: optional.has(id), current: id === current }));
}
