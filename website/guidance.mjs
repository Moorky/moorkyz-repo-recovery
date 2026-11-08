import { measuredStatistics, nextStep, helpTopics } from './guidance-model.mjs';
import { scanProgress } from './simple-model.mjs';
const $ = id => document.getElementById(id);
function node(tag, text, className) {
  const el = document.createElement(tag);
  if (text !== undefined) el.textContent = text;
  if (className) el.className = className;
  return el;
}
const number = value => value == null ? 'Unknown' : value.toLocaleString(undefined, { maximumFractionDigits: 1 });
const elapsed = value => value == null ? 'Unknown' : value >= 3600000 ? `${(value / 3600000).toFixed(1)} h` : value >= 60000 ? `${(value / 60000).toFixed(1)} min` : `${(value / 1000).toFixed(1)} s`;
let openCase;
export function initializeGuidance(open) {
  openCase = open;
  for (const [section, topic] of Object.entries({ medkit: 'workflow', overview: 'health', estimates: 'estimates',
    procedures: 'timing', lifecycle: 'health', cases: 'workflow' })) {
    const summary = document.querySelector(`[data-section="${section}"] > summary`);
    const help = node('span', undefined, 'panel-help');
    help.dataset.help = topic;
    summary?.append(help);
  }
  for (const [index, placeholder] of [...document.querySelectorAll('[data-help]')].entries()) {
    const topic = helpTopics[placeholder.dataset.help];
    if (!topic) continue;
    const button = node('button', '?', 'help-button');
    button.type = 'button';
    const panel = node('div', undefined, 'help-popover');
    panel.id = `recovery-help-${index}`;
    panel.popover = 'auto';
    panel.setAttribute('role', 'region');
    panel.setAttribute('aria-label', topic.title);
    button.setAttribute('aria-label', `Help: ${topic.title}`);
    button.setAttribute('aria-controls', panel.id);
    button.setAttribute('aria-expanded', 'false');
    panel.append(node('h3', topic.title), node('p', topic.body));
    const link = node('a', 'Read the full explanation');
    link.href = topic.link;
    const close = node('button', 'Close', 'secondary');
    close.type = 'button';
    panel.append(link, close);
    placeholder.append(button);
    document.body.append(panel);
    let timer, suppressFocus = false;
    function show() {
      clearTimeout(timer);
      if (!panel.matches(':popover-open')) panel.showPopover();
      const rect = button.getBoundingClientRect();
      panel.style.left = `${Math.max(8, Math.min(rect.left, innerWidth - panel.offsetWidth - 8))}px`;
      panel.style.top = `${Math.max(8, Math.min(rect.bottom + 8, innerHeight - panel.offsetHeight - 8))}px`;
    }
    const hide = () => { suppressFocus = true; if (panel.matches(':popover-open')) panel.hidePopover(); };
    button.addEventListener('pointerenter', () => { suppressFocus = false; show(); });
    button.addEventListener('focus', () => { if (!suppressFocus) show(); });
    button.addEventListener('blur', () => { suppressFocus = false; });
    button.addEventListener('click', event => { event.preventDefault(); event.stopPropagation(); suppressFocus = false; show(); });
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape' && panel.matches(':popover-open')) {
        event.preventDefault();
        event.stopPropagation();
        hide();
      }
    }, true);
    for (const el of [button, panel]) {
      el.addEventListener('pointerenter', () => clearTimeout(timer));
      el.addEventListener('pointerleave', () => { timer = setTimeout(() => { if (!panel.contains(document.activeElement) && document.activeElement !== button) hide(); }, 180); });
    }
    close.addEventListener('click', hide);
    panel.addEventListener('toggle', () => button.setAttribute('aria-expanded', String(panel.matches(':popover-open'))));
  }
  $('toggle-detail-table').addEventListener('click', () => {
    const hidden = !$('detailed-case-table').hidden;
    $('detailed-case-table').hidden = hidden;
    $('toggle-detail-table').textContent = hidden ? 'Show advanced table' : 'Hide advanced table';
    $('toggle-detail-table').setAttribute('aria-expanded', String(!hidden));
  });
}
function facts(id, entries) {
  const root = $(id);
  root.replaceChildren();
  for (const [label, value, note] of entries) {
    const item = node('div', undefined, 'measured-fact');
    item.append(node('dt', label), node('dd', value), node('small', note));
    root.append(item);
  }
}
function known(metric) { return `${metric.known} measured / ${metric.unknown} unknown cases`; }
export function renderGuidance(state, visible) {
  const stats = measuredStatistics(state.repositories);
  $('guided-case-count').textContent = `${stats.total} projects · ${stats.qualityPassed} passed validation · ${stats.qualityFailed} failed · ${stats.notValidated} without a current check record`;
  facts('gate-statistics', [
    ['Inspected', `${stats.inspected} / ${stats.total}`, `${stats.uninspected} not inspected`],
    ['Copies verified', `${stats.preserved} / ${stats.total}`, 'Backup + independent working copy'],
    ['Integrity passed', number(stats.integrityPassed), 'Successful saved integrity checks'],
    ['Validation passed', number(stats.qualityPassed), `${stats.qualityFailed} failed; ${stats.notValidated} without a current gate record`],
    ['Baseline validated', number(stats.recovered), 'Scoped handoff evidence, not all lost work'],
    ['Delivered', number(stats.delivered), 'Explicit reviewed disposition'],
  ]);
  facts('history-statistics', [
    ['Tracked index paths', number(stats.tracked.value), known(stats.tracked)],
    ['Missing index paths', number(stats.missing.value), known(stats.missing)],
    ['Staged deletions', number(stats.stagedDeletions.value), known(stats.stagedDeletions)],
    ['Audit-related paths', number(stats.audits.value), known(stats.audits)],
    ['Local Git tags', number(stats.tags.value), known(stats.tags)],
    ['Stashes', number(stats.stashes.value), known(stats.stashes)],
  ]);
  facts('copy-statistics', [
    ['Baseline file bytes', stats.baselineBytes.value == null ? 'Unknown' : `${(stats.baselineBytes.value / 1024 ** 3).toFixed(2)} GiB`, 'One baseline per known case; not free-space usage'],
    ['Baseline files', number(stats.baselineFiles.value), known(stats.baselineFiles)],
    ['Preserved relative links', number(stats.links.value), known(stats.links)],
    ['Exact file retention', stats.retention ? `${stats.retention.percent.toFixed(1)}%` : 'Not validated', stats.retention ? `${number(stats.retention.matched)} / ${number(stats.retention.baseline)} known files` : 'Requires final baseline checks'],
  ]);
  facts('run-statistics', [
    ['Recorded attempts', number(stats.attempts), 'Historical applied procedures, not preview count'],
    ['Failed attempts', number(stats.failedAttempts), 'Includes prior failures later resolved'],
    ['Median attempt time', elapsed(stats.medianDurationMs), `${stats.durationsKnown} attempts have timing evidence`],
    ['Oldest inspection age', elapsed(stats.oldestInspectionAgeMs), 'Not continuous filesystem monitoring'],
  ]);
  $('case-cards').replaceChildren();
  for (const repo of visible) {
    const next = nextStep(repo), card = node('article', undefined, 'recovery-case-card');
    const quality = repo.records?.quality;
    const status = quality?.passed === false ? 'Needs attention' : repo.records?.recovery ? 'Validated scope' : repo.records?.preservation ? 'Protected copy' : 'Needs preservation';
    card.dataset.state = quality?.passed === false ? 'failed' : repo.records?.recovery ? 'validated' : 'pending';
    card.append(node('span', status, 'case-badge'), node('h3', repo.name), node('p', next.detail));
    const progress = node('progress');
    progress.max = 5;
    progress.value = ['inspection', 'preservation', 'integrity', 'quality', 'recovery'].filter(key => repo.records?.[key] && repo.records[key].passed !== false).length;
    progress.setAttribute('aria-label', `${progress.value} of 5 evidence gates recorded for ${repo.name}`);
    card.append(progress, node('small', `${progress.value}/5 evidence gates · not a completion percentage`));
    const button = node('button', next.label, 'primary');
    button.type = 'button';
    button.dataset.caseOpen = repo.id;
    button.disabled = state.job?.status === 'running' && state.job.repositoryId !== repo.id;
    button.addEventListener('click', () => openCase(repo));
    card.append(button);
    $('case-cards').append(card);
  }
  const job = state.job;
  $('active-operation').hidden = !job;
  if (job?.action === 'scan') {
    const progress = scanProgress(job);
    $('active-operation-title').textContent = `Repository scan — ${job.status}`;
    $('active-operation-detail').textContent = progress.text;
  } else if (job) {
    const name = state.repositories.find(repo => repo.id === job.repositoryId)?.name || 'Unknown case';
    const duration = Date.parse(job.finishedAt || new Date().toISOString()) - Date.parse(job.startedAt);
    $('active-operation-title').textContent = `${name}: ${job.action} — ${job.status}`;
    $('active-operation-detail').textContent = job.error || `${elapsed(duration)} elapsed. ${job.status === 'running' ? 'Copying/hashing may be slow. Do not retry, rescan, modify originals or assume completion. Validation can be cancelled in the case panel.' : 'Review the recorded evidence; this is not proof of application completeness.'}`;
  }
}
