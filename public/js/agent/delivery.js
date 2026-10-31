// Agreement, payments and schedule: what the couple signs, pays and attends,
// plus the agency-only run sheet for the day.
import { html, fmtDate, fmtDateTime, fmtTime, pill, emptyState, visibility } from '../core/ui.js';
import { renderAgreementDoc, renderAcceptance } from '../components/agreement.js';
import { renderPaymentTimeline } from '../components/payments.js';
import { renderEvents, groupByDate } from '../components/schedule.js';
import { select, field, card } from './common.js';

// ---------- agreement ----------
const DEFAULT_TERMS = [
  '1. Fees: the planning fee is payable in the milestones shown in the payment timeline.',
  '2. Vendor contracts: vendors are contracted with the couple; the agency coordinates them.',
  '3. Changes: changes to scope are agreed in writing and may change the fee.',
  '4. Cancellation: payments made before cancellation are refundable as set out in the schedule your planner shares.',
].join('\n');

function scopeFromRequirements(c) {
  const d = c.requirements.find((x) => x.status === 'approved');
  if (!d) return '';
  const pick = d.sections.find((s) => /overview/i.test(s.title)) || d.sections[0];
  return `Full planning and coordination as set out in requirements version ${d.version}. ${pick ? pick.items.join('; ') : ''}`.trim();
}

function agreementForm(c, a = null) {
  return html`
    <form data-form="${a ? 'agreement-edit' : 'agreement-new'}" ${a ? `data-id=${a.id}` : ''} class="form-stack">
      ${field('Title', html`<input name="title" value="${a?.title || 'Wedding planning service agreement'}" required maxlength="120">`)}
      ${field('Scope of services', html`<textarea name="scopeSummary" rows="4" required>${a?.scopeSummary || scopeFromRequirements(c)}</textarea>`)}
      ${field('Terms', html`<textarea name="terms" rows="6" required>${a?.terms || DEFAULT_TERMS}</textarea>`)}
      ${field('Planning fee (₹)', html`<input name="feeAmount" inputmode="numeric" value="${a?.feeAmount ?? ''}">`)}
      ${a ? '' : html`<label class="check"><input type="checkbox" name="scopeConfirmed" required><span>I’ve confirmed this scope with the couple.</span></label>`}
      <div class="row-end"><button class="btn ${a ? 'btn-ghost' : ''}" type="submit">${a ? 'Save draft' : 'Create draft'}</button></div>
    </form>`;
}

function agreementView(ctx) {
  const c = ctx.c;
  const a = c.agreements[0];
  const gate = c.agreementGate;
  const gateNote = gate.ok ? '' : html`<div class="callout callout-warn">${gate.reason}</div>`;
  if (!a || a.status === 'superseded') {
    return card({ title: 'Service agreement', kind: 'shared', label: 'Shared once sent' }, html`${gateNote}
      ${c.requirements.some((d) => d.status === 'approved') ? agreementForm(c) : emptyState({ icon: 'doc', title: 'Approve the requirements first' })}`);
  }
  const status = { draft: 'Draft', sent: 'Sent · awaiting acceptance', accepted: 'Accepted' }[a.status];
  return html`
    ${card({ title: 'Service agreement', kind: a.status === 'draft' ? 'internal' : 'shared', label: a.status === 'draft' ? 'Draft · not shared' : 'Shared with couple', extra: pill(a.status, status) }, html`
      ${a.status === 'draft' ? gateNote : ''}
      ${renderAgreementDoc(a)}
      ${renderAcceptance(a)}
      ${a.status === 'sent' ? html`<p class="muted small">Sent ${fmtDateTime(a.sentAt)}. The couple accepts from their portal; their name, account and the time are recorded.</p>` : ''}
      ${a.status === 'draft' ? html`
        <details class="add-task"><summary>Edit draft</summary>${agreementForm(c, a)}</details>
        <div class="row-end"><button class="btn" type="button" data-action="agreement-send" data-id="${a.id}" ${gate.ok ? '' : 'disabled'}>Send to the couple</button></div>` : ''}
      <p class="muted small">Acceptance is recorded in the portal; it is not a certified e-signature. No e-signature provider is connected.</p>`)}
    ${a.status !== 'draft' ? html`<details class="card add-brief"><summary>Create a new version</summary><p class="muted small">The current version is replaced for the couple once the new one is created.</p>${agreementForm(c)}</details>` : ''}`;
}

