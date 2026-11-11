'use strict';
// Minimal test runner: each test file exports an async function(t) and uses t.ok / t.eq / t.throws.
const fs = require('node:fs'), path = require('node:path');
(async () => {
  let pass = 0, fail = 0;
  const t = {
    ok(c, m) { if (c) { pass++; } else { fail++; console.error('  ✗ ' + m); } },
    eq(a, b, m) { const ok = typeof a === 'number' && typeof b === 'number' ? Math.abs(a - b) < 1e-6 : JSON.stringify(a) === JSON.stringify(b); t.ok(ok, `${m} (expected ${JSON.stringify(b)}, got ${JSON.stringify(a)})`); },
    throws(fn, re, m) { try { fn(); t.ok(false, m + ' (did not throw)'); } catch (e) { t.ok(re.test(e.message) || re.test(e.code || ''), `${m} (wrong error: ${e.message})`); } },
    async rejects(fn, re, m) { try { await fn(); t.ok(false, m + ' (did not reject)'); } catch (e) { t.ok(re.test(e.message), `${m} (wrong error: ${e.message})`); } },
  };
  for (const f of fs.readdirSync(__dirname).filter(f => f.endsWith('.test.js')).sort()) {
    const before = fail; console.log('• ' + f);
    try { await require(path.join(__dirname, f))(t); } catch (e) { fail++; console.error('  ✗ crashed: ' + e.stack); }
    if (fail === before) console.log('  ✓ ok');
  }
  console.log(`\n${pass} checks passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
