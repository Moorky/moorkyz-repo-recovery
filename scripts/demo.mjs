import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readGit, containedBy, projectRoot } from '../src/recovery.mjs';

// Builds a disposable portfolio of small Git repositories with known, reproducible damage.
// Everything is synthetic; nothing outside the chosen new folder is touched.

function repository(root, name, hooks) {
  const folder = path.join(root, name);
  fs.mkdirSync(folder, { recursive: true });
  const git = (...args) => {
    const result = readGit(folder, ['-c', `core.hooksPath=${hooks}`, '-c', 'user.name=Demo Author', '-c', 'user.email=demo@example.invalid',
      '-c', 'commit.gpgsign=false', '-c', 'core.autocrlf=false', '-c', 'init.defaultBranch=main', ...args]);
    if (result.exitCode !== 0 || result.error) throw new Error(`git ${args.join(' ')} failed in ${name}: ${result.stderr || result.error}`);
    return result.stdout.trim();
  };
  const write = files => {
    for (const [file, text] of Object.entries(files)) {
      fs.mkdirSync(path.dirname(path.join(folder, file)), { recursive: true });
      fs.writeFileSync(path.join(folder, file), text);
    }
  };
  const commit = (message, files = {}) => {
    write(files);
    git('add', '-A');
    git('commit', '-q', '-m', message);
    return git('rev-parse', 'HEAD');
  };
  git('init', '-q');
  return { folder, git, write, commit };
}

const testScript = `import('./src/feature.mjs')
  .then(({ price }) => {
    if (price(2) !== 42) throw new Error('price(2) should be 42');
    console.log('ok: pricing feature works');
  })
  .catch(error => { console.error(\`FAIL: \${error.message}\`); process.exit(1); });
`;

export function createDemoPortfolio(target) {
  target = path.resolve(target);
  if (fs.existsSync(target)) throw new Error('Demo folder already exists; choose a new folder so nothing is overwritten.');
  const parent = fs.realpathSync(path.dirname(target));
  if (containedBy(path.join(parent, path.basename(target)), fs.realpathSync(projectRoot))) throw new Error('Create the demo outside this project.');
  fs.mkdirSync(target);
  const root = path.join(target, 'portfolio');
  const hooks = path.join(target, '.no-hooks');
  fs.mkdirSync(root);
  fs.mkdirSync(hooks);

  const lost = repository(root, 'lost-commits', hooks);
  const skeleton = lost.commit('Project skeleton', {
    'README.md': '# Shop\n\nRun `npm test`.\n',
    'package.json': `${JSON.stringify({ name: 'demo-shop', private: true, type: 'module', scripts: { test: 'node test.mjs' } }, null, 2)}\n`,
    'test.mjs': testScript,
  });
  const lostFeature = lost.commit('Add pricing feature', { 'src/feature.mjs': 'export const price = quantity => quantity * 21;\n' });
  lost.git('reset', '-q', '--hard', skeleton);

  const branch = repository(root, 'deleted-branch', hooks);
  const branchBase = branch.commit('Initial notes', { 'README.md': '# Notes\n' });
  branch.git('checkout', '-q', '-b', 'experiment');
  const branchWork = branch.commit('Design notes on a branch that was later deleted', { 'docs/design.md': '# Design\n\nOnly on the deleted branch.\n' });
  branch.git('checkout', '-q', 'main');
  branch.git('branch', '-q', '-D', 'experiment');

  const overwritten = repository(root, 'overwritten-files', hooks);
  const goodVersion = overwritten.commit('Working calculator', {
    'README.md': '# Calculator\n',
    'src/add.mjs': 'export const add = (a, b) => a + b;\n',
    'src/multiply.mjs': 'export const multiply = (a, b) => a * b;\n',
  });
  const badVersion = overwritten.commit('Automated refactor that overwrote two files', {
    'src/add.mjs': 'export const add = () => { throw new Error("TODO"); };\n',
    'src/multiply.mjs': '// generated placeholder\n',
  });

  const corrupt = repository(root, 'corrupted-objects', hooks);
  corrupt.commit('Commit whose data object is later deleted', { 'README.md': '# Corrupt\n', 'data.txt': 'This blob will be missing.\n' });
  const missingBlob = corrupt.git('rev-parse', 'HEAD:data.txt');
  fs.rmSync(path.join(corrupt.folder, '.git', 'objects', missingBlob.slice(0, 2), missingBlob.slice(2)), { force: true });

  const clean = repository(root, 'clean-project', hooks);
  clean.commit('Only commit', { 'README.md': '# Clean project\n\nNothing is flagged here, which still does not prove nothing was lost.\n' });

  const sourceOnly = path.join(root, 'notes-without-git');
  fs.mkdirSync(sourceOnly);
  fs.writeFileSync(path.join(sourceOnly, 'README.md'), '# Copied folder without .git\n');
  fs.writeFileSync(path.join(sourceOnly, 'package.json'), '{ "name": "notes-without-git", "private": true }\n');
  fs.mkdirSync(path.join(root, 'empty-folder'));
  fs.rmSync(hooks, { recursive: true });

  fs.writeFileSync(path.join(target, 'DEMO.txt'), [
    'Synthetic MOORKYZ Repo Recovery demo. Safe to delete.',
    '',
    'portfolio/lost-commits       reset --hard removed the pricing feature (reflog-only commit)',
    'portfolio/deleted-branch     a branch with unique work was deleted',
    'portfolio/overwritten-files  a later commit overwrote two working files (compare HEAD~1)',
    'portfolio/corrupted-objects  a Git object file was deleted (blocked)',
    'portfolio/clean-project      nothing flagged (clean does not mean complete)',
    'portfolio/notes-without-git  copied folder without history',
    'portfolio/empty-folder       not a project; skipped',
    '',
  ].join('\n'));
  return {
    target, root,
    expected: {
      'lost-commits': { head: skeleton, lostCommit: lostFeature, file: 'src/feature.mjs' },
      'deleted-branch': { head: branchBase, lostCommit: branchWork, file: 'docs/design.md' },
      'overwritten-files': { head: badVersion, goodCommit: goodVersion, files: ['src/add.mjs', 'src/multiply.mjs'] },
      'corrupted-objects': { missingBlob },
      'clean-project': {},
      'notes-without-git': {},
    },
  };
}

async function main(args) {
  if (args.length !== 1 || args[0].startsWith('-')) {
    console.log('Usage: node scripts/demo.mjs <new-folder-outside-this-project>');
    return args.length === 1 && ['-h', '--help'].includes(args[0]) ? 0 : 1;
  }
  const demo = createDemoPortfolio(args[0]);
  console.log(`Demo portfolio created: ${demo.root}`);
  console.log('Start the dashboard on it:');
  console.log(`  node src/dashboard/server.mjs --root "${demo.root}" --data "${path.join(demo.target, 'dashboard-data')}"`);
  console.log('Then open http://127.0.0.1:4317 and press "Scan repositories". Delete the folder when finished.');
  return 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2)).then(code => { process.exitCode = code; }, error => { console.error(`Demo error: ${error.message}`); process.exitCode = 1; });
}
