// Multi-day wedding schedule. Agents see owners and vendor arrival tracking;
// couples see times, venues and notes only.
// Actions (agent): data-action="arrival" data-day data-event data-vendor
import { html, fmtDay, pill, emptyState, futureTag, visibility } from '../core/ui.js';

export const ARRIVAL_FLOW = ['Not confirmed', 'Expected', 'Arrived', 'Delayed'];

export function renderAgentSchedule(days) {
  if (!days.length) {
    return html`<section class="card"><div class="card-head"><h2 class="card-title">Wedding schedule</h2></div>
      ${emptyState({ icon: 'calendar', title: 'No events scheduled yet', body: 'Add functions and days once the requirements are approved.' })}</section>`;
  }
  const vendorsTotal = days.flatMap((d) => d.events.flatMap((e) => e.vendors));
  const arrived = vendorsTotal.filter((v) => v.status === 'Arrived').length;
  return html`
    <section class="card" aria-labelledby="sch-h">
      <div class="card-head">
        <h2 id="sch-h" class="card-title">Wedding schedule &amp; day-of tracking</h2>
        ${visibility('shared', 'Times shared · arrivals internal')}
        <span class="muted small">${days.length} days · ${arrived}/${vendorsTotal.length} arrivals checked in</span>
        ${futureTag('Live day-of updates')}
      </div>
      ${days.map((d, di) => html`
        <div class="day">
          <h3 class="day-title"><span>${d.label}</span> ${fmtDay(d.date)}</h3>
          ${d.events.map((e, ei) => html`
            <article class="event">
              <div class="event-time"><strong>${e.start}</strong><span>${e.end}</span></div>
              <div class="event-body">
                <h4 class="event-name">${e.name}</h4>
                <p class="muted small">${e.venue} · Owner: ${e.owner}</p>
                ${e.vendors.length ? html`
                  <ul class="arrivals" aria-label="Vendor arrivals for ${e.name}">
                    ${e.vendors.map((v, vi) => html`
                      <li>
                        <span class="arrival-name">${v.name}<small class="muted"> · ${v.role}</small></span>
                        <span class="arrival-time">Arrive ${v.arrival}</span>
                        <button class="pill-btn" type="button" data-action="arrival" data-day="${di}" data-event="${ei}" data-vendor="${vi}" title="Change arrival status (preview)">${pill(v.status)}<span class="sr-only">, change arrival status</span></button>
                      </li>`)}
                  </ul>` : html`<p class="muted small">No vendors assigned.</p>`}
              </div>
            </article>`)}
        </div>`)}
    </section>`;
}

export function renderCoupleEvents(days, { dayOf = [], final = false } = {}) {
  if (!days.length) return emptyState({ icon: 'calendar', title: 'Your events will appear here', body: 'Once your vendors are confirmed, your planner will build the schedule.' });
  return html`
    <div class="couple-events">
      ${days.map((d) => html`
        <section class="day" aria-label="${d.label}">
          <h3 class="day-title"><span>${d.label}</span> ${fmtDay(d.date)}</h3>
          ${d.items.map((e) => html`
            <article class="event">
              <div class="event-time"><strong>${e.start}</strong><span>${e.end}</span></div>
              <div class="event-body">
                <h4 class="event-name">${e.name}</h4>
                <p class="muted small">${e.venue}</p>
                ${e.note ? html`<p class="small">${e.note}</p>` : ''}
              </div>
            </article>`)}
        </section>`)}
${dayOf.length ? html`      <section class="card card-soft" aria-labelledby="dayof-h">
        <div class="card-head"><h3 id="dayof-h" class="card-title">On the day</h3>${pill(final ? 'Confirmed' : 'Draft', final ? 'Final' : 'Draft schedule')}</div>
        <ul class="list">${dayOf.map((p) => html`<li class="list-row"><span class="muted">${p.role}</span><strong>${p.name}</strong></li>`)}</ul>
        <p class="muted small">Contact details will be shared closer to the date.</p>
      </section>` : ''}
    </div>`;
}
