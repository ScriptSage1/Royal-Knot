// Planner API: the wedding list, and the case-file router every wedding
// section hangs off. `/weddings/:code/...` always loads the wedding and checks
// the planner's assignment first; record queries are then scoped with
// `wedding_id = ?`, so an id from another wedding simply isn't found.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const express = require('express');
const config = require('../config');
const { one, all, run } = require('../db');
const { apiFor, plannerWedding } = require('../auth/guards');
const { badRequest, notFound, conflict } = require('../lib/errors');
const { nowISO, today } = require('../lib/dates');
const { plannerCase, plannerListRow, touch } = require('../services/weddings');
const v = require('../lib/validate');
const { isEnabled: claudeEnabled } = require('../services/claude-cli');

const router = express.Router();
router.use(apiFor('planner'));

router.get('/weddings', (req, res) => {
  const mine = all('SELECT * FROM weddings WHERE planner_id = ? ORDER BY completed_at IS NOT NULL, COALESCE(wedding_date, wedding_month, created_at)', req.user.id).map(plannerListRow);
  const enquiries = all('SELECT * FROM weddings WHERE planner_id IS NULL ORDER BY created_at DESC').map(plannerListRow);
  res.json({ mine, enquiries, today: today() });
});

router.get('/planners', (req, res) => res.json(all("SELECT id, name FROM users WHERE role = 'planner' ORDER BY name")));

router.get('/directory', (req, res) => res.json({
  categories: all('SELECT id, name FROM vendor_categories ORDER BY name'),
  vendors: all(`SELECT v.id, v.name, v.city, v.email, v.category_id AS categoryId, c.name AS category,
    EXISTS (SELECT 1 FROM users u WHERE u.vendor_id = v.id) AS hasPortal
    FROM vendors v JOIN vendor_categories c ON c.id = v.category_id ORDER BY c.name, v.name`),
  meetingLinkDefault: config.defaultMeetingLink,
  // Whether a Claude CLI is configured on this server (not whether it is
  // signed in: that is only known when a draft is attempted).
  drafting: { claudeCli: claudeEnabled(), model: config.claudeCliModel, effort: config.claudeCliEffort || 'default' },
}));

// ---------- one wedding ----------
const w = express.Router({ mergeParams: true });
router.use('/weddings/:code', w);

// Viewing an unassigned enquiry is allowed (to take it on); changes are not.
w.use((req, res, next) => {
  const readOnly = req.method === 'GET' || req.path === '/claim';
  req.wedding = plannerWedding(req.params.code, req.user, { allowUnassigned: readOnly });
  next();
});
const send = (req, res) => res.json(plannerCase(one('SELECT * FROM weddings WHERE id = ?', req.wedding.id)));

w.get('/', send);

w.post('/claim', (req, res) => {
  const r = run('UPDATE weddings SET planner_id = ?, updated_at = ? WHERE id = ? AND planner_id IS NULL', req.user.id, nowISO(), req.wedding.id);
  if (!r.changes && req.wedding.planner_id !== req.user.id) throw conflict('Another planner has already taken on this wedding.');
  send(req, res);
});

w.post('/handover', (req, res) => {
  const to = one("SELECT id FROM users WHERE id = ? AND role = 'planner'", v.id(req.body.plannerId, 'Planner'));
  if (!to) throw badRequest('Choose a planner.');
  run('UPDATE weddings SET planner_id = ?, updated_at = ? WHERE id = ?', to.id, nowISO(), req.wedding.id);
  res.json({ handedOver: true });
});

// The planner can record the couple's vendor choice from the consultation.
w.patch('/scope', (req, res) => {
  run('UPDATE weddings SET vendor_sourcing = ?, vendor_note = ?, updated_at = ? WHERE id = ?',
    v.oneOf(req.body.vendorSourcing, ['help', 'own', 'later', 'not_needed'], { field: 'Vendor choice', required: false }),
    v.text(req.body.vendorNote, { field: 'Vendor note', max: 1500 }), nowISO(), req.wedding.id);
  send(req, res);
});

