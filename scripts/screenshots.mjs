import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createDemoPortfolio } from './demo.mjs';
import { startDashboard } from '../src/dashboard/server.mjs';
import { launchBrowser } from './browser.mjs';

// Captures documentation screenshots from the real UI running on the synthetic demo portfolio.
// Choose a neutral work folder (for example C:\demo) so no personal path appears in the images.

const js = value => JSON.stringify(value);

export async function captureScreenshots(work, output) {
  const demo = createDemoPortfolio(work);
  fs.mkdirSync(output, { recursive: true });
  const app = await startDashboard({ root: demo.root, data: path.join(work, 'dashboard-data'), port: 0 });
  const browser = await launchBrowser();
  const shots = [];
  try {
    const { evaluate, waitFor } = browser;
    const card = name => `[...document.querySelectorAll('article.project-card')].find(item => item.querySelector('h3').textContent === ${js(name)})`;
    const panel = "document.querySelector('#guided-recovery .guided-panel')";
    const click = (scope, text) => evaluate(`[...(${scope}).querySelectorAll('button')].find(item => item.textContent.trim().startsWith(${js(text)}) && !item.disabled).click()`);
    const idle = title => waitFor(`${panel}?.querySelector('h3')?.textContent === ${js(title)} && !/Running:/.test(${panel}.textContent)`, { timeout: 90_000, label: title });
    const shoot = async (name, selector) => {
      const file = path.join(output, name);
      if (selector) {
        const box = await evaluate(`(() => { const r = document.querySelector(${js(selector)}).getBoundingClientRect(); return { x: r.x + scrollX, y: r.y + scrollY, width: r.width, height: r.height }; })()`);
        await browser.screenshot(file, box);
      } else await browser.screenshot(file);
      shots.push(file);
    };
    await browser.viewport(1280, 900);
    await browser.navigate(app.origin);
    await waitFor(`document.querySelectorAll('article.project-card').length === 6`);
    await evaluate(`document.getElementById('scan-repositories').click()`);
    await waitFor(`/Scan finished/.test(document.getElementById('scan-status').textContent)`, { timeout: 120_000 });
    await shoot('simple-mode-scan-results.png');
    await evaluate(`(() => { const item = ${card('lost-commits')}; item.querySelector('details').open = true; item.id = 'shot-card'; })()`);
    await shoot('candidate-details.png', '#shot-card');
    await click(card('lost-commits'), 'Choose this candidate');
    await waitFor(`/Chosen for guided recovery/.test(${card('lost-commits')}.textContent)`);
    await click(card('lost-commits'), 'Open guided recovery');
    await idle('Protect two copies');
    await click(panel, 'Preview copies');
    await waitFor(`document.getElementById('guided-approve-copies')`);
    await shoot('guided-recovery-protect.png', '#case-dialog');
    await evaluate(`document.getElementById('guided-approve-copies').click()`);
    await click(panel, 'Create and verify copies');
    await idle('Check Git integrity');
    await click(panel, 'Check Git integrity');
    await idle('Compare and restore files');
    await click(panel, 'Compare with working copy');
    await waitFor(`[...${panel}.querySelectorAll('button')].some(item => item.textContent === 'Preview restore')`);
    await click(panel, 'Preview restore');
    await waitFor(`document.getElementById('guided-approve-restore')`);
    await shoot('guided-recovery-restore-preview.png', '#case-dialog');
    await evaluate(`document.getElementById('guided-approve-restore').click()`);
    await click(panel, 'Restore into working copy');
    await idle('Check Git integrity');
    await click(panel, 'Check Git integrity');
    await idle('Run approved checks');
    await click(panel, 'Preview checks');
    await waitFor(`document.getElementById('guided-approve-checks')`);
    await shoot('guided-recovery-checks-approval.png', '#case-dialog');
    await browser.key('Escape');
    await waitFor(`!document.getElementById('case-dialog').open`);
    await evaluate(`document.getElementById('mode-toggle').click()`);
    await new Promise(resolve => setTimeout(resolve, 400));
    await evaluate('scrollTo(0, 0)');
    await waitFor('scrollY === 0');
    await shoot('advanced-mode.png');
    await evaluate(`document.getElementById('mode-toggle').click(); scrollTo(0, 0)`);
    await browser.viewport(390, 844);
    await shoot('simple-mode-mobile.png');
    if (browser.errors.length) throw new Error(`Page errors: ${browser.errors.join('; ')}`);
  } finally {
    await browser.close();
    await app.close();
  }
  return shots;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [work, output = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'docs', 'assets')] = process.argv.slice(2);
  if (!work) {
    console.error('Usage: node scripts/screenshots.mjs <new-neutral-work-folder, e.g. C:\\demo> [output-folder]');
    process.exitCode = 1;
  } else {
    captureScreenshots(path.resolve(work), path.resolve(output))
      .then(shots => { for (const shot of shots) console.log(`Saved ${shot}`); console.log(`Delete ${work} when finished.`); })
      .catch(error => { console.error(`Screenshot error: ${error.message}`); process.exitCode = 1; });
  }
}
