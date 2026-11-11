# User Manual

**Mobile Shop Manager Pro {{version}}** — offline inventory, sales, credit and reporting for mobile phone shops.

## 1. The main window

**Sidebar (left)** — the thirteen sections of the app: Dashboard, Mobile Inventory, Accessories, New Sale, Sales History, Customers, Credit Book, Exchange / Used Stock, Expenses, Suppliers, Reports, Backup & Restore, Settings.

**Top bar**

- **Search** (Ctrl + K) — finds customers, phone numbers, emails, models, IMEIs, invoice numbers, Stock IDs, accessories and suppliers. Use the arrow keys and Enter to open a result.
- **Currency indicator** — the currency you are working in.
- **Date and time** — in your shop's time zone and format.
- **Bell** — notifications: low stock, overdue backups, licence notices.
- **Shop profile** — opens Settings.

Every table has its own search box, filters, sortable columns (click a heading), pagination and **Export CSV**.

## 2. Dashboard

Choose a period at the top right: **Today, Yesterday, This week, This month, This year** or a **Custom** range.

| Card | Meaning |
|---|---|
| Sales | Total value of completed sales in the period |
| Profit | Gross profit on those sales (see section 14) |
| Expenses | Business expenses dated in the period |
| Net profit | Profit minus expenses |
| Mobile stock | Phones in stock and their cost value |
| Accessory stock | Units in stock and their cost value |
| Transactions | Number of sales, and cash actually received in the period |
| Outstanding credit | Everything customers currently owe you |

Below are monthly sales and profit charts for the last twelve months, recent transactions (click one to open its invoice), sales by product type, payments by method, and low-stock products. The dashboard refreshes whenever you open it or change the period.

## 3. Mobile Inventory

**Add mobile** — Brand, Model, RAM, Storage, Color, IMEI 1, IMEI 2, Purchase price, Selling price, Supplier, Purchase date, Warranty, Notes. A Stock ID (`MS-0001`, `MS-0002`, …) is assigned automatically.

**IMEI rules** — IMEI 1 is required. No IMEI may repeat anywhere in Mobile Inventory or in available Used Stock. The app checks both IMEI slots.

**Supplier payment** — when a supplier is selected, choose *Paid in full* or *Not paid yet*. Unpaid purchases appear as payable under **Suppliers**.

**Statuses**

| Status | Meaning |
|---|---|
| In Stock | Available to sell |
| Sold | Sold on an invoice (set automatically) |
| Exchange | Given out in a swap or otherwise set aside |
| Returned | Returned to the supplier |

**Actions** — view details, edit, delete (with confirmation), search by model or IMEI, filter by brand and status, export CSV. A phone that appears on a sale cannot be deleted, and its IMEI and cost are locked.

## 4. Accessories

Categories: Chargers, Cables, Phone cases, Screen protectors, Earphones, Earbuds, Power banks, Smart watches, Memory cards, Other.

Fields: Product name, Category, SKU (generated if left empty), Purchase price, Selling price, Quantity, Minimum stock level, Supplier, Notes.

- **Purchase** — record new stock arriving. Quantity goes up and the purchase price becomes the weighted average of old and new stock. If a supplier is chosen, the purchase (and any unpaid part) is posted to the supplier's account.
- **Adjust stock** — add, remove, or set the counted quantity, always with a reason. Stock can never go below zero.
- **Stock history** — every movement: opening stock, purchases, sales, adjustments, voided sales.
- **Low stock** — an item is low when quantity ≤ its minimum level. It is highlighted, counted on the sidebar and listed on the dashboard and in notifications.
- **Sales** — accessories are sold from **New Sale**, alone or together with a phone.

Deleting an accessory that has been sold archives it instead, so old invoices remain intact.

## 5. New Sale

