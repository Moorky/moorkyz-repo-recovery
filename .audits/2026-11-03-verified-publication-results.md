# Verified publication results and remote-readable index

- Date: 2026-11-03.
- Authority: owner requested audit, commit and push of outstanding repositories.
- Reviewer: Copilot SDK in VS Code; scoped self-review.
- Source checkpoint: `cb93656`.

All eight planned source updates were pushed without force and independently
verified against advertised remote SHAs. Three existing default branches were
fast-forwarded, five deliberate review branches were created, and four already
current repositories were left untouched. See the curated publication index
for exact links and source/audit hashes.

The index contains repository-level status only, not private SQLite, raw attempts,
recordings, local preservation paths or unpublished private history. It is
explicitly included in the public source ZIP so the new README link remains
usable in downloaded source. Owner-local repair reports remain excluded.

Focused source-export and project-link checks cover this final index wiring.
The full source checkpoint already passed 66 tests in both the working checkout
and a clean source-only copy. No new recovery or deployment behavior is added.

The Evidence migration barrier remains unresolved in the original. Its
source-review branch is based on existing published ancestry and passed clean-
clone validation; it is not permission to remove the original lock or discard
staged work. No current default with enabled deployment was pushed.
