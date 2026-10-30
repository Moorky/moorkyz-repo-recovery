# Dashboard and medikit

## Run

```powershell
node .\src\dashboard\server.mjs --root "C:\Users\marvi\source\repos" --port 4317
```

Open http://127.0.0.1:4317, or launch [DASHBOARD.cmd](../DASHBOARD.cmd).
Node 22+ and Git are required. There are no external dependencies, CDN assets,
frontend compilation or automatic installations.

The root is chosen at server startup, not accepted from an arbitrary HTTP path.
Discovery lists all non-hidden immediate directories except common dependency,
data and build folders, then one level deeper where a recognized project
marker exists. Empty folders and folders without Git are included as candidates,
not falsely claimed to be Git repositories. Links/junctions are not followed.
Enumeration/manifest errors are explicit.

Private state is stored in `%USERPROFILE%\.moorkyz-recovery\dashboard`.
Pass `--data <external-directory>` for another root; existing state must match
that root. A new session restores recorded evidence with observation times.
Rescan resets gates deliberately; rerunning a stage invalidates it and all later
stages, even if the rerun fails. Evidence is not a live-monitoring guarantee:
rescan/re-inspect after changes. External links/secrets are not automatically checked.

## Five medikit stages

| Order | Action | Evidence / prerequisite |
|---|---|---|
| 1 | Inspect condition | Root rubric, Git root/HEAD/status/refs/worktrees; no repair or product execution |
| 2 | Verify preservation | Existing independent untouched backup and disposable working copy; complete baseline bytes and directories match original |
| 3 | Object integrity | Non-writing `git fsck --full --no-reflogs --unreachable --no-progress` on verified working copy; source-only Git is N/A |
| 4 | Quality checks | Passing integrity; explicit Node execution approval or eligible documentation-only profile |
| 5 | Validate recovery baseline | Passing checks, unchanged source/backup, unchanged candidate since quality, final Git integrity |

Full preservation hashes **all** regular files, including `.git`, ignored files,
media and installed dependencies. It streams file contents in 1 MiB chunks but
can be slow and memory-intensive for very large path inventories. No files are
copied or deleted. Quiesce other writers; linked worktrees/external Git metadata
need separate acquisition and cannot be certified here. Backup and working copy
must be independent and outside scanned/project/state directories.

Stage 4 supports `package.json` scripts named `test`, `lint`, `build`, `typecheck`.
It runs every declared member of that set; **test is required** for Node final
quality. No package-manager inference or dependency installation is attempted.
Scripts execute with npm and `CI=true`, two-minute command timeouts and an 8 MiB
output cap. Errors/timeouts are saved as failed measurements. Scripts can create
side effects and child processes; this is not a sandbox or process supervisor.

The documentation-only profile checks Markdown local-file links, excludes
archived `sources`, requires at least one Markdown file, and is rejected for
projects with `package.json` or recognized source directories. It does not test
anchors, external references, prose quality or product behavior.

Jobs run one at a time in a worker so the HTTP server remains responsive.
API/job failures are visible; scores unlock only after evidence is saved.
There is no automatic repair queue, history integration or remote completeness scan.

## Exact score contract (0-100)

These are **rubric scores**, not objective product-quality ratings, loss
percentages or probabilities. “Final” means measured against this contract at
the recorded time. Tool/check failure is not replaced by a guessed success.

### Static potential rubric

| Measured root signal | Points |
|---|---:|
| README.md | 20 |
| Recognized source directory or docs directory | 25 |
| Test directory or declared test script | 25 |
| CONTRIBUTING.md or AGENTS.md | 15 |
| SECURITY.md | 15 |

### Condition

Before inspection: heuristic estimate 0 for empty, 50 for a Git marker, 25 for
source-only. It is explicitly not a diagnosis.

After successful inspection:
`round(static rubric / 2 + successful Git queries / 5 * 50)`.
No Git means zero Git points, not manufactured history. Any failed Git query
blocks a final condition number. Unborn/damaged state is shown with raw evidence;
uncommitted work is a caution, not proof of corruption.

### Potential quality / measured quality

Before inspection: unavailable. After inspection: static rubric as an estimate.
After approved validation:
`round(static rubric on working copy * 0.30 + passing checks / executed checks * 70)`.

Failed checks still produce a **measured low final quality score**, but prevent
recovery validation. Missing test command, unsupported profile or inaccessible
input produces no final score. A passing command does not prove adequate test
coverage or absence of vulnerabilities. Scope lists the actual checks.

### Recovery

Unavailable until stage 5:
`round(exactly retained original-baseline files / original-baseline files * 100)`.

Only byte-identical original files count as retained. New files are not losses;
changed baseline files reduce this retention metric even when intentional.
The dashboard does not assess missing code that was never in the supplied
baseline. A 100 score is not a recovered-history certificate.

### Confidence

Evidence coverage, not probability: 20 points each for inspection, verified
preservation, passing integrity, passing quality and completed baseline validation.
Provisional until all five stages; then 100 final coverage. It can be 100 with
a recovery-retention score below 100 because these measure different things.

## Verification

```powershell
npm test
npm run lint
```

`npm test` runs disposable engine/API/inventory fixtures. Browser validation
checks the real UI, filtering, gate presentation and responsive layout. The
project's “lint” script is the existing document/source consistency checker,
not an added third-party JavaScript linter.
