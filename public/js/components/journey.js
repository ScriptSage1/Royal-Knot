// Planning journey stepper. Renders any list from milestoneStatuses().
import { html } from '../core/ui.js';

export function renderJourney(steps, { audience = 'couple', compact = false } = {}) {
  return html`
    <ol class="journey ${compact ? 'journey-compact' : ''}">
      ${steps.map((s, i) => html`
        <li class="journey-step is-${s.status}">
          <span class="journey-dot" aria-hidden="true">${s.status === 'done' ? '✓' : i + 1}</span>
          <span class="journey-text">
            <span class="journey-label">${audience === 'couple' ? s.coupleLabel : s.label}</span>
            <span class="sr-only">— ${s.status === 'done' ? 'completed' : s.status === 'current' ? 'current step' : 'upcoming'}</span>
            ${s.status === 'current' && !compact ? html`<span class="journey-now">Current step</span>` : ''}
          </span>
        </li>`)}
    </ol>`;
}

export function renderProgressBar(fraction, label) {
  const pct = Math.round(fraction * 100);
  return html`
    <div class="progress" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pct}" aria-label="${label}">
      <span class="progress-fill" style="width:${pct}%"></span>
    </div>`;
}
