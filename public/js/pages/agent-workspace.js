// Agent: one wedding, one case file. The header is the single place for the
// stage; the overview leads with what needs attention and what's coming up.
// All sections render from one in-memory wedding object; interactions mutate
// that copy only.
import { html, mount, on, inr, fmtDate, pill, emptyState, previewNotice, relDays, daysFrom, visibility, initials } from '../core/ui.js';
import { STAGES, stageState, stageIndexOf, progressOf, milestoneStatuses, stageFromUrl, writeStageToUrl, publishProgress } from '../core/progress.js';
import { initDevbar, isDevMode } from '../core/devbar.js';
import { initAgentShell } from '../core/agent-shell.js';
import { loadWedding, asOf } from '../data/source.js';
import { renderPeople } from '../components/workspace.js';
import { renderMeeting, renderAgentNotes } from '../components/meeting.js';
import { renderRequirementsDoc, renderChecklist } from '../components/documents.js';
import { renderAgreement, AGREEMENT_FLOW } from '../components/agreement.js';
import { renderVendorRequests, renderComparison } from '../components/proposals.js';
import { renderTasks, TASK_STATUSES } from '../components/tasks.js';
import { renderAgentSchedule, ARRIVAL_FLOW } from '../components/schedule.js';
import { renderPaymentTimeline, renderVendorCosts, renderCloseout } from '../components/payments.js';
import { mountGarden } from '../garden/garden.js';

const TODAY = asOf();

// Add a row here to add a workspace section; the nav and router follow.
const SECTIONS = [
  { id: 'overview', label: 'Overview' },
  { id: 'meeting', label: 'Meeting & notes' },
  { id: 'documents', label: 'Requirements' },
  { id: 'agreement', label: 'Agreement' },
  { id: 'vendors', label: 'Vendors & proposals' },
  { id: 'tasks', label: 'Planning tasks' },
  { id: 'schedule', label: 'Schedule & run sheet' },
  { id: 'finance', label: 'Payments & closeout' },
];

