'use strict';
// Renders docs/*.md to branded PDFs in delivery/docs using Chromium (via Playwright).
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
(async () => {
  const { marked } = await import('marked');
  const { chromium } = require('playwright');
  const root = path.join(__dirname, '..'), out = path.join(root, 'delivery', 'docs');
  const pkg = require(path.join(root, 'package.json')), cfg = require(path.join(root, 'src/main/license.config.json'));
  fs.mkdirSync(out, { recursive: true });
  const logo = fs.readFileSync(path.join(root, 'src/renderer/assets/logo.svg'), 'utf8');
  const sums = ['Setup', 'Portable'].map(k => path.join(root, 'dist', `MobileShopManagerPro-${k}-${pkg.version}.exe`)).filter(f => fs.existsSync(f))
    .map(f => `- \`${path.basename(f)}\`  \n  \`${crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex')}\``).join('\n') || '_Build the executables first (`npm run dist:win`), then run `npm run docs` again._';
  const vars = { version: pkg.version, date: new Date().toISOString().slice(0, 10), electron: require(path.join(root, 'node_modules/electron/package.json')).version.split('.')[0], trialDays: cfg.trialDays, graceDays: cfg.graceDays, checksums: sums };
  const css = `@page{size:A4;margin:18mm 16mm 18mm}body{font-family:"Segoe UI",Inter,"Helvetica Neue",Arial,sans-serif;color:#0f172a;font-size:11pt;line-height:1.55;margin:0}
    .brand{display:flex;align-items:center;gap:12px;border-bottom:3px solid #2563eb;padding-bottom:12px;margin-bottom:22px}.brand svg{width:42px;height:42px}.brand b{font-size:13pt}.brand span{display:block;color:#64748b;font-size:9pt}
    h1{font-size:24pt;margin:0 0 6px;letter-spacing:-.01em}h2{font-size:14.5pt;margin:24px 0 8px;color:#1d4ed8;break-after:avoid}h3{font-size:11.5pt;margin:16px 0 6px;break-after:avoid}
    p,li{orphans:3;widows:3}table{border-collapse:collapse;width:100%;margin:10px 0 14px;font-size:10pt}tr{break-inside:avoid}th{background:#eff4ff;text-align:left}th,td{border:1px solid #dbe3f0;padding:6px 9px;vertical-align:top}
    code{background:#f1f5f9;border-radius:4px;padding:1px 5px;font-size:9.5pt;font-family:Consolas,"Courier New",monospace;word-break:break-all}pre{background:#0f172a;color:#e2e8f0;padding:12px;border-radius:8px;font-size:9.5pt;break-inside:avoid}pre code{background:none;color:inherit}
    blockquote{margin:12px 0;padding:10px 14px;background:#fff7e6;border-left:4px solid #d97706;border-radius:4px}blockquote p{margin:0}hr{border:0;border-top:1px solid #e5e9f2;margin:18px 0}a{color:#1d4ed8}`;
  const browser = await chromium.launch();
  for (const f of fs.readdirSync(path.join(root, 'docs')).filter(f => f.endsWith('.md')).sort()) {
    let md = fs.readFileSync(path.join(root, 'docs', f), 'utf8').replace(/\{\{(\w+)\}\}/g, (m, k) => (k in vars ? vars[k] : m));
    const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><style>${css}</style></head><body><div class="brand">${logo}<div><b>Mobile Shop Manager Pro</b><span>Version ${pkg.version}</span></div></div>${marked.parse(md)}</body></html>`;
    const page = await browser.newPage(); await page.setContent(html, { waitUntil: 'load' });
    const name = f.replace(/\.md$/, '.pdf');
    await page.pdf({ path: path.join(out, name), format: 'A4', printBackground: true, displayHeaderFooter: true, headerTemplate: '<span></span>',
      footerTemplate: `<div style="font-size:8px;color:#8492a6;width:100%;padding:0 16mm;display:flex;justify-content:space-between"><span>Mobile Shop Manager Pro ${pkg.version}</span><span><span class="pageNumber"></span> / <span class="totalPages"></span></span></div>` });
    await page.close(); console.log('  ' + name);
  }
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
