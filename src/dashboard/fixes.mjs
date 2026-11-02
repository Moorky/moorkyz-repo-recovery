import fs from 'node:fs';
import path from 'node:path';
import { containedBy } from '../recovery.mjs';
import { ensurePreserved } from './engine.mjs';
import { targetFile, readTarget, replaceFile, relativeFile, sha256, planHash } from './files.mjs';

export const remedies = [
  { id: 'restore-file', name: 'Restore a baseline file', description: 'Restore one missing or changed file from the verified untouched backup, in the working copy only.' },
  { id: 'normalize-text', name: 'Normalize text line endings', description: 'Convert CRLF/CR to LF for one reviewed UTF-8 text file in the working copy.' },
  { id: 'repair-link', name: 'Repair a Markdown file link', description: 'Replace an exact local link target with an existing file inside the working copy.' },
];

function plan(repository, input) {
  const preservation = repository.records.preservation;
  if (!preservation) throw new Error('Verify preservation before using fix scripts.');
  ensurePreserved(repository.path, preservation);
  const relative = relativeFile(input.file);
  const file = targetFile(preservation.workingCopy, relative, { mustExist: input.remedy !== 'restore-file', missingParents: true });
  const before = readTarget(file);
  let after;
  if (input.remedy === 'restore-file') {
    if (!preservation.baseline.files[relative]) throw new Error('This file is not part of the preserved baseline.');
    after = readTarget(targetFile(preservation.backup, relative, { mustExist: true }));
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
  const hash = bytes => bytes === null ? null : sha256(bytes);
  const preview = {
    remedy: input.remedy, file: relative, beforeHash: hash(before), afterHash: hash(after),
    beforeBytes: before?.length ?? 0, afterBytes: after.length,
    changed: hash(before) !== hash(after),
    workingCopy: preservation.workingCopy,
  };
  return { file, after, preview, planHash: planHash(preview) };
}

export function fix(repository, action, input) {
  const prepared = plan(repository, input);
  if (action === 'fix-preview') return { at: new Date().toISOString(), ...prepared.preview, planHash: prepared.planHash };
  if (input.approved !== true || input.planHash !== prepared.planHash) throw new Error('Approve the current unchanged preview before applying.');
  if (!prepared.preview.changed) throw new Error('Preview has no changes to apply.');
  replaceFile(prepared.preview.workingCopy, prepared.preview.file, prepared.after, prepared.preview.beforeHash);
  ensurePreserved(repository.path, repository.records.preservation);
  return { at: new Date().toISOString(), ...prepared.preview, planHash: prepared.planHash, passed: true };
}
