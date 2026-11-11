'use strict';
const U = require('./util');
const C = require('../../shared/constants');
const Settings = require('./settings');
const Accessories = require('./accessories');
const Exchanges = require('./exchanges');
const Customers = require('./customers');

/**
 * Completes a sale atomically.
 * payload: { customer_id?, sale_date?, items:[{type:'mobile'|'accessory'|'used', id, quantity?, unit_price}], discount,
 *            tax_exempt, paid, payment_method, trade_in?: {brand,model,imei,condition,estimated_value,value,notes}, notes }
 *
 * Accounting rules (kept in one place so nothing is double counted):
 *  - Revenue and profit are recognised once, when the sale is completed, for the full sale value.
 *  - Money received later against credit only reduces the customer's balance; it never adds profit.
 *  - A trade-in is a form of payment. The traded phone enters used stock at its trade-in value
 *    and earns its own profit only when it is resold.
 *  - Tax collected is never profit.
 */
function create(db, payload, today, demo = 0) {
  const d = payload || {};
  const settings = Settings.get(db);
  const dec = settings.decimals;
  const R = n => U.Fmt.round(n, dec);
  if (!Array.isArray(d.items) || d.items.length === 0) throw new U.AppError('Add at least one item to the sale.');
  if (d.items.length > 200) throw new U.AppError('Too many items on one sale.');
  const customerId = U.idOrNull(d.customer_id);
  const saleDate = U.date(d.sale_date, 'Sale date', { fallback: today });
  const method = U.oneOf(d.payment_method, C.PAYMENT_METHODS, 'Payment method', 'cash');
  const notes = U.str(d.notes, 'Notes', { max: 1000 });

  return db.tx(() => {
    if (customerId && !db.get('SELECT id FROM customers WHERE id = ?', [customerId])) throw new U.AppError('Customer not found.', 'NOT_FOUND');
    const lines = [], seen = new Set();
    for (const it of d.items) {
      const type = U.oneOf(it.type, ['mobile', 'accessory', 'used'], 'Item type');
      const id = U.id(it.id);
      const key = type + ':' + id;
      if (seen.has(key)) throw new U.AppError('The same item was added twice. Change its quantity instead.');
      seen.add(key);
      const price = R(U.num(it.unit_price, 'Price', { required: true }));
      if (type === 'mobile') {
        const m = db.get('SELECT * FROM mobiles WHERE id = ?', [id]);
        if (!m) throw new U.AppError('Selected mobile no longer exists.', 'NOT_FOUND');
        if (m.status !== 'in_stock') throw new U.AppError(`${m.brand} ${m.model} (${m.stock_id}) is not in stock and cannot be sold.`, 'OUT_OF_STOCK');
        lines.push({ type, ref: m, quantity: 1, unit_price: price, unit_cost: m.purchase_price, line_total: price, cost: m.purchase_price,
          description: [m.brand, m.model, [m.ram, m.storage].filter(Boolean).join('/'), m.color].filter(Boolean).join(' '), brand: m.brand, imei: [m.imei1, m.imei2].filter(Boolean).join(' / ') });
      } else if (type === 'used') {
        const x = db.get('SELECT * FROM exchanges WHERE id = ?', [id]);
        if (!x) throw new U.AppError('Selected used phone no longer exists.', 'NOT_FOUND');
        if (x.status !== 'available') throw new U.AppError(`${x.brand} ${x.model} (${x.stock_id}) is not available and cannot be sold.`, 'OUT_OF_STOCK');
        lines.push({ type, ref: x, quantity: 1, unit_price: price, unit_cost: x.acquisition_value, line_total: price, cost: x.acquisition_value,
          description: `${x.brand} ${x.model} (Used)`, brand: x.brand, imei: x.imei });
      } else {
        const a = db.get('SELECT * FROM accessories WHERE id = ? AND is_active = 1', [id]);
        if (!a) throw new U.AppError('Selected accessory no longer exists.', 'NOT_FOUND');
        const qty = U.int(it.quantity, 'Quantity', { min: 1, max: 1e6, required: true });
        if (qty > a.quantity) throw new U.AppError(`Only ${a.quantity} of "${a.name}" in stock.`, 'OUT_OF_STOCK');
        lines.push({ type, ref: a, quantity: qty, unit_price: price, unit_cost: a.purchase_price, line_total: R(price * qty), cost: R(a.purchase_price * qty),
          description: a.name, brand: '', imei: '' });
      }
    }
    const discount = R(U.num(d.discount, 'Discount'));
    const preSubtotal = R(lines.reduce((a, l) => a + l.line_total, 0));
    if (discount > preSubtotal + 1e-9) throw new U.AppError('Discount cannot be more than the subtotal.');
    const calc = U.Fmt.calcSale(lines, discount, { enabled: settings.tax_enabled, rate: settings.tax_rate, mode: settings.tax_mode, exempt: !!d.tax_exempt }, dec);

    // Trade-in counts as payment, never above what is owed.
    let tradeValue = 0;
    if (d.trade_in && (d.trade_in.brand || d.trade_in.model || d.trade_in.value)) {
      tradeValue = R(U.num(d.trade_in.value, 'Trade-in value', { required: true }));
      if (!(tradeValue > 0)) throw new U.AppError('Trade-in value must be greater than zero.');
      if (tradeValue > calc.grand_total + 1e-9) throw new U.AppError('Trade-in value cannot be more than the sale total. Buy the phone into used stock separately instead.');
    }
    const received = R(U.num(d.paid, 'Amount received'));
    const moneyDue = R(calc.grand_total - tradeValue);
    const moneyPaid = Math.min(received, moneyDue);   // anything above is change handed back
    const change = R(received - moneyPaid);
    const paid = R(moneyPaid + tradeValue);
    const remaining = R(calc.grand_total - paid);
    if (remaining > 0 && !customerId) throw new U.AppError('Select a customer to sell on credit. Walk-in sales must be paid in full.', 'CREDIT_NEEDS_CUSTOMER');

    const t = U.nowIso();
    const invoiceNo = Settings.nextCode(db, 'invoice_next', settings.invoice_prefix || 'INV-');
    const saleId = db.run(`INSERT INTO sales(invoice_no,customer_id,sale_date,subtotal,discount,tax_label,tax_rate,tax_mode,tax_amount,grand_total,paid_amount,total_cost,profit,payment_method,currency_code,notes,status,is_demo,created_at)
      VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,'completed',?,?)`,
      [invoiceNo, customerId, saleDate, calc.subtotal, calc.discount, calc.tax_mode === 'none' ? '' : settings.tax_label, calc.tax_rate, calc.tax_mode, calc.tax_amount,
        calc.grand_total, paid, calc.total_cost, calc.profit, method, settings.currency_code, notes, demo, t]).id;

    lines.forEach((l, i) => {
      const c = calc.lines[i];
      db.run(`INSERT INTO sale_items(sale_id,item_type,mobile_id,accessory_id,exchange_id,description,brand,imei,quantity,unit_price,unit_cost,line_total,discount_alloc,tax_alloc,profit)
        VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [saleId, l.type, l.type === 'mobile' ? l.ref.id : null, l.type === 'accessory' ? l.ref.id : null, l.type === 'used' ? l.ref.id : null,
          l.description, l.brand, l.imei, l.quantity, l.unit_price, l.unit_cost, c.line_total, c.discount_alloc, c.tax_alloc, c.profit]);
      if (l.type === 'mobile') {
        const r = db.run(`UPDATE mobiles SET status='sold', updated_at=? WHERE id=? AND status='in_stock'`, [t, l.ref.id]);
        if (!r.changes) throw new U.AppError('Mobile is no longer in stock.', 'OUT_OF_STOCK');
        db.run(`INSERT INTO stock_movements(item_type,item_id,movement_type,quantity,balance_after,unit_cost,ref_type,ref_id,note,movement_date,created_at) VALUES('mobile',?,'sale',-1,0,?,'sale',?,?,?,?)`,
          [l.ref.id, l.unit_cost, saleId, invoiceNo, saleDate, t]);
      } else if (l.type === 'used') {
        const r = db.run(`UPDATE exchanges SET status='sold', updated_at=? WHERE id=? AND status='available'`, [t, l.ref.id]);
        if (!r.changes) throw new U.AppError('Used phone is no longer available.', 'OUT_OF_STOCK');
        db.run(`INSERT INTO stock_movements(item_type,item_id,movement_type,quantity,balance_after,unit_cost,ref_type,ref_id,note,movement_date,created_at) VALUES('used',?,'sale',-1,0,?,'sale',?,?,?,?)`,
          [l.ref.id, l.unit_cost, saleId, invoiceNo, saleDate, t]);
      } else {
        const r = db.run('UPDATE accessories SET quantity = quantity - ?, updated_at=? WHERE id=? AND quantity >= ?', [l.quantity, t, l.ref.id, l.quantity]);
        if (!r.changes) throw new U.AppError(`Not enough "${l.ref.name}" in stock.`, 'OUT_OF_STOCK');
        Accessories.move(db, l.ref.id, 'sale', -l.quantity, l.ref.quantity - l.quantity, l.unit_cost, invoiceNo, saleDate, 'sale', saleId);
      }
    });

    if (customerId) db.run(`INSERT INTO customer_ledger(customer_id,entry_date,entry_type,sale_id,description,debit,credit,created_at) VALUES(?,?,?,?,?,?,0,?)`,
      [customerId, saleDate, 'sale', saleId, 'Sale ' + invoiceNo, calc.grand_total, t]);
    const pay = (amount, m, note) => {
      if (!(amount > 0)) return;
      db.run('INSERT INTO sale_payments(sale_id,customer_id,amount,method,payment_date,receipt_no,note,created_at) VALUES(?,?,?,?,?,?,?,?)', [saleId, customerId, amount, m, saleDate, '', note, t]);
      if (customerId) db.run(`INSERT INTO customer_ledger(customer_id,entry_date,entry_type,sale_id,description,debit,credit,method,created_at) VALUES(?,?,?,?,?,0,?,?,?)`,
        [customerId, saleDate, 'payment', saleId, note + ' ' + invoiceNo, amount, m, t]);
    };
    pay(moneyPaid, method, 'Payment at sale');
    let tradeInId = null;
    if (tradeValue > 0) {
      tradeInId = Exchanges.create(db, { ...d.trade_in, acquisition_value: tradeValue, date_received: saleDate, customer_id: customerId }, today, { source_sale_id: saleId, demo });
      pay(tradeValue, 'exchange', 'Trade-in');
    }
    return { id: saleId, invoice_no: invoiceNo, grand_total: calc.grand_total, paid, remaining, change, profit: calc.profit, trade_in_id: tradeInId };
  });
}

function get(db, id) {
  const s = db.get(`SELECT s.*, s.grand_total - s.paid_amount AS remaining, c.name AS customer_name, c.phone_code AS customer_phone_code, c.phone AS customer_phone,
    c.email AS customer_email, c.address AS customer_address FROM sales s LEFT JOIN customers c ON c.id = s.customer_id WHERE s.id = ?`, [U.id(id)]);
  if (!s) throw new U.AppError('Sale not found.', 'NOT_FOUND');
  s.items = db.all('SELECT * FROM sale_items WHERE sale_id = ? ORDER BY id', [s.id]);
  s.payments = db.all('SELECT * FROM sale_payments WHERE sale_id = ? ORDER BY id', [s.id]);
  s.trade_in = db.get('SELECT * FROM exchanges WHERE source_sale_id = ?', [s.id]) || null;
  s.customer_balance = s.customer_id ? Customers.balance(db, s.customer_id) : 0;
  return s;
}
function list(db, f = {}) {
  const where = [], p = [];
  if (f.from) { where.push('s.sale_date >= ?'); p.push(f.from); }
  if (f.to) { where.push('s.sale_date <= ?'); p.push(f.to); }
  if (f.status) { where.push('s.status = ?'); p.push(f.status); }
  if (f.customer_id) { where.push('s.customer_id = ?'); p.push(Number(f.customer_id)); }
  if (f.q) {
    where.push(`(s.invoice_no LIKE ? ESCAPE '\\' OR c.name LIKE ? ESCAPE '\\' OR EXISTS (SELECT 1 FROM sale_items i WHERE i.sale_id = s.id AND (i.description LIKE ? ESCAPE '\\' OR i.imei LIKE ? ESCAPE '\\')))`);
    const q = U.like(f.q); p.push(q, q, q, q);
  }
  return db.all(`SELECT s.*, s.grand_total - s.paid_amount AS remaining, c.name AS customer_name,
      (SELECT group_concat(CASE WHEN i.quantity > 1 THEN i.quantity || ' × ' ELSE '' END || i.description, ', ') FROM sale_items i WHERE i.sale_id = s.id) AS items_summary
    FROM sales s LEFT JOIN customers c ON c.id = s.customer_id ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
    ORDER BY s.sale_date DESC, s.id DESC LIMIT ${Math.min(Number(f.limit) || 20000, 50000)}`, p);
}

/**
 * Controlled administrative reversal. The sale row is kept (status = voided) with a reason,
 * stock is returned, and the customer's balance is reversed. Nothing is deleted.
 */
function voidSale(db, d, today) {
  const id = U.id(d.id);
  const reason = U.str(d.reason, 'Reason', { required: true, max: 300 });
  Settings.requireAdmin(db, d.password);
  return db.tx(() => {
    const s = db.get('SELECT * FROM sales WHERE id = ?', [id]);
    if (!s) throw new U.AppError('Sale not found.', 'NOT_FOUND');
    if (s.status === 'voided') throw new U.AppError('This sale has already been voided.');
    const t = U.nowIso();
    const trade = db.get('SELECT * FROM exchanges WHERE source_sale_id = ?', [id]);
    if (trade && trade.status === 'sold') throw new U.AppError('The trade-in phone from this sale has already been resold, so the sale cannot be voided.');
    for (const i of db.all('SELECT * FROM sale_items WHERE sale_id = ?', [id])) {
      if (i.item_type === 'mobile') {
        db.run(`UPDATE mobiles SET status='in_stock', updated_at=? WHERE id=?`, [t, i.mobile_id]);
        db.run(`INSERT INTO stock_movements(item_type,item_id,movement_type,quantity,balance_after,ref_type,ref_id,note,movement_date,created_at) VALUES('mobile',?,'void',1,1,'sale',?,?,?,?)`, [i.mobile_id, id, 'Sale voided: ' + s.invoice_no, today, t]);
      } else if (i.item_type === 'used') {
        db.run(`UPDATE exchanges SET status='available', updated_at=? WHERE id=?`, [t, i.exchange_id]);
        db.run(`INSERT INTO stock_movements(item_type,item_id,movement_type,quantity,balance_after,ref_type,ref_id,note,movement_date,created_at) VALUES('used',?,'void',1,1,'sale',?,?,?,?)`, [i.exchange_id, id, 'Sale voided: ' + s.invoice_no, today, t]);
      } else {
        db.run('UPDATE accessories SET quantity = quantity + ?, updated_at=? WHERE id=?', [i.quantity, t, i.accessory_id]);
        const q = db.get('SELECT quantity FROM accessories WHERE id=?', [i.accessory_id]).quantity;
        Accessories.move(db, i.accessory_id, 'void', i.quantity, q, i.unit_cost, 'Sale voided: ' + s.invoice_no, today, 'sale', id);
      }
    }
    if (trade) db.run(`UPDATE exchanges SET status='returned', notes = trim(notes || ' [Returned to customer: sale voided]'), updated_at=? WHERE id=?`, [t, trade.id]);
    if (s.customer_id) {
      // Reverse the charge and the payments already received (refunded to the customer).
      db.run(`INSERT INTO customer_ledger(customer_id,entry_date,entry_type,sale_id,description,debit,credit,created_at) VALUES(?,?,?,?,?,?,?,?)`,
        [s.customer_id, today, 'void', id, `Sale ${s.invoice_no} voided: ${reason}`, s.paid_amount, s.grand_total, t]);
    }
    db.run(`UPDATE sales SET status='voided', void_reason=?, voided_at=? WHERE id=?`, [reason, t, id]);
    return { id, refunded: s.paid_amount };
  });
}

module.exports = { create, get, list, voidSale };
