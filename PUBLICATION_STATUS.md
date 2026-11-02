# Verified repository publication status

Date: 2026-11-03. Each published branch below was checked with a fresh remote-ref
query after the push; its advertised SHA matched the reviewed local commit.
No force push, remote history replacement, automatic merge or requested
production deployment was performed.

## Published updates

| Repository | Remote destination | Verified source/audit commit | Outcome |
|---|---|---|---|
| [AgenticHeaven](https://github.com/Moorky/AgenticHeaven/tree/master) | `master` | `b598fb3` | Fast-forwarded the existing private default branch. |
| [moorkyz-template](https://github.com/Moorky/moorkyz-template/tree/master) | `master` | `5a9c2af` | Fast-forwarded the public default branch; existing `v1.0.0` tag was already current and unchanged. |
| [moorkyz-repo-recovery](https://github.com/Moorky/moorkyz-repo-recovery/tree/master) | `master` | `cb93656` | Published the guided workbench, responsive layout, manual and sanitized summaries. This index is a subsequent documentation commit. |
| [moorkyz-cards](https://github.com/Moorky/moorkyz-cards/tree/recovery/verified-20261103) | `recovery/verified-20261103` | `a54b14e` | Source/audit review branch; default branch would publish a production image and has deployment enabled. |
| [moorkyz-chatflow](https://github.com/Moorky/moorkyz-chatflow/tree/recovery/verified-20261103) | `recovery/verified-20261103` | `1db2d49` | Published the verified offline implementation without overwriting the independently initialized default history. |
| [moorkyz-tools](https://github.com/Moorky/moorkyz-tools/tree/recovery/verified-20261103) | `recovery/verified-20261103` | `5508f63` | Preserved divergent default history and avoided its enabled production deployment. |
| [moorkyz-video-transcriptor](https://github.com/Moorky/moorkyz-video-transcriptor/tree/recovery/verified-20261103) | `recovery/verified-20261103` | `0ddf197` | Published local recovery/readiness fixes without replacing the remote dependency-update commit. |
| [moorkyz-evidence](https://github.com/Moorky/moorkyz-evidence/tree/recovery/verified-20261103) | `recovery/verified-20261103` | `ef50a9a` | Reviewed source-only checkpoint based on published ancestry; private divergent local history was not uploaded. |

Review branches are **not merged into master/main**. Select the named branch in
GitHub to see those files. Review and integration, dependency reconciliation and
any production deployment are separate decisions.

## Already current

These live default refs already matched their local checkout and were left
untouched; no empty audit commit or redundant push was invented:

| Repository | Branch | Matching commit |
|---|---|---|
| moorkyz-ai | `master` | `c027794` |
| moorkyz-site | `master` | `f141be9` |
| moorkyz-the-dot | `master` | `0cde937` |
| moorkyz-the-dot-docs | `master` | `235c0a1` |

## What was verified

- Current and outgoing source paths, existing task audits, actual remote tips,
  ancestry relationships and deployment opt-in variables were inspected.
- Existing refs were preserved in verified local bundles before publication.
- Bounded selected-credential scans covered current files and newly reachable
  outgoing blobs. No selected credential signature matched. Broad Tools data-path
  warnings were reviewed as source/catalog manifests, not personal runtime data.
- Recovery: 66 tests passed both locally and from a source-only public checkout.
  Private archive checks are explicitly NOT RUN when those inputs are absent;
  ordinary broken public links and incomplete local archives still fail.
- Layout: measured at 320, 390, 820 and 1440 pixels; no document overflow or
  title/help overlap, full-row narrow panels and compact mobile navigation.
- Evidence publication: 37 runtime/storage tests, 21 guide-format tests,
  14 passing reference checks with zero local failures, and the complete offline
  PowerShell/core/layout/executable suite. A fresh clone verified the final Git
  filename casing and visibility of recovered CLI support files.
- The other repositories' exact-baseline product checks are documented in their
  existing recovery audits and the new per-repository publication audits.

These are scoped local/publication checks, not comprehensive secret, security,
forensic or production certification.

## Privacy and remaining limitations

GitHub receives source and curated audit/status summaries, **not the live
dashboard's private database**. SQLite/WAL, raw attempt JSON, backups, recordings,
browser profiles, runtime secrets and ignored historical inputs remain outside
the published recovery source.

Evidence's original nested-root migration and maintenance lock remain unresolved.
The source-review branch does not discard its staged local work, publish its
private unpublished ancestry, remove that barrier or certify normal startup.
The isolated branch also fixes an ignore-rule conflict and canonical filename
casing that clean-clone tests exposed.

Read [the operator manual](docs/USER_GUIDE.md) for correct recovery usage and
[portfolio repair results](PORTFOLIO_REPAIR_RESULTS.md) for the distinction
between repaired defects, passing scoped checks and unfinished migrations.
