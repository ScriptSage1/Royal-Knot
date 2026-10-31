// Payment timeline: any number of milestones with a state computed on the
// server (paid, overdue, due within 14 days, upcoming). `side(p)` renders
// each row's actions for the audience.
import { html, inr, fmtDate, pill } from '../core/ui.js';

const KIND = { booking: 'Booking', advance: 'Advance', final: 'Final', extra: 'Extra', other: 'Payment' };
const STATE = { paid: 'Paid', overdue: 'Overdue', due: 'Due soon', upcoming: 'Upcoming' };

export function renderPaymentTimeline(payments, { side = null } = {}) {
  const total = payments.reduce((n, p) => n + p.amount, 0);
  const paid = payments.filter((p) => p.state === 'paid').reduce((n, p) => n + p.amount, 0);
  const due = payments.filter((p) => p.state === 'due' || p.state === 'overdue').reduce((n, p) => n + p.amount, 0);
  return html`
    <ul class="stat-row">
      <li><span>Total</span><strong>${inr(total)}</strong></li>
      <li><span>Paid</span><strong>${inr(paid)}</strong></li>
      <li><span>Due now</span><strong>${inr(due)}</strong></li>
      <li><span>Remaining</span><strong>${inr(total - paid)}</strong></li>
    </ul>
    <ol class="timeline">
      ${payments.map((p) => html`
        <li class="timeline-item tone-${p.state}">
          <span class="timeline-dot" aria-hidden="true"></span>
          <div class="timeline-main">
            <p class="timeline-title">${p.label} <span class="kind">${KIND[p.kind] || 'Payment'}</span></p>
            <p class="muted small">${p.state === 'paid' && p.paidOn ? `Paid ${fmtDate(p.paidOn)}` : `Due ${fmtDate(p.dueDate)}`}</p>
          </div>
          <div class="timeline-side">
            <strong class="amount">${inr(p.amount)}</strong>
            ${pill(p.state, STATE[p.state])}
            ${side ? side(p) : ''}
          </div>
        </li>`)}
    </ol>`;
}
