# Quick start: recover a lost commit in five minutes

This walkthrough uses synthetic, disposable repositories, so you can try every
step without touching real work. Commands work in PowerShell, bash and zsh.

## 1. Requirements

- [Node.js](https://nodejs.org/) 22.13 or newer (24 LTS recommended).
- Git on `PATH` (`git --version`).
- No `npm install` and no build: the project has no npm dependencies.

## 2. Create the demo and start the dashboard

From the repository folder:

```powershell
node scripts/demo.mjs ../recovery-demo
node src/dashboard/server.mjs --root ../recovery-demo/portfolio --open
```

The demo folder must be new and outside this project. If the browser does not open,
visit the address printed in the terminal (normally `http://127.0.0.1:4317`).
Stop the server with Ctrl+C.

The demo contains:

| Project | Damage | What you should see |
|---|---|---|
| `lost-commits` | `git reset --hard` removed the commit that added `src/feature.mjs` | Recovery candidates found |
| `deleted-branch` | A branch with unique notes was deleted | Recovery candidates found |
| `overwritten-files` | A later commit overwrote two working files | No local candidates; `HEAD~1` listed as an earlier commit |
| `corrupted-objects` | A Git object file was deleted | Blocked: Git problems found |
| `clean-project` | Nothing | No local candidates (clean is not complete) |
| `notes-without-git` | A copied folder without `.git` | Needs review |
| `empty-folder` | Not a project | Skipped |

## 3. Scan

Press **Scan repositories**. The scan is read-only and takes a few seconds. Open
**Review findings and 1 candidate** on `lost-commits`: the candidate *Add pricing
feature* is "Only in reflog" and has `src/feature.mjs`, which is missing from the
current version. Press **Choose this candidate**.

## 4. Guided recovery

Press **Open guided recovery** on `lost-commits` and follow the steps:

1. **Protect two copies** — keep or edit the suggested folders, press **Preview copies**,
   tick the approval box and press **Create and verify copies**.
2. **Check Git integrity** — runs `git fsck` on the working copy.
3. **Compare and restore files** — **Compare with working copy**, then **Preview restore**
   on `src/feature.mjs`, read the bytes, tick the box and **Restore into working copy**.
4. **Check Git integrity** again (restoring a file resets later checks).
5. **Run approved checks** — **Preview checks** shows `npm run test` and the declared
   script `node test.mjs`. Tick the box and **Run checks**; the demo test passes only
   with the restored file.
6. **Validate and export** — keep or edit the description, press **Validate and recheck**,
   then **Download case report (Markdown)**.
7. **Hand off** — write a short final report.

Afterwards, `../recovery-demo/portfolio/lost-commits` still lacks `src/feature.mjs` and
`git status` there is clean: only the working copy was changed.

## 5. Clean up

Stop the server and delete `../recovery-demo` and the two copy folders. The demo's
private dashboard data lives under `~/.moorkyz-recovery/`; delete the matching
`workspaces/<id>` folder (or the `dashboard` folder if this was your first root).

## Next

- Run it on your own folder: `node src/dashboard/server.mjs --root <folder-with-repositories> --open`.
- Read the [operator manual](USER_GUIDE.md) before recovering real work, especially
  [when to stop](USER_GUIDE.md#when-to-stop).
- Switch to **Advanced mode** for recovery branches, remote import, custom validation
  commands and the full diagnostics.
