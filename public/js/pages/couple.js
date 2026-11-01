// Couple portal. The home view is one moment: where you are, what your
// planner is handling, and the single next thing for you. Chapters open as
// panels over the Shared Garden, whose growth follows the wedding's real
// progress from the server.
import { html, mount, on, fmtDate, fmtDateTime, toast } from '../core/ui.js';
import { api, formValues } from '../core/api.js';
import { progressOf, publishProgress } from '../core/progress.js';
import { mountGarden } from '../garden/garden.js';
import { viewStory, saveStep, gotoStep, storyState } from '../couple/story.js';
import * as C from '../couple/chapters.js';

const root = document.getElementById('cp-view');
const ctx = { data: null };

const VIEWS = {
  story: viewStory, consultation: C.viewConsultation, plan: C.viewPlan, vendors: C.viewVendors,
  agreement: C.viewAgreement, payments: C.viewPayments, schedule: C.viewSchedule, account: C.viewAccount,
};
const LINKS = { story: 'Your story', consultation: 'Consultation', plan: 'Your plan', vendors: 'Vendors', agreement: 'Agreement', payments: 'Payments', schedule: 'Schedule' };

// ---------- the current moment ----------
function moment(d) {
  const w = d.wedding;
  const P = w.planner ? w.planner.name.split(' ')[0] : null;
  const a = d.appointment;
  const r = d.requirements;
  const ag = d.agreement;
  const due = d.payments.find((p) => p.state === 'overdue' || p.state === 'due');
  const undecided = d.shortlist.some((c) => !c.options.some((o) => o.decision === 'chosen'));

  if (!w.detailsShared) return { eyebrow: 'Your story', title: 'Let’s begin with you', lede: 'A few gentle questions about the two of you. Skip anything, and change it later.', planner: 'Your planner is matched when you share your story.', cta: ['Begin your story', '#story'] };
  if (!a) return { eyebrow: 'Meeting your planner', title: 'A first conversation', lede: 'Suggest a time for a relaxed hour together, online or in our studio.', planner: P ? `${P} is looking forward to meeting you.` : 'We’ll pair you with a planner who suits your celebration.', cta: ['Choose a time', '#consultation'] };
  if (a.status === 'requested') return { eyebrow: 'Meeting your planner', title: 'Your time is requested', lede: `You asked for ${fmtDateTime(a.preferredAt)}. We’ll confirm shortly.`, planner: P ? `${P} is confirming your time.` : 'A planner is reviewing your request.', cta: ['View your request', '#consultation'] };
  if (a.status === 'confirmed') return { eyebrow: 'Meeting your planner', title: 'See you soon', lede: `${fmtDateTime(a.scheduledAt)}. Bring your ideas, and anyone you’d like.`, planner: `${P || 'Your planner'} will be there.`, cta: ['Your appointment', '#consultation'] };
  if (!r) return { eyebrow: 'Your plan, in writing', title: 'Your plan is taking shape', lede: 'Everything from your conversation is being written up for you to review.', planner: `${P || 'Your planner'} is drafting your plan.`, cta: ['Revisit your story', '#story'] };
  if (!r.response) return { eyebrow: 'Your plan, in writing', title: 'Your plan is ready to read', lede: 'Check it feels like you. Nothing is booked until you’re happy.', planner: `${P} wrote this from your conversation.`, cta: ['Read your plan', '#plan'] };
  if (r.response === 'changes_requested') return { eyebrow: 'Your plan, in writing', title: 'Updating your plan', lede: 'Thank you for your notes. A new version is on its way.', planner: `${P} is working on your changes.`, cta: ['See your notes', '#plan'] };
  if (ag && ag.status === 'sent') return { eyebrow: 'Our agreement', title: 'Your agreement is ready', lede: 'The scope, the fee and how payments work, in one document.', planner: `${P} is happy to talk anything through.`, cta: ['Review and accept', '#agreement'], due };
  if (undecided) return { eyebrow: 'Choosing your vendors', title: 'Your shortlist is here', lede: 'Compare options side by side, ask anything, and choose what feels right.', planner: `${P} shortlisted these for you.`, cta: ['Compare your options', '#vendors'], due };
  if (w.vendorSourcing === 'help' && !d.vendorsResolved && !ag) return { eyebrow: 'Choosing your vendors', title: 'Gathering proposals', lede: 'Vendors who fit your plan are sending their proposals.', planner: `${P} is collecting and checking every quote.`, cta: ['Your vendors', '#vendors'] };
  if (!ag) return { eyebrow: 'Our agreement', title: 'Your agreement is being prepared', lede: 'Your planner is setting out the scope and payment timeline.', planner: `${P} is preparing your agreement.`, cta: ['Read your plan again', '#plan'] };
  if (w.completed) return { eyebrow: 'After the celebration', title: 'Thank you', lede: 'It was a joy to plan this with you.', planner: `With love from ${P} and the team.`, cta: ['Your wedding days', '#schedule'] };
  if (w.scheduleFinal) return { eyebrow: 'The wedding days', title: 'Everything is in place', lede: 'Your final schedule, all in one place.', planner: `${P} and the team will be with you on the day.`, cta: ['See your schedule', '#schedule'], due };
  const open = d.tasks.filter((t) => t.ownerType === 'couple' && t.status !== 'done').length;
  return { eyebrow: 'Bringing it together', title: 'The details are coming together', lede: open ? `${open} small thing${open > 1 ? 's' : ''} for the two of you, and your schedule so far.` : 'Your events and timings, as they firm up.', planner: `${P} is coordinating your vendors and venues.`, cta: ['See what’s next', '#schedule'], due };
}

