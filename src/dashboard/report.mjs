import { readGit } from '../recovery.mjs';
import { assessFindings, limitations } from './findings.mjs';

const good = result => result.exitCode === 0 && result.error === null;
const nulList = text => text.split('\0').filter(Boolean);
const lines = text => text.split(/\r?\n/).filter(Boolean);
const auditPath = name => /(^|\/)(\.audits|audits)(\/|$)|(^|\/)audit[^/]*\.md$/i.test(name);
const versionPath = name => /(^|\/)(package\.json|[^/]*(changelog|version|release)[^/]*\.(md|json|txt))$/i.test(name);

function changes(text) {
  const entries = nulList(text);
  const result = { staged: 0, unstaged: 0, stagedDeletions: [], stagedRenames: 0, conflicts: 0, untrackedEntries: 0 };
  for (let index = 0; index < entries.length; index++) {
    const entry = entries[index];
    const status = entry.slice(0, 2);
    if (status === '??') {
      result.untrackedEntries++;
      continue;
    }
    if (status === '!!') continue;
    if (status[0] !== ' ') result.staged++;
    if (status[1] !== ' ') result.unstaged++;
    if (status[0] === 'D') result.stagedDeletions.push(entry.slice(3));
    if (status[0] === 'R') result.stagedRenames++;
    if (['DD', 'AU', 'UD', 'UA', 'DU', 'AA', 'UU'].includes(status)) result.conflicts++;
    // Porcelain -z emits a second path for renames/copies, even when it contains newlines.
    if (/[RC]/.test(status)) index++;
  }
  return result;
}

export function collectRecoveryEvidence(repository) {
  const queries = {
    tracked: ['ls-files', '-z'],
    missing: ['ls-files', '--deleted', '-z'],
    changes: ['status', '--porcelain=v1', '-z', '--untracked-files=normal'],
    refs: ['for-each-ref', '--format=%(refname)'],
    commits: ['rev-list', '--all', '--count'],
    shallow: ['rev-parse', '--is-shallow-repository'],
    stashes: ['stash', 'list', '--format=%H'],
    reflog: ['reflog', 'show', '--all', '--format=%H', '-n', '250'],
  };
  const commands = Object.fromEntries(Object.entries(queries).map(([key, args]) => [key, readGit(repository, args)]));
  const value = (key, parse) => good(commands[key]) ? parse(commands[key].stdout) : null;
  const tracked = value('tracked', text => [...new Set(nulList(text))]);
  const refs = value('refs', lines);
  return {
    commands,
    hasErrors: Object.values(commands).some(command => !good(command)),
    trackedFiles: tracked?.length ?? null,
    missingFromIndex: value('missing', text => [...new Set(nulList(text))]),
    changes: value('changes', changes),
    auditPaths: tracked?.filter(auditPath) ?? null,
    versionPaths: tracked?.filter(versionPath) ?? null,
    localBranches: refs?.filter(ref => ref.startsWith('refs/heads/')).map(ref => ref.slice(11)) ?? null,
    remoteTrackingRefs: refs?.filter(ref => ref.startsWith('refs/remotes/')).length ?? null,
    tags: refs?.filter(ref => ref.startsWith('refs/tags/')).map(ref => ref.slice(10)) ?? null,
    commits: value('commits', text => Number(text.trim())),
    shallow: value('shallow', text => text.trim() === 'true'),
    stashes: value('stashes', text => lines(text).length),
    reflogEntriesSampled: value('reflog', text => lines(text).length),
    scope: 'Local Git/index evidence, not fsck, a remote comparison, a backup or proof of product completeness. Reflog sample is capped at 250.',
  };
}

