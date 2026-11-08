# Contributing

Thanks for helping. This tool protects other people's only copy of their work, so
safety evidence matters more than speed.

## Development setup

1. Install Node.js 22.13+ (24 LTS recommended) and Git. There is nothing to
   `npm install`; please do not add dependencies without a documented need.
2. `npm test`, `npm run lint` and `npm run smoke` must pass before a pull request.
   Install Edge or Chrome to run the browser end-to-end test locally; otherwise it
   is reported as skipped.
3. Try changes on the synthetic demo: `node scripts/demo.mjs ../recovery-demo`, then
   `node src/dashboard/server.mjs --root ../recovery-demo/portfolio --open`.
4. Read the [architecture guide](docs/ARCHITECTURE.md) and keep the trust
   boundaries: no writes to originals, preview + approval for every change,
   no unapproved code execution or network contact.

## Tests and fixtures

- Use only disposable repositories created by the test (see `tests/candidates.test.mjs`
  and `scripts/demo.mjs`). Never point tests at real projects.
- Give every new behavior a happy-path test and at least one adverse-path test, and
  assert that original snapshots are unchanged where relevant.
- Never report a skipped or unexecuted check as passed.
- Regenerate screenshots with `node scripts/screenshots.mjs <neutral-folder>` so no
  personal path appears.

## Recovery cases and audits

Start with the [documentation map](docs/README.md) and [agent guide](AGENTS.md).
Use a [case record](docs/templates/CASE.md) for each repository investigation.

1. Read relevant sources and preserve unrelated changes.
2. Specify acceptance criteria, evidence gaps and approvals before repair.
3. Implement only the chosen scope; update canonical docs and disposable tests.
4. Run the commands in the [tool guide](docs/TOOLING.md).
5. Complete a truthful [audit](docs/templates/AUDIT.md), including blockers and
   pending human review.

Keep original inputs immutable. Do not upload private reports or raw evidence.
Local Git history already exists; never replace its metadata. Commits,
publication and real-project recovery approvals are separate from local
validation. See the [guided workflow](docs/GUIDED_RECOVERY.md) for copy and
historical-recovery boundaries. Report security problems privately as described
in [SECURITY.md](SECURITY.md).
