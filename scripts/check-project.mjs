import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { projectRoot, containedBy } from '../src/recovery.mjs';

const failures = [];
const archive = path.join(projectRoot, 'docs', 'sources', '2026-10-30');
const manifest = JSON.parse(fs.readFileSync(path.join(archive, 'manifest.json'), 'utf8'));
for (const source of manifest.files) {
  const target = path.resolve(archive, source.archivedPath);
  if (!containedBy(target, path.join(archive, 'originals'))) {
    failures.push(`Invalid archived path: ${source.archivedPath}`);
    continue;
  }
  try {
    const bytes = fs.readFileSync(target);
    const hash = crypto.createHash('sha256').update(bytes).digest('hex');
    if (bytes.length !== source.bytes || hash !== source.sha256) failures.push(`Source changed: ${source.archivedPath}`);
  } catch (error) {
    failures.push(`Source unavailable: ${source.archivedPath}: ${error.message}`);
  }
}

let documentCount = 0;
function checkLinks(folder) {
  for (const entry of fs.readdirSync(folder, { withFileTypes: true })) {
    const target = path.join(folder, entry.name);
    if (entry.isDirectory()) {
      if (!['originals', '.git', 'node_modules'].includes(entry.name)) checkLinks(target);
    } else if (entry.name.endsWith('.md')) {
      documentCount++;
      const text = fs.readFileSync(target, 'utf8');
      for (const match of text.matchAll(/\[[^\]]*\]\(([^)]+)\)/g)) {
        const link = match[1].replace(/^<|>$/g, '');
        if (/^(https?:|mailto:|#)/i.test(link)) continue;
        const local = decodeURIComponent(link.split('#')[0]);
        if (!fs.existsSync(path.resolve(folder, local))) failures.push(`Broken link in ${target}: ${link}`);
      }
    }
  }
}
checkLinks(projectRoot);
if (failures.length) {
  console.error(failures.join('\n'));
  process.exitCode = 1;
} else {
  console.log(`PASS: ${manifest.files.length} preserved source hashes; ${documentCount} Markdown documents' local file links.`);
}
