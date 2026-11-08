import { defaults, preferenceKey, validatePreferences, procedureExtremes, selectRepositories, listWindow, suggestions, columns, moveBefore, moveBy } from './list-model.mjs';
import { initializeWorkspace, renderWorkspace } from './workspace.mjs';
import { initializeGuidance, renderGuidance } from './guidance.mjs';
import { nextStep } from './guidance-model.mjs';
import { initializeSimple, renderSimple, renderGuided } from './simple.mjs';

const stages = [
  { action: 'inspect', key: 'inspection', title: 'Inspect local condition', description: 'Read root structure, declared checks and Git state. Uncommitted work is preserved, not treated as permission to reset. This unlocks a measured condition rubric and a potential-quality estimate.' },
  { action: 'preserve', key: 'preservation', title: 'Verify independent preservation', description: 'Verify an untouched backup and a separate disposable working copy against the complete original file baseline. No copy, overwrite or cleanup is performed. This gate must pass before running repository code.' },
  { action: 'integrity', key: 'integrity', title: 'Check local object integrity', description: 'Run non-writing Git fsck on the verified working copy. Source-only folders receive an explicit not-applicable Git result, never invented Git history. No remote comparison is implied.' },
  { action: 'quality', key: 'quality', title: 'Measure validated quality', description: 'Run declared Node checks with your explicit authorization, or local links for documentation-only projects. A final quality score measures this limited rubric, not all aspects of software quality.' },
  { action: 'recover', key: 'recovery', title: 'Validate the recovery baseline', description: 'Recheck the untouched backup, original baseline, working-copy freshness and Git integrity. Measure the percentage of known baseline files retained. Completed gates produce final evidence coverage, not a probability of recovering unknown missing code.' },
];
const $ = id => document.getElementById(id);
let token;
let state;
let selectedId;
let selectedStage = 0;
let polling = false;
let fixPreview = null;
let fixInput = null;
let validationPreview = null;
let workflowPreview = null;
let workflowInput = null;
const workflowApply = { 'acquire-preview': 'acquire-apply', 'restore-preview': 'restore-apply',
  'rescue-preview': 'rescue-apply', 'remote-preview': 'remote-fetch' };
let preferences = validatePreferences(defaults);
let pageIndex = 0;
let visibleLimit = defaults.pageSize;
let currentWindow;
let suggestionIndex = -1;
let searchSuggestions = [];
let preferenceError;
let dragging = null;
let attributeContext = null;
const defaultWidths = { repository: 210, state: 180, stay: 165, findings: 200, condition: 155, quality: 165, recovery: 190, outcome: 200, procedures: 175, extremes: 175, medikit: 110 };
const headerCells = new Map([...document.querySelectorAll('.case-table th')].map((header, index) => {
  header.dataset.column = columns[index];
  return [columns[index], header];
}));
const colgroup = document.createElement('colgroup');
document.querySelector('.case-table').prepend(colgroup);
try {
  const saved = localStorage.getItem(preferenceKey);
  if (saved !== null) preferences = validatePreferences(JSON.parse(saved));
} catch (error) {
  preferenceError = `Saved settings could not be read: ${error.message}. Using defaults for this session.`;
}
visibleLimit = preferences.pageSize;
function loadIfNearEnd() {
  if (preferences.mode !== 'continuous' || !currentWindow?.hasMore || $('case-dialog').open) return;
  const rect = $('load-sentinel').getBoundingClientRect();
  if (rect.top <= innerHeight + 150 && rect.bottom >= -150) {
    visibleLimit += preferences.pageSize;
    render();
  }
}
const loadObserver = new IntersectionObserver(entries => {
  if (entries.some(entry => entry.isIntersecting)) loadIfNearEnd();
}, { rootMargin: '150px' });
document.addEventListener('scroll', loadIfNearEnd, { passive: true });

