'use strict';
const { AppError } = require('../db');
const Fmt = require('../../shared/format');

const nowIso = () => new Date().toISOString();

function str(v, label, { required = false, max = 500 } = {}) {
  const s = v == null ? '' : String(v).trim();
  if (required && !s) throw new AppError(`${label} is required.`);
  if (s.length > max) throw new AppError(`${label} is too long (maximum ${max} characters).`);
  return s;
}
function num(v, label, { min = 0, max = 1e12, required = false } = {}) {
  if (v === '' || v == null) { if (required) throw new AppError(`${label} is required.`); return 0; }
  const n = Number(v);
  if (!Number.isFinite(n)) throw new AppError(`${label} must be a number.`);
  if (n < min) throw new AppError(`${label} cannot be less than ${min}.`);
  if (n > max) throw new AppError(`${label} is too large.`);
  return n;
}
function int(v, label, opts = {}) {
  const n = num(v, label, opts);
  if (!Number.isInteger(n)) throw new AppError(`${label} must be a whole number.`);
  return n;
}
function date(v, label, { required = false, fallback = null } = {}) {
  if (v === '' || v == null) { if (required && !fallback) throw new AppError(`${label} is required.`); return fallback; }
  if (!Fmt.isDate(v)) throw new AppError(`${label} is not a valid date.`);
  return v;
}
function oneOf(v, list, label, fallback) {
  if (v === '' || v == null) { if (fallback !== undefined) return fallback; throw new AppError(`${label} is required.`); }
  if (!list.includes(v)) throw new AppError(`${label} has an unsupported value.`);
  return v;
}
function idOrNull(v) { if (v === '' || v == null) return null; const n = Number(v); if (!Number.isInteger(n) || n <= 0) throw new AppError('Invalid record reference.'); return n; }
function id(v) { const n = idOrNull(v); if (n == null) throw new AppError('Record reference is required.'); return n; }
function email(v) {
  const s = str(v, 'Email', { max: 200 });
  if (s && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)) throw new AppError('Email address is not valid.');
  return s;
}
function like(q) { return '%' + String(q || '').trim().replace(/[\\%_]/g, m => '\\' + m) + '%'; }

module.exports = { nowIso, str, num, int, date, oneOf, id, idOrNull, email, like, AppError, Fmt };
