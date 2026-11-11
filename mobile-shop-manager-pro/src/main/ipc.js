'use strict';
/**
 * Single IPC entry point. Every call is checked against this table (unknown channels are
 * rejected), gated by the optional login and by the licence state, and validated again
 * inside the services. Errors meant for the user are AppError; anything else is logged
 * and reported generically.
 */
const { ipcMain, dialog, shell, app, BrowserWindow } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { AppError } = require('./db');
const Fmt = require('../shared/format');
const S = {
  settings: require('./services/settings'), mobiles: require('./services/mobiles'), accessories: require('./services/accessories'), customers: require('./services/customers'),
  suppliers: require('./services/suppliers'), sales: require('./services/sales'), exchanges: require('./services/exchanges'), expenses: require('./services/expenses'),
  reports: require('./services/reports'), search: require('./services/search'), backup: require('./services/backup'), csv: require('./services/csv'), demo: require('./services/demo'),
};

module.exports = function registerIpc(ctx) {
  const { db, license } = ctx;
  const today = () => Fmt.today(S.settings.get(db).timezone);
  const win = () => BrowserWindow.getFocusedWindow() || ctx.getMainWindow();
  const safeName = n => String(n || 'export').replace(/[^\w.\- ]+/g, '_').slice(0, 80);
  let unlocked = false;

  function loadLocale(lang) {
    if (!/^[a-z]{2}$/.test(lang) || lang === 'en') return {};
    try { return JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'renderer', 'locales', lang + '.json'), 'utf8')); } catch (_) { return {}; }
  }
  function info() {
    return { name: app.getName(), version: app.getVersion(), platform: process.platform, electron: process.versions.electron, sqlite: db.get('SELECT sqlite_version() AS v').v,
      dataFolder: ctx.dataDir, backupFolder: S.settings.get(db).backup_folder || ctx.defaultBackupDir, portable: ctx.portable, year: new Date().getFullYear() };
  }
  /** Renders trusted, app-generated HTML in a hidden, script-less window for printing / PDF. */
  async function withPrintWindow(html, fn) {
    if (typeof html !== 'string' || html.length > 8e6) throw new AppError('Document is too large to print.');
    const file = path.join(app.getPath('temp'), `msm-print-${process.pid}-${Date.now()}.html`);
    fs.writeFileSync(file, html, 'utf8');
    const w = new BrowserWindow({ show: false, width: 900, height: 1200, webPreferences: { javascript: false, sandbox: true, contextIsolation: true, nodeIntegration: false } });
    try {
      w.webContents.on('will-navigate', e => e.preventDefault());
      w.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
      await w.loadFile(file);
      return await fn(w);
    } finally { if (!w.isDestroyed()) w.destroy(); fs.unlink(file, () => {}); }
  }
  const pdfOptions = d => d.thermal
    ? { printBackground: true, pageSize: { width: 3.15, height: Math.min(Math.max(Number(d.heightIn) || 8, 3), 60) }, margins: { top: 0, bottom: 0, left: 0, right: 0 } }
    : { printBackground: true, pageSize: 'A4', landscape: !!d.landscape, margins: { top: 0, bottom: 0, left: 0, right: 0 }, preferCSSPageSize: true };

  // channel -> [handler, flags]   flags: w = changes business data (blocked in restricted licence mode), open = allowed before login
  const H = {
    'app:bootstrap': [() => {
      const settings = S.settings.get(db);
      const locked = settings.auth_enabled && !unlocked;
      return { locked, shop_name: settings.shop_name, shop_logo: settings.shop_logo, info: locked ? { name: app.getName(), version: app.getVersion(), year: new Date().getFullYear() } : info(),
        settings: locked ? { language: settings.language } : settings, locale: loadLocale(settings.language), license: license.state(), hasDemo: locked ? false : S.demo.hasDemo(db) };
    }, 'open'],
    'app:info': [() => info()],
    'app:locale': [lang => loadLocale(String(lang))],
    'auth:login': [d => { if (!S.settings.verifyPassword(db, d && d.password)) throw new AppError('Incorrect password.', 'AUTH'); unlocked = true; return true; }, 'open'],
    'auth:lock': [() => { unlocked = false; return true; }],
    'auth:setPassword': [d => S.settings.setPassword(db, d || {})],
    'settings:get': [() => S.settings.get(db)],
    'settings:update': [d => S.settings.update(db, d)],
    'settings:pickLogo': [async () => {
      const r = await dialog.showOpenDialog(win(), { title: 'Choose shop logo', properties: ['openFile'], filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'webp'] }] });
      if (r.canceled || !r.filePaths[0]) return null;
      const f = r.filePaths[0], ext = path.extname(f).toLowerCase().replace('.', '');
      if (fs.statSync(f).size > 1000000) throw new AppError('Logo image is too large. Please use an image under 1 MB.');
      return `data:image/${ext === 'jpg' ? 'jpeg' : ext};base64,${fs.readFileSync(f).toString('base64')}`;
    }],

    'mobiles:list': [f => S.mobiles.list(db, f || {})], 'mobiles:get': [id => S.mobiles.get(db, id)], 'mobiles:brands': [() => S.mobiles.brands(db)],
    'mobiles:create': [d => S.mobiles.create(db, d, today()), 'w'], 'mobiles:update': [d => S.mobiles.update(db, d, today()), 'w'], 'mobiles:remove': [id => S.mobiles.remove(db, id), 'w'],
    'accessories:list': [f => S.accessories.list(db, f || {})], 'accessories:get': [id => S.accessories.get(db, id)],
    'accessories:create': [d => S.accessories.create(db, d, today()), 'w'], 'accessories:update': [d => S.accessories.update(db, d), 'w'], 'accessories:remove': [id => S.accessories.remove(db, id), 'w'],
    'accessories:adjust': [d => S.accessories.adjust(db, d, today()), 'w'], 'accessories:purchase': [d => S.accessories.purchase(db, d, today()), 'w'],
    'customers:list': [f => S.customers.list(db, f || {})], 'customers:get': [id => S.customers.get(db, id)], 'customers:statement': [d => S.customers.statement(db, d)],
    'customers:payments': [id => S.customers.payments(db, id)], 'customers:creditBook': [() => S.customers.creditBook(db)],
    'customers:create': [d => S.customers.create(db, d), 'w'], 'customers:update': [d => S.customers.update(db, d), 'w'], 'customers:remove': [id => S.customers.remove(db, id), 'w'],
    'customers:recordPayment': [d => S.customers.recordPayment(db, d, today()), 'w'],
    'suppliers:list': [() => S.suppliers.list(db)], 'suppliers:get': [id => S.suppliers.get(db, id)],
    'suppliers:create': [d => S.suppliers.create(db, d), 'w'], 'suppliers:update': [d => S.suppliers.update(db, d), 'w'], 'suppliers:remove': [id => S.suppliers.remove(db, id), 'w'],
    'suppliers:recordPayment': [d => S.suppliers.recordPayment(db, d, today()), 'w'],
    'exchanges:list': [f => S.exchanges.list(db, f || {})], 'exchanges:get': [id => S.exchanges.get(db, id)],
    'exchanges:create': [d => S.exchanges.create(db, d, today()), 'w'], 'exchanges:update': [d => S.exchanges.update(db, d, today()), 'w'], 'exchanges:remove': [id => S.exchanges.remove(db, id), 'w'],
    'expenses:list': [f => S.expenses.list(db, f || {})], 'expenses:summary': [r => S.expenses.summary(db, r)],
    'expenses:create': [d => S.expenses.create(db, d, today()), 'w'], 'expenses:update': [d => S.expenses.update(db, d, today()), 'w'], 'expenses:remove': [id => S.expenses.remove(db, id), 'w'],
    'sales:list': [f => S.sales.list(db, f || {})], 'sales:get': [id => S.sales.get(db, id)],
    'sales:create': [d => S.sales.create(db, d, today()), 'w'], 'sales:void': [d => S.sales.voidSale(db, d, today()), 'w'],
    'reports:dashboard': [d => S.reports.dashboard(db, { ...d, today: today() })], 'reports:run': [d => S.reports.run(db, d)], 'reports:catalog': [() => S.reports.catalog()],
    'search:query': [q => S.search.search(db, q)],
    'notify:list': [() => {
      const s = S.settings.get(db), out = [];
      if (s.low_stock_alerts) for (const a of S.accessories.lowStock(db).slice(0, 20)) out.push({ type: 'low_stock', page: 'accessories', title: a.name, text: a.quantity === 0 ? 'Out of stock' : `Only ${a.quantity} left (minimum ${a.min_stock})`, level: a.quantity === 0 ? 'danger' : 'warn' });
      const last = S.backup.lastBackup(db);
      if (!last || Date.now() - Date.parse(last.created_at) > 7 * 86400000) out.push({ type: 'backup', page: 'backup', title: 'Backup recommended', text: last ? 'Your last backup is more than 7 days old.' : 'No backup has been made yet.', level: 'warn' });
      const lic = license.state();
      if (lic.restricted || lic.mode === 'trial') out.push({ type: 'license', page: 'settings', title: lic.mode === 'trial' ? 'Trial version' : 'Licence needs attention', text: lic.message, level: lic.restricted ? 'danger' : 'info' });
      return out;
    }],

    'backup:list': [() => ({ history: S.backup.list(db), folder: S.settings.get(db).backup_folder || ctx.defaultBackupDir, last: S.backup.lastBackup(db) })],
    'backup:create': [() => S.backup.create(db, ctx.defaultBackupDir, 'manual')],
    'backup:chooseFolder': [async () => {
      const r = await dialog.showOpenDialog(win(), { title: 'Select backup folder', properties: ['openDirectory', 'createDirectory'] });
      if (r.canceled || !r.filePaths[0]) return null;
      fs.accessSync(r.filePaths[0], fs.constants.W_OK);
      S.settings.update(db, { backup_folder: r.filePaths[0] });
      return r.filePaths[0];
    }],
    'backup:openFolder': [async () => { const f = S.backup.folder(db, ctx.defaultBackupDir); await shell.openPath(f); return f; }],
    'backup:pickFile': [async () => {
      const r = await dialog.showOpenDialog(win(), { title: 'Select backup file', defaultPath: S.backup.folder(db, ctx.defaultBackupDir), properties: ['openFile'], filters: [{ name: 'Mobile Shop Manager Pro backup', extensions: ['msmbackup', 'db'] }] });
      return r.canceled || !r.filePaths[0] ? null : S.backup.validate(r.filePaths[0]);
    }],
    'backup:validate': [file => S.backup.validate(String(file))],
    'backup:restore': [d => { S.settings.requireAdmin(db, d && d.password); const r = S.backup.restore(db, String(d.file), ctx.defaultBackupDir); return r; }],
    'backup:exportCsv': [async () => {
      const r = await dialog.showOpenDialog(win(), { title: 'Choose a folder for the CSV export', properties: ['openDirectory', 'createDirectory'] });
      return r.canceled || !r.filePaths[0] ? null : S.backup.exportAllCsv(db, r.filePaths[0]);
    }],
    'backup:importCsv': [async entity => {
      const r = await dialog.showOpenDialog(win(), { title: 'Select CSV file to import', properties: ['openFile'], filters: [{ name: 'CSV', extensions: ['csv', 'txt'] }] });
      if (r.canceled || !r.filePaths[0]) return null;
      if (fs.statSync(r.filePaths[0]).size > 20e6) throw new AppError('The file is too large to import.');
      return S.csv.importCsv(db, String(entity), fs.readFileSync(r.filePaths[0], 'utf8'), today());
    }, 'w'],
    'backup:template': [async entity => {
      const content = S.csv.template(String(entity));
      const r = await dialog.showSaveDialog(win(), { title: 'Save CSV template', defaultPath: `${safeName(entity)}-import-template.csv`, filters: [{ name: 'CSV', extensions: ['csv'] }] });
      if (r.canceled || !r.filePath) return null;
      fs.writeFileSync(r.filePath, content, 'utf8'); return r.filePath;
    }],
    'file:saveCsv': [async d => {
      const content = S.csv.toCsv(Array.isArray(d.rows) ? d.rows.slice(0, 200000) : [], Array.isArray(d.columns) ? d.columns : undefined);
      const r = await dialog.showSaveDialog(win(), { title: 'Export CSV', defaultPath: safeName(d.name) + '.csv', filters: [{ name: 'CSV', extensions: ['csv'] }] });
      if (r.canceled || !r.filePath) return null;
      fs.writeFileSync(r.filePath, content, 'utf8'); return r.filePath;
    }],
    'print:html': [d => withPrintWindow(d.html, w => new Promise((resolve, reject) => {
      w.webContents.print({ silent: false, printBackground: true, margins: { marginType: 'none' } }, (ok, reason) => ok || !reason || /cancel/i.test(reason) ? resolve(ok) : reject(new AppError('Printing failed: ' + reason)));
    }))],
    'print:pdf': [async d => {
      const r = await dialog.showSaveDialog(win(), { title: 'Save as PDF', defaultPath: safeName(d.name || 'document') + '.pdf', filters: [{ name: 'PDF', extensions: ['pdf'] }] });
      if (r.canceled || !r.filePath) return null;
      const buf = await withPrintWindow(d.html, w => w.webContents.printToPDF(pdfOptions(d)));
      fs.writeFileSync(r.filePath, buf);
      return r.filePath;
    }],
    'shell:whatsapp': [async d => {
      const phone = String((d && d.phone) || '').replace(/\D/g, '');
      const text = String((d && d.text) || '').slice(0, 3000);
      if (phone && (phone.length < 7 || phone.length > 15)) throw new AppError('The phone number is not valid for WhatsApp. Include the country code.');
      await shell.openExternal(`https://wa.me/${phone}?text=${encodeURIComponent(text)}`);
      return true;
    }],
    'shell:purchase': [async () => { const u = license.config.purchaseUrl; if (!/^https:\/\//.test(u || '')) throw new AppError('No purchase page has been configured.'); await shell.openExternal(u); return true; }],
    'shell:email': [async to => { const m = String(to || ''); if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(m)) throw new AppError('No valid email address.'); await shell.openExternal('mailto:' + m); return true; }],
    'shell:showFile': [f => { const p = String(f || ''); if (p && fs.existsSync(p)) shell.showItemInFolder(p); return true; }],

    'license:status': [() => license.state(), 'open'],
    'license:activate': [d => license.activate(d && d.key), 'open'],
    'license:verify': [() => license.verify({ force: true }), 'open'],
    'license:deactivate': [d => { S.settings.requireAdmin(db, d && d.password); return license.deactivate(); }],
    'demo:load': [() => S.demo.load(db, today()), 'w'],
    'demo:remove': [() => S.demo.remove(db)],
    'demo:status': [() => S.demo.hasDemo(db)],
  };

  ipcMain.handle('api', async (event, channel, payload) => {
    try {
      if (event.senderFrame !== ctx.getMainWindow().webContents.mainFrame) throw new AppError('Request rejected.', 'FORBIDDEN');
      const entry = H[channel];
      if (!entry) throw new AppError('Unknown request.', 'FORBIDDEN');
      const [fn, flag] = entry;
      if (flag !== 'open' && S.settings.get(db).auth_enabled && !unlocked) throw new AppError('Please sign in first.', 'AUTH');
      if (flag === 'w' && license.state().restricted) throw new AppError(license.state().message, 'LICENSE_RESTRICTED');
      return { ok: true, data: await fn(payload) };
    } catch (e) {
      if (e && e.isAppError) return { ok: false, error: e.message, code: e.code };
      if (e && /UNIQUE constraint failed: mobiles\.imei/.test(e.message)) return { ok: false, error: 'This IMEI already exists in inventory.', code: 'DUPLICATE_IMEI' };
      console.error(`[ipc] ${channel}:`, e);
      return { ok: false, error: 'Something went wrong. Your data has not been changed.', code: 'INTERNAL' };
    }
  });
};
