// Couple API. Every handler resolves the wedding from the signed-in user's
// membership (never from an id in the request) and every response is built by
// coupleView's allow-list.
const express = require('express');
const { one, run, tx } = require('../db');
const { apiFor, coupleWedding } = require('../auth/guards');
const { badRequest, notFound, conflict } = require('../lib/errors');
const { nowISO } = require('../lib/dates');
const { coupleView, touch } = require('../services/weddings');
const v = require('../lib/validate');

const router = express.Router();
router.use(apiFor('couple'));
router.use((req, res, next) => { req.wedding = coupleWedding(req.user); next(); });

const send = (req, res) => res.json(coupleView(one('SELECT * FROM weddings WHERE id = ?', req.wedding.id)));

router.get('/workspace', send);

// Partial profile updates, saved step by step. Every field is optional.
const PROFILE = {
  coupleLabel: ['couple_label', (x) => v.line(x, { field: 'Names', max: 80 })],
  dateMode: ['date_mode', (x) => v.oneOf(x, ['exact', 'month', 'undecided'], { field: 'Date' })],
  weddingDate: ['wedding_date', (x) => v.date(x, { field: 'Date' })],
  weddingMonth: ['wedding_month', (x) => v.month(x)],
  location: ['location', (x) => v.line(x, { field: 'Location', max: 160 })],
  guestEstimate: ['guest_estimate', (x) => v.int(x, { field: 'Guest estimate', min: 1, max: 20000 })],
  eventsCount: ['events_count', (x) => v.int(x, { field: 'Events or days', min: 1, max: 30 })],
  budgetMode: ['budget_mode', (x) => v.oneOf(x, ['unanswered', 'range', 'no_fixed', 'prefer_not', 'unsure'], { field: 'Budget' })],
  budgetRange: ['budget_range', (x) => v.line(x, { field: 'Budget range', max: 80 })],
  whatMatters: ['what_matters', (x) => v.text(x, { field: 'What matters', max: 3000 })],
  priorities: ['priorities', (x) => v.text(x, { field: 'Priorities', max: 1500 })],
  traditionsNote: ['traditions_note', (x) => v.text(x, { field: 'Traditions', max: 3000 })],
  languages: ['languages', (x) => v.line(x, { field: 'Languages', max: 200 })],
  familyNote: ['family_note', (x) => v.text(x, { field: 'Family', max: 2000 })],
  traditionsDeciding: ['traditions_deciding', (x) => (v.bool(x) ? 1 : 0)],
  traditionsDiscuss: ['traditions_discuss', (x) => (v.bool(x) ? 1 : 0)],
  vendorSourcing: ['vendor_sourcing', (x) => v.oneOf(x, ['help', 'own', 'later', 'not_needed'], { field: 'Vendor choice', required: false })],
  vendorNote: ['vendor_note', (x) => v.text(x, { field: 'Vendor note', max: 1500 })],
};

router.patch('/profile', (req, res) => {
  const sets = [], params = [];
  for (const [key, [col, clean]] of Object.entries(PROFILE)) {
    if (Object.prototype.hasOwnProperty.call(req.body, key)) { sets.push(`${col} = ?`); params.push(clean(req.body[key])); }
  }
  if (!sets.length) throw badRequest('Nothing to save.');
  run(`UPDATE weddings SET ${sets.join(', ')}, updated_at = ? WHERE id = ?`, ...params, nowISO(), req.wedding.id);
  send(req, res);
});

router.post('/profile/share', (req, res) => {
  run('UPDATE weddings SET details_shared_at = COALESCE(details_shared_at, ?), updated_at = ? WHERE id = ?', nowISO(), nowISO(), req.wedding.id);
  send(req, res);
});

// Consultation request: the couple suggests a time; the planner confirms.
router.post('/appointment', (req, res) => {
  const live = one(`SELECT id FROM appointments WHERE wedding_id = ? AND status IN ('requested', 'confirmed')`, req.wedding.id);
  if (live) throw conflict('You already have a consultation requested. Change or cancel that one first.');
  const preferredAt = v.dateTime(req.body.preferredAt, { field: 'Preferred time', required: true });
  if (new Date(preferredAt) < new Date()) throw badRequest('Choose a time in the future.');
  run(`INSERT INTO appointments (wedding_id, status, preferred_at, other_times, format, couple_note, created_by)
       VALUES (?, 'requested', ?, ?, ?, ?, ?)`,
  req.wedding.id, preferredAt, v.text(req.body.otherTimes, { field: 'Other times', max: 500 }),
  v.oneOf(req.body.format, ['video', 'in_person', 'phone'], { field: 'Format' }),
  v.text(req.body.note, { field: 'Note', max: 1000 }), req.user.id);
  touch(req.wedding.id);
  send(req, res);
});

