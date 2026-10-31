// Date helpers. Dates are stored as ISO strings (YYYY-MM-DD, or
// YYYY-MM-DDTHH:MM for local appointment times).
const pad = (n) => String(n).padStart(2, '0');
const localISO = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

const today = () => localISO(new Date());
const addDays = (iso, n) => { const d = new Date(`${iso}T00:00:00`); d.setDate(d.getDate() + n); return localISO(d); };
const daysBetween = (a, b) => Math.round((new Date(`${b}T00:00:00`) - new Date(`${a}T00:00:00`)) / 86400000);
const nowISO = () => new Date().toISOString().replace(/\.\d+Z$/, 'Z');

module.exports = { today, addDays, daysBetween, nowISO };
