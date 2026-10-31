// "Your story": a short, progressive intake. Each step saves to the server
// when the couple continues, so nothing is lost on refresh, and every answer
// is optional and editable later. Traditions, budget and vendor help are
// asked openly, never as a required fixed choice.
import { html, whenText } from '../core/ui.js';
import { api, formValues } from '../core/api.js';

const BUDGET_MODES = [
  ['range', 'We have a range in mind'],
  ['no_fixed', 'No fixed budget'],
  ['unsure', 'Not sure yet'],
  ['prefer_not', 'Prefer not to say'],
];
const SOURCING = [
  ['help', 'Help us find vendors', 'Your planner gathers proposals and shortlists the best for you.'],
  ['own', 'We already have some vendors', 'Your planner coordinates the people you’ve chosen and helps fill any gaps.'],
  ['later', 'We’ll decide later', 'Planning carries on; you can choose anytime.'],
  ['not_needed', 'We don’t need vendor sourcing', 'Planning and coordination only.'],
];
export const SOURCING_LABEL = Object.fromEntries(SOURCING.map(([k, l]) => [k, l]));

const STEPS = [
  { id: 'names', label: 'You' },
  { id: 'when', label: 'When & where' },
  { id: 'size', label: 'Guests' },
  { id: 'budget', label: 'Budget' },
  { id: 'feel', label: 'What matters' },
  { id: 'traditions', label: 'Traditions & family' },
  { id: 'vendors', label: 'Vendors' },
];

export const storyState = { step: 0, editing: false };

const budgetText = (w) => ({ range: w.budgetRange || 'A range in mind', no_fixed: 'No fixed budget', unsure: 'Not sure yet', prefer_not: 'Prefer not to say' }[w.budgetMode] || 'Not answered');

function summary(w) {
  const trad = [w.traditionsNote, w.languages && `Languages: ${w.languages}`, w.familyNote].filter(Boolean).join('\n')
    || (w.traditionsDeciding ? 'Still deciding' : w.traditionsDiscuss ? 'We’d like to talk this through' : 'Nothing shared yet');
  return html`
    <dl class="story-summary">
      <div><dt>Names</dt><dd>${w.coupleLabel || 'Not shared'}</dd></div>
      <div><dt>When</dt><dd>${whenText(w)}</dd></div>
      <div><dt>Where</dt><dd>${w.location || 'Still deciding'}</dd></div>
      <div><dt>Guests</dt><dd>${w.guestEstimate ? `About ${w.guestEstimate}` : 'Not shared'}${w.eventsCount ? ` · ${w.eventsCount} events or days` : ''}</dd></div>
      <div><dt>Budget</dt><dd>${budgetText(w)}</dd></div>
      <div><dt>Vendors</dt><dd>${SOURCING_LABEL[w.vendorSourcing] || 'Not decided'}</dd></div>
      <div class="wide"><dt>What matters</dt><dd class="story-answer">${[w.whatMatters, w.priorities].filter(Boolean).join('\n\n') || 'Not shared'}</dd></div>
      <div class="wide"><dt>Traditions & family</dt><dd class="story-answer">${trad}</dd></div>
    </dl>`;
}

const radio = (name, value, label, checked, hint = '') => html`
  <label class="choice"><input type="radio" name="${name}" value="${value}" ${checked ? 'checked' : ''}><span><strong>${label}</strong>${hint ? html`<small>${hint}</small>` : ''}</span></label>`;

