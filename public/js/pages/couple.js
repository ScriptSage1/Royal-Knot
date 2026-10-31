// Couple portal — a guided journey told in chapters, with the Shared Garden as
// the stage. Renders from the couple-safe mock projection only; nothing is
// saved or sent. Planning state comes from the mock stage (or `?stage=N`) and
// from the couple's own preview actions.
//
// One way to navigate and see progress: the "Your journey" button in the top
// bar. The home view is one moment — what your planner is handling, the one
// thing needed from you, and what happens next.
import { html, mount, on, fmtDate, fmtDay, pill, emptyState, previewNotice } from '../core/ui.js';
import { stageState, stageIndexOf, progressOf, stageFromUrl, writeStageToUrl, publishProgress } from '../core/progress.js';
import { initDevbar, isDevMode } from '../core/devbar.js';
import { loadCoupleWorkspace } from '../data/source.js';
import { renderRequirementsDoc } from '../components/documents.js';
import { renderAgreement } from '../components/agreement.js';
import { renderPaymentTimeline } from '../components/payments.js';
import { renderComparison } from '../components/proposals.js';
import { renderCoupleEvents } from '../components/schedule.js';
import { mountGarden } from '../garden/garden.js';

// The whole journey, in chapters. A chapter completes when its milestones are
// done; chapters without milestones follow the one before. Add a row here (and
// a view below) to extend the journey.
const CHAPTERS = [
  { id: 'details', milestones: ['enquiry'], title: 'Your story', blurb: 'Share the first details.' },
  { id: 'consultation', milestones: ['consultBooked', 'consultHeld'], title: 'Meeting your planner', blurb: 'Choose a time to meet.' },
  { id: 'plan', milestones: ['requirements'], title: 'Your plan, in writing', blurb: 'Review your celebration plan.' },
  { id: 'vendors', milestones: ['vendors'], title: 'Choosing your vendors', blurb: 'Compare your vendor shortlist.' },
  { id: 'agreement', milestones: ['agreement'], title: 'Our agreement', blurb: 'Review service and payment terms.' },
  { id: 'events', milestones: ['tasks', 'schedule', 'complete'], title: 'Bringing it together', blurb: 'Confirm the schedule.' },
  { id: 'day', milestones: ['wedding-day'], title: 'The wedding day', blurb: 'Your schedule and day-of team.' },
  { id: 'closeout', milestones: ['closeout'], title: 'After the celebration', blurb: 'Final payments and memories.' },
];

const BUDGETS = ['Under ₹25 L', '₹25 – 50 L', '₹50 L – 1 Cr', '₹1 – 3 Cr', 'Above ₹3 Cr', 'Not sure yet'];

const S = { data: null, state: null, view: 'home', vendorCategory: null, choices: {}, step: 0, editing: false, dev: false };
const root = document.getElementById('cp-view');
const dialog = document.getElementById('journey');
const has = (k) => S.state.done.has(k);
const planner = () => S.data.planner.name;
const firstName = () => planner().split(' ')[0];

// ---------- chapter state ----------
function chapterStates() {
  let currentFound = false;
  return CHAPTERS.map((c, i) => {
    const done = c.milestones.every(has);
    let status = 'upcoming';
    if (done) status = 'done';
    else if (!currentFound) { status = 'current'; currentFound = true; }
    return { ...c, n: i + 1, status };
  });
}
const currentChapter = () => chapterStates().find((c) => c.status === 'current');
const nextChapter = () => { const chs = chapterStates(); const i = chs.findIndex((c) => c.status === 'current'); return chs[i + 1]; };

function canOpen(id) {
  if (id === 'home' || id === 'details') return true;
  if (id === 'payments') return has('requirements');
  const c = chapterStates().find((x) => x.id === id);
  return !!c && c.status !== 'upcoming';
}

