import { caseStatus, summaryCounts, scanProgress, candidateView, suggestedCopies, guidedSteps, modeKey, validMode } from './simple-model.mjs';

const $ = id => document.getElementById(id);
function node(tag, text, className) {
  const el = document.createElement(tag);
  if (text !== undefined && text !== null) el.textContent = text;
  if (className) el.className = className;
  return el;
}
function button(text, className, onClick) {
  const el = node('button', text, className);
  el.type = 'button';
  el.addEventListener('click', onClick);
  return el;
}
const time = value => (value ? new Date(value).toLocaleString() : 'unknown time');
const bytes = value => (value >= 1024 ** 3 ? `${(value / 1024 ** 3).toFixed(2)} GiB` : value >= 1024 ** 2 ? `${(value / 1024 ** 2).toFixed(1)} MiB` : `${Math.ceil(value / 1024)} KiB`);
const recordKeys = { inspect: 'inspection', 'acquire-apply': 'preservation', recover: 'recovery' };

let ctx;
let mode = 'simple';
let listSignature = '';
let guidedSignature = '';
const openDetails = new Set();
const drafts = new Map();
const local = new Map(); // per-case previews and step selection, never persisted
const caseLocal = id => {
  if (!local.has(id)) local.set(id, { step: null, acquire: null, compare: null, restore: null, checks: null, result: null, message: null });
  return local.get(id);
};

function setMode(next, announce = true) {
  mode = validMode(next);
  document.body.dataset.mode = mode;
  const toggle = $('mode-toggle');
  toggle.setAttribute('aria-pressed', String(mode === 'advanced'));
  toggle.textContent = mode === 'advanced' ? 'Advanced mode: on' : 'Advanced mode: off';
  try { localStorage.setItem(modeKey, mode); } catch { /* preference only */ }
  if (announce) ctx.announce(mode === 'advanced'
    ? 'Advanced mode: all manual procedures, tables, estimates and diagnostics are visible. No approvals carry over.'
    : 'Simple mode: scan, review findings and follow guided recovery. Advanced tools stay one click away.');
}

export function initializeSimple(context) {
  ctx = context;
  let saved = 'simple';
  try { saved = localStorage.getItem(modeKey) ?? 'simple'; } catch { /* default */ }
  setMode(saved, false);
  $('mode-toggle').addEventListener('click', () => setMode(mode === 'advanced' ? 'simple' : 'advanced'));
  $('scan-repositories').addEventListener('click', startScan);
  $('cancel-scan').addEventListener('click', async () => {
    try { ctx.announce((await ctx.api('/api/cancel', {})).message); await ctx.refresh(); }
    catch (error) { ctx.announce(error.message, true); }
  });
  $('toggle-case-advanced').addEventListener('click', () => {
    const open = !$('case-dialog').classList.contains('show-advanced');
    $('case-dialog').classList.toggle('show-advanced', open);
    $('toggle-case-advanced').setAttribute('aria-expanded', String(open));
    $('toggle-case-advanced').textContent = open ? 'Hide advanced tools' : 'Show advanced tools';
  });
  $('guided-recovery').addEventListener('input', event => {
    if (event.target.id) drafts.set(event.target.id, event.target.type === 'checkbox' ? event.target.checked : event.target.value);
  });
  // Some embedded browsers deliver Escape without firing the native dialog cancel event.
  document.addEventListener('keydown', event => {
    if (event.key !== 'Escape' || event.defaultPrevented) return;
    const open = [...document.querySelectorAll('dialog[open]')];
    const target = open.find(dialog => dialog.contains(document.activeElement)) ?? open.at(-1);
    if (target) {
      event.preventDefault();
      target.close();
    }
  });
}

async function startScan() {
  try {
    await ctx.api('/api/scan', {});
    ctx.announce('Scanning. The scan reads Git metadata only; no files are changed and no project code runs.');
    await ctx.refresh();
    await ctx.watchJob();
    const progress = scanProgress(ctx.getState().job);
    if (progress) ctx.announce(progress.text, Boolean(progress.error));
  } catch (error) { ctx.announce(error.message, true); }
}

async function choose(repo, commit) {
  try {
    await ctx.api('/api/case', { repositoryId: repo.id, type: 'select-candidate', commit });
    await ctx.refresh();
    ctx.announce(commit ? `Candidate ${commit.slice(0, 10)} chosen for ${repo.name}. Next: protect two copies.` : 'Candidate choice cleared.');
  } catch (error) { ctx.announce(error.message, true); }
}

