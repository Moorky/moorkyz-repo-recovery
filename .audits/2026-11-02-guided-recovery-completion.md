# Guided recovery completion checkpoint

- Date: 2026-11-02.
- Authority: owner requested completing the recovery project, moving questions
  to the end and fixing the viewport-fixed footer; supplied reflog recovery
  information as additional context.
- Baseline: prior reporting work remains uncommitted; all those changes retained.
- Reviewer: Copilot SDK in VS Code; self-review, not independent certification.
- Version checkpoint: 0.2.0, local files only; no release tag/commit/push.

## Implemented

1. Previewed full-copy acquisition with two independent external destinations,
   hash-bound approval, final copy verification and explicit retained partial
   copies on failure. Unsupported links/external metadata fail rather than
   becoming fabricated backups.
2. Commit/ref/reflog discovery and integrity-reported unreachable candidates;
   exact historical tree comparison and reviewed regular-file restoration.
3. Atomic new recovery-branch creation in the disposable copy without checkout,
   reset, overwritten refs or hook execution.
4. Explicitly approved HTTPS/local remote advertisement comparison and imports
   into unique working-copy namespaces. No original ref updates or publishing.
5. Reviewed nested/multi-stack validation plans, missing-tool failures, bounded
   time/output, owned-process cancellation and explicit unrun checks.
6. Exact restored-file targets, written recovery acceptance, final handoff and
   immutable private attempt JSON alongside SQLite. Previous attempts survive
   rescans and can be viewed from procedure history.
7. Dashboard forms, selectable comparison paths, command previews and archive
   readers. Footer returned to document flow without replacing its branding.
8. Guided instructions, current readiness, owner decision list and changelog.
   Stale "no Git repository yet" contributor guidance was reconciled without
   granting implicit commit/push permission.

## Verification

| Check | Result | Scope |
|---|---|---|
| Regression suite | PASS | 58 tests passed, zero failed/skipped. Includes final adapter-planning and missing-runtime regression. |
| Complete API recovery | PASS | Disposable acquisition, historical comparison/restore, real Node tests, target validation, reviewed delivery, cancellation and old-attempt access after rescan. |
| Lost commit | PASS | Reflog-only candidate anchored in a new branch; current HEAD unchanged; existing ref protected; failing fixture hook not executed. |
| Remote import | PASS | Disposable local bare upstream, explicit permissions, isolated imported branch/tag refs. No live external remote contacted. |
| Preservation | PASS | Original/backup hashes unchanged; stale approvals, existing destinations, links, object alternates, metadata and traversal paths rejected. |
| Native browser UI pilot | PASS | Real pointer workflow: inspect, acquire, integrity, compare, restore, integrity, preview/run Node test, accept, save final report and deliver. |
| Footer desktop/mobile | PASS | Computed position relative. Footer moved exactly 200px for a 200px document scroll; mobile width approximately 343px inside a 390px viewport. |
| Markdown download | PASS with harness limit | HTTP Markdown body/title and UI success notice verified. Integrated browser did not emit Playwright's Blob-download event; no OS download-file assertion claimed. |
| Runtime adapters | Scoped | Node/npm executed; Python/PowerShell/.NET command construction and missing executables tested, not every installed test platform. |
| Preserved sources/docs | PASS | All 13 historical source hashes matched; local links passed across 33 Markdown documents. |

Final commands: `node --test --test-reporter=spec tests\*.test.mjs`,
`node --check website\app.js`, `node scripts\check-project.mjs`,
`git diff --check`; all exited zero. Runtime: Node.js 22.18.0 / Windows.
SQLite's experimental API warning and the deliberate invalid-copy failure
fixture are expected output, not unreported production failures.
The isolated browser server was stopped and its exact disposable fixture
directory removed. The browser acceptance helper was removed from session
scratch storage. Source changes and the requested reports remain saved.

## Limits and questions

The supported supervised source-recovery workflow is complete; automatic product
reconstruction, browser/media/disk/cloud data rescue, SSH/custom remote
transports and AI experiments are not silently claimed implemented. Full-copy
verification is not ACL/ADS/device-metadata forensic acquisition. Approved code
is not sandboxed and deliberately escaped children need separate inspection.

The live browser pilot used disposable data only. It recovered a file in the
working copy while the original still lacked that file. No real sibling code,
data, refs, stashes or branches were repaired, reset, merged or published.

Owner choices are collected in [owner decisions](../docs/OWNER_DECISIONS.md):
first case/desired baseline, external copy destination, remote permissions and
whether broader data/AI work is a separate phase. These are not implicit consent.

The end-of-task form was offered after verification. The owner was unavailable;
no answers or new permissions were inferred. Local-only/no-original-repair
defaults are recorded, and a real-project pilot remains pending owner review.
