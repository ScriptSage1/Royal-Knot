// Overview: only the essentials. The next action, up to three alerts, and
// what the couple has shared. Everything else lives in its own section.
import { html, emptyState, whenText, fmtDateTime } from '../core/ui.js';
import { BUDGET, SOURCING, FORMAT, card } from './common.js';

function nextCard(c) {
  if (!c.wedding.planner) {
    const a = c.appointments.find((x) => x.status === 'requested');
    return html`<section class="card next-card">
      <p class="ag-eyebrow">New enquiry</p>
      <h2 class="next-title">Take on this wedding</h2>
      ${a ? html`<p>Consultation requested for <b>${fmtDateTime(a.preferredAt)}</b> · ${FORMAT[a.format]}${a.otherTimes ? html`<br><span class="muted small">Other times: ${a.otherTimes}</span>` : ''}</p>` : ''}
      <p class="muted">You’ll become their planner, and every section of the case file opens.</p>
      <div class="row-end"><button class="btn" type="button" data-action="claim">Take on this wedding</button></div>
    </section>`;
  }
  const n = c.next;
  return html`<section class="card next-card">
    <p class="ag-eyebrow">${n.waiting ? 'Waiting on' : 'Next action'}</p>
    <h2 class="next-title">${n.label}</h2>
    ${n.waiting ? '' : html`<div class="row-end"><a class="btn" href="#${n.section}">Open ${n.section === 'overview' ? '' : n.section}</a></div>`}
  </section>`;
}

function alertsCard(c) {
  return card({ title: 'Needs attention' }, c.alerts.length
    ? html`<ul class="attn">${c.alerts.map((a) => html`<li class="attn-${a.level}"><span class="attn-mark" aria-hidden="true"></span><span class="attn-title">${a.label}</span><a class="btn btn-small btn-ghost" href="#${a.section}">Open<span class="sr-only"> ${a.label}</span></a></li>`)}</ul>`
    : emptyState({ title: 'All caught up' }));
}

function coupleCard(c) {
  const w = c.wedding;
  const rows = [
    ['When', whenText(w)], ['Where', w.location || 'Still deciding'],
    ['Guests', w.guestEstimate ? `About ${w.guestEstimate}${w.eventsCount ? ` · ${w.eventsCount} events or days` : ''}` : 'Not shared'],
    ['Budget', (BUDGET[w.budgetMode] || BUDGET.unanswered)(w)], ['Vendors', SOURCING[w.vendorSourcing] || 'Not decided'],
  ];
  const words = [
    ['What matters', [w.whatMatters, w.priorities].filter(Boolean).join('\n\n')],
    ['Traditions & customs', [w.traditionsNote, w.traditionsDeciding ? 'Still deciding.' : '', w.traditionsDiscuss ? 'Would like to talk it through.' : ''].filter(Boolean).join(' ')],
    ['Languages', w.languages], ['Family', w.familyNote],
  ].filter(([, v]) => v);
  return card({ title: 'From the couple', kind: 'shared', label: 'Shared by the couple' }, html`
    ${c.wedding.detailsSharedAt ? '' : html`<p class="muted small">The couple hasn’t finished sharing their story yet.</p>`}
    <dl class="kv">${rows.map(([k, v]) => html`<div><dt>${k}</dt><dd>${v}</dd></div>`)}</dl>
    ${words.map(([k, v]) => html`<h3 class="sub-h">${k}</h3><p class="pre quote-plain">${v}</p>`)}
    <p class="muted small">Accounts: ${c.members.map((m) => m.name).join(', ')} · Partner invite code <code>${w.inviteCode}</code></p>`);
}

function handover(ctx) {
  if (!ctx.c.wedding.planner || ctx.planners.length < 2) return '';
  const others = ctx.planners.filter((p) => p.id !== ctx.c.wedding.planner.id);
  return html`<details class="card add-brief"><summary>Hand over to another planner</summary>
    <form data-form="handover" class="form-row">
      <label class="field field-inline"><span class="field-label">Planner</span><select name="plannerId">${others.map((p) => html`<option value="${p.id}">${p.name}</option>`)}</select></label>
      <button class="btn btn-ghost btn-small" type="submit">Hand over</button>
    </form><p class="muted small">You will lose access to this wedding after handing it over.</p></details>`;
}

export default {
  id: 'overview',
  label: 'Overview',
  view: (ctx) => html`<div class="ws-layout"><div class="ws-stack">${nextCard(ctx.c)}${alertsCard(ctx.c)}${handover(ctx)}</div><div class="ws-stack">${coupleCard(ctx.c)}</div></div>`,
  actions: { claim: (t, ctx) => ctx.call('POST', '/claim') },
  forms: {
    handover: async (v, ctx) => { await ctx.call('POST', '/handover', v); location.href = '/agent/weddings'; return null; },
  },
  success: {},
};
