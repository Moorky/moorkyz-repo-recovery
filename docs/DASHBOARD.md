# Dashboard, estimates and medikit

## Simple and Advanced mode

The dashboard opens in **Simple mode** (stored per browser in `localStorage`
under `moorkyz-recovery-mode`; no cookies). Simple mode shows the scan panel,
status chips and one card per project. The header button **Advanced mode** shows
the complete workbench described below; the scan panel stays visible in both
modes. Inside a case, **Show advanced tools** reveals the full medikit without
leaving Simple mode. Mode switches never carry approvals over.

### Scan

**Scan repositories** calls `POST /api/scan`: rediscover projects (same rules as
below), then inspect each repository in a worker thread, one at a time. The job
reports `progress { total, done, failed, current }`; `POST /api/cancel` sets
`cancelRequested` and the worker stops before the next repository, ending as
`cancelled`. Results are saved per repository as they finish, so a cancelled or
crashed scan keeps what completed. Each project gets one `scan` procedure entry
and the job is archived as one attempt file.

A repository without verified copies receives the new inspection as its first
gate (later gates are invalidated, exactly like **Inspect**). A repository with a
`preservation` record keeps all gates; the scan is stored beside them
(`scan.gatesUpdated: false`).

Projects no longer found on disk keep their saved evidence and are shown as
*Folder no longer found* (read-only) instead of being deleted, also after **Rescan**.
Folders that cannot be read are skipped and listed with the reason `unreadable`.

If the dashboard stops while an operation runs, the next start records that
operation as `interrupted`, shows the case as *Interrupted: review before
continuing*, names any partial copy folders (never reused) and clears evidence the
operation may have changed. Evidence is otherwise cleared only when an operation
succeeds, or fails after it already wrote to the working copy; a refused approval
leaves existing records intact.

### Statuses

Scan statuses come from `src/dashboard/findings.mjs`; case statuses from
`website/simple-model.mjs`. They are labels for recorded evidence, not scores.

| Status | Rule |
|---|---|
| Not scanned | No inspection saved |
| Blocked: Git problems found | A blocker finding: failed Git query, unreadable HEAD (with commits present), missing/broken objects, or a scan error |
| Recovery candidates found | At least one reflog-only, dangling, stash or recovery-ref commit |
| Needs review | Warnings only: uncommitted work, missing tracked files, staged deletions, conflicts, no `.git`, linked worktree, submodule or contains submodules |
| No local candidates found | No blocker or warning; earlier branch commits may still be listed |
| Interrupted: review before continuing | The dashboard stopped during an operation on this case |
| Copies verified → Files restored → Checks passed / Checks failed → Recovery validated → Completed and handed off | Case progress, which outranks the scan label |

### Candidates

`src/dashboard/candidates.mjs` lists at most 50 candidates and compares the first
25 with HEAD (`git diff --name-status --no-renames --no-ext-diff --no-textconv`).
Kinds: *Only in reflog* (`git log --reflog --not --all`), *Dangling commit*
(`git fsck --connectivity-only` output), *Stash* (stash index/untracked parents are
excluded), *Recovery ref* (`refs/heads/recovery/*`, `refs/recovery/*`) and *Earlier
commit* (last ten first-parent commits of HEAD). Ordering is deterministic: at-risk
kinds first, then more files only in the candidate, then newer commit time, then
hash. Each candidate carries `factors` and `unknowns`; no percentage is produced.
Repositories above 250,000 objects skip the object check and say so.

### Reports

`GET /api/report.md` exports all cases; `?repository=<id>` exports one case with
its findings, object check, top candidates, selected candidate, restored files,
validation results, final verification statements and a *Remaining limitations*
section.

## Guided operator interface (Advanced mode)

The top-level How to recover checklist links to the [operator manual](USER_GUIDE.md).
Project cards show the next safe gate without executing it. The original, backup
and working-copy locations are shown together inside each case. The advanced
wide table is opt-in; its filters and saved column layout remain available.

Four expandable measured panels show evidence gates, Git/history counts,
baseline bytes/files/link metadata and retention, and historical attempt counts/
known timing. These use all discovered cases, independently of list filters and
diagnostic date filters. Unknown fields in older records remain unknown. No loss
percentage, free-space measurement or repair ETA is fabricated.

Question-mark help opens on hover, focus or click/tap, closes with Escape/Close,
and links to the exact manual section. The active-operation banner states elapsed
time and limitations. Refresh saved evidence never resets gates; the distinctly
labelled rescan action still requires confirmation and deliberately resets gates.

