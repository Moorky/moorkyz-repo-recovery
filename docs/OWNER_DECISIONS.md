# Owner decisions before real-project recovery

Requested on 2026-11-02: complete implementation first, collect questions here,
then review the answers with the owner. None of these pending decisions is
permission to alter an original, fetch a remote or publish anything.

## Questions

1. **First pilot and desired result:** Which project should we recover first?
   Specify the last version/capabilities you want back, not just a clean checkout.
   For Tools, should the old SDK/Studio return alongside the new catalog, replace
   the newer direction, or merely be preserved on a separate recovery branch?
2. **Copy location and space:** Which existing external directory/drive should
   hold full backups and working copies? Both include ignored files and `.git`;
   allow at least twice the source file bytes plus working/build headroom.
   No destination has been created for a real project.
3. **Remote permission:** Should the pilot remain local-only, or may we inspect
   and import its configured HTTPS remote into the disposable copy? No pushes.
   SSH-only remotes need a separately reviewed transport workflow.
4. **Product scope after this release:** Is the supervised source-recovery
   workbench the intended finish line, or do you also want a separate phase for
   browser/media-data recovery or the AI experiment roadmap? Those require
   their own privacy, source-access and acceptance requirements.

## Current decisions / defaults

- Original repositories remain read-only; backups and working copies must be
  external and independent.
- Each copy acquisition, historical file restore, recovery branch and remote
  import requires a fresh preview and explicit approval.
- No automatic reset/merge/push/deployment, branch replacement or dependency
  installation.
- Footer belongs to document flow, not fixed to the viewport.
- End-to-end recovery is exercised only with disposable local fixtures until
  the owner chooses and authorizes a real case.

## Owner answers

The end-of-task question form was presented on 2026-11-02, but the owner was
unavailable. No human answers or new permissions were received.

Conservative operating defaults until review:

| Topic | Current handling |
|---|---|
| Finish line | Implemented supervised source/Git workflow; broader data/AI scope remains unconfirmed. |
| First case / baseline | Undecided. No actual project recovery started. |
| Copy destination | Undecided. No real-project copies created or space assumed available. |
| Remote permission | Local-only. No owner remote contacted or imported. |
| Dashboard launch | The disposable test server was stopped. Use `DASHBOARD.cmd` to launch when ready; no unattended service was left running. |

These are safety defaults, not recorded owner preferences or consent. Review
answers together and update the next case plan before real-project mutations.

## Subsequent request: run the portfolio recovery

Later on 2026-11-02 the owner asked: "Can you run it for me through so that all
repos are repaired?" This authorizes a local preservation/validation/repair pass
over the identified repositories, not automatic publication, remote uploads,
resetting branches, or reinstating previously rejected product scope.

- A new independent local repair workspace was selected outside the scanned
  project directory after checking available disk space.
- Work proceeds on verified working copies; originals and prior backups are
  retained. Existing staged Evidence migration work is not discarded.
- The documented current baseline is used for tests. Whether to reverse an
  intentional scope decision still needs a specific owner decision.
- Full outcomes, private paths and raw attempts live in the external repair
  workspace and its dedicated dashboard, not in this source document.
- Remote access remains off; no GitHub fetch, push or live provider invocation
  is authorized by implication.

## Final remaining migration decision

After the scoped portfolio repairs and guided UI/manual were verified, the owner
was asked whether to retain Evidence's barrier, investigate the existing migration
on an independent copy first, or provide a new canonical-root requirement.
The owner was unavailable. The conservative choice is therefore to **retain
the migration lock and staged work** and review migration separately.

This is not a claim that the Evidence application is fully ready for normal
startup. Its source/reference repairs passed, but the root-consolidation gate
remains an explicit blocker. See [portfolio repair results](../PORTFOLIO_REPAIR_RESULTS.md).

## Open-source release roadmap decisions

On 2026-11-08 the owner asked to include the
[release roadmap](RELEASE_ROADMAP.md) in the project. Inclusion is not approval
of its gates or permission for Git, GitHub or publication actions. These
roadmap items still need owner answers before the related tasks can close:

| Topic | Roadmap task | Current state |
|---|---|---|
| Release scope, supported OS/Node/Git matrix, meaning of "automatic" | R03 / G0 | Undecided; question 4 above remains open. |
| Copyright holder line in `LICENSE` (`Copyright [2026 ] [Moorkyz]`) and README/SECURITY licensing wording | R53 | Undecided; Apache-2.0 file exists, wording not reconciled. |
| Distribution: keep `private: true` and Node+Git quick-start, or another package | R63 | Default: no npm publishing. |
| Optional batch recovery and scheduled read-only checks | R38 / R39 | Neither accepted nor deferred. |
| Test isolation approach for any unattended validation | R36 | Default: no unattended execution; checks remain unsandboxed and approval-gated. |
| Work branch, commits, tag, GitHub settings and LinkedIn announcement | R01 / R64 / R65 / R73 | Each requires an explicit owner request. |
