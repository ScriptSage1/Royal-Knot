// Agent: season overview — upcoming weddings, planner workload, money due and
// cases needing attention. Each block supports a decision (who can take the
// next enquiry, what to chase this week); nothing is decorative.
import { html, mount, inr, fmtDate, pill, futureTag, relDays, daysFrom, initials } from '../core/ui.js';
import { STAGES, stageState, milestoneStatuses } from '../core/progress.js';
import { initDevbar } from '../core/devbar.js';
import { initAgentShell } from '../core/agent-shell.js';
import { loadSeason, listPlanners, asOf } from '../data/source.js';

const TODAY = asOf();
const root = document.getElementById('ag-view');
const track = (stage) => html`<ol class="stage-track" aria-hidden="true">${milestoneStatuses(stageState(stage)).map((m) => html`<li class="is-${m.status}"></li>`)}</ol>`;

function render(s, planners) {
  const dated = s.weddings.filter((w) => w.approxDate).sort((a, b) => a.approxDate.localeCompare(b.approxDate));
  const byMonth = new Map();
  dated.forEach((w) => { const k = w.approxDate.slice(0, 7); byMonth.set(k, [...(byMonth.get(k) || []), w]); });
  const undated = s.weddings.filter((w) => !w.approxDate);

  const load = planners.map((p) => {
    const mine = s.weddings.filter((w) => w.planner === p.name);
    return {
      ...p,
      active: mine.length,
      soon: mine.filter((w) => w.approxDate && daysFrom(w.approxDate, TODAY) <= 60).length,
      open: mine.reduce((n, w) => n + w.openTasks, 0),
      overdue: mine.reduce((n, w) => n + w.overdueTasks, 0),
      next: mine.filter((w) => w.approxDate).sort((a, b) => a.approxDate.localeCompare(b.approxDate))[0],
    };
  });
  const spare = load.filter((p) => p.active < p.capacity).sort((a, b) => a.active - b.active || a.open - b.open)[0];
  const money = s.upcomingMoney.slice().sort((a, b) => a.due.localeCompare(b.due));
  const due60 = money.filter((m) => daysFrom(m.due, TODAY) <= 60).reduce((n, m) => n + m.amount, 0);
  const overdue = money.filter((m) => m.status === 'Overdue');
  const attention = s.weddings.filter((w) => !w.planner || w.overdueTasks || w.payment?.status === 'Overdue' || daysFrom(w.nextAction.due, TODAY) < 0);

  mount(root, html`
    <header class="ag-pagehead">
      <div>
        <p class="ag-eyebrow">Season overview · as of ${fmtDate(TODAY)}</p>
        <h1 class="ag-title">${s.label}</h1>
        <p class="ag-sub"><b>${s.weddings.length}</b> weddings · <b>${dated.filter((w) => daysFrom(w.approxDate, TODAY) <= 60).length}</b> in the next 60 days · <b>${inr(due60)}</b> due from couples in that time</p>
      </div>
      ${futureTag('Live reporting')}
    </header>

    <div class="season-layout">
      <section class="card" aria-labelledby="cal-h">
        <div class="card-head"><h2 id="cal-h" class="card-title">Upcoming weddings</h2><span class="muted small">By wedding date</span></div>
        <div class="season-cal">
          ${[...byMonth].map(([month, ws]) => html`
            <div class="season-month">
              <h3>${new Date(month + '-01T00:00:00').toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}</h3>
              ${ws.map((w) => html`
                <div class="season-row">
                  <span class="agenda-date"><b>${new Date(w.approxDate + 'T00:00:00').getDate()}</b><small>${new Date(w.approxDate + 'T00:00:00').toLocaleDateString('en-IN', { month: 'short' })}</small></span>
                  <span><a href="/agent/weddings/${w.mockKey}">${w.coupleLabel}</a><span class="cell-sub">${w.location} · ${relDays(w.approxDate, TODAY)} · ${w.planner || 'Unassigned'}</span></span>
                  <span class="stage-cell"><span class="small">${STAGES[w.stage].label}</span>${track(w.stage)}</span>
                </div>`)}
            </div>`)}
          ${undated.length ? html`<p class="muted small">${undated.length} enquiry without a date yet: ${undated.map((w) => html`<a class="link" href="/agent/weddings/${w.mockKey}">${w.coupleLabel}</a>`)}</p>` : ''}
        </div>
      </section>

      <div class="ws-stack">
        <section class="card" aria-labelledby="load-h">
          <div class="card-head"><h2 id="load-h" class="card-title">Planner workload</h2><span class="muted small">Active weddings vs. capacity</span></div>
          <ul class="workload">${load.map((p) => html`
            <li>
              <span class="who"><span class="who-dot" aria-hidden="true">${initials(p.name)}</span><b>${p.name}</b></span>
              <span class="workload-count">${p.active} of ${p.capacity} weddings</span>
              <span class="load-bar ${p.active >= p.capacity ? 'is-full' : ''}" role="img" aria-label="${p.active} of ${p.capacity} capacity"><span style="width:${Math.min(100, (p.active / p.capacity) * 100)}%"></span></span>
              <span class="cell-sub">${p.soon} within 60 days · ${p.open} open tasks${p.overdue ? html` · <span class="due-overdue">${p.overdue} overdue</span>` : ''}${p.next ? ` · next: ${p.next.coupleLabel}, ${fmtDate(p.next.approxDate, { day: 'numeric', month: 'short' })}` : ''}</span>
            </li>`)}</ul>
          ${undated.length && spare ? html`<p class="callout"><span><strong>${undated[0].coupleLabel}</strong> is unassigned. ${spare.name} has the most capacity (${spare.active} of ${spare.capacity}).</span></p>` : ''}
        </section>

        <section class="card" aria-labelledby="money-h">
          <div class="card-head"><h2 id="money-h" class="card-title">Money due from couples</h2></div>
          ${overdue.length ? html`<p class="small due-overdue">${inr(overdue.reduce((n, m) => n + m.amount, 0))} overdue</p>` : ''}
          <ul class="list">${money.map((m) => html`
            <li class="list-row"><span><a class="link" href="/agent/weddings/${m.mockKey}#finance">${m.couple}</a><span class="cell-sub">${m.label} · ${m.status === 'Overdue' ? `overdue since ${fmtDate(m.due, { day: 'numeric', month: 'short' })}` : `due ${fmtDate(m.due, { day: 'numeric', month: 'short' })}`}</span></span>
            <span class="list-row-side"><strong class="num">${inr(m.amount)}</strong>${pill(m.status)}</span></li>`)}</ul>
          <p class="ag-note">Vendor bills outstanding across the season: <b>${inr(s.vendorBillsDue)}</b></p>
        </section>

        <section class="card" aria-labelledby="att-h">
          <div class="card-head"><h2 id="att-h" class="card-title">Cases needing attention</h2><span class="muted small">${attention.length}</span></div>
          <ul class="attn">${attention.map((w) => html`
            <li class="attn-high"><span class="attn-mark" aria-hidden="true"></span>
              <span><span class="attn-title">${w.coupleLabel}</span><span class="attn-meta">${[!w.planner && 'No planner assigned', w.payment?.status === 'Overdue' && `${w.payment.label} overdue`, w.overdueTasks && `${w.overdueTasks} overdue task${w.overdueTasks > 1 ? 's' : ''}`, daysFrom(w.nextAction.due, TODAY) < 0 && `“${w.nextAction.label}” ${relDays(w.nextAction.due, TODAY)}`].filter(Boolean).join(' · ')}</span></span>
              <a class="btn btn-small btn-ghost" href="/agent/weddings/${w.mockKey}">Open<span class="sr-only"> ${w.coupleLabel}</span></a></li>`)}</ul>
        </section>
      </div>
    </div>

    <section class="card ag-block" aria-labelledby="vp-h">
      <div class="card-head"><h2 id="vp-h" class="card-title">Vendor reliability</h2><span class="muted small">Across this season · sample metrics</span></div>
      <div class="ag-sheet"><table class="ag-table">
        <thead><tr><th scope="col">Vendor</th><th scope="col">Category</th><th scope="col" class="num">Weddings</th><th scope="col" class="num">On-time arrival</th><th scope="col" class="num">Rating</th><th scope="col" class="num">Issues</th></tr></thead>
        <tbody>${s.vendors.map((v) => html`<tr><th scope="row">${v.name}</th><td data-label="Category">${v.category}</td><td data-label="Weddings" class="num">${v.weddings}</td><td data-label="On-time" class="num"><span class="${v.onTime < 0.85 ? 'due-overdue' : ''}">${Math.round(v.onTime * 100)}%</span></td><td data-label="Rating" class="num">${v.rating.toFixed(1)}</td><td data-label="Issues" class="num">${v.issues}</td></tr>`)}</tbody>
      </table></div>
    </section>`);
}

(async function boot() {
  initAgentShell();
  initDevbar();
  const [season, planners] = await Promise.all([loadSeason(), listPlanners()]);
  render(season, planners);
})();