// ---------- derived mock statuses ----------
function agreementView() {
  const status = has('agreement') ? 'Signed' : has('requirements') ? 'Sent' : 'Not started';
  return { ...S.data.agreement, status, history: [] };
}
function paymentsView() {
  if (!has('requirements')) return [];
  const stage = stageIndexOf(S.state);
  return S.data.payments.map((p, i) => {
    let status = 'Upcoming';
    if (has('agreement')) {
      if (i === 0) status = 'Paid';
      else if (i === 1) status = stage >= 8 ? 'Paid' : 'Due';
      else if (i === 2) status = stage >= 9 ? 'Paid' : stage >= 8 ? 'Due' : 'Upcoming';
    } else if (i === 0) status = 'Due';
    return { ...p, status, paidOn: status === 'Paid' ? p.due : null };
  });
}
const duePayment = () => paymentsView().find((p) => p.status === 'Due' || p.status === 'Overdue');

// What the couple sees now: the planner's part, their part, and what follows.
function moment(c) {
  const booked = S.data.consultation.booked || S.data.consultation.slots[0];
  const P = firstName();
  const M = {
    details: {
      title: 'Let’s begin with you',
      lede: 'Share what you know. You can change it later.',
      planner: 'Your planner will be matched soon.',
      cta: 'Begin your story', href: '#details',
      more: ['Five quick questions', 'Estimates are fine', 'Edit anytime'],
    },
    consultation: has('consultBooked')
      ? {
        title: 'Your first conversation',
        lede: `You're meeting ${fmtDay(booked.date)} · ${booked.time}. Bring your ideas.`,
        planner: `${P} · your planner`,
        cta: 'View your appointment', href: '#consultation',
        more: ['About an hour · online or in studio', 'Bring anyone you like', 'Private notes keep the details together'],
      }
      : {
        title: 'Meet your planner',
        lede: 'Choose a time for a relaxed first conversation.',
        planner: `${P} · your planner`,
        cta: 'Choose a time', href: '#consultation',
        more: ['About an hour · online or in studio', 'Pick a time', 'Change the time anytime'],
      },
    plan: {
      title: 'Your plan is taking shape',
      lede: 'Review your celebration plan before anything is booked.',
      planner: `${P} · preparing your plan`,
      cta: 'See what’s being prepared', href: '#plan',
      more: ['Celebration, style, food and access', 'Traditions as you describe them', 'Nothing is booked before approval'],
    },
    agreement: {
      title: 'Your agreement',
      lede: 'Review the service and payment terms.',
      planner: `${P} · here to help`,
      cta: 'Read the agreement', href: '#agreement',
      more: ['Digital signing is coming later', 'Payment schedule included', 'Signed copy stays here'],
    },
    vendors: {
      title: 'Your vendor shortlist',
      lede: 'Compare proposals and choose what feels right.',
      planner: `${P} · here to help`,
      cta: 'Compare your options', href: '#vendors',
      more: ['Compare price, scope and extras', 'Your stationery vendor handles invitations', 'Confirm your choice with your planner'],
    },
    events: {
      title: 'The details are coming together',
      lede: 'See your confirmed events and timings.',
      planner: `${P} · coordinating your team`,
      cta: 'See your events', href: '#events',
      more: ['Draft schedule, updated as plans firm up', 'Final timings before the day', 'Your planner coordinates arrivals'],
    },
    day: {
      title: 'Your day, all in place',
      lede: 'Your schedule and day-of contacts, together.',
      planner: `${P} · with you on the day`,
      cta: 'Your wedding day', href: '#day',
      more: ['Final schedule', 'Day-of contacts', 'Closeout after the celebration'],
    },
  }[c.id];
  return M;
}

// ---------- shell ----------
function renderBar() {
  const c = currentChapter();
  document.getElementById('journey-meta').textContent = `Chapter ${c.n} of ${CHAPTERS.length}`;
}

