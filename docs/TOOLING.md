# Supported tooling

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
node --test .\tests\recovery.test.mjs
node --test .\tests\dashboard.test.mjs
node .\scripts\check-project.mjs
```

Tests use disposable temporary repositories only, not the sibling projects.
They cover nested roots/worktrees, unchanged Git state, output containment,
bad input and explicit command failures. The project checker verifies local
Markdown file links outside the immutable originals and hashes all archived
sources against the manifest. It does not certify external links or secrets.

## Historical scripts

Two supplied PowerShell tools and their launcher remain in the source archive
for provenance. They are **not supported entrypoints** and are not run by this
project. There is one supported inventory implementation, avoiding divergent
PowerShell/Node behavior. The Windows launcher only prints help; inspection
always requires an explicit command.

The separate [dashboard launcher](../DASHBOARD.cmd) starts the loopback website.
Its medikit includes opt-in working-copy checks beyond the read-only inventory
contract; see [dashboard tooling and scores](DASHBOARD.md).
