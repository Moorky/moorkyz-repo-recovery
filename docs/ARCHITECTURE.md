# Architecture

MOORKYZ Repo Recovery is a single local Node.js process with a static browser UI.
It has no npm dependencies, no build step and no network service beyond loopback.

```text
Browser (website/)                         Node process (src/)
  Simple mode  simple.mjs ─┐               server.mjs  HTTP on 127.0.0.1, token + same-origin
  Advanced     app.js ...  ├── fetch ───►    ├─ /api/scan ──► worker.mjs (scan loop) ─► engine.inspect
  shared       *-model.mjs ┘                 ├─ /api/task ──► worker.mjs ─► procedures.mjs ─► engine / acquisition /
                                             │                                 history / remote / fixes / checks
                                             ├─ /api/case    case notes, candidate selection, delivery
                                             ├─ /api/report.md  report.mjs (whole portfolio or ?repository=)
                                             └─ store.mjs  node:sqlite (WAL) + attempts/<uuid>.json
```

## Components

| Module | Responsibility |
|---|---|
| `src/dashboard/server.mjs` | Loopback HTTP server, session token, Host/Origin checks, one job at a time, scan orchestration, state view, CLI (`--root`, `--data`, `--port`, `--open`) |
| `src/dashboard/worker.mjs` | Worker thread for procedures and the scan loop; cancellation between repositories / for validation processes |
| `src/dashboard/engine.mjs` | Discovery, read-only inspection, snapshots/hashing, preservation verification, integrity, validation, final recovery validation |
| `src/dashboard/candidates.mjs` | Bounded object check (`fsck --connectivity-only`) and recovery-candidate discovery and ranking |
| `src/dashboard/findings.mjs` | Pure interpretation of an inspection into findings, status, next action and limitations |
| `src/dashboard/acquisition.mjs` | Previewed, approved creation of two new independent copies |
| `src/dashboard/history.mjs`, `files.mjs` | Working-copy history, comparison, one-file restore, recovery branches, path safety |
| `src/dashboard/remote.mjs` | Approved HTTPS/local remote comparison and namespaced import (Advanced) |
| `src/dashboard/checks.mjs` | Validation plans (exact executable, args, folder, declared script) and bounded execution |
| `src/dashboard/report.mjs` | Inspection evidence collection and Markdown reports |
| `src/dashboard/store.mjs` | SQLite persistence outside the scan root and project |
| `website/simple-model.mjs`, `simple.mjs` | Simple mode: statuses, progress text, guided steps (pure model) and DOM |
| `website/app.js` and other modules | Advanced workbench (unchanged capabilities) |
| `scripts/` | Checks, demo builder, smoke test, packager, screenshots, headless Chromium driver |

## Data flow of a guided recovery

1. **Scan** (`POST /api/scan`): rediscover projects, then inspect each in a worker.
   Inspection runs read-only Git commands with optional locks disabled, a bounded
   connectivity check and candidate discovery. Results are saved per repository;
   cases with verified copies keep their gates and store the scan separately.
2. **Choose** (`/api/case` `select-candidate`): only a commit present in the saved
   candidate list is accepted.
3. **Protect** (`acquire-preview` / `acquire-apply`): the preview hashes the complete
   source and binds the destinations into a plan hash; apply requires that exact hash,
   creates two new folders, copies and verifies both against the original snapshot.
4. **Integrity, compare, restore** run only on the verified working copy, each
   re-checking that the original and backup are unchanged.
5. **Checks** run only approved, previewed plans in the working copy.
6. **Validate** rechecks original, backup, restored files and `git fsck --full`, then
   records the verification statements used by the report.

## State and persistence

- Each repository record holds `records` (one entry per gate/procedure), `scan`,
  `selectedCandidate`, `recoveryTargets`, case notes, lifecycle and procedures.
- A `pendingJob` marker is saved before an action starts. Records the action invalidates
  are cleared only after success, or after a failure that already wrote to the working copy
  (tracked per worker by `write-guard.mjs`). On restart a leftover marker becomes an
  `interrupted` procedure, clears possibly affected evidence and names partial copy folders.
- Every finished action is archived as `attempts/<uuid>.json` (written once).
- The job object lives in memory only; after a restart no job is reported as running
  or successful. Partial copies stay on disk and are never reused.

## Trust boundaries

| Boundary | Enforcement |
|---|---|
| Network | Binds `127.0.0.1`; rejects foreign Host/Origin and cross-site requests; per-process token for every API route |
| Originals | Never a write target; snapshots compared before and after protected actions |
| Copies | Must be new, outside the scan root, project and data folders, not linked/aliased |
| Paths | Relative, no traversal, no `.git`, no reserved names, no links in restore targets |
| Git | `GIT_OPTIONAL_LOCKS=0`, maintenance and fsmonitor disabled, Git env overrides removed, all configured filter drivers (including LFS) disabled, hooks path pointed at nothing, `status --ignore-submodules=all` |
| Project code | Runs only after preview and approval, in the working copy, with timeouts and output caps; **not sandboxed** |
| Remotes | Never during scan; Advanced remote import needs separate contact permission and approval |

## Tests

`npm test` runs `node --test` suites against disposable synthetic repositories:
engine and workflow units, candidate discovery with independently known commits,
HTTP end-to-end scan and guided recovery, interruption (hard kill during a copy),
CLI options, report and archive contents, UI models, and a headless-browser
end-to-end test that drives the real UI through the complete guided workflow.
`npm run smoke` starts the CLI on the demo portfolio like a new user would.
