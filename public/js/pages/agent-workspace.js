// Agent: one wedding, one case file. The header is the single place for the
// stage; the overview leads with what needs attention and what's coming up.
// All sections render from one in-memory wedding object; interactions mutate
// that copy only.
import { html, mount, on, inr, fmtDate, pill, emptyState, previewNotice, relDays, daysFrom, visibility, initials } from '../core/ui.js';
import { STAGES, stageState, stageIndexOf, progressOf, milestoneStatuses, stageFromUrl, writeStageToUrl, publishProgress } from '../core/progress.js';
import { initDevbar, isDevMode } from '../core/devbar.js';
import { initAgentShell } from '../core/agent-shell.js';
import { loadWedding, asOf } from '../data/source.js';

import { renderMeeting, renderAgentNotes } from '../components/meeting.js';
import { renderRequirementsDoc, renderChecklist } from '../components/documents.js';
import { renderAgreement, AGREEMENT_FLOW } from '../components/agreement.js';
import { renderVendorRequests, renderComparison } from '../components/proposals.js';
import { renderTasks, TASK_STATUSES } from '../components/tasks.js';
import { renderAgentSchedule, ARRIVAL_FLOW } from '../components/schedule.js';
import { renderPaymentTimeline, renderVendorCosts, renderCloseout } from '../components/payments.js';


const TODAY = asOf();

// Add a row here to add a workspace section; the nav and router follow.
const SECTIONS = [
  { id: 'overview', label: 'Overview' },
  { id: 'meeting', label: 'Meeting & notes' },
  { id: 'documents', label: 'Requirements' },
  { id: 'vendors', label: 'Vendors & proposals' },
  { id: 'agreement', label: 'Agreement' },
  { id: 'tasks', label: 'Planning tasks' },
  { id: 'schedule', label: 'Schedule & run sheet' },
  { id: 'finance', label: 'Payments & closeout' },
];

const S = { w: null, state: null, section: 'overview', category: null, taskFilters: {}, scheduleView: 'events' };
const root = document.getElementById('ag-view');
const subnav = document.querySelector('#ag-section-nav');

function renderSubnav() {
  subnav.hidden = false;
  subnav.querySelector('nav').innerHTML = String(html`${SECTIONS.map((s) =>
    html`<a href="#${s.id}" ${S.section === s.id ? 'aria-current=true' : ''}>${s.label}</a>`)}`);
}

function header() {
  const w = S.w;
  const idx = stageIndexOf(S.state);
  const steps = milestoneStatuses(S.state);
  return html`
    <header class="ag-pagehead case-head">
      <div>
        <a class="back" href="/agent/weddings">← Weddings</a>
        <p class="ag-eyebrow">Demo session · ${w.mockKey}</p>
        <h1 class="ag-title">${w.coupleLabel}</h1>
        <p class="case-facts">
          <span><b>${w.approxDate ? fmtDate(w.approxDate) : 'Date not set'}</b>${w.approxDate ? ` · ${relDays(w.approxDate, TODAY)}` : ''}</span>
          <span>${w.location}</span>
          <span>~${w.guests} guests</span>
          <span>${w.budgetRange}</span>
          <span>Planner <b>${w.planner || 'Unassigned'}</b></span>
        </p>
      </div>
      <div class="case-stage">
        <p class="case-stage-label">Stage</p>
        <p class="case-stage-name">${STAGES[idx].label}</p>
        <ol class="stage-track" aria-label="Milestones">${steps.map((m) => html`<li class="is-${m.status}" title="${m.label}"><span class="sr-only">${m.label}: ${m.status}</span></li>`)}</ol>
      </div>
    </header>
    <label class="ws-jump field"><span class="field-label">Go to</span>
      <select data-jump>${SECTIONS.map((s) => html`<option value="${s.id}" ${S.section === s.id ? 'selected' : ''}>${s.label}</option>`)}</select>
    </label>`;
}