function savePreferences() {
  try { localStorage.setItem(preferenceKey, JSON.stringify(preferences)); }
  catch (error) { announce(`Settings could not be saved locally: ${error.message}`, true); }
}
function layoutColumns() {
  const order = preferences.columnOrder;
  const header = document.querySelector('.case-table thead tr');
  const cells = order.map(key => headerCells.get(key));
  // Width changes must not detach a handle while it has pointer capture.
  if (cells.some((cell, index) => header.children[index] !== cell)) header.replaceChildren(...cells);
  colgroup.replaceChildren(...order.map(key => {
    const col = document.createElement('col');
    const width = preferences.columnWidths[key] || defaultWidths[key];
    col.style.width = `${width}px`;
    headerCells.get(key).style.width = `${width}px`;
    return col;
  }));
  document.querySelector('.case-table').style.minWidth = `${order.reduce((sum, key) => sum + (preferences.columnWidths[key] || defaultWidths[key]), 0)}px`;
}
function endDrag() {
  dragging = null;
  for (const node of document.querySelectorAll('.dragging,.drop-target')) node.classList.remove('dragging', 'drop-target');
}
function startDrag(event, kind, id) {
  dragging = { kind, id };
  event.dataTransfer.effectAllowed = 'move';
  event.dataTransfer.setData('text/plain', id);
  event.currentTarget.classList.add('dragging');
}
function orderedRowIds() {
  return selectRepositories(state.repositories, '', { ...defaults, sort: 'manual', rowOrder: preferences.rowOrder }).map(repo => repo.id);
}
function reorderRows(source, target, delta) {
  const order = orderedRowIds();
  preferences.rowOrder = delta === undefined ? moveBefore(order, source, target) : moveBy(order, source, delta);
  preferences.sort = 'manual';
  $('sort').value = 'manual';
  savePreferences();
  render();
  announce('Row order saved locally. Case data was not changed.');
  document.querySelector(`tr[data-repository-id="${source}"] .row-grip`)?.focus();
}
function reorderColumns(source, target, delta) {
  preferences.columnOrder = delta === undefined ? moveBefore(preferences.columnOrder, source, target) : moveBy(preferences.columnOrder, source, delta);
  savePreferences();
  render();
  headerCells.get(source).querySelector('.column-grip').focus();
  announce('Column order saved locally.');
}
for (const [key, header] of headerCells) {
  const grip = element('button', '⠿', 'column-grip');
  grip.type = 'button';
  grip.draggable = true;
  grip.title = 'Drag to move column. Or focus this grip and use Left/Right.';
  grip.setAttribute('aria-label', `Move ${key} column; Left/Right keys or drag`);
  grip.addEventListener('dragstart', event => startDrag(event, 'column', key));
  grip.addEventListener('dragend', endDrag);
  grip.addEventListener('keydown', event => {
    if (['ArrowLeft', 'ArrowRight'].includes(event.key)) {
      event.preventDefault();
      reorderColumns(key, null, event.key === 'ArrowLeft' ? -1 : 1);
    }
  });
  header.prepend(grip);
  header.addEventListener('dragover', event => {
    if (dragging?.kind !== 'column') return;
    event.preventDefault();
    header.classList.add('drop-target');
  });
  header.addEventListener('dragleave', () => header.classList.remove('drop-target'));
  header.addEventListener('drop', event => {
    if (dragging?.kind !== 'column') return;
    event.preventDefault();
    const source = dragging.id;
    endDrag();
    reorderColumns(source, key);
  });
  const resizer = element('button', '', 'column-resizer');
  resizer.type = 'button';
  resizer.title = 'Drag this edge to resize. Left/Right changes width by 20px.';
  resizer.setAttribute('aria-label', `Resize ${key} column`);
  function resize(width) {
    preferences.columnWidths[key] = Math.max(100, Math.min(600, width));
    layoutColumns();
  }
  resizer.addEventListener('pointerdown', event => {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    const initial = header.getBoundingClientRect().width;
    const x = event.clientX;
    resizer.setPointerCapture(event.pointerId);
    const move = event => resize(initial + event.clientX - x);
    const finish = () => {
      resizer.removeEventListener('pointermove', move);
      resizer.removeEventListener('pointerup', finish);
      resizer.removeEventListener('pointercancel', finish);
      savePreferences();
    };
    resizer.addEventListener('pointermove', move);
    resizer.addEventListener('pointerup', finish);
    resizer.addEventListener('pointercancel', finish);
  });
  resizer.addEventListener('keydown', event => {
    if (!['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
    event.preventDefault();
    resize((preferences.columnWidths[key] || defaultWidths[key]) + (event.key === 'ArrowLeft' ? -20 : 20));
    savePreferences();
    announce(`${key} column width: ${preferences.columnWidths[key]}px.`);
  });
  header.append(resizer);
}
function attributeButton(label, value, repository, field, description) {
  const button = element('button', undefined, 'attribute-button');
  button.type = 'button';
  button.append(value);
  button.dataset.tip = `Click for ${label.toLowerCase()} details`;
  button.setAttribute('aria-label', `${label} for ${repository.name}: view details`);
  button.addEventListener('click', () => {
    attributeContext = { id: repository.id, label, field, description };
    showAttribute();
    $('attribute-dialog').showModal();
  });
  return button;
}
function showAttribute() {
  const repo = state.repositories.find(item => item.id === attributeContext?.id);
  if (!repo) return;
  $('attribute-title').textContent = `${attributeContext.label} / ${repo.name}`;
  $('attribute-description').textContent = attributeContext.description;
  $('attribute-value').textContent = JSON.stringify(attributeContext.field === 'identity' ? { id: repo.id, name: repo.name, path: repo.path, markers: repo.markers } :
    attributeContext.field === 'estimates' ? repo.estimates :
    attributeContext.field === 'procedures' ? repo.procedures :
      attributeContext.field === 'lifecycle' ? repo.lifecycle : repo.case, null, 2);
  $('refresh-attribute').disabled = busy();
  $('examine-attribute').disabled = busy();
  $('attribute-open-case').disabled = busy() && selectedId !== repo.id;
}
function resetWindow() {
  pageIndex = 0;
  visibleLimit = preferences.pageSize;
}
function openCase(repo) {
  if (busy() && selectedId !== repo.id) return announce('Wait for the running procedure before opening a different case.', true);
  selectedId = repo.id;
  selectedStage = nextStep(repo).stage;
  $('backup').value = '';
  $('working-copy').value = '';
  $('approve').checked = false;
  $('approve-fix').checked = false;
  fixPreview = null;
  fixInput = null;
  resetWorkflow();
  resetValidation();
  $('workflow-output').textContent = 'Choose a procedure. No preview has been approved for this case.';
  $('history-files').replaceChildren();
  $('history-refs').replaceChildren();
  $('recovery-acceptance').value = repo.records.recovery?.acceptance || '';
  $('backup').value = repo.records.preservation?.backup || '';
  $('working-copy').value = repo.records.preservation?.workingCopy || '';
  render();
  populateTools();
  if (!$('case-dialog').open) $('case-dialog').showModal();
}
function renderSuggestions() {
  searchSuggestions = state ? suggestions(selectRepositories(state.repositories, '', preferences), $('search').value) : [];
  suggestionIndex = -1;
  $('search-suggestions').replaceChildren();
  for (const [index, repo] of searchSuggestions.entries()) {
    const option = element('button', undefined, 'search-option');
    option.type = 'button';
    option.id = `suggestion-${index}`;
    option.setAttribute('role', 'option');
    option.setAttribute('aria-selected', 'false');
    option.tabIndex = -1;
    option.append(element('strong', repo.name), element('small', `${repo.lifecycle.status} / ${repo.case.target || repo.case.owner || repo.id}`));
    option.addEventListener('pointerdown', event => event.preventDefault());
    option.addEventListener('click', () => chooseSuggestion(index));
    $('search-suggestions').append(option);
  }
  const show = searchSuggestions.length > 0 && document.activeElement === $('search');
  $('search-suggestions').hidden = !show;
  $('search').setAttribute('aria-expanded', String(show));
  $('search').removeAttribute('aria-activedescendant');
}
function closeSuggestions() {
  $('search-suggestions').hidden = true;
  $('search').setAttribute('aria-expanded', 'false');
  $('search').removeAttribute('aria-activedescendant');
}
function chooseSuggestion(index) {
  const repo = searchSuggestions[index];
  if (!repo) return;
  $('search').value = `id:${repo.id}`;
  closeSuggestions();
  resetWindow();
  render();
}

function timestamp(value) {
  if (!value) return '--';
  const date = new Date(value);
  const pad = number => String(number).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}
function duration(ms) {
  const hours = Math.floor(ms / 3600000);
  return `${Math.floor(hours / 24)}d ${hours % 24}h ${Math.floor(ms / 60000) % 60}m`;
}
function percentColor(value) {
  const stops = [[239, 108, 111], [238, 151, 113], [229, 193, 119], [166, 207, 145], [125, 229, 196]];
  const scaled = Math.min(100, Math.max(0, value)) / 25;
  const index = Math.min(3, Math.floor(scaled));
  const fraction = scaled - index;
  return `rgb(${stops[index].map((channel, part) => Math.round(channel + (stops[index + 1][part] - channel) * fraction)).join(',')})`;
}
function percent(value) {
  const node = element('strong', value === null || value === undefined ? '--' : `${value}%`, 'estimate-number');
  if (value !== null && value !== undefined) node.style.color = percentColor(value);
  return node;
}
function detailsCell(items, repository, field = 'case') {
  const cell = element('td', undefined, 'details-cell');
  for (const [label, value] of items) {
    const block = element('div', undefined, 'cell-detail');
    block.append(element('small', label), attributeButton(label, element('span', value || '--'), repository, field,
      field === 'lifecycle' ? 'Timestamped observed case activity. Refresh reads saved data; re-examination reads the original without repairs.' :
        'Case notes describe scope and interpretation. Edit them in the full case panel; absence is not proof of no issue.'));
    cell.append(block);
  }
  return cell;
}
function pairCell(repo, field) {
  const cell = element('td', undefined, 'paired-cell');
  for (const kind of ['potential', 'current']) {
    const estimate = repo.estimates[kind];
    const block = element('div', undefined, `estimate-pair ${kind}`);
    block.title = `${estimate.rationale || 'Examination required'}${estimate.stale ? ' / STALE: re-examine and review' : ''}`;
    block.append(element('span', kind === 'potential' ? 'POTENTIAL ESTIMATE' : 'CURRENT ESTIMATE', 'estimate-badge'));
    if (field === 'recovery') {
      const line = element('div', undefined, 'dual-estimate');
      const recovery = element('div');
      recovery.append(element('small', 'Recovery'), percent(estimate.recovery));
      const confidence = element('div');
      confidence.append(element('small', 'Confidence'), percent(estimate.confidence));
      line.append(recovery, confidence);
      block.append(line);
    } else block.append(percent(estimate[field]));
    block.append(element('time', timestamp(estimate.examinationAt || estimate.at), 'examination-time'));
    if (estimate.stale) block.append(element('small', 'STALE / review required', 'stale'));
    cell.append(attributeButton(`${kind} ${field}`, block, repo, 'estimates',
      `${estimate.rationale || 'Examination required'}. Estimates remain subjective. Refresh saved data or explicitly re-examine the case.`));
  }
  return cell;
}

function element(tag, text, className) {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  if (className) node.className = className;
  return node;
}
async function api(route, input) {
  const response = await fetch(route, {
    method: input === undefined ? 'GET' : 'POST',
    headers: { 'X-Recovery-Token': token || '', 'Content-Type': 'application/json' },
    body: input === undefined ? undefined : JSON.stringify(input),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || `Request failed (${response.status})`);
  return result;
}
function announce(text, error = false) {
  $('notice').textContent = text;
  $('notice').classList.toggle('error', error);
  $('case-notice').textContent = text;
  $('case-notice').classList.toggle('error', error);
}
function selected() { return state?.repositories.find(repository => repository.id === selectedId); }
function busy() { return state?.job?.status === 'running'; }
function ready(repository, index) {
  if (index === 0) return true;
  if (index === 1) return Boolean(repository.records.inspection);
  if (index === 2) return Boolean(repository.records.preservation);
  if (index === 3) return repository.records.integrity?.passed === true;
  return repository.records.quality?.passed === true && repository.records.integrity?.passed === true;
}
function render() {
  layoutColumns();
  $('root').textContent = state.root;
  $('scan-time').textContent = `Discovered ${new Date(state.scannedAt).toLocaleString()}`;
  $('total').textContent = state.repositories.length;
  $('inspected').textContent = state.repositories.filter(repo => repo.records.inspection).length;
  $('preserved').textContent = state.repositories.filter(repo => repo.records.preservation).length;
  $('recovered').textContent = state.repositories.filter(repo => repo.records.recovery).length;
  $('rescan').disabled = busy();
  $('download-report').disabled = busy();
  const list = selectRepositories(state.repositories, $('search').value, preferences);
  currentWindow = listWindow(list, preferences, pageIndex, visibleLimit);
  renderGuidance(state, currentWindow.items);
  renderSimple(state);
  pageIndex = currentWindow.page;
  $('repositories').replaceChildren();
  for (const repo of currentWindow.items) {
    const row = element('tr', undefined, repo.id === selectedId ? 'selected' : '');
    row.dataset.repositoryId = repo.id;
    row.tabIndex = 0;
    row.setAttribute('aria-label', `${repo.name}; double-click or press Enter to expand case`);
    row.addEventListener('dblclick', event => {
      if (!event.target.closest('button,input,select,a')) openCase(repo);
    });
    row.addEventListener('keydown', event => {
      if (event.target === row && ['Enter', ' '].includes(event.key)) {
        event.preventDefault();
        openCase(repo);
      }
    });
    const name = element('td');
    const rowGrip = element('button', '⠿', 'row-grip');
    rowGrip.type = 'button';
    rowGrip.draggable = true;
    rowGrip.title = 'Drag this row to reorder. Or focus the grip and use Up/Down.';
    rowGrip.setAttribute('aria-label', `Move ${repo.name} row; Up/Down keys or drag`);
    rowGrip.addEventListener('dragstart', event => startDrag(event, 'row', repo.id));
    rowGrip.addEventListener('dragend', endDrag);
    rowGrip.addEventListener('keydown', event => {
      if (['ArrowUp', 'ArrowDown'].includes(event.key)) {
        event.preventDefault();
        reorderRows(repo.id, null, event.key === 'ArrowUp' ? -1 : 1);
      }
    });
    row.addEventListener('dragover', event => {
      if (dragging?.kind !== 'row') return;
      event.preventDefault();
      row.classList.add('drop-target');
    });
    row.addEventListener('dragleave', () => row.classList.remove('drop-target'));
    row.addEventListener('drop', event => {
      if (dragging?.kind !== 'row') return;
      event.preventDefault();
      const source = dragging.id;
      endDrag();
      reorderRows(source, repo.id);
    });
    name.append(rowGrip);
    const identity = element('span');
    identity.append(element('strong', repo.name), element('code', repo.id, 'repo-id'));
    name.append(attributeButton('Repository identity', identity, repo, 'identity',
      'This local ID identifies the discovered path, not a GitHub repository or identical contents in another copy.'));
    const meta = element('div', undefined, 'repo-meta');
    const condition = repo.lifecycle.status;
    meta.append(element('span', condition.replaceAll('-', ' '), `state-tag ${condition}`));
    if (repo.records.recovery) meta.append(element('span', 'baseline validated', 'state-tag clean-checkout'));
    name.append(meta);
    name.title = repo.path;
    name.append(element('small', `${repo.case.priority} / ${repo.case.owner || 'owner unassigned'}`, 'repo-owner'));
    row.append(name,
      detailsCell([['State', condition.replaceAll('-', ' ')], ['Updated at', timestamp(repo.lifecycle.updatedAt)],
        ['Unchanged since', timestamp(repo.lifecycle.unchangedSince)], ['Unchanged', duration(repo.lifecycle.unchangedMs)]], repo, 'lifecycle'),
      detailsCell([['Total stay', duration(repo.lifecycle.totalStayMs)], ['Delivered', timestamp(repo.lifecycle.deliveredAt)], ['Dismissed', timestamp(repo.lifecycle.dismissedAt)]], repo, 'lifecycle'),
      detailsCell([['Findings', repo.case.findings], ['Diagnosis', repo.case.diagnosis], ['Report', repo.case.report]], repo),
      pairCell(repo, 'condition'), pairCell(repo, 'quality'), pairCell(repo, 'recovery'),
      detailsCell([['The cure', repo.case.cure], ['Nonfixable', repo.case.nonfixable], ['Final report', repo.case.finalReport]], repo));
    const procedures = element('td', undefined, 'procedures-cell');
    for (const procedure of repo.procedures.slice(-3)) {
      const entry = element('div', undefined, 'procedure-summary');
      entry.append(element('strong', procedure.name), element('small', timestamp(procedure.at)),
        element('small', procedure.status), percent(procedure.helpingFactor));
      entry.title = procedure.rationale || 'Helping factor not reviewed';
      procedures.append(attributeButton(procedure.name, entry, repo, 'procedures', 'Reviewed helping factors are subjective; click to see all attempts and their evidence.'));
    }
    if (!repo.procedures.length) procedures.append(element('span', 'Not used yet', 'muted'));
    else procedures.append(element('small', `${repo.procedures.length} attempts / full list in medikit`));
    row.append(procedures);
    const extremes = procedureExtremes(repo.procedures);
    const extremeCell = element('td', undefined, 'procedure-extremes');
    for (const kind of ['best', 'worst']) {
      const procedure = extremes[kind];
      const block = element('div', undefined, 'procedure-summary');
      block.append(element('small', kind.toUpperCase()), element('strong', procedure?.name || 'Not rated'),
        percent(procedure?.helpingFactor), element('time', timestamp(procedure?.at)));
      if (procedure) block.title = procedure.rationale || 'Reviewer-rated helping factor';
      extremeCell.append(attributeButton(`${kind} procedure`, block, repo, 'procedures', 'Highest/lowest reviewed helping factor, not an inferred universal treatment ranking.'));
    }
    row.append(extremeCell);
    const action = element('td');
    const button = element('button', 'Medikit', 'secondary');
    button.setAttribute('aria-label', `Open medikit for ${repo.name}`);
    button.addEventListener('click', () => openCase(repo));
    action.append(button);
    row.append(action);
    const cells = new Map([...row.children].map((cell, index) => {
      cell.dataset.column = columns[index];
      return [columns[index], cell];
    }));
    row.replaceChildren(...preferences.columnOrder.map(key => cells.get(key)));
    $('repositories').append(row);
  }
  $('empty').hidden = list.length !== 0;
  $('list-count').textContent = list.length ? `${currentWindow.start + 1}–${currentWindow.end} of ${list.length} cases` : '0 matching cases';
  const paged = preferences.mode === 'pages';
  $('previous-page').hidden = !paged;
  $('next-page').hidden = !paged;
  $('previous-page').disabled = pageIndex === 0;
  $('next-page').disabled = !currentWindow.hasMore;
  $('page-status').textContent = paged ? `Page ${pageIndex + 1} of ${currentWindow.pages}` : currentWindow.hasMore ? 'More cases load as you scroll' : 'All matching cases shown';
  $('load-more').hidden = paged || !currentWindow.hasMore;
  loadObserver.unobserve($('load-sentinel'));
  if (!paged && currentWindow.hasMore) loadObserver.observe($('load-sentinel'));
  $('filter-panel').hidden = !preferences.filtersOpen;
  $('toggle-filters').setAttribute('aria-expanded', String(preferences.filtersOpen));
  const filterCount = Number(preferences.filter !== 'all') + Number(preferences.priority !== 'all') +
    Number(preferences.rated !== 'all') + Number(preferences.targetOnly);
  $('filter-count').textContent = filterCount ? String(filterCount) : '';
  renderMedikit();
}
function renderMedikit() {
  const repo = selected();
  $('steps').replaceChildren();
  $('evidence').disabled = !repo;
  $('selected-name').textContent = repo?.name || 'Choose a repository';
  $('selected-path').textContent = repo?.path || 'Open a medikit from the table to begin.';
  $('case-tools').hidden = !repo;
  $('case-copy-map').replaceChildren();
  $('case-next-note').textContent = repo ? nextStep(repo).detail : '';
  if (repo) {
    for (const [label, value] of [['Original · never a repair target', repo.path],
      ['Untouched backup', repo.records.preservation?.backup],
      ['Disposable working copy · approved changes go here', repo.records.preservation?.workingCopy]]) {
      const location = element('div');
      location.append(element('strong', label), element('code', value || 'Not verified yet'));
      $('case-copy-map').append(location);
    }
  }
  if (!repo) {
    $('stage-title').textContent = 'No repository selected';
    $('stage-description').textContent = 'Choose a repository to collect new evidence.';
    $('copy-fields').hidden = true;
    $('quality-fields').hidden = true;
    $('run-action').disabled = true;
    $('run-action').textContent = 'Choose a repository';
    return;
  }
  for (const [index, stage] of stages.entries()) {
    const record = repo.records[stage.key];
    const button = element('button', undefined, `step ${index === selectedStage ? 'active' : ''} ${record && record.passed !== false ? 'done' : ''}`);
    button.type = 'button';
    button.disabled = busy() || !ready(repo, index);
    button.append(element('span', record && record.passed !== false ? '\u2713' : String(index + 1).padStart(2, '0'), 'step-number'));
    const caption = element('span');
    caption.append(element('strong', stage.title), element('small', record?.at ? `Measured ${new Date(record.at).toLocaleString()}` : 'Evidence not collected'));
    button.append(caption, element('span', record?.passed === false ? 'FAILED' : record ? 'RECORDED' : ready(repo, index) ? 'READY' : 'GATED', 'step-state'));
    button.addEventListener('click', () => { selectedStage = index; renderMedikit(); });
    $('steps').append(button);
  }
  const stage = stages[selectedStage];
  $('stage-title').textContent = stage.title;
  $('stage-description').textContent = stage.description;
  $('copy-fields').hidden = stage.action !== 'preserve';
  $('quality-fields').hidden = stage.action !== 'quality';
  $('acceptance-field').hidden = stage.action !== 'recover';
  $('cancel-quality').hidden = !(busy() && state.job.action === 'quality');
  $('preview-quality').disabled = busy();
  $('run-workflow').disabled = busy() || !repo.records.inspection;
  $('run-action').textContent = busy() ? 'Medikit job running...' : stage.title;
  $('run-action').disabled = busy() || !ready(repo, selectedStage);
  const job = state.job;
  $('job-status').classList.toggle('error', job?.status === 'failed');
  $('job-status').textContent = job ? `${job.action}: ${job.status}${job.error ? ` - ${job.error}` : ''}` : 'No job running.';
  renderGuided(repo);
}
async function refresh() {
  state = await api('/api/state');
  if (!state.repositories.some(repo => repo.id === selectedId)) {
    selectedId = undefined;
    $('case-dialog').close();
  }
  render();
  renderWorkspace(state);
  if (!document.querySelector('#inline-kit-items .supply-card')) renderGlobalKit();
  if ($('global-kit').open && !document.querySelector('#global-kit-items .supply-card')) renderGlobalKit();
}
async function watchJob() {
  if (polling) return;
  polling = true;
  try {
    while (busy()) {
      await new Promise(resolve => setTimeout(resolve, 750));
      await refresh();
    }
    if (state.job?.status === 'failed') announce(state.job.error, true);
    else {
      announce(document.body.dataset.mode === 'simple' ? `Finished: ${state.job?.action ?? 'job'}. The result is saved locally; nothing was changed in your original.`
        : 'Evidence saved in local SQLite. Review results and rate the procedure helping factor.');
      if (state.job?.action === 'fix-preview') {
        const evidence = await api(`/api/evidence/${selectedId}`);
        fixPreview = evidence['fix-preview'];
        $('fix-preview').textContent = JSON.stringify(fixPreview, null, 2);
        $('apply-fix').disabled = false;
      }
    }
    populateTools();
  } catch (error) {
    announce(`Lost connection: ${error.message}. Refresh to reconnect; do not assume a job succeeded.`, true);
  } finally { polling = false; }
}
$('search').addEventListener('input', () => {
  resetWindow();
  if (state) render();
  renderSuggestions();
});
$('search').addEventListener('focus', renderSuggestions);
$('search').addEventListener('keydown', event => {
  if (event.key === 'Escape') {
    if (!$('search-suggestions').hidden) event.stopPropagation();
    closeSuggestions();
  } else if (['ArrowDown', 'ArrowUp'].includes(event.key) && searchSuggestions.length) {
    event.preventDefault();
    $('search-suggestions').hidden = false;
    $('search').setAttribute('aria-expanded', 'true');
    suggestionIndex = suggestionIndex < 0 ? event.key === 'ArrowDown' ? 0 : searchSuggestions.length - 1 :
      (suggestionIndex + (event.key === 'ArrowDown' ? 1 : -1) + searchSuggestions.length) % searchSuggestions.length;
    for (const [index, option] of [...$('search-suggestions').children].entries()) option.setAttribute('aria-selected', String(index === suggestionIndex));
    $('search').setAttribute('aria-activedescendant', `suggestion-${suggestionIndex}`);
  } else if (event.key === 'Enter' && suggestionIndex >= 0 && !$('search-suggestions').hidden) {
    event.preventDefault();
    chooseSuggestion(suggestionIndex);
  } else if (event.key === 'Tab') closeSuggestions();
});
document.addEventListener('pointerdown', event => { if (!event.target.closest('.smart-search')) closeSuggestions(); });
const controls = { sort: 'sort', filter: 'filter', 'priority-filter': 'priority', 'rated-filter': 'rated', 'list-mode': 'mode', 'page-size': 'pageSize', 'target-filter': 'targetOnly' };
for (const [id, key] of Object.entries(controls)) {
  $(id)[key === 'targetOnly' ? 'checked' : 'value'] = preferences[key];
  $(id).addEventListener('change', () => {
    preferences[key] = key === 'targetOnly' ? $(id).checked : key === 'pageSize' ? Number($(id).value) : $(id).value;
    resetWindow();
    savePreferences();
    if (state) render();
  });
}
$('toggle-filters').addEventListener('click', () => {
  preferences.filtersOpen = !preferences.filtersOpen;
  savePreferences();
  if (state) render();
});
$('reset-filters').addEventListener('click', () => {
  Object.assign(preferences, { filter: 'all', priority: 'all', rated: 'all', targetOnly: false });
  $('filter').value = 'all'; $('priority-filter').value = 'all'; $('rated-filter').value = 'all'; $('target-filter').checked = false;
  resetWindow(); savePreferences(); if (state) render();
});
$('previous-page').addEventListener('click', () => { pageIndex--; render(); $('portfolio').scrollIntoView({ block: 'start' }); });
$('next-page').addEventListener('click', () => { pageIndex++; render(); $('portfolio').scrollIntoView({ block: 'start' }); });
$('load-more').addEventListener('click', () => { visibleLimit += preferences.pageSize; render(); });
$('reset-layout').addEventListener('click', () => {
  preferences.columnOrder = [...columns];
  preferences.columnWidths = {};
  preferences.rowOrder = [];
  if (preferences.sort === 'manual') {
    preferences.sort = 'name';
    $('sort').value = 'name';
  }
  savePreferences();
  if (state) render();
  else layoutColumns();
  announce('Column widths and row/column order reset. Case data unchanged.');
});
function renderGlobalKit() {
  const supplies = [...(state?.catalog || [])];
  for (let index = supplies.length - 1; index > 0; index--) {
    const other = Math.floor(Math.random() * (index + 1));
    [supplies[index], supplies[other]] = [supplies[other], supplies[index]];
  }
  $('global-kit-items').replaceChildren();
  $('inline-kit-items').replaceChildren();
  if (!supplies.length) $('global-kit-items').append(element('p', 'The procedure catalog is loading. Setup, docs and source links above are already available.'));
  for (const [index, item] of supplies.entries()) {
    const card = element('a', undefined, 'supply-card');
    card.href = `/guide/${encodeURIComponent(item.id)}`;
    card.target = '_blank';
    card.rel = 'noreferrer';
    card.append(element('span', '+', 'supply-icon'), element('strong', item.name),
      element('p', item.description), element('small', 'Read procedure, script and setup →'));
    $('global-kit-items').append(card);
    if (index < 3) $('inline-kit-items').append(card.cloneNode(true));
  }
}
$('open-global-kit').addEventListener('click', () => {
  renderGlobalKit();
  $('global-kit').showModal();
});
$('close-global-kit').addEventListener('click', () => $('global-kit').close());
$('shuffle-kit').addEventListener('click', renderGlobalKit);
$('shuffle-inline-kit').addEventListener('click', renderGlobalKit);
$('close-attribute').addEventListener('click', () => $('attribute-dialog').close());
$('refresh-attribute').addEventListener('click', async () => {
  try {
    await refresh();
    showAttribute();
    $('attribute-status').textContent = 'Saved SQLite case data refreshed. No examination or procedure was run.';
  } catch (error) { $('attribute-status').textContent = error.message; announce(error.message, true); }
});
$('examine-attribute').addEventListener('click', async () => {
  if (!attributeContext || busy()) return;
  try {
    selectedId = attributeContext.id;
    await api('/api/task', { repositoryId: attributeContext.id, action: 'inspect' });
    await refresh();
    showAttribute();
    $('attribute-status').textContent = 'Read-only examination running; downstream evidence invalidated.';
    await watchJob();
    showAttribute();
    $('attribute-status').textContent = state.job.status === 'failed' ? state.job.error : 'Examination complete. Estimates and findings refreshed.';
  } catch (error) { $('attribute-status').textContent = error.message; announce(error.message, true); }
});
$('attribute-open-case').addEventListener('click', () => {
  const repo = state.repositories.find(item => item.id === attributeContext?.id);
  if (!repo) return;
  $('attribute-dialog').close();
  openCase(repo);
});
$('close-case').addEventListener('click', () => $('case-dialog').close());
$('case-dialog').addEventListener('click', event => {
  if (event.target === $('case-dialog')) {
    const rect = $('case-dialog').getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) $('case-dialog').close();
  }
});
$('case-dialog').addEventListener('close', () => {
  const row = document.querySelector(`tr[data-repository-id="${selectedId}"]`);
  const card = [...document.querySelectorAll(`[data-case-open="${selectedId}"]`)].find(item => item.offsetParent !== null);
  ($('detailed-case-table').hidden ? card || $('search') : row || card || $('search')).focus();
});
$('rescan').addEventListener('click', async () => {
  if (!confirm('Rescan directory and reset all current score gates? Saved scores must not be reused for changed sources.')) return;
  try {
    await api('/api/rescan', {});
    await refresh();
    if ($('global-kit').open) renderGlobalKit();
    announce('Directory rescanned. Scores are provisional until new evidence is collected.');
  } catch (error) { announce(error.message, true); }
});
async function download(route, filename) {
  const response = await fetch(route, { headers: { 'X-Recovery-Token': token } });
  if (!response.ok) throw new Error((await response.json()).error || `Report export failed (${response.status})`);
  const url = URL.createObjectURL(await response.blob());
  const link = element('a');
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  announce('Markdown report downloaded from saved evidence. No scan or repair ran. Review private paths before sharing.');
}
$('download-report').addEventListener('click', async () => {
  try { await download('/api/report.md', 'recovery-assessment.md'); }
  catch (error) { announce(error.message, true); }
});
$('action-form').addEventListener('submit', async event => {
  event.preventDefault();
  const repo = selected();
  if (!repo || busy()) return;
  const action = stages[selectedStage].action;
  try {
    if (action === 'quality' && $('profile').value !== 'documentation' && (!validationPreview || !$('approve').checked)) throw new Error('Preview and explicitly approve validation commands first.');
    if (action === 'preserve' && (!$('backup').value.trim() || !$('working-copy').value.trim())) throw new Error('Enter both independent copy paths.');
    const input = { repositoryId: repo.id, action, backup: $('backup').value.trim(), workingCopy: $('working-copy').value.trim(),
      ...(action === 'quality' ? validationInput() : {}), approved: $('approve').checked,
      planHash: validationPreview?.planHash, acceptance: $('recovery-acceptance').value.trim() };
    await api('/api/task', input);
    $('approve').checked = false;
    await refresh();
    announce('Medikit job running. The server remains responsive; evidence gates update only after completion.');
    await watchJob();
    validationPreview = null;
  } catch (error) { announce(error.message, true); }
});
$('evidence').addEventListener('click', async () => {
  try {
    $('evidence-content').textContent = JSON.stringify(await api(`/api/evidence/${selectedId}`), null, 2);
    $('evidence-dialog').showModal();
  } catch (error) { announce(error.message, true); }
});
$('close-dialog').addEventListener('click', () => $('evidence-dialog').close());
const workspaceError = initializeWorkspace({ announce, resetTable: () => $('reset-layout').click() });
initializeGuidance(openCase);
initializeSimple({ api, refresh, watchJob, openCase, announce, download, selected, getState: () => state });
$('refresh-saved').addEventListener('click', async () => {
  try { await refresh(); announce('Saved evidence refreshed. No gates reset and no procedure started.'); if (busy() && !polling) await watchJob(); }
  catch (error) { announce(error.message, true); }
});
(async () => {
  try {
    ({ token } = await api('/api/session'));
    await refresh();
    announce(preferenceError || workspaceError || `${state.repositories.length} cases ready. ${state.skipped.length} ordinary or linked directories excluded.`, Boolean(preferenceError || workspaceError));
    if (busy()) await watchJob();
  } catch (error) { announce(`Dashboard unavailable: ${error.message}`, true); }
})();

function populateTools() {
  const repo = selected();
  if (!repo) return;
  if (!fixPreview) {
    $('fix-preview').textContent = 'No current preview. Choose a script and preview its changes first.';
    $('apply-fix').disabled = true;
  }
  for (const [key, value] of Object.entries(repo.case)) {
    const input = $('case-form').elements.namedItem(key);
    if (input) input.value = value;
  }
  $('deliver').disabled = busy() || !repo.records.recovery;
  $('dismiss').disabled = busy();
  $('remedy').replaceChildren();
  for (const remedy of state.remedies) {
    const option = element('option', remedy.name);
    option.value = remedy.id;
    option.title = remedy.description;
    $('remedy').append(option);
  }
  $('procedure-list').replaceChildren();
  $('procedure-select').replaceChildren();
  for (const procedure of repo.procedures) {
    const entry = element('article', undefined, 'procedure-entry');
    entry.append(element('strong', procedure.name), element('time', timestamp(procedure.at)),
      element('span', procedure.status), percent(procedure.helpingFactor),
      element('p', procedure.rationale || 'Helping factor not assessed; review after examination.'));
    if (procedure.ratedAt) entry.append(element('p', `Helping factor reviewed at ${timestamp(procedure.ratedAt)}`));
    if (procedure.error) entry.append(element('p', procedure.error, 'warning'));
    if (procedure.evidenceId) {
      const evidence = element('button', 'Read archived attempt', 'secondary');
      evidence.type = 'button';
      evidence.addEventListener('click', async () => {
        try {
          $('evidence-content').textContent = JSON.stringify(await api(`/api/attempt/${procedure.evidenceId}`), null, 2);
          $('evidence-dialog').showModal();
        } catch (error) { announce(error.message, true); }
      });
      entry.append(evidence);
    }
    $('procedure-list').append(entry);
    const option = element('option', `${timestamp(procedure.at)} / ${procedure.name}`);
    option.value = procedure.id;
    $('procedure-select').append(option);
  }
  $('procedure-form').querySelector('button').disabled = !repo.procedures.length || busy();
}
for (const button of document.querySelectorAll('[data-tab]')) {
  button.addEventListener('click', () => {
    for (const tab of document.querySelectorAll('[data-tab]')) {
      const active = tab === button;
      tab.setAttribute('aria-selected', String(active));
      $(tab.dataset.tab).hidden = !active;
    }
  });
}
async function saveCase(input) {
  if (!selected() || busy()) throw new Error('Select a repository and wait for active jobs.');
  await api('/api/case', { repositoryId: selectedId, ...input });
  await refresh();
  populateTools();
  announce('Case saved in SQLite.');
}
$('case-form').addEventListener('submit', async event => {
  event.preventDefault();
  try { await saveCase({ type: 'notes', ...Object.fromEntries(new FormData(event.target)) }); }
  catch (error) { announce(error.message, true); }
});
$('estimate-form').addEventListener('submit', async event => {
  event.preventDefault();
  const input = Object.fromEntries(new FormData(event.target));
  for (const key of ['condition', 'quality', 'confidence']) input[key] = Number(input[key]);
  try { await saveCase({ type: 'estimates', ...input }); }
  catch (error) { announce(error.message, true); }
});
for (const type of ['deliver', 'dismiss']) $(type).addEventListener('click', async () => {
  try { await saveCase({ type }); } catch (error) { announce(error.message, true); }
});
$('procedure-form').addEventListener('submit', async event => {
  event.preventDefault();
  const input = Object.fromEntries(new FormData(event.target));
  input.helpingFactor = Number(input.helpingFactor);
  try { await saveCase({ type: 'procedure-rating', ...input }); }
  catch (error) { announce(error.message, true); }
});
$('fix-form').addEventListener('input', () => {
  fixPreview = null;
  $('apply-fix').disabled = true;
  $('approve-fix').checked = false;
});
$('fix-form').addEventListener('submit', async event => {
  event.preventDefault();
  try {
    if (!selected() || busy()) throw new Error('Select a repository; wait for active jobs.');
    fixInput = Object.fromEntries(new FormData(event.target));
    fixPreview = null;
    $('apply-fix').disabled = true;
    await api('/api/task', { repositoryId: selectedId, action: 'fix-preview', ...fixInput });
    await refresh();
    await watchJob();
  } catch (error) { announce(error.message, true); }
});
$('apply-fix').addEventListener('click', async () => {
  try {
    if (!fixPreview || !$('approve-fix').checked) throw new Error('Approve the exact fix preview first.');
    await api('/api/task', { repositoryId: selectedId, action: 'fix-apply', ...fixInput, approved: true, planHash: fixPreview.planHash });
    fixPreview = null;
    $('apply-fix').disabled = true;
    $('approve-fix').checked = false;
    await refresh();
    await watchJob();
  } catch (error) { announce(error.message, true); }
});

function resetValidation() {
  validationPreview = null;
  $('approve').checked = false;
  $('quality-preview').textContent = 'Preview commands before approving code execution.';
  $('custom-checks').hidden = $('profile').value !== 'custom';
}
function validationInput() {
  return { profile: $('profile').value, timeoutSeconds: Number($('check-timeout').value),
    ...($('profile').value === 'custom' ? { commands: JSON.parse($('check-commands').value) } : {}) };
}
for (const id of ['profile', 'check-timeout', 'check-commands']) $(id).addEventListener('input', resetValidation);
$('preview-quality').addEventListener('click', async () => {
  try {
    if (!selected() || busy()) throw new Error('Select a case and wait for active jobs.');
    resetValidation();
    await api('/api/task', { repositoryId: selectedId, action: 'quality-preview', ...validationInput() });
    await refresh();
    await watchJob();
    validationPreview = (await api(`/api/evidence/${selectedId}`))['quality-preview'] || null;
    $('quality-preview').textContent = JSON.stringify(validationPreview || { error: state.job.error }, null, 2);
  } catch (error) { announce(error.message, true); }
});
$('cancel-quality').addEventListener('click', async () => {
  try { announce((await api('/api/cancel', {})).message); }
  catch (error) { announce(error.message, true); }
});
function resetWorkflow() {
  workflowPreview = null;
  workflowInput = null;
  $('apply-workflow').disabled = true;
  $('approve-workflow').checked = false;
  for (const field of document.querySelectorAll('[data-workflow]')) {
    field.hidden = !field.dataset.workflow.split(' ').includes($('workflow-action').value);
  }
}
$('workflow-form').addEventListener('input', resetWorkflow);
function showWorkflow(record) {
  $('workflow-output').textContent = JSON.stringify(record, null, 2);
  $('history-files').replaceChildren();
  if (record?.commits) {
    $('history-refs').replaceChildren();
    const seen = new Set();
    for (const item of [...record.commits, ...record.reflog, ...record.unreachable.map(commit => ({ commit, subject: 'Unreachable object' }))]) {
      if (seen.has(item.commit)) continue;
      seen.add(item.commit);
      const option = element('option', item.subject);
      option.value = item.commit;
      $('history-refs').append(option);
    }
  }
  if (record?.files && Array.isArray(record.files)) {
    const candidates = record.files.filter(file => ['missing', 'changed'].includes(file.state));
    $('history-files').append(element('p', `${candidates.length} missing/changed paths; first 500 selectable below. Full comparison is in Evidence.`));
    for (const file of candidates.slice(0, 500)) {
      const button = element('button', `${file.state}: ${file.file}`, 'secondary history-file');
      button.type = 'button';
      button.addEventListener('click', () => {
        $('workflow-action').value = 'restore-preview';
        $('workflow-ref').value = record.commit;
        $('workflow-file').value = file.file;
        resetWorkflow();
        announce('Historical file selected. Preview its exact bytes before approving restoration.');
      });
      $('history-files').append(button);
    }
  }
}
$('workflow-form').addEventListener('submit', async event => {
  event.preventDefault();
  try {
    if (!selected() || busy()) throw new Error('Select a case and wait for active jobs.');
    resetWorkflow();
    workflowInput = {
      repositoryId: selectedId, action: $('workflow-action').value,
      backup: $('workflow-backup').value.trim(), workingCopy: $('workflow-working').value.trim(),
      ref: $('workflow-ref').value.trim(), file: $('workflow-file').value.trim(),
      branch: $('workflow-branch').value.trim(), remote: $('workflow-remote').value.trim(),
      networkApproved: $('approve-network').checked,
    };
    const submitted = workflowInput;
    await api('/api/task', submitted);
    await refresh();
    await watchJob();
    const result = (await api(`/api/evidence/${selectedId}`))[submitted.action];
    showWorkflow(result || { error: state.job.error });
    workflowPreview = workflowInput === submitted && state.job.status === 'completed' && workflowApply[submitted.action] ? result : null;
    $('apply-workflow').disabled = !workflowPreview;
  } catch (error) { announce(error.message, true); }
});
$('apply-workflow').addEventListener('click', async () => {
  try {
    if (busy() || !workflowPreview || workflowInput?.repositoryId !== selectedId || !$('approve-workflow').checked) throw new Error('Approve the exact current preview for this case first.');
    const action = workflowApply[workflowInput.action];
    const input = { ...workflowInput, action, approved: true, planHash: workflowPreview.planHash };
    resetWorkflow();
    await api('/api/task', input);
    await refresh();
    await watchJob();
    const records = await api(`/api/evidence/${selectedId}`);
    const result = records[action === 'acquire-apply' ? 'preservation' : action];
    showWorkflow(result?.baseline ? { at: result.at, backup: result.backup, workingCopy: result.workingCopy,
      files: Object.keys(result.baseline.files).length, passed: result.passed } : result || { error: state.job.error });
    if (action === 'acquire-apply' && result) {
      $('backup').value = result.backup;
      $('working-copy').value = result.workingCopy;
      selectedStage = 2;
      renderMedikit();
    }
    resetValidation();
  } catch (error) { announce(error.message, true); }
});
