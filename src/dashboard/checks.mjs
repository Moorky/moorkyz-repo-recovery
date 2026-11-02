import fs from 'node:fs';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { containedBy } from '../recovery.mjs';
import { targetFile } from './files.mjs';

export function checkPlan(root, options, defaults) {
  const timeoutSeconds = options.timeoutSeconds ?? 120;
  if (!Number.isInteger(timeoutSeconds) || timeoutSeconds < 1 || timeoutSeconds > 1800) throw new Error('Check timeout must be 1-1800 seconds.');
  const commands = options.profile === 'custom' ? options.commands : defaults.map(script => ({
    name: script, kind: script === 'test' ? 'test' : 'check', runner: 'package', manager: 'npm', script, directory: '.',
  }));
  if (!Array.isArray(commands) || !commands.length || commands.length > 10 || !commands.some(command => command?.kind === 'test')) {
    throw new Error('Declare 1-10 reviewed commands, including at least one actual test (kind: test).');
  }
  const resolved = commands.map(command => {
    if (!command || typeof command.name !== 'string' || !command.name.trim() || command.name.length > 120) throw new Error('Each check needs a descriptive name.');
    if (typeof command.directory !== 'string' || path.isAbsolute(command.directory) || path.win32.isAbsolute(command.directory)) throw new Error('Check directory must be relative to the working copy.');
    const cwd = path.resolve(root, command.directory);
    if (!containedBy(cwd, root) || path.relative(root, cwd).split(path.sep).some(part => part.toLowerCase() === '.git') ||
      fs.realpathSync(cwd) !== cwd || !fs.statSync(cwd).isDirectory()) throw new Error('Check directory must be an unlinked working-copy directory, outside Git metadata.');
    const args = command.args ?? [];
    if (!Array.isArray(args) || args.length > 50 || args.some(arg => typeof arg !== 'string' || arg.length > 4096 || /[\0\r\n]/.test(arg))) throw new Error('Check args must be an array of at most 50 plain strings.');
    let executable, argv;
    if (command.runner === 'package') {
      if (!['npm', 'pnpm'].includes(command.manager) || !/^[a-zA-Z0-9][a-zA-Z0-9:_-]{0,80}$/.test(command.script ?? '') || args.length) {
        throw new Error('Package checks require npm/pnpm, a safe script name and no shell arguments.');
      }
      const manifestFile = targetFile(cwd, 'package.json', { mustExist: true });
      if (fs.statSync(manifestFile).size > 1024 * 1024) throw new Error('Package manifest exceeds 1 MiB.');
      const manifest = JSON.parse(fs.readFileSync(manifestFile, 'utf8'));
      if (typeof manifest.scripts?.[command.script] !== 'string') throw new Error(`Missing declared package script: ${command.script}`);
      executable = process.platform === 'win32' ? process.env.ComSpec || 'cmd.exe' : command.manager;
      argv = process.platform === 'win32' ? ['/d', '/s', '/c', `${command.manager}.cmd run ${command.script}`] : ['run', command.script];
    } else {
      const file = targetFile(cwd, command.file, { mustExist: true });
      if (command.runner === 'node' && /\.(mjs|cjs|js)$/.test(file)) { executable = process.execPath; argv = [file, ...args]; }
      else if (command.runner === 'python' && /\.py$/.test(file)) {
        executable = command.interpreter === undefined ? 'python' : targetFile(root, command.interpreter, { mustExist: true });
        if (command.interpreter !== undefined && !/^python(?:\d+(?:\.\d+)*)?(?:\.exe)?$/i.test(path.basename(executable))) {
          throw new Error('Project-local Python interpreter must be a regular python executable inside the working copy.');
        }
        argv = [file, ...args];
      }
      else if (command.runner === 'powershell' && /\.ps1$/i.test(file)) { executable = 'pwsh'; argv = ['-NoProfile', '-NonInteractive', '-File', file, ...args]; }
      else if (command.runner === 'dotnet' && /\.(csproj|fsproj|sln|slnx)$/i.test(file)) { executable = 'dotnet'; argv = ['test', file, '--no-restore', ...args]; }
      else throw new Error('Supported runners: package, node (.js/.mjs/.cjs), python (.py), powershell (.ps1), dotnet (project/solution).');
    }
    return { name: command.name.trim(), kind: command.kind, executable, args: argv, cwd };
  });
  return { commands: resolved, timeoutSeconds,
    warning: 'Approved repository code is NOT sandboxed. Review scripts/arguments; they may access absolute paths/network. No dependencies are installed by the workbench.' };
}

