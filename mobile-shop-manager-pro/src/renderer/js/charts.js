'use strict';
/* Small dependency-free SVG charts: one y-axis, recessive grid, legend for 2+ series, hover tooltip. */
const Charts = (() => {
  const NS = 'http://www.w3.org/2000/svg';
  const s = (tag, attrs, text) => { const el = document.createElementNS(NS, tag); for (const k in attrs) el.setAttribute(k, attrs[k]); if (text != null) el.textContent = text; return el; };
  const COLORS = { blue: '#2563eb', green: '#16a34a', amber: '#d97706' };
  function niceMax(v) { if (v <= 0) return 1; const p = Math.pow(10, Math.floor(Math.log10(v))); const n = v / p; return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * p; }
  function compact(v) { const a = Math.abs(v); return a >= 1e9 ? Fmt.formatNumber(v / 1e9, App.settings, 1) + 'B' : a >= 1e6 ? Fmt.formatNumber(v / 1e6, App.settings, 1) + 'M' : a >= 1e4 ? Fmt.formatNumber(v / 1e3, App.settings, 0) + 'k' : Fmt.formatNumber(v, App.settings, 0); }

  /** Grouped bars. series: [{ name, color, values[] }]. Negative values draw below the zero line. */
  function bars(labels, series, { height = 250, format = money } = {}) {
    const W = 760, H = height, L = 52, R = 8, T = 10, B = 26;
    const wrap = h('div', { class: 'chart' });
    const svg = s('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': series.map(x => x.name).join(', ') });
    const all = series.flatMap(x => x.values);
    const max = niceMax(Math.max(0, ...all)), minRaw = Math.min(0, ...all), min = minRaw < 0 ? -niceMax(-minRaw) : 0;
    const y = v => T + (H - T - B) * (1 - (v - min) / (max - min));
    const ticks = 4;
    for (let i = 0; i <= ticks; i++) {
      const v = min + (max - min) * i / ticks, yy = y(v);
      svg.append(s('line', { x1: L, x2: W - R, y1: yy, y2: yy, stroke: Math.abs(v) < 1e-9 ? '#cbd5e1' : '#eef1f7', 'stroke-width': 1 }));
      svg.append(s('text', { x: L - 8, y: yy + 4, 'text-anchor': 'end', 'font-size': 11, fill: '#8492a6' }, compact(v)));
    }
    const band = (W - L - R) / Math.max(labels.length, 1);
    const bw = Math.min(22, (band - 10) / series.length - 2);
    const tip = h('div', { class: 'tip hidden' });
    labels.forEach((lb, i) => {
      const cx = L + band * i + band / 2;
      series.forEach((se, j) => {
        const v = se.values[i] || 0, x = cx - (series.length * (bw + 2) - 2) / 2 + j * (bw + 2);
        const y0 = y(0), y1 = y(v), top = Math.min(y0, y1), hh = Math.max(Math.abs(y1 - y0), v ? 1.5 : 0);
        svg.append(s('rect', { x, y: top, width: bw, height: hh, rx: Math.min(4, hh / 2), fill: se.color }));
      });
      if (labels.length <= 14 || i % 2 === 0) svg.append(s('text', { x: cx, y: H - 8, 'text-anchor': 'middle', 'font-size': 11, fill: '#8492a6' }, lb));
      const hit = s('rect', { x: L + band * i, y: T, width: band, height: H - T - B, fill: 'transparent' });
      hit.addEventListener('mouseenter', () => {
        tip.replaceChildren(h('b', null, lb), ...series.map(se => h('div', null, h('i', { style: { background: se.color } }), `${se.name}: ${format(se.values[i] || 0)}`)));
        tip.classList.remove('hidden'); tip.style.left = (cx / W * 100) + '%'; tip.style.top = (Math.min(...series.map(se => y(Math.max(se.values[i] || 0, 0)))) / H * 100) + '%';
      });
      hit.addEventListener('mouseleave', () => tip.classList.add('hidden'));
      svg.append(hit);
    });
    wrap.append(svg, tip);
    return wrap;
  }
  function legend(series) { return h('div', { class: 'legend' }, series.map(x => h('span', null, h('i', { style: { background: x.color } }), x.name))); }
  /** Labelled horizontal bars for a short ranked list (single hue, direct value labels). */
  function hbars(items, format = money) {
    const max = Math.max(1e-9, ...items.map(i => Math.abs(i.value)));
    return h('div', null, items.length ? items.map(i => h('div', { class: 'hbar' }, h('span', null, i.label), h('div', { class: 'track' }, h('i', { style: { width: Math.max(2, Math.abs(i.value) / max * 100) + '%', background: i.color || COLORS.blue } })), h('b', { class: 'num' }, format(i.value)))) : h('div', { class: 'muted small' }, t('No data for this period.')));
  }
  return { bars, legend, hbars, COLORS };
})();
