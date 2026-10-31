// Agent: wedding workspace dashboard. All sections render from one in-memory
// wedding object; interactions mutate that copy only.
import { html, mount, on, inr, fmtDate, pill, emptyState, previewNotice } from '../core/ui.js';
import { STAGES, stageState, stageIndexOf, progressOf, milestoneStatuses, stageFromUrl, writeStageToUrl, publishProgress } from '../core/progress.js';
import { initDevbar, isDevMode } from '../core/devbar.js';
import { loadWedding } from '../data/source.js';
import { renderJourney } from '../components/journey.js';
import { renderWorkspaceContainer, renderCaseFacts, renderPeople } from '../components/workspace.js';
import { renderMeeting, renderAgentNotes } from '../components/meeting.js';
import { renderRequirementsDoc, renderChecklist } from '../components/documents.js';
import { renderAgreement, AGREEMENT_FLOW } from '../components/agreement.js';
import { renderVendorRequests, renderComparison } from '../components/proposals.js';
import { renderTasks, TASK_STATUSES } from '../components/tasks.js';
import { renderAgentSchedule, ARRIVAL_FLOW } from '../components/schedule.js';
import { renderPaymentTimeline, renderVendorCosts, renderCloseout } from '../components/payments.js';
import { mountGarden } from '../garden/garden.js';

// Add a row here to add a workspace section; the nav and router follow.
const SECTIONS = [
  { id: 'overview', label: 'Overview' },
  { id: 'meeting', label: 'Meeting & notes' },
  { id: 'documents', label: 'Requirements' },
  { id: 'agreement', label: 'Agreement' },
  { id: 'vendors', label: 'Vendors & proposals' },
  { id: 'tasks', label: 'Tasks' },
  { id: 'schedule', label: 'Schedule & day-of' },
  { id: 'finance', label: 'Payments & closeout' },
];

const S = { w: null, state: null, section: 'overview', category: null, taskFilters: {} };
const root = document.getElementById('ag-view');
const subnav = document.querySelector('#ag-section-nav');

function renderSubnav() {
  subnav.hidden = false;
  subnav.querySelector('nav').innerHTML = String(html`${SECTIONS.map((s) =>
    html`<a href="#${s.id}" ${S.section === s.id ? 'aria-current=true' : ''}>${s.label}</a>`)}`);
}

// Planner next actions per stage. Buttons route to the relevant section.
const NEXT_ACTIONS = [
  [['Review the new enquiry', 'overview'], ['Assign a planner', 'overview'], ['Offer consultation slots', 'meeting']],
  [['Offer consultation slots', 'meeting'], ['Read what the couple shared', 'overview']],
  [['Prepare for the consultation', 'meeting'], ['Add the meeting link (later module)', 'meeting']],
  [['Draft the requirements document', 'documents'], ['Complete the planner checklist', 'documents']],
  [['Prepare the service agreement', 'agreement'], ['Send vendor requests', 'vendors']],
  [['Shortlist vendor proposals', 'vendors'], ['Send the shortlist to the couple', 'vendors']],
  [['Confirm vendor bookings', 'vendors'], ['Build the wedding schedule', 'schedule']],
  [['Chase open tasks', 'tasks'], ['Collect the pre-wedding advance', 'finance']],
  [['Sign off the day-of run sheet', 'schedule'], ['Confirm vendor arrival times', 'schedule']],
  [['Final payment after the event', 'finance'], ['Vendor closeout & profit review', 'finance']],
];

function header() {
  const w = S.w;
  const idx = stageIndexOf(S.state);
  const p = progressOf(S.state);
  const steps = milestoneStatuses(S.state);
  return html`
    <header class="ag-head ag-head-ws">
      <div class="ag-head-main">
        <a class="back" href="/agent/weddings">← All weddings</a>
        <h1 class="ag-title">${w.coupleLabel}</h1>
        <p class="ag-meta">${w.location} <span aria-hidden="true">·</span> ${w.approxDate ? fmtDate(w.approxDate) : 'Date not decided'} <span aria-hidden="true">·</span> ${w.guests ? `~${w.guests} guests` : 'Guests TBC'} <span aria-hidden="true">·</span> Planner: ${w.planner || 'Unassigned'}</p>
      </div>
      <div class="ag-stage">
        <p class="ag-stage-label"><span>Current stage</span><strong>${STAGES[idx].label}</strong><span class="muted">${Math.round(p * 100)}%</span></p>
        <ol class="ag-stage-track" aria-label="Milestones">
          ${steps.map((m) => html`<li class="is-${m.status}" title="${m.label}"><span class="sr-only">${m.label}: ${m.status}</span></li>`)}
        </ol>
      </div>
    </header>
    <nav class="ws-tabs" aria-label="Workspace sections">
      ${SECTIONS.map((s) => html`<a href="#${s.id}" ${S.section === s.id ? 'aria-current=true' : ''}>${s.label}</a>`)}
    </nav>`;
}

