# Open-Source MVP Audit (0.4.0)

- **Date:** 2026-11-08
- **Baseline:** `dev @ 3c58133`; roadmap and scheduler-link commits `e535f18`, `383bcda`.
- **Request:** "Deliver a complete, polished, reliable open-source MVP" with local commits,
  no push/publish/tag/settings changes without approval.
- **Reviewer:** AI assistant self-review. Not human approval and not the independent
  release assessment.

## Scope and commits

| Commit | Change |
|---|---|
| `383bcda` | Kept the owner's working-tree removal of the out-of-repo scheduler link (check-project green) |
| `78d9f63` | Read-only candidate discovery, bounded object check, findings module |
| `e48695a` | Scan job API with progress/cancel, candidate selection, per-case reports, demo builder |
| `0f55501` | Simple mode, guided recovery, browser driver and E2E, HTTP E2E tests |
| `b664fba` | Interruption/CLI/smoke tests, CI workflow, packager, screenshots, launcher, 0.4.0 metadata |
| this commit | Documentation, templates, LICENSE line, readiness and this audit |

## Safety impact

- Originals: no new write path. The scan adds only read-only Git queries, including
  `fsck --connectivity-only` without `--lost-found`. Tests assert full byte snapshots
  (including `.git`) are unchanged after scan, guided recovery, cancellation, preview
  races and a hard kill during copying.
- Approvals: unchanged engine contract (plan hashes, fresh previews). The UI adds
  approval checkboxes and refuses to proceed without them (browser E2E).
- Code execution: unchanged and still **not sandboxed**; previews now include the
  declared script text.
- Persistence: projects missing from discovery keep their evidence (behavior change
  from silently dropping them on restart).

## Verification (Windows 11, Git 2.50.1)

| Check | Result |
|---|---|
| `npm test` on Node 22.18.0 | PASS: 87 tests, 87 pass, 0 fail/cancelled/skipped |
| `node --test` on Node 22.13.0 (portable, SHA-256 verified) | PASS: 87/87 |
| `node --test --test-reporter=tap` on Node 24.22.2 (portable, SHA-256 verified) | PASS: 87/87 |
| `npm run lint` | PASS on all three versions (13 preserved source hashes) |
| `npm run smoke` | PASS on all three versions (18 checks) |
| Browser E2E (headless Microsoft Edge) | PASS: scan → choose → protect → integrity → restore → checks → validate → hand off; Escape/focus; Advanced mode; no overflow at 390/320 px; no page errors |
| Manual walkthrough (integrated browser) | Completed all eight steps on the demo; original `lost-commits` still lacked `src/feature.mjs` and had a clean `git status` afterwards |
| `assess` CLI on the demo | Exit 0; report contains scan status and ranked candidates |
| `scripts/package.mjs` (pre-documentation tree) | 1,518,524-byte ZIP, SHA-256 `560b2204387e4d9a1e50b1d129f9d8ae876177ae454a4ed8bf09e029d568d13e`; not a release artifact |
| `git diff --check` | PASS |
| Clean clone of `dev @ 684397e` (no private inputs, no working-tree state) | `npm test` 87/87 PASS; `npm run lint` PASS with private-archive hashes and 2 private-report links correctly NOT RUN; `npm run smoke` PASS |
| `scripts/package.mjs` from that clean clone | 1,517,486-byte `moorkyz-repo-recovery-0.4.0-source.zip`, SHA-256 `76bfea52fde4f13c020e4c5d5075f1d5015d13e63d74fc05d8587785bc0e5f43` (tree `684397e`; rebuild after any further commit) |
| GitHub Actions CI | **NOT RUN**: no push authorized |
| Linux / macOS | **NOT RUN** (Docker Desktop was not running and was not started on the shared machine) |
| Screen reader / WCAG audit | **NOT RUN** |

## Findings during the work

- An embedded browser delivered Escape without firing the dialog `cancel` event; an
  explicit Escape fallback now closes the focused dialog.
- The guided panel jumped ahead while a job was running because gates are invalidated
  at job start; the panel now stays on the step that started the action.
- `/api/state` summaries lacked fields the guided panel needed (check results,
  verification, integrity failure); compact versions were added.
- Screenshots from the integrated browser ignored viewport emulation and exposed a
  personal temp path; final screenshots use the headless driver and `C:\demo`.

## Remaining limitations and owner actions

See [release readiness](../docs/RELEASE_READINESS.md) and
[owner decisions](../docs/OWNER_DECISIONS.md): push and CI run, Linux/macOS results,
human review, licensing holder confirmation, private vulnerability reporting, tag and
release, and all launch activities.

## Audit follow-up

An independent review agent audited `1494e1e` against the owner's focused-MVP release
specification and returned NO-GO for all release decisions
([report](REPO_RECOVERY_MVP_RELEASE_AUDIT_2026-11-08_1494e1e.md)). It also found that the owner had
already pushed `dev` and merged it into `master` (`8db29fb`); CI run #1-#3 failed (Windows jobs hit
the 25-minute limit during `npm test`, macOS failed, Ubuntu passed). Job logs require a GitHub login
and `gh` was not authenticated, so the CI failure causes are inferred, not observed.

Fixes are in `e8256c9` (code and tests) and the following documentation commit; see the
[status table](../docs/RELEASE_READINESS.md#audit-findings-and-status). Nothing was pushed.

| Check (Windows 11, Git 2.50.1, git-lfs 3.7.0) | Result |
|---|---|
| S0 reproduction before the fix | Control step in `tests/read-only-safety.test.mjs`: a plain `git status` on the LFS fixture changes `.git`; the product scan does not |
| `npm test` on Node 22.18.0 (with `--test-timeout=300000`) | PASS: 94 tests, 94 pass, 0 fail/cancelled/skipped |
| `node --test` on portable Node 22.13.0 and 24.22.2 (SHA-256 verified downloads) | PASS: 94/94 on each |
| `npm run lint`, `npm run smoke` | PASS on all three Node versions |
| Scan cost of the filter fix | 6 demo repositories: 4.7 s before, 8.6 s without caching, 4.8 s with the per-repository config-signature cache |
| GitHub CI on the fixed commits | **NOT RUN** (not pushed) |
| Independent re-audit of the fixed commits | **NOT RUN** |
| F-13 (Advanced-mode wording) | Deferred, S3 |
