# Project integrity and recovery assessment

**Later repair outcome:** see [Portfolio repair results](PORTFOLIO_REPAIR_RESULTS.md).
The original assessment below is a dated snapshot, not the current repair status.

**Snapshot reviewed:** 2026-11-02

**Scope:** the 12 project folders directly under this workspace.

**Status:** imported into the recovery repository on 2026-11-02 at the owner's
request. This is a dated assessment, not live tool output. The workspace-root
original is retained. See [current tool readiness](docs/READINESS.md) and
[fresh evidence reporting](docs/TOOLING.md).

## Important qualification added during implementation

A clean Git working tree does **not** prove that the correct product, all prior
work, or private runtime data is present. The ratings below are only triage
priorities from the original read-only review; no full baseline comparison was
performed. A commit describing retirement/removal establishes that the change
was recorded, **not that the owner authorized it**. In particular, the Tools
SDK/Studio scope change needs owner review before accepting the simpler product
as the intended baseline. No exact missing-data total or loss percentage was
established. Earlier validation claims below are attributed historical audits,
not tests rerun by this report.

## Fresh tool checkpoint: 2026-11-02

The new recovery `assess` command inspected all 12 project roots without query
failures and identified the nested Evidence Git root correctly. Every repository
had zero **missing Git-index paths** at that inspection. Evidence still had
326 staged entries, including 7 staged deletions. These measurements do not
cover files removed from older commits, missing browser/media data, or whether
the current product matches its intended functionality.

The recovery repository itself is now intentionally dirty because this task adds
the reporting implementation, this document and readiness/tests; it is no longer
one of the clean checkouts described in the original snapshot below. New raw
Markdown/JSON evidence is retained outside the repository. No sibling files were
repaired, overwritten or removed.

## Executive summary

- I found **no evidence that the portfolio as a whole was replaced by basic HTML**. Eleven project folders have clean Git working trees. The exception is `moorkyz-evidence`, whose actual Git root is nested one level down and currently has **326 staged changes**. That is a preservation and review priority, but staged changes are not the same as 326 missing files or proof of corruption.
- Two apparent source-loss events have recovery records dated today: Cards preserved its pre-reconciliation checkout in a stash, and Video Transcriptor restored 22 missing tracked files from surviving Git/source copies. Both active trees are now clean.
- Some simpler or HTML-heavy layouts are documented design choices. Moorkyz Tools recorded retirement of its earlier SDK/Studio; its current Toolbar Builder is a standalone HTML generator. Whether that change matched the owner's intent still needs confirmation. Moorkyz Template documents a large HTML design collection as its product.
- **Audits are not generally gone.** Audit-related paths remain tracked in every Git repository inspected. **Formal Git release tags are scarce:** only `moorkyz-template` currently has a tag (`v1.0.0`). Several other projects retain package versions and commit history; no tag does not mean that history is lost.
- No live remote was queried and no project tests/builds were rerun as part of this read-only assessment. The ratings below describe observed local evidence, not a forensic certification or a percentage of data loss.

## How to read the ratings and estimates

“Corruption” cannot be measured as a percentage without a verified baseline copy to compare byte-for-byte. The rating is therefore about **current evidence of damage**, not a claim that every possible file or runtime datum is present:

- **Low / no detected damage:** current tracked tree and history are present; no current Git changes were observed.
- **Review / elevated risk:** an intentional scope change or historical divergence needs confirmation.
- **High preservation priority:** substantial in-progress changes or an unresolved root/source boundary needs protection before any repair.

Recovery times estimate one developer’s effort to preserve, compare available local history, and validate the **current known project baseline**. They are not estimates to finish a product or recreate all functionality from scratch. If code or user data is confirmed absent, effort may be substantially higher.

## Per-project assessment

