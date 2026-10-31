// Agent: season overview across weddings (mock). Reporting is a later module.
import { html, mount, inr, fmtDate, pill, futureTag } from '../core/ui.js';
import { STAGES } from '../core/progress.js';
import { initDevbar } from '../core/devbar.js';
import { loadSeason } from '../data/source.js';

const root = document.getElementById('ag-view');

function render(s) {
  const dueSoon = s.upcomingMoney.reduce((n, m) => n + m.amount, 0);
  const overdue = s.upcomingMoney.filter((m) => m.status === 'Overdue').reduce((n, m) => n + m.amount, 0);
  const byMonth = new Map();
  s.weddings.filter((w) => w.approxDate).sort((a, b) => a.approxDate.localeCompare(b.approxDate)).forEach((w) => {
    const k = w.approxDate.slice(0, 7);
    byMonth.set(k, [...(byMonth.get(k) || []), w]);
  });

  mount(root, html`
    <header class="ag-head">
      <div>
        <p class="eyebrow">Season overview</p>
        <h1 class="ag-title">${s.label}</h1>
        <p class="muted">Sample data. Live reporting across weddings arrives in a later module.</p>
      </div>
      ${futureTag('Reporting')}
    </header>

    <ul class="kpis">
      <li><span>Weddings this season</span><strong>${s.weddings.length}</strong></li>
      <li><span>Couple payments due (next 60 days)</span><strong>${inr(dueSoon)}</strong></li>
      <li><span>Overdue</span><strong class="text-risk">${inr(overdue)}</strong></li>
      <li><span>Vendor bills outstanding</span><strong>${inr(s.vendorBillsDue)}</strong></li>
    </ul>

    <div class="ws-grid">
      <section class="card" aria-labelledby="cal-h">
        <div class="card-head"><h2 id="cal-h" class="card-title">Wedding calendar</h2></div>
        <ol class="season-cal">
          ${[...byMonth].map(([month, ws]) => html`
            <li><h3>${new Date(month + '-01T00:00:00').toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}</h3>
              <ul>${ws.map((w) => html`<li><a href="/agent/weddings/${w.mockKey}">${w.coupleLabel}</a><span class="muted small">${fmtDate(w.approxDate, { day: 'numeric', month: 'short' })} · ${w.location}</span>${pill(w.stage >= 9 ? 'Complete' : 'In progress', STAGES[w.stage].label)}</li>`)}</ul>
            </li>`)}
        </ol>
        <p class="muted small">${s.weddings.filter((w) => !w.approxDate).length} enquiry without a date yet.</p>
      </section>

      <section class="card" aria-labelledby="money-h">
        <div class="card-head"><h2 id="money-h" class="card-title">Upcoming money due</h2></div>
        <ul class="list">${s.upcomingMoney.slice().sort((a, b) => a.due.localeCompare(b.due)).map((m) => html`
          <li class="list-row"><span><strong>${m.couple}</strong><small class="muted"> · ${m.label}</small><br><small class="muted">Due ${fmtDate(m.due)}</small></span>
          <span class="list-row-side"><strong>${inr(m.amount)}</strong>${pill(m.status)}</span></li>`)}</ul>
      </section>
    </div>

    <section class="card" aria-labelledby="vp-h">
      <div class="card-head"><h2 id="vp-h" class="card-title">Vendor performance</h2><span class="muted small">Sample metrics</span></div>
      <div class="table-wrap"><table class="table">
        <thead><tr><th scope="col">Vendor</th><th scope="col">Category</th><th scope="col" class="num">Weddings</th><th scope="col" class="num">On-time arrival</th><th scope="col" class="num">Avg. rating</th><th scope="col" class="num">Issues</th></tr></thead>
        <tbody>${s.vendors.map((v) => html`<tr><th scope="row">${v.name}</th><td>${v.category}</td><td class="num">${v.weddings}</td><td class="num"><span class="${v.onTime < 0.85 ? 'text-risk' : ''}">${Math.round(v.onTime * 100)}%</span></td><td class="num">${v.rating.toFixed(1)}</td><td class="num">${v.issues}</td></tr>`)}</tbody>
      </table></div>
    </section>

    <section class="card card-soft" aria-labelledby="later-h">
      <div class="card-head"><h2 id="later-h" class="card-title">Coming in reporting modules</h2></div>
      <ul class="tags"><li>Profit by wedding</li><li>Cash-flow forecast</li><li>Planner workload</li><li>Enquiry-to-booking rate</li><li>Vendor scorecards</li></ul>
    </section>`);
}

(async function boot() {
  initDevbar();
  render(await loadSeason());
})();
