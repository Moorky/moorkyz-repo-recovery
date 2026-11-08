# Release readiness: 0.4.0 open-source MVP

- **Date:** 2026-11-08
- **Version:** 0.4.0 (`package.json`), branch `dev`, local commits only; not pushed, not tagged.
- **Assessor:** AI assistant self-assessment. This is **not** the independent release
  assessment or owner approval required before publication.

## Recommendation

**GO for local use and for an owner-approved push that runs CI. NO-GO for a public
release announcement until the open items below are closed.** The core product
(scan, candidates, guided recovery, verification, reports, Advanced mode) works
and is tested on Windows across the supported Node versions. Publication evidence
is incomplete: CI has never run, so Linux and macOS are unverified, and no human
review has happened.

## Definition of Done

| Criterion | Status | Evidence |
|---|---|---|
| New user can install and start from a clean checkout | Met on Windows | `npm run smoke` starts the CLI with a new data folder; clean-clone run recorded in the [MVP audit](../.audits/2026-11-08-open-source-mvp.md) |
| Assessment works with one primary action | Met | `tests/scan.test.mjs`, browser E2E, smoke |
| Recovery candidates can be identified and inspected | Met | `tests/candidates.test.mjs` (independently known commits), scan E2E |
| Manual recovery works through a simplified, safe workflow | Met | Browser E2E drives all eight steps; HTTP guided workflow test |
| All previously supported advanced features still work | Met (automated) | All 66 pre-existing tests still pass; only the source-archive test was extended (expected entry count 6 → 8 for the new `.github/` and `docs/assets/` allowlist). Advanced mode shows the full workbench (browser E2E, page test) |
| Real verification evidence for the final result | Met | Final verification statements, per-case report, original/backup hash checks in tests |
| Existing and new automated tests pass | Met | 87/87 on Node 22.13.0, 22.18.0 and 24.22.2 (Windows) |
| GitHub CI green on documented platforms | **Not met** | Workflow added; never executed (no push authorized). Linux/macOS untested |
| Documentation matches behavior | Met (self-reviewed) | README, quick start, manual, architecture, dashboard, tooling, security, readiness updated |
| No unresolved critical/high release blockers | **Not met** | See blockers below |

## Release gates (roadmap G0–G9)

| Gate | Status |
|---|---|
| G0 Product scope | Proposed (MVP scope in the [roadmap](RELEASE_ROADMAP.md#60-mvp-delivery-map-040)); owner confirmation pending |
| G1 Data safety | Automated evidence: originals byte-identical after scan, guided recovery, cancellation, preview races and a hard kill. No human adversarial review |
| G2 Working recovery | Met on synthetic repositories (browser and HTTP E2E, smoke) |
| G3 Manual parity | Met by retained code paths and the unchanged pre-existing tests; no separate parity matrix document |
| G4 Security | Partial: loopback/token/origin unchanged; scan read-only; checks still **not sandboxed** (documented, approval-gated). No CodeQL/secret scan, no human threat review |
| G5 Quality | Partial: unit/integration/E2E/adverse tests pass on Windows; no WCAG audit, no performance budget, no Linux/macOS run |
| G6 UX | Partial: Simple mode verified by automated browser test and screenshots; no first-time-user study |
| G7 Docs | Met (self-reviewed) |
| G8 GitHub | Not met: CI not run, no tag/release, settings unchanged |
| G9 Independent review | Not started |

## Open blockers before publication

| Severity | Item | Next action |
|---|---|---|
| High | CI never ran; Linux/macOS behavior unknown (path realpaths, `/var` → `/private/var`, Chromium sandbox flags) | Owner approves pushing `dev`; fix any CI failures |
| High | No independent human review of write paths and the release diff | Owner or reviewer walks the [quick start](QUICKSTART.md) on a fresh machine and reviews `git diff 3c58133..dev` |
| Medium | Licensing holder name normalized to "Moorkyz" without legal confirmation | Owner confirms (see [owner decisions](OWNER_DECISIONS.md)) |
| Medium | Private vulnerability reporting referenced in SECURITY.md is not yet enabled | Owner enables it in GitHub settings |
| Medium | Approved checks are not sandboxed | Documented and approval-gated; isolation is deferred (roadmap R36) |

## Known limitations (accepted for the MVP)

- Scans run one repository at a time (about 0.7–1 s per small repository on the test
  machine); large portfolios take proportionally longer. No performance budget yet.
- Candidate discovery lists at most 50 candidates, compares 25 with HEAD, reads at most
  200 reflog-only commits and skips the object check above 250,000 objects.
- Restore is one file at a time (≤ 64 MiB); there is no batch restore or merge.
- Copy previews show the required bytes; free disk space is not measured.
- Linked worktrees, external Git directories and object alternates are reported but
  not copied. SSH remotes are not supported.
- Projects without a package `test` script need reviewed commands in Advanced mode.
- Node 22 prints an `ExperimentalWarning` for the built-in SQLite module.
- The browser E2E test needs an installed Chromium-based browser; otherwise it is
  reported as skipped.
- Accessibility: keyboard flow, Escape handling, focus return and 320/390 px layouts
  are tested; there is no screen-reader or WCAG 2.2 audit.

## Release artifacts

`node scripts/package.mjs <folder>` builds `moorkyz-repo-recovery-0.4.0-source.zip`
and its `.sha256` from the allowlisted sources (no Git metadata, private inputs,
audits or runtime data). The checksum recorded in the [MVP audit](../.audits/2026-11-08-open-source-mvp.md)
applies only to the tree it was built from; rebuild from the final reviewed commit
for a release. Screenshots in `docs/assets/` come from the real UI on the synthetic
demo with neutral paths.