// Up to four places worth revisiting, from what exists.
function alsoHere(d, ctaHref) {
  const have = {
    story: d.wedding.detailsShared, consultation: Boolean(d.appointment), plan: Boolean(d.requirements),
    vendors: d.shortlist.length > 0, agreement: Boolean(d.agreement), payments: d.payments.length > 0, schedule: d.events.length > 0 || d.tasks.length > 0,
  };
  return Object.keys(LINKS).filter((k) => have[k] && `#${k}` !== ctaHref).slice(-4);
}

function viewHome() {
  const d = ctx.data;
  const m = moment(d);
  const links = alsoHere(d, m.cta[1]).filter((k) => !(m.due && k === 'payments'));
  return html`
    <section class="moment" aria-labelledby="moment-title">
      <div class="moment-copy">
        <p class="moment-eyebrow">${m.eyebrow}</p>
        ${d.wedding.coupleLabel ? html`<p class="moment-greeting">For ${d.wedding.coupleLabel}</p>` : ''}
        <h1 class="moment-title" id="moment-title" tabindex="-1">${m.title}</h1>
        <p class="moment-lede">${m.lede}</p>
        <p class="moment-planner"><span class="moment-avatar" aria-hidden="true">${d.wedding.planner ? d.wedding.planner.name[0] : 'RK'}</span><span>${m.planner}</span></p>
        <div class="moment-actions">
          <a class="cx-btn" href="${m.cta[1]}">${m.cta[0]}</a>
          ${m.due ? html`<a class="cx-link cx-link-sm" href="#payments">${m.due.label} ${m.due.state === 'overdue' ? 'is overdue' : `is due ${fmtDate(m.due.dueDate, { day: 'numeric', month: 'short' })}`}</a>` : ''}
        </div>
        ${links.length ? html`<nav class="moment-also" aria-label="Also in your planning space">${links.map((k) => html`<a href="#${k}">${LINKS[k]}</a>`)}</nav>` : ''}
      </div>
    </section>`;
}

function shell({ title, lede = '' }, body) {
  return html`
    <article class="chapter" aria-labelledby="chapter-title">
      <a class="chapter-back" href="#home"><span aria-hidden="true">←</span> Back</a>
      <header class="chapter-head">
        <h1 class="chapter-title" id="chapter-title" tabindex="-1">${title}</h1>
        ${lede ? html`<p class="chapter-lede">${lede}</p>` : ''}
      </header>
      <div class="paper rk-folio rk-clasp">${body}</div>
    </article>`;
}

