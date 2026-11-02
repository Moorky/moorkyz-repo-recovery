# Layout correction and reviewed public source publication

- Date: 2026-11-03.
- Authority: owner requested a layout fix followed by audit, commit and push of
  repositories not current remotely.
- Baseline: local `1b75713`, remote master observed at `7bf2919`; earlier
  uncommitted supervised-recovery/reporting work is included in this checkpoint.
- Reviewer: Copilot SDK in VS Code; scoped self-review.
- Version: 0.3.1, not a new release tag or production deployment.

## Reproduced layout and publication defects

- Hero navigation inherited the full-width form-button rule.
- Narrow content columns kept half-width panel sizing and wasted space.
- Mobile navigation was over 330px high; title/help/resize controls competed
  for narrow headers and some help controls escaped at 320px.
- The project checker required ignored private archival inputs, so a clean
  public checkout could not pass without publishing private evidence.

## Changes and exact verification

Panel stacking now follows available content width, header actions wrap, hero
links have their own sizing, resize handles sit below content, and mobile
navigation uses compact three-tab presentation.

PASS: measured live layouts at 320, 390, 820 and 1440 pixels; no document
overflow, no title/help overlap, narrow panels match their container width.
Mobile navigation measured 123.5px high and help buttons 28px wide. Footer
remains in document flow. Existing desktop reorder/resize semantics retained.

PASS: 66 complete regression tests on Node.js 24.22.2, including layout guards
and clean-public-checkout tests. The latter explicitly records unavailable
private hash/link checks as NOT RUN; partial archives and ordinary broken
public links still fail. Original local archived hashes remain verified when
available. Clean staged-source validation is required before push.

Current source and newly reachable outgoing blobs passed the bounded selected
credential/path scan. The source branch contains curated project-level reports,
not private SQLite, raw attempts, recordings, external preservation bundles or
ignored historical originals. The local repair-directory path was removed from
the public result summary. No credential was printed or committed.

## Cross-repository publication boundary

Actual GitHub tips were queried through Git's working credential path. The
separate GitHub CLI keyring session was invalid; no credential/account settings
were changed. Current repositories need no artificial commit. Divergent or
production-enabled defaults use explicit review branches, never force pushes,
unrequested remote merges or deployments.

Evidence uses an isolated source checkpoint based on published ancestry.
Unreviewed private divergent history and its staged migration stay local.
The original maintenance barrier is not removed or called complete.

Full operational output and preserved-ref bundles remain external. No push is
claimed until its resulting remote SHA is independently observed.
