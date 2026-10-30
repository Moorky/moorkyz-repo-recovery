# Audit - Recovery project foundation

Date: 2026-10-30. Human review: pending.

## Scope and evidence

Created the basic local recovery workbench requested by the owner, without Git
initialization. Read historical assessments, kit scripts/readme and research
material; compared documented structures in AgenticHeaven, moorkyz-template and
moorkyz-evidence. No template adoption or sibling product execution.

All 13 inputs were hashed before moving. Four exact duplicate pairs and one
empty file were identified. Moved the complete unorganized tree to the dated
source archive without changing bytes; generated old/new-path, size and SHA-256
manifest. No supplied file deleted.

## Deliverables and decisions

Canonical English documentation map, recovery handbook, 12-project historical
triage, source conflict reconciliation, foundation decision, case/audit templates,
contributor and agent guidance, sharing exclusions, help launcher, read-only CLI
and dependency-free validation.

Historical reports remain immutable and private by default. No present loss
claim, backup certification or incident cause is inferred. The new project
uses separate project tooling, not copied template/runtime/deployment code.

## Validation

Environment: Windows, Node.js v22.18.0, Git 2.50.1.windows.1.
Node.js 22+ is supported; 24 LTS remains the recommended future pin.

- PASS: `node --test .\tests\recovery.test.mjs` after fixing Windows Git fixture
  configuration. Initial fixture used Node's Windows null-device spelling,
  which Git rejected; replaced it with an actual empty disposable config/hooks
  directory. No product workaround or dependency installation.
- Regression coverage: nested roots, linked worktrees, unchanged complete
  fixture file hashes, containment including junction aliases, new-only output,
  corrupt/unborn Git state, bounded discovery, inherited Git path overrides,
  skipped junctions, invalid arguments and partial-report exit codes.
- PASS: `node .\scripts\check-project.mjs`: all 13 source hashes and curated
  Markdown local file links checked. Archived original links intentionally
  excluded; they describe historical paths.
- PASS: `node .\src\recovery.mjs help`.
- PASS: absence of project `.git` confirmed.
- NOT RUN: sibling tests/builds, actual portfolio inventory, remote verification,
  forensic acquisition, backup restore, integrations and deployment; outside scope.

## Self-review and remaining risks

Source precedence explicitly resolves TaskOrchestrator exclusion, MediaRecover
scope, ChatFlow source presence, priority differences, ambiguous tracking refs,
placeholder images and writing `fsck --lost-found` advice. Unsupported archived
PowerShell entrypoints are not exposed as current tools.

Inventory records per-command failures, refuses output inside source/project
or existing reports, never collects raw remote URLs, and does not repair Git.
Filesystem reads are not strict forensic acquisition; reports still contain
private metadata. Ignore rules are not a content secret scan.

License and publication review await the owner. Raw source archive and manifest
are ignored until reviewed. Human approval has not been inferred from tests.
Git not initialized and no commit created, as explicitly requested. No sibling
files, original Git histories, live data or external services changed.

Next action: owner provides Git and reviews publication scope; then create
individual preservation/investigation cases, beginning with P0.
