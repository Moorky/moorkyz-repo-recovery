import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { containedBy, readGit } from '../recovery.mjs';

const markers = ['.git', 'package.json', 'README.md', 'AGENTS.md', 'pyproject.toml', 'Cargo.toml'];
const skip = new Set(['.git', 'node_modules', '.venv', '.next', 'data', 'dist', 'build', 'bin', 'obj']);
const checks = ['test', 'lint', 'build', 'typecheck'];
const digest = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const good = result => result.exitCode === 0 && result.error === null;

function entries(folder) {
  return fs.readdirSync(folder, { withFileTypes: true });
}

export function discover(root) {
  root = fs.realpathSync(root);
  if (!fs.statSync(root).isDirectory()) throw new Error('Directory root is not a folder.');
  const repositories = [];
  const skipped = [];
  function add(folder) {
    const names = entries(folder).map(entry => entry.name);
    repositories.push({
      id: digest(folder).slice(0, 24),
      name: path.relative(root, folder) || path.basename(folder),
      path: folder,
      hasGit: names.includes('.git'),
      empty: names.length === 0,
      markers: markers.filter(marker => names.includes(marker)),
      records: {},
    });
  }
  const rootEntries = entries(root);
  if (rootEntries.some(entry => markers.includes(entry.name))) add(root);
  for (const entry of rootEntries) {
    const folder = path.join(root, entry.name);
    if (entry.isSymbolicLink()) {
      skipped.push({ path: folder, reason: 'link/junction not followed' });
    } else if (entry.isDirectory() && !entry.name.startsWith('.') && !skip.has(entry.name.toLowerCase())) {
      add(folder);
      for (const child of entries(folder)) {
        if (!child.isDirectory() || child.name.startsWith('.') || skip.has(child.name.toLowerCase())) continue;
        const nested = path.join(folder, child.name);
        if (entries(nested).some(item => markers.includes(item.name))) add(nested);
      }
    }
  }
  return { root, repositories: repositories.sort((a, b) => a.name.localeCompare(b.name)), skipped };
}

function fileHash(file) {
  const hash = crypto.createHash('sha256');
  const descriptor = fs.openSync(file, 'r');
  const buffer = Buffer.alloc(1024 * 1024);
  try {
    let count;
    while ((count = fs.readSync(descriptor, buffer, 0, buffer.length, null)) > 0) hash.update(buffer.subarray(0, count));
  } finally {
    fs.closeSync(descriptor);
  }
  return hash.digest('hex');
}

export function snapshot(folder) {
  const files = {};
  const directories = [];
  function walk(current) {
    for (const entry of entries(current).sort((a, b) => a.name.localeCompare(b.name))) {
      const target = path.join(current, entry.name);
      const relative = path.relative(folder, target);
      if (entry.isSymbolicLink()) throw new Error(`Cannot certify a full copy containing a link/junction: ${relative}`);
      if (entry.isDirectory()) {
        directories.push(relative);
        walk(target);
      } else if (entry.isFile()) {
        files[relative] = { bytes: fs.statSync(target).size, sha256: fileHash(target) };
      } else {
        throw new Error(`Unsupported filesystem entry: ${relative}`);
      }
    }
  }
  walk(folder);
  return { files, directories: directories.sort(), fingerprint: digest(JSON.stringify({ files, directories: directories.sort() })) };
}

function structure(folder) {
  const list = entries(folder);
  const names = list.map(entry => entry.name);
  let manifest = null;
  if (names.includes('package.json')) {
    const file = path.join(folder, 'package.json');
    if (fs.statSync(file).size > 1024 * 1024) throw new Error('package.json exceeds the 1 MiB inspection limit.');
    manifest = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) throw new Error('Invalid package manifest.');
  }
  const availableChecks = checks.filter(check => typeof manifest?.scripts?.[check] === 'string');
  const hasSource = names.some(name => ['src', 'apps', 'packages', 'server', 'client'].includes(name));
  const hasTests = names.some(name => ['test', 'tests', '__tests__'].includes(name));
  const rubric = [
    { label: 'README', pass: names.includes('README.md'), weight: 20 },
    { label: 'Source or documentation tree', pass: hasSource || names.includes('docs'), weight: 25 },
    { label: 'Tests or declared test command', pass: hasTests || availableChecks.includes('test'), weight: 25 },
    { label: 'Contribution / agent guidance', pass: names.includes('CONTRIBUTING.md') || names.includes('AGENTS.md'), weight: 15 },
    { label: 'Safety guidance', pass: names.includes('SECURITY.md'), weight: 15 },
  ];
  return {
    rubric,
    staticScore: rubric.reduce((sum, item) => sum + (item.pass ? item.weight : 0), 0),
    availableChecks,
    hasSource,
    manifestHash: manifest ? fileHash(path.join(folder, 'package.json')) : null,
  };
}

