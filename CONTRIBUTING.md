# Contributing

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
historical-recovery boundaries.
