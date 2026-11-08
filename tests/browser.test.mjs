import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { snapshot } from '../src/dashboard/engine.mjs';
import { startDashboard } from '../src/dashboard/server.mjs';
import { createDemoPortfolio } from '../scripts/demo.mjs';
import { findBrowser, launchBrowser } from '../scripts/browser.mjs';

const browserPath = findBrowser();
const js = value => JSON.stringify(value);

test('browser: one-click scan, candidate choice and the complete guided recovery in Simple mode', { skip: browserPath ? false : 'No Chromium-based browser installed (set RECOVERY_BROWSER).', timeout: 240_000 }, async t => {
  const base = fs.mkdtempSync(path.join(fs.realpathSync.native(os.tmpdir()), 'recovery-browser-e2e-'));
  let app;
  let browser;
  t.after(async () => {
    await browser?.close();
    await app?.close();
    fs.rmSync(base, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
  });
  const demo = createDemoPortfolio(path.join(base, 'demo'));
  const source = path.join(demo.root, 'lost-commits');
  const original = snapshot(source).fingerprint;
  app = await startDashboard({ root: demo.root, data: path.join(base, 'data'), port: 0 });
  browser = await launchBrowser({ executable: browserPath });
  const { evaluate, waitFor } = browser;
  const card = name => `[...document.querySelectorAll('article.project-card')].find(item => item.querySelector('h3').textContent === ${js(name)})`;
  // All interaction uses real browser mouse and keyboard input, not element.click() or synthetic events.
  const buttonIn = (scope, text) => `[...(${scope}).querySelectorAll('button')].find(item => item.textContent.trim().startsWith(${js(text)}) && !item.disabled)`;
  const click = async (scope, text) => {
    const available = await evaluate(`Boolean(${buttonIn(scope, text)})`);
    assert.ok(available, `button "${text}" is available in: ${await evaluate(`[...(${scope}).querySelectorAll('button')].map(item => item.textContent.trim() + (item.disabled ? ' [disabled]' : '')).join(' | ')`)}`);
    await browser.click(buttonIn(scope, text));
  };
  const panel = "document.querySelector('#guided-recovery .guided-panel')";
  const heading = title => `${panel}?.querySelector('h3')?.textContent === ${js(title)} && !/Running:/.test(${panel}.textContent)`;
  const fill = (id, value) => browser.type(`document.getElementById(${js(id)})`, value);
  const tick = id => browser.click(`document.getElementById(${js(id)})`);

  await browser.viewport(1280, 900);
  await browser.navigate(app.origin);
  await waitFor(`document.querySelectorAll('article.project-card').length === 6`, { label: 'project cards' });
  assert.equal(await evaluate('document.body.dataset.mode'), 'simple', 'first visit opens Simple mode');
  assert.equal(await evaluate(`getComputedStyle(document.querySelector('.sidebar')).display`), 'none');
  assert.equal(await evaluate(`document.getElementById('scan-repositories').textContent`), 'Scan repositories');

  await browser.click(`document.getElementById('scan-repositories')`);
  await waitFor(`/Scan finished/.test(document.getElementById('scan-status').textContent)`, { label: 'scan finished', timeout: 60_000 });
  assert.match(await evaluate(`document.getElementById('scan-status').textContent`), /6 projects scanned\. No files were changed\./);
  assert.equal(await evaluate(`${card('lost-commits')}.querySelector('.status-badge').textContent`), 'Recovery candidates found');
  assert.equal(await evaluate(`${card('corrupted-objects')}.querySelector('.status-badge').textContent`), 'Blocked: Git problems found');
  assert.doesNotMatch(await evaluate(`document.getElementById('project-list').textContent`), /\d+(\.\d+)?%/, 'no percentages in Simple mode');

  await browser.click(`${card('lost-commits')}.querySelector('details > summary')`);
  await click(card('lost-commits'), 'Choose this candidate');
  await waitFor(`/Chosen for guided recovery/.test(${card('lost-commits')}.textContent)`, { label: 'candidate chosen' });
  await click(card('lost-commits'), 'Open guided recovery');
  await waitFor(`document.getElementById('case-dialog').open && ${heading('Protect two copies')}`, { label: 'guided recovery opens at protect' });

  await fill('guided-backup', path.join(base, 'backup'));
  await fill('guided-working', path.join(base, 'working'));
  await click(panel, 'Preview copies');
  await waitFor(`document.getElementById('guided-approve-copies')`, { label: 'copy preview' });
  await click(panel, 'Create and verify copies');
  await waitFor(`/Tick the approval box/.test(${panel}.textContent)`, { label: 'approval required' });
  assert.equal(fs.existsSync(path.join(base, 'backup')), false, 'nothing is created without approval');
  await tick('guided-approve-copies');
  await click(panel, 'Create and verify copies');
  await waitFor(heading('Check Git integrity'), { label: 'advance to integrity', timeout: 60_000 });
  await click(panel, 'Check Git integrity');
  await waitFor(heading('Compare and restore files'), { label: 'advance to restore', timeout: 60_000 });
  await click(panel, 'Compare with working copy');
  await waitFor(`[...${panel}.querySelectorAll('button')].some(item => item.textContent === 'Preview restore')`, { label: 'comparison' });
  assert.match(await evaluate(`${panel}.textContent`), /1 missing, 0 changed/);
  await click(panel, 'Preview restore');
  await waitFor(`document.getElementById('guided-approve-restore')`, { label: 'restore preview' });
  assert.match(await evaluate(`${panel}.querySelector('pre').textContent`), /quantity \* 21/);
  await tick('guided-approve-restore');
  await click(panel, 'Restore into working copy');
  await waitFor(heading('Check Git integrity'), { label: 'integrity again after restore', timeout: 60_000 });
  await click(panel, 'Check Git integrity');
  await waitFor(heading('Run approved checks'), { label: 'advance to checks', timeout: 60_000 });
  await click(panel, 'Preview checks');
  await waitFor(`document.getElementById('guided-approve-checks')`, { label: 'checks preview' });
  assert.match(await evaluate(`${panel}.textContent`), /Not sandboxed/);
  assert.match(await evaluate(`${panel}.textContent`), /runs: node test\.mjs/);
  await tick('guided-approve-checks');
  await click(panel, 'Run checks');
  await waitFor(heading('Validate and export'), { label: 'advance to validate', timeout: 90_000 });
  await click(panel, 'Validate and recheck');
  await waitFor(heading('Hand off'), { label: 'advance to hand off', timeout: 60_000 });
  await fill('guided-final', 'Feature restored and tested in the working copy; the owner copies it into the original manually.');
  await click(panel, 'Save and mark handed off');
  await waitFor(`/Handed off/.test(${panel}.textContent)`, { label: 'handed off' });
  assert.equal(await evaluate(`[...document.querySelectorAll('.guided-step.done')].length`), 8);

  await browser.key('Escape');
  await waitFor(`!document.getElementById('case-dialog').open`, { label: 'Escape closes the dialog' });
  await waitFor(`document.activeElement?.dataset.caseOpen === ${card('lost-commits')}.querySelector('[data-case-open]').dataset.caseOpen`, { label: 'focus returns to the card', timeout: 5000 });
  await browser.click(`document.getElementById('mode-toggle')`);
  assert.equal(await evaluate(`document.getElementById('mode-toggle').getAttribute('aria-pressed')`), 'true');
  assert.notEqual(await evaluate(`getComputedStyle(document.querySelector('.sidebar')).display`), 'none', 'Advanced mode restores the full workbench');
  assert.notEqual(await evaluate(`getComputedStyle(document.getElementById('workspace-sections')).display`), 'none');
  await browser.click(`document.getElementById('mode-toggle')`);

  for (const width of [390, 320]) {
    await browser.viewport(width, 800);
    assert.ok(await evaluate('document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1'), `no horizontal overflow at ${width}px`);
  }
  assert.deepEqual(browser.errors, [], 'no uncaught page errors');
  assert.equal(snapshot(source).fingerprint, original, 'original unchanged after the browser workflow');
  assert.ok(fs.existsSync(path.join(base, 'working', 'src', 'feature.mjs')));
  assert.equal(fs.existsSync(path.join(source, 'src', 'feature.mjs')), false);
});