Layout follows the available content width, not just the screen width: below
760px of workbench content, workspace panels use the full row. Header actions
wrap, hero links do not inherit full-width form-button styling, and panel
resize handles sit below content instead of competing with title/help controls.
On mobile, navigation becomes three compact tabs; sidebar reorder grips remain
available on wider screens. The detailed table keeps its own horizontal scroll.

New attempts record nonnegative observed duration; older attempts without timing
are excluded from median duration. Previous failed attempts are historical
failures, not necessarily currently broken cases. Markdown documentation is
rendered locally with escaped HTML, conservative links and headings/lists/tables;
no remote renderer or CDN dependency.

## Run locally

```powershell
node .\src\dashboard\server.mjs --root "C:\Projects" --port 4317 --open
```

Open http://127.0.0.1:4317 or use [DASHBOARD.cmd](../DASHBOARD.cmd), which asks
for the folder. `--open` launches the default browser.
Node.js **22.13+** is required for built-in SQLite; Node 24 LTS is recommended.
There are no external dependencies, CDN assets, frontend build or automatic installs.

Private state is stored in `recovery.sqlite` (SQLite WAL) under
`%USERPROFILE%\.moorkyz-recovery\dashboard` for the first scan root; other roots
automatically use `%USERPROFILE%\.moorkyz-recovery\workspaces\<root-hash>`.
Use `--data <external-directory>` to choose explicitly. State and evidence are committed transactionally; tables
include workspace, repositories, events, evidence and procedures. Existing
`dashboard-state.json` is imported once, if its root matches; the original JSON
is preserved unchanged. Never publish databases or their WAL/SHM companions.

## What is a repository entry?

Directory names and README files alone do not establish independent repositories.
Discovery recognizes `.git`, `package.json`, `pyproject.toml`, `Cargo.toml` and
`PROJECT_MANIFEST.json`. At a portfolio root it lists immediate independent
projects. Under an existing project it lists only independent Git roots, not its
docs, tests, packages or app directories. One further level detects projects
inside grouping folders and nested Git roots. Links/junctions and common
dependency/data/build directories are excluded.

A source-only project with a manifest is explicitly labeled source-only. An
empty or unmarked directory is excluded, not called a broken repository. The
scanner is bounded, not a complete drive crawl; deeper or unmarked real projects
need an explicit project identity marker or separate investigation.

IDs identify normalized local paths, not GitHub IDs or repository content.

## Layout and lifecycle

The top-level sections are **Introduction**, **Cases** and **Diagnostics**.
Introduction contains the compact hero, inline MedKit and whole-portfolio
overview/state graph. Diagnostics contains estimates, procedure performance and
lifecycle panels. All six original panels retain accordion, resize and reorder
preferences; panel movement stays within its parent section. Old saved layouts
migrate without losing sizes/open states. Sidebar hospital-style case cards
use the local DM Mono font and a local Moorkyz/medical SVG motif; the motif makes
no trademark or healthcare claim. The linked footer and its timing are unchanged.
Drag sidebar grips or use Up/Down keys to reorder cards; `navOrder` is persisted
in the existing workspace preference key. Reset restores default card/panel order.

Diagnostics dates are UTC calendar days: start inclusive, through date inclusive
(implemented as the next midnight exclusive). A case matches if its saved
examination or any saved procedure timestamp is in range. Discovery, first-seen
and updated times do not substitute for an examination. Unknown/invalid times
are excluded whenever either bound is set; all-time includes them explicitly.
Cases group once by current state, owner or priority (missing values unassigned).
Only in-range procedures contribute to bounded procedure aggregates; estimates
require an in-range saved examination. Lifecycle values describe the included
cases now, not reconstructed historical states. Table filters do not alter this
view. Date/group controls are session-only and are not saved with case data.

Download PDF generates an actual PDF 1.4 browser Blob using built-in Helvetica,
escaped ASCII text, page objects, stream lengths and a cross-reference table.
It summarizes filters, group counts and case names/procedure counts, not full
private evidence. Non-ASCII characters become `?`; lines are limited to 100
characters and reports to 1000 lines (truncation explicitly indicated). Narrow
filters for larger portfolios. Nothing is uploaded; review before sharing.
Invalid date ranges disable download and report an error.

The [AI science MVP TODO](AI_SCIENCE_TODO.md) records deferred environment,
controlled-variant, report/context/quota and independent actual-run model
evaluation work. The dashboard does not generate AI benchmark scores.

The horizontally scrollable table groups related fields inside each cell:

