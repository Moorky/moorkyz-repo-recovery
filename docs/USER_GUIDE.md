# How to recover your projects correctly

This manual explains the supervised recovery workbench from first launch to a
reviewed handoff. Follow the order. The goal is to preserve surviving work,
recover a specific missing capability, and verify it without damaging the
original. It is not to make every indicator green.

## What this tool can and cannot promise

The workbench can inspect repositories, preserve independent copies, read Git
history and reflogs, compare a historical tree, recover selected files, run
reviewed tests and record the result. It cannot infer your intended product,
recreate deleted objects that exist nowhere, recover private browser data from
Git, or guarantee that a passing test means the whole product is finished.

- A clean checkout means the worktree matches its index, not that no feature is missing.
- A recorded deletion can be a deliberate product decision or a mistake; review the request and audit.
- Existing audit files help identify work but are not substitutes for source or data.
- A Git tag, package version, commit and deployed version are different things.
- A verified backup protects a known baseline; it does not prove that earlier work was already complete.
- A completed procedure and a completed recovery case are separate events.

## Before opening the dashboard

1. Stop cleanup, synchronization and automatic repair activity that could change the affected sources.
2. Save open documents. Do not force-close apps holding unsaved work. Identify any development servers that write heartbeat/log files.
3. Decide the recovery target: a missing file, old feature, known-good commit or documented behavior.
4. Choose a local external recovery directory with sufficient free space. Do not use a directory inside the project being scanned.
5. Keep original media, browser profiles, secrets and personal data private. Never publish backup folders.
6. Use installed Node.js 22.13 or newer; Node 24 LTS and Git are recommended. The workbench has no npm dependencies or frontend build.

The normal source folder, a preservation backup and a disposable working copy
must be three distinct places. A Git linked worktree shares metadata and is not
an independent preservation backup.

## Start the correct workspace

Open `DASHBOARD.cmd` in the recovery repository, or run:

```powershell
node .\src\dashboard\server.mjs --root "C:\Projects" --data "C:\Recovery\dashboard" --port 4317
```

Open the loopback address printed in the terminal. The source root is the
directory containing the projects to examine. The data directory contains the
private SQLite database and immutable attempt files; it must not overlap the
source root or recovery project's source.

Use the same data directory when resuming the same case history. Another data
directory starts a different workspace. The port is not the identity of the
saved evidence. If a port is already in use, inspect its owner or choose another
port; do not kill an unknown process.

If you are using a VS Code tunnel, open or forward this local port within your
own trusted session. Do not expose the dashboard publicly or proxy around its
same-origin checks. A `vscode.dev/tunnel/...` link opens the editor, not the
recovery website itself.

## Read the screen before taking action

The top of the dashboard gives you:

- **How to recover:** the safe sequence, with links to detailed instructions.
- **Evidence gates:** saved inspection, preservation, integrity, validation and handoff counts.
- **History and missing paths:** measured local Git evidence, with unknown cases explicitly counted.
- **Preservation and retention:** baseline size, file/link counts and exact retained-file ratios.
- **Attempts and time:** historical failures and observed durations, never an invented ETA.
- **Project cards:** a readable status and the next safe action for each case.

Use the `?` buttons by pointer hover, keyboard focus or click/tap. The help panel
explains the statistic, its limitations and where to read more. Escape or Close
dismisses it. Information is not available only on hover.

Search and filters affect the project list/cards. The measured panels use all
discovered cases. The separate Diagnostics date controls apply to that
diagnostic view, not to the whole workspace's measured overview.

The advanced table contains the full reviewer-estimate and lifecycle columns.
Open **Show advanced table** when you need them; it is not required for a first
recovery. Panels retain their existing movement/resize controls. Reset layout
changes presentation, not your case evidence.

## The seven-step workflow

1. **Define and inspect:** choose the correct original and write the target.
2. **Preserve:** create or verify an untouched backup and independent working copy.
3. **Check integrity:** inspect surviving Git objects on the working copy.
4. **Compare and recover:** choose verified historical sources and approve selected changes.
5. **Validate:** run the repository's real checks with reviewed commands.
6. **Accept:** recheck preservation, candidate freshness and recovered files against the target.
7. **Hand off:** write limitations, export the report and separately decide whether to integrate.

The next-action button opens the appropriate case stage; it does not run that
stage automatically. The case panel shows the original, backup and working-copy
paths together. Always read those locations before approving anything.

## Inspect a project

Click its project card, then **Inspect local condition**. Inspection reads
structure and Git metadata; it does not start the application, install packages,
fetch a remote or repair files.

In Case & outcomes, record:

