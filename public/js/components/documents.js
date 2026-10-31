// Requirements document, rendered the same way for planner and couple.
// Every value goes through the escaping `html` helper.
import { html, fmtDate } from '../core/ui.js';

export function renderRequirementsDoc(doc, { label = 'Requirements', note = '' } = {}) {
  return html`
    <article class="doc-preview" aria-label="${label}">
      <header class="doc-preview-head">
        <p class="eyebrow">${label}</p>
        <p class="muted small">Version ${doc.version}${doc.sharedAt ? ` · Shared ${fmtDate(doc.sharedAt.slice(0, 10))}` : doc.approvedAt ? ` · Approved ${fmtDate(doc.approvedAt.slice(0, 10))}` : ''}${note ? ` · ${note}` : ''}</p>
      </header>
      ${doc.sections.map((s) => html`
        <section class="doc-section">
          <h3>${s.title}</h3>
          <ul>${s.items.map((i) => html`<li>${i}</li>`)}</ul>
        </section>`)}
    </article>`;
}
