'use strict';
/* Core UI toolkit: IPC wrapper, i18n, DOM helper, icons, modal/form/table components. */
const App = { settings: {}, info: {}, license: {}, locale: {}, pages: {}, current: null, hasDemo: false };

async function api(channel, payload) {
  const r = await window.api.invoke(channel, payload);
  if (r && r.ok) return r.data;
  const e = new Error((r && r.error) || 'Request failed'); e.code = r && r.code; throw e;
}

/** gettext-style translation: the English text is the key. t('Only {n} left', {n: 3}) */
function t(s, vars) {
  let out = (App.locale && App.locale[s]) || s;
  if (vars) out = out.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? vars[k] : m));
  return out;
}
const money = n => Fmt.formatMoney(n, App.settings);
const numf = (n, d = 0) => Fmt.formatNumber(n, App.settings, d);
const fdate = v => Fmt.formatDate(v, App.settings);
const fdatetime = v => Fmt.formatDateTime(v, App.settings);
const today = () => Fmt.today(App.settings.timezone);
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const label = (map, k) => t(map[k] || k || '');

function h(tag, attrs, ...kids) {
  const el = document.createElement(tag);
  if (attrs) for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'html') el.innerHTML = v;            // only ever used with app-generated markup (icons)
    else if (k in el && k !== 'list' && typeof v !== 'string') el[k] = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const kid of kids.flat(Infinity)) {
    if (kid == null || kid === false) continue;
    el.append(kid.nodeType ? kid : document.createTextNode(String(kid)));
  }
  return el;
}

