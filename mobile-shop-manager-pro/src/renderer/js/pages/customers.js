'use strict';
(() => {
  const phoneOf = c => [c.phone_code, c.phone].filter(Boolean).join(' ');
  const countryOptions = () => [['', t('— Select —')], ...Const.COUNTRIES.map(c => [c.iso, c.name])];
  const dialCodes = () => { const seen = new Set(), out = [['', '—']]; for (const c of Const.COUNTRIES) out.push([c.dial + '|' + c.iso, `${c.name} (${c.dial})`]); return out.filter(o => !seen.has(o[0]) && seen.add(o[0])); };

  /** Add / edit. Resolves to the customer id, or null when cancelled. */
  async function editCustomer(c) {
    if (restricted()) return null;
    const home = Const.COUNTRIES.find(x => x.iso === App.settings.country);
    const codeVal = c ? (() => { const m = Const.COUNTRIES.find(x => x.dial === c.phone_code && (x.iso === c.country || !c.country)) || Const.COUNTRIES.find(x => x.dial === c.phone_code); return m ? m.dial + '|' + m.iso : ''; })() : (home ? home.dial + '|' + home.iso : '');
    return formModal({ title: c ? t('Edit customer') : t('Add customer'), values: c ? { ...c, phone_code: codeVal } : { phone_code: codeVal, country: App.settings.country },
      fields: [{ name: 'name', label: t('Customer name'), required: true, span: 2 },
        { name: 'phone_code', label: t('Country code'), type: 'select', options: dialCodes() }, { name: 'phone', label: t('Phone number'), placeholder: '555 0142', hint: t('Without the country code. Used for WhatsApp.') },
        { name: 'email', label: t('Email'), type: 'email' }, { name: 'country', label: t('Country'), type: 'select', options: countryOptions() },
        { name: 'address', label: t('Address'), span: 2 }, { name: 'notes', label: t('Notes'), type: 'textarea', span: 2 }],
      onSubmit: async v => { const d = { ...v, phone_code: v.phone_code.split('|')[0] }; if (c) { await api('customers:update', { ...d, id: c.id }); return c.id; } return api('customers:create', d); } });
  }
  /** Record a credit payment; optionally against one invoice. Resolves truthy when saved. */
  async function takePayment(customerId, sale) {
    if (restricted()) return null;
    const c = (await api('customers:list')).find(x => x.id === customerId);
    if (!c) return null;
    const due = sale ? sale.remaining : c.balance;
    if (!(due > 0)) { toast(t('This customer has no outstanding balance.'), 'info'); return null; }
    const res = await formModal({ title: t('Record payment — {name}', { name: c.name }), submitLabel: t('Save payment'), values: { amount: due, date: today(), method: 'cash' },
      fields: [{ type: 'note', label: sale ? t('Balance of invoice {inv}: {amt}', { inv: sale.invoice_no, amt: money(due) }) : t('Outstanding balance: {amt}. The payment is applied to the oldest unpaid invoices first.', { amt: money(due) }) },
        { name: 'amount', label: t('Amount received'), type: 'money', required: true }, { name: 'method', label: t('Payment method'), type: 'select', options: methodOptions() },
        { name: 'date', label: t('Date'), type: 'date' }, { name: 'note', label: t('Note') }],
      onSubmit: async v => { const r = await api('customers:recordPayment', { customer_id: c.id, sale_id: sale ? sale.id : null, ...v }); return { ...r, method: v.method, date: v.date }; } });
    if (res) {
      toast(t('Payment of {amt} recorded. New balance: {bal}', { amt: money(res.amount), bal: money(res.balance) }));
      Docs.preview({ title: t('Payment receipt') + ' ' + res.receipt_no, body: Docs.receipt(c, res), name: res.receipt_no });
    }
    return res;
  }
  async function showStatement(customerId) {
    let st; try { st = await api('customers:statement', { customer_id: customerId }); } catch (e) { return fail(e); }
    const c = st.customer;
    Docs.preview({ title: t('Statement — {name}', { name: c.name }), body: Docs.statement(st), name: 'statement-' + c.name,
      extra: [btn('WhatsApp', 'chat', 'success', () => api('shell:whatsapp', { phone: (c.phone_code || '') + (c.phone || ''), text: t('Hello {name},', { name: c.name }) + '\n\n' + t('Your outstanding balance at {shop} is {amt}.', { shop: App.settings.shop_name, amt: money(st.closing) }) + '\n\n' + App.settings.shop_name }).catch(fail))] });
  }
  async function viewCustomer(id, onChange) {
    let c; try { c = await api('customers:get', id); } catch (e) { return fail(e); }
    const typeName = { sale: t('Sale'), payment: t('Payment'), void: t('Void'), adjustment: t('Adjustment') };
    const m = modal({ title: c.name, size: 'lg', body: h('div', { class: 'col', style: { gap: '16px' } },
      h('div', { class: 'stats', style: { gridTemplateColumns: 'repeat(3,1fr)', marginBottom: 0 } }, statCard(t('Total purchases'), money(c.total_purchases), { ico: 'cart', sub: t('{n} invoices', { n: c.sale_count }) }), statCard(t('Total payments'), money(c.total_paid), { ico: 'cash', color: 'green' }),
        statCard(t('Outstanding balance'), money(c.balance), { ico: 'book', color: c.balance > 0 ? 'red' : 'slate' })),
      kv([[t('Phone'), phoneOf(c)], [t('Email'), c.email], [t('Country'), (Const.COUNTRIES.find(x => x.iso === c.country) || {}).name], [t('Address'), c.address], [t('Notes'), c.notes]]),
      h('h4', null, t('Transaction history')),
      h('div', { class: 'table-wrap', style: { maxHeight: '300px', border: '1px solid var(--line)', borderRadius: '10px' } }, h('table', { class: 'tbl' }, h('thead', null, h('tr', null, h('th', null, t('Date')), h('th', null, t('Type')), h('th', null, t('Description')), h('th', { class: 'num' }, t('Charges')), h('th', { class: 'num' }, t('Payments')), h('th', { class: 'num' }, t('Balance')))),
        h('tbody', null, c.ledger.length ? [...c.ledger].reverse().map(e => { const tr = h('tr', { class: e.sale_id ? 'click' : '' }, h('td', { class: 'nowrap' }, fdate(e.entry_date)), h('td', null, typeName[e.entry_type] || e.entry_type), h('td', null, e.description), h('td', { class: 'num' }, e.debit ? money(e.debit) : ''), h('td', { class: 'num' }, e.credit ? money(e.credit) : ''), h('td', { class: 'num' }, h('b', null, money(e.balance))));
          if (e.sale_id) tr.addEventListener('click', () => Docs.showInvoice(e.sale_id).catch(fail)); return tr; }) : h('tr', null, h('td', { colspan: 6 }, h('div', { class: 'empty', style: { padding: '20px' } }, t('No transactions.')))))))),
      footer: [c.phone ? btn('WhatsApp', 'chat', 'grow success', () => api('shell:whatsapp', { phone: c.phone_code + c.phone, text: t('Hello {name},', { name: c.name }) + ' ' }).catch(fail)) : h('span', { class: 'grow' }),
        btn(t('Statement'), 'print', '', () => showStatement(c.id)), btn(t('Edit'), 'edit', '', async () => { if (await editCustomer(c)) { m.close(); onChange && onChange(); viewCustomer(id, onChange); } }),
        c.balance > 0 ? btn(t('Record payment'), 'cash', 'primary', async () => { if (await takePayment(c.id)) { m.close(); onChange && onChange(); refreshBadges(); } }) : btn(t('New sale'), 'cart', 'primary', () => { m.close(); navigate('newsale', { customer: c.id }); })] });
  }

  App.pages.customers = {
    title: 'Customers', icon: 'users', editCustomer, takePayment, showStatement, viewCustomer,
    async render(root, params) {
      let table;
      const reload = async () => { try { table.setRows((await api('customers:list')).map(c => ({ ...c, phone_full: phoneOf(c) }))); } catch (e) { fail(e); } };
      const del = async c => {
        if (restricted()) return;
        if (!await confirmDialog({ title: t('Delete customer?'), text: t('Delete {name}? Customers with transactions cannot be deleted.', { name: c.name }), confirmLabel: t('Delete'), danger: true })) return;
        try { await api('customers:remove', c.id); toast(t('Customer deleted.')); reload(); } catch (e) { fail(e); }
      };
      const rows = (await api('customers:list')).map(c => ({ ...c, phone_full: phoneOf(c) }));
      table = dataTable({ rows, exportName: 'customers', empty: t('No customers yet.'), searchKeys: ['name', 'phone_full', 'phone', 'email'], initialQuery: params && params.q,
        columns: [{ key: 'name', label: t('Customer'), render: r => h('div', { class: 'main-cell' }, h('b', null, r.name), h('span', null, r.email || '')) }, { key: 'phone_full', label: t('Phone') },
          { key: 'country', label: t('Country'), render: r => (Const.COUNTRIES.find(x => x.iso === r.country) || {}).name || '' },
          { key: 'total_purchases', label: t('Total purchases'), type: 'money' }, { key: 'total_paid', label: t('Total payments'), type: 'money' },
          { key: 'balance', label: t('Outstanding'), type: 'money', render: r => r.balance > 0 ? h('b', { style: { color: 'var(--red)' } }, money(r.balance)) : money(0) }, { key: 'last_sale', label: t('Last purchase'), type: 'date' }],
        onRow: r => viewCustomer(r.id, reload),
        actions: r => [r.phone ? iconBtn('chat', 'WhatsApp', () => api('shell:whatsapp', { phone: r.phone_code + r.phone, text: t('Hello {name},', { name: r.name }) + ' ' }).catch(fail)) : null,
          iconBtn('eye', t('View details'), () => viewCustomer(r.id, reload)), iconBtn('edit', t('Edit'), async () => { if (await editCustomer(r)) { toast(t('Customer updated.')); reload(); } }), iconBtn('trash', t('Delete'), () => del(r), 'danger')] });
      root.append(pageHead(t('Customers'), t('{n} customers', { n: rows.length }), btn(t('Add customer'), 'plus', 'primary', async () => { if (await editCustomer(null)) { toast(t('Customer added.')); reload(); } })), table.el);
      if (params && params.open) viewCustomer(params.open, reload);
    },
  };

  App.pages.credit = {
    title: 'Credit Book', icon: 'book',
    async render(root) {
      let table; const head = h('div', { class: 'stats', style: { gridTemplateColumns: 'repeat(3,minmax(0,1fr))' } });
      const load = async () => {
        let d, all; try { [d, all] = await Promise.all([api('customers:creditBook'), api('customers:list')]); } catch (e) { return fail(e); }
        const rows = all.filter(c => c.balance > 0 || c.total_purchases > 0).map(c => ({ ...c, phone_full: phoneOf(c) })).sort((a, b) => b.balance - a.balance);
        table.setRows(rows);
        head.replaceChildren(statCard(t('Total outstanding credit'), money(d.total), { ico: 'book', color: d.total > 0 ? 'red' : 'green' }), statCard(t('Customers with a balance'), numf(d.customers.length), { ico: 'users', color: 'slate' }),
          statCard(t('Largest balance'), money(d.customers[0] ? d.customers[0].balance : 0), { ico: 'alert', color: 'amber', sub: d.customers[0] ? d.customers[0].name : '' }));
      };
      const history = async c => {
        let p; try { p = await api('customers:payments', c.id); } catch (e) { return fail(e); }
        modal({ title: t('Payment history — {name}', { name: c.name }), size: 'lg', body: h('div', { class: 'table-wrap' }, h('table', { class: 'tbl' }, h('thead', null, h('tr', null, h('th', null, t('Date')), h('th', null, t('Invoice')), h('th', null, t('Method')), h('th', null, t('Receipt')), h('th', { class: 'num' }, t('Amount')))),
          h('tbody', null, p.length ? p.map(x => h('tr', null, h('td', null, fdate(x.payment_date)), h('td', null, x.invoice_no), h('td', null, label(Const.PAYMENT_METHOD_LABELS, x.method)), h('td', null, x.receipt_no || t('At sale')), h('td', { class: 'num' }, money(x.amount)))) : h('tr', null, h('td', { colspan: 5 }, h('div', { class: 'empty' }, t('No payments yet.'))))))) });
      };
      table = dataTable({ rows: [], exportName: 'credit-book', empty: t('No customer credit. Balances appear here when a sale is not paid in full.'), searchKeys: ['name', 'phone_full', 'phone'],
        columns: [{ key: 'name', label: t('Customer'), render: r => h('b', null, r.name) }, { key: 'phone_full', label: t('Phone') }, { key: 'total_purchases', label: t('Total purchases'), type: 'money' }, { key: 'total_paid', label: t('Total payments'), type: 'money' },
          { key: 'balance', label: t('Outstanding balance'), type: 'money', render: r => r.balance > 0 ? h('b', { style: { color: 'var(--red)' } }, money(r.balance)) : badge(t('Settled'), 'green') }, { key: 'last_entry', label: t('Last transaction'), type: 'date' }],
        filters: [{ key: 'balance', label: t('All customers'), value: 'due', options: [['due', t('Outstanding balances only')], ['settled', t('Settled')]], test: (r, v) => v === 'due' ? r.balance > 0 : r.balance <= 0 }],
        footer: rows => h('tr', null, h('td', { colspan: 4 }, t('Total')), h('td', { class: 'num' }, money(rows.reduce((a, r) => a + Math.max(r.balance, 0), 0))), h('td', { colspan: 2 })),
        onRow: r => viewCustomer(r.id, load),
        actions: r => [r.balance > 0 ? btn(t('Record payment'), 'cash', 'sm primary', async () => { if (await takePayment(r.id)) { load(); refreshBadges(); } }) : null, iconBtn('calendar', t('Payment history'), () => history(r)), iconBtn('print', t('Print statement'), () => showStatement(r.id)),
          r.phone && r.balance > 0 ? iconBtn('chat', t('WhatsApp reminder'), () => api('shell:whatsapp', { phone: r.phone_code + r.phone, text: t('Hello {name},', { name: r.name }) + '\n\n' + t('Your outstanding balance at {shop} is {amt}.', { shop: App.settings.shop_name, amt: money(r.balance) }) + '\n\n' + App.settings.shop_name }).catch(fail)) : null] });
      root.append(pageHead(t('Credit Book'), t('Money customers owe you. Payments reduce the balance; they are never counted as extra profit.')), head, table.el);
      await load();
    },
  };
})();
