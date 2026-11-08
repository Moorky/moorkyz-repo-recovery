import fs from 'node:fs';
import path from 'node:path';

const folders = new Set(['src', 'scripts', 'tests', 'website', 'docs', '.github']);
const rootFiles = new Set(['README.md', 'CHANGELOG.md', 'PUBLICATION_STATUS.md', 'AGENTS.md', 'AGENT_SCHEDULER.md', 'CONTRIBUTING.md', 'SECURITY.md', 'LICENSE',
  'package.json', 'DASHBOARD.cmd', 'RUN.cmd', '.editorconfig', '.gitattributes', '.gitignore', '.node-version']);
const textExtensions = new Set(['.md', '.mjs', '.js', '.css', '.html', '.json', '.ps1', '.cmd', '.yml', '.yaml']);
const assets = new Set([path.join('website', 'fonts', 'DMMono-Regular.ttf'), path.join('website', 'fonts', 'OFL.txt'),
  path.join('website', 'favicon.svg')]);
// Synthetic-demo screenshots only; no other binary paths are exported.
const screenshot = name => path.dirname(name) === path.join('docs', 'assets') && path.extname(name) === '.png';

function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

export function sourceArchive(root) {
  const files = [];
  let size = 0;
  function visit(folder, relative = '') {
    for (const entry of fs.readdirSync(folder, { withFileTypes: true })) {
      const name = path.join(relative, entry.name);
      const file = path.join(folder, entry.name);
      if (entry.isSymbolicLink()) continue;
      if (entry.isDirectory()) {
        if ((relative === '' && folders.has(entry.name)) ||
          (relative !== '' && !['sources', 'node_modules', '.git', '.archive', '.logs'].includes(entry.name) && !entry.name.startsWith('.'))) visit(file, name);
      } else if (entry.isFile() && (assets.has(name) || screenshot(name) || (relative === '' ? rootFiles.has(entry.name) : !entry.name.startsWith('.') && textExtensions.has(path.extname(entry.name))))) {
        const length = fs.statSync(file).size;
        size += length;
        if (length > 8 * 1024 * 1024 || size > 32 * 1024 * 1024) throw new Error('Source archive exceeds the safe export size limit.');
        if (files.length >= 4096) throw new Error('Source archive exceeds 4096 files.');
        files.push({ name: `moorkyz-repo-recovery/${name.split(path.sep).join('/')}`, bytes: fs.readFileSync(file) });
      }
    }
  }
  visit(root);
  const local = [];
  const central = [];
  let offset = 0;
  for (const file of files) {
    const name = Buffer.from(file.name);
    const checksum = crc32(file.bytes);
    const header = Buffer.alloc(30);
    header.writeUInt32LE(0x04034b50, 0); header.writeUInt16LE(20, 4);
    header.writeUInt16LE(0x800, 6); header.writeUInt16LE(33, 12);
    header.writeUInt32LE(checksum, 14); header.writeUInt32LE(file.bytes.length, 18);
    header.writeUInt32LE(file.bytes.length, 22); header.writeUInt16LE(name.length, 26);
    local.push(header, name, file.bytes);
    const directory = Buffer.alloc(46);
    directory.writeUInt32LE(0x02014b50, 0); directory.writeUInt16LE(20, 4); directory.writeUInt16LE(20, 6);
    directory.writeUInt16LE(0x800, 8); directory.writeUInt16LE(33, 14);
    directory.writeUInt32LE(checksum, 16); directory.writeUInt32LE(file.bytes.length, 20);
    directory.writeUInt32LE(file.bytes.length, 24); directory.writeUInt16LE(name.length, 28);
    directory.writeUInt32LE(offset, 42);
    central.push(directory, name);
    offset += header.length + name.length + file.bytes.length;
  }
  const directory = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(files.length, 8); end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(directory.length, 12); end.writeUInt32LE(offset, 16);
  return Buffer.concat([...local, directory, end]);
}