function renderJourney() {
  const chs = chapterStates();
  const pay = has('requirements');
  document.getElementById('journey-body').innerHTML = String(html`
    <div class="cx-journey-head">
      <h2 id="journey-title" class="cx-journey-title">Your journey</h2>
      <button class="cx-icon-btn" type="button" data-close-journey aria-label="Close your journey">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>
      </button>
    </div>
    <ol class="cx-chapters">
      ${chs.map((c, i) => {
        const href = `#${c.id}`;
        const note = c.status === 'done' ? 'Complete' : c.status === 'current' ? 'Current' : c.id === 'closeout' ? 'After the wedding' : `Coming later`;
        const inner = html`
          <span class="cx-ch-num" aria-hidden="true">${c.status === 'done' ? '✓' : c.n}</span>
          <span class="cx-ch-text"><span class="cx-ch-title">${c.title}</span><span class="cx-ch-blurb">${c.blurb}</span><span class="cx-ch-note">${note}</span></span>`;
        return html`<li class="cx-ch is-${c.status}">${c.status === 'upcoming'
          ? html`<div class="cx-ch-row">${inner}</div>`
          : html`<a class="cx-ch-row" href="${href}" ${S.view === c.id ? 'aria-current=page' : ''}>${inner}</a>`}</li>`;
      })}
    </ol>
    <h3 class="cx-journey-sub">Quick links</h3>
    <ul class="cx-alongside">
      <li><a href="#details"><strong>Your details</strong><span>Review or edit</span></a></li>
      <li>${pay ? html`<a href="#payments"><strong>Payments</strong><span>${duePayment() ? 'Due now' : 'View milestones'}</span></a>` : html`<div><strong>Payments</strong><span>Available with your agreement</span></div>`}</li>
    </ul>`);
}

function openJourney() {
  renderJourney();
  dialog.showModal();
  (dialog.querySelector('.cx-ch.is-current a') || dialog.querySelector('[data-close-journey]')).focus();
}

// ---------- views ----------
function viewHome() {
  const c = currentChapter();
  const m = moment(c);
  const nx = nextChapter();
  const names = S.data.profile.names.trim();
  const due = c.id !== 'agreement' && duePayment();
  return html`
    <section class="moment" aria-labelledby="moment-title">
      <div class="moment-copy">
        <p class="moment-eyebrow">${c.title}</p>
        ${names ? html`<p class="moment-greeting">For ${names}</p>` : ''}
        <h1 class="moment-title" id="moment-title" tabindex="-1">${m.title}</h1>
        <p class="moment-lede">${m.lede}</p>
        <p class="moment-planner"><span class="moment-avatar" aria-hidden="true">${has('enquiry') ? planner()[0] : 'RK'}</span><span>${m.planner}</span></p>
        <div class="moment-actions">
          <a class="cx-btn" href="${m.href}">${m.cta}</a>
          ${due ? html`<a class="cx-link cx-link-sm" href="#payments">${due.label} is due ${fmtDate(due.due, { day: 'numeric', month: 'short' })}</a>` : ''}
        </div>
        <details class="moment-more">
          <summary>${nx ? html`Then: <strong>${nx.title}</strong>` : 'What this chapter covers'}</summary>
          <ul>${m.more.map((x) => html`<li>${x}</li>`)}</ul>
        </details>
      </div>
    </section>
    <p class="cx-foot">Preview · changes stay in this tab.</p>`;
}

function chapterShell(id, { eyebrow, title, lede }, body) {
  
  return html`
    <article class="chapter" aria-labelledby="chapter-title">
      <a class="chapter-back" href="#home"><span aria-hidden="true">←</span> Back</a>
      <header class="chapter-head">
        ${eyebrow ? html`<p class="moment-eyebrow">${eyebrow}</p>` : ''}
        <h1 class="chapter-title" id="chapter-title" tabindex="-1">${title}</h1>
        ${lede ? html`<p class="chapter-lede">${lede}</p>` : ''}
      </header>
      <div class="paper">${body}</div>
    </article>`;
}

// Chapter 1 — guided, one question at a time; a summary once shared.
const STEPS = ['About you', 'Date & where', 'Size & budget', 'What matters', 'Traditions & family'];
function whenText(f) {
  if (f.dateMode === 'exact' && f.date) return fmtDate(f.date);
  if (f.dateMode === 'month' && f.month) return new Date(f.month + '-01T00:00:00').toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
  return 'Still deciding';
}
function viewDetails() {
  const f = S.data.profile;
  if (has('enquiry') && !S.editing) {
    const trad = f.traditionsNote || (f.traditionsDeciding ? 'Still deciding' : f.traditionsDiscuss ? 'Would rather talk it through with the planner' : 'Nothing shared');
    return chapterShell('details', { title: 'Your story so far', lede: 'Review or edit anytime.' }, html`
      <dl class="story-summary">
        <div><dt>Names</dt><dd>${f.names || 'Not shared'}</dd></div>
        <div><dt>Date</dt><dd>${whenText(f)}</dd></div>
        <div><dt>Location</dt><dd>${f.location || 'Still deciding'}</dd></div>
        <div><dt>Guests</dt><dd>About ${f.guests}${f.eventsCount ? ` · ${f.eventsCount} events or days` : ''}</dd></div>
        <div><dt>Budget</dt><dd>${f.budget || 'To discuss'}</dd></div>
        <div class="wide"><dt>What matters</dt><dd class="story-answer">${f.whatMatters || 'Not shared'}</dd></div>
        <div class="wide"><dt>Traditions & family</dt><dd>${trad}</dd></div>
      </dl>
      <div class="row-end"><button class="btn" type="button" data-action="edit-story">Update your story</button></div>`);
  }
  const chip = (name, value, checked, type = 'checkbox') => html`
    <label class="chip"><input type="${type}" name="${name}" value="${value}" ${checked ? 'checked' : ''}><span>${value}</span></label>`;
  const step = (i, body) => html`<fieldset class="story-step" data-step="${i}" ${S.step === i ? '' : 'hidden'}><legend class="story-legend sr-only" tabindex="-1">${STEPS[i]}</legend>${body}</fieldset>`;
  return chapterShell('details', {
    title: 'Let’s begin with you',
    lede: 'Share the essentials. Change them anytime.',
  }, html`
    <form class="story" data-form="details" novalidate>
      <ol class="story-progress">
        ${STEPS.map((s, i) => html`<li class="${i < S.step ? 'is-done' : i === S.step ? 'is-current' : ''}"><button type="button" data-goto-step="${i}" ${i === S.step ? 'aria-current=step' : ''}><span class="sr-only">Step ${i + 1}: </span>${s}</button></li>`)}
      </ol>

      ${step(0, html`
        <label class="field">
          <span class="field-label">What names should we use?</span>
          <input name="names" value="${f.names}" placeholder="e.g. Asha & Kiran" autocomplete="off">
          
        </label>`)}

      ${step(1, html`
        <div class="field">
          <span class="field-label" id="date-l">When are you hoping to celebrate?</span>
          <div class="seg" role="radiogroup" aria-labelledby="date-l">
            ${[['exact', 'A specific date'], ['month', 'A rough month'], ['undecided', 'Still deciding']].map(([v, l]) => html`
              <label class="seg-opt"><input type="radio" name="dateMode" value="${v}" ${f.dateMode === v ? 'checked' : ''}><span>${l}</span></label>`)}
          </div>
        </div>
        <label class="field field-narrow" data-date="exact" ${f.dateMode !== 'exact' ? 'hidden' : ''}><span class="field-label">Date</span><input type="date" name="date" value="${f.date}"></label>
        <label class="field field-narrow" data-date="month" ${f.dateMode !== 'month' ? 'hidden' : ''}><span class="field-label">Month</span><input type="month" name="month" value="${f.month}"></label>
        <label class="field">
          <span class="field-label">Where would you like to celebrate?</span>
          <input name="location" value="${f.location}" list="loc-ideas" placeholder="A city, a region, or “open to ideas”">
          <datalist id="loc-ideas"><option value="Close to home"><option value="A destination — open to ideas"><option value="Still deciding"></datalist>
        </label>`)}

      ${step(2, html`
        <label class="field">
          <span class="field-label">Guest estimate <output id="guest-out">${f.guests}</output></span>
          <input type="range" name="guests" min="20" max="1500" step="10" value="${f.guests}" aria-describedby="guest-hint">
          <span class="field-hint" id="guest-hint">A rough estimate is fine.</span>
        </label>
        <label class="field field-narrow">
          <span class="field-label">How many events or days?</span>
          <input type="number" min="1" max="20" name="eventsCount" value="${f.eventsCount}" placeholder="e.g. 3">
        </label>
        <div class="field">
          <span class="field-label" id="budget-l">What budget range feels comfortable?</span>
          <div class="chips" role="radiogroup" aria-labelledby="budget-l">${BUDGETS.map((b) => chip('budget', b, f.budget === b, 'radio'))}</div>
        </div>`)}

      ${step(3, html`
        <label class="field">
          <span class="field-label" id="matters-l">What do you want this celebration to feel like?</span>
          <textarea name="whatMatters" rows="5" placeholder="Describe the mood, moments, or details that matter.">${f.whatMatters || ''}</textarea>
          
        </label>
        <details class="story-inspiration">
          <summary>Need a starting point?</summary>

          <div class="story-examples">
            ${[
              'An intimate evening with time to talk and memorable food.',
              'A lively celebration with music, dancing and time together.',
              'An outdoor setting with shade and comfortable seating.',
              'A celebration that feels personal to both families.',
            ].map((example) => html`<button class="story-example" type="button" data-story-example="${example}">${example}</button>`)}
          </div>
        </details>`)}

      ${step(4, html`
        <label class="field">
          <span class="field-label">Any traditions or family practices to include?</span>
          <textarea name="traditionsNote" rows="5" aria-describedby="trad-hint" placeholder="Share anything you’d like us to include.">${f.traditionsNote}</textarea>
          <span class="field-hint" id="trad-hint">Ceremonies, language, food, music or attire — or leave it open.</span>
        </label>
        <div class="story-checks">
          <label class="check"><input type="checkbox" name="traditionsDeciding" ${f.traditionsDeciding ? 'checked' : ''}><span>We’re still deciding</span></label>
          <label class="check"><input type="checkbox" name="traditionsDiscuss" ${f.traditionsDiscuss ? 'checked' : ''}><span>Talk this through with our planner</span></label>
        </div>`)}

      <div class="story-foot">
        <button class="btn btn-ghost" type="button" data-step-nav="-1" ${S.step === 0 ? 'hidden' : ''}>Back</button>
        <span class="story-count" aria-live="polite">Step ${S.step + 1} of ${STEPS.length}</span>
        ${S.step < STEPS.length - 1
          ? html`<button class="btn" type="button" data-step-nav="1">Continue</button>`
          : html`<button class="btn" type="submit">${has('enquiry') ? 'Save changes' : 'Share your story'}</button>`}
      </div>
      <p class="story-note">Preview · answers stay in this tab.</p>
    </form>`);
}

function viewConsultation() {
  const c = S.data.consultation;
  const booked = has('consultBooked') ? (c.booked || c.slots[0]) : null;
  let body;
  if (has('consultHeld')) {
    body = html`<div class="paper-section"><div class="card-head"><h2 class="card-title">Your consultation</h2>${pill('Held')}</div>
      <p>${fmtDay(c.heldSlot.date)} · ${c.heldSlot.time} · ${c.heldSlot.mode}</p>

      ${has('requirements') ? html`<a class="link" href="#plan">Read your plan summary →</a>` : ''}</div>`;
  } else if (booked) {
    body = html`<div class="paper-section"><div class="card-head"><h2 class="card-title">Your appointment</h2>${pill('Requested', 'Requested')}</div>
      <dl class="kv"><div><dt>Date</dt><dd>${fmtDay(booked.date)} · ${booked.time}</dd></div><div><dt>Format</dt><dd>${booked.mode}</dd></div><div><dt>With</dt><dd>${planner()}, your planner</dd></div></dl>
      <div class="placeholder-row"><div><p class="placeholder-title">Meeting link</p><p class="muted small">Meeting link coming later.</p></div>
      <button class="btn btn-ghost" type="button" data-action="join" aria-disabled="true">Join</button></div>
      <div class="row-end"><button class="btn btn-ghost btn-small" type="button" data-action="rebook">Change time</button></div></div>`;
  } else {
    body = html`<div class="paper-section">
      <h2 class="card-title">Pick a time</h2>
      <p class="muted">About an hour · online or in studio.</p>
      <ul class="slots">${c.slots.map((s, i) => html`
        <li><button class="slot" type="button" data-action="book" data-index="${i}"><strong>${fmtDay(s.date)}</strong><span>${s.time}</span><small>${s.mode}</small></button></li>`)}</ul>
    </div>`;
  }
  return chapterShell('consultation', { title: 'Meeting your planner', lede: '' }, body);
}

function viewPlan() {
  if (!has('requirements')) {
    return chapterShell('plan', { title: 'Your plan, in writing' }, html`<div class="paper-section">${emptyState({ icon: 'doc', title: `${firstName()} is preparing this`, body: 'Drafting after your consultation.' })}</div>`);
  }
  return chapterShell('plan', { title: 'Your plan, in writing', lede: 'Your consultation, in one plan.' },
    renderRequirementsDoc({ ...S.data.requirementsSummary, status: 'Approved', version: null }, { audience: 'couple' }));
}

const viewAgreement = () => chapterShell('agreement', { title: 'Our agreement', lede: 'Review service and payment terms.' }, html`
  ${renderAgreement(agreementView(), { audience: 'couple' })}
  <p class="paper-link"><a class="link" href="#payments">See your payment schedule →</a></p>`);

function viewVendors() {
  const cats = S.data.shortlist.map((c) => c.category);
  const category = S.vendorCategory || cats[0];
  const group = S.data.shortlist.find((c) => c.category === category);
  const selected = has('vendors') ? S.data.selectedVendors[category] : S.choices[category] || null;
  return chapterShell('vendors', {
    title: 'Choosing your vendors',
    lede: has('vendors') ? 'Your vendors are confirmed.' : `${firstName()} has shortlisted these for you. Compare and choose your favourite.`,
  }, html`${renderComparison({ category, options: group.options, audience: 'couple', selected, categories: cats })}
    <p class="muted small center">Invitations: handled by your stationery vendor.</p>`);
}

const viewPayments = () => chapterShell('payments', { title: 'Your payments', lede: '' }, renderPaymentTimeline(paymentsView(), { audience: 'couple' }));

function viewEvents() {
  const vendors = Object.entries(S.data.selectedVendors);
  return chapterShell('events', { title: 'Bringing it together', lede: '' }, html`
    <div class="paper-section">

      <ul class="confirmed">${vendors.map(([cat, v]) => html`<li><span class="muted">${cat}</span><strong>${v}</strong></li>`)}</ul>
    </div>
    <div class="paper-section">${renderCoupleEvents(S.data.events, { dayOf: [], final: has('schedule') })}</div>`);
}

function viewDay() {
  return chapterShell('day', { title: 'The wedding day', lede: '' }, html`
    ${renderCoupleEvents(S.data.events, { dayOf: S.data.dayOf, final: true })}
    <details class="paper-more">
      <summary>Before the day</summary>
      <ul class="bullets"><li>Choose a family contact</li><li>Final outfit fittings · one week before</li><li>Vendor arrivals confirmed the evening before</li></ul>
    </details>`);
}

const VIEWS = { home: viewHome, details: viewDetails, consultation: viewConsultation, plan: viewPlan, vendors: viewVendors, agreement: viewAgreement, payments: viewPayments, events: viewEvents, day: viewDay };

function render({ focus = false } = {}) {
  if (!VIEWS[S.view] || !canOpen(S.view)) S.view = 'home';
  const mode = S.view === 'home' ? 'home' : 'chapter';
  if (document.body.dataset.view !== mode) window.dispatchEvent(new CustomEvent('rk:garden-mode', { detail: { mode } }));
  document.body.dataset.view = mode;
  renderBar();
  mount(root, VIEWS[S.view]());
  if (dialog.open) renderJourney();
  if (focus) root.querySelector('h1')?.focus({ preventScroll: true });
}

// ---------- state ----------
let devbar;
function setState(state, { fromDev = false } = {}) {
  S.state = state;
  publishProgress(progressOf(state));
  const idx = stageIndexOf(state);
  if (!fromDev) devbar?.setStage(idx);
  if (S.dev) writeStageToUrl(idx);
  render();
}
function complete(key) {
  const done = new Set(S.state.done); done.add(key);
  setState({ ...S.state, done });
}

function readForm(form) {
  const fd = new FormData(form);
  Object.assign(S.data.profile, {
    names: fd.get('names') ?? S.data.profile.names,
    dateMode: fd.get('dateMode') || 'undecided',
    date: fd.get('date') || '', month: fd.get('month') || '',
    location: fd.get('location') || '',
    guests: +fd.get('guests'),
    eventsCount: fd.get('eventsCount') || '',
    budget: fd.get('budget') || '',
    whatMatters: fd.get('whatMatters') || '',
    traditionsNote: fd.get('traditionsNote') || '',
    traditionsDeciding: fd.get('traditionsDeciding') === 'on',
    traditionsDiscuss: fd.get('traditionsDiscuss') === 'on',
  });
}

function goStep(form, i) {
  readForm(form);
  S.step = Math.max(0, Math.min(STEPS.length - 1, i));
  render();
  root.querySelector(`[data-step="${S.step}"] .story-legend`)?.focus();
}

// ---------- events ----------
on(root, 'submit', 'form[data-form="details"]', (e, form) => {
  e.preventDefault();
  readForm(form);
  S.step = 0;
  const first = !has('enquiry');
  S.editing = false;
  previewNotice('Your story is kept in this browser tab only. It has not been sent to a planner.');
  if (first) { complete('enquiry'); location.hash = 'home'; } else render({ focus: true });
});
on(root, 'click', '[data-step-nav]', (e, t) => goStep(t.closest('form'), S.step + +t.dataset.stepNav));
on(root, 'click', '[data-goto-step]', (e, t) => goStep(t.closest('form'), +t.dataset.gotoStep));
on(root, 'click', '[data-story-example]', (e, t) => {
  const field = t.closest('form')?.querySelector('textarea[name="whatMatters"]');
  if (!field) return;
  field.value = t.dataset.storyExample;
  field.focus();
  field.setSelectionRange(field.value.length, field.value.length);
});
on(root, 'keydown', 'form[data-form="details"] input:not([type=checkbox]):not([type=radio])', (e, t) => {
  if (e.key === 'Enter' && S.step < STEPS.length - 1) { e.preventDefault(); goStep(t.form, S.step + 1); }
});
on(root, 'input', 'input[name="guests"]', (e, input) => { document.getElementById('guest-out').textContent = input.value; });
on(root, 'change', 'input[name="dateMode"]', (e, input) => {
  root.querySelectorAll('[data-date]').forEach((el) => { el.hidden = el.dataset.date !== input.value; });
});

document.getElementById('journey-open').addEventListener('click', openJourney);
on(dialog, 'click', '[data-close-journey]', () => dialog.close());
dialog.addEventListener('click', (e) => { if (e.target === dialog) dialog.close(); });
on(dialog, 'click', 'a[href^="#"]', () => dialog.close());

on(root, 'click', '[data-action]', (e, t) => {
  const a = t.dataset.action;
  if (a === 'book') {
    S.data.consultation.booked = S.data.consultation.slots[+t.dataset.index];
    previewNotice('Preview only · no appointment created.');
    complete('consultBooked');
  } else if (a === 'rebook') {
    S.data.consultation.booked = null;
    const done = new Set(S.state.done); done.delete('consultBooked');
    setState({ ...S.state, done });
  } else if (a === 'edit-story') { S.editing = true; S.step = 0; render({ focus: true }); }
  else if (a === 'join') previewNotice('Meeting link coming later.');
  else if (a === 'agreement-sign') previewNotice('Preview only · nothing signed.');
  else if (a === 'pay') previewNotice('Preview only · no payment taken.');
  else if (a === 'category') { S.vendorCategory = t.dataset.category; render(); }
  else if (a === 'choose') {
    if (has('vendors')) { previewNotice('Your vendors are confirmed.'); return; }
    const cat = S.vendorCategory || S.data.shortlist[0].category;
    const opt = S.data.shortlist.find((c) => c.category === cat).options[+t.dataset.index];
    S.choices[cat] = opt.vendor;
    previewNotice(`${opt.vendor} saved as your favourite in this preview.`);
    render();
  }
});

window.addEventListener('hashchange', () => {
  S.view = location.hash.slice(1) || 'home';
  S.editing = false;
  render({ focus: true });
  window.scrollTo({ top: 0 });
});

// ---------- boot ----------
(async function boot() {
  S.data = await loadCoupleWorkspace();
  S.dev = isDevMode();
  S.state = stageState(stageFromUrl() ?? 0);
  S.view = location.hash.slice(1) || 'home';
  devbar = initDevbar({ stage: stageIndexOf(S.state), onStage: (i) => setState(stageState(i), { fromDev: true }) });
  document.body.dataset.view = '';
  mountGarden(document.getElementById('garden-canvas'), { progress: progressOf(S.state) });
  render();
})();
