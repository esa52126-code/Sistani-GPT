# Mobile Shop Manager Pro

Offline-first desktop software for mobile phone retailers: IMEI-tracked inventory, sales, customer credit, trade-ins, expenses, suppliers, reports, invoices and backups. Built with Electron and a local SQLite database; licensed with Gumroad licence keys.

## Run from source

Requires Node.js 22 or newer.

```
npm install
npm start
```

## Commands

| Command | What it does |
|---|---|
| `npm start` | Run the app in development |
| `npm test` | Business-logic, accounting, backup and licensing tests (no display needed) |
| `npm run e2e` | Drives the real app through the main workflow and saves screenshots to `gumroad/screenshots` (needs Playwright; on Linux run under `xvfb-run`) |
| `npm run dist:win` | Windows installer + portable `.exe` in `dist/` (on Linux this needs Wine) |
| `npm run dist:mac` / `dist:linux` | macOS DMG / Linux AppImage (run on that OS) |
| `npm run docs` | Render `docs/*.md` to PDF in `delivery/docs` |
| `npm run package:gumroad` | Assemble the customer ZIP and seller kit in `delivery/` |
| `npm run strings` | Regenerate `src/renderer/locales/en.json` for translators |
| `npm run icons` | Regenerate icons from `src/renderer/assets/logo.svg` |

`dist/` and `delivery/` are build outputs and are not committed (the executables are over 100 MB each).

## Layout

```
src/main/            Electron main process
  main.js            windows, menu, security lockdown, start-up
  preload.js         the only bridge exposed to the UI (one validated invoke function)
  ipc.js             channel table: login gate, licence gate, dialogs, print/PDF
  db.js              SQLite wrapper (Node's built-in driver), transactions
  migrations.js      schema migrations (PRAGMA user_version)
  license.config.json  seller's Gumroad product ID and licence policy
  services/          business logic, one file per area; runs under plain Node for tests
src/shared/          formatting, sale maths and reference data used by main and UI
src/renderer/        interface (plain HTML/CSS/JS, no framework, no remote content)
tests/               automated tests
docs/                customer documentation (Markdown → PDF)
gumroad/             product listing, seller guide, screenshots
```

## Design notes

- **No native modules.** The database uses Node's built-in `node:sqlite`, so there is nothing to compile per platform.
- **Security.** Context isolation on, Node integration off, sandboxed renderer, strict Content-Security-Policy, navigation and new windows blocked, all web requests other than local files cancelled. Every IPC call is checked against a whitelist and validated again in the services.
- **One source of truth for money.** `calcSale` in `src/shared/format.js` is used by the sale screen and by the service that saves the sale.
- **Financial history is append-only.** Sales can be voided with a reason, never deleted; anything referenced by a sale cannot be deleted.
- **Licensing is separate from data.** Licence state lives in `license.db`; the shop database knows nothing about it. Two key types are accepted: Gumroad keys (verified online) and universal `MSM1-` keys signed with the seller's private key and verified offline with the public key in `license.config.json`. The private key and key generator live in `seller-private/`, which is never committed. See `gumroad/SELLER-GUIDE.md`.

## What has been verified, and what has not

Verified in the development environment (Linux):

- `npm test` — 161 checks covering the full sale → credit → payment → backup → restore workflow, IMEI uniqueness, stock adjustments, trade-ins and resale profit, expenses, tax (inclusive, exclusive, exempt), currency and date formats, time zones, void, demo-data removal, and licence activation, refund, disable, activation limit, offline grace period and clock rollback against a local stand-in for Gumroad's endpoint.
- `npm run e2e` — the real Electron app driven through adding a phone, duplicate-IMEI rejection, adding a customer, a part-paid sale, invoice (A4 and thermal), credit payment, expense, every report, backup, currency/date switch and right-to-left layout, with no console errors.
- Licence activation through the real interface and Electron's network stack, against the local stand-in.
- The Windows installer and portable executables build successfully.

**Not verified here:**

- **Running on real Windows.** The executables were cross-built on Linux. Wine could not start Electron's browser processes in this environment, so installation and first launch on Windows 10/11 still need to be tested on a real PC (or with the included GitHub Actions workflow, which runs the tests and builds on Windows).
- **Gumroad's live API.** The network policy of the development environment blocks `api.gumroad.com`. Behaviour was tested against a stand-in that follows Gumroad's documented response format. Do the test purchase described in the seller guide before selling.
- **Physical printing** on A4 and thermal printers. PDF output uses the same layout.
- macOS and Linux packages were not built.
