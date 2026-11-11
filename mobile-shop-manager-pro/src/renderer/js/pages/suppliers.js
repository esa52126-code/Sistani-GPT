'use strict';
App.pages.suppliers = {
  title: 'Suppliers', icon: 'truck',
  async render(root, params) {
    let table;
    const reload = async () => { try { table.setRows(await api('suppliers:list')); } catch (e) { fail(e); } };
    const edit = async s => {
      if (restricted()) return;
      const ok = await formModal({ title: s ? t('Edit supplier') : t('Add supplier'), values: s || {},
        fields: [{ name: 'name', label: t('Supplier name'), required: true }, { name: 'company', label: t('Company') }, { name: 'phone', label: t('Phone'), placeholder: '+1 555 0100' }, { name: 'email', label: t('Email'), type: 'email' },
          { name: 'address', label: t('Address'), span: 2 }, { name: 'notes', label: t('Notes'), type: 'textarea', span: 2 }],
        onSubmit: v => api(s ? 'suppliers:update' : 'suppliers:create', s ? { ...v, id: s.id } : v) });
      if (ok) { toast(s ? t('Supplier updated.') : t('Supplier added.')); reload(); }
    };
    const pay = async s => {
      if (restricted()) return;
      const ok = await formModal({ title: t('Pay supplier — {name}', { name: s.name }), submitLabel: t('Save payment'), values: { amount: s.payable, date: today() },
        fields: [{ type: 'note', label: t('Amount payable: {amt}', { amt: money(s.payable) }) }, { name: 'amount', label: t('Amount paid'), type: 'money', required: true }, { name: 'method', label: t('Payment method'), type: 'select', options: methodOptions() },
          { name: 'date', label: t('Date'), type: 'date' }, { name: 'note', label: t('Note') }],
        onSubmit: v => api('suppliers:recordPayment', { ...v, supplier_id: s.id }) });
      if (ok) { toast(t('Supplier payment recorded.')); reload(); }
      return ok;
    };
    const view = async id => {
      let s; try { s = await api('suppliers:get', id); } catch (e) { return fail(e); }
      const m = modal({ title: s.name, size: 'lg', body: h('div', { class: 'col', style: { gap: '16px' } },
        h('div', { class: 'stats', style: { gridTemplateColumns: 'repeat(3,1fr)', marginBottom: 0 } }, statCard(t('Total purchases'), money(s.total_purchases), { ico: 'truck' }), statCard(t('Amount paid'), money(s.total_paid), { ico: 'cash', color: 'green' }), statCard(t('Amount payable'), money(s.payable), { ico: 'wallet', color: s.payable > 0 ? 'red' : 'slate' })),
        kv([[t('Company'), s.company], [t('Phone'), s.phone], [t('Email'), s.email], [t('Address'), s.address], [t('Notes'), s.notes]]), h('h4', null, t('Purchase history')),
        h('div', { class: 'table-wrap', style: { maxHeight: '300px', border: '1px solid var(--line)', borderRadius: '10px' } }, h('table', { class: 'tbl' }, h('thead', null, h('tr', null, h('th', null, t('Date')), h('th', null, t('Type')), h('th', null, t('Description')), h('th', { class: 'num' }, t('Purchase')), h('th', { class: 'num' }, t('Paid')))),
          h('tbody', null, s.ledger.length ? s.ledger.map(e => h('tr', null, h('td', { class: 'nowrap' }, fdate(e.entry_date)), h('td', null, e.entry_type === 'purchase' ? t('Purchase') : t('Payment')), h('td', null, e.description), h('td', { class: 'num' }, e.debit ? money(e.debit) : ''), h('td', { class: 'num' }, e.credit ? money(e.credit) : '')))
            : h('tr', null, h('td', { colspan: 5 }, h('div', { class: 'empty', style: { padding: '20px' } }, t('No purchases yet. Select this supplier when adding stock.')))))))),
        footer: [btn(t('Edit'), 'edit', '', () => { m.close(); edit(s); }), s.payable > 0 ? btn(t('Record payment'), 'cash', 'primary', async () => { if (await pay(s)) { m.close(); view(id); } }) : null] });
    };
    const del = async s => {
      if (restricted()) return;
      if (!await confirmDialog({ title: t('Delete supplier?'), text: t('Delete {name}? Suppliers with purchase history cannot be deleted.', { name: s.name }), confirmLabel: t('Delete'), danger: true })) return;
      try { await api('suppliers:remove', s.id); toast(t('Supplier deleted.')); reload(); } catch (e) { fail(e); }
    };
    const rows = await api('suppliers:list');
    table = dataTable({ rows, exportName: 'suppliers', empty: t('No suppliers yet.'), searchKeys: ['name', 'company', 'phone', 'email'], initialQuery: params && params.q,
      columns: [{ key: 'name', label: t('Supplier'), render: r => h('div', { class: 'main-cell' }, h('b', null, r.name), h('span', null, r.company || '')) }, { key: 'phone', label: t('Phone') }, { key: 'email', label: t('Email') },
        { key: 'total_purchases', label: t('Total purchases'), type: 'money' }, { key: 'total_paid', label: t('Amount paid'), type: 'money' },
        { key: 'payable', label: t('Amount payable'), type: 'money', render: r => r.payable > 0 ? h('b', { style: { color: 'var(--red)' } }, money(r.payable)) : money(0) }],
      onRow: r => view(r.id),
      actions: r => [r.payable > 0 ? btn(t('Pay'), 'cash', 'sm', () => pay(r)) : null, iconBtn('eye', t('View details'), () => view(r.id)), iconBtn('edit', t('Edit'), () => edit(r)), iconBtn('trash', t('Delete'), () => del(r), 'danger')] });
    root.append(pageHead(t('Suppliers'), t('{n} suppliers · total payable {v}', { n: rows.length, v: money(rows.reduce((a, r) => a + Math.max(r.payable, 0), 0)) }), btn(t('Add supplier'), 'plus', 'primary', () => edit(null))), table.el);
    if (params && params.open) view(params.open);
  },
};