w.post('/complete', (req, res) => {
  run('UPDATE weddings SET completed_at = ?, updated_at = ? WHERE id = ?', v.bool(req.body.complete) ? nowISO() : null, nowISO(), req.wedding.id);
  send(req, res);
});

// ---------- consultation ----------
const APPT_STATUS = ['requested', 'confirmed', 'completed', 'cancelled'];

w.post('/appointments', (req, res) => {
  const scheduledAt = v.dateTime(req.body.scheduledAt, { field: 'Date and time', required: true });
  run(`INSERT INTO appointments (wedding_id, status, scheduled_at, duration_min, format, meeting_link, place, planner_message, created_by)
       VALUES (?, 'confirmed', ?, ?, ?, ?, ?, ?, ?)`,
  req.wedding.id, scheduledAt, v.int(req.body.durationMin, { field: 'Duration', min: 15, max: 240 }) || 60,
  v.oneOf(req.body.format, ['video', 'in_person', 'phone'], { field: 'Format' }), v.url(req.body.meetingLink, { field: 'Meeting link' }),
  v.line(req.body.place, { field: 'Place', max: 200 }), v.text(req.body.plannerMessage, { field: 'Message', max: 1000 }), req.user.id);
  touch(req.wedding.id);
  send(req, res);
});

w.patch('/appointments/:id', (req, res) => {
  const a = one('SELECT * FROM appointments WHERE id = ? AND wedding_id = ?', v.id(req.params.id), req.wedding.id);
  if (!a) throw notFound('Appointment not found.');
  const b = req.body;
  const status = b.status === undefined ? a.status : v.oneOf(b.status, APPT_STATUS, { field: 'Status' });
  const scheduledAt = b.scheduledAt === undefined ? a.scheduled_at : v.dateTime(b.scheduledAt, { field: 'Date and time' });
  if (status === 'confirmed' && !scheduledAt) throw badRequest('Set the confirmed date and time.');
  run(`UPDATE appointments SET status = ?, scheduled_at = ?, duration_min = ?, format = ?, meeting_link = ?, place = ?, planner_message = ?, updated_at = ?
       WHERE id = ?`,
  status, scheduledAt,
  b.durationMin === undefined ? a.duration_min : v.int(b.durationMin, { field: 'Duration', min: 15, max: 240 }) || 60,
  b.format === undefined ? a.format : v.oneOf(b.format, ['video', 'in_person', 'phone'], { field: 'Format' }),
  b.meetingLink === undefined ? a.meeting_link : v.url(b.meetingLink, { field: 'Meeting link' }),
  b.place === undefined ? a.place : v.line(b.place, { field: 'Place', max: 200 }),
  b.plannerMessage === undefined ? a.planner_message : v.text(b.plannerMessage, { field: 'Message', max: 1000 }),
  nowISO(), a.id);
  touch(req.wedding.id);
  send(req, res);
});

// ---------- transcripts (agency only) ----------
w.post('/transcripts', (req, res) => {
  run(`INSERT INTO transcripts (wedding_id, appointment_id, source, status, title, content, created_by) VALUES (?, ?, 'pasted', ?, ?, ?, ?)`,
    req.wedding.id, appointmentFor(req, req.body.appointmentId), v.oneOf(req.body.status || 'final', ['draft', 'final'], { field: 'Status' }),
    v.line(req.body.title, { field: 'Title', max: 120 }), v.text(req.body.content, { field: 'Transcript', max: 200000, required: true }), req.user.id);
  touch(req.wedding.id);
  send(req, res);
});

function appointmentFor(req, id) {
  if (id === undefined || id === null || id === '') return null;
  const a = one('SELECT id FROM appointments WHERE id = ? AND wedding_id = ?', v.id(id), req.wedding.id);
  if (!a) throw badRequest('That appointment is not part of this wedding.');
  return a.id;
}

