export const catalog = [
  { id: 'inspect', name: 'Local examination', description: 'Read structure and Git state without repairs.', source: 'src/dashboard/engine.mjs', section: 'Ordered examination and fix procedures' },
  { id: 'preserve', name: 'Preservation verification', description: 'Verify independent backup and working-copy bytes.', source: 'src/dashboard/engine.mjs', section: 'Ordered examination and fix procedures' },
  { id: 'integrity', name: 'Object integrity', description: 'Non-writing Git fsck on a secured working copy.', source: 'src/dashboard/engine.mjs', section: 'Ordered examination and fix procedures' },
  { id: 'quality', name: 'Quality checks', description: 'Approved package checks or eligible documentation links.', source: 'src/dashboard/engine.mjs', section: 'Ordered examination and fix procedures' },
  { id: 'recover', name: 'Baseline validation', description: 'Compare known files after passing checks.', source: 'src/dashboard/engine.mjs', section: 'Estimate cheatsheet' },
  { id: 'restore-file', name: 'Baseline file restoration', description: 'Restore one reviewed file in the disposable copy.', source: 'src/dashboard/fixes.mjs', section: 'Actual fix scripts' },
  { id: 'normalize-text', name: 'Text line-ending treatment', description: 'Normalize one UTF-8 text file after preview.', source: 'src/dashboard/fixes.mjs', section: 'Actual fix scripts' },
  { id: 'repair-link', name: 'Markdown link repair', description: 'Repair an exact local link to an existing target.', source: 'src/dashboard/fixes.mjs', section: 'Actual fix scripts' },
  { id: 'inventory', name: 'Standalone Git inventory', description: 'Read-only metadata snapshot outside source roots.', source: 'src/recovery.mjs', section: 'Run locally' },
];
