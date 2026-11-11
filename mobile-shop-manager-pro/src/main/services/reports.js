'use strict';
const U = require('./util');
const Customers = require('./customers');
const Accessories = require('./accessories');

const OK = `s.status = 'completed'`;

function totals(db, from, to) {
  const s = db.get(`SELECT COALESCE(SUM(grand_total),0) AS sales, COALESCE(SUM(profit),0) AS profit, COALESCE(SUM(tax_amount),0) AS tax,
    COALESCE(SUM(discount),0) AS discount, COUNT(*) AS transactions FROM sales s WHERE ${OK} AND sale_date BETWEEN ? AND ?`, [from, to]);
  const e = db.get('SELECT COALESCE(SUM(amount),0) AS t FROM expenses WHERE expense_date BETWEEN ? AND ?', [from, to]).t;
  const cash = db.get(`SELECT COALESCE(SUM(p.amount),0) AS t FROM sale_payments p JOIN sales s ON s.id = p.sale_id WHERE ${OK} AND p.method <> 'exchange' AND p.payment_date BETWEEN ? AND ?`, [from, to]).t;
  return { sales: s.sales, profit: s.profit, tax: s.tax, discount: s.discount, transactions: s.transactions, expenses: e, net_profit: s.profit - e, cash_received: cash };
}

/** d: { from, to, prev:{from,to}, today, chartFrom } – all dates are business dates supplied by the caller. */
function dashboard(db, d) {
  const from = U.date(d.from, 'From', { required: true }), to = U.date(d.to, 'To', { required: true });
  const cur = totals(db, from, to);
  const prev = d.prev ? totals(db, U.date(d.prev.from, 'From'), U.date(d.prev.to, 'To')) : null;
  const todayT = totals(db, d.today, d.today);
  const stock = {
    mobiles: db.get(`SELECT COUNT(*) AS n, COALESCE(SUM(purchase_price),0) AS value FROM mobiles WHERE status = 'in_stock'`),
    accessories: db.get(`SELECT COALESCE(SUM(quantity),0) AS n, COUNT(*) AS products, COALESCE(SUM(quantity * purchase_price),0) AS value FROM accessories WHERE is_active = 1`),
    used: db.get(`SELECT COUNT(*) AS n, COALESCE(SUM(acquisition_value),0) AS value FROM exchanges WHERE status = 'available'`),
  };
  const credit = Customers.creditBook(db);
  const monthly = db.all(`SELECT substr(sale_date,1,7) AS month, SUM(grand_total) AS sales, SUM(profit) AS profit, COUNT(*) AS n FROM sales s
    WHERE ${OK} AND sale_date >= ? GROUP BY 1 ORDER BY 1`, [d.chartFrom]);
  const monthlyExpenses = db.all('SELECT substr(expense_date,1,7) AS month, SUM(amount) AS expenses FROM expenses WHERE expense_date >= ? GROUP BY 1', [d.chartFrom]);
  const daily = db.all(`SELECT sale_date AS day, SUM(grand_total) AS sales, SUM(profit) AS profit FROM sales s WHERE ${OK} AND sale_date BETWEEN ? AND ? GROUP BY 1 ORDER BY 1`, [from, to]);
  const byType = db.all(`SELECT i.item_type AS type, SUM(i.line_total - i.discount_alloc) AS sales, SUM(i.profit) AS profit, SUM(i.quantity) AS units
    FROM sale_items i JOIN sales s ON s.id = i.sale_id WHERE ${OK} AND s.sale_date BETWEEN ? AND ? GROUP BY 1`, [from, to]);
  const byMethod = db.all(`SELECT p.method, SUM(p.amount) AS amount FROM sale_payments p JOIN sales s ON s.id = p.sale_id WHERE ${OK} AND p.payment_date BETWEEN ? AND ? GROUP BY 1 ORDER BY 2 DESC`, [from, to]);
  const recent = db.all(`SELECT s.id, s.invoice_no, s.sale_date, s.grand_total, s.paid_amount, s.grand_total - s.paid_amount AS remaining, s.profit, s.status, c.name AS customer_name,
      (SELECT group_concat(i.description, ', ') FROM sale_items i WHERE i.sale_id = s.id) AS items_summary
    FROM sales s LEFT JOIN customers c ON c.id = s.customer_id ORDER BY s.id DESC LIMIT 8`);
  return { range: { from, to }, current: cur, previous: prev, today: todayT, stock, credit_total: credit.total, credit_customers: credit.customers.length,
    low_stock: Accessories.lowStock(db).slice(0, 8), low_stock_count: Accessories.lowStock(db).length, monthly, monthlyExpenses, daily, byType, byMethod, recent };
}

