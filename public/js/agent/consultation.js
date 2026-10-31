// Consultation: the appointment, the finalised transcript (paste or upload)
// and private planner notes. Transcripts and notes are agency-only; the
// server never includes them in a couple's response.
import { html, fmtDateTime, pill, emptyState } from '../core/ui.js';
import { api } from '../core/api.js';
import { FORMAT, TOPIC, select, field, card, dtLocal } from './common.js';

const STATUS = { requested: 'Requested by couple', confirmed: 'Confirmed', completed: 'Held', cancelled: 'Cancelled' };

function appointmentForm(name, a, ctx, submit) {
  return html`
    <form data-form="${name}" ${a ? `data-id=${a.id}` : ''} class="form-grid">
      ${field('Date and time', html`<input type="datetime-local" name="scheduledAt" value="${dtLocal(a?.scheduledAt || a?.preferredAt)}" required>`)}
      ${field('Format', select('format', FORMAT, a?.format || 'video'))}
      ${field('Video link', html`<input type="url" name="meetingLink" value="${a?.meetingLink || ctx.dir.meetingLinkDefault || ''}" placeholder="https://…">`, 'Paste the room link from your calendar. Shared with the couple once confirmed.')}
      ${field('Place', html`<input name="place" value="${a?.place || ''}" placeholder="For in-person meetings">`)}
      <label class="field form-span"><span class="field-label">Message to the couple <span class="optional">optional</span></span><textarea name="plannerMessage" rows="2">${a?.plannerMessage || ''}</textarea></label>
      <div class="row-end form-span"><button class="btn" type="submit">${submit}</button></div>
    </form>`;
}

function appointments(c, ctx) {
  const live = c.appointments.find((a) => a.status === 'requested' || a.status === 'confirmed');
  const past = c.appointments.filter((a) => a !== live);
  const row = (a) => html`
    <dl class="kv">
      <div><dt>Status</dt><dd>${pill(a.status, STATUS[a.status])}</dd></div>
      <div><dt>${a.status === 'requested' ? 'Couple prefers' : 'When'}</dt><dd>${fmtDateTime(a.status === 'requested' ? a.preferredAt : a.scheduledAt || a.preferredAt)}</dd></div>
      <div><dt>Format</dt><dd>${FORMAT[a.format]}${a.place ? ` · ${a.place}` : ''}</dd></div>
      ${a.otherTimes ? html`<div><dt>Other times</dt><dd>${a.otherTimes}</dd></div>` : ''}
      ${a.coupleNote ? html`<div><dt>Couple’s note</dt><dd>${a.coupleNote}</dd></div>` : ''}
      ${a.meetingLink ? html`<div><dt>Link</dt><dd><a href="${a.meetingLink}" target="_blank" rel="noopener noreferrer">${a.meetingLink}</a></dd></div>` : ''}
    </dl>`;
  let body;
  if (!live) {
    body = html`${past[0] ? row(past[0]) : emptyState({ icon: 'calendar', title: 'No consultation yet', body: 'The couple can request one from their portal, or schedule it here.' })}
      <details class="add-task" ${past[0]?.status === 'completed' ? '' : 'open'}><summary>Schedule a consultation</summary>${appointmentForm('appt-new', null, ctx, 'Schedule and confirm')}</details>`;
  } else if (live.status === 'requested') {
    body = html`${row(live)}<h3 class="sub-h">Confirm this consultation</h3>${appointmentForm('appt-confirm', live, ctx, 'Confirm with the couple')}
      <div class="row-end"><button class="btn btn-ghost btn-small" type="button" data-action="appt-status" data-id="${live.id}" data-status="cancelled">Decline request</button></div>`;
  } else {
    body = html`${row(live)}
      <div class="row-end">
        <button class="btn btn-ghost btn-small" type="button" data-action="appt-status" data-id="${live.id}" data-status="cancelled">Cancel</button>
        <button class="btn" type="button" data-action="appt-status" data-id="${live.id}" data-status="completed">Mark as held</button>
      </div>
      <details class="add-task"><summary>Change time, format or link</summary>${appointmentForm('appt-confirm', live, ctx, 'Save changes')}</details>`;
  }
  return card({ title: 'Consultation', kind: 'shared', label: 'Time and link shared with couple' }, body);
}

