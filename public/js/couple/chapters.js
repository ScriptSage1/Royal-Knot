// Couple chapters after the intake: consultation, plan, vendors, agreement,
// payments, schedule and account. Each view renders from the couple's
// server-side projection; each action calls the couple API and re-renders
// from the response.
import { html, fmtDate, fmtDateTime, emptyState, pill, todayISO } from '../core/ui.js';
import { api } from '../core/api.js';
import { renderRequirementsDoc } from '../components/documents.js';
import { renderComparison } from '../components/proposals.js';
import { renderPaymentTimeline } from '../components/payments.js';
import { renderEvents } from '../components/schedule.js';
import { renderAgreementDoc, renderAcceptance } from '../components/agreement.js';
import { SOURCING_LABEL } from './story.js';

const FORMAT = { video: 'Video call', in_person: 'In person', phone: 'Phone call' };
const plannerName = (d) => d.wedding.planner?.name || 'your planner';

// ---------- consultation ----------
function minDateTime() {
  const d = new Date(Date.now() + 2 * 3600000);
  d.setMinutes(0, 0, 0);
  return new Date(d - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

export function viewConsultation(ctx, shell) {
  const a = ctx.data.appointment;
  if (!a) {
    return shell({ title: 'Meet your planner', lede: 'A relaxed first conversation, about an hour. Suggest a time that suits you; your planner will confirm it.' }, html`
      <form data-form="appointment" class="form-stack">
        <label class="field field-narrow"><span class="field-label">Your preferred time</span>
          <input type="datetime-local" name="preferredAt" min="${minDateTime()}" required></label>
        <fieldset class="field"><legend class="field-label">How would you like to meet?</legend>
          <div class="seg">${Object.entries(FORMAT).map(([v, l], i) => html`<label class="seg-opt"><input type="radio" name="format" value="${v}" ${i === 0 ? 'checked' : ''}><span>${l}</span></label>`)}</div>
        </fieldset>
        <label class="field"><span class="field-label">Other times that work <span class="optional">optional</span></span>
          <input name="otherTimes" maxlength="500" placeholder="e.g. weekday evenings after 6 pm"></label>
        <label class="field"><span class="field-label">Anything you’d like us to know first? <span class="optional">optional</span></span>
          <textarea name="note" rows="2" maxlength="1000"></textarea></label>
        <div class="row-end"><button class="btn" type="submit">Request this time</button></div>
      </form>`);
  }
  const rows = [
    ['When', a.status === 'requested' ? `${fmtDateTime(a.preferredAt)} (requested)` : fmtDateTime(a.scheduledAt)],
    ['How', FORMAT[a.format]],
    a.place ? ['Where', a.place] : null,
    ['With', a.status === 'requested' && !ctx.data.wedding.planner ? 'A Royal Knot planner' : plannerName(ctx.data)],
    a.otherTimes && a.status === 'requested' ? ['Other times', a.otherTimes] : null,
  ].filter(Boolean);
  const title = { requested: 'Your consultation is requested', confirmed: 'Your consultation is confirmed', completed: 'Your consultation' }[a.status];
  const lede = { requested: 'Your planner will confirm the time, or suggest another, shortly.', confirmed: 'Bring your ideas, and anyone you’d like to join you.', completed: 'Thank you for a lovely conversation.' }[a.status];
  return shell({ title, lede }, html`
    <div class="paper-section">
      <div class="card-head"><h2 class="card-title">Appointment</h2>${pill(a.status, { requested: 'Requested', confirmed: 'Confirmed', completed: 'Held' }[a.status])}</div>
      <dl class="kv">${rows.map(([k, v]) => html`<div><dt>${k}</dt><dd>${v}</dd></div>`)}</dl>
      ${a.plannerMessage ? html`<blockquote class="quote">${a.plannerMessage}</blockquote>` : ''}
      ${a.status === 'confirmed' && a.format === 'video' ? (a.meetingLink
        ? html`<p><a class="btn" href="${a.meetingLink}" target="_blank" rel="noopener noreferrer">Join the video call</a></p><p class="muted small">Opens the meeting room your planner shared.</p>`
        : html`<p class="muted small">Your planner will share the video link before the call.</p>`) : ''}
      ${a.status !== 'completed' ? html`<div class="row-end"><button class="btn btn-ghost btn-small" type="button" data-action="appointment-cancel">${a.status === 'requested' ? 'Cancel this request' : 'Cancel and choose another time'}</button></div>` : ''}
      ${a.status === 'completed' ? html`<p><a class="link" href="#plan">${ctx.data.requirements ? 'Read your plan →' : `${plannerName(ctx.data)} is writing up your plan →`}</a></p>` : ''}
    </div>`);
}

// ---------- plan ----------
export function viewPlan(ctx, shell) {
  const r = ctx.data.requirements;
  if (!r) {
    return shell({ title: 'Your plan, in writing' }, html`<div class="paper-section">${emptyState({ icon: 'doc', title: `${plannerName(ctx.data)} is preparing this`, body: 'After your consultation, your planner writes everything down here for you to review.' })}</div>`);
  }
  const responded = r.response && html`
    <div class="callout-soft">
      ${r.response === 'confirmed' ? html`<strong>You confirmed this plan.</strong>` : html`<strong>You asked for changes.</strong> ${plannerName(ctx.data)} is updating the plan.<p class="pre small">${r.comment}</p>`}
    </div>`;
  return shell({ title: 'Your plan, in writing', lede: 'Everything from your conversation, in one place. Nothing is booked until you’re happy.' }, html`
    ${renderRequirementsDoc(r, { label: 'Your celebration plan' })}
    ${responded || html`
      <div class="row-end row-split">
        <details class="ask-changes">
          <summary class="btn btn-ghost">Ask for changes</summary>
          <form data-form="plan-changes" class="form-stack">
            <label class="field"><span class="field-label">What should change?</span><textarea name="comment" rows="3" maxlength="2000" required></textarea></label>
            <div class="row-end"><button class="btn" type="submit">Send to my planner</button></div>
          </form>
        </details>
        <button class="btn" type="button" data-action="plan-confirm" data-id="${r.id}">This looks right</button>
      </div>`}`);
}

// ---------- vendors ----------
export const vendorState = { category: null };

export function viewVendors(ctx, shell) {
  const d = ctx.data;
  const sourcing = d.wedding.vendorSourcing;
  const changeChoice = html`
    <details class="paper-more">
      <summary>Change how we help with vendors</summary>
      <form data-form="sourcing" class="form-stack">
        <div class="choices">${Object.entries(SOURCING_LABEL).map(([v, l]) => html`<label class="choice"><input type="radio" name="vendorSourcing" value="${v}" ${sourcing === v ? 'checked' : ''}><span><strong>${l}</strong></span></label>`)}</div>
        <div class="row-end"><button class="btn btn-small" type="submit">Save</button></div>
      </form>
    </details>`;
  if (!d.shortlist.length) {
    const msg = sourcing === 'help'
      ? { title: 'Your shortlist is on its way', body: `${plannerName(d)} is gathering proposals from vendors who fit your plan.` }
      : sourcing === 'own' ? { title: 'Working with your own vendors', body: 'Your planner will coordinate the vendors you already have, and can help fill any gaps.' }
        : sourcing === 'not_needed' ? { title: 'No vendor sourcing needed', body: 'Your planning carries on without it. You can change your mind anytime.' }
          : { title: 'Decide whenever you’re ready', body: 'Planning carries on in the meantime.' };
    return shell({ title: 'Your vendors' }, html`<div class="paper-section">${emptyState({ icon: 'people', ...msg })}</div>${changeChoice}`);
  }
  const cat = d.shortlist.find((c) => c.category === vendorState.category) || d.shortlist[0];
  const tabs = d.shortlist.length > 1 ? html`<div class="tabs" role="group" aria-label="Vendor category">${d.shortlist.map((c) => html`
    <button type="button" class="tab" data-action="vendor-category" data-category="${c.category}" aria-pressed="${c === cat}">${c.category}${c.options.some((o) => o.decision === 'chosen') ? ' ✓' : ''}</button>`)}</div>` : '';
  const footer = (o) => html`
    <div class="btn-stack">
      <button class="btn btn-small ${o.decision === 'chosen' ? '' : 'btn-ghost'}" type="button" data-action="decide" data-id="${o.id}" data-decision="${o.decision === 'chosen' ? '' : 'chosen'}" aria-pressed="${o.decision === 'chosen'}">${o.decision === 'chosen' ? 'Chosen ✓' : 'Choose this'}</button>
      <button class="link-btn" type="button" data-action="decide" data-id="${o.id}" data-decision="${o.decision === 'deferred' ? '' : 'deferred'}">${o.decision === 'deferred' ? 'Undo maybe later' : 'Maybe later'}</button>
      <button class="link-btn" type="button" data-action="decide" data-id="${o.id}" data-decision="${o.decision === 'declined' ? '' : 'declined'}">${o.decision === 'declined' ? 'Undo not for us' : 'Not for us'}</button>
    </div>`;
  return shell({ title: 'Your vendor shortlist', lede: `${plannerName(d)} has shortlisted these for you. Compare, ask anything, and choose what feels right.` }, html`
    ${tabs || html`<h2 class="card-title">${cat.category}</h2>`}
    ${renderComparison({ options: cat.options, audience: 'couple', footer })}
    <section class="questions" aria-labelledby="q-h">
      <h3 id="q-h" class="sub-h">Questions for your planner</h3>
      ${cat.options.flatMap((o) => o.questions.map((q) => html`
        <div class="qa"><p><strong>${o.vendorName}:</strong> ${q.question}</p>${q.answer ? html`<p class="qa-answer">${q.answer}</p>` : html`<p class="muted small">Waiting for an answer</p>`}</div>`))}
      <form data-form="question" class="form-row">
        <label class="field field-inline"><span class="field-label sr-only">About</span>
          <select name="proposalId">${cat.options.map((o) => html`<option value="${o.id}">${o.vendorName}</option>`)}</select></label>
        <label class="field field-grow"><span class="field-label sr-only">Your question</span><input name="question" maxlength="1000" placeholder="Ask about any option" required></label>
        <button class="btn btn-small" type="submit">Ask</button>
      </form>
    </section>
    ${changeChoice}`);
}

// ---------- agreement ----------
export function viewAgreement(ctx, shell) {
  const a = ctx.data.agreement;
  if (!a) {
    return shell({ title: 'Your agreement' }, html`<div class="paper-section">${emptyState({ icon: 'doc', title: 'Your agreement will appear here', body: 'Once your plan and scope are settled, your planner prepares the agreement for you to review.' })}</div>`);
  }
  return shell({ title: 'Your agreement', lede: a.status === 'accepted' ? 'Accepted. Here’s your record.' : 'Read it at your own pace. Ask your planner anything before you accept.' }, html`
    ${renderAgreementDoc(a)}
    ${a.status === 'accepted' ? renderAcceptance(a) : html`
      <form data-form="accept" class="accept-form" data-id="${a.id}">
        <label class="field"><span class="field-label">Your full name</span><input name="signatoryName" maxlength="120" autocomplete="name" required></label>
        <label class="check"><input type="checkbox" name="agree" required><span>I have read version ${a.version} of this agreement and accept it on behalf of us both.</span></label>
        <p class="muted small">This records your acceptance in The Royal Knot portal with your name, account and the time. It is not a certified electronic signature.</p>
        <div class="row-end"><button class="btn" type="submit">Accept the agreement</button></div>
      </form>`}
    <p class="paper-link"><a class="link" href="#payments">See your payment timeline →</a></p>`);
}

// ---------- payments ----------
export function viewPayments(ctx, shell) {
  const p = ctx.data.payments;
  if (!p.length) return shell({ title: 'Your payments' }, html`<div class="paper-section">${emptyState({ icon: 'coin', title: 'No payments yet', body: 'Your payment timeline appears with your agreement.' })}</div>`);
  const side = (x) => (x.state !== 'paid' && x.paymentLink
    ? html`<a class="btn btn-small" href="${x.paymentLink}" target="_blank" rel="noopener noreferrer">Pay online</a>` : '');
  return shell({ title: 'Your payments', lede: 'Every milestone, in order. Your planner records each payment as it arrives.' }, html`
    ${renderPaymentTimeline(p, { side })}
    <p class="muted small">Pay through the link your planner shares, or by the bank details in your agreement. Payments are never taken on this page.</p>`);
}

// ---------- schedule ----------
export function viewSchedule(ctx, shell) {
  const d = ctx.data;
  const mine = d.tasks.filter((t) => t.ownerType === 'couple');
  const today = todayISO();
  return shell({ title: d.wedding.scheduleFinal ? 'Your wedding days' : 'Bringing it together', lede: d.wedding.scheduleFinal ? 'The final schedule.' : 'The schedule so far. Your planner will tell you when it’s final.' }, html`
    ${mine.length ? html`<section class="paper-section" aria-labelledby="mine-h">
      <h2 id="mine-h" class="card-title">For the two of you</h2>
      <ul class="checklist">${mine.map((t) => html`<li><label class="check"><input type="checkbox" data-action="task-toggle" data-id="${t.id}" ${t.status === 'done' ? 'checked' : ''}><span>${t.title}${t.dueDate ? html` <small class="${t.status !== 'done' && t.dueDate < today ? 'is-late' : 'muted'}">· by ${fmtDate(t.dueDate, { day: 'numeric', month: 'short' })}</small>` : ''}</span></label></li>`)}</ul>
    </section>` : ''}
    <section class="paper-section" aria-labelledby="ev-h">
      <div class="card-head"><h2 id="ev-h" class="card-title">Events</h2>${pill(d.wedding.scheduleFinal ? 'final' : 'draft', d.wedding.scheduleFinal ? 'Final' : 'Draft')}</div>
      ${d.events.length ? renderEvents(d.events) : emptyState({ icon: 'calendar', title: 'Your events will appear here', body: 'Your planner adds them as the plan takes shape.' })}
    </section>`);
}

// ---------- account ----------
export function viewAccount(ctx, shell) {
  const w = ctx.data.wedding;
  return shell({ title: 'Your planning space' }, html`
    <dl class="kv">
      <div><dt>Case ID</dt><dd><code>${w.caseCode}</code></dd></div>
      <div><dt>Planner</dt><dd>${w.planner ? w.planner.name : 'Matched after your first booking'}</dd></div>
    </dl>
    <section class="paper-section" aria-labelledby="inv-h">
      <h2 id="inv-h" class="card-title">Invite your partner</h2>
      <p>Share this code. They create their own account and choose “Join my partner’s”.</p>
      <p class="invite"><code id="invite-code">${w.inviteCode}</code><button class="btn btn-ghost btn-small" type="button" data-action="copy-invite">Copy</button></p>
    </section>
    <form method="post" action="/logout" class="row-end"><input type="hidden" name="area" value="couple"><input type="hidden" name="_csrf" value="${document.querySelector('meta[name="csrf-token"]').content}"><button class="btn btn-ghost" type="submit">Sign out</button></form>`);
}

// ---------- actions ----------
export const actions = {
  'appointment-cancel': () => api.post('/api/couple/appointment/cancel'),
  'plan-confirm': (t) => api.post(`/api/couple/requirements/${t.dataset.id}/respond`, { response: 'confirmed' }),
  'vendor-category': (t) => { vendorState.category = t.dataset.category; return null; },
  decide: (t) => api.post(`/api/couple/proposals/${t.dataset.id}/decision`, { decision: t.dataset.decision }),
  'task-toggle': (t) => api.post(`/api/couple/tasks/${t.dataset.id}/status`, { done: t.checked }),
  'copy-invite': async () => { await navigator.clipboard.writeText(document.getElementById('invite-code').textContent); return { toast: 'Invite code copied.' }; },
};

export const forms = {
  appointment: (v) => api.post('/api/couple/appointment', v),
  'plan-changes': (v, ctx) => api.post(`/api/couple/requirements/${ctx.data.requirements.id}/respond`, { response: 'changes_requested', comment: v.comment }),
  sourcing: (v) => api.patch('/api/couple/profile', { vendorSourcing: v.vendorSourcing || null }),
  question: (v) => api.post(`/api/couple/proposals/${v.proposalId}/questions`, { question: v.question }),
  accept: (v, ctx, form) => api.post(`/api/couple/agreements/${form.dataset.id}/accept`, v),
};

