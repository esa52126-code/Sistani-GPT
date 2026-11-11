'use strict';
App.pages.reports = {
  title: 'Reports', icon: 'chart',
  async render(root, params) {
    const catalog = await api('reports:catalog');
    const GROUPS = [[t('Sales'), ['sales', 'sales_by_day', 'sales_by_month', 'sales_by_year', 'best_sellers', 'sales_by_brand']], [t('Profit & expenses'), ['profit', 'expenses']],
      [t('Inventory'), ['mobile_inventory', 'accessories_inventory', 'low_stock']], [t('Customers & suppliers'), ['customer_credit', 'supplier_purchases']]];
    let current = (params && params.name) || 'sales', range, data = null;
    const menu = h('div', { class: 'card', style: { padding: '8px', alignSelf: 'start' } }), out = h('div', { style: { minWidth: 0 } });
    const fmtCell = (c, v) => { if (v == null) return ''; switch (c.type) {
      case 'money': return money(v); case 'number': return numf(v); case 'date': return fdate(v);
      case 'method': return label(Const.PAYMENT_METHOD_LABELS, v); case 'expense_category': return label(Const.EXPENSE_CATEGORY_LABELS, v); case 'accessory_category': return label(Const.ACCESSORY_CATEGORY_LABELS, v);
      case 'mobile_status': return label(Const.MOBILE_STATUS_LABELS, v); case 'item_type': return t({ mobile: 'New mobile', accessory: 'Accessory', used: 'Used phone' }[v] || v);
      default: return String(v).startsWith('Expense: ') ? t('Expense') + ': ' + label(Const.EXPENSE_CATEGORY_LABELS, String(v).slice(9)) : t(String(v)); } };
    const isNum = c => c.type === 'money' || c.type === 'number';
    const totalsOf = d => { if (d.noTotals || !d.rows.length) return null; let any = false;
      const cells = d.columns.map((c, i) => { if (i === 0) return t('Total'); if (isNum(c) && (!d.sumOnly || d.sumOnly.includes(c.key)) && !/price|min_stock|unit/.test(c.key)) { any = true; const s = d.rows.reduce((a, r) => a + (Number(r[c.key]) || 0), 0); return c.type === 'money' ? money(s) : numf(s); } return ''; });
      return any ? cells : null; };
    const period = d => !d.ranged ? '' : d.from <= '0001-01-01' ? t('All time') : d.from === d.to ? fdate(d.from) : `${fdate(d.from)} – ${fdate(d.to)}`;
    const drawMenu = () => menu.replaceChildren(...GROUPS.flatMap(([g, names]) => [h('div', { class: 'small muted', style: { padding: '8px 10px 4px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em', fontSize: '11px' } }, g),
      ...names.map(n => { const r = catalog.find(c => c.name === n); return h('button', { class: 'btn ghost', style: { width: '100%', justifyContent: 'flex-start', background: n === current ? 'var(--blue-l)' : '', color: n === current ? 'var(--blue-d)' : '' }, onclick: () => { current = n; drawMenu(); load(); } }, t(r.title)); })]));
    const load = async () => {
      const def = catalog.find(c => c.name === current), r = range.value();
      range.el.classList.toggle('hidden', !def.ranged);
      try { data = await api('reports:run', { name: current, from: def.ranged ? r.from : undefined, to: def.ranged ? r.to : undefined }); } catch (e) { return fail(e); }
      const totals = totalsOf(data);
      out.replaceChildren(h('div', { class: 'card' }, h('div', { class: 'hd' }, h('div', null, h('h3', null, t(data.title)), h('p', null, [period(data), t('{n} rows', { n: data.rows.length })].filter(Boolean).join(' · '))),
        h('div', { class: 'row' }, btn(t('Export CSV'), 'download', 'sm', exportCsv), btn(t('Save as PDF'), 'pdf', 'sm', () => doc('pdf')), btn(t('Print'), 'print', 'sm primary', () => doc('print')))),
        h('div', { class: 'table-wrap', style: { maxHeight: 'calc(100vh - 300px)' } }, h('table', { class: 'tbl' }, h('thead', null, h('tr', null, data.columns.map(c => h('th', { class: isNum(c) ? 'num' : '' }, t(c.label))))),
          h('tbody', null, data.rows.length ? data.rows.slice(0, 2000).map(row => h('tr', { class: row.bold ? 'bold' : '' }, data.columns.map(c => h('td', { class: isNum(c) ? 'num' : '' }, fmtCell(c, row[c.key])))))
            : h('tr', null, h('td', { colspan: data.columns.length }, h('div', { class: 'empty' }, icon('chart'), h('b', null, t('No data for this period.')), t('Try a wider date range.'))))),
          totals ? h('tfoot', null, h('tr', null, totals.map((c, i) => h('td', { class: isNum(data.columns[i]) ? 'num' : '' }, c)))) : null)),
        data.rows.length > 2000 ? h('div', { class: 'pager' }, t('Showing the first 2,000 rows. Export to CSV or PDF for the full report.')) : null),
        current === 'profit' ? h('div', { class: 'note', style: { marginTop: '12px' } }, t('Profit is recognised when a sale is completed. Money collected later against customer credit is not counted again, tax collected is excluded, and voided sales are ignored.')) : null);
    };
    const exportCsv = async () => { if (!data) return; try { const f = await api('file:saveCsv', { name: data.name + '-report', columns: data.columns.map(c => ({ key: c.key, label: t(c.label) })), rows: data.rows.map(r => Object.fromEntries(data.columns.map(c => [c.key, isNum(c) || c.type === 'date' ? r[c.key] : fmtCell(c, r[c.key])]))) }); if (f) toast(t('Exported to {file}', { file: f })); } catch (e) { fail(e); } };
    const doc = async mode => {
      if (!data) return;
      const cols = data.columns.map(c => ({ label: t(c.label), num: isNum(c) }));
      const body = Docs.table(t(data.title), period(data), cols, data.rows.map(r => ({ bold: r.bold, cells: data.columns.map(c => fmtCell(c, r[c.key])) })), totalsOf(data));
      const payload = { html: Docs.full(body, { landscape: cols.length > 7, title: data.title }), name: data.name + '-report', landscape: cols.length > 7 };
      try { if (mode === 'pdf') { const f = await api('print:pdf', payload); if (f) toast(t('Saved to {file}', { file: f })); } else await api('print:html', payload); } catch (e) { fail(e); }
    };
    range = rangePicker('month', load, [['today', t('Daily')], ['week', t('Weekly')], ['month', t('Monthly')], ['year', t('Yearly')], ['all', t('All time')], ['custom', t('Custom')]]);
    root.append(pageHead(t('Reports'), t('Print, save as PDF or export any report to CSV.'), range.el), h('div', { class: 'grid', style: { gridTemplateColumns: '230px minmax(0,1fr)' } }, menu, out));
    drawMenu(); await load();
  },
};
