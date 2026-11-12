'use strict';
const crypto = require('node:crypto');
const { License } = require('../src/main/services/license');
const OfflineKey = require('../src/main/services/offline-key');

module.exports = async function (t) {
  const priv = crypto.generateKeyPairSync('ec', { namedCurve: 'P-256' }).privateKey.export({ format: 'jwk' });
  const pub = { kty: priv.kty, crv: priv.crv, x: priv.x, y: priv.y };
  const other = crypto.generateKeyPairSync('ec', { namedCurve: 'P-256' }).privateKey.export({ format: 'jwk' });
  let clock = Date.UTC(2026, 5, 1), online = true, calls = 0;
  const make = (config = {}) => { const L = new License({ file: ':memory:', config: { offlinePublicKey: pub, trialDays: 14, graceDays: 30, ...config }, now: () => clock, fetchImpl: () => { calls++; return online ? Promise.reject(new Error('should not be called')) : Promise.reject(new Error('offline')); } }); L.deviceCodeFn = () => 'A1B2-C3D4'; return L; };

  const key = OfflineKey.sign(priv);
  t.ok(/^MSM1-/.test(key), 'universal key format');
  t.ok(OfflineKey.verify(pub, key).ok, 'genuine key verifies');
  t.ok(OfflineKey.verify(pub, key.toLowerCase().replace(/-/g, ' ')).ok, 'spaces and lower case are tolerated');
  t.eq(OfflineKey.verify(pub, OfflineKey.sign(other)).reason, 'signature', 'key from another seller is rejected');
  const tampered = key.slice(0, 8) + (key[8] === 'A' ? 'B' : 'A') + key.slice(9);
  t.ok(!OfflineKey.verify(pub, tampered).ok, 'a changed key is rejected');
  t.eq(OfflineKey.verify(pub, key.slice(0, 60)).reason, 'format', 'a cut-off key is rejected');

  const L = make();
  t.eq(L.state().mode, 'trial', 'app with only universal keys starts as a trial'); t.eq(L.state().device_code, 'A1B2-C3D4', 'device code is shown to the customer');
  await t.rejects(async () => L.activate(OfflineKey.sign(other)), /not valid/, 'forged key shows a clear error');
  await t.rejects(async () => L.activate(key.slice(0, 50)), /incomplete/, 'incomplete key shows a clear error');
  await t.rejects(async () => L.activate('6F0E4C97-B72A4E69-A11BF6C4-AF6517E7'), /not valid/, 'Gumroad-style key is refused when Gumroad is not configured');
  online = false;
  const st = await L.activate(key);
  t.eq(st.mode, 'active', 'universal key activates with no internet'); t.eq(calls, 0, 'no network request is made for a universal key');
  t.ok(st.key_masked.length < 30 && !st.key_masked.includes(key.slice(10, 30)), 'long key is masked and shortened in the interface');
  clock += 3650 * 86400000; t.eq(L.state().mode, 'active', 'universal key never expires or needs re-checking');
  await L.verify({ force: true }); t.eq(calls, 0, 'verify does not go online for a universal key'); t.eq(L.state().mode, 'active', 'still active after verify');
  t.eq(L.deactivate().mode, 'trial_expired', 'key can be removed from the computer');

  // device-locked keys
  const mine = OfflineKey.sign(priv, { device: 'a1b2-c3d4' }), theirs = OfflineKey.sign(priv, { device: 'FFFF-0000' });
  t.eq(OfflineKey.verify(pub, mine).device, 'A1B2-C3D4', 'device code is carried inside the key');
  const L2 = make();
  await t.rejects(async () => L2.activate(theirs), /another computer.*A1B2-C3D4/, 'key for another computer is refused and shows this device code');
  t.eq((await L2.activate(mine)).mode, 'active', 'key for this computer activates');
  L2._device = null; L2.deviceCodeFn = () => '9999-9999';
  t.eq(L2.state().mode, 'revoked', 'a device-locked key copied to another computer stops working'); t.ok(L2.state().restricted, 'and the app is restricted there');

  t.ok(/^[0-9A-F]{4}-[0-9A-F]{4}$/.test(OfflineKey.deviceCode()), 'real device code has the expected shape'); t.eq(OfflineKey.deviceCode(), OfflineKey.deviceCode(), 'device code is stable');
};