function transcripts(c) {
  const list = c.transcripts.map((t) => html`
    <li class="doc-item">
      <div class="doc-item-head">
        <strong>${t.title || 'Transcript'}</strong>
        ${pill(t.status === 'final' ? 'final' : 'draft', t.status === 'final' ? 'Final' : 'Draft')}
        <span class="muted small">${t.source === 'uploaded' ? `Uploaded file · ${t.originalName}` : 'Pasted text'} · ${t.author || 'Planner'} · ${fmtDateTime(t.createdAt)}</span>
      </div>
      <details><summary>Read transcript (${t.content.length.toLocaleString('en-IN')} characters)</summary><pre class="transcript">${t.content}</pre></details>
      <div class="row-end">
        <button class="link-btn" type="button" data-action="transcript-status" data-id="${t.id}" data-status="${t.status === 'final' ? 'draft' : 'final'}">Mark as ${t.status === 'final' ? 'draft' : 'final'}</button>
        <button class="link-btn text-risk" type="button" data-action="transcript-delete" data-id="${t.id}">Delete</button>
      </div>
    </li>`);
  return card({ title: 'Meeting transcript', kind: 'internal', label: 'Agency only', extra: html`<span class="muted small">Manual · no live transcription connected</span>` }, html`
    ${list.length ? html`<ul class="doc-list">${list}</ul>` : emptyState({ icon: 'doc', title: 'No transcript yet', body: 'Paste the finalised transcript, or upload the text file your meeting tool exported.' })}
    <details class="add-task" ${list.length ? '' : 'open'}>
      <summary>Add a transcript</summary>
      <form data-form="transcript-paste" class="form-stack">
        <div class="form-grid">
          ${field('Title', html`<input name="title" maxlength="120" placeholder="e.g. First consultation">`)}
          ${field('Status', select('status', { final: 'Final', draft: 'Draft' }, 'final'))}
        </div>
        ${field('Paste the transcript', html`<textarea name="content" rows="6" required></textarea>`)}
        <div class="row-end"><button class="btn" type="submit">Save transcript</button></div>
      </form>
      <form data-form="transcript-upload" class="form-row upload-row">
        <label class="field field-grow"><span class="field-label">…or upload a text file</span><input type="file" name="file" accept=".txt,.vtt,.srt,.md,text/plain" required></label>
        <button class="btn btn-ghost" type="submit">Upload</button>
      </form>
      <p class="muted small">Plain-text transcripts (.txt, .vtt, .srt, .md) up to ${ctxLimit} KB. Stored privately with this wedding.</p>
    </details>`);
}
const ctxLimit = 512;

function notes(c) {
  return card({ title: 'Private notes', kind: 'internal', label: 'Agency only' }, html`
    <form data-form="note" class="note-form">
      <div class="form-row">
        <label class="field field-inline"><span class="field-label">Topic</span>${select('topic', TOPIC, 'general')}</label>
      </div>
      <label class="field"><span class="field-label sr-only">Note</span><textarea name="body" rows="3" required placeholder="Emotions, family context, practical constraints, cultural nuance…"></textarea></label>
      <div class="row-end"><button class="btn" type="submit">Add note</button></div>
    </form>
    ${c.notes.length ? html`<ul class="notes">${c.notes.map((n) => html`
      <li>
        <p><span class="topic topic-${n.topic}">${TOPIC[n.topic]}</span> ${n.body}</p>
        <span class="muted small">${n.author || 'Planner'} · ${fmtDateTime(n.createdAt)} · <button class="link-btn" type="button" data-action="note-delete" data-id="${n.id}">Delete</button></span>
      </li>`)}</ul>` : emptyState({ title: 'No notes yet' })}`);
}

export default {
  id: 'consultation',
  label: 'Consultation & notes',
  view: (ctx) => html`<div class="ws-grid"><div class="ws-col">${appointments(ctx.c, ctx)}${transcripts(ctx.c)}</div><div class="ws-col">${notes(ctx.c)}</div></div>`,
  actions: {
    'appt-status': (t, ctx) => ctx.call('PATCH', `/appointments/${t.dataset.id}`, { status: t.dataset.status }),
    'transcript-status': (t, ctx) => ctx.call('PATCH', `/transcripts/${t.dataset.id}`, { status: t.dataset.status }),
    'transcript-delete': (t, ctx) => (confirm('Delete this transcript? This cannot be undone.') ? ctx.call('DELETE', `/transcripts/${t.dataset.id}`) : null),
    'note-delete': (t, ctx) => (confirm('Delete this note?') ? ctx.call('DELETE', `/notes/${t.dataset.id}`) : null),
  },
  forms: {
    'appt-new': (v, ctx) => ctx.call('POST', '/appointments', v),
    'appt-confirm': (v, ctx, form) => ctx.call('PATCH', `/appointments/${form.dataset.id}`, { ...v, status: 'confirmed' }),
    'transcript-paste': (v, ctx) => ctx.call('POST', '/transcripts', v),
    'transcript-upload': (v, ctx, form) => {
      const file = form.elements.file.files[0];
      if (!file) return null;
      return api.upload(`${ctx.base}/transcripts/upload`, file, { 'x-transcript-title': encodeURIComponent(file.name.replace(/\.[^.]+$/, '')) });
    },
    note: (v, ctx) => ctx.call('POST', '/notes', v),
  },
  success: { 'appt-new': 'Consultation scheduled.', 'appt-confirm': 'Saved. The couple can see the confirmed time.', 'transcript-paste': 'Transcript saved.', 'transcript-upload': 'Transcript uploaded.', note: 'Note added.' },
};
