'use strict';
const U = require('./util');
const C = require('../../shared/constants');
const Settings = require('./settings');
const Mobiles = require('./mobiles');

const SELECT = `SELECT x.*, c.name AS customer_name, s.invoice_no AS source_invoice,
  (SELECT i.unit_price - i.discount_alloc - i.tax_alloc FROM sale_items i JOIN sales s2 ON s2.id = i.sale_id WHERE i.exchange_id = x.id AND s2.status='completed' LIMIT 1) AS resale_value,
  (SELECT i.profit FROM sale_items i JOIN sales s2 ON s2.id = i.sale_id WHERE i.exchange_id = x.id AND s2.status='completed' LIMIT 1) AS resale_profit
  FROM exchanges x LEFT JOIN customers c ON c.id = x.customer_id LEFT JOIN sales s ON s.id = x.source_sale_id`;

function clean(d, today) {
  return { brand: U.str(d.brand, 'Brand', { required: true, max: 60 }), model: U.str(d.model, 'Model', { required: true, max: 80 }),
    imei: Mobiles.cleanImei(d.imei, 'IMEI', false), condition: U.oneOf(d.condition, C.CONDITIONS, 'Condition', 'good'),
    estimated_value: U.num(d.estimated_value, 'Estimated value'), acquisition_value: U.num(d.acquisition_value, 'Acquisition value', { required: true }),
    notes: U.str(d.notes, 'Notes', { max: 2000 }), date_received: U.date(d.date_received, 'Date received', { fallback: today }), customer_id: U.idOrNull(d.customer_id) };
}
function list(db, f = {}) {
  const where = [], p = [];
  if (f.status) { where.push('x.status = ?'); p.push(f.status); }
  if (f.q) { where.push(`(x.brand LIKE ? ESCAPE '\\' OR x.model LIKE ? ESCAPE '\\' OR x.imei LIKE ? ESCAPE '\\' OR x.stock_id LIKE ? ESCAPE '\\')`); const q = U.like(f.q); p.push(q, q, q, q); }
  return db.all(`${SELECT} ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY x.id DESC`, p);
}
function get(db, id) {
  const x = db.get(`${SELECT} WHERE x.id = ?`, [U.id(id)]);
  if (!x) throw new U.AppError('Used phone not found.', 'NOT_FOUND');
  return x;
}
/** Used by manual entry and by trade-ins taken during a sale. */
function create(db, d, today, { source_sale_id = null, demo = 0 } = {}) {
  const c = clean(d, today);
  return db.tx(() => {
    Mobiles.assertImeiFree(db, c.imei, { forUsed: true });
    const stockId = Settings.nextStockId(db, 'exchanges', 'stock_id', 'UX-');
    const t = U.nowIso();
    const id = db.run(`INSERT INTO exchanges(stock_id,brand,model,imei,condition,estimated_value,acquisition_value,notes,date_received,status,source_sale_id,customer_id,is_demo,created_at,updated_at)
      VALUES(?,?,?,?,?,?,?,?,?,'available',?,?,?,?,?)`,
      [stockId, c.brand, c.model, c.imei, c.condition, c.estimated_value || c.acquisition_value, c.acquisition_value, c.notes, c.date_received, source_sale_id, c.customer_id, demo, t, t]).id;
    db.run(`INSERT INTO stock_movements(item_type,item_id,movement_type,quantity,balance_after,unit_cost,ref_type,ref_id,note,movement_date,created_at) VALUES('used',?,?,1,1,?,?,?,?,?,?)`,
      [id, source_sale_id ? 'trade_in' : 'purchase', c.acquisition_value, source_sale_id ? 'sale' : '', source_sale_id, source_sale_id ? 'Received as trade-in' : 'Added to used stock', c.date_received, t]);
    return id;
  });
}
function update(db, d, today) {
  const id = U.id(d.id);
  return db.tx(() => {
    const cur = db.get('SELECT * FROM exchanges WHERE id = ?', [id]);
    if (!cur) throw new U.AppError('Used phone not found.', 'NOT_FOUND');
    const c = clean(d, today);
    let status = cur.status;
    if (cur.status === 'sold') {
      if (c.acquisition_value !== cur.acquisition_value || c.imei !== cur.imei) throw new U.AppError('IMEI and acquisition value cannot be changed after the phone is sold.');
    } else {
      if (cur.source_sale_id && c.acquisition_value !== cur.acquisition_value)
        throw new U.AppError('The acquisition value of a trade-in is fixed by the original sale.');
      if (d.status && d.status !== cur.status) status = U.oneOf(d.status, ['available', 'returned'], 'Status');
    }
    if (status === 'available') Mobiles.assertImeiFree(db, c.imei, { exchangeId: id, forUsed: true });
    db.run(`UPDATE exchanges SET brand=?,model=?,imei=?,condition=?,estimated_value=?,acquisition_value=?,notes=?,date_received=?,status=?,updated_at=? WHERE id=?`,
      [c.brand, c.model, c.imei, c.condition, c.estimated_value, c.acquisition_value, c.notes, c.date_received, status, U.nowIso(), id]);
    return id;
  });
}
function remove(db, id) {
  const xid = U.id(id);
  return db.tx(() => {
    const cur = db.get('SELECT * FROM exchanges WHERE id = ?', [xid]);
    if (!cur) throw new U.AppError('Used phone not found.', 'NOT_FOUND');
    if (cur.source_sale_id) throw new U.AppError('This phone was received as a trade-in on a sale and cannot be deleted. Mark it as Returned instead.');
    if (db.get('SELECT COUNT(*) AS n FROM sale_items WHERE exchange_id = ?', [xid]).n > 0) throw new U.AppError('This phone appears on a sale and cannot be deleted.');
    db.run(`DELETE FROM stock_movements WHERE item_type='used' AND item_id=?`, [xid]);
    db.run('DELETE FROM exchanges WHERE id = ?', [xid]);
    return true;
  });
}
module.exports = { list, get, create, update, remove };
