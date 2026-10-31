// Events grouped by day. `extra(event)` adds audience-specific detail
// (the planner's owner, internal note and controls).
import { html, fmtDay, fmtTime } from '../core/ui.js';

export function groupByDate(events) {
  const days = new Map();
  for (const e of events) {
    if (!days.has(e.date)) days.set(e.date, []);
    days.get(e.date).push(e);
  }
  return [...days.entries()];
}

export function renderEvents(events, { extra = null } = {}) {
  return html`
    <div class="couple-events">
      ${groupByDate(events).map(([date, list], i) => html`
        <section class="day" aria-label="Day ${i + 1}">
          <h3 class="day-title"><span>Day ${i + 1}</span> ${fmtDay(date)}</h3>
          ${list.map((e) => html`
            <article class="event">
              <div class="event-time"><strong>${fmtTime(e.start) || 'Time TBC'}</strong><span>${fmtTime(e.end)}</span></div>
              <div class="event-body">
                <h4 class="event-name">${e.name}</h4>
                ${e.venue ? html`<p class="muted small">${e.venue}</p>` : ''}
                ${e.coupleNote ? html`<p class="small">${e.coupleNote}</p>` : ''}
                ${extra ? extra(e) : ''}
              </div>
            </article>`)}
        </section>`)}
    </div>`;
}
