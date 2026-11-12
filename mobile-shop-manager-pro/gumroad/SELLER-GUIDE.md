# Seller Guide — selling Mobile Shop Manager Pro

The app accepts **two kinds of licence key**, and both can be switched on at the same time:

| | Universal keys (`MSM1-…`) | Gumroad keys |
|---|---|---|
| Who creates them | You, with the Licence Key Generator | Gumroad, automatically per sale |
| Where you can sell | Anywhere: any store, your website, WhatsApp, in person | Gumroad only |
| Internet needed by the customer | Never | Once, to activate |
| Can a refunded key be switched off? | No | Yes |
| Can be locked to one computer | Yes (device code) | No |

## Universal keys — sell on any platform

Your private seller files (never share or upload these):

- `License-Key-Generator.html` — open it in Chrome, Edge or Firefox. It works without internet.
- `Licence-Keys-500.txt` — 500 ready-made keys, one per line.
- `private-key.json` — your signing key. **Back it up.** If it is lost, new keys can only be made after creating a new signing key and rebuilding the app, and keys from the old one stop being accepted by the new build.

How to use them:

- **Stores that accept a list of keys** (one key handed out per sale): upload `Licence-Keys-500.txt`, or create a bigger list with the generator.
- **Stores without key support, or direct sales**: after each sale, copy the next unused key from the list and send it to the customer. Mark it as used.
- **Stronger protection**: ask the customer for the **device code** shown in the app under Settings → Licence, type it into the generator, and send the key it creates. That key works on that computer only.

Honest limits of universal keys: because they are checked without any server, a key that is *not* device-locked will work on any number of computers if a customer shares it, and a key cannot be cancelled after a refund. Use device-locked keys when that matters.

To create your own signing key and generator from the source code: `npm run keygen:setup` (then rebuild the app).

---

# Gumroad keys

## 1. Create the product and switch on licence keys

1. In Gumroad, create a **Digital product**.
2. On the product's **Content** page, add the **License key** module. Gumroad then issues a unique key to every buyer.
3. Expand the licence key module and copy the **Product ID** shown there.

The product ID is a public identifier, not a secret. The app never needs your Gumroad password or an API access token.

## 2. Put your product ID into the app

Edit `src/main/license.config.json`:

```json
{
  "productId": "PASTE-YOUR-PRODUCT-ID",
  "purchaseUrl": "https://YOURNAME.gumroad.com/l/YOURPRODUCT",
  "supportEmail": "support@your-domain.com",
  "trialDays": 14,
  "graceDays": 30,
  "recheckDays": 7,
  "maxActivations": 0
}
```

| Setting | Meaning |
|---|---|
| `productId` | Your Gumroad product ID. **Empty = licensing switched off (unlocked build).** |
| `productPermalink` | Only for products created before 9 January 2023, instead of `productId` |
| `purchaseUrl` | Opened by the "Buy" link in the app |
| `trialDays` | Full-feature days without a key |
| `graceDays` | Days the app runs without a successful online check |
| `recheckDays` | How often it re-checks when online |
| `maxActivations` | Maximum activations per key; `0` = unlimited |

> **The installer in this delivery was built with an empty `productId`**, because your product ID is not known yet. It runs fully unlocked. Rebuild after step 2 before selling.

## 3. Rebuild

On a Windows PC with [Node.js 22+](https://nodejs.org):

```
npm install
npm test
npm run dist:win
npm run docs
npm run package:gumroad
```

The customer ZIP appears in `delivery/`. Alternatively push to GitHub and run the **Build Windows release** workflow (`.github/workflows/`), then download the artifact.

## 4. Test before you sell

1. Install the build on a clean Windows 10 or 11 PC.
2. In Gumroad, use **Test purchase** on your product to get a real key.
3. Activate it in **Settings → Licence**. Status should read **Licensed**.
4. Disconnect the internet and confirm the app still works.
5. Refund the test purchase, then click **Verify now**: the app should report the refund.

## 5. Upload

1. Upload `MobileShopManagerPro-v<version>-Gumroad.zip` as the product file. Buyers download it immediately — nobody needs to contact you to receive the software.
2. Paste the text from `PRODUCT-LISTING.md`.
3. Upload images from `screenshots/`.
4. Fill in `[brackets]` in the Support Information document and the EULA (`LICENSE.txt`), then rebuild the docs.

## 6. How licensing behaves — what to tell customers

- Gumroad **issues** keys; it does not enforce them. The app enforces them itself by calling Gumroad's licence verification endpoint.
- The call is made only from the app's main process. No secret is stored in the app.
- **Invalid key** → rejected. **Refunded / charged back / disputed** → rejected and, if already active, revoked at the next check. **Disabled by you** (Gumroad → Sales → the sale → disable licence) → revoked at the next check.
- **Offline**: after one activation the app works without internet, re-checks weekly when online, and tolerates `graceDays` without contact.
- **Data is never held hostage**: in restricted mode customers can still open, search, print, export and back up everything. Only adding new records is paused.
- Licence state is stored in `license.db`, separate from the shop database, so restoring a backup never moves a licence.

Honest limits: a determined person can bypass any offline licence check, and `maxActivations` counts activations rather than distinct machines (Gumroad cannot decrease the count without your access token). This scheme is designed to keep honest customers honest without ever punishing them for a bad internet connection.

## 7. Recommended before a wide launch

- **Code signing.** The executables are unsigned, so Windows SmartScreen warns on first run. A code-signing certificate removes that warning; set `CSC_LINK` and `CSC_KEY_PASSWORD` and electron-builder signs automatically.
- **Test on real Windows.** See `README.md` for exactly what was and was not verified in the development environment.
- **Legal review** of the EULA and refund policy for the countries you sell to.
- **Translations.** `src/renderer/locales/en.json` lists every interface string. Copy it to complete another language.
