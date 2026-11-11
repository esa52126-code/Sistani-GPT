'use strict';
const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const { Database } = require('../src/main/db');
const S = { settings: require('../src/main/services/settings'), mobiles: require('../src/main/services/mobiles'), accessories: require('../src/main/services/accessories'),
  customers: require('../src/main/services/customers'), suppliers: require('../src/main/services/suppliers'), sales: require('../src/main/services/sales'),
  exchanges: require('../src/main/services/exchanges'), expenses: require('../src/main/services/expenses'), reports: require('../src/main/services/reports'),
  backup: require('../src/main/services/backup'), search: require('../src/main/services/search'), csv: require('../src/main/services/csv'), demo: require('../src/main/services/demo') };
const Fmt = require('../src/shared/format');

module.exports = async function (t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'msm-test-'));
  const db = new Database(path.join(dir, 'shop.db'));
  const today = '2026-03-10';
  const dash = () => S.reports.dashboard(db, { from: today, to: today, today, chartFrom: '2025-04-01' });

  // 1-4: add a Samsung with unique IMEI, cost 500, price 550
  const sup = S.suppliers.create(db, { name: 'Test Supplier' });
  const mid = S.mobiles.create(db, { brand: 'Samsung', model: 'Galaxy A55', imei1: '356789104523871', purchase_price: 500, selling_price: 550, supplier_id: sup, supplier_paid: 'unpaid' }, today);
  let m = S.mobiles.get(db, mid);
  t.eq(m.stock_id, 'MS-0001', 'first stock id'); t.eq(m.status, 'in_stock', 'new mobile in stock');
  t.eq(S.suppliers.get(db, sup).payable, 500, 'supplier payable after unpaid purchase');
  // 5: customer Ahmed
  const ahmed = S.customers.create(db, { name: 'Ahmed', phone_code: '+971', phone: '555 0101' });
  // 6-7: sell to Ahmed, pay 300
  const sale = S.sales.create(db, { customer_id: ahmed, items: [{ type: 'mobile', id: mid, unit_price: 550 }], discount: 0, paid: 300, payment_method: 'cash' }, today);
  t.eq(sale.remaining, 250, '8. remaining is 250');
  t.eq(S.mobiles.get(db, mid).status, 'sold', '9. phone is SOLD');
  t.eq(sale.profit, 50, '10. profit is 50');
  t.eq(S.customers.balance(db, ahmed), 250, '11. customer balance is 250');
  const inv = S.sales.get(db, sale.id);
  t.eq(inv.invoice_no, 'INV-000001', '12. invoice number generated'); t.eq(inv.items[0].imei, '356789104523871', 'invoice carries IMEI'); t.eq(inv.payments.length, 1, 'invoice has payment');
  // 13-14: payment of 100
  const pay = S.customers.recordPayment(db, { customer_id: ahmed, amount: 100, method: 'bank_transfer' }, today);
  t.eq(pay.balance, 150, '14. balance is 150'); t.eq(S.sales.get(db, sale.id).remaining, 150, 'invoice remaining 150');
  t.eq(S.customers.get(db, ahmed).total_paid, 400, 'total paid 400');
  // 15: dashboard — credit payments must not create profit
  let d = dash();
  t.eq(d.current.sales, 550, 'dashboard sales'); t.eq(d.current.profit, 50, 'dashboard profit unchanged by credit payment');
  t.eq(d.current.cash_received, 400, 'cash received'); t.eq(d.credit_total, 150, 'outstanding credit'); t.eq(d.stock.mobiles.n, 0, 'mobile stock count');
  t.throws(() => S.customers.recordPayment(db, { customer_id: ahmed, amount: 151 }, today), /more than the outstanding/, 'cannot overpay credit');
  // never sell unavailable stock
  t.throws(() => S.sales.create(db, { customer_id: ahmed, items: [{ type: 'mobile', id: mid, unit_price: 550 }], paid: 550 }, today), /not in stock/, 'cannot sell a sold phone');
  // walk-in credit not allowed
  const mid2 = S.mobiles.create(db, { brand: 'Apple', model: 'iPhone 15', imei1: '356789104523889', imei2: '356789104523897', purchase_price: 700, selling_price: 800 }, today);
  t.throws(() => S.sales.create(db, { items: [{ type: 'mobile', id: mid2, unit_price: 800 }], paid: 100 }, today), /Select a customer/, 'walk-in must pay in full');
  t.eq(S.mobiles.get(db, mid2).status, 'in_stock', 'failed sale rolled back');
  t.eq(S.settings.get(db).invoice_next, 2, 'failed sale did not consume an invoice number');

  // 19: duplicate IMEI prevention (both slots, both inventories)
  t.throws(() => S.mobiles.create(db, { brand: 'X', model: 'Y', imei1: '356789104523871', purchase_price: 1, selling_price: 2 }, today), /already exists/, 'duplicate imei1');
  t.throws(() => S.mobiles.create(db, { brand: 'X', model: 'Y', imei1: '111111111111111', imei2: '356789104523897', purchase_price: 1, selling_price: 2 }, today), /already exists/, 'duplicate via imei2');
  t.throws(() => S.mobiles.create(db, { brand: 'X', model: 'Y', imei1: '356789104523897', purchase_price: 1, selling_price: 2 }, today), /already exists/, 'imei1 equal to another imei2');
  t.throws(() => S.mobiles.create(db, { brand: 'X', model: 'Y', imei1: '222222222222222', imei2: '222222222222222', purchase_price: 1, selling_price: 2 }, today), /cannot be the same/, 'same imei twice');
  t.throws(() => S.exchanges.create(db, { brand: 'Apple', model: 'iPhone 15', imei: '356789104523889', acquisition_value: 100 }, today), /already exists/, 'used stock clashes with in-stock mobile');

  // 20: stock adjustments
  const acc = S.accessories.create(db, { name: 'Charger', category: 'chargers', purchase_price: 5, selling_price: 12, quantity: 10, min_stock: 3 }, today);
  t.eq(S.accessories.get(db, acc).sku, 'ACC-0001', 'auto SKU');
  t.eq(S.accessories.adjust(db, { id: acc, quantity: -2, reason: 'Damaged' }, today), 8, 'adjust down');
  t.eq(S.accessories.adjust(db, { id: acc, mode: 'set', quantity: 9, reason: 'Stock count' }, today), 9, 'set counted quantity');
  t.throws(() => S.accessories.adjust(db, { id: acc, quantity: -50, reason: 'x' }, today), /below zero/, 'no negative stock');
  t.eq(S.accessories.purchase(db, { id: acc, quantity: 11, unit_cost: 7, supplier_id: sup, paid: 0 }, today), 20, 'purchase raises quantity');
  t.eq(S.accessories.get(db, acc).purchase_price, 6.1, 'weighted average cost (9×5 + 11×7)/20');
  t.eq(S.suppliers.get(db, sup).payable, 577, 'supplier payable includes accessory purchase');
  S.suppliers.recordPayment(db, { supplier_id: sup, amount: 77 }, today);
  t.eq(S.suppliers.get(db, sup).payable, 500, 'supplier payment reduces payable');
  t.throws(() => S.sales.create(db, { items: [{ type: 'accessory', id: acc, quantity: 21, unit_price: 12 }], paid: 999 }, today), /Only 20/, 'cannot oversell accessory');

  // 21: exchange sale — trade-in is payment; used phone earns profit only on resale
  const ex = S.sales.create(db, { customer_id: ahmed, items: [{ type: 'mobile', id: mid2, unit_price: 800 }, { type: 'accessory', id: acc, quantity: 2, unit_price: 12 }], discount: 24,
    paid: 1000, payment_method: 'card', trade_in: { brand: 'Samsung', model: 'Galaxy S21', imei: '490154203237518', condition: 'good', value: 200 } }, today);
  t.eq(ex.grand_total, 800, 'exchange sale total 824 - 24'); t.eq(ex.remaining, 0, 'paid by trade-in + card'); t.eq(ex.change, 400, 'change = 1000 - (800 - 200)');
  t.eq(ex.profit, 800 + 24 - 24 - 700 - 12.2, 'profit = revenue - discount - cost; trade-in does not change it');
  const exSale = S.sales.get(db, ex.id);
  t.eq(exSale.items.reduce((a, i) => a + i.discount_alloc, 0), 24, 'discount fully allocated to lines');
  t.eq(exSale.items[0].profit, 800 - 23.3 - 700, 'mobile profit = price - cost - allocated discount');
  t.eq(S.accessories.get(db, acc).quantity, 18, 'accessory quantity reduced');
  const used = S.exchanges.list(db, { status: 'available' });
  t.eq(used.length, 1, 'trade-in added to used stock'); t.eq(used[0].acquisition_value, 200, 'acquisition = trade-in value'); t.eq(used[0].stock_id, 'UX-0001', 'used stock id');
  t.eq(S.customers.balance(db, ahmed), 150, 'balance unaffected by fully paid exchange sale');
  const resale = S.sales.create(db, { items: [{ type: 'used', id: used[0].id, unit_price: 260 }], paid: 260 }, today);
  t.eq(resale.profit, 60, 'used phone profit = resale - acquisition cost');
  t.eq(S.exchanges.get(db, used[0].id).status, 'sold', 'used phone sold');
  t.throws(() => S.sales.voidSale(db, { id: ex.id, reason: 'test' }, today), /already been resold/, 'cannot void when trade-in resold');

  // 22: expenses and net profit
  S.expenses.create(db, { category: 'rent', amount: 40, expense_date: today }, today);
  d = dash();
  const gross = 50 + ex.profit + 60;
  t.eq(d.current.profit, gross, 'gross profit sums all sales once'); t.eq(d.current.expenses, 40, 'expenses'); t.eq(d.current.net_profit, gross - 40, 'net = gross - expenses');
  t.eq(d.current.transactions, 3, 'transaction count');
  const pl = S.reports.run(db, { name: 'profit', from: today, to: today });
  t.eq(pl.rows.find(r => r.line === 'Net profit').amount, gross - 40, 'P&L report agrees with dashboard');
  t.eq(S.reports.run(db, { name: 'sales_by_brand', from: today, to: today }).rows.find(r => r.brand === 'Samsung').units, 2, 'sales by brand');
  for (const r of S.reports.catalog()) t.ok(Array.isArray(S.reports.run(db, { name: r.name, from: today, to: today }).rows), 'report runs: ' + r.name);

  // 23: tax calculations
  S.settings.update(db, { tax_enabled: true, tax_rate: 20, tax_label: 'VAT', tax_mode: 'exclusive' });
  const a2 = S.accessories.create(db, { name: 'Case', category: 'cases', purchase_price: 40, selling_price: 100, quantity: 10 }, today);
  let tx = S.sales.create(db, { items: [{ type: 'accessory', id: a2, quantity: 1, unit_price: 100 }], paid: 1e6 }, today);
  t.eq(tx.grand_total, 120, 'exclusive tax adds 20%'); t.eq(tx.profit, 60, 'tax is not profit (exclusive)');
  S.settings.update(db, { tax_mode: 'inclusive' });
  tx = S.sales.create(db, { items: [{ type: 'accessory', id: a2, quantity: 1, unit_price: 120 }], paid: 1e6 }, today);
  t.eq(tx.grand_total, 120, 'inclusive total unchanged'); t.eq(S.sales.get(db, tx.id).tax_amount, 20, 'inclusive tax extracted'); t.eq(tx.profit, 60, 'tax is not profit (inclusive)');
  tx = S.sales.create(db, { items: [{ type: 'accessory', id: a2, quantity: 1, unit_price: 100 }], paid: 1e6, tax_exempt: true }, today);
  t.eq(tx.grand_total, 100, 'tax-exempt sale'); t.eq(S.sales.get(db, tx.id).tax_mode, 'exempt', 'exempt recorded');
  S.settings.update(db, { tax_enabled: false });

  // void: controlled reversal keeps the record
  const v = S.sales.create(db, { customer_id: ahmed, items: [{ type: 'accessory', id: a2, quantity: 3, unit_price: 100 }], paid: 100 }, today);
  t.eq(S.customers.balance(db, ahmed), 350, 'credit before void');
  S.sales.voidSale(db, { id: v.id, reason: 'Customer changed mind' }, today);
  t.eq(S.customers.balance(db, ahmed), 150, 'void reverses balance'); t.eq(S.accessories.get(db, a2).quantity, 7, 'void returns stock');
  t.eq(S.sales.get(db, v.id).status, 'voided', 'voided sale is kept, not deleted');
  t.throws(() => S.mobiles.remove(db, mid), /cannot be deleted/, 'sold phone cannot be deleted');
  t.throws(() => S.customers.remove(db, ahmed), /cannot be deleted/, 'customer with history cannot be deleted');
  // ledger integrity: ledger balance equals sum of unpaid completed invoices
  const due = db.get(`SELECT SUM(grand_total - paid_amount) AS d FROM sales WHERE customer_id = ? AND status = 'completed'`, [ahmed]).d;
  t.eq(S.customers.balance(db, ahmed), due, 'ledger balance equals unpaid invoices');
  const paidSum = db.get(`SELECT SUM(p.amount) AS s FROM sale_payments p JOIN sales s ON s.id = p.sale_id WHERE s.status='completed'`).s;
  t.eq(paidSum, db.get(`SELECT SUM(paid_amount) AS s FROM sales WHERE status='completed'`).s, 'payments table equals paid amounts');

  // 24-25: currencies and date formats
  t.eq(Fmt.formatMoney(1234.5, { currency_symbol: '$', currency_position: 'before', decimals: 2, number_format: 'comma_dot' }), '$1,234.50', 'USD');
  t.eq(Fmt.formatMoney(1234.5, { currency_symbol: '€', currency_position: 'after_space', decimals: 2, number_format: 'dot_comma' }), '1.234,50 €', 'EUR');
  t.eq(Fmt.formatMoney(1234567, { currency_symbol: 'Rs.', currency_position: 'before_space', decimals: 0, number_format: 'comma_dot' }), 'Rs. 1,234,567', 'PKR');
  t.eq(Fmt.formatMoney(1234567.5, { currency_symbol: '₹', currency_position: 'before', decimals: 2, number_format: 'indian' }), '₹12,34,567.50', 'INR lakh grouping');
  t.eq(Fmt.formatMoney(12.3456, { currency_symbol: 'KD', currency_position: 'after_space', decimals: 3 }), '12.346 KD', 'KWD 3 decimals');
  t.eq(Fmt.formatMoney(-5, { currency_symbol: '£', decimals: 2 }), '-£5.00', 'negative');
  t.eq(Fmt.formatDate('2026-03-10', { date_format: 'DD/MM/YYYY' }), '10/03/2026', 'UK date');
  t.eq(Fmt.formatDate('2026-03-10', { date_format: 'MM/DD/YYYY' }), '03/10/2026', 'US date');
  t.eq(Fmt.formatDate('2026-03-10', { date_format: 'DD.MM.YYYY' }), '10.03.2026', 'DE date');
  t.eq(Fmt.formatDate('2026-03-10', { date_format: 'MMM D, YYYY' }), 'Mar 10, 2026', 'long date');
  t.eq(Fmt.today('Asia/Karachi', new Date('2026-03-10T20:30:00Z')), '2026-03-11', 'business date follows shop time zone');
  t.eq(Fmt.today('America/Los_Angeles', new Date('2026-03-10T05:30:00Z')), '2026-03-09', 'business date west of UTC');
  t.eq(Fmt.formatTime('2026-03-10T13:05:00Z', { timezone: 'UTC', time_format: '24h' }), '13:05', '24h'); t.eq(Fmt.formatTime('2026-03-10T13:05:00Z', { timezone: 'UTC', time_format: '12h' }), '1:05 PM', '12h');
  t.eq(Fmt.range('week', { week_start: 'monday', timezone: 'UTC' }, new Date('2026-03-11T12:00:00Z')), { from: '2026-03-09', to: '2026-03-15' }, 'week starts Monday');
  t.eq(Fmt.range('week', { week_start: 'saturday', timezone: 'UTC' }, new Date('2026-03-11T12:00:00Z')), { from: '2026-03-07', to: '2026-03-13' }, 'week starts Saturday');
  S.settings.update(db, { currency_code: 'JPY', currency_symbol: '¥', decimals: 0 });
  const jp = S.sales.create(db, { items: [{ type: 'accessory', id: a2, quantity: 1, unit_price: 1500.4 }], discount: 0, paid: 5000 }, today);
  t.eq(jp.grand_total, 1500, 'zero-decimal currency rounds totals'); t.eq(S.sales.get(db, jp.id).currency_code, 'JPY', 'sale records its currency');
  S.settings.update(db, { currency_code: 'USD', currency_symbol: '$', decimals: 2 });

  // search + csv
  t.ok(S.search.search(db, '4523871').some(r => r.group === 'Mobiles'), 'search by partial IMEI');
  t.ok(S.search.search(db, 'INV-000001').some(r => r.group === 'Invoices'), 'search by invoice'); t.ok(S.search.search(db, 'ahmed').some(r => r.group === 'Customers'), 'search by customer');
  const imp = S.csv.importCsv(db, 'mobiles', 'brand,model,imei1,purchase_price,selling_price\nNokia,G42,351111111111111,100,130\nNokia,G42,351111111111111,100,130\n,Bad,,1,1\n', today);
  t.eq(imp.imported, 1, 'csv import keeps good rows'); t.eq(imp.skipped, 2, 'csv import reports duplicate + invalid rows');
  t.ok(S.csv.parse(S.csv.toCsv([{ a: 'x,"y"', b: '=1+1' }]))[0].a === 'x,"y"', 'csv round trip with quotes');
  t.ok(S.csv.toCsv([{ a: '=HYPERLINK("x")' }]).includes("'=HYPERLINK"), 'csv formula injection neutralised');

  // 16-18: backup, change data, restore, verify everything intact
  const snap = () => JSON.stringify(['mobiles', 'accessories', 'customers', 'suppliers', 'sales', 'sale_items', 'sale_payments', 'expenses', 'exchanges', 'customer_ledger', 'supplier_ledger', 'stock_movements', 'settings']
    .map(tb => db.all(`SELECT * FROM ${tb} ORDER BY 1`)));
  const before = snap();
  const b = S.backup.create(db, path.join(dir, 'backups'), 'manual');
  t.ok(fs.existsSync(b.file) && b.size > 0, '16. backup file created');
  t.eq(S.backup.validate(b.file).counts.customers, 1, 'backup validates');
  S.customers.create(db, { name: 'Added After Backup' }); S.expenses.create(db, { category: 'other', amount: 999 }, today); S.customers.recordPayment(db, { customer_id: ahmed, amount: 50 }, today);
  t.ok(snap() !== before, 'data changed after backup');
  const r = S.backup.restore(db, b.file, path.join(dir, 'backups'));
  t.ok(fs.existsSync(r.safety_backup), '17. safety backup created before restore');
  t.eq(snap(), before, '18. all records intact after restore');
  t.eq(S.customers.balance(db, ahmed), 150, 'balance intact after restore');
  t.ok(S.backup.list(db).length >= 2, 'backup history survives restore');
  fs.writeFileSync(path.join(dir, 'bad.msmbackup'), 'not a database at all');
  t.throws(() => S.backup.restore(db, path.join(dir, 'bad.msmbackup'), dir), /not a Mobile Shop Manager Pro backup/, 'invalid backup rejected');
  t.eq(snap(), before, 'rejected restore leaves data untouched');
  t.eq(S.backup.exportAllCsv(db, dir).files, 12, 'csv export of all tables');

  // demo data: removal never deletes genuine records
  const db2 = new Database(':memory:');
  S.demo.load(db2, today);
  t.eq([db2.get('SELECT COUNT(*) n FROM mobiles').n, db2.get('SELECT COUNT(*) n FROM accessories').n, db2.get('SELECT COUNT(*) n FROM customers').n, db2.get('SELECT COUNT(*) n FROM sales').n, db2.get('SELECT COUNT(*) n FROM expenses').n], [5, 10, 3, 2, 2], 'demo data counts');
  t.eq(S.customers.creditBook(db2).customers.length, 1, 'one demo credit customer');
  const real = S.customers.create(db2, { name: 'Real Customer' });
  const demoAcc = db2.get(`SELECT id FROM accessories WHERE name LIKE 'Power Bank%'`).id;
  const demoPhone = db2.get(`SELECT id FROM mobiles WHERE status = 'in_stock' LIMIT 1`).id;
  const realSale = S.sales.create(db2, { customer_id: real, items: [{ type: 'accessory', id: demoAcc, quantity: 1, unit_price: 25 }, { type: 'mobile', id: demoPhone, unit_price: 400 }], paid: 100 }, today);
  S.demo.remove(db2);
  t.eq(db2.get('SELECT COUNT(*) n FROM sales').n, 1, 'genuine sale kept'); t.eq(S.sales.get(db2, realSale.id).items.length, 2, 'genuine sale items kept');
  t.eq(db2.get('SELECT COUNT(*) n FROM customers').n, 1, 'only genuine customer left'); t.eq(S.customers.balance(db2, real), 325, 'genuine balance intact');
  t.eq(db2.get('SELECT COUNT(*) n FROM mobiles').n, 1, 'demo phone used in a genuine sale is kept'); t.eq(db2.get('SELECT COUNT(*) n FROM accessories').n, 1, 'demo accessory used in a genuine sale is kept');
  t.eq(db2.get('SELECT COUNT(*) n FROM expenses').n, 0, 'demo expenses removed'); t.ok(!S.demo.hasDemo(db2), 'no demo rows remain');
  t.eq(db2.all('PRAGMA foreign_key_check').length, 0, 'no orphaned references after demo removal');

  // password + admin-controlled void
  S.settings.setPassword(db, { password: 'secret1' });
  t.ok(S.settings.verifyPassword(db, 'secret1') && !S.settings.verifyPassword(db, 'nope'), 'password verification');
  t.throws(() => S.sales.voidSale(db, { id: jp.id, reason: 'x', password: 'wrong' }, today), /password/, 'void needs admin password');
  t.ok(!('auth_hash' in S.settings.get(db)), 'password hash never leaves the main process');
  db.close(); db2.close();
  fs.rmSync(dir, { recursive: true, force: true });
};