| Project | Current evidence and damage rating | Missing or uncertain | Estimated effort to validate/reach known baseline |
|---|---|---|---:|
| **AgenticHeaven** | **Low.** 180 tracked files, 66 commits, clean tree; a `rescue/agent-latest` branch survives. | README says this is a planning repository and that application code does not exist yet; planning documents are intentionally scaffolds. This is not evidence of a lost application. | 2–4 hours |
| **moorkyz-ai** | **Low locally.** 360 tracked files, 152 commits, clean tree. | An older portfolio report described a root-only ZIP and a more complete remote. That was a dated observation, not verified against today’s remote. Compare sources before concluding anything is missing. | 0.5–2 days |
| **moorkyz-cards** | **Low after recovery.** 181 tracked files, 52 commits, clean tree; package version `0.1.0`. | A 2026-11-02 audit records a preserved pre-reconciliation stash and successful restoration of the canonical checkout/audit tooling. The audit says an incomplete duplicate was archived; it does not describe the active tree as still missing those files. | 2–6 hours |
| **moorkyz-chatflow** | **Low locally.** 61 tracked files, 16 commits, clean tree; version `1.0.0`. | README describes a real offline extension foundation, not a static placeholder. A historical report said the remote default branch was README-only; that remote state was not freshly checked. Browser-held conversation snapshots are separate from Git. | 0.5–1 day |
| **moorkyz-evidence** | **High preservation priority; corruption unproven.** The actual Git root is `moorkyz-evidence/moorkyz-evidence` (479 commits, 443 tracked files, 9 branches). It has **326 staged changes**: 26 additions, 246 modifications, 47 renames and 7 deletions (6,487 insertions / 9,271 deletions). | The outer folder is not the Git root. A 2026-10-27 audit says root consolidation was deliberately not completed and records the final migration gate as blocked. Current staged work spans `docs/` and `src/`; preserve it as work, not as disposable noise. The audit’s remote/ahead-behind numbers are historical; local remote-tracking refs are dated 2026-10-22/23 and no live comparison was made. | 2–5 days, assuming the recorded external backup still verifies |
| **moorkyz-repo-recovery** | **Low.** 59 tracked files, 4 commits, clean tree; package version `0.1.0`; its documentation and dashboard are the intended recovery workbench. | Early foundation, so its small history is expected. Its own handbook correctly treats unknown evidence as unknown and warns not to repair originals. | 2–4 hours |
| **moorkyz-site** | **Low locally.** 408 tracked files, 472 commits, clean tree; package version `0.1.0`. README identifies it as a Next.js application. | No current local source gap found. Remote comparison and release verification remain separate tasks. | 0.5–1.5 days |
| **moorkyz-template** | **Low.** 209 tracked files, 146 commits, clean tree, and the sole current Git release tag: `v1.0.0`. | Its HTML files are an intentional design/catalog collection (the README describes 20 landing pages and 20 README editions), not evidence of an application being flattened. | 4–8 hours |
| **moorkyz-the-dot** | **Low locally.** 252 tracked files, 55 commits, clean tree; package version `0.0.1`. README describes a game prototype with client/runtime source. | No current local source gap found. Confirm the desired branch/release against a fresh remote only if needed. | 0.5–1.5 days |
| **moorkyz-the-dot-docs** | **Low for repository integrity; content is intentionally incomplete.** 134 tracked files, 29 commits, clean tree; package version `0.1.0`. | This is a documentation/research repository, not the game. Its README says publication manuscripts are currently front matter only and nothing is peer-reviewed. Missing manuscript content should not be inferred to be deleted source. | 0.5–1 day to validate; new research writing is unbounded |
| **moorkyz-tools** | **Review the intentional scope change; no current corruption signal.** 487 tracked files, 272 commits, clean tree. | Current README says the former SDK and Studio were removed. Commit `a84eb08` is explicitly titled “Retire toolbar SDK and add archive-only Directory Cleaner,” and prior audit records describe SDK/Studio implementation. The simple current Toolbar Builder is a deliberate standalone tool, not the entire repository. If the retirement was unintended, recover selected code from pre-retirement Git history on a separate branch. | 0.5–1.5 days to validate; 2–5 days to selectively restore the old SDK/Studio |
| **moorkyz-video-transcriptor** | **Low after recovery.** 93 tracked files, 100 commits, clean tree; package version `0.1.0`. | The 2026-11-02 recovery audit says 22 absent tracked files were restored from surviving Git/index objects and another checkout; an October 30 source ZIP also exists. It records passing local type, test, build and smoke checks, with provider transcription and production deployment not tested. A stash retains later work. | 2–4 hours to revalidate the restored baseline |

## Are the audits and versions gone?

No. The following counts are **tracked paths matching audit-related directory/file names**, so they include some templates or checklists and are not counts of completed audit reports:

| Project | Audit-related tracked paths |
|---|---:|
| AgenticHeaven | 15 |
| moorkyz-ai | 26 |
| moorkyz-cards | 14 |
| moorkyz-chatflow | 3 |
| moorkyz-evidence (nested Git root) | 216 |
| moorkyz-repo-recovery | 10 |
| moorkyz-site | 140 |
| moorkyz-template | 48 |
| moorkyz-the-dot | 12 |
| moorkyz-the-dot-docs | 11 |
| moorkyz-tools | 112 |
| moorkyz-video-transcriptor | 18 |

