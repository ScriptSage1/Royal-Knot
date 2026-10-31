// Workspace container: the case overview that will eventually group every
// section under one persistent wedding record.
import { html, fmtDate, futureTag } from '../core/ui.js';

export function renderWorkspaceContainer(w) {
  const counts = [
    ['Events', w.schedule.reduce((n, d) => n + d.events.length, 0)],
    ['Vendor requests', w.vendorRequests.length],
    ['Proposals', w.vendorRequests.reduce((n, r) => n + r.proposals.length, 0)],
    ['Tasks', w.tasks.length],
    ['Payment milestones', w.payments.length],
    ['Agent notes', w.agentNotes.length],
  ];
  return html`
    <section class="card ws-container" aria-labelledby="ws-container-h">
      <div class="card-head">
        <h2 id="ws-container-h" class="card-title">Wedding workspace record</h2>
        ${futureTag('Workspace module')}
      </div>
      <div class="ws-id">
        <span class="ws-id-label">Workspace ID</span>
        <span class="ws-id-value">Workspace ID will be assigned in a later module.</span>
      </div>
      <p class="muted small">Everything below is grouped here for preview. In a later module it becomes one persistent wedding record.</p>
      <ul class="ws-counts">
        ${counts.map(([k, v]) => html`<li><strong>${v}</strong><span>${k}</span></li>`)}
      </ul>
    </section>`;
}

export function renderCaseFacts(w) {
  const facts = [
    ['Date', w.approxDate ? fmtDate(w.approxDate) : 'Not decided', w.dateNote],
    ['Location', w.location || '—'],
    ['Guests', w.guests ? `~${w.guests}` : '—'],
    ['Budget range', w.budgetRange || '—'],
    ['Planner', w.planner || 'Unassigned'],
  ];
  return html`
    <dl class="facts">
      ${facts.map(([k, v, note]) => html`<div><dt>${k}</dt><dd>${v}${note ? html`<small>${note}</small>` : ''}</dd></div>`)}
    </dl>`;
}

export function renderPeople(people) {
  if (!people.length) return html`<p class="muted small">No contacts shared yet. Names are optional.</p>`;
  return html`<ul class="people">${people.map((p) => html`<li><span class="avatar" aria-hidden="true">${p.name.slice(0, 1)}</span><span><strong>${p.name}</strong><small>${p.role}</small></span></li>`)}</ul>`;
}