const ICONS = {
  dashboard: '<rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/>',
  phone: '<rect x="6" y="2" width="12" height="20" rx="2.5"/><path d="M11 18h2"/>',
  headphones: '<path d="M4 14v-2a8 8 0 0 1 16 0v2"/><rect x="2.5" y="14" width="5" height="7" rx="2"/><rect x="16.5" y="14" width="5" height="7" rx="2"/>',
  cart: '<circle cx="9" cy="20" r="1.5"/><circle cx="18" cy="20" r="1.5"/><path d="M2 3h3l2.7 12.4a1 1 0 0 0 1 .8h9.2a1 1 0 0 0 1-.8L21 7H6"/>',
  receipt: '<path d="M5 2v20l3-2 2 2 2-2 2 2 2-2 3 2V2z"/><path d="M9 7h6M9 11h6M9 15h4"/>',
  users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><path d="M16 4.6a3.5 3.5 0 0 1 0 6.8M18 14.5a6 6 0 0 1 3.5 5.5"/>',
  book: '<path d="M4 4.5A2.5 2.5 0 0 1 6.5 2H20v17H6.5A2.5 2.5 0 0 0 4 21.5z"/><path d="M4 21.5A2.5 2.5 0 0 0 6.5 24H20"/><path d="M9 7h7M9 11h5"/>',
  swap: '<path d="M7 4 3 8l4 4"/><path d="M3 8h14"/><path d="m17 12 4 4-4 4"/><path d="M21 16H7"/>',
  wallet: '<path d="M3 7a2 2 0 0 1 2-2h13v4"/><path d="M3 7v11a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1V10a1 1 0 0 0-1-1H5a2 2 0 0 1-2-2z"/><circle cx="16.5" cy="14.5" r="1"/>',
  truck: '<path d="M2 6h11v10H2z"/><path d="M13 9h4l4 4v3h-8z"/><circle cx="6.5" cy="18" r="2"/><circle cx="17" cy="18" r="2"/>',
  chart: '<path d="M3 3v18h18"/><path d="M8 16v-5M12.5 16V7M17 16v-8"/>',
  database: '<ellipse cx="12" cy="5.5" rx="8" ry="3"/><path d="M4 5.5v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6"/><path d="M4 11.5v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.9 2.9l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.9l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.9l-.1-.1A2 2 0 1 1 7 4.200l.1.1a1.7 1.7 0 0 0 1.800.3h.1a1.700 1.700 0 0 0 1-1.500V3a2 2 0 1 1 4 0v.1a1.700 1.700 0 0 0 1 1.500 1.700 1.700 0 0 0 1.900-.3l.1-.1a2 2 0 1 1 2.800 2.900l-.1.1a1.700 1.700 0 0 0-.3 1.800v.1a1.700 1.700 0 0 0 1.500 1H21a2 2 0 1 1 0 4h-.1a1.700 1.700 0 0 0-1.500 1z"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.500-3.500"/>',
  bell: '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 8 3 8H3s3-1 3-8"/><path d="M10.300 20a1.900 1.900 0 0 0 3.400 0"/>',
  plus: '<path d="M12 5v14M5 12h14"/>', x: '<path d="M18 6 6 18M6 6l12 12"/>', check: '<path d="m5 12.500 4.500 4.500L19 7.500"/>',
  edit: '<path d="M12 20h9"/><path d="M16.500 3.500a2.100 2.100 0 0 1 3 3L7 19l-4 1 1-4z"/>',
  trash: '<path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14M10 11v5M14 11v5"/>',
  eye: '<path d="M1.500 12S5.500 5 12 5s10.500 7 10.500 7-4 7-10.500 7S1.500 12 1.500 12z"/><circle cx="12" cy="12" r="3"/>',
  download: '<path d="M12 3v12M7 10.500l5 5 5-5M4 20h16"/>', upload: '<path d="M12 16V4M7 8.500l5-5 5 5M4 20h16"/>',
  print: '<path d="M6 9V3h12v6"/><rect x="3" y="9" width="18" height="8" rx="2"/><path d="M6 14h12v7H6z"/>',
  pdf: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M8 13h8M8 17h5"/>',
  chat: '<path d="M21 11.500a8.400 8.400 0 0 1-12.300 7.400L3 21l2-5.500A8.400 8.400 0 1 1 21 11.500z"/>',
  cash: '<rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2.500"/><path d="M6 10v4M18 10v4"/>',
  trend: '<path d="m3 17 6-6 4 4 8-8"/><path d="M15 7h6v6"/>', alert: '<path d="M12 3 2 20h20z"/><path d="M12 10v4M12 17.500v.01"/>',
  box: '<path d="M21 8 12 3 3 8v8l9 5 9-5z"/><path d="M3 8l9 5 9-5M12 13v8"/>', lock: '<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
  key: '<circle cx="8" cy="15" r="4"/><path d="m11 12 9-9M16 7l3 3M14 9l2 2"/>', folder: '<path d="M3 6a2 2 0 0 1 2-2h4l2 3h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
  refresh: '<path d="M21 12a9 9 0 0 1-15.500 6.200L3 16"/><path d="M3 12a9 9 0 0 1 15.500-6.200L21 8"/><path d="M21 3v5h-5M3 21v-5h5"/>',
  minus: '<path d="M5 12h14"/>', ban: '<circle cx="12" cy="12" r="9"/><path d="m5.600 5.600 12.800 12.800"/>', info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.500v.01"/>',
  layers: '<path d="m12 3 9 5-9 5-9-5z"/><path d="m3 13 9 5 9-5"/>', calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
};
function icon(name) { const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); s.setAttribute('viewBox', '0 0 24 24'); s.setAttribute('class', 'ic'); s.innerHTML = ICONS[name] || ''; return s; }

function toast(msg, type = 'ok', ms = 3800) {
  const el = h('div', { class: 'toast ' + type, role: type === 'err' ? 'alert' : 'status' }, icon(type === 'ok' ? 'check' : type === 'err' ? 'alert' : 'info'), h('div', null, msg));
  document.getElementById('toasts').append(el);
  setTimeout(() => el.remove(), type === 'err' ? 6500 : ms);
}
const fail = e => toast(t(e.message || String(e)), 'err');

