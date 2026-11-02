import fs from 'node:fs';
import path from 'node:path';
import { containedBy } from '../recovery.mjs';
import { snapshot, preserve, assertLocalGit } from './engine.mjs';
import { planHash } from './files.mjs';

function destination(value, source, forbiddenRoots) {
  if (typeof value !== 'string' || !path.isAbsolute(value)) throw new Error('Copy destinations must be absolute paths.');
  const folder = path.resolve(value);
  if (fs.existsSync(folder)) throw new Error('Copy destination already exists; nothing will be overwritten.');
  const parent = fs.realpathSync(path.dirname(folder));
  if (!fs.statSync(parent).isDirectory() || parent !== path.dirname(folder)) throw new Error('Destination parent must exist and must not be a linked/aliased path.');
  for (const root of [source, ...forbiddenRoots]) {
    if (containedBy(folder, root) || containedBy(root, folder)) throw new Error('Copies must be outside and independent of original, scan, project and state directories.');
  }
  return folder;
}

export function acquire(repository, action, input, forbiddenRoots) {
  if (!repository.records.inspection) throw new Error('Run inspection before acquiring copies.');
  const source = fs.realpathSync(repository.path);
  const backup = destination(input.backup, source, forbiddenRoots);
  const workingCopy = destination(input.workingCopy, source, forbiddenRoots);
  if (containedBy(backup, workingCopy) || containedBy(workingCopy, backup)) throw new Error('Backup and working copy must be independent.');
  const baseline = snapshot(source);
  assertLocalGit(source, baseline);
  const files = Object.values(baseline.files);
  if (!files.length) throw new Error('Cannot acquire an empty baseline.');
  const preview = {
    source, backup, workingCopy, fingerprint: baseline.fingerprint, files: files.length,
    links: Object.keys(baseline.links ?? {}).length,
    bytes: files.reduce((total, file) => total + file.bytes, 0),
    requiredCopyBytes: files.reduce((total, file) => total + file.bytes * 2, 0),
    scope: 'Source-root byte copies including ignored data, Git and contained relative links. External registered worktrees are separate sources. Stop writers first. Not a forensic/ACL certificate.',
  };
  const hash = planHash(preview);
  if (action === 'acquire-preview') return { at: new Date().toISOString(), ...preview, planHash: hash };
  if (input.approved !== true || input.planHash !== hash) throw new Error('Approve the unchanged acquisition preview; source or destinations may have changed.');
  const created = [];
  try {
    for (const folder of [backup, workingCopy]) {
      fs.mkdirSync(folder, { mode: 0o700 });
      created.push(folder);
      for (const entry of fs.readdirSync(source)) {
        fs.cpSync(path.join(source, entry), path.join(folder, entry), {
          recursive: true, force: false, errorOnExist: true, dereference: false,
          verbatimSymlinks: true, preserveTimestamps: true,
        });
      }
    }
    const result = preserve(source, backup, workingCopy, forbiddenRoots);
    if (result.baseline.fingerprint !== baseline.fingerprint) throw new Error('Source changed during acquisition.');
    return { ...result, acquired: true, passed: true, planHash: hash };
  } catch (error) {
    throw new Error(`Acquisition failed: ${error.message}. Partial copies retained, never treated as verified: ${created.join('; ') || 'none'}. Choose new destinations after review.`);
  }
}