// ---------- overview: what needs attention, what's coming up ----------
function attentionItems(w) {
  const items = [];
  const level = (iso) => (daysFrom(iso, TODAY) < 0 ? 'high' : daysFrom(iso, TODAY) <= 7 ? 'soon' : 'normal');
  if (!w.planner) items.push({ title: 'Assign a planner', meta: 'No planner assigned', level: 'high', section: 'overview' });
  if (w.nextAction) items.push({ title: w.nextAction.label, meta: `Due ${fmtDate(w.nextAction.due, { day: 'numeric', month: 'short' })}`, level: level(w.nextAction.due), section: w.nextAction.section, sort: w.nextAction.due });
  w.tasks.filter((t) => t.status !== 'Done' && daysFrom(t.due, TODAY) <= 7 && t.title !== w.nextAction?.label)
    .forEach((t) => items.push({ title: t.title, meta: `${t.owner} · ${relDays(t.due, TODAY)}`, level: level(t.due), section: 'tasks', sort: t.due }));
  w.payments.filter((p) => p.status === 'Overdue' || (p.status === 'Due' && daysFrom(p.due, TODAY) <= 45))
    .forEach((p) => items.push({ title: `${p.label} · ${inr(p.amount)}`, meta: p.status === 'Overdue' ? 'Payment overdue' : `Due ${fmtDate(p.due, { day: 'numeric', month: 'short' })}`, level: p.status === 'Overdue' ? 'high' : 'soon', section: 'finance', sort: p.due }));
  if (w.payment?.status === 'Overdue' && !w.payments.length) items.push({ title: `${w.payment.label} · ${inr(w.payment.amount)}`, meta: 'Payment overdue', level: 'high', section: 'finance', sort: w.payment.due });
  w.vendorRequests.filter((r) => r.responses < r.sentTo && !r.proposals.some((p) => p.status === 'Selected'))
    .forEach((r) => items.push({ title: `Chase ${r.sentTo - r.responses} ${r.category.toLowerCase()} quote${r.sentTo - r.responses > 1 ? 's' : ''}`, meta: `Due ${fmtDate(r.dueBy, { day: 'numeric', month: 'short' })}`, level: level(r.dueBy), section: 'vendors', sort: r.dueBy }));
  if (w.overdueTasks && !w.tasks.length) items.push({ title: `${w.overdueTasks} overdue tasks`, meta: 'Planning tasks', level: 'high', section: 'tasks' });
  const rank = { high: 0, soon: 1, normal: 2 };
  items.sort((a, b) => rank[a.level] - rank[b.level] || (a.sort || '').localeCompare(b.sort || ''));
  return items.slice(0, 3);
}

function viewOverview() {
  const w = S.w;
  const items = attentionItems(w);
  const openTasks = w.tasks.filter((task) => task.status !== 'Done').length;
  const partners = w.people.filter((person) => person.role === 'Partner');
  const priority = (item) => html`
    <li class="attn-${item.level}">
      <span class="attn-mark" aria-hidden="true"></span>
      <span><span class="attn-title">${item.title}</span><span class="attn-meta">${item.level === 'high' ? html`<span class="due-overdue">Urgent · </span>` : ''}${item.meta}</span></span>
      <a class="btn btn-small btn-ghost" href="#${item.section}">Open<span class="sr-only"> ${item.title}</span></a>
    </li>`;

  return html`
    <div class="ws-layout ws-overview">
      <section class="card priority-card" aria-labelledby="attn-h">
        <div class="card-head">
          <h2 id="attn-h" class="card-title">Needs attention</h2>
          <span class="muted small">${openTasks} open tasks</span>
        </div>
        ${items.length ? html`
          <ul class="attn priority-list">${priority(items[0])}</ul>
          ${items.length > 1 ? html`
            <details class="overview-more">
              <summary>${items.length - 1} more actions</summary>
              <ul class="attn">${items.slice(1).map(priority)}</ul>
            </details>` : ''}` : emptyState({ title: 'All caught up' })}
      </section>

      <aside class="card couple-shared couple-compact" aria-labelledby="cp-h">
        <div class="card-head"><h2 id="cp-h" class="card-title">Couple</h2>${visibility('shared', 'Shared')}</div>
        <p class="couple-names">${partners.map((person) => person.name).join(' & ')}</p>
        ${w.preferences.length
          ? html`<p class="compact-priorities">${w.preferences.slice(0, 3).join(' · ')}</p>`
          : html`<p class="muted small">No priorities shared yet.</p>`}
        ${w.traditions.note ? html`<details class="family-note">
          <summary>Family notes</summary>
          <blockquote class="quote">${w.traditions.note}</blockquote>
          ${w.traditions.discussWithPlanner ? html`<p class="small muted">Discuss with planner.</p>` : ''}
        </details>` : ''}
      </aside>
    </div>`;
}
const viewMeeting = () => html`<div class="ws-grid"><div class="ws-col">${renderMeeting(S.w.meeting)}</div><div class="ws-col">${renderAgentNotes(S.w.agentNotes)}</div></div>`;
const viewDocuments = () => html`<div class="ws-grid ws-grid-wide"><div class="ws-col">${renderRequirementsDoc(S.w.requirements, { audience: 'agent' })}</div><div class="ws-col">${renderChecklist(S.w.checklist)}</div></div>`;
const viewAgreement = () => renderAgreement(S.w.agreement, { audience: 'agent' });

