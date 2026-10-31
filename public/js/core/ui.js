// Small rendering helpers shared by every component.
// `html` is a tagged template that escapes interpolated values unless they
// were produced by `html`/`raw`, so mock (and later real) data is always safe.

class Raw {
  constructor(s) { this.s = s; }
  toString() { return this.s; }
}

export const raw = (s) => new Raw(String(s));

export const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function flat(v) {
  if (v == null || v === false) return '';
  if (Array.isArray(v)) return v.map(flat).join('');
  if (v instanceof Raw) return v.s;
  return esc(v);
}

export function html(strings, ...vals) {
  let out = '';
  strings.forEach((s, i) => { out += s + (i < vals.length ? flat(vals[i]) : ''); });
  return new Raw(out);
}

export const mount = (el, view) => { el.innerHTML = String(view); };

// Delegated events: on(root, 'click', '[data-action]', (e, target) => …)
export function on(root, type, selector, fn) {
  root.addEventListener(type, (e) => {
    const t = e.target.closest(selector);
    if (t && root.contains(t)) fn(e, t);
  });
}

// ---------- formatting ----------
const inrFmt = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });
export const inr = (n) => (n == null ? '—' : inrFmt.format(n));

export const fmtDate = (iso, opts = { day: 'numeric', month: 'short', year: 'numeric' }) =>
  iso ? new Date(iso + (iso.length === 10 ? 'T00:00:00' : '')).toLocaleDateString('en-IN', opts) : '—';

export const fmtDay = (iso) => fmtDate(iso, { weekday: 'short', day: 'numeric', month: 'short' });
export const fmtMonth = (ym) => (ym ? new Date(`${ym}-01T00:00:00`).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' }) : '—');
export const fmtDateTime = (iso) => (iso ? new Date(iso).toLocaleString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }) : '—');
export const fmtTime = (hhmm) => {
  if (!hhmm) return '';
  const [h, m] = hhmm.split(':').map(Number);
  return new Date(2000, 0, 1, h, m).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' });
};
export const todayISO = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

// How a wedding's date reads, whichever way the couple answered.
export function whenText(w) {
  if (w.dateMode === 'exact' && w.weddingDate) return fmtDate(w.weddingDate);
  if (w.dateMode === 'month' && w.weddingMonth) return fmtMonth(w.weddingMonth);
  return 'Date to be decided';
}

export const plural = (n, one, many = one + 's') => `${n} ${n === 1 ? one : many}`;

// ---------- status pills ----------
// One mapping for every status word used across modules, so new records only
// need a status string. Unknown statuses fall back to neutral.
const TONES = {
  ok: ['paid', 'accepted', 'approved', 'done', 'complete', 'completed', 'chosen', 'confirmed', 'shortlisted', 'responded', 'final', 'shared', 'arrived'],
  info: ['sent', 'requested', 'in_progress', 'in progress', 'received', 'upcoming', 'scheduled', 'invited', 'open', 'draft', 'pending'],
  warn: ['due', 'deferred', 'changes_requested', 'delayed', 'awaiting'],
  risk: ['overdue', 'declined', 'blocked', 'cancelled', 'not_progressed'],
};
export function tone(status) {
  const s = String(status || '').toLowerCase();
  for (const [t, words] of Object.entries(TONES)) if (words.includes(s)) return t;
  return 'neutral';
}
export const pill = (status, label = status) => html`<span class="pill pill-${tone(status)}">${label}</span>`;

// Who can see a section: 'internal' (agency only) or 'shared' (visible to the couple).
export const visibility = (kind, label) => html`<span class="vis vis-${kind}" title="${kind === 'internal' ? 'Agency only' : 'Visible to couple'}"><svg viewBox="0 0 16 16" aria-hidden="true">${raw(kind === 'internal'
  ? '<rect x="3.5" y="7" width="9" height="6.5" rx="1.5"/><path d="M5.5 7V5.2a2.5 2.5 0 0 1 5 0V7"/>'
  : '<path d="M1.5 8s2.4-4.5 6.5-4.5S14.5 8 14.5 8 12.1 12.5 8 12.5 1.5 8 1.5 8Z"/><circle cx="8" cy="8" r="2"/>')}</svg>${label || (kind === 'internal' ? 'Internal' : 'Shared with couple')}</span>`;

// Relative dates against a reference day (mock data uses a fixed "as of").
const DAY = 86400000;
export const daysFrom = (iso, ref) => Math.round((new Date(iso + 'T00:00:00') - new Date(ref + 'T00:00:00')) / DAY);
export function relDays(iso, ref) {
  const d = daysFrom(iso, ref);
  if (d === 0) return 'today';
  if (d === 1) return 'tomorrow';
  if (d === -1) return 'yesterday';
  return d > 0 ? `in ${d} days` : `${-d} days overdue`;
}
export const initials = (name) => (name || '?').split(/[\s.&]+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase();

export const emptyState = ({ title, body, icon = 'leaf' }) => html`
  <div class="empty">
    <svg class="empty-icon" viewBox="0 0 24 24" aria-hidden="true">${raw(ICONS[icon] || ICONS.leaf)}</svg>
    <p class="empty-title">${title}</p>
    ${body ? html`<p class="empty-body">${body}</p>` : ''}
  </div>`;

const ICONS = {
  leaf: '<path d="M5 19c0-8 6-13 14-13 0 8-5 14-13 14"/><path d="M5 19l7-7"/>',
  doc: '<path d="M7 3h7l4 4v14H7z"/><path d="M14 3v4h4M10 12h5M10 16h5"/>',
  calendar: '<rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 10h16M9 3v4M15 3v4"/>',
  lock: '<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
  coin: '<circle cx="12" cy="12" r="8"/><path d="M9 10h6M9 13h6M11 10c3 0 3 6-2 6l5 0"/>',
  people: '<circle cx="9" cy="9" r="3"/><circle cx="16" cy="10" r="2.5"/><path d="M4 19c0-3 2-5 5-5s5 2 5 5M14 19c0-2 1-4 3-4s3 2 3 4"/>',
};

// ---------- toasts ----------
// Short confirmations and errors after an action. Text is set with
// textContent, never HTML.
export function toast(message, { title = '', tone = 'ok' } = {}) {
  const region = document.getElementById('toast-region');
  if (!region) return;
  const t = document.createElement('div');
  t.className = `toast toast-${tone}`;
  t.setAttribute('role', tone === 'error' ? 'alert' : 'status');
  if (title) { const s = document.createElement('strong'); s.textContent = title; t.append(s); }
  const m = document.createElement('span'); m.textContent = message; t.append(m);
  region.appendChild(t);
  requestAnimationFrame(() => t.classList.add('in'));
  setTimeout(() => { t.classList.remove('in'); setTimeout(() => t.remove(), 300); }, tone === 'error' ? 6500 : 3600);
}

export const prefersReducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
