'use strict';
const U = require('./util');
const Mobiles = require('./mobiles');
const Accessories = require('./accessories');
const Customers = require('./customers');
const Suppliers = require('./suppliers');

function cell(v) {
  if (v == null) return '';
  let s = String(v);
  if (/^[=+\-@\t\r]/.test(s) && isNaN(Number(s))) s = "'" + s;   // neutralise spreadsheet formulas
  return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}
/** rows: array of objects; columns: [{key,label}] (defaults to all keys). UTF-8 with BOM for Excel. */
function toCsv(rows, columns) {
  const cols = columns || (rows[0] ? Object.keys(rows[0]).map(k => ({ key: k, label: k })) : []);
  const lines = [cols.map(c => cell(c.label)).join(',')];
  for (const r of rows) lines.push(cols.map(c => cell(r[c.key])).join(','));
  return '﻿' + lines.join('\r\n') + '\r\n';
}
function parse(text) {
  const src = String(text || '').replace(/^﻿/, '');
  const rows = []; let row = [], cur = '', q = false;
  const delim = (src.split(/\r?\n/)[0].match(/;/g) || []).length > (src.split(/\r?\n/)[0].match(/,/g) || []).length ? ';' : ',';
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (q) { if (ch === '"') { if (src[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += ch; }
    else if (ch === '"') q = true;
    else if (ch === delim) { row.push(cur); cur = ''; }
    else if (ch === '\n' || ch === '\r') { if (ch === '\r' && src[i + 1] === '\n') i++; row.push(cur); cur = ''; if (row.some(c => c.trim() !== '')) rows.push(row); row = []; }
    else cur += ch;
  }
  row.push(cur); if (row.some(c => c.trim() !== '')) rows.push(row);
  if (!rows.length) return [];
  const head = rows[0].map(h => h.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, ''));
  return rows.slice(1).map(r => Object.fromEntries(head.map((h, i) => [h, (r[i] || '').trim().replace(/^'(?=[=+\-@])/, '')])));
}

const IMPORTERS = {
  mobiles: { columns: ['brand', 'model', 'ram', 'storage', 'color', 'imei1', 'imei2', 'purchase_price', 'selling_price', 'purchase_date', 'warranty', 'notes'],
    sample: ['Samsung', 'Galaxy A55', '8GB', '256GB', 'Navy', '356789104523871', '', '320', '389', '2026-01-15', '12 months', ''],
    add: (db, r, today) => Mobiles.create(db, { ...r, imei1: r.imei1 || r.imei || r.imei_1, imei2: r.imei2 || r.imei_2 }, today) },
  accessories: { columns: ['name', 'category', 'sku', 'purchase_price', 'selling_price', 'quantity', 'min_stock', 'notes'],
    sample: ['USB-C Fast Charger 25W', 'chargers', 'CHG-25W', '6', '15', '20', '5', ''],
    add: (db, r, today) => Accessories.create(db, { ...r, name: r.name || r.product_name, category: (r.category || 'other').toLowerCase().replace(/\s+/g, '_') }, today) },
  customers: { columns: ['name', 'phone_code', 'phone', 'email', 'address', 'country', 'notes'],
    sample: ['Alex Morgan', '+1', '5550142', 'alex@example.com', '12 Market Street', 'US', ''],
    add: (db, r) => Customers.create(db, { ...r, name: r.name || r.customer_name }) },
  suppliers: { columns: ['name', 'phone', 'email', 'company', 'address', 'notes'],
    sample: ['Jordan Lee', '+44 20 5550 0199', 'sales@example.com', 'Northline Distribution', '', ''],
    add: (db, r) => Suppliers.create(db, { ...r, name: r.name || r.supplier_name }) },
};
function template(entity) {
  const imp = IMPORTERS[entity];
  if (!imp) throw new U.AppError('Unsupported import type.');
  return imp.columns.join(',') + '\r\n' + imp.sample.map(cell).join(',') + '\r\n';
}
/** Imports row by row; bad rows are skipped and reported, good rows are kept. */
function importCsv(db, entity, text, today) {
  const imp = IMPORTERS[entity];
  if (!imp) throw new U.AppError('Unsupported import type.');
  const rows = parse(text);
  if (!rows.length) throw new U.AppError('The file has no data rows.');
  if (rows.length > 20000) throw new U.AppError('The file has too many rows (maximum 20,000 per import).');
  const errors = []; let imported = 0;
  db.tx(() => {
    rows.forEach((r, i) => {
      db.exec('SAVEPOINT imp');
      try { imp.add(db, r, today); db.exec('RELEASE imp'); imported++; }
      catch (e) { db.exec('ROLLBACK TO imp'); db.exec('RELEASE imp'); errors.push({ row: i + 2, message: e.isAppError ? e.message : 'Invalid data' }); }
    });
  });
  return { imported, skipped: errors.length, errors: errors.slice(0, 50) };
}
const EXPORT_TABLES = ['mobiles', 'accessories', 'customers', 'suppliers', 'sales', 'sale_items', 'sale_payments', 'expenses', 'exchanges', 'customer_ledger', 'supplier_ledger', 'stock_movements'];
function exportTable(db, table) {
  if (!EXPORT_TABLES.includes(table)) throw new U.AppError('Unsupported export table.');
  return toCsv(db.all(`SELECT * FROM ${table}`));
}
module.exports = { toCsv, parse, template, importCsv, exportTable, EXPORT_TABLES, IMPORTERS };