/** Opens a modal. Returns { el, close }. Esc closes the top-most modal. */
function modal({ title, body, footer, size = '', onClose }) {
  const root = document.getElementById('modals');
  const previous = document.activeElement;
  const overlay = h('div', { class: 'overlay' });
  const close = () => { overlay.remove(); if (onClose) onClose(); if (previous && previous.focus) try { previous.focus(); } catch (_) { /* gone */ } };
  const box = h('div', { class: 'modal ' + size, role: 'dialog', 'aria-modal': 'true', 'aria-label': title },
    h('header', null, h('h2', null, title), h('button', { class: 'btn icon', 'aria-label': t('Close'), onclick: close }, icon('x'))),
    h('div', { class: 'body' }, body), footer ? h('footer', null, footer) : null);
  overlay.append(box);
  overlay.addEventListener('mousedown', e => { if (e.target === overlay) overlay._down = true; });
  overlay.addEventListener('mouseup', e => { if (e.target === overlay && overlay._down) close(); overlay._down = false; });
  overlay._close = close;
  root.append(overlay);
  setTimeout(() => { const f = box.querySelector('[autofocus], .body input:not([type=hidden]):not([disabled]), .body select, .body textarea, footer .btn.primary, footer .btn'); if (f) f.focus(); }, 30);
  return { el: box, close, overlay };
}
function closeTopModal() { const all = document.querySelectorAll('#modals > .overlay'); if (all.length) { all[all.length - 1]._close(); return true; } return false; }

function confirmDialog({ title, text, confirmLabel, danger = false, fields }) {
  return new Promise(resolve => {
    let done = false;
    const inputs = {};
    const err = h('div', { class: 'formerr hidden' });
    const body = h('div', { class: 'col' }, err, h('div', { style: { lineHeight: 1.5, color: 'var(--ink-2)' } }, text),
      (fields || []).map(f => h('div', { class: 'field' }, h('label', null, f.label, f.required ? h('em', null, ' *') : null),
        inputs[f.name] = h('input', { class: 'input', type: f.type || 'text', placeholder: f.placeholder || '' }))));
    const ok = h('button', { class: 'btn ' + (danger ? 'danger' : 'primary'), onclick: () => {
      const vals = {}; for (const f of fields || []) { vals[f.name] = inputs[f.name].value.trim(); if (f.required && !vals[f.name]) { err.textContent = t('{field} is required.', { field: f.label }); err.classList.remove('hidden'); inputs[f.name].focus(); return; } }
      done = true; m.close(); resolve(fields ? vals : true);
    } }, confirmLabel || t('Confirm'));
    const m = modal({ title, body, size: 'sm', footer: [h('button', { class: 'btn', onclick: () => m.close() }, t('Cancel')), ok], onClose: () => { if (!done) resolve(null); } });
    body.addEventListener('keydown', e => { if (e.key === 'Enter') ok.click(); });
  });
}

/** Asks for the admin password only when one is set. Resolves '' when not needed, null when cancelled. */
async function adminFields() { return App.settings.auth_enabled ? [{ name: 'password', label: t('Administrator password'), type: 'password', required: true }] : []; }

/**
 * Builds a form from field definitions.
 * field: { name, label, type: text|number|money|int|select|textarea|date|password|checkbox|custom, options:[[value,label]], required, span, hint, placeholder, value, disabled, prefix, suffix, onchange }
 */
