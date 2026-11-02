# Preserve the pending recovery workbench implementation

- Date: 2026-11-02.
- Baseline: `7bf2919`.
- Authority: owner explicitly requested committing all remaining unstaged work.
- Reviewer: Copilot SDK in VS Code; scoped self-review.
- Outcome: verified local checkpoint; no recovery case or product release certified.

## Scope

Preserved existing dashboard, SQLite case storage, diagnostics/PDF, layout/list
models, source-archive implementation, documentation, tests, license and licensed
font. Included the existing task audit trail without inventing new approvals.
The source remains local-first and does not automatically repair sibling repos.

The repository already has Git supplied by the owner. The current explicit
commit request establishes the local checkpoint workflow despite the older
guide's pre-Git wording. No Git root was initialized or copied here.

## Verification

- PASS: `node --test tests\*.test.mjs`: 41 tests.
- PASS: `node scripts\check-project.mjs`: 13 historical source hashes and
  25 Markdown documents' local file links.
- PASS: tracked-source whitespace and bounded credential-signature checks.
- FAIL, retained vendor formatting: the full staged check reports one trailing
  space in the supplied OFL font license. Its original licensed text is preserved
  rather than silently reformatted; application source checks pass.
- PASS: pending files and original index SHA-256 preserved outside the project.
- NOT RUN: new live private-case recovery, new independent browser acceptance,
  external integrations or production deployment.

The historical inputs under `docs/sources/` and private case inventories,
databases, backups and runtime data remain excluded. The test error mentioning
a nonexistent fixture path is an exercised rejection, not a successful live
repair. No push or publication.
