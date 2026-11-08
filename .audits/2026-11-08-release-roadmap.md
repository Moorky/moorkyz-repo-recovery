# Release Roadmap Inclusion Audit

- **Date:** 2026-11-08
- **Baseline:** `dev @ 3c58133` (`master`, `origin/dev` and `origin/master` at the same SHA); clean working tree before this change.
- **Scope:** new `docs/RELEASE_ROADMAP.md`; links/entries in `README.md`, `docs/README.md`, `docs/OWNER_DECISIONS.md`, `CHANGELOG.md`; this audit.
- **Reviewer:** AI assistant scoped self-review; not human approval of the roadmap, its gates or any release.

## Request and result

- The owner asked to finish the externally drafted open-source release roadmap and include it in the project.
- The draft was copied to `docs/RELEASE_ROADMAP.md` and completed against the actual checkout:
  - re-measured baseline (section 2.1): branch/HEAD, tags, runtimes, test and checker results, missing CI/community files, source-inspected server/SQLite/sandbox facts;
  - corrected the assessed branch (`dev` and `master` share the HEAD) and recorded the malformed `LICENSE` copyright line and missing `package.json` license field;
  - recorded the pre-existing `check-project` broken link as a baseline issue for R00/R51/R60;
  - aligned R01, R65, R73 and the master prompt with `AGENTS.md`: branches, commits, tags, pushes, GitHub settings and announcements need an explicit owner request;
  - replaced the external file name and GitHub blob links with in-repository relative links, and added a phase status table plus maintenance rules (section 14.1);
  - converted trailing-space Markdown line breaks so `git diff --check` passes.
- `docs/OWNER_DECISIONS.md` lists the roadmap's open owner decisions; inclusion is recorded as not approving any gate.
- No application code, tests, historical originals, private data or Git metadata changed. No commit, branch, tag or push was made.

## Verification

| Check | Result | Evidence |
|---|---|---|
| `npm test` (before) | PASS | 66 tests, 66 pass, 0 fail/cancelled/skipped/todo. |
| `npm test` (after) | PASS | 66 tests, 66 pass, 0 fail/cancelled/skipped/todo. |
| `node .\scripts\check-project.mjs` (before and after) | FAIL (pre-existing) | Only failure: `Broken link in AGENT_SCHEDULER.md: ../AGENT_SCHEDULER.md` (portfolio file outside this checkout, introduced in `3c58133`). Left unchanged as unrelated; tracked in the roadmap. All new links resolve. |
| Roadmap in-document anchors | PASS | Script check: every `](#...)` link matches a heading slug. |
| `git diff --check` (with roadmap marked intent-to-add) | PASS | Run after converting hard-break trailing spaces. |
| Node 24, Linux/macOS, browser checks | NOT RUN | Documentation-only change. |

## Findings and limits

- The roadmap is a plan. No task R00–R74 or gate G0–G9 is complete, and `docs/READINESS.md` remains the source of verified capabilities.
- The `check-project` failure blocks a green CI (R60) until resolved with owner agreement on how to reference the portfolio scheduler.
