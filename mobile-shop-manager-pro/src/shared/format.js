/* Shared formatting + sale maths. Loaded by both the Electron main process (require)
 * and the renderer (<script>), so every screen, invoice and report agrees. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Fmt = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const NUMBER_FORMATS = {
    'comma_dot': { group: ',', decimal: '.', label: '1,234,567.89' },
    'dot_comma': { group: '.', decimal: ',', label: '1.234.567,89' },
    'space_comma': { group: ' ', decimal: ',', label: '1 234 567,89' },
    'apostrophe_dot': { group: "'", decimal: '.', label: "1'234'567.89" },
    'indian': { group: ',', decimal: '.', indian: true, label: '12,34,567.89' },
    'none_dot': { group: '', decimal: '.', label: '1234567.89' },
  };
  const DATE_FORMATS = ['YYYY-MM-DD', 'DD/MM/YYYY', 'MM/DD/YYYY', 'DD.MM.YYYY', 'DD-MM-YYYY', 'DD MMM YYYY', 'MMM D, YYYY'];

  function round(n, decimals) {
    const d = decimals == null ? 2 : decimals;
    const f = Math.pow(10, d);
    const v = Number(n) || 0;
    return Math.round((v + (v >= 0 ? 1e-9 : -1e-9)) * f) / f;
  }

  function formatNumber(n, s, decimals) {
    const d = decimals == null ? Number(s && s.decimals != null ? s.decimals : 2) : decimals;
    const nf = NUMBER_FORMATS[(s && s.number_format) || 'comma_dot'] || NUMBER_FORMATS.comma_dot;
    const v = round(n, d);
    const neg = v < 0;
    const parts = Math.abs(v).toFixed(d).split('.');
    let int = parts[0];
    if (nf.group) {
      if (nf.indian && int.length > 3) {
        const last3 = int.slice(-3);
        const rest = int.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, nf.group);
        int = rest + nf.group + last3;
      } else {
        int = int.replace(/\B(?=(\d{3})+(?!\d))/g, nf.group);
      }
    }
    return (neg ? '-' : '') + int + (d > 0 ? nf.decimal + parts[1] : '');
  }

  function formatMoney(n, s) {
    const sym = (s && s.currency_symbol) || '';
    const pos = (s && s.currency_position) || 'before';
    const v = round(n, Number(s && s.decimals != null ? s.decimals : 2));
    const body = formatNumber(Math.abs(v), s);
    let out;
    if (pos === 'before') out = sym + body;
    else if (pos === 'before_space') out = sym + ' ' + body;
    else if (pos === 'after') out = body + sym;
    else out = body + ' ' + sym;
    return (v < 0 ? '-' : '') + out;
  }

  /** Returns {y,m,d,hh,mm,ss} for an instant in the given IANA zone ('system' = computer zone). */
  function zoneParts(date, tz) {
    const dt = date instanceof Date ? date : new Date(date);
    const opts = { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' };
    if (tz && tz !== 'system') opts.timeZone = tz;
    let parts;
    try { parts = new Intl.DateTimeFormat('en-US', opts).formatToParts(dt); }
    catch (e) { delete opts.timeZone; parts = new Intl.DateTimeFormat('en-US', opts).formatToParts(dt); }
    const o = {};
    parts.forEach(p => { o[p.type] = p.value; });
    return { y: +o.year, m: +o.month, d: +o.day, hh: +o.hour % 24, mm: +o.minute, ss: +o.second };
  }
  const p2 = n => String(n).padStart(2, '0');
  function ymd(y, m, d) { return y + '-' + p2(m) + '-' + p2(d); }
  /** Business date (YYYY-MM-DD) for "now" in the shop's time zone. */
  function today(tz, now) { const p = zoneParts(now || new Date(), tz); return ymd(p.y, p.m, p.d); }
  function addDays(dateStr, n) {
    const [y, m, d] = dateStr.split('-').map(Number);
    const dt = new Date(Date.UTC(y, m - 1, d + n));
    return ymd(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate());
  }
  function weekday(dateStr) { const [y, m, d] = dateStr.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d)).getUTCDay(); }
  function isDate(s) { return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(Date.parse(s + 'T00:00:00Z')); }

  function formatYmd(y, m, d, fmt) {
    switch (fmt) {
      case 'DD/MM/YYYY': return p2(d) + '/' + p2(m) + '/' + y;
      case 'MM/DD/YYYY': return p2(m) + '/' + p2(d) + '/' + y;
      case 'DD.MM.YYYY': return p2(d) + '.' + p2(m) + '.' + y;
      case 'DD-MM-YYYY': return p2(d) + '-' + p2(m) + '-' + y;
      case 'DD MMM YYYY': return p2(d) + ' ' + MONTHS[m - 1] + ' ' + y;
      case 'MMM D, YYYY': return MONTHS[m - 1] + ' ' + d + ', ' + y;
      default: return ymd(y, m, d);
    }
  }
  /** Formats a business date ('YYYY-MM-DD') or an ISO timestamp using the shop's date format. */
  function formatDate(value, s) {
    if (!value) return '';
    const fmt = (s && s.date_format) || 'YYYY-MM-DD';
    if (isDate(value)) { const [y, m, d] = value.split('-').map(Number); return formatYmd(y, m, d, fmt); }
    const dt = new Date(value);
    if (isNaN(dt)) return String(value);
    const p = zoneParts(dt, s && s.timezone);
    return formatYmd(p.y, p.m, p.d, fmt);
  }
  function formatTime(value, s) {
    const dt = value instanceof Date ? value : new Date(value);
    if (isNaN(dt)) return '';
    const p = zoneParts(dt, s && s.timezone);
    if (s && s.time_format === '24h') return p2(p.hh) + ':' + p2(p.mm);
    const h = p.hh % 12 || 12;
    return h + ':' + p2(p.mm) + ' ' + (p.hh < 12 ? 'AM' : 'PM');
  }
  function formatDateTime(value, s) { return value ? formatDate(value, s) + ' ' + formatTime(value, s) : ''; }

  /** Date ranges for dashboard/report presets, honouring first day of week. */
  function range(preset, s, now) {
    const t = today(s && s.timezone, now);
    const [y, m] = t.split('-').map(Number);
    const ws = { sunday: 0, monday: 1, saturday: 6 }[(s && s.week_start) || 'monday'];
    switch (preset) {
      case 'yesterday': { const d = addDays(t, -1); return { from: d, to: d }; }
      case 'week': { const back = (weekday(t) - ws + 7) % 7; const from = addDays(t, -back); return { from, to: addDays(from, 6) }; }
      case 'month': { const last = new Date(Date.UTC(y, m, 0)).getUTCDate(); return { from: ymd(y, m, 1), to: ymd(y, m, last) }; }
      case 'year': return { from: ymd(y, 1, 1), to: ymd(y, 12, 31) };
      case 'all': return { from: '0001-01-01', to: '9999-12-31' };
      default: return { from: t, to: t };
    }
  }
  function daysBetween(a, b) { return Math.round((Date.parse(b + 'T00:00:00Z') - Date.parse(a + 'T00:00:00Z')) / 86400000); }
  /** The equally long period immediately before {from,to}. */
  function previousRange(r) { const n = daysBetween(r.from, r.to) + 1; return { from: addDays(r.from, -n), to: addDays(r.from, -1) }; }

  /**
   * Single source of truth for sale totals.
   * lines: [{ line_total, cost }]  (cost = total cost of the line)
   * tax: { enabled, rate, mode: 'exclusive'|'inclusive', exempt }
   */
  function calcSale(lines, discount, tax, decimals) {
    const d = decimals == null ? 2 : decimals;
    const subtotal = round(lines.reduce((a, l) => a + (Number(l.line_total) || 0), 0), d);
    const disc = Math.min(Math.max(round(discount, d), 0), subtotal);
    const base = round(subtotal - disc, d);
    const rate = Number(tax && tax.rate) || 0;
    let mode = 'none';
    if (tax && tax.enabled && rate > 0) mode = tax.exempt ? 'exempt' : (tax.mode === 'inclusive' ? 'inclusive' : 'exclusive');
    let taxAmount = 0, grand = base;
    if (mode === 'exclusive') { taxAmount = round(base * rate / 100, d); grand = round(base + taxAmount, d); }
    else if (mode === 'inclusive') { taxAmount = round(base - base / (1 + rate / 100), d); }
    const out = [];
    let dLeft = disc, tLeft = mode === 'inclusive' ? taxAmount : 0;
    let lastIdx = -1;
    lines.forEach((l, i) => { if ((Number(l.line_total) || 0) > 0) lastIdx = i; });
    lines.forEach((l, i) => {
      const lt = round(l.line_total, d);
      let da = 0, ta = 0;
      if (subtotal > 0 && lt > 0) {
        if (i === lastIdx) { da = round(dLeft, d); ta = round(tLeft, d); }
        else {
          da = round(disc * lt / subtotal, d);
          ta = mode === 'inclusive' ? round(taxAmount * lt / subtotal, d) : 0;
          dLeft = round(dLeft - da, d); tLeft = round(tLeft - ta, d);
        }
      }
      const cost = round(l.cost, d);
      out.push({ line_total: lt, discount_alloc: da, tax_alloc: ta, cost, profit: round(lt - da - ta - cost, d) });
    });
    const totalCost = round(out.reduce((a, l) => a + l.cost, 0), d);
    const profit = round(out.reduce((a, l) => a + l.profit, 0), d);
    return { subtotal, discount: disc, tax_mode: mode, tax_rate: mode === 'none' ? 0 : rate, tax_amount: taxAmount, grand_total: grand, total_cost: totalCost, profit, lines: out };
  }

  return { MONTHS, NUMBER_FORMATS, DATE_FORMATS, round, formatNumber, formatMoney, zoneParts, today, addDays, weekday, isDate,
    formatDate, formatTime, formatDateTime, range, previousRange, daysBetween, calcSale };
});
