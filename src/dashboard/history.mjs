import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { isUtf8 } from 'node:buffer';
import { readGit } from '../recovery.mjs';
import { ensurePreserved, snapshot } from './engine.mjs';
import { relativeFile, targetFile, readTarget, replaceFile, sha256, planHash } from './files.mjs';
import { discoverCandidates } from './candidates.mjs';

export function gitResult(folder, args, options) {
  const result = readGit(folder, args, options);
  if (result.exitCode !== 0 || result.error) throw new Error(`Git ${args[0]} failed: ${result.error || result.stderr || `exit ${result.exitCode}`}`);
  return result.stdout;
}

export function workingRepository(repository) {
  const preservation = repository.records.preservation;
  if (!preservation) throw new Error('Verify independent preservation first.');
  ensurePreserved(repository.path, preservation);
  const folder = preservation.workingCopy;
  if (!fs.statSync(path.join(folder, '.git')).isDirectory()) throw new Error('An independent Git working copy is required.');
  return folder;
}

export function resolveCommit(folder, ref) {
  if (typeof ref !== 'string' || !ref.trim() || ref.startsWith('-') || /[\0\r\n]/.test(ref) || ref.length > 256) {
    throw new Error('Enter a commit hash, local ref or reflog selector (for example HEAD@{1}).');
  }
  return gitResult(folder, ['rev-parse', '--verify', '--end-of-options', `${ref}^{commit}`]).trim();
}

export function commitTree(folder, commit) {
  return gitResult(folder, ['ls-tree', '-r', '-z', '--full-tree', commit]).split('\0').filter(Boolean).map(entry => {
    const tab = entry.indexOf('\t');
    const [mode, type, object] = entry.slice(0, tab).split(' ');
    return { file: entry.slice(tab + 1), mode, type, object };
  });
}

function commitRows(text, source) {
  return text.split(/\r?\n/).filter(Boolean).map(line => {
    const [commit, at, ...subject] = line.split('\t');
    return { commit, at, subject: subject.join('\t'), source };
  });
}

export function history(repository) {
  const folder = workingRepository(repository);
  const format = '%H%x09%cI%x09%s';
  const commits = commitRows(gitResult(folder, ['log', '--all', '-n', '100', `--format=${format}`]), 'reachable refs');
  const reflog = commitRows(gitResult(folder, ['reflog', 'show', '--all', '-n', '100', '--format=%H%x09%cI%x09%gs']), 'reflog');
  const refs = gitResult(folder, ['for-each-ref', '--format=%(objectname)%09%(refname)']).split(/\r?\n/).filter(Boolean).map(line => {
    const [commit, name] = line.split('\t');
    return { commit, name };
  });
  const objectLog = repository.records.integrity?.command?.stdout ?? '';
  const unreachable = [...new Set([...objectLog.matchAll(/(?:unreachable|dangling) commit ([0-9a-f]{40,64})/g)].map(match => match[1]))];
  return {
    at: new Date().toISOString(), commits, reflog, refs, unreachable,
    candidates: discoverCandidates(folder, { dangling: unreachable }),
    scope: 'Up to 100 log and 100 reflog entries. Unreachable commits come from the last integrity check. Reflog expiry or missing objects can prevent recovery.',
  };
}

function blobHash(file, algorithm) {
  const hash = crypto.createHash(algorithm);
  hash.update(`blob ${fs.statSync(file).size}\0`);
  const fd = fs.openSync(file, 'r');
  try {
    const buffer = Buffer.alloc(1024 * 1024);
    let count;
    while ((count = fs.readSync(fd, buffer, 0, buffer.length, null)) > 0) hash.update(buffer.subarray(0, count));
  } finally { fs.closeSync(fd); }
  return hash.digest('hex');
}

export function compareHistory(repository, input) {
  const folder = workingRepository(repository);
  const before = snapshot(folder).fingerprint;
  const commit = resolveCommit(folder, input.ref);
  const files = commitTree(folder, commit).map(entry => {
    if (entry.type !== 'blob' || !['100644', '100755'].includes(entry.mode)) return { ...entry, state: 'unsupported', reason: 'Symlink/submodule or non-regular entry; not followed.' };
    let relative;
    try { relative = relativeFile(entry.file); }
    catch (error) { return { ...entry, state: 'unsupported', reason: error.message }; }
    const target = targetFile(folder, relative, { missingParents: true });
    const state = !fs.existsSync(target) ? 'missing' : blobHash(target, commit.length === 64 ? 'sha256' : 'sha1') === entry.object ? 'identical' : 'changed';
    return { ...entry, state };
  });
  if (snapshot(folder).fingerprint !== before) throw new Error('Working copy changed during comparison; stop writers and retry.');
  const totals = Object.fromEntries(['identical', 'missing', 'changed', 'unsupported'].map(state => [state, files.filter(file => file.state === state).length]));
  return {
    at: new Date().toISOString(), commit, fingerprint: before, files, totals,
    scope: 'Selected commit tree versus working-copy bytes, without filters/textconv. CRLF/filter differences can appear changed. Extra working files are retained and are not losses. This does not infer owner intent.',
  };
}