function candidateList(repo, candidates, limit) {
  const list = node('ol', undefined, 'candidate-list');
  for (const candidate of candidates.slice(0, limit)) {
    const view = candidateView(candidate);
    const item = node('li', undefined, 'candidate');
    const selected = repo.selectedCandidate?.commit === candidate.commit;
    item.classList.toggle('selected', selected);
    const head = node('div', undefined, 'candidate-head');
    for (const kind of view.kinds) head.append(node('span', kind, 'kind'));
    head.append(node('code', view.short), node('strong', view.subject));
    item.append(head, node('p', `${view.when} · ${view.summary}`, 'muted'));
    if (view.paths.length) item.append(node('p', `Only here: ${view.paths.slice(0, 6).join(', ')}${view.paths.length > 6 ? ', …' : ''}`, 'paths'));
    const why = node('details');
    why.append(node('summary', 'Why is this listed?'));
    const reasons = node('ul');
    for (const text of [...view.factors, ...view.unknowns]) reasons.append(node('li', text));
    why.append(reasons);
    item.append(why);
    if (!repo.unavailable) {
      item.append(selected ? node('p', 'Chosen for guided recovery ✓', 'chosen')
        : button('Choose this candidate', 'secondary', () => choose(repo, candidate.commit)));
    }
    list.append(item);
  }
  return list;
}

function projectCard(repo, state) {
  const status = caseStatus(repo);
  const scan = repo.scan ?? {};
  const card = node('article', undefined, `project-card tone-${status.tone}`);
  card.dataset.status = status.key;
  const header = node('header');
  const title = node('div');
  title.append(node('h3', repo.name), node('code', repo.path, 'project-path'));
  header.append(title, node('span', status.label, 'status-badge'));
  card.append(header);
  card.append(node('p', scan.at ? `Scanned ${time(scan.at)}${scan.gatesUpdated === false ? ' · case gates kept (copies already verified)' : ''}` : 'Not scanned yet.', 'muted'));
  if (repo.interrupted) card.append(node('p', repo.interrupted.message, 'warning'));
  const top = (scan.findings ?? []).slice(0, 2);
  if (top.length) {
    const list = node('ul', undefined, 'finding-summary');
    for (const finding of top) list.append(node('li', finding.title, `severity-${finding.severity}`));
    card.append(list);
  }
  if (scan.nextAction && scan.status !== 'not-scanned') card.append(node('p', `Next: ${scan.nextAction}`, 'next-action'));
  const details = node('details', undefined, 'project-details');
  details.open = openDetails.has(repo.id);
  details.addEventListener('toggle', () => (details.open ? openDetails.add(repo.id) : openDetails.delete(repo.id)));
  details.append(node('summary', `Review findings${scan.candidates?.candidates?.length ? ` and ${scan.candidates.candidates.length} candidate${scan.candidates.candidates.length === 1 ? '' : 's'}` : ''}`));
  for (const finding of scan.findings ?? []) {
    const block = node('div', undefined, `finding severity-${finding.severity}`);
    block.append(node('strong', `${finding.severity === 'blocker' ? 'Blocker' : finding.severity === 'warning' ? 'Warning' : 'Info'}: ${finding.title}`),
      node('pre', finding.evidence), node('p', finding.nextAction));
    details.append(block);
  }
  if (scan.candidates?.candidates?.length) {
    details.append(node('h4', 'Recovery candidates (ordered by evidence, not by probability)'));
    details.append(candidateList(repo, scan.candidates.candidates, 8));
    if (scan.candidates.candidates.length > 8) details.append(node('p', `${scan.candidates.candidates.length - 8} more in the guided recovery panel.`, 'muted'));
  }
  if (scan.limitations?.length) {
    const limits = node('ul', undefined, 'limitations');
    for (const text of scan.limitations) limits.append(node('li', text));
    details.append(node('h4', 'What this scan cannot tell you'), limits);
  }
  card.append(details);
  if (!(scan.findings ?? []).length) details.hidden = true;
  const actions = node('div', undefined, 'card-actions');
  const open = button(repo.records?.preservation ? 'Continue guided recovery' : 'Open guided recovery', 'primary', () => ctx.openCase(repo));
  open.dataset.caseOpen = repo.id;
  open.disabled = Boolean(repo.unavailable) || (state.job?.status === 'running' && state.job.repositoryId !== repo.id);
  actions.append(open);
  card.append(actions);
  return card;
}

