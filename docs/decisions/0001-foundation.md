# Decision 0001 - Local, preservation-first foundation

Date: 2026-10-30. Status: implemented foundation; recovery actions deferred.

## Context

The recovery project contained only mixed historical reports, duplicate kits,
an internal CSV and an empty strategy file. Its role is to support other
repositories, not become a copy of their applications.

## Decision

Keep a stack-light workbench with canonical Markdown under `docs/`, immutable
inputs under dated `docs/sources/`, project tooling in `src/` and `scripts/`,
tests in `tests/`, and reviewed task evidence in `.audits/`.

Use Node's standard library for a small CLI and test runner; no package manifest
or dependency install is needed. Do not wholesale copy a template, run template
claim/setup, inherit audit history, select a web framework or add deployment.
Keep Windows `RUN.cmd` as a help-only entrypoint.

Preserve all source files, including duplicates, with old-path mappings and
SHA-256 hashes. Resolve duplication in the reader's curated map, not by deleting
potential provenance. Keep raw input ignored until reviewed for publication.

## Consequences and deferred decisions

No Git initialization or commit until the owner supplies the repository.
No sibling repair or backup acquisition in this task. No deployment, remote
automation, bulk template propagation or automatic merges. License, hosting,
public source release and future richer UI need explicit owner decisions.

The inventory is bounded rather than a complete drive crawler. Strict forensic
acquisition, expensive object analysis and actual integration are case-specific
work after preservation. See the [handbook](../RECOVERY_HANDBOOK.md).
