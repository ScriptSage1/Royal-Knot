import { html, mount, emptyState, fmtDate } from '../core/ui.js';
import { STAGES } from '../core/progress.js';
import { initDevbar } from '../core/devbar.js';
import { initAgentShell } from '../core/agent-shell.js';
import { listWeddings } from '../data/source.js';

const root = document.getElementById('ag-view');

function render(cases) {
  if (!cases.length) {
    mount(root, html`<section class="card">${emptyState({ title: 'No wedding sessions yet' })}</section>`);
    return;
  }

  mount(root, html`
    <header class="ag-pagehead">
      <div>
        <p class="ag-eyebrow">Planner workspace</p>
        <h1 class="ag-title">Wedding sessions</h1>
        <p class="ag-sub">${cases.length} separate workspaces</p>
      </div>
    </header>

    <div class="case-list session-list">
      ${cases.map((wedding) => html`
        <section class="card session-card" aria-labelledby="case-${wedding.mockKey}-title">
          <div class="session-card-top">
            <div class="session-card-identity">
              <p class="ag-eyebrow">Preview · ${wedding.mockKey}</p>
              <h2 id="case-${wedding.mockKey}-title" class="card-title">${wedding.coupleLabel}</h2>
              <p class="session-card-meta">${wedding.location} · ${wedding.guests} guests · ${fmtDate(wedding.approxDate)}</p>
            </div>
            <span class="pill pill-info">${STAGES[wedding.stage].label}</span>
          </div>
          <div class="session-card-bottom">
            <div class="session-card-context">
              <span>${wedding.planner || 'Unassigned'} · ${wedding.budgetRange}</span>
              <strong>Next · ${wedding.nextAction.label} · ${fmtDate(wedding.nextAction.due, { day: 'numeric', month: 'short' })}</strong>
            </div>
            <a class="btn btn-small" href="/agent/weddings/${wedding.mockKey}">Open workspace</a>
          </div>
        </section>`)}
    </div>`);
}

async function boot() {
  initAgentShell();
  initDevbar();
  render(await listWeddings());
}
boot();