export function renderSimple(state) {
  if (!ctx) return;
  $('scan-root').textContent = state.root;
  const running = state.job?.status === 'running';
  const progress = scanProgress(state.job);
  $('scan-repositories').disabled = running;
  $('scan-repositories').textContent = running && state.job.action === 'scan' ? 'Scanning…' : 'Scan repositories';
  $('cancel-scan').hidden = !(running && state.job.action === 'scan');
  $('cancel-scan').disabled = Boolean(state.job?.cancelRequested);
  $('scan-progress').hidden = !progress?.running;
  if (progress) {
    $('scan-progress').max = progress.max;
    $('scan-progress').value = progress.value;
  }
  const lastScan = state.repositories.map(repo => repo.scan?.at).filter(Boolean).sort().at(-1);
  $('scan-status').textContent = progress?.text ?? (lastScan ? `Last scan: ${time(lastScan)}. Scan again any time; it never changes files.`
    : 'Not scanned yet. Nothing has been read except folder names.');
  $('scan-status').classList.toggle('error', Boolean(progress?.error));

  const signature = JSON.stringify([state.repositories.map(repo => [repo.id, repo.scan?.at, repo.scan?.status, caseStatus(repo).key,
    repo.selectedCandidate?.commit, repo.unavailable]), running, state.job?.repositoryId, state.skipped.length]);
  if (signature === listSignature) return;
  listSignature = signature;
  const counts = summaryCounts(state.repositories);
  $('scan-summary').replaceChildren(...counts.map(entry => node('span', `${entry.label}: ${entry.count}`, `summary-chip tone-${entry.tone}`)));
  if (state.skipped.length) $('scan-summary').append(node('span', `Skipped folders (no project marker, or a link): ${state.skipped.length}`, 'summary-chip tone-neutral'));
  const order = ['interrupted', 'blocked', 'candidates-found', 'needs-review', 'checks-failed', 'protected', 'files-restored', 'checks-passed', 'validated', 'not-scanned', 'no-candidates', 'completed', 'dismissed', 'unavailable'];
  const sorted = [...state.repositories].sort((a, b) => order.indexOf(caseStatus(a).key) - order.indexOf(caseStatus(b).key) || a.name.localeCompare(b.name));
  $('project-list').replaceChildren(...sorted.map(repo => projectCard(repo, state)));
  if (!state.repositories.length) {
    $('project-list').append(node('p', 'No projects found in this folder. Projects are folders that contain .git, package.json, pyproject.toml, Cargo.toml or PROJECT_MANIFEST.json, up to two levels deep. Restart with --root to choose another folder.', 'empty'));
  }
}

// ---------- Guided recovery (inside the case dialog) ----------

async function run(repo, action, input = {}) {
  await ctx.api('/api/task', { repositoryId: repo.id, action, ...input });
  await ctx.refresh();
  await ctx.watchJob();
  const job = ctx.getState().job;
  if (job.status !== 'completed') throw new Error(job.error || `${action} did not complete.`);
  return (await ctx.api(`/api/evidence/${repo.id}`))[recordKeys[action] ?? action];
}

function guard(repo, work, advance = false) {
  return async () => {
    const saved = caseLocal(repo.id);
    try {
      saved.message = null;
      // Stay on the step that started the action while it runs; gates may be invalidated at job start.
      saved.step = saved.lastActive ?? saved.step;
      await work(saved);
      if (advance) saved.step = null;
    } catch (error) {
      saved.message = { text: error.message, error: true };
      ctx.announce(error.message, true);
    }
    guidedSignature = '';
    renderGuided(ctx.selected());
  };
}

function field(labelText, id, value, attributes = {}) {
  const label = node('label', labelText);
  const input = node(attributes.multiline ? 'textarea' : 'input');
  input.id = id;
  input.value = drafts.has(id) ? drafts.get(id) : value;
  for (const [key, attribute] of Object.entries(attributes)) if (key !== 'multiline') input.setAttribute(key, attribute);
  label.append(input);
  return label;
}

