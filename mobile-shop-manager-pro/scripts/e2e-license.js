'use strict';
/* Activates a licence through the real UI against a local stand-in for Gumroad's verify endpoint. */
const { _electron } = require('playwright');
const http = require('node:http'), fs = require('node:fs'), os = require('node:os'), path = require('node:path');
(async () => {
  const root = path.join(__dirname, '..');
  const server = http.createServer((req, res) => { let b = ''; req.on('data', c => b += c); req.on('end', () => { const p = new URLSearchParams(b); res.setHeader('Content-Type', 'application/json');
    if (p.get('product_id') === 'DEMO-PRODUCT' && p.get('license_key') === 'ABCD1234-EFGH5678-IJKL9012-MNOP3456') res.end(JSON.stringify({ success: true, uses: 1, purchase: { email: 'buyer@example.com', refunded: false } }));
    else { res.statusCode = 404; res.end(JSON.stringify({ success: false, message: 'That license does not exist for the provided product.' })); } }); });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const data = fs.mkdtempSync(path.join(os.tmpdir(), 'msm-lic-'));
  const env = { ...process.env, MSM_DATA_DIR: data, MSM_NO_SPLASH: '1', MSM_MAXIMIZE: '0', MSM_LICENSE_PRODUCT: 'DEMO-PRODUCT', MSM_LICENSE_ENDPOINT: `http://127.0.0.1:${server.address().port}/v2/licenses/verify` }; delete env.NODE_OPTIONS;
  const app = await _electron.launch({ executablePath: require(path.join(root, 'node_modules/electron')), args: [root, '--no-sandbox'], env });
  let page = await app.firstWindow();
  for (let i = 0; i < 50 && !/index\.html/.test(page.url()); i++) { await new Promise(r => setTimeout(r, 200)); page = app.windows().find(w => /index\.html/.test(w.url())) || page; }
  await page.waitForSelector('.stats');
  const res = [], ok = (c, m) => { res.push(!!c); console.log((c ? '  ✓ ' : '  ✗ ') + m); };
  ok(/Trial/.test(await page.textContent('#lic-pill')), 'starts as a trial when licensing is configured');
  await page.click('.nav button[data-page="settings"]'); await page.click('.tabs button:has-text("Licence")');
  await page.fill('textarea[placeholder^="Paste your licence"]', 'WRONG000-WRONG000-WRONG000-WRONG000'); await page.click('button:has-text("Activate")'); await page.waitForSelector('.toast.err');
  ok(/not valid/.test(await page.textContent('.toast.err')), 'invalid key shows a clear error');
  await page.fill('textarea[placeholder^="Paste your licence"]', 'ABCD1234-EFGH5678-IJKL9012-MNOP3456'); await page.click('button:has-text("Activate")'); await page.waitForSelector('.badge:has-text("Licensed")');
  ok(true, 'valid key activates through the main process'); ok(/buyer@example.com/.test(await page.textContent('.kv')), 'activation details shown');
  ok(!(await page.textContent('.kv')).includes('EFGH5678'), 'key is masked in the interface');
  if (process.argv[2]) await page.screenshot({ path: process.argv[2] });
  await app.close(); server.close(); fs.rmSync(data, { recursive: true, force: true });
  process.exit(res.every(Boolean) ? 0 : 1);
})().catch(e => { console.error(e); process.exit(1); });
