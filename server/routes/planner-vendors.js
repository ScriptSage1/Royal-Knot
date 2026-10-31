// Planner: vendor directory, briefs, proposals, shortlists and couple
// questions. Categories are rows, not code, so any category can be added.
const { one, all, run, tx } = require('../db');
const { badRequest, notFound, conflict } = require('../lib/errors');
const { nowISO } = require('../lib/dates');
const { touch } = require('../services/weddings');
const v = require('../lib/validate');

// Find or create a category by name (case-insensitive).
function categoryId(body) {
  if (body.categoryId) {
    const c = one('SELECT id FROM vendor_categories WHERE id = ?', v.id(body.categoryId, 'Category'));
    if (!c) throw badRequest('Choose a category.');
    return c.id;
  }
  const name = v.line(body.categoryName, { field: 'Category', max: 60, required: true });
  const found = one('SELECT id FROM vendor_categories WHERE name = ?', name);
  return found ? found.id : Number(run('INSERT INTO vendor_categories (name) VALUES (?)', name).lastInsertRowid);
}

const proposalFields = (b) => ({
  amount: v.int(b.amount, { field: 'Total amount', min: 0, max: 1e10, required: true }),
  scope: v.text(b.scope, { field: 'Scope', max: 1500, required: true }),
  inclusions: v.text(b.inclusions, { field: 'Included', max: 2000 }),
  exclusions: v.text(b.exclusions, { field: 'Not included', max: 2000 }),
  extras: v.text(b.extras, { field: 'Extra charges', max: 2000 }),
  valid_until: v.date(b.validUntil, { field: 'Valid until' }),
  vendor_message: v.text(b.vendorMessage, { field: 'Message', max: 2000 }),
});