// ---------- sections ----------
function viewOverview() {
  const w = S.w;
  const today = new Date().toISOString().slice(0, 10);
  const openTasks = w.tasks.filter((t) => t.status !== 'Done').sort((a, b) => a.due.localeCompare(b.due)).slice(0, 4);
  const nextPay = w.payments.find((p) => p.status !== 'Paid');
  const actions = NEXT_ACTIONS[stageIndexOf(S.state)];
  return html`
    <section class="card next-actions" aria-labelledby="na-h">
      <div class="card-head"><h2 id="na-h" class="card-title">Your next actions</h2><span class="muted small">Suggested for this stage · preview</span></div>
      <ol class="na-list">
        ${actions.map(([label, sec], i) => html`<li><span class="na-n">${i + 1}</span><span class="na-label">${label}</span><a class="btn btn-small ${i ? 'btn-ghost' : ''}" href="#${sec}">Open</a></li>`)}
      </ol>
    </section>
    <div class="ws-grid">
      <div class="ws-col">
        <section class="card garden-card" aria-labelledby="gd-h">
          <div class="card-head"><h2 id="gd-h" class="card-title">The couple’s garden</h2><span class="muted small">What the couple sees at this stage</span></div>
          <div data-garden-slot></div>
        </section>
        <section class="card" aria-labelledby="ov-h">
          <div class="card-head"><h2 id="ov-h" class="card-title">Case overview</h2></div>
          ${renderCaseFacts(w)}
        </section>
        <section class="card" aria-labelledby="ms-h">
          <div class="card-head"><h2 id="ms-h" class="card-title">Milestones</h2></div>
          ${renderJourney(milestoneStatuses(S.state), { audience: 'agent', compact: true })}
        </section>
        <section class="card" aria-labelledby="up-h">
          <div class="card-head"><h2 id="up-h" class="card-title">Upcoming tasks</h2><a class="link small" href="#tasks">All tasks</a></div>
          ${openTasks.length ? html`<ul class="list">${openTasks.map((t) => html`
            <li class="list-row"><span>${t.title}<small class="muted"> · ${t.owner}</small></span>
            <span class="list-row-side"><span class="${t.due < today ? 'is-late' : 'muted'} small">${fmtDate(t.due)}</span>${pill(t.status)}</span></li>`)}</ul>`
          : emptyState({ title: 'No open tasks' })}
        </section>
      </div>
      <div class="ws-col">
        ${renderWorkspaceContainer(w)}
        <section class="card" aria-labelledby="cp-h">
          <div class="card-head"><h2 id="cp-h" class="card-title">Shared by the couple</h2></div>
          ${renderPeople(w.people)}
          <h3 class="sub-h">Preferences</h3>
          ${w.preferences.length ? html`<ul class="tags">${w.preferences.map((p) => html`<li>${p}</li>`)}</ul>` : html`<p class="muted small">None shared yet.</p>`}
          <h3 class="sub-h">Traditions, customs &amp; cultural details</h3>
          ${w.traditions.note ? html`<blockquote class="quote">${w.traditions.note}</blockquote>` : html`<p class="muted small">Nothing shared yet.</p>`}
          ${w.traditions.discussWithPlanner ? html`<p class="small">${pill('Requested', 'Would like to discuss with planner')}</p>` : ''}
        </section>
        <section class="card" aria-labelledby="np-h">
          <div class="card-head"><h2 id="np-h" class="card-title">Next payment</h2><a class="link small" href="#finance">Finance</a></div>
          ${nextPay ? html`<p class="big-num">${inr(nextPay.amount)}</p><p class="muted small">${nextPay.label} · due ${fmtDate(nextPay.due)} ${pill(nextPay.status)}</p>` : emptyState({ icon: 'coin', title: 'No payments scheduled' })}
        </section>
      </div>
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
    ${req ? html`<div class="row-end"><button class="btn" type="button" data-action="send-shortlist">Send shortlist to couple</button></div>` : ''}`;
}

const viewTasks = () => renderTasks(S.w.tasks, S.taskFilters);
const viewSchedule = () => renderAgentSchedule(S.w.schedule);
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
    w.agreement.history = [...(w.agreement.history || []), { status: next, at: new Date().toISOString().slice(0, 10) }];
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
  const key = document.body.dataset.mockKey;
  S.w = await loadWedding(key);
  if (!S.w) {
    initDevbar();
    mount(root, html`<div class="card">${emptyState({ title: 'No mock wedding with this preview key', body: 'Go back to the weddings list to open a sample case.' })}<div class="row-center"><a class="btn" href="/agent/weddings">All weddings</a></div></div>`);
    return;
  }
  document.title = `${S.w.coupleLabel} · Wedding workspace · The Royal Knot`;
  const urlStage = stageFromUrl();
  S.state = stageState(urlStage ?? S.w.stage);
  S.section = location.hash.slice(1) || 'overview';
  initDevbar({
    stage: stageIndexOf(S.state),
    onStage: (i) => { S.state = stageState(i); if (isDevMode()) writeStageToUrl(i); publishProgress(progressOf(S.state)); render(); },
  });
  render();
})();