// ---------- payments ----------
function paymentsView(ctx) {
  const c = ctx.c;
  const side = (p) => (p.state === 'paid'
    ? html`<span class="muted small">${[p.method, p.reference].filter(Boolean).join(' · ')}</span>`
    : html`<details class="mini-edit"><summary>Record or edit</summary>
        <form data-form="payment-paid" data-id="${p.id}" class="form-stack">
          <div class="form-grid">
            ${field('Paid on', html`<input type="date" name="paidOn">`)}
            ${field('Method', html`<input name="method" placeholder="e.g. Bank transfer">`)}
            ${field('Reference', html`<input name="reference">`)}
          </div>
          <button class="btn btn-small" type="submit">Record as paid</button>
        </form>
        <form data-form="payment-edit" data-id="${p.id}" class="form-stack">
          <div class="form-grid">
            ${field('Amount (₹)', html`<input name="amount" inputmode="numeric" value="${p.amount}">`)}
            ${field('Due date', html`<input type="date" name="dueDate" value="${p.dueDate}">`)}
          </div>
          ${field('Payment link', html`<input type="url" name="paymentLink" value="${p.paymentLink}" placeholder="https://…">`, 'Optional: a payment page you created with your payment provider. The couple sees a “Pay online” button.')}
          <div class="row-end"><button class="link-btn text-risk" type="button" data-action="payment-cancel" data-id="${p.id}">Remove milestone</button><button class="btn btn-small btn-ghost" type="submit">Save</button></div>
        </form></details>`);
  return card({ title: 'Payment timeline', kind: 'shared', label: 'Shared with couple' }, html`
    ${c.payments.length ? renderPaymentTimeline(c.payments, { side }) : emptyState({ icon: 'coin', title: 'No milestones yet', body: 'Add the milestones agreed in the service agreement.' })}
    <details class="add-task" ${c.payments.length ? '' : 'open'}><summary>Add a milestone</summary>
      <form data-form="payment-new" class="form-grid">
        ${field('Milestone', html`<input name="label" required placeholder="e.g. Planning advance">`)}
        ${field('Type', select('kind', { booking: 'Booking', advance: 'Advance', final: 'Final', extra: 'Extra', other: 'Other' }, 'advance'))}
        ${field('Amount (₹)', html`<input name="amount" inputmode="numeric" required>`)}
        ${field('Due date', html`<input type="date" name="dueDate" required>`)}
        <label class="field form-span"><span class="field-label">Payment link <span class="optional">optional</span></span><input type="url" name="paymentLink" placeholder="https://…"></label>
        <div class="row-end form-span"><button class="btn" type="submit">Add milestone</button></div>
      </form>
    </details>
    <p class="muted small">No payment gateway is connected. Record payments as they arrive; links open your provider’s own page.</p>`);
}

// ---------- schedule & run sheet ----------
export const scheduleUi = { view: 'events' };

function eventFields(e = {}) {
  return html`
    ${field('Event', html`<input name="name" value="${e.name || ''}" required maxlength="120">`)}
    ${field('Date', html`<input type="date" name="date" value="${e.date || ''}" required>`)}
    ${field('Starts', html`<input type="time" name="start" value="${e.start || ''}">`)}
    ${field('Ends', html`<input type="time" name="end" value="${e.end || ''}">`)}
    ${field('Venue', html`<input name="venue" value="${e.venue || ''}">`)}
    ${field('Owner', html`<input name="ownerLabel" value="${e.ownerLabel || ''}" placeholder="Planner on point">`)}
    <label class="field form-span"><span class="field-label">Note for the couple</span><input name="coupleNote" value="${e.coupleNote || ''}"></label>
    <label class="field form-span"><span class="field-label">Internal note</span><input name="internalNote" value="${e.internalNote || ''}"></label>
    <label class="check form-span"><input type="checkbox" name="shared" ${e.shared === false ? '' : 'checked'}><span>Show this event to the couple</span></label>`;
}

