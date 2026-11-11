'use strict';
App.pages.sales = {
  title: 'Sales History', icon: 'receipt',
  async render(root, params) {
    let table, range;
    const summary = h('div', { class: 'stats' });
    const load = async () => {
      const r = range.value();
      let rows; try { rows = await api('sales:list', { from: r.from, to: r.to }); } catch (e) { return fail(e); }
      table.setRows(rows);
      const ok = rows.filter(s => s.status === 'completed');
      const sum = k => ok.reduce((a, s) => a + s[k], 0);
      summary.replaceChildren(statCard(t('Sales'), money(sum('grand_total')), { ico: 'cart', sub: t('{n} transactions', { n: ok.length }) }), statCard(t('Gross profit'), money(sum('profit')), { ico: 'trend', color: 'green' }),
        statCard(t('Paid'), money(sum('paid_amount')), { ico: 'cash', color: 'slate' }), statCard(t('Remaining'), money(sum('remaining')), { ico: 'book', color: sum('remaining') > 0 ? 'red' : 'slate' }));
    };
    const voidSale = async s => {
      if (restricted()) return;
      const v = await confirmDialog({ title: t('Void sale {inv}?', { inv: s.invoice_no }), danger: true, confirmLabel: t('Void sale'),
        text: t('Voiding returns the items to stock and reverses the customer balance. The invoice is kept in history and marked as void. Any money already received ({paid}) should be refunded to the customer.', { paid: money(s.paid_amount) }),
        fields: [{ name: 'reason', label: t('Reason'), required: true }, ...(await adminFields())] });
      if (!v) return;
      try { await api('sales:void', { id: s.id, reason: v.reason, password: v.password }); toast(t('Sale voided.')); load(); refreshBadges(); } catch (e) { fail(e); }
    };
    table = dataTable({
      rows: [], exportName: 'sales-history', empty: t('No sales in this period.'), searchKeys: ['invoice_no', 'customer_name', 'items_summary'], initialQuery: params && params.q,
      columns: [
        { key: 'invoice_no', label: t('Invoice'), render: r => h('b', null, r.invoice_no) }, { key: 'sale_date', label: t('Date'), type: 'date' },
        { key: 'customer_name', label: t('Customer'), render: r => r.customer_name || t('Walk-in customer') },
        { key: 'items_summary', label: t('Items'), render: r => h('div', { style: { maxWidth: '280px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }, title: r.items_summary || '' }, r.items_summary || '') },
        { key: 'grand_total', label: t('Total'), type: 'money' }, { key: 'paid_amount', label: t('Paid'), type: 'money' },
        { key: 'remaining', label: t('Remaining'), type: 'money', render: r => r.status === 'voided' ? '—' : r.remaining > 0 ? h('b', { style: { color: 'var(--red)' } }, money(r.remaining)) : money(0) },
        { key: 'profit', label: t('Profit'), type: 'money', render: r => r.status === 'voided' ? '—' : money(r.profit) },
        { key: 'status', label: t('Status'), render: r => statusBadge(r.status), csv: r => r.status },
      ],
      filters: [{ key: 'status', label: t('All statuses'), options: [['completed', t('Completed')], ['voided', t('Voided')]] }, { key: 'remaining', label: t('All payments'), options: [['due', t('With balance due')], ['paid', t('Fully paid')]], test: (r, v) => r.status === 'completed' && (v === 'due' ? r.remaining > 0 : r.remaining <= 0) }],
      onRow: r => Docs.showInvoice(r.id).catch(fail),
      actions: r => [iconBtn('receipt', t('View invoice'), () => Docs.showInvoice(r.id).catch(fail)),
        r.status === 'completed' && r.remaining > 0 && r.customer_id ? iconBtn('cash', t('Record payment'), async () => { if (await App.pages.customers.takePayment(r.customer_id, r)) { load(); refreshBadges(); } }) : null,
        r.status === 'completed' ? iconBtn('ban', t('Void sale'), () => voidSale(r), 'danger') : null],
    });
    range = rangePicker(params && params.q ? 'all' : 'month', load, [['today', t('Today')], ['week', t('This week')], ['month', t('This month')], ['year', t('This year')], ['all', t('All time')], ['custom', t('Custom')]]);
    root.append(pageHead(t('Sales History'), t('Every completed and voided sale. Sales are never deleted.'), range.el, btn(t('New Sale'), 'plus', 'primary', () => navigate('newsale'))), summary, table.el);
    await load();
    if (params && params.open) Docs.showInvoice(params.open).catch(fail);
  },
};