function stepBody(id, w) {
  switch (id) {
    case 'names': return html`
      <label class="field"><span class="field-label">What names should we use for your celebration?</span>
        <input name="coupleLabel" value="${w.coupleLabel}" placeholder="e.g. Asha & Kiran" maxlength="80" autocomplete="off"></label>
      <p class="field-hint">However you’d like to be addressed. No titles or roles needed.</p>`;
    case 'when': return html`
      <fieldset class="field"><legend class="field-label">When are you hoping to celebrate?</legend>
        <div class="seg">
          ${[['exact', 'A specific date'], ['month', 'A rough month'], ['undecided', 'Still deciding']].map(([v, l]) => html`
            <label class="seg-opt"><input type="radio" name="dateMode" value="${v}" ${w.dateMode === v ? 'checked' : ''}><span>${l}</span></label>`)}
        </div></fieldset>
      <label class="field field-narrow" data-date="exact" ${w.dateMode !== 'exact' ? 'hidden' : ''}><span class="field-label">Date</span><input type="date" name="weddingDate" value="${w.weddingDate || ''}"></label>
      <label class="field field-narrow" data-date="month" ${w.dateMode !== 'month' ? 'hidden' : ''}><span class="field-label">Month</span><input type="month" name="weddingMonth" value="${w.weddingMonth || ''}"></label>
      <label class="field"><span class="field-label">Where would you like to celebrate?</span>
        <input name="location" value="${w.location}" placeholder="A city, a region, or “open to ideas”" maxlength="160"></label>`;
    case 'size': return html`
      <label class="field field-narrow"><span class="field-label">Roughly how many guests?</span>
        <input type="number" inputmode="numeric" name="guestEstimate" min="1" max="20000" value="${w.guestEstimate ?? ''}" placeholder="e.g. 200"></label>
      <label class="field field-narrow"><span class="field-label">How many events or days?</span>
        <input type="number" inputmode="numeric" name="eventsCount" min="1" max="30" value="${w.eventsCount ?? ''}" placeholder="e.g. 3"></label>
      <p class="field-hint">Estimates are perfect. Leave either blank if you’re not sure yet.</p>`;
    case 'budget': return html`
      <fieldset class="field"><legend class="field-label">How would you like to talk about budget?</legend>
        <div class="choices">${BUDGET_MODES.map(([v, l]) => radio('budgetMode', v, l, w.budgetMode === v))}</div></fieldset>
      <label class="field" data-budget-range ${w.budgetMode !== 'range' ? 'hidden' : ''}><span class="field-label">Your range, in your words</span>
        <input name="budgetRange" value="${w.budgetRange}" list="budget-ideas" placeholder="e.g. ₹50 L – 1 Cr" maxlength="80">
        <datalist id="budget-ideas"><option value="Under ₹25 L"><option value="₹25 – 50 L"><option value="₹50 L – 1 Cr"><option value="₹1 – 3 Cr"><option value="Above ₹3 Cr"></datalist></label>
      <p class="field-hint">Whatever you choose, your planner will still ask what matters most, so the plan reflects you rather than a number.</p>`;
    case 'feel': return html`
      <label class="field"><span class="field-label">What do you want your celebration to feel like?</span>
        <textarea name="whatMatters" rows="4" maxlength="3000" placeholder="Tell us in your own words: the mood, the moments, the people.">${w.whatMatters}</textarea></label>
      <label class="field"><span class="field-label">What would you most love to get right? <span class="optional">optional</span></span>
        <textarea name="priorities" rows="3" maxlength="1500" placeholder="e.g. the food, time with grandparents, music that gets everyone dancing">${w.priorities}</textarea></label>`;
    case 'traditions': return html`
      <label class="field"><span class="field-label">Are there any traditions, customs, or family practices you’d like us to make room for?</span>
        <textarea name="traditionsNote" rows="4" maxlength="3000" placeholder="Tell us in your own words, as much or as little as you like.">${w.traditionsNote}</textarea>
        <span class="field-hint">Ceremonies, food, music, attire, timings, or anything else. We won’t assume anything you haven’t told us.</span></label>
      <label class="field"><span class="field-label">Languages your families speak <span class="optional">optional</span></span>
        <input name="languages" value="${w.languages}" maxlength="200" placeholder="e.g. Hindi, Tamil, English"></label>
      <label class="field"><span class="field-label">Who else is involved in planning? <span class="optional">optional</span></span>
        <textarea name="familyNote" rows="2" maxlength="2000" placeholder="e.g. an aunt coordinating for the family">${w.familyNote}</textarea></label>
      <div class="story-checks">
        <label class="check"><input type="checkbox" name="traditionsDeciding" ${w.traditionsDeciding ? 'checked' : ''}><span>We’re still deciding</span></label>
        <label class="check"><input type="checkbox" name="traditionsDiscuss" ${w.traditionsDiscuss ? 'checked' : ''}><span>We’d like to talk this through with our planner</span></label>
      </div>`;
    case 'vendors': return html`
      <fieldset class="field"><legend class="field-label">Would you like our help finding vendors?</legend>
        <div class="choices">${SOURCING.map(([v, l, hint]) => radio('vendorSourcing', v, l, w.vendorSourcing === v, hint))}</div></fieldset>
      <label class="field"><span class="field-label">Anything we should know? <span class="optional">optional</span></span>
        <textarea name="vendorNote" rows="2" maxlength="1500" placeholder="e.g. we already have a photographer we love">${w.vendorNote}</textarea></label>`;
    default: return '';
  }
}

