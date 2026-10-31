// Agent: the wedding case list — an operational overview built around what to
// act on next. Attention filters double as the only workload indicators.
import { html, mount, on, inr, fmtDate, previewNotice, relDays, daysFrom, initials } from '../core/ui.js';
import { STAGES, stageState, milestoneStatuses } from '../core/progress.js';
import { initDevbar } from '../core/devbar.js';
import { initAgentShell } from '../core/agent-shell.js';
import { listWeddings, asOf } from '../data/source.js';

const TODAY = asOf();
const S = { cases: [], q: '', planner: '', phase: '', focus: 'all', sort: 'deadline' };
const root = document.getElementById('ag-view');

const PHASES = [
  { id: 'enquiry', label: 'Enquiry & consultation', test: (s) => s <= 3 },
  { id: 'planning', label: 'Planning', test: (s) => s >= 4 && s <= 7 },
  { id: 'final', label: 'Final stretch', test: (s) => s >= 8 },
];

const overdue = (iso) => iso && daysFrom(iso, TODAY) < 0;
const isUrgent = (c) => overdue(c.nextAction?.due) || c.payment?.status === 'Overdue' || !c.planner;
const FOCUS = [
  { id: 'all', label: 'All weddings', test: () => true },
  { id: 'attention', label: 'Needs attention', test: (c) => isUrgent(c) || c.overdueTasks > 0 || c.flags.length > 0, alert: true },
  { id: 'week', label: 'Due this week', test: (c) => c.nextAction && daysFrom(c.nextAction.due, TODAY) <= 7 },
  { id: 'unassigned', label: 'Unassigned', test: (c) => !c.planner, alert: true },
  { id: 'payments', label: 'Payment overdue', test: (c) => c.payment?.status === 'Overdue', alert: true },
];

function filtered() {
  const q = S.q.trim().toLowerCase();
  const focus = FOCUS.find((f) => f.id === S.focus);
  const list = S.cases.filter((c) =>
    focus.test(c) &&
    (!q || [c.coupleLabel, c.location, c.planner, c.nextAction?.label].join(' ').toLowerCase().includes(q)) &&
    (!S.planner || (S.planner === 'Unassigned' ? !c.planner : c.planner === S.planner)) &&
    (!S.phase || PHASES.find((p) => p.id === S.phase).test(c.stage)));
  const byDeadline = (a, b) => (a.nextAction?.due || '9999').localeCompare(b.nextAction?.due || '9999');
  const byDate = (a, b) => (a.approxDate || '9999').localeCompare(b.approxDate || '9999');
  return list.sort(S.sort === 'date' ? byDate : byDeadline);
}

const track = (stage) => html`<ol class="stage-track" aria-hidden="true">${milestoneStatuses(stageState(stage)).map((m) => html`<li class="is-${m.status}"></li>`)}</ol>`;
function dueClass(iso) {
  const d = daysFrom(iso, TODAY);
  return d < 0 ? 'due-overdue' : d <= 3 ? 'due-soon' : '';
}

function rows(list) {
  if (!list.length) return html`<tr class="ag-empty-row"><td colspan="6">No weddings match. <button class="link-btn" type="button" data-action="reset">Clear filters</button></td></tr>`;
  return list.map((c) => html`
    <tr class="${isUrgent(c) ? 'is-urgent' : ''}">
      <th scope="row">
        <a class="case-name" href="/agent/weddings/${c.mockKey}">${c.coupleLabel}</a>
        <span class="cell-sub">${c.location} · ~${c.guests} guests</span>
      </th>
      <td data-label="Wedding">
        ${c.approxDate ? html`<span class="cell-strong">${fmtDate(c.approxDate)}</span><span class="cell-sub">${relDays(c.approxDate, TODAY)}</span>` : html`<span class="muted">Date not set</span>`}
      </td>
      <td data-label="Stage" class="stage-cell">${STAGES[c.stage].label}${track(c.stage)}</td>
      <td data-label="Planner">${c.planner
        ? html`<span class="who"><span class="who-dot" aria-hidden="true">${initials(c.planner)}</span>${c.planner}</span>`
        : html`<span class="who who-none"><span class="who-dot" aria-hidden="true">?</span>Unassigned</span>`}</td>
      <td data-label="Next action" class="wide">
        <span class="cell-strong">${c.nextAction.label}</span>
        <span class="cell-sub ${dueClass(c.nextAction.due)}">${fmtDate(c.nextAction.due, { day: 'numeric', month: 'short' })} · ${relDays(c.nextAction.due, TODAY)}</span>
        ${c.overdueTasks ? html`<span class="flag">${c.overdueTasks} overdue task${c.overdueTasks > 1 ? 's' : ''}</span>` : ''}
        ${c.flags.filter((f) => f !== 'Unassigned' && f !== 'Advance overdue').map((f) => html`<span class="flag">${f}</span>`)}
      </td>
      <td data-label="Next payment" class="num">${c.payment
        ? html`<span class="cell-strong">${inr(c.payment.amount)}</span><span class="cell-sub">${c.payment.label}</span><span class="cell-sub ${c.payment.status === 'Overdue' ? 'due-overdue' : ''}">${c.payment.status === 'Overdue' ? `Overdue since ${fmtDate(c.payment.due, { day: 'numeric', month: 'short' })}` : `Due ${fmtDate(c.payment.due, { day: 'numeric', month: 'short' })}`}</span>`
        : html`<span class="muted">—</span>`}</td>
    </tr>`);
}