function eventsView(c) {
  const extra = (e) => html`
    <p class="small muted">${e.ownerLabel ? `Owner: ${e.ownerLabel} · ` : ''}${e.shared ? visibility('shared', 'Shared') : visibility('internal', 'Agency only')}</p>
    ${e.internalNote ? html`<p class="small internal-text">${e.internalNote}</p>` : ''}
    <details class="mini-edit"><summary>Edit</summary><form data-form="event-edit" data-id="${e.id}" class="form-grid">${eventFields(e)}
      <div class="row-end form-span"><button class="link-btn text-risk" type="button" data-action="event-delete" data-id="${e.id}">Delete</button><button class="btn btn-small" type="submit">Save</button></div></form></details>`;
  return html`
    ${c.events.length ? renderEvents(c.events, { extra }) : emptyState({ icon: 'calendar', title: 'No events yet' })}
    <details class="add-task" ${c.events.length ? '' : 'open'}><summary>Add an event</summary>
      <form data-form="event-new" class="form-grid">${eventFields()}<div class="row-end form-span"><button class="btn" type="submit">Add event</button></div></form>
    </details>`;
}

const RUN = { pending: 'Pending', done: 'Done', delayed: 'Delayed' };
const NEXT = { pending: 'done', done: 'delayed', delayed: 'pending' };

function runSheet(c) {
  const events = Object.fromEntries(c.events.map((e) => [String(e.id), `${e.name} · ${fmtDate(e.date, { day: 'numeric', month: 'short' })}`]));
  const rows = [...c.runItems, ...c.events.map((e) => ({ eventStart: true, date: e.date, time: e.start || '00:00', label: `${e.name} begins`, ownerLabel: e.ownerLabel, venue: e.venue }))]
    .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
  return html`
    ${rows.length ? html`<div class="ag-sheet"><table class="ag-table runsheet">
      <thead><tr><th scope="col">Time</th><th scope="col">What happens</th><th scope="col">Owner</th><th scope="col">Status</th></tr></thead>
      <tbody>${groupByDate(rows).map(([date, list]) => html`
        <tr class="rs-day"><td colspan="4">${fmtDate(date, { weekday: 'long', day: 'numeric', month: 'long' })}</td></tr>
        ${list.map((r) => html`<tr>
          <td data-label="Time" class="num">${fmtTime(r.time)}</td>
          <td data-label="What" class="wide">${r.eventStart ? html`<b>${r.label}</b><span class="cell-sub">${r.venue}</span>` : r.label}</td>
          <td data-label="Owner">${r.ownerLabel || '—'}</td>
          <td data-label="Status">${r.eventStart ? html`<span class="muted small">Event</span>` : html`<button class="pill-btn" type="button" data-action="run-status" data-id="${r.id}" data-status="${NEXT[r.status]}">${pill(r.status, RUN[r.status])}<span class="sr-only">, change status</span></button> <button class="link-btn" type="button" data-action="run-delete" data-id="${r.id}" aria-label="Remove ${r.label}">×</button>`}</td>
        </tr>`)}`)}</tbody></table></div>` : emptyState({ icon: 'calendar', title: 'No run sheet yet', body: 'Add arrivals and cues for the day.' })}
    <details class="add-task"><summary>Add a run sheet line</summary>
      <form data-form="run-new" class="form-grid">
        ${field('Date', html`<input type="date" name="date" required>`)}
        ${field('Time', html`<input type="time" name="time" required>`)}
        <label class="field form-span"><span class="field-label">What happens</span><input name="label" required placeholder="e.g. Décor team arrives"></label>
        ${field('Owner', html`<input name="ownerLabel">`)}
        ${field('For event', select('eventId', { '': 'None', ...events }, ''))}
        <div class="row-end form-span"><button class="btn" type="submit">Add line</button></div>
      </form>
    </details>`;
}

