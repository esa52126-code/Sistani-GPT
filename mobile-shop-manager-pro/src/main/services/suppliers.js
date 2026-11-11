'use strict';
const U = require('./util');
const C = require('../../shared/constants');

function clean(d) {
  return { name: U.str(d.name, 'Supplier name', { required: true, max: 120 }), phone: U.str(d.phone, 'Phone', { max: 40 }), email: U.email(d.email),
    company: U.str(d.company, 'Company', { max: 120 }), address: U.str(d.address, 'Address'), notes: U.str(d.notes, 'Notes', { max: 2000 }) };
}
function list(db) {
  return db.all(`SELECT s.*, COALESCE(l.purchases,0) AS total_purchases, COALESCE(l.paid,0) AS total_paid,
      COALESCE(l.purchases,0) - COALESCE(l.paid,0) AS payable
    FROM suppliers s LEFT JOIN (SELECT supplier_id, SUM(debit) AS purchases, SUM(credit) AS paid FROM supplier_ledger GROUP BY supplier_id) l
      ON l.supplier_id = s.id ORDER BY s.name COLLATE NOCASE`);
}
function get(db, id) {
  const s = list(db).find(x => x.id === U.id(id));
  if (!s) throw new U.AppError('Supplier not found.', 'NOT_FOUND');
  s.ledger = db.all('SELECT * FROM supplier_ledger WHERE supplier_id = ? ORDER BY entry_date DESC, id DESC', [s.id]);
  return s;
}
function create(db, d, demo = 0) {
  const c = clean(d), t = U.nowIso();
  return db.run('INSERT INTO suppliers(name,phone,email,company,address,notes,is_demo,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?)',
    [c.name, c.phone, c.email, c.company, c.address, c.notes, demo, t, t]).id;
}
function update(db, d) {
  const c = clean(d);
  const r = db.run('UPDATE suppliers SET name=?,phone=?,email=?,company=?,address=?,notes=?,updated_at=? WHERE id=?',
    [c.name, c.phone, c.email, c.company, c.address, c.notes, U.nowIso(), U.id(d.id)]);
  if (!r.changes) throw new U.AppError('Supplier not found.', 'NOT_FOUND');
  return d.id;
}
function remove(db, id) {
  const sid = U.id(id);
  const n = db.get('SELECT COUNT(*) AS n FROM supplier_ledger WHERE supplier_id = ?', [sid]).n;
  if (n > 0) throw new U.AppError('This supplier has purchase or payment history and cannot be deleted.');
  db.run('DELETE FROM suppliers WHERE id = ?', [sid]);
  return true;
}
function payable(db, supplierId) {
  return db.get('SELECT COALESCE(SUM(debit),0) - COALESCE(SUM(credit),0) AS b FROM supplier_ledger WHERE supplier_id = ?', [supplierId]).b;
}
/** Adds a purchase (amount we owe) and optionally the part already paid. */
function addPurchase(db, { supplier_id, amount, paid = 0, date, description, ref_type = '', ref_id = null, method = 'cash', demo = 0 }) {
  if (!supplier_id || !(amount > 0)) return;
  const t = U.nowIso();
  db.run(`INSERT INTO supplier_ledger(supplier_id,entry_date,entry_type,ref_type,ref_id,description,debit,credit,method,is_demo,created_at)
    VALUES(?,?,?,?,?,?,?,0,'',?,?)`, [supplier_id, date, 'purchase', ref_type, ref_id, description, amount, demo, t]);
  const p = Math.min(paid || 0, amount);
  if (p > 0) db.run(`INSERT INTO supplier_ledger(supplier_id,entry_date,entry_type,ref_type,ref_id,description,debit,credit,method,is_demo,created_at)
    VALUES(?,?,?,?,?,?,0,?,?,?,?)`, [supplier_id, date, 'payment', ref_type, ref_id, 'Paid at purchase: ' + description, p, method, demo, t]);
}
function removeRef(db, ref_type, ref_id) { db.run('DELETE FROM supplier_ledger WHERE ref_type = ? AND ref_id = ?', [ref_type, ref_id]); }
function recordPayment(db, d, today) {
  const sid = U.id(d.supplier_id);
  const amount = U.num(d.amount, 'Amount', { min: 0.0001, required: true });
  if (!db.get('SELECT id FROM suppliers WHERE id = ?', [sid])) throw new U.AppError('Supplier not found.', 'NOT_FOUND');
  const due = payable(db, sid);
  if (amount > due + 1e-6) throw new U.AppError('Payment is more than the amount payable to this supplier.');
  return db.run(`INSERT INTO supplier_ledger(supplier_id,entry_date,entry_type,description,debit,credit,method,created_at) VALUES(?,?,?,?,0,?,?,?)`,
    [sid, U.date(d.date, 'Date', { fallback: today }), 'payment', U.str(d.note, 'Note') || 'Payment to supplier', amount,
      U.oneOf(d.method, C.PAYMENT_METHODS, 'Payment method', 'cash'), U.nowIso()]).id;
}
module.exports = { list, get, create, update, remove, addPurchase, removeRef, recordPayment, payable };
