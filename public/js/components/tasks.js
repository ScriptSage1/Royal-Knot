// Task/checklist board: many tasks grouped by stage, filterable by owner type
// and status. Actions: data-action="task-status" data-index | form data-form="add-task"
// Filters: select[data-filter="ownerType"|"status"]
import { html, fmtDate, pill, emptyState, esc } from '../core/ui.js';
import { renderProgressBar } from './journey.js';

export const TASK_STATUSES = ['Pending', 'In progress', 'Done', 'Blocked'];
export const OWNER_TYPES = ['Agency', 'Couple', 'Vendor'];

export function renderTasks(tasks, filters = {}) {
  const shown = tasks
    .map((t, i) => ({ ...t, i }))
    .filter((t) => (!filters.ownerType || t.ownerType === filters.ownerType) && (!filters.status || t.status === filters.status));
  const stages = [...new Set(shown.map((t) => t.stage))];
  const done = tasks.filter((t) => t.status === 'Done').length;
  const today = new Date().toISOString().slice(0, 10);

  const select = (name, label, opts) => html`
    <label class="field field-inline"><span class="field-label">${label}</span>
      <select data-filter="${name}"><option value="">All</option>${opts.map((o) => html`<option ${filters[name] === o ? 'selected' : ''}>${o}</option>`)}</select>
    </label>`;

  return html`
    <section class="card" aria-labelledby="tasks-h">
      <div class="card-head">
        <h2 id="tasks-h" class="card-title">Wedding tasks</h2>
        <span class="muted small">${done} of ${tasks.length} done</span>
      </div>
      ${tasks.length ? renderProgressBar(tasks.length ? done / tasks.length : 0, 'Task completion') : ''}
      <div class="toolbar">
        ${select('ownerType', 'Owner', OWNER_TYPES)}
        ${select('status', 'Status', TASK_STATUSES)}
      </div>
      ${!tasks.length ? emptyState({ title: 'No tasks yet', body: 'Tasks are created from the requirements and planner checklist.' })
        : !shown.length ? emptyState({ title: 'No tasks match these filters' })
        : stages.map((stage) => html`
          <div class="task-group">
            <h3 class="task-group-title">${stage}</h3>
            <ul class="tasks">
              ${shown.filter((t) => t.stage === stage).map((t) => html`
                <li class="task ${t.status === 'Done' ? 'is-done' : ''}">
                  <span class="task-title">${t.title}</span>
                  <span class="task-owner"><span class="owner-type owner-${t.ownerType.toLowerCase()}">${t.ownerType}</span>${t.owner}</span>
                  <span class="task-due ${t.status !== 'Done' && t.due < today ? 'is-late' : ''}">${fmtDate(t.due)}</span>
                  <button class="pill-btn" type="button" data-action="task-status" data-index="${t.i}" title="Change status (preview)">${pill(t.status)}<span class="sr-only">, change status</span></button>
                </li>`)}
            </ul>
          </div>`)}
      <details class="add-task">
        <summary>Add a task</summary>
        <form data-form="add-task" class="form-grid">
          <label class="field"><span class="field-label">Task</span><input name="title" required></label>
          <label class="field"><span class="field-label">Owner</span><input name="owner" required placeholder="Name or vendor"></label>
          <label class="field"><span class="field-label">Owner type</span><select name="ownerType">${OWNER_TYPES.map((o) => html`<option>${o}</option>`)}</select></label>
          <label class="field"><span class="field-label">Stage</span><input name="stage" required list="task-stages" placeholder="e.g. Logistics"></label>
          <datalist id="task-stages">${[...new Set(tasks.map((t) => t.stage))].map((s) => html`<option value="${esc(s)}">`)}</datalist>
          <label class="field"><span class="field-label">Due</span><input type="date" name="due" required></label>
          <div class="row-end form-span"><span class="muted small">Added to this preview only — not saved.</span><button class="btn" type="submit">Add task</button></div>
        </form>
      </details>
    </section>`;
}