function buildForm(fields, values = {}) {
  const controls = {};
  const grid = h('div', { class: 'grid g2' });
  for (const f of fields) {
    if (f.type === 'section') { grid.append(h('h4', { class: 'spanall', style: { marginTop: '6px', fontSize: '13px', color: 'var(--ink-2)' } }, f.label)); continue; }
    if (f.type === 'note') { grid.append(h('div', { class: 'spanall note ' + (f.kind || '') }, f.label)); continue; }
    const v = values[f.name] != null ? values[f.name] : (f.value != null ? f.value : '');
    let input;
    if (f.type === 'select') {
      input = h('select', { class: 'input' }, (f.options || []).map(o => h('option', { value: o[0] }, o[1])));
      input.value = String(v == null ? '' : v);
      if (input.selectedIndex < 0) input.selectedIndex = 0;
    } else if (f.type === 'textarea') input = h('textarea', { class: 'input', rows: f.rows || 2, placeholder: f.placeholder || '' }, v);
    else if (f.type === 'checkbox') input = h('input', { type: 'checkbox', checked: !!v });
    else {
      const isNum = ['number', 'money', 'int'].includes(f.type);
      input = h('input', { class: 'input' + (isNum ? ' num' : ''), type: isNum ? 'number' : (f.type || 'text'), placeholder: f.placeholder || '', value: v,
        step: f.type === 'int' ? '1' : f.type === 'money' ? String(1 / Math.pow(10, App.settings.decimals)) : 'any', min: isNum && f.min == null ? '0' : f.min, maxlength: f.max, inputmode: isNum ? 'decimal' : null, list: f.list });
    }
    if (f.disabled) input.disabled = true;
    if (f.onchange) input.addEventListener(f.type === 'select' || f.type === 'checkbox' ? 'change' : 'input', () => f.onchange(input.value, controls));
    controls[f.name] = input;
    let inner = input;
    const pre = f.prefix || (f.type === 'money' && App.settings.currency_position.startsWith('before') ? App.settings.currency_symbol : null);
    const suf = f.suffix || (f.type === 'money' && App.settings.currency_position.startsWith('after') ? App.settings.currency_symbol : null);
    if (pre || suf) inner = h('div', { class: 'addon' }, pre ? h('span', null, pre) : null, input, suf ? h('span', null, suf) : null);
    if (f.type === 'checkbox') grid.append(h('label', { class: 'check ' + (f.span === 1 ? '' : 'spanall') }, input, f.label));
    else grid.append(h('div', { class: 'field ' + (f.span === 2 ? 'spanall' : ''), 'data-field': f.name }, h('label', null, f.label, f.required ? h('em', null, ' *') : null), inner, f.hint ? h('div', { class: 'hint' }, f.hint) : null,
      f.datalist ? h('datalist', { id: f.list }, f.datalist.map(o => h('option', { value: o }))) : null));
  }
  const read = () => {
    const out = {};
    for (const f of fields) { if (!controls[f.name]) continue; const c = controls[f.name]; out[f.name] = f.type === 'checkbox' ? c.checked : c.value.trim(); }
    return out;
  };
  const validate = () => {
    for (const f of fields) {
      const c = controls[f.name]; if (!c) continue;
      c.classList.remove('invalid');
      if (f.required && f.type !== 'checkbox' && !c.value.trim() && !c.closest('.hidden')) { c.classList.add('invalid'); c.focus(); return t('{field} is required.', { field: f.label }); }
    }
    return null;
  };
  return { el: grid, controls, read, validate };
}

/** Modal form with validation, busy state and inline errors. onSubmit may throw; the message is shown. */
function formModal({ title, fields, values, submitLabel, onSubmit, size, extra, danger }) {
  return new Promise(resolve => {
    let result = null;
    const form = buildForm(fields, values);
    const err = h('div', { class: 'formerr hidden' });
    const submit = h('button', { class: 'btn ' + (danger ? 'danger' : 'primary') }, submitLabel || t('Save'));
    const m = modal({ title, size, body: h('div', null, err, form.el, extra ? extra(form) : null), footer: [h('button', { class: 'btn', onclick: () => m.close() }, t('Cancel')), submit], onClose: () => resolve(result) });
    const go = async () => {
      const v = form.validate();
      if (v) { err.textContent = v; err.classList.remove('hidden'); return; }
      submit.disabled = true;
      try { result = (await onSubmit(form.read(), form)) ?? true; m.close(); }
      catch (e) { err.textContent = t(e.message); err.classList.remove('hidden'); m.el.querySelector('.body').scrollTop = 0; submit.disabled = false; }
    };
    submit.addEventListener('click', go);
    form.el.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.tagName !== 'TEXTAREA') { e.preventDefault(); go(); } });
  });
}

function badge(text, color) { return h('span', { class: 'badge ' + (color || '') }, text); }
const STATUS_COLOR = { in_stock: 'green', available: 'green', sold: 'blue', exchange: 'amber', returned: 'red', completed: 'green', voided: 'red' };
function statusBadge(s, map) { return badge(t((map && map[s]) || { completed: 'Completed', voided: 'Voided' }[s] || s), STATUS_COLOR[s]); }

/**
 * Searchable, sortable, paginated table.
 * columns: [{ key, label, type: 'money'|'number'|'date'|'text', render(row), sort: false, csv(row) }]
 */
