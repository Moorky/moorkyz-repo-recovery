# Agent Scheduler

Read [AGENTS.md](AGENTS.md), [README.md](README.md), the
[documentation map](docs/README.md), and the [recovery handbook](docs/RECOVERY_HANDBOOK.md)
before taking work. This file tracks owner-scoped case ownership; it does not
authorize repair, cleanup, Git operations, publication, or access to private data.
Portfolio-wide tasks remain in the [portfolio scheduler](../AGENT_SCHEDULER.md).

## Queue rules

1. Add only an explicit owner-approved recovery case. A portfolio report,
   inventory, or historical proposal is not an implementation request.
2. Keep at most one recovery task `IN_PROGRESS`. Do not take another owner's
   `CLAIMED`, `IN_PROGRESS`, or `PAUSED` item without a recorded handoff.
3. Before editing, identify and preserve original, nested, duplicate, linked,
   ignored, and backup sources. Use a disposable investigation or integration
   copy only after the handbook's preservation gates are met.
4. Do not run package scripts, repair originals, sync branches, reset, prune,
   rewrite history, delete data, or publish evidence without the approvals and
   verified independent copies required by `AGENTS.md` and the handbook.
5. Link the case and audit records. Record source provenance, observed results,
   unknowns, and blockers without inventing causes or loss estimates.
6. A local commit is part of closeout only when the owner explicitly requests
   it. Push, merge, deletion, and deployment each require their own applicable
   authorization.

## States

| State | Meaning |
|---|---|
| READY | A scoped owner-approved case is eligible; work has not started. |
| CLAIMED | Reserved by a named owner/session; not active. |
| IN_PROGRESS | The single active recovery task. |
| PAUSED | Explicitly paused; retain the owner and restart condition. |
| BLOCKED | A concrete evidence, preservation, input, or approval gate is missing. |
| DONE | Case acceptance and required audit evidence are recorded; commit status follows `AGENTS.md`. |

## Current queue

No repository-specific recovery case is currently claimed. Keep historical
portfolio findings and cross-repository coordination in their source records;
create a local case from [the case template](docs/templates/CASE.md) only after
the required source-preservation and owner-approval gates are satisfied.
