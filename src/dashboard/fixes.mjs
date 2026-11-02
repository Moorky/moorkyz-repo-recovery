import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { containedBy } from '../recovery.mjs';
import { snapshot, ensurePreserved } from './engine.mjs';

export const remedies = [
  { id: 'restore-file', name: 'Restore a baseline file', description: 'Restore one missing or changed file from the verified untouched backup, in the working copy only.' },
  { id: 'normalize-text', name: 'Normalize text line endings', description: 'Convert CRLF/CR to LF for one reviewed UTF-8 text file in the working copy.' },
  { id: 'repair-link', name: 'Repair a Markdown file link', description: 'Replace an exact local link target with an existing file inside the working copy.' },
];

function targetFile(root, relative, mustExist = false) {
  if (typeof relative !== 'string' || !relative || path.isAbsolute(relative)) throw new Error('Enter a relative file path.');
  const file = path.resolve(root, relative);
  if (!containedBy(file, root) || file === root || path.relative(root, file).split(path.sep).includes('.git')) {
    throw new Error('File must stay inside the working copy and outside Git metadata.');
  }
  if (!fs.existsSync(path.dirname(file))) throw new Error('Target parent must already exist.');
  if (fs.realpathSync(path.dirname(file)) !== path.dirname(file)) throw new Error('Linked parent paths are not supported.');
  if (fs.existsSync(file) && (fs.lstatSync(file).isSymbolicLink() || !fs.statSync(file).isFile())) throw new Error('Target must be a regular file.');
  if (mustExist && !fs.existsSync(file)) throw new Error('Target file does not exist.');
  return file;
}

function plan(repository, input) {
  const preservation = repository.records.preservation;
  if (!preservation) throw new Error('Verify preservation before using fix scripts.');
  ensurePreserved(repository.path, preservation);
  snapshot(preservation.workingCopy);
  const file = targetFile(preservation.workingCopy, input.file, input.remedy !== 'restore-file');
  const before = fs.existsSync(file) ? fs.readFileSync(file) : null;
  let after;
  if (input.remedy === 'restore-file') {
    if (!preservation.baseline.files[input.file]) throw new Error('This file is not part of the preserved baseline.');
    after = fs.readFileSync(targetFile(preservation.backup, input.file, true));
  } else if (['normalize-text', 'repair-link'].includes(input.remedy)) {
    if (!/\.(md|txt|json|js|mjs|cjs|ts|css|html|yml|yaml|ps1)$/i.test(file) || before.length > 2 * 1024 * 1024) throw new Error('Use a supported text file below 2 MiB.');
    const text = new TextDecoder('utf-8', { fatal: true }).decode(before);
    if (text.includes('\0')) throw new Error('Binary content is not supported.');
    if (input.remedy === 'normalize-text') after = Buffer.from(text.replace(/\r\n?/g, '\n'));
    else {
      if (!file.endsWith('.md') || typeof input.oldTarget !== 'string' || !input.oldTarget ||
        typeof input.newTarget !== 'string' || !input.newTarget || /[()\n\r]/.test(input.newTarget) ||
        /^[a-z]+:|^#/i.test(input.newTarget)) throw new Error('Enter exact, local Markdown link targets.');
      const destination = path.resolve(path.dirname(file), input.newTarget);
      if (!containedBy(destination, preservation.workingCopy) || !fs.existsSync(destination)) throw new Error('Replacement target must exist within the working copy.');
      const needle = `](${input.oldTarget})`;
      if (!text.includes(needle)) throw new Error('Exact Markdown link was not found.');
      after = Buffer.from(text.split(needle).join(`](${input.newTarget})`));
    }
  } else throw new Error('Unknown fix script.');
  const hash = bytes => bytes === null ? null : crypto.createHash('sha256').update(bytes).digest('hex');
  const preview = {
    remedy: input.remedy, file: input.file, beforeHash: hash(before), afterHash: hash(after),
    beforeBytes: before?.length ?? 0, afterBytes: after.length,
    changed: hash(before) !== hash(after),
    workingCopy: preservation.workingCopy,
  };
  return { file, after, preview, planHash: crypto.createHash('sha256').update(JSON.stringify(preview)).digest('hex') };
}

export function fix(repository, action, input) {
  const prepared = plan(repository, input);
  if (action === 'fix-preview') return { at: new Date().toISOString(), ...prepared.preview, planHash: prepared.planHash };
  if (input.approved !== true || input.planHash !== prepared.planHash) throw new Error('Approve the current unchanged preview before applying.');
  if (!prepared.preview.changed) throw new Error('Preview has no changes to apply.');
  const temporary = `${prepared.file}.recovery-${crypto.randomUUID()}.tmp`;
  const mode = fs.existsSync(prepared.file) ? fs.statSync(prepared.file).mode : 0o600;
  try {
    fs.writeFileSync(temporary, prepared.after, { flag: 'wx', mode });
    fs.renameSync(temporary, prepared.file);
  } finally {
    if (fs.existsSync(temporary)) fs.unlinkSync(temporary);
  }
  ensurePreserved(repository.path, repository.records.preservation);
  return { at: new Date().toISOString(), ...prepared.preview, planHash: prepared.planHash, passed: true };
}
