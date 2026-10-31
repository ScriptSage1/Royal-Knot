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

export const plural = (n, one, many = one + 's') => `${n} ${n === 1 ? one : many}`;

// ---------- status pills ----------
// One mapping for every status word used across modules, so new records only
// need a status string. Unknown statuses fall back to neutral.
const TONES = {
  ok: ['paid', 'signed', 'approved', 'done', 'complete', 'completed', 'selected', 'arrived', 'confirmed', 'held', 'on track', 'received', 'settled'],
  info: ['sent', 'shortlisted', 'in progress', 'in review', 'scheduled', 'requested', 'viewed', 'sent to couple', 'booked', 'active', 'expected', 'open'],
  warn: ['due', 'due soon', 'awaiting', 'awaiting signature', 'pending', 'delayed', 'not confirmed', 'needs review', 'quote pending', 'at risk', 'partially paid'],
  risk: ['overdue', 'declined', 'blocked', 'cancelled', 'no show'],
};
export function tone(status) {
  const s = String(status || '').toLowerCase();
  for (const [t, words] of Object.entries(TONES)) if (words.includes(s)) return t;
  return 'neutral';
}
export const pill = (status, label = status) => html`<span class="pill pill-${tone(status)}">${label}</span>`;

// "Connects later" tag marks a visible future integration point.
export const futureTag = (label) => html`<span class="future-tag" title="Integration point for a later module">Connects later · ${label}</span>`;

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

// ---------- preview notices ----------
// Every button that would hit a real service calls this instead, so the UI
// never implies that anything was saved, sent, signed or paid.
export function previewNotice(message, title = 'Preview only') {
  const region = document.getElementById('toast-region');
  if (!region) return;
  const t = document.createElement('div');
  t.className = 'toast';
  t.innerHTML = String(html`<strong>${title}</strong><span>${message}</span>`);
  region.appendChild(t);
  requestAnimationFrame(() => t.classList.add('in'));
  setTimeout(() => { t.classList.remove('in'); setTimeout(() => t.remove(), 300); }, 4200);
}

export const prefersReducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
