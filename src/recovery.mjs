import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const excluded = new Set([
  '.git', 'node_modules', '.next', '.venv', 'venv', 'dist', 'build',
  'bin', 'obj', 'data', 'raw', 'uploads', 'evidence', '.recovery',
]);
const queries = [
  ['rev-parse', '--show-toplevel'],
  ['rev-parse', '--absolute-git-dir'],
  ['rev-parse', '--verify', 'HEAD'],
  ['show-ref', '--head'],
  ['worktree', 'list', '--porcelain'],
  ['stash', 'list', '--format=%gd %H'],
  ['reflog', 'show', '--all', '--format=%H %gd', '-n', '250'],
];

export function containedBy(candidate, root) {
  const relative = path.relative(root, candidate);
  return relative === '' || (!path.isAbsolute(relative) &&
    relative !== '..' && !relative.startsWith(`..${path.sep}`));
}

// Repository-defined filter drivers (for example Git LFS or a `filter.x.clean` command) are code
// that Git runs while reading the working tree, and git-lfs also writes hooks/config into .git.
// Every query disables all configured drivers so inspection never executes or writes anything.
// GIT_CONFIG_KEY_n is used instead of `-c` because subsection names may contain "=".
// The driver list is cached briefly per repository and invalidated when a config file changes.
const driverCache = new Map();
function configSignature(repository) {
  const files = [path.join(repository, '.git', 'config'), path.join(repository, '.git', 'config.worktree'),
    path.join(os.homedir(), '.gitconfig'), path.join(process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config'), 'git', 'config')];
  return files.map(file => { try { const stat = fs.statSync(file); return `${stat.mtimeMs}:${stat.size}`; } catch { return '-'; } }).join('|');
}
function filterDrivers(repository, env) {
  const signature = configSignature(repository);
  const cached = driverCache.get(repository);
  if (cached && cached.signature === signature && Date.now() - cached.at < 5_000) return cached.names;
  const listed = spawnSync('git', ['--no-pager', '-C', repository, 'config', '--null', '--name-only', '--get-regexp', '^filter\\.'], {
    encoding: 'utf8', timeout: 15_000, windowsHide: true, env,
  });
  const names = new Set(['lfs']);
  for (const key of (listed.stdout ?? '').split('\0')) {
    const match = /^filter\.([\s\S]+)\.(clean|smudge|process|required)$/i.exec(key.trim());
    if (match) names.add(match[1]);
  }
  const list = [...names];
  driverCache.set(repository, { signature, at: Date.now(), names: list });
  return list;
}
const noHooks = path.join(os.tmpdir(), `moorkyz-recovery-no-hooks-${process.pid}-unused`);

export function readGit(repository, args, { binary = false, timeout = 30_000, maxBuffer = 8 * 1024 * 1024 } = {}) {
  const env = { ...process.env, GIT_OPTIONAL_LOCKS: '0', GIT_TERMINAL_PROMPT: '0', GIT_PAGER: 'cat', GIT_NO_REPLACE_OBJECTS: '1' };
  for (const key of Object.keys(env)) {
    if ([
      'GIT_DIR', 'GIT_WORK_TREE', 'GIT_COMMON_DIR', 'GIT_INDEX_FILE',
      'GIT_OBJECT_DIRECTORY', 'GIT_ALTERNATE_OBJECT_DIRECTORIES',
      'GIT_NAMESPACE', 'GIT_SHALLOW_FILE', 'GIT_PREFIX', 'GIT_EXTERNAL_DIFF',
    ].includes(key.toUpperCase()) || /^GIT_CONFIG_(COUNT|KEY_\d+|VALUE_\d+|PARAMETERS)$/i.test(key)) delete env[key];
  }
  const overrides = filterDrivers(repository, env).flatMap(name => [
    [`filter.${name}.clean`, ''], [`filter.${name}.smudge`, ''], [`filter.${name}.process`, ''], [`filter.${name}.required`, 'false'],
  ]);
  env.GIT_CONFIG_COUNT = String(overrides.length);
  for (const [index, [key, value]] of overrides.entries()) {
    env[`GIT_CONFIG_KEY_${index}`] = key;
    env[`GIT_CONFIG_VALUE_${index}`] = value;
  }
  const result = spawnSync('git', [
    '--no-pager', '-c', 'core.fsmonitor=false', '-c', 'maintenance.auto=false',
    '-c', 'gc.auto=0', '-c', `core.hooksPath=${noHooks}`, '-c', 'diff.external=', '-C', repository, ...args,
  ], {
    encoding: binary ? null : 'utf8',
    timeout,
    maxBuffer,
    windowsHide: true,
    env,
  });
  return {
    args,
    exitCode: result.status,
    stdout: result.stdout ?? (binary ? Buffer.alloc(0) : ''),
    stderr: result.stderr?.toString('utf8') ?? '',
    error: result.error?.message ?? (result.signal ? `Terminated by ${result.signal}` : null),
  };
}

function outputLocation(scanRoot, output) {
  const outputPath = path.resolve(output);
  const outputParent = fs.realpathSync(path.dirname(outputPath));
  const physicalOutput = path.join(outputParent, path.basename(outputPath));
  if (containedBy(physicalOutput, scanRoot) || containedBy(physicalOutput, fs.realpathSync(projectRoot))) {
    throw new Error('Output must be outside the scan root and this project.');
  }
  if (fs.existsSync(outputPath)) throw new Error('Output directory already exists; nothing will be overwritten.');
  return physicalOutput;
}

export function inventory(root, output) {
  const scanRoot = fs.realpathSync(root);
  if (!fs.statSync(scanRoot).isDirectory()) throw new Error('Scan root must be a directory.');
  const physicalOutput = outputLocation(scanRoot, output);
  const candidates = [];
  const skippedPaths = [];
  function discover(folder, depth) {
    const entries = fs.readdirSync(folder, { withFileTypes: true });
    const metadata = entries.find(entry => entry.name === '.git');
    if (metadata) {
      if (metadata.isDirectory() || metadata.isFile()) candidates.push(folder);
      else skippedPaths.push({ path: path.join(folder, '.git'), reason: 'unsupported Git metadata entry' });
    }
    if (depth === 2) return;
    for (const entry of entries) {
      const child = path.join(folder, entry.name);
      if (entry.isSymbolicLink()) {
        skippedPaths.push({ path: child, reason: 'symbolic link or junction' });
      } else if (entry.isDirectory()) {
        if (excluded.has(entry.name.toLowerCase())) {
          skippedPaths.push({ path: child, reason: 'excluded data/build/metadata directory' });
        } else {
          discover(child, depth + 1);
        }
      }
    }
  }
  discover(scanRoot, 0);
  const repositories = candidates.sort().map(repository => ({
    path: repository,
    commands: queries.map(args => readGit(repository, args)),
  }));
  const report = {
    schemaVersion: 1,
    collectedAt: new Date().toISOString(),
    scanRoot,
    scanDepth: 2,
    isBackup: false,
    skippedPaths,
    repositories,
    hasErrors: repositories.some(repository =>
      repository.commands.some(command => command.exitCode !== 0 || command.error !== null)),
  };
  // Atomic directory creation refuses a competing invocation's existing output.
  fs.mkdirSync(physicalOutput);
  fs.writeFileSync(path.join(physicalOutput, 'git-snapshot.json'), `${JSON.stringify(report, null, 2)}\n`, { flag: 'wx' });
  return report;
}

export async function assess(root, output) {
  const scanRoot = fs.realpathSync(root);
  const physicalOutput = outputLocation(scanRoot, output);
  const { discover, inspect } = await import('./dashboard/engine.mjs');
  const { renderReport } = await import('./dashboard/report.mjs');
  const report = { schemaVersion: 1, ...discover(scanRoot), scannedAt: new Date().toISOString(), isBackup: false, hasErrors: false };
  for (const repository of report.repositories) {
    try {
      const inspection = inspect(repository.path);
      repository.records.inspection = inspection;
      if (inspection.commands.some(command => command.exitCode !== 0 || command.error !== null) || inspection.recoveryEvidence?.hasErrors) {
        report.hasErrors = true;
      }
    } catch (error) {
      repository.inspectionError = error.message;
      report.hasErrors = true;
    }
  }
  fs.mkdirSync(physicalOutput);
  fs.writeFileSync(path.join(physicalOutput, 'assessment.json'), `${JSON.stringify(report, null, 2)}\n`, { flag: 'wx' });
  fs.writeFileSync(path.join(physicalOutput, 'assessment.md'), renderReport(report), { flag: 'wx' });
  return report;
}

const help = `Moorkyz Repo Recovery - preservation-first local workbench

Commands:
  node .\\src\\recovery.mjs help
  node .\\src\\recovery.mjs inventory --root <preserved-copy-root> --output <new-external-folder>
  node .\\src\\recovery.mjs assess --root <project-root> --output <new-external-folder>

Output parent must exist. Inventory is NOT a backup or automatic repair.
Assess writes Markdown and JSON evidence without running product scripts or Git repairs.
Reports may contain private paths and branch names. No network calls.
Read docs\\RECOVERY_HANDBOOK.md before investigation.
`;

export async function main(args) {
  try {
    if (args.length === 0 || (args.length === 1 && args[0] === 'help')) {
      console.log(help);
      return 0;
    }
    if (!['inventory', 'assess'].includes(args[0])) throw new Error(`Unknown command: ${args[0]}`);
    const options = {};
    for (let index = 1; index < args.length; index += 2) {
      const key = args[index];
      const value = args[index + 1];
      if (!['--root', '--output'].includes(key) || !value || value.startsWith('--') || options[key]) {
        throw new Error('Expected exactly --root <directory> and --output <new-external-folder>.');
      }
      options[key] = value;
    }
    if (!options['--root'] || !options['--output']) throw new Error('--root and --output are required.');
    const assessment = args[0] === 'assess';
    const report = assessment ? await assess(options['--root'], options['--output']) : inventory(options['--root'], options['--output']);
    console.log(`${assessment ? 'Assessment' : 'Inventory'} saved: ${path.join(path.resolve(options['--output']), assessment ? 'assessment.md' : 'git-snapshot.json')}`);
    console.log(`Repositories: ${report.repositories.length}. This is NOT a backup.`);
    if (report.hasErrors) {
      console.error(assessment ? 'Partial assessment: inspection failures are recorded in Markdown and JSON. Unknown is not zero.' :
        'Partial inventory: Git queries failed. Review command errors in the report.');
      return 1;
    }
    return 0;
  } catch (error) {
    console.error(`Recovery error: ${error.message}`);
    return 1;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2)).then(code => { process.exitCode = code; });
}
