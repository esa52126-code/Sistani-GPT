'use strict';
/**
 * Database layer: opens the local SQLite file (Node's built-in SQLite driver,
 * no native add-ons), applies migrations, and exposes small helpers.
 */
const { DatabaseSync } = require('node:sqlite');
const fs = require('node:fs');
const path = require('node:path');
const migrations = require('./migrations');

class AppError extends Error {
  constructor(message, code = 'VALIDATION') { super(message); this.code = code; this.isAppError = true; }
}

class Database {
  constructor(file) {
    this.file = file;
    this.open();
  }
  open() {
    if (this.file !== ':memory:') fs.mkdirSync(path.dirname(this.file), { recursive: true });
    this.db = new DatabaseSync(this.file);
    this.db.exec('PRAGMA foreign_keys = ON;');
    if (this.file !== ':memory:') this.db.exec('PRAGMA journal_mode = WAL; PRAGMA synchronous = NORMAL;');
    this.db.exec('PRAGMA busy_timeout = 5000;');
    this._stmts = new Map();
    this._depth = 0;
    this.migrate();
  }
  close() {
    this._stmts = new Map();
    try { this.db.exec('PRAGMA wal_checkpoint(TRUNCATE);'); } catch (_) { /* ignore */ }
    try { this.db.close(); } catch (_) { /* ignore */ }
  }
  migrate() {
    const current = this.db.prepare('PRAGMA user_version').get().user_version;
    if (current > migrations.length) {
      throw new AppError('This database was created by a newer version of the application.', 'DB_TOO_NEW');
    }
    for (let v = current; v < migrations.length; v++) {
      this.db.exec('BEGIN IMMEDIATE');
      try {
        migrations[v](this.db);
        this.db.exec(`PRAGMA user_version = ${v + 1}`);
        this.db.exec('COMMIT');
      } catch (e) { this.db.exec('ROLLBACK'); throw e; }
    }
  }
  get schemaVersion() { return this.db.prepare('PRAGMA user_version').get().user_version; }
  _p(sql) {
    let s = this._stmts.get(sql);
    if (!s) { s = this.db.prepare(sql); this._stmts.set(sql, s); }
    return s;
  }
  static _args(params) { return params === undefined ? [] : Array.isArray(params) ? params : [params]; }
  all(sql, params) { return this._p(sql).all(...Database._args(params)).map(r => ({ ...r })); }
  get(sql, params) { const r = this._p(sql).get(...Database._args(params)); return r ? { ...r } : undefined; }
  run(sql, params) {
    const r = this._p(sql).run(...Database._args(params));
    return { changes: Number(r.changes), id: Number(r.lastInsertRowid) };
  }
  exec(sql) { this.db.exec(sql); }
  /** Runs fn atomically. Nested calls join the outer transaction. */
  tx(fn) {
    if (this._depth > 0) return fn();
    this.db.exec('BEGIN IMMEDIATE');
    this._depth++;
    try {
      const out = fn();
      this.db.exec('COMMIT');
      return out;
    } catch (e) {
      try { this.db.exec('ROLLBACK'); } catch (_) { /* ignore */ }
      throw e;
    } finally { this._depth--; }
  }
}

module.exports = { Database, AppError };
