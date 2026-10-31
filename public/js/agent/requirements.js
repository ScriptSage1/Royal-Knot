// Requirements document and planner checklist. Drafts come from the Claude
// CLI (when the server has it configured) or from a template the planner
// completes by hand; either way the planner edits and approves before
// anything is shared. Approval turns the checklist into tasks.
import { html, fmtDateTime, pill } from '../core/ui.js';
import { renderRequirementsDoc } from '../components/documents.js';
import { OWNER, TOPIC, select, card } from './common.js';

const GEN = { claude_cli: 'Drafted by Claude', template: 'Template draft, completed by hand', manual: 'Written by the planner' };

function generatorLine(d) {
  const m = d.generatorMeta || {};
  if (d.generator === 'claude_cli') return `${GEN.claude_cli} (${m.model || 'model'}, ${m.effort || 'default'} effort${m.attempts > 1 ? `, retried: ${m.retryReason}` : ''}, prompt ${m.promptVersion}) · reviewed by the planner before approval`;
  if (m.copiedFrom) return `Copied from version ${m.copiedFrom}`;
  return GEN[d.generator];
}

function startCard(ctx) {
  const cli = ctx.dir.drafting.claudeCli;
  const hasInputs = ctx.c.transcripts.length || ctx.c.notes.length;
  return card({ title: 'Draft the requirements', kind: 'internal', label: 'Draft · agency only' }, html`
    <p>Start a first draft of the requirements document and your checklist. You’ll edit and approve it before anyone else sees it.</p>
    <div class="draft-options">
      <div class="draft-option">
        <h3>Draft with Claude</h3>
        ${cli
          ? html`<p class="muted small">Runs the Claude CLI on the server (${ctx.dir.drafting.model}, ${ctx.dir.drafting.effort} effort) with the full transcript and your notes as untrusted input. No tools or files are available to it.</p>
            <button class="btn" type="button" data-action="draft" data-method="claude" ${hasInputs ? '' : 'disabled'}>Draft with Claude</button>
            ${hasInputs ? '' : html`<p class="muted small">Add a transcript or notes first.</p>`}`
          : html`<p class="muted small">Not configured on this server. Set <code>CLAUDE_CLI_COMMAND</code> to a signed-in Claude Code CLI to enable it.</p>`}
      </div>
      <div class="draft-option">
        <h3>Start from the template</h3>
        <p class="muted small">A structured outline filled with what the couple shared and your notes. Complete the “[To complete]” lines yourself.</p>
        <button class="btn ${cli ? 'btn-ghost' : ''}" type="button" data-action="draft" data-method="template">Use the template</button>
      </div>
    </div>`);
}

function conflictsPanel(d) {
  if (!d.conflicts.length) return '';
  return html`
    <div class="conflicts" role="note">
      <p><strong>Check these before approving.</strong> The transcript and your notes disagree:</p>
      <ul>${d.conflicts.map((c) => html`<li>${pill(c.severity === 'significant' ? 'overdue' : 'due', c.severity === 'significant' ? 'Significant' : 'Minor')} <strong>${c.topic}</strong>: transcript says “${c.transcript}”; notes say “${c.notes}”.</li>`)}</ul>
    </div>`;
}

function editor(d) {
  const blankSections = [{ title: '', items: [] }];
  const blankChecks = [{ task: '', owner: 'agency', dueInDays: null, notes: '' }, { task: '', owner: 'agency', dueInDays: null, notes: '' }];
  return html`
    <form data-form="doc-save" data-id="${d.id}" class="doc-editor">
      <h3 class="sub-h">Requirements document</h3>
      <p class="muted small">One line per item. Leave a section title blank to remove it.</p>
      ${[...d.sections, ...blankSections].map((s, i) => html`
        <fieldset class="doc-edit-section">
          <legend class="sr-only">Section ${i + 1}</legend>
          <input class="doc-edit-title" name="title-${i}" value="${s.title}" placeholder="${i >= d.sections.length ? 'Add a section…' : 'Section title'}" aria-label="Section ${i + 1} title">
          <textarea name="items-${i}" rows="${Math.max(2, s.items.length + 1)}" aria-label="Section ${i + 1} items, one per line">${s.items.join('\n')}</textarea>
        </fieldset>`)}
      <h3 class="sub-h">Planner checklist <span class="muted small">becomes tasks when you approve</span></h3>
      <div class="table-wrap"><table class="table check-edit">
        <thead><tr><th scope="col">Task</th><th scope="col">Owner</th><th scope="col">Due in (days)</th><th scope="col">Notes</th></tr></thead>
        <tbody>${[...d.checklist, ...blankChecks].map((c, i) => html`<tr>
          <td><input name="task-${i}" value="${c.task}" aria-label="Task ${i + 1}" placeholder="${i >= d.checklist.length ? 'Add a task…' : ''}"></td>
          <td>${select(`owner-${i}`, OWNER, c.owner)}</td>
          <td><input type="number" min="0" max="730" name="due-${i}" value="${c.dueInDays ?? ''}" aria-label="Due in days, task ${i + 1}"></td>
          <td><input name="notes-${i}" value="${c.notes}" aria-label="Notes, task ${i + 1}"></td></tr>`)}</tbody>
      </table></div>
      <div class="row-end">
        <button class="btn btn-ghost btn-small text-risk" type="button" data-action="doc-delete" data-id="${d.id}">Discard draft</button>
        <button class="btn btn-ghost" type="submit" name="intent" value="save">Save draft</button>
        <button class="btn" type="submit" name="intent" value="approve">Save and approve</button>
      </div>
    </form>`;
}

