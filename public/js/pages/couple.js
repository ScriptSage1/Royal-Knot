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
  { id: 'details', milestones: ['enquiry'], title: 'Your story', blurb: 'A little about the celebration you imagine.' },
  { id: 'consultation', milestones: ['consultBooked', 'consultHeld'], title: 'Meeting your planner', blurb: 'A relaxed first conversation.' },
  { id: 'plan', milestones: ['requirements'], title: 'Your plan, in writing', blurb: 'Your conversation, written up for you to approve.' },
  { id: 'agreement', milestones: ['agreement'], title: 'Our agreement', blurb: 'The service agreement and your payment schedule.' },
  { id: 'vendors', milestones: ['vendors'], title: 'Choosing your vendors', blurb: 'Shortlisted caterers, designers and artists to compare.' },
  { id: 'events', milestones: ['tasks', 'schedule', 'complete'], title: 'Bringing it together', blurb: 'Every event, every timing, confirmed.' },
  { id: 'day', milestones: ['wedding-day'], title: 'The wedding day', blurb: 'Your day-of schedule and the people looking after you.' },
  { id: 'closeout', milestones: ['closeout'], title: 'After the celebration', blurb: 'Final payment, thank-yous and your memories.' },
];

const BUDGETS = ['Under ₹25 L', '₹25 – 50 L', '₹50 L – 1 Cr', '₹1 – 3 Cr', 'Above ₹3 Cr', 'Not sure yet'];
const PREFERENCES = ['Intimate', 'Grand & lively', 'Outdoors', 'Heritage venue', 'Destination', 'Close to home', 'Relaxed', 'Formal', 'Sustainable choices', 'Music & dancing', 'Food-focused', 'Comfortable for elders'];

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
      lede: 'Tell us a little about the celebration you imagine — as much or as little as you like. Nothing is fixed yet.',
      planner: 'A dedicated planner will be matched to you as soon as you share your story.',
      cta: 'Begin your story', href: '#details',
      more: ['Five short, optional questions', 'Approximate answers are perfect', 'You can change anything later'],
    },
    consultation: has('consultBooked')
      ? {
        title: 'We’re looking forward to meeting you',
        lede: `Your first conversation is on ${fmtDay(booked.date)} at ${booked.time}. There’s nothing to prepare — just bring your ideas.`,
        planner: `${P} has read your story and is preparing a few ideas for you.`,
        cta: 'View your appointment', href: '#consultation',
        more: ['About an hour, online or at our studio', 'Bring anyone you’d like to include', 'Your planner keeps private notes so nothing is lost'],
      }
      : {
        title: 'A first conversation',
        lede: 'Choose a time to meet your planner. Bring your ideas, your questions, and anyone you’d like to include.',
        planner: `${P} has read your story and will lead the conversation.`,
        cta: 'Choose a time', href: '#consultation',
        more: ['About an hour, online or at our studio', 'Pick whichever slot suits you', 'You can change the time later'],
      },
    plan: {
      title: 'Your plan is taking shape',
      lede: 'Everything you talked about is being written into a plan summary for you to read and approve.',
      planner: `${P} is writing up your consultation, so nothing gets lost.`,
      cta: 'See what’s being prepared', href: '#plan',
      more: ['Your celebration, style, food and accessibility needs', 'Traditions only as you described them', 'Nothing is booked until you approve'],
    },
    agreement: {
      title: 'A promise, in writing',
      lede: 'Your service agreement is ready to read. It sets out how we’ll look after every detail, and when each payment falls.',
      planner: `${P} is happy to walk you through any clause.`,
      cta: 'Read the agreement', href: '#agreement',
      more: ['Digital signing arrives in a later version of this preview', 'Your payment schedule is attached', 'A copy stays here once signed'],
    },
    vendors: {
      title: 'The people who will bring it to life',
      lede: 'Your planner has shortlisted caterers and designers. Compare them side by side and choose your favourites.',
      planner: `${P} has worked with every vendor on your shortlist and will join tastings.`,
      cta: 'Compare your options', href: '#vendors',
      more: ['Prices, inclusions and extras shown side by side', 'Invitation design is handled by your stationery vendor', 'Your choice is confirmed with your planner'],
    },
    events: {
      title: 'Every moment, finding its place',
      lede: 'Vendors are confirmed and your events are being scheduled, day by day.',
      planner: `${P} is coordinating every vendor, timing and arrival.`,
      cta: 'See your events', href: '#events',
      more: ['A draft schedule you can follow as it firms up', 'Final timings are shared before the day', 'Your planner handles vendor arrivals'],
    },
    day: {
      title: 'Everything is ready',
      lede: 'Your plan is complete. Every vendor, every moment and every detail is in place. All that’s left is to celebrate — together.',
      planner: `${P} will be with you on the day, from the first arrival to the last goodbye.`,
      cta: 'Your wedding day', href: '#day',
      more: ['Your final schedule, by day and by event', 'Who to call for anything, at any time', 'Your closing chapter opens after the celebration'],
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
        const note = c.status === 'done' ? 'Complete · revisit' : c.status === 'current' ? 'You are here' : c.id === 'closeout' ? 'Opens after the wedding' : `Opens after “${chs[i - 1].title}”`;
        const inner = html`
          <span class="cx-ch-num" aria-hidden="true">${c.status === 'done' ? '✓' : c.n}</span>
          <span class="cx-ch-text"><span class="cx-ch-title">${c.title}</span><span class="cx-ch-blurb">${c.blurb}</span><span class="cx-ch-note">${note}</span></span>`;
        return html`<li class="cx-ch is-${c.status}">${c.status === 'upcoming'
          ? html`<div class="cx-ch-row">${inner}</div>`
          : html`<a class="cx-ch-row" href="${href}" ${S.view === c.id ? 'aria-current=page' : ''}>${inner}</a>`}</li>`;
      })}
    </ol>
    <h3 class="cx-journey-sub">Always here</h3>
    <ul class="cx-alongside">
      <li><a href="#details"><strong>What you’ve shared</strong><span>Review or update your story</span></a></li>
      <li>${pay ? html`<a href="#payments"><strong>Payments</strong><span>${duePayment() ? 'A milestone is due' : 'Your milestone schedule'}</span></a>` : html`<div><strong>Payments</strong><span>Your schedule appears with the agreement</span></div>`}</li>
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
    <p class="cx-foot">Preview build · anything you enter stays in this browser tab and is not sent to anyone.</p>`;
}

function chapterShell(id, { eyebrow, title, lede }, body) {
  const i = CHAPTERS.findIndex((x) => x.id === id);
  return html`
    <article class="chapter" aria-labelledby="chapter-title">
      <a class="chapter-back" href="#home"><span aria-hidden="true">←</span> Back to now</a>
      <header class="chapter-head">
        <p class="moment-eyebrow">${eyebrow || (i >= 0 ? `Chapter ${i + 1} · ${CHAPTERS[i].title}` : '')}</p>
        <h1 class="chapter-title" id="chapter-title" tabindex="-1">${title}</h1>
        ${lede ? html`<p class="chapter-lede">${lede}</p>` : ''}
      </header>
      <div class="paper">${body}</div>
    </article>`;
}

// Chapter 1 — guided, one question at a time; a summary once shared.
const STEPS = ['About you', 'When & where', 'Size & budget', 'What matters', 'Traditions & family'];
function whenText(f) {
  if (f.dateMode === 'exact' && f.date) return fmtDate(f.date);
  if (f.dateMode === 'month' && f.month) return new Date(f.month + '-01T00:00:00').toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
  return 'Still deciding';
}
function viewDetails() {
  const f = S.data.profile;
  if (has('enquiry') && !S.editing) {
    const trad = f.traditionsNote || (f.traditionsDeciding ? 'Still deciding' : f.traditionsDiscuss ? 'Would rather talk it through with the planner' : 'Nothing shared');
    return chapterShell('details', { title: 'Your story so far', lede: 'What you’ve shared with us. Update it any time — your planner sees the latest version.' }, html`
      <dl class="story-summary">
        <div><dt>How we address you</dt><dd>${f.names || 'Not shared'}</dd></div>
        <div><dt>When</dt><dd>${whenText(f)}</dd></div>
        <div><dt>Where</dt><dd>${f.location || 'Still deciding'}</dd></div>
        <div><dt>Guests</dt><dd>About ${f.guests}${f.eventsCount ? ` · ${f.eventsCount} events or days` : ''}</dd></div>
        <div><dt>Budget</dt><dd>${f.budget || 'To discuss'}</dd></div>
        <div><dt>What matters</dt><dd>${f.preferences.length ? f.preferences.join(', ') : 'Not shared'}</dd></div>
        <div class="wide"><dt>Traditions, customs & family practices</dt><dd>${trad}</dd></div>
      </dl>
      <div class="row-end"><button class="btn" type="button" data-action="edit-story">Update your story</button></div>`);
  }
  const chip = (name, value, checked, type = 'checkbox') => html`
    <label class="chip"><input type="${type}" name="${name}" value="${value}" ${checked ? 'checked' : ''}><span>${value}</span></label>`;
  const step = (i, body) => html`<fieldset class="story-step" data-step="${i}" ${S.step === i ? '' : 'hidden'}><legend class="story-legend" tabindex="-1">${STEPS[i]}</legend>${body}</fieldset>`;
  return chapterShell('details', {
    title: 'Tell us about the celebration you imagine',
    lede: 'Every question is optional. Approximate answers are perfect — your planner will go through everything with you.',
  }, html`
    <form class="story" data-form="details" novalidate>
      <ol class="story-progress">
        ${STEPS.map((s, i) => html`<li class="${i < S.step ? 'is-done' : i === S.step ? 'is-current' : ''}"><button type="button" data-goto-step="${i}" ${i === S.step ? 'aria-current=step' : ''}><span class="sr-only">Step ${i + 1}: </span>${s}</button></li>`)}
      </ol>

      ${step(0, html`
        <label class="field">
          <span class="field-label">How would you like us to address you?</span>
          <input name="names" value="${f.names}" placeholder="e.g. Asha & Kiran — or however you prefer" autocomplete="off">
          <span class="field-hint">Use any names you like, for as many people as are planning together.</span>
        </label>`)}

      ${step(1, html`
        <div class="field">
          <span class="field-label" id="date-l">Do you have a date in mind?</span>
          <div class="seg" role="radiogroup" aria-labelledby="date-l">
            ${[['exact', 'A specific date'], ['month', 'A rough month'], ['undecided', 'Still deciding']].map(([v, l]) => html`
              <label class="seg-opt"><input type="radio" name="dateMode" value="${v}" ${f.dateMode === v ? 'checked' : ''}><span>${l}</span></label>`)}
          </div>
        </div>
        <label class="field field-narrow" data-date="exact" ${f.dateMode !== 'exact' ? 'hidden' : ''}><span class="field-label">Date</span><input type="date" name="date" value="${f.date}"></label>
        <label class="field field-narrow" data-date="month" ${f.dateMode !== 'month' ? 'hidden' : ''}><span class="field-label">Approximate month</span><input type="month" name="month" value="${f.month}"></label>
        <label class="field">
          <span class="field-label">Where would you like to celebrate?</span>
          <input name="location" value="${f.location}" list="loc-ideas" placeholder="A city, a region, or “open to ideas”">
          <datalist id="loc-ideas"><option value="Close to home"><option value="A destination — open to ideas"><option value="Still deciding"></datalist>
        </label>`)}

      ${step(2, html`
        <label class="field">
          <span class="field-label">Roughly how many guests? <output id="guest-out">${f.guests}</output></span>
          <input type="range" name="guests" min="20" max="1500" step="10" value="${f.guests}" aria-describedby="guest-hint">
          <span class="field-hint" id="guest-hint">A best guess is fine — it usually changes.</span>
        </label>
        <label class="field field-narrow">
          <span class="field-label">How many events or days are you imagining?</span>
          <input type="number" min="1" max="20" name="eventsCount" value="${f.eventsCount}" placeholder="e.g. 3">
        </label>
        <div class="field">
          <span class="field-label" id="budget-l">A budget range that feels comfortable</span>
          <div class="chips" role="radiogroup" aria-labelledby="budget-l">${BUDGETS.map((b) => chip('budget', b, f.budget === b, 'radio'))}</div>
        </div>`)}

      ${step(3, html`
        <div class="field">
          <span class="field-label" id="pref-l">What matters most to you? <span class="optional">Choose any</span></span>
          <div class="chips" role="group" aria-labelledby="pref-l">${PREFERENCES.map((p) => chip('preferences', p, f.preferences.includes(p)))}</div>
        </div>`)}

      ${step(4, html`
        <label class="field">
          <span class="field-label">Are there any traditions, customs, or family practices you’d like us to make room for?</span>
          <textarea name="traditionsNote" rows="5" aria-describedby="trad-hint" placeholder="Share as much or as little as you like.">${f.traditionsNote}</textarea>
          <span class="field-hint" id="trad-hint">You might mention family customs, ceremonies, languages, food, music or attire. Many celebrations bring together more than one tradition — or none at all. Whatever yours looks like is welcome.</span>
        </label>
        <div class="story-checks">
          <label class="check"><input type="checkbox" name="traditionsDeciding" ${f.traditionsDeciding ? 'checked' : ''}><span>We’re still deciding</span></label>
          <label class="check"><input type="checkbox" name="traditionsDiscuss" ${f.traditionsDiscuss ? 'checked' : ''}><span>We’d rather talk this through with our planner</span></label>
        </div>`)}

      <div class="story-foot">
        <button class="btn btn-ghost" type="button" data-step-nav="-1" ${S.step === 0 ? 'hidden' : ''}>Back</button>
        <span class="story-count" aria-live="polite">Step ${S.step + 1} of ${STEPS.length}</span>
        ${S.step < STEPS.length - 1
          ? html`<button class="btn" type="button" data-step-nav="1">Continue</button>`
          : html`<button class="btn" type="submit">${has('enquiry') ? 'Save changes' : 'Share your story'}</button>`}
      </div>
      <p class="story-note">Preview build: your answers stay in this browser tab and are not sent to anyone.</p>
    </form>`);
}

function viewConsultation() {
  const c = S.data.consultation;
  const booked = has('consultBooked') ? (c.booked || c.slots[0]) : null;
  let body;
  if (has('consultHeld')) {
    body = html`<div class="paper-section"><div class="card-head"><h2 class="card-title">Your consultation</h2>${pill('Held')}</div>
      <p>${fmtDay(c.heldSlot.date)} · ${c.heldSlot.time} · ${c.heldSlot.mode}</p>
      <p class="muted">Thank you for meeting with us. Your conversation became your plan summary.</p>
      ${has('requirements') ? html`<a class="link" href="#plan">Read your plan summary →</a>` : ''}</div>`;
  } else if (booked) {
    body = html`<div class="paper-section"><div class="card-head"><h2 class="card-title">Your appointment</h2>${pill('Requested', 'Requested · preview')}</div>
      <dl class="kv"><div><dt>When</dt><dd>${fmtDay(booked.date)} · ${booked.time}</dd></div><div><dt>Format</dt><dd>${booked.mode}</dd></div><div><dt>With</dt><dd>${planner()}, your planner</dd></div></dl>
      <div class="placeholder-row"><div><p class="placeholder-title">Meeting link</p><p class="muted small">A video link will appear here once meetings are connected.</p></div>
      <button class="btn btn-ghost" type="button" data-action="join" aria-disabled="true">Join</button></div>
      <div class="row-end"><button class="btn btn-ghost btn-small" type="button" data-action="rebook">Choose a different time</button></div></div>`;
  } else {
    body = html`<div class="paper-section">
      <h2 class="card-title">Choose a time that suits you</h2>
      <p class="muted">About an hour, online or at our studio. Bring as many people as you like.</p>
      <ul class="slots">${c.slots.map((s, i) => html`
        <li><button class="slot" type="button" data-action="book" data-index="${i}"><strong>${fmtDay(s.date)}</strong><span>${s.time}</span><small>${s.mode}</small></button></li>`)}</ul>
    </div>`;
  }
  return chapterShell('consultation', { title: 'Meeting your planner', lede: 'A relaxed conversation about what you have in mind. There’s nothing to prepare.' }, body);
}

function viewPlan() {
  if (!has('requirements')) {
    return chapterShell('plan', { title: 'Your plan, in writing' }, html`<div class="paper-section">${emptyState({ icon: 'doc', title: `${firstName()} is preparing this`, body: 'Your planner writes up everything you discussed. You’ll be able to read and approve it here.' })}</div>`);
  }
  return chapterShell('plan', { title: 'Your plan, in writing', lede: 'What we heard from you, in one place. Your approved summary guides every vendor we approach.' },
    renderRequirementsDoc({ ...S.data.requirementsSummary, status: 'Approved', version: null }, { audience: 'couple' }));
}

const viewAgreement = () => chapterShell('agreement', { title: 'Our agreement', lede: 'How we’ll look after your celebration, and when each payment falls.' }, html`
  ${renderAgreement(agreementView(), { audience: 'couple' })}
  <p class="paper-link"><a class="link" href="#payments">See your payment schedule →</a></p>`);

function viewVendors() {
  const cats = S.data.shortlist.map((c) => c.category);
  const category = S.vendorCategory || cats[0];
  const group = S.data.shortlist.find((c) => c.category === category);
  const selected = has('vendors') ? S.data.selectedVendors[category] : S.choices[category] || null;
  return chapterShell('vendors', {
    title: 'Choosing your vendors',
    lede: has('vendors') ? 'Your vendors are confirmed. Here’s who will bring your celebration to life.' : `${firstName()} has shortlisted these for you. Compare them side by side and tell us your favourite.`,
  }, html`${renderComparison({ category, options: group.options, audience: 'couple', selected, categories: cats })}
    <p class="muted small center">Invitation design is handled by your chosen stationery vendor.</p>`);
}

const viewPayments = () => chapterShell('payments', { eyebrow: 'Always here', title: 'Your payments', lede: 'Payments are spread across milestones — a booking payment, an advance before the wedding, and a final payment after the celebration.' }, renderPaymentTimeline(paymentsView(), { audience: 'couple' }));

function viewEvents() {
  const vendors = Object.entries(S.data.selectedVendors);
  return chapterShell('events', { title: 'Bringing it together', lede: 'Every function across every day. Timings firm up as your planner confirms each vendor.' }, html`
    <div class="paper-section">
      <p class="eyebrow">Confirmed so far</p>
      <ul class="confirmed">${vendors.map(([cat, v]) => html`<li><span class="muted">${cat}</span><strong>${v}</strong></li>`)}</ul>
    </div>
    <div class="paper-section">${renderCoupleEvents(S.data.events, { dayOf: [], final: has('schedule') })}</div>`);
}

function viewDay() {
  return chapterShell('day', { title: 'The wedding day', lede: 'Your final schedule and the people looking after you. Rest — we have everything in hand.' }, html`
    ${renderCoupleEvents(S.data.events, { dayOf: S.data.dayOf, final: true })}
    <details class="paper-more">
      <summary>Before the day</summary>
      <ul class="bullets"><li>Choose one family point of contact and share them with your planner</li><li>Final outfit fittings at least a week before</li><li>Your planner confirms every vendor arrival the evening before</li></ul>
    </details>`);
}

const VIEWS = { home: viewHome, details: viewDetails, consultation: viewConsultation, plan: viewPlan, agreement: viewAgreement, vendors: viewVendors, payments: viewPayments, events: viewEvents, day: viewDay };

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
    preferences: fd.getAll('preferences'),
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
    previewNotice('Time requested in this preview only — no appointment was created and no one was notified.');
    complete('consultBooked');
  } else if (a === 'rebook') {
    S.data.consultation.booked = null;
    const done = new Set(S.state.done); done.delete('consultBooked');
    setState({ ...S.state, done });
  } else if (a === 'edit-story') { S.editing = true; S.step = 0; render({ focus: true }); }
  else if (a === 'join') previewNotice('Video meetings are not connected yet.');
  else if (a === 'agreement-sign') previewNotice('Digital signing is not connected yet. Nothing was signed.');
  else if (a === 'pay') previewNotice('Online payments are not connected yet. No payment was taken.');
  else if (a === 'category') { S.vendorCategory = t.dataset.category; render(); }
  else if (a === 'choose') {
    if (has('vendors')) { previewNotice('Your vendors are already confirmed with your planner.'); return; }
    const cat = S.vendorCategory || S.data.shortlist[0].category;
    const opt = S.data.shortlist.find((c) => c.category === cat).options[+t.dataset.index];
    S.choices[cat] = opt.vendor;
    previewNotice(`${opt.vendor} marked as your favourite in this preview. Your planner has not been notified.`);
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
