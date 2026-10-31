// Planner case file: one wedding, every section, one header. The header is
// the only place the stage appears. Each section module supplies a view plus
// handlers for its buttons (actions), selects (changes) and forms; every
// handler calls the planner API and the page re-renders from the server's
// response, so the screen always shows what is saved.
import { html, mount, on, toast, whenText, relDays, todayISO } from '../core/ui.js';
import { api, formValues } from '../core/api.js';
import { MILESTONES } from '../core/progress.js';
import { initAgentShell } from '../core/agent-shell.js';
import overview from '../agent/overview.js';
import consultation from '../agent/consultation.js';
import requirements from '../agent/requirements.js';
import vendors from '../agent/vendors.js';
import tasks, { taskUi } from '../agent/tasks.js';
import { agreement, payments, schedule, scheduleUi } from '../agent/delivery.js';

const SECTIONS = [overview, consultation, requirements, vendors, agreement, payments, tasks, schedule];
const root = document.getElementById('ag-view');
const subnav = document.getElementById('ag-section-nav');
const code = document.body.dataset.caseCode;

const ctx = {
  c: null, dir: null, planners: [], code,
  base: `/api/planner/weddings/${encodeURIComponent(code)}`,
  async call(method, path, body, { busy = '' } = {}) {
    if (busy) toast(busy, { tone: 'info' });
    const out = await api[{ GET: 'get', POST: 'post', PATCH: 'patch', PUT: 'put', DELETE: 'del' }[method]](`${ctx.base}${path}`, body);
    return out;
  },
  async reloadDirectory() { ctx.dir = await api.get('/api/planner/directory'); },
};
let section = 'overview';
const current = () => SECTIONS.find((s) => s.id === section) || overview;

function header() {
  const c = ctx.c;
  const w = c.wedding;
  const date = w.dateMode === 'exact' && w.weddingDate;
  return html`
    <header class="ag-pagehead case-head">
      <div>
        <a class="back" href="/agent/weddings">← Weddings</a>
        <p class="ag-eyebrow">${w.caseCode}${w.isDemo ? ' · demo record' : ''}</p>
        <h1 class="ag-title">${w.coupleLabel || 'Name not shared yet'}</h1>
        <p class="case-facts">
          <span><b>${whenText(w)}</b>${date ? ` · ${relDays(w.weddingDate, todayISO())}` : ''}</span>
          <span>${w.location || 'Place to be decided'}</span>
          ${w.guestEstimate ? html`<span>~${w.guestEstimate} guests</span>` : ''}
          <span>Planner <b>${w.planner ? w.planner.name : 'Unassigned'}</b></span>
        </p>
      </div>
      <div class="case-stage">
        <p class="case-stage-label">Current stage</p>
        <p class="case-stage-name">${c.stage.label}</p>
        <ol class="stage-track" aria-label="Milestones">${MILESTONES.map((m) => {
          const s = c.milestones.done.includes(m.key) ? 'done' : '';
          return html`<li class="${s ? 'is-done' : ''}" title="${m.label}"><span class="sr-only">${m.label}: ${s ? 'done' : 'not yet'}</span></li>`;
        })}</ol>
      </div>
    </header>
    ${available().length > 1 ? html`<label class="ws-jump field"><span class="field-label">Go to</span>
      <select data-jump>${available().map((s) => html`<option value="${s.id}" ${section === s.id ? 'selected' : ''}>${s.label}</option>`)}</select>
    </label>` : ''}`;
}

// Until a planner takes the wedding on, only the overview is available, so
// the navigation offers nothing that would lead nowhere.
const available = () => (ctx.c.wedding.planner ? SECTIONS : [overview]);

function renderSubnav() {
  subnav.hidden = false;
  subnav.querySelector('nav').innerHTML = String(html`${available().map((s) => html`<a href="#${s.id}" ${section === s.id ? 'aria-current=true' : ''}>${s.label}</a>`)}`);
}

function render() {
  if (!available().some((s) => s.id === section)) {
    section = 'overview';
    if (location.hash && location.hash !== '#overview') history.replaceState(null, '', '#overview');
  }
  renderSubnav();
  mount(root, html`${header()}<div class="ws-body">${current().view(ctx)}</div>`);
  document.title = `${ctx.c.wedding.coupleLabel || ctx.code} · Case file · The Royal Knot`;
}

// Run a handler; on success re-render from the returned case.
async function perform(fn, { button, success } = {}) {
  if (button) button.disabled = true;
  try {
    const out = await fn();
    if (out && out.wedding) {
      ctx.c = out;
      render();
      if (success) toast(success);
    } else if (button) button.disabled = false;
  } catch (err) {
    toast(err.message, { tone: 'error' });
    if (button) button.disabled = false;
  }
}

on(root, 'click', 'button[data-action]', (e, t) => {
  const fn = current().actions?.[t.dataset.action] || overview.actions[t.dataset.action];
  if (fn) perform(() => fn(t, ctx), { button: t });
});
on(root, 'change', 'select[data-action]', (e, t) => {
  const fn = current().changes?.[t.dataset.action];
  if (fn) perform(() => fn(t, ctx));
});
on(root, 'submit', 'form[data-form]', (e, form) => {
  e.preventDefault();
  if (!form.reportValidity()) return;
  const s = current();
  const name = form.dataset.form;
  const fn = s.forms?.[name] || overview.forms[name];
  if (fn) perform(() => fn(formValues(form), ctx, form, e.submitter), { button: e.submitter, success: s.success?.[name] });
});
on(root, 'change', 'select[data-task-filter]', (e, t) => { taskUi[t.name] = t.value; render(); });
on(root, 'click', '[data-sched]', (e, t) => { scheduleUi.view = t.dataset.sched; render(); root.querySelector(`[data-sched="${scheduleUi.view}"]`)?.focus(); });
on(root, 'change', '[data-jump]', (e, t) => { location.hash = t.value; });

window.addEventListener('hashchange', () => {
  section = location.hash.slice(1) || 'overview';
  render();
  root.querySelector('.ws-body')?.scrollIntoView({ block: 'start' });
});

(async function boot() {
  initAgentShell();
  try {
    [ctx.c, ctx.dir, ctx.planners] = await Promise.all([api.get(ctx.base), api.get('/api/planner/directory'), api.get('/api/planner/planners')]);
  } catch (err) {
    mount(root, html`<section class="card"><p>${err.message}</p><a class="btn" href="/agent/weddings">All weddings</a></section>`);
    return;
  }
  section = location.hash.slice(1) || 'overview';
  render();
})();