export function restoreHistory(repository, action, input) {
  const folder = workingRepository(repository);
  const commit = resolveCommit(folder, input.ref);
  const relative = relativeFile(input.file);
  const entry = commitTree(folder, commit).find(entry => entry.file === relative.split(path.sep).join('/'));
  if (!entry || entry.type !== 'blob' || !['100644', '100755'].includes(entry.mode)) {
    throw new Error('Selected path is not a regular file in that commit; symlinks/submodules are not restored.');
  }
  const file = targetFile(folder, relative, { missingParents: true });
  const before = readTarget(file);
  const size = Number(gitResult(folder, ['cat-file', '-s', entry.object]).trim());
  if (size > 64 * 1024 * 1024) throw new Error('Historical file exceeds the 64 MiB selective-recovery limit.');
  const after = gitResult(folder, ['cat-file', 'blob', entry.object], { binary: true, maxBuffer: 64 * 1024 * 1024 });
  const preview = {
    workingCopy: folder, file: relative, sourceCommit: commit, object: entry.object,
    beforeHash: before === null ? null : sha256(before), afterHash: sha256(after),
    beforeBytes: before?.length ?? 0, afterBytes: after.length, mode: entry.mode,
  };
  const hash = planHash(preview);
  if (action === 'restore-preview') return {
    at: new Date().toISOString(), ...preview, planHash: hash,
    excerpt: isUtf8(after) && !after.includes(0) ? after.toString('utf8').slice(0, 2000) : '(binary; review hashes and source file separately)',
  };
  if (input.approved !== true || input.planHash !== hash) throw new Error('Approve the unchanged historical-file preview.');
  if (preview.beforeHash === preview.afterHash) throw new Error('Selected historical bytes are already present.');
  replaceFile(folder, relative, after, preview.beforeHash, entry.mode === '100755' ? 0o755 : 0o644);
  ensurePreserved(repository.path, repository.records.preservation);
  return { at: new Date().toISOString(), ...preview, planHash: hash, passed: true };
}

export function withoutHooks(folder, args, options) {
  const hooks = fs.mkdtempSync(path.join(os.tmpdir(), 'recovery-no-hooks-'));
  try { return gitResult(folder, ['-c', `core.hooksPath=${hooks}`, ...args], options); }
  finally { fs.rmdirSync(hooks); }
}

export function rescueCommit(repository, action, input) {
  const folder = workingRepository(repository);
  const commit = resolveCommit(folder, input.ref);
  if (typeof input.branch !== 'string' || !/^recovery\/[a-zA-Z0-9][a-zA-Z0-9/_-]{0,100}$/.test(input.branch)) {
    throw new Error('Use a new recovery/<name> branch containing letters, digits, slash, dash or underscore.');
  }
  gitResult(folder, ['check-ref-format', '--branch', input.branch]);
  const ref = `refs/heads/${input.branch}`;
  const existing = readGit(folder, ['show-ref', '--verify', '--quiet', ref]);
  if (existing.exitCode === 0) throw new Error('Recovery branch already exists; it will never be overwritten.');
  if (existing.exitCode !== 1 || existing.error) throw new Error(`Cannot verify branch availability: ${existing.error || existing.stderr}`);
  const preview = { workingCopy: folder, sourceCommit: commit, branch: input.branch };
  const hash = planHash(preview);
  if (action === 'rescue-preview') return { at: new Date().toISOString(), ...preview, planHash: hash };
  if (input.approved !== true || input.planHash !== hash) throw new Error('Approve the unchanged recovery-branch preview.');
  withoutHooks(folder, ['update-ref', '--create-reflog', ref, commit, '0'.repeat(commit.length)]);
  ensurePreserved(repository.path, repository.records.preservation);
  return { at: new Date().toISOString(), ...preview, planHash: hash, passed: true,
    scope: 'New branch in the disposable copy only. No checkout, reset, merge, index update or original modification.' };
}
