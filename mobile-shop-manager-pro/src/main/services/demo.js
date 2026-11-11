'use strict';
const U = require('./util');
const Settings = require('./settings');
const Suppliers = require('./suppliers');
const Mobiles = require('./mobiles');
const Accessories = require('./accessories');
const Customers = require('./customers');
const Expenses = require('./expenses');
const Sales = require('./sales');

/** Neutral, international sample data. Everything is flagged is_demo so it can be removed safely. */
function load(db, today) {
  if (Settings.get(db).demo_loaded) throw new U.AppError('Demo data has already been loaded.');
  return db.tx(() => {
    const day = n => U.Fmt.addDays(today, -n);
    const sup1 = Suppliers.create(db, { name: 'Northline Distribution', company: 'Northline Distribution Ltd.', phone: '+1 555 0100', email: 'orders@northline.example' }, 1);
    const sup2 = Suppliers.create(db, { name: 'Global Mobile Parts', company: 'Global Mobile Parts Co.', phone: '+44 20 5550 0188', email: 'sales@gmparts.example' }, 1);
    const mob = (o, n) => Mobiles.create(db, { ...o, purchase_date: day(n), supplier_id: sup1, warranty: '12 months' }, today, 1);
    const m1 = mob({ brand: 'Samsung', model: 'Galaxy S24', ram: '8GB', storage: '256GB', color: 'Onyx Black', imei1: '990000862471854', imei2: '990000862471862', purchase_price: 620, selling_price: 749 }, 20);
    const m2 = mob({ brand: 'Apple', model: 'iPhone 15', ram: '6GB', storage: '128GB', color: 'Blue', imei1: '990000112233445', purchase_price: 650, selling_price: 799 }, 18);
    mob({ brand: 'Google', model: 'Pixel 8a', ram: '8GB', storage: '128GB', color: 'Aloe', imei1: '990000554433221', purchase_price: 360, selling_price: 449 }, 15);
    mob({ brand: 'Xiaomi', model: 'Redmi Note 13 Pro', ram: '8GB', storage: '256GB', color: 'Midnight Black', imei1: '990000778899001', imei2: '990000778899019', purchase_price: 210, selling_price: 279 }, 12);
    mob({ brand: 'OnePlus', model: 'Nord 4', ram: '12GB', storage: '256GB', color: 'Mercurial Silver', imei1: '990000246813579', purchase_price: 330, selling_price: 399 }, 9);
    const acc = (name, category, pp, sp, quantity, min_stock) => Accessories.create(db, { name, category, purchase_price: pp, selling_price: sp, quantity, min_stock, supplier_id: sup2 }, today, 1);
    const a1 = acc('USB-C Fast Charger 25W', 'chargers', 6, 15, 24, 5);
    const a2 = acc('USB-C to USB-C Cable 1m', 'cables', 2, 8, 40, 10);
    acc('Lightning Cable 1m', 'cables', 3, 10, 30, 10);
    const a4 = acc('Clear Silicone Case (Universal)', 'cases', 2.5, 12, 35, 8);
    const a5 = acc('Tempered Glass Screen Protector', 'screen_protectors', 1, 9, 60, 15);
    acc('Wired Earphones 3.5mm', 'earphones', 3, 9, 18, 5);
    acc('Wireless Earbuds Pro', 'earbuds', 18, 39, 4, 5);
    acc('Power Bank 10,000 mAh', 'power_banks', 11, 25, 12, 4);
    acc('Smart Watch Fit S', 'smart_watches', 28, 59, 3, 3);
    acc('microSD Card 128GB', 'memory_cards', 7, 18, 22, 6);
    const c1 = Customers.create(db, { name: 'Alex Morgan', phone_code: '+1', phone: '555 0142', email: 'alex.morgan@example.com', country: 'US', address: '12 Market Street' }, 1);
    const c2 = Customers.create(db, { name: 'Sofia Rossi', phone_code: '+39', phone: '555 0177', email: 'sofia.rossi@example.com', country: 'IT' }, 1);
    Customers.create(db, { name: 'Omar Khalid', phone_code: '+971', phone: '555 0119', email: 'omar.khalid@example.com', country: 'AE' }, 1);
    // Sale 1: paid in full. Sale 2: on credit (the one credit customer).
    Sales.create(db, { customer_id: c1, sale_date: day(3), items: [{ type: 'mobile', id: m1, unit_price: 749 }, { type: 'accessory', id: a1, quantity: 1, unit_price: 15 }, { type: 'accessory', id: a5, quantity: 1, unit_price: 9 }],
      discount: 10, paid: 1e9, payment_method: 'card', tax_exempt: true }, today, 1);
    Sales.create(db, { customer_id: c2, sale_date: day(1), items: [{ type: 'mobile', id: m2, unit_price: 799 }, { type: 'accessory', id: a4, quantity: 1, unit_price: 12 }, { type: 'accessory', id: a2, quantity: 1, unit_price: 8 }],
      discount: 0, paid: 500, payment_method: 'cash', tax_exempt: true }, today, 1);
    Expenses.create(db, { category: 'rent', amount: 450, expense_date: day(10), description: 'Shop rent', payment_method: 'bank_transfer' }, today, 1);
    Expenses.create(db, { category: 'electricity', amount: 65, expense_date: day(4), description: 'Electricity bill', payment_method: 'cash' }, today, 1);
    Settings.setRaw(db, 'demo_loaded', true);
    return true;
  });
}

