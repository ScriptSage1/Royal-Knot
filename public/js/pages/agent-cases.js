// Agent: list of couple/wedding cases (mock).
import { html, mount, on, inr, fmtDate, pill, previewNotice } from '../core/ui.js';
import { STAGES, stageState, progressOf } from '../core/progress.js';
import { initDevbar } from '../core/devbar.js';
import { listWeddings } from '../data/source.js';
import { renderProgressBar } from '../components/journey.js';

const S = { cases: [], q: '', planner: '', phase: '' };
const root = document.getElementById('ag-view');

const PHASES = [
  { id: 'enquiry', label: 'Enquiry & consultation', test: (s) => s <= 3 },
  { id: 'planning', label: 'Planning', test: (s) => s >= 4 && s <= 7 },
  { id: 'final', label: 'Final stretch', test: (s) => s >= 8 },
];

function filtered() {
  const q = S.q.trim().toLowerCase();
  return S.cases.filter((c) =>
    (!q || [c.coupleLabel, c.location, c.planner].join(' ').toLowerCase().includes(q)) &&
    (!S.planner || (S.planner === 'Unassigned' ? !c.planner : c.planner === S.planner)) &&
    (!S.phase || PHASES.find((p) => p.id === S.phase).test(c.stage)));
}

function rows(list) {
  if (!list.length) return html`<tr><td colspan="6" class="muted center">No weddings match these filters.</td></tr>`;
  return list.map((c) => html`
    <tr>
      <th scope="row">
        <a class="case-link" href="/agent/weddings/${c.mockKey}">${c.coupleLabel}</a>
        <small class="muted">${c.location}</small>
      </th>
      <td>${c.approxDate ? fmtDate(c.approxDate) : html`<span class="muted">Not decided</span>`}</td>
      <td class="case-stage">${pill(c.stage >= 9 ? 'Complete' : c.stage >= 4 ? 'In progress' : 'Open', STAGES[c.stage].label)}${renderProgressBar(progressOf(stageState(c.stage)), `${c.coupleLabel} progress`)}</td>
      <td>${c.planner || html`<span class="pill pill-warn">Unassigned</span>`}</td>
      <td>${c.nextStep}${c.flags.length ? html`<div class="flags">${c.flags.map((f) => html`<span class="pill pill-risk">${f}</span>`)}</div>` : ''}</td>
      <td class="num">${c.moneyDue ? inr(c.moneyDue) : html`<span class="muted">—</span>`}</td>
    </tr>`);
}

function render() {
  const list = filtered();
  const planners = [...new Set(S.cases.map((c) => c.planner || 'Unassigned'))];
  mount(root, html`
    <header class="ag-head">
      <div>
        <p class="eyebrow">Weddings</p>
        <h1 class="ag-title">All weddings</h1>
        <p class="muted">${S.cases.length} cases in mock data · new enquiries will arrive from the couple portal in a later module.</p>
      </div>
      <button class="btn" type="button" data-action="new-case">New enquiry</button>
    </header>
    <ul class="kpis">
      ${PHASES.map((p) => html`<li><span>${p.label}</span><strong>${S.cases.filter((c) => p.test(c.stage)).length}</strong></li>`)}
      <li><span>Needs attention</span><strong>${S.cases.filter((c) => c.flags.length).length}</strong></li>
    </ul>
    <section class="card">
      <div class="toolbar">
        <label class="field field-inline field-grow"><span class="field-label">Search</span><input type="search" data-filter="q" value="${S.q}" placeholder="Couple, location or planner"></label>
        <label class="field field-inline"><span class="field-label">Planner</span><select data-filter="planner"><option value="">All</option>${planners.map((p) => html`<option ${S.planner === p ? 'selected' : ''}>${p}</option>`)}</select></label>
        <label class="field field-inline"><span class="field-label">Phase</span><select data-filter="phase"><option value="">All</option>${PHASES.map((p) => html`<option value="${p.id}" ${S.phase === p.id ? 'selected' : ''}>${p.label}</option>`)}</select></label>
      </div>
      <div class="table-wrap">
        <table class="table cases-table">
          <thead><tr><th scope="col">Couple</th><th scope="col">Date</th><th scope="col">Stage</th><th scope="col">Planner</th><th scope="col">Next step</th><th scope="col" class="num">Money due</th></tr></thead>
          <tbody id="case-rows">${rows(list)}</tbody>
        </table>
      </div>
    </section>`);
}

on(root, 'input', '[data-filter="q"]', (e, t) => { S.q = t.value; document.getElementById('case-rows').innerHTML = String(rows(filtered())); });
on(root, 'change', 'select[data-filter]', (e, t) => { S[t.dataset.filter] = t.value; render(); });
on(root, 'click', '[data-action="new-case"]', () => {
  previewNotice('Creating cases is a later module. No case or workspace was created.');
});

(async function boot() {
  initDevbar();
  S.cases = await listWeddings();
  render();
})();
