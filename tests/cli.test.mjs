import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { parseArguments, defaultDataFolder } from '../src/dashboard/server.mjs';
import { openStore } from '../src/dashboard/store.mjs';

test('CLI arguments accept --open and reject malformed or unknown options', () => {
  assert.deepEqual(parseArguments(['--root', 'C:\\repos', '--open', '--port', '5000'], { root: 'x', port: 4317 }),
    { root: 'C:\\repos', port: 5000, data: null, open: true });
  assert.equal(parseArguments([], { root: 'x', port: 4317 }).open, false);
  for (const bad of [['--root'], ['--root', '--open'], ['--unknown', 'x'], ['--port', '0'], ['--port', '70000'], ['root', 'x']]) {
    assert.throws(() => parseArguments(bad, { root: 'x', port: 4317 }), /Use --root|Port must/, bad.join(' '));
  }
});

test('without --data each scan root gets its own private data folder; the original default stays with its root', t => {
  const home = fs.mkdtempSync(path.join(fs.realpathSync.native(os.tmpdir()), 'recovery-home-'));
  t.after(() => fs.rmSync(home, { recursive: true, force: true }));
  const first = path.join(home, 'repos-a');
  const second = path.join(home, 'repos-b');
  fs.mkdirSync(first);
  fs.mkdirSync(second);
  const legacy = path.join(home, '.moorkyz-recovery', 'dashboard');
  assert.equal(defaultDataFolder(first, home), legacy, 'first use keeps the documented default');
  fs.mkdirSync(legacy, { recursive: true });
  const store = openStore(legacy, fs.realpathSync(first));
  store.save({ root: fs.realpathSync(first), scannedAt: new Date().toISOString(), skipped: [], repositories: [] });
  store.close();
  assert.equal(defaultDataFolder(first, home), legacy);
  const other = defaultDataFolder(second, home);
  assert.match(other, /[\\/]\.moorkyz-recovery[\\/]workspaces[\\/][0-9a-f]{16}$/);
  assert.equal(defaultDataFolder(second, home), other, 'stable per root');
});
