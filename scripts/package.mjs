import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { projectRoot, containedBy, readGit } from '../src/recovery.mjs';
import { sourceArchive } from '../src/dashboard/source-archive.mjs';

// Builds the release source ZIP from committed files only (same allowlist as the dashboard
// download) plus a SHA-256 file. The ZIP contains BUILD-INFO.txt naming the exact commit.
// Output goes to an existing folder outside this project; existing files are never overwritten.

function git(args) {
  const result = readGit(projectRoot, args);
  if (result.exitCode !== 0 || result.error) throw new Error(`git ${args.join(' ')} failed: ${result.stderr || result.error}`);
  return result.stdout;
}

export function packageRelease(output) {
  const folder = fs.realpathSync(path.resolve(output));
  if (containedBy(folder, fs.realpathSync(projectRoot))) throw new Error('Write release artifacts outside the project folder.');
  const dirty = git(['status', '--porcelain=v1', '--untracked-files=normal']).trim();
  if (dirty) throw new Error(`Uncommitted or untracked changes would not match any commit; commit or remove them first:\n${dirty}`);
  const commit = git(['rev-parse', '--verify', 'HEAD']).trim();
  const tracked = new Set(git(['ls-files', '-z']).split('\0').filter(Boolean));
  const { version } = JSON.parse(fs.readFileSync(path.join(projectRoot, 'package.json'), 'utf8'));
  const name = `moorkyz-repo-recovery-${version}-${commit.slice(0, 7)}-source.zip`;
  const info = `MOORKYZ Repo Recovery ${version}\nCommit: ${commit}\nBuilt: ${new Date().toISOString()}\nContents: committed files only, publication allowlist (no Git metadata, private inputs, audits or runtime data).\n`;
  const archive = sourceArchive(projectRoot, { tracked, extra: [{ name: 'BUILD-INFO.txt', bytes: info }] });
  const digest = crypto.createHash('sha256').update(archive).digest('hex');
  fs.writeFileSync(path.join(folder, name), archive, { flag: 'wx' });
  fs.writeFileSync(path.join(folder, `${name}.sha256`), `${digest}  ${name}\n`, { flag: 'wx' });
  return { file: path.join(folder, name), sha256: digest, bytes: archive.length, commit };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const output = process.argv[2];
    if (!output || process.argv.length !== 3) throw new Error('Usage: node scripts/package.mjs <existing-folder-outside-project>');
    const result = packageRelease(output);
    console.log(`Created ${result.file} (${result.bytes} bytes) from commit ${result.commit}`);
    console.log(`SHA-256 ${result.sha256}`);
  } catch (error) {
    console.error(`Package error: ${error.message}`);
    process.exitCode = 1;
  }
}
