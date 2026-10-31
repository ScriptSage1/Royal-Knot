// Vendors: the couple's sourcing choice, briefs to vendors, proposals (from
// the vendor portal or entered by the planner), review, the shortlist shared
// with the couple, and their questions. Categories are data, so any new one
// can be typed in.
import { html, fmtDate, pill, emptyState } from '../core/ui.js';
import { renderComparison } from '../components/proposals.js';
import { SOURCING, select, field, card } from './common.js';

export const vendorUi = { open: null };

function sourcingCard(c) {
  const w = c.wedding;
  return card({ title: 'Vendor approach', kind: 'shared', label: 'Couple’s choice' }, html`
    <form data-form="scope" class="form-row">
      <label class="field field-inline"><span class="field-label">Couple’s choice</span>${select('vendorSourcing', { '': 'Not decided', ...SOURCING }, w.vendorSourcing || '')}</label>
      <label class="field field-grow"><span class="field-label">Note</span><input name="vendorNote" value="${w.vendorNote}" maxlength="1500"></label>
      <button class="btn btn-ghost btn-small" type="submit">Save</button>
    </form>
    <p class="muted small">${w.vendorSourcing === 'help' ? 'The agreement follows vendor selection.' : 'The agreement can go ahead once the scope is confirmed; vendor sourcing doesn’t block it.'}</p>
    ${w.vendorSourcing === 'help' ? html`<div class="row-end">${w.vendorsCompleteAt
      ? html`<span class="muted small">Selection marked complete ${fmtDate(w.vendorsCompleteAt.slice(0, 10))}</span><button class="link-btn" type="button" data-action="vendors-complete" data-complete="false">Reopen</button>`
      : html`<button class="btn btn-ghost btn-small" type="button" data-action="vendors-complete" data-complete="true">Mark vendor selection complete</button>`}</div>` : ''}`);
}

function newBrief(ctx) {
  const approved = ctx.c.requirements.some((d) => d.status === 'approved');
  if (!approved) return html`<p class="muted small">Approve the requirements to start sending vendor briefs.</p>`;
  const cats = Object.fromEntries(ctx.dir.categories.map((x) => [String(x.id), x.name]));
  return html`
    <details class="card add-brief" ${ctx.c.requests.length ? '' : 'open'}>
      <summary>New vendor brief</summary>
      <form data-form="brief" class="form-stack">
        <div class="form-grid">
          ${field('Category', select('categoryId', { '': 'Choose…', ...cats }, ''))}
          ${field('…or a new category', html`<input name="categoryName" maxlength="60" placeholder="e.g. Mehendi artist">`)}
          ${field('Budget guide', html`<input name="budgetNote" maxlength="160" placeholder="e.g. ₹2–3 L">`)}
          ${field('Reply by', html`<input type="date" name="dueDate">`)}
        </div>
        ${field('Brief', html`<textarea name="brief" rows="4" required placeholder="What you need, for how many guests, which events, and anything vendors must know."></textarea>`, 'Vendors see this brief with the city, date and guest numbers. They never see the couple’s names or your notes.')}
        <fieldset class="field"><legend class="field-label">Send to</legend>
          <div class="vendor-picks">${ctx.dir.vendors.map((v) => html`<label class="check"><input type="checkbox" name="vendorIds" value="${v.id}"><span>${v.name} <small class="muted">· ${v.category}${v.city ? ` · ${v.city}` : ''}${v.hasPortal ? ' · portal' : ''}</small></span></label>`)}</div>
        </fieldset>
        <div class="row-end"><button class="btn" type="submit">Send brief</button></div>
      </form>
      <details class="add-task"><summary>Add a vendor to the directory</summary>
        <form data-form="vendor-new" class="form-grid">
          ${field('Name', html`<input name="name" required maxlength="120">`)}
          ${field('Category', select('categoryId', { '': 'Choose…', ...cats }, ''))}
          ${field('…or a new category', html`<input name="categoryName" maxlength="60">`)}
          ${field('City', html`<input name="city" maxlength="80">`)}
          ${field('Email', html`<input type="email" name="email">`)}
          <div class="row-end form-span"><button class="btn btn-ghost" type="submit">Add vendor</button></div>
        </form>
      </details>
    </details>`;
}

