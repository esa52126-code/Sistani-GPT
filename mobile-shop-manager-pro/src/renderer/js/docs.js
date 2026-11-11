'use strict';
/* Printable documents (invoice, receipt, statement, report). Built as escaped HTML strings so the
 * same markup is used for on-screen preview, printing and PDF. */
const Docs = (() => {
  const S = () => App.settings;
  const CSS = accent => `
  @page { size: A4; margin: 0 }
  .doc{font-family:"Segoe UI",Inter,system-ui,-apple-system,"Helvetica Neue","Noto Sans",Arial,sans-serif;color:#0f172a;font-size:12.5px;line-height:1.45;background:#fff;padding:14mm 14mm 12mm;box-sizing:border-box;width:210mm;min-height:296mm;margin:0 auto}
  .doc *{box-sizing:border-box}
  .doc .hd{display:flex;justify-content:space-between;gap:20px;align-items:flex-start;border-bottom:3px solid ${accent};padding-bottom:14px;margin-bottom:16px}
  .doc .shop{display:flex;gap:14px;align-items:center}.doc .shop img{max-width:74px;max-height:74px;border-radius:8px}
  .doc .shop h1{margin:0;font-size:21px;letter-spacing:-.01em}.doc .shop p{margin:1px 0;color:#475569;font-size:11.5px}
  .doc .ttl{text-align:end}.doc .ttl h2{margin:0;font-size:24px;color:${accent};letter-spacing:.04em;text-transform:uppercase}.doc .ttl p{margin:2px 0;font-size:12px;color:#475569}.doc .ttl b{color:#0f172a}
  .doc .two{display:flex;justify-content:space-between;gap:24px;margin-bottom:16px}.doc .two h4{margin:0 0 4px;font-size:10.5px;text-transform:uppercase;letter-spacing:.08em;color:#8492a6}.doc .two p{margin:1px 0}
  .doc table{width:100%;border-collapse:collapse}.doc th{background:${accent};color:#fff;text-align:start;font-size:10.5px;text-transform:uppercase;letter-spacing:.05em;padding:7px 9px}
  .doc td{padding:7px 9px;border-bottom:1px solid #e5e9f2;vertical-align:top}.doc .r{text-align:end;white-space:nowrap;font-variant-numeric:tabular-nums}
  .doc td small{display:block;color:#64748b;font-size:10.5px}.doc tr.b td{font-weight:700;background:#f8fafc}
  .doc .sum{display:flex;justify-content:space-between;gap:24px;margin-top:14px}.doc .sum .l{flex:1;font-size:11.5px;color:#475569}
  .doc .sum table{width:280px}.doc .sum td{border:0;padding:4px 9px}.doc .sum tr.g td{font-size:15px;font-weight:800;border-top:2px solid #0f172a;padding-top:8px}.doc .sum tr.d td{font-weight:700;color:#b91c1c}
  .doc .stamp{display:inline-block;border:2px solid;border-radius:6px;padding:2px 10px;font-weight:800;letter-spacing:.08em;font-size:12px;margin-top:6px}.doc .paid{color:#15803d}.doc .due{color:#b91c1c}.doc .void{color:#b91c1c}
  .doc .ft{margin-top:26px;padding-top:12px;border-top:1px solid #e5e9f2;text-align:center;color:#475569;font-size:11.5px}.doc .ft b{display:block;color:#0f172a;font-size:13px;margin-bottom:3px}
  .doc .terms{white-space:pre-wrap;font-size:10.5px;color:#64748b;margin-top:8px}
  .doc.land{width:297mm;min-height:209mm}.doc.rep td,.doc.rep th{padding:5px 7px;font-size:11px}
  .doc.th{width:80mm;min-height:0;padding:4mm 4mm 6mm;font-size:11px;font-family:"Segoe UI",Arial,sans-serif}
  .doc.th h1{font-size:15px;text-align:center;margin:4px 0 0}.doc.th .c{text-align:center}.doc.th p{margin:1px 0}.doc.th img{max-width:34mm;max-height:20mm;display:block;margin:0 auto}
  .doc.th hr{border:0;border-top:1px dashed #000;margin:6px 0}.doc.th table td{border:0;padding:2px 0;font-size:11px}.doc.th .g td{font-weight:800;font-size:13px}
  [dir=rtl] .doc .ttl{text-align:start}`;
  const shopLines = () => { const s = S(); return [s.shop_address, [s.shop_phone, s.shop_email].filter(Boolean).join(' · '), s.shop_website, s.tax_id ? `${s.tax_label || t('Tax')} ${t('No.')}: ${s.tax_id}` : ''].filter(Boolean); };
  const header = (title, lines) => { const s = S(); return `<div class="hd"><div class="shop">${s.invoice_show_logo && s.shop_logo ? `<img src="${esc(s.shop_logo)}" alt="">` : ''}<div><h1>${esc(s.shop_name)}</h1>${s.shop_tagline ? `<p>${esc(s.shop_tagline)}</p>` : ''}${shopLines().map(l => `<p>${esc(l)}</p>`).join('')}</div></div>
    <div class="ttl"><h2>${esc(title)}</h2>${lines.map(l => `<p>${esc(l[0])}: <b>${esc(l[1])}</b></p>`).join('')}</div></div>`; };
  const methodName = m => label(Const.PAYMENT_METHOD_LABELS, m);
  const taxName = sale => (sale.tax_label || t('Tax')) + (sale.tax_rate ? ` (${Fmt.formatNumber(sale.tax_rate, S(), sale.tax_rate % 1 ? 2 : 0)}%)` : '');
  const custPhone = sale => [sale.customer_phone_code, sale.customer_phone].filter(Boolean).join(' ');

  function invoiceA4(sale) {
    const rem = Fmt.round(sale.grand_total - sale.paid_amount, S().decimals);
    const rows = sale.items.map((i, n) => `<tr><td>${n + 1}</td><td><b>${esc(i.description)}</b>${i.imei ? `<small>IMEI: ${esc(i.imei)}</small>` : ''}</td><td class="r">${i.quantity}</td><td class="r">${esc(money(i.unit_price))}</td><td class="r">${esc(money(i.line_total))}</td></tr>`).join('');
    const pays = sale.payments.map(p => `<p>${esc(fdate(p.payment_date))} · ${esc(methodName(p.method))}: <b>${esc(money(p.amount))}</b></p>`).join('');
    const stamp = sale.status === 'voided' ? `<span class="stamp void">${esc(t('VOID'))}</span>` : rem <= 0 ? `<span class="stamp paid">${esc(t('PAID'))}</span>` : `<span class="stamp due">${esc(t('BALANCE DUE'))}</span>`;
    return `<div class="doc">${header(t('Invoice'), [[t('Invoice No.'), sale.invoice_no], [t('Date'), fdate(sale.sale_date)]])}
      <div class="two"><div><h4>${esc(t('Bill to'))}</h4><p><b>${esc(sale.customer_name || t('Walk-in customer'))}</b></p>${custPhone(sale) ? `<p>${esc(custPhone(sale))}</p>` : ''}${sale.customer_email ? `<p>${esc(sale.customer_email)}</p>` : ''}${sale.customer_address ? `<p>${esc(sale.customer_address)}</p>` : ''}</div>
      <div style="text-align:end"><h4>${esc(t('Payment'))}</h4><p>${esc(t('Method'))}: <b>${esc(methodName(sale.payment_method))}</b></p>${stamp}</div></div>
      <table><thead><tr><th style="width:30px">#</th><th>${esc(t('Description'))}</th><th class="r">${esc(t('Qty'))}</th><th class="r">${esc(t('Unit price'))}</th><th class="r">${esc(t('Amount'))}</th></tr></thead><tbody>${rows}</tbody></table>
      <div class="sum"><div class="l">${pays ? `<b>${esc(t('Payments received'))}</b>${pays}` : ''}${sale.trade_in ? `<p style="margin-top:6px">${esc(t('Trade-in received'))}: <b>${esc(sale.trade_in.brand + ' ' + sale.trade_in.model)}</b>${sale.trade_in.imei ? ' · IMEI ' + esc(sale.trade_in.imei) : ''}</p>` : ''}${sale.notes ? `<p style="margin-top:6px">${esc(t('Notes'))}: ${esc(sale.notes)}</p>` : ''}
      ${sale.tax_mode === 'exempt' ? `<p style="margin-top:6px">${esc(t('Tax-exempt sale'))}</p>` : ''}${sale.tax_mode === 'inclusive' ? `<p style="margin-top:6px">${esc(t('Prices include {tax}', { tax: taxName(sale) }))}</p>` : ''}</div>
      <table><tr><td>${esc(t('Subtotal'))}</td><td class="r">${esc(money(sale.subtotal))}</td></tr>
      ${sale.discount > 0 ? `<tr><td>${esc(t('Discount'))}</td><td class="r">-${esc(money(sale.discount))}</td></tr>` : ''}
      ${sale.tax_mode === 'exclusive' || sale.tax_mode === 'inclusive' ? `<tr><td>${esc(taxName(sale))}${sale.tax_mode === 'inclusive' ? ' ' + esc(t('(included)')) : ''}</td><td class="r">${esc(money(sale.tax_amount))}</td></tr>` : ''}
      <tr class="g"><td>${esc(t('Grand total'))}</td><td class="r">${esc(money(sale.grand_total))}</td></tr>
      <tr><td>${esc(t('Amount paid'))}</td><td class="r">${esc(money(sale.paid_amount))}</td></tr>
      <tr class="${rem > 0 ? 'd' : ''}"><td>${esc(t('Remaining balance'))}</td><td class="r">${esc(money(rem))}</td></tr></table></div>
      <div class="ft"><b>${esc(S().invoice_footer || '')}</b>${S().invoice_terms ? `<div class="terms">${esc(S().invoice_terms)}</div>` : ''}</div></div>`;
  }
  function invoiceThermal(sale) {
    const s = S(), rem = Fmt.round(sale.grand_total - sale.paid_amount, s.decimals);
    const rows = sale.items.map(i => `<tr><td>${esc(i.description)}${i.imei ? `<br><small>IMEI ${esc(i.imei)}</small>` : ''}<br>${i.quantity} × ${esc(money(i.unit_price))}</td><td class="r">${esc(money(i.line_total))}</td></tr>`).join('');
    return `<div class="doc th">${s.invoice_show_logo && s.shop_logo ? `<img src="${esc(s.shop_logo)}" alt="">` : ''}<h1>${esc(s.shop_name)}</h1><div class="c">${shopLines().map(l => `<p>${esc(l)}</p>`).join('')}</div><hr>
      <p>${esc(t('Invoice No.'))}: <b>${esc(sale.invoice_no)}</b></p><p>${esc(t('Date'))}: ${esc(fdate(sale.sale_date))}</p><p>${esc(t('Customer'))}: ${esc(sale.customer_name || t('Walk-in customer'))}</p>${sale.status === 'voided' ? `<p><b>*** ${esc(t('VOID'))} ***</b></p>` : ''}<hr>
      <table>${rows}</table><hr><table><tr><td>${esc(t('Subtotal'))}</td><td class="r">${esc(money(sale.subtotal))}</td></tr>
      ${sale.discount > 0 ? `<tr><td>${esc(t('Discount'))}</td><td class="r">-${esc(money(sale.discount))}</td></tr>` : ''}
      ${sale.tax_mode === 'exclusive' || sale.tax_mode === 'inclusive' ? `<tr><td>${esc(taxName(sale))}${sale.tax_mode === 'inclusive' ? ' ' + esc(t('(included)')) : ''}</td><td class="r">${esc(money(sale.tax_amount))}</td></tr>` : ''}
      <tr class="g"><td>${esc(t('Grand total'))}</td><td class="r">${esc(money(sale.grand_total))}</td></tr><tr><td>${esc(t('Amount paid'))} (${esc(methodName(sale.payment_method))})</td><td class="r">${esc(money(sale.paid_amount))}</td></tr>
      <tr><td><b>${esc(t('Remaining balance'))}</b></td><td class="r"><b>${esc(money(rem))}</b></td></tr></table><hr><p class="c"><b>${esc(s.invoice_footer || '')}</b></p></div>`;
  }
  function receipt(customer, pay) {
    return `<div class="doc">${header(t('Payment receipt'), [[t('Receipt No.'), pay.receipt_no], [t('Date'), fdate(pay.date || today())]])}
      <div class="two"><div><h4>${esc(t('Received from'))}</h4><p><b>${esc(customer.name)}</b></p><p>${esc([customer.phone_code, customer.phone].filter(Boolean).join(' '))}</p></div></div>
      <table><thead><tr><th>${esc(t('Applied to invoice'))}</th><th class="r">${esc(t('Amount'))}</th></tr></thead><tbody>${pay.applied.map(a => `<tr><td>${esc(a.invoice_no)}</td><td class="r">${esc(money(a.amount))}</td></tr>`).join('')}</tbody></table>
      <div class="sum"><div class="l">${esc(t('Method'))}: <b>${esc(methodName(pay.method))}</b></div><table><tr class="g"><td>${esc(t('Amount received'))}</td><td class="r">${esc(money(pay.amount))}</td></tr><tr class="${pay.balance > 0 ? 'd' : ''}"><td>${esc(t('Remaining balance'))}</td><td class="r">${esc(money(pay.balance))}</td></tr></table></div>
      <div class="ft"><b>${esc(S().invoice_footer || '')}</b></div></div>`;
  }
  function statement(st) {
    const c = st.customer;
    const typeName = { sale: t('Sale'), payment: t('Payment'), void: t('Void'), adjustment: t('Adjustment') };
    const rows = st.entries.map(e => `<tr><td>${esc(fdate(e.entry_date))}</td><td>${esc(typeName[e.entry_type] || e.entry_type)}</td><td>${esc(e.description)}</td><td class="r">${e.debit ? esc(money(e.debit)) : ''}</td><td class="r">${e.credit ? esc(money(e.credit)) : ''}</td><td class="r">${esc(money(e.balance))}</td></tr>`).join('');
    return `<div class="doc">${header(t('Statement'), [[t('Date'), fdate(today())]])}
      <div class="two"><div><h4>${esc(t('Customer'))}</h4><p><b>${esc(c.name)}</b></p><p>${esc([c.phone_code, c.phone].filter(Boolean).join(' '))}</p>${c.email ? `<p>${esc(c.email)}</p>` : ''}${c.address ? `<p>${esc(c.address)}</p>` : ''}</div>
      <div style="text-align:end"><h4>${esc(t('Outstanding balance'))}</h4><p style="font-size:20px;font-weight:800">${esc(money(st.closing))}</p></div></div>
      <table><thead><tr><th>${esc(t('Date'))}</th><th>${esc(t('Type'))}</th><th>${esc(t('Description'))}</th><th class="r">${esc(t('Charges'))}</th><th class="r">${esc(t('Payments'))}</th><th class="r">${esc(t('Balance'))}</th></tr></thead>
      <tbody>${st.opening ? `<tr class="b"><td colspan="5">${esc(t('Opening balance'))}</td><td class="r">${esc(money(st.opening))}</td></tr>` : ''}${rows || `<tr><td colspan="6">${esc(t('No transactions.'))}</td></tr>`}
      <tr class="b"><td colspan="3">${esc(t('Totals'))}</td><td class="r">${esc(money(st.total_debit))}</td><td class="r">${esc(money(st.total_credit))}</td><td class="r">${esc(money(st.closing))}</td></tr></tbody></table>
      <div class="ft"><b>${esc(S().invoice_footer || '')}</b></div></div>`;
  }
  /** Generic tabular report. cells: array of arrays of {text, num} */
  function table(title, subtitle, columns, rows, totals) {
    const wide = columns.length > 7;
    return `<div class="doc rep ${wide ? 'land' : ''}">${header(title, [[t('Printed'), fdate(today())]].concat(subtitle ? [[t('Period'), subtitle]] : []))}
      <table><thead><tr>${columns.map(c => `<th class="${c.num ? 'r' : ''}">${esc(c.label)}</th>`).join('')}</tr></thead><tbody>
      ${rows.map(r => `<tr class="${r.bold ? 'b' : ''}">${r.cells.map((c, i) => `<td class="${columns[i].num ? 'r' : ''}">${esc(c)}</td>`).join('')}</tr>`).join('') || `<tr><td colspan="${columns.length}">${esc(t('No data for this period.'))}</td></tr>`}
      ${totals ? `<tr class="b">${totals.map((c, i) => `<td class="${columns[i].num ? 'r' : ''}">${esc(c)}</td>`).join('')}</tr>` : ''}</tbody></table></div>`;
  }
  const full = (body, { thermal, landscape, title } = {}) => `<!doctype html><html lang="${esc(S().language)}" dir="${document.documentElement.dir}"><head><meta charset="utf-8">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; style-src 'unsafe-inline'"><title>${esc(title || '')}</title>
    <style>html,body{margin:0;padding:0;background:#fff}${CSS(S().invoice_accent)}${thermal ? '@page{size:80mm auto;margin:0}' : landscape ? '@page{size:A4 landscape;margin:0}' : ''}</style></head><body>${body}</body></html>`;

  function whatsappText(sale) {
    const s = S(), rem = Fmt.round(sale.grand_total - sale.paid_amount, s.decimals);
    const lines = [t('Hello {name},', { name: sale.customer_name || t('Customer') }), '', t('Thank you for your purchase from {shop}.', { shop: s.shop_name }), '', `${t('Invoice No.')}: ${sale.invoice_no}`, `${t('Date')}: ${fdate(sale.sale_date)}`];
    for (const i of sale.items) lines.push(`• ${i.quantity > 1 ? i.quantity + ' × ' : ''}${i.description}${i.imei ? ` (IMEI: ${i.imei})` : ''}`);
    lines.push('', `${t('Total')}: ${money(sale.grand_total)}`, `${t('Paid')}: ${money(sale.paid_amount)}`, `${t('Remaining')}: ${money(rem)}`, '', s.shop_name + (s.shop_phone ? ' · ' + s.shop_phone : ''));
    return lines.join('\n');
  }

  /** Preview modal with Print / PDF (and optional extra buttons). */
  function preview({ title, body, name, thermal = false, landscape = false, extra = [], switcher }) {
    const host = h('div', { style: { background: '#e2e8f0', padding: '18px', borderRadius: '10px', overflow: 'auto', maxHeight: '64vh' } });
    const shadow = host.attachShadow({ mode: 'open' });
    let cur = { body, thermal };
    const paint = () => { shadow.innerHTML = `<style>${CSS(S().invoice_accent)} .doc{box-shadow:0 4px 24px rgba(15,23,42,.18);zoom:${cur.thermal ? 1.15 : 0.82}}</style>${cur.body}`; };
    paint();
    const payload = () => { const el = shadow.querySelector('.doc'); return { html: full(cur.body, { thermal: cur.thermal, landscape, title }), name, thermal: cur.thermal, landscape, heightIn: cur.thermal ? (el.scrollHeight / 96 + 0.3) : undefined }; };
    const doPrint = async () => { try { await api('print:html', payload()); } catch (e) { fail(e); } };
    const doPdf = async () => { try { const f = await api('print:pdf', payload()); if (f) toast(t('Saved to {file}', { file: f })); } catch (e) { fail(e); } };
    let seg = null;
    if (switcher) { seg = h('div', { class: 'seg grow' }, switcher.map((o, i) => h('button', { class: (o.thermal === thermal ? 'active' : ''), onclick: e => { cur = { body: o.body, thermal: o.thermal }; [...seg.children].forEach(b => b.classList.remove('active')); e.target.classList.add('active'); paint(); } }, o.label))); }
    const m = modal({ title, size: 'lg', body: host, footer: [seg, ...extra, btn(t('Save as PDF'), 'pdf', '', doPdf), btn(t('Print'), 'print', 'primary', doPrint)] });
    return m;
  }
  async function showInvoice(saleId) {
    const sale = await api('sales:get', saleId);
    const a4 = invoiceA4(sale), th = invoiceThermal(sale), thermal = S().invoice_template === 'thermal';
    const wa = btn('WhatsApp', 'chat', 'success', async () => {
      try { await api('shell:whatsapp', { phone: (sale.customer_phone_code || '') + (sale.customer_phone || ''), text: whatsappText(sale) }); } catch (e) { fail(e); }
    });
    return preview({ title: `${t('Invoice')} ${sale.invoice_no}`, body: thermal ? th : a4, thermal, name: sale.invoice_no, extra: [wa],
      switcher: [{ label: t('A4 invoice'), body: a4, thermal: false }, { label: t('Thermal receipt'), body: th, thermal: true }] });
  }
  return { invoiceA4, invoiceThermal, receipt, statement, table, full, preview, showInvoice, whatsappText };
})();
