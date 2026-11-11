'use strict';
// Renders build/icon.png (1024), build/icon.ico (multi-size) and renderer/assets/icon.png from the SVG logo.
const { chromium } = require('playwright');
const fs = require('node:fs'), path = require('node:path'), { execFileSync } = require('node:child_process');
(async () => {
  const root = path.join(__dirname, '..'), svg = fs.readFileSync(path.join(root, 'src/renderer/assets/logo.svg'), 'utf8');
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1024, height: 1024 } });
  await p.setContent(`<body style="margin:0;background:transparent">${svg.replace('<svg ', '<svg width="1024" height="1024" ')}</body>`);
  fs.mkdirSync(path.join(root, 'build'), { recursive: true });
  await p.screenshot({ path: path.join(root, 'build/icon.png'), omitBackground: true });
  await b.close();
  execFileSync('convert', [path.join(root, 'build/icon.png'), '-resize', '256x256', path.join(root, 'src/renderer/assets/icon.png')]);
  execFileSync('convert', [path.join(root, 'build/icon.png'), '-define', 'icon:auto-resize=256,128,64,48,32,24,16', path.join(root, 'build/icon.ico')]);
  console.log('icons written');
})();
