'use strict';
// Collects every translatable string (t('…') calls and shared label maps) into
// src/renderer/locales/en.json. Copy that file to xx.json and translate the values.
const fs = require('node:fs'), path = require('node:path');
const root = path.join(__dirname, '..', 'src'), found = new Set();
const walk = d => fs.readdirSync(d, { withFileTypes: true }).forEach(e => { const p = path.join(d, e.name); if (e.isDirectory()) walk(p); else if (p.endsWith('.js')) scan(fs.readFileSync(p, 'utf8')); });
function scan(src) { for (const re of [/\bt\('((?:[^'\\]|\\.)+)'/g, /\bt\("((?:[^"\\]|\\.)+)"/g]) for (const m of src.matchAll(re)) found.add(m[1].replace(/\\(['"])/g, '$1')); }
walk(path.join(root, 'renderer', 'js'));
const C = require(path.join(root, 'shared', 'constants.js'));
for (const k of Object.keys(C)) if (k.endsWith('_LABELS') && !Array.isArray(C[k])) Object.values(C[k]).forEach(v => found.add(v));
require(path.join(root, 'main', 'services', 'reports.js')).catalog().forEach(r => found.add(r.title));
const out = Object.fromEntries([...found].sort((a, b) => a.localeCompare(b)).map(k => [k, k]));
fs.writeFileSync(path.join(root, 'renderer', 'locales', 'en.json'), JSON.stringify(out, null, 1) + '\n');
console.log(Object.keys(out).length + ' strings written to locales/en.json');
