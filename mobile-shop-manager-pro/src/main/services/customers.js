'use strict';
const U = require('./util');
const C = require('../../shared/constants');
const Settings = require('./settings');

const TOTALS = `
  SELECT c.*,
    COALESCE(s.purchases,0) AS total_purchases, COALESCE(s.paid,0) AS total_paid,
    COALESCE(l.balance,0) AS balance, s.last_sale, l.last_entry, COALESCE(s.sale_count,0) AS sale_count
  FROM customers c
  LEFT JOIN (SELECT customer_id, SUM(grand_total) AS purchases, SUM(paid_amount) AS paid, MAX(sale_date) AS last_sale, COUNT(*) AS sale_count
             FROM sales WHERE status = 'completed' GROUP BY customer_id) s ON s.customer_id = c.id
  LEFT JOIN (SELECT customer_id, SUM(debit) - SUM(credit) AS balance, MAX(entry_date) AS last_entry FROM customer_ledger GROUP BY customer_id) l ON l.customer_id = c.id`;

function clean(d) {
  const code = U.str(d.phone_code, 'Country code', { max: 6 });
  if (code && !/^\+\d{1,4}$/.test(code)) throw new U.AppError('Country code must look like +1 or +44.');
  const phone = U.str(d.phone, 'Phone', { max: 30 });
  if (phone && !/^[0-9 ()\-.]{3,30}$/.test(phone)) throw new U.AppError('Phone number may only contain digits, spaces, brackets and dashes.');
  return { name: U.str(d.name, 'Customer name', { required: true, max: 120 }), phone_code: code, phone, email: U.email(d.email),
    address: U.str(d.address, 'Address'), country: U.str(d.country, 'Country', { max: 4 }), notes: U.str(d.notes, 'Notes', { max: 2000 }) };
}
function list(db, f = {}) {
  const where = [], p = [];
  if (f.q) { where.push(`(c.name LIKE ? ESCAPE '\\' OR c.phone LIKE ? ESCAPE '\\' OR c.email LIKE ? ESCAPE '\\')`); const q = U.like(f.q); p.push(q, q, q); }
  if (f.outstanding) where.push('COALESCE(l.balance,0) > 0.00001');
  return db.all(`${TOTALS} ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY c.name COLLATE NOCASE`, p);
}
function balance(db, customerId) {
  return U.Fmt.round(db.get('SELECT COALESCE(SUM(debit),0) - COALESCE(SUM(credit),0) AS b FROM customer_ledger WHERE customer_id = ?', [customerId]).b, 4);
}
function get(db, id) {
  const c = db.get(`${TOTALS} WHERE c.id = ?`, [U.id(id)]);
  if (!c) throw new U.AppError('Customer not found.', 'NOT_FOUND');
  c.sales = db.all(`SELECT id, invoice_no, sale_date, grand_total, paid_amount, grand_total - paid_amount AS remaining, status FROM sales WHERE customer_id = ? ORDER BY sale_date DESC, id DESC`, [c.id]);
  c.ledger = statement(db, { customer_id: c.id }).entries;
  return c;
}
/** Chronological statement with a running balance; optional date window with opening balance. */
function statement(db, d) {
  const cid = U.id(d.customer_id);
  const customer = db.get('SELECT * FROM customers WHERE id = ?', [cid]);
  if (!customer) throw new U.AppError('Customer not found.', 'NOT_FOUND');
  const from = U.date(d.from, 'From') || '0001-01-01', to = U.date(d.to, 'To') || '9999-12-31';
  const opening = db.get('SELECT COALESCE(SUM(debit),0) - COALESCE(SUM(credit),0) AS b FROM customer_ledger WHERE customer_id = ? AND entry_date < ?', [cid, from]).b;
  const rows = db.all(`SELECT l.*, s.invoice_no FROM customer_ledger l LEFT JOIN sales s ON s.id = l.sale_id
    WHERE l.customer_id = ? AND l.entry_date BETWEEN ? AND ? ORDER BY l.entry_date, l.id`, [cid, from, to]);
  let run = opening;
  rows.forEach(r => { run = U.Fmt.round(run + r.debit - r.credit, 4); r.balance = run; });
  return { customer, opening: U.Fmt.round(opening, 4), entries: rows, closing: U.Fmt.round(run, 4),
    total_debit: rows.reduce((a, r) => a + r.debit, 0), total_credit: rows.reduce((a, r) => a + r.credit, 0) };
}
function create(db, d, demo = 0) {
  const c = clean(d), t = U.nowIso();
  return db.run('INSERT INTO customers(name,phone_code,phone,email,address,country,notes,is_demo,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?)',
    [c.name, c.phone_code, c.phone, c.email, c.address, c.country, c.notes, demo, t, t]).id;
}
function update(db, d) {
  const c = clean(d);
  const r = db.run('UPDATE customers SET name=?,phone_code=?,phone=?,email=?,address=?,country=?,notes=?,updated_at=? WHERE id=?',
    [c.name, c.phone_code, c.phone, c.email, c.address, c.country, c.notes, U.nowIso(), U.id(d.id)]);
  if (!r.changes) throw new U.AppError('Customer not found.', 'NOT_FOUND');
  return d.id;
}
function remove(db, id) {
  const cid = U.id(id);
  if (db.get('SELECT COUNT(*) AS n FROM sales WHERE customer_id = ?', [cid]).n > 0 || db.get('SELECT COUNT(*) AS n FROM customer_ledger WHERE customer_id = ?', [cid]).n > 0)
    throw new U.AppError('This customer has transaction history and cannot be deleted.');
  db.run('UPDATE exchanges SET customer_id = NULL WHERE customer_id = ?', [cid]);
  db.run('DELETE FROM customers WHERE id = ?', [cid]);
  return true;
}
/**
 * Records a credit payment. The amount is applied to the customer's unpaid invoices,
 * oldest first (or to one chosen invoice), and posted once to the ledger.
 * Profit is NOT touched here: it was recognised when the sale was made.
 */
