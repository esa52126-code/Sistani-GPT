# Seller Guide — getting Mobile Shop Manager Pro onto Gumroad

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
