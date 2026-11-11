'use strict';
/* Application shell: boot, navigation, top bar, global search, notifications, shortcuts. */
const NAV = [['dashboard', 'Dashboard'], ['mobiles', 'Mobile Inventory'], ['accessories', 'Accessories'], ['newsale', 'New Sale'], ['sales', 'Sales History'], ['customers', 'Customers'], ['credit', 'Credit Book'],
  ['exchanges', 'Exchange / Used Stock'], ['expenses', 'Expenses'], ['suppliers', 'Suppliers'], ['reports', 'Reports'], ['backup', 'Backup & Restore'], ['settings', 'Settings']];
let contentEl = null, navEl = null, clockTimer = null, notifications = [];

async function navigate(name, params) {
  if (!App.pages[name]) name = 'dashboard';
  App.current = name;
  document.querySelectorAll('#modals > .overlay').forEach(o => o._close());
  if (navEl) [...navEl.querySelectorAll('button')].forEach(b => b.classList.toggle('active', b.dataset.page === name));
  const root = h('div');
  try { await App.pages[name].render(root, params || {}); }
  catch (e) { root.replaceChildren(h('div', { class: 'card' }, h('div', { class: 'empty' }, icon('alert'), h('b', null, t('This page could not be loaded')), t(e.message || '')))); }
  if (App.current !== name) return;
  contentEl.replaceChildren(root); contentEl.scrollTop = 0; contentEl._page = root;
  document.title = `${t(App.pages[name].title)} — Mobile Shop Manager Pro`;
}

async function refreshBadges() {
  try { notifications = await api('notify:list'); } catch (_) { notifications = []; }
  const b = document.getElementById('bell-dot');
  if (b) { b.textContent = notifications.length; b.classList.toggle('hidden', !notifications.length); }
  const low = notifications.filter(n => n.type === 'low_stock').length, c = document.getElementById('nav-low');
  if (c) { c.textContent = low; c.classList.toggle('hidden', !low); }
}

/** Re-reads settings-dependent chrome (direction, banner, profile, currency chip). */
async function applySettings() {
  const lang = Const.LANGUAGES.find(l => l.code === App.settings.language) || Const.LANGUAGES[0];
  document.documentElement.lang = lang.code; document.documentElement.dir = lang.rtl ? 'rtl' : 'ltr';
  const set = (id, fn) => { const el = document.getElementById(id); if (el) fn(el); };
  set('shop-name', el => { el.textContent = App.settings.shop_name; });
  set('shop-av', el => el.replaceChildren(App.settings.shop_logo ? h('img', { src: App.settings.shop_logo, alt: '' }) : (App.settings.shop_name || 'M').trim().charAt(0).toUpperCase()));
  set('cur-chip', el => { el.textContent = `${App.settings.currency_code} · ${App.settings.currency_symbol}`; });
  set('lic-pill', el => { const L = App.license; el.textContent = { active: t('Licensed'), trial: t('Trial') + (L.trial_days_left ? ` · ${L.trial_days_left}d` : ''), unconfigured: '', trial_expired: t('Trial ended'), revoked: t('Not licensed'), verification_needed: t('Verify licence') }[L.mode] || ''; el.className = 'pill ' + (L.restricted ? 'bad' : L.mode === 'trial' ? 'warn' : '') + (L.mode === 'unconfigured' ? ' hidden' : ''); });
  set('banner', el => { const L = App.license; el.className = 'banner ' + (L.restricted ? 'bad' : 'info') + (L.restricted || (L.mode === 'trial' && L.trial_days_left <= 5) ? '' : ' hidden');
    el.replaceChildren(icon(L.restricted ? 'alert' : 'info'), h('span', { class: 'grow' }, t(L.message || '')), btn(L.mode === 'verification_needed' ? t('Verify now') : t('Enter licence key'), 'key', 'sm', () => navigate('settings', { tab: 'license' }))); });
  tickClock(); refreshBadges();
}
function tickClock() { const el = document.getElementById('clock'); if (el) el.replaceChildren(h('b', null, Fmt.formatTime(new Date(), App.settings)), h('span', null, fdate(new Date().toISOString()))); }

