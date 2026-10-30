# Source reconciliation

## Source precedence

1. New, reproducible observations with source identity and time.
2. The ZIP-based first-pass assessment, for facts about that supplied ZIP.
3. The earlier remote incident assessment, for its dated remote observations.
4. The deep research report, as hypothesis/reference material only.

This is a scope/evidence ordering, not proof of chronology from filenames.
Both assessments bear the same date. The ZIP assessment explicitly narrows the
earlier scope and describes additional supplied material; exact authoring times
are unknown. No original is silently edited to make the story consistent.

## Input reconciliation

Thirteen supplied files contain nine unique byte sequences. Four pairs are exact
SHA-256 duplicates: incident report, ZIP assessment, CSV inventory and snapshot
script. Both copies remain preserved. The strategy file is **zero bytes** and
provides no requirements. The [archive catalog](sources/2026-10-30/README.md)
and generated manifest map each old path to its preserved path and hash.

| Conflict or misleading claim | Current interpretation |
|---|---|
| Earlier scope includes TaskOrchestrator; later excludes it and includes standalone MediaRecover | Use the later 12-project recovery scope; do not revive the predecessor |
| Earlier report treats ChatFlow source availability as unknown; ZIP assessment finds source/tests | Recover surviving local implementation before considering reconstruction |
| Site priority P1 in earlier report, P2 later | Use P2 initial triage; re-rank with fresh evidence |
| Deep report suggests scenario dates and causal sync/reset story | Hypotheses only; no confirmed incident cause or exact loss |
| 179 local-ahead commits described as missing from GitHub | Tracking-reference-dependent historical claim; verify original refs and ancestry |
| File-count differences described as missing implementation | Different snapshot scopes and roots; counts are not loss measurements |
| Duplicate AgenticHeaven reported byte-identical | True only for the assessed ZIP, not today's working trees |
| Research images use `ImageDescription_*` placeholders | Not real image assets; excluded from curated documentation |
| Research recommends `fsck --lost-found` in inspection | Writes files; use non-writing diagnostics on preserved copies instead |
| Archived inspection script says read-only but permits index refresh and lacks output containment | Historical script only; do not expose it as the supported entrypoint |
| Archived snapshot omits many command exit codes and can skip discovery errors | Historical artifact only; supported tool records failures explicitly |

## What has and has not been verified here

Verified: actual supplied file sizes/hashes and duplicate groups; empty strategy;
the local reference projects' documentation/structure; foundation tests and checks.

Not reverified: supplied ZIP identity/CRC/content claims, GitHub branches/counts,
external citations, historical backup integrity, sibling reflogs or recovery
status. No web upload or remote query is needed to organize this foundation.

## Updating the narrative

Attach new measurements to a case record, including failed commands. Keep
historical originals immutable. Update the curated portfolio/handbook with a
dated decision and links to reviewed evidence, never inferred percentages.
Private artifacts remain outside the publication tree.
