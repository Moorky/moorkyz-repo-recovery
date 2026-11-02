# Diagnostics acceptance

- Full regression: 41 tests passing and project lint passing.
- Isolated headless Edge: Introduction/Cases/Diagnostics, local SVG favicon,
  three sidebar cards, resource header and removal of LOCAL WORKSPACE verified.
- Sidebar keyboard reorder persisted after reload. Row reorder switched to
  manual sorting without randomization.
- Two disposable cases, one examined: all-time diagnostics included both and
  disclosed one unknown-time case. A bounded 2000-01-01 through 2000-01-02 UTC
  range excluded both; priority grouping updated without inventing observations.
- At 390px viewport width, no document horizontal overflow.
- Independent PyMuPDF reader opened the generated PDF as three pages and
  extracted all 120 fixture case entries, including the last case.

Browser checks used isolated Chromium through CDP because the shared browser
connection was unavailable. Sidebar drag/drop itself has automated model coverage
and keyboard browser coverage; physical drag ergonomics were not tested here.
AI model execution/scoring remains the explicitly documented future MVP, not
manufactured instant scores. No Git commits or sibling changes. Disposable
servers, profile, database, PDF and validation helpers are removed afterwards.
