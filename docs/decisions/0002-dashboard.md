# Decision 0002 - Local dashboard with evidence-gated medikit

Date: 2026-10-30. Status: implemented.

The owner requested directory-based repository evaluation, provisional-to-final
scores and a script medikit. Extend the foundation with a dependency-free Node
loopback HTTP server and plain HTML/CSS/JavaScript. Keep UI assets in `website/`
and project logic in `src/dashboard/`; do not adopt a sibling's application stack.

The four scores are explicitly scoped local-condition, potential/measured
quality, baseline recovery retention and evidence-checklist confidence. Do not
invent “probability of recovery” from filesystem markers. Publish formulas,
weights, gates, failures and timestamps in the [scoring contract](../DASHBOARD.md).

Heavy work uses a worker; evidence persists outside the scanned tree. The first
actions read metadata only. Product-check execution is opt-in, allowlisted by
script name and confined by path to a verified independent working copy, but
not claimed to be sandboxed. Preserve a third untouched copy.

The existing inventory CLI and help-only RUN.cmd remain backward compatible.
Add a separate DASHBOARD.cmd and a private dependency-free package manifest
for start/test/check commands. No lockfile is needed without dependencies.

Do not initialize Git, deploy, install packages, launch sibling products or run
repair operations as part of website creation. Strict forensic acquisition,
additional runtime profiles, complete remote history reconciliation and actual
rescue integration remain separately scoped future work.
