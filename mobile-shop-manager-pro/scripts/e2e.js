'use strict';
/* Drives the real Electron app through the main workflow and captures screenshots.
 * Usage: xvfb-run -a node scripts/e2e.js [outDir]   (Linux)   |   node scripts/e2e.js   (Windows/macOS) */
const { _electron } = require('playwright');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
(async () => {
  const root = path.join(__dirname, '..'), out = path.resolve(process.argv[2] || path.join(root, 'gumroad', 'screenshots'));
  fs.mkdirSync(out, { recursive: true });
  const data = fs.mkdtempSync(path.join(os.tmpdir(), 'msm-e2e-'));
  const env = { ...process.env, MSM_DATA_DIR: data, MSM_NO_SPLASH: '1', MSM_MAXIMIZE: '0' }; delete env.NODE_OPTIONS;
  const app = await _electron.launch({ executablePath: require(path.join(root, 'node_modules/electron')), args: [root, '--no-sandbox', '--force-device-scale-factor=1'], env });
  const errors = [];
  const win = await app.firstWindow();
  let page = win;
  for (let i = 0; i < 50 && !/index\.html/.test(page.url()); i++) { await new Promise(r => setTimeout(r, 200)); page = app.windows().find(w => /index\.html/.test(w.url())) || page; }
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', e => errors.push('PAGEERROR ' + e.message));
  await app.evaluate(({ BrowserWindow }) => { const w = BrowserWindow.getAllWindows().find(x => /index\.html/.test(x.webContents.getURL())); w.setSize(1440, 900); w.show(); });
  await page.waitForSelector('.stats');
  let n = 0; const checks = [];
  const shot = async name => { await page.waitForTimeout(350); await page.screenshot({ path: path.join(out, `${String(++n).padStart(2, '0')}-${name}.png`) }); };
  const ok = (c, m) => { checks.push([!!c, m]); if (!c) console.error('  ✗ ' + m); };
  const nav = async p => { await page.click(`.nav button[data-page="${p}"]`); await page.waitForTimeout(450); };
  const field = (name) => `.modal [data-field="${name}"] .input`;
  const toastText = async () => (await page.locator('.toast').last().textContent().catch(() => '')) || '';

  await shot('dashboard');
  // 1-4 add Samsung
  await nav('mobiles'); await shot('mobile-inventory');
  await page.click('text=Add mobile'); await page.waitForSelector('.modal'); await page.waitForTimeout(200);
  await page.fill(field('brand'), 'Samsung'); await page.fill(field('model'), 'Galaxy A55'); await page.fill(field('imei1'), '356789104523871');
  await page.fill(field('purchase_price'), '500'); await page.fill(field('selling_price'), '550'); await shot('add-mobile');
  await page.click('.modal footer .btn.primary'); await page.waitForSelector('.modal', { state: 'detached' });
  ok(await page.locator('td:has-text("356789104523871")').count() === 1, 'mobile added and listed');
  // 19 duplicate IMEI
  await page.click('text=Add mobile'); await page.waitForSelector('.modal'); await page.waitForTimeout(200); await page.fill(field('brand'), 'Samsung'); await page.fill(field('model'), 'Dup'); await page.fill(field('imei1'), '356789104523871'); await page.fill(field('purchase_price'), '1'); await page.fill(field('selling_price'), '2');
  await page.click('.modal footer .btn.primary'); await page.waitForSelector('.formerr:not(.hidden)');
  { const tx = await page.textContent('.modal .formerr'); ok(/already exists/.test(tx), 'duplicate IMEI blocked in the UI: ' + tx); } await page.keyboard.press('Escape');
  // 5 customer Ahmed
  await nav('customers'); await page.click('text=Add customer'); await page.waitForSelector('.modal'); await page.waitForTimeout(200); await page.fill(field('name'), 'Ahmed'); await page.fill(field('phone'), '555 0101'); await page.click('.modal footer .btn.primary'); await page.waitForSelector('.modal', { state: 'detached' });
  await shot('customers');
  // 6-12 sale
  await nav('newsale'); await page.fill('.pos input[type=search]', '356789104523871'); await page.click('.pick'); 
  await page.selectOption('.pos .card:nth-child(2) select >> nth=0', { label: await page.locator('.pos select >> nth=0').locator('option', { hasText: 'Ahmed' }).textContent() });
  await page.fill('.pos .g2 >> nth=1 >> input >> nth=0', '300'); await shot('new-sale');
  ok(/250/.test(await page.textContent('.tot.due')), 'remaining shows 250 before completing');
  await page.click('text=Complete sale'); await page.waitForSelector('.modal'); await page.waitForTimeout(500); await shot('invoice-a4');
  await page.click('.modal .seg button:has-text("Thermal")'); await shot('invoice-thermal'); await page.keyboard.press('Escape');
  await nav('mobiles'); ok(await page.locator('tr:has-text("356789104523871") .badge:has-text("Sold")').count() === 1, 'phone status is SOLD');
  // 13-14 credit payment
  await nav('credit'); ok(/250/.test(await page.textContent('tr:has-text("Ahmed")')), 'credit book shows 250'); await shot('credit-book');
  await page.click('tr:has-text("Ahmed") >> text=Record payment'); await page.waitForSelector('.modal'); await page.waitForTimeout(200); await page.fill(field('amount'), '100'); await page.click('.modal footer .btn.primary'); await page.waitForTimeout(600);
  await shot('payment-receipt'); await page.keyboard.press('Escape'); await page.waitForTimeout(300);
  ok(/150/.test(await page.textContent('tr:has-text("Ahmed")')), 'balance is 150 after paying 100');
  // accessories, exchanges, expenses, suppliers, reports, backup, settings
  await nav('accessories'); await shot('accessories');
  await nav('sales'); await shot('sales-history');
  await nav('exchanges'); await shot('used-stock');
  await nav('expenses'); await page.click('text=Add expense'); await page.waitForSelector('.modal'); await page.waitForTimeout(200); await page.fill(field('amount'), '40'); await page.click('.modal footer .btn.primary'); await page.waitForSelector('.modal', { state: 'detached' }); await shot('expenses');
  await nav('suppliers'); await shot('suppliers');
  await nav('reports'); await shot('reports'); await page.click('text=Profit & loss summary'); await page.waitForTimeout(300); await shot('report-profit');
  for (const r of ['Daily sales summary', 'Best-selling products', 'Sales by brand', 'Mobile inventory', 'Accessories inventory', 'Low-stock products', 'Customer credit', 'Supplier purchases', 'Expenses report']) { await page.click(`.card >> text="${r}"`); await page.waitForTimeout(150); }
  await nav('backup'); await page.click('text=Back up now'); await page.waitForTimeout(700); ok(/Backup saved/.test(await toastText()), 'manual backup created'); await shot('backup');
  await nav('settings'); await shot('settings-shop');
  for (const tab of ['Regional', 'Tax', 'Invoice', 'Alerts & backup', 'Security', 'Licence', 'Demo data', 'About']) { await page.click(`.tabs button:has-text("${tab}")`); await page.waitForTimeout(150); if (['Regional', 'Tax', 'Licence'].includes(tab)) await shot('settings-' + tab.toLowerCase()); }
  // 24-25 currency/date switch
  await page.click('.tabs button:has-text("Regional")'); await page.selectOption('[data-field="currency_preset"] select', 'EUR'); await page.selectOption('[data-field="currency_position"] select', 'after_space'); await page.selectOption('[data-field="number_format"] select', 'dot_comma'); await page.selectOption('[data-field="date_format"] select', 'DD.MM.YYYY');
  await page.click('text=Save changes'); await page.waitForTimeout(500);
  await nav('dashboard'); await page.click('.seg button:has-text("This month")'); await page.waitForTimeout(500);
  ok(/€/.test(await page.textContent('.stats')), 'dashboard switched to euro'); ok(/\d\d\.\d\d\.\d{4}/.test(await page.textContent('#clock')), 'date format switched'); await shot('dashboard-euro');
  // RTL
  await nav('settings'); await page.click('.tabs button:has-text("Regional")'); await page.selectOption('[data-field="language"] select', 'ar'); await page.click('text=Save changes'); await page.waitForTimeout(900);
  ok(await page.evaluate(() => document.documentElement.dir) === 'rtl', 'Arabic switches the layout to right-to-left'); await page.click('.nav button[data-page="dashboard"]'); await page.waitForTimeout(500); await shot('dashboard-arabic-rtl');
  // global search
  await page.fill('#global-search', '4523871'); await page.waitForSelector('.results:not(.hidden) button'); ok(true, 'global search finds IMEI'); await shot('global-search'); await page.keyboard.press('Escape');
  await app.close();
  fs.rmSync(data, { recursive: true, force: true });
  const failed = checks.filter(c => !c[0]).length;
  console.log(`${checks.length - failed}/${checks.length} UI checks passed; ${errors.length} console errors`);
  errors.slice(0, 15).forEach(e => console.log('  console: ' + e));
  process.exit(failed || errors.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
