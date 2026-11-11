'use strict';
App.pages.accessories = {
  title: 'Accessories', icon: 'headphones',
  async render(root, params) {
    let table, suppliers = [];
    const catOptions = Const.ACCESSORY_CATEGORIES.map(c => [c, label(Const.ACCESSORY_CATEGORY_LABELS, c)]);
    const reload = async () => { try { table.setRows(await api('accessories:list')); refreshBadges(); } catch (e) { fail(e); } };
    const edit = async a => {
      if (restricted()) return;
      suppliers = await api('suppliers:list');
      const ok = await formModal({ title: a ? t('Edit accessory') : t('Add accessory'), size: 'lg', values: a ? { ...a, supplier_id: a.supplier_id || '' } : { min_stock: App.settings.low_stock_default },
        fields: [{ name: 'name', label: t('Product name'), required: true }, { name: 'category', label: t('Category'), type: 'select', options: catOptions },
          { name: 'sku', label: t('SKU'), hint: t('Leave empty to generate one automatically.') }, { name: 'supplier_id', label: t('Supplier'), type: 'select', options: supplierOptions(suppliers) },
          { name: 'purchase_price', label: t('Purchase price'), type: 'money', required: true }, { name: 'selling_price', label: t('Selling price'), type: 'money', required: true },
          a ? null : { name: 'quantity', label: t('Opening quantity'), type: 'int', value: 0 }, { name: 'min_stock', label: t('Minimum stock level'), type: 'int', hint: t('You are alerted when stock falls to this level.') },
          { name: 'notes', label: t('Notes'), type: 'textarea', span: 2 }].filter(Boolean),
        onSubmit: v => api(a ? 'accessories:update' : 'accessories:create', a ? { ...v, id: a.id } : v) });
      if (ok) { toast(a ? t('Accessory updated.') : t('Accessory added.')); reload(); }
    };
    const adjust = async a => {
      if (restricted()) return;
      const ok = await formModal({ title: t('Adjust stock — {name}', { name: a.name }), size: 'sm', submitLabel: t('Apply adjustment'),
        fields: [{ type: 'note', label: t('Current quantity: {n}', { n: a.quantity }) },
          { name: 'mode', label: t('Adjustment type'), type: 'select', span: 2, options: [['add', t('Add stock (+)')], ['remove', t('Remove stock (−)')], ['set', t('Set counted quantity')]] },
          { name: 'quantity', label: t('Quantity'), type: 'int', required: true, span: 2 }, { name: 'reason', label: t('Reason'), required: true, span: 2, placeholder: t('e.g. Damaged, stock count, gift') }],
        onSubmit: v => api('accessories:adjust', { id: a.id, mode: v.mode === 'set' ? 'set' : 'delta', quantity: v.mode === 'remove' ? -Math.abs(Number(v.quantity)) : Number(v.quantity), reason: v.reason }) });
      if (ok) { toast(t('Stock adjusted.')); reload(); }
    };
    const purchase = async a => {
      if (restricted()) return;
      suppliers = await api('suppliers:list');
      const ok = await formModal({ title: t('Purchase entry — {name}', { name: a.name }), submitLabel: t('Add stock'), values: { unit_cost: a.purchase_price, supplier_id: a.supplier_id || '', date: today() },
        fields: [{ name: 'quantity', label: t('Quantity purchased'), type: 'int', required: true }, { name: 'unit_cost', label: t('Unit cost'), type: 'money', required: true },
          { name: 'supplier_id', label: t('Supplier'), type: 'select', options: supplierOptions(suppliers) }, { name: 'date', label: t('Date'), type: 'date' },
          { name: 'paid', label: t('Amount paid to supplier'), type: 'money', hint: t('Leave empty if paid in full. The rest is added to the supplier payable.') }, { name: 'method', label: t('Payment method'), type: 'select', options: methodOptions() },
          { type: 'note', label: t('The purchase price is updated to the weighted average cost of old and new stock.') }],
        onSubmit: v => api('accessories:purchase', { ...v, id: a.id }) });
      if (ok) { toast(t('Stock added.')); reload(); }
    };
    const history = async a => {
      let d; try { d = await api('accessories:get', a.id); } catch (e) { return fail(e); }
      const names = { opening: t('Opening stock'), purchase: t('Purchase'), sale: t('Sale'), adjustment: t('Adjustment'), void: t('Sale voided') };
      modal({ title: t('Stock history — {name}', { name: a.name }), size: 'lg', body: h('div', { class: 'table-wrap' }, h('table', { class: 'tbl' }, h('thead', null, h('tr', null, h('th', null, t('Date')), h('th', null, t('Type')), h('th', null, t('Note')), h('th', { class: 'num' }, t('Change')), h('th', { class: 'num' }, t('Balance')))),
        h('tbody', null, d.movements.map(m => h('tr', null, h('td', null, fdate(m.movement_date)), h('td', null, names[m.movement_type] || m.movement_type), h('td', null, m.note), h('td', { class: 'num' }, (m.quantity > 0 ? '+' : '') + m.quantity), h('td', { class: 'num' }, m.balance_after)))))) });
    };
    const del = async a => {
      if (restricted()) return;
      if (!await confirmDialog({ title: t('Delete accessory?'), text: t('Delete “{name}”? If it has been sold before it will be archived so past invoices stay intact.', { name: a.name }), confirmLabel: t('Delete'), danger: true })) return;
      try { const r = await api('accessories:remove', a.id); toast(r.archived ? t('Accessory archived (it appears on past sales).') : t('Accessory deleted.')); reload(); } catch (e) { fail(e); }
    };
    const rows = await api('accessories:list');
    table = dataTable({
      rows, exportName: 'accessories', empty: t('No accessories yet.'), searchKeys: ['name', 'sku', 'supplier_name'], initialQuery: params && params.q,
      columns: [
        { key: 'name', label: t('Product'), render: r => h('b', null, r.name) }, { key: 'sku', label: t('SKU') },
        { key: 'category', label: t('Category'), render: r => label(Const.ACCESSORY_CATEGORY_LABELS, r.category), csv: r => Const.ACCESSORY_CATEGORY_LABELS[r.category] },
        { key: 'purchase_price', label: t('Purchase'), type: 'money' }, { key: 'selling_price', label: t('Selling'), type: 'money' },
        { key: 'quantity', label: t('Quantity'), type: 'number', render: r => r.quantity === 0 ? badge(t('Out of stock'), 'red') : r.low_stock ? badge(String(r.quantity) + ' · ' + t('Low'), 'amber') : h('b', null, numf(r.quantity)) },
        { key: 'min_stock', label: t('Min. level'), type: 'number' }, { key: 'supplier_name', label: t('Supplier') },
      ],
      filters: [{ key: 'category', label: t('All categories'), options: catOptions }, { key: 'low_stock', label: t('All stock levels'), options: [['1', t('Low stock only')]], value: params && params.low ? '1' : '', test: r => !!r.low_stock }],
      actions: r => [btn(t('Purchase'), 'plus', 'sm', () => purchase(r)), iconBtn('layers', t('Adjust stock'), () => adjust(r)), iconBtn('calendar', t('Stock history'), () => history(r)), iconBtn('edit', t('Edit'), () => edit(r)), iconBtn('trash', t('Delete'), () => del(r), 'danger')],
    });
    const low = rows.filter(r => r.low_stock).length;
    root.append(pageHead(t('Accessories'), t('{n} products · {u} units · stock value {v}', { n: rows.length, u: numf(rows.reduce((a, r) => a + r.quantity, 0)), v: money(rows.reduce((a, r) => a + r.quantity * r.purchase_price, 0)) }) + (low ? ' · ' + t('{n} low on stock', { n: low }) : ''),
      btn(t('Sell accessories'), 'cart', '', () => navigate('newsale')), btn(t('Add accessory'), 'plus', 'primary', () => edit(null))), table.el);
  },
};
