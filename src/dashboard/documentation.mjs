const escape = text => String(text).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
function inline(text) {
  return text.split(/(`[^`]+`|\[[^\]]+\]\([^)]+\)|\*\*[^*]+\*\*)/g).map(part => {
    if (part.startsWith('`') && part.endsWith('`')) return `<code>${escape(part.slice(1, -1))}</code>`;
    if (part.startsWith('**') && part.endsWith('**')) return `<strong>${escape(part.slice(2, -2))}</strong>`;
    const link = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(part);
    if (link) {
      const [file, fragment] = link[2].split('#');
      const route = { 'USER_GUIDE.md': '/manual', 'GUIDED_RECOVERY.md': '/workflow', 'DASHBOARD.md': '/docs',
        '../README.md': '/setup', 'README.md': '/docs' }[file];
      if (route) link[2] = route + (fragment ? `#${fragment}` : '');
    }
    if (link && /^(?:https?:\/\/|#[a-zA-Z0-9_-]+$|\/(?:manual|workflow|docs|setup)(?:#[a-zA-Z0-9_-]+)?$)/.test(link[2])) {
      return `<a href="${escape(link[2])}" rel="noreferrer">${escape(link[1])}</a>`;
    }
    return escape(part);
  }).join('');
}
export function renderDocumentation(markdown) {
  const output = [], contents = [], used = new Map();
  let code = null, list = null, paragraph = [], table = false;
  function flush() { if (paragraph.length) output.push(`<p>${inline(paragraph.join(' '))}</p>`); paragraph = []; }
  function closeBlocks() { flush(); if (list) output.push(`</${list}>`); list = null; if (table) output.push('</tbody></table></div>'); table = false; }
  for (const line of markdown.split(/\r?\n/)) {
    if (/^```/.test(line)) {
      if (code !== null) { output.push(`<pre><code>${escape(code.join('\n'))}</code></pre>`); code = null; }
      else { closeBlocks(); code = []; }
      continue;
    }
    if (code !== null) { code.push(line); continue; }
    const heading = /^(#{1,4})\s+(.+)$/.exec(line);
    if (heading) {
      closeBlocks();
      const slug = heading[2].toLowerCase().replace(/[^a-z0-9 -]/g, '').trim().replace(/\s+/g, '-');
      const count = used.get(slug) ?? 0; used.set(slug, count + 1);
      const id = `${slug || 'section'}${count ? `-${count}` : ''}`;
      const level = heading[1].length;
      output.push(`<h${level} id="${id}">${inline(heading[2])}</h${level}>`);
      if (level === 2) contents.push(`<li><a href="#${id}">${escape(heading[2])}</a></li>`);
    } else if (line.trim().startsWith('|') && line.trim().endsWith('|')) {
      flush();
      if (/^\s*\|[\s:|-]+\|\s*$/.test(line)) continue;
      const cells = line.trim().slice(1, -1).split('|').map(cell => cell.trim());
      if (!table) { if (list) output.push(`</${list}>`); list = null; output.push('<div class="manual-table"><table><thead><tr>' + cells.map(cell => `<th scope="col">${inline(cell)}</th>`).join('') + '</tr></thead><tbody>'); table = true; }
      else output.push('<tr>' + cells.map(cell => `<td>${inline(cell)}</td>`).join('') + '</tr>');
    } else if (/^\s*(?:[-*]|\d+\.)\s+/.test(line)) {
      flush(); if (table) { output.push('</tbody></table></div>'); table = false; }
      const kind = /^\s*\d+\./.test(line) ? 'ol' : 'ul';
      if (list !== kind) { if (list) output.push(`</${list}>`); output.push(`<${kind}>`); list = kind; }
      output.push(`<li>${inline(line.replace(/^\s*(?:[-*]|\d+\.)\s+/, ''))}</li>`);
    } else if (!line.trim()) closeBlocks();
    else { if (list || table) closeBlocks(); paragraph.push(line.trim()); }
  }
  closeBlocks();
  if (code !== null) output.push(`<pre><code>${escape(code.join('\n'))}</code></pre>`);
  return `<nav class="manual-contents" aria-label="On this page"><strong>On this page</strong><ul>${contents.join('')}</ul></nav>${output.join('\n')}`;
}
