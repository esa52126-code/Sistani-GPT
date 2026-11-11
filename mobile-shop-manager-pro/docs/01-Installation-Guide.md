# Installation Guide

**Mobile Shop Manager Pro {{version}}**

## System requirements

| | Minimum | Recommended |
|---|---|---|
| Operating system | Windows 10 (64-bit) | Windows 11 (64-bit) |
| Processor | Any 64-bit dual-core CPU | Intel Core i3 / AMD Ryzen 3 or better |
| Memory | 4 GB RAM | 8 GB RAM |
| Disk space | 500 MB free | 1 GB free plus space for backups |
| Display | 1280 × 720 | 1920 × 1080 |
| Internet | Only once, to activate the licence | — |
| Printer (optional) | Any Windows printer: A4/Letter or 80 mm thermal receipt printer | |

## Which file should I use?

Your download contains two editions. They are the same software.

- **Installer** — `1-Windows-Installer/MobileShopManagerPro-Setup-{{version}}.exe`
  Best for the shop's main computer. Adds Start menu and desktop shortcuts and an uninstaller.
- **Portable** — `2-Portable-Version/MobileShopManagerPro-Portable-{{version}}.exe`
  No installation. Runs from any folder or a USB drive and keeps its data in a folder named `MobileShopManagerPro-Data` beside the program.

## Installing (recommended)

1. Unzip the download. Do not run the installer from inside the ZIP.
2. Double-click **MobileShopManagerPro-Setup-{{version}}.exe**.
3. If Windows shows **“Windows protected your PC”**, click **More info**, then **Run anyway**. This appears for software from smaller publishers and is expected.
4. Accept the licence agreement, choose the folder (the default is fine) and click **Install**.
5. Click **Finish**. The application opens.

No administrator rights are needed; the app installs for the current Windows user.

## Using the portable version

1. Copy the portable `.exe` into a folder you can write to, for example `D:\MobileShop\`.
2. Double-click it. The first start takes a little longer because the program unpacks itself.
3. Your data is stored in `MobileShopManagerPro-Data` next to the `.exe`. Copy both together to move to another computer.

## First start

1. The app opens with **sample data** so you can explore. Remove it any time in **Settings → Demo data → Remove demo data**.
2. Go to **Settings → Shop profile** and enter your shop name, address, phone and logo.
3. Go to **Settings → Regional** and choose your country, currency, date format and time zone.
4. If you charge tax, set it up in **Settings → Tax**.
5. Activate your licence in **Settings → Licence** (see the Licence Activation guide).

## Where is my data?

| Edition | Location |
|---|---|
| Installed | `C:\Users\<you>\AppData\Roaming\Mobile Shop Manager Pro\data\` |
| Portable | `MobileShopManagerPro-Data\` beside the program |

Backups are saved to `Documents\Mobile Shop Manager Pro Backups` unless you choose another folder in **Backup & Restore**.

## Updating to a newer version

Run the new installer over the old one. Your data is kept. Make a backup first (**Backup & Restore → Back up now**).

## Uninstalling

Windows **Settings → Apps → Installed apps → Mobile Shop Manager Pro → Uninstall**. Your data folder is deliberately **not** deleted, so nothing is lost by accident. Delete the data folder by hand if you really want to remove everything.

## macOS and Linux

The delivered package is built for Windows. The source project can also be built for macOS and Linux (`npm run dist:mac`, `npm run dist:linux`) on those systems.