function requestCard(r, ctx) {
  const shortlisted = r.proposals.filter((p) => p.agencyStatus === 'shortlisted');
  const unshared = shortlisted.filter((p) => !p.sharedAt).length;
  const footer = (p) => html`
    <div class="btn-stack">
      ${p.agencyStatus !== 'shortlisted' ? html`<button class="btn btn-small" type="button" data-action="proposal-status" data-id="${p.id}" data-status="shortlisted">Shortlist</button>` : ''}
      ${p.agencyStatus !== 'declined' ? html`<button class="btn btn-small btn-ghost" type="button" data-action="proposal-status" data-id="${p.id}" data-status="declined">Decline</button>` : html`<button class="link-btn" type="button" data-action="proposal-status" data-id="${p.id}" data-status="received">Reconsider</button>`}
      <details class="mini-edit"><summary>Notes</summary>
        <form data-form="proposal-notes" data-id="${p.id}" class="form-stack">
          <label class="field"><span class="field-label">Internal comment</span><textarea name="internalComment" rows="2">${p.internalComment}</textarea></label>
          <label class="field"><span class="field-label">Note for the couple</span><textarea name="noteForCouple" rows="2">${p.noteForCouple}</textarea></label>
          <button class="btn btn-small" type="submit">Save</button>
        </form>
      </details>
    </div>`;
  const questions = r.proposals.flatMap((p) => p.questions.map((q) => ({ ...q, vendor: p.vendorName })));
  const recipients = Object.fromEntries(ctx.dir.vendors.filter((v) => !r.proposals.some((p) => p.vendorId === v.id)).map((v) => [String(v.id), `${v.name} · ${v.category}`]));
  return html`
    <section class="card request-card">
      <div class="card-head">
        <h2 class="card-title">${r.category}</h2>
        ${pill(r.status, r.status === 'open' ? 'Open' : 'Closed')}
        <span class="muted small">${r.proposals.length}/${r.recipients.length || r.proposals.length} replied${r.dueDate ? ` · reply by ${fmtDate(r.dueDate)}` : ''}${r.budgetNote ? ` · ${r.budgetNote}` : ''}</span>
      </div>
      <p class="brief">${r.brief}</p>
      ${r.recipients.length ? html`<p class="recipients">${r.recipients.map((x) => html`<span class="chip-static">${x.vendorName} · ${{ invited: 'invited', responded: 'replied', declined: 'declined' }[x.status]}</span>`)}</p>` : ''}
      ${r.proposals.length ? renderComparison({ options: r.proposals, audience: 'agent', footer }) : emptyState({ icon: 'people', title: 'No proposals yet', body: 'Vendors reply through their portal, or enter a quote you received by email or phone.' })}
      <div class="row-end">
        ${unshared ? html`<button class="btn" type="button" data-action="share-shortlist" data-id="${r.id}">Share ${unshared} shortlisted with the couple</button>` : shortlisted.length ? html`<span class="muted small">Shortlist shared with the couple</span>` : ''}
      </div>
      ${questions.length ? html`<h3 class="sub-h">Couple’s questions ${pill('shared', 'Shared')}</h3>${questions.map((q) => html`
        <div class="qa"><p><strong>${q.vendor}:</strong> ${q.question} <span class="muted small">· ${q.askedBy || 'Couple'}</span></p>
          ${q.answer ? html`<p class="qa-answer">${q.answer}</p>` : html`<form data-form="answer" data-id="${q.id}" class="form-row"><label class="field field-grow"><span class="field-label sr-only">Answer</span><input name="answer" required placeholder="Reply to the couple"></label><button class="btn btn-small" type="submit">Reply</button></form>`}</div>`)}` : ''}
      <details class="add-task"><summary>Enter a proposal received elsewhere</summary>
        <form data-form="proposal-entry" data-id="${r.id}" class="form-grid">
          ${field('Vendor', select('vendorId', { '': 'Choose…', ...recipients }, ''))}
          ${field('Total amount (₹)', html`<input name="amount" inputmode="numeric" required>`)}
          <label class="field form-span"><span class="field-label">Scope</span><input name="scope" required></label>
          ${field('Included (one per line)', html`<textarea name="inclusions" rows="2"></textarea>`)}
          ${field('Not included (one per line)', html`<textarea name="exclusions" rows="2"></textarea>`)}
          ${field('Extra charges (one per line)', html`<textarea name="extras" rows="2"></textarea>`)}
          ${field('Valid until', html`<input type="date" name="validUntil">`)}
          <label class="field form-span"><span class="field-label">Internal comment</span><input name="internalComment"></label>
          <div class="row-end form-span"><button class="btn" type="submit">Add proposal</button></div>
        </form>
      </details>
      <details class="add-task"><summary>Invite more vendors</summary>
        <form data-form="invite" data-id="${r.id}" class="form-stack">
          <div class="vendor-picks">${ctx.dir.vendors.filter((v) => !r.recipients.some((x) => x.vendorId === v.id)).map((v) => html`<label class="check"><input type="checkbox" name="vendorIds" value="${v.id}"><span>${v.name} <small class="muted">· ${v.category}</small></span></label>`)}</div>
          <div class="row-end"><button class="link-btn" type="button" data-action="request-status" data-id="${r.id}" data-status="${r.status === 'open' ? 'closed' : 'open'}">${r.status === 'open' ? 'Close this request' : 'Reopen this request'}</button><button class="btn btn-ghost btn-small" type="submit">Invite</button></div>
        </form>
      </details>
    </section>`;
}