function viewVendors() {
  const reqs = S.w.vendorRequests;
  const category = S.category || reqs[0]?.category;
  const req = reqs.find((r) => r.category === category);
  return html`${renderVendorRequests(reqs, category)}
    ${req ? renderComparison({ category, options: req.proposals, audience: 'agent', categories: reqs.map((r) => r.category) }) : ''}
    ${req ? html`<div class="row-end"><span class="muted small">Couple sees the shortlist only.</span><button class="btn" type="button" data-action="send-shortlist">Send shortlist to couple</button></div>` : ''}`;
}

const viewTasks = () => renderTasks(S.w.tasks, S.taskFilters);

// Day-of run sheet: every arrival and start time, in order, per day.
function runSheet(days) {
  if (!days.length) return emptyState({ icon: 'calendar', title: 'No schedule yet', body: 'Add events to build the run sheet.' });
  return html`<div class="ag-sheet"><table class="ag-table runsheet">
    <thead><tr><th scope="col">Time</th><th scope="col">What happens</th><th scope="col">Owner</th><th scope="col">Status</th></tr></thead>
    <tbody>${days.map((d, di) => {
      const rows = [];
      d.events.forEach((e, ei) => {
        rows.push({ time: e.start, what: html`<b>${e.name} begins</b><span class="cell-sub">${e.venue}</span>`, owner: e.owner, status: null });
        e.vendors.forEach((v, vi) => rows.push({ time: v.arrival, what: html`${v.name} arrives<span class="cell-sub">${v.role} · for ${e.name}</span>`, owner: e.owner, status: html`<button class="pill-btn" type="button" data-action="arrival" data-day="${di}" data-event="${ei}" data-vendor="${vi}">${pill(v.status)}<span class="sr-only">, change status</span></button>` }));
      });
      rows.sort((a, b) => a.time.localeCompare(b.time));
      return html`<tr class="rs-day"><td colspan="4">${d.label} · ${fmtDate(d.date, { weekday: 'long', day: 'numeric', month: 'long' })}</td></tr>
        ${rows.map((r) => html`<tr><td data-label="Time" class="num">${r.time}</td><td data-label="What" class="wide">${r.what}</td><td data-label="Owner"><span class="who"><span class="who-dot" aria-hidden="true">${initials(r.owner)}</span>${r.owner}</span></td><td data-label="Status">${r.status || html`<span class="muted small">Event</span>`}</td></tr>`)}`;
    })}</tbody></table></div>`;
}

function viewSchedule() {
  return html`
    <div class="ag-filters">
      <div class="seg-toggle" role="group" aria-label="Schedule view">
        <button type="button" data-sched="events" aria-pressed="${S.scheduleView === 'events'}">By event</button>
        <button type="button" data-sched="runsheet" aria-pressed="${S.scheduleView === 'runsheet'}">Day-of run sheet</button>
      </div>
      <span class="muted small">${visibility('shared', 'Times shared with couple')} ${visibility('internal', 'Arrivals & owners internal')}</span>
    </div>
    ${S.scheduleView === 'runsheet' ? runSheet(S.w.schedule) : renderAgentSchedule(S.w.schedule)}`;
}

const viewFinance = () => html`${renderPaymentTimeline(S.w.payments, { audience: 'agent' })}${renderVendorCosts(S.w.vendorBills, S.w.extras)}${renderCloseout(S.w)}`;

const VIEWS = { overview: viewOverview, meeting: viewMeeting, documents: viewDocuments, agreement: viewAgreement, vendors: viewVendors, tasks: viewTasks, schedule: viewSchedule, finance: viewFinance };

