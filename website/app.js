'use strict';

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
function scoreCell(score) {
  const cell = element('td');
  cell.title = score.scope;
  cell.append(element('span', score.value === null ? '--' : String(score.value), `score-value ${score.status}`));
  cell.append(element('span', score.status === 'final' ? 'MEASURED FINAL' : score.status.toUpperCase(), 'score-status'));
  if (score.value !== null) {
    const bar = element('div', undefined, 'score-bar');
    const fill = element('span', undefined, score.status);
    fill.style.width = `${Math.max(0, Math.min(100, score.value))}%`;
    bar.append(fill);
    cell.append(bar);
  }
  return cell;
}
function render() {
  $('root').textContent = state.root;
  $('scan-time').textContent = `Discovered ${new Date(state.scannedAt).toLocaleString()}`;
  $('total').textContent = state.repositories.length;
  $('inspected').textContent = state.repositories.filter(repo => repo.records.inspection).length;
  $('preserved').textContent = state.repositories.filter(repo => repo.records.preservation).length;
  $('recovered').textContent = state.repositories.filter(repo => repo.records.recovery).length;
  $('rescan').disabled = busy();
  const query = $('search').value.toLowerCase();
  const filter = $('filter').value;
  const list = state.repositories.filter(repo => {
    const condition = repo.records.inspection?.state || 'pending';
    return `${repo.name} ${repo.path}`.toLowerCase().includes(query) &&
      (filter === 'all' || (filter === 'recovered' ? Boolean(repo.records.recovery) : condition === filter));
  });
  list.sort((a, b) => $('sort').value === 'name' ? a.name.localeCompare(b.name) :
    (a.scores[$('sort').value].value ?? -1) - (b.scores[$('sort').value].value ?? -1));
  $('repositories').replaceChildren();
  for (const repo of list) {
    const row = element('tr', undefined, repo.id === selectedId ? 'selected' : '');
    const name = element('td');
    name.append(element('strong', repo.name));
    const meta = element('div', undefined, 'repo-meta');
    const condition = repo.records.inspection?.state || (repo.empty ? 'empty / pending' : 'pending');
    meta.append(element('span', condition.replaceAll('-', ' '), `state-tag ${condition}`));
    if (repo.records.recovery) meta.append(element('span', 'baseline validated', 'state-tag clean-checkout'));
    name.append(meta);
    name.title = repo.path;
    row.append(name, scoreCell(repo.scores.condition), scoreCell(repo.scores.quality), scoreCell(repo.scores.recovery), scoreCell(repo.scores.confidence));
    const action = element('td');
    const button = element('button', 'Medikit', 'secondary');
    button.setAttribute('aria-label', `Open medikit for ${repo.name}`);
    button.addEventListener('click', () => {
      selectedId = repo.id;
      selectedStage = Math.max(0, stages.findIndex(stage => !repo.records[stage.key] || repo.records[stage.key].passed === false));
      $('backup').value = '';
      $('working-copy').value = '';
      $('approve').checked = false;
      render();
      $('medikit').scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
    });
    action.append(button);
    row.append(action);
    $('repositories').append(row);
  }
  $('empty').hidden = list.length !== 0;
  renderMedikit();
}
function renderMedikit() {
  const repo = selected();
  $('steps').replaceChildren();
  $('evidence').disabled = !repo;
  $('selected-name').textContent = repo?.name || 'Choose a repository';
  $('selected-path').textContent = repo?.path || 'Open a medikit from the table to begin.';
  if (!repo) return;
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
  $('run-action').textContent = busy() ? 'Medikit job running...' : stage.title;
  $('run-action').disabled = busy() || !ready(repo, selectedStage);
  const job = state.job;
  $('job-status').classList.toggle('error', job?.status === 'failed');
  $('job-status').textContent = job ? `${job.action}: ${job.status}${job.error ? ` - ${job.error}` : ''}` : 'No job running.';
}
async function refresh() {
  state = await api('/api/state');
  if (!state.repositories.some(repo => repo.id === selectedId)) selectedId = undefined;
  render();
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
    else announce('Evidence saved locally. Review the results before moving to the next gate.');
  } catch (error) {
    announce(`Lost connection: ${error.message}. Refresh to reconnect; do not assume a job succeeded.`, true);
  } finally { polling = false; }
}
for (const id of ['search', 'filter', 'sort']) $(id).addEventListener(id === 'search' ? 'input' : 'change', render);
$('rescan').addEventListener('click', async () => {
  if (!confirm('Rescan directory and reset all current score gates? Saved scores must not be reused for changed sources.')) return;
  try {
    await api('/api/rescan', {});
    await refresh();
    announce('Directory rescanned. Scores are provisional until new evidence is collected.');
  } catch (error) { announce(error.message, true); }
});
$('action-form').addEventListener('submit', async event => {
  event.preventDefault();
  const repo = selected();
  if (!repo || busy()) return;
  const action = stages[selectedStage].action;
  try {
    if (action === 'quality' && $('profile').value === 'node' && !$('approve').checked) throw new Error('Explicit script execution approval is required.');
    if (action === 'preserve' && (!$('backup').value.trim() || !$('working-copy').value.trim())) throw new Error('Enter both independent copy paths.');
    const input = { repositoryId: repo.id, action, backup: $('backup').value.trim(), workingCopy: $('working-copy').value.trim(), profile: $('profile').value, approved: $('approve').checked };
    await api('/api/task', input);
    $('approve').checked = false;
    await refresh();
    announce('Medikit job running. The server remains responsive; evidence gates update only after completion.');
    await watchJob();
  } catch (error) { announce(error.message, true); }
});
$('evidence').addEventListener('click', async () => {
  try {
    $('evidence-content').textContent = JSON.stringify(await api(`/api/evidence/${selectedId}`), null, 2);
    $('evidence-dialog').showModal();
  } catch (error) { announce(error.message, true); }
});
$('close-dialog').addEventListener('click', () => $('evidence-dialog').close());
(async () => {
  try {
    ({ token } = await api('/api/session'));
    await refresh();
    announce(`Directory discovery only. ${state.skipped.length} linked paths skipped. Scores are timestamped observations; rescan after changes.`);
    if (busy()) await watchJob();
  } catch (error) { announce(`Dashboard unavailable: ${error.message}`, true); }
})();