router.post('/appointment/cancel', (req, res) => {
  const r = run(`UPDATE appointments SET status = 'cancelled', updated_at = ? WHERE wedding_id = ? AND status IN ('requested', 'confirmed')`, nowISO(), req.wedding.id);
  if (!r.changes) throw notFound('There is no upcoming consultation to cancel.');
  send(req, res);
});

router.post('/requirements/:id/respond', (req, res) => {
  const response = v.oneOf(req.body.response, ['confirmed', 'changes_requested'], { field: 'Response' });
  const comment = v.text(req.body.comment, { field: 'Comment', max: 2000, required: response === 'changes_requested' });
  const r = run(`UPDATE requirements_docs SET couple_response = ?, couple_comment = ?, couple_responded_at = ?, updated_at = ?
    WHERE id = ? AND wedding_id = ? AND status = 'approved' AND shared_at IS NOT NULL`, response, comment, nowISO(), nowISO(), v.id(req.params.id), req.wedding.id);
  if (!r.changes) throw notFound('This plan is no longer available.');
  touch(req.wedding.id);
  send(req, res);
});

// Only proposals the planner has shortlisted and shared are reachable.
function sharedProposal(req) {
  const p = one(`SELECT p.id FROM proposals p JOIN vendor_requests r ON r.id = p.request_id
    WHERE p.id = ? AND r.wedding_id = ? AND p.shared_at IS NOT NULL AND p.agency_status = 'shortlisted'`, v.id(req.params.id), req.wedding.id);
  if (!p) throw notFound('This option is no longer available.');
  return p;
}

router.post('/proposals/:id/decision', (req, res) => {
  const p = sharedProposal(req);
  const decision = v.oneOf(req.body.decision, ['chosen', 'deferred', 'declined', ''], { field: 'Decision' }) || null;
  run('UPDATE proposals SET couple_decision = ?, couple_decided_at = ?, updated_at = ? WHERE id = ?', decision, decision ? nowISO() : null, nowISO(), p.id);
  touch(req.wedding.id);
  send(req, res);
});

router.post('/proposals/:id/questions', (req, res) => {
  const p = sharedProposal(req);
  run('INSERT INTO proposal_questions (proposal_id, asked_by, question) VALUES (?, ?, ?)', p.id, req.user.id, v.text(req.body.question, { field: 'Question', max: 1000, required: true }));
  touch(req.wedding.id);
  send(req, res);
});

// Demo acceptance record. Not a legally binding e-signature: the response
// and the UI both say so.
router.post('/agreements/:id/accept', (req, res) => {
  const signatory = v.line(req.body.signatoryName, { field: 'Full name', max: 120, required: true });
  if (!v.bool(req.body.agree)) throw badRequest('Tick the box to confirm you have read and accept the agreement.');
  tx(() => {
    const a = one(`SELECT id, version FROM agreements WHERE id = ? AND wedding_id = ? AND status = 'sent'`, v.id(req.params.id), req.wedding.id);
    if (!a) throw notFound('This agreement is not waiting for acceptance.');
    const statement = `${signatory} accepted version ${a.version} of this agreement on behalf of the couple through The Royal Knot portal, signed in as ${req.user.email}.`;
    run(`UPDATE agreements SET status = 'accepted', accepted_at = ?, accepted_by = ?, signatory_name = ?, acceptance_text = ?, updated_at = ? WHERE id = ?`,
      nowISO(), req.user.id, signatory, statement, nowISO(), a.id);
  });
  touch(req.wedding.id);
  send(req, res);
});

// Couples can tick off tasks the planner shared with them and assigned to them.
router.post('/tasks/:id/status', (req, res) => {
  const status = v.bool(req.body.done) ? 'done' : 'todo';
  const r = run(`UPDATE tasks SET status = ?, updated_at = ? WHERE id = ? AND wedding_id = ? AND shared = 1 AND owner_type = 'couple'`, status, nowISO(), v.id(req.params.id), req.wedding.id);
  if (!r.changes) throw notFound('This task is not one of yours.');
  send(req, res);
});

module.exports = router;
