import { workspaceKey, workspacePreferences, moveSection, moveWorkspaceSection, estimateStatistics, procedureStatistics, lifecycleStatistics } from './workspace-model.mjs';
import { diagnostics, diagnosticsPdf, sectionGroup } from './diagnostics-model.mjs';

const $ = id => document.getElementById(id);
let preferences = workspacePreferences();
let snapshot;
let report;
let dragged;
const panels = new Map([...document.querySelectorAll('[data-section]')].map(panel => [panel.dataset.section, panel]));
const percentage = value => value === null ? 'Not assessed' : `${value.toFixed(1)}%`;
function node(tag, text, className) {
  const result = document.createElement(tag);
  if (text !== undefined) result.textContent = text;
  if (className) result.className = className;
  return result;
}
function save() {
  try { localStorage.setItem(workspaceKey, JSON.stringify(preferences)); }
  catch (error) { report(`Workspace layout could not be saved: ${error.message}`, true); }
}
function apply() {
  const root = $('workspace-sections');
  const sections = ['introduction', 'cases', 'diagnostics'].map($);
  if (sections.some((section, index) => root.children[index] !== section)) root.replaceChildren(...sections);
  for (const group of ['introduction', 'cases', 'diagnostics']) {
    const container = $(`${group}-panels`);
    const ordered = preferences.order.filter(id => sectionGroup[id] === group).map(id => panels.get(id));
    if (ordered.some((panel, index) => container.children[index] !== panel)) container.replaceChildren(...ordered);
  }
  const navigation = $('section-navigation');
  const cards = preferences.navOrder.map(id => document.querySelector(`[data-nav="${id}"]`));
  if (cards.some((card, index) => navigation.children[index] !== card)) navigation.replaceChildren(...cards);
  for (const [id, panel] of panels) {
    panel.open = preferences.open.includes(id);
    const size = preferences.sizes[id];
    panel.style.width = size ? `${size.width}%` : '';
    panel.style.height = size && panel.open ? `${size.height}px` : '';
  }
}
function reorder(id, target, delta) {
  preferences.order = moveWorkspaceSection(preferences.order, id, target, delta);
  apply();
  save();
  panels.get(id).querySelector('.section-grip').focus();
  report('Section order saved.');
}
export function initializeWorkspace({ announce, resetTable }) {
  report = announce;
  let errorMessage;
  try {
    const saved = localStorage.getItem(workspaceKey);
    if (saved !== null) preferences = workspacePreferences(JSON.parse(saved));
  } catch (error) { errorMessage = `Workspace layout could not be read: ${error.message}. Using defaults.`; report(errorMessage, true); }
  for (const [id, panel] of panels) {
    panel.addEventListener('toggle', () => {
      const changed = panel.open !== preferences.open.includes(id);
      if (!changed) return;
      preferences.open = panel.open ? [...preferences.open, id] : preferences.open.filter(value => value !== id);
      panel.style.height = panel.open && preferences.sizes[id] ? `${preferences.sizes[id].height}px` : '';
      save();
    });
    const grip = panel.querySelector('.section-grip');
    grip.addEventListener('dragstart', event => {
      dragged = id;
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/plain', id);
      panel.classList.add('dragging');
    });
    function end() {
      dragged = undefined;
      for (const item of panels.values()) item.classList.remove('dragging', 'section-drop');
    }
    grip.addEventListener('dragend', end);
    grip.addEventListener('keydown', event => {
      if (!['ArrowUp', 'ArrowDown'].includes(event.key)) return;
      event.preventDefault();
      event.stopPropagation();
      reorder(id, null, event.key === 'ArrowUp' ? -1 : 1);
    });
    panel.addEventListener('dragover', event => {
      if (!dragged || dragged === id || sectionGroup[dragged] !== sectionGroup[id]) return;
      event.preventDefault();
      panel.classList.add('section-drop');
    });
    panel.addEventListener('dragleave', () => panel.classList.remove('section-drop'));
    panel.addEventListener('drop', event => {
      if (!dragged || sectionGroup[dragged] !== sectionGroup[id]) return;
      event.preventDefault();
      const source = dragged;
      end();
      reorder(source, id);
    });
    const handle = panel.querySelector('.section-resizer');
    function resize(width, height) {
      preferences.sizes[id] = { width: Math.max(40, Math.min(100, width)), height: Math.max(220, Math.min(1200, height)) };
      apply();
      return errorMessage;
    }
    handle.addEventListener('pointerdown', event => {
      if (event.button !== 0 || !panel.open) return;
      event.preventDefault();
      event.stopPropagation();
      const rect = panel.getBoundingClientRect();
      const containerWidth = panel.parentElement.getBoundingClientRect().width;
      const x = event.clientX;
      const y = event.clientY;
      handle.setPointerCapture(event.pointerId);
      const move = event => resize((rect.width + event.clientX - x) / containerWidth * 100, rect.height + event.clientY - y);
      const finish = () => {
        handle.removeEventListener('pointermove', move);
        handle.removeEventListener('pointerup', finish);
        handle.removeEventListener('pointercancel', finish);
        save();
      };
      handle.addEventListener('pointermove', move);
      handle.addEventListener('pointerup', finish);
      handle.addEventListener('pointercancel', finish);
    });
    handle.addEventListener('keydown', event => {
      if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key) || !panel.open) return;
      event.preventDefault();
      event.stopPropagation();
      const width = preferences.sizes[id]?.width || panel.getBoundingClientRect().width / panel.parentElement.getBoundingClientRect().width * 100;
      const height = preferences.sizes[id]?.height || panel.getBoundingClientRect().height;
      resize(width + (event.key === 'ArrowRight' ? 5 : event.key === 'ArrowLeft' ? -5 : 0),
        height + (event.key === 'ArrowDown' ? 40 : event.key === 'ArrowUp' ? -40 : 0));
      save();
      report(`${id} panel size saved.`);
    });
  }
  const reset = () => {
    preferences = workspacePreferences({ statField: preferences.statField, statProcedure: preferences.statProcedure });
    apply();
    save();
    resetTable();
    report('Workspace sections and table layout reset. Case evidence and browsing settings unchanged.');
  };
  $('reset-workspace').addEventListener('click', reset);
  $('settings-reset').addEventListener('click', reset);
  $('open-settings').addEventListener('click', () => $('settings-dialog').showModal());
  $('close-settings').addEventListener('click', () => $('settings-dialog').close());
  for (const link of document.querySelectorAll('.sidebar .nav-item')) {
    link.addEventListener('click', () => {
      const section = document.querySelector(link.getAttribute('href'));
      const first = section?.querySelector('[data-section]');
      if (first) first.open = true;
      for (const item of document.querySelectorAll('.sidebar .nav-item')) item.removeAttribute('aria-current');
      link.setAttribute('aria-current', 'location');
    });
  }
  $('stat-field').value = preferences.statField;
  $('stat-field').addEventListener('change', () => {
    preferences.statField = $('stat-field').value;
    save();
    renderWorkspace(snapshot);
  });
  $('stat-procedure').addEventListener('change', () => {
    preferences.statProcedure = $('stat-procedure').value;
    save();
    renderWorkspace(snapshot);
  });
  $('footer-year').textContent = new Date().getFullYear();
  for (const control of [$('diagnostic-from'), $('diagnostic-through'), $('diagnostic-group')]) {
    control.addEventListener('change', () => renderWorkspace(snapshot));
  }
  $('download-diagnostics').disabled = true;
  $('download-diagnostics').addEventListener('click', () => {
    try {
      const result = diagnosticSelection(snapshot.repositories);
      const url = URL.createObjectURL(new Blob([diagnosticsPdf(result)], { type: 'application/pdf' }));
      const link = node('a');
      link.href = url;
      link.download = 'moorkyz-diagnostics.pdf';
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
    } catch (error) { report(error.message, true); }
  });
  let draggedNav;
  for (const card of document.querySelectorAll('[data-nav]')) {
    const grip = card.querySelector('button');
    const move = (target, delta) => {
      preferences.navOrder = moveSection(preferences.navOrder, card.dataset.nav, target, delta);
      apply();
      save();
      grip.focus();
      report('Sidebar card order saved.');
    };
    grip.addEventListener('keydown', event => {
      if (!['ArrowUp', 'ArrowDown'].includes(event.key)) return;
      event.preventDefault();
      move(null, event.key === 'ArrowUp' ? -1 : 1);
    });
    grip.addEventListener('dragstart', event => {
      draggedNav = card.dataset.nav;
      event.dataTransfer.setData('text/plain', draggedNav);
    });
    grip.addEventListener('dragend', () => { draggedNav = undefined; });
    card.addEventListener('dragover', event => { if (draggedNav) event.preventDefault(); });
    card.addEventListener('drop', event => {
      if (!draggedNav) return;
      event.preventDefault();
      preferences.navOrder = moveSection(preferences.navOrder, draggedNav, card.dataset.nav);
      draggedNav = undefined;
      apply();
      save();
      report('Sidebar card order saved.');
    });
  }
  apply();
}
function diagnosticSelection(repositories) {
  return diagnostics(repositories, { from: $('diagnostic-from').value, through: $('diagnostic-through').value,
    group: $('diagnostic-group').value });
}
function facts(container, values) {
  const list = node('dl', undefined, 'stat-facts');
  for (const [label, value] of values) {
    const entry = node('div');
    entry.append(node('dt', label), node('dd', String(value)));
    list.append(entry);
  }
  container.append(list);
}
function bars(container, values, total) {
  const chart = node('div', undefined, 'stat-chart');
  for (const [label, count] of values) {
    const row = node('div', undefined, 'stat-bar-row');
    const bar = node('progress');
    bar.max = Math.max(1, total);
    bar.value = count;
    bar.setAttribute('aria-label', `${label}: ${count} of ${total}`);
    row.append(node('span', label), bar, node('strong', String(count)));
    chart.append(row);
  }
  container.append(chart);
}
export function renderWorkspace(state) {
  if (!state) return;
  snapshot = state;
  $('overview-summary').textContent = `${state.repositories.length} cases`;
  $('overview-chart').replaceChildren();
  bars($('overview-chart'), Object.entries(lifecycleStatistics(state.repositories).states), state.repositories.length);
  let selection;
  try { selection = diagnosticSelection(state.repositories); }
  catch (error) {
    $('diagnostic-summary').textContent = error.message;
    $('download-diagnostics').disabled = true;
    for (const id of ['diagnostic-groups', 'estimate-statistics', 'procedure-statistics', 'lifecycle-statistics']) $(id).replaceChildren();
    for (const id of ['estimates-summary', 'procedures-summary', 'lifecycle-summary']) $(id).textContent = 'Invalid date range';
    return;
  }
  $('download-diagnostics').disabled = false;
  const repositories = selection.repositories;
  $('diagnostic-summary').textContent = `${repositories.length} cases included; ${selection.excluded} excluded. ${selection.unknown} cases have no known examination/procedure time${selection.bounded ? ' and are excluded' : ' (included in all-time view)'}. Dates use UTC, end date inclusive.`;
  $('diagnostic-groups').replaceChildren();
  bars($('diagnostic-groups'), selection.groups, repositories.length);
  const estimates = $('estimate-statistics');
  estimates.replaceChildren();
  const chooser = node('div', undefined, 'stat-choosers');
  for (const [field, label] of Object.entries({ condition: 'Condition', quality: 'Relational quality', recovery: 'Recovery', confidence: 'Confidence' })) {
    for (const result of estimateStatistics(repositories, field)) {
      const button = node('button', undefined, 'stat-chooser');
      button.type = 'button';
      button.append(node('small', `${result.pair} ${label}`), node('strong', percentage(result.average)));
      button.addEventListener('click', () => {
        preferences.statField = field;
        $('stat-field').value = field;
        save();
        renderWorkspace(snapshot);
        $('stat-field').focus();
      });
      chooser.append(button);
    }
  }
  estimates.append(chooser);
  for (const result of estimateStatistics(repositories, $('stat-field').value)) {
    const block = node('section', undefined, 'stat-pair');
    block.append(node('h3', `${result.pair} estimates`));
    facts(block, [['Mean', percentage(result.average)], ['Range', result.count ? `${percentage(result.minimum)} - ${percentage(result.maximum)}` : 'Not assessed'],
      ['Assessed', result.count], ['Unknown', result.missing], ['Stale / excluded', result.stale]]);
    bars(block, result.buckets.map(bucket => [bucket.label, bucket.count]), result.count);
    estimates.append(block);
  }
  const assessed = estimateStatistics(repositories, 'condition')[1].count;
  $('estimates-summary').textContent = `${assessed} current conditions assessed`;
  const all = procedureStatistics(repositories);
  const select = $('stat-procedure');
  const selected = preferences.statProcedure;
  select.replaceChildren(new Option('All procedures', ''));
  for (const name of Object.keys(all.names).sort()) select.append(new Option(name, name));
  select.value = Object.hasOwn(all.names, selected) ? selected : '';
  const procedures = procedureStatistics(repositories, select.value);
  $('procedures-summary').textContent = `${all.total} attempts / ${all.reviewed} reviewed`;
  const procedureContainer = $('procedure-statistics');
  const attemptsOpen = procedureContainer.querySelector('details')?.open;
  procedureContainer.replaceChildren();
  facts(procedureContainer, [['Attempts', procedures.total], ['Reviewed', procedures.reviewed], ['Unrated', procedures.unrated],
    ['Mean helping factor', percentage(procedures.average)]]);
  bars(procedureContainer, Object.entries(procedures.statuses), procedures.total);
  for (const kind of ['best', 'worst']) {
    const entry = procedures[kind];
    procedureContainer.append(node('p', `${kind}: ${entry ? `${entry.name} / ${entry.repository} / ${percentage(entry.helpingFactor)} / ${entry.at}` : 'Not reviewed'}`));
  }
  if (procedures.attempts.length) {
    const history = node('details');
    history.open = Boolean(attemptsOpen);
    history.append(node('summary', `Expand all ${procedures.attempts.length} timestamped attempts`));
    const list = node('ul', undefined, 'stat-attempts');
    for (const entry of procedures.attempts) list.append(node('li', `${entry.repository}: ${entry.name} / ${entry.status} / ${entry.at} / helping factor ${percentage(entry.helpingFactor ?? null)}`));
    history.append(list);
    procedureContainer.append(history);
  }
  const lifecycle = lifecycleStatistics(repositories);
  $('lifecycle-summary').textContent = `${lifecycle.active} active / ${lifecycle.delivered} delivered / ${lifecycle.dismissed} dismissed`;
  const lifecycleContainer = $('lifecycle-statistics');
  lifecycleContainer.replaceChildren();
  const elapsed = value => value === null ? 'Not observed' : `${(value / 3600000).toFixed(1)} hours`;
  facts(lifecycleContainer, [['Active', lifecycle.active], ['Delivered', lifecycle.delivered], ['Dismissed', lifecycle.dismissed],
    ['Focused targets', lifecycle.targets], ['Mean total stay', elapsed(lifecycle.averageStay)], ['Mean unchanged', elapsed(lifecycle.averageUnchanged)]]);
  lifecycleContainer.append(node('h3', 'States'));
  bars(lifecycleContainer, Object.entries(lifecycle.states), lifecycle.total);
  lifecycleContainer.append(node('h3', 'Priorities'));
  bars(lifecycleContainer, Object.entries(lifecycle.priorities), lifecycle.total);
}
