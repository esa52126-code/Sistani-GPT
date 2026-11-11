'use strict';
const http = require('node:http');
const { License } = require('../src/main/services/license');
const DAY = 86400000;

module.exports = async function (t) {
  // Local stand-in for Gumroad's POST /v2/licenses/verify
  const keys = { 'GOOD-1111-2222-3333': { uses: 0, purchase: { email: 'buyer@example.com', id: 'p1', refunded: false } }, 'REFD-1111-2222-3333': { uses: 1, purchase: { refunded: true } },
    'DSBL-1111-2222-3333': { uses: 1, purchase: { disabled: true } } };
  let online = true, hits = 0;
  const server = http.createServer((req, res) => {
    let body = ''; req.on('data', c => body += c); req.on('end', () => {
      hits++;
      const p = new URLSearchParams(body), k = keys[p.get('license_key')];
      res.setHeader('Content-Type', 'application/json');
      if (p.get('product_id') !== 'PROD123' || !k) { res.statusCode = 404; return res.end(JSON.stringify({ success: false, message: 'That license does not exist for the provided product.' })); }
      if (p.get('increment_uses_count') === 'true') k.uses++;
      res.end(JSON.stringify({ success: true, uses: k.uses, purchase: k.purchase }));
    });
  });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const endpoint = `http://127.0.0.1:${server.address().port}/v2/licenses/verify`;
  let clock = Date.UTC(2026, 0, 1);
  const fetchImpl = (...a) => online ? fetch(...a) : Promise.reject(new Error('offline'));
  const make = (config) => new License({ file: ':memory:', config: { productId: 'PROD123', trialDays: 14, graceDays: 30, recheckDays: 7, ...config }, endpoint, fetchImpl, now: () => clock });

  t.eq(new License({ file: ':memory:', config: {} }).state().mode, 'unconfigured', 'no product id = licensing off, app unlocked');
  const L = make();
  t.eq(L.state().mode, 'trial', 'starts in trial'); t.ok(!L.state().restricted, 'trial is unrestricted');
  clock += 15 * DAY; t.eq(L.state().mode, 'trial_expired', 'trial expires'); t.ok(L.state().restricted, 'expired trial is restricted');
  await t.rejects(() => L.activate('bad key!'), /exactly as shown/, 'malformed key rejected locally');
  await t.rejects(() => L.activate('NOPE-0000-0000-0000'), /not valid/, 'unknown key rejected');
  await t.rejects(() => L.activate('REFD-1111-2222-3333'), /refunded/, 'refunded key rejected');
  await t.rejects(() => L.activate('DSBL-1111-2222-3333'), /disabled/, 'disabled key rejected');
  online = false; await t.rejects(() => L.activate('GOOD-1111-2222-3333'), /Could not reach/, 'activation offline gives a clear message'); online = true;
  const st = await L.activate('GOOD-1111-2222-3333');
  t.eq(st.mode, 'active', 'valid key activates'); t.eq(keys['GOOD-1111-2222-3333'].uses, 1, 'activation counted once'); t.ok(!st.key_masked.includes('1111'), 'key is masked for the UI');
  t.eq(st.email, 'buyer@example.com', 'buyer email cached');
  // offline grace
  online = false; hits = 0;
  clock += 29 * DAY; let s = await L.verify(); t.eq(s.mode, 'active', 'still active offline on day 29'); t.ok(s.last_error, 'failed re-check recorded, not fatal');
  clock += 2 * DAY; s = await L.verify(); t.eq(s.mode, 'verification_needed', 'grace period ends after 30 days offline'); t.ok(s.restricted, 'restricted until verified');
  online = true; s = await L.verify({ force: true }); t.eq(s.mode, 'active', 'reconnecting restores the licence'); t.eq(keys['GOOD-1111-2222-3333'].uses, 1, 're-verification does not consume activations');
  hits = 0; await L.verify(); t.eq(hits, 0, 'no network call inside the re-check interval');
  clock -= 400 * DAY; t.eq(L.state().mode, 'active', 'clock rollback does not break an active licence');
  clock += 400 * DAY;
  // refund after activation
  keys['GOOD-1111-2222-3333'].purchase.refunded = true; clock += 8 * DAY;
  s = await L.verify(); t.eq(s.mode, 'revoked', 'refund detected on re-check'); t.ok(/refunded/.test(s.message), 'revocation reason shown');
  keys['GOOD-1111-2222-3333'].purchase.refunded = false;
  t.eq(L.deactivate().mode, 'trial_expired', 'deactivate removes the key locally');
  // activation limit
  const L2 = make({ maxActivations: 1 });
  await t.rejects(() => L2.activate('GOOD-1111-2222-3333'), /maximum allowed/, 'activation limit enforced');
  // trial clock rollback
  const L3 = make(); clock += 20 * DAY; L3.touch(); clock -= 20 * DAY; t.eq(L3.state().mode, 'trial_expired', 'moving the clock back does not extend the trial');
  server.close();
};
