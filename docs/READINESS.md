# Recovery workbench readiness

Version **0.4.0**, 2026-11-08 (open-source MVP candidate, not tagged). The
supported **supervised repository recovery** workflow is implemented end to end,
now with a one-click read-only scan, recovery-candidate discovery and a Simple
mode guided flow. This is not a claim that the original projects have already
been repaired, or that disk/browser/media/AI recovery is implemented. See the
[guided workflow](GUIDED_RECOVERY.md), [release readiness](RELEASE_READINESS.md)
and [pending owner decisions](OWNER_DECISIONS.md).

## What works now

| Capability | Verified behavior / boundary |
|---|---|
| One-click scan (0.4.0) | Rediscover and inspect every project read-only with progress, confirmed cancellation and per-project persistence; bounded `fsck --connectivity-only`; originals byte-identical afterwards (tested). |
| Findings and statuses (0.4.0) | Evidence-backed findings with next action and limitations; Blocked / Recovery candidates found / Needs review / No local candidates; no percentages in Simple mode. |
| Recovery candidates (0.4.0) | Reflog-only, dangling, stash, recovery-ref and recent-history commits; compared with HEAD; deterministic, explained ordering; selectable per case. |
| Simple mode and guided recovery (0.4.0) | Eight steps over the existing engine with previews, explicit approvals, auto-advance, per-case Markdown report and handoff; Advanced mode keeps every earlier feature. |
| Portfolio triage | Bounded project/nested-Git discovery; read-only audit/version/missing-index evidence; Markdown/JSON CLI reports. |
| Dashboard | Local SQLite cases, staged gates, notes, estimates, diagnostics, history and report downloads. |
| Copy acquisition | Preview and approve two new independent full byte copies, including ignored files and Git; verify hashes and original stability. Never overwrite an existing destination. |
| Git diagnostics | Working-copy fsck, reachable commits, reflog candidates, saved unreachable commit candidates and local refs. |
| Historical comparison | Chosen commit versus working-copy bytes, with identical/changed/missing/unsupported paths. No filters or intent assumptions. |
| Historical restoration | Preview/approve one regular-file blob at a time, including binary files and missing parents; enforce unchanged target and final SHA-256 expectations. |
| Lost commit preservation | New `recovery/<name>` branch in the disposable copy, without checkout/reset or overwriting refs. |
| Remote comparison/import | Explicitly approved HTTPS/local refs; fetch into a unique working-copy namespace only. No push, existing-ref replacement or original modification. |
| Validation | Previewed root/nested package and script adapters, real tests required, configurable timeout, output cap, cancellation and explicit failure/skip results. |
| Final handoff | Recheck preservation, Git, candidate freshness and restored targets; require written acceptance and final report before delivery. |
| Durable attempt evidence | Private uniquely named JSON per new attempt; previous outputs survive rescans/reruns. Read them from procedure history. |
| Existing file fixes | Restore a preserved file, normalize UTF-8 line endings, repair an exact local Markdown link; approval and revalidation required. |
| Footer | Normal document flow, verified to move with scrolling on desktop and remain in flow at 390px mobile width. |
| Guided operator interface | Seven-step instructions, next-step project cards, visible copy roles, optional detailed table and distinct refresh/rescan controls. |
| Measured panels and help | Evidence/history/copy/run panels with unknown denominators; accessible question-mark explanations and links to the extensive local manual. |

## Validation evidence

### 0.4.0 (2026-11-08, Windows 11, Git 2.50.1)

- `npm test`: **87 tests, 87 passed**, 0 failed/cancelled/skipped on Node 22.18.0;
  the same 87/87 on portable, checksum-verified Node **22.13.0** (declared minimum)
  and **24.22.2**. Includes a headless Microsoft Edge end-to-end test of the
  complete Simple-mode guided workflow.
- `npm run lint` and `npm run smoke` passed on all three Node versions.
- A hard process kill during copy acquisition left the partial backup unverified,
  refused reuse of its destination and left the original byte-identical.
