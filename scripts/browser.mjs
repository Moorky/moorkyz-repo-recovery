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

const withTimeout = (promise, ms, label) => {
  let timer;
  return Promise.race([promise, new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(`Timed out: ${label}`)), ms); })])
    .finally(() => clearTimeout(timer));
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

export async function launchBrowser(options = {}) {
  const session = { child: null, profile: null };
  try {
    return await startBrowser(options, session);
  } catch (error) {
    // Never leave a half-started browser running: it would keep the calling process alive.
    if (session.child) killTree(session.child);
    if (session.profile) fs.rmSync(session.profile, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
    throw error;
  }
}

function killTree(child) {
  if (child.exitCode !== null || child.signalCode !== null) return;
  if (process.platform === 'win32') spawnSync('taskkill', ['/pid', String(child.pid), '/T', '/F'], { windowsHide: true });
  else child.kill('SIGKILL');
}

async function startBrowser({ executable = findBrowser(), width = 1280, height = 900 }, session) {
  if (!executable) throw new Error('No Chromium-based browser found. Set RECOVERY_BROWSER to its executable.');
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'recovery-browser-'));
  session.profile = profile;
  const child = spawn(executable, [
    '--headless=new', '--remote-debugging-port=0', `--user-data-dir=${profile}`, '--no-first-run', '--no-default-browser-check',
    '--disable-extensions', '--disable-sync', '--disable-background-networking', `--window-size=${width},${height}`,
    // Hosted Linux CI images may block Chromium's user-namespace sandbox; only the local test page is loaded.
    ...(process.platform === 'linux' && process.env.CI ? ['--no-sandbox'] : []), 'about:blank',
  ], { stdio: 'ignore' });
  session.child = child;
  const portFile = path.join(profile, 'DevToolsActivePort');
  const deadline = Date.now() + 30_000;
  while (!fs.existsSync(portFile) || !fs.readFileSync(portFile, 'utf8').includes('\n')) {
    if (Date.now() > deadline || child.exitCode !== null) throw new Error(`Browser did not start (${executable}).`);
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  const port = fs.readFileSync(portFile, 'utf8').split('\n')[0].trim();
  let target;
  for (let attempt = 0; attempt < 50 && !target; attempt++) {
    target = (await withTimeout(fetch(`http://127.0.0.1:${port}/json/list`).then(response => response.json()), 5_000, 'DevTools target list'))
      .find(item => item.type === 'page');
    if (!target) await new Promise(resolve => setTimeout(resolve, 100));
  }
  if (!target) throw new Error('Browser exposed no page target.');
  const socket = new WebSocket(target.webSocketDebuggerUrl);
  await withTimeout(new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = () => reject(new Error('DevTools connection failed.')); }),
    15_000, 'DevTools connection');
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
  const send = (method, params = {}) => withTimeout(new Promise((resolve, reject) => {
    const messageId = ++id;
    pending.set(messageId, { resolve, reject });
    socket.send(JSON.stringify({ id: messageId, method, params }));
  }), 30_000, `DevTools ${method}`);
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
    // Real pointer input: scroll the element into view, then press and release the mouse at its centre.
    async click(expression) {
      const box = await evaluate(`(() => { const el = ${expression}; if (!el) return null; el.scrollIntoView({ block: 'center', behavior: 'instant' });
        const r = el.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2, disabled: Boolean(el.disabled) }; })()`);
      if (!box) throw new Error(`Nothing to click: ${expression}`);
      if (box.disabled) throw new Error(`Element is disabled: ${expression}`);
      await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: box.x, y: box.y });
      await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: box.x, y: box.y, button: 'left', clickCount: 1 });
      await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: box.x, y: box.y, button: 'left', clickCount: 1 });
    },
    // Real keyboard text input into a focused field, replacing its current value.
    async type(expression, text) {
      await this.click(expression);
      await evaluate(`(${expression}).select()`);
      await send('Input.insertText', { text });
    },
    async screenshot(file, clip) {
      const { data } = await send('Page.captureScreenshot', { format: 'png', ...(clip ? { clip: { ...clip, scale: 1 } } : {}), captureBeyondViewport: Boolean(clip) });
      fs.writeFileSync(file, Buffer.from(data, 'base64'));
    },
    async close() {
      try { socket.close(); } catch { /* already closed */ }
      // Chromium starts helper processes; end the whole tree so nothing keeps the test process alive.
      killTree(child);
      await withTimeout(new Promise(resolve => (child.exitCode !== null || child.signalCode !== null ? resolve() : child.once('exit', resolve))), 10_000, 'browser exit')
        .catch(() => {});
      for (let attempt = 0; attempt < 20; attempt++) {
        try { fs.rmSync(profile, { recursive: true, force: true }); break; }
        catch { await new Promise(resolve => setTimeout(resolve, 200)); }
      }
    },
  };
}
