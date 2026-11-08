# Release readiness: 0.4.0 open-source MVP

- **Date:** 2026-11-08
- **Version:** 0.4.0 (`package.json`). Not tagged.
- **Branches:** the owner pushed `dev` (`1494e1e`) and merged it into `master` as `8db29fb`
  (PR #2). The audit fixes below (`e8256c9` and later) are **local commits on `dev`, not
  pushed**, so GitHub CI has not run on them.
- **Independent assessment:** [REPO_RECOVERY_MVP_RELEASE_AUDIT_2026-11-08_1494e1e](../.audits/REPO_RECOVERY_MVP_RELEASE_AUDIT_2026-11-08_1494e1e.md),
  run by a separate review agent against `1494e1e`, following the owner's focused-MVP audit
  specification. This page is the implementer's follow-up, **not** a new independent verdict.

## Current recommendation

| Decision | Independent verdict on `1494e1e` | After the fixes (implementer's view, needs re-audit) |
|---|---|---|
| Public open-source MVP | NO-GO (S0 finding) | **CONDITIONAL GO as a labelled preview** once the fixes are pushed and CI is green |
| Tagged MVP release (`v0.4.0`) | NO-GO | NO-GO until CI is green on all claimed platforms, a re-audit passes and the owner signs off |
| LinkedIn "finished MVP" announcement | NO-GO | NO-GO until the tagged release exists |
| `v1.0.0` | NO-GO | Not requested |

**`master` currently contains `8db29fb`, which has the S0 LFS/filter defect fixed in `e8256c9`.**
Until the fix is pushed, do not point users at `master`.

## Audit findings and status

| ID | Sev | Finding | Status (local `dev`) | Evidence |
|---|---|---|---|---|
| F-01 | S0 | Scanning a Git LFS repository wrote hooks/config/`lfs/tmp` into the original `.git` | **Fixed**: every Git query disables all configured filter drivers (always including `lfs`) and points hooks at an empty location; `status` ignores submodules | `tests/read-only-safety.test.mjs` (real git-lfs fixture; control shows plain `git status` does write) |
| F-02 | S1 | Scan ran repository-defined `filter.*.clean`/`process` commands | **Fixed** (same change; driver names passed via `GIT_CONFIG_KEY_n`, so names containing `=` are covered) | same file: marker filter never runs, `.git` byte-identical, control proves fixture sensitivity |
| F-03 | S1 | CI: Windows jobs hung to the 25-min limit, macOS failed; Ubuntu passed | **Mitigated, unverified**: per-test 300 s timeout; server closes idle connections on shutdown; browser driver has timeouts and kills the process tree on any failure; tests use real temp paths (macOS `/var` → `/private/var`). Logs were not accessible (login required), so causes are inferred | Needs a push and a green run |
| F-04 | S1 | One unreadable folder stopped the dashboard from starting | **Fixed**: skipped with reason `unreadable (EPERM)` | `tests/scan.test.mjs` (real ACL/chmod denial) |
| F-05 | S2 | A rejected approval erased integrity/quality/copy records | **Fixed**: evidence is invalidated only after success or after a failure that already wrote to the working copy | `tests/scan.test.mjs` |
| F-06 | S2 | Rescan deleted saved cases of moved projects | **Fixed**: they stay listed as unavailable with their evidence; discovered projects still get their gates reset as documented | `tests/scan.test.mjs` |
| F-07 | S2 | After a crash, interrupted operations and partial folders were invisible | **Fixed**: pending-job marker; on restart an `interrupted` procedure, case status, partial folders and report line | `tests/interruption.test.mjs` |
| F-08 | S2 | Approving `npm run test` also ran unseen `pretest`/`posttest` | **Fixed**: `--ignore-scripts` for npm; lifecycle scripts and project `.npmrc` shown in the preview and bound into its hash | `tests/scan.test.mjs` |
| F-09 | S2 | Docs contradicted code/CI | **Updated** in this commit | README, SECURITY, CHANGELOG, READINESS, this page |
| F-10 | S2 | Release ZIP built from the working tree without a commit | **Fixed**: committed files only, refuses uncommitted changes, `<version>-<sha>` name and `BUILD-INFO.txt` | `tests/source-archive.test.mjs`, `node scripts/package.mjs` |
| F-11 | S3 | Browser E2E used `element.click()` | **Fixed**: real DevTools mouse and keyboard input | `tests/browser.test.mjs` |
| F-12 | S3 | Submodules labelled as linked worktrees | **Fixed**: `submodule` / `contains-submodules` findings | `tests/read-only-safety.test.mjs` |
| F-13 | S3 | Advanced mode shows percentages and "confidence" | **Deferred** (Advanced only, labelled; Simple mode has none) | — |
| F-14 | S3 | Node validation ran with `approved:true` but no preview hash | **Fixed**: every code-running profile needs the current preview hash | `tests/scan.test.mjs` |
| F-15 | Owner | Copyright holder, GitHub description/topics, default branch | **Owner action** | [owner decisions](OWNER_DECISIONS.md) |

## Verification of the fixes (Windows 11, Git 2.50.1, git-lfs 3.7.0)

Recorded in the [MVP audit record](../.audits/2026-11-08-open-source-mvp.md#audit-follow-up). Linux and
macOS results exist only for `1494e1e` from GitHub CI (Ubuntu passed, macOS failed) and must be
re-run after pushing.

## Remaining before a tagged release

1. Owner pushes `dev` (or approves a push); CI must be green on Windows, Ubuntu and macOS, or
   the README platform claims must be narrowed to what passes.
2. Independent re-audit of the fixed SHA (at least RR-M04, RR-M16, RR-M21/22, RR-M25, RR-M31, RR-M32).
3. Owner decisions: copyright holder, repository description/topics, default branch, private
   vulnerability reporting.
4. Owner runs one demo recovery from the quick start on a clean machine and signs off.

## Known limitations (accepted for the MVP)

- Scans run one repository at a time (about 0.8 s per small repository on the test machine).
- Candidate discovery lists at most 50 candidates, compares 25 with HEAD, reads at most 200
  reflog-only commits and skips the object check above 250,000 objects.
- Restore is one file at a time (≤ 64 MiB); no batch restore or merge. Git LFS files are
  restored as their pointer files; LFS content is not fetched.
- Submodules, linked worktrees, external Git directories and object alternates are reported but
  not copied. SSH remotes are not supported.
- Copy previews show the required bytes; free disk space is not measured.
- Approved checks are **not sandboxed**. pnpm may still run pre/post scripts depending on its
  `enable-pre-post-scripts` setting (shown in the preview).
- Interrupted scans are not resumed; repositories not reached keep their previous status.
- Accessibility: keyboard flow, Escape, focus return and 320/390 px layouts are tested; no
  screen-reader or WCAG 2.2 audit.
- Node 22 prints an `ExperimentalWarning` for the built-in SQLite module.
