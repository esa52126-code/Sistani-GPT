'use strict';
App.pages.newsale = {
  title: 'New Sale', icon: 'cart',
  async render(root, params) {
    const S = App.settings, dec = S.decimals;
    let [mobiles, used, accessories, customers] = await Promise.all([api('mobiles:list', { status: 'in_stock' }), api('exchanges:list', { status: 'available' }), api('accessories:list', { inStock: true }), api('customers:list')]);
    const cart = [];   // { type, id, description, sub, quantity, max, unit_price, cost }
    const state = { tab: 'mobile', q: '', customer_id: params && params.customer ? String(params.customer) : '', tradeIn: null, busy: false };
    const step = String(1 / Math.pow(10, dec));

    // ----- left: product picker -----
    const list = h('div', { class: 'picklist' });
    const tabs = h('div', { class: 'seg' });
    const search = h('input', { class: 'input sm', type: 'search', placeholder: t('Search by model, IMEI, stock ID or product…'), autofocus: true, oninput: e => { state.q = e.target.value.toLowerCase(); drawList(); } });
    const TABS = [['mobile', t('Mobiles')], ['accessory', t('Accessories')], ['used', t('Used phones')]];
    const drawTabs = () => tabs.replaceChildren(...TABS.map(([k, lb]) => h('button', { class: state.tab === k ? 'active' : '', onclick: () => { state.tab = k; drawTabs(); drawList(); search.focus(); } }, `${lb} (${k === 'mobile' ? mobiles.length : k === 'used' ? used.length : accessories.length})`)));
    const inCart = (type, id) => cart.find(c => c.type === type && c.id === id);
    function add(type, r) {
      if (restricted()) return;
      const ex = inCart(type, r.id);
      if (type === 'accessory') { if (ex) { if (ex.quantity < ex.max) ex.quantity++; else toast(t('Only {n} in stock.', { n: ex.max }), 'warn'); } else cart.push({ type, id: r.id, description: r.name, sub: r.sku, quantity: 1, max: r.quantity, unit_price: r.selling_price, cost: r.purchase_price }); }
      else if (!ex) {
        if (type === 'mobile') cart.push({ type, id: r.id, description: `${r.brand} ${r.model}`, sub: `${r.stock_id} · IMEI ${[r.imei1, r.imei2].filter(Boolean).join(' / ')}`, quantity: 1, max: 1, unit_price: r.selling_price, cost: r.purchase_price });
        else cart.push({ type, id: r.id, description: `${r.brand} ${r.model} (${t('Used')})`, sub: `${r.stock_id}${r.imei ? ' · IMEI ' + r.imei : ''}`, quantity: 1, max: 1, unit_price: r.estimated_value || r.acquisition_value, cost: r.acquisition_value });
      }
      drawList(); drawCart();
    }
    function drawList() {
      const q = state.q;
      let rows, make;
      if (state.tab === 'mobile') { rows = mobiles.filter(r => !q || `${r.brand} ${r.model} ${r.imei1} ${r.imei2} ${r.stock_id} ${r.color}`.toLowerCase().includes(q));
        make = r => [h('div', null, h('b', null, `${r.brand} ${r.model}`), h('div', { class: 'small muted' }, [r.stock_id, [r.ram, r.storage].filter(Boolean).join('/'), r.color, 'IMEI ' + r.imei1].filter(Boolean).join(' · '))), h('span', { class: 'p num' }, money(r.selling_price))]; }
      else if (state.tab === 'used') { rows = used.filter(r => !q || `${r.brand} ${r.model} ${r.imei} ${r.stock_id}`.toLowerCase().includes(q));
        make = r => [h('div', null, h('b', null, `${r.brand} ${r.model}`), h('div', { class: 'small muted' }, [r.stock_id, label(Const.CONDITION_LABELS, r.condition), r.imei ? 'IMEI ' + r.imei : ''].filter(Boolean).join(' · '))), h('span', { class: 'p num' }, money(r.estimated_value))]; }
      else { rows = accessories.filter(r => !q || `${r.name} ${r.sku}`.toLowerCase().includes(q));
        make = r => [h('div', null, h('b', null, r.name), h('div', { class: 'small muted' }, `${r.sku} · ${t('{n} in stock', { n: r.quantity })}`)), h('span', { class: 'p num' }, money(r.selling_price))]; }
      list.replaceChildren(...rows.slice(0, 200).map(r => { const added = state.tab !== 'accessory' && inCart(state.tab, r.id); return h('button', { class: 'pick' + (added ? ' added' : ''), disabled: !!added, onclick: () => add(state.tab, r) }, make(r), added ? badge(t('Added'), 'blue') : icon('plus')); }));
      if (!rows.length) list.append(h('div', { class: 'empty' }, icon('box'), h('b', null, t('Nothing available')), state.tab === 'mobile' ? t('Add phones in Mobile Inventory first.') : t('No matching stock.')));
    }

    // ----- right: cart & payment -----
    const customerSel = h('select', { class: 'input' });
    const drawCustomers = () => { customerSel.replaceChildren(h('option', { value: '' }, t('Walk-in customer')), ...customers.map(c => h('option', { value: c.id }, c.name + (c.phone ? ` · ${c.phone_code} ${c.phone}` : '') + (c.balance > 0 ? ` · ${t('owes')} ${money(c.balance)}` : '')))); customerSel.value = state.customer_id; };
    customerSel.addEventListener('change', () => { state.customer_id = customerSel.value; drawTotals(); });
    const lines = h('div'), totals = h('div');
    const discount = h('input', { class: 'input sm num', type: 'number', min: '0', step, value: '', placeholder: '0' });
    const paid = h('input', { class: 'input num', type: 'number', min: '0', step, placeholder: '0' });
    const method = h('select', { class: 'input' }, methodOptions().map(o => h('option', { value: o[0] }, o[1])));
    const exempt = h('input', { type: 'checkbox' });
    const notes = h('input', { class: 'input sm', placeholder: t('Optional note printed on the invoice') });
    const dateIn = h('input', { class: 'input sm', type: 'date', value: today(), max: today() });
    const tradeBox = h('div');
    const completeBtn = h('button', { class: 'btn success lg', style: { width: '100%' } }, icon('check'), t('Complete sale'));
    let paidTouched = false;
    paid.addEventListener('input', () => { paidTouched = true; drawTotals(); });
    discount.addEventListener('input', drawTotals); exempt.addEventListener('change', drawTotals);

    function calc() {
      const c = Fmt.calcSale(cart.map(l => ({ line_total: Fmt.round(l.unit_price * l.quantity, dec), cost: l.cost * l.quantity })), Number(discount.value) || 0, { enabled: S.tax_enabled, rate: S.tax_rate, mode: S.tax_mode, exempt: exempt.checked }, dec);
      const trade = state.tradeIn ? Math.min(Number(state.tradeIn.value) || 0, c.grand_total) : 0;
      const due = Fmt.round(c.grand_total - trade, dec);
      const received = paidTouched ? (Number(paid.value) || 0) : due;
      const remaining = Fmt.round(Math.max(due - received, 0), dec), change = Fmt.round(Math.max(received - due, 0), dec);
      return { ...c, trade, due, received, remaining, change };
    }
    function drawCart() {
      lines.replaceChildren(...cart.map((l, i) => h('div', { class: 'cart-line' },
        h('div', { class: 'd' }, h('b', null, l.description), h('span', null, l.sub)),
        l.type === 'accessory' ? h('input', { class: 'input sm num', type: 'number', min: '1', max: l.max, step: '1', value: l.quantity, 'aria-label': t('Quantity'), onchange: e => { l.quantity = Math.min(Math.max(parseInt(e.target.value, 10) || 1, 1), l.max); e.target.value = l.quantity; drawTotals(); } }) : h('span', { class: 'muted small', style: { textAlign: 'center' } }, '× 1'),
        h('input', { class: 'input sm num', type: 'number', min: '0', step, value: l.unit_price, 'aria-label': t('Price'), oninput: e => { l.unit_price = Math.max(Number(e.target.value) || 0, 0); drawTotals(); } }),
        iconBtn('x', t('Remove'), () => { cart.splice(i, 1); drawCart(); drawList(); }, 'danger'))));
      if (!cart.length) lines.append(h('div', { class: 'empty', style: { padding: '26px 10px' } }, icon('cart'), h('b', null, t('The sale is empty')), t('Pick a phone or accessory from the list.')));
      drawTotals();
    }
    function drawTrade() {
      const ti = state.tradeIn;
      tradeBox.replaceChildren(ti ? h('div', { class: 'note row between' }, h('span', null, `${t('Trade-in')}: `, h('b', null, `${ti.brand} ${ti.model}`), ` · ${money(ti.value)}`), h('span', { class: 'row' }, iconBtn('edit', t('Edit'), editTrade), iconBtn('x', t('Remove'), () => { state.tradeIn = null; drawTrade(); drawTotals(); })))
        : btn(t('Add trade-in / exchange phone'), 'swap', 'sm', editTrade));
    }
    async function editTrade() {
      await formModal({ title: t('Trade-in / exchange phone'), submitLabel: t('Apply trade-in'), values: state.tradeIn || { condition: 'good' },
        fields: [{ type: 'note', label: t('The customer hands in this phone as part payment. It is added to Used Stock at the trade-in value when the sale is completed.') },
          { name: 'brand', label: t('Brand'), required: true }, { name: 'model', label: t('Model'), required: true }, { name: 'imei', label: t('IMEI') },
          { name: 'condition', label: t('Condition'), type: 'select', options: Const.CONDITIONS.map(c => [c, label(Const.CONDITION_LABELS, c)]) },
          { name: 'value', label: t('Trade-in value (deducted from the sale)'), type: 'money', required: true }, { name: 'estimated_value', label: t('Expected resale price'), type: 'money' }, { name: 'notes', label: t('Notes'), type: 'textarea', span: 2 }],
        onSubmit: v => { if (!(Number(v.value) > 0)) throw new Error('Trade-in value must be greater than zero.'); if (Number(v.value) > calc().grand_total + (state.tradeIn ? 0 : 0) && cart.length) { const g = Fmt.calcSale(cart.map(l => ({ line_total: l.unit_price * l.quantity, cost: 0 })), Number(discount.value) || 0, { enabled: S.tax_enabled, rate: S.tax_rate, mode: S.tax_mode, exempt: exempt.checked }, dec).grand_total; if (Number(v.value) > g) throw new Error('Trade-in value cannot be more than the sale total. Buy the phone into used stock separately instead.'); } state.tradeIn = v; } });
      drawTrade(); drawTotals();
    }
    function drawTotals() {
      const c = calc();
      if (!paidTouched) paid.value = cart.length ? c.due : '';
      const row = (lb, v, cls) => h('div', { class: 'tot ' + (cls || '') }, h('span', null, lb), h('b', { class: 'num' }, v));
      const taxLbl = `${S.tax_label || t('Tax')} (${numf(S.tax_rate, S.tax_rate % 1 ? 2 : 0)}%)`;
      totals.replaceChildren(row(t('Subtotal'), money(c.subtotal)), c.discount > 0 ? row(t('Discount'), '-' + money(c.discount)) : null,
        c.tax_mode === 'exclusive' ? row(taxLbl, money(c.tax_amount)) : c.tax_mode === 'inclusive' ? row(taxLbl + ' ' + t('(included)'), money(c.tax_amount)) : c.tax_mode === 'exempt' ? row(S.tax_label || t('Tax'), t('Exempt')) : null,
        row(t('Grand total'), money(c.grand_total), 'big'), c.trade > 0 ? row(t('Trade-in'), '-' + money(c.trade)) : null,
        c.remaining > 0 ? row(t('Remaining (on credit)'), money(c.remaining), 'due') : c.change > 0 ? row(t('Change to return'), money(c.change), 'ok') : row(t('Remaining'), money(0), 'ok'),
        c.remaining > 0 && !state.customer_id ? h('div', { class: 'note warn', style: { marginTop: '6px' } }, t('Select a customer to sell on credit. Walk-in sales must be paid in full.')) : null,
        h('div', { class: 'small muted', style: { marginTop: '6px' } }, t('Profit on this sale: {p}', { p: money(c.profit) })));
      completeBtn.disabled = !cart.length || state.busy || (c.remaining > 0 && !state.customer_id);
    }
    async function complete() {
      if (restricted() || state.busy || !cart.length) return;
      const c = calc();
      state.busy = true; completeBtn.disabled = true;
      try {
        const res = await api('sales:create', { customer_id: state.customer_id || null, sale_date: dateIn.value || today(), items: cart.map(l => ({ type: l.type, id: l.id, quantity: l.quantity, unit_price: l.unit_price })),
          discount: Number(discount.value) || 0, tax_exempt: exempt.checked, paid: c.received, payment_method: method.value, trade_in: state.tradeIn, notes: notes.value });
        toast(t('Sale {inv} completed.', { inv: res.invoice_no }) + (res.change > 0 ? ' ' + t('Change: {c}', { c: money(res.change) }) : ''));
        refreshBadges();
        await navigate('newsale');
        Docs.showInvoice(res.id).catch(fail);
      } catch (e) { fail(e); state.busy = false; drawTotals(); }
    }
    completeBtn.addEventListener('click', complete);
    const newCustomer = async () => {
      if (restricted()) return;
      const id = await App.pages.customers.editCustomer(null);
      if (id) { customers = await api('customers:list'); state.customer_id = String(id); drawCustomers(); drawTotals(); }
    };

    root.append(pageHead(t('New Sale'), t('Pick items, choose the customer, take payment.'), btn(t('Clear'), 'refresh', '', () => navigate('newsale'))),
      h('div', { class: 'pos' },
        h('div', { class: 'card' }, h('div', { class: 'toolbar' }, tabs, h('div', { class: 'grow' }, search)), list),
        h('div', { class: 'card' }, h('div', { class: 'bd col', style: { gap: '12px' } },
          h('div', { class: 'field' }, h('label', null, t('Customer')), h('div', { class: 'row' }, customerSel, iconBtn('plus', t('New customer'), newCustomer))),
          lines,
          h('div', { class: 'grid g2' }, h('div', { class: 'field' }, h('label', null, t('Discount')), discount), h('div', { class: 'field' }, h('label', null, t('Sale date')), dateIn)),
          S.tax_enabled && S.tax_rate > 0 ? h('label', { class: 'check' }, exempt, t('Tax-exempt sale')) : null,
          tradeBox, totals,
          h('div', { class: 'grid g2' }, h('div', { class: 'field' }, h('label', null, t('Amount received')), paid), h('div', { class: 'field' }, h('label', null, t('Payment method')), method)),
          h('div', { class: 'field' }, h('label', null, t('Notes')), notes),
          completeBtn, h('div', { class: 'small muted', style: { textAlign: 'center' } }, t('Shortcut: Ctrl + Enter completes the sale'))))));
    root._onKey = e => { if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); complete(); } };
    drawTabs(); drawCustomers(); drawTrade(); drawCart(); drawList();
    if (params && params.mobile) { const m = mobiles.find(x => x.id === params.mobile); if (m) add('mobile', m); }
    if (params && params.used) { const x = used.find(u => u.id === params.used); if (x) { state.tab = 'used'; drawTabs(); add('used', x); } }
  },
};
