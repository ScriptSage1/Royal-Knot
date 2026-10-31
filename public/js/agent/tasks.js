// Planning tasks: one list for the planner's checklist and everything after.
// Each task can be shared with the couple; couple-owned shared tasks can be
// ticked off from their portal.
import { html, fmtDate, emptyState, todayISO, visibility } from '../core/ui.js';
import { OWNER, TASK_STATUS, select, field, card } from './common.js';

export const taskUi = { owner: '', status: 'open' };

function row(t, today) {
  const late = t.status !== 'done' && t.dueDate && t.dueDate < today;
  return html`
    <li class="task ${t.status === 'done' ? 'is-done' : ''}">
      <span class="task-title">${t.title}${t.notes ? html`<small class="cell-sub">${t.notes}</small>` : ''}</span>
      <span class="task-owner"><span class="owner-type owner-${t.ownerType}">${OWNER[t.ownerType]}</span>${t.ownerLabel}</span>
      <span class="task-due ${late ? 'is-late' : ''}">${t.dueDate ? fmtDate(t.dueDate) : 'No date'}</span>
      <button class="link-btn vis-toggle" type="button" data-action="task-share" data-id="${t.id}" data-shared="${t.shared ? 'false' : 'true'}" title="${t.shared ? 'Visible to the couple. Click to make internal.' : 'Agency only. Click to share with the couple.'}">${t.shared ? visibility('shared', 'Shared') : visibility('internal', 'Internal')}</button>
      <label class="task-status"><span class="sr-only">Status for ${t.title}</span>
        <select data-action="task-status" data-id="${t.id}">${Object.entries(TASK_STATUS).map(([v, l]) => html`<option value="${v}" ${t.status === v ? 'selected' : ''}>${l}</option>`)}</select></label>
    </li>`;
}

function view(ctx) {
  const all = ctx.c.tasks;
  const today = todayISO();
  const shown = all.filter((t) => (!taskUi.owner || t.ownerType === taskUi.owner)
    && (taskUi.status === 'all' || (taskUi.status === 'open' ? t.status !== 'done' : t.status === taskUi.status)));
  const done = all.filter((t) => t.status === 'done').length;
  return card({ title: 'Planning tasks', kind: 'internal', label: 'Internal unless shared', extra: html`<span class="muted small">${done} of ${all.length} done</span>` }, html`
    <div class="toolbar">
      <label class="field field-inline"><span class="field-label">Owner</span>${select('owner', { '': 'Everyone', ...OWNER }, taskUi.owner, 'data-task-filter')}</label>
      <label class="field field-inline"><span class="field-label">Show</span>${select('status', { open: 'Open', all: 'All', ...TASK_STATUS }, taskUi.status, 'data-task-filter')}</label>
    </div>
    ${!all.length ? emptyState({ title: 'No tasks yet', body: 'Approving the requirements adds the checklist here.' })
      : shown.length ? html`<ul class="tasks">${shown.map((t) => row(t, today))}</ul>` : emptyState({ title: 'Nothing matches these filters' })}
    <details class="add-task"><summary>Add a task</summary>
      <form data-form="task-new" class="form-grid">
        <label class="field form-span"><span class="field-label">Task</span><input name="title" required maxlength="200"></label>
        ${field('Owner', select('ownerType', OWNER, 'agency'))}
        ${field('Owner name', html`<input name="ownerLabel" placeholder="Person or vendor">`)}
        ${field('Due', html`<input type="date" name="dueDate">`)}
        ${field('Notes', html`<input name="notes">`)}
        <label class="check form-span"><input type="checkbox" name="shared"><span>Show this task to the couple</span></label>
        <div class="row-end form-span"><button class="btn" type="submit">Add task</button></div>
      </form>
    </details>`);
}

export default {
  id: 'tasks',
  label: 'Tasks',
  view,
  actions: {
    'task-share': (t, ctx) => ctx.call('PATCH', `/tasks/${t.dataset.id}`, { shared: t.dataset.shared === 'true' }),
  },
  changes: {
    'task-status': (t, ctx) => ctx.call('PATCH', `/tasks/${t.dataset.id}`, { status: t.value }),
  },
  forms: { 'task-new': (v, ctx) => ctx.call('POST', '/tasks', v) },
  success: { 'task-new': 'Task added.' },
};