export function inspect(repository) {
  const measured = structure(repository);
  const hasGit = fs.existsSync(path.join(repository, '.git'));
  const commands = hasGit ? [
    ['rev-parse', '--show-toplevel'], ['rev-parse', '--verify', 'HEAD'],
    ['status', '--porcelain=v1', '--untracked-files=normal'],
    ['show-ref', '--head'], ['worktree', 'list', '--porcelain'],
  ].map(args => readGit(repository, args)) : [];
  const head = commands.find(command => command.args[0] === 'rev-parse' && command.args.includes('HEAD'));
  const state = !hasGit ? 'source-only' : !good(head) ? 'unborn-or-damaged' :
    commands.some(command => !good(command)) ? 'inspection-errors' :
      commands.find(command => command.args[0] === 'status').stdout ? 'uncommitted-work' : 'clean-checkout';
  const gitPoints = !hasGit ? 0 : commands.filter(good).length / commands.length * 50;
  return {
    at: new Date().toISOString(), measured, hasGit, commands, state,
    conditionScore: Math.round(gitPoints + measured.staticScore / 2),
  };
}

function separateCopy(source, copy, forbiddenRoots) {
  copy = fs.realpathSync(copy);
  if (!fs.statSync(copy).isDirectory()) throw new Error('Copy must be a directory.');
  if (containedBy(copy, source) || containedBy(source, copy)) throw new Error('Copy must not overlap the original.');
  for (const root of forbiddenRoots) {
    if (containedBy(copy, root) || containedBy(root, copy)) throw new Error('Copy must be outside the dashboard and scanned directory.');
  }
  if (fs.existsSync(path.join(copy, '.git')) && fs.statSync(path.join(copy, '.git')).isFile()) {
    throw new Error('Linked worktree copies require preservation of external Git metadata; certification is unavailable.');
  }
  return copy;
}

export function preserve(source, backup, workingCopy, forbiddenRoots) {
  if (fs.existsSync(path.join(source, '.git')) && fs.statSync(path.join(source, '.git')).isFile()) {
    throw new Error('External Git metadata must be acquired separately. Linked-worktree preservation cannot be certified by this tool.');
  }
  backup = separateCopy(source, backup, forbiddenRoots);
  workingCopy = separateCopy(source, workingCopy, forbiddenRoots);
  if (containedBy(backup, workingCopy) || containedBy(workingCopy, backup)) throw new Error('Backup and working copy must be independent.');
  const original = snapshot(source);
  if (!Object.keys(original.files).length) throw new Error('An empty directory has no recoverable file baseline.');
  if (snapshot(backup).fingerprint !== original.fingerprint) throw new Error('Backup differs from original: preservation not verified.');
  if (snapshot(workingCopy).fingerprint !== original.fingerprint) throw new Error('Working copy differs from original baseline.');
  if (snapshot(source).fingerprint !== original.fingerprint) throw new Error('Original changed during verification. Retry after quiescing writers.');
  return { at: new Date().toISOString(), backup, workingCopy, baseline: original };
}

function ensurePreserved(source, record) {
  for (const folder of [source, record.backup, record.workingCopy]) {
    if (fs.realpathSync(folder) !== path.resolve(folder)) throw new Error('A verified directory now resolves to a different physical path. Re-verify copies.');
  }
  if (snapshot(source).fingerprint !== record.baseline.fingerprint) throw new Error('Original changed since preservation. Re-inspect and re-verify copies.');
  if (snapshot(record.backup).fingerprint !== record.baseline.fingerprint) throw new Error('Preservation backup changed. Re-verify an untouched backup.');
}