export function viewStory(ctx, shell) {
  const w = ctx.data.wedding;
  if (w.detailsShared && !storyState.editing) {
    return shell({ title: 'Your story so far', lede: 'This is what your planner sees. Change anything, anytime.' }, html`
      ${summary(w)}
      <div class="row-end"><button class="btn" type="button" data-action="story-edit">Update your story</button></div>`);
  }
  const i = storyState.step;
  const last = i === STEPS.length - 1;
  return shell({ title: w.detailsShared ? 'Update your story' : 'Let’s begin with you', lede: 'A few gentle questions. Skip anything, and change it later.' }, html`
    <form class="story" data-form="story" novalidate>
      <ol class="story-progress">
        ${STEPS.map((s, n) => html`<li class="${n < i ? 'is-done' : n === i ? 'is-current' : ''}"><button type="button" data-goto-step="${n}" ${n === i ? 'aria-current=step' : ''}><span class="sr-only">Step ${n + 1}: </span>${s.label}</button></li>`)}
      </ol>
      <fieldset class="story-step"><legend class="story-legend" tabindex="-1">${STEPS[i].label}</legend>${stepBody(STEPS[i].id, w)}</fieldset>
      <div class="story-foot">
        ${i > 0 ? html`<button class="btn btn-ghost" type="button" data-step-nav="-1">Back</button>` : ''}
        <span class="story-count" aria-live="polite">Step ${i + 1} of ${STEPS.length}</span>
        <button class="btn" type="submit">${last ? (w.detailsShared ? 'Save changes' : 'Share with our planner') : 'Continue'}</button>
      </div>
      <p class="story-note">Saved as you go.</p>
    </form>`);
}

// Fields on the current step, with blanks sent as empty so they can be cleared.
function stepPayload(form) {
  const v = formValues(form);
  if ('traditionsDeciding' in v || form.querySelector('[name="traditionsNote"]')) {
    v.traditionsDeciding = Boolean(v.traditionsDeciding);
    v.traditionsDiscuss = Boolean(v.traditionsDiscuss);
  }
  if ('dateMode' in v && !v.dateMode) delete v.dateMode;
  if ('budgetMode' in v && !v.budgetMode) delete v.budgetMode;
  if ('vendorSourcing' in v && !v.vendorSourcing) v.vendorSourcing = null;
  if (v.dateMode && v.dateMode !== 'exact') v.weddingDate = '';
  if (v.dateMode && v.dateMode !== 'month') v.weddingMonth = '';
  if (v.budgetMode && v.budgetMode !== 'range') v.budgetRange = '';
  return v;
}

export async function saveStep(form, ctx, delta) {
  const data = await api.patch('/api/couple/profile', stepPayload(form));
  const last = storyState.step === STEPS.length - 1;
  if (delta > 0 && last) {
    const shared = data.wedding.detailsShared ? data : await api.post('/api/couple/profile/share');
    storyState.step = 0;
    storyState.editing = false;
    return { data: shared, done: true, firstShare: !data.wedding.detailsShared };
  }
  storyState.step = Math.max(0, Math.min(STEPS.length - 1, storyState.step + delta));
  return { data, done: false };
}

export function gotoStep(n) { storyState.step = Math.max(0, Math.min(STEPS.length - 1, n)); }

