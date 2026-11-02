# Guided operator experience and extensive manual

- Date: 2026-11-02.
- Authority: owner requested a more approachable UI, explained statistics panels,
  question-mark hover help and extensive step-by-step recovery instructions.
- Version: local 0.3.0 checkpoint, not a published release.
- Reviewer: Copilot SDK in VS Code; scoped self-review.

## Delivered

- Seven-step recovery roadmap, next-safe-step project cards and optional detailed
  table, keeping existing case filters and table/layout controls.
- Original/backup/working-copy map in the case panel; separate refresh versus
  rescan/reset-gates actions and an elapsed-time operation banner.
- Four expandable measured panels: gates, history/missing paths, preservation/
  retention, and attempts/timing. Unknown records, historical failed attempts
  and missing timing are not converted into zero or a fabricated probability.
- Contextual question-mark popovers on new and existing panels, accessible by
  hover, focus and click/tap; Escape and Close dismiss them. Help links point
  to actual manual headings.
- Extensive operator manual with prerequisites, copy/layout examples, Git and
  reflog recovery, remote permissions, exact runner examples, troubleshooting,
  metric definitions, integration boundaries and an operator checklist.
- Safe local rich-document rendering with contents links, headings, tables and
  fenced code. Raw HTML is escaped and unsafe link schemes are not activated.
- Footer remains in document flow.

## Verification

- PASS: 64 full workbench regression tests on Node.js 24.22.2.
- PASS: syntax checks and existing preserved-source/local-link checker.
- PASS: real browser fixture with two independently discovered synthetic cases;
  no page errors, correct known/unknown gate counts and next-step cards.
- PASS: explicit card action opens the case, copy roles are visible, and Close
  returns focus to the card rather than an invisible advanced-table row.
- PASS: keyboard focus opens help; reproduced Escape reopening was fixed and
  rechecked with zero open popovers after Escape.
- PASS: 390px mobile layout, no page overflow; advanced table can be explicitly
  revealed and the footer remains relative/in-flow.
- PASS: local manual renders 18 contents/section links and four code examples,
  with no mobile overflow. No external renderer, assets or analytics added.

These are UI/model/runtime checks, not independent accessibility certification.
Portfolio recovery results are separate evidence and are not converted into
invented global completion scores. No production deployment or automatic
integration policy was added. Existing uncommitted recovery work is retained.
