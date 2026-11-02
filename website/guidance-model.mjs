export function nextStep(repository) {
  const records = repository.records ?? {};
  if (!records.inspection) return { stage: 0, label: 'Inspect this case', detail: 'Read local structure and Git state. This does not execute project code.' };
  if (!records.preservation) return { stage: 1, label: 'Create or verify copies', detail: 'Keep an untouched backup and a separate working copy outside the portfolio.' };
  if (!records.integrity?.passed) return { stage: 2, label: records.integrity ? 'Review integrity failure' : 'Check Git integrity', detail: 'Inspect the saved errors on the working copy; do not reset or prune the original.' };
  if (!records.quality?.passed) return { stage: 3, label: records.quality ? 'Review failed checks' : 'Preview validation checks', detail: 'First recover any selected historical files in Recovery workflow, then approve the real project tests.' };
  if (!records.recovery) return { stage: 4, label: 'Validate the handoff', detail: 'Write the actual target and limitations. Recheck candidate freshness and recovered bytes.' };
  return { stage: 4, label: 'Review validated result', detail: 'Validation covers the stated scope at its recorded time. Original integration and product completion are separate.' };
}

const finite = value => typeof value === 'number' && Number.isFinite(value) && value >= 0;
const sum = values => values.reduce((total, value) => total + value, 0);
export function measuredStatistics(repositories, now = Date.now()) {
  const inspected = repositories.filter(repo => repo.records?.inspection);
  const preserved = repositories.filter(repo => repo.records?.preservation);
  const quality = repositories.filter(repo => repo.records?.quality);
  const recovered = repositories.filter(repo => repo.records?.recovery);
  function metric(get) {
    const values = repositories.map(get).filter(finite);
    return { value: values.length ? sum(values) : null, known: values.length, unknown: repositories.length - values.length };
  }
  const timed = repositories.flatMap(repo => repo.procedures ?? []).filter(item => finite(item.durationMs));
  const durations = timed.map(item => item.durationMs).sort((a, b) => a - b);
  const timestamps = inspected.map(repo => Date.parse(repo.records.inspection.at)).filter(Number.isFinite);
  const baseline = sum(recovered.map(repo => repo.records.recovery.baselineFiles).filter(finite));
  const matched = sum(recovered.map(repo => repo.records.recovery.matchedFiles).filter(finite));
  return {
    total: repositories.length, inspected: inspected.length, uninspected: repositories.length - inspected.length,
    preserved: preserved.length, integrityPassed: repositories.filter(repo => repo.records?.integrity?.passed === true).length,
    qualityPassed: quality.filter(repo => repo.records.quality.passed === true).length,
    qualityFailed: quality.filter(repo => repo.records.quality.passed === false).length,
    notValidated: repositories.length - quality.length, recovered: recovered.length,
    delivered: repositories.filter(repo => repo.lifecycle?.deliveredAt).length,
    sourceOnly: inspected.filter(repo => repo.records.inspection.state === 'source-only').length,
    failedAttempts: repositories.flatMap(repo => repo.procedures ?? []).filter(item => item.status === 'failed').length,
    attempts: repositories.flatMap(repo => repo.procedures ?? []).length,
    durationsKnown: timed.length,
    medianDurationMs: durations.length ? (durations[Math.floor((durations.length - 1) / 2)] + durations[Math.floor(durations.length / 2)]) / 2 : null,
    oldestInspectionAgeMs: timestamps.length ? Math.max(0, now - Math.min(...timestamps)) : null,
    retention: baseline ? { matched, baseline, percent: matched / baseline * 100 } : null,
    tracked: metric(repo => repo.records?.inspection?.summary?.trackedFiles),
    missing: metric(repo => repo.records?.inspection?.summary?.missingIndexPaths),
    stagedDeletions: metric(repo => repo.records?.inspection?.summary?.stagedDeletions),
    audits: metric(repo => repo.records?.inspection?.summary?.auditPaths),
    tags: metric(repo => repo.records?.inspection?.summary?.tags),
    stashes: metric(repo => repo.records?.inspection?.summary?.stashes),
    baselineBytes: metric(repo => repo.records?.preservation?.summary?.bytes),
    baselineFiles: metric(repo => repo.records?.preservation?.summary?.files),
    links: metric(repo => repo.records?.preservation?.summary?.links),
  };
}

export const helpTopics = {
  workflow: { title: 'The safe order', body: 'Inspect -> preserve -> check integrity -> compare/recover -> test -> validate -> review. A passing gate is evidence for its stated scope, not permission to reset originals.', link: '/manual#the-seven-step-workflow' },
  preservation: { title: 'What is actually preserved?', body: 'Both independent copies must match the complete recorded source baseline. File bytes and contained relative-link targets are checked. Numbers count one baseline, not two copies or available free space. External worktrees and browser profiles are separate.', link: '/manual#preservation-and-space' },
  health: { title: 'Measured gates, not a health score', body: 'These counts come from saved records. Failed, not run and unknown are separate. A clean checkout can still contain the wrong product. A delivered case is a reviewed scoped handoff, not proof of total recovery.', link: '/manual#understanding-the-statistics' },
  history: { title: 'Git evidence survives independently', body: 'Audit paths include templates, Git tags are not package versions, and stashes are local recovery candidates. Missing index paths and staged deletions have different meanings. Zero is shown only when a successful inspection measured it.', link: '/manual#git-and-historical-recovery' },
  retention: { title: 'Retention is not a loss percentage', body: 'Exact retained baseline files divided by all known baseline files. Intentionally changed files lower this number; newly recovered files do not mean the unknown past is complete. It includes the recorded baseline, which can include generated data and Git metadata.', link: '/manual#understanding-the-statistics' },
  timing: { title: 'Observed time, not an ETA', body: 'Attempt durations measure completed new attempts with start/end evidence. Older attempts without duration are excluded. Inspection age indicates staleness risk; this tool does not continuously watch the filesystem or predict repair time.', link: '/manual#long-running-and-interrupted-work' },
  estimates: { title: 'Subjective estimates', body: 'Potential/current values are rubrics or reviewer judgements. They are separate from measured gates and retained-byte evidence. Confidence is not a probability; never add these values into a global corruption percentage.', link: '/manual#understanding-the-statistics' },
  rescan: { title: 'Refresh versus rescan', body: 'Refresh reads saved evidence without invalidating it. Rescan discovers roots again and resets current gates because source identity may have changed. Archived attempt files remain. Use rescan deliberately, not as a progress-refresh button.', link: '/manual#long-running-and-interrupted-work' },
  approval: { title: 'Why preview and approve?', body: 'A preview binds the selected source, destination and bytes. Changed inputs require a new preview. Approval runs only the named operation; project scripts are not sandboxed and must be reviewed first.', link: '/manual#run-validation' },
};