- Linux and macOS: GitHub CI on `1494e1e` (pushed by the owner) passed on Ubuntu, failed on
  macOS and timed out on Windows; logs were not accessible. The fixes after the independent
  audit (see [release readiness](RELEASE_READINESS.md)) have not run in CI yet. Treat Linux
  and macOS as unverified.
- Independent audit of `1494e1e`: NO-GO because scans of Git LFS repositories wrote into the
  original `.git` (S0). Fixed on `dev`; regression tests use a real git-lfs repository and a
  marker-writing filter.
- Manual browser walkthrough of the demo (scan → handoff) in an integrated browser;
  the Blob download event is not observable there, so the report endpoint is
  verified through HTTP tests instead.

### 0.3.1 (2026-11-03)
- **66 automated tests passed**, zero failed/skipped; syntax, whitespace and
  local-link checks passed, and all 13 preserved historical input hashes matched.
- Full regression testing covers acquisition, stale approvals, path boundaries,
  lost-commit anchoring without hooks/reset, local-remote import, historical-file
  recovery, original/backup preservation, validation failures/cancellation, saved
  acceptance, archived output and delivery.
- A disposable live-browser pilot completed the actual UI path: inspect, acquire,
  integrity, compare, restore, integrity, preview checks, run tests, accept and
  deliver. Its original remained missing the test feature while the working copy
  recovered it and passed the real test.
- Native pointer interaction succeeded after bringing the integrated browser to
  the foreground. The Markdown endpoint and download handler succeeded; this
  integrated browser did not emit Playwright's Blob-download event, so an OS
  download-file assertion is not claimed.
- Node/npm execution is exercised. Python/PowerShell/.NET adapters are tested for
  executable/argument planning and missing-tool failure, not certified against
  every test platform or sibling project's real toolchain. Supply appropriate
  runtime/platform arguments and dependencies yourself.
- Live HTTPS authentication, large private datasets, power-loss acquisition and
  intentionally escaping/malicious subprocesses are not certified. Remote tests
  use disposable local repositories, never the owner's GitHub repositories.
- Source-hash and local Markdown-link checks protect preserved historical input.
  Final counts/results are recorded in the
  [completion audit](../.audits/2026-11-02-guided-recovery-completion.md).

## Intentional limits, not hidden success fallbacks

- A human selects the intended version/capabilities. No automatic reconstruction,
  subjective loss percentage, scope reduction or universal completion guarantee.
- Absolute/escaping links, linked-worktree roots and object alternates require manual
  acquisition. Byte copies do not certify ACLs, NTFS alternate streams or device
  metadata. Failed partial copies are retained, never silently erased/reused.
  Contained relative links are preserved without traversal; external registered
  worktrees remain separately scoped sources.
- One historical file per approval, maximum 64 MiB. No unreviewed full-tree
  replacement or automatic merge/rebase/integration into originals.
- SSH/custom remote transports need a separate reviewed workflow. No automatic
  dependency installation, publishing, live deployment or credential handling.
- Approved checks are **not sandboxed**. Code can access absolute paths/network;
  timeout/cancellation cannot contain deliberately detached/malicious processes.
- Browser profiles/IndexedDB, raw media, deleted-disk data, cloud version history
  and the [AI experiments](AI_SCIENCE_TODO.md) are separate product scopes.

## Ready to use

Run `DASHBOARD.cmd` (asks for the folder) or `node src/dashboard/server.mjs --root <folder> --open`.
No frontend build or package installation is required. Start with the
[quick start](QUICKSTART.md), then the [extensive operator manual](USER_GUIDE.md)
and the [guided recovery](GUIDED_RECOVERY.md)
steps rather than running a copied reset command.

The owner subsequently authorized a local portfolio pass. Verified case results
and selected source repairs are recorded in the external repair workspace; that
does not authorize remote access, root migrations or reinstating rejected product
scope. See [owner decisions](OWNER_DECISIONS.md). Per-project source repairs must
be distinguished from completed tests, preserved originals and remaining barriers.

The [portfolio assessment](../PROJECT_RECOVERY_ASSESSMENT.md) is retained as a
dated historical assessment. Generate fresh evidence before acting on a case.
