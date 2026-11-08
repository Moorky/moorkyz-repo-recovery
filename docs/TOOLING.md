# Supported tooling

## Portfolio assessment

```powershell
node .\src\recovery.mjs assess --root "C:\preserved-copies" --output "C:\Recovery\assessment-001"
```

Uses the dashboard's bounded project discovery and read-only inspection. Writes
`assessment.md` and `assessment.json` to a new external directory; the parent
must already exist. Never overwrites an earlier report. Same containment rules
as inventory below, including physical-parent/junction checks.

The report includes working-tree state, Git-index missing files, staged deletions
and renames, root package version/check scripts, tracked audit/version paths,
local branches/tags, cached remote-ref count, reachable commit count, shallow
history, stashes and up to 250 reflog entries, plus the dashboard's scan status,
findings, object-check result and up to ten ranked recovery candidates per
project. A staged deletion is not an unstaged missing index path. Neither proves
unrecoverable loss. Audit paths can include templates; clean status is not a
completeness test.

No product scripts, installs, remote requests or repairs run. The only object
check is the read-only `git fsck --connectivity-only` (no `--lost-found`), skipped
above 250,000 objects. JSON retains
raw Git results and per-case errors. One failed inspection does not hide other
cases: partial reports are written and the CLI exits 1 with an explicit warning.
Unknown values are not counted as zero. Enumeration failures abort rather than
silently omitting inaccessible paths. Source-only projects have no fabricated
Git counts. Missing historical/private data and product intent remain unmeasured.

The dashboard's **Download Markdown report** uses the same renderer but exports
only saved evidence. `/api/report.md` requires the existing session token and
same-origin checks; export is blocked while a procedure is running. It never
re-inspects or runs scripts. Older saved inspections without extended evidence
say to re-inspect. Reports may contain private paths, filenames and case notes;
keep them outside the repo and review before sharing.

## Inventory

```powershell
node .\src\recovery.mjs inventory --root "C:\preserved-copies" --output "C:\Recovery\inspection-001"
```

- Node.js 22+ (24 LTS recommended); Git on PATH; no dependencies or network requests.
- Exactly one explicit root per invocation; scan root, children and grandchildren.
- Detects `.git` directories and `.git` files, including linked worktrees.
- Does not traverse symlink/junction directories or common data/build folders.
  Skipped paths are reported. Missing/inaccessible roots are errors.
- Output parent must exist. A new output folder is required, outside scan root
  and project, checked against resolved physical parent paths.
- Git runs with optional locks and automatic maintenance disabled, fsmonitor
  disabled and pagers off. Inherited Git path overrides are removed so queries
  address the selected copy. No hooks, product startup, fetch, fsck or repair.
- Captures HEAD, Git directory, refs, worktrees, stash identifiers and up to 250
  reflog entries. Reflog messages, remote URLs and working-tree file contents
  are not collected. Reports still contain private paths/branch names.
- Git command errors retain their exit code/stderr; a partial report exits 1.
  Detached/unborn HEAD is represented through raw command outcomes, not
  mistaken for a successful empty repository. Exit 0 means all queries passed,
  not that a backup or recovery succeeded.
- Each Git command has a 30-second timeout and 8 MiB output cap; errors are
  explicit, not silently truncated into a successful result.
- Enumeration/argument failures exit 1. No existing report is overwritten.

`git-snapshot.json` has `schemaVersion`, `collectedAt`, `scanRoot`, `scanDepth`,
`isBackup: false`, `skippedPaths`, `repositories`, and `hasErrors`. Each repository
has its candidate path and `commands`; each command records `args`, `exitCode`,
`stdout`, `stderr`, and `error`. Interpretation and preservation verification are
separate human-reviewed steps.

## Checks

```powershell
npm test                 # every suite: node --test tests/*.test.mjs
npm run lint             # node scripts/check-project.mjs
npm run smoke            # node scripts/smoke.mjs
node --test .\tests\scan.test.mjs   # one suite
```

Tests use disposable temporary repositories only, not the sibling projects.
They cover nested roots/worktrees, unchanged Git state, output containment,
bad input and explicit command failures, candidate discovery against commits the
test itself made unreachable, the HTTP scan and guided workflow, cancellation,
a hard process kill during a copy, and the CLI. The project checker verifies local
Markdown file links outside the immutable originals and hashes all archived
sources against the manifest. It does not certify external links or secrets.

`tests/browser.test.mjs` drives the real UI in an installed Chromium-based browser
(Edge or Chrome, headless) through `scripts/browser.mjs`, which speaks the DevTools
protocol over Node's built-in WebSocket. No npm package is involved. Without a
browser the test is reported as **skipped**, never passed. Override the executable
with `RECOVERY_BROWSER`. On Linux CI it adds `--no-sandbox` for the local test page.

`npm run smoke` creates the synthetic demo in a temporary folder, starts the
dashboard through its CLI with a new data folder, runs one scan, checks the expected
statuses and the first candidate, exports a case report and proves every original
is byte-identical. It exits 1 on any failed check.

## Demo, screenshots and release artifacts

```powershell
node scripts/demo.mjs ../recovery-demo                # synthetic damaged repositories (new folder)
node scripts/screenshots.mjs C:\demo                  # regenerate docs/assets from the real UI
node scripts/package.mjs ../release                    # existing folder outside the project
```

`demo.mjs` builds seven projects with known damage (reset-lost commit, deleted
branch, overwritten files, deleted object, clean, no `.git`, empty folder); see the
[quick start](QUICKSTART.md). `screenshots.mjs` runs the demo through the browser
driver; pass a neutral work folder so no personal path appears in the images.
`package.mjs` writes `moorkyz-repo-recovery-<version>-<short-sha>-source.zip` from
**committed files only** (the same allowlist as the dashboard source download: no Git
metadata, private inputs, audits, runtime data or secrets files) plus `BUILD-INFO.txt`
naming the commit, and a `.sha256` file. It refuses to run with uncommitted or untracked
changes and never overwrites.

## Continuous integration

`.github/workflows/ci.yml` runs `npm test`, `npm run lint` and `npm run smoke` on
Windows, Ubuntu and macOS with Node 22.13.0 (declared minimum) and 24. It has
read-only `contents` permission, pinned action commits, no secrets and no install
step.

## Public checkout checks

The immutable historical inputs are intentionally excluded from Git and source
downloads. A clean public checkout reports their hash gate and references as
**NOT RUN**, rather than requiring private evidence to be published or falsely
claiming it was verified. If an archive directory exists without its manifest,
the check fails as incomplete acquisition. Ordinary missing public links still
fail. The two owner-local portfolio report links are explicitly optional in a
downloaded source ZIP; they are not silently replaced with fabricated content.

## Historical scripts

Two supplied PowerShell tools and their launcher remain in the source archive
for provenance. They are **not supported entrypoints** and are not run by this
project. There is one supported inventory implementation, avoiding divergent
PowerShell/Node behavior. The Windows launcher only prints help; inspection
always requires an explicit command.

The separate [dashboard launcher](../DASHBOARD.cmd) starts the loopback website.
Its medikit includes opt-in working-copy checks beyond the read-only inventory
contract; see [dashboard tooling and scores](DASHBOARD.md).