For versioning, only the template has a Git tag in the current local refs (`v1.0.0`). Root package metadata also reports `0.0.0` for AI, `0.1.0` for Cards, ChatFlow `1.0.0`, and `0.1.0` for Repo Recovery, Site, THE DOT Docs and Video Transcriptor; THE DOT reports `0.0.1`. AgenticHeaven, Evidence and Tools have no root `package.json` version recorded by this check. These package values are not Git release tags. Commit histories, changelogs, adoption records and audits still provide chronology even where formal tags are absent.

## Where recovery information can come from

1. **Git history and refs:** commits, branches, remote-tracking refs, stashes, reflogs and older path versions. Cards has `stash@{0}` (`e1ca931`); Video Transcriptor has `stash@{0}` (`ba07ade`); AgenticHeaven has `rescue/agent-latest`. These should be inspected or copied, not popped/reset over current trees.
2. **Project audits and docs:** useful for identifying intended behavior, known-good SHAs, missing-path lists, tests, and where a source copy was found. An audit is evidence about work; it is not a substitute for the code or raw data itself.
3. **Preserved copies and archives:** the Evidence consolidation audit records a hash-verified external backup at that time. The Video Transcriptor audit identifies another checkout and a source ZIP. Reverify those copies before relying on them.
4. **Authorized upstream repositories:** compare fresh remote branch tips and files from a separate clone/copy. Do not fetch, reset, merge, or push into the only surviving working copy just to investigate.
5. **Non-Git data sources:** browser profiles/exports for IndexedDB or localStorage projects, original recordings and evidence inputs, IDE local history, OS/cloud backups, and generated archives. Git generally does not contain these. For example, ChatFlow’s imported snapshot, Cards’ local card designs, and Video Transcriptor’s local recordings/history may live in browser storage.

## Recommended fixes and safe order

1. **Protect `moorkyz-evidence` first.** Preserve both the outer and nested roots, the complete `.git`, the staged index, all non-ignored files, ignored runtime/data directories, and the external backup. Save/close any applications using it before migration work. Review the staged deletes/renames and the blocked root-consolidation gate on a disposable copy. Do not reset, clean, switch branches, or overwrite the staged state.
2. **Keep the recovered Cards and Transcriptor states intact.** Their audits and stashes are recovery points. Compare the stash/checkpoint to the current clean checkout; do not blindly reapply older changes over the restored release.
3. **For Moorkyz Tools, decide whether the SDK/Studio retirement was intended.** If not, extract and compare the pre-`a84eb08` implementation into a separate branch/worktree, then selectively restore and test it. Do not replace the current project with an older tree.
4. **For AI and ChatFlow, compare current local source to fresh authorized remotes and supplied ZIPs.** The older “remote README-only” and “root-only ZIP” statements are not current measurements.
5. **For the remaining clean projects, run each repository’s own validation in a disposable copy.** Only reconstruct code if Git, backups and alternate checkouts have been checked and the required behavior is documented.
6. **Recover user/runtime data separately from source code.** Look for original exports, browser-profile backups, evidence/media originals and local archives. A clean Git repository cannot prove that browser or local data survived.

## Source notes

- [Recovery handbook](docs/RECOVERY_HANDBOOK.md) explains preservation, comparison and recovery classes.
- [Historical source reconciliation](docs/SOURCE_RECONCILIATION.md) explicitly warns that older ZIP/remote findings and ahead/behind numbers were not freshly verified.
- Workspace evidence source: `moorkyz-evidence/moorkyz-evidence/.audits/2026-10-27T07-08-55Z-Root-Consolidation-Checkpoint.md` records that the migration was not complete.
- Workspace evidence sources: `moorkyz-cards/audits/2026-11-02T13-09-01Z-restore-preserved-checkout-and-canonical-audit-tooling.md` and `moorkyz-video-transcriptor/docs/audits/2026-11-02-repository-source-recovery.md` document recent source recovery and validation.
- Workspace evidence source: `moorkyz-tools/.audits/2026-11-02-pending-workspace-checkpoint.md` distinguishes a committed checkpoint from completed release certification.

Workspace evidence paths are provenance references, not bundled documents.
This owner-requested portfolio report is intentionally excluded from the
parent-project source ZIP; raw generated assessments remain outside the repo.

**No project code was changed during this assessment.** The report is a triage artifact; it does not certify external backups, live remotes, or preservation of private runtime data.