// Upload: the raw file body with its name in a header. Only small UTF-8 text
// files (.txt, .vtt, .srt, .md) are accepted. The file is saved under a
// generated name inside UPLOAD_DIR (never served or executed) and its text
// is stored for drafting.
const ALLOWED = new Set(['.txt', '.vtt', '.srt', '.md']);
w.post('/transcripts/upload', express.raw({ type: () => true, limit: config.maxUploadBytes }), (req, res) => {
  const original = path.basename(String(req.get('x-upload-name') || '')).replace(/[^\w.\- ()]/g, '_').slice(0, 120);
  const ext = path.extname(original).toLowerCase();
  if (!ALLOWED.has(ext)) throw badRequest('Upload a text transcript (.txt, .vtt, .srt or .md).');
  const buf = req.body;
  if (!Buffer.isBuffer(buf) || !buf.length) throw badRequest('The file is empty.');
  if (buf.includes(0)) throw badRequest('That file is not plain text.');
  const content = new TextDecoder('utf-8', { fatal: false }).decode(buf).replace(/^﻿/, '');
  if (content.includes('�')) throw badRequest('Save the transcript as UTF-8 text and try again.');
  const stored = `${crypto.randomUUID()}${ext}`;
  const dir = path.join(config.uploadDir, String(req.wedding.id));
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, stored), buf, { flag: 'wx', mode: 0o600 });
  run(`INSERT INTO transcripts (wedding_id, appointment_id, source, status, title, original_name, stored_name, content, created_by)
       VALUES (?, ?, 'uploaded', ?, ?, ?, ?, ?, ?)`,
  req.wedding.id, appointmentFor(req, req.get('x-appointment-id')), req.get('x-transcript-status') === 'draft' ? 'draft' : 'final',
  v.line(decodeURIComponent(req.get('x-transcript-title') || ''), { field: 'Title', max: 120 }), original, stored, content, req.user.id);
  touch(req.wedding.id);
  send(req, res);
});

w.patch('/transcripts/:id', (req, res) => {
  const r = run('UPDATE transcripts SET status = ? WHERE id = ? AND wedding_id = ?', v.oneOf(req.body.status, ['draft', 'final'], { field: 'Status' }), v.id(req.params.id), req.wedding.id);
  if (!r.changes) throw notFound('Transcript not found.');
  send(req, res);
});

w.delete('/transcripts/:id', (req, res) => {
  const t = one('SELECT id, stored_name FROM transcripts WHERE id = ? AND wedding_id = ?', v.id(req.params.id), req.wedding.id);
  if (!t) throw notFound('Transcript not found.');
  run('DELETE FROM transcripts WHERE id = ?', t.id);
  if (t.stored_name) fs.rm(path.join(config.uploadDir, String(req.wedding.id), path.basename(t.stored_name)), { force: true }, () => {});
  send(req, res);
});

// ---------- private planner notes ----------
w.post('/notes', (req, res) => {
  run('INSERT INTO planner_notes (wedding_id, author_id, topic, body) VALUES (?, ?, ?, ?)', req.wedding.id, req.user.id,
    v.oneOf(req.body.topic || 'general', ['emotion', 'family', 'practical', 'culture', 'general'], { field: 'Topic' }),
    v.text(req.body.body, { field: 'Note', max: 4000, required: true }));
  touch(req.wedding.id);
  send(req, res);
});

w.delete('/notes/:id', (req, res) => {
  const r = run('DELETE FROM planner_notes WHERE id = ? AND wedding_id = ?', v.id(req.params.id), req.wedding.id);
  if (!r.changes) throw notFound('Note not found.');
  send(req, res);
});

require('./planner-documents')(w, send);
require('./planner-vendors')(w, send);
require('./planner-delivery')(w, send);

module.exports = router;