function render() {
  if (!VIEWS[S.section]) S.section = 'overview';
  renderSubnav();
  mount(root, html`${header()}<div class="ws-body">${VIEWS[S.section]()}</div>`);
}
// ---------- interactions (in-memory only) ----------
on(root, 'click', '[data-action]', (e, t) => {
  const a = t.dataset.action;
  const w = S.w;
  if (a === 'meet-link') previewNotice('Meet link coming later.');
  else if (a === 'generate-doc') previewNotice('Draft generation coming later.');
  else if (a === 'send-doc') previewNotice('Not sent · sharing coming later.');
  else if (a === 'agreement-advance') {
    const i = AGREEMENT_FLOW.indexOf(w.agreement.status);
    const next = AGREEMENT_FLOW[i + 1];
    w.agreement.status = next;
    w.agreement.history = [...(w.agreement.history || []), { status: next, at: TODAY }];
    previewNotice(`Status set to “${next}” in this preview only. No document was ${next === 'Signed' ? 'signed or attached' : 'sent'}.`);
    render();
  } else if (a === 'category') { S.category = t.dataset.category; render(); }
  else if (a === 'shortlist' || a === 'decline') {
    const req = w.vendorRequests.find((r) => r.category === (S.category || w.vendorRequests[0].category));
    req.proposals[+t.dataset.index].status = a === 'shortlist' ? 'Shortlisted' : 'Declined';
    render();
  } else if (a === 'send-shortlist') previewNotice('Not sent · portals use separate preview data.');
  else if (a === 'request-quotes') previewNotice('Quote requests coming later.');
  else if (a === 'task-status') {
    const task = w.tasks[+t.dataset.index];
    task.status = TASK_STATUSES[(TASK_STATUSES.indexOf(task.status) + 1) % TASK_STATUSES.length];
    render();
  } else if (a === 'arrival') {
    const v = w.schedule[+t.dataset.day].events[+t.dataset.event].vendors[+t.dataset.vendor];
    v.status = ARRIVAL_FLOW[(ARRIVAL_FLOW.indexOf(v.status) + 1) % ARRIVAL_FLOW.length];
    render();
  } else if (a === 'remind') previewNotice('Preview only · no reminder sent.');
});
on(root, 'click', '[data-sched]', (e, t) => { S.scheduleView = t.dataset.sched; render(); root.querySelector(`[data-sched="${S.scheduleView}"]`)?.focus(); });
on(root, 'change', '[data-jump]', (e, t) => { location.hash = t.value; });
on(root, 'change', '[data-action="toggle-check"]', (e, t) => { S.w.checklist[+t.dataset.index].done = t.checked; render(); });
on(root, 'change', 'select[data-filter]', (e, t) => { S.taskFilters[t.dataset.filter] = t.value; render(); });

on(root, 'submit', 'form[data-form]', (e, form) => {
  e.preventDefault();
  const fd = new FormData(form);
  if (form.dataset.form === 'add-note') {
    const text = String(fd.get('note') || '').trim();
    if (!text) return;
    S.w.agentNotes.push({ at: new Date().toISOString(), author: 'You (preview)', text, unsaved: true });
    previewNotice('Preview only · note not saved.');
  } else if (form.dataset.form === 'add-task') {
    S.w.tasks.push({ title: fd.get('title'), owner: fd.get('owner'), ownerType: fd.get('ownerType'), stage: fd.get('stage'), due: fd.get('due'), status: 'Pending' });
    previewNotice('Preview only · task not saved.');
  }
  render();
});

window.addEventListener('hashchange', () => { S.section = location.hash.slice(1) || 'overview'; render(); window.scrollTo({ top: 0 }); });

(async function boot() {
  initAgentShell();
  const key = document.body.dataset.mockKey;
  S.w = await loadWedding(key);
  if (!S.w) {
    initDevbar();
    mount(root, html`<div class="card">${emptyState({ title: 'No mock wedding with this preview key', body: 'Go back to the weddings list to open a sample case.' })}<div class="row-center"><a class="btn" href="/agent/weddings">All weddings</a></div></div>`);
    return;
  }
  document.title = `${S.w.coupleLabel} · Case file · The Royal Knot`;
  S.state = stageState(stageFromUrl() ?? S.w.stage);
  S.section = location.hash.slice(1) || 'overview';
  initDevbar({
    stage: stageIndexOf(S.state),
    onStage: (i) => { S.state = stageState(i); if (isDevMode()) writeStageToUrl(i); publishProgress(progressOf(S.state)); render(); },
  });
  render();
})();