const col = (key, label, type = 'text') => ({ key, label, type });
const REPORTS = {
  sales: { title: 'Sales report', ranged: true, run(db, f, t) {
    const rows = db.all(`SELECT s.sale_date, s.invoice_no, COALESCE(c.name,'Walk-in customer') AS customer,
      (SELECT group_concat(i.description, ', ') FROM sale_items i WHERE i.sale_id = s.id) AS items,
      s.subtotal, s.discount, s.tax_amount, s.grand_total, s.paid_amount, s.grand_total - s.paid_amount AS remaining, s.profit
      FROM sales s LEFT JOIN customers c ON c.id = s.customer_id WHERE ${OK} AND s.sale_date BETWEEN ? AND ? ORDER BY s.sale_date, s.id`, [f, t]);
    return { columns: [col('sale_date', 'Date', 'date'), col('invoice_no', 'Invoice'), col('customer', 'Customer'), col('items', 'Items'), col('subtotal', 'Subtotal', 'money'),
      col('discount', 'Discount', 'money'), col('tax_amount', 'Tax', 'money'), col('grand_total', 'Total', 'money'), col('paid_amount', 'Paid', 'money'), col('remaining', 'Remaining', 'money'), col('profit', 'Profit', 'money')], rows };
  } },
  sales_by_day: { title: 'Daily sales summary', ranged: true, run(db, f, t) { return grouped(db, f, t, 'sale_date', 'expense_date', 'date', 'Date'); } },
  sales_by_month: { title: 'Monthly sales summary', ranged: true, run(db, f, t) { return grouped(db, f, t, 'substr(sale_date,1,7)', 'substr(expense_date,1,7)', 'text', 'Month'); } },
  sales_by_year: { title: 'Yearly sales summary', ranged: true, run(db, f, t) { return grouped(db, f, t, 'substr(sale_date,1,4)', 'substr(expense_date,1,4)', 'text', 'Year'); } },
  profit: { title: 'Profit & loss summary', ranged: true, run(db, f, t) {
    const x = totals(db, f, t);
    const byType = db.all(`SELECT i.item_type AS type, SUM(i.line_total - i.discount_alloc - i.tax_alloc) AS revenue, SUM(i.unit_cost * i.quantity) AS cost, SUM(i.profit) AS profit
      FROM sale_items i JOIN sales s ON s.id = i.sale_id WHERE ${OK} AND s.sale_date BETWEEN ? AND ? GROUP BY 1`, [f, t]);
    const label = { mobile: 'New mobiles', accessory: 'Accessories', used: 'Used / exchange phones' };
    const rows = ['mobile', 'accessory', 'used'].map(k => { const r = byType.find(b => b.type === k) || {}; return { line: label[k], revenue: r.revenue || 0, cost: r.cost || 0, amount: r.profit || 0 }; });
    rows.push({ line: 'Gross profit', revenue: null, cost: null, amount: x.profit, bold: true });
    for (const e of db.all('SELECT category, SUM(amount) AS a FROM expenses WHERE expense_date BETWEEN ? AND ? GROUP BY 1 ORDER BY 2 DESC', [f, t]))
      rows.push({ line: 'Expense: ' + e.category, revenue: null, cost: e.a, amount: -e.a });
    rows.push({ line: 'Total business expenses', revenue: null, cost: x.expenses, amount: -x.expenses, bold: true });
    rows.push({ line: 'Net profit', revenue: null, cost: null, amount: x.net_profit, bold: true });
    return { columns: [col('line', 'Line'), col('revenue', 'Revenue (ex. tax)', 'money'), col('cost', 'Cost', 'money'), col('amount', 'Profit / (loss)', 'money')], rows, noTotals: true };
  } },
  expenses: { title: 'Expenses report', ranged: true, run(db, f, t) {
    return { columns: [col('expense_date', 'Date', 'date'), col('category', 'Category', 'expense_category'), col('description', 'Description'), col('payment_method', 'Payment method', 'method'), col('amount', 'Amount', 'money')],
      rows: db.all('SELECT * FROM expenses WHERE expense_date BETWEEN ? AND ? ORDER BY expense_date, id', [f, t]) };
  } },
  mobile_inventory: { title: 'Mobile inventory', run(db) {
    return { columns: [col('stock_id', 'Stock ID'), col('brand', 'Brand'), col('model', 'Model'), col('variant', 'RAM / Storage'), col('color', 'Color'), col('imei1', 'IMEI 1'), col('imei2', 'IMEI 2'),
      col('status', 'Status', 'mobile_status'), col('purchase_price', 'Purchase price', 'money'), col('selling_price', 'Selling price', 'money')],
      rows: db.all(`SELECT *, trim(ram || ' / ' || storage, ' /') AS variant FROM mobiles WHERE status = 'in_stock' ORDER BY brand, model`) };
  } },
  accessories_inventory: { title: 'Accessories inventory', run(db) {
    return { columns: [col('sku', 'SKU'), col('name', 'Product'), col('category', 'Category', 'accessory_category'), col('quantity', 'Quantity', 'number'), col('min_stock', 'Min. level', 'number'),
      col('purchase_price', 'Unit cost', 'money'), col('selling_price', 'Selling price', 'money'), col('stock_value', 'Stock value', 'money')],
      rows: db.all('SELECT *, quantity * purchase_price AS stock_value FROM accessories WHERE is_active = 1 ORDER BY name COLLATE NOCASE'), sumOnly: ['quantity', 'stock_value'] };
  } },
  low_stock: { title: 'Low-stock products', run(db) {
    return { columns: [col('sku', 'SKU'), col('name', 'Product'), col('category', 'Category', 'accessory_category'), col('quantity', 'Quantity', 'number'), col('min_stock', 'Min. level', 'number'), col('supplier_name', 'Supplier')],
      rows: Accessories.lowStock(db), noTotals: true };
  } },
  customer_credit: { title: 'Customer credit', run(db) {
    return { columns: [col('name', 'Customer'), col('phone_full', 'Phone'), col('total_purchases', 'Total purchases', 'money'), col('total_paid', 'Total paid', 'money'), col('balance', 'Outstanding', 'money'), col('last_entry', 'Last transaction', 'date')],
      rows: Customers.creditBook(db).customers.map(c => ({ ...c, phone_full: (c.phone_code + ' ' + c.phone).trim() })) };
  } },
  best_sellers: { title: 'Best-selling products', ranged: true, run(db, f, t) {
    return { columns: [col('product', 'Product'), col('type', 'Type', 'item_type'), col('units', 'Units sold', 'number'), col('sales', 'Sales', 'money'), col('profit', 'Profit', 'money')],
      rows: db.all(`SELECT CASE WHEN i.item_type = 'accessory' THEN i.description ELSE COALESCE(m.brand || ' ' || m.model, x.brand || ' ' || x.model || ' (Used)', i.description) END AS product,
        i.item_type AS type, SUM(i.quantity) AS units, SUM(i.line_total - i.discount_alloc) AS sales, SUM(i.profit) AS profit
        FROM sale_items i JOIN sales s ON s.id = i.sale_id LEFT JOIN mobiles m ON m.id = i.mobile_id LEFT JOIN exchanges x ON x.id = i.exchange_id
        WHERE ${OK} AND s.sale_date BETWEEN ? AND ? GROUP BY 1, 2 ORDER BY units DESC, sales DESC LIMIT 100`, [f, t]) };
  } },
  sales_by_brand: { title: 'Sales by brand', ranged: true, run(db, f, t) {
    return { columns: [col('brand', 'Brand'), col('units', 'Phones sold', 'number'), col('sales', 'Sales', 'money'), col('profit', 'Profit', 'money')],
      rows: db.all(`SELECT i.brand, SUM(i.quantity) AS units, SUM(i.line_total - i.discount_alloc) AS sales, SUM(i.profit) AS profit FROM sale_items i JOIN sales s ON s.id = i.sale_id
        WHERE ${OK} AND i.item_type IN ('mobile','used') AND s.sale_date BETWEEN ? AND ? GROUP BY i.brand COLLATE NOCASE ORDER BY sales DESC`, [f, t]) };
  } },
  supplier_purchases: { title: 'Supplier purchases', ranged: true, run(db, f, t) {
    return { columns: [col('name', 'Supplier'), col('company', 'Company'), col('purchases', 'Purchases', 'money'), col('paid', 'Paid', 'money'), col('payable', 'Payable (all time)', 'money')],
      rows: db.all(`SELECT s.name, s.company, COALESCE(SUM(CASE WHEN l.entry_date BETWEEN ? AND ? THEN l.debit END),0) AS purchases,
        COALESCE(SUM(CASE WHEN l.entry_date BETWEEN ? AND ? THEN l.credit END),0) AS paid, COALESCE(SUM(l.debit),0) - COALESCE(SUM(l.credit),0) AS payable
        FROM suppliers s LEFT JOIN supplier_ledger l ON l.supplier_id = s.id GROUP BY s.id ORDER BY purchases DESC`, [f, t, f, t]) };
  } },
};
function grouped(db, f, t, saleExpr, expExpr, type, label) {
  const rows = db.all(`SELECT ${saleExpr} AS period, COUNT(*) AS transactions, SUM(grand_total) AS sales, SUM(tax_amount) AS tax, SUM(profit) AS gross_profit FROM sales s
    WHERE ${OK} AND sale_date BETWEEN ? AND ? GROUP BY 1`, [f, t]);
  const map = new Map(rows.map(r => [r.period, { ...r, expenses: 0 }]));
  for (const e of db.all(`SELECT ${expExpr} AS period, SUM(amount) AS expenses FROM expenses WHERE expense_date BETWEEN ? AND ? GROUP BY 1`, [f, t])) {
    if (!map.has(e.period)) map.set(e.period, { period: e.period, transactions: 0, sales: 0, tax: 0, gross_profit: 0, expenses: 0 });
    map.get(e.period).expenses = e.expenses;
  }
  const out = [...map.values()].sort((a, b) => a.period < b.period ? -1 : 1).map(r => ({ ...r, net_profit: r.gross_profit - r.expenses }));
  return { columns: [col('period', label, type), col('transactions', 'Transactions', 'number'), col('sales', 'Sales', 'money'), col('tax', 'Tax', 'money'),
    col('gross_profit', 'Gross profit', 'money'), col('expenses', 'Expenses', 'money'), col('net_profit', 'Net profit', 'money')], rows: out };
}
function run(db, d) {
  const def = REPORTS[d && d.name];
  if (!def) throw new U.AppError('Unknown report.');
  const from = U.date(d.from, 'From') || '0001-01-01', to = U.date(d.to, 'To') || '9999-12-31';
  if (from > to) throw new U.AppError('The start date must be before the end date.');
  const r = def.run(db, from, to);
  return { name: d.name, title: def.title, ranged: !!def.ranged, from, to, ...r };
}
function catalog() { return Object.entries(REPORTS).map(([name, r]) => ({ name, title: r.title, ranged: !!r.ranged })); }

module.exports = { dashboard, totals, run, catalog };
