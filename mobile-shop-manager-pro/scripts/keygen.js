'use strict';
// Command-line key maker.  node scripts/keygen.js [count] [--device A1B2-C3D4]
const fs = require('node:fs'), path = require('node:path'), OfflineKey = require('../src/main/services/offline-key');
const f = path.join(__dirname, '..', 'seller-private', 'private-key.json');
if (!fs.existsSync(f)) { console.error('No signing key yet. Run: node scripts/make-keygen.js'); process.exit(1); }
const priv = JSON.parse(fs.readFileSync(f, 'utf8')), i = process.argv.indexOf('--device'), device = i > 0 ? process.argv[i + 1] : '';
if (device && !OfflineKey.normalizeDevice(device)) { console.error('A device code has 8 characters, like A1B2-C3D4.'); process.exit(1); }
for (let k = 0, n = parseInt(process.argv[2], 10) || 1; k < n; k++) console.log(OfflineKey.sign(priv, { device }));