const ids = (v) => (Array.isArray(v.vendorIds) ? v.vendorIds : []);
const category = (v) => (v.categoryId ? { categoryId: v.categoryId } : { categoryName: v.categoryName });

export default {
  id: 'vendors',
  label: 'Vendors & proposals',
  view: (ctx) => html`${sourcingCard(ctx.c)}${ctx.c.requests.map((r) => requestCard(r, ctx))}${newBrief(ctx)}`,
  actions: {
    'vendors-complete': (t, ctx) => ctx.call('POST', '/vendors-complete', { complete: t.dataset.complete === 'true' }),
    'proposal-status': (t, ctx) => ctx.call('PATCH', `/proposals/${t.dataset.id}`, { agencyStatus: t.dataset.status }),
    'share-shortlist': (t, ctx) => ctx.call('POST', `/vendor-requests/${t.dataset.id}/share`),
    'request-status': (t, ctx) => ctx.call('PATCH', `/vendor-requests/${t.dataset.id}`, { status: t.dataset.status }),
  },
  forms: {
    scope: (v, ctx) => ctx.call('PATCH', '/scope', { vendorSourcing: v.vendorSourcing || null, vendorNote: v.vendorNote }),
    brief: async (v, ctx) => { const out = await ctx.call('POST', '/vendor-requests', { ...category(v), brief: v.brief, budgetNote: v.budgetNote, dueDate: v.dueDate, vendorIds: ids(v) }); if (!v.categoryId) await ctx.reloadDirectory(); return out; },
    'vendor-new': async (v, ctx) => { const out = await ctx.call('POST', '/vendors', { ...category(v), name: v.name, city: v.city, email: v.email }); await ctx.reloadDirectory(); return out; },
    'proposal-notes': (v, ctx, form) => ctx.call('PATCH', `/proposals/${form.dataset.id}`, v),
    'proposal-entry': (v, ctx, form) => ctx.call('POST', `/vendor-requests/${form.dataset.id}/proposals`, v),
    answer: (v, ctx, form) => ctx.call('POST', `/questions/${form.dataset.id}/answer`, v),
    invite: (v, ctx, form) => ctx.call('POST', `/vendor-requests/${form.dataset.id}/recipients`, { vendorIds: ids(v) }),
  },
  success: { scope: 'Saved.', brief: 'Brief sent to the selected vendors.', 'vendor-new': 'Vendor added.', 'proposal-notes': 'Saved.', 'proposal-entry': 'Proposal added.', answer: 'Reply shared with the couple.', invite: 'Invited.' },
};
