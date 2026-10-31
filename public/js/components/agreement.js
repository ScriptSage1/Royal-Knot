// The agreement document and its acceptance record. Acceptance here is a
// recorded confirmation in the portal, not a certified e-signature, and the
// record says so.
import { html, inr, fmtDateTime } from '../core/ui.js';

export function renderAgreementDoc(a) {
  return html`
    <article class="doc-preview doc-paper" aria-label="${a.title}">
      <header class="doc-preview-head">
        <p class="eyebrow">${a.title}</p>
        <p class="muted small">Version ${a.version}${a.sentAt ? ` · Sent ${fmtDateTime(a.sentAt)}` : ' · Draft'}</p>
      </header>
      <section class="doc-section"><h3>Scope of services</h3><p class="pre">${a.scopeSummary}</p></section>
      <section class="doc-section"><h3>Vendors</h3><p>${a.vendorPath}</p></section>
      ${a.feeAmount != null ? html`<section class="doc-section"><h3>Planning fee</h3><p><strong>${inr(a.feeAmount)}</strong> plus applicable taxes, paid in the milestones in your payment timeline.</p></section>` : ''}
      <section class="doc-section"><h3>Terms</h3><p class="pre">${a.terms}</p></section>
    </article>`;
}

export function renderAcceptance(a) {
  if (a.status !== 'accepted') return '';
  return html`
    <div class="acceptance">
      <p class="eyebrow">Acceptance record</p>
      <dl class="kv kv-tight">
        <div><dt>Accepted by</dt><dd>${a.signatoryName}</dd></div>
        <div><dt>When</dt><dd>${fmtDateTime(a.acceptedAt)}</dd></div>
        <div><dt>Version</dt><dd>${a.version}</dd></div>
      </dl>
      <p class="small">${a.acceptanceText}</p>
      <p class="muted small">Recorded in The Royal Knot portal. This is a confirmation of acceptance, not a certified electronic signature.</p>
    </div>`;
}
