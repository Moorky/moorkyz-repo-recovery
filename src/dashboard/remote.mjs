import path from 'node:path';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { workingRepository, gitResult, withoutHooks } from './history.mjs';
import { ensurePreserved } from './engine.mjs';
import { planHash } from './files.mjs';

export function remoteRecovery(repository, action, input) {
  if (input.networkApproved !== true) throw new Error('Explicit permission to contact this configured remote is required.');
  const folder = workingRepository(repository);
  if (typeof input.remote !== 'string' || !/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,80}$/.test(input.remote)) {
    throw new Error('Choose a configured remote name, not a URL or command.');
  }
  const url = gitResult(folder, ['remote', 'get-url', input.remote]).trim();
  if (url.startsWith('https://')) {
    const parsed = new URL(url);
    if (parsed.username || parsed.password || parsed.search || parsed.hash) throw new Error('Remote URL must not embed credentials, query tokens or fragments.');
  } else if (!path.isAbsolute(url) || !fs.statSync(url).isDirectory()) {
    throw new Error('Only HTTPS or absolute local-directory remotes are supported. SSH/custom helpers require a separate reviewed workflow.');
  }
  const transport = ['-c', 'protocol.allow=never', '-c', 'protocol.https.allow=always', '-c', 'protocol.file.allow=always'];
  const advertised = gitResult(folder, [...transport, 'ls-remote', '--refs', '--heads', '--tags', url], { timeout: 60_000 })
    .split(/\r?\n/).filter(Boolean).map(line => {
      const [object, ref] = line.split('\t');
      return { object, ref };
    }).sort((a, b) => a.ref.localeCompare(b.ref));
  if (!advertised.length) throw new Error('Remote advertised no branch/tag refs. No completeness or successful import is claimed.');
  const local = new Map(gitResult(folder, ['for-each-ref', '--format=%(refname)%09%(objectname)'])
    .split(/\r?\n/).filter(Boolean).map(line => line.split('\t')));
  const comparison = advertised.map(entry => {
    const cachedRef = entry.ref.startsWith('refs/heads/') ? `refs/remotes/${input.remote}/${entry.ref.slice(11)}` : entry.ref;
    return { ...entry, cachedRef, cachedObject: local.get(cachedRef) ?? null,
      sameCachedObject: local.get(cachedRef) === entry.object };
  });
  const preview = { workingCopy: folder, remote: input.remote, advertised };
  const hash = planHash({ ...preview, url });
  if (action === 'remote-preview') return { at: new Date().toISOString(), ...preview, comparison, planHash: hash,
    scope: 'Fresh advertised ref IDs only, not a complete history/content comparison. HTTPS may use configured credential helpers. No local refs changed.' };
  if (input.approved !== true || input.planHash !== hash) throw new Error('Approve the current remote preview; changed advertisements require a new preview.');
  const namespace = `refs/recovery/import/${crypto.randomUUID()}`;
  withoutHooks(folder, [...transport, 'fetch', '--atomic', '--no-tags', '--no-write-fetch-head',
    '--no-recurse-submodules', '--no-auto-maintenance', url,
    `refs/heads/*:${namespace}/heads/*`, `refs/tags/*:${namespace}/tags/*`], { timeout: 120_000 });
  ensurePreserved(repository.path, repository.records.preservation);
  const imported = gitResult(folder, ['for-each-ref', '--format=%(objectname)%09%(refname)', namespace])
    .split(/\r?\n/).filter(Boolean).map(line => {
      const [object, ref] = line.split('\t');
      return { object, ref };
    });
  if (advertised.some(entry => !imported.some(item => item.ref === `${namespace}/${entry.ref.slice(5)}` && item.object === entry.object))) {
    throw new Error(`Remote changed during fetch. Imported objects/refs are retained under ${namespace}; inspect before use.`);
  }
  return { at: new Date().toISOString(), remote: input.remote, namespace, imported, passed: true,
    scope: 'Imported into a unique recovery namespace in the disposable copy. Original and existing branch/tag refs unchanged. Inspect imported commits before selecting files.' };
}
