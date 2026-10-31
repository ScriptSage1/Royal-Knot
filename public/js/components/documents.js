// Requirements/specification document + planner checklist.
// Actions: data-action="toggle-check" data-index | "generate-doc"
import { html, fmtDate, futureTag, emptyState, pill, visibility } from '../core/ui.js';

export function renderRequirementsDoc(req, { audience = 'agent' } = {}) {
  const body = req.sections.length
    ? html`
      <article class="doc-preview" aria-label="Requirements document preview">
        <header class="doc-preview-head">
          <p class="eyebrow">Requirements summary</p>
          <p class="muted small">${req.version ? `${req.version} · ` : ''}${req.updated ? `Updated ${fmtDate(req.updated)}` : ''}</p>
        </header>
        ${req.sections.map((s) => html`
          <section class="doc-section">
            <h3>${s.title}</h3>
            <ul>${s.items.map((i) => html`<li>${i}</li>`)}</ul>
          </section>`)}
      </article>`
    : emptyState({ icon: 'doc', title: 'No requirements document yet', body: audience === 'agent' ? 'The document will be drafted from the consultation. Automated drafting is a later module.' : 'Your planner prepares this after your consultation.' });

  return html`
    <section class="card" aria-labelledby="req-h">
      <div class="card-head">
        <h2 id="req-h" class="card-title">Requirements document</h2>
        ${pill(req.status)}
        ${audience === 'agent' ? html`${visibility('shared', 'Shared once sent')}${futureTag('Document generation')}` : ''}
      </div>
      ${body}
      ${audience === 'agent' ? html`
        <div class="row-end">
          <button class="btn btn-ghost" type="button" data-action="generate-doc">Draft from meeting</button>
          <button class="btn btn-ghost" type="button" data-action="send-doc">Send to couple for approval</button>
        </div>` : ''}
    </section>`;
}

export function renderChecklist(items) {
  const done = items.filter((i) => i.done).length;
  return html`
    <section class="card" aria-labelledby="chk-h">
      <div class="card-head"><h2 id="chk-h" class="card-title">Planner checklist</h2><span class="muted small">${done}/${items.length} done</span>${visibility('internal')}</div>
      ${items.length ? html`
        <ul class="checklist">
          ${items.map((it, i) => html`
            <li>
              <label class="check">
                <input type="checkbox" data-action="toggle-check" data-index="${i}" ${it.done ? 'checked' : ''}>
                <span>${it.label}</span>
              </label>
            </li>`)}
        </ul>` : emptyState({ title: 'Checklist not started', body: 'Checklist items will be created from the requirements document.' })}
    </section>`;
}
