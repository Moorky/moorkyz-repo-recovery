# Portfolio triage

For the owner's newer dated assessment, see
[Project integrity and recovery assessment](../PROJECT_RECOVERY_ASSESSMENT.md).
For a reproducible current local snapshot, use [the assess command](TOOLING.md).
The table below remains historical input, not a current tool-generated diagnosis.

All entries below are **reported historical observations from 2026-10-30**, not
a fresh local/remote forensic assessment. The later ZIP assessment controls the
initial queue where it supersedes the earlier remote-only report. See
[source reconciliation](SOURCE_RECONCILIATION.md). Priority is investigation
urgency, not a measured amount of lost work.

| Priority | Project | Historical finding | Next evidence / action |
|---|---|---|---|
| P0 | moorkyz-evidence | Nested root; substantial local/remote divergence; audit reports 179 ahead / 4 behind at a previous checkpoint | Locate and verify full copies, object backup and bundles; identify the exact comparison refs; no root consolidation |
| P0 | moorkyz-chatflow | ZIP contains implementation/tests; remote default branch reportedly README-only | Preserve local source and Git history; compare actual architectures rather than rebuilding from remote README |
| P1 | AgenticHeaven | Planning baseline, not a lost application; duplicate ZIP copy reportedly byte-identical; final report differs remotely | Preserve versions; reconcile decisions with canonical MVP/vision documents |
| P1 | moorkyz-ai | ZIP root-only snapshot; remote reportedly has substantial source; divergent branch candidate | Recover separate full source, then evaluate local variants and unique branch commits |
| P1 | moorkyz-video-transcriptor | ZIP lacks remote source/tests; local manifest differs; remote branches diverge | Preserve remote trees and local manifest; review branch patches and CI |
| P1 | moorkyz-the-dot-docs | ZIP incomplete; remote contains larger input/docs/output trees | Preserve full sources; review local documentation differences and sharing permissions |
| P1 | moorkyz-the-dot | ZIP lacks remote client tree | Recover complete source separately; compare local server/shared/rule changes |
| P2 | moorkyz-site | ZIP includes embedded toolbar/tools copy; remaining path counts match remote | Treat embedded copy independently; compare hashes/branches and check CI |
| P2 | moorkyz-cards | Similar file counts; README/manifest differences and branch candidate | Targeted diff and repository tests before selective integration |
| P2 | moorkyz-tools | Local extras/audits and embedded MediaRecover | Establish per-tool provenance; preserve unique sources |
| P2 | moorkyz-tools-mediarecover | Standalone snapshot; same-named remote not verified; related embedded tool exists | Compare standalone and embedded implementations; no assumed remote loss |
| P3 | moorkyz-template | Reportedly near matching baseline; historical release tag observed | Protect reference; review only measured differences |

**TaskOrchestrator is excluded:** the later assessment identifies it as an
undeveloped predecessor, not a recovery case. Reopen only with new evidence and
an explicit scope decision.

## Evidence-specific cautions

The 179-ahead observation is historical and tracking-reference dependent. It is
not a present claim that GitHub lacks exactly 179 commits. Reported successful
backup checks do not prove those copies still exist or are complete today.
Keep outer launcher root, inner Git root and external backup path independent.

## Suggested queue

1. Secure original/copy provenance across the portfolio.
2. Investigate Evidence and ChatFlow in separate case records.
3. Restore incomplete source snapshots for P1 projects; reconcile planning only
   where there is no verified application to recover.
4. Compare P2 variants and selected remote branches.
5. Validate the template reference, without propagating a bulk template update.

Current status for every project: **not yet investigated by this foundation**.
No case is closed, no sibling has been repaired, and no historical CI outcome
has been rerun here.