function approval(id, text) {
  const label = node('label', undefined, 'checkbox approval');
  const input = node('input');
  input.type = 'checkbox';
  input.id = id;
  input.checked = drafts.get(id) === true;
  label.append(input, document.createTextNode(` ${text}`));
  return label;
}
const checked = id => $(id)?.checked === true;
const value = id => $(id)?.value.trim() ?? '';

function stepScan(repo, panel) {
  const scan = repo.scan ?? {};
  panel.append(node('p', scan.at ? `Scanned ${time(scan.at)}: ${scan.label}.` : 'This project has not been scanned yet.'));
  for (const finding of (scan.findings ?? []).slice(0, 4)) panel.append(node('p', `${finding.title}. ${finding.nextAction}`, `finding severity-${finding.severity}`));
  panel.append(button(scan.at ? 'Scan this project again' : 'Scan this project', 'secondary', guard(repo, async saved => {
    await run(repo, 'inspect');
    saved.message = { text: 'Scan finished. No files were changed.' };
  }, true)));
  if (repo.records?.preservation) panel.append(node('p', 'Note: scanning again resets the later steps of this case.', 'warning'));
}

function stepChoose(repo, panel, saved) {
  const candidates = repo.scan?.candidates?.candidates ?? [];
  panel.append(node('p', 'Pick the commit that contains the work you want back. The order follows the listed evidence; it is not a probability, and only you know which version you need.'));
  if (!candidates.length) {
    panel.append(node('p', 'No candidates were found locally. You can still protect copies; Advanced mode lets you compare any commit, tag or remote.', 'warning'));
  } else panel.append(candidateList(repo, candidates, 50));
  if (repo.selectedCandidate) panel.append(button('Clear choice', 'secondary', () => choose(repo, null)));
  panel.append(button('Continue to protecting copies', 'primary', () => { saved.step = 'protect'; guidedSignature = ''; renderGuided(repo); }));
}

function stepProtect(repo, panel, saved) {
  const preservation = repo.records?.preservation;
  if (preservation) {
    panel.append(node('p', `Copies verified ${time(preservation.at)}: every file (including .git) matches the original.`));
    panel.append(node('p', `Untouched backup: ${preservation.backup}`, 'mono'), node('p', `Working copy (all changes go here): ${preservation.workingCopy}`, 'mono'));
    return;
  }
  panel.append(node('p', 'Two new folders are created outside your projects: an untouched backup and a working copy. All recovery work happens only in the working copy. The original is never modified.'));
  const suggestion = suggestedCopies(ctx.getState().root, repo.name);
  panel.append(field('New backup folder (must not exist yet)', 'guided-backup', suggestion.backup, { autocomplete: 'off' }),
    field('New working-copy folder (must not exist yet)', 'guided-working', suggestion.workingCopy, { autocomplete: 'off' }));
  panel.append(button('Preview copies', 'secondary', guard(repo, async state => {
    const input = { backup: value('guided-backup'), workingCopy: value('guided-working') };
    state.acquire = { input, preview: await run(repo, 'acquire-preview', input) };
    drafts.delete('guided-approve-copies');
  })));
  const preview = saved.acquire?.preview;
  if (preview) {
    const box = node('div', undefined, 'preview');
    box.append(node('p', `${preview.files} files, ${bytes(preview.bytes)} in the original. Both copies need about ${bytes(preview.requiredCopyBytes)} of free space.`),
      node('p', `Backup: ${preview.backup}`, 'mono'), node('p', `Working copy: ${preview.workingCopy}`, 'mono'), node('p', preview.scope, 'muted'));
    box.append(approval('guided-approve-copies', 'I approve creating exactly these two new folders. Stop other programs from writing to this project first.'));
    box.append(button('Create and verify copies', 'primary', guard(repo, async state => {
      if (!checked('guided-approve-copies')) throw new Error('Tick the approval box to create the copies.');
      await run(repo, 'acquire-apply', { ...state.acquire.input, approved: true, planHash: state.acquire.preview.planHash });
      state.acquire = null;
      state.step = null;
      state.message = { text: 'Copies created and verified byte for byte. The original was not changed.' };
    }, true)));
    panel.append(box);
  }
}

