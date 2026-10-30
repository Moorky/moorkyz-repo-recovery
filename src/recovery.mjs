import fs from 'node:fs';
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

export function readGit(repository, args) {
  const env = { ...process.env, GIT_OPTIONAL_LOCKS: '0', GIT_TERMINAL_PROMPT: '0', GIT_PAGER: 'cat' };
  for (const key of Object.keys(env)) {
    if ([
      'GIT_DIR', 'GIT_WORK_TREE', 'GIT_COMMON_DIR', 'GIT_INDEX_FILE',
      'GIT_OBJECT_DIRECTORY', 'GIT_ALTERNATE_OBJECT_DIRECTORIES',
      'GIT_NAMESPACE', 'GIT_SHALLOW_FILE', 'GIT_PREFIX',
    ].includes(key.toUpperCase())) delete env[key];
  }
  const result = spawnSync('git', [
    '--no-pager', '-c', 'core.fsmonitor=false', '-c', 'maintenance.auto=false',
    '-c', 'gc.auto=0', '-C', repository, ...args,
  ], {
    encoding: 'utf8',
    timeout: 30_000,
    maxBuffer: 8 * 1024 * 1024,
    windowsHide: true,
    env,
  });
  return {
    args,
    exitCode: result.status,
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
    error: result.error?.message ?? (result.signal ? `Terminated by ${result.signal}` : null),
  };
}

export function inventory(root, output) {
  const scanRoot = fs.realpathSync(root);
  if (!fs.statSync(scanRoot).isDirectory()) throw new Error('Scan root must be a directory.');
  const outputPath = path.resolve(output);
  const outputParent = fs.realpathSync(path.dirname(outputPath));
  const physicalOutput = path.join(outputParent, path.basename(outputPath));
  if (containedBy(physicalOutput, scanRoot) || containedBy(physicalOutput, fs.realpathSync(projectRoot))) {
    throw new Error('Output must be outside the scan root and this project.');
  }
  if (fs.existsSync(outputPath)) throw new Error('Output directory already exists; nothing will be overwritten.');

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

const help = `Moorkyz Repo Recovery - preservation-first local workbench

Commands:
  node .\\src\\recovery.mjs help
  node .\\src\\recovery.mjs inventory --root <preserved-copy-root> --output <new-external-folder>

Output parent must exist. Inventory is NOT a backup or automatic repair.
Reports may contain private paths and branch names. No network calls.
Read docs\\RECOVERY_HANDBOOK.md before investigation.
`;

export function main(args) {
  try {
    if (args.length === 0 || (args.length === 1 && args[0] === 'help')) {
      console.log(help);
      return 0;
    }
    if (args[0] !== 'inventory') throw new Error(`Unknown command: ${args[0]}`);
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
    const report = inventory(options['--root'], options['--output']);
    console.log(`Inventory saved: ${path.join(path.resolve(options['--output']), 'git-snapshot.json')}`);
    console.log(`Repositories: ${report.repositories.length}. This is NOT a backup.`);
    if (report.hasErrors) {
      console.error('Partial inventory: Git queries failed. Review command errors in the report.');
      return 1;
    }
    return 0;
  } catch (error) {
    console.error(`Recovery error: ${error.message}`);
    return 1;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = main(process.argv.slice(2));
}