1. **Pick items** from the *Mobiles*, *Accessories* or *Used phones* tab. Type in the search box to filter by model, IMEI, Stock ID or product name. The IMEI is carried onto the invoice automatically.
2. **Customer** — choose one, add a new one with **+**, or leave *Walk-in customer*.
3. **Prices and quantities** can be changed on each line.
4. **Discount** — an amount off the whole sale.
5. **Tax** — applied from your tax settings; tick **Tax-exempt sale** when it does not apply.
6. **Trade-in** — see section 9.
7. **Amount received** and **Payment method** (Cash, Bank transfer, Card, Mobile wallet, Other).
8. **Complete sale**.

**Calculations**

- Subtotal = mobile price + accessories
- Grand total = Subtotal − Discount (+ tax when prices exclude tax)
- Remaining = Grand total − Paid

If the customer pays more than the total, the change to return is shown. If they pay less, the remainder becomes customer credit — this requires a named customer.

**On completion** the phone becomes *Sold*, accessory quantities drop, the transaction and its profit are recorded, the customer's balance is updated, and the invoice opens. If anything is unavailable the whole sale is rejected and nothing is changed.

## 6. Sales History

All sales for the chosen period with totals for sales, gross profit, paid and remaining. Click a sale to open its invoice. From here you can also **record a payment** against an invoice or **void** it.

**Voiding a sale** is the controlled way to reverse a mistake. You must enter a reason (and the administrator password if one is set). Items return to stock, the customer's balance is reversed, and the invoice remains in history marked *Voided*. Sales are never permanently deleted.

## 7. Customers

Fields: Name, Phone with international country code, Email, Address, Country, Notes.

Open a customer to see total purchases, total payments, outstanding balance and full transaction history. From there you can print a **statement**, send a **WhatsApp** message, record a payment, or start a new sale. Customers with transactions cannot be deleted.

## 8. Credit Book

A list of everyone who owes you money, with the total outstanding at the top.

- **Record payment** — enter the amount and method. The payment is applied to the oldest unpaid invoices first and a numbered receipt (`RCT-000001`) is produced.
- **Payment history** — every payment the customer has made.
- **Print statement** — a dated statement with a running balance.
- **WhatsApp reminder** — opens WhatsApp with a polite balance message.
- Filter between outstanding and settled customers.

You cannot record more than the customer owes.

## 9. Exchange / Used Stock

Used phones arrive in two ways:

- **Trade-in during a sale** — on New Sale click **Add trade-in / exchange phone**, enter the phone and its trade-in value. That value counts as payment toward the sale, and the phone is added to used stock at that cost with a Stock ID such as `UX-0001`.
- **Bought directly** — click **Add used phone**.

Fields: Brand, Model, IMEI, Condition, Estimated value, Acquisition/exchange value, Notes, Date received, Status (Available, Sold, Returned).

Sell a used phone with **Sell** or from the *Used phones* tab on New Sale. **Profit = resale price − acquisition value**, shown in the *Resale profit* column.

## 10. Expenses

Categories: Rent, Electricity, Internet, Salaries, Transport, Repairs, Marketing, Other. Each expense has an amount, date, description and payment method. The cards show today's, this month's, this year's and total expenses.

## 11. Suppliers

Fields: Name, Phone, Email, Company, Address, Notes. For each supplier you see **total purchases, amount paid and amount payable**, plus the full purchase history. Use **Pay** to record a payment to the supplier.

Purchases are posted automatically when you add a phone or an accessory purchase with a supplier selected.

## 12. Reports

| Report | Shows |
|---|---|
| Sales report | Every sale in the period |
| Daily / Monthly / Yearly sales summary | Transactions, sales, tax, gross profit, expenses, net profit per period |
| Best-selling products | Units, sales and profit per product |
| Sales by brand | Phones sold, sales and profit per brand |
| Profit & loss summary | Gross profit by product type, expenses by category, net profit |
| Expenses report | Every expense in the period |
| Mobile inventory | Phones in stock |
| Accessories inventory | Quantities and stock value |
| Low-stock products | Items at or below their minimum |
| Customer credit | Outstanding balances |
| Supplier purchases | Purchases, payments and payable per supplier |

