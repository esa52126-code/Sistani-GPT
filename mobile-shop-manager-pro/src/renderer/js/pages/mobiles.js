'use strict';
App.pages.mobiles = {
  title: 'Mobile Inventory', icon: 'phone',
  async render(root, params) {
    let table, suppliers = [];
    const reload = async () => { try { table.setRows(await api('mobiles:list')); } catch (e) { fail(e); } };
    const fields = (m, brands) => [
      { name: 'brand', label: t('Brand'), required: true, list: 'dl-brands', datalist: brands, placeholder: 'Samsung' }, { name: 'model', label: t('Model'), required: true, placeholder: 'Galaxy A55' },
      { name: 'ram', label: t('RAM'), placeholder: '8GB' }, { name: 'storage', label: t('Storage'), placeholder: '256GB' },
      { name: 'color', label: t('Color') }, { name: 'warranty', label: t('Warranty'), placeholder: t('e.g. 12 months') },
      { name: 'imei1', label: t('IMEI 1'), required: true, max: 20, hint: t('Must be unique. Dial *#06# on the phone to see it.'), disabled: m && m.status === 'sold' },
      { name: 'imei2', label: t('IMEI 2'), max: 20, hint: t('Optional, for dual-SIM phones.'), disabled: m && m.status === 'sold' },
      { name: 'purchase_price', label: t('Purchase price'), type: 'money', required: true, disabled: m && m.status === 'sold' }, { name: 'selling_price', label: t('Selling price'), type: 'money', required: true },
      { name: 'supplier_id', label: t('Supplier'), type: 'select', options: supplierOptions(suppliers) }, { name: 'purchase_date', label: t('Purchase date'), type: 'date', value: today() },
      m ? (m.status === 'sold' ? null : { name: 'status', label: t('Status'), type: 'select', options: ['in_stock', 'exchange', 'returned'].map(s => [s, label(Const.MOBILE_STATUS_LABELS, s)]) })
        : { name: 'supplier_paid', label: t('Supplier payment'), type: 'select', options: [['paid', t('Paid in full')], ['unpaid', t('Not paid yet (add to payable)')]], hint: t('Only used when a supplier is selected.') },
      { name: 'notes', label: t('Notes'), type: 'textarea', span: 2 },
    ].filter(Boolean);
    const edit = async m => {
      if (restricted()) return;
      const [sup, brands] = await Promise.all([api('suppliers:list'), api('mobiles:brands')]); suppliers = sup;
      const ok = await formModal({ title: m ? t('Edit mobile {id}', { id: m.stock_id }) : t('Add mobile'), size: 'lg', fields: fields(m, brands), values: m ? { ...m, supplier_id: m.supplier_id || '' } : {},
        onSubmit: v => api(m ? 'mobiles:update' : 'mobiles:create', m ? { ...m, ...v } : v) });
      if (ok) { toast(m ? t('Mobile updated.') : t('Mobile added to inventory.')); reload(); }
    };
    const view = async id => {
      let m; try { m = await api('mobiles:get', id); } catch (e) { return fail(e); }
      const md = modal({ title: `${m.brand} ${m.model}`, body: h('div', { class: 'col', style: { gap: '16px' } }, kv([
        [t('Stock ID'), m.stock_id], [t('Status'), statusBadge(m.status, Const.MOBILE_STATUS_LABELS)], [t('RAM / Storage'), [m.ram, m.storage].filter(Boolean).join(' / ')], [t('Color'), m.color],
        [t('IMEI 1'), m.imei1], [t('IMEI 2'), m.imei2], [t('Purchase price'), money(m.purchase_price)], [t('Selling price'), money(m.selling_price)], [t('Expected profit'), money(m.selling_price - m.purchase_price)],
        [t('Supplier'), m.supplier_name], [t('Purchase date'), fdate(m.purchase_date)], [t('Warranty'), m.warranty], [t('Notes'), m.notes]]),
        m.sale ? h('div', { class: 'note' }, t('Sold on {date} to {customer} for {price} — invoice {inv}.', { date: fdate(m.sale.sale_date), customer: m.sale.customer_name || t('Walk-in customer'), price: money(m.sale.unit_price), inv: m.sale.invoice_no })) : null),
        footer: [m.sale ? btn(t('View invoice'), 'receipt', '', () => Docs.showInvoice(m.sale.id).catch(fail)) : null, btn(t('Edit'), 'edit', '', () => { md.close(); edit(m); }),
          m.status === 'in_stock' ? btn(t('Sell this phone'), 'cart', 'primary', () => { md.close(); navigate('newsale', { mobile: m.id }); }) : null] });
    };
    const del = async m => {
      if (restricted()) return;
      if (!await confirmDialog({ title: t('Delete mobile?'), text: t('Delete {name} ({id}) from inventory? This cannot be undone.', { name: m.brand + ' ' + m.model, id: m.stock_id }), confirmLabel: t('Delete'), danger: true })) return;
      try { await api('mobiles:remove', m.id); toast(t('Mobile deleted.')); reload(); } catch (e) { fail(e); }
    };
    const rows = await api('mobiles:list');
    const brands = [...new Set(rows.map(r => r.brand))].sort();
    table = dataTable({
      rows, exportName: 'mobile-inventory', initialQuery: params && params.q, empty: t('No mobiles yet. Click “Add mobile” to add your first phone.'),
      searchKeys: ['stock_id', 'brand', 'model', 'imei1', 'imei2', 'color', 'supplier_name'],
      columns: [
        { key: 'stock_id', label: t('Stock ID'), render: r => h('b', null, r.stock_id) },
        { key: 'model', label: t('Mobile'), render: r => h('div', { class: 'main-cell' }, h('b', null, `${r.brand} ${r.model}`), h('span', null, [r.ram, r.storage, r.color].filter(Boolean).join(' · '))), csv: r => `${r.brand} ${r.model}` },
        { key: 'imei1', label: t('IMEI'), render: r => h('div', { class: 'main-cell num' }, h('div', null, r.imei1), r.imei2 ? h('span', null, r.imei2) : null), csv: r => [r.imei1, r.imei2].filter(Boolean).join(' / ') },
        { key: 'purchase_price', label: t('Purchase'), type: 'money' }, { key: 'selling_price', label: t('Selling'), type: 'money' },
        { key: 'supplier_name', label: t('Supplier') }, { key: 'purchase_date', label: t('Purchased'), type: 'date' },
        { key: 'status', label: t('Status'), render: r => statusBadge(r.status, Const.MOBILE_STATUS_LABELS), csv: r => Const.MOBILE_STATUS_LABELS[r.status] },
      ],
      filters: [{ key: 'brand', label: t('All brands'), options: brands.map(b => [b, b]) }, { key: 'status', label: t('All statuses'), options: Const.MOBILE_STATUSES.map(s => [s, label(Const.MOBILE_STATUS_LABELS, s)]), value: params && params.status }],
      onRow: r => view(r.id),
      actions: r => [iconBtn('eye', t('View details'), () => view(r.id)), iconBtn('edit', t('Edit'), () => edit(r)), iconBtn('trash', t('Delete'), () => del(r), 'danger')],
    });
    const inStock = rows.filter(r => r.status === 'in_stock');
    root.append(pageHead(t('Mobile Inventory'), t('{n} phones in stock · stock value {v}', { n: inStock.length, v: money(inStock.reduce((a, r) => a + r.purchase_price, 0)) }), btn(t('Add mobile'), 'plus', 'primary', () => edit(null))), table.el);
    if (params && params.open) view(params.open);
    if (params && params.add) edit(null);
  },
};
