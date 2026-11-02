# Guided recovery: a complete local case

This workbench can now acquire copies, find historical work, restore selected
files and validate a reviewed result. It never silently chooses which former
product the owner intended. All mutations stay in new external copies; originals
and verified backups are not repair targets. No automatic checkout, reset,
merge, rebase, prune, push or deployment.

## 1. Inspect and choose the goal

Open `DASHBOARD.cmd`, select a case and run **Inspect local condition**.
Record the intended capability/baseline in Case & outcomes. Clean Git status
does not prove completeness. A removal commit is evidence of a change, not
proof that the owner approved it.

## 2. Acquire independent copies

In **Recovery workflow**, choose **Preview creation of full backup + working
copy**. Enter two new absolute directories whose parents already exist outside
the scanned portfolio, recovery project and private dashboard-state directory.

The preview shows file count, original bytes and twice that byte count for the
two copies (not a filesystem free-space guarantee). Save/close applications and
stop writers first. Review and approve the unchanged preview.

The tool copies all regular files, empty directories, ignored data and `.git`,
then hashes both copies against the original and checks the original again.
Existing destinations are refused. A failure retains partial copies with an
explicit error; never retry over them or call them verified. Choose new
destinations after reviewing available space and the cause.

Contained relative links (including pnpm dependency links) are copied verbatim,
not followed. Link text is included in the hash baseline, including dangling
links; missing targets are not magically recovered. Absolute/escaping links,
linked-worktree roots, submodule `.git` pointer files, object alternates and
external Git working-tree configurations are refused.
Registered worktree metadata is retained when its common-directory pointer
stays within the copied root. External registered worktree directories are
separate sources and are not covered by this root's preservation certificate.
Acquire those independently before deciding whether they hold unique work.
This is byte preservation, not ACL/ADS/device-metadata forensic acquisition.

If you already have independent complete copies, use the existing
**Verify independent preservation** stage instead.

## 3. Check Git and locate surviving versions

Run **Check local object integrity**. Then use **Discover commits, reflog and
saved unreachable commits** in Recovery workflow:

- Up to 100 reachable log entries and 100 reflog entries with hashes, times and
  subjects. Reflog is local and can expire; it cannot recreate absent objects.
- Local refs, including tags and imported recovery refs.
- Unreachable commit hashes reported by the last integrity check.

Enter a hash, ref or selector such as `HEAD@{1}`. For a useful reflog-only commit,
preview a new `recovery/<name>` branch and approve it. The branch is created
**only in the disposable working copy**, with hooks disabled and an atomic
must-not-exist check. No checkout/reset/index replacement occurs.

## 4. Compare and restore historical files

Choose **Compare a historical commit with the working copy**. The report
classifies selected-tree paths as identical, changed, missing or unsupported.
Comparison is byte-exact and does not run Git filters/textconv; CRLF or LFS
pointer differences are not automatically loss. Extra working-copy files are
retained and are not classified as missing.

Select a missing/changed file from the comparison, or enter its relative path.
Preview the chosen commit/file. The preview binds the resolved commit, path,
before/after hashes and lengths, with a bounded text excerpt where possible.
Approve only after reviewing those bytes. The target must still match preview.
Missing parent directories can be created inside the working copy.

One regular file is restored per approval, up to 64 MiB. Binary blobs are
copied exactly; symlinks/submodules, metadata/traversal paths and nonportable
reserved filenames are refused. No current file is overwritten without preview
approval. Repeat for other selected files. Bulk/unreviewed tree replacement and
automatic merging are intentionally not offered.

Restored targets are retained as exact SHA-256 expectations for final validation.
If you subsequently modify one, its historical-byte requirement must be reviewed;
the tool refuses to silently claim that the original restored bytes still match.

## 5. Optional fresh remote comparison and import

Choose **Compare fresh configured-remote refs / preview import**, name a remote
already configured in the working copy (for example `origin`), and explicitly
approve contacting it. Supported transports are HTTPS and absolute local
repository directories. SSH/custom helpers are outside this release's boundary.
Credentials embedded in URLs, query strings and URL fragments are refused.
HTTPS may use installed/configured authentication helpers; review Git
configuration first. Do not paste credentials into this tool.