// Suggested planner actions per stage, used when the case has little else due.
const STAGE_ACTIONS = [
  [['Assign a planner', 'overview'], ['Offer consultation slots', 'meeting']],
  [['Offer consultation slots', 'meeting']],
  [['Prepare for the consultation', 'meeting']],
  [['Draft the requirements document', 'documents'], ['Complete the planner checklist', 'documents']],
  [['Prepare the service agreement', 'agreement'], ['Send vendor requests', 'vendors']],
  [['Shortlist proposals and send to the couple', 'vendors']],
  [['Confirm vendor bookings', 'vendors'], ['Build the wedding schedule', 'schedule']],
  [['Collect the pre-wedding advance', 'finance']],
  [['Confirm vendor arrival times', 'schedule']],
  [['Final payment and vendor closeout after the event', 'finance']],
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
        <a class="back" href="/agent/weddings">← All weddings</a>
        <p class="ag-eyebrow">Case file</p>
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
        <p class="case-stage-label">Current stage</p>
        <p class="case-stage-name">${STAGES[idx].label}</p>
        <ol class="stage-track" aria-label="Milestones">${steps.map((m) => html`<li class="is-${m.status}" title="${m.label}"><span class="sr-only">${m.label}: ${m.status}</span></li>`)}</ol>
      </div>
    </header>
    <label class="ws-jump field"><span class="field-label">Section</span>
      <select data-jump>${SECTIONS.map((s) => html`<option value="${s.id}" ${S.section === s.id ? 'selected' : ''}>${s.label}</option>`)}</select>
    </label>`;
}

// ---------- overview: what needs attention, what's coming up ----------
function attentionItems(w) {
  const items = [];
  const level = (iso) => (daysFrom(iso, TODAY) < 0 ? 'high' : daysFrom(iso, TODAY) <= 7 ? 'soon' : 'normal');
  if (!w.planner) items.push({ title: 'Assign a planner', meta: 'This enquiry has no planner yet', due: null, level: 'high', section: 'overview' });
  if (w.nextAction) items.push({ title: w.nextAction.label, meta: `Next action · ${fmtDate(w.nextAction.due, { day: 'numeric', month: 'short' })} · ${relDays(w.nextAction.due, TODAY)}`, level: level(w.nextAction.due), section: w.nextAction.section, sort: w.nextAction.due });
  w.tasks.filter((t) => t.status !== 'Done' && daysFrom(t.due, TODAY) <= 7 && t.title !== w.nextAction?.label)
    .forEach((t) => items.push({ title: t.title, meta: `Task · ${t.owner} · ${relDays(t.due, TODAY)}`, level: level(t.due), section: 'tasks', sort: t.due }));
  w.payments.filter((p) => p.status === 'Overdue' || (p.status === 'Due' && daysFrom(p.due, TODAY) <= 45))
    .forEach((p) => items.push({ title: `${p.label} · ${inr(p.amount)}`, meta: `Couple payment · ${p.status === 'Overdue' ? 'overdue' : `due ${fmtDate(p.due, { day: 'numeric', month: 'short' })}`}`, level: p.status === 'Overdue' ? 'high' : 'soon', section: 'finance', sort: p.due }));
  if (w.payment?.status === 'Overdue' && !w.payments.length) items.push({ title: `${w.payment.label} · ${inr(w.payment.amount)}`, meta: 'Couple payment · overdue', level: 'high', section: 'finance', sort: w.payment.due });
  w.vendorRequests.filter((r) => r.responses < r.sentTo && !r.proposals.some((p) => p.status === 'Selected'))
    .forEach((r) => items.push({ title: `Chase ${r.sentTo - r.responses} ${r.category.toLowerCase()} quote${r.sentTo - r.responses > 1 ? 's' : ''}`, meta: `Vendor requests · due ${fmtDate(r.dueBy, { day: 'numeric', month: 'short' })}`, level: level(r.dueBy), section: 'vendors', sort: r.dueBy }));
  if (w.overdueTasks && !w.tasks.length) items.push({ title: `${w.overdueTasks} overdue task${w.overdueTasks > 1 ? 's' : ''}`, meta: 'Planning tasks', level: 'high', section: 'tasks' });
  const rank = { high: 0, soon: 1, normal: 2 };
  items.sort((a, b) => rank[a.level] - rank[b.level] || (a.sort || '').localeCompare(b.sort || ''));
  if (items.length < 3) {
    STAGE_ACTIONS[stageIndexOf(S.state)].forEach(([title, section]) => {
      if (!items.some((i) => i.title === title)) items.push({ title, meta: 'Suggested for this stage', level: 'normal', section });
    });
  }
  return items.slice(0, 6);
}

function agenda(w) {
  const rows = [];
  w.tasks.filter((t) => t.status !== 'Done' && daysFrom(t.due, TODAY) >= 0).forEach((t) => rows.push({ date: t.due, kind: 'Task', title: t.title, who: t.owner }));
  w.payments.filter((p) => p.status !== 'Paid').forEach((p) => rows.push({ date: p.due, kind: 'Payment', title: `${p.label} · ${inr(p.amount)}`, who: 'Couple' }));
  w.vendorBills.filter((b) => b.status !== 'Paid').forEach((b) => rows.push({ date: b.due, kind: 'Vendor bill', title: `${b.vendor} · ${inr(b.amount - b.paid)}`, who: 'Agency' }));
  w.schedule.forEach((d) => rows.push({ date: d.date, kind: 'Event', title: `${d.label}: ${d.events.map((e) => e.name).join(', ')}`, who: '' }));
  return rows.filter((r) => daysFrom(r.date, TODAY) <= 120).sort((a, b) => a.date.localeCompare(b.date)).slice(0, 7);
}

function viewOverview() {
  const w = S.w;
  const items = attentionItems(w);
  const ag = agenda(w);
  const counts = [['events', w.schedule.reduce((n, d) => n + d.events.length, 0)], ['proposals', w.vendorRequests.reduce((n, r) => n + r.proposals.length, 0)], ['tasks', w.tasks.length], ['payment milestones', w.payments.length]];
  return html`
    <div class="ws-layout">
      <div class="ws-stack">
        <section class="card" aria-labelledby="attn-h">
          <div class="card-head"><h2 id="attn-h" class="card-title">Needs your attention</h2><span class="muted small">${items.length} item${items.length === 1 ? '' : 's'}</span></div>
          <ul class="attn">
            ${items.map((it) => html`
              <li class="attn-${it.level}">
                <span class="attn-mark" aria-hidden="true"></span>
                <span><span class="attn-title">${it.title}</span><span class="attn-meta">${it.level === 'high' ? html`<span class="due-overdue">Urgent · </span>` : ''}${it.meta}</span></span>
                <a class="btn btn-small ${it.level === 'high' ? '' : 'btn-ghost'}" href="#${it.section}">Open<span class="sr-only"> ${it.title}</span></a>
              </li>`)}
          </ul>
        </section>
        <section class="card" aria-labelledby="ag-h">
          <div class="card-head"><h2 id="ag-h" class="card-title">Coming up</h2><span class="muted small">Next deadlines, payments and events</span></div>
          ${ag.length ? html`<ol class="agenda">
            ${ag.map((r) => html`<li>
              <span class="agenda-date"><b>${new Date(r.date + 'T00:00:00').getDate()}</b><small>${new Date(r.date + 'T00:00:00').toLocaleDateString('en-IN', { month: 'short' })}</small></span>
              <span><span class="cell-strong">${r.title}</span><span class="cell-sub">${relDays(r.date, TODAY)}${r.who ? ` · ${r.who}` : ''}</span></span>
              <span class="kind kind-${r.kind.split(' ')[0].toLowerCase()}">${r.kind}</span>
            </li>`)}
          </ol>` : emptyState({ icon: 'calendar', title: 'Nothing scheduled yet', body: 'Deadlines, payments and events appear here as the plan takes shape.' })}
        </section>
      </div>

      <aside class="ws-stack" aria-label="Case details">
        <section class="card couple-shared" aria-labelledby="cp-h">
          <div class="card-head"><h2 id="cp-h" class="card-title">From the couple</h2>${visibility('shared', 'Shared by the couple')}</div>
          ${renderPeople(w.people)}
          <h3 class="sub-h">What matters to them</h3>
          ${w.preferences.length ? html`<ul class="tags">${w.preferences.map((p) => html`<li>${p}</li>`)}</ul>` : html`<p class="muted small">Not shared yet.</p>`}
          <h3 class="sub-h">Traditions, customs & family practices</h3>
          ${w.traditions.note ? html`<blockquote class="quote">${w.traditions.note}</blockquote>` : html`<p class="muted small">Nothing shared yet — keep it couple-led.</p>`}
          ${w.traditions.discussWithPlanner ? html`<p class="small muted">They’d like to talk this through with their planner.</p>` : ''}
        </section>
        <section class="card" aria-labelledby="rec-h">
          <div class="card-head"><h2 id="rec-h" class="card-title">Case record</h2></div>
          <div class="ws-id"><span class="ws-id-label">Workspace ID</span><span class="ws-id-value">Assigned in a later module</span></div>
          <p class="record-line">${counts.map(([k, v]) => html`<span><b>${v}</b> ${k}</span>`)}</p>
        </section>
        <section class="card garden-mini" aria-labelledby="gd-h">
          <div class="card-head"><h2 id="gd-h" class="card-title">The couple’s view</h2><span class="muted small">Their garden at this stage</span></div>
          <div data-garden-slot></div>
        </section>
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
    ${req ? html`<div class="row-end"><span class="muted small">Only shortlisted options and planner notes reach the couple.</span><button class="btn" type="button" data-action="send-shortlist">Send shortlist to couple</button></div>` : ''}`;
}

const viewTasks = () => renderTasks(S.w.tasks, S.taskFilters);

// Day-of run sheet: every arrival and start time, in order, per day.
function runSheet(days) {
  if (!days.length) return emptyState({ icon: 'calendar', title: 'No schedule yet', body: 'The run sheet builds itself from the event schedule.' });
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
      <span class="muted small">${visibility('shared', 'Event times shared with couple')} ${visibility('internal', 'Arrivals & owners internal')}</span>
    </div>
    ${S.scheduleView === 'runsheet' ? runSheet(S.w.schedule) : renderAgentSchedule(S.w.schedule)}`;
}

