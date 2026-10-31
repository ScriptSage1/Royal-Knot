// Vendor portal: the briefs this vendor was invited to, and a proposal form
// for each. The server limits the list to this vendor's invitations and
// shares only the city, date, guest numbers and brief, never the couple.
import { html, mount, on, toast, fmtDate, inr, pill, emptyState, whenText } from '../core/ui.js';
import { api, formValues } from '../core/api.js';
import { initAgentShell } from '../core/agent-shell.js';

const root = document.getElementById('ag-view');
const STATUS = { received: 'Received · under review', shortlisted: 'Shortlisted by the planner', not_progressed: 'Not taken forward this time' };

function proposalForm(r) {
  const p = r.proposal || {};
  const lines = (a) => (a || []).join('\n');
  return html`
    <form data-form="proposal" data-id="${r.id}" class="form-grid">
      <label class="field"><span class="field-label">Total amount (₹)</span><input name="amount" inputmode="numeric" value="${p.amount ?? ''}" required></label>
      <label class="field"><span class="field-label">Valid until</span><input type="date" name="validUntil" value="${p.validUntil || ''}"></label>
      <label class="field form-span"><span class="field-label">Scope</span><input name="scope" value="${p.scope || ''}" required placeholder="What you’ll provide, for which events"></label>
      <label class="field"><span class="field-label">Included <span class="optional">one per line</span></span><textarea name="inclusions" rows="3">${lines(p.inclusions)}</textarea></label>
      <label class="field"><span class="field-label">Not included <span class="optional">one per line</span></span><textarea name="exclusions" rows="3">${lines(p.exclusions)}</textarea></label>
      <label class="field"><span class="field-label">Extra charges <span class="optional">one per line</span></span><textarea name="extras" rows="2">${lines(p.extras)}</textarea></label>
      <label class="field"><span class="field-label">Message to the planner</span><textarea name="vendorMessage" rows="2">${p.vendorMessage || ''}</textarea></label>
      <div class="row-end form-span">
        ${r.proposal ? '' : html`<button class="btn btn-ghost" type="button" data-action="decline" data-id="${r.id}">We can’t quote for this</button>`}
        <button class="btn" type="submit">${r.proposal ? 'Update proposal' : 'Send proposal'}</button>
      </div>
    </form>`;
}

function requestCard(r) {
  const w = r.wedding;
  const p = r.proposal;
  return html`
    <section class="card request-card">
      <div class="card-head">
        <h2 class="card-title">${r.category} · ${w.location || 'Location TBC'}</h2>
        ${p ? pill(p.status === 'not_progressed' ? 'declined' : p.status === 'shortlisted' ? 'shortlisted' : 'received', STATUS[p.status]) : r.inviteStatus === 'declined' ? pill('declined', 'You declined') : pill(r.status, r.status === 'open' ? 'Awaiting your proposal' : 'Closed')}
      </div>
      <dl class="kv">
        <div><dt>Reference</dt><dd><code>${w.reference}</code></dd></div>
        <div><dt>When</dt><dd>${whenText(w)}</dd></div>
        <div><dt>Guests</dt><dd>${w.guestEstimate ? `About ${w.guestEstimate}` : 'TBC'}${w.eventsCount ? ` · ${w.eventsCount} events or days` : ''}</dd></div>
        ${r.budgetNote ? html`<div><dt>Budget guide</dt><dd>${r.budgetNote}</dd></div>` : ''}
        ${r.dueDate ? html`<div><dt>Reply by</dt><dd>${fmtDate(r.dueDate)}</dd></div>` : ''}
      </dl>
      <h3 class="sub-h">The brief</h3>
      <p class="brief">${r.brief}</p>
      ${p ? html`<p class="muted small">You sent ${inr(p.amount)} on ${fmtDate(p.submittedAt.slice(0, 10))}.${p.editable ? ' You can update it until the planner reviews it.' : ' The planner is reviewing it; contact them to change anything.'}</p>` : ''}
      ${r.status === 'open' && r.inviteStatus !== 'declined' && (!p || p.editable) ? html`<details class="add-task" ${p ? '' : 'open'}><summary>${p ? 'Update your proposal' : 'Your proposal'}</summary>${proposalForm(r)}</details>` : ''}
    </section>`;
}

function render(data) {
  mount(root, html`
    <header class="ag-pagehead">
      <div>
        <p class="ag-eyebrow">${data.vendor.category}</p>
        <h1 class="ag-title">${data.vendor.name}</h1>
        <p class="ag-sub">Briefs from The Royal Knot planners. You see the event details needed to quote; couples’ names and contacts stay with the planner.</p>
      </div>
    </header>
    ${data.requests.length ? data.requests.map(requestCard) : html`<section class="card">${emptyState({ title: 'No requests yet', body: 'When a planner invites you to quote, the brief appears here.' })}</section>`}`);
}

async function act(fn, button, success) {
  if (button) button.disabled = true;
  try { render(await fn()); toast(success); } catch (err) { toast(err.message, { tone: 'error' }); if (button) button.disabled = false; }
}

on(root, 'submit', 'form[data-form="proposal"]', (e, form) => {
  e.preventDefault();
  if (!form.reportValidity()) return;
  act(() => api.post(`/api/vendor/requests/${form.dataset.id}/proposal`, formValues(form)), e.submitter, 'Proposal sent to the planner.');
});
on(root, 'click', '[data-action="decline"]', (e, t) => {
  if (confirm('Let the planner know you can’t quote for this request?')) act(() => api.post(`/api/vendor/requests/${t.dataset.id}/decline`), t, 'The planner has been told.');
});

(async function boot() {
  initAgentShell();
  try { render(await api.get('/api/vendor/requests')); } catch (err) { mount(root, html`<section class="card"><p>${err.message}</p></section>`); }
})();
