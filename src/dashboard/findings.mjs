// Pure, deterministic interpretation of a saved inspection. Every finding cites the evidence it
// came from; nothing here estimates loss, health or recovery probability.

const good = command => command.exitCode === 0 && command.error === null;
const plural = (count, word) => `${count} ${word}${count === 1 ? '' : 's'}`;

export const scanStatuses = {
  'not-scanned': 'Not scanned',
  blocked: 'Blocked: Git problems found',
  'candidates-found': 'Recovery candidates found',
  'needs-review': 'Needs review',
  'no-candidates': 'No local candidates found',
};

export const limitations = [
  'A clean Git status does not prove that no functionality was lost.',
  'No remote was contacted; work that exists only on a server or another machine is not visible here.',
  'Expired reflog entries and garbage-collected objects cannot be discovered.',
  'No project code, package script or test was executed during the scan.',
];

export function assessFindings(inspection, error = null) {
  if (error) {
    return { status: 'blocked', label: scanStatuses.blocked, limitations,
      findings: [{ id: 'scan-error', severity: 'blocker', title: 'The scan could not read this project', evidence: error,
        nextAction: 'Fix the reported access problem (permissions, locked files, invalid manifest) and scan again. Unknown is not the same as empty.' }],
      nextAction: 'Fix the reported access problem and scan again.' };
  }
  if (!inspection) return { status: 'not-scanned', label: scanStatuses['not-scanned'], findings: [], limitations, nextAction: 'Scan repositories.' };
  const findings = [];
  const add = (id, severity, title, evidence, nextAction) => findings.push({ id, severity, title, evidence, nextAction });
  const evidence = inspection.recoveryEvidence;
  const objects = inspection.objects;
  const candidates = inspection.candidates;

  if (!inspection.hasGit) {
    add('source-only', 'warning', 'No Git metadata in this folder', 'No .git entry was found, so local history cannot be searched here.',
      'Preserve this folder, then look for the original repository, a backup or a bundle that still has history.');
  }
  if (inspection.linkedWorktree) {
    add('linked-worktree', 'warning', 'Linked worktree: Git data lives elsewhere', '.git is a file that points to another repository.',
      'Preserve the main repository that owns this worktree; this tool cannot certify copies of linked worktrees.');
  }
  if (inspection.submodule) {
    add('submodule', 'warning', 'Git submodule: history lives in the parent repository', '.git is a file that points into a parent .git/modules folder.',
      'Preserve the parent repository; copying a submodule on its own is not supported.');
  }
  if (inspection.containsSubmodules) {
    add('contains-submodules', 'warning', 'Contains Git submodules (not supported for copying)', 'A .gitmodules file is present; submodule status is not inspected.',
      'Protecting copies is refused while submodules are checked out. Preserve this repository with your own tools (for example a full folder backup) before any repair.');
  }
  const failed = [...(inspection.commands ?? []), ...Object.values(evidence?.commands ?? {})].filter(command => !good(command));
  if (inspection.state === 'unborn-or-damaged') {
    const headError = inspection.commands?.find(command => command.args.includes('HEAD'));
    const detail = (headError?.stderr || headError?.error || '').trim();
    const emptyRepository = evidence?.commits === 0 && !objects?.problems?.length;
    if (emptyRepository) {
      add('unborn', 'info', 'No commits yet', 'HEAD does not point to a commit and no commits exist on any ref.',
        'Nothing to recover from this history unless other copies exist.');
    } else {
      add('head-unreadable', 'blocker', 'Current commit (HEAD) cannot be read', detail || 'git rev-parse HEAD failed.',
        'Do not repair the original. Create protected copies and investigate the damage on the working copy.');
    }
  }
  if (failed.length && inspection.state !== 'unborn-or-damaged') {
    add('git-query-failed', 'blocker', `${plural(failed.length, 'Git query')} failed`,
      failed.slice(0, 3).map(command => `git ${command.args.join(' ')}: ${(command.stderr || command.error || `exit ${command.exitCode}`).trim()}`).join('\n'),
      'Create protected copies and diagnose the failed queries on the working copy. Do not assume missing output means missing data.');
  }
  if (objects?.problems?.length) {
    add('object-problems', 'blocker', 'Git reports missing or broken objects', objects.problems.slice(0, 5).join('\n'),
      'Create protected copies first; look for the missing objects in backups, other clones or a remote before any repair.');
  } else if (objects && objects.ran === false && inspection.hasGit) {
    add('objects-not-checked', 'info', 'Object connectivity was not checked during the scan', objects.skippedReason,
      'Run the integrity check on a verified working copy.');
  }
  const changes = evidence?.changes;
  if (changes?.conflicts) add('conflicts', 'warning', `${plural(changes.conflicts, 'conflicted path')} in the index`, 'git status reports unmerged paths.',
    'Preserve the repository as-is before resolving conflicts on a working copy.');
  if (evidence?.missingFromIndex?.length) {
    add('missing-files', 'warning', `${plural(evidence.missingFromIndex.length, 'tracked file')} missing from the working tree`,
      evidence.missingFromIndex.slice(0, 5).join('\n'), 'Create protected copies, then compare with a known-good commit and restore selected files.');
  }
  if (changes?.stagedDeletions?.length) {
    add('staged-deletions', 'warning', `${plural(changes.stagedDeletions.length, 'deletion')} staged for commit`, changes.stagedDeletions.slice(0, 5).join('\n'),
      'Check whether these deletions are intended before committing anything.');
  }
  if (changes && (changes.staged || changes.unstaged || changes.untrackedEntries)) {
    add('uncommitted-work', 'warning', 'Uncommitted work present',
      `${changes.staged} staged, ${changes.unstaged} unstaged, ${changes.untrackedEntries} untracked entries.`,
      'Preserve this work before anything else. Never reset or clean this folder.');
  }
  if (evidence?.shallow) add('shallow', 'info', 'Shallow clone', 'Older history was never downloaded to this copy.', 'Older commits can only come from another clone or the remote.');
  if (candidates?.errors?.length) add('candidate-errors', 'warning', 'Some history queries failed', candidates.errors.slice(0, 3).join('\n'), 'Review the candidates on a working copy.');
  const totals = candidates?.totals;
  const offBranch = totals ? totals.offBranch ?? totals.listed : 0;
  if (offBranch) {
    const parts = [
      totals.reflogOnly && `${plural(totals.reflogOnly, 'commit')} only in the reflog`,
      totals.unreachable && `${plural(totals.unreachable, 'dangling commit')}`,
      totals.stashes && (totals.stashes === 1 ? '1 stash entry' : `${totals.stashes} stash entries`),
      totals.recoveryRefs && `${plural(totals.recoveryRefs, 'existing recovery ref')}`,
    ].filter(Boolean);
    add('candidates', totals.reflogOnly || totals.unreachable ? 'warning' : 'info', `${plural(offBranch, 'recovery candidate')} found`,
      `${parts.join(', ')}.${totals.discovered > totals.listed ? ` ${totals.discovered} discovered; first ${totals.listed} listed.` : ''}`,
      'Review the candidates, choose one that contains the work you want, then create protected copies to compare and restore.');
  }
  const blocked = findings.some(item => item.severity === 'blocker');
  const status = blocked ? 'blocked' : offBranch ? 'candidates-found' :
    findings.some(item => item.severity === 'warning') ? 'needs-review' : 'no-candidates';
  if (status === 'no-candidates') {
    const earlier = totals?.recentHistory ? ` ${plural(totals.recentHistory, 'earlier commit')} of the current branch can still be compared.` : '';
    add('nothing-flagged', 'info', 'Nothing flagged locally',
      inspection.hasGit ? `No reflog-only, dangling, stash or recovery-ref commits and no missing tracked files.${earlier}` : 'No local history to search.',
      'If you know something is missing, open guided recovery and compare an older commit with the current files.');
  }
  const order = { blocker: 0, warning: 1, info: 2 };
  findings.sort((a, b) => order[a.severity] - order[b.severity]);
  return { status, label: scanStatuses[status], findings, limitations, nextAction: findings[0]?.nextAction ?? 'Review the findings.' };
}