- **Target:** the behavior/version you need back.
- **Findings:** observed facts such as a missing index path or known historical commit.
- **Diagnosis:** your interpretation, keeping uncertain causes explicit.
- **Issue report:** the problem, impact and what has not yet been checked.

If a project is missing from discovery, check its actual root. The scanner is
bounded to root/children/grandchildren and recognizes independent Git roots or
project manifests. Empty directories are not automatically corrupt projects.
A nested repository may be the real root beneath an outer launcher/data folder.
Preserve that wrapper separately if the program depends on it.

## Preservation and space

In **Recovery workflow**, choose **Preview creation of full backup + working
copy**. Enter two new absolute paths whose parent directories already exist.

```text
Original:      C:\Projects\my-project
Backup:        C:\Recovery\backups\my-project-001
Working copy:  C:\Recovery\working\my-project-001
Dashboard:     C:\Recovery\dashboard
```

The preview displays file count, link count and baseline bytes. Two full copies
need at least twice those bytes, plus build/cache/filesystem headroom. It is not
a free-space check. A 35 GiB data-heavy project can require more than 70 GiB.

Review the preview, select the approval checkbox and apply. The tool copies
ordinary files, hidden/ignored files and Git metadata, then checks hashes of
both copies and original stability. It preserves empty directories and
contained relative-link metadata without following the links. An unresolvable
dependency link is preserved as a link; its missing target is not recovered.

If you already made independent full copies, use **Verify independent
preservation** and enter those paths instead.

### Common copy problems

| Result | What to do |
|---|---|
| Destination exists | Do not overwrite or empty it. Inspect the old attempt and choose a new destination. |
| Preview changed | Stop the writer, inspect what changed, then create a fresh preview. Do not bypass the fingerprint. |
| Backup differs | Inspect the differences. Do not label it verified or use it as an untouched recovery source. |
| Absolute/escaping link | Preserve its target separately or use an explicit reviewed acquisition; do not follow it blindly. |
| Registered worktree | Root metadata may be preserved, but external worktree directories require their own archive. |
| Partial copy failure | The partial copy remains for review. It is not a successful backup and is never silently overwritten. |
| Too little space | Stop before creating more copies. Preserve existing evidence and choose an approved destination. |

A live portal heartbeat can invalidate a full copy. Save its state and arrange
a controlled stop of that specific service, not every Node process. Restore
the service afterward. Never close an evidence application with unsaved state
just to make copying convenient.

On Windows, thousands of files can take much longer than their total byte size
suggests because antivirus and metadata I/O are part of each full verification.
Elapsed time alone does not mean a job is stuck. Check recorded job state and
owned-process read activity before interrupting it; do not launch another copy
job on the same destinations.

## Check Git integrity

Run **Check local object integrity** after preservation succeeds. The command
uses the disposable copy, not the original. It records Git output and errors.

- Unreachable or dangling objects can be recovery candidates, not corruption by themselves.
- A missing/corrupt object is a real integrity issue. Look for another copy/bundle/remote source.
- A source-only project receives an explicit not-applicable Git result.
- Passing fsck means the checked local objects are internally consistent; it does not prove all remote or historical objects exist.

Do not run garbage collection, prune, reset or stash pop while investigating
lost history. Those operations can remove or obscure surviving evidence.

## Git and historical recovery

Use **Discover commits, reflog and saved unreachable commits**. The list is
bounded to 100 log and 100 reflog entries. Integrity evidence may contain
additional unreachable commit hashes. A bounded list is not the whole history.

Select a hash or enter a selector such as `HEAD@{1}`. First compare its tree with
the current working copy. Review missing, changed, identical and unsupported
paths. Byte differences can be line endings or filters, not missing features.

### Preserve a lost commit

Choose **Preview a new recovery branch**, select the commit and enter a new
name such as `recovery/lost-editor`. Review and approve it. This creates a new
ref in the disposable working copy without checkout, reset or changing the
current branch/index. Existing branch names are never overwritten.

A reflog entry cannot restore an object that has already been deleted
everywhere. Search other backups, copies and approved remote sources before
reconstructing new implementation.

### Restore a file

Choose a comparison row or enter a relative path, then preview restoration.
Check the source commit, current hash, restored hash, sizes and available text
excerpt. Approve only that current preview. If the file changes between
preview/apply, preview again.

One regular file is restored per approval, up to 64 MiB. Binary files are
copied exactly. The tool does not restore symlinks/submodules as executable
links, overwrite Git metadata, or perform an automatic whole-tree replacement.
Missing parent directories can be created safely inside the working copy.

