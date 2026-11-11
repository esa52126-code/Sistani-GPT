'use strict';
App.pages.dashboard = {
  title: 'Dashboard', icon: 'dashboard',
  async render(root) {
    const body = h('div');
    let range;
    const load = async () => {
      const r = range.value();
      const t0 = today();
      const [y, m] = t0.split('-').map(Number);
      const start = new Date(Date.UTC(y, m - 12, 1));
      const chartFrom = `${start.getUTCFullYear()}-${String(start.getUTCMonth() + 1).padStart(2, '0')}-01`;
      let d;
      try { d = await api('reports:dashboard', { from: r.from, to: r.to, prev: Fmt.previousRange(r), chartFrom }); } catch (e) { return fail(e); }
      const c = d.current, p = d.previous;
      const delta = (a, b) => { if (!p || !b) return null; const pc = (a - b) / Math.abs(b) * 100; return h('span', null, h('span', { class: 'delta ' + (pc >= 0 ? 'up' : 'down') }, (pc >= 0 ? '▲ ' : '▼ ') + numf(Math.abs(pc), 0) + '%'), ' ' + t('vs previous period')); };
      const isToday = r.preset === 'today';
      const L = s => isToday ? t("Today's " + s) : t(s.charAt(0).toUpperCase() + s.slice(1));
      const months = []; for (let i = 0; i < 12; i++) { const dt = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + i, 1)); months.push(`${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}`); }
      const mv = k => months.map(mo => { const x = d.monthly.find(q => q.month === mo); return x ? x[k] : 0; });
      const mLabels = months.map(mo => t(Fmt.MONTHS[+mo.slice(5) - 1]));
      const series = [{ name: t('Sales'), color: Charts.COLORS.blue, values: mv('sales') }];
      const pSeries = [{ name: t('Gross profit'), color: Charts.COLORS.green, values: mv('profit') }];
      const typeLabel = { mobile: t('New mobiles'), accessory: t('Accessories'), used: t('Used phones') };
      body.replaceChildren(
        h('div', { class: 'stats' },
          statCard(L('sales'), money(c.sales), { ico: 'cart', sub: delta(c.sales, p && p.sales) || t('{n} transactions', { n: c.transactions }) }),
          statCard(L('profit'), money(c.profit), { ico: 'trend', color: 'green', sub: delta(c.profit, p && p.profit) || t('Gross profit before expenses') }),
          statCard(L('expenses'), money(c.expenses), { ico: 'wallet', color: 'amber', sub: t('Business expenses') }),
          statCard(L('net profit'), money(c.net_profit), { ico: 'cash', color: c.net_profit < 0 ? 'red' : 'green', sub: t('Gross profit − expenses') })),
        h('div', { class: 'stats' },
          statCard(t('Mobile stock'), numf(d.stock.mobiles.n), { ico: 'phone', color: 'slate', sub: t('Value {v}', { v: money(d.stock.mobiles.value) }) + (d.stock.used.n ? ' · ' + t('{n} used', { n: d.stock.used.n }) : '') }),
          statCard(t('Accessory stock'), numf(d.stock.accessories.n), { ico: 'headphones', color: 'slate', sub: t('{n} products · value {v}', { n: d.stock.accessories.products, v: money(d.stock.accessories.value) }) }),
          statCard(t('Transactions'), numf(c.transactions), { ico: 'receipt', color: 'slate', sub: t('Cash received {v}', { v: money(c.cash_received) }) }),
          statCard(t('Outstanding credit'), money(d.credit_total), { ico: 'book', color: d.credit_total > 0 ? 'red' : 'slate', sub: t('{n} customers owe money', { n: d.credit_customers }) })),
        h('div', { class: 'grid g2', style: { marginBottom: '14px' } },
          h('div', { class: 'card' }, h('div', { class: 'hd' }, h('div', null, h('h3', null, t('Monthly sales')), h('p', null, t('Last 12 months')))), h('div', { class: 'bd' }, Charts.bars(mLabels, series))),
          h('div', { class: 'card' }, h('div', { class: 'hd' }, h('div', null, h('h3', null, t('Monthly profit')), h('p', null, t('Gross profit, last 12 months')))), h('div', { class: 'bd' }, Charts.bars(mLabels, pSeries)))),
        h('div', { class: 'grid', style: { gridTemplateColumns: 'minmax(0,2fr) minmax(0,1fr)', marginBottom: '14px' } },
          h('div', { class: 'card' }, h('div', { class: 'hd' }, h('h3', null, t('Recent transactions')), btn(t('View all'), null, 'sm ghost', () => navigate('sales'))),
            h('div', { class: 'table-wrap' }, h('table', { class: 'tbl' }, h('thead', null, h('tr', null, [t('Invoice'), t('Customer'), t('Items'), t('Date')].map(x => h('th', null, x)), h('th', { class: 'num' }, t('Total')), h('th', { class: 'num' }, t('Remaining')))),
              h('tbody', null, d.recent.length ? d.recent.map(s => { const tr = h('tr', { class: 'click' }, h('td', null, h('b', null, s.invoice_no), s.status === 'voided' ? [' ', statusBadge('voided')] : null), h('td', null, s.customer_name || t('Walk-in customer')),
                h('td', { style: { maxWidth: '240px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }, title: s.items_summary || '' }, s.items_summary || ''), h('td', { class: 'nowrap' }, fdate(s.sale_date)), h('td', { class: 'num' }, money(s.grand_total)),
                h('td', { class: 'num' }, s.remaining > 0 && s.status !== 'voided' ? badge(money(s.remaining), 'red') : badge(t('Paid'), 'green'))); tr.addEventListener('click', () => Docs.showInvoice(s.id).catch(fail)); return tr; })
                : h('tr', null, h('td', { colspan: 6 }, h('div', { class: 'empty' }, icon('receipt'), h('b', null, t('No sales yet')), t('Completed sales will appear here.')))))))),
          h('div', { class: 'col', style: { gap: '14px' } },
            h('div', { class: 'card' }, h('div', { class: 'hd' }, h('div', null, h('h3', null, t('Sales performance')), h('p', null, t('Selected period, by product type')))), h('div', { class: 'bd' },
              Charts.hbars(['mobile', 'accessory', 'used'].map(k => ({ label: typeLabel[k], value: (d.byType.find(b => b.type === k) || {}).sales || 0 }))),
              h('div', { style: { height: '10px' } }), h('div', { class: 'small muted', style: { marginBottom: '4px' } }, t('Payments received by method')),
              Charts.hbars(d.byMethod.map(b => ({ label: label(Const.PAYMENT_METHOD_LABELS, b.method), value: b.amount, color: Charts.COLORS.green }))))),
            h('div', { class: 'card' }, h('div', { class: 'hd' }, h('h3', null, t('Low-stock products')), d.low_stock_count ? badge(String(d.low_stock_count), 'amber') : null),
              h('div', null, d.low_stock.length ? d.low_stock.map(a => h('div', { class: 'row between', style: { padding: '9px 16px', borderBottom: '1px solid var(--line-2)' } }, h('div', null, h('div', { style: { fontWeight: 600 } }, a.name), h('div', { class: 'small muted' }, a.sku)),
                badge(a.quantity === 0 ? t('Out of stock') : t('{n} left', { n: a.quantity }), a.quantity === 0 ? 'red' : 'amber'))) : h('div', { class: 'empty', style: { padding: '22px' } }, t('All products are above their minimum level.')))))));
    };
    range = rangePicker('today', load);
    root.append(pageHead(t('Dashboard'), t('Live overview of {shop}', { shop: App.settings.shop_name }), range.el, btn(t('New Sale'), 'plus', 'primary', () => navigate('newsale'))), body);
    await load();
  },
};