// ---------- render ----------
let view = 'home';
function render({ focus = false } = {}) {
  if (view !== 'home' && !VIEWS[view]) view = 'home';
  const mode = view === 'home' ? 'home' : 'chapter';
  if (document.body.dataset.view !== mode) window.dispatchEvent(new CustomEvent('rk:garden-mode', { detail: { mode } }));
  document.body.dataset.view = mode;
  mount(root, view === 'home' ? viewHome() : VIEWS[view](ctx, shell));
  document.getElementById('cx-planner').textContent = ctx.data.wedding.planner ? `Planner · ${ctx.data.wedding.planner.name}` : '';
  if (focus) root.querySelector('h1, .story-legend')?.focus({ preventScroll: true });
}

function setData(data) {
  ctx.data = data;
  publishProgress(progressOf({ done: new Set(data.milestones.done), tasks: data.milestones.tasks }));
}

// Run an action, show errors kindly, then re-render from the server's answer.
async function perform(fn, { button, success } = {}) {
  if (button) button.disabled = true;
  try {
    const out = await fn();
    if (out && out.toast) toast(out.toast);
    else if (out && out.wedding) { setData(out); if (success) toast(success); }
    render();
    return true;
  } catch (err) {
    toast(err.message, { tone: 'error' });
    if (button) button.disabled = false;
    return false;
  }
}

const SUCCESS = { appointment: 'Request sent. Your planner will confirm.', 'plan-changes': 'Sent to your planner.', sourcing: 'Saved.', question: 'Question sent to your planner.', accept: 'Thank you. Your acceptance is recorded.' };
const focusStep = () => root.querySelector('.story-legend')?.focus();

on(root, 'submit', 'form[data-form]', (e, form) => {
  e.preventDefault();
  const name = form.dataset.form;
  const button = form.querySelector('[type="submit"]');
  if (name === 'story') {
    perform(async () => {
      const r = await saveStep(form, ctx, 1);
      setData(r.data);
      if (r.done) { toast(r.firstShare ? 'Shared with your planner. Welcome.' : 'Saved.'); location.hash = 'home'; }
      return null;
    }, { button }).then(focusStep);
    return;
  }
  if (!form.reportValidity()) return;
  perform(() => C.forms[name](formValues(form), ctx, form), { button, success: SUCCESS[name] });
});

on(root, 'click', '[data-step-nav]', (e, t) => perform(async () => { const r = await saveStep(t.form, ctx, Number(t.dataset.stepNav)); setData(r.data); return null; }).then(focusStep));
on(root, 'click', '[data-goto-step]', (e, t) => perform(async () => { const r = await saveStep(t.closest('form'), ctx, 0); setData(r.data); gotoStep(Number(t.dataset.gotoStep)); return null; }).then(focusStep));
on(root, 'click', '[data-action="story-edit"]', () => { storyState.editing = true; storyState.step = 0; render({ focus: true }); });
on(root, 'click', 'button[data-action]', (e, t) => {
  const fn = C.actions[t.dataset.action];
  if (fn) perform(() => fn(t, ctx), { button: t });
});
on(root, 'change', 'input[type="checkbox"][data-action]', (e, t) => perform(() => C.actions[t.dataset.action](t, ctx)));
on(root, 'change', 'input[name="dateMode"]', (e, t) => root.querySelectorAll('[data-date]').forEach((el) => { el.hidden = el.dataset.date !== t.value; }));
on(root, 'change', 'input[name="budgetMode"]', (e, t) => { const el = root.querySelector('[data-budget-range]'); if (el) el.hidden = t.value !== 'range'; });

window.addEventListener('hashchange', () => {
  view = location.hash.slice(1) || 'home';
  storyState.editing = false;
  render({ focus: true });
  window.scrollTo({ top: 0 });
});

(async function boot() {
  try {
    setData(await api.get('/api/couple/workspace'));
  } catch (err) {
    mount(root, html`<p class="cx-loading">${err.message}</p>`);
    return;
  }
  view = location.hash.slice(1) || 'home';
  document.body.dataset.view = '';
  mountGarden(document.getElementById('garden-canvas'), { progress: progressOf({ done: new Set(ctx.data.milestones.done), tasks: ctx.data.milestones.tasks }) });
  render();
})();