After any fix, rerun integrity and validation. Restored historical targets are
checked by SHA-256 during final acceptance. If you deliberately improve a
restored file later, its exact historical-byte target must be reconciled, not
silently treated as unchanged.

## Optional remote sources

Use remote comparison only when permitted. Choose an already-configured
HTTPS or local-directory remote, explicitly authorize contact, and inspect its
advertised refs. Do not paste credentials into the tool.

Approving import fetches into a unique `refs/recovery/import/...` namespace in
the disposable copy. It does not publish, replace existing branches/tags, reset
HEAD or update the original. Rerun integrity and inspect imported commits before
restoring files. SSH/custom transports need a separate reviewed workflow.

Cached `origin/...` refs are not fresh remote evidence. A failed authentication
request is unknown, not proof the remote is empty. The tool does not make
automatic network retries that could duplicate an approved mutation.

## Run validation

Select the repository's actual checks. Read its contributor instructions,
package scripts and test prerequisites first. A command called `test` might
start services, install tools or access networks; the workbench is not a sandbox.

1. Choose root Node, eligible documentation-only, or reviewed commands.
2. Set a bounded per-command timeout appropriate to the actual suite.
3. Preview the resolved executable, arguments and working directory.
4. Confirm the working-copy path and approve code execution.
5. Read complete output in Evidence or the archived attempt.
6. Resolve failures on the working copy, then preview/run checks again.

Example nested pnpm workspace:

```json
[
  {"name":"full project gate","kind":"test","runner":"package","manager":"pnpm","script":"check","directory":"src"}
]
```

Example project-local Python check:

```json
[
  {"name":"reference check","kind":"test","runner":"python","interpreter":".venv/Scripts/python.exe","file":"tools/check_docs.py","directory":".","args":[]}
]
```

Declare 1-10 reviewed commands with at least one real test. Package runners
support npm/pnpm declared scripts; script runners support Node, Python,
PowerShell and .NET project files. Use the actual test-platform invocation; a
custom native console harness may need a project-owned wrapper rather than
pretending `dotnet test` ran it. See [runner details](GUIDED_RECOVERY.md).

Missing dependencies are failures, not permission to disable checks. Restore
only the project's existing lockfile/dependencies in its working copy after
the missing prerequisite is identified. Do not upgrade everything to latest.

Documentation-only validation is limited to eligible source-free projects.
Do not use it to bypass the real tests of an application.

## Long-running and interrupted work

The operation banner shows the case, operation, status and elapsed time. It
does not invent a percent-done or ETA. Full hashing can take a long time for
large data sets or tens of thousands of dependency files.

- **Refresh saved evidence** reads current saved state without resetting gates.
- **Rescan roots and reset gates** deliberately discovers roots again and invalidates current gates.
- Only one dashboard worker runs at a time; don't start a competing procedure.
- Validation can be cancelled; the tool attempts to terminate its owned process tree.
- Copy/Git operations finish their current bounded action; do not force-stop the server casually.
- Output limits/timeouts are failures, with partial output or skipped checks labeled.

If the browser disconnects, reconnect to the same server/data directory and
inspect the current job before doing anything. Never blindly resubmit an apply.
If the process itself was interrupted, an absent result is **not success**.
Inspect partial destinations and archive files; verify existing copies only
when their complete content can still be established.

Every new completed attempt has a uniquely named JSON record in the external
data directory's `attempts` folder. Use **Read archived attempt** in Procedures
used. SQLite stores current evidence and case notes. Old versions without
archived output cannot be retroactively certified.

## Understanding the statistics

| Panel or value | Definition | What it does not mean |
|---|---|---|
| Inspected | Cases with saved local inspection | Complete historical inventory |
| Copies verified | Cases with matching independent backup and working baseline | Forensic preservation of ACLs/ADS or external worktrees |
| Integrity passed | Saved successful local object check | All expected code/data exists |
| Validation passed/failed/not run | Actual recorded project check outcome | Product acceptance or security certification |
| Delivered | Explicit reviewed disposition after scoped validation | Changes were merged into the original or deployed |
| Missing index paths | Tracked index entries absent from the worktree | All files lost across history |
| Staged deletions | Index deletions relative to HEAD | Permanently unrecoverable content |
| Audit paths | Tracked audit-like files, including templates | Independently certified complete audits |
| Git tags | Existing local tag refs | Package versions, release approval or live remote state |
| Baseline bytes/files/links | One recorded source baseline per case | Actual free space or duplicated-copy storage consumption |
| Retention | Exact unchanged baseline files divided by known baseline files | Loss probability, feature completeness or value of recovered work |
| Failed attempts | Historical failed procedures, including resolved ones | Number of currently broken projects |
| Median time | Median known nonnegative completed attempt duration | Estimated completion time for the next run |
| Inspection age | Age of oldest valid saved examination | Continuous filesystem freshness guarantee |
| Subjective estimates | Rubric/reviewer values with scope and rationale | Measured corruption or recovery probabilities |

