'use strict';
App.pages.exchanges = {
  title: 'Exchange / Used Stock', icon: 'swap',
  async render(root, params) {
    let table;
    const reload = async () => { try { table.setRows(await api('exchanges:list')); } catch (e) { fail(e); } };
    const edit = async x => {
      if (restricted()) return;
      const locked = x && (x.status === 'sold' || x.source_sale_id);
      const ok = await formModal({ title: x ? t('Edit used phone {id}', { id: x.stock_id }) : t('Add used phone'), values: x || { condition: 'good', date_received: today() },
        fields: [x ? null : { type: 'note', label: t('Use this for phones you buy directly. Phones taken as a trade-in during a sale are added here automatically.') },
          { name: 'brand', label: t('Brand'), required: true }, { name: 'model', label: t('Model'), required: true }, { name: 'imei', label: t('IMEI'), disabled: x && x.status === 'sold' },
          { name: 'condition', label: t('Condition'), type: 'select', options: Const.CONDITIONS.map(c => [c, label(Const.CONDITION_LABELS, c)]) },
          { name: 'acquisition_value', label: t('Acquisition / exchange value'), type: 'money', required: true, disabled: locked, hint: t('What the phone cost you. Profit = resale price − this value.') },
          { name: 'estimated_value', label: t('Estimated resale value'), type: 'money' }, { name: 'date_received', label: t('Date received'), type: 'date' },
          x && x.status !== 'sold' ? { name: 'status', label: t('Status'), type: 'select', options: ['available', 'returned'].map(s => [s, label(Const.USED_STATUS_LABELS, s)]) } : null,
          { name: 'notes', label: t('Notes'), type: 'textarea', span: 2 }].filter(Boolean),
        onSubmit: v => api(x ? 'exchanges:update' : 'exchanges:create', x ? { ...x, ...v } : v) });
      if (ok) { toast(x ? t('Used phone updated.') : t('Used phone added.')); reload(); }
    };
    const del = async x => {
      if (restricted()) return;
      if (!await confirmDialog({ title: t('Delete used phone?'), text: t('Delete {name} ({id})?', { name: x.brand + ' ' + x.model, id: x.stock_id }), confirmLabel: t('Delete'), danger: true })) return;
      try { await api('exchanges:remove', x.id); toast(t('Used phone deleted.')); reload(); } catch (e) { fail(e); }
    };
    const rows = await api('exchanges:list');
    table = dataTable({ rows, exportName: 'used-stock', empty: t('No used phones yet.'), searchKeys: ['stock_id', 'brand', 'model', 'imei', 'customer_name'], initialQuery: params && params.q,
      columns: [{ key: 'stock_id', label: t('Stock ID'), render: r => h('b', null, r.stock_id) },
        { key: 'model', label: t('Phone'), render: r => h('div', { class: 'main-cell' }, h('b', null, `${r.brand} ${r.model}`), h('span', null, r.source_invoice ? t('Trade-in on {inv}', { inv: r.source_invoice }) + (r.customer_name ? ' · ' + r.customer_name : '') : t('Bought directly'))), csv: r => `${r.brand} ${r.model}` },
        { key: 'imei', label: t('IMEI') }, { key: 'condition', label: t('Condition'), render: r => label(Const.CONDITION_LABELS, r.condition) },
        { key: 'acquisition_value', label: t('Acquisition value'), type: 'money' }, { key: 'estimated_value', label: t('Estimated value'), type: 'money' },
        { key: 'resale_profit', label: t('Resale profit'), type: 'money', render: r => r.status === 'sold' && r.resale_profit != null ? h('b', { style: { color: r.resale_profit >= 0 ? 'var(--green)' : 'var(--red)' } }, money(r.resale_profit)) : '—' },
        { key: 'date_received', label: t('Received'), type: 'date' }, { key: 'status', label: t('Status'), render: r => statusBadge(r.status, Const.USED_STATUS_LABELS), csv: r => r.status }],
      filters: [{ key: 'status', label: t('All statuses'), options: Const.USED_STATUSES.map(s => [s, label(Const.USED_STATUS_LABELS, s)]) }],
      actions: r => [r.status === 'available' ? btn(t('Sell'), 'cart', 'sm primary', () => navigate('newsale', { used: r.id })) : null, iconBtn('edit', t('Edit'), () => edit(r)), iconBtn('trash', t('Delete'), () => del(r), 'danger')] });
    const avail = rows.filter(r => r.status === 'available'), sold = rows.filter(r => r.status === 'sold');
    root.append(pageHead(t('Exchange / Used Stock'), t('Phones received as trade-ins or bought used.'), btn(t('Add used phone'), 'plus', 'primary', () => edit(null))),
      h('div', { class: 'stats', style: { gridTemplateColumns: 'repeat(3,minmax(0,1fr))' } }, statCard(t('Available'), numf(avail.length), { ico: 'swap', sub: t('Value {v}', { v: money(avail.reduce((a, r) => a + r.acquisition_value, 0)) }) }),
        statCard(t('Sold'), numf(sold.length), { ico: 'check', color: 'slate' }), statCard(t('Profit from resold phones'), money(sold.reduce((a, r) => a + (r.resale_profit || 0), 0)), { ico: 'trend', color: 'green', sub: t('Resale price − acquisition cost') })), table.el);
  },
};
