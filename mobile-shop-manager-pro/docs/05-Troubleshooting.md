# Troubleshooting Guide

## Installation and starting

**“Windows protected your PC” (SmartScreen)**
Click **More info → Run anyway**. Windows shows this for new software from smaller publishers.

**Antivirus blocks or deletes the file**
Restore the file from quarantine and add it as an exception, or download the ZIP again. The software contains no network components other than the licence check.

**The portable version is slow to open the first time**
It unpacks itself on first start. Later starts are faster. Run it from a local disk rather than a slow USB stick when possible.

**“The application could not start”**
1. Restart the computer and try again.
2. Make sure the data folder is not on a full or read-only disk.
3. Send the log file to support. Installed edition: `C:\Users\<you>\AppData\Roaming\Mobile Shop Manager Pro\logs\main.log`. Portable edition: `MobileShopManagerPro-Data\app\logs\main.log`. The log contains no customer or sales data.

**“This database was created by a newer version of the application”**
You opened newer data with an older program. Install the latest version.

## Sales and stock

**A phone does not appear on the New Sale screen**
Only phones with status **In Stock** can be sold. Check its status in **Mobile Inventory**.

**“IMEI … already exists”**
That IMEI is already in Mobile Inventory or in available Used Stock. Search for it with **Ctrl + K**.

**“Select a customer to sell on credit”**
A walk-in sale must be paid in full. Choose or add a customer to leave a balance.

**I made a mistake on a completed sale**
Sales are never deleted. Open **Sales History**, click the void icon, and give a reason. Stock returns, the customer's balance is reversed and the invoice stays in history marked **VOID**. Then enter the sale again correctly.

**A sold phone cannot be deleted or its IMEI changed**
This protects your financial history. Void the sale first if the sale itself was a mistake.

**Profit looks too low or too high**
Profit = selling price − purchase price − discount (and excludes tax). Check the purchase price of the items. Credit payments do not add profit; profit is counted once, on the day of the sale.

## Printing and invoices

**Nothing happens when I click Print**
Check that a printer is installed in Windows. Use **Save as PDF** as an alternative.

**Thermal receipts are cut off or too small**
Choose the **Thermal receipt** layout on the invoice, and in the Windows print dialog select your receipt printer and an 80 mm paper size with margins set to none.

**WhatsApp does not open**
WhatsApp Desktop or a browser must be available. The customer's phone needs a country code — edit the customer and choose it.

## Backup and restore

**“This file is not a Mobile Shop Manager Pro backup”**
Choose a `.msmbackup` file created by the app.

**“The backup file is damaged”**
The file is incomplete or corrupted (for example, a failed USB copy). Use another backup.

**I restored the wrong backup**
Every restore first creates a **Safety** backup of what you had. Find it in **Backup history** and restore it.

**Automatic backups are not appearing**
Check **Backup & Restore → Automatic backup** is not Off, and that the backup folder still exists (for example, the USB drive is connected).

## Licence

See the **Licence Activation** guide for every licence message and its fix.

## Password

**I forgot the app password**
There is no recovery, by design: the password is stored only on your computer in hashed form. Contact support with your purchase details for guidance; restoring a backup made *before* the password was set also removes it.

## Still stuck?

Contact support (see the Support Information page) and include: the app version (**Settings → About**), your Windows version, what you clicked, and the exact message shown.
