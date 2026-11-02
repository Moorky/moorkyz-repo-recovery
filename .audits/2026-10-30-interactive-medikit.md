# Interactive dashboard and global MedKit

## Changes

- Visible row/column drag grips, keyboard reordering, column edge resizing and
  locally saved layout/reset controls.
- Clickable identity, lifecycle, findings, estimate and procedure attributes;
  details distinguish saved SQLite refresh from explicit read-only examination.
- Always-available shuffled MedKit documentation supplies and practical header
  links to docs, setup and parent-project source; no landing/About section.
- Fixed catalog-only documentation/script routes and a bounded source ZIP that
  excludes Git metadata, original acquisition documents, audits and runtime data.

## Verification

- `npm test`: 31/31 passed.
- `npm run lint`: passed; 13 original hashes preserved and 21 Markdown
  documents' local file links checked.
- `node --check .\website\app.js`: passed.
- Disposable three-project workspace: global MedKit opened without case
  selection, all nine supplies appeared, identity details and saved-data refresh
  worked, and an explicit examination recorded one completed inspect procedure.
- Keyboard ordering/resizing persisted; reordered headers and cells stayed aligned.
- At 390px viewport width, the MedKit stayed inside the viewport with no document
  horizontal overflow. Cookie content remained empty.
- Isolated headless Edge, using trusted Chromium input and native drag data:
  continuous resizing changed 180px to 240px; native row dragging changed
  alpha/beta/gamma to beta/alpha/gamma; native column dragging moved state before
  condition. Header/cell alignment, Escape dismissal and reload persistence passed.
- Independent Windows .NET ZIP reader read all 41 source entries, checked final
  UI/docs SHA-256 hashes and absence of private acquisition/Git/audit/SQLite paths.

Native validation caught two interaction defects: header rebuilding could detach
a captured resize handle, and the header label covered its drag grip. Width-only
changes now retain header nodes, and grips have reserved space above label hit
targets. The integrated hidden browser's initial pointer/Escape probes were
inconclusive; trusted headless input verified the finished implementation instead.

## Boundaries

This is automated self-verification, not human approval. No sibling repository
was repaired, no product code was run outside disposable fixtures, and no Git
initialization, staging, commits or publication were performed. Source ZIPs are
shareable snapshots, not full Git-history exports, forensic backups or secret
scans. Temporary servers, browser profile, workspace and downloaded ZIP are
task-only validation resources, not project deliverables.
