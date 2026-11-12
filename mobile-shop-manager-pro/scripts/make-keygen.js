'use strict';
/* Seller set-up for universal licence keys.
 *  - creates the seller's signing key pair once (seller-private/private-key.json — NEVER commit or share it)
 *  - writes the public half into src/main/license.config.json so the app can verify keys
 *  - builds seller-private/License-Key-Generator.html (works offline in a browser) and a starter list of keys
 * Usage: node scripts/make-keygen.js [number of starter keys, default 500] */
const crypto = require('node:crypto'), fs = require('node:fs'), path = require('node:path');
const OfflineKey = require('../src/main/services/offline-key');
const root = path.join(__dirname, '..'), dir = path.join(root, 'seller-private'), privFile = path.join(dir, 'private-key.json'), cfgFile = path.join(root, 'src/main/license.config.json');
fs.mkdirSync(dir, { recursive: true });
let priv;
if (fs.existsSync(privFile)) priv = JSON.parse(fs.readFileSync(privFile, 'utf8'));
else { priv = crypto.generateKeyPairSync('ec', { namedCurve: 'P-256' }).privateKey.export({ format: 'jwk' }); fs.writeFileSync(privFile, JSON.stringify(priv, null, 2)); console.log('New signing key created.'); }
const pub = { kty: priv.kty, crv: priv.crv, x: priv.x, y: priv.y };
const cfg = JSON.parse(fs.readFileSync(cfgFile, 'utf8')); cfg.offlinePublicKey = pub; fs.writeFileSync(cfgFile, JSON.stringify(cfg, null, 2) + '\n');
const html = fs.readFileSync(path.join(__dirname, 'keygen-template.html'), 'utf8').replace('/*PRIVATE_JWK*/null', JSON.stringify(priv)).replace('/*PUBLIC_JWK*/null', JSON.stringify(pub));
fs.writeFileSync(path.join(dir, 'License-Key-Generator.html'), html);
const n = Math.max(1, Math.min(20000, parseInt(process.argv[2], 10) || 500)), keys = [];
for (let i = 0; i < n; i++) keys.push(OfflineKey.sign(priv));
fs.writeFileSync(path.join(dir, `Licence-Keys-${n}.txt`), keys.join('\r\n') + '\r\n');
console.log(`Public key written to license.config.json\nGenerator: ${path.join(dir, 'License-Key-Generator.html')}\n${n} keys:  ${path.join(dir, `Licence-Keys-${n}.txt`)}`);
