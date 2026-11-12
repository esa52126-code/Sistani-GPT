'use strict';
/**
 * Commercial licensing (Gumroad license keys).
 *
 * - Runs only in the Electron main process. The renderer never talks to Gumroad.
 * - Uses Gumroad's public licence verification endpoint, which needs only the public
 *   product ID and the customer's key. No seller secret or access token is stored in the app.
 * - State lives in its own small SQLite file (license.db), completely separate from the
 *   shop database, so backups/restores never move a licence between computers and a
 *   licensing problem can never damage business data.
 * - Offline-first: after one successful activation the app keeps working without internet.
 *   It re-checks quietly every `recheckDays` when a connection happens to be available and
 *   tolerates `graceDays` without any successful check. Even after that, or after a refund,
 *   the shop's data stays readable, printable, exportable and backup-able (restricted mode
 *   only pauses creating new records).
 */
const { DatabaseSync } = require('node:sqlite');
const fs = require('node:fs');
const path = require('node:path');
const { AppError } = require('../db');
const OfflineKey = require('./offline-key');

const ENDPOINT = 'https://api.gumroad.com/v2/licenses/verify';
const DAY = 86400000;

class License {
  constructor({ file, config, fetchImpl, endpoint, now }) {
    this.config = Object.assign({ productId: '', productPermalink: '', purchaseUrl: '', supportEmail: '', trialDays: 14, graceDays: 30, recheckDays: 7, maxActivations: 0 }, config || {});
    this.fetch = fetchImpl || globalThis.fetch;
    this.endpoint = endpoint || ENDPOINT;
    this.now = now || (() => Date.now());
    if (file !== ':memory:') fs.mkdirSync(path.dirname(file), { recursive: true });
    this.db = new DatabaseSync(file);
    this.db.exec(`CREATE TABLE IF NOT EXISTS licenses (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      license_key TEXT DEFAULT '', product_id TEXT DEFAULT '',
      status TEXT NOT NULL DEFAULT 'none' CHECK (status IN ('none','active','revoked')),
      revoke_reason TEXT DEFAULT '', email TEXT DEFAULT '', purchase_id TEXT DEFAULT '', purchased_at TEXT DEFAULT '',
      uses INTEGER DEFAULT 0, is_test INTEGER DEFAULT 0,
      first_run_at INTEGER NOT NULL, activated_at INTEGER, last_verified_at INTEGER, last_attempt_at INTEGER, last_error TEXT DEFAULT '', last_seen_at INTEGER
    )`);
    // Added in 1.1: which kind of key is stored ('gumroad' is checked online, 'offline' is a signed universal key).
    if (!this.db.prepare('PRAGMA table_info(licenses)').all().some(c => c.name === 'key_type')) this.db.exec(`ALTER TABLE licenses ADD COLUMN key_type TEXT DEFAULT 'gumroad'`);
    if (!this.db.prepare('SELECT id FROM licenses WHERE id = 1').get())
      this.db.prepare('INSERT INTO licenses(id, first_run_at, last_seen_at) VALUES(1, ?, ?)').run(this.now(), this.now());
  }
  get gumroadEnabled() { return !!(this.config.productId || this.config.productPermalink); }
  get offlineEnabled() { return !!(this.config.offlinePublicKey && this.config.offlinePublicKey.x); }
  get configured() { return this.gumroadEnabled || this.offlineEnabled; }
  deviceCode() { if (!this._device) this._device = (this.deviceCodeFn || OfflineKey.deviceCode)(); return this._device; }
  row() { return { ...this.db.prepare('SELECT * FROM licenses WHERE id = 1').get() }; }
  set(patch) {
    const keys = Object.keys(patch);
    this.db.prepare(`UPDATE licenses SET ${keys.map(k => k + ' = ?').join(', ')} WHERE id = 1`).run(...keys.map(k => patch[k]));
  }
  close() { try { this.db.close(); } catch (_) { /* ignore */ } }

