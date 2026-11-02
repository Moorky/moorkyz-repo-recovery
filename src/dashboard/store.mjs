import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { initialize } from './assessment.mjs';

export function openStore(data, root) {
  const database = new DatabaseSync(path.join(data, 'recovery.sqlite'));
  database.exec(`
    PRAGMA journal_mode=WAL;
    PRAGMA foreign_keys=ON;
    CREATE TABLE IF NOT EXISTS workspace (id INTEGER PRIMARY KEY CHECK(id=1), root TEXT NOT NULL, scanned_at TEXT NOT NULL, skipped TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS repositories (id TEXT PRIMARY KEY, path TEXT NOT NULL UNIQUE, name TEXT NOT NULL, updated_at TEXT NOT NULL, delivered_at TEXT, dismissed_at TEXT, payload TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS events (id INTEGER PRIMARY KEY, repository_id TEXT NOT NULL, at TEXT NOT NULL, payload TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS evidence (repository_id TEXT NOT NULL, kind TEXT NOT NULL, examined_at TEXT NOT NULL, payload TEXT NOT NULL, PRIMARY KEY(repository_id,kind));
    CREATE TABLE IF NOT EXISTS procedures (id TEXT PRIMARY KEY, repository_id TEXT NOT NULL, name TEXT NOT NULL, at TEXT NOT NULL, status TEXT NOT NULL, helping_factor REAL CHECK(helping_factor BETWEEN 0 AND 100), payload TEXT NOT NULL);
  `);
  const workspace = database.prepare('SELECT root, scanned_at, skipped FROM workspace WHERE id=1').get();
  if (workspace && workspace.root !== root) {
    database.close();
    throw new Error('SQLite workspace root mismatch. Use a separate --data directory.');
  }
  function save(state) {
    database.exec('BEGIN IMMEDIATE');
    try {
      database.prepare('INSERT OR REPLACE INTO workspace VALUES (1,?,?,?)').run(state.root, state.scannedAt, JSON.stringify(state.skipped));
      database.exec('DELETE FROM repositories; DELETE FROM events; DELETE FROM evidence; DELETE FROM procedures;');
      const repoStatement = database.prepare('INSERT INTO repositories VALUES (?,?,?,?,?,?,?)');
      const eventStatement = database.prepare('INSERT INTO events(repository_id,at,payload) VALUES (?,?,?)');
      const evidenceStatement = database.prepare('INSERT INTO evidence VALUES (?,?,?,?)');
      const procedureStatement = database.prepare('INSERT INTO procedures VALUES (?,?,?,?,?,?,?)');
      for (const repository of state.repositories) {
        initialize(repository, state.scannedAt);
        const life = repository.lifecycle;
        const { records, history, procedures, ...payload } = repository;
        repoStatement.run(repository.id, repository.path, repository.name, life.updatedAt, life.deliveredAt, life.dismissedAt, JSON.stringify(payload));
        for (const event of history) eventStatement.run(repository.id, event.at, JSON.stringify(event));
        for (const [kind, record] of Object.entries(records)) evidenceStatement.run(repository.id, kind, record.at, JSON.stringify(record));
        for (const procedure of procedures) procedureStatement.run(procedure.id, repository.id, procedure.name, procedure.at,
          procedure.status || 'recorded', procedure.helpingFactor ?? null, JSON.stringify(procedure));
      }
      database.exec('COMMIT');
    } catch (error) {
      database.exec('ROLLBACK');
      throw error;
    }
  }
  function load() {
    const record = database.prepare('SELECT * FROM workspace WHERE id=1').get();
    if (!record) return null;
    const repositories = database.prepare('SELECT id,payload FROM repositories ORDER BY name').all().map(row => ({
      ...JSON.parse(row.payload),
      records: Object.fromEntries(database.prepare('SELECT kind,payload FROM evidence WHERE repository_id=?').all(row.id).map(item => [item.kind, JSON.parse(item.payload)])),
      history: database.prepare('SELECT payload FROM events WHERE repository_id=? ORDER BY id').all(row.id).map(item => JSON.parse(item.payload)),
      procedures: database.prepare('SELECT payload FROM procedures WHERE repository_id=? ORDER BY at,id').all(row.id).map(item => JSON.parse(item.payload)),
    }));
    return { schemaVersion: 1, root: record.root, scannedAt: record.scanned_at, skipped: JSON.parse(record.skipped), repositories };
  }
  if (!workspace) {
    const legacy = path.join(data, 'dashboard-state.json');
    if (fs.existsSync(legacy)) {
      try {
        const state = JSON.parse(fs.readFileSync(legacy, 'utf8'));
        if (state.schemaVersion !== 1 || state.root !== root || !Array.isArray(state.repositories)) throw new Error('Legacy state does not match workspace.');
        save(state);
      } catch (error) {
        database.close();
        throw error;
      }
    }
  }
  return { save, load, close: () => database.close() };
}