function buildShell() {
  navEl = h('nav', { class: 'nav', 'aria-label': t('Main menu') }, NAV.map(([p, title], i) => [i === 3 || i === 8 || i === 11 ? h('div', { class: 'sep' }) : null,
    h('button', { 'data-page': p, class: p === 'newsale' ? 'primary' : '', title: i < 9 ? `Ctrl+${i + 1}` : '', onclick: () => navigate(p) }, icon(App.pages[p].icon), h('span', null, t(title)), p === 'accessories' ? h('span', { id: 'nav-low', class: 'count hidden', title: t('Low-stock products') }) : null)]));
  // ---- global search ----
  const results = h('div', { class: 'results hidden', role: 'listbox' });
  const input = h('input', { id: 'global-search', type: 'search', placeholder: t('Search customers, IMEI, models, invoices, accessories, suppliers…'), 'aria-label': t('Global search'), autocomplete: 'off' });
  let timer = null, items = [], sel = -1, seq = 0;
  const open = r => { results.classList.add('hidden'); input.value = ''; if (r.page === 'sales') navigate('sales', { open: r.id, q: r.title }); else if (r.page === 'accessories' || r.page === 'exchanges') navigate(r.page, { q: r.page === 'accessories' ? r.title : r.subtitle.split(' ')[0] }); else navigate(r.page, { open: r.id }); };
  const paint = () => { let last = ''; results.replaceChildren(...items.flatMap((r, i) => { const out = []; if (r.group !== last) { last = r.group; out.push(h('h5', null, t(r.group))); }
      out.push(h('button', { class: i === sel ? 'sel' : '', role: 'option', onclick: () => open(r) }, h('div', { class: 'grow' }, h('div', { class: 't' }, r.title), h('div', { class: 's' }, r.subtitle)), r.badge ? statusBadge(r.badge, { ...Const.MOBILE_STATUS_LABELS, ...Const.USED_STATUS_LABELS }) : null)); return out; }));
    if (!items.length) results.append(h('div', { class: 'empty', style: { padding: '22px' } }, t('No results. Try a name, phone number, IMEI, invoice number or stock ID.'))); results.classList.remove('hidden'); };
  input.addEventListener('input', () => { clearTimeout(timer); const q = input.value.trim(); if (q.length < 2) { results.classList.add('hidden'); return; } timer = setTimeout(async () => { const my = ++seq; try { const r = await api('search:query', q); if (my !== seq) return; items = r; sel = r.length ? 0 : -1; paint(); } catch (_) { /* ignore */ } }, 140); });
  input.addEventListener('keydown', e => { if (results.classList.contains('hidden')) return; if (e.key === 'ArrowDown') { sel = Math.min(sel + 1, items.length - 1); paint(); e.preventDefault(); } else if (e.key === 'ArrowUp') { sel = Math.max(sel - 1, 0); paint(); e.preventDefault(); } else if (e.key === 'Enter' && items[sel]) open(items[sel]); else if (e.key === 'Escape') { results.classList.add('hidden'); input.blur(); e.stopPropagation(); } });
  // ---- notifications ----
  const pop = h('div', { class: 'pop hidden' });
  const togglePop = () => { if (!pop.classList.contains('hidden')) return pop.classList.add('hidden');
    pop.replaceChildren(h('h4', null, t('Notifications')), ...(notifications.length ? notifications.map(n => h('div', { class: 'n ' + n.level, onclick: () => { pop.classList.add('hidden'); navigate(n.page, n.type === 'low_stock' ? { low: true } : n.type === 'license' ? { tab: 'license' } : {}); } }, h('i'), h('div', null, h('b', null, n.type === 'low_stock' ? n.title : t(n.title)), h('div', { class: 'small muted' }, t(n.text)))))
      : [h('div', { class: 'empty', style: { padding: '26px' } }, icon('check'), h('b', null, t('All clear')), t('No alerts right now.'))])); pop.classList.remove('hidden'); };
  document.addEventListener('mousedown', e => { if (!e.target.closest('.search')) results.classList.add('hidden'); if (!e.target.closest('.pop') && !e.target.closest('#bell')) pop.classList.add('hidden'); });
  contentEl = h('main', { class: 'content', id: 'content' });
  document.getElementById('app').replaceChildren(h('div', { class: 'shell' },
    h('aside', { class: 'side' }, h('div', { class: 'brand' }, h('img', { src: 'assets/logo.svg', alt: '' }), h('div', null, h('b', null, 'Mobile Shop'), h('span', null, 'Manager Pro'))), navEl,
      h('div', { class: 'side-foot' }, h('span', null, `v${App.info.version}`), h('span', { id: 'lic-pill', class: 'pill' }))),
    h('div', { class: 'main' },
      h('header', { class: 'top' }, h('div', { class: 'search' }, icon('search'), input, h('kbd', null, 'Ctrl K'), results),
        h('div', { class: 'meta' }, h('span', { class: 'chip', id: 'cur-chip', title: t('Currency') }), h('div', { class: 'clock', id: 'clock' }),
          h('button', { class: 'iconbtn', id: 'bell', title: t('Notifications'), 'aria-label': t('Notifications'), onclick: togglePop }, icon('bell'), h('span', { class: 'dot hidden', id: 'bell-dot' })),
          h('button', { class: 'profile', title: t('Shop profile'), onclick: () => navigate('settings', { tab: 'shop' }) }, h('span', { class: 'av', id: 'shop-av' }), h('b', { id: 'shop-name' }))), pop),
      h('div', { id: 'banner', class: 'banner hidden' }), contentEl)));
  clearInterval(clockTimer); clockTimer = setInterval(tickClock, 20000);
}