  /** Safe summary for the renderer (the key is masked). */
  state() {
    const r = this.row(), now = this.now(), c = this.config;
    const base = { configured: this.configured, gumroad: this.gumroadEnabled, offline: this.offlineEnabled, device_code: this.offlineEnabled ? this.deviceCode() : '', key_type: r.key_type || 'gumroad', purchaseUrl: c.purchaseUrl, supportEmail: c.supportEmail, graceDays: c.graceDays, trialDays: c.trialDays,
      email: r.email, key_masked: !r.license_key ? '' : r.license_key.length > 60 ? r.license_key.slice(0, 5) + '••••••-…-' + r.license_key.slice(-6) : r.license_key.replace(/.(?=.{4})/g, ch => (ch === '-' ? '-' : '•')),
      activated_at: r.activated_at, last_verified_at: r.last_verified_at, last_error: r.last_error, is_test: !!r.is_test };
    if (!this.configured) return { ...base, mode: 'unconfigured', restricted: false, message: 'Licensing is not configured in this build.' };
    // A clock moved far backwards cannot be used to stretch the trial or grace period.
    const clock = Math.max(now, r.last_seen_at || 0);
    if (r.status === 'active' && r.key_type === 'offline') {
      // Universal keys are verified on this computer; they never need the internet again.
      const v = this.offlineEnabled ? OfflineKey.verify(this.config.offlinePublicKey, r.license_key) : { ok: false };
      if (v.ok && (!v.device || v.device === this.deviceCode())) return { ...base, mode: 'active', restricted: false, grace_days_left: null, message: 'Licensed' };
      return { ...base, mode: 'revoked', restricted: true, reason: 'the licence key does not belong to this computer',
        message: 'This licence key is not valid on this computer. Your data is safe and can still be viewed, printed, exported and backed up.' };
    }
    if (r.status === 'active') {
      const since = (clock - (r.last_verified_at || r.activated_at || 0)) / DAY;
      const left = Math.ceil(c.graceDays - since);
      if (left > 0) return { ...base, mode: 'active', restricted: false, grace_days_left: left, message: 'Licensed' };
      return { ...base, mode: 'verification_needed', restricted: true, grace_days_left: 0,
        message: `This licence has not been verified for more than ${c.graceDays} days. Connect to the internet and choose "Verify now". Your data is safe and can still be viewed, printed, exported and backed up.` };
    }
    if (r.status === 'revoked') return { ...base, mode: 'revoked', restricted: true, reason: r.revoke_reason,
      message: `This licence is no longer valid (${r.revoke_reason || 'disabled'}). Your data is safe and can still be viewed, printed, exported and backed up.` };
    const left = Math.ceil(c.trialDays - (clock - r.first_run_at) / DAY);
    if (left > 0) return { ...base, mode: 'trial', restricted: false, trial_days_left: left, message: `Trial: ${left} day${left === 1 ? '' : 's'} left` };
    return { ...base, mode: 'trial_expired', restricted: true, trial_days_left: 0,
      message: 'The trial has ended. Enter your licence key to continue adding records. Your data is safe and can still be viewed, printed, exported and backed up.' };
  }
  touch() { const now = this.now(), r = this.row(); if (now > (r.last_seen_at || 0)) this.set({ last_seen_at: now }); }

