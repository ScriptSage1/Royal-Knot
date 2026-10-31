// Vendor API. A vendor account sees only the briefs its vendor company was
// invited to, with just enough wedding context to quote (no couple names,
// contacts, notes or other vendors' proposals).
const express = require('express');
const { one, all, run, tx } = require('../db');
const { apiFor } = require('../auth/guards');
const { forbidden, notFound, conflict } = require('../lib/errors');
const { nowISO } = require('../lib/dates');
const { touch } = require('../services/weddings');
const { proposalFields } = require('./planner-vendors');
const v = require('../lib/validate');

const router = express.Router();
router.use(apiFor('vendor'));
router.use((req, res, next) => (req.user.vendorId ? next() : next(forbidden('This account is not linked to a vendor.'))));

const lines = (s) => String(s || '').split('\n').map((x) => x.trim()).filter(Boolean);

function list(req) {
  const vendor = one('SELECT v.name, c.name AS category FROM vendors v JOIN vendor_categories c ON c.id = v.category_id WHERE v.id = ?', req.user.vendorId);
  const rows = all(`
    SELECT r.id, r.brief, r.budget_note, r.due_date, r.status, r.created_at, c.name AS category, rr.status AS invite_status,
           w.case_code, w.id AS wedding_id, w.date_mode, w.wedding_date, w.wedding_month, w.location, w.guest_estimate, w.events_count
    FROM vendor_request_recipients rr
    JOIN vendor_requests r ON r.id = rr.request_id
    JOIN vendor_categories c ON c.id = r.category_id
    JOIN weddings w ON w.id = r.wedding_id
    WHERE rr.vendor_id = ? ORDER BY r.status = 'closed', r.due_date IS NULL, r.due_date`, req.user.vendorId);
  return {
    vendor,
    requests: rows.map((r) => {
      const p = one('SELECT * FROM proposals WHERE request_id = ? AND vendor_id = ?', r.id, req.user.vendorId);
      return {
        id: r.id, category: r.category, brief: r.brief, budgetNote: r.budget_note, dueDate: r.due_date, status: r.status, inviteStatus: r.invite_status,
        wedding: { reference: r.case_code, dateMode: r.date_mode, weddingDate: r.wedding_date, weddingMonth: r.wedding_month, location: r.location, guestEstimate: r.guest_estimate, eventsCount: r.events_count },
        proposal: p && {
          amount: p.amount, scope: p.scope, inclusions: lines(p.inclusions), exclusions: lines(p.exclusions), extras: lines(p.extras),
          validUntil: p.valid_until, vendorMessage: p.vendor_message, submittedAt: p.created_at, updatedAt: p.updated_at,
          // Vendors learn whether they are under review, not the couple's choice.
          status: p.agency_status === 'declined' ? 'not_progressed' : p.agency_status === 'shortlisted' ? 'shortlisted' : 'received',
          editable: p.agency_status === 'received' && !p.shared_at,
        },
      };
    }),
  };
}

const invitation = (req) => {
  const r = one(`SELECT r.id, r.status, r.wedding_id FROM vendor_request_recipients rr JOIN vendor_requests r ON r.id = rr.request_id
    WHERE rr.request_id = ? AND rr.vendor_id = ?`, v.id(req.params.id), req.user.vendorId);
  if (!r) throw notFound('This request is not available to your account.');
  if (r.status !== 'open') throw conflict('This request is closed.');
  return r;
};

router.get('/requests', (req, res) => res.json(list(req)));

router.post('/requests/:id/proposal', (req, res) => {
  const r = invitation(req);
  const f = proposalFields(req.body);
  tx(() => {
    const p = one('SELECT id, agency_status, shared_at FROM proposals WHERE request_id = ? AND vendor_id = ?', r.id, req.user.vendorId);
    if (p && (p.agency_status !== 'received' || p.shared_at)) throw conflict('Your proposal is already under review. Contact the planner to change it.');
    if (p) {
      run(`UPDATE proposals SET amount = ?, scope = ?, inclusions = ?, exclusions = ?, extras = ?, valid_until = ?, vendor_message = ?, updated_at = ? WHERE id = ?`,
        f.amount, f.scope, f.inclusions, f.exclusions, f.extras, f.valid_until, f.vendor_message, nowISO(), p.id);
    } else {
      run(`INSERT INTO proposals (request_id, vendor_id, source, amount, scope, inclusions, exclusions, extras, valid_until, vendor_message)
           VALUES (?, ?, 'vendor_portal', ?, ?, ?, ?, ?, ?, ?)`, r.id, req.user.vendorId, f.amount, f.scope, f.inclusions, f.exclusions, f.extras, f.valid_until, f.vendor_message);
    }
    run(`UPDATE vendor_request_recipients SET status = 'responded' WHERE request_id = ? AND vendor_id = ?`, r.id, req.user.vendorId);
  });
  touch(r.wedding_id);
  res.json(list(req));
});

router.post('/requests/:id/decline', (req, res) => {
  const r = invitation(req);
  if (one('SELECT 1 FROM proposals WHERE request_id = ? AND vendor_id = ?', r.id, req.user.vendorId)) throw conflict('You have already sent a proposal for this request.');
  run(`UPDATE vendor_request_recipients SET status = 'declined' WHERE request_id = ? AND vendor_id = ?`, r.id, req.user.vendorId);
  res.json(list(req));
});

module.exports = router;
