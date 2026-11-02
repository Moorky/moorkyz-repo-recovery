# Audit - SQLite case workbench, estimates and fix medikit

Date: 2026-10-30. Scoped self-review; human approval pending.

## Request and preserved work

Implemented the owner's revised repository classification, lifecycle/case
columns, paired potential/current estimates, relation-based recovery formula,
continuous red-to-green percentage palette, styled column tooltips, SQLite
persistence and animated actual fix medikit. Included the added procedure list
with timestamp and reviewed helping factor.

Integrated prior uncommitted server/browser work. The pre-existing LICENSE and
prior dashboard audit were not altered. No Git initialization, commits or sibling
repair actions performed.

## Implementation

- Discovery excludes ordinary README-only directories and nested project
  components unless independent Git metadata exists.
- Built-in Node SQLite (22.13+) provides transactional workspace/repository,
  event, evidence and procedure tables. Legacy JSON is imported without changing
  its bytes; data stays outside scan/project roots.
- Case lifecycle, owner/priority/target, findings/diagnosis/report,
  cure/nonfixable/final report and disposition edits persist.
- Paired percentages show examination times. Reviewer overrides need rationale;
  relative quality allows values above 100. Recovery uses condition × quality
  / 100; confidence is independent. Unknown values are not red zeroes.
- Procedure attempts record name, timestamp and result. Helping factor remains
  unassessed until reviewed, with rationale and rating time.
- Fix scripts restore a baseline file, normalize UTF-8 line endings or repair
  an exact local Markdown link. A fresh hash preview and explicit approval are
  mandatory. Changes target only verified disposable copies, invalidate later
  checks and never mutate untouched backups or original Git metadata.
- Table groups lifecycle/paired estimates into compact cells, with contained
  horizontal scrolling, sticky medikit access, tooltips and reduced-motion support.

## Validation

- PASS: `npm test`: 23 tests covering existing inventory, discovery exclusions,
  exact estimate formulas/ranges, lifecycle, SQLite round-trip/migration,
  procedure ratings, approved fix previews/application, path protection,
  copy freshness, API gate sequence and persisted evidence.
- PASS: `npm run lint`: all 13 source hashes and curated local file links.
- PASS: browser/server JavaScript syntax checks.
- PASS: HTTP 200 from isolated SQLite fixture dashboard.
- PASS: integrated browser DOM/form validation with disposable fixtures:
  examination, potential 50% condition / 150% ratio / 100% confidence produced
  75% estimated recovery; procedure rated 75% with rationale; preservation
  verified; reviewed restore preview applied; case report saved.
- PASS: all 10 table headers have tooltip controls; focus displays a tooltip.
- PASS: 390px and 1440px browser document widths remain within viewport; table
  scroll remains contained and cell pairs are present.

The shared browser tab was not visible; pointer action stability timed out.
Browser workflows were verified through DOM-dispatched control/form events,
not claimed as a full pointer interaction or accessibility certification.

Initial SQLite test cleanup tried removing a database before closing its
connection on Windows; fixed disposable cleanup ordering and reran successfully.
The timed-out test process was stopped and task-created fixtures cleaned up.

## Risks and handoff

Estimates remain subjective, not loss percentages or probabilities. Condition
examinations and unchanged time are observed history, not real-time monitoring.
Input cap for relative quality is 1000% for practicality. Deep/unmarked projects
need explicit identity or separate investigation. Full hashing can be expensive.

Package checks remain opt-in and unsandboxed; external side effects require
review. Actual fixes are narrowly scoped text/file fixes, not automatic Git
history reconciliation. No backup/forensic/secret-scan certification is claimed.
Node 22's built-in SQLite currently prints an experimental warning.

Launch `DASHBOARD.cmd` and open http://127.0.0.1:4317. Additional useful future
fields: canonical/remote identity, baseline/ref, last verified backup,
reviewer, next action/blocker and rollback location. Owner/priority/target are
already editable in this workbench.