function scheduleView(ctx) {
  const c = ctx.c;
  const final = Boolean(c.wedding.scheduleFinalAt);
  return html`
    <div class="ag-filters">
      <div class="seg-toggle" role="group" aria-label="Schedule view">
        <button type="button" data-sched="events" aria-pressed="${scheduleUi.view === 'events'}">Events</button>
        <button type="button" data-sched="runsheet" aria-pressed="${scheduleUi.view === 'runsheet'}">Day-of run sheet</button>
      </div>
      <span class="row-gap">${final ? html`${pill('final', 'Final schedule shared')} <button class="link-btn" type="button" data-action="schedule-final" data-final="false">Reopen</button>` : html`<button class="btn btn-ghost btn-small" type="button" data-action="schedule-final" data-final="true">Share as final with the couple</button>`}</span>
    </div>
    ${scheduleUi.view === 'runsheet'
      ? card({ title: 'Day-of run sheet', kind: 'internal', label: 'Agency only' }, runSheet(c))
      : card({ title: 'Events', kind: 'shared', label: 'Shared events visible to couple' }, eventsView(c))}
    <div class="row-end">${c.wedding.completedAt
      ? html`<span class="muted small">Wedding marked complete ${fmtDate(c.wedding.completedAt.slice(0, 10))}</span> <button class="link-btn" type="button" data-action="complete" data-complete="false">Undo</button>`
      : html`<button class="btn btn-ghost btn-small" type="button" data-action="complete" data-complete="true">Mark the wedding complete</button>`}</div>`;
}

export const agreement = {
  id: 'agreement', label: 'Agreement', view: agreementView,
  actions: { 'agreement-send': (t, ctx) => ctx.call('POST', `/agreements/${t.dataset.id}/send`) },
  forms: {
    'agreement-new': (v, ctx) => ctx.call('POST', '/agreements', v),
    'agreement-edit': (v, ctx, form) => ctx.call('PUT', `/agreements/${form.dataset.id}`, v),
  },
  success: { 'agreement-new': 'Draft created.', 'agreement-edit': 'Draft saved.' },
};

export const payments = {
  id: 'payments', label: 'Payments', view: paymentsView,
  actions: { 'payment-cancel': (t, ctx) => (confirm('Remove this milestone?') ? ctx.call('PATCH', `/payments/${t.dataset.id}`, { status: 'cancelled' }) : null) },
  forms: {
    'payment-new': (v, ctx) => ctx.call('POST', '/payments', v),
    'payment-paid': (v, ctx, form) => ctx.call('PATCH', `/payments/${form.dataset.id}`, { ...v, status: 'paid' }),
    'payment-edit': (v, ctx, form) => ctx.call('PATCH', `/payments/${form.dataset.id}`, v),
  },
  success: { 'payment-new': 'Milestone added.', 'payment-paid': 'Payment recorded.', 'payment-edit': 'Saved.' },
};

export const schedule = {
  id: 'schedule', label: 'Schedule & run sheet', view: scheduleView,
  actions: {
    'schedule-final': (t, ctx) => ctx.call('POST', '/schedule-final', { final: t.dataset.final === 'true' }),
    complete: (t, ctx) => ctx.call('POST', '/complete', { complete: t.dataset.complete === 'true' }),
    'event-delete': (t, ctx) => (confirm('Delete this event?') ? ctx.call('DELETE', `/events/${t.dataset.id}`) : null),
    'run-status': (t, ctx) => ctx.call('PATCH', `/run-items/${t.dataset.id}`, { status: t.dataset.status }),
    'run-delete': (t, ctx) => ctx.call('DELETE', `/run-items/${t.dataset.id}`),
  },
  forms: {
    'event-new': (v, ctx) => ctx.call('POST', '/events', v),
    'event-edit': (v, ctx, form) => ctx.call('PATCH', `/events/${form.dataset.id}`, v),
    'run-new': (v, ctx) => ctx.call('POST', '/run-items', v),
  },
  success: { 'event-new': 'Event added.', 'event-edit': 'Saved.', 'run-new': 'Added to the run sheet.' },
};