function stepIntegrity(repo, panel) {
  const record = repo.records?.integrity;
  panel.append(node('p', 'Runs a full git fsck on the working copy (read-only). A failure is evidence to investigate, never a reason to reset.'));
  if (record) panel.append(node('p', record.passed ? `Passed ${time(record.at)}. ${record.note}` : `Failed ${time(record.at)}: ${record.failure || 'see Evidence in Advanced mode.'}`, record.passed ? 'ok' : 'warning'));
  panel.append(button(record ? 'Check again' : 'Check Git integrity', record?.passed ? 'secondary' : 'primary', guard(repo, async () => { await run(repo, 'integrity'); }, true)));
}

function stepRestore(repo, panel, saved) {
  const candidate = repo.selectedCandidate;
  for (const target of repo.recoveryTargets ?? []) panel.append(node('p', `Restored in working copy: ${target.file} (from ${target.sourceCommit.slice(0, 10)})`, 'ok'));
  if (!candidate) {
    panel.append(node('p', 'No candidate chosen. Choose one in step 2, or use Advanced mode to compare any commit. You can also skip to the checks.', 'warning'));
    panel.append(button('Skip to checks', 'secondary', () => { saved.step = 'checks'; guidedSignature = ''; renderGuided(repo); }));
    return;
  }
  panel.append(node('p', `Compare ${candidate.commit.slice(0, 10)} (${candidate.subject}) with the working copy, then restore selected files one at a time. Every restore is previewed first.`));
  panel.append(button('Compare with working copy', 'secondary', guard(repo, async state => {
    state.compare = await run(repo, 'compare', { ref: candidate.commit });
    state.restore = null;
  })));
  const compare = saved.compare;
  if (compare?.commit === candidate.commit) {
    const files = compare.files.filter(file => ['missing', 'changed'].includes(file.state));
    panel.append(node('p', `${compare.totals.missing} missing, ${compare.totals.changed} changed, ${compare.totals.identical} identical${compare.totals.unsupported ? `, ${compare.totals.unsupported} unsupported` : ''}. Extra files in the working copy are kept.`));
    const list = node('ul', undefined, 'file-list');
    for (const file of files.slice(0, 200)) {
      const item = node('li');
      item.append(node('span', file.state === 'missing' ? 'Missing' : 'Changed', `kind ${file.state}`), node('code', file.file),
        button('Preview restore', 'secondary', guard(repo, async state => {
          state.restore = await run(repo, 'restore-preview', { ref: candidate.commit, file: file.file });
          drafts.delete('guided-approve-restore');
        })));
      list.append(item);
    }
    if (files.length > 200) list.append(node('li', `${files.length - 200} more; use Advanced mode for the full list.`));
    if (!files.length) list.append(node('li', 'Nothing to restore: every file in this commit already matches.'));
    panel.append(list);
  }
  const preview = saved.restore;
  if (preview) {
    const box = node('div', undefined, 'preview');
    box.append(node('p', `${preview.file}: ${preview.beforeHash ? `${preview.beforeBytes} bytes now` : 'missing now'} → ${preview.afterBytes} bytes from ${preview.sourceCommit.slice(0, 10)}`),
      node('pre', preview.excerpt), approval('guided-approve-restore', 'I approve writing exactly these bytes into the working copy.'),
      button('Restore into working copy', 'primary', guard(repo, async state => {
        if (!checked('guided-approve-restore')) throw new Error('Tick the approval box to restore this file.');
        await run(repo, 'restore-apply', { ref: state.restore.sourceCommit, file: state.restore.file, approved: true, planHash: state.restore.planHash });
        state.message = { text: `Restored ${state.restore.file} into the working copy. Integrity and checks must be run again.` };
        state.restore = null;
        state.compare = null;
      }, true)));
    panel.append(box);
  }
  if (repo.recoveryTargets?.length && repo.records?.integrity?.passed !== true) panel.append(node('p', 'Run the integrity check again after restoring (step 4).', 'warning'));
}

