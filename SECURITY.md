# Private data and safe sharing

Recovery inventories, source archives and backups may expose private paths,
branch names, personal information, credentials or authenticated remote URLs.
Keep full acquisition material outside the project and review before sharing.

The entire historical source directory is Git-ignored by default. The canonical
guides contain only project-level summaries. Ignore rules are a guardrail, not a
secret scanner: forced staging and already tracked files bypass them.

Before the owner creates/publishes Git:

1. Review every file proposed for staging; never stage full backups.
2. Keep raw inventories, evidence media, `.env`, tokens and private logs excluded.
3. Review archived inputs locally and publish only deliberately sanitized material.
4. Decide project licensing and source-release permissions.

Report suspected exposure privately to the owner, without copying secrets into
an issue, audit or chat. Do not rotate credentials, publish evidence or change
account configuration without authorization.

Read-only Git inspection is not strict forensic acquisition: filesystem reads
can affect access timestamps. Work on verified copies when integrity matters.

## Local dashboard boundary

The server binds only `127.0.0.1`, rejects foreign Host/Origin values, uses
same-origin API requests with a random per-session token. Static resources are
allowlisted UI modules/styles and the bundled footer font, fixed local
documentation/setup routes and catalogued procedure source. These read-only
resources and the source download do not require an API token. Private evidence
is stored outside the scan/project tree.
Do not proxy or expose this server to a network: it is a trusted-local-user tool,
not a multiuser authenticated service.

Discovery and inspection do not execute product code. Full preservation checks
reject links/junctions and linked Git worktrees that need external metadata.
Node package checks require explicit approval and run only on a verified
independent disposable working copy. **They are not sandboxed:** package scripts
may access the network, absolute paths or external systems. Review them first;
copy separation is not protection against malicious code.

Stop the dashboard only after the current check finishes. Process timeouts are
failures, not approval or proof that descendant processes have stopped; inspect
any script-spawned background processes separately. No dependency installation,
merge, reset, garbage collection, push or deployment is automated.

The SQLite database, WAL/SHM files, examination logs, reviewer estimates and
procedure ratings are private runtime evidence. Legacy JSON migration preserves
the original report but does not sanitize it.

Medikit file fixes require a fresh hash preview and explicit approval. They only
write a selected file in the verified working copy; restore reads from the
untouched backup. Git metadata, parent traversal, linked directories and binary
text edits are rejected. Original and preservation backup are never fix targets.

List view/filter/sort/layout settings live in localStorage only; no cookies are used.
Search terms, case content, tokens and evidence are not stored there. Case data
remains in the private SQLite workspace. Browser preferences are not credentials
or authorization, and can be cleared without deleting case evidence. Manual row
order stores opaque case IDs, not names or filesystem paths. Workspace
preferences store section IDs, dimensions, accordion states and selected
statistic/procedure view names, not the underlying statistics or case content.
Sidebar order stores only fixed section IDs. Diagnostics date/group inputs are
session-only. PDF export is generated locally in the browser without a new
server action, token bypass, HTML rendering or external service. Saved text is
ASCII-normalized and PDF-escaped; resource limits cap pages/lines. Export includes
private case names and group labels: review it before sharing. Unknown timestamps
are excluded from bounded filters, never replaced with scan time.

The parent-project source ZIP excludes Git metadata, historical source originals,
audits, dependencies, SQLite/runtime data, links and hidden nested files. It
contains only allowlisted root files, textual source/documentation paths and
the specifically allowlisted DM Mono font with its redistribution license and
local favicon SVG. Other SVG/binary paths remain excluded.
This is not a forensic backup, full Git export or secret scanner. Review allowed
source content before sharing; fixed path exclusions cannot detect secrets
embedded in otherwise valid source files.
