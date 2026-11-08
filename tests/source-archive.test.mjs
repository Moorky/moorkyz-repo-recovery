import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { sourceArchive } from '../src/dashboard/source-archive.mjs';
import { catalog } from '../src/dashboard/catalog.mjs';
import { projectRoot } from '../src/recovery.mjs';

test('ZIP snapshot includes shareable project files and excludes private/runtime input', t => {
  const root = fs.mkdtempSync(path.join(fs.realpathSync.native(os.tmpdir()), 'recovery-archive-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  for (const name of ['docs', path.join('docs', 'sources'), path.join('website', 'fonts'), 'src', '.git', '.audits', 'node_modules']) fs.mkdirSync(path.join(root, name), { recursive: true });
  fs.writeFileSync(path.join(root, 'README.md'), '# Public guide');
  fs.writeFileSync(path.join(root, 'PUBLICATION_STATUS.md'), '# Reviewed publication summary');
  fs.writeFileSync(path.join(root, 'src', 'tool.mjs'), 'export const fixture = true;');
  fs.writeFileSync(path.join(root, 'src', '.env.json'), '{"private":true}');
  fs.writeFileSync(path.join(root, '.env'), 'private');
  fs.writeFileSync(path.join(root, 'PROJECT_RECOVERY_ASSESSMENT.md'), '# private portfolio findings');
  fs.writeFileSync(path.join(root, 'PORTFOLIO_REPAIR_RESULTS.md'), '# private repair findings');
  fs.writeFileSync(path.join(root, 'docs', 'sources', 'private.md'), 'private');
  fs.writeFileSync(path.join(root, '.git', 'config'), 'private');
  fs.writeFileSync(path.join(root, 'website', 'fonts', 'DMMono-Regular.ttf'), Buffer.from([0, 1, 0, 0, 17, 25]));
  fs.writeFileSync(path.join(root, 'website', 'fonts', 'OFL.txt'), 'Font license');
  fs.writeFileSync(path.join(root, 'website', 'fonts', 'unapproved.ttf'), 'private');
  fs.writeFileSync(path.join(root, 'website', 'favicon.svg'), '<svg xmlns="http://www.w3.org/2000/svg"/>');
  fs.mkdirSync(path.join(root, 'docs', 'assets'));
  fs.writeFileSync(path.join(root, 'docs', 'assets', 'demo.png'), Buffer.from([0x89, 0x50, 0x4e, 0x47]));
  fs.writeFileSync(path.join(root, 'docs', 'private-capture.png'), 'private');
  fs.mkdirSync(path.join(root, '.github', 'workflows'), { recursive: true });
  fs.writeFileSync(path.join(root, '.github', 'workflows', 'ci.yml'), 'name: CI');
  const archive = sourceArchive(root);
  assert.equal(archive.readUInt32LE(0), 0x04034b50);
  assert.equal(archive.readUInt32LE(archive.length - 22), 0x06054b50);
  assert.equal(archive.readUInt16LE(archive.length - 12), 8);
  assert.ok(archive.includes(Buffer.from('moorkyz-repo-recovery/docs/assets/demo.png')));
  assert.ok(archive.includes(Buffer.from('moorkyz-repo-recovery/.github/workflows/ci.yml')));
  assert.ok(archive.includes(Buffer.from('moorkyz-repo-recovery/README.md')));
  assert.ok(archive.includes(Buffer.from('# Public guide')));
  assert.ok(archive.includes(Buffer.from('PUBLICATION_STATUS.md')));
  assert.ok(archive.includes(Buffer.from('website/fonts/DMMono-Regular.ttf')));
  assert.ok(archive.includes(Buffer.from('Font license')));
  assert.ok(archive.includes(Buffer.from('website/favicon.svg')));
  assert.ok(!archive.includes(Buffer.from('private')));
  assert.ok(!archive.includes(Buffer.from('PROJECT_RECOVERY_ASSESSMENT.md')));
  assert.ok(!archive.includes(Buffer.from('PORTFOLIO_REPAIR_RESULTS.md')));
});

test('release archive mode includes only committed files plus build information', t => {
  const root = fs.mkdtempSync(path.join(fs.realpathSync.native(os.tmpdir()), 'recovery-archive-tracked-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.mkdirSync(path.join(root, 'src'));
  fs.writeFileSync(path.join(root, 'README.md'), '# committed');
  fs.writeFileSync(path.join(root, 'src', 'committed.mjs'), 'export {};');
  fs.writeFileSync(path.join(root, 'src', 'uncommitted.mjs'), 'export const local = true;');
  const archive = sourceArchive(root, { tracked: new Set(['README.md', 'src/committed.mjs']), extra: [{ name: 'BUILD-INFO.txt', bytes: 'Commit: abc' }] });
  assert.equal(archive.readUInt16LE(archive.length - 12), 3);
  assert.ok(archive.includes(Buffer.from('src/committed.mjs')));
  assert.ok(archive.includes(Buffer.from('Commit: abc')));
  assert.ok(!archive.includes(Buffer.from('uncommitted')));
});

test('every documented supply has a real source file and unique ID', () => {
  assert.equal(new Set(catalog.map(item => item.id)).size, catalog.length);
  for (const item of catalog) assert.ok(fs.existsSync(path.join(projectRoot, item.source)), item.id);
});
