// Couple portal — a guided journey told in chapters, with the Shared Garden as
// the stage. Renders from the couple-safe mock projection only; nothing is
// saved or sent. Planning state comes from the mock stage (or `?stage=N`) and
// from the couple's own preview actions.
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

// The story, in chapters. Each chapter completes when its milestones are done.
// Add a chapter here (and a view below) to extend the journey.
const CHAPTERS = [
  { id: 'details', milestones: ['enquiry'], title: 'Your story', blurb: 'Share a little about the celebration you imagine.' },
  { id: 'consultation', milestones: ['consultBooked', 'consultHeld'], title: 'Meeting your planner', blurb: 'A relaxed first conversation, online or in person.' },
  { id: 'plan', milestones: ['requirements'], title: 'Your plan, in writing', blurb: 'Your conversation becomes a plan summary for you to approve.' },
  { id: 'agreement', milestones: ['agreement'], title: 'Our agreement', blurb: 'Read and sign the service agreement.' },
  { id: 'vendors', milestones: ['vendors'], title: 'Choosing your vendors', blurb: 'Compare the caterers, designers and artists we shortlist for you.' },
  { id: 'events', milestones: ['tasks', 'schedule'], title: 'Bringing it together', blurb: 'Your events, your schedule, and who looks after each moment.' },
  { id: 'celebration', milestones: ['complete'], title: 'The celebration', blurb: 'Everything in place, and your loved ones gathered.' },
];
// Always-available places that sit alongside the story.
const ALONGSIDE = [
  { id: 'details', title: 'Your details', note: 'Update anything you’ve shared' },
  { id: 'payments', title: 'Payments', note: 'Your milestone schedule', opensAfter: 'requirements' },
];

const BUDGETS = ['Under ₹25 L', '₹25 – 50 L', '₹50 L – 1 Cr', '₹1 – 3 Cr', 'Above ₹3 Cr', 'Not sure yet'];
const PREFERENCES = ['Intimate', 'Large & lively', 'Outdoors', 'Indoors', 'Destination', 'Close to home', 'Relaxed', 'Formal', 'Eco-conscious', 'Music & dancing', 'Food-focused', 'Comfortable for elders'];

const S = { data: null, state: null, view: 'home', vendorCategory: null, choices: {}, step: 0, dev: false };
const root = document.getElementById('cp-view');
const dialog = document.getElementById('journey');
const has = (k) => S.state.done.has(k);
const planner = () => S.data.planner.name;

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
const currentChapter = () => { const chs = chapterStates(); return chs.find((c) => c.status === 'current') || chs.at(-1); };

function canOpen(id) {
  if (id === 'home' || id === 'details') return true;
  if (id === 'payments') return has('requirements');
  const c = chapterStates().find((x) => x.id === id);
  return !!c && c.status !== 'upcoming';
}

// What the couple sees as "now": one moment, one action.
function moment() {
  const c = currentChapter();
  const booked = S.data.consultation.booked || S.data.consultation.slots[0];
  if (c.status === 'done') {
    return { chapter: c, title: 'Everything is ready', lede: 'Your plan is complete. Every vendor, every moment and every detail is in place. All that’s left is to celebrate — together.', cta: 'See your events', href: '#events' };
  }
  const m = {
    details: { title: 'Let’s begin with you', lede: 'Tell us a little about the celebration you imagine — as much or as little as you like. Nothing is fixed yet, and everything can change.', cta: 'Begin your story', href: '#details' },
    consultation: has('consultBooked')
      ? { title: 'We’re looking forward to meeting you', lede: `Your first conversation with ${planner()} is on ${fmtDay(booked.date)} at ${booked.time}. There’s nothing to prepare — just bring your ideas.`, cta: 'View your appointment', href: '#consultation' }
      : { title: 'A first conversation', lede: `Choose a time to meet ${planner()}, your planner. Bring your ideas, your questions, and anyone you’d like to include.`, cta: 'Choose a time', href: '#consultation' },
    plan: { title: 'Your plan is taking shape', lede: `${planner()} is writing up everything you talked about. You’ll be invited to read it and approve it here.`, cta: 'See what’s being prepared', href: '#plan' },
    agreement: { title: 'A promise, in writing', lede: 'Your service agreement is ready. It sets out how we’ll look after every detail, and when each payment falls.', cta: 'Read the agreement', href: '#agreement' },
    vendors: { title: 'The people who will bring it to life', lede: `${planner()} has shortlisted caterers and designers for you. Compare them side by side and choose your favourites.`, cta: 'Compare your options', href: '#vendors' },
    events: { title: 'Every moment, finding its place', lede: 'Your planner and vendors are working through the details. Your events and schedule are coming together, day by day.', cta: 'See your events', href: '#events' },
    celebration: { title: 'Almost there', lede: 'A final walk-through with your planner, and your plan is complete.', cta: 'See your events', href: '#events' },
  }[c.id];
  return { chapter: c, ...m };
}

