'use strict';
App.pages.expenses = {
  title: 'Expenses', icon: 'wallet',
  async render(root) {
    let table, range; const head = h('div', { class: 'stats' });
    const catOptions = Const.EXPENSE_CATEGORIES.map(c => [c, label(Const.EXPENSE_CATEGORY_LABELS, c)]);
    const load = async () => {
      const r = range.value();
      try {
        const [rows, sum] = await Promise.all([api('expenses:list', { from: r.from, to: r.to }), api('expenses:summary', { today: Fmt.range('today', App.settings), month: Fmt.range('month', App.settings), year: Fmt.range('year', App.settings) })]);
        table.setRows(rows);
        head.replaceChildren(statCard(t("Today's expenses"), money(sum.today), { ico: 'wallet', color: 'amber' }), statCard(t('This month'), money(sum.month), { ico: 'calendar', color: 'amber' }), statCard(t('This year'), money(sum.year), { ico: 'calendar', color: 'slate' }), statCard(t('Total expenses'), money(sum.total), { ico: 'layers', color: 'slate' }));
      } catch (e) { fail(e); }
    };
    const edit = async x => {
      if (restricted()) return;
      const ok = await formModal({ title: x ? t('Edit expense') : t('Add expense'), values: x || { expense_date: today(), category: 'other', payment_method: 'cash' },
        fields: [{ name: 'category', label: t('Category'), type: 'select', options: catOptions }, { name: 'amount', label: t('Amount'), type: 'money', required: true }, { name: 'expense_date', label: t('Date'), type: 'date' },
          { name: 'payment_method', label: t('Payment method'), type: 'select', options: methodOptions() }, { name: 'description', label: t('Description'), type: 'textarea', span: 2 }],
        onSubmit: v => api(x ? 'expenses:update' : 'expenses:create', x ? { ...v, id: x.id } : v) });
      if (ok) { toast(x ? t('Expense updated.') : t('Expense added.')); load(); }
    };
    const del = async x => {
      if (restricted()) return;
      if (!await confirmDialog({ title: t('Delete expense?'), text: t('Delete this expense of {amt}?', { amt: money(x.amount) }), confirmLabel: t('Delete'), danger: true })) return;
      try { await api('expenses:remove', x.id); toast(t('Expense deleted.')); load(); } catch (e) { fail(e); }
    };
    table = dataTable({ rows: [], exportName: 'expenses', empty: t('No expenses in this period.'), searchKeys: ['description', 'category'],
      columns: [{ key: 'expense_date', label: t('Date'), type: 'date' }, { key: 'category', label: t('Category'), render: r => badge(label(Const.EXPENSE_CATEGORY_LABELS, r.category)), csv: r => Const.EXPENSE_CATEGORY_LABELS[r.category] }, { key: 'description', label: t('Description') },
        { key: 'payment_method', label: t('Payment method'), render: r => label(Const.PAYMENT_METHOD_LABELS, r.payment_method), csv: r => Const.PAYMENT_METHOD_LABELS[r.payment_method] }, { key: 'amount', label: t('Amount'), type: 'money' }],
      filters: [{ key: 'category', label: t('All categories'), options: catOptions }],
      footer: rows => h('tr', null, h('td', { colspan: 4 }, t('Total for the rows shown')), h('td', { class: 'num' }, money(rows.reduce((a, r) => a + r.amount, 0))), h('td')),
      actions: r => [iconBtn('edit', t('Edit'), () => edit(r)), iconBtn('trash', t('Delete'), () => del(r), 'danger')] });
    range = rangePicker('month', load, [['today', t('Today')], ['month', t('This month')], ['year', t('This year')], ['all', t('All time')], ['custom', t('Custom')]]);
    root.append(pageHead(t('Expenses'), t('Business running costs. They reduce net profit, not gross profit.'), range.el, btn(t('Add expense'), 'plus', 'primary', () => edit(null))), head, table.el);
    await load();
  },
};
