'use strict';
/* Records a silent, captioned product demo of the real app.  Usage: xvfb-run -a -s "-screen 0 1600x1000x24" node scripts/demo-video.js [outDir] */
const { _electron } = require('playwright');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
(async () => {
  const root = path.join(__dirname, '..'), out = path.resolve(process.argv[2] || path.join(root, 'delivery', 'video'));
  fs.rmSync(out, { recursive: true, force: true }); fs.mkdirSync(out, { recursive: true });
  const data = fs.mkdtempSync(path.join(os.tmpdir(), 'msm-demo-'));
  // Show the app as a licensed copy.
  const { License } = require(path.join(root, 'src/main/services/license'));
  const L = new License({ file: path.join(data, 'license.db'), config: require(path.join(root, 'src/main/license.config.json')) });
  L.set({ license_key: 'DEMO0000-DEMO0000-DEMO0000-DEMO0000', status: 'active', activated_at: Date.now(), last_verified_at: Date.now(), email: 'demo@example.com' }); L.close();
  const env = { ...process.env, MSM_DATA_DIR: data, MSM_NO_SPLASH: '1', MSM_MAXIMIZE: '0' }; delete env.NODE_OPTIONS;
  const W = 1440, H = 900;
  const app = await _electron.launch({ executablePath: require(path.join(root, 'node_modules/electron')), args: [root, '--no-sandbox', '--force-device-scale-factor=1'], env, recordVideo: { dir: out, size: { width: W, height: H } } });
  let page = await app.firstWindow();
  for (let i = 0; i < 50 && !/index\.html/.test(page.url()); i++) { await new Promise(r => setTimeout(r, 200)); page = app.windows().find(w => /index\.html/.test(w.url())) || page; }
  await app.evaluate(({ BrowserWindow }, s) => { const w = BrowserWindow.getAllWindows().find(x => /index\.html/.test(x.webContents.getURL())); w.setContentSize(s.W, s.H); w.show(); }, { W, H });
  await page.waitForSelector('.stats');
  const t0 = Date.now();
  await page.evaluate(async () => {
    await api('settings:update', { shop_name: 'City Mobile Center', shop_address: '24 Market Street', shop_phone: '+1 555 0100', shop_email: 'hello@citymobile.example' });
    App.settings = await api('settings:get'); await applySettings(); await navigate('dashboard');
    const cur = document.createElement('div'); cur.id = 'demo-cur';
    Object.assign(cur.style, { position: 'fixed', width: '22px', height: '22px', borderRadius: '50%', background: 'rgba(37,99,235,.35)', border: '2px solid #2563eb', zIndex: 99999, pointerEvents: 'none', transform: 'translate(-50%,-50%)', left: '720px', top: '450px', transition: 'width .12s,height .12s' });
    const cap = document.createElement('div'); cap.id = 'demo-cap';
    Object.assign(cap.style, { position: 'fixed', left: '50%', bottom: '26px', transform: 'translateX(-50%)', background: 'rgba(15,23,42,.94)', color: '#fff', padding: '14px 28px', borderRadius: '14px', font: '600 22px "Segoe UI",Inter,system-ui,sans-serif', zIndex: 99998, pointerEvents: 'none', boxShadow: '0 12px 40px rgba(0,0,0,.35)', whiteSpace: 'nowrap', opacity: 0, transition: 'opacity .3s' });
    document.body.append(cur, cap);
    document.addEventListener('mousemove', e => { cur.style.left = e.clientX + 'px'; cur.style.top = e.clientY + 'px'; }, true);
    document.addEventListener('mousedown', () => { cur.style.width = '34px'; cur.style.height = '34px'; setTimeout(() => { cur.style.width = '22px'; cur.style.height = '22px'; }, 160); }, true);
    document.getElementById('toasts').style.bottom = '100px';
  });
  const wait = ms => page.waitForTimeout(ms);
  const caption = async text => { await page.evaluate(tx => { const c = document.getElementById('demo-cap'); c.style.opacity = tx ? 1 : 0; if (tx) c.textContent = tx; }, text); await wait(500); };
  let mx = 720, my = 450;
  const moveTo = async loc => { const el = typeof loc === 'string' ? page.locator(loc).first() : loc; await el.scrollIntoViewIfNeeded(); const b = await el.boundingBox(); const x = b.x + b.width / 2, y = b.y + b.height / 2; await page.mouse.move(x, y, { steps: 24 }); mx = x; my = y; await wait(180); return el; };
  const click = async loc => { await moveTo(loc); await page.mouse.down(); await wait(70); await page.mouse.up(); await wait(450); };
  const type = async (loc, text) => { await click(loc); await page.keyboard.type(text, { delay: 55 }); await wait(200); };
  const pick = async (loc, value) => { const el = await moveTo(loc); await wait(200); await el.selectOption(value); await wait(500); };
  const nav = async p => { await click(`.nav button[data-page="${p}"]`); await wait(700); };
  const field = n => `.modal [data-field="${n}"] .input`;

  // 1. Dashboard
  await caption('Mobile Shop Manager Pro — your whole shop on one screen'); await click('.seg button:has-text("This month")'); await wait(2600);
  await caption('Sales, profit, expenses, stock and customer credit at a glance'); await page.mouse.move(560, 520, { steps: 30 }); await wait(900); await page.mouse.move(1110, 520, { steps: 30 }); await wait(2000);
  // 2. Add a phone
  await caption('Add every phone with its IMEI'); await nav('mobiles'); await wait(900);
  await click('button:has-text("Add mobile")'); await page.waitForSelector('.modal'); await wait(500);
  await type(field('brand'), 'Samsung'); await type(field('model'), 'Galaxy A55'); await type(field('ram'), '8GB'); await type(field('storage'), '256GB');
  await type(field('imei1'), '356789104523871'); await type(field('purchase_price'), '500'); await type(field('selling_price'), '550');
  await caption('A duplicate IMEI is never accepted'); await wait(1300);
  await click('.modal footer .btn.primary'); await page.waitForSelector('.modal', { state: 'detached' }); await wait(1800);
  // 3. Sale
  await caption('New Sale — find the phone by model or IMEI'); await nav('newsale'); await type('.pos input[type=search]', 'Galaxy A55'); await wait(500); await click('.pick'); await wait(700);
  await caption('Add accessories to the same sale'); await click('.pos .seg button:has-text("Accessories")'); await click('.pos input[type=search]'); await page.keyboard.press('Control+A'); await page.keyboard.press('Backspace'); await wait(500); await click('.pick:has-text("Fast Charger")'); await click('.pick:has-text("Screen Protector")'); await wait(700);
  await caption('Choose the customer'); const custLabel = await page.locator('.pos select').first().locator('option', { hasText: 'Omar Khalid' }).textContent(); await pick(page.locator('.pos select').first(), { label: custLabel });
  await caption('Part payment? The balance goes to the Credit Book'); const paid = page.locator('.pos .field:has(label:text-is("Amount received")) input'); await click(paid); await page.keyboard.press('Control+A'); await page.keyboard.type('400', { delay: 90 }); await wait(1900);
  await caption('Complete the sale in one click'); await click('button:has-text("Complete sale")'); await page.waitForSelector('.modal'); await wait(900);
  await caption('A professional invoice is ready — print, PDF or WhatsApp'); await wait(3200);
  await caption('Thermal receipt layout for 80 mm printers'); await click('.modal .seg button:has-text("Thermal")'); await wait(2600); await page.keyboard.press('Escape'); await wait(600);
  // 4. Credit book
  await caption('Credit Book — see who owes you, and how much'); await nav('credit'); await wait(2200);
  await caption('Record a payment and get a receipt'); await click(page.locator('tr:has-text("Omar Khalid") button:has-text("Record payment")')); await page.waitForSelector('.modal'); await wait(500);
  await click(field('amount')); await page.keyboard.press('Control+A'); await page.keyboard.type('100', { delay: 90 }); await wait(700); await click('.modal footer .btn.primary'); await wait(3000); await page.keyboard.press('Escape'); await wait(1200);
  // 5. Stock
  await caption('Accessories with low-stock alerts'); await nav('accessories'); await wait(2600);
  await caption('Trade-in phones become used stock automatically'); await nav('exchanges'); await wait(2200);
  // 6. Reports
  await caption('13 reports — print, PDF or export to CSV'); await nav('reports'); await wait(1800);
  await caption('See your real profit after expenses'); await click('.card button:has-text("Profit & loss summary")'); await wait(2800);
  await click('.card button:has-text("Best-selling products")'); await wait(1800);
  // 7. Backup
  await caption('One-click backups keep your data safe'); await nav('backup'); await wait(1200); await click('button:has-text("Back up now")'); await wait(2600);
  // 8. Regional
  await caption('Any currency, tax and date format — works in your country'); await nav('settings'); await click('.tabs button:has-text("Regional")'); await wait(900);
  await pick('[data-field="currency_preset"] select', 'GBP'); await wait(900); await pick('[data-field="currency_preset"] select', 'AED'); await wait(900); await pick('[data-field="currency_preset"] select', 'EUR'); await wait(1400);
  // 9. Close
  await caption('Works offline · Your data stays on your computer'); await nav('dashboard'); await click('.seg button:has-text("This month")'); await wait(2600);
  await caption('Mobile Shop Manager Pro — pay once, no monthly fee'); await wait(3800);
  console.log('recorded seconds:', Math.round((Date.now() - t0) / 1000));
  const video = page.video(); await app.close();
  const file = await video.path(); fs.renameSync(file, path.join(out, 'raw.webm'));
  fs.rmSync(data, { recursive: true, force: true });
  console.log(path.join(out, 'raw.webm'));
})().catch(e => { console.error(e); process.exit(1); });
