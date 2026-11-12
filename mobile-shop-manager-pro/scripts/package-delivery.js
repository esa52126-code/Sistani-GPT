'use strict';
// Assembles the customer download (ZIP) and the seller kit under delivery/.
const fs = require('node:fs'), path = require('node:path'), { execFileSync } = require('node:child_process');
const root = path.join(__dirname, '..'), pkg = require(path.join(root, 'package.json')), v = pkg.version;
const name = `MobileShopManagerPro-v${v}`, base = path.join(root, 'delivery'), dir = path.join(base, name), docs = path.join(base, 'docs');
const need = f => { if (!fs.existsSync(f)) { console.error('Missing: ' + f + '\nRun "npm run dist:win" and "npm run docs" first.'); process.exit(1); } return f; };
const setup = need(path.join(root, 'dist', `MobileShopManagerPro-Setup-${v}.exe`)), portable = need(path.join(root, 'dist', `MobileShopManagerPro-Portable-${v}.exe`));
need(path.join(docs, '03-User-Manual.pdf'));
fs.rmSync(dir, { recursive: true, force: true });
const mk = d => { fs.mkdirSync(path.join(dir, d), { recursive: true }); return path.join(dir, d); };
fs.copyFileSync(setup, path.join(mk('1-Windows-Installer'), path.basename(setup)));
fs.copyFileSync(portable, path.join(mk('2-Portable-Version'), path.basename(portable)));
const d3 = mk('3-Documentation');
for (const f of fs.readdirSync(docs).filter(f => f.endsWith('.pdf'))) fs.copyFileSync(path.join(docs, f), path.join(d3, f));
fs.copyFileSync(path.join(root, 'LICENSE.txt'), path.join(dir, 'LICENSE.txt'));
const crlf = s => s.replace(/\r?\n/g, '\r\n');
fs.writeFileSync(path.join(dir, 'VERSION.txt'), crlf(`Mobile Shop Manager Pro\nVersion ${v}\nBuilt ${new Date().toISOString().slice(0, 10)}\nPlatform: Windows 10 / 11 (64-bit)\n`));
fs.writeFileSync(path.join(dir, 'CHANGELOG.txt'), crlf(fs.readFileSync(path.join(root, 'docs', '06-Changelog.md'), 'utf8').replace(/^#+ /gm, '')));
fs.writeFileSync(path.join(dir, 'README - START HERE.txt'), crlf(`MOBILE SHOP MANAGER PRO  v${v}
=====================================

Thank you for your purchase.

QUICK INSTALL
  1. Open the folder "1-Windows-Installer".
  2. Double-click MobileShopManagerPro-Setup-${v}.exe
  3. If Windows shows "Windows protected your PC", click "More info", then "Run anyway".
  4. Open the app, go to Settings > Licence and paste the licence key you received with your purchase.

NO INSTALLATION?
  Use the portable version in "2-Portable-Version". Copy it to any folder or USB drive and run it.

WHAT IS IN THIS DOWNLOAD
  1-Windows-Installer    Installer for Windows 10 / 11 (64-bit)
  2-Portable-Version     Runs without installation
  3-Documentation        Installation Guide, Quick-Start Guide, User Manual,
                         Licence Activation, Troubleshooting, Changelog,
                         Version Information, Customer Support Information (PDF)
  LICENSE.txt            Licence agreement
  VERSION.txt            Version details
  CHANGELOG.txt          What is new

YOUR DATA
  Everything you enter is stored only on your computer.
  Please make regular backups: Backup & Restore > Back up now.
`));
const zip = path.join(base, `${name}-Gumroad.zip`);
fs.rmSync(zip, { force: true });
if (process.platform === 'win32') execFileSync('powershell', ['-NoProfile', '-Command', `Compress-Archive -Path '${dir}' -DestinationPath '${zip}'`], { stdio: 'inherit' });
else execFileSync('zip', ['-r', '-q', '-1', zip, name], { cwd: base, stdio: 'inherit' });
// Seller kit (not for customers): listing text, seller guide, screenshots.
const kit = path.join(base, 'Seller-Kit'); fs.rmSync(kit, { recursive: true, force: true }); fs.cpSync(path.join(root, 'gumroad'), kit, { recursive: true });
console.log(`Customer package: ${zip} (${(fs.statSync(zip).size / 1048576).toFixed(0)} MB)\nSeller kit:       ${kit}`);
