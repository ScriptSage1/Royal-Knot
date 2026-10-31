// Meeting area: appointment details, meeting link and transcript placeholders,
// and the internal-only agent notes. Notes typed here live in page memory only.
// Actions (handled by the page): data-action="meet-link" | "add-note"
import { html, fmtDate, futureTag, emptyState, pill, visibility } from '../core/ui.js';

export function renderMeeting(m) {
  const rows = [
    ['Status', pill(m.status)],
    ['Date', m.date ? fmtDate(m.date) : 'Not set'],
    ['Time', m.time ? `${m.time}${m.duration ? ` · ${m.duration}` : ''}` : 'Not set'],
    ['Format', m.mode || 'Not set'],
    ['Attendees', m.attendees.length ? m.attendees.join(', ') : '—'],
  ];
  return html`
    <section class="card" aria-labelledby="mt-h">
      <div class="card-head"><h2 id="mt-h" class="card-title">Consultation appointment</h2>${futureTag('Scheduling')}</div>
      <dl class="kv">${rows.map(([k, v]) => html`<div><dt>${k}</dt><dd>${v}</dd></div>`)}</dl>
      <div class="placeholder-row">
        <div>
          <p class="placeholder-title">Google Meet link</p>
          <p class="muted small">${m.meetLink ? m.meetLink : 'No link yet.'}</p>
        </div>
        <button class="btn btn-ghost" type="button" data-action="meet-link" ${m.meetLink ? '' : 'aria-disabled=true'}>Join meeting</button>
      </div>
    </section>
    <section class="card" aria-labelledby="tr-h">
      <div class="card-head"><h2 id="tr-h" class="card-title">Meeting transcript</h2>${visibility('internal')}${futureTag('Transcript capture')}</div>
      ${m.transcript ? html`<pre class="transcript">${m.transcript}</pre>` : emptyState({ icon: 'doc', title: 'No transcript yet' })}
    </section>`;
}

export function renderAgentNotes(notes) {
  return html`
    <section class="card card-internal" aria-labelledby="notes-h">
      <div class="card-head"><h2 id="notes-h" class="card-title">Agent notes</h2>${visibility('internal', 'Internal only')}</div>
      <form class="note-form" data-form="add-note">
        <label class="field">
          <span class="field-label">Add a note</span>
          <textarea name="note" rows="3" placeholder="Add a private note…"></textarea>
        </label>
        <div class="row-end">
          <span class="muted small">Preview only · not saved.</span>
          <button class="btn" type="submit">Add note</button>
        </div>
      </form>
      ${notes.length ? html`
        <ul class="notes">
          ${notes.slice().reverse().map((n) => html`
            <li>
              <p>${n.text}</p>
              <span class="muted small">${n.author} · ${n.at ? new Date(n.at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : ''}${n.unsaved ? html` · <span class="pill pill-warn">Not saved</span>` : ''}</span>
            </li>`)}
        </ul>` : emptyState({ title: 'No notes yet' })}
    </section>`;
}