- Repository name, local Repo_ID, owner and priority.
- State, updated at, unchanged since and unchanged duration.
- Total stay, delivered at and dismissed at.
- Findings (observations), diagnosis (interpretation), issue report.
- Paired **potential / current** estimates for condition, relational optimal
  recovery, and derived recovery with confidence.
- Cure, nonfixable issues within scope and final report.
- Procedures used, timestamp, outcome and helping factor.
- Medikit entrypoint.

Every column has a styled hover/focus tooltip. Dates use local time,
`yyyy-mm-dd hh:mm:ss`; estimate timestamps identify their examination. Duration
uses days/hours/minutes. All estimates use a continuous site palette:
0 red, 25 coral, 50 amber, 75 sage, 100 mint. Relational values above 100 remain
numerically visible; their color saturates at green. Unknown is `--`, not zero.

First seen persists across rescans/restarts. Total stay runs from first seen to
delivery/dismissal or now. Unchanged time starts at a new observation fingerprint
or case mutation, not every repeated identical examination. This is observation
history, **not continuous filesystem monitoring**. A case change reopens disposition.
Delivery requires validated recovery and a final report. Dismissal requires a
final report but does not mean an issue was fixed.

The list is a compact panel, with a small column-style heading. Smart search
supports fuzzy terms and explicit `id:`, `name:`, `path:`, `state:`, `owner:`,
`priority:`, `target:`, `findings:`, `diagnosis:` and `report:` terms. Terms
combine with AND; quoted text is accepted. Matching cases appear as keyboard-
accessible suggestions (arrows, Enter, Escape). Choosing a suggestion narrows
to its local ID. Search text is not persisted.

Sorting sits immediately to the right of search, followed by an icon-labelled
Filters button that expands state/priority/rating/target filters. Active filters
are counted even while the panel is collapsed.

The list defaults to **Continuous** browsing: the first batch renders, then
the next batch appears when the bottom sentinel approaches the viewport. A
Show more button is available too. **Pages** switches to Previous/Next controls.
Batch sizes are 10, 20 or 50. Search/filter/sort changes reset the list window.
The current snapshot is fetched once; incremental browsing renders more rows
locally rather than claiming server-side pagination.

View mode, batch size, sorting, filters and filter-panel expansion are saved in
browser `localStorage` under `moorkyz-recovery.list.v1` and restored on reload.
No cookies are read or written. Storage failures are reported; defaults apply
for the session if saved settings cannot be read. This does not replace SQLite
case persistence. Browser preferences are per origin, so another port has its
own settings.

Double-click a row, focus it and press Enter/Space, or use its Medikit button
to open a floating case dialog. Escape/Close dismiss it and return focus to the
row. There is no bottom-page medikit panel; the dialog retains all examinations,
case editors and approved fix scripts. Reduced-motion settings disable opening
animation. Closing a panel does not cancel a running procedure.

### Visible interaction handles

Row and column grips are visible from the beginning. Drag a row grip onto a
row to place it before that row; this switches sorting to **My row order**.
Drag a column grip onto a header to reorder headers and their corresponding
cells together. Focus a row grip and use Up/Down, or a column grip and use
Left/Right, for keyboard alternatives. Drag/drop only accepts a drag started
inside this workbench; it does not import arbitrary external data.

Column edge handles resize from 100 to 600px; focused edge handles use
Left/Right in 20px steps. Row order, column order and widths persist in
localStorage. Reset layout restores defaults without touching cases or evidence.
Sorting by a measured attribute temporarily changes the view, not stored case data.

Attributes are click targets with hover/focus hints. Their detail dialog shows
the relevant identity, lifecycle, notes, estimates or procedure evidence. Refresh
saved case data only reads SQLite. **Re-examine case (read-only)** explicitly
runs examination for that one case and invalidates downstream gates; it does
not execute product tests, fixes or arbitrary code. Opening details alone never
starts a procedure.

### Global MedKit, docs and parent-source download

The top-left workbench icon/title and top-right READ THE DOCS, PUBLIC RECOVERY
REPO and Settings button are always visible. A very compact introduction leads
straight into the inline MedKit and statistics, without an About/landing page.
The global MedKit can be opened before any case is selected; it shows shuffled
cards for all supported procedures. Cards link to dedicated local guides,
actual script source, setup and the complete procedure handbook. Shuffling
changes presentation only; it does not select or execute random procedures.

`/docs`, `/setup`, `/guide/<known-id>` and `/procedure-source/<known-id>` are
fixed local resources. The source view exposes only catalogued script paths,
never arbitrary filesystem paths.

