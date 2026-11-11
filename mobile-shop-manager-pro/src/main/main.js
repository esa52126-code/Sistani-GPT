'use strict';
const { app, BrowserWindow, Menu, session, dialog, shell } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const { Database } = require('./db');
const { License } = require('./services/license');
const Backup = require('./services/backup');
const Settings = require('./services/settings');
const Demo = require('./services/demo');
const Fmt = require('../shared/format');
const registerIpc = require('./ipc');

const isDev = !app.isPackaged;
// Portable build keeps its data beside the .exe so it can live on a USB drive.
const portableDir = process.env.PORTABLE_EXECUTABLE_DIR;
const dataDir = (isDev && process.env.MSM_DATA_DIR) || (portableDir ? path.join(portableDir, 'MobileShopManagerPro-Data') : path.join(app.getPath('userData'), 'data'));
if (portableDir || (isDev && process.env.MSM_DATA_DIR)) app.setPath('userData', path.join(dataDir, 'app'));

let mainWindow = null, splash = null, db = null, license = null;

if (!app.requestSingleInstanceLock()) { app.quit(); }
else {
  app.on('second-instance', () => { if (mainWindow) { if (mainWindow.isMinimized()) mainWindow.restore(); mainWindow.focus(); } });
  app.whenReady().then(start).catch(fatal);
}

function fatal(e) {
  console.error(e);
  dialog.showErrorBox('Mobile Shop Manager Pro', 'The application could not start.\n\n' + (e && e.message ? e.message : e) + '\n\nYour data has not been changed. See the Troubleshooting guide for help.');
  app.exit(1);
}

function createSplash() {
  splash = new BrowserWindow({ width: 460, height: 300, frame: false, resizable: false, movable: true, show: false, alwaysOnTop: true, skipTaskbar: true, backgroundColor: '#0f172a',
    webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false, javascript: false } });
  splash.loadFile(path.join(__dirname, '..', 'renderer', 'splash.html'));
  splash.once('ready-to-show', () => splash && splash.show());
}

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1440, height: 900, minWidth: 1100, minHeight: 680, show: false, backgroundColor: '#f4f6fb', title: 'Mobile Shop Manager Pro',
    icon: path.join(__dirname, '..', 'renderer', 'assets', 'icon.png'),
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false, sandbox: true, webSecurity: true, spellcheck: false, devTools: isDev },
  });
  const wc = mainWindow.webContents;
  wc.on('will-navigate', e => e.preventDefault());                // the app is a single local page
  wc.setWindowOpenHandler(() => ({ action: 'deny' }));
  wc.on('will-attach-webview', e => e.preventDefault());
  mainWindow.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'));
  const started = Date.now();
  mainWindow.once('ready-to-show', () => {
    setTimeout(() => { if (splash && !splash.isDestroyed()) splash.destroy(); splash = null; if (!mainWindow) return; mainWindow.show(); if (process.env.MSM_MAXIMIZE !== '0') mainWindow.maximize(); },
      Math.max(0, (isDev && process.env.MSM_NO_SPLASH ? 0 : 1400) - (Date.now() - started)));
  });
  mainWindow.on('closed', () => { mainWindow = null; });
}

function buildMenu() {
  const send = action => mainWindow && mainWindow.webContents.send('event:menu', action);
  const template = [
    { label: 'File', submenu: [
      { label: 'New Sale', accelerator: 'CmdOrCtrl+N', click: () => send('nav:new-sale') },
      { label: 'Back Up Now', accelerator: 'CmdOrCtrl+B', click: () => send('backup') },
      { type: 'separator' }, { label: 'Settings', accelerator: 'CmdOrCtrl+,', click: () => send('nav:settings') }, { type: 'separator' }, { role: 'quit' } ] },
    { label: 'Edit', submenu: [{ role: 'undo' }, { role: 'redo' }, { type: 'separator' }, { role: 'cut' }, { role: 'copy' }, { role: 'paste' }, { role: 'selectAll' }] },
    { label: 'View', submenu: [{ label: 'Search', accelerator: 'CmdOrCtrl+K', click: () => send('search') }, { type: 'separator' }, { role: 'resetZoom' }, { role: 'zoomIn' }, { role: 'zoomOut' }, { type: 'separator' }, { role: 'togglefullscreen' },
      ...(isDev ? [{ type: 'separator' }, { role: 'reload' }, { role: 'toggleDevTools' }] : [])] },
    { label: 'Help', submenu: [{ label: 'Keyboard Shortcuts', accelerator: 'F1', click: () => send('shortcuts') }, { label: 'Open Data Folder', click: () => shell.openPath(dataDir) }, { type: 'separator' }, { label: 'About Mobile Shop Manager Pro', click: () => send('about') }] },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

async function start() {
  app.setAppUserModelId('com.mobileshopmanagerpro.app');
  // Lock the renderer down: no permissions, no remote content.
  session.defaultSession.setPermissionRequestHandler((_wc, _perm, cb) => cb(false));
  session.defaultSession.webRequest.onBeforeRequest((details, cb) => cb({ cancel: !/^(file|devtools|data|blob|chrome-extension):/.test(details.url) }));
  createSplash();

  fs.mkdirSync(dataDir, { recursive: true });
  db = new Database(path.join(dataDir, 'shop.db'));
  const defaultBackupDir = portableDir ? path.join(dataDir, 'Backups') : path.join(app.getPath('documents'), 'Mobile Shop Manager Pro Backups');

  let config = {};
  try { config = JSON.parse(fs.readFileSync(path.join(__dirname, 'license.config.json'), 'utf8')); } catch (_) { /* licensing stays off */ }
  // Developers can point at a local mock server while testing; ignored in packaged builds.
  if (isDev && process.env.MSM_LICENSE_PRODUCT) config.productId = process.env.MSM_LICENSE_PRODUCT;
  license = new License({ file: path.join(dataDir, 'license.db'), config, endpoint: isDev ? process.env.MSM_LICENSE_ENDPOINT : undefined,
    // Chromium network stack (honours the system proxy) in an isolated session; only the main process can use it.
    fetchImpl: (url, opts) => session.fromPartition('license-net').fetch(url, opts) });
  license.touch();

  // First run: realistic sample data so the app is not empty (removable in Settings).
  if (!Settings.raw(db, 'first_run_done')) {
    try { if (db.get('SELECT COUNT(*) AS n FROM mobiles').n === 0 && process.env.MSM_NO_DEMO !== '1') Demo.load(db, Fmt.today('system')); } catch (e) { console.error(e); }
    Settings.setRaw(db, 'first_run_done', 'true');
  }

  registerIpc({ db, license, dataDir, defaultBackupDir, portable: !!portableDir, getMainWindow: () => mainWindow });
  buildMenu();
  createMainWindow();

  Backup.autoIfDue(db, defaultBackupDir);
  const recheck = () => license.verify().then(s => mainWindow && mainWindow.webContents.send('event:license', s)).catch(() => {});
  setTimeout(recheck, 8000);
  setInterval(() => { license.touch(); recheck(); Backup.autoIfDue(db, defaultBackupDir); }, 6 * 3600 * 1000).unref();

  app.on('activate', () => { if (!mainWindow) createMainWindow(); });
}

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
app.on('before-quit', () => { try { license && license.close(); db && db.close(); } catch (_) { /* ignore */ } });
app.on('web-contents-created', (_e, contents) => { contents.on('will-attach-webview', e => e.preventDefault()); });
