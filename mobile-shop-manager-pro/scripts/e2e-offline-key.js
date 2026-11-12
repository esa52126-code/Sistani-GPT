'use strict';
/* Makes a key in the browser generator, then activates it in the real app (no network). Needs seller-private/ (npm run keygen:setup). */
const { _electron, chromium } = require('playwright');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
(async () => {
  const root = path.join(__dirname, '..'), OfflineKey = require(path.join(root, 'src/main/services/offline-key'));
  const pub = require(path.join(root, 'src/main/license.config.json')).offlinePublicKey;
  const res = [], ok = (c, m) => { res.push(!!c); console.log((c ? '  ✓ ' : '  ✗ ') + m); };
  const b = await chromium.launch(), g = await b.newPage({ viewport: { width: 420, height: 900 } });
  await g.goto('file://' + path.join(root, 'seller-private', 'License-Key-Generator.html'));
  await g.click('#one'); await g.waitForFunction(() => document.getElementById('oneOut').value.length > 50);
  const key = await g.inputValue('#oneOut');
  ok(OfflineKey.verify(pub, key).ok, 'key made in the browser generator is accepted by the app\'s verifier');
  await g.fill('#dev', OfflineKey.deviceCode()); await g.click('#one'); await g.waitForFunction(() => /device/.test(document.getElementById('oneMsg').textContent));
  const bound = await g.inputValue('#oneOut'); ok(OfflineKey.verify(pub, bound).device === OfflineKey.deviceCode(), 'generator locks a key to a device code');
  await g.fill('#n', '25'); await g.click('#many'); await g.waitForFunction(() => document.getElementById('manyOut').value.split('\n').length === 25);
  const many = (await g.inputValue('#manyOut')).split('\n'); ok(many.every(k => OfflineKey.verify(pub, k).ok) && new Set(many).size === 25, 'batch of 25 unique valid keys');
  await g.fill('#chk', key); await g.click('#check'); await g.waitForFunction(() => document.getElementById('chkMsg').textContent.length > 0); ok(/Genuine/.test(await g.textContent('#chkMsg')), 'generator can check a key');
  if (process.argv[2]) await g.screenshot({ path: process.argv[2], fullPage: true });
  await b.close();

  const data = fs.mkdtempSync(path.join(os.tmpdir(), 'msm-off-'));
  const env = { ...process.env, MSM_DATA_DIR: data, MSM_NO_SPLASH: '1', MSM_MAXIMIZE: '0' }; delete env.NODE_OPTIONS;
  const app = await _electron.launch({ executablePath: require(path.join(root, 'node_modules/electron')), args: [root, '--no-sandbox'], env });
  let page = await app.firstWindow();
  for (let i = 0; i < 50 && !/index\.html/.test(page.url()); i++) { await new Promise(r => setTimeout(r, 200)); page = app.windows().find(w => /index\.html/.test(w.url())) || page; }
  await page.waitForSelector('.stats');
  await page.click('.nav button[data-page="settings"]'); await page.click('.tabs button:has-text("Licence")');
  ok((await page.textContent('.content')).includes(OfflineKey.deviceCode()), 'app shows this computer\'s device code');
  const box = 'textarea[placeholder^="Paste your licence"]';
  await page.fill(box, key.slice(0, 40)); await page.click('button:has-text("Activate")'); await page.waitForSelector('.toast.err'); ok(/incomplete/.test(await page.textContent('.toast.err')), 'incomplete key gives a clear message');
  await page.fill(box, bound); await page.click('button:has-text("Activate")'); await page.waitForSelector('.badge:has-text("Licensed")'); ok(true, 'device-locked key from the generator activates in the app without internet');
  ok(/Licensed/.test(await page.textContent('#lic-pill')), 'sidebar shows Licensed');
  if (process.argv[3]) await page.screenshot({ path: process.argv[3] });
  await app.close(); fs.rmSync(data, { recursive: true, force: true });
  process.exit(res.every(Boolean) ? 0 : 1);
})().catch(e => { console.error(e); process.exit(1); });