function dataTable({ columns, rows, pageSize = 25, search = true, searchKeys, filters, actions, onRow, empty, exportName, toolbarExtra, footer, initialQuery }) {
  const state = { q: initialQuery || '', page: 1, sort: null, dir: 1, rows: rows || [], filterFns: {} };
  const tbody = h('tbody'), pager = h('div', { class: 'pager' }), tfoot = h('tfoot');
  const cellText = (r, c) => c.type === 'money' ? money(r[c.key]) : c.type === 'number' ? numf(r[c.key]) : c.type === 'date' ? fdate(r[c.key]) : (r[c.key] == null ? '' : r[c.key]);
  const keys = searchKeys || columns.filter(c => !c.type || c.type === 'text').map(c => c.key);
  function filtered() {
    const q = state.q.trim().toLowerCase();
    let out = state.rows;
    for (const fn of Object.values(state.filterFns)) if (fn) out = out.filter(fn);
    if (q) out = out.filter(r => keys.some(k => String(r[k] == null ? '' : r[k]).toLowerCase().includes(q)));
    if (state.sort) { const k = state.sort, d = state.dir; out = [...out].sort((a, b) => { const x = a[k], y = b[k]; if (x == null) return 1; if (y == null) return -1; return (typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y), undefined, { numeric: true })) * d; }); }
    return out;
  }
  const thead = h('thead', null, h('tr', null, columns.map(c => {
    const th = h('th', { class: (c.type === 'money' || c.type === 'number' ? 'num ' : '') + (c.sort === false ? '' : 'sortable') }, c.label);
    if (c.sort !== false) th.addEventListener('click', () => { if (state.sort === c.key) state.dir *= -1; else { state.sort = c.key; state.dir = 1; } draw(); });
    return th;
  }), actions ? h('th', null, '') : null));
  function draw() {
    const all = filtered();
    const pages = Math.max(1, Math.ceil(all.length / pageSize));
    state.page = Math.min(state.page, pages);
    const slice = all.slice((state.page - 1) * pageSize, state.page * pageSize);
    tbody.replaceChildren(...slice.map(r => {
      const tr = h('tr', { class: (onRow ? 'click ' : '') + (r.bold ? 'bold' : '') }, columns.map(c => h('td', { class: c.type === 'money' || c.type === 'number' ? 'num' : '' }, c.render ? c.render(r) : cellText(r, c))),
        actions ? h('td', null, h('div', { class: 'acts' }, actions(r))) : null);
      if (onRow) tr.addEventListener('click', e => { if (!e.target.closest('button,a,input,select')) onRow(r); });
      return tr;
    }));
    if (!slice.length) tbody.append(h('tr', null, h('td', { colspan: columns.length + (actions ? 1 : 0) }, h('div', { class: 'empty' }, icon('box'), h('b', null, state.rows.length ? t('No matching records') : (empty || t('Nothing here yet'))), state.rows.length ? t('Try a different search or filter.') : ''))));
    tfoot.replaceChildren(); if (footer && all.length) { const f = footer(all); if (f) tfoot.append(f); }
    pager.replaceChildren(h('span', null, all.length ? t('Showing {a}–{b} of {n}', { a: (state.page - 1) * pageSize + 1, b: Math.min(state.page * pageSize, all.length), n: numf(all.length) }) : ''),
      h('div', { class: 'row' }, h('button', { class: 'btn sm', disabled: state.page <= 1, onclick: () => { state.page--; draw(); } }, t('Previous')), h('span', null, `${state.page} / ${pages}`),
        h('button', { class: 'btn sm', disabled: state.page >= pages, onclick: () => { state.page++; draw(); } }, t('Next'))));
  }
  const searchInput = h('input', { class: 'input sm', type: 'search', placeholder: t('Search…'), value: state.q, oninput: e => { state.q = e.target.value; state.page = 1; draw(); } });
  const bar = h('div', { class: 'toolbar' }, search ? h('div', { class: 'tsearch' }, icon('search'), searchInput) : null,
    (filters || []).map(f => { const sel = h('select', { class: 'input sm', 'aria-label': f.label, onchange: () => { state.filterFns[f.key] = sel.value ? (r => f.test ? f.test(r, sel.value) : String(r[f.key]) === sel.value) : null; state.page = 1; draw(); } }, h('option', { value: '' }, f.label), f.options.map(o => h('option', { value: o[0] }, o[1]))); 
      if (f.value) { sel.value = f.value; state.filterFns[f.key] = r => f.test ? f.test(r, sel.value) : String(r[f.key]) === sel.value; } return sel; }),
    h('div', { class: 'grow' }), toolbarExtra || null,
    exportName ? h('button', { class: 'btn sm', onclick: exportCsv }, icon('download'), t('Export CSV')) : null);
  async function exportCsv() {
    const cols = columns.filter(c => c.csv !== false);
    const data = filtered().map(r => Object.fromEntries(cols.map(c => [c.key, c.csv ? c.csv(r) : c.type === 'money' || c.type === 'number' ? r[c.key] : c.type === 'date' ? r[c.key] : (r[c.key] == null ? '' : r[c.key])])));
    try { const f = await api('file:saveCsv', { name: exportName, rows: data, columns: cols.map(c => ({ key: c.key, label: c.label })) }); if (f) toast(t('Exported to {file}', { file: f })); } catch (e) { fail(e); }
  }
  const el = h('div', { class: 'card' }, bar, h('div', { class: 'table-wrap' }, h('table', { class: 'tbl' }, thead, tbody, tfoot)), pager);
  draw();
  return { el, setRows(r) { state.rows = r || []; draw(); }, redraw: draw, filtered, focusSearch: () => searchInput.focus() };
}

