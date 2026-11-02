# Dashboard sections and diagnostics — self-review

## Scope

Added local sidebar logo/favicon, DM Mono case-card navigation with persisted
drag/keyboard ordering, Introduction/Cases/Diagnostics parent sections, and an
all-case state graph. Preserved six panel identities, saved sizes/open states,
case dialogs, approvals, list behavior and exact linked-footer animation rules.

Diagnostics filters saved examination/procedure timestamps by inclusive UTC
calendar dates and groups cases once by current state, owner or priority.
Unknown times are excluded from bounded ranges; procedure-only matches do not
include unrelated examination estimates. Local PDF export uses escaped ASCII
text, real page/stream objects and byte-offset cross-reference entries.
Updated source ZIP/static asset allowlists and added the explicitly requested
AI science MVP experiment TODO; no model runner or invented model scores.

## Verification

- `npm test`: **41 passed, 0 failed** (including 5 new diagnostics/layout/PDF tests).
- `npm run lint`: **PASS**, 13 preserved source hashes and 24 Markdown documents'
  local file links.
- `node --check`: passed for app, workspace, workspace model, diagnostics model,
  dashboard server, source archive and new diagnostics tests.
- HTTP regression tests cover local diagnostics module/favicon responses.
- PDF tests verify stream byte lengths, object references, cross-reference
  offsets, three-page output, escaping and valid empty-report structure.
- Tests used a relative, local fixture directory with TEMP/TMP redirected;
  fixtures and validation output were removed after completion.

Browser visual/drag/pointer-capture interactions and opening the downloaded PDF
in a real viewer still need human/browser checks. This is automated verification
and self-review, not human approval. No commits or sibling project edits.
