# Portfolio reporting and readiness checkpoint

- Date: 2026-11-02.
- Baseline: `1b75713`; clean recovery-repository working tree before this task.
- Authority: owner requested adding the portfolio report to this repository,
  continuing development, and explaining working features, gaps and effort.
- Reviewer: Copilot SDK in VS Code; scoped self-review, not independent approval.
- Outcome: usable read-only portfolio reporting; broader recovery MVP remains
  unfinished and explicitly scoped in the readiness document.

## Changes

- Copied the owner-requested portfolio assessment into the repository, retaining
  its workspace-root original. Corrected source links and added qualifications:
  clean Git state is not product completeness; recorded retirement is not owner
  authorization. Kept raw new evidence outside the repository.
- Added `assess` CLI output in Markdown and JSON, using existing discovery,
  inspection and read-only Git helpers. Records errors per case; partial reports
  exit nonzero. Existing output directories cannot be overwritten.
- Expanded inspection with missing index paths, staged changes/deletions/renames,
  tracked audit/version paths, refs/tags, shallow history, stashes and bounded
  reflog samples. Missing values remain unknown. No loss percentages or invented
  completion estimates are calculated.
- Added a session-protected dashboard Markdown export of saved inspections/notes.
  Exports do not rescan or run code and are blocked during active jobs.
- Recognized and tested the root `type-check` script alias alongside `typecheck`.
- Documented working functionality, remaining limitations, a supervised pilot
  and a 3-6 developer-day planning range for the expanded guided recovery MVP.
  No promise of autonomous wall-clock completion or full product recovery.

## Verification

| Check | Result | Evidence |
|---|---|---|
| Before-change regression baseline | PASS | 41 tests; source hashes and local Markdown links passed. |
| Final full regression suite | PASS | `node --test --test-reporter=spec tests\*.test.mjs`: 46 passed, 0 failed/skipped. |
| Syntax / CLI | PASS | `node --check website\app.js`; CLI help exposes inventory and assess. |
| Source preservation | PASS | Disposable Git fixture hashes unchanged after inspection/assessment, including Git metadata; no product check scripts executed by assessment. |
| Failure handling / output containment | PASS | Corrupt Git metadata, invalid manifest, partial-report exit, nested roots, source-only cases, existing output and junction containment tested. |
| Private export | PASS | API rejects missing token; Markdown content/type/attachment tested; source ZIP excludes the owner portfolio report. |
| Fresh portfolio run | PASS | 12 projects discovered, including nested Evidence; no failed queries. All 12 had zero missing index paths. Evidence retained 326 staged entries and 7 staged deletions. |
| Browser smoke | PASS with limitation | Isolated loopback dashboard loaded 12 cases. Programmatic activation of the visible enabled Markdown button completed with its success notice. Native pointer/actionability waits timed out in the integrated browser; no manual pointer/layout certification claimed. |
| Temporary resources | CLEANED | Isolated dashboard stopped and its test SQLite directory removed. Markdown/JSON assessment deliverables remain outside repos. |

Runtime: installed Node.js 22.18.0 on Windows. SQLite emits its experimental API
warning. No dependency installations, external data uploads or remote queries.
The expected invalid-copy regression emits an explicit preservation error while
its test passes. No sibling product tests/builds or repairs were performed.

## Limits and handoff

The original historical report's prior build/recovery claims remain attributed
to earlier audits; this task did not rerun them. Inspection is a sequence of
read-only observations, not an atomic forensic snapshot. No backup acquisition,
live upstream comparison, historical-code extraction, browser-data recovery or
AI runner was implemented. The first supervised real recovery pilot is pending.
Read [readiness](../docs/READINESS.md) before using the tool.

No commit, push, deployment, history rewrite, stash application or original
repository repair was performed. Existing Git in this project does not imply
authorization to publish its reports or private historical sources.
