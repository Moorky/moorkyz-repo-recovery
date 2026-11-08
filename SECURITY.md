# Private data and safe sharing

Recovery inventories, source archives and backups may expose private paths,
branch names, personal information, credentials or authenticated remote URLs.
Keep full acquisition material outside the project and review before sharing.

The entire historical source directory is Git-ignored by default. The canonical
guides contain only project-level summaries. Ignore rules are a guardrail, not a
secret scanner: forced staging and already tracked files bypass them.

Before committing or publishing repository content:

1. Review every file proposed for staging; never stage full backups.
2. Keep raw inventories, evidence media, `.env`, tokens and private logs excluded.
3. Review archived inputs locally and publish only deliberately sanitized material.
4. The project is licensed under Apache-2.0 ([LICENSE](LICENSE)). Publishing,
   release tags and repository settings remain separate owner decisions.

## Reporting a vulnerability

Please do not open a public issue for a security problem. Use GitHub's private
vulnerability reporting for this repository (Security tab → *Report a
vulnerability*) when it is enabled, or contact the maintainer privately through
the GitHub profile. Never attach private repositories, credentials or evidence;
a synthetic reproduction (see `scripts/demo.mjs`) is enough.

| Version | Supported |
|---|---|
| 0.4.x | Yes (current MVP line) |
| < 0.4 | No |

There is no bug bounty and no guaranteed response time. Fixes are released with a
changelog entry after the test suite passes.

## What the scan reads

**Scan repositories** and the `assess` CLI only read originals: directory names,
root manifests (`package.json` parsed as data, max 1 MiB), and Git through
`readGit` with `GIT_OPTIONAL_LOCKS=0`, fsmonitor and automatic maintenance
disabled, no pager and inherited Git path variables removed. Commands are
`rev-parse`, `status`, `show-ref`, `worktree list`, `ls-files`, `for-each-ref`,
`rev-list`, `stash list`, `reflog show`, `log`, `show -s`, `diff --name-status`,
`ls-tree`, `count-objects` and `fsck --connectivity-only` (no `--lost-found`,
skipped above 250,000 objects). Tests prove the full byte snapshot of every demo
original, including `.git`, is identical after a scan. Ordinary reads can still
update filesystem access times; this is not forensic acquisition.

The owner-requested `PROJECT_RECOVERY_ASSESSMENT.md` is a dated project-level
report kept here explicitly, excluded from the root-file allowlist for the
parent-project source ZIP. Newly generated Markdown/JSON assessments and
dashboard Markdown exports may contain private paths and case notes: retain
them externally and review them before sharing. Markdown export uses the same
session/origin restrictions as private evidence; it never fetches a remote.

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

Private attempt outputs persist as unique JSON files under the external data
directory, alongside SQLite. `/api/attempt/<id>` requires the session token and
only accepts generated UUID filenames. These records survive rescans and must
not be copied into source-control or public archives.

Discovery and inspection do not execute product code. Full preservation checks
allow only contained relative links, recorded without traversal, and reject
absolute/escaping links and linked Git roots that need external metadata.
Node package checks require explicit approval and run only on a verified
independent disposable working copy. **They are not sandboxed:** package scripts
may access the network, absolute paths or external systems. Review them first;
copy separation is not protection against malicious code.

Stop the dashboard only after the current check finishes. Process timeouts are
failures, not approval or proof that deliberately detached descendants have stopped.
Cancellation attempts to stop the owned process tree using exact PIDs/process groups;
cleanup errors are recorded. Inspect script-spawned background processes separately.
No automatic dependency installation,
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
contains only allowlisted root files, textual source/documentation paths
(including `.github/` workflow and template YAML/Markdown), the synthetic-demo
screenshots under `docs/assets/`, and the specifically allowlisted DM Mono font
with its redistribution license and local favicon SVG. Other SVG/binary paths
remain excluded. `scripts/package.mjs` builds the same archive with a SHA-256 file.
This is not a forensic backup, full Git export or secret scanner. Review allowed
source content before sharing; fixed path exclusions cannot detect secrets
embedded in otherwise valid source files.

## Guided acquisition and historical recovery

Acquisition previews hash the complete source and bind new external destinations.
Apply refuses existing targets, absolute/escaping links, external Git metadata
and stale previews. Contained relative-link metadata is hashed and copied verbatim.
Failure retains partial copies for review, never a successful preservation result.
Only verified ordinary copies advance to repairs.

Historical restoration binds commit/file IDs and before/after hashes, writes
regular files atomically, and rejects metadata/traversal paths. Recovery branches
use a must-not-exist ref update with hooks disabled; no checkout/reset occurs.
Remote operations require separate contact permission and apply approval.
Only configured HTTPS or absolute local remotes are supported, and credential-
bearing URL/query/fragment values are rejected. HTTPS may still use configured
credential helpers: review Git configuration and do not assume these helpers
are sandboxed. Fetch uses an isolated new ref namespace, disabled hooks, no
submodules, tags auto-follow, FETCH_HEAD writes or automatic maintenance.

Scope, limits and supported validation runners are documented in
[guided recovery](docs/GUIDED_RECOVERY.md). Owner-approved code remains capable
of accessing external systems; independent copies are not a security sandbox.
