// Planner: agreement versions, the payment timeline, events and the day-of
// run sheet. Mounted on the per-wedding router (req.wedding is authorised).
const { one, run, tx } = require('../db');
const { badRequest, notFound, conflict } = require('../lib/errors');
const { nowISO } = require('../lib/dates');
const { touch, agreementGate, records } = require('../services/weddings');
const v = require('../lib/validate');

const VENDOR_PATH = {
  help: 'Vendors sourced by the agency, as selected by the couple.',
  own: 'The couple is working with vendors they already have; the agency coordinates them.',
  later: 'Vendor sourcing to be decided later; not included in this scope unless agreed in writing.',
  not_needed: 'No vendor sourcing; planning and coordination services only.',
};

module.exports = function register(w, send) {
  // ---------- agreement ----------
  const agreementFields = (b) => ({
    title: v.line(b.title, { field: 'Title', max: 120, required: true }),
    scope_summary: v.text(b.scopeSummary, { field: 'Scope', max: 6000, required: true }),
    terms: v.text(b.terms, { field: 'Terms', max: 12000, required: true }),
    fee_amount: v.int(b.feeAmount, { field: 'Planning fee', min: 0, max: 1e10 }),
  });

  w.post('/agreements', (req, res) => {
    if (!v.bool(req.body.scopeConfirmed)) throw badRequest('Confirm the scope with the couple first.');
    const f = agreementFields(req.body);
    tx(() => {
      const n = (one('SELECT MAX(version) AS n FROM agreements WHERE wedding_id = ?', req.wedding.id).n || 0) + 1;
      run(`UPDATE agreements SET status = 'superseded', updated_at = ? WHERE wedding_id = ? AND status IN ('draft', 'sent')`, nowISO(), req.wedding.id);
      run(`INSERT INTO agreements (wedding_id, version, title, scope_summary, terms, fee_amount, vendor_path, scope_confirmed_at, created_by)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      req.wedding.id, n, f.title, f.scope_summary, f.terms, f.fee_amount, VENDOR_PATH[req.wedding.vendor_sourcing] || 'Vendor approach to be confirmed.', nowISO(), req.user.id);
    });
    touch(req.wedding.id);
    send(req, res);
  });

  const agreement = (req) => {
    const a = one('SELECT * FROM agreements WHERE id = ? AND wedding_id = ?', v.id(req.params.id), req.wedding.id);
    if (!a) throw notFound('Agreement not found.');
    return a;
  };

  w.put('/agreements/:id', (req, res) => {
    const a = agreement(req);
    if (a.status !== 'draft') throw conflict('Only a draft can be edited. Create a new version instead.');
    const f = agreementFields(req.body);
    run('UPDATE agreements SET title = ?, scope_summary = ?, terms = ?, fee_amount = ?, updated_at = ? WHERE id = ?', f.title, f.scope_summary, f.terms, f.fee_amount, nowISO(), a.id);
    send(req, res);
  });

  w.post('/agreements/:id/send', (req, res) => {
    const a = agreement(req);
    if (a.status !== 'draft') throw conflict('This version has already been sent.');
    const gate = agreementGate(req.wedding, records(req.wedding.id));
    if (!gate.ok) throw conflict(gate.reason);
    run(`UPDATE agreements SET status = 'sent', sent_at = ?, updated_at = ? WHERE id = ?`, nowISO(), nowISO(), a.id);
    touch(req.wedding.id);
    send(req, res);
  });

  // ---------- payments ----------
  const KINDS = ['booking', 'advance', 'final', 'extra', 'other'];
  w.post('/payments', (req, res) => {
    run('INSERT INTO payments (wedding_id, label, kind, amount, due_date, payment_link, recorded_by) VALUES (?, ?, ?, ?, ?, ?, ?)',
      req.wedding.id, v.line(req.body.label, { field: 'Milestone', max: 120, required: true }), v.oneOf(req.body.kind || 'other', KINDS, { field: 'Type' }),
      v.int(req.body.amount, { field: 'Amount', min: 0, max: 1e10, required: true }), v.date(req.body.dueDate, { field: 'Due date', required: true }),
      v.url(req.body.paymentLink, { field: 'Payment link' }), req.user.id);
    touch(req.wedding.id);
    send(req, res);
  });

  w.patch('/payments/:id', (req, res) => {
    const p = one('SELECT * FROM payments WHERE id = ? AND wedding_id = ?', v.id(req.params.id), req.wedding.id);
    if (!p) throw notFound('Payment not found.');
    const b = req.body;
    const status = b.status === undefined ? p.status : v.oneOf(b.status, ['scheduled', 'paid', 'cancelled'], { field: 'Status' });
    const paidOn = status === 'paid' ? (b.paidOn === undefined ? p.paid_on : v.date(b.paidOn, { field: 'Paid on' })) || nowISO().slice(0, 10) : null;
    run(`UPDATE payments SET label = ?, kind = ?, amount = ?, due_date = ?, status = ?, paid_on = ?, method = ?, reference = ?, payment_link = ?, updated_at = ? WHERE id = ?`,
      b.label === undefined ? p.label : v.line(b.label, { field: 'Milestone', max: 120, required: true }),
      b.kind === undefined ? p.kind : v.oneOf(b.kind, KINDS, { field: 'Type' }),
      b.amount === undefined ? p.amount : v.int(b.amount, { field: 'Amount', min: 0, max: 1e10, required: true }),
      b.dueDate === undefined ? p.due_date : v.date(b.dueDate, { field: 'Due date', required: true }),
      status, paidOn,
      b.method === undefined ? p.method : v.line(b.method, { field: 'Method', max: 80 }),
      b.reference === undefined ? p.reference : v.line(b.reference, { field: 'Reference', max: 120 }),
      b.paymentLink === undefined ? p.payment_link : v.url(b.paymentLink, { field: 'Payment link' }),
      nowISO(), p.id);
    touch(req.wedding.id);
    send(req, res);
  });

  // ---------- events ----------
  const eventFields = (b, e = {}) => ({
    name: b.name === undefined ? e.name : v.line(b.name, { field: 'Event', max: 120, required: true }),
    event_date: b.date === undefined ? e.event_date : v.date(b.date, { field: 'Date', required: true }),
    start_time: b.start === undefined ? e.start_time || '' : v.time(b.start, { field: 'Start' }),
    end_time: b.end === undefined ? e.end_time || '' : v.time(b.end, { field: 'End' }),
    venue: b.venue === undefined ? e.venue || '' : v.line(b.venue, { field: 'Venue', max: 160 }),
    couple_note: b.coupleNote === undefined ? e.couple_note || '' : v.text(b.coupleNote, { field: 'Note for the couple', max: 1000 }),
    internal_note: b.internalNote === undefined ? e.internal_note || '' : v.text(b.internalNote, { field: 'Internal note', max: 1000 }),
    owner_label: b.ownerLabel === undefined ? e.owner_label || '' : v.line(b.ownerLabel, { field: 'Owner', max: 80 }),
    shared: b.shared === undefined ? (e.shared ?? 1) : (v.bool(b.shared) ? 1 : 0),
  });
  const FIELDS = ['name', 'event_date', 'start_time', 'end_time', 'venue', 'couple_note', 'internal_note', 'owner_label', 'shared'];

  w.post('/events', (req, res) => {
    const f = eventFields(req.body);
    run(`INSERT INTO events (wedding_id, ${FIELDS.join(', ')}) VALUES (?, ${FIELDS.map(() => '?').join(', ')})`, req.wedding.id, ...FIELDS.map((k) => f[k]));
    touch(req.wedding.id);
    send(req, res);
  });

  w.patch('/events/:id', (req, res) => {
    const e = one('SELECT * FROM events WHERE id = ? AND wedding_id = ?', v.id(req.params.id), req.wedding.id);
    if (!e) throw notFound('Event not found.');
    const f = eventFields(req.body, e);
    run(`UPDATE events SET ${FIELDS.map((k) => `${k} = ?`).join(', ')} WHERE id = ?`, ...FIELDS.map((k) => f[k]), e.id);
    touch(req.wedding.id);
    send(req, res);
  });

  w.delete('/events/:id', (req, res) => {
    const r = run('DELETE FROM events WHERE id = ? AND wedding_id = ?', v.id(req.params.id), req.wedding.id);
    if (!r.changes) throw notFound('Event not found.');
    send(req, res);
  });

  w.post('/schedule-final', (req, res) => {
    if (v.bool(req.body.final) && !one('SELECT 1 FROM events WHERE wedding_id = ? AND shared = 1', req.wedding.id)) throw badRequest('Add at least one shared event first.');
    run('UPDATE weddings SET schedule_final_at = ?, updated_at = ? WHERE id = ?', v.bool(req.body.final) ? nowISO() : null, nowISO(), req.wedding.id);
    send(req, res);
  });

  // ---------- run sheet (agency only) ----------
  w.post('/run-items', (req, res) => {
    let eventId = null;
    if (req.body.eventId) {
      const e = one('SELECT id FROM events WHERE id = ? AND wedding_id = ?', v.id(req.body.eventId, 'Event'), req.wedding.id);
      if (!e) throw badRequest('That event is not part of this wedding.');
      eventId = e.id;
    }
    run('INSERT INTO run_items (wedding_id, event_id, item_date, item_time, label, owner_label) VALUES (?, ?, ?, ?, ?, ?)',
      req.wedding.id, eventId, v.date(req.body.date, { field: 'Date', required: true }), v.time(req.body.time, { field: 'Time', required: true }),
      v.line(req.body.label, { field: 'What happens', max: 200, required: true }), v.line(req.body.ownerLabel, { field: 'Owner', max: 80 }));
    send(req, res);
  });

  w.patch('/run-items/:id', (req, res) => {
    const r = run('UPDATE run_items SET status = ? WHERE id = ? AND wedding_id = ?', v.oneOf(req.body.status, ['pending', 'done', 'delayed'], { field: 'Status' }), v.id(req.params.id), req.wedding.id);
    if (!r.changes) throw notFound('Run sheet item not found.');
    send(req, res);
  });

  w.delete('/run-items/:id', (req, res) => {
    const r = run('DELETE FROM run_items WHERE id = ? AND wedding_id = ?', v.id(req.params.id), req.wedding.id);
    if (!r.changes) throw notFound('Run sheet item not found.');
    send(req, res);
  });
};