`/download/source.zip` exports the shareable **parent recovery project** source:
root documentation/config/license, src, scripts, tests, website and curated docs.
It excludes `.git`, private source originals, audits, SQLite/runtime data,
dependencies, links/junctions and hidden secret files. Limits are 8 MiB per file,
32 MiB total and 4096 files. Review content before sharing: path exclusions are
not a secret scanner. This is a source snapshot, **not full Git history or a
forensic recovery backup**, and it never downloads another case's repository.

### Focusable statistics workspace

The inline MedKit presents three shuffled supplies and opens the complete catalog in its full
panel. Setup and source-download links live with the supplies, not in the header.
Below it, independent accordions expose overview, paired estimates, procedure
performance, lifecycle/priorities and repository cases. All four estimate means
are visible in potential/current pairs; clicking one selects its distribution.
Expanded content includes exact distribution bins, ranges, assessed/unknown/stale
counts, procedure outcomes, best/worst reviewed factors, timestamped attempt
history, dispositions, target counts and observed stay/unchanged durations.

Statistics use **all discovered cases**, independent of the table's filters.
Only finite non-stale estimates contribute to means; zero is retained, unknown
and stale are separate, and above-100 ratios remain above 100. Procedure filters
never infer ratings from command success. These are saved-evidence aggregates,
not predictive AI analytics or invented tests/scenarios.

Drag a section's visible grip onto another section or use its Up/Down keys.
Resize an open panel with its labelled handle or arrow keys (5 percentage points
of width / 40px height). Widths stay between 40–100% and heights between
220–1200px; narrow screens use full-width panels. Unresized accordions grow
naturally on expansion; explicitly resized panels scroll their larger content.
Order, sizes, accordion states and selected statistic/procedure views persist
under `moorkyz-recovery.workspace.v1`.
The prominent **RESET WORKSPACE LAYOUT** restores section defaults and table
layout without changing evidence, filters or browsing settings.

Settings contains the existing continuous/pages mode and batch size. All settings
use localStorage; the interface is English-only, with no bilingual/language toggle.

The linked footer follows moorkyz.com's `made /w` mark, year and Moorkyz line,
in-flow scrim, fading hairline, DM Mono and glint. It no longer overlays the
viewport or obscures content. The deployed site's timing was
verified: 900ms fade after 400ms, then one 2.4s glint after 1.5s (not an invented
repeating interval). Reduced motion disables both. It links to moorkyz.com;
there are no Impressum/legal links. The bundled DM Mono font and its OFL license
are included in the ZIP as explicitly allowlisted assets and require no runtime
Google/font requests.

Best/worst procedures are the maximum/minimum **reviewed** helping factors.
Unrated attempts do not count as zero; a sole rated procedure is both best and
worst. Ties use timestamp then local procedure ID for stable ordering. The
column shows names, factors and procedure timestamps, never inferred efficacy.

Case, outcome and estimate editors live in the floating medikit. Owner, priority and
target are included as additional useful fields. Further suggested columns:
canonical/remote identity, last successful backup, last examination/job, reviewer,
blocking prerequisite, next action and rollback location. Sensitive details
should remain in private case evidence rather than the overview.

A focused target may be a file, bug, issue or scenario. It is searchable/filterable
and file fixes already work at that smaller scope. This does not create a separate
subcase or rebase whole-repository scores onto a file. Cross-project AI analytics,
training datasets and larger scenario/statistics tooling belong to the later
flagship, not this local recovery workbench.

## Estimate cheatsheet

All displayed potential/current values remain estimates. Measurements inform
them but do not turn 100% confidence into certainty. They need a target, evidence
scope and rationale. Reviewer overrides are saved with timestamps and history.
Re-examination marks old reviewer estimates stale; a fix clears those overrides.

### Automatic starting rubric

| Root signal | Points |
|---|---:|
| README.md | 20 |
| Recognized source directory or docs | 25 |
| Tests directory or declared test script | 25 |
| CONTRIBUTING.md or AGENTS.md | 15 |
| SECURITY.md | 15 |

**Condition:** after examination,
`round(static rubric / 2 + successful Git queries / 5 * 50)`.
Source-only gets zero Git points; failed Git queries leave condition unknown.
Uncommitted work is not permission to reset.

**Potential relational recovery:** static rubric is a conservative automatic
starting estimate only, not an objective prediction.

**Current relational recovery:** after supported quality checks,
`round(static rubric * 0.30 + passing checks / executed checks * 70)`.
Before those checks it is unknown. A failed check produces a lower estimate and
blocks recovery validation. Missing tests do not become a successful fallback.