Choose **Daily, Weekly, Monthly, Yearly, All time** or a **Custom** range, then **Print**, **Save as PDF** or **Export CSV**.

## 13. Invoices and WhatsApp

Every invoice includes your logo, shop details, invoice number, date, customer, items with IMEI, subtotal, tax, discount, grand total, amount paid, remaining balance, payment method and your thank-you message.

- **A4 invoice** and **Thermal receipt (80 mm)** — switch at the bottom of the invoice window. Set your default in **Settings → Invoice**.
- **Print** — opens the Windows print dialog.
- **Save as PDF** — saves a PDF file.
- **WhatsApp** — opens WhatsApp with a ready-written message containing the customer name, products, IMEI, total, paid, remaining and your shop name. It uses the normal WhatsApp link; attach the saved PDF yourself if you want to send the document too.

## 14. How profit is calculated

| | Formula |
|---|---|
| Mobile profit | Selling price − Purchase price − Allocated discount |
| Accessory profit | (Selling price − Purchase price) × quantity − Allocated discount |
| Used phone profit | Resale price − Acquisition cost − Allocated discount |
| Gross profit | Sum of the above for completed sales |
| Net profit | Gross profit − Business expenses |

Rules that keep the numbers honest:

- A sale-wide discount is shared across the items in proportion to their value.
- Tax you collect is never counted as profit.
- Profit is counted **once, on the sale date**, for the full sale — even if the customer pays later.
- Payments against credit reduce the customer's balance only. They are **not** additional profit.
- A trade-in is a form of payment; it does not change the profit of the sale. The traded phone earns its own profit when resold.
- Voided sales are excluded everywhere.

## 15. Backup & Restore

- **Back up now** — writes one `.msmbackup` file to your backup folder.
- **Automatic backup** — Daily (default), Weekly or Off, keeping the number of copies you choose.
- **Backup folder** — change it to a USB drive or cloud-synced folder.
- **Restore** — choose a file. The app validates it, shows what it contains, asks you to confirm, makes a **safety backup** of your current data, and only then restores.
- **Export all data as CSV** — one CSV file per table, for spreadsheets or your accountant.
- **Import from CSV** — for mobiles, accessories, customers and suppliers. Download the template, fill it in, import. Invalid or duplicate rows are skipped and listed.

**Your data exists only on your computer. Back up regularly and keep a copy somewhere else.**

## 16. Settings

| Tab | What you set |
|---|---|
| Shop profile | Name, tagline, logo, address, phone, email, website |
| Regional | Country, language, currency (or a custom currency), symbol position, decimals, number format, date and time format, time zone, first day of week |
| Tax | On/off, tax name (VAT, GST, Sales Tax…), rate, inclusive or exclusive pricing, registration number |
| Invoice | Default layout, number prefix, accent colour, logo, thank-you message, terms |
| Alerts & backup | Low-stock notifications and default minimum level |
| Security | Optional password for opening the app, voiding sales and restoring backups |
| Licence | Activation and licence status |
| Demo data | Remove (or load) the sample data |
| About | Version, data folder, backup folder |

**Tax note.** Tax rules differ by country, region and product. The software calculates tax from the settings you enter. It does not give tax advice and cannot guarantee legal compliance — confirm your obligations with an accountant or your tax authority.

**Languages.** English is complete. Urdu, Arabic, Spanish, French, German and Hindi include starter translations of the main screens; untranslated text appears in English. Urdu and Arabic switch the whole interface to right-to-left.

## 17. Demo data

The first start loads 5 phones, 10 accessories, 3 customers, 2 sales (one on credit) and 2 expenses so the screens are not empty. **Settings → Demo data → Remove demo data** deletes only those sample records. Anything you created — and any sample item you used in a real sale — is kept.