function recordPayment(db, d, today) {
  const cid = U.id(d.customer_id);
  const dec = Settings.get(db).decimals;
  const amount = U.Fmt.round(U.num(d.amount, 'Amount', { min: 0, required: true }), dec);
  if (!(amount > 0)) throw new U.AppError('Enter a payment amount greater than zero.');
  const method = U.oneOf(d.method, C.PAYMENT_METHODS, 'Payment method', 'cash');
  const date = U.date(d.date, 'Date', { fallback: today });
  const note = U.str(d.note, 'Note');
  return db.tx(() => {
    if (!db.get('SELECT id FROM customers WHERE id = ?', [cid])) throw new U.AppError('Customer not found.', 'NOT_FOUND');
    const bal = balance(db, cid);
    if (amount > bal + 1e-6) throw new U.AppError('Payment is more than the outstanding balance.');
    let open = db.all(`SELECT id, invoice_no, grand_total - paid_amount AS due FROM sales WHERE customer_id = ? AND status = 'completed' AND grand_total - paid_amount > 0.00001 ORDER BY sale_date, id`, [cid]);
    if (d.sale_id) {
      open = open.filter(s => s.id === Number(d.sale_id));
      if (!open.length) throw new U.AppError('That invoice has no outstanding balance.');
      if (amount > open[0].due + 1e-6) throw new U.AppError('Payment is more than the balance of that invoice.');
    }
    const receipt = Settings.nextCode(db, 'receipt_next', 'RCT-');
    const t = U.nowIso();
    let left = amount; const applied = [];
    for (const s of open) {
      if (left <= 1e-9) break;
      const part = U.Fmt.round(Math.min(left, s.due), dec);
      if (part <= 0) continue;
      db.run('INSERT INTO sale_payments(sale_id,customer_id,amount,method,payment_date,receipt_no,note,created_at) VALUES(?,?,?,?,?,?,?,?)', [s.id, cid, part, method, date, receipt, note, t]);
      db.run('UPDATE sales SET paid_amount = ROUND(paid_amount + ?, 4) WHERE id = ?', [part, s.id]);
      applied.push({ sale_id: s.id, invoice_no: s.invoice_no, amount: part });
      left = U.Fmt.round(left - part, dec);
    }
    if (left > 1e-6) throw new U.AppError('Payment could not be matched to unpaid invoices.');
    db.run(`INSERT INTO customer_ledger(customer_id,entry_date,entry_type,sale_id,description,debit,credit,method,receipt_no,created_at) VALUES(?,?,?,?,?,0,?,?,?,?)`,
      [cid, date, 'payment', applied.length === 1 ? applied[0].sale_id : null, note || ('Payment received – ' + applied.map(a => a.invoice_no).join(', ')), amount, method, receipt, t]);
    return { receipt_no: receipt, amount, applied, balance: balance(db, cid) };
  });
}
function payments(db, customerId) {
  return db.all(`SELECT p.*, s.invoice_no FROM sale_payments p JOIN sales s ON s.id = p.sale_id WHERE p.customer_id = ? AND s.status = 'completed' ORDER BY p.payment_date DESC, p.id DESC`, [U.id(customerId)]);
}
function creditBook(db) {
  const rows = list(db, { outstanding: true });
  return { total: U.Fmt.round(rows.reduce((a, r) => a + r.balance, 0), 4), customers: rows.sort((a, b) => b.balance - a.balance) };
}
module.exports = { list, get, create, update, remove, statement, recordPayment, payments, creditBook, balance };