**Derived recovery:** `condition * relational recovery / 100`.
For example, 50% condition times 100% quality = 50%; 50% times 150% = 75%.
Confidence is **not multiplied in**. The product is a subjective scenario metric,
not measured lost/recovered code. It is not added to other stats to total 100.

**Confidence:** automatic evidence coverage starts at 20 points for each of
examination, preservation, passing integrity, passing quality and baseline
validation. Reviewer judgement may override it with rationale; even 100 means
neither a guarantee nor a probability.

Condition, confidence and helping-factor inputs accept 0-100%. Relational
quality accepts 0-1000% as a practical UI/input bound, not a theoretical maximum.
No number is invented before examination. Potential/current values are shown
in paired grids within the same column with examination timestamps and labels.

Inspection also records explicit Git/index evidence: missing index paths,
staged deletions/renames, tracked audit/version paths, refs, stashes, shallow
history and a bounded reflog sample. These do not replace the subjective rubric
or prove completeness. See [portfolio assessment and Markdown export](TOOLING.md).
Use **Download Markdown report** in Repository cases to export saved inspections
and case notes, including unknown/uninspected cases. No inspection runs on download.

**Measured baseline retention** remains separate recorded evidence:
`exact byte-identical original files retained / original files * 100`.
Changed baseline files reduce that measurement even if intentionally improved;
new files are not losses. This does not estimate unknown lost history.

## Ordered examination and fix procedures

1. Inspect local structure/Git metadata without product execution.
2. Verify an untouched backup and independent disposable working copy.
3. Run non-writing Git fsck on the working copy (source-only Git is N/A).
4. Preview/approve declared npm checks, reviewed nested/multi-stack commands, or eligible docs-only links.
5. Validate baseline retention, backup/original stability and candidate freshness.

The [guided recovery workflow](GUIDED_RECOVERY.md) adds previewed full-copy
acquisition, commit/reflog discovery, historical comparison/restoration, recovery
branches and explicitly approved remote inspection/import. These procedures live
in the Recovery workflow tab and respect the same preservation gates.

Full preservation hashes all regular files, including ignored files, dependencies
and `.git`; it can take substantial time. Linked worktrees/external Git metadata
need separate acquisition. Copies must remain outside original/project/scan/state
roots. Node checks require a real test script and explicit code-execution approval.
No automatic package installations. Commands have a default two-minute timeout,
configurable to 1-1800 seconds, and 8 MiB output limits. Validation cancellation
terminates the owned process tree where possible and records cleanup failures.
Commands are not sandboxed and may spawn other processes.

### Actual fix scripts

The Fix scripts tab offers:

- **Restore baseline file:** copy one preserved file from untouched backup into
  the working copy. Never modify Git metadata or the original.
- **Normalize text:** convert CRLF/CR to LF in one supported UTF-8 text file
  below 2 MiB; binary files are rejected.
- **Repair Markdown link:** replace an exact local file link with an existing
  target inside the working copy.

Every fix requires a preview of file path, byte counts and hashes, then explicit
approval of the current preview hash. Changed inputs invalidate preview approval.
Applied fixes clear integrity/quality/recovery gates and reviewed estimates;
run the checks again. Fixes never automatically deliver a case.

### Procedures used and helping factor

Each examination, check, fix and failed attempt records name, outcome and time.
Previews are recorded evidence, not counted as an applied helping procedure.
Helping factor starts unassessed (`--`). Rate 0-100% with rationale in the
Procedures used tab, after examining what the procedure actually helped:

- 0: no observed help or harm; explain outcome.
- 25: small clarification or limited symptom improvement.
- 50: meaningful partial progress with unresolved core issues.
- 75: substantial progress, residual issues remain.
- 100: fully helped the **stated scoped target**, not universal recovery.

These are subjective anchors, not formulas derived from exit codes. Ratings
have their own reviewed timestamp and persistent history.

## Persistence and boundaries

One worker job runs at a time. Failures are visible and saved; stage reruns
invalidate downstream evidence even on failure. Rescan resets gates but preserves
case notes, lifecycle and procedure history. SQLite retains evidence and reviewed
estimates across restarts. Browser tables are not real-time monitoring guarantees.

The server binds loopback only with same-origin Host/Origin/token checks.
Optional approved HTTPS/local remote imports stay in new working-copy namespaces.
No automatic merge/reset/push/deployment or cloud upload.
See [security boundaries](../SECURITY.md).

```powershell
npm test
npm run lint
```

Tests use disposable repositories/copies and SQLite databases. The existing
project consistency checker validates source hashes/local document links; it is
not a third-party JavaScript linter, secret scanner or forensic certificate.
