// Planner's wedding list: their own weddings, then new enquiries any planner
// can take on. Each row shows only what helps decide where to look next.
import { html, mount, on, emptyState, whenText, toast } from '../core/ui.js';
import { api } from '../core/api.js';
import { initAgentShell } from '../core/agent-shell.js';

const root = document.getElementById('ag-view');

const row = (w, { enquiry = false } = {}) => html`
  <section class="card session-card ${w.alerts.some((a) => a.level === 'high') ? 'is-urgent' : ''}" aria-labelledby="case-${w.caseCode}">
    <div class="session-card-top">
      <div class="session-card-identity">
        <p class="ag-eyebrow">${w.caseCode}${w.isDemo ? ' · demo record' : ''}</p>
        <h2 id="case-${w.caseCode}" class="card-title"><a class="case-name" href="/agent/weddings/${w.caseCode}">${w.coupleLabel}</a></h2>
        <p class="session-card-meta">${[whenText(w), w.location, w.guestEstimate ? `${w.guestEstimate} guests` : ''].filter(Boolean).join(' · ')}</p>
      </div>
      <span class="pill pill-info">${w.stage.label}</span>
    </div>
    <div class="session-card-bottom">
      <div class="session-card-context">
        <strong>${enquiry ? 'New enquiry · not yet assigned' : `${w.next.waiting ? 'Waiting · ' : 'Next · '}${w.next.label}`}</strong>
        ${w.alerts.length ? html`<span class="case-alerts">${w.alerts.map((a) => html`<span class="flag flag-${a.level}">${a.label}</span>`)}</span>` : ''}
      </div>
      ${enquiry
        ? html`<button class="btn btn-small" type="button" data-claim="${w.caseCode}">Take on</button>`
        : html`<a class="btn btn-small" href="/agent/weddings/${w.caseCode}${w.next.waiting ? '' : `#${w.next.section}`}">Open</a>`}
    </div>
  </section>`;

function render({ mine, enquiries }) {
  mount(root, html`
    <header class="ag-pagehead">
      <div>
        <p class="ag-eyebrow">Planner workspace</p>
        <h1 class="ag-title">Your weddings</h1>
        <p class="ag-sub">${mine.length} assigned to you${enquiries.length ? html` · <b>${enquiries.length} new ${enquiries.length === 1 ? 'enquiry' : 'enquiries'}</b>` : ''}</p>
      </div>
    </header>
    ${enquiries.length ? html`<h2 class="ag-section-title">New enquiries</h2><div class="case-list session-list">${enquiries.map((w) => row(w, { enquiry: true }))}</div>` : ''}
    <h2 class="ag-section-title">Assigned to you</h2>
    ${mine.length ? html`<div class="case-list session-list">${mine.map((w) => row(w))}</div>` : html`<section class="card">${emptyState({ title: 'No weddings assigned yet', body: 'Take on a new enquiry to get started.' })}</section>`}`);
}

on(root, 'click', '[data-claim]', async (e, t) => {
  t.disabled = true;
  try {
    await api.post(`/api/planner/weddings/${encodeURIComponent(t.dataset.claim)}/claim`);
    location.href = `/agent/weddings/${encodeURIComponent(t.dataset.claim)}#consultation`;
  } catch (err) {
    toast(err.message, { tone: 'error' });
    t.disabled = false;
  }
});

(async function boot() {
  initAgentShell();
  try { render(await api.get('/api/planner/weddings')); } catch (err) { mount(root, html`<section class="card"><p>${err.message}</p></section>`); }
})();