/**
 * Removes only records flagged as demo. Anything a genuine record depends on is kept
 * (and un-flagged) so real customers and transactions are never touched.
 */
function remove(db) {
  return db.tx(() => {
    const kept = [];
    const demoSales = db.all('SELECT id FROM sales WHERE is_demo = 1').map(r => r.id);
    for (const id of demoSales) {
      // A trade-in from a demo sale that was genuinely resold pins the sale.
      const pinned = db.get(`SELECT COUNT(*) AS n FROM exchanges x JOIN sale_items i ON i.exchange_id = x.id JOIN sales s ON s.id = i.sale_id WHERE x.source_sale_id = ? AND s.is_demo = 0`, [id]).n;
      const genuinePay = db.get(`SELECT COUNT(*) AS n FROM sale_payments WHERE sale_id = ? AND receipt_no <> ''`, [id]).n;
      if (pinned || genuinePay) { db.run('UPDATE sales SET is_demo = 0 WHERE id = ?', [id]); kept.push('sale'); continue; }
      for (const i of db.all(`SELECT accessory_id, quantity FROM sale_items WHERE sale_id = ? AND accessory_id IS NOT NULL`, [id]))
        db.run('UPDATE accessories SET quantity = quantity + ? WHERE id = ?', [i.quantity, i.accessory_id]);
      db.run(`DELETE FROM stock_movements WHERE ref_type = 'sale' AND ref_id = ?`, [id]);
      db.run('DELETE FROM exchanges WHERE source_sale_id = ? AND is_demo = 1', [id]);
      db.run('DELETE FROM customer_ledger WHERE sale_id = ?', [id]);
      db.run('DELETE FROM sale_payments WHERE sale_id = ?', [id]);
      db.run('DELETE FROM sale_items WHERE sale_id = ?', [id]);
      db.run('DELETE FROM sales WHERE id = ?', [id]);
    }
    db.run('DELETE FROM expenses WHERE is_demo = 1');
    db.run(`UPDATE mobiles SET is_demo = 0 WHERE is_demo = 1 AND id IN (SELECT mobile_id FROM sale_items WHERE mobile_id IS NOT NULL)`);
    db.run(`DELETE FROM stock_movements WHERE item_type = 'mobile' AND item_id IN (SELECT id FROM mobiles WHERE is_demo = 1)`);
    db.run(`DELETE FROM supplier_ledger WHERE ref_type = 'mobile' AND ref_id IN (SELECT id FROM mobiles WHERE is_demo = 1)`);
    db.run('DELETE FROM mobiles WHERE is_demo = 1');
    db.run(`UPDATE accessories SET is_demo = 0 WHERE is_demo = 1 AND id IN (SELECT accessory_id FROM sale_items WHERE accessory_id IS NOT NULL)`);
    db.run(`DELETE FROM stock_movements WHERE item_type = 'accessory' AND item_id IN (SELECT id FROM accessories WHERE is_demo = 1)`);
    db.run(`DELETE FROM supplier_ledger WHERE ref_type = 'accessory_purchase' AND ref_id IN (SELECT id FROM accessories WHERE is_demo = 1)`);
    db.run('DELETE FROM accessories WHERE is_demo = 1');
    db.run(`UPDATE exchanges SET is_demo = 0 WHERE is_demo = 1 AND id IN (SELECT exchange_id FROM sale_items WHERE exchange_id IS NOT NULL)`);
    db.run(`DELETE FROM stock_movements WHERE item_type = 'used' AND item_id IN (SELECT id FROM exchanges WHERE is_demo = 1)`);
    db.run('DELETE FROM exchanges WHERE is_demo = 1');
    db.run(`UPDATE customers SET is_demo = 0 WHERE is_demo = 1 AND (id IN (SELECT customer_id FROM sales WHERE customer_id IS NOT NULL) OR id IN (SELECT customer_id FROM customer_ledger) OR id IN (SELECT customer_id FROM exchanges WHERE customer_id IS NOT NULL))`);
    db.run('DELETE FROM customers WHERE is_demo = 1');
    db.run('DELETE FROM supplier_ledger WHERE is_demo = 1');
    db.run(`UPDATE suppliers SET is_demo = 0 WHERE is_demo = 1 AND (id IN (SELECT supplier_id FROM supplier_ledger) OR id IN (SELECT supplier_id FROM mobiles WHERE supplier_id IS NOT NULL) OR id IN (SELECT supplier_id FROM accessories WHERE supplier_id IS NOT NULL))`);
    db.run('DELETE FROM suppliers WHERE is_demo = 1');
    return { removed: true, kept: kept.length };
  });
}
function hasDemo(db) {
  return ['mobiles', 'accessories', 'customers', 'sales', 'expenses', 'suppliers', 'exchanges'].some(t => db.get(`SELECT COUNT(*) AS n FROM ${t} WHERE is_demo = 1`).n > 0);
}
module.exports = { load, remove, hasDemo };