function stepChecks(repo, panel, saved) {
  const availableChecks = repo.records?.inspection?.availableChecks ?? [];
  const quality = repo.records?.quality;
  if (quality) {
    panel.append(node('p', `${quality.passed ? 'Passed' : 'Failed'} ${time(quality.at)} — ${quality.scope}`, quality.passed ? 'ok' : 'warning'));
    for (const result of quality.results ?? []) panel.append(node('p', `${result.check}: exit ${result.exitCode}${result.error ? ` (${result.error})` : ''}`, 'mono'));
  }
  // The server rejects the documentation profile for projects with source code, so this guess is safe.
  const profile = availableChecks.includes('test') ? 'node' : repo.markers?.includes('package.json') ? null : 'documentation';
  if (!profile) {
    panel.append(node('p', 'No declared package test script was found. Configure reviewed commands (Python, PowerShell, .NET or nested packages) in Advanced mode → Measure validated quality.', 'warning'));
    return;
  }
  panel.append(node('p', profile === 'node'
    ? `Runs the declared package scripts (${availableChecks.join(', ')}) in the working copy. Nothing runs until you approve the exact commands.`
    : 'No package tests declared: checks that local Markdown links resolve (documentation-only projects). No code runs. Projects with source code need reviewed commands in Advanced mode.'));
  panel.append(button('Preview checks', 'secondary', guard(repo, async state => {
    state.checks = await run(repo, 'quality-preview', { profile, timeoutSeconds: 120 });
    drafts.delete('guided-approve-checks');
  })));
  const plan = saved.checks;
  if (plan) {
    const box = node('div', undefined, 'preview');
    for (const command of plan.commands ?? []) {
      box.append(node('p', `${command.name}: ${[command.executable, ...(command.args ?? [])].join(' ')}  (in ${command.cwd})`, 'mono'));
      if (command.declared) box.append(node('p', `Declared script "${command.name}" runs: ${command.declared}`, 'mono'));
      for (const [name, text] of Object.entries(command.lifecycleScripts ?? {})) box.append(node('p', `Also declared: "${name}": ${text} — ${command.lifecycleNote}`, 'mono'));
      if (command.projectNpmrc !== undefined) box.append(node('p', `Project .npmrc (npm reads it; review settings such as script-shell):\n${command.projectNpmrc}`, 'mono'));
    }
    if (profile === 'node') {
      box.append(node('p', 'Not sandboxed: approved scripts run with your user permissions and can read files, use the network or start other programs. Review them first.', 'warning'));
      box.append(approval('guided-approve-checks', 'I reviewed these commands and approve running them in the working copy.'));
    }
    box.append(button('Run checks', 'primary', guard(repo, async state => {
      if (profile === 'node' && !checked('guided-approve-checks')) throw new Error('Tick the approval box to run project code.');
      await run(repo, 'quality', { profile, timeoutSeconds: 120, approved: profile === 'node', planHash: state.checks.planHash });
      state.checks = null;
    }, true)));
    panel.append(box);
  }
  const job = ctx.getState().job;
  if (job?.status === 'running' && job.action === 'quality' && job.repositoryId === repo.id) {
    panel.append(button('Cancel running checks', 'secondary', async () => {
      try { ctx.announce((await ctx.api('/api/cancel', {})).message); } catch (error) { ctx.announce(error.message, true); }
    }));
  }
}

function reportButton(repo) {
  return button('Download case report (Markdown)', 'secondary', async () => {
    try { await ctx.download(`/api/report.md?repository=${encodeURIComponent(repo.id)}`, `${repo.name.replace(/[^a-zA-Z0-9._-]+/g, '-')}-recovery-report.md`); }
    catch (error) { ctx.announce(error.message, true); }
  });
}

function stepValidate(repo, panel) {
  const recovery = repo.records?.recovery;
  if (recovery) {
    panel.append(node('p', `Validated ${time(recovery.at)}.`, 'ok'));
    const labels = { original: 'Original', backup: 'Backup', gitIntegrity: 'Git integrity', restoredFiles: 'Restored files', checks: 'Checks' };
    const list = node('ul');
    for (const [label, text] of Object.entries(recovery.verification ?? {})) list.append(node('li', `${labels[label] ?? label}: ${text}`));
    panel.append(list);
  } else {
    const targets = (repo.recoveryTargets ?? []).map(target => target.file).join(', ');
    const template = repo.selectedCandidate
      ? `Restored ${targets || 'no files'} from ${repo.selectedCandidate.commit.slice(0, 10)} (${repo.selectedCandidate.subject}). Approved checks passed on the working copy. Not verified: `
      : 'Checks passed on the working copy. Not verified: ';
    panel.append(node('p', 'Describe what you recovered and what is still unverified. Validation rechecks the original, the backup, restored files and Git integrity.'));
    panel.append(field('What was recovered and what remains unverified', 'guided-acceptance', template, { multiline: true, rows: '4' }));
    panel.append(button('Validate and recheck', 'primary', guard(repo, async state => {
      await run(repo, 'recover', { acceptance: value('guided-acceptance') });
      state.message = { text: 'Validated: the original, backup, restored files and Git integrity were rechecked. Download the report or hand off below.' };
    }, true)));
  }
  panel.append(reportButton(repo));
}