function pageHead(title, subtitle, ...actions) {
  return h('div', { class: 'page-head' }, h('div', null, h('h1', null, title), subtitle ? h('p', null, subtitle) : null), h('div', { class: 'row wrap' }, actions));
}
function statCard(lbl, value, { ico = 'chart', color = '', sub } = {}) {
  return h('div', { class: 'stat ' + color }, h('div', { class: 'ico' }, icon(ico)), h('div', { style: { minWidth: 0 } }, h('div', { class: 'lbl' }, lbl), h('div', { class: 'val num', title: String(value) }, value), sub ? h('div', { class: 'sub' }, sub) : null));
}
function kv(pairs) { return h('dl', { class: 'kv' }, pairs.filter(Boolean).filter(p => p[1] !== '' && p[1] != null).map(p => [h('dt', null, p[0]), h('dd', null, p[1])])); }
function btn(text, ico, cls, onclick, extra) { return h('button', Object.assign({ class: 'btn ' + (cls || ''), onclick }, extra || {}), ico ? icon(ico) : null, text); }
function iconBtn(ico, title, onclick, cls) { return h('button', { class: 'btn icon ' + (cls || ''), title, 'aria-label': title, onclick }, icon(ico)); }
/** Date-range picker with presets. onChange({from,to,preset}) */
function rangePicker(initial, onChange, presets) {
  const P = presets || [['today', t('Today')], ['yesterday', t('Yesterday')], ['week', t('This week')], ['month', t('This month')], ['year', t('This year')], ['custom', t('Custom')]];
  let cur = initial || 'today';
  const from = h('input', { class: 'input sm', type: 'date', style: { width: '140px' }, 'aria-label': t('From') }), to = h('input', { class: 'input sm', type: 'date', style: { width: '140px' }, 'aria-label': t('To') });
  const custom = h('div', { class: 'row hidden' }, from, h('span', { class: 'muted' }, '–'), to);
  const seg = h('div', { class: 'seg', role: 'tablist' });
  const value = () => cur === 'custom' ? { from: from.value || today(), to: to.value || from.value || today(), preset: cur } : { ...Fmt.range(cur, App.settings), preset: cur };
  const fire = () => { const v = value(); if (v.from > v.to) { toast(t('The start date must be before the end date.'), 'warn'); return; } onChange(v); };
  const paint = () => { [...seg.children].forEach(b => b.classList.toggle('active', b.dataset.p === cur)); custom.classList.toggle('hidden', cur !== 'custom'); };
  P.forEach(([p, lbl]) => seg.append(h('button', { 'data-p': p, onclick: () => { cur = p; if (p === 'custom' && !from.value) { const r = Fmt.range('month', App.settings); from.value = r.from; to.value = r.to; } paint(); fire(); } }, lbl)));
  from.addEventListener('change', fire); to.addEventListener('change', fire);
  paint();
  return { el: h('div', { class: 'row wrap' }, seg, custom), value };
}
function supplierOptions(list) { return [['', t('— None —')], ...list.map(s => [String(s.id), s.name + (s.company ? ' · ' + s.company : '')])]; }
function methodOptions() { return Const.PAYMENT_METHODS.map(m => [m, label(Const.PAYMENT_METHOD_LABELS, m)]); }
function restricted() { if (App.license && App.license.restricted) { toast(App.license.message, 'warn', 7000); return true; } return false; }
