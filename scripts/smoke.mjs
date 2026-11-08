import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createDemoPortfolio } from './demo.mjs';
import { snapshot } from '../src/dashboard/engine.mjs';

// Fresh-checkout smoke test: build the synthetic demo, start the dashboard exactly as a user would
// (CLI entry point, new data folder), run one scan, check results and prove no original changed.

const server = fileURLToPath(new URL('../src/dashboard/server.mjs', import.meta.url));
const failures = [];
const check = (ok, message) => {
  console.log(`${ok ? 'PASS' : 'FAIL'}: ${message}`);
  if (!ok) failures.push(message);
};

async function freePort() {
  const probe = net.createServer();
  await new Promise(resolve => probe.listen(0, '127.0.0.1', resolve));
  const { port } = probe.address();
  await new Promise(resolve => probe.close(resolve));
  return port;
}

const base = fs.mkdtempSync(path.join(os.tmpdir(), 'recovery-smoke-'));
let child;
try {
  const demo = createDemoPortfolio(path.join(base, 'demo'));
  const projects = fs.readdirSync(demo.root).filter(name => name !== 'empty-folder');
  const before = Object.fromEntries(projects.map(name => [name, snapshot(path.join(demo.root, name)).fingerprint]));
  const port = await freePort();
  child = spawn(process.execPath, [server, '--root', demo.root, '--data', path.join(base, 'data'), '--port', String(port)], { stdio: ['ignore', 'pipe', 'pipe'] });
  let output = '';
  child.stdout.on('data', chunk => { output += chunk; });
  child.stderr.on('data', chunk => { output += chunk; });
  const deadline = Date.now() + 30_000;
  while (!output.includes('Recovery dashboard:') && child.exitCode === null && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 50));
  check(output.includes(`Recovery dashboard: http://127.0.0.1:${port}`), 'dashboard starts from the CLI with a new data folder');
  const origin = `http://127.0.0.1:${port}`;
  const page = await (await fetch(origin)).text();
  check(/Scan repositories/.test(page) && /Advanced mode/.test(page), 'home page offers Scan repositories and Advanced mode');
  const { token } = await (await fetch(`${origin}/api/session`)).json();
  const api = async (route, input) => (await fetch(origin + route, {
    method: input ? 'POST' : 'GET', headers: { 'X-Recovery-Token': token, 'Content-Type': 'application/json' }, body: input && JSON.stringify(input),
  })).json();
  check((await fetch(`${origin}/api/state`)).status === 403, 'API refuses requests without the session token');
  await api('/api/scan', {});
  let state;
  const scanDeadline = Date.now() + 120_000;
  do {
    await new Promise(resolve => setTimeout(resolve, 100));
    state = await api('/api/state');
  } while (state.job?.status === 'running' && Date.now() < scanDeadline);
  check(state.job?.status === 'completed' && state.job.progress.done === projects.length, `one scan covers all ${projects.length} demo projects`);
  const status = Object.fromEntries(state.repositories.map(repo => [repo.name, repo.scan.status]));
  const expected = { 'lost-commits': 'candidates-found', 'deleted-branch': 'candidates-found', 'corrupted-objects': 'blocked',
    'clean-project': 'no-candidates', 'overwritten-files': 'no-candidates', 'notes-without-git': 'needs-review' };
  for (const [name, value] of Object.entries(expected)) check(status[name] === value, `${name}: ${value}`);
  const lost = state.repositories.find(repo => repo.name === 'lost-commits');
  check(lost?.scan.candidates.candidates[0]?.commit === demo.expected['lost-commits'].lostCommit, 'lost commit is the first candidate');
  const report = await (await fetch(`${origin}/api/report.md?repository=${lost.id}`, { headers: { 'X-Recovery-Token': token } })).text();
  check(/## Remaining limitations/.test(report), 'case report exports with limitations');
  for (const name of projects) check(snapshot(path.join(demo.root, name)).fingerprint === before[name], `original ${name} is byte-identical after scanning`);
} catch (error) {
  check(false, `smoke run error: ${error.message}`);
} finally {
  if (child && child.exitCode === null) {
    await new Promise(resolve => { child.once('exit', resolve); child.kill(); });
  }
  fs.rmSync(base, { recursive: true, force: true });
}
console.log(failures.length ? `SMOKE FAILED: ${failures.length} check(s).` : 'SMOKE PASSED.');
process.exitCode = failures.length ? 1 : 0;
