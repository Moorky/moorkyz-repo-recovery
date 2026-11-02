# Live portfolio preservation compatibility

- Date: 2026-11-02.
- Authority: owner asked to run the workbench across all repositories.
- Scope: safe acquisition compatibility discovered during that run, not a claim
  that all portfolio cases have already been repaired.
- Original workbench source was independently copied and SHA-256 verified before
  these fixes; raw evidence stays in the external private repair workspace.

## Reproduced blockers and changes

1. On installed Node.js 24.22.2, `cpSync` with `errorOnExist` rejected the
   exclusively reserved destination root. Copying individual source entries into
   that new root fixes the failure without allowing overwritten destinations.
   The failed empty destination was retained and a new destination selected.
2. Real pnpm workspaces contain relative internal dependency links. Snapshot now
   hashes their target text and acquisition copies them verbatim, without
   traversal. Absolute/escaping and indirectly escaping links remain rejected.
   Dangling links are preserved as metadata, not claimed recovered file content.
3. Main repositories retain registered-worktree `commondir` metadata pointing
   inside their own Git directory. These contained pointers are supported;
   external linked-worktree roots/object alternates remain separate acquisitions.
4. Snapshot uses native physical-path resolution and reuses already-computed full
   snapshots within each gate. It does not introduce stat-only caching, sampling
   or skipped byte verification. Originals and backups are still rehashed.

## Verification

- PASS: Node.js 24.22.2, all 60 regression tests.
- PASS: internal/dangling-link preservation and copy independence.
- PASS: contained registered-worktree metadata without redirecting the copy.
- PASS: stale approvals, original/backup changes and unsafe links still fail.
- PASS: all 13 preserved historical input hashes and local Markdown links.
- Real portfolio inspection found 12 roots. Ancillary raw worktree/wrapper
  preservation verified five sources; two old registered worktree paths are
  unavailable and remain explicit gaps, not automatically deleted registrations.

No project purpose was rewritten. No original media, sibling source, branch,
stash, remote or private browser data was repaired by these compatibility
changes. Portfolio outcomes are recorded separately by the running workbench.
No commit, push or deployment performed for this workbench task.

The portfolio also includes an existing project-local Python renderer, distinct
from global Python. Reviewed Python commands now accept an explicit
working-copy-relative interpreter path. The path is validated, displayed in the
preview and covered by the working-copy hash; no outside-copy selection, silent
global fallback or automatic installation was added.