function render() {
  const list = filtered();
  const planners = [...new Set(S.cases.map((c) => c.planner || 'Unassigned'))];
  const urgent = S.cases.filter(isUrgent).length;
  mount(root, html`
    <header class="ag-pagehead">
      <div>
        <p class="ag-eyebrow">Weddings · as of ${fmtDate(TODAY)}</p>
        <h1 class="ag-title">All weddings</h1>
        <p class="ag-sub"><b>${S.cases.length}</b> active cases${urgent ? html` · <b>${urgent}</b> need action today` : ''}</p>
      </div>
      <button class="btn" type="button" data-action="new-case">New enquiry</button>
    </header>

    <div class="ag-filters">
      <div class="ag-chips" role="group" aria-label="Focus">
        ${FOCUS.map((f) => {
          const n = S.cases.filter(f.test).length;
          return html`<button type="button" class="ag-chip ${f.alert && n ? 'is-alert' : ''}" data-focus="${f.id}" aria-pressed="${S.focus === f.id}">${f.label}<b>${n}</b></button>`;
        })}
      </div>
    </div>
    <div class="ag-filters">
      <label class="field field-inline ag-search"><span class="field-label">Search</span><input type="search" data-filter="q" value="${S.q}" placeholder="Couple, place, planner or action"></label>
      <div class="ag-tools">
        <label class="field field-inline"><span class="field-label">Planner</span><select data-filter="planner"><option value="">All planners</option>${planners.map((p) => html`<option ${S.planner === p ? 'selected' : ''}>${p}</option>`)}</select></label>
        <label class="field field-inline"><span class="field-label">Phase</span><select data-filter="phase"><option value="">All phases</option>${PHASES.map((p) => html`<option value="${p.id}" ${S.phase === p.id ? 'selected' : ''}>${p.label}</option>`)}</select></label>
        <label class="field field-inline"><span class="field-label">Sort by</span><select data-filter="sort"><option value="deadline" ${S.sort === 'deadline' ? 'selected' : ''}>Next deadline</option><option value="date" ${S.sort === 'date' ? 'selected' : ''}>Wedding date</option></select></label>
      </div>
    </div>

    <div class="ag-sheet">
      <table class="ag-table">
        <caption class="sr-only">Wedding cases, ${list.length} shown</caption>
        <thead><tr><th scope="col">Couple</th><th scope="col">Wedding</th><th scope="col">Stage</th><th scope="col">Planner</th><th scope="col">Next action</th><th scope="col" class="num">Next payment</th></tr></thead>
        <tbody id="case-rows">${rows(list)}</tbody>
      </table>
    </div>
    <p class="ag-note">Sample data. New enquiries from the couple portal will appear here in a later module. A rose edge marks work that is overdue or unassigned.</p>`);
}

on(root, 'input', '[data-filter="q"]', (e, t) => { S.q = t.value; document.getElementById('case-rows').innerHTML = String(rows(filtered())); });
on(root, 'change', 'select[data-filter]', (e, t) => { S[t.dataset.filter] = t.value; render(); });
on(root, 'click', '[data-focus]', (e, t) => { S.focus = t.dataset.focus; render(); root.querySelector(`[data-focus="${S.focus}"]`).focus(); });
on(root, 'click', '[data-action="reset"]', () => { Object.assign(S, { q: '', planner: '', phase: '', focus: 'all' }); render(); });
on(root, 'click', '[data-action="new-case"]', () => previewNotice('Creating cases is a later module. No case or workspace was created.'));

(async function boot() {
  initAgentShell();
  initDevbar();
  S.cases = await listWeddings();
  render();
})();