function text(value) {
  if (value === null || value === undefined) return 'Unknown';
  return String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
    .replace(/[\\`*_[\]{}()|#!~]/g, '\\$&').replace(/[\r\n\t\0]/g, ' ');
}

function nextAction(inspection, error) {
  if (error) return 'Resolve the inspection error; do not infer missing data from a failed read.';
  if (!inspection) return 'Run read-only inspection; no assessment has been saved.';
  const evidence = inspection.recoveryEvidence;
  if (!inspection.hasGit) return 'Preserve this source-only copy; locate Git history/backups separately.';
  if (inspection.commands.some(command => !good(command)) || evidence?.hasErrors) {
    return 'Preserve all copies and diagnose failed Git queries on a separate copy.';
  }
  if (!evidence) return 'Re-inspect to collect audit, version and missing-path evidence.';
  if (evidence.changes.conflicts) return 'Preserve the index and conflict stages before manual reconciliation.';
  if (evidence.missingFromIndex.length) return 'Preserve current state; compare missing index paths with Git objects and independent copies.';
  if (evidence.changes.staged || evidence.changes.unstaged || evidence.changes.untrackedEntries) {
    return 'Preserve staged, unstaged and untracked work before selecting a baseline. Do not reset.';
  }
  return 'Compare with an agreed historical baseline, then validate an independent copy. Clean does not mean complete.';
}

export function renderReport(state) {
  const output = [
    '# Local recovery evidence report', '',
    `Generated: ${new Date().toISOString()}`,
    `Discovery snapshot: ${text(state.scannedAt)}`,
    `Scan root: ${text(state.root)}`, '',
    'Private local report: review before sharing. This is NOT a backup or a repair.',
    'This export uses saved inspections; it does not refresh files, run tests, contact remotes or validate Git objects.',
    'A clean checkout can still be an incomplete or intentionally changed product. Counts are not loss percentages.',
    'Staged deletions are changes relative to HEAD; missing index paths are absent from the working tree. Neither proves permanent loss.',
    'Audit counts include templates/checklists. Version metadata is not release approval. Unknown is not zero.',
    'Recovery effort: not automatically estimated; an agreed baseline, missing capabilities and verified sources are required.', '',
    '| Project | Inspection state | Tracked files | Missing index paths | Staged deletions | Audit paths | Git tags |',
    '|---|---|---:|---:|---:|---:|---:|',
  ];
  for (const repository of state.repositories) {
    const inspection = repository.records?.inspection;
    const evidence = inspection?.recoveryEvidence;
    output.push(`| ${text(repository.name)} | ${text(repository.inspectionError ? 'inspection-failed' : inspection?.state ?? 'not-inspected')} | ${text(evidence?.trackedFiles)} | ${text(evidence?.missingFromIndex?.length)} | ${text(evidence?.changes?.stagedDeletions?.length)} | ${text(evidence?.auditPaths?.length)} | ${text(evidence?.tags?.length)} |`);
  }
  for (const repository of state.repositories) {
    const inspection = repository.records?.inspection;
    const evidence = inspection?.recoveryEvidence;
    output.push('', `## ${text(repository.name)}`, '',
      `- Path: ${text(repository.path)}`,
      `- Inspected: ${text(inspection?.at)}`,
      `- Next action: ${nextAction(inspection, repository.inspectionError)}`,
      `- Root package version: ${text(inspection?.measured?.packageVersion)}; package manager: ${text(inspection?.measured?.packageManager)}.`,
      `- Declared supported checks (not executed by inspection): ${text(inspection?.measured?.availableChecks?.join(', ') || null)}.`);
    const head = inspection?.commands.find(command => command.args.includes('--verify') && command.args.includes('HEAD'));
    output.push(`- HEAD: ${text(head && good(head) ? head.stdout.trim() : null)}.`);
    const view = repository.scanView ?? { ...assessFindings(repository.inspectionError ? null : inspection, repository.inspectionError ?? null),
      candidates: inspection?.candidates ?? null, at: inspection?.at ?? null };
    output.push(`- Scan status: ${text(view.label)}${view.at ? ` (scanned ${text(view.at)})` : ''}.`);
    for (const finding of view.findings ?? []) {
      output.push(`- Finding [${text(finding.severity)}]: ${text(finding.title)}. Evidence: ${text(finding.evidence)}. Next: ${text(finding.nextAction)}`);
    }
    const objects = (repository.scan?.inspection ?? inspection)?.objects;
    if (objects) output.push(`- Object check: ${objects.ran ? (objects.passed ? 'passed (connectivity only)' : `FAILED: ${text(objects.problems.slice(0, 3).join('; '))}`) : `not run: ${text(objects.skippedReason)}`}.`);
    for (const candidate of view.candidates?.candidates?.slice(0, 10) ?? []) {
      const comparison = candidate.comparison && !candidate.comparison.error ? `; vs HEAD: ${candidate.comparison.onlyInCandidate} only here, ${candidate.comparison.changed} changed, ${candidate.comparison.onlyInHead} only in HEAD` : '';
      output.push(`- Candidate #${candidate.rank}: ${text(candidate.commit)} (${text(candidate.kinds.join(', '))}) ${text(candidate.at)} ${text(candidate.subject)}${text(comparison)}.`);
    }
    if ((view.candidates?.candidates?.length ?? 0) > 10) output.push(`- Further candidates: ${view.candidates.candidates.length - 10} not listed in this report.`);
    if (repository.selectedCandidate) output.push(`- Selected candidate: ${text(repository.selectedCandidate.commit)} (${text(repository.selectedCandidate.subject)}), chosen ${text(repository.selectedCandidate.at)}.`);
    if (evidence) {
      output.push(
        `- Reachable commits across refs: ${text(evidence.commits)}; shallow history: ${text(evidence.shallow)}.`,
        `- Local branches: ${text(evidence.localBranches?.length)}; cached remote refs: ${text(evidence.remoteTrackingRefs)} (not a fresh remote check).`,
        `- Stashes: ${text(evidence.stashes)}; reflog entries sampled: ${text(evidence.reflogEntriesSampled)} (cap 250, not full history).`,
        `- Staged entries: ${text(evidence.changes?.staged)}; unstaged entries: ${text(evidence.changes?.unstaged)}; untracked entries: ${text(evidence.changes?.untrackedEntries)} (may represent directories).`,
        `- Staged renames: ${text(evidence.changes?.stagedRenames)}; conflict entries: ${text(evidence.changes?.conflicts)}.`);
      for (const [label, values] of [
        ['Git tags', evidence.tags], ['Local branch names', evidence.localBranches],
        ['Missing index paths', evidence.missingFromIndex], ['Staged deletions', evidence.changes?.stagedDeletions],
        ['Audit paths', evidence.auditPaths], ['Version/changelog/manifest paths', evidence.versionPaths],
      ]) {
        output.push(`- ${label}: ${values == null ? 'Unknown' : values.length === 0 ? 'None observed' : `${values.length} total; first ${Math.min(20, values.length)}: ${values.slice(0, 20).map(text).join('; ')}`}.`);
      }
    }
    const failures = [
      ...(inspection?.commands ?? []),
      ...Object.values(evidence?.commands ?? {}),
    ].filter(command => !good(command));
    if (repository.inspectionError) output.push(`- Inspection error: ${text(repository.inspectionError)}`);
    for (const command of failures) {
      output.push(`- Failed Git query: ${text(command.args.join(' '))}; exit ${text(command.exitCode)}; ${text(command.error || command.stderr)}`);
    }
    for (const [key, label] of [['findings', 'Findings'], ['diagnosis', 'Diagnosis'], ['report', 'Issue report'],
      ['cure', 'Cure'], ['nonfixable', 'Unresolved scope'], ['finalReport', 'Final report']]) {
      if (repository.case?.[key]) output.push(`- Saved ${label}: ${text(repository.case[key])}`);
    }
    for (const key of ['preservation', 'integrity', 'quality', 'recovery']) {
      const record = repository.records?.[key];
      output.push(`- ${key}: ${record ? `recorded at ${text(record.at)}${record.passed === false ? ' (FAILED)' : ''}` : 'NOT RUN / no current evidence'}.`);
    }
    const records = repository.records ?? {};
    if (records.preservation) output.push(`- Verified-copy locations: backup ${text(records.preservation.backup)}; working ${text(records.preservation.workingCopy)}.`);
    if (records.compare) output.push(`- Compared commit: ${text(records.compare.commit)}; counts: ${text(JSON.stringify(records.compare.totals))}.`);
    for (const target of repository.recoveryTargets ?? []) {
      output.push(`- Restored target: ${text(target.file)}; commit ${text(target.sourceCommit)}; SHA-256 ${text(target.afterHash)}.`);
    }
    for (const result of records.quality?.results ?? []) {
      output.push(`- Validation ${text(result.check)}: exit ${text(result.exitCode)}${result.error ? `; ${text(result.error)}` : ''}.`);
    }
    if (records.recovery?.acceptance) output.push(`- Reviewed acceptance: ${text(records.recovery.acceptance)}`);
    for (const [label, value] of Object.entries(records.recovery?.verification ?? {})) output.push(`- Final verification (${text(label)}): ${text(value)}`);
    if (records['rescue-apply']) output.push(`- Preserved recovery branch: ${text(records['rescue-apply'].branch)} at ${text(records['rescue-apply'].sourceCommit)}.`);
    if (records['remote-fetch']) output.push(`- Imported remote namespace: ${text(records['remote-fetch'].namespace)}; ${text(records['remote-fetch'].imported?.length)} refs.`);
    for (const procedure of repository.procedures ?? []) {
      output.push(`- Procedure: ${text(procedure.name)}; ${text(procedure.at)}; ${text(procedure.status)}; archived attempt ${text(procedure.evidenceId)}.`);
    }
  }
  output.push('', '## Remaining limitations', '', ...limitations.map(item => `- ${item}`),
    '- Approved validation commands are not sandboxed: they run with your user permissions and may access files and the network.',
    '- A passing check proves only what that check tests, not that all intended functionality is restored.',
    '- Nothing in this report was written to an original repository, pushed, published or deployed by this tool.');
  output.push('', '## Discovery boundaries', '',
    'Discovery is bounded to the root, children and grandchildren; unmarked/deeper projects may be absent.',
    'Ignored/runtime/browser data, historical deletions and external backups are not assessed for completeness.');
  for (const item of state.skipped ?? []) output.push(`- ${text(item.path)}: ${text(item.reason)}`);
  return `${output.join('\n')}\n`;
}
