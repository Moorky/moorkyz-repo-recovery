# Audit - Compact smart list and floating case panel

Date: 2026-10-30. Scoped self-review; human review pending.

## Scope

Addressed the consecutive UI requests: compact list-panel header and column-style
title; intelligent search; adjacent sorting; expandable icon-labelled filters;
best/worst procedure column; continuous/default versus paged browsing with saved
localStorage preferences; double-click expanded floating panel, replacing the
bottom medikit section.

Preserved the SQLite case/evidence model, scored estimates, approval gates,
working-copy fix boundary and existing unrelated dirty work. No sibling changes,
Git commits, cookies, packages or external services added.

## Changes

- Added a shared dependency-free list model for fuzzy/fielded AND search,
  bounded suggestions, filtering/sorting, exact list windows, validated
  preferences and rated-procedure extrema.
- Search uses a keyboard-accessible suggestion list and narrows selections by
  local repository ID. Sort remains adjacent; icon-labelled filters expand
  separately and report active filter count.
- Browser view, batch, sort/filter and expansion settings save under
  `moorkyz-recovery.list.v1`. Search, private evidence and API tokens are not
  stored there. Read/write failures are surfaced.
- Continuous browsing renders successive local snapshot batches, using a
  near-bottom observer/scroll listener with a Show more fallback. Pages uses
  Previous/Next with clamped boundaries. Search/filter/sort resets the window.
- A floating native dialog contains all medikit diagnostics, notes, estimates,
  procedures and fixes. Double-click, row Enter/Space and the button open it.
  Close/Escape restore focus. No bottom-page medikit remains.
- Best/worst use reviewed helping factors only; zero is valid, unrated is not
  zero, a single rating can be both extrema, and ties are deterministic.
- Existing focused target field explicitly supports a file/bug/scenario, with
  smart search and a target-only filter. It is not a new independently scored
  subcase. Large AI/statistical/scenario work is deferred to the future flagship.

## Validation

- PASS: `npm test`: 28 tests including five new list-model suites for continuous
  defaults, exact pages/batches, setting validation, fuzzy/fielded search, combined
  filters, bounded suggestions and best/worst rating behavior. Existing
  SQLite/inventory/fix/API tests retained; module serving/no-cookie response checked.
- PASS: browser JavaScript syntax and project local-reference/source checks.
- PASS: HTTP readiness for disposable 45-project fixture workspace.
- PASS: browser initial 20-row default; saved Pages/10 restored on reload;
  page 2 shows entries 11-20; fielded/filter search and suggestions; keyboard
  suggestion selection; case double-click opens floating dialog with all tools.
- PASS: continuous 10-row view grew to 20 on near-bottom scroll.
- PASS: best/worst show reviewed fixture ratings 80% and 0%, not unrated entries.
- PASS: compact title uses 11px column-style typography; measured panel header
  about 57px. At 390px viewport, document is 375px and dialog about 371px wide,
  containing all tools without horizontal body overflow.
- PASS: empty browser cookie string and no Set-Cookie from local module response.

The shared browser is hidden, so interaction validation used DOM-dispatched
events and instantaneous scroll for deterministic checks; smooth animations
are throttled in a hidden tab. Native cookie-storage inspection was unsupported
by the integrated browser protocol; checked document cookie state and HTTP
response instead. No full accessibility or real-pointer certification claimed.

## Cleanup and risks

Disposed of the temporary 45-case server/data after verification. Preferences
remain per browser origin and may be cleared independently of SQLite evidence.
Incremental browsing renders rows from the fetched snapshot; it does not imply
server pagination or continuous repository monitoring.

No new product analytics/training system created. Case-target fields describe
scope; repository-level observations are not falsely reclassified as per-file
scores. Existing security limits and pending human review remain.
