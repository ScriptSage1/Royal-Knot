// Small helpers shared by the planner's case-file sections.
import { html, visibility } from '../core/ui.js';

export const FORMAT = { video: 'Video call', in_person: 'In person', phone: 'Phone call' };
export const OWNER = { agency: 'Agency', couple: 'Couple', vendor: 'Vendor' };
export const TASK_STATUS = { todo: 'To do', in_progress: 'In progress', done: 'Done', blocked: 'Blocked' };
export const TOPIC = { emotion: 'Emotions', family: 'Family', practical: 'Practical', culture: 'Culture & customs', general: 'General' };
export const SOURCING = { help: 'Help us find vendors', own: 'Already has some vendors', later: 'Will decide later', not_needed: 'No vendor sourcing needed' };
export const BUDGET = { range: (w) => w.budgetRange || 'A range in mind', no_fixed: () => 'No fixed budget', unsure: () => 'Not sure yet', prefer_not: () => 'Prefers not to say', unanswered: () => 'Not answered' };

export const select = (name, options, value, attrs = '') => html`
  <select name="${name}" ${attrs}>${Object.entries(options).map(([v, l]) => html`<option value="${v}" ${String(value) === v ? 'selected' : ''}>${l}</option>`)}</select>`;

export const field = (label, control, hint = '') => html`
  <label class="field"><span class="field-label">${label}</span>${control}${hint ? html`<span class="field-hint">${hint}</span>` : ''}</label>`;

// kind: 'internal' (agency only), 'shared' (the couple can see it) or null.
export const card = ({ title, kind = null, label = '', extra = '' }, body) => html`
  <section class="card ${kind === 'internal' ? 'card-internal' : ''}">
    <div class="card-head"><h2 class="card-title">${title}</h2>${kind ? visibility(kind, label) : ''}${extra}</div>
    ${body}
  </section>`;

// datetime-local value from an ISO-like string.
export const dtLocal = (iso) => (iso ? iso.slice(0, 16) : '');
