# Moorkyz Repo Recovery

A local recovery workbench for preserving, comparing and recovering the other
Moorkyz projects without overwriting surviving work. This foundation is usable
without a Git repository, external network access or package installation.

## Start here

See [verified publication status](PUBLICATION_STATUS.md) for the GitHub branch
links, audited source commits and explicit remaining limits across the portfolio.

New to recovery? Open the [complete step-by-step operator manual](docs/USER_GUIDE.md).
The dashboard links to its readable local edition at `/manual`, with a table of
contents, scenario troubleshooting, metric definitions and a final checklist.

1. Read the [documentation map](docs/README.md).
2. Follow the [recovery handbook](docs/RECOVERY_HANDBOOK.md), beginning with preservation.
3. Use the [portfolio triage](docs/PORTFOLIO.md) to choose a case.
4. Record that case with the [case template](docs/templates/CASE.md).
5. Validate and hand off using the [audit template](docs/templates/AUDIT.md).

See [what works, remaining gaps and effort estimates](docs/READINESS.md) before
using this tool on another project. The planned path to a public open-source
release is tracked in the [release roadmap](docs/RELEASE_ROADMAP.md); it lists
intended work and gates, not implemented features. The owner's
[portfolio assessment](PROJECT_RECOVERY_ASSESSMENT.md) is retained as a dated
triage report, not a completeness certificate.

The subsequent [portfolio repair results](PORTFOLIO_REPAIR_RESULTS.md) separate
verified baselines, integrated source fixes and the remaining Evidence migration
barrier. Do not mistake the earlier assessment for a current completion claim.
These owner-local portfolio reports are deliberately omitted from the source
ZIP; their links refer to this checkout, not to files bundled for redistribution.

For actual supervised recovery, follow the
[complete guided workflow](docs/GUIDED_RECOVERY.md): preview/acquire two copies,
discover Git/reflog history, compare a selected commit, restore reviewed files,
run approved validation and write the handoff. Optional remote imports go only
to unique recovery refs in the disposable copy. Originals remain untouched.

**Never treat an inventory as a backup.** Never run a repair against the only
surviving copy. This project does not automatically merge, reset, fetch, publish
or change other repositories.

## Local commands

Prerequisites: Node.js 22.13 or newer and Git on PATH; Node.js 24 LTS is recommended
and pinned for future adoption. No npm dependencies.
Double-click `RUN.cmd` for help, or run:

```powershell
node .\src\recovery.mjs help
node .\src\recovery.mjs assess --root "C:\Users\marvi\source\repos" --output "C:\Recovery\assessment-001"
node --test .\tests\recovery.test.mjs
node .\scripts\check-project.mjs
```

For `assess`, the output parent must exist and the output folder must be new.
It writes private Markdown/JSON outside the scanned tree. No repair, remote
access or product code execution occurs. The dashboard's **Download Markdown
report** exports saved inspections instead; inspect cases first.

## Recovery dashboard

Double-click [DASHBOARD.cmd](DASHBOARD.cmd), or:

```powershell
node .\src\dashboard\server.mjs --root "C:\Users\marvi\source\repos"
```

Open **http://127.0.0.1:4317**. The website lists independent project/Git roots
and excludes ordinary component folders. Search, filter,
sort and double-click a row to open its floating case medikit. Continuous browsing
is the default; switch to Pages if preferred. List settings persist in browser
localStorage without cookies. No repair or product code runs on discovery.

Drag row/column grips to arrange the list, resize column edges, and click
attributes for evidence or an explicit read-only refresh. The always-visible
MedKit opens procedure cards, docs, setup and a downloadable parent-project
source snapshot, without requiring a selected case. A compact intro leads to the
inline MedKit and movable/resizable statistics accordions. Settings saves
continuous/pages browsing; the prominent reset restores section/table layout
without touching evidence. The English-only interface uses the linked moorkyz.com
footer and its exact fade/glint timing, with a locally bundled, OFL-licensed font.

Introduction, Cases and Diagnostics organize the six panels. Sidebar case cards
can be reordered by drag or Up/Down keys and persist with layout preferences.
Diagnostics groups cases by state, owner or priority and filters saved examination
and procedure timestamps using inclusive UTC dates. Unknown-time records are
excluded from bounded ranges. Download a real, locally generated PDF summary.
See the [AI science MVP TODO](docs/AI_SCIENCE_TODO.md) for planned experiments;
no AI model runner or independent model scores exist yet.

The five stages are inspection, preservation verification, object integrity,
approved quality checks and recovery-baseline validation. Paired potential/current
estimates, lifecycle, findings, outcome reports and timestamped procedures are
shown together. The medikit offers previewable copy acquisition, historical-file
restoration, recovery branches, optional remote import and working-copy file fixes.
Validation supports reviewed nested and multi-stack commands, bounded timeouts
and cancellation. The footer now stays in normal document flow.
Read the
[dashboard and scoring contract](docs/DASHBOARD.md) before interpreting a score.

Private evidence persists in SQLite under `%USERPROFILE%\.moorkyz-recovery\dashboard`.
Use `--data <external-directory>` for another workspace and `--port <number>`
for a different port. No dependency installation or frontend build is needed.

After securing the original copies, collect local Git metadata explicitly:

```powershell
node .\src\recovery.mjs inventory --root "C:\Users\marvi\source\repos" --output "C:\Recovery\inspection-001"
```

The output parent must already exist; the output directory must be new and
outside both the scan root and this project. See the [tool contract](docs/TOOLING.md).
Reports are private local material and must be reviewed before sharing.

## Layout

| Location | Purpose |
|---|---|
| `docs/` | Current, curated handbook, triage and decisions |
| `docs/templates/` | Reusable case and audit formats |
| `docs/sources/2026-10-30/` | Immutable historical input and checksum manifest; not current instructions |
| `src/` | Project-owned read-only inventory CLI |
| `src/dashboard/` | Local HTTP server, scoring engine and medikit worker |
| `website/` | Dependency-free dashboard UI |
| `scripts/` | Project consistency checks |
| `tests/` | Disposable-fixture regression tests |
| `.audits/` | Reviewed project change records |

The structure borrows stack separation and phase-based audits from
moorkyz-template and AgenticHeaven, and preservation/governance separation from
moorkyz-evidence. Their runtimes, private data, template histories and deployment
configuration are deliberately not copied.

## Current boundary

Documents have been reconciled; the dashboard provides measured local checks,
not an automatic history-repair engine. Historical ZIP/GitHub numbers have **not**
been reverified. Measured retention compares a known baseline; relational recovery estimates
use condition × recovery quality, with confidence separate.
No automatic sibling changes, remote inspection, integration, deployment, Git
initialization or commit are included. Copy verification is byte-baseline
verification, not a strict forensic acquisition certificate.

Explicitly approved HTTPS/local remote inspection/import is available on
verified disposable copies; no remote is contacted during discovery/assessment.
Owner choices before a real recovery are collected in
[owner decisions](docs/OWNER_DECISIONS.md).

Before publishing repository content, review the [sharing policy](SECURITY.md).
Historical inputs are intentionally ignored by Git until reviewed. Licensing of
the new project remains an owner decision; no license from another project is assumed.