const viewFinance = () => html`${renderPaymentTimeline(S.w.payments, { audience: 'agent' })}${renderVendorCosts(S.w.vendorBills, S.w.extras)}${renderCloseout(S.w)}`;

const VIEWS = { overview: viewOverview, meeting: viewMeeting, documents: viewDocuments, agreement: viewAgreement, vendors: viewVendors, tasks: viewTasks, schedule: viewSchedule, finance: viewFinance };

// The garden preview canvas is created once and moved into the overview on
// each render, so its WebGL context and textures survive re-renders.
const gardenEl = document.createElement('div');
gardenEl.className = 'garden-frame';
gardenEl.innerHTML = '<canvas aria-hidden="true"></canvas>';
let gardenMounted = false;

function render() {
  if (!VIEWS[S.section]) S.section = 'overview';
  renderSubnav();
  mount(root, html`${header()}<div class="ws-body">${VIEWS[S.section]()}</div>`);
  const slot = root.querySelector('[data-garden-slot]');
  if (slot) {
    slot.replaceWith(gardenEl);
    if (!gardenMounted) {
      gardenMounted = true;
      mountGarden(gardenEl.querySelector('canvas'), { progress: progressOf(S.state), layout: 'card' });
    }
  }
}

// ---------- interactions (in-memory only) ----------
on(root, 'click', '[data-action]', (e, t) => {
  const a = t.dataset.action;
  const w = S.w;
  if (a === 'meet-link') previewNotice('Google Meet is not connected yet. No meeting link exists.');
  else if (a === 'generate-doc') previewNotice('Drafting from the meeting is a later module. No document was generated.');
  else if (a === 'send-doc') previewNotice('Nothing was sent. Sharing documents with couples is a later module.');
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
  } else if (a === 'send-shortlist') previewNotice('Nothing was sent. The couple portal reads from its own mock data in this build.');
  else if (a === 'request-quotes') previewNotice('Vendor requests are a later module. No vendor was contacted.');
  else if (a === 'task-status') {
    const task = w.tasks[+t.dataset.index];
    task.status = TASK_STATUSES[(TASK_STATUSES.indexOf(task.status) + 1) % TASK_STATUSES.length];
    render();
  } else if (a === 'arrival') {
    const v = w.schedule[+t.dataset.day].events[+t.dataset.event].vendors[+t.dataset.vendor];
    v.status = ARRIVAL_FLOW[(ARRIVAL_FLOW.indexOf(v.status) + 1) % ARRIVAL_FLOW.length];
    render();
  } else if (a === 'remind') previewNotice('Reminders are a later module. Nothing was sent to the couple.');
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
    previewNotice('Note added to this tab only. It is not saved.');
  } else if (form.dataset.form === 'add-task') {
    S.w.tasks.push({ title: fd.get('title'), owner: fd.get('owner'), ownerType: fd.get('ownerType'), stage: fd.get('stage'), due: fd.get('due'), status: 'Pending' });
    previewNotice('Task added to this preview only. It is not saved.');
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
