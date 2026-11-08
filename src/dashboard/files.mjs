import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { containedBy } from '../recovery.mjs';
import { beginWrite } from './write-guard.mjs';

export const sha256 = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
export const planHash = plan => sha256(JSON.stringify(plan));

export function relativeFile(value) {
  if (typeof value !== 'string' || !value || path.isAbsolute(value) || path.win32.isAbsolute(value)) {
    throw new Error('Enter a relative file path.');
  }
  const parts = value.replaceAll('\\', '/').split('/');
  if (parts.some(part => !part || ['.', '..', '.git'].includes(part.toLowerCase()) ||
    /[\0-\x1f<>:"|?*]/.test(part) || /[. ]$/.test(part) ||
    /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\.|$)/i.test(part))) {
    throw new Error('File must stay inside the working copy; traversal, Git metadata and reserved names are forbidden.');
  }
  return parts.join(path.sep);
}

export function targetFile(root, value, { mustExist = false, missingParents = false } = {}) {
  const relative = relativeFile(value);
  const file = path.resolve(root, relative);
  if (!containedBy(file, root) || file === root || fs.realpathSync(root) !== path.resolve(root)) {
    throw new Error('File must stay inside the independent physical working copy.');
  }
  let current = root;
  for (const [index, part] of relative.split(path.sep).entries()) {
    current = path.join(current, part);
    let stat;
    try { stat = fs.lstatSync(current); }
    catch (error) {
      if (error.code !== 'ENOENT') throw error;
      if (mustExist || (!missingParents && current !== file)) throw new Error('Target or parent does not exist.');
      continue;
    }
    if (stat.isSymbolicLink() || (current === file ? !stat.isFile() : !stat.isDirectory())) {
      throw new Error(`Unsupported linked or non-regular path component ${index + 1}.`);
    }
  }
  return file;
}

export function readTarget(file) {
  if (!fs.existsSync(file)) return null;
  if (fs.statSync(file).size > 64 * 1024 * 1024) throw new Error('File exceeds the 64 MiB selective-recovery limit.');
  return fs.readFileSync(file);
}

export function replaceFile(root, relative, bytes, expectedHash, mode) {
  const file = targetFile(root, relative, { missingParents: true });
  const before = readTarget(file);
  if ((before === null ? null : sha256(before)) !== expectedHash) throw new Error('Target changed after preview; preview again.');
  beginWrite();
  fs.mkdirSync(path.dirname(file), { recursive: true });
  targetFile(root, relative);
  const temporary = `${file}.recovery-${crypto.randomUUID()}.tmp`;
  try {
    fs.writeFileSync(temporary, bytes, { flag: 'wx', mode: mode ?? (before ? fs.statSync(file).mode : 0o600) });
    fs.renameSync(temporary, file);
  } finally {
    if (fs.existsSync(temporary)) fs.unlinkSync(temporary);
  }
}
