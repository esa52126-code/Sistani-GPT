'use strict';
const U = require('./util');
const Settings = require('./settings');
const Suppliers = require('./suppliers');

const SELECT = `SELECT m.*, s.name AS supplier_name FROM mobiles m LEFT JOIN suppliers s ON s.id = m.supplier_id`;

function cleanImei(v, label, required) {
  const s = U.str(v, label, { required, max: 20 }).replace(/[\s-]/g, '');
  if (s && !/^[0-9A-Za-z]{8,20}$/.test(s)) throw new U.AppError(`${label} must be 8–20 letters or digits (a standard IMEI has 15 digits).`);
  return s.toUpperCase();
}
/**
 * IMEI uniqueness across inventories: an IMEI may not match any other new-stock record
 * (either IMEI slot) or any used phone that is currently available.
 */
function assertImeiFree(db, imei, { mobileId = null, exchangeId = null, forUsed = false } = {}) {
  if (!imei) return;
  const m = forUsed
    ? db.get(`SELECT stock_id FROM mobiles WHERE (imei1 = ? OR imei2 = ?) AND status = 'in_stock'`, [imei, imei])
    : db.get('SELECT stock_id FROM mobiles WHERE (imei1 = ? OR imei2 = ?) AND id <> ?', [imei, imei, mobileId || 0]);
  if (m) throw new U.AppError(`IMEI ${imei} already exists in mobile inventory (${m.stock_id}).`, 'DUPLICATE_IMEI');
  const x = db.get(`SELECT stock_id FROM exchanges WHERE imei = ? AND status = 'available' AND id <> ?`, [imei, exchangeId || 0]);
  if (x) throw new U.AppError(`IMEI ${imei} already exists in used stock (${x.stock_id}).`, 'DUPLICATE_IMEI');
}
function clean(d, today) {
  const c = {
    brand: U.str(d.brand, 'Brand', { required: true, max: 60 }), model: U.str(d.model, 'Model', { required: true, max: 80 }),
    ram: U.str(d.ram, 'RAM', { max: 20 }), storage: U.str(d.storage, 'Storage', { max: 20 }), color: U.str(d.color, 'Color', { max: 40 }),
    imei1: cleanImei(d.imei1, 'IMEI 1', true), imei2: cleanImei(d.imei2, 'IMEI 2', false),
    purchase_price: U.num(d.purchase_price, 'Purchase price', { required: true }), selling_price: U.num(d.selling_price, 'Selling price', { required: true }),
    supplier_id: U.idOrNull(d.supplier_id), purchase_date: U.date(d.purchase_date, 'Purchase date', { fallback: today }),
    warranty: U.str(d.warranty, 'Warranty', { max: 80 }), notes: U.str(d.notes, 'Notes', { max: 2000 }),
  };
  if (c.imei2 && c.imei2 === c.imei1) throw new U.AppError('IMEI 1 and IMEI 2 cannot be the same.', 'DUPLICATE_IMEI');
  return c;
}
function list(db, f = {}) {
  const where = [], p = [];
  if (f.status) { where.push('m.status = ?'); p.push(f.status); }
  if (f.brand) { where.push('m.brand = ? COLLATE NOCASE'); p.push(f.brand); }
  if (f.q) { where.push(`(m.brand LIKE ? ESCAPE '\\' OR m.model LIKE ? ESCAPE '\\' OR m.imei1 LIKE ? ESCAPE '\\' OR m.imei2 LIKE ? ESCAPE '\\' OR m.stock_id LIKE ? ESCAPE '\\')`); const q = U.like(f.q); p.push(q, q, q, q, q); }
  return db.all(`${SELECT} ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY m.id DESC`, p);
}
function get(db, id) {
  const m = db.get(`${SELECT} WHERE m.id = ?`, [U.id(id)]);
  if (!m) throw new U.AppError('Mobile not found.', 'NOT_FOUND');
  m.sale = db.get(`SELECT s.id, s.invoice_no, s.sale_date, s.status, i.unit_price, c.name AS customer_name FROM sale_items i JOIN sales s ON s.id = i.sale_id
    LEFT JOIN customers c ON c.id = s.customer_id WHERE i.mobile_id = ? AND s.status = 'completed' ORDER BY s.id DESC LIMIT 1`, [m.id]) || null;
  return m;
}
function syncSupplier(db, id, c, paid, demo) {
  Suppliers.removeRef(db, 'mobile', id);
  if (c.supplier_id) Suppliers.addPurchase(db, { supplier_id: c.supplier_id, amount: c.purchase_price, paid, date: c.purchase_date,
    description: `Mobile ${c.brand} ${c.model} (${c.imei1})`, ref_type: 'mobile', ref_id: id, demo });
}
function create(db, d, today, demo = 0) {
  const c = clean(d, today);
  return db.tx(() => {
    assertImeiFree(db, c.imei1); assertImeiFree(db, c.imei2);
    if (c.supplier_id && !db.get('SELECT id FROM suppliers WHERE id = ?', [c.supplier_id])) throw new U.AppError('Supplier not found.');
    const stockId = Settings.nextStockId(db, 'mobiles', 'stock_id', 'MS-');
    const t = U.nowIso();
    const id = db.run(`INSERT INTO mobiles(stock_id,brand,model,ram,storage,color,imei1,imei2,purchase_price,selling_price,supplier_id,purchase_date,warranty,notes,status,is_demo,created_at,updated_at)
      VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,'in_stock',?,?,?)`,
      [stockId, c.brand, c.model, c.ram, c.storage, c.color, c.imei1, c.imei2, c.purchase_price, c.selling_price, c.supplier_id, c.purchase_date, c.warranty, c.notes, demo, t, t]).id;
    const paid = d.supplier_paid === 'unpaid' ? 0 : d.supplier_paid === 'partial' ? U.num(d.supplier_paid_amount, 'Amount paid to supplier') : c.purchase_price;
    syncSupplier(db, id, c, paid, demo);
    db.run(`INSERT INTO stock_movements(item_type,item_id,movement_type,quantity,balance_after,unit_cost,note,movement_date,created_at) VALUES('mobile',?,?,1,1,?,?,?,?)`,
      [id, 'purchase', c.purchase_price, 'Added to inventory', c.purchase_date, t]);
    return id;
  });
}
function update(db, d, today) {
  const id = U.id(d.id);
  return db.tx(() => {
    const cur = db.get('SELECT * FROM mobiles WHERE id = ?', [id]);
    if (!cur) throw new U.AppError('Mobile not found.', 'NOT_FOUND');
    const c = clean(d, today);
    let status = cur.status;
    if (cur.status === 'sold') {
      // Sold phones are part of financial history: identity and cost are frozen.
      if (c.imei1 !== cur.imei1 || c.imei2 !== cur.imei2 || c.purchase_price !== cur.purchase_price)
        throw new U.AppError('IMEI and purchase price cannot be changed after a phone is sold. Void the sale first if it was a mistake.');
    } else if (d.status && d.status !== cur.status) {
      status = U.oneOf(d.status, ['in_stock', 'exchange', 'returned'], 'Status');
    }
    assertImeiFree(db, c.imei1, { mobileId: id }); assertImeiFree(db, c.imei2, { mobileId: id });
    db.run(`UPDATE mobiles SET brand=?,model=?,ram=?,storage=?,color=?,imei1=?,imei2=?,purchase_price=?,selling_price=?,supplier_id=?,purchase_date=?,warranty=?,notes=?,status=?,updated_at=? WHERE id=?`,
      [c.brand, c.model, c.ram, c.storage, c.color, c.imei1, c.imei2, c.purchase_price, c.selling_price, c.supplier_id, c.purchase_date, c.warranty, c.notes, status, U.nowIso(), id]);
    if (c.supplier_id !== cur.supplier_id || c.purchase_price !== cur.purchase_price) {
      // Keep what was already paid against this phone, re-post the purchase.
      const paid = db.get(`SELECT COALESCE(SUM(credit),0) AS p FROM supplier_ledger WHERE ref_type='mobile' AND ref_id=?`, [id]).p;
      syncSupplier(db, id, c, c.supplier_id === cur.supplier_id ? paid : 0, cur.is_demo);
    }
    if (status !== cur.status) db.run(`INSERT INTO stock_movements(item_type,item_id,movement_type,quantity,balance_after,note,movement_date,created_at) VALUES('mobile',?,?,?,?,?,?,?)`,
      [id, 'status', status === 'in_stock' ? 1 : -1, status === 'in_stock' ? 1 : 0, `Status changed to ${status}`, today, U.nowIso()]);
    return id;
  });
}
function remove(db, id) {
  const mid = U.id(id);
  return db.tx(() => {
    const cur = db.get('SELECT * FROM mobiles WHERE id = ?', [mid]);
    if (!cur) throw new U.AppError('Mobile not found.', 'NOT_FOUND');
    if (db.get('SELECT COUNT(*) AS n FROM sale_items WHERE mobile_id = ?', [mid]).n > 0)
      throw new U.AppError('This phone appears on a sale and cannot be deleted. Sales history must be preserved.');
    Suppliers.removeRef(db, 'mobile', mid);
    db.run(`DELETE FROM stock_movements WHERE item_type='mobile' AND item_id=?`, [mid]);
    db.run('DELETE FROM mobiles WHERE id = ?', [mid]);
    return true;
  });
}
function brands(db) { return db.all('SELECT DISTINCT brand FROM mobiles ORDER BY brand COLLATE NOCASE').map(r => r.brand); }

module.exports = { list, get, create, update, remove, brands, assertImeiFree, cleanImei };
