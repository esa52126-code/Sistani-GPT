'use strict';
/**
 * Universal (platform-independent) licence keys.
 *
 * A key is a small payload signed by the seller's private key (ECDSA P-256). The app carries
 * only the matching PUBLIC key, so it can check a key completely offline but cannot create one.
 * The same key works whether the customer bought on Gumroad, Payhip, a website or in person.
 *
 * Layout (75 bytes, shown as "MSM1-" + base32 in groups of six):
 *   [0]     format version (1)
 *   [1..4]  serial number
 *   [5..6]  issue date, days since 2026-01-01
 *   [7..10] device code this key is locked to, or zero for "any computer"
 *   [11..74] signature over bytes 0..10
 */
const crypto = require('node:crypto');
const os = require('node:os');
const fs = require('node:fs');
const { execFileSync } = require('node:child_process');

const PREFIX = 'MSM1', EPOCH = Date.UTC(2026, 0, 1), ALPHA = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

function b32encode(buf) { let bits = 0, val = 0, out = ''; for (const b of buf) { val = (val << 8) | b; bits += 8; while (bits >= 5) { out += ALPHA[(val >>> (bits - 5)) & 31]; bits -= 5; } } if (bits) out += ALPHA[(val << (5 - bits)) & 31]; return out; }
function b32decode(str) { let bits = 0, val = 0; const out = []; for (const ch of str) { const i = ALPHA.indexOf(ch); if (i < 0) return null; val = (val << 5) | i; bits += 5; if (bits >= 8) { out.push((val >>> (bits - 8)) & 255); bits -= 8; } } return Buffer.from(out); }
const group = s => s.match(/.{1,6}/g).join('-');

function looksLikeOfflineKey(text) { return String(text || '').replace(/[^A-Za-z0-9]/g, '').toUpperCase().startsWith(PREFIX); }
function normalizeDevice(code) { const h = String(code || '').replace(/[^0-9a-fA-F]/g, '').toUpperCase(); return h.length === 8 ? h : ''; }

/** A short, stable code for this computer (e.g. "A1B2-C3D4"). Reveals nothing about the machine. */
function deviceCode() {
  let id = '';
  try {
    if (process.platform === 'win32') {
      const out = execFileSync('reg', ['query', 'HKLM\\SOFTWARE\\Microsoft\\Cryptography', '/v', 'MachineGuid'], { encoding: 'utf8', windowsHide: true, timeout: 5000 });
      id = (out.match(/MachineGuid\s+REG_SZ\s+(\S+)/i) || [])[1] || '';
    } else if (process.platform === 'darwin') {
      const out = execFileSync('ioreg', ['-rd1', '-c', 'IOPlatformExpertDevice'], { encoding: 'utf8', timeout: 5000 });
      id = (out.match(/"IOPlatformUUID"\s*=\s*"([^"]+)"/) || [])[1] || '';
    } else { for (const f of ['/etc/machine-id', '/var/lib/dbus/machine-id']) { try { id = fs.readFileSync(f, 'utf8').trim(); if (id) break; } catch (_) { /* next */ } } }
  } catch (_) { /* fall back below */ }
  if (!id) id = `${os.hostname()}|${os.userInfo().username}|${os.arch()}|${(os.cpus()[0] || {}).model || ''}`;
  const h = crypto.createHash('sha256').update('msm-device:' + id).digest('hex').slice(0, 8).toUpperCase();
  return h.slice(0, 4) + '-' + h.slice(4);
}

/** Seller side only: creates a key. privateKey is a JWK or KeyObject. */
function sign(privateKey, { serial, device = '', issued = Date.now() } = {}) {
  const key = privateKey.type ? privateKey : crypto.createPrivateKey({ key: privateKey, format: 'jwk' });
  const p = Buffer.alloc(11);
  p[0] = 1; p.writeUInt32BE((serial == null ? crypto.randomBytes(4).readUInt32BE(0) : serial) >>> 0, 1);
  p.writeUInt16BE(Math.max(0, Math.min(65535, Math.floor((issued - EPOCH) / 86400000))), 5);
  const dev = normalizeDevice(device); if (dev) Buffer.from(dev, 'hex').copy(p, 7);
  const sig = crypto.sign('sha256', p, { key, dsaEncoding: 'ieee-p1363' });
  return PREFIX + '-' + group(b32encode(Buffer.concat([p, sig])));
}

/** App side: returns { ok, serial, issued, device } or { ok:false, reason }. publicKey is a JWK. */
function verify(publicKey, text) {
  const clean = String(text || '').replace(/[^A-Za-z0-9]/g, '').toUpperCase();
  if (!clean.startsWith(PREFIX)) return { ok: false, reason: 'format' };
  const raw = b32decode(clean.slice(PREFIX.length));
  if (!raw || raw.length < 75 || raw[0] !== 1) return { ok: false, reason: 'format' };
  const p = raw.subarray(0, 11), sig = raw.subarray(11, 75);
  let good = false;
  try { good = crypto.verify('sha256', p, { key: crypto.createPublicKey({ key: publicKey, format: 'jwk' }), dsaEncoding: 'ieee-p1363' }, sig); } catch (_) { good = false; }
  if (!good) return { ok: false, reason: 'signature' };
  const dev = p.subarray(7, 11).toString('hex').toUpperCase();
  return { ok: true, serial: p.readUInt32BE(1), issued: EPOCH + p.readUInt16BE(5) * 86400000, device: dev === '00000000' ? '' : dev.slice(0, 4) + '-' + dev.slice(4),
    canonical: PREFIX + '-' + group(clean.slice(PREFIX.length, PREFIX.length + 120)) };
}

module.exports = { sign, verify, deviceCode, looksLikeOfflineKey, normalizeDevice, PREFIX };
