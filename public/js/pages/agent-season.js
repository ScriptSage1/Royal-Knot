import { html, mount, emptyState, fmtDate, relDays } from '../core/ui.js';
import { STAGES } from '../core/progress.js';
import { initDevbar } from '../core/devbar.js';
import { initAgentShell } from '../core/agent-shell.js';
import { loadSeason, asOf } from '../data/source.js';

const TODAY = asOf();
const root = document.getElementById('ag-view');

function render(season) {
  const weddings = season.weddings || (season.wedding ? [season.wedding] : []);
  if (!weddings.length) {
    mount(root, html`<section class="card">${emptyState({ title: 'No wedding sessions yet' })}</section>`);
    return;
  }

  mount(root, html`
    <header class="ag-pagehead">
      <div>
        <p class="ag-eyebrow">Season</p>
        <h1 class="ag-title">Wedding pipeline</h1>
        <p class="ag-sub">${weddings.length} separate workspaces</p>
      </div>
    </header>

    <div class="case-list">
      ${weddings.map((wedding, i) => html`
        <section class="card season-single" aria-labelledby="season-case-${wedding.mockKey}">
          <div class="card-head">
            <div>
              <p class="ag-eyebrow">Demo session ${i + 1} · ${wedding.mockKey}</p>
              <h2 id="season-case-${wedding.mockKey}" class="card-title"><a class="season-case-link" href="/agent/weddings/${wedding.mockKey}">${wedding.coupleLabel}</a></h2>
              <p class="muted small">${wedding.location} · ~${wedding.guests} guests</p>
            </div>
            <span class="pill pill-info">${STAGES[wedding.stage].label}</span>
          </div>

          <dl class="facts">
            <div><dt>Date</dt><dd>${fmtDate(wedding.approxDate)} · ${relDays(wedding.approxDate, TODAY)}</dd></div>
            <div><dt>Planner</dt><dd>${wedding.planner || 'Unassigned'}</dd></div>
            <div><dt>Budget</dt><dd>${wedding.budgetRange}</dd></div>
          </dl>

          <div class="row-end"><a class="btn" href="/agent/weddings/${wedding.mockKey}">Open workspace</a></div>
        </section>`)}
    </div>`);
}

(async function boot() {
  initAgentShell();
  initDevbar();
  const season = await loadSeason();
  render(season);
})();