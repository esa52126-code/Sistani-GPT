'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const U = require('./util');
const Settings = require('./settings');
const Csv = require('./csv');
const migrations = require('../migrations');

const REQUIRED = ['mobiles', 'accessories', 'customers', 'suppliers', 'sales', 'sale_items', 'sale_payments', 'expenses', 'exchanges', 'customer_ledger', 'supplier_ledger', 'stock_movements', 'settings', 'backup_history'];

function stamp() { const d = new Date(), p = n => String(n).padStart(2, '0'); return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`; }
function folder(db, defaultDir) {
  const f = Settings.get(db).backup_folder || defaultDir;
  fs.mkdirSync(f, { recursive: true });
  return f;
}
/** Writes a consistent single-file copy of the live database (safe while the app is in use). */
function create(db, defaultDir, type = 'manual', targetDir) {
  const dir = targetDir || folder(db, defaultDir);
  fs.mkdirSync(dir, { recursive: true });
  let file = path.join(dir, `MobileShopManagerPro-${type}-${stamp()}.msmbackup`);
  for (let i = 2; fs.existsSync(file); i++) file = file.replace(/(-\d+)?\.msmbackup$/, `-${i}.msmbackup`);
  db.exec(`VACUUM INTO '${file.replace(/'/g, "''")}'`);
  const size = fs.statSync(file).size;
  db.run('INSERT INTO backup_history(file_path,backup_type,size_bytes,created_at) VALUES(?,?,?,?)', [file, type, size, U.nowIso()]);
  if (type === 'auto') prune(db);
  return { file, size, type };
}
function prune(db) {
  const keep = Settings.get(db).backup_keep;
  for (const b of db.all(`SELECT * FROM backup_history WHERE backup_type = 'auto' ORDER BY id DESC`).slice(keep)) {
    try { if (fs.existsSync(b.file_path)) fs.unlinkSync(b.file_path); } catch (_) { /* ignore */ }
    db.run('DELETE FROM backup_history WHERE id = ?', [b.id]);
  }
}
function list(db) { return db.all('SELECT * FROM backup_history ORDER BY id DESC LIMIT 200').map(b => ({ ...b, exists: fs.existsSync(b.file_path) })); }
function lastBackup(db) { return db.get('SELECT * FROM backup_history ORDER BY id DESC LIMIT 1') || null; }
/** Auto-backup when the configured interval has elapsed. Never throws. */
function autoIfDue(db, defaultDir) {
  try {
    const mode = Settings.get(db).auto_backup;
    if (mode === 'off') return null;
    const last = db.get(`SELECT created_at FROM backup_history WHERE backup_type = 'auto' ORDER BY id DESC LIMIT 1`);
    const hours = last ? (Date.now() - Date.parse(last.created_at)) / 3600000 : Infinity;
    if (hours < (mode === 'weekly' ? 168 : 24)) return null;
    if (db.get('SELECT COUNT(*) AS n FROM sales').n + db.get('SELECT COUNT(*) AS n FROM mobiles').n + db.get('SELECT COUNT(*) AS n FROM accessories').n === 0) return null;
    return create(db, defaultDir, 'auto');
  } catch (e) { return { error: e.message }; }
}
/** Opens a candidate file read-only and checks it really is a healthy backup of this app. */
function validate(file) {
  if (!file || !fs.existsSync(file)) throw new U.AppError('Backup file was not found.');
  const head = Buffer.alloc(16); const fd = fs.openSync(file, 'r'); fs.readSync(fd, head, 0, 16, 0); fs.closeSync(fd);
  if (head.toString('latin1') !== 'SQLite format 3\u0000') throw new U.AppError('This file is not a Mobile Shop Manager Pro backup.');
  let t;
  try {
    t = new DatabaseSync(file, { readOnly: true });
    const ok = t.prepare('PRAGMA integrity_check').get();
    if (!ok || Object.values(ok)[0] !== 'ok') throw new U.AppError('The backup file is damaged and cannot be restored.');
    const tables = t.prepare(`SELECT name FROM sqlite_master WHERE type = 'table'`).all().map(r => r.name);
    const missing = REQUIRED.filter(n => !tables.includes(n));
    if (missing.length) throw new U.AppError('This file is not a Mobile Shop Manager Pro backup.');
    const version = t.prepare('PRAGMA user_version').get().user_version;
    if (version > migrations.length) throw new U.AppError('This backup was created by a newer version of the application. Please update the app first.');
    const count = n => t.prepare(`SELECT COUNT(*) AS n FROM ${n}`).get().n;
    return { file, version, size: fs.statSync(file).size, modified: fs.statSync(file).mtime.toISOString(),
      counts: { mobiles: count('mobiles'), accessories: count('accessories'), customers: count('customers'), sales: count('sales'), expenses: count('expenses') } };
  } catch (e) {
    if (e.isAppError) throw e;
    throw new U.AppError('The backup file could not be read.');
  } finally { try { t && t.close(); } catch (_) { /* ignore */ } }
}
/**
 * Validate -> safety backup of current data -> swap files -> reopen and migrate.
 * If anything fails after the swap, the previous database is put back.
 */
function restore(db, file, defaultDir) {
  const info = validate(file);
  if (db.file === ':memory:') throw new U.AppError('Restore is not available for an in-memory database.');
  const safety = create(db, defaultDir, 'safety');
  const history = db.all('SELECT file_path,backup_type,size_bytes,created_at FROM backup_history');
  db.close();
  const rollback = db.file + '.before-restore';
  fs.copyFileSync(db.file, rollback);
  try {
    for (const ext of ['-wal', '-shm']) { try { fs.unlinkSync(db.file + ext); } catch (_) { /* none */ } }
    fs.copyFileSync(file, db.file);
    db.open();
    // The list of backups describes files on this computer, so it survives the restore.
    db.tx(() => { db.run('DELETE FROM backup_history'); for (const h of history) db.run('INSERT INTO backup_history(file_path,backup_type,size_bytes,created_at) VALUES(?,?,?,?)', [h.file_path, h.backup_type, h.size_bytes, h.created_at]); });
  } catch (e) {
    try { db.close(); } catch (_) { /* ignore */ }
    for (const ext of ['-wal', '-shm']) { try { fs.unlinkSync(db.file + ext); } catch (_) { /* none */ } }
    fs.copyFileSync(rollback, db.file);
    db.open();
    throw new U.AppError('Restore failed and your previous data was kept. ' + (e.isAppError ? e.message : ''));
  } finally { try { fs.unlinkSync(rollback); } catch (_) { /* ignore */ } }
  return { restored: info, safety_backup: safety.file };
}
function exportAllCsv(db, dir) {
  const out = path.join(dir, `MobileShopManagerPro-CSV-${stamp()}`);
  fs.mkdirSync(out, { recursive: true });
  for (const t of Csv.EXPORT_TABLES) fs.writeFileSync(path.join(out, t + '.csv'), Csv.exportTable(db, t), 'utf8');
  return { folder: out, files: Csv.EXPORT_TABLES.length };
}
module.exports = { create, list, lastBackup, autoIfDue, validate, restore, exportAllCsv, folder };
