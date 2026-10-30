# Recovery handbook

## Purpose and vocabulary

Recover surviving implementation before reconstructing missing implementation.
Repository recovery includes documents, local-only files and divergent history,
not just GitHub default branches.

- **Observation:** measured at a stated time against an identified source.
- **Reported observation:** a historical document's assertion, not reverified here.
- **Hypothesis:** plausible explanation requiring evidence.
- **Decision:** chosen action with scope, owner and approval.
- **Unknown:** evidence absent; never a zero or a confirmed loss.

File counts, branch counts and ahead/behind numbers are not loss percentages.
An audit describing a feature does not supply that feature's code.

## 0. Stop destructive activity

Pause sync, cleanup and repair activity with the owner's agreement. Do not run
pull, merge, rebase, reset, clean, prune, garbage collection, stash pop, root
consolidation or force-push on originals. Do not launch sibling product code
merely to inspect it: startup can write data or run migrations.

## 1. Preserve every source

Identify original, nested and duplicate roots, linked worktrees, external Git
directories, bundles, backup/sync versions and IDE history. Keep copies separate
with source path, collection time, collector and checksum manifests.

Preserve working trees including hidden `.git`, untracked and ignored files.
For linked worktrees, preserve the referenced common Git directory too. A
bundle covers selected reachable refs, not ignored files, all reflog-only objects
or a full working tree. A source ZIP without `.git` cannot establish local history.

Use a separate untouched preservation copy and verify content hashes/counts.
Record inaccessible paths and copy failures. Never mark this gate passed from
inventory output alone. Private media and credentials stay outside this project.

**Gate:** independently verified copies exist and the owner has identified the
disposable investigation copy. Strict forensic acquisition requires its own
process; ordinary filesystem reads may update access timestamps.

## 2. Inventory, without repair

On a preserved investigation copy collect actual root, Git metadata location,
HEAD, refs, worktrees, stashes and optional reflogs. Capture command errors too.
Use the [inventory tool](TOOLING.md); its scan stops at grandchildren and does
not search every drive. Explicitly inspect deeper or external roots separately.

Run expensive `git fsck --no-reflogs --unreachable` only on a secured copy after
estimating cost. Do not use `--lost-found` during read-only inspection: it writes.
Absence from a branch reflog does not prove loss; deleted branch reflogs may no
longer exist. Inspect surviving HEAD/other reflogs, refs, objects and backups.

**Gate:** each candidate has provenance, errors and unknowns recorded.

## 3. Compare independent sources

Obtain remote state separately, only with authorized network/account access.
Record observation time, remote identity, branch tip SHAs and complete pagination.
Never fetch into the original just to make a comparison easier.

Compare commits by ancestry/merge base and files by bytes plus deliberate
line-ending normalization. Keep remote, local and backup copies independent.
Duplicate paths and equal counts do not establish equivalent contents.

**Gate:** unique content and commits are mapped to actual surviving sources.
No causal claim about sync, reset or user profiles is made without evidence.

## 4. Select a recovery class

| Class | Evidence | Action on a separate integration copy |
|---|---|---|
| A - Synchronize | One tip is an ancestor of the other | Preserve both tips, then consider fast-forward |
| B - Reconcile | Both copies contain unique work | Review selective merge/cherry-pick and file integration |
| C - Restore | Missing content survives in objects/backups/IDE history | Extract into a separate destination, compare and test |
| D - Reconstruct | Recovery sources exhausted; requirements verified | Implement only confirmed missing scope, labeled newly built |

Do not choose D because a ZIP is incomplete or GitHub has only a README. Do not
automatically rebase all branches. Shared history must not be rewritten without
explicit authorization. Handle unrelated histories as a case-specific decision,
not an automatic `--allow-unrelated-histories` operation.

**Gate:** a reviewed case plan names base/candidate SHAs, target copy, recovery
class, approvals, expected output, rollback source and validation.

## 5. Recover and validate

Work in a third disposable integration copy/rescue branch, never over a backup.
Preserve original tips before applying selected patches. Keep unrelated changes.
Separate root migration, template adoption and functional recovery.

Run the affected repository's own tests/build/reference checks using disposable
fixtures. Check retained requirements and unique capabilities, not only file
counts. Review secrets, private-data exposure, dependencies and CI independently.
Record `PASS`, `FAIL`, `NOT RUN` with reason or `N/A` for each check.

**Gate:** intended content is recovered, regressions addressed, remaining unknowns
listed and rollback remains possible.

## 6. Handoff and prevention

Complete the [case](templates/CASE.md) and [audit](templates/AUDIT.md) records.
List recovered SHAs/files, discarded alternatives with reasons, tests, blockers,
approval state and next owner action.

Local verification is not human approval or permission to publish. Git
initialization, commits, pushes, merges and deployment follow explicit owner
authorization and the target project's rules. Review public files before staging;
never stage a whole preservation directory. Add tested backup/restore practice
and clear canonical-root ownership after recovery, not during emergency triage.
