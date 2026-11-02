import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { projectRoot, containedBy } from '../src/recovery.mjs';

const failures = [];
const archive = path.join(projectRoot, 'docs', 'sources', '2026-10-30');
const manifestPath = path.join(archive, 'manifest.json');
const manifest = fs.existsSync(manifestPath) ? JSON.parse(fs.readFileSync(manifestPath, 'utf8')) : null;
if (!manifest && fs.existsSync(archive)) failures.push('Private source archive is present without its integrity manifest; acquisition is incomplete.');
if (!manifest) console.log('NOT RUN: private historical-source hashes; these inputs are deliberately excluded from Git/source downloads.');
for (const source of manifest?.files ?? []) {
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
let privateLinks = 0;
const privateReports = ['PROJECT_RECOVERY_ASSESSMENT.md', 'PORTFOLIO_REPAIR_RESULTS.md'].map(name => path.join(projectRoot, name));
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
        const destination = path.resolve(folder, local);
        if (!fs.existsSync(destination)) {
          if ((!manifest && containedBy(destination, archive)) || privateReports.includes(destination)) privateLinks++;
          else failures.push(`Broken link in ${target}: ${link}`);
        }
      }
    }
  }
}
checkLinks(projectRoot);
if (failures.length) {
  console.error(failures.join('\n'));
  process.exitCode = 1;
} else {
  console.log(`PASS: ${manifest?.files.length ?? 0} available preserved source hashes; ${documentCount} Markdown documents' local file links.`);
  if (privateLinks) console.log(`NOT RUN: ${privateLinks} links to deliberately excluded private inputs/reports. No private-data completeness claim.`);
}
