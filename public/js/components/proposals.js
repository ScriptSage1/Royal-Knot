// Side-by-side proposal comparison for any number of vendors. The couple's
// version only ever receives shortlisted, shared options from the server;
// the planner's version adds status, the vendor's message and the internal
// comment. `footer(option)` renders each column's actions.
import { html, inr, pill, plural } from '../core/ui.js';

const DECISION = { chosen: 'Your choice', deferred: 'Maybe later', declined: 'Not for us' };
const AGENCY = { received: 'New', shortlisted: 'Shortlisted', declined: 'Declined' };

export function renderComparison({ options, audience, footer = null }) {
  if (!options.length) return '';
  const list = (items, cls) => (items.length ? html`<ul class="mini-list ${cls}">${items.map((x) => html`<li>${x}</li>`)}</ul>` : html`<span class="muted">—</span>`);
  const rows = [
    audience === 'agent' ? ['Status', (o) => html`${pill(o.agencyStatus, AGENCY[o.agencyStatus])}${o.sharedAt ? html` ${pill('shared', 'Shared')}` : ''}${o.coupleDecision ? html` ${pill(o.coupleDecision, `Couple: ${DECISION[o.coupleDecision]}`)}` : ''}`] : null,
    ['Total quote', (o) => html`<strong class="amount">${inr(o.amount)}</strong>`],
    ['Scope', (o) => o.scope || '—'],
    ['Included', (o) => list(o.inclusions, 'ok')],
    ['Not included', (o) => list(o.exclusions, 'no')],
    ['Extra charges', (o) => list(o.extras, '')],
    audience === 'agent' ? ['Received via', (o) => (o.source === 'vendor_portal' ? 'Vendor portal' : 'Entered by planner')] : null,
    audience === 'agent' ? ['Vendor’s message', (o) => o.vendorMessage || html`<span class="muted">—</span>`] : null,
    audience === 'agent' ? ['Internal comment', (o) => html`<span class="internal-text">${o.internalComment || '—'}</span>`] : null,
    ['Planner’s note', (o) => (audience === 'agent' ? o.noteForCouple : o.plannerNote) || html`<span class="muted">—</span>`],
  ].filter(Boolean);

  const chosen = (o) => (audience === 'agent' ? o.coupleDecision === 'chosen' : o.decision === 'chosen');
  return html`
    <div class="compare-wrap" tabindex="0" role="region" aria-label="Comparison of ${plural(options.length, 'option')}; scrolls sideways on small screens">
      <table class="compare" style="--cols:${options.length}">
        <thead><tr><td></td>${options.map((o) => html`
          <th scope="col" class="${chosen(o) ? 'is-selected' : ''}">
            <span class="compare-vendor">${o.vendorName}</span>
            ${audience === 'couple' && o.decision ? pill(o.decision, DECISION[o.decision]) : ''}
          </th>`)}</tr></thead>
        <tbody>${rows.map(([label, cell]) => html`<tr><th scope="row">${label}</th>${options.map((o) => html`<td>${cell(o)}</td>`)}</tr>`)}</tbody>
        ${footer ? html`<tfoot><tr><td></td>${options.map((o) => html`<td>${footer(o)}</td>`)}</tr></tfoot>` : ''}
      </table>
    </div>`;
}
