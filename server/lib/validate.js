// Server-side input normalisation. Each helper returns a clean value or throws
// a 400 with a message that is safe to show. Routes never trust the browser.
const { badRequest } = require('./errors');

const CONTROL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

function text(v, { field = 'Value', max = 2000, required = false, multiline = true } = {}) {
  if (v == null) v = '';
  if (typeof v !== 'string' && typeof v !== 'number') throw badRequest(`${field} must be text.`);
  let s = String(v).replace(CONTROL, '').replace(/\r\n?/g, '\n');
  if (!multiline) s = s.replace(/\s+/g, ' ');
  s = s.trim();
  if (required && !s) throw badRequest(`${field} is required.`);
  if (s.length > max) throw badRequest(`${field} must be ${max} characters or fewer.`);
  return s;
}
const line = (v, opts = {}) => text(v, { max: 200, ...opts, multiline: false });

function int(v, { field = 'Number', min = 0, max = 1e12, required = false } = {}) {
  if (v === '' || v == null) {
    if (required) throw badRequest(`${field} is required.`);
    return null;
  }
  const n = typeof v === 'number' ? v : Number(String(v).replace(/[,\s₹]/g, ''));
  if (!Number.isInteger(n) || n < min || n > max) throw badRequest(`${field} must be a whole number between ${min} and ${max}.`);
  return n;
}

function oneOf(v, list, { field = 'Value', required = true } = {}) {
  if ((v === '' || v == null) && !required) return null;
  if (!list.includes(v)) throw badRequest(`${field} is not a valid choice.`);
  return v;
}

const DATE = /^\d{4}-\d{2}-\d{2}$/;
function date(v, { field = 'Date', required = false } = {}) {
  if (v === '' || v == null) {
    if (required) throw badRequest(`${field} is required.`);
    return null;
  }
  if (typeof v !== 'string' || !DATE.test(v) || Number.isNaN(Date.parse(`${v}T00:00:00Z`))) throw badRequest(`${field} must be a valid date.`);
  return v;
}
function month(v, { field = 'Month' } = {}) {
  if (v === '' || v == null) return null;
  if (typeof v !== 'string' || !/^\d{4}-(0[1-9]|1[0-2])$/.test(v)) throw badRequest(`${field} must be a valid month.`);
  return v;
}
function dateTime(v, { field = 'Date and time', required = false } = {}) {
  if (v === '' || v == null) {
    if (required) throw badRequest(`${field} is required.`);
    return null;
  }
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(v) || Number.isNaN(Date.parse(v))) throw badRequest(`${field} must be a valid date and time.`);
  return v;
}
function time(v, { field = 'Time', required = false } = {}) {
  if (v === '' || v == null) {
    if (required) throw badRequest(`${field} is required.`);
    return '';
  }
  if (typeof v !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(v)) throw badRequest(`${field} must be a time like 18:30.`);
  return v;
}

// Only http(s) links, so a stored link can never become `javascript:`.
function url(v, { field = 'Link' } = {}) {
  const s = line(v, { field, max: 500 });
  if (!s) return '';
  let u;
  try { u = new URL(s); } catch { throw badRequest(`${field} must be a full web address starting with https://`); }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') throw badRequest(`${field} must start with https://`);
  return u.toString();
}

function email(v) {
  const s = line(v, { field: 'Email', max: 254, required: true }).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)) throw badRequest('Enter a valid email address.');
  return s;
}

const bool = (v) => v === true || v === 'true' || v === 'on' || v === 1 || v === '1';

function id(v, field = 'Id') {
  const n = Number(v);
  if (!Number.isInteger(n) || n <= 0) throw badRequest(`${field} is not valid.`);
  return n;
}

module.exports = { text, line, int, oneOf, date, month, dateTime, time, url, email, bool, id };
