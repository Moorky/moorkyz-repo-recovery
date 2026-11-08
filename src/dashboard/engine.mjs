import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { containedBy, readGit } from '../recovery.mjs';
import { collectRecoveryEvidence } from './report.mjs';
import { targetFile, planHash } from './files.mjs';
import { checkPlan, runChecks } from './checks.mjs';
import { checkObjects, discoverCandidates } from './candidates.mjs';
import { beginWrite } from './write-guard.mjs';

const markers = ['.git', 'package.json', 'pyproject.toml', 'Cargo.toml', 'PROJECT_MANIFEST.json'];
const skip = new Set(['.git', 'node_modules', '.venv', '.next', 'data', 'dist', 'build', 'bin', 'obj']);
const checks = ['test', 'lint', 'build', 'typecheck', 'type-check'];
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
  // Unreadable child folders are skipped with a reason; they must not stop discovery of the others.
  function readable(folder) {
    try { return entries(folder); }
    catch (error) {
      skipped.push({ path: folder, reason: `unreadable (${error.code || error.message})` });
      return null;
    }
  }
  function add(folder, names) {
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
  const rootIsProject = rootEntries.some(entry => markers.includes(entry.name));
  if (rootIsProject) add(root, rootEntries.map(entry => entry.name));
  for (const entry of rootEntries) {
    const folder = path.join(root, entry.name);
    if (entry.isSymbolicLink()) {
      skipped.push({ path: folder, reason: 'link/junction not followed' });
    } else if (entry.isDirectory() && !entry.name.startsWith('.') && !skip.has(entry.name.toLowerCase())) {
      const children = readable(folder);
      if (!children) continue;
      const childIsProject = children.some(item => markers.includes(item.name));
      if ((!rootIsProject && childIsProject) || children.some(item => item.name === '.git')) add(folder, children.map(item => item.name));
      else if (!rootIsProject) skipped.push({ path: folder, reason: 'ordinary directory; no independent project marker' });
      for (const child of children) {
        if (!child.isDirectory() || child.name.startsWith('.') || skip.has(child.name.toLowerCase())) continue;
        const nested = path.join(folder, child.name);
        const nestedEntries = readable(nested);
        if (!nestedEntries) continue;
        if (nestedEntries.some(item => item.name === '.git') ||
          (!rootIsProject && !childIsProject && nestedEntries.some(item => markers.includes(item.name)))) add(nested, nestedEntries.map(item => item.name));
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
  const physicalRoot = fs.realpathSync.native(folder);
  const files = Object.create(null);
  const links = Object.create(null);
  const directories = [];
  function walk(current) {
    for (const entry of entries(current).sort((a, b) => a.name.localeCompare(b.name))) {
      const target = path.join(current, entry.name);
      const relative = path.relative(folder, target);
      if (entry.isSymbolicLink()) {
        const link = fs.readlinkSync(target);
        const resolved = path.resolve(path.dirname(target), link);
        if (path.isAbsolute(link) || path.win32.isAbsolute(link) || !containedBy(resolved, folder)) {
          throw new Error(`Cannot certify an absolute or escaping link/junction: ${relative}`);
        }
        let ancestor = resolved;
        while (!fs.existsSync(ancestor) && ancestor !== folder) ancestor = path.dirname(ancestor);
        if (!containedBy(fs.realpathSync.native(ancestor), physicalRoot)) {
          throw new Error(`Cannot certify an indirectly escaping link/junction: ${relative}`);
        }
        links[relative] = { target: link };
      } else if (entry.isDirectory()) {
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
  const content = { files, directories: directories.sort(), ...(Object.keys(links).length ? { links } : {}) };
  return { ...content, fingerprint: digest(JSON.stringify(content)) };
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
    packageVersion: typeof manifest?.version === 'string' ? manifest.version : null,
    packageManager: typeof manifest?.packageManager === 'string' ? manifest.packageManager : null,
    manifestHash: manifest ? fileHash(path.join(folder, 'package.json')) : null,
  };
}

export function inspect(repository) {
  const measured = structure(repository);
  const hasGit = fs.existsSync(path.join(repository, '.git'));
  const commands = hasGit ? [
    ['rev-parse', '--show-toplevel'], ['rev-parse', '--verify', 'HEAD'],
    ['status', '--porcelain=v1', '--untracked-files=normal', '--ignore-submodules=all'],
    ['show-ref', '--head'], ['worktree', 'list', '--porcelain'],
  ].map(args => readGit(repository, args)) : [];
  const head = commands.find(command => command.args[0] === 'rev-parse' && command.args.includes('HEAD'));
  const state = !hasGit ? 'source-only' : !good(head) ? 'unborn-or-damaged' :
    commands.some(command => !good(command)) ? 'inspection-errors' :
      commands.find(command => command.args[0] === 'status').stdout ? 'uncommitted-work' : 'clean-checkout';
  const gitPoints = !hasGit ? 0 : commands.filter(good).length / commands.length * 50;
  const gitFile = hasGit && fs.statSync(path.join(repository, '.git')).isFile();
  // A submodule's .git file points into its parent's .git/modules; anything else is a linked worktree.
  const pointer = gitFile ? fs.readFileSync(path.join(repository, '.git'), 'utf8').slice(0, 4096) : '';
  const submodule = gitFile && /[\\/]modules[\\/]/.test(pointer);
  const linkedWorktree = gitFile && !submodule;
  const containsSubmodules = hasGit && fs.existsSync(path.join(repository, '.gitmodules'));
  const objects = hasGit ? checkObjects(repository) : null;
  return {
    at: new Date().toISOString(), measured, hasGit, linkedWorktree, submodule, containsSubmodules, commands, state,
    recoveryEvidence: hasGit ? collectRecoveryEvidence(repository) : null,
    objects,
    candidates: hasGit ? discoverCandidates(repository, { dangling: objects.dangling }) : null,
    conditionScore: Math.round(gitPoints + measured.staticScore / 2),
  };
}

export function separateCopy(source, copy, forbiddenRoots) {
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

export function assertLocalGit(folder, baseline = snapshot(folder)) {
  for (const name of Object.keys(baseline.files)) {
    const parts = name.split(path.sep).map(part => part.toLowerCase());
    if (parts.at(-1) === '.git' || parts.includes('.git') && parts.slice(-3).join('/') === 'objects/info/alternates') {
      throw new Error('External Git metadata / object alternates require separate manual acquisition.');
    }
    if (parts.includes('.git') && parts.at(-1) === 'commondir') {
      const pointer = path.join(folder, name);
      const common = path.resolve(path.dirname(pointer), fs.readFileSync(pointer, 'utf8').trim());
      if (!containedBy(common, folder) || !containedBy(fs.realpathSync(common), fs.realpathSync(folder))) {
        throw new Error('External Git common directory requires separate manual acquisition.');
      }
    }
    if (parts.at(-1) !== 'config' || parts.at(-2) !== '.git') continue;
    const root = path.dirname(path.dirname(path.join(folder, name)));
    const result = readGit(root, ['rev-parse', '--show-toplevel']);
    if (!good(result) || fs.realpathSync(result.stdout.trim()) !== fs.realpathSync(root)) {
      throw new Error('Git working-tree configuration points outside its independent copy or is unreadable.');
    }
  }
}

export function preserve(source, backup, workingCopy, forbiddenRoots) {
  if (fs.existsSync(path.join(source, '.git')) && fs.statSync(path.join(source, '.git')).isFile()) {
    throw new Error('External Git metadata must be acquired separately. Linked-worktree preservation cannot be certified by this tool.');
  }
  backup = separateCopy(source, backup, forbiddenRoots);
  workingCopy = separateCopy(source, workingCopy, forbiddenRoots);
  if (containedBy(backup, workingCopy) || containedBy(workingCopy, backup)) throw new Error('Backup and working copy must be independent.');
  const original = snapshot(source);
  assertLocalGit(source, original);
  if (!Object.keys(original.files).length) throw new Error('An empty directory has no recoverable file baseline.');
  const backupSnapshot = snapshot(backup);
  const workingSnapshot = snapshot(workingCopy);
  if (backupSnapshot.fingerprint !== original.fingerprint) throw new Error('Backup differs from original: preservation not verified.');
  if (workingSnapshot.fingerprint !== original.fingerprint) throw new Error('Working copy differs from original baseline.');
  assertLocalGit(backup, backupSnapshot);
  assertLocalGit(workingCopy, workingSnapshot);
  if (snapshot(source).fingerprint !== original.fingerprint) throw new Error('Original changed during verification. Retry after quiescing writers.');
  return { at: new Date().toISOString(), backup, workingCopy, baseline: original,
    scope: 'Source-root file bytes and contained relative-link metadata. Registered external worktree directories require separate preservation.' };
}

export function ensurePreserved(source, record) {
  for (const folder of [source, record.backup, record.workingCopy]) {
    if (fs.realpathSync(folder) !== path.resolve(folder)) throw new Error('A verified directory now resolves to a different physical path. Re-verify copies.');
  }
  if (snapshot(source).fingerprint !== record.baseline.fingerprint) throw new Error('Original changed since preservation. Re-inspect and re-verify copies.');
  if (snapshot(record.backup).fingerprint !== record.baseline.fingerprint) throw new Error('Preservation backup changed. Re-verify an untouched backup.');
  const working = snapshot(record.workingCopy);
  assertLocalGit(record.workingCopy, working);
  return working;
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

export function qualityPreview(source, preservation, input) {
  const working = ensurePreserved(source, preservation);
  const folder = preservation.workingCopy;
  const measured = structure(folder);
  const profile = input.profile;
  if (!['node', 'documentation', 'custom'].includes(profile)) throw new Error('Select an explicit Node, reviewed-command or documentation-only profile.');
  if (profile === 'node' && !measured.availableChecks.includes('test')) {
    throw new Error('No package.json test script. Configure a real test command before a final quality score.');
  }
  if (profile === 'documentation' && (measured.hasSource || fs.existsSync(path.join(folder, 'package.json')))) {
    throw new Error('Documentation-only profile cannot bypass tests for a source/package project.');
  }
  const plan = profile === 'documentation' ? { commands: [], timeoutSeconds: null } : checkPlan(folder, input, measured.availableChecks);
  const preview = { profile, measured, fingerprint: working.fingerprint, ...plan };
  return { at: new Date().toISOString(), ...preview, planHash: planHash(preview) };
}

export async function quality(source, preservation, profile, approved, options = {}) {
  if (profile !== 'documentation' && approved !== true) throw new Error('Executing repository code requires explicit approval.');
  const preview = qualityPreview(source, preservation, { ...options, profile });
  if ((profile !== 'documentation' || options.planHash) && options.planHash !== preview.planHash) throw new Error('Approve the unchanged validation preview.');
  const folder = preservation.workingCopy;
  const measured = preview.measured;
  if (profile !== 'documentation') beginWrite();
  const results = profile === 'documentation' ? [localLinks(folder)] : await runChecks(preview, options.signal);
  const after = ensurePreserved(source, preservation);
  return {
    at: new Date().toISOString(), profile, measured, results, before: preview.fingerprint, planHash: preview.planHash,
    fingerprint: after.fingerprint,
    passed: results.every(good),
    score: Math.round(measured.staticScore * 0.3 + results.filter(good).length / results.length * 70),
    scope: profile === 'documentation' ? 'Documentation local-file links only' : `Approved commands: ${preview.commands.map(command => command.name).join(', ')}`,
  };
}

export function validateRecovery(source, preservation, integrityRecord, qualityRecord, targets = [], acceptance = '') {
  const candidate = ensurePreserved(source, preservation);
  if (!integrityRecord.passed || !qualityRecord.passed) throw new Error('Integrity and quality checks must pass before recovery validation.');
  if (candidate.fingerprint !== qualityRecord.fingerprint) throw new Error('Working copy changed after quality checks. Run quality checks again.');
  for (const target of targets) {
    const file = targetFile(preservation.workingCopy, target.file, { mustExist: true });
    if (fileHash(file) !== target.afterHash) throw new Error(`Recovered target no longer matches approved bytes: ${target.file}`);
  }
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
    verifiedTargets: targets,
    acceptance,
    finalIntegrity,
    verification: {
      original: 'Unchanged since preservation (full SHA-256 snapshot including .git).',
      backup: 'Unchanged since preservation (full SHA-256 snapshot including .git).',
      gitIntegrity: finalIntegrity ? 'git fsck --full passed on the working copy.' : 'Not applicable: the copy has no Git metadata.',
      restoredFiles: `${targets.length} restored file(s) still match their approved bytes.`,
      checks: qualityRecord.scope,
    },
    originalFingerprint: preservation.baseline.fingerprint,
    scope: 'Verified baseline file preservation and completed local checks; not a probability of recovering unknown lost work.',
  };
}

export function scores(repository) {
  const { inspection, preservation, integrity: objects, quality: validation, recovery } = repository.records;
  return {
    condition: inspection ? inspection.commands.some(command => !good(command)) || inspection.recoveryEvidence?.hasErrors ?
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

export function executeTask(repository, action, input, forbiddenRoots, signal) {
  const records = repository.records;
  if (action === 'inspect') return inspect(repository.path);
  if (!records.inspection) throw new Error('Run inspection first.');
  if (action === 'preserve') return preserve(repository.path, input.backup, input.workingCopy, forbiddenRoots);
  if (!records.preservation) throw new Error('Verify preservation first.');
  if (action === 'integrity') return integrity(repository.path, records.preservation);
  if (!records.integrity?.passed) throw new Error('Run passing integrity diagnostics first.');
  if (action === 'quality-preview') return qualityPreview(repository.path, records.preservation, input);
  if (action === 'quality') return quality(repository.path, records.preservation, input.profile, input.approved, { ...input, signal });
  if (!records.quality) throw new Error('Run quality checks first.');
  if (action === 'recover') {
    if (typeof input.acceptance !== 'string' || !input.acceptance.trim() || input.acceptance.length > 8000) throw new Error('Describe the reviewed recovery target, validation and remaining limitations before handoff.');
    return validateRecovery(repository.path, records.preservation, records.integrity, records.quality, repository.recoveryTargets ?? [], input.acceptance.trim());
  }
  throw new Error('Unknown medikit action.');
}
