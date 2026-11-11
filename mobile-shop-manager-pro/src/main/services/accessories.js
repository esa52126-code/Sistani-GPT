'use strict';
const U = require('./util');
const C = require('../../shared/constants');
const Settings = require('./settings');
const Suppliers = require('./suppliers');

const SELECT = `SELECT a.*, s.name AS supplier_name, (a.quantity <= a.min_stock) AS low_stock FROM accessories a LEFT JOIN suppliers s ON s.id = a.supplier_id`;

function clean(d) {
  return { name: U.str(d.name, 'Product name', { required: true, max: 120 }), category: U.oneOf(d.category, C.ACCESSORY_CATEGORIES, 'Category', 'other'),
    sku: U.str(d.sku, 'SKU', { max: 40 }).toUpperCase(), purchase_price: U.num(d.purchase_price, 'Purchase price'), selling_price: U.num(d.selling_price, 'Selling price'),
    min_stock: U.int(d.min_stock, 'Minimum stock level', { max: 1e6 }), supplier_id: U.idOrNull(d.supplier_id), notes: U.str(d.notes, 'Notes', { max: 2000 }) };
}
function move(db, id, type, qty, balance, cost, note, date, ref_type = '', ref_id = null) {
  db.run(`INSERT INTO stock_movements(item_type,item_id,movement_type,quantity,balance_after,unit_cost,ref_type,ref_id,note,movement_date,created_at) VALUES('accessory',?,?,?,?,?,?,?,?,?,?)`,
    [id, type, qty, balance, cost, ref_type, ref_id, note, date, U.nowIso()]);
}
function list(db, f = {}) {
  const where = ['a.is_active = 1'], p = [];
  if (f.category) { where.push('a.category = ?'); p.push(f.category); }
  if (f.low) where.push('a.quantity <= a.min_stock');
  if (f.inStock) where.push('a.quantity > 0');
  if (f.q) { where.push(`(a.name LIKE ? ESCAPE '\\' OR a.sku LIKE ? ESCAPE '\\')`); const q = U.like(f.q); p.push(q, q); }
  return db.all(`${SELECT} WHERE ${where.join(' AND ')} ORDER BY a.name COLLATE NOCASE`, p);
}
function get(db, id) {
  const a = db.get(`${SELECT} WHERE a.id = ?`, [U.id(id)]);
  if (!a) throw new U.AppError('Accessory not found.', 'NOT_FOUND');
  a.movements = db.all(`SELECT * FROM stock_movements WHERE item_type='accessory' AND item_id=? ORDER BY id DESC LIMIT 200`, [a.id]);
  return a;
}
function create(db, d, today, demo = 0) {
  const c = clean(d);
  const qty = U.int(d.quantity, 'Quantity', { max: 1e7 });
  return db.tx(() => {
    if (!c.sku) c.sku = Settings.nextStockId(db, 'accessories', 'sku', 'ACC-');
    if (db.get('SELECT id FROM accessories WHERE sku = ?', [c.sku])) throw new U.AppError(`SKU ${c.sku} is already in use.`, 'DUPLICATE');
    const t = U.nowIso();
    const id = db.run(`INSERT INTO accessories(name,category,sku,purchase_price,selling_price,quantity,min_stock,supplier_id,notes,is_demo,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)`,
      [c.name, c.category, c.sku, c.purchase_price, c.selling_price, qty, c.min_stock, c.supplier_id, c.notes, demo, t, t]).id;
    if (qty > 0) move(db, id, 'opening', qty, qty, c.purchase_price, 'Opening stock', today);
    return id;
  });
}
function update(db, d) {
  const id = U.id(d.id), c = clean(d);
  return db.tx(() => {
    const cur = db.get('SELECT * FROM accessories WHERE id = ?', [id]);
    if (!cur) throw new U.AppError('Accessory not found.', 'NOT_FOUND');
    if (!c.sku) c.sku = cur.sku;
    if (db.get('SELECT id FROM accessories WHERE sku = ? AND id <> ?', [c.sku, id])) throw new U.AppError(`SKU ${c.sku} is already in use.`, 'DUPLICATE');
    db.run(`UPDATE accessories SET name=?,category=?,sku=?,purchase_price=?,selling_price=?,min_stock=?,supplier_id=?,notes=?,updated_at=? WHERE id=?`,
      [c.name, c.category, c.sku, c.purchase_price, c.selling_price, c.min_stock, c.supplier_id, c.notes, U.nowIso(), id]);
    return id;
  });
}
function remove(db, id) {
  const aid = U.id(id);
  return db.tx(() => {
    if (!db.get('SELECT id FROM accessories WHERE id = ?', [aid])) throw new U.AppError('Accessory not found.', 'NOT_FOUND');
    if (db.get('SELECT COUNT(*) AS n FROM sale_items WHERE accessory_id = ?', [aid]).n > 0) {
      // Sold before: archive instead of deleting so past invoices stay intact.
      db.run('UPDATE accessories SET is_active = 0, updated_at = ? WHERE id = ?', [U.nowIso(), aid]);
      return { archived: true };
    }
    Suppliers.removeRef(db, 'accessory_purchase', aid);
    db.run(`DELETE FROM stock_movements WHERE item_type='accessory' AND item_id=?`, [aid]);
    db.run('DELETE FROM accessories WHERE id = ?', [aid]);
    return { archived: false };
  });
}
/** Manual correction: either a signed change or an absolute counted quantity. */
function adjust(db, d, today) {
  const id = U.id(d.id);
  return db.tx(() => {
    const cur = db.get('SELECT * FROM accessories WHERE id = ?', [id]);
    if (!cur) throw new U.AppError('Accessory not found.', 'NOT_FOUND');
    let delta;
    if (d.mode === 'set') delta = U.int(d.quantity, 'Counted quantity', { max: 1e7 }) - cur.quantity;
    else delta = U.int(d.quantity, 'Quantity change', { min: -1e7, max: 1e7 });
    if (delta === 0) throw new U.AppError('The quantity is unchanged.');
    const after = cur.quantity + delta;
    if (after < 0) throw new U.AppError(`Stock cannot go below zero (current quantity is ${cur.quantity}).`);
    db.run('UPDATE accessories SET quantity = ?, updated_at = ? WHERE id = ?', [after, U.nowIso(), id]);
    move(db, id, 'adjustment', delta, after, cur.purchase_price, U.str(d.reason, 'Reason', { required: true, max: 300 }), today);
    return after;
  });
}
/** Stock purchase: raises quantity, re-averages cost and posts to the supplier ledger. */
function purchase(db, d, today, demo = 0) {
  const id = U.id(d.id);
  const qty = U.int(d.quantity, 'Quantity', { min: 1, max: 1e7, required: true });
  const cost = U.num(d.unit_cost, 'Unit cost', { required: true });
  const supplierId = U.idOrNull(d.supplier_id);
  const date = U.date(d.date, 'Date', { fallback: today });
  return db.tx(() => {
    const cur = db.get('SELECT * FROM accessories WHERE id = ?', [id]);
    if (!cur) throw new U.AppError('Accessory not found.', 'NOT_FOUND');
    const after = cur.quantity + qty;
    const avg = U.Fmt.round((cur.quantity * cur.purchase_price + qty * cost) / after, 4);
    db.run('UPDATE accessories SET quantity=?, purchase_price=?, supplier_id=COALESCE(?, supplier_id), updated_at=? WHERE id=?', [after, avg, supplierId, U.nowIso(), id]);
    move(db, id, 'purchase', qty, after, cost, U.str(d.note, 'Note') || 'Stock purchase', date);
    if (supplierId) {
      const total = U.Fmt.round(qty * cost, 4);
      const paid = d.paid === '' || d.paid == null ? total : U.num(d.paid, 'Amount paid', { max: total });
      Suppliers.addPurchase(db, { supplier_id: supplierId, amount: total, paid, date, description: `${qty} × ${cur.name}`, ref_type: 'accessory_purchase', ref_id: id,
        method: U.oneOf(d.method, C.PAYMENT_METHODS, 'Payment method', 'cash'), demo });
    }
    return after;
  });
}
function lowStock(db) { return db.all(`${SELECT} WHERE a.is_active = 1 AND a.quantity <= a.min_stock ORDER BY a.quantity, a.name COLLATE NOCASE`); }

module.exports = { list, get, create, update, remove, adjust, purchase, lowStock, move };
