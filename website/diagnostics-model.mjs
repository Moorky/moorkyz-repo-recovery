const day = 86400000;
export const navigationIds = ['introduction', 'cases', 'diagnostics'];
export const sectionGroup = { medkit: 'introduction', overview: 'introduction', cases: 'cases',
  estimates: 'diagnostics', procedures: 'diagnostics', lifecycle: 'diagnostics' };

export function dateBounds(from = '', through = '') {
  function parse(value) {
    if (!value) return null;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error('Use calendar dates.');
    const time = Date.parse(`${value}T00:00:00Z`);
    if (!Number.isFinite(time) || new Date(time).toISOString().slice(0, 10) !== value) throw new Error('Invalid calendar date.');
    return time;
  }
  const start = parse(from);
  const endDate = parse(through);
  if (start !== null && endDate !== null && start > endDate) throw new Error('Start date must not follow end date.');
  return { start, end: endDate === null ? null : endDate + day };
}

export function diagnostics(repositories, { from = '', through = '', group = 'state' } = {}) {
  if (!['state', 'owner', 'priority'].includes(group)) throw new Error('Unknown case grouping.');
  const bounds = dateBounds(from, through);
  const bounded = bounds.start !== null || bounds.end !== null;
  function time(value) {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/.test(value)) return null;
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  const matches = value => {
    const at = time(value);
    return at !== null && (bounds.start === null || at >= bounds.start) && (bounds.end === null || at < bounds.end);
  };
  let unknown = 0;
  const selected = [];
  const groups = new Map();
  for (const repo of repositories) {
    const examination = repo.records?.inspection?.at;
    const attempts = repo.procedures || [];
    if (![examination, ...attempts.map(attempt => attempt.at)].some(value => time(value) !== null)) unknown++;
    if (bounded && !matches(examination) && !attempts.some(attempt => matches(attempt.at))) continue;
    const copy = { ...repo, procedures: bounded ? attempts.filter(attempt => matches(attempt.at)) : attempts };
    // Procedure-only matches must not pull an out-of-range examination into estimate averages.
    if (bounded && !matches(examination)) copy.estimates = {};
    selected.push(copy);
    const label = group === 'state' ? repo.lifecycle?.status || 'awaiting-examination' : repo.case?.[group]?.trim() || 'unassigned';
    groups.set(label, (groups.get(label) || 0) + 1);
  }
  return { repositories: selected, groups: [...groups].sort(([a], [b]) => a.localeCompare(b)), unknown,
    excluded: repositories.length - selected.length, bounded, from, through, group };
}

// ASCII-only built-in Helvetica PDF: data is text, never PDF operators or HTML.
export function diagnosticsPdf(result) {
  const clean = value => String(value).replace(/[^\x20-\x7e]/g, '?').replace(/[\\()]/g, '\\$&');
  const lines = ['Moorkyz recovery diagnostics', `UTC dates: ${result.from || 'unbounded'} through ${result.through || 'unbounded'}`,
    `Cases: ${result.repositories.length}; excluded: ${result.excluded}; unknown-time cases: ${result.unknown}`,
    'Saved examinations and procedures only. Unknown is not zero.',
    'Not an AI model evaluation or a success probability.', `Grouping: ${result.group}`,
    ...result.groups.map(([label, count]) => `${label}: ${count}`),
    ...result.repositories.map(repo => `${repo.name} | ${repo.lifecycle?.status || 'awaiting-examination'} | procedures: ${repo.procedures.length}`)];
  const clipped = lines.slice(0, 999);
  if (lines.length > 999) clipped.push('Report truncated at 1000 lines; narrow the date range.');
  const pages = [];
  for (let index = 0; index < clipped.length; index += 48) pages.push(clipped.slice(index, index + 48));
  const objects = ['', '<< /Type /Catalog /Pages 2 0 R >>', '',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'];
  const ids = [];
  for (const page of pages) {
    const id = objects.length;
    ids.push(id);
    objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 3 0 R >> >> /Contents ${id + 1} 0 R >>`);
    const stream = `BT /F1 10 Tf 14 TL 40 750 Td\n${page.map((line, i) => `${i ? 'T* ' : ''}(${clean(line.slice(0, 100))}) Tj`).join('\n')}\nET\n`;
    objects.push(`<< /Length ${stream.length} >>\nstream\n${stream}endstream`);
  }
  objects[2] = `<< /Type /Pages /Count ${ids.length} /Kids [${ids.map(id => `${id} 0 R`).join(' ')}] >>`;
  let output = '%PDF-1.4\n';
  const offsets = [0];
  for (let i = 1; i < objects.length; i++) {
    offsets.push(output.length);
    output += `${i} 0 obj\n${objects[i]}\nendobj\n`;
  }
  const xref = output.length;
  output += `xref\n0 ${objects.length}\n0000000000 65535 f \n`;
  output += offsets.slice(1).map(offset => `${String(offset).padStart(10, '0')} 00000 n \n`).join('');
  output += `trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return new TextEncoder().encode(output);
}