  /** One call to Gumroad. Resolves to {ok, purchase, uses} | {ok:false, kind:'invalid'|'network', message}. */
  async call(key, increment) {
    const body = new URLSearchParams();
    if (this.config.productId) body.set('product_id', this.config.productId);
    else body.set('product_permalink', this.config.productPermalink);
    body.set('license_key', key);
    body.set('increment_uses_count', increment ? 'true' : 'false');
    let res, json;
    try {
      const ctl = new AbortController(); const timer = setTimeout(() => ctl.abort(), 15000);
      try { res = await this.fetch(this.endpoint, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' }, body: body.toString(), signal: ctl.signal }); }
      finally { clearTimeout(timer); }
    } catch (e) { return { ok: false, kind: 'network', message: 'Could not reach the licence server. Check your internet connection and try again.' }; }
    try { json = await res.json(); } catch (_) { json = null; }
    if (res.status >= 500 || res.status === 429 || (!json && res.status !== 404)) return { ok: false, kind: 'network', message: 'The licence server is temporarily unavailable. Please try again later.' };
    if (!json || json.success !== true) return { ok: false, kind: 'invalid', message: (json && json.message) || 'That licence key was not found for this product.' };
    return { ok: true, purchase: json.purchase || {}, uses: Number(json.uses) || 0 };
  }
  /** Why a successfully looked-up purchase should not unlock the app, or ''. */
  static problem(p) {
    if (p.refunded) return 'the purchase was refunded';
    if (p.chargebacked) return 'the purchase was charged back';
    if (p.disputed && !p.dispute_won) return 'the purchase is under dispute';
    if (p.disabled || p.license_disabled) return 'the licence was disabled by the seller';
    for (const k of ['subscription_ended_at', 'subscription_cancelled_at', 'subscription_failed_at']) if (p[k] && Date.parse(p[k]) <= Date.now()) return 'the subscription has ended';
    return '';
  }

  async activate(rawKey) {
    if (!this.configured) throw new AppError('Licensing is not configured in this build.', 'LICENSE');
    const key = String(rawKey || '').trim();
    if (OfflineKey.looksLikeOfflineKey(key)) return this.activateOffline(key);
    if (!this.gumroadEnabled) throw new AppError('This licence key is not valid for Mobile Shop Manager Pro. Please check it and try again.', 'LICENSE');
    if (!/^[A-Za-z0-9-]{8,80}$/.test(key)) throw new AppError('Please enter the licence key exactly as shown on your Gumroad receipt.', 'LICENSE');
    const cur = this.row();
    const same = cur.license_key === key && cur.status === 'active';
    const check = await this.call(key, false);
    if (!check.ok) throw new AppError(check.kind === 'invalid' ? 'This licence key is not valid for Mobile Shop Manager Pro. Please check it and try again.' : check.message, 'LICENSE');
    const bad = License.problem(check.purchase);
    if (bad) throw new AppError(`This licence cannot be activated because ${bad}.`, 'LICENSE');
    const max = Number(this.config.maxActivations) || 0;
    if (!same && max > 0 && check.uses >= max) throw new AppError(`This licence key has already been activated ${check.uses} time(s), which is the maximum allowed. Contact support to move it to this computer.`, 'LICENSE');
    let uses = check.uses;
    if (!same) { const inc = await this.call(key, true); if (inc.ok) uses = inc.uses; }
    const now = this.now(), p = check.purchase;
    this.set({ license_key: key, product_id: this.config.productId || this.config.productPermalink, status: 'active', revoke_reason: '', email: String(p.email || ''),
      purchase_id: String(p.id || p.sale_id || ''), purchased_at: String(p.sale_timestamp || p.created_at || ''), uses, is_test: p.test ? 1 : 0,
      activated_at: same ? cur.activated_at : now, last_verified_at: now, last_attempt_at: now, last_error: '', last_seen_at: now, key_type: 'gumroad' });
    return this.state();
  }
  /** Universal key: checked against the built-in public key, no internet involved. */
  activateOffline(key) {
    if (!this.offlineEnabled) throw new AppError('This licence key is not valid for Mobile Shop Manager Pro. Please check it and try again.', 'LICENSE');
    if (key.length > 400) throw new AppError('Please paste the complete licence key exactly as you received it.', 'LICENSE');
    const v = OfflineKey.verify(this.config.offlinePublicKey, key);
    if (!v.ok) throw new AppError(v.reason === 'format' ? 'The licence key is incomplete. Please paste the complete key exactly as you received it.' : 'This licence key is not valid for Mobile Shop Manager Pro. Please check it and try again.', 'LICENSE');
    if (v.device && v.device !== this.deviceCode()) throw new AppError(`This licence key was issued for another computer (device code ${v.device}). This computer's device code is ${this.deviceCode()}. Please send it to the seller to receive a key for this computer.`, 'LICENSE');
    const now = this.now();
    this.set({ license_key: v.canonical, product_id: 'offline', status: 'active', revoke_reason: '', email: '', purchase_id: String(v.serial), purchased_at: new Date(v.issued).toISOString().slice(0, 10), uses: 0, is_test: 0,
      activated_at: now, last_verified_at: now, last_attempt_at: now, last_error: '', last_seen_at: now, key_type: 'offline' });
    return this.state();
  }
  /** Re-checks a stored key. Network trouble never changes the licence status. */
  async verify({ force = false } = {}) {
    const r = this.row();
    if (!this.gumroadEnabled || !r.license_key || r.status === 'none' || r.key_type === 'offline') return this.state();
    const now = this.now();
    if (!force && r.status === 'active' && r.last_verified_at && now - r.last_verified_at < this.config.recheckDays * DAY) return this.state();
    const res = await this.call(r.license_key, false);
    if (!res.ok && res.kind === 'network') { this.set({ last_attempt_at: now, last_error: res.message }); return this.state(); }
    if (!res.ok) { this.set({ status: 'revoked', revoke_reason: 'the licence key is no longer recognised', last_attempt_at: now, last_error: '' }); return this.state(); }
    const bad = License.problem(res.purchase);
    if (bad) this.set({ status: 'revoked', revoke_reason: bad, last_attempt_at: now, last_error: '' });
    else this.set({ status: 'active', revoke_reason: '', last_verified_at: now, last_attempt_at: now, last_error: '', last_seen_at: now, uses: res.uses, email: String(res.purchase.email || r.email) });
    return this.state();
  }
  /** Removes the key from this computer only. */
  deactivate() {
    this.set({ license_key: '', status: 'none', revoke_reason: '', email: '', purchase_id: '', purchased_at: '', uses: 0, activated_at: null, last_verified_at: null, last_error: '', key_type: 'gumroad' });
    return this.state();
  }
}
module.exports = { License, ENDPOINT };
