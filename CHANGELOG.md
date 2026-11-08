# Changelog

## Unreleased - 2026-11-08

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