export function integrity(source, preservation) {
  ensurePreserved(source, preservation);
  const folder = preservation.workingCopy;
  const hasGit = fs.existsSync(path.join(folder, '.git'));
  const command = hasGit ? readGit(folder, ['fsck', '--full', '--no-reflogs', '--unreachable', '--no-progress']) : null;
  return {
    at: new Date().toISOString(), hasGit, command,
    passed: !hasGit || good(command),
    note: hasGit ? 'Local object integrity; no remote completeness claim.' : 'Source-only copy: Git integrity not applicable.',
  };
}

function localLinks(folder) {
  let examined = 0;
  const failures = [];
  function walk(current) {
    for (const entry of entries(current)) {
      const file = path.join(current, entry.name);
      if (entry.isSymbolicLink()) throw new Error('Documentation check does not follow links/junctions.');
      if (entry.isDirectory()) {
        if (!skip.has(entry.name.toLowerCase()) && entry.name !== 'sources') walk(file);
      } else if (entry.name.endsWith('.md')) {
        examined++;
        if (fs.statSync(file).size > 2 * 1024 * 1024) throw new Error(`Markdown file too large for link check: ${file}`);
        const text = fs.readFileSync(file, 'utf8');
        for (const match of text.matchAll(/\[[^\]]*\]\(([^)]+)\)/g)) {
          const link = match[1].replace(/^<|>$/g, '');
          if (/^(https?:|mailto:|#)/i.test(link)) continue;
          const target = path.resolve(current, decodeURIComponent(link.split('#')[0]));
          if (!containedBy(target, folder) || !fs.existsSync(target)) failures.push(`${path.relative(folder, file)}: ${link}`);
        }
      }
    }
  }
  walk(folder);
  return { check: 'documentation-links', exitCode: examined > 0 && failures.length === 0 ? 0 : 1,
    stdout: `${examined} Markdown files checked (archived sources excluded).`, stderr: failures.join('\n'), error: null };
}

function runPackageCheck(folder, check) {
  // Check names are allowlisted; no user-provided shell fragments are interpolated.
  const executable = process.platform === 'win32' ? process.env.ComSpec || 'cmd.exe' : 'npm';
  const args = process.platform === 'win32' ? ['/d', '/s', '/c', `npm.cmd run ${check}`] : ['run', check];
  const result = spawnSync(executable, args, {
    cwd: folder, encoding: 'utf8', timeout: 120_000, maxBuffer: 8 * 1024 * 1024, windowsHide: true,
    env: { ...process.env, CI: 'true', GIT_TERMINAL_PROMPT: '0' },
  });
  return { check, exitCode: result.status, stdout: result.stdout ?? '', stderr: result.stderr ?? '',
    error: result.error?.message ?? (result.signal ? `Terminated by ${result.signal}` : null) };
}

export function quality(source, preservation, profile, approved) {
  ensurePreserved(source, preservation);
  const folder = preservation.workingCopy;
  const measured = structure(folder);
  if (!['node', 'documentation'].includes(profile)) throw new Error('Select an explicit Node or documentation-only profile.');
  if (profile === 'node' && approved !== true) throw new Error('Executing repository code requires explicit approval.');
  if (profile === 'node' && !measured.availableChecks.includes('test')) {
    throw new Error('No package.json test script. Configure a real test command before a final quality score.');
  }
  if (profile === 'documentation' && (measured.hasSource || fs.existsSync(path.join(folder, 'package.json')))) {
    throw new Error('Documentation-only profile cannot bypass tests for a source/package project.');
  }
  const before = snapshot(folder).fingerprint;
  const results = profile === 'node' ? measured.availableChecks.map(check => runPackageCheck(folder, check)) : [localLinks(folder)];
  ensurePreserved(source, preservation);
  const after = snapshot(folder);
  return {
    at: new Date().toISOString(), profile, measured, results, before,
    fingerprint: after.fingerprint,
    passed: results.every(good),
    score: Math.round(measured.staticScore * 0.3 + results.filter(good).length / results.length * 70),
    scope: profile === 'node' ? `Declared npm scripts: ${measured.availableChecks.join(', ')}` : 'Documentation local-file links only',
  };
}