function plannerNote() {
  const c = currentChapter();
  if (!has('enquiry')) return { who: 'The Royal Knot', initials: 'RK', note: 'Once you share your story, a dedicated planner will be matched to you and will be in touch personally.' };
  const note = c.status === 'done'
    ? 'Everything is in place. I’ll be with you on the day, from the first arrival to the last goodbye.'
    : {
      consultation: 'I’ve read everything you shared. I’ll come to our conversation with a few ideas — and plenty of questions.',
      plan: 'I’m writing up our conversation now, so nothing gets lost. You’ll see it all before anything is booked.',
      agreement: 'Take your time with the agreement. If anything is unclear, I’m happy to walk you through it.',
      vendors: 'I’ve worked with every vendor on your shortlist. I’ll be there for tastings and walk-throughs.',
      events: 'I’m coordinating every vendor and every timing, so you don’t have to.',
      celebration: 'We’re nearly there. I’ll be with you on the day, from the first arrival to the last goodbye.',
    }[c.id];
  return { who: planner(), initials: planner()[0], note };
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

// ---------- shell ----------
function renderBar() {
  const c = currentChapter();
  document.getElementById('journey-meta').textContent = c.status === 'done' ? 'Plan complete' : `Chapter ${c.n} of ${CHAPTERS.length}`;
}

function renderJourney() {
  const chs = chapterStates();
  document.getElementById('journey-body').innerHTML = String(html`
    <div class="cx-journey-head">
      <h2 id="journey-title" class="cx-journey-title">Your journey</h2>
      <button class="cx-icon-btn" type="button" data-close-journey aria-label="Close your journey">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>
      </button>
    </div>
    <p class="cx-journey-intro">${CHAPTERS.length} chapters, at your own pace. ${has('enquiry') ? planner() : 'Your planner'} guides you through each one.</p>
    <ol class="cx-chapters">
      ${chs.map((c, i) => {
        const href = c.id === 'celebration' ? '#home' : `#${c.id}`;
        const note = c.status === 'done' ? 'Complete' : c.status === 'current' ? 'You are here' : `Opens after “${chs[i - 1].title}”`;
        const inner = html`
          <span class="cx-ch-num" aria-hidden="true">${c.status === 'done' ? '✓' : c.n}</span>
          <span class="cx-ch-text"><span class="cx-ch-title">${c.title}</span><span class="cx-ch-blurb">${c.blurb}</span><span class="cx-ch-note">${note}</span></span>`;
        return html`<li class="cx-ch is-${c.status}">${c.status === 'upcoming'
          ? html`<div class="cx-ch-row">${inner}</div>`
          : html`<a class="cx-ch-row" href="${href}" ${S.view === c.id ? 'aria-current=page' : ''}>${inner}</a>`}</li>`;
      })}
    </ol>
    <h3 class="cx-journey-sub">Alongside your journey</h3>
    <ul class="cx-alongside">
      ${ALONGSIDE.map((a) => {
        const open = !a.opensAfter || has(a.opensAfter);
        return html`<li>${open
          ? html`<a href="#${a.id}"><strong>${a.title}</strong><span>${a.note}</span></a>`
          : html`<div><strong>${a.title}</strong><span>Shared once your plan is approved</span></div>`}</li>`;
      })}
    </ul>`);
}

function openJourney() {
  renderJourney();
  dialog.showModal();
  (dialog.querySelector('.cx-ch.is-current a') || dialog.querySelector('[data-close-journey]')).focus();
}

// ---------- views ----------
function viewHome() {
  const m = moment();
  const chs = chapterStates();
  const pn = plannerNote();
  const ahead = chs.filter((c) => c.status === 'upcoming').slice(0, 3);
  const f = S.data.profile;
  const names = f.names.trim();
  const shared = has('enquiry');
  const when = f.dateMode === 'exact' && f.date ? fmtDate(f.date)
    : f.dateMode === 'month' && f.month ? new Date(f.month + '-01T00:00:00').toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })
    : 'Still deciding';
  return html`
    <section class="moment" aria-labelledby="moment-title">
      <div class="moment-copy">
        <p class="moment-eyebrow">${m.chapter.status === 'done' ? 'Your plan is complete' : `Chapter ${m.chapter.n} of ${CHAPTERS.length} · ${m.chapter.title}`}</p>
        ${names ? html`<p class="moment-greeting">For ${names}</p>` : ''}
        <h1 class="moment-title" id="moment-title" tabindex="-1">${m.title}</h1>
        <p class="moment-lede">${m.lede}</p>
        <div class="moment-actions">
          <a class="cx-btn" href="${m.href}">${m.cta}</a>
          <button class="cx-link" type="button" data-open-journey>See your whole journey</button>
        </div>
        <ol class="moment-dots" aria-label="${chs.filter((c) => c.status === 'done').length} of ${CHAPTERS.length} chapters complete">
          ${chs.map((c) => html`<li class="is-${c.status}"><span class="sr-only">${c.title}: ${c.status}</span></li>`)}
        </ol>
      </div>
    </section>

    <section class="care" aria-label="Looking after you">
      <div class="care-grid">
        <article class="care-card care-planner">
          <p class="care-eyebrow">In ${pn.who}’s care</p>
          <div class="care-planner-row">
            <span class="care-avatar" aria-hidden="true">${pn.initials}</span>
            <blockquote class="care-note">“${pn.note}”</blockquote>
          </div>
          ${shared ? html`<button class="cx-link cx-link-sm" type="button" data-action="message-planner">Send ${planner()} a note</button>` : ''}
        </article>

        <article class="care-card">
          <p class="care-eyebrow">${ahead.length ? 'Chapters ahead' : 'Your journey'}</p>
          ${ahead.length ? html`
            <ol class="care-ahead">
              ${ahead.map((c) => html`<li><span class="care-ahead-n">${c.n}</span><span><strong>${c.title}</strong><small>${c.blurb}</small></span></li>`)}
            </ol>` : html`<p class="care-muted">Every chapter is complete. Thank you for letting us be part of your story.</p>`}
          <button class="cx-link cx-link-sm" type="button" data-open-journey>All chapters</button>
        </article>

        <article class="care-card">
          <p class="care-eyebrow">What you’ve shared</p>
          ${shared ? html`
            <dl class="care-facts">
              <div><dt>When</dt><dd>${when}</dd></div>
              <div><dt>Where</dt><dd>${f.location || 'Still deciding'}</dd></div>
              <div><dt>Guests</dt><dd>About ${f.guests}</dd></div>
              <div><dt>Budget</dt><dd>${f.budget || 'To discuss'}</dd></div>
            </dl>
            <a class="cx-link cx-link-sm" href="#details">Update your details</a>`
          : html`<p class="care-muted">Nothing yet — and there’s no rush. Your story starts whenever you’re ready.</p><a class="cx-link cx-link-sm" href="#details">Begin your story</a>`}
        </article>
      </div>
      <p class="care-foot">Preview build · anything you enter stays in this browser tab and is not sent to anyone.</p>
    </section>`;
}

function chapterShell(id, { eyebrow, title, lede }, body) {
  const i = CHAPTERS.findIndex((x) => x.id === id);
  return html`
    <article class="chapter" aria-labelledby="chapter-title">
      <a class="chapter-back" href="#home"><span aria-hidden="true">←</span> Back to your journey</a>
      <header class="chapter-head">
        <p class="moment-eyebrow">${eyebrow || (i >= 0 ? `Chapter ${i + 1} · ${CHAPTERS[i].title}` : '')}</p>
        <h1 class="chapter-title" id="chapter-title" tabindex="-1">${title}</h1>
        ${lede ? html`<p class="chapter-lede">${lede}</p>` : ''}
      </header>
      <div class="paper">${body}</div>
    </article>`;
}

// Guided, one-question-at-a-time story form. Every answer is optional.
const STEPS = ['About you', 'When & where', 'Size & budget', 'What matters', 'Traditions & family'];
function viewDetails() {
  const f = S.data.profile;
  const chip = (name, value, checked, type = 'checkbox') => html`
    <label class="chip"><input type="${type}" name="${name}" value="${value}" ${checked ? 'checked' : ''}><span>${value}</span></label>`;
  const step = (i, body) => html`<fieldset class="story-step" data-step="${i}" ${S.step === i ? '' : 'hidden'}><legend class="story-legend" tabindex="-1">${STEPS[i]}</legend>${body}</fieldset>`;
  return chapterShell('details', {
    title: has('enquiry') ? 'Your story so far' : 'Tell us about the celebration you imagine',
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
          : html`<button class="btn" type="submit">${has('enquiry') ? 'Update your story' : 'Share your story'}</button>`}
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
      <p class="muted">Thank you for meeting with us. ${planner()} is turning your conversation into a plan summary.</p></div>`;
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
      ${!has('enquiry') ? html`<p class="muted small">Tip: <a href="#details">sharing your story</a> first helps your planner prepare.</p>` : ''}
    </div>`;
  }
  return chapterShell('consultation', { title: 'Meeting your planner', lede: 'A relaxed conversation about what you have in mind. There’s nothing to prepare.' }, body);
}

function viewPlan() {
  if (!has('requirements')) {
    return chapterShell('plan', { title: 'Your plan, in writing' }, html`<div class="paper-section">${emptyState({ icon: 'doc', title: `${planner()} is preparing this`, body: 'After your consultation, your planner writes up everything you discussed. You’ll be able to read and approve it here.' })}</div>`);
  }
  return chapterShell('plan', { title: 'Your plan, in writing', lede: 'What we heard from you, in one place. Your approved summary guides every vendor we approach.' },
    renderRequirementsDoc({ ...S.data.requirementsSummary, status: 'Approved', version: null }, { audience: 'couple' }));
}

const viewAgreement = () => chapterShell('agreement', { title: 'Our agreement', lede: 'How we’ll look after your celebration, and when each payment falls.' }, renderAgreement(agreementView(), { audience: 'couple' }));

function viewVendors() {
  const cats = S.data.shortlist.map((c) => c.category);
  const category = S.vendorCategory || cats[0];
  const group = S.data.shortlist.find((c) => c.category === category);
  const selected = has('vendors') ? S.data.selectedVendors[category] : S.choices[category] || null;
  return chapterShell('vendors', {
    title: 'Choosing your vendors',
    lede: has('vendors') ? 'Your vendors are confirmed. Here’s who will bring your celebration to life.' : `${planner()} has shortlisted these for you. Compare them side by side and tell us your favourite.`,
  }, html`${renderComparison({ category, options: group.options, audience: 'couple', selected, categories: cats })}
    <p class="muted small center">Invitation design is handled by your chosen stationery vendor.</p>`);
}

const viewPayments = () => chapterShell('payments', { eyebrow: 'Alongside your journey', title: 'Your payments', lede: 'Payments are spread across milestones, so nothing arrives all at once.' }, renderPaymentTimeline(paymentsView(), { audience: 'couple' }));
const viewEvents = () => chapterShell('events', { title: 'Bringing it together', lede: 'Every function across every day, with what you need to know.' }, renderCoupleEvents(S.data.events, { dayOf: S.data.dayOf, final: has('schedule') }));

const VIEWS = { home: viewHome, details: viewDetails, consultation: viewConsultation, plan: viewPlan, agreement: viewAgreement, vendors: viewVendors, payments: viewPayments, events: viewEvents };

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
    names: fd.get('names') || '',
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
  previewNotice('Your story is kept in this browser tab only. It has not been sent to a planner.');
  if (!has('enquiry')) complete('enquiry');
  location.hash = 'home';
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

on(document.body, 'click', '[data-open-journey]', () => openJourney());
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
  } else if (a === 'join') previewNotice('Video meetings are not connected yet.');
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
  } else if (a === 'message-planner') previewNotice('Messaging is a later module. Nothing was sent.');
});

window.addEventListener('hashchange', () => {
  S.view = location.hash.slice(1) || 'home';
  render({ focus: true });
  window.scrollTo({ top: 0 });
});

// Deepen the scrim as the couple scrolls past the opening moment.
const onScroll = () => document.body.style.setProperty('--scroll', Math.min(1, window.scrollY / (window.innerHeight * 0.7)).toFixed(3));
window.addEventListener('scroll', onScroll, { passive: true });

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
  onScroll();
})();