function stepHandoff(repo, panel) {
  if (repo.lifecycle?.deliveredAt) {
    panel.append(node('p', `Handed off ${time(repo.lifecycle.deliveredAt)}.`, 'ok'));
  } else {
    panel.append(field('Final report (what happens next with the working copy)', 'guided-final', repo.case?.finalReport || '', { multiline: true, rows: '3' }));
    panel.append(button('Save and mark handed off', 'primary', guard(repo, async state => {
      const finalReport = value('guided-final');
      if (!finalReport) throw new Error('Write a short final report first.');
      await ctx.api('/api/case', { repositoryId: repo.id, type: 'notes', ...repo.case, finalReport });
      await ctx.api('/api/case', { repositoryId: repo.id, type: 'deliver' });
      await ctx.refresh();
      state.message = { text: 'Handed off. Nothing was copied into your original repository.' };
    }, true)));
  }
  panel.append(node('p', `The recovered result lives only in ${repo.records?.preservation?.workingCopy ?? 'the working copy'}. Moving it into your original project is your decision: review the diff there and copy or commit it yourself.`, 'muted'));
  panel.append(reportButton(repo));
}

const renderers = { scan: stepScan, choose: stepChoose, protect: stepProtect, integrity: stepIntegrity, restore: stepRestore, checks: stepChecks, validate: stepValidate, handoff: stepHandoff };

export function renderGuided(repo) {
  if (!ctx || !repo) return;
  const saved = caseLocal(repo.id);
  const job = ctx.getState().job;
  const signature = JSON.stringify([repo.id, Object.entries(repo.records ?? {}).map(([key, record]) => [key, record.at, record.passed]),
    repo.selectedCandidate?.commit, repo.recoveryTargets, repo.scan?.at, repo.lifecycle?.deliveredAt, job?.status, job?.id,
    saved.step, saved.message, Boolean(saved.acquire), saved.compare?.at, saved.restore?.at, saved.checks?.at]);
  if (signature === guidedSignature) return;
  guidedSignature = signature;
  const steps = guidedSteps(repo);
  const pinned = job?.status === 'running' ? steps.find(step => step.id === saved.step) : null;
  const active = pinned ?? steps.find(step => step.id === saved.step && step.available) ?? steps.find(step => step.current);
  saved.lastActive = active.id;
  const root = $('guided-recovery');
  const nav = node('ol', undefined, 'guided-steps');
  for (const [index, step] of steps.entries()) {
    const item = node('li');
    const control = button(`${index + 1}. ${step.title}`, `guided-step${step.id === active.id ? ' active' : ''}${step.done ? ' done' : ''}`, () => {
      saved.step = step.id;
      guidedSignature = '';
      renderGuided(repo);
    });
    control.disabled = !step.available || job?.status === 'running';
    if (step.id === active.id) control.setAttribute('aria-current', 'step');
    control.append(node('small', step.done ? ' ✓ done' : step.optional ? ' optional' : step.available ? '' : ' locked'));
    item.append(control);
    nav.append(item);
  }
  const panel = node('div', undefined, 'guided-panel');
  panel.append(node('h3', active.title));
  if (repo.interrupted) panel.append(node('p', repo.interrupted.message, 'warning'));
  if (saved.message) panel.append(node('p', saved.message.text, saved.message.error ? 'warning' : 'ok'));
  if (job?.status === 'running') panel.append(node('p', `Running: ${job.action}. Please wait; the result is saved when it finishes.`, 'muted'));
  renderers[active.id](repo, panel, saved);
  if (job?.status === 'running') for (const control of panel.querySelectorAll('button, input, textarea')) if (!/Cancel/.test(control.textContent)) control.disabled = true;
  const focused = document.activeElement?.id;
  root.replaceChildren(node('h2', 'Guided recovery', 'sr-only'), nav, panel);
  if (focused && $(focused) && root.contains($(focused))) $(focused).focus();
}
