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
same-origin requests with a random per-session token and serves only three
allowlisted UI assets. Private evidence is stored outside the scan/project tree.
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
