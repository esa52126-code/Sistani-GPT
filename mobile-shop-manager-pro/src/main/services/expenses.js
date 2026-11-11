'use strict';
const U = require('./util');
const C = require('../../shared/constants');

function clean(d, today) {
  const amount = U.num(d.amount, 'Amount', { required: true });
  if (!(amount > 0)) throw new U.AppError('Amount must be greater than zero.');
  return { category: U.oneOf(d.category, C.EXPENSE_CATEGORIES, 'Category', 'other'), amount, expense_date: U.date(d.expense_date, 'Date', { fallback: today }),
    description: U.str(d.description, 'Description', { max: 500 }), payment_method: U.oneOf(d.payment_method, C.PAYMENT_METHODS, 'Payment method', 'cash') };
}
function list(db, f = {}) {
  const where = [], p = [];
  if (f.from) { where.push('expense_date >= ?'); p.push(f.from); }
  if (f.to) { where.push('expense_date <= ?'); p.push(f.to); }
  if (f.category) { where.push('category = ?'); p.push(f.category); }
  return db.all(`SELECT * FROM expenses ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY expense_date DESC, id DESC`, p);
}
function create(db, d, today, demo = 0) {
  const c = clean(d, today), t = U.nowIso();
  return db.run('INSERT INTO expenses(category,amount,expense_date,description,payment_method,is_demo,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?)',
    [c.category, c.amount, c.expense_date, c.description, c.payment_method, demo, t, t]).id;
}
function update(db, d, today) {
  const c = clean(d, today);
  const r = db.run('UPDATE expenses SET category=?,amount=?,expense_date=?,description=?,payment_method=?,updated_at=? WHERE id=?',
    [c.category, c.amount, c.expense_date, c.description, c.payment_method, U.nowIso(), U.id(d.id)]);
  if (!r.changes) throw new U.AppError('Expense not found.', 'NOT_FOUND');
  return d.id;
}
function remove(db, id) { db.run('DELETE FROM expenses WHERE id = ?', [U.id(id)]); return true; }
function sum(db, from, to) { return db.get('SELECT COALESCE(SUM(amount),0) AS t FROM expenses WHERE expense_date BETWEEN ? AND ?', [from, to]).t; }
/** ranges: { today:{from,to}, month:{...}, year:{...} } computed by the caller in the shop's time zone. */
function summary(db, ranges) {
  return { today: sum(db, ranges.today.from, ranges.today.to), month: sum(db, ranges.month.from, ranges.month.to),
    year: sum(db, ranges.year.from, ranges.year.to), total: sum(db, '0001-01-01', '9999-12-31') };
}
module.exports = { list, create, update, remove, sum, summary };