// Read the editor back into { sections, checklist }.
export function readEditor(form) {
  const f = form.elements;
  const sections = [], checklist = [];
  for (let i = 0; f[`title-${i}`]; i++) {
    const title = f[`title-${i}`].value.trim();
    const items = f[`items-${i}`].value.split('\n').map((x) => x.trim()).filter(Boolean);
    if (title) sections.push({ title, items });
  }
  for (let i = 0; f[`task-${i}`]; i++) {
    const task = f[`task-${i}`].value.trim();
    if (!task) continue;
    const due = f[`due-${i}`].value;
    checklist.push({ task, owner: f[`owner-${i}`].value, dueInDays: due === '' ? null : Number(due), notes: f[`notes-${i}`].value.trim() });
  }
  return { sections, checklist };
}

// Private material to draft from, shown beside the editor. It is never
// copied into the document automatically.
function reference(c) {
  return card({ title: 'For reference', kind: 'internal', label: 'Agency only' }, html`
    <p class="muted small">Your notes and the transcript stay private. Use them to complete the draft in words you’re happy for the couple to read.</p>
    ${c.notes.length ? html`<ul class="notes">${c.notes.map((n) => html`<li><p><span class="topic topic-${n.topic}">${TOPIC[n.topic]}</span> ${n.body}</p></li>`)}</ul>` : html`<p class="muted small">No notes yet.</p>`}
    ${c.transcripts.map((t) => html`<details class="doc-item"><summary>${t.title || 'Transcript'} (${t.status})</summary><pre class="transcript">${t.content}</pre></details>`)}`);
}

function current(ctx) {
  const d = ctx.c.requirements[0];
  const head = html`<span class="muted small">Version ${d.version} · ${generatorLine(d)}</span>`;
  if (d.status === 'draft') {
    return html`<div class="ws-grid ws-grid-wide"><div class="ws-col">${card({ title: 'Requirements (draft)', kind: 'internal', label: 'Draft · agency only', extra: head }, html`${conflictsPanel(d)}${editor(d)}`)}</div>
      <div class="ws-col">${reference(ctx.c)}</div></div>`;
  }
  const shared = d.sharedAt;
  return card({ title: 'Requirements', kind: shared ? 'shared' : 'internal', label: shared ? 'Shared with couple' : 'Approved · not shared yet', extra: head }, html`
    ${renderRequirementsDoc(d)}
    ${d.coupleResponse ? html`<div class="callout ${d.coupleResponse === 'changes_requested' ? 'callout-warn' : ''}">
      <strong>${d.coupleResponse === 'confirmed' ? 'The couple confirmed this plan' : 'The couple asked for changes'}</strong> · ${fmtDateTime(d.coupleRespondedAt)}
      ${d.coupleComment ? html`<p class="pre">${d.coupleComment}</p>` : ''}</div>` : ''}
    <div class="row-end">
      <button class="btn btn-ghost" type="button" data-action="draft" data-method="copy">Start a new version</button>
      ${shared ? '' : html`<button class="btn" type="button" data-action="doc-share" data-id="${d.id}">Share with the couple</button>`}
    </div>`);
}

function history(ctx) {
  if (ctx.c.requirements.length < 2) return '';
  return html`<details class="card versions"><summary>Earlier versions (${ctx.c.requirements.length - 1})</summary>
    <ul class="list">${ctx.c.requirements.slice(1).map((d) => html`<li class="list-row"><span>Version ${d.version} · ${GEN[d.generator]}</span><span class="list-row-side">${pill(d.status === 'approved' ? 'approved' : 'draft', d.status === 'approved' ? (d.sharedAt ? 'Shared' : 'Approved') : 'Draft')}</span></li>`)}</ul></details>`;
}

export default {
  id: 'requirements',
  label: 'Requirements',
  view: (ctx) => (ctx.c.requirements.length ? html`${current(ctx)}${history(ctx)}` : startCard(ctx)),
  actions: {
    draft: (t, ctx) => ctx.call('POST', '/requirements/draft', { method: t.dataset.method }, { busy: t.dataset.method === 'claude' ? 'Claude is drafting. This can take a minute…' : '' }),
    'doc-share': (t, ctx) => ctx.call('POST', `/requirements/${t.dataset.id}/share`),
    'doc-delete': (t, ctx) => (confirm('Discard this draft?') ? ctx.call('DELETE', `/requirements/${t.dataset.id}`) : null),
  },
  forms: {
    'doc-save': async (v, ctx, form, submitter) => {
      const body = readEditor(form);
      const saved = await ctx.call('PUT', `/requirements/${form.dataset.id}`, body);
      if (submitter?.value !== 'approve') return saved;
      return ctx.call('POST', `/requirements/${form.dataset.id}/approve`);
    },
  },
  success: { 'doc-save': 'Saved.' },
};

