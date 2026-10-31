// Service agreement: status track, document preview, signing state, attached file.
// Actions: data-action="agreement-advance" (agent, mock) | "agreement-sign" (couple) | "agreement-download"
import { html, fmtDate, futureTag, pill, emptyState } from '../core/ui.js';

export const AGREEMENT_FLOW = ['Draft', 'Sent', 'Viewed', 'Signed'];

export function renderAgreement(a, { audience = 'agent' } = {}) {
  const idx = AGREEMENT_FLOW.indexOf(a.status);
  const started = idx >= 0;
  const signed = a.status === 'Signed';
  const historyAt = (s) => (a.history || []).find((h) => h.status === s)?.at;

  const next = AGREEMENT_FLOW[idx + 1];
  const agentAction = !started ? 'Create draft' : next ? `Mark as ${next.toLowerCase()}` : null;

  return html`
    <section class="card" aria-labelledby="agr-h">
      <div class="card-head">
        <h2 id="agr-h" class="card-title">${a.title}</h2>
        ${pill(signed ? 'Signed' : a.status === 'Sent' || a.status === 'Viewed' ? 'Awaiting signature' : a.status)}
        ${futureTag('Digital signing')}
      </div>

      <ol class="status-track" aria-label="Agreement status">
        ${AGREEMENT_FLOW.map((s, i) => html`
          <li class="${i <= idx ? 'is-done' : ''} ${i === idx ? 'is-current' : ''}">
            <span class="status-track-dot" aria-hidden="true"></span>
            <span>${s}</span>
            <small>${historyAt(s) ? fmtDate(historyAt(s)) : ''}</small>
          </li>`)}
      </ol>

      <div class="agreement-grid">
        <article class="doc-preview doc-paper" aria-label="Agreement preview">
          <p class="eyebrow">Document preview</p>
          ${a.summary.length ? html`
            <dl class="kv kv-tight">${a.summary.map(([k, v]) => html`<div><dt>${k}</dt><dd>${v}</dd></div>`)}</dl>
            <div class="doc-lines" aria-hidden="true"><span></span><span></span><span></span><span class="short"></span></div>
            <p class="muted small">Sample preview. The full agreement document is generated in a later module.</p>`
          : emptyState({ icon: 'doc', title: 'No agreement drafted yet', body: audience === 'agent' ? 'Drafting from the requirements document is a later module.' : 'Your planner will share the agreement after your plan summary is approved.' })}
        </article>

        <div class="attach ${signed ? 'attach-ready' : ''}">
          <p class="placeholder-title">Signed document</p>
          ${a.file
            ? html`<p>${a.file.name}</p><button class="btn btn-ghost" type="button" data-action="agreement-download">Download</button>`
            : html`<p class="muted small">${signed
                ? 'Marked as signed in this preview. The signed file will be attached here automatically once the digital signing module is connected.'
                : 'The signed file will be attached here after signing. Digital signing is not connected yet.'}</p>`}
        </div>
      </div>

      <div class="row-end">
        ${audience === 'agent' && agentAction ? html`<button class="btn" type="button" data-action="agreement-advance">${agentAction}</button>` : ''}
        ${audience === 'agent' && signed ? html`<span class="muted small">Agreement complete.</span>` : ''}
        ${audience === 'couple' && (a.status === 'Sent' || a.status === 'Viewed') ? html`<button class="btn" type="button" data-action="agreement-sign">Review &amp; sign</button>` : ''}
      </div>
    </section>`;
}