function showShortcuts() {
  const rows = [['Ctrl + K', t('Search everything')], ['Ctrl + N', t('New sale')], ['Ctrl + Enter', t('Complete the sale (on the New Sale screen)')], ['Ctrl + 1 … 9', t('Open the first nine menu items')], ['Ctrl + B', t('Back up now')], ['Ctrl + ,', t('Settings')], ['/', t('Search the current table')], ['Esc', t('Close the current window')], ['F1', t('Show this list')]];
  modal({ title: t('Keyboard shortcuts'), size: 'sm', body: h('table', { class: 'tbl' }, h('tbody', null, rows.map(r => h('tr', null, h('td', null, h('kbd', { style: { border: '1px solid var(--line)', borderRadius: '6px', padding: '2px 7px', background: '#f8fafc', fontFamily: 'inherit', fontSize: '12px' } }, r[0])), h('td', null, r[1]))))) });
}
function showAbout() { modal({ title: t('About'), body: aboutContent() }); }

function lockScreen(boot) {
  const pw = h('input', { class: 'input', type: 'password', placeholder: t('Password'), autofocus: true }), err = h('div', { class: 'formerr hidden' });
  const go = async () => { try { await api('auth:login', { password: pw.value }); bootstrap(); } catch (e) { err.textContent = t(e.message); err.classList.remove('hidden'); pw.select(); } };
  pw.addEventListener('keydown', e => { if (e.key === 'Enter') go(); });
  document.getElementById('app').replaceChildren(h('div', { class: 'gate' }, h('div', { class: 'box' }, boot.shop_logo ? h('img', { src: boot.shop_logo, alt: '', style: { objectFit: 'contain' } }) : h('img', { src: 'assets/logo.svg', alt: '' }), h('h1', null, boot.shop_name || 'Mobile Shop Manager Pro'),
    h('p', null, t('Enter your password to open the shop.')), err, h('div', { class: 'col' }, pw, btn(t('Unlock'), 'lock', 'primary lg', go)), h('div', { class: 'small muted', style: { marginTop: '18px' } }, `Mobile Shop Manager Pro · v${boot.info.version}`))));
  setTimeout(() => pw.focus(), 50);
}

async function bootstrap() {
  let boot;
  try { boot = await api('app:bootstrap'); } catch (e) { document.getElementById('app').textContent = 'Could not start: ' + e.message; return; }
  App.locale = boot.locale || {}; App.license = boot.license; App.info = boot.info; App.settings = boot.settings; App.hasDemo = boot.hasDemo;
  if (boot.locked) { const lang = Const.LANGUAGES.find(l => l.code === boot.settings.language); document.documentElement.dir = lang && lang.rtl ? 'rtl' : 'ltr'; return lockScreen(boot); }
  buildShell();
  await applySettings();
  await navigate(App.current || 'dashboard');
}

document.addEventListener('keydown', e => {
  const mod = e.ctrlKey || e.metaKey, typing = /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName);
  if (e.key === 'Escape') { if (closeTopModal()) e.preventDefault(); return; }
  if (!contentEl) return;
  if (contentEl._page && contentEl._page._onKey && !document.querySelector('#modals > .overlay')) contentEl._page._onKey(e);
  if (mod && e.key.toLowerCase() === 'k') { e.preventDefault(); const s = document.getElementById('global-search'); s.focus(); s.select(); }
  else if (mod && /^[1-9]$/.test(e.key) && !document.querySelector('#modals > .overlay')) { e.preventDefault(); navigate(NAV[+e.key - 1][0]); }
  else if (e.key === '/' && !typing && !mod) { const s = contentEl.querySelector('.tsearch input, .toolbar input[type=search]'); if (s) { e.preventDefault(); s.focus(); } }
});
window.bridge.on('menu', a => { if (!contentEl) return; if (a === 'nav:new-sale') navigate('newsale'); else if (a === 'nav:settings') navigate('settings'); else if (a === 'backup') App.pages.backup.backupNow(); else if (a === 'search') document.getElementById('global-search').focus(); else if (a === 'shortcuts') showShortcuts(); else if (a === 'about') showAbout(); });
window.bridge.on('license', s => { if (!contentEl) return; const was = App.license.mode; App.license = s; if (s.mode !== was) applySettings(); });
window.addEventListener('error', e => console.error(e.error || e.message));
bootstrap();