Unknown is not zero. Older saved records can lack new summary/timing fields.
Manual repairs verified outside a dashboard gate can be documented in case notes
and external logs; they do not automatically become machine-recorded passed gates.
Use re-inspection deliberately if you need new fields, knowing it invalidates
downstream gates. Always read the timestamp and denominator before interpreting
a ratio. Measured overview counts use all cases; Diagnostics has separate date
and group controls.

## Validate and hand off

After checks pass, enter a plain-language acceptance statement: what was
recovered, which tests prove the intended behavior, and what remains unverified.
Run **Validate the recovery baseline**. This rechecks untouched sources,
candidate freshness, Git and exact recovered-file targets.

Save a final report with:

- Original identity, baseline commit and relevant recovery sources.
- Backup and working-copy locations.
- Exact recovered/changed files and why those versions were selected.
- Tests/builds actually run, their outcomes and timestamps.
- Remaining gaps: private data, live integrations, old versions, migration barriers.
- The rollback source and proposed integration step.

Only then mark the scoped case delivered and export Markdown. Review the report
before sharing; it can contain private paths, branch names and case notes.
The source ZIP exports the recovery tool, **not a backup of your repositories**.
The PDF is a diagnostic summary, not full raw evidence.

## Integrating repairs into the original

The dashboard deliberately does not automate final integration. A tested
working copy is not authority to replace everything in the original.

1. Review the exact patch and intended product scope.
2. Confirm original files have not changed since the preserved baseline.
3. Keep before-images and a durable path/hash receipt.
4. Apply only reviewed files; retain unrelated staged/unstaged work.
5. Validate the actual final source and record any fresh failures.
6. Follow the project's audit/commit policy; don't include secrets or broad backups.
7. Restore any specifically paused local services and verify their actual URL.

Never blanket-copy `.git`, reset branches, clear user storage or remove a
migration maintenance lock merely to obtain a green result. Root consolidation,
live-data migration and deployment need their own verified acceptance.

## When to stop

Stop and preserve evidence if the only copy changes while you inspect it,
ownership of a running app is uncertain, files have conflicting newer edits,
a required source is missing, a migration barrier remains unresolved, or a
repair would require guessing the owner's product decision.

Write the concrete blocker and next safe action. A partial recovery with clear
evidence is more useful than a false “all repaired” result. Keep successful
cases and their timestamps; do not redo them just to hide a blocked case.

## Practical scenarios

### A project became a basic page

Compare current requirements, owner decisions and audits with earlier commits.
If simplification was intended, preserve the old branch but do not undo it.
If it was accidental, restore the specific implementation in a working copy,
restore its matching test/config dependencies and verify real behavior.

### Audits or version records seem missing

Check the actual Git root, hidden audit directories, older tracked paths,
stashes, refs and external worktrees. A moved audit is not lost. Package version
`0.1.0` without tags does not mean all history disappeared.

### The app works but backup verification fails

Look for live heartbeat/log writers, linked dependencies, external worktree
metadata or stale destinations. Stop only specifically identified managed
writers with saved state; preserve unresolved data separately.

### Tests pass but the application still cannot start

Check the documented launch contract, required runtime and maintenance barriers.
Tests may validate only offline fixtures. Don't claim desktop, provider or
production acceptance when those workflows were not exercised.

### Your full baseline includes large evidence/media files

Plan disk capacity and elapsed hashing time. Do not exclude private originals
silently to make copying faster. Do not open/upload recordings as test fixtures.
Preserve data as received and validate source/tooling with synthetic inputs.

## Final operator checklist

- Correct root, intended capability and owner authorization recorded.
- Original, backup and working copy identified separately.
- Copies verified; external/unsupported sources explicitly accounted for.
- Selected history and file approvals reviewed.
- Real validation passed for the claimed scope.
- Original stability and candidate freshness checked.
- Remaining failures/unknowns and migration barriers disclosed.
- Final report and attempts preserved privately.
- Any integration is selective, reversible and verified.
- Paused services restored; no orphaned test servers left behind.

For exact operation contracts, read [guided recovery](GUIDED_RECOVERY.md) and
[dashboard reference](DASHBOARD.md). Return to this manual whenever a green
indicator seems to imply more than the recorded evidence actually proves.
