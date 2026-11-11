'use strict';
App.pages.settings = {
  title: 'Settings', icon: 'settings',
  async render(root, params) {
    let tab = (params && params.tab) || 'shop';
    const TABS = [['shop', t('Shop profile')], ['regional', t('Regional')], ['tax', t('Tax')], ['invoice', t('Invoice')], ['alerts', t('Alerts & backup')], ['security', t('Security')], ['license', t('Licence')], ['data', t('Demo data')], ['about', t('About')]];
    const tabsEl = h('div', { class: 'tabs', role: 'tablist' }), pane = h('div', { style: { maxWidth: '900px' } });
    const save = async (patch, msg) => { try { App.settings = await api('settings:update', patch); toast(msg || t('Settings saved.')); await applySettings(); return true; } catch (e) { fail(e); return false; } };
    const section = (title, sub, form, onSave, extra) => h('div', { class: 'card', style: { marginBottom: '14px' } }, h('div', { class: 'hd' }, h('div', null, h('h3', null, title), sub ? h('p', null, sub) : null)),
      h('div', { class: 'bd col', style: { gap: '16px' } }, form.el, extra || null, onSave ? h('div', null, btn(t('Save changes'), 'check', 'primary', () => { const v = form.validate(); if (v) return toast(v, 'err'); onSave(form.read(), form); })) : null));
    const S = () => App.settings;

    const panes = {
      shop() {
        let logo = S().shop_logo;
        const prev = h('div', { class: 'row' });
        const drawLogo = () => prev.replaceChildren(logo ? h('img', { src: logo, alt: '', style: { width: '64px', height: '64px', objectFit: 'contain', border: '1px solid var(--line)', borderRadius: '10px', background: '#fff' } }) : h('div', { class: 'muted small' }, t('No logo selected')),
          btn(t('Choose logo…'), 'upload', 'sm', async () => { try { const d = await api('settings:pickLogo'); if (d) { logo = d; drawLogo(); } } catch (e) { fail(e); } }), logo ? btn(t('Remove'), 'x', 'sm ghost', () => { logo = ''; drawLogo(); }) : null);
        drawLogo();
        const f = buildForm([{ name: 'shop_name', label: t('Shop name'), required: true }, { name: 'shop_tagline', label: t('Tagline') }, { name: 'shop_phone', label: t('Phone') }, { name: 'shop_email', label: t('Email'), type: 'email' },
          { name: 'shop_website', label: t('Website') }, { name: 'shop_address', label: t('Business address'), type: 'textarea', span: 2 }], S());
        return section(t('Shop profile'), t('Shown in the app and printed on invoices, receipts and statements.'), f, v => save({ ...v, shop_logo: logo }), h('div', { class: 'field' }, h('label', null, t('Shop logo')), prev, h('div', { class: 'hint' }, t('PNG, JPG or WebP, up to 1 MB.'))));
      },
      regional() {
        const sample = h('div', { class: 'note' });
        const f = buildForm([
          { name: 'country', label: t('Country'), type: 'select', options: Const.COUNTRIES.map(c => [c.iso, c.name]), onchange: (v, c) => { const co = Const.COUNTRIES.find(x => x.iso === v), cur = co && Const.CURRENCIES.find(x => x.code === co.currency); if (cur && c.currency_preset) { c.currency_preset.value = cur.code; c.currency_code.value = cur.code; c.currency_symbol.value = cur.symbol; c.decimals.value = cur.decimals; } upd(); } },
          { name: 'language', label: t('Language'), type: 'select', options: Const.LANGUAGES.map(l => [l.code, l.name]), hint: t('English is complete. Other languages are starter translations you can extend in the locales folder.') },
          { type: 'section', label: t('Currency') },
          { name: 'currency_preset', label: t('Currency'), type: 'select', options: [...Const.CURRENCIES.map(c => [c.code, `${c.code} — ${c.name} (${c.symbol})`]), ['custom', t('Custom currency…')]], value: Const.CURRENCIES.some(c => c.code === S().currency_code && c.symbol === S().currency_symbol) ? S().currency_code : 'custom',
            onchange: (v, c) => { const cur = Const.CURRENCIES.find(x => x.code === v); if (cur) { c.currency_code.value = cur.code; c.currency_symbol.value = cur.symbol; c.decimals.value = cur.decimals; } upd(); } },
          { name: 'currency_code', label: t('Currency code'), required: true, max: 8, onchange: () => upd() }, { name: 'currency_symbol', label: t('Currency symbol'), required: true, max: 8, onchange: () => upd() },
          { name: 'currency_position', label: t('Symbol position'), type: 'select', options: [['before', t('Before amount ($100)')], ['before_space', t('Before with space ($ 100)')], ['after', t('After amount (100$)')], ['after_space', t('After with space (100 $)')]], onchange: () => upd() },
          { name: 'decimals', label: t('Decimal precision'), type: 'select', options: [['0', '0'], ['1', '1'], ['2', '2'], ['3', '3']], onchange: () => upd() },
          { name: 'number_format', label: t('Number format'), type: 'select', options: Object.entries(Fmt.NUMBER_FORMATS).map(([k, v]) => [k, v.label]), onchange: () => upd() },
          { type: 'section', label: t('Date and time') },
          { name: 'date_format', label: t('Date format'), type: 'select', options: Fmt.DATE_FORMATS.map(d => [d, `${d}  (${Fmt.formatDate(today(), { date_format: d })})`]), onchange: () => upd() },
          { name: 'time_format', label: t('Time format'), type: 'select', options: [['12h', t('12-hour (2:30 PM)')], ['24h', t('24-hour (14:30)')]], onchange: () => upd() },
          { name: 'timezone', label: t('Time zone'), type: 'select', options: Const.TIMEZONES.map(z => [z, z === 'system' ? t('Same as this computer') : z.replace(/_/g, ' ')]), onchange: () => upd() },
          { name: 'week_start', label: t('First day of the week'), type: 'select', options: [['monday', t('Monday')], ['sunday', t('Sunday')], ['saturday', t('Saturday')]] },
        ], { ...S(), decimals: String(S().decimals) });
        const upd = () => { const v = f.read(); const s = { ...v, decimals: Number(v.decimals) }; sample.textContent = `${t('Preview')}:  ${Fmt.formatMoney(1234567.891, s)}   ·   ${Fmt.formatMoney(-49.5, s)}   ·   ${Fmt.formatDate(new Date().toISOString(), s)}  ${Fmt.formatTime(new Date(), s)}`; };
        upd();
        return section(t('Regional settings'), t('Currency, numbers, dates and language for your country. Nothing here is fixed to one region.'), f, async v => { const { currency_preset, ...rest } = v; const langChanged = rest.language !== S().language; if (await save(rest) && langChanged) { await bootstrap(); navigate('settings', { tab: 'regional' }); } }, sample);
      },
      tax() {
        const f = buildForm([{ name: 'tax_enabled', label: t('Charge tax on sales'), type: 'checkbox' },
          { name: 'tax_label', label: t('Tax name'), list: 'dl-tax', datalist: Const.TAX_LABELS, hint: t('For example VAT, GST, Sales Tax, IVA, TVA, MwSt — or your local name.') }, { name: 'tax_rate', label: t('Tax rate'), type: 'number', suffix: '%', hint: t('Your standard rate, for example 5, 7.5 or 20.') },
          { name: 'tax_mode', label: t('Prices are entered'), type: 'select', options: [['exclusive', t('Without tax — tax is added at checkout')], ['inclusive', t('With tax included — tax is shown inside the total')]] },
          { name: 'tax_id', label: t('Tax registration number'), hint: t('Printed on invoices when filled in (VAT no., GSTIN, TRN, EIN…).') }], S());
        return section(t('Tax settings'), t('You decide whether tax applies and how. Individual sales can be marked tax-exempt at checkout.'), f, v => save(v),
          h('div', { class: 'note warn' }, t('Tax rules differ by country, region and product. This software calculates tax from the settings you enter; it does not provide tax advice and cannot guarantee legal compliance. Please confirm your obligations with a qualified accountant or your tax authority.')));
      },
      invoice() {
        const f = buildForm([{ name: 'invoice_template', label: t('Default layout'), type: 'select', options: [['a4', t('A4 invoice')], ['thermal', t('Thermal receipt (80 mm)')]] }, { name: 'invoice_prefix', label: t('Invoice number prefix'), max: 12, hint: t('Next invoice: {n}', { n: (S().invoice_prefix || '') + String(S().invoice_next).padStart(6, '0') }) },
          { name: 'invoice_accent', label: t('Accent colour'), type: 'color' }, { name: 'invoice_show_logo', label: t('Print the shop logo'), type: 'checkbox', span: 1 },
          { name: 'invoice_footer', label: t('Thank-you message'), span: 2 }, { name: 'invoice_terms', label: t('Terms / return policy (optional)'), type: 'textarea', rows: 3, span: 2 }], S());
        return section(t('Invoice design'), t('Both layouts can be printed, saved as PDF or shared on WhatsApp from any invoice.'), f, v => save(v));
      },
      alerts() {
        const f = buildForm([{ name: 'low_stock_alerts', label: t('Show low-stock notifications'), type: 'checkbox' }, { name: 'low_stock_default', label: t('Default minimum stock level for new accessories'), type: 'int' }], S());
        return h('div', null, section(t('Low-stock alerts'), t('An accessory is “low” when its quantity reaches its own minimum level.'), f, v => save(v)),
          h('div', { class: 'card' }, h('div', { class: 'bd row between' }, h('div', null, h('b', null, t('Backup settings')), h('div', { class: 'small muted' }, t('Folder, automatic backups, restore, CSV import and export.'))), btn(t('Open Backup & Restore'), 'database', '', () => navigate('backup')))));
      },
      security() {
        const on = S().auth_enabled;
        const f = buildForm([on ? { name: 'current', label: t('Current password'), type: 'password', required: true, span: 2 } : null, { name: 'password', label: on ? t('New password') : t('Password'), type: 'password', hint: on ? t('Leave empty to remove the password.') : t('At least 4 characters.') }, { name: 'confirm', label: t('Confirm password'), type: 'password' }].filter(Boolean), {});
        return h('div', null, section(t('Password protection'), on ? t('A password is required to open the app, void sales and restore backups.') : t('Optional. When set, a password is required to open the app, void sales and restore backups.'), f, async v => {
          if (v.password !== v.confirm) return toast(t('The passwords do not match.'), 'err');
          if (!on && !v.password) return toast(t('Enter a password.'), 'err');
          try { await api('auth:setPassword', { current: v.current, password: v.password }); App.settings = await api('settings:get'); toast(v.password ? t('Password saved.') : t('Password removed.')); navigate('settings', { tab: 'security' }); } catch (e) { fail(e); }
        }, h('div', { class: 'note warn' }, t('There is no password recovery: the password is stored only on this computer in encrypted (hashed) form. Keep it somewhere safe.'))),
        on ? h('div', { class: 'card' }, h('div', { class: 'bd row between' }, h('div', null, h('b', null, t('Lock now')), h('div', { class: 'small muted' }, t('Return to the sign-in screen.'))), btn(t('Lock'), 'lock', '', async () => { await api('auth:lock'); bootstrap(); }))) : null,
        h('div', { class: 'card', style: { marginTop: '14px' } }, h('div', { class: 'bd' }, h('b', null, t('How your data is protected')), h('ul', { class: 'small', style: { color: 'var(--ink-2)', lineHeight: 1.7, margin: '8px 0 0', paddingInlineStart: '18px' } },
          [t('All business data is stored only on this computer, in a local database file.'), t('Nothing is uploaded. The only internet request the app ever makes is the licence check, which sends just the licence key.'), t('Completed sales cannot be deleted — only voided with a reason, which keeps the full history.'), t('Backups are ordinary files you control. Store copies somewhere safe.')].map(x => h('li', null, x))))));
      },
      license() {
        const L = App.license;
        const color = { active: 'green', trial: 'blue', unconfigured: '', trial_expired: 'red', revoked: 'red', verification_needed: 'amber' }[L.mode];
        const name = { active: t('Licensed'), trial: t('Trial'), unconfigured: t('Licensing not enabled in this build'), trial_expired: t('Trial ended'), revoked: t('Licence not valid'), verification_needed: t('Verification needed') }[L.mode];
        const key = h('input', { class: 'input', placeholder: 'XXXXXXXX-XXXXXXXX-XXXXXXXX-XXXXXXXX', spellcheck: false, autocomplete: 'off' });
        const go = async b => { const v = key.value.trim(); if (!v) return key.focus(); b.disabled = true; try { App.license = await api('license:activate', { key: v }); toast(t('Thank you! The software is activated.')); await applySettings(); navigate('settings', { tab: 'license' }); } catch (e) { fail(e); b.disabled = false; } };
        return h('div', null, h('div', { class: 'card', style: { marginBottom: '14px' } }, h('div', { class: 'hd' }, h('div', null, h('h3', null, t('Licence status')), h('p', null, t(L.message || ''))), badge(name, color)),
          h('div', { class: 'bd col', style: { gap: '14px' } }, kv([[t('Licence key'), L.key_masked], [t('Registered email'), L.email], [t('Activated'), L.activated_at ? fdatetime(new Date(L.activated_at).toISOString()) : ''], [t('Last verified online'), L.last_verified_at ? fdatetime(new Date(L.last_verified_at).toISOString()) : ''],
            L.mode === 'active' ? [t('Offline allowance'), t('{n} days remaining before the next online check is required', { n: L.grace_days_left })] : null, L.last_error ? [t('Last check'), t(L.last_error)] : null]),
            L.configured && L.key_masked ? h('div', { class: 'row' }, btn(t('Verify now'), 'refresh', '', async e => { try { App.license = await api('license:verify'); await applySettings(); toast(App.license.restricted ? t(App.license.message) : t('Licence verified.'), App.license.restricted ? 'warn' : 'ok'); navigate('settings', { tab: 'license' }); } catch (er) { fail(er); } }),
              btn(t('Remove licence from this computer'), 'x', 'ghost', async () => { const v = await confirmDialog({ title: t('Remove licence?'), text: t('The licence key will be removed from this computer so it can be used on another one. Your business data is not affected.'), danger: true, confirmLabel: t('Remove'), fields: await adminFields() }); if (!v) return; try { App.license = await api('license:deactivate', { password: v.password }); await applySettings(); navigate('settings', { tab: 'license' }); } catch (e) { fail(e); } })) : null)),
          L.configured && L.mode !== 'active' ? h('div', { class: 'card', style: { marginBottom: '14px' } }, h('div', { class: 'hd' }, h('div', null, h('h3', null, t('Activate software')), h('p', null, t('Enter the licence key from your Gumroad receipt email. Activation needs an internet connection once.')))),
            h('div', { class: 'bd col' }, h('div', { class: 'row' }, key, (() => { const b = btn(t('Activate'), 'key', 'primary', () => go(b)); key.addEventListener('keydown', e => { if (e.key === 'Enter') go(b); }); return b; })()),
              L.purchaseUrl ? h('div', { class: 'small muted' }, t('No licence yet?'), ' ', h('a', { href: '#', onclick: e => { e.preventDefault(); api('shell:purchase').catch(fail); } }, t('Buy Mobile Shop Manager Pro'))) : null)) : null,
          h('div', { class: 'note' }, t('The app works offline. After activation it re-checks the licence quietly when the internet is available and allows up to {n} days without any check. Whatever the licence status, your data can always be viewed, printed, exported and backed up.', { n: L.graceDays })));
      },
      data() {
        return h('div', { class: 'card' }, h('div', { class: 'hd' }, h('div', null, h('h3', null, t('Demo data')), h('p', null, t('Sample phones, accessories, customers, sales and expenses to help you explore the app.')))),
          h('div', { class: 'bd col' }, App.hasDemo ? [h('div', { class: 'note' }, t('Only records created as demo data are removed. Anything you added yourself — and any demo item used in one of your real sales — is kept.')),
            h('div', null, btn(t('Remove demo data'), 'trash', 'danger', async () => { if (!await confirmDialog({ title: t('Remove demo data?'), text: t('All sample records will be removed. Your own customers, stock and transactions are not affected.'), danger: true, confirmLabel: t('Remove demo data') })) return;
              try { await api('demo:remove'); App.hasDemo = false; toast(t('Demo data removed.')); refreshBadges(); navigate('settings', { tab: 'data' }); } catch (e) { fail(e); } }))]
            : [h('div', { class: 'muted' }, t('There is no demo data in your database.')), S().demo_loaded ? null : h('div', null, btn(t('Load demo data'), 'download', '', async () => { try { await api('demo:load'); App.hasDemo = true; App.settings = await api('settings:get'); toast(t('Demo data loaded.')); navigate('settings', { tab: 'data' }); } catch (e) { fail(e); } }))]));
      },
      about() { return h('div', { class: 'card' }, h('div', { class: 'bd' }, aboutContent())); },
    };
    const draw = () => { tabsEl.replaceChildren(...TABS.map(([k, lb]) => h('button', { class: k === tab ? 'active' : '', role: 'tab', onclick: () => { tab = k; draw(); } }, lb))); pane.replaceChildren(panes[tab]()); };
    root.append(pageHead(t('Settings'), t('Shop profile, regional formats, tax, invoices, security and licence.')), tabsEl, pane);
    draw();
  },
};
function aboutContent() {
  const i = App.info;
  return h('div', { class: 'about col', style: { alignItems: 'center', gap: '6px' } }, h('img', { src: 'assets/logo.svg', alt: '' }), h('h2', null, 'Mobile Shop Manager Pro'), h('div', { class: 'muted' }, t('Version {v}', { v: i.version })),
    h('p', { style: { maxWidth: '460px', color: 'var(--ink-2)' } }, t('Offline-first inventory, sales, credit and reporting software for mobile phone retailers worldwide.')),
    i.dataFolder ? h('div', { style: { textAlign: 'start', width: '100%', maxWidth: '560px', marginTop: '8px' } }, kv([[t('Data folder'), i.dataFolder], [t('Backup folder'), i.backupFolder], [t('Edition'), i.portable ? t('Portable') : t('Installed')], [t('Platform'), `${i.platform} · Electron ${i.electron} · SQLite ${i.sqlite}`],
      App.license.supportEmail ? [t('Support'), h('a', { href: '#', onclick: e => { e.preventDefault(); api('shell:email', App.license.supportEmail).catch(fail); } }, App.license.supportEmail)] : null])) : null,
    h('div', { class: 'small muted', style: { marginTop: '10px' } }, `© ${i.year} Mobile Shop Manager Pro. ${t('All rights reserved.')}`));
}
