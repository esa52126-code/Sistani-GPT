'use strict';
const U = require('./util');

/** Global search across the whole shop. Returns small, grouped result sets. */
function search(db, query) {
  const text = String(query || '').trim();
  if (text.length < 2) return [];
  const q = U.like(text), E = `ESCAPE '\\'`, out = [];
  const add = (group, page, rows) => rows.forEach(r => out.push({ group, page, ...r }));
  add('Mobiles', 'mobiles', db.all(`SELECT id, brand || ' ' || model AS title, stock_id || ' · IMEI ' || imei1 AS subtitle, status AS badge FROM mobiles
    WHERE brand LIKE ? ${E} OR model LIKE ? ${E} OR (brand || ' ' || model) LIKE ? ${E} OR imei1 LIKE ? ${E} OR imei2 LIKE ? ${E} OR stock_id LIKE ? ${E} ORDER BY id DESC LIMIT 8`, [q, q, q, q, q, q]));
  add('Used stock', 'exchanges', db.all(`SELECT id, brand || ' ' || model AS title, stock_id || CASE WHEN imei <> '' THEN ' · IMEI ' || imei ELSE '' END AS subtitle, status AS badge FROM exchanges
    WHERE brand LIKE ? ${E} OR model LIKE ? ${E} OR imei LIKE ? ${E} OR stock_id LIKE ? ${E} ORDER BY id DESC LIMIT 6`, [q, q, q, q]));
  add('Accessories', 'accessories', db.all(`SELECT id, name AS title, sku || ' · Qty ' || quantity AS subtitle, '' AS badge FROM accessories
    WHERE is_active = 1 AND (name LIKE ? ${E} OR sku LIKE ? ${E}) ORDER BY name LIMIT 6`, [q, q]));
  add('Customers', 'customers', db.all(`SELECT id, name AS title, trim(phone_code || ' ' || phone || CASE WHEN email <> '' THEN ' · ' || email ELSE '' END) AS subtitle, '' AS badge FROM customers
    WHERE name LIKE ? ${E} OR phone LIKE ? ${E} OR (phone_code || phone) LIKE ? ${E} OR email LIKE ? ${E} ORDER BY name LIMIT 6`, [q, q, U.like(text.replace(/\s/g, '')), q]));
  add('Invoices', 'sales', db.all(`SELECT s.id, s.invoice_no AS title, COALESCE(c.name, 'Walk-in customer') || ' · ' || s.sale_date AS subtitle, s.status AS badge FROM sales s LEFT JOIN customers c ON c.id = s.customer_id
    WHERE s.invoice_no LIKE ? ${E} OR EXISTS (SELECT 1 FROM sale_items i WHERE i.sale_id = s.id AND i.imei LIKE ? ${E}) ORDER BY s.id DESC LIMIT 6`, [q, q]));
  add('Suppliers', 'suppliers', db.all(`SELECT id, name AS title, trim(company || ' ' || phone) AS subtitle, '' AS badge FROM suppliers
    WHERE name LIKE ? ${E} OR company LIKE ? ${E} OR phone LIKE ? ${E} OR email LIKE ? ${E} ORDER BY name LIMIT 5`, [q, q, q, q]));
  return out;
}
module.exports = { search };
