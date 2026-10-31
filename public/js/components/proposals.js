// Vendor requests + side-by-side proposal comparison for a variable number of
// vendors. The same component serves both audiences; the couple version omits
// internal notes and only receives shortlisted options from couple-mock.js.
// Actions: data-action="category" data-category | "shortlist" data-index |
//          "decline" data-index | "choose" data-index | "request-quotes"
import { html, inr, fmtDate, pill, emptyState, futureTag, plural, visibility } from '../core/ui.js';

export function renderVendorRequests(requests, active) {
  if (!requests.length) {
    return html`<section class="card"><div class="card-head"><h2 class="card-title">Vendor requests</h2>${futureTag('Vendor portal')}</div>
      ${emptyState({ icon: 'people', title: 'No vendor requests yet', body: 'Request quotes after plan approval.' })}
      <div class="row-end"><button class="btn btn-ghost" type="button" data-action="request-quotes">Request quotes</button></div></section>`;
  }
  return html`
    <section class="card" aria-labelledby="vr-h">
      <div class="card-head"><h2 id="vr-h" class="card-title">Vendor requests</h2>${visibility('internal')}${futureTag('Vendor portal')}</div>
      <div class="table-wrap"><table class="table">
        <thead><tr><th scope="col">Category</th><th scope="col">Brief</th><th scope="col">Responses</th><th scope="col">Quotes due</th><th scope="col"><span class="sr-only">Compare</span></th></tr></thead>
        <tbody>${requests.map((r) => html`
          <tr class="${r.category === active ? 'is-active' : ''}">
            <th scope="row">${r.category}</th>
            <td class="muted">${r.brief}</td>
            <td>${r.responses}/${r.sentTo}</td>
            <td>${fmtDate(r.dueBy)}</td>
            <td><button class="btn btn-small btn-ghost" type="button" data-action="category" data-category="${r.category}" aria-pressed="${r.category === active}">Compare</button></td>
          </tr>`)}</tbody>
      </table></div>
      <div class="row-end"><button class="btn btn-ghost" type="button" data-action="request-quotes">Request quotes</button></div>
    </section>`;
}

// options: [{vendor, status?, total, perPlate, scope, inclusions, exclusions, extras, lines?, internalNote?, plannerNote?}]
export function renderComparison({ category, options, audience = 'agent', selected = null, categories = [] }) {
  const tabs = categories.length > 1 ? html`
    <div class="tabs" role="group" aria-label="Vendor category">
      ${categories.map((c) => html`<button type="button" class="tab" data-action="category" data-category="${c}" aria-pressed="${c === category}">${c}</button>`)}
    </div>` : '';

  if (!options.length) {
    return html`<section class="card">${tabs}${emptyState({ icon: 'people', title: `No ${category ? category.toLowerCase() + ' ' : ''}proposals to compare yet` })}</section>`;
  }

  const showPerPlate = options.some((o) => o.perPlate);
  const rows = [
    audience === 'agent' ? ['Status', (o) => pill(o.status)] : null,
    ['Total quote', (o) => html`<strong class="amount">${inr(o.total)}</strong>`],
    showPerPlate ? ['Price per plate', (o) => (o.perPlate ? html`${inr(o.perPlate)}${o.plates ? html`<small class="muted"> × ${o.plates}</small>` : ''}` : html`<span class="muted">n/a</span>`)] : null,
    ['Scope', (o) => o.scope],
    ['Included', (o) => html`<ul class="mini-list ok">${o.inclusions.map((x) => html`<li>${x}</li>`)}</ul>`],
    ['Not included', (o) => html`<ul class="mini-list no">${o.exclusions.map((x) => html`<li>${x}</li>`)}</ul>`],
    ['Extra charges', (o) => (o.extras.length ? html`<ul class="mini-list">${o.extras.map((x) => html`<li>${x.label} <span class="muted">+${inr(x.amount)}</span></li>`)}</ul>` : html`<span class="muted">None listed</span>`)],
    ['With extras', (o) => inr(o.total + o.extras.reduce((n, x) => n + x.amount, 0))],
    audience === 'agent' ? ['Quote lines', (o) => (o.lines?.length ? html`<ul class="mini-list">${o.lines.map((l) => html`<li>${l.label} <span class="muted">${l.qty} ${l.unit} · ${inr(l.amount)}</span></li>`)}</ul>` : '—')] : null,
    audience === 'agent' ? ['Internal comment', (o) => html`<span class="internal-text">${o.internalNote || '—'}</span>`] : null,
    audience === 'couple' ? ['Planner’s note', (o) => o.plannerNote || '—'] : null,
  ].filter(Boolean);

  return html`
    <section class="card" aria-labelledby="cmp-h">
      <div class="card-head">
        <h2 id="cmp-h" class="card-title">${audience === 'agent' ? 'Proposals' : 'Your options'} · ${category}</h2>
        ${audience === 'agent' ? visibility('internal', 'Internal only') : ''}<span class="muted small">${plural(options.length, 'option')}</span>
      </div>
      ${tabs}
      <div class="compare-wrap" tabindex="0" aria-label="Comparison table, scrolls sideways on small screens">
        <table class="compare" style="--cols:${options.length}">
          <thead><tr><td></td>${options.map((o) => html`
            <th scope="col" class="${selected === o.vendor || o.status === 'Selected' ? 'is-selected' : ''}">
              <span class="compare-vendor">${o.vendor}</span>
              ${selected === o.vendor ? html`<span class="pill pill-ok">Your choice</span>` : ''}
            </th>`)}</tr></thead>
          <tbody>${rows.map(([label, cell]) => html`<tr><th scope="row">${label}</th>${options.map((o) => html`<td>${cell(o)}</td>`)}</tr>`)}</tbody>
          <tfoot><tr><td></td>${options.map((o, i) => html`<td>
            ${audience === 'agent'
              ? (o.status === 'Selected' ? html`<span class="muted small">Selected by couple</span>` : o.status === 'Declined' ? html`<span class="muted small">Declined</span>` : html`
                <div class="btn-stack">
                  <button class="btn btn-small" type="button" data-action="shortlist" data-index="${i}" ${o.status === 'Shortlisted' ? 'disabled' : ''}>${o.status === 'Shortlisted' ? 'Shortlisted' : 'Shortlist'}</button>
                  <button class="btn btn-small btn-ghost" type="button" data-action="decline" data-index="${i}">Decline</button>
                </div>`)
              : html`<button class="btn btn-small ${selected === o.vendor ? '' : 'btn-ghost'}" type="button" data-action="choose" data-index="${i}" aria-pressed="${selected === o.vendor}">${selected === o.vendor ? 'Chosen' : 'Choose this option'}</button>`}
          </td>`)}</tr></tfoot>
        </table>
      </div>
    </section>`;
}