The preview lists current advertised branch/tag IDs versus cached tracking refs.
This is not yet a full remote content/ancestry comparison. Approving import
fetches branches/tags into a **new unique `refs/recovery/import/...` namespace**
in the working copy. Existing branches/tags, HEAD, index and FETCH_HEAD are not
rewritten; submodules and automatic maintenance are disabled.

Changed advertisements require another preview. If a race occurs during fetch,
imported objects/refs are retained with an error for review. Then run integrity
again and inspect imported commits before choosing files. Nothing is pushed.

## 6. Preview and run the actual checks

After modifications, rerun integrity. Choose a validation profile:

- **Node:** declared root npm test/lint/build/typecheck/type-check scripts.
- **Documentation:** local links, only for eligible source-free projects.
- **Reviewed commands:** 1-10 explicitly described commands, including at least
  one real test (`kind: "test"`). Each working directory is relative to the
  verified disposable copy.

Example nested package and Python documentation checks:

```json
[
  {"name":"workspace tests","kind":"test","runner":"package","manager":"pnpm","script":"test","directory":"src"},
  {"name":"documentation","kind":"check","runner":"python","file":"tools/check_docs.py","directory":".","args":[]}
]
```

Choose only commands that actually exist in that project. Supported runners:

| Runner | Required fields | Invocation |
|---|---|---|
| `package` | `manager` npm/pnpm, `script`, `directory` | Declared package script; no arbitrary shell fragments |
| `node` | `file` .js/.mjs/.cjs, `directory`, optional `args` | Installed Node with the selected script |
| `python` | `file` .py, `directory`, optional `args` | Python on PATH with selected script |
| `powershell` | `file` .ps1, `directory`, optional `args` | pwsh, no profile, noninteractive, selected file |
| `dotnet` | Project/solution `file`, `directory`, optional `args` | dotnet test --no-restore; supply project-specific test-platform arguments |

Python commands may additionally select `interpreter`, relative to the working
copy root, for example `.venv/Scripts/python.exe`. The preview shows the resolved
executable. Missing, linked or outside-copy interpreter paths fail explicitly;
there is no silent fallback to global Python and no automatic package install.

Preview first, read the resolved executable/arguments/directories and approve.
Changes to working-copy bytes or the plan invalidate approval. The workbench
does not install tools/dependencies. Missing prerequisites are explicit failures.
Package scripts themselves are code and may install things: **not a sandbox**.
Review scripts and arguments, especially for access to original absolute paths.

Per-command timeout is 1-1800 seconds, default 120. Combined stdout/stderr is
capped at 8 MiB per command; overflow fails explicitly with partial output.
Checks stop after a failure, recording remaining checks as not run.
**Cancel running validation** requests termination of the owned child/process
tree. Cleanup failures are reported. This cannot contain malicious or deliberately
detached code; inspect any such processes separately before continuing.

## 7. Validate and hand off

Run **Validate the recovery baseline** with a written acceptance statement:
what capability was recovered, which checks verify it and remaining limitations.
The tool rechecks original/backup stability, candidate freshness, Git integrity,
known-file retention and exact hashes of restored historical targets.

Save a final case report, then **Mark delivered**. Delivery requires recorded
acceptance, not just a numerical score. Measurements are timestamped, not
continuous monitoring; any external edit requires revalidation.

Download Markdown for a portable report and keep the JSON/SQLite evidence
private. Review the resulting working copy before any manual integration into
the original. Integration/publication is a separate owner decision.

Every new procedure attempt has a uniquely named private JSON artifact under
the dashboard data directory's `attempts` folder. These are never overwritten
by later attempts or removed by a rescan. Use **Read archived attempt** in
Procedures used to inspect previous output. Older procedure rows from before
this feature do not magically gain missing historical output.

## Supported completion boundary

This is a supervised repository/source recovery workbench, not disk forensics,
an automatic product reconstruction agent, or a browser/media/cloud data rescue
service. It does not claim that a passing test recovers unrecorded requirements.
AI model experiments remain a separately scoped roadmap. Record unresolved
choices in [owner decisions](OWNER_DECISIONS.md).
