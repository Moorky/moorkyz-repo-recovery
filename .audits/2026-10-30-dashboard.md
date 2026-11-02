# Audit - Repository dashboard and medikit

Date: 2026-10-30. Self-review only; human review pending.

## Scope and implementation

Built the requested website without initializing Git or adopting sibling stacks.
Read the supplied tools audit for workflow precedent, existing inventory CLI and
local project guidance. Added a Node loopback server, plain responsive website,
discovery/scoring engine, worker-based medikit and dependency-free npm commands.
The inventory CLI remains compatible; its Git query helper is shared.

Discovery includes empty/source-only directories and nested marker-bearing
projects. UI supplies search/filter/sort, summary counts, estimate/final/gated
labels, per-repository medikit, visible errors and recorded-evidence dialog.

Ordered gates: inspect, verify untouched backup plus separate working copy,
check Git integrity, approve/run quality checks, validate known-file retention.
Exact formulas, limitations and supported profiles are documented. Final
confidence means evidence coverage, not an invented recovery probability.
Failed Git queries block condition scores; failed checks lower measured quality
but block recovery. Reruns invalidate downstream records, including on failure.

Private persistent state is outside the project/scan root. Only loopback binding,
same-origin Host/Origin checks and session-token API calls are allowed. Commands
are fixed diagnostic actions or allowlisted npm script names. No installs,
history repairs, resets, pushes or deployment operations added.

## Verification

- PASS: `npm test`: 17 disposable-fixture tests covering existing inventory and
  new discovery, exact numeric score outputs, prerequisite gates, complete
  documentation recovery sequence, mismatched/overlapping copies, source and
  backup drift, candidate freshness, explicit execution approval, Node checks,
  failed checks, baseline retention, loopback protections and saved evidence.
- PASS: `npm run lint`: immutable original hashes and curated local file links.
- PASS: `node --check` on browser JavaScript, dashboard engine and server.
- PASS: live HTTP readiness (200) on port 4317.
- PASS: integrated browser search, selecting the recovery project, four initial
  gated stages, running read-only inspection, measured condition / estimated
  quality presentation, next-gate availability, evidence dialog and empty search.
- PASS: browser layout at 390px and 1440px; document scroll widths remain
  within viewport after fixing absolute screen-reader header positioning.
- No sibling package scripts were executed, no preservation/repair performed
  on live portfolio repositories. Only this project's read-only inspection was
  triggered in the browser.

Initial API Host test used fetch, which normalized its Host override; changed
the fixture to an actual HTTP client sending the intended header. The server
correctly rejects the foreign Host. Initial mobile browser check found overflow
from an absolutely positioned screen-reader-only table header; bounded it by
the table scroll container and reverified both viewport sizes.

## Risks and handoff

Package scripts are not sandboxed. Explicit approval on a disposable working
copy does not prevent scripts from accessing absolute paths, network or spawning
descendants. Review code before execution. Timeouts fail checks but do not
certify descendant cleanup; avoid stopping during active checks.

Scores are timestamped rubric measurements, not live monitoring or objective
software-quality/loss measurements. Full file hashing can be expensive.
Linked worktrees/junction-based acquisition requires separate tooling. Remote
comparison, non-Node product execution and actual history repair remain outside
the supported medikit. No forensic, secret-scan or independent-review
certification is claimed.

Private state from browser verification lives outside the repository. No Git
initialization, commits, external publication or deployment. Local launch:
`npm start` or `DASHBOARD.cmd`, then http://127.0.0.1:4317.

Final validation rerun: all 17 tests and project consistency checks pass.
The no-Git assertion detected Git metadata newly supplied externally during
the task; `git status --short` is now available. No Git initialization or commit
was performed by this task, and the externally created baseline was left intact.
