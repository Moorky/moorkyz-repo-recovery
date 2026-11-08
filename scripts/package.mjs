import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { projectRoot, containedBy } from '../src/recovery.mjs';
import { sourceArchive } from '../src/dashboard/source-archive.mjs';

// Builds the release source ZIP (same allowlist as the dashboard download) plus a SHA-256 file.
// Output goes to an existing folder outside this project; existing files are never overwritten.

export function packageRelease(output) {
  const folder = fs.realpathSync(path.resolve(output));
  if (containedBy(folder, fs.realpathSync(projectRoot))) throw new Error('Write release artifacts outside the project folder.');
  const { version } = JSON.parse(fs.readFileSync(path.join(projectRoot, 'package.json'), 'utf8'));
  const name = `moorkyz-repo-recovery-${version}-source.zip`;
  const archive = sourceArchive(projectRoot);
  const digest = crypto.createHash('sha256').update(archive).digest('hex');
  fs.writeFileSync(path.join(folder, name), archive, { flag: 'wx' });
  fs.writeFileSync(path.join(folder, `${name}.sha256`), `${digest}  ${name}\n`, { flag: 'wx' });
  return { file: path.join(folder, name), sha256: digest, bytes: archive.length };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const output = process.argv[2];
    if (!output || process.argv.length !== 3) throw new Error('Usage: node scripts/package.mjs <existing-folder-outside-project>');
    const result = packageRelease(output);
    console.log(`Created ${result.file} (${result.bytes} bytes)`);
    console.log(`SHA-256 ${result.sha256}`);
  } catch (error) {
    console.error(`Package error: ${error.message}`);
    process.exitCode = 1;
  }
}
