// Payment timeline (any number of milestones), vendor costs, and closeout.
// Actions: data-action="pay" data-index (couple, not connected) | "remind" data-index (agent, mock)
import { html, inr, fmtDate, pill, emptyState, futureTag, visibility } from '../core/ui.js';

const KIND_LABEL = { booking: 'Booking', advance: 'Advance', final: 'Final', extra: 'Extra' };

export function renderPaymentTimeline(milestones, { audience = 'couple' } = {}) {
  if (!milestones.length) {
    return html`<section class="card"><div class="card-head"><h2 class="card-title">Payment timeline</h2>${futureTag('Payments')}</div>
      ${emptyState({ icon: 'coin', title: 'No payment milestones yet', body: audience === 'couple' ? 'Your payment schedule appears here once your agreement is shared.' : 'Milestones are added from the service agreement.' })}</section>`;
  }
  const total = milestones.reduce((n, m) => n + m.amount, 0);
  const paid = milestones.filter((m) => m.status === 'Paid').reduce((n, m) => n + m.amount, 0);
  const due = milestones.filter((m) => m.status === 'Due' || m.status === 'Overdue').reduce((n, m) => n + m.amount, 0);

  return html`
    <section class="card" aria-labelledby="pay-h">
      <div class="card-head"><h2 id="pay-h" class="card-title">Payment timeline</h2>${audience === 'agent' ? visibility('shared') : ''}${futureTag('Payments')}</div>
      <ul class="stat-row">
        <li><span>Total</span><strong>${inr(total)}</strong></li>
        <li><span>Paid</span><strong>${inr(paid)}</strong></li>
        <li><span>Due now</span><strong>${inr(due)}</strong></li>
        <li><span>Remaining</span><strong>${inr(total - paid)}</strong></li>
      </ul>
      <ol class="timeline">
        ${milestones.map((m, i) => html`
          <li class="timeline-item tone-${m.status ? m.status.toLowerCase() : 'upcoming'}">
            <span class="timeline-dot" aria-hidden="true"></span>
            <div class="timeline-main">
              <p class="timeline-title">${m.label} <span class="kind">${KIND_LABEL[m.kind] || m.kind}</span></p>
              <p class="muted small">${m.status === 'Paid' && m.paidOn ? `Paid ${fmtDate(m.paidOn)}` : `Due ${fmtDate(m.due)}`}</p>
            </div>
            <div class="timeline-side">
              <strong class="amount">${inr(m.amount)}</strong>
              ${pill(m.status || 'Upcoming')}
              ${audience === 'couple' && (m.status === 'Due' || m.status === 'Overdue') ? html`<button class="btn btn-small" type="button" data-action="pay" data-index="${i}">Pay</button>` : ''}
              ${audience === 'agent' && (m.status === 'Due' || m.status === 'Overdue') ? html`<button class="btn btn-small btn-ghost" type="button" data-action="remind" data-index="${i}">Send reminder</button>` : ''}
            </div>
          </li>`)}
      </ol>
      <p class="muted small">${audience === 'couple' ? 'Online payment isn’t connected yet. Your planner will share how to pay each milestone.' : 'Payment collection and reconciliation are later modules. Statuses shown are mock values.'}</p>
    </section>`;
}

export function renderVendorCosts(bills, extras) {
  const billTotal = bills.reduce((n, b) => n + b.amount, 0);
  return html`
    <section class="card" aria-labelledby="vc-h">
      <div class="card-head"><h2 id="vc-h" class="card-title">Vendor bills</h2>${visibility('internal')}</div>
      ${bills.length ? html`
        <div class="table-wrap"><table class="table">
          <thead><tr><th scope="col">Vendor</th><th scope="col">Category</th><th scope="col" class="num">Amount</th><th scope="col" class="num">Paid</th><th scope="col">Due</th><th scope="col">Status</th></tr></thead>
          <tbody>${bills.map((b) => html`<tr><td>${b.vendor}</td><td>${b.category}</td><td class="num">${inr(b.amount)}</td><td class="num">${inr(b.paid)}</td><td>${fmtDate(b.due)}</td><td>${pill(b.status)}</td></tr>`)}</tbody>
          <tfoot><tr><th scope="row" colspan="2">Total</th><td class="num">${inr(billTotal)}</td><td class="num">${inr(bills.reduce((n, b) => n + b.paid, 0))}</td><td colspan="2"></td></tr></tfoot>
        </table></div>` : emptyState({ icon: 'coin', title: 'No vendor bills yet', body: 'Bills appear once vendors are booked.' })}
    </section>
    <section class="card" aria-labelledby="ex-h">
      <div class="card-head"><h2 id="ex-h" class="card-title">Extra costs</h2>${visibility('internal')}</div>
      ${extras.length ? html`
        <ul class="list">
          ${extras.map((x) => html`<li class="list-row"><span>${x.label}<small class="muted"> · ${x.billable ? 'Billable to couple' : 'Agency cost'}</small></span><span class="list-row-side"><strong>${inr(x.amount)}</strong>${pill(x.status)}</span></li>`)}
        </ul>` : emptyState({ title: 'No extra costs recorded' })}
    </section>`;
}

export function renderCloseout(w) {
  const income = w.payments.reduce((n, m) => n + m.amount, 0) + w.extras.filter((x) => x.billable).reduce((n, x) => n + x.amount, 0);
  const costs = w.vendorBills.reduce((n, b) => n + b.amount, 0) + w.extras.filter((x) => !x.billable).reduce((n, x) => n + x.amount, 0);
  const steps = ['All vendor bills received', 'Final payment received', 'Extras reconciled', 'Profit reviewed & case closed'];
  return html`
    <section class="card" aria-labelledby="co-h">
      <div class="card-head"><h2 id="co-h" class="card-title">Final closeout</h2>${visibility('internal')}${futureTag('Closeout & reporting')}</div>
      <ul class="stat-row">
        <li><span>Expected income</span><strong>${inr(income)}</strong></li>
        <li><span>Known costs</span><strong>${inr(costs)}</strong></li>
        <li><span>Indicative margin</span><strong>${income ? inr(income - costs) : '—'}</strong></li>
      </ul>
      <p class="muted small">Indicative figures from mock data. Profit review is calculated in a later module after the event.</p>
      <ul class="checklist checklist-static">${steps.map((s) => html`<li><span class="check-box" aria-hidden="true"></span>${s} <span class="muted small">· after the event</span></li>`)}</ul>
    </section>`;
}