function stopTree(child) {
  if (!child.pid || child.exitCode !== null) return null;
  if (process.platform !== 'win32') {
    try { process.kill(-child.pid, 'SIGKILL'); return null; }
    catch (error) { return error.code === 'ESRCH' ? null : error.message; }
  }
  const script = `$ErrorActionPreference='Stop'; function Stop-Tree([int]$processId) {
    $children = @(Get-CimInstance Win32_Process -Filter "ParentProcessId = $processId");
    foreach ($child in $children) { Stop-Tree $child.ProcessId }
    $process = Get-Process -Id $processId -ErrorAction SilentlyContinue;
    if ($process) { Stop-Process -Id $processId -Force -ErrorAction Stop }
  }; Stop-Tree ${child.pid}`;
  const result = spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], {
    encoding: 'utf8', windowsHide: true, timeout: 15_000,
  });
  return result.status === 0 ? null : result.error?.message || result.stderr || 'Process-tree termination failed.';
}

export function runCheck(command, timeoutSeconds, signal) {
  return new Promise(resolve => {
    if (signal?.aborted) return resolve({ check: command.name, exitCode: null, stdout: '', stderr: '', error: 'Validation cancelled before execution.' });
    const child = spawn(command.executable, command.args, {
      cwd: command.cwd, windowsHide: true, detached: process.platform !== 'win32',
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, CI: 'true', GIT_TERMINAL_PROMPT: '0' },
    });
    const stdout = [], stderr = [];
    let bytes = 0, failure = null, stopping = false, settled = false, fallback;
    const startedAt = new Date().toISOString();
    function finish(code, childSignal) {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      clearTimeout(fallback);
      signal?.removeEventListener('abort', cancel);
      resolve({ check: command.name, command, startedAt, finishedAt: new Date().toISOString(),
        exitCode: code, stdout: Buffer.concat(stdout).toString('utf8'), stderr: Buffer.concat(stderr).toString('utf8'),
        error: failure || (childSignal ? `Terminated by ${childSignal}` : null) });
    }
    function stop(reason) {
      if (stopping || settled) return;
      stopping = true;
      failure = reason;
      const error = stopTree(child);
      if (error) failure += ` Process cleanup incomplete: ${error}`;
      fallback = setTimeout(() => {
        failure += ' Process/pipe closure could not be confirmed; inspect descendants before further work.';
        child.stdout.destroy();
        child.stderr.destroy();
        child.unref();
        finish(null);
      }, 5000);
    }
    const cancel = () => stop('Validation cancelled by the user.');
    const timer = setTimeout(() => stop(`Check timed out after ${timeoutSeconds} seconds.`), timeoutSeconds * 1000);
    signal?.addEventListener('abort', cancel, { once: true });
    function capture(target, chunk) {
      bytes += chunk.length;
      if (bytes <= 8 * 1024 * 1024) target.push(chunk);
      else stop('Combined check output exceeds 8 MiB; captured output is partial.');
    }
    child.stdout.on('data', chunk => capture(stdout, chunk));
    child.stderr.on('data', chunk => capture(stderr, chunk));
    child.once('error', error => { failure = error.message; finish(null); });
    child.once('close', finish);
  });
}

export async function runChecks(plan, signal) {
  const results = [];
  for (const command of plan.commands) {
    if (results.some(result => result.exitCode !== 0 || result.error)) {
      results.push({ check: command.name, exitCode: null, stdout: '', stderr: '', error: 'Not run after an earlier failed/cancelled check.' });
    } else results.push(await runCheck(command, plan.timeoutSeconds, signal));
  }
  return results;
}
