'use strict';
// Builds 1280x720 marketing cover images (rendered at 2x) from real app screenshots into gumroad/covers.
const { chromium } = require('playwright');
const fs = require('node:fs'), path = require('node:path');
(async () => {
  const root = path.join(__dirname, '..'), out = path.join(root, 'gumroad', 'covers'); fs.mkdirSync(out, { recursive: true });
  const shot = n => 'file://' + path.join(root, 'gumroad', 'screenshots', n), logo = fs.readFileSync(path.join(root, 'src/renderer/assets/logo.svg'), 'utf8');
  const css = `*{box-sizing:border-box}html,body{margin:0}body{width:1280px;height:720px;overflow:hidden;font-family:"Segoe UI",Inter,system-ui,sans-serif;color:#fff;position:relative}
    .dark{background:radial-gradient(1200px 700px at 85% 10%,#1d4ed8 0%,transparent 60%),linear-gradient(135deg,#0b1224 0%,#0f172a 45%,#172554 100%)}
    .light{background:linear-gradient(135deg,#eef4ff 0%,#f8fafc 55%,#ecfdf3 100%);color:#0f172a}
    .brand{display:flex;align-items:center;gap:14px;font-weight:700;font-size:22px}.brand svg{width:52px;height:52px;border-radius:13px;box-shadow:0 8px 24px rgba(0,0,0,.35)}
    h1{font-size:60px;line-height:1.04;letter-spacing:-.03em;margin:26px 0 18px;font-weight:800}h1 em{font-style:normal;color:#4ade80}.light h1 em{color:#2563eb}
    p.lead{font-size:23px;line-height:1.4;margin:0;color:#cbd5e1;max-width:520px}.light p.lead{color:#475569}
    .chips{display:flex;flex-wrap:wrap;gap:10px;margin-top:28px}.chip{padding:9px 16px;border-radius:999px;font-size:17px;font-weight:650;background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.2)}
    .light .chip{background:#fff;border-color:#dbe3f0;box-shadow:0 2px 6px rgba(15,23,42,.06)}.chip b{color:#4ade80;margin-right:7px}.light .chip b{color:#16a34a}
    .col{position:absolute;left:64px;top:56px;width:560px}
    .win{position:absolute;border-radius:14px;overflow:hidden;box-shadow:0 30px 80px rgba(2,6,23,.55),0 0 0 1px rgba(255,255,255,.12);background:#fff}.light .win{box-shadow:0 26px 70px rgba(15,23,42,.22),0 0 0 1px #dbe3f0}
    .win img{display:block;width:100%}
    ul{list-style:none;padding:0;margin:26px 0 0}li{font-size:22px;margin:13px 0;display:flex;gap:12px;align-items:center;font-weight:600}
    li i{flex:none;width:28px;height:28px;border-radius:50%;background:#16a34a;display:grid;place-items:center;font-style:normal;font-size:16px;color:#fff}
    .foot{position:absolute;left:64px;bottom:44px;font-size:17px;color:#94a3b8;font-weight:600}.light .foot{color:#64748b}`;
  const brand = `<div class="brand">${logo}<span>Mobile Shop Manager Pro</span></div>`;
  const tick = t => `<li><i>✓</i>${t}</li>`;
  const pages = {
    'cover-1-hero': `<body class="dark"><div class="col">${brand}<h1>Run your mobile shop from <em>one screen</em></h1><p class="lead">Inventory, sales, customer credit and profit reports for phone retailers.</p>
      <div class="chips"><span class="chip"><b>✓</b>Works offline</span><span class="chip"><b>✓</b>Pay once</span><span class="chip"><b>✓</b>IMEI tracking</span></div></div>
      <div class="win" style="left:650px;top:96px;width:860px;transform:perspective(1800px) rotateY(-9deg) rotateX(2deg)"><img src="${shot('26-dashboard-month.png')}"></div><div class="foot">For Windows 10 &amp; 11</div></body>`,
    'cover-2-sales': `<body class="light"><div class="col" style="width:500px">${brand}<h1>Sell a phone in <em>under a minute</em></h1>
      <ul>${['Find any phone by model or IMEI', 'Add accessories, discount, trade-in', 'Part payment goes to the credit book', 'Invoice: print, PDF or WhatsApp'].map(tick).join('')}</ul></div>
      <div class="win" style="left:600px;top:70px;width:720px"><img src="${shot('05-new-sale.png')}"></div>
      <div class="win" style="left:760px;top:330px;width:470px;height:340px"><img src="${shot('06-invoice-a4.png')}" style="width:1010px;margin:-96px 0 0 -272px"></div><div class="foot">Mobile Shop Manager Pro · Windows 10 &amp; 11</div></body>`,
    'cover-3-profit': `<body class="dark"><div class="col" style="width:520px">${brand}<h1>Know your <em>real profit</em>, every day</h1>
      <ul>${['Profit per sale, per day, per month', 'Expenses deducted automatically', 'See who owes you, and how much', '13 reports: print, PDF or CSV'].map(tick).join('')}</ul></div>
      <div class="win" style="left:640px;top:64px;width:700px"><img src="${shot('16-report-profit.png')}"></div>
      <div class="win" style="left:560px;top:400px;width:560px;height:262px"><img src="${shot('08-credit-book.png')}" style="width:860px;margin:-78px 0 0 -150px"></div><div class="foot">Mobile Shop Manager Pro · Windows 10 &amp; 11</div></body>`,
    'cover-4-global': `<body class="light"><div class="col" style="width:520px">${brand}<h1>Your shop. Your data. <em>No monthly fee.</em></h1>
      <p class="lead">Everything is stored on your own computer and backed up automatically.</p>
      <div class="chips"><span class="chip"><b>✓</b>No internet needed</span><span class="chip"><b>✓</b>Any currency</span><span class="chip"><b>✓</b>VAT / GST / sales tax</span><span class="chip"><b>✓</b>Automatic backups</span><span class="chip"><b>✓</b>A4 &amp; thermal receipts</span></div></div>
      <div class="win" style="left:640px;top:60px;width:700px"><img src="${shot('22-dashboard-euro.png')}"></div>
      <div class="win" style="left:590px;top:400px;width:520px;height:262px"><img src="${shot('19-settings-regional.png')}" style="width:900px;margin:-150px 0 0 -160px"></div><div class="foot">Mobile Shop Manager Pro · Windows 10 &amp; 11</div></body>`,
  };
  const b = await chromium.launch(), ctx = await b.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 2 });
  for (const [name, body] of Object.entries(pages)) {
    const p = await ctx.newPage(), f = path.join(out, name + '.html');
    fs.writeFileSync(f, `<!doctype html><html><head><meta charset="utf-8"><style>${css}</style></head>${body}</html>`);
    await p.goto('file://' + f, { waitUntil: 'load' }); await p.waitForTimeout(300);
    await p.screenshot({ path: path.join(out, name + '.png') }); await p.close(); fs.unlinkSync(f); console.log(name + '.png');
  }
  await b.close();
})().catch(e => { console.error(e); process.exit(1); });