module.exports = function register(w, send) {
  // New vendor in the agency directory (optionally a new category too).
  w.post('/vendors', (req, res) => {
    run('INSERT INTO vendors (name, category_id, email, city) VALUES (?, ?, ?, ?)',
      v.line(req.body.name, { field: 'Vendor name', max: 120, required: true }), categoryId(req.body),
      req.body.email ? v.email(req.body.email) : '', v.line(req.body.city, { field: 'City', max: 80 }));
    send(req, res);
  });

  const request = (req, id = req.params.id) => {
    const r = one('SELECT * FROM vendor_requests WHERE id = ? AND wedding_id = ?', v.id(id), req.wedding.id);
    if (!r) throw notFound('Vendor request not found.');
    return r;
  };
  const vendorIds = (list) => {
    if (!Array.isArray(list)) return [];
    return [...new Set(list.map((x) => v.id(x, 'Vendor')))].filter((id) => one('SELECT 1 FROM vendors WHERE id = ?', id));
  };

  // A brief can only go out once requirements are approved.
  w.post('/vendor-requests', (req, res) => {
    if (!one(`SELECT 1 FROM requirements_docs WHERE wedding_id = ? AND status = 'approved'`, req.wedding.id)) {
      throw conflict('Approve the requirements before sending vendor briefs.');
    }
    const ids = vendorIds(req.body.vendorIds);
    tx(() => {
      const rid = Number(run('INSERT INTO vendor_requests (wedding_id, category_id, brief, budget_note, due_date, created_by) VALUES (?, ?, ?, ?, ?, ?)',
        req.wedding.id, categoryId(req.body), v.text(req.body.brief, { field: 'Brief', max: 4000, required: true }),
        v.line(req.body.budgetNote, { field: 'Budget guide', max: 160 }), v.date(req.body.dueDate, { field: 'Reply by' }), req.user.id).lastInsertRowid);
      for (const id of ids) run('INSERT INTO vendor_request_recipients (request_id, vendor_id) VALUES (?, ?)', rid, id);
    });
    touch(req.wedding.id);
    send(req, res);
  });

  w.post('/vendor-requests/:id/recipients', (req, res) => {
    const r = request(req);
    for (const id of vendorIds(req.body.vendorIds)) run('INSERT OR IGNORE INTO vendor_request_recipients (request_id, vendor_id) VALUES (?, ?)', r.id, id);
    send(req, res);
  });

  w.patch('/vendor-requests/:id', (req, res) => {
    const r = request(req);
    run('UPDATE vendor_requests SET status = ? WHERE id = ?', v.oneOf(req.body.status, ['open', 'closed'], { field: 'Status' }), r.id);
    send(req, res);
  });

  // A proposal received by email, phone or in person.
  w.post('/vendor-requests/:id/proposals', (req, res) => {
    const r = request(req);
    const vendorId = v.id(req.body.vendorId, 'Vendor');
    if (!one('SELECT 1 FROM vendors WHERE id = ?', vendorId)) throw badRequest('Choose a vendor.');
    if (one('SELECT 1 FROM proposals WHERE request_id = ? AND vendor_id = ?', r.id, vendorId)) throw conflict('This vendor already has a proposal on this request. Edit that one instead.');
    const f = proposalFields(req.body);
    tx(() => {
      run(`INSERT INTO proposals (request_id, vendor_id, source, amount, scope, inclusions, exclusions, extras, valid_until, vendor_message, internal_comment)
           VALUES (?, ?, 'planner_entry', ?, ?, ?, ?, ?, ?, ?, ?)`,
      r.id, vendorId, f.amount, f.scope, f.inclusions, f.exclusions, f.extras, f.valid_until, f.vendor_message,
      v.text(req.body.internalComment, { field: 'Internal comment', max: 2000 }));
      run(`INSERT INTO vendor_request_recipients (request_id, vendor_id, status) VALUES (?, ?, 'responded')
           ON CONFLICT (request_id, vendor_id) DO UPDATE SET status = 'responded'`, r.id, vendorId);
    });
    touch(req.wedding.id);
    send(req, res);
  });

  const proposal = (req) => {
    const p = one(`SELECT p.* FROM proposals p JOIN vendor_requests r ON r.id = p.request_id WHERE p.id = ? AND r.wedding_id = ?`, v.id(req.params.id), req.wedding.id);
    if (!p) throw notFound('Proposal not found.');
    return p;
  };

  // Review: shortlist or decline, plus the internal comment and the note the
  // couple will see. A declined proposal is withdrawn from the couple.
  w.patch('/proposals/:id', (req, res) => {
    const p = proposal(req);
    const b = req.body;
    const status = b.agencyStatus === undefined ? p.agency_status : v.oneOf(b.agencyStatus, ['received', 'shortlisted', 'declined'], { field: 'Status' });
    run(`UPDATE proposals SET agency_status = ?, internal_comment = ?, note_for_couple = ?, shared_at = ?, updated_at = ? WHERE id = ?`,
      status,
      b.internalComment === undefined ? p.internal_comment : v.text(b.internalComment, { field: 'Internal comment', max: 2000 }),
      b.noteForCouple === undefined ? p.note_for_couple : v.text(b.noteForCouple, { field: 'Note for the couple', max: 1000 }),
      status === 'shortlisted' ? p.shared_at : null, nowISO(), p.id);
    touch(req.wedding.id);
    send(req, res);
  });

  // Share every shortlisted proposal on this request with the couple.
  w.post('/vendor-requests/:id/share', (req, res) => {
    const r = request(req);
    const n = run(`UPDATE proposals SET shared_at = COALESCE(shared_at, ?) WHERE request_id = ? AND agency_status = 'shortlisted'`, nowISO(), r.id).changes;
    if (!n) throw badRequest('Shortlist at least one proposal first.');
    touch(req.wedding.id);
    send(req, res);
  });

  w.post('/questions/:id/answer', (req, res) => {
    const q = one(`SELECT q.id FROM proposal_questions q JOIN proposals p ON p.id = q.proposal_id JOIN vendor_requests r ON r.id = p.request_id
      WHERE q.id = ? AND r.wedding_id = ?`, v.id(req.params.id), req.wedding.id);
    if (!q) throw notFound('Question not found.');
    run('UPDATE proposal_questions SET answer = ?, answered_by = ?, answered_at = ? WHERE id = ?',
      v.text(req.body.answer, { field: 'Answer', max: 2000, required: true }), req.user.id, nowISO(), q.id);
    touch(req.wedding.id);
    send(req, res);
  });

  // Close vendor selection explicitly (e.g. some categories deferred).
  w.post('/vendors-complete', (req, res) => {
    run('UPDATE weddings SET vendors_complete_at = ?, updated_at = ? WHERE id = ?', v.bool(req.body.complete) ? nowISO() : null, nowISO(), req.wedding.id);
    send(req, res);
  });
};

module.exports.proposalFields = proposalFields;
