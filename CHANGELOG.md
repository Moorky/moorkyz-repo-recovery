# Changelog

## 0.4.0 - 2026-11-08 (open-source MVP preview; not tagged)

### Fixed after the independent audit (local `dev`, after `1494e1e`)

- **Data safety:** scans of Git LFS repositories wrote hooks, config and `lfs/tmp` into the
  original `.git`, and repository-defined filter commands ran during `git status`. Every Git
  command now disables all configured filter drivers and hooks; `status` ignores submodules.
- One unreadable folder no longer stops the dashboard from starting; it is skipped with a reason.
- A refused or stale approval no longer erases existing integrity, check or copy records.
- Operations interrupted by a crash are reported after restart (case status, procedure,
  partial folders, report line).
- Rescan keeps saved cases whose folders disappeared (shown as unavailable).
- npm checks run with `--ignore-scripts`; previews list lifecycle scripts and `.npmrc`.
- Every code-running validation profile requires the current preview hash.
- Release ZIPs contain committed files only, refuse uncommitted changes and record the commit.
- Submodules are reported explicitly; the browser E2E test uses real mouse/keyboard input.
- CI hardening: per-test timeouts, server closes idle connections, browser cleanup, real
  temporary paths on macOS.

### Added

- **Simple mode** (default): one **Scan repositories** action with progress and
  confirmed cancellation, status chips, one card per project with evidence-backed
  findings, next action and "what this scan cannot tell you".
- **Recovery candidates**: reflog-only commits, dangling commits, stash entries,
  existing `recovery/*` refs and recent branch history, compared with HEAD and
  ordered deterministically by listed evidence (no percentages). Choose a candidate
  per case.
- **Guided recovery** in eight steps on top of the existing safe engine: protect
  copies (suggested locations), integrity, compare and one-file restore, approved
  checks with the declared script text, validation with explicit verification
  statements, per-case Markdown report and handoff.
- Bounded read-only object check (`git fsck --connectivity-only`, skipped above
  250,000 objects) during inspection and the `assess` CLI.
- `POST /api/scan`, scan cancellation via `/api/cancel`, `select-candidate` case
  updates and `GET /api/report.md?repository=<id>`.
- `--open`, a folder prompt in `DASHBOARD.cmd`, friendly missing-folder errors and
  automatic per-root data folders when `--data` is omitted.
- Synthetic demo portfolio (`scripts/demo.mjs`), fresh-start smoke test
  (`npm run smoke`), release ZIP + SHA-256 packager, reproducible screenshots and a
  dependency-free headless-Chromium browser driver.
- Tests: candidate discovery with independently known commits, findings for
  corrupted/malformed/empty/source-only/linked-worktree repositories, HTTP scan and
  full guided workflow, cancellation and retry, hard kill during a copy, CLI options,
  Simple-mode model, and a browser end-to-end test of the complete guided workflow.
- GitHub Actions CI matrix (Windows, Ubuntu, macOS × Node 22.13.0 and 24), quick
  start, architecture guide, issue and pull-request templates.

### Changed

- Advanced mode keeps every previous workbench feature unchanged; scores and
  estimates appear only there.
- Projects that disappear from discovery keep their saved evidence (shown as
  "Folder no longer found") instead of being dropped on restart.
- Escape closes dialogs even in embedded browsers that do not fire `cancel`.
- Validation previews include the declared package script text.
- The source ZIP now includes `.github/` YAML/Markdown and `docs/assets/` screenshots.
- License metadata reconciled: `package.json` declares Apache-2.0; the LICENSE
  appendix line reads `Copyright 2026 Moorkyz`.
- Removed a link to a file outside this repository from `AGENT_SCHEDULER.md`, which
  made `check-project` fail in every clone.

### Not included

- No release tag, push, npm publication or GitHub settings change.
- No sandbox for project code, no unattended test execution, no AI/ML ranking.

## Documentation - 2026-11-08 (before 0.4.0)

- Add the [open-source release roadmap](docs/RELEASE_ROADMAP.md) with a
  re-verified baseline, release gates, task checklist and owner-decision list.
  Documentation only; no application behavior changed.

## 0.3.1 - 2026-11-03

- Fix inherited full-width hero actions, narrow-panel sizing and overlapping
  header/help/resize controls; compact mobile navigation without hiding core actions.
- Use available workbench width for panel stacking and preserve table-local scrolling.
- Make clean Git/source-download checks explicitly report private archival inputs
  as NOT RUN rather than requiring them to be published.
- Add layout/public-checkout regressions and publication audits. This is a source
  checkpoint, not a deployment or new Git release tag.

## Unreleased compatibility fixes - 2026-11-02

- Copy source entries into exclusively created destination directories, avoiding
  Node.js 24's root-directory `cp`/`errorOnExist` incompatibility.
- Preserve and hash contained relative links (including dangling pnpm links)
  without following them or redirecting copies to originals.
- Retain main-repository worktree registrations with contained common-directory
  metadata; external worktree files remain a separately preserved source.

## 0.3.0 - 2026-11-02

- Operator-first project cards and next safe steps, with advanced table opt-in.
- Seven-step recovery checklist and an extensive local operator manual.
- Four measured statistics panels with explicit known/unknown denominators.
- Keyboard, pointer and touch-friendly question-mark help with linked explanations.
- Original/backup/working-copy map, active-job elapsed-time banner, and refresh
  separated from destructive-to-gates rescanning.
- Safe local rich documentation rendering, contents navigation and code examples.
- Known attempt durations, historical failure counts and weighted baseline
  retention without invented loss percentages, free-space totals or ETAs.

## 0.2.0 - 2026-11-02

Local guided-recovery workbench checkpoint; not a published Git release/tag.

- Portfolio Markdown/JSON assessment and saved dashboard Markdown export.
- Previewed, approved full-copy acquisition with independent verification.
- Historical tree comparison, selected regular-file restoration, reflog/commit
  discovery and new recovery branches without resetting or checking out.
- Explicitly approved HTTPS/local remote comparison and imports into unique
  disposable-copy namespaces; no pushes or existing-branch replacement.
- Previewed nested/multi-stack checks, configurable timeouts, failure propagation
  and cancellation of owned validation processes.
- Reviewed acceptance and exact historical-target hashes in final validation.
- Immutable private attempt JSON alongside SQLite, readable from procedure
  history and retained across rescans/reruns.
- Footer restored to normal page flow, with existing branding/motion preserved.
- Guided workflow documentation, supported boundaries and owner decision list.

The original project and untouched backup are never repair targets. Automatic
product reconstruction, browser/media forensics and AI experiments are not part
of this release. See [guided recovery](docs/GUIDED_RECOVERY.md).

## 0.1.0

Initial local inventory, dashboard, evidence gates, copy verification, approved
checks, baseline file fixes, SQLite, diagnostics, PDF and source-snapshot exports.