export function validateRecovery(source, preservation, integrityRecord, qualityRecord) {
  ensurePreserved(source, preservation);
  if (!integrityRecord.passed || !qualityRecord.passed) throw new Error('Integrity and quality checks must pass before recovery validation.');
  const candidate = snapshot(preservation.workingCopy);
  if (candidate.fingerprint !== qualityRecord.fingerprint) throw new Error('Working copy changed after quality checks. Run quality checks again.');
  const baselineFiles = Object.entries(preservation.baseline.files);
  const matched = baselineFiles.filter(([name, original]) =>
    candidate.files[name]?.sha256 === original.sha256 && candidate.files[name]?.bytes === original.bytes).length;
  const hasGit = fs.existsSync(path.join(preservation.workingCopy, '.git'));
  const finalIntegrity = hasGit ? readGit(preservation.workingCopy, ['fsck', '--full', '--no-reflogs', '--unreachable', '--no-progress']) : null;
  if (finalIntegrity && !good(finalIntegrity)) throw new Error(`Final Git integrity failed: ${finalIntegrity.stderr || finalIntegrity.error}`);
  return {
    at: new Date().toISOString(),
    matchedFiles: matched, baselineFiles: baselineFiles.length,
    recoveryScore: Math.round(matched / baselineFiles.length * 100),
    confidenceScore: 100,
    fingerprint: candidate.fingerprint,
    finalIntegrity,
    scope: 'Verified baseline file preservation and completed local checks; not a probability of recovering unknown lost work.',
  };
}

export function scores(repository) {
  const { inspection, preservation, integrity: objects, quality: validation, recovery } = repository.records;
  return {
    condition: inspection ? inspection.commands.some(command => !good(command)) ?
      { value: null, status: 'blocked', scope: 'Git query failures leave the condition unknown; see recorded evidence' } :
      { value: inspection.conditionScore, status: 'final', scope: 'Local condition rubric at inspection time' } :
      { value: repository.empty ? 0 : repository.hasGit ? 50 : 25, status: 'estimate', scope: 'Directory markers only; inspect to measure' },
    quality: validation ? { value: validation.score, status: 'final', scope: validation.scope } :
      inspection ? { value: inspection.measured.staticScore, status: 'estimate', scope: 'Static potential only; no validation run' } :
        { value: null, status: 'locked', scope: 'Inspect before estimating potential quality' },
    recovery: recovery ? { value: recovery.recoveryScore, status: 'final', scope: recovery.scope } :
      { value: null, status: 'locked', scope: 'Preservation, integrity, passing checks and baseline validation required' },
    confidence: recovery ? { value: recovery.confidenceScore, status: 'final', scope: 'Evidence checklist coverage, NOT a recovery probability' } :
      { value: [inspection, preservation, objects?.passed, validation?.passed].filter(Boolean).length * 20,
        status: 'estimate', scope: 'Evidence checklist coverage: 20 points per completed gate' },
  };
}

export function executeTask(repository, action, input, forbiddenRoots) {
  const records = repository.records;
  if (action === 'inspect') return inspect(repository.path);
  if (!records.inspection) throw new Error('Run inspection first.');
  if (action === 'preserve') return preserve(repository.path, input.backup, input.workingCopy, forbiddenRoots);
  if (!records.preservation) throw new Error('Verify preservation first.');
  if (action === 'integrity') return integrity(repository.path, records.preservation);
  if (!records.integrity?.passed) throw new Error('Run passing integrity diagnostics first.');
  if (action === 'quality') return quality(repository.path, records.preservation, input.profile, input.approved);
  if (!records.quality) throw new Error('Run quality checks first.');
  if (action === 'recover') return validateRecovery(repository.path, records.preservation, records.integrity, records.quality);
  throw new Error('Unknown medikit action.');
}
