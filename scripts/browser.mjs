import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';

// Minimal Chrome DevTools Protocol driver for an already installed Chromium-based browser.
// Used by the browser end-to-end test and the screenshot script; adds no npm dependency.

const candidates = {
  win32: [
    path.join(process.env['ProgramFiles(x86)'] ?? 'C:\\Program Files (x86)', 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
    path.join(process.env.ProgramFiles ?? 'C:\\Program Files', 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
    path.join(process.env.ProgramFiles ?? 'C:\\Program Files', 'Google', 'Chrome', 'Application', 'chrome.exe'),
    path.join(process.env.LOCALAPPDATA ?? '', 'Google', 'Chrome', 'Application', 'chrome.exe'),
  ],
  darwin: ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge', '/Applications/Chromium.app/Contents/MacOS/Chromium'],
  linux: ['google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser', 'microsoft-edge'],
};

export function findBrowser() {
  if (process.env.RECOVERY_BROWSER) return fs.existsSync(process.env.RECOVERY_BROWSER) ? process.env.RECOVERY_BROWSER : null;
  for (const candidate of candidates[process.platform] ?? candidates.linux) {
    if (path.isAbsolute(candidate)) {
      if (fs.existsSync(candidate)) return candidate;
    } else {
      const found = spawnSync('which', [candidate], { encoding: 'utf8' });
      if (found.status === 0 && found.stdout.trim()) return found.stdout.trim();
    }
  }
  return null;
}

export async function launchBrowser({ executable = findBrowser(), width = 1280, height = 900 } = {}) {
  if (!executable) throw new Error('No Chromium-based browser found. Set RECOVERY_BROWSER to its executable.');
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'recovery-browser-'));
  const child = spawn(executable, [
    '--headless=new', '--remote-debugging-port=0', `--user-data-dir=${profile}`, '--no-first-run', '--no-default-browser-check',
    '--disable-extensions', '--disable-sync', '--disable-background-networking', `--window-size=${width},${height}`,
    // Hosted Linux CI images may block Chromium's user-namespace sandbox; only the local test page is loaded.
    ...(process.platform === 'linux' && process.env.CI ? ['--no-sandbox'] : []), 'about:blank',
  ], { stdio: 'ignore' });
  const portFile = path.join(profile, 'DevToolsActivePort');
  const deadline = Date.now() + 30_000;
  while (!fs.existsSync(portFile) || !fs.readFileSync(portFile, 'utf8').includes('\n')) {
    if (Date.now() > deadline || child.exitCode !== null) throw new Error(`Browser did not start (${executable}).`);
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  const port = fs.readFileSync(portFile, 'utf8').split('\n')[0].trim();
  let target;
  for (let attempt = 0; attempt < 50 && !target; attempt++) {
    target = (await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()).find(item => item.type === 'page');
    if (!target) await new Promise(resolve => setTimeout(resolve, 100));
  }
  const socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = () => reject(new Error('DevTools connection failed.')); });
  let id = 0;
  const pending = new Map();
  const errors = [];
  socket.onmessage = event => {
    const message = JSON.parse(event.data);
    if (message.id && pending.has(message.id)) {
      const { resolve, reject } = pending.get(message.id);
      pending.delete(message.id);
      if (message.error) reject(new Error(message.error.message));
      else resolve(message.result);
    } else if (message.method === 'Runtime.exceptionThrown') errors.push(message.params.exceptionDetails.exception?.description ?? message.params.exceptionDetails.text);
  };
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const messageId = ++id;
    pending.set(messageId, { resolve, reject });
    socket.send(JSON.stringify({ id: messageId, method, params }));
  });
  await send('Runtime.enable');
  await send('Page.enable');

  async function evaluate(expression) {
    const result = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true, userGesture: true });
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description ?? result.exceptionDetails.text);
    return result.result.value;
  }
  async function waitFor(expression, { timeout = 30_000, label = expression } = {}) {
    const end = Date.now() + timeout;
    while (Date.now() < end) {
      if (await evaluate(`Boolean(${expression})`)) return;
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    throw new Error(`Timed out waiting for ${label}`);
  }
  return {
    errors, send, evaluate, waitFor,
    async viewport(nextWidth, nextHeight) {
      await send('Emulation.setDeviceMetricsOverride', { width: nextWidth, height: nextHeight, deviceScaleFactor: 1, mobile: nextWidth < 600 });
    },
    async navigate(url) {
      await send('Page.navigate', { url });
      await waitFor('document.readyState === "complete"', { label: 'page load' });
    },
    async key(key) {
      const code = key === 'Escape' ? 'Escape' : key;
      for (const type of ['keyDown', 'keyUp']) await send('Input.dispatchKeyEvent', { type, key, code, windowsVirtualKeyCode: key === 'Escape' ? 27 : 0 });
    },
    async screenshot(file, clip) {
      const { data } = await send('Page.captureScreenshot', { format: 'png', ...(clip ? { clip: { ...clip, scale: 1 } } : {}), captureBeyondViewport: Boolean(clip) });
      fs.writeFileSync(file, Buffer.from(data, 'base64'));
    },
    async close() {
      try { socket.close(); } catch { /* already closed */ }
      child.kill();
      await new Promise(resolve => (child.exitCode !== null ? resolve() : child.once('exit', resolve)));
      for (let attempt = 0; attempt < 20; attempt++) {
        try { fs.rmSync(profile, { recursive: true, force: true }); break; }
        catch { await new Promise(resolve => setTimeout(resolve, 200)); }
      }
    },
  };
}
