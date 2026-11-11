'use strict';
const crypto = require('node:crypto');
const U = require('./util');
const C = require('../../shared/constants');

const DEFAULTS = {
  shop_name: 'My Mobile Shop', shop_tagline: '', shop_logo: '', shop_address: '', shop_phone: '', shop_email: '', shop_website: '',
  country: 'US', currency_code: 'USD', currency_symbol: '$', currency_position: 'before', decimals: 2,
  number_format: 'comma_dot', date_format: 'MM/DD/YYYY', time_format: '12h', timezone: 'system', week_start: 'sunday', language: 'en',
  tax_enabled: false, tax_label: 'Tax', tax_rate: 0, tax_mode: 'exclusive', tax_id: '',
  invoice_prefix: 'INV-', invoice_next: 1, receipt_next: 1, invoice_template: 'a4', invoice_accent: '#2563eb',
  invoice_footer: 'Thank you for your business!', invoice_terms: '', invoice_show_logo: true,
  low_stock_alerts: true, low_stock_default: 5,
  backup_folder: '', auto_backup: 'daily', backup_keep: 14,
  auth_enabled: false, demo_loaded: false, onboarded: false,
};
const PRIVATE = ['auth_hash', 'auth_salt'];
const ENUMS = {
  currency_position: ['before', 'before_space', 'after', 'after_space'],
  number_format: Object.keys(U.Fmt.NUMBER_FORMATS), date_format: U.Fmt.DATE_FORMATS, time_format: ['12h', '24h'],
  week_start: ['sunday', 'monday', 'saturday'], tax_mode: ['exclusive', 'inclusive'], invoice_template: ['a4', 'thermal'],
  auto_backup: ['off', 'daily', 'weekly'], language: C.LANGUAGES.map(l => l.code),
};
const READONLY = ['invoice_next', 'receipt_next', 'auth_enabled', 'demo_loaded'];

function raw(db, key) { const r = db.get('SELECT value FROM settings WHERE key = ?', [key]); return r ? r.value : undefined; }
function setRaw(db, key, value) {
  db.run('INSERT INTO settings(key, value) VALUES(?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value', [key, String(value)]);
}
function get(db) {
  const out = { ...DEFAULTS };
  for (const r of db.all('SELECT key, value FROM settings')) {
    if (PRIVATE.includes(r.key) || !(r.key in DEFAULTS)) continue;
    const def = DEFAULTS[r.key];
    out[r.key] = typeof def === 'boolean' ? r.value === 'true' : typeof def === 'number' ? Number(r.value) : r.value;
  }
  return out;
}
function update(db, patch) {
  if (!patch || typeof patch !== 'object') throw new U.AppError('Invalid settings.');
  db.tx(() => {
    for (const [key, v] of Object.entries(patch)) {
      if (!(key in DEFAULTS) || READONLY.includes(key)) continue;
      const def = DEFAULTS[key];
      let val;
      if (typeof def === 'boolean') val = !!v;
      else if (key === 'decimals') val = U.int(v, 'Decimal precision', { min: 0, max: 4 });
      else if (key === 'tax_rate') val = U.num(v, 'Tax rate', { min: 0, max: 100 });
      else if (key === 'backup_keep') val = U.int(v, 'Backups to keep', { min: 1, max: 365 });
      else if (key === 'low_stock_default') val = U.int(v, 'Low-stock level', { min: 0, max: 100000 });
      else if (typeof def === 'number') val = U.num(v, key);
      else if (ENUMS[key]) val = U.oneOf(v, ENUMS[key], key);
      else if (key === 'shop_logo') {
        val = String(v || '');
        if (val && !/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(val)) throw new U.AppError('Logo must be a PNG, JPG or WebP image.');
        if (val.length > 1400000) throw new U.AppError('Logo image is too large. Please use an image under 1 MB.');
      } else if (key === 'shop_name') val = U.str(v, 'Shop name', { required: true, max: 120 });
      else if (key === 'shop_email') val = U.email(v);
      else if (key === 'currency_symbol') val = U.str(v, 'Currency symbol', { required: true, max: 8 });
      else if (key === 'currency_code') val = U.str(v, 'Currency code', { required: true, max: 8 }).toUpperCase();
      else if (key === 'invoice_accent') { val = String(v || ''); if (!/^#[0-9a-fA-F]{6}$/.test(val)) throw new U.AppError('Invoice colour must be a hex colour.'); }
      else val = U.str(v, key, { max: key === 'invoice_terms' ? 2000 : 500 });
      setRaw(db, key, val);
    }
  });
  return get(db);
}
/** Atomically takes the next number from a counter and returns the formatted code. */
function nextCode(db, counterKey, prefix, pad = 6) {
  const n = Number(raw(db, counterKey) || DEFAULTS[counterKey] || 1);
  setRaw(db, counterKey, n + 1);
  return prefix + String(n).padStart(pad, '0');
}
/** Next sequential stock id such as MS-0001 for the given table. */
function nextStockId(db, table, column, prefix) {
  const r = db.get(`SELECT MAX(CAST(substr(${column}, ${prefix.length + 1}) AS INTEGER)) AS n FROM ${table} WHERE ${column} LIKE ?`, [prefix + '%']);
  return prefix + String((r && r.n ? r.n : 0) + 1).padStart(4, '0');
}

// ---- optional local password ----
function hash(password, salt) { return crypto.scryptSync(password, salt, 32).toString('hex'); }
function setPassword(db, { current, password }) {
  const s = get(db);
  if (s.auth_enabled && !verifyPassword(db, current)) throw new U.AppError('Current password is incorrect.', 'AUTH');
  if (!password) { db.tx(() => { setRaw(db, 'auth_enabled', false); setRaw(db, 'auth_hash', ''); setRaw(db, 'auth_salt', ''); }); return { auth_enabled: false }; }
  if (String(password).length < 4) throw new U.AppError('Password must be at least 4 characters.');
  const salt = crypto.randomBytes(16).toString('hex');
  db.tx(() => { setRaw(db, 'auth_salt', salt); setRaw(db, 'auth_hash', hash(String(password), salt)); setRaw(db, 'auth_enabled', true); });
  return { auth_enabled: true };
}
function verifyPassword(db, password) {
  const h = raw(db, 'auth_hash'), salt = raw(db, 'auth_salt');
  if (!h || !salt) return true;
  const a = Buffer.from(hash(String(password || ''), salt), 'hex'), b = Buffer.from(h, 'hex');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
/** Throws unless the admin password (when one is set) matches. */
function requireAdmin(db, password) {
  if (get(db).auth_enabled && !verifyPassword(db, password)) throw new U.AppError('Administrator password is incorrect.', 'AUTH');
}

module.exports = { DEFAULTS, get, update, raw, setRaw, nextCode, nextStockId, setPassword, verifyPassword, requireAdmin };
