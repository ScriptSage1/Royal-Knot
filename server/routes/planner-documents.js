// Planner: requirements drafts and the planning checklist (tasks).
// Mounted on the per-wedding router, so req.wedding is already authorised.
const { one, all, run, tx } = require('../db');
const { badRequest, notFound, conflict, HttpError } = require('../lib/errors');
const { nowISO, addDays, today } = require('../lib/dates');
const { touch } = require('../services/weddings');
const D = require('../services/drafting');
const v = require('../lib/validate');

const TASK_STATUS = ['todo', 'in_progress', 'done', 'blocked'];
const OWNERS = ['agency', 'couple', 'vendor'];

module.exports = function register(w, send) {
  const nextVersion = (wid) => (one('SELECT MAX(version) AS n FROM requirements_docs WHERE wedding_id = ?', wid).n || 0) + 1;
  const saveDraft = (req, { sections, checklist, conflicts = [], generator, meta = null }) => {
    run(`INSERT INTO requirements_docs (wedding_id, version, generator, generator_meta, sections_json, checklist_json, conflicts_json, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    req.wedding.id, nextVersion(req.wedding.id), generator, meta ? JSON.stringify(meta) : '',
    JSON.stringify(sections), JSON.stringify(checklist), JSON.stringify(conflicts), req.user.id);
    touch(req.wedding.id);
  };

  // method: "claude" (Claude CLI), "template" (manual skeleton) or "copy"
  // (start a new version from the latest one).
  w.post('/requirements/draft', async (req, res, next) => {
    try {
      const method = v.oneOf(req.body.method, ['claude', 'template', 'copy'], { field: 'Method' });
      if (method === 'copy') {
        const last = one('SELECT * FROM requirements_docs WHERE wedding_id = ? ORDER BY version DESC LIMIT 1', req.wedding.id);
        if (!last) throw badRequest('There is no earlier version to copy.');
        saveDraft(req, { sections: JSON.parse(last.sections_json), checklist: JSON.parse(last.checklist_json), generator: 'manual', meta: { copiedFrom: last.version } });
        return send(req, res);
      }
      const notes = all('SELECT topic, body FROM planner_notes WHERE wedding_id = ? ORDER BY created_at', req.wedding.id);
      if (method === 'template') {
        saveDraft(req, { ...D.templateDraft(req.wedding), generator: 'template' });
        return send(req, res);
      }
      const transcripts = all(`SELECT source, status, title, content FROM transcripts WHERE wedding_id = ? ORDER BY status = 'final' DESC, created_at`, req.wedding.id);
      if (!transcripts.length && !notes.length) throw badRequest('Add a transcript or planner notes before drafting with Claude.');
      let draft;
      try {
        draft = await D.draftWithClaude(req.wedding, transcripts, notes);
      } catch (err) {
        if (err.kind) {
          console.warn(`[drafting] Claude CLI ${err.kind} for wedding ${req.wedding.id}`);
          throw new HttpError(err.kind === 'disabled' ? 409 : 502, err.message);
        }
        throw err;
      }
      saveDraft(req, { ...draft, generator: 'claude_cli' });
      send(req, res);
    } catch (err) { next(err); }
  });

  const draftDoc = (req) => {
    const d = one('SELECT * FROM requirements_docs WHERE id = ? AND wedding_id = ?', v.id(req.params.id), req.wedding.id);
    if (!d) throw notFound('Document not found.');
    return d;
  };

  // Planner edits. Approved versions are frozen; copy to a new version to change them.
  w.put('/requirements/:id', (req, res) => {
    const d = draftDoc(req);
    if (d.status !== 'draft') throw conflict('This version is approved. Start a new version to make changes.');
    let sections, checklist;
    try {
      sections = D.validateSections(req.body.sections);
      checklist = D.validateChecklist(req.body.checklist || []);
    } catch (e) {
      throw badRequest(`Check the document: ${e.message}.`);
    }
    run('UPDATE requirements_docs SET sections_json = ?, checklist_json = ?, updated_at = ? WHERE id = ?', JSON.stringify(sections), JSON.stringify(checklist), nowISO(), d.id);
    send(req, res);
  });

  // Approval freezes the version and turns its checklist into tasks.
  // Couple-owned items are shared with the couple; the rest stay internal.
  w.post('/requirements/:id/approve', (req, res) => {
    const d = draftDoc(req);
    if (d.status !== 'draft') throw conflict('This version is already approved.');
    const sections = JSON.parse(d.sections_json);
    if (!sections.length || sections.every((s) => !s.items.length)) throw badRequest('Add content before approving.');
    if (sections.some((s) => s.items.some((i) => i.startsWith('[To complete]')))) throw badRequest('Complete or remove every “[To complete]” line before approving.');
    tx(() => {
      run(`UPDATE requirements_docs SET status = 'approved', approved_by = ?, approved_at = ?, updated_at = ? WHERE id = ?`, req.user.id, nowISO(), nowISO(), d.id);
      for (const c of JSON.parse(d.checklist_json)) {
        run(`INSERT INTO tasks (wedding_id, title, owner_type, owner_label, due_date, notes, shared, source) VALUES (?, ?, ?, ?, ?, ?, ?, 'requirements')`,
          req.wedding.id, c.task, c.owner, '', c.dueInDays == null ? null : addDays(today(), c.dueInDays), c.notes || '', c.owner === 'couple' ? 1 : 0);
      }
    });
    touch(req.wedding.id);
    send(req, res);
  });

  w.post('/requirements/:id/share', (req, res) => {
    const d = draftDoc(req);
    if (d.status !== 'approved') throw conflict('Approve this version before sharing it.');
    run('UPDATE requirements_docs SET shared_at = COALESCE(shared_at, ?), updated_at = ? WHERE id = ?', nowISO(), nowISO(), d.id);
    touch(req.wedding.id);
    send(req, res);
  });

  w.delete('/requirements/:id', (req, res) => {
    const d = draftDoc(req);
    if (d.status !== 'draft') throw conflict('Approved versions are kept as a record.');
    run('DELETE FROM requirements_docs WHERE id = ?', d.id);
    send(req, res);
  });

  // ---------- tasks ----------
  const taskFields = (b, t = {}) => ({
    title: b.title === undefined ? t.title : v.line(b.title, { field: 'Task', max: 200, required: true }),
    owner_type: b.ownerType === undefined ? t.owner_type || 'agency' : v.oneOf(b.ownerType, OWNERS, { field: 'Owner' }),
    owner_label: b.ownerLabel === undefined ? t.owner_label || '' : v.line(b.ownerLabel, { field: 'Owner name', max: 80 }),
    due_date: b.dueDate === undefined ? t.due_date ?? null : v.date(b.dueDate, { field: 'Due date' }),
    status: b.status === undefined ? t.status || 'todo' : v.oneOf(b.status, TASK_STATUS, { field: 'Status' }),
    notes: b.notes === undefined ? t.notes || '' : v.text(b.notes, { field: 'Notes', max: 1500 }),
    shared: b.shared === undefined ? t.shared || 0 : (v.bool(b.shared) ? 1 : 0),
  });

  w.post('/tasks', (req, res) => {
    const f = taskFields(req.body);
    if (!f.title) throw badRequest('Task is required.');
    run('INSERT INTO tasks (wedding_id, title, owner_type, owner_label, due_date, status, notes, shared) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      req.wedding.id, f.title, f.owner_type, f.owner_label, f.due_date, f.status, f.notes, f.shared);
    touch(req.wedding.id);
    send(req, res);
  });

  w.patch('/tasks/:id', (req, res) => {
    const t = one('SELECT * FROM tasks WHERE id = ? AND wedding_id = ?', v.id(req.params.id), req.wedding.id);
    if (!t) throw notFound('Task not found.');
    const f = taskFields(req.body, t);
    run('UPDATE tasks SET title = ?, owner_type = ?, owner_label = ?, due_date = ?, status = ?, notes = ?, shared = ?, updated_at = ? WHERE id = ?',
      f.title, f.owner_type, f.owner_label, f.due_date, f.status, f.notes, f.shared, nowISO(), t.id);
    touch(req.wedding.id);
    send(req, res);
  });

  w.delete('/tasks/:id', (req, res) => {
    const r = run('DELETE FROM tasks WHERE id = ? AND wedding_id = ?', v.id(req.params.id), req.wedding.id);
    if (!r.changes) throw notFound('Task not found.');
    send(req, res);
  });
};
