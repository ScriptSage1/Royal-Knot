// Loads one wedding's records and shapes them for each audience.
//
// Privacy is enforced here, on the server: `coupleView` builds its response
// field by field from an allow-list, so transcripts, planner notes, internal
// vendor comments, checklist drafts, run sheets and agency-only tasks are
// never part of a couple's response, whatever the browser asks for.
const { one, all, run } = require('../db');
const { nowISO } = require('../lib/dates');
const S = require('./stage');

const parse = (s, d) => { try { return JSON.parse(s); } catch { return d; } };
const lines = (s) => String(s || '').split('\n').map((x) => x.trim()).filter(Boolean);

function records(weddingId) {
  const requests = all(`SELECT r.*, c.name AS category FROM vendor_requests r JOIN vendor_categories c ON c.id = r.category_id
    WHERE r.wedding_id = ? ORDER BY r.created_at, r.id`, weddingId);
  const proposals = all(`SELECT p.*, v.name AS vendor_name FROM proposals p JOIN vendor_requests r ON r.id = p.request_id
    JOIN vendors v ON v.id = p.vendor_id WHERE r.wedding_id = ? ORDER BY p.amount`, weddingId);
  return {
    appointments: all('SELECT * FROM appointments WHERE wedding_id = ? ORDER BY created_at DESC, id DESC', weddingId),
    transcripts: all(`SELECT t.*, u.name AS author FROM transcripts t LEFT JOIN users u ON u.id = t.created_by
      WHERE t.wedding_id = ? ORDER BY t.created_at DESC, t.id DESC`, weddingId),
    notes: all(`SELECT n.*, u.name AS author FROM planner_notes n LEFT JOIN users u ON u.id = n.author_id
      WHERE n.wedding_id = ? ORDER BY n.created_at DESC, n.id DESC`, weddingId),
    docs: all('SELECT * FROM requirements_docs WHERE wedding_id = ? ORDER BY version DESC', weddingId),
    tasks: all(`SELECT * FROM tasks WHERE wedding_id = ? ORDER BY status = 'done', due_date IS NULL, due_date, id`, weddingId),
    requests,
    recipients: all(`SELECT rr.*, v.name AS vendor_name FROM vendor_request_recipients rr JOIN vendors v ON v.id = rr.vendor_id
      JOIN vendor_requests r ON r.id = rr.request_id WHERE r.wedding_id = ?`, weddingId),
    proposals,
    questions: all(`SELECT q.*, u.name AS asked_by_name FROM proposal_questions q JOIN proposals p ON p.id = q.proposal_id
      JOIN vendor_requests r ON r.id = p.request_id LEFT JOIN users u ON u.id = q.asked_by WHERE r.wedding_id = ? ORDER BY q.created_at, q.id`, weddingId),
    agreements: all('SELECT * FROM agreements WHERE wedding_id = ? ORDER BY version DESC', weddingId),
    payments: all(`SELECT * FROM payments WHERE wedding_id = ? AND status != 'cancelled' ORDER BY due_date, id`, weddingId),
    events: all('SELECT * FROM events WHERE wedding_id = ? ORDER BY event_date, start_time, id', weddingId),
    runItems: all('SELECT * FROM run_items WHERE wedding_id = ? ORDER BY item_date, item_time, id', weddingId),
  };
}

const profile = (w) => ({
  coupleLabel: w.couple_label,
  dateMode: w.date_mode, weddingDate: w.wedding_date, weddingMonth: w.wedding_month,
  location: w.location, guestEstimate: w.guest_estimate, eventsCount: w.events_count,
  budgetMode: w.budget_mode, budgetRange: w.budget_range,
  whatMatters: w.what_matters, priorities: w.priorities,
  traditionsNote: w.traditions_note, languages: w.languages, familyNote: w.family_note,
  traditionsDeciding: Boolean(w.traditions_deciding), traditionsDiscuss: Boolean(w.traditions_discuss),
  vendorSourcing: w.vendor_sourcing, vendorNote: w.vendor_note,
});

const appointmentOut = (a) => a && ({
  id: a.id, status: a.status, preferredAt: a.preferred_at, otherTimes: a.other_times, scheduledAt: a.scheduled_at,
  durationMin: a.duration_min, format: a.format, meetingLink: a.meeting_link, place: a.place,
  coupleNote: a.couple_note, plannerMessage: a.planner_message, createdAt: a.created_at,
});
const docOut = (d) => ({
  id: d.id, version: d.version, status: d.status, generator: d.generator, generatorMeta: parse(d.generator_meta, null),
  sections: parse(d.sections_json, []), checklist: parse(d.checklist_json, []), conflicts: parse(d.conflicts_json, []),
  approvedAt: d.approved_at, sharedAt: d.shared_at, coupleResponse: d.couple_response, coupleComment: d.couple_comment,
  coupleRespondedAt: d.couple_responded_at, createdAt: d.created_at, updatedAt: d.updated_at,
});
const taskOut = (t) => ({ id: t.id, title: t.title, ownerType: t.owner_type, ownerLabel: t.owner_label, dueDate: t.due_date, status: t.status, notes: t.notes, shared: Boolean(t.shared), source: t.source });
const agreementOut = (a) => a && ({
  id: a.id, version: a.version, status: a.status, title: a.title, scopeSummary: a.scope_summary, terms: a.terms,
  feeAmount: a.fee_amount, vendorPath: a.vendor_path, scopeConfirmedAt: a.scope_confirmed_at, sentAt: a.sent_at,
  acceptedAt: a.accepted_at, signatoryName: a.signatory_name, acceptanceText: a.acceptance_text, createdAt: a.created_at,
});
const paymentOut = (p) => ({ id: p.id, label: p.label, kind: p.kind, amount: p.amount, dueDate: p.due_date, state: S.paymentState(p), paidOn: p.paid_on, paymentLink: p.payment_link });
const eventOut = (e) => ({ id: e.id, name: e.name, date: e.event_date, start: e.start_time, end: e.end_time, venue: e.venue, coupleNote: e.couple_note });

function summary(w, r) {
  const m = S.milestones(w, r);
  const index = S.stageIndex(m);
  return { milestones: m, stage: { index, label: S.STAGE_LABELS[index] } };
}

// ---------- planner: the whole case file ----------
function plannerCase(w) {
  const r = records(w.id);
  const planner = w.planner_id ? one('SELECT id, name FROM users WHERE id = ?', w.planner_id) : null;
  const sum = summary(w, r);
  const proposalOut = (p) => ({
    id: p.id, requestId: p.request_id, vendorId: p.vendor_id, vendorName: p.vendor_name, source: p.source, amount: p.amount,
    scope: p.scope, inclusions: lines(p.inclusions), exclusions: lines(p.exclusions), extras: lines(p.extras), validUntil: p.valid_until,
    vendorMessage: p.vendor_message, internalComment: p.internal_comment, noteForCouple: p.note_for_couple,
    agencyStatus: p.agency_status, sharedAt: p.shared_at, coupleDecision: p.couple_decision, createdAt: p.created_at,
    questions: r.questions.filter((q) => q.proposal_id === p.id).map((q) => ({ id: q.id, question: q.question, askedBy: q.asked_by_name, answer: q.answer, answeredAt: q.answered_at, createdAt: q.created_at })),
  });
  return {
    wedding: {
      caseCode: w.case_code, inviteCode: w.invite_code, planner, ...profile(w),
      detailsSharedAt: w.details_shared_at, vendorsCompleteAt: w.vendors_complete_at, scheduleFinalAt: w.schedule_final_at,
      completedAt: w.completed_at, createdAt: w.created_at, isDemo: Boolean(w.is_demo),
    },
    members: all('SELECT u.name, u.email FROM wedding_members m JOIN users u ON u.id = m.user_id WHERE m.wedding_id = ?', w.id),
    appointments: r.appointments.map(appointmentOut),
    transcripts: r.transcripts.map((t) => ({ id: t.id, source: t.source, status: t.status, title: t.title, originalName: t.original_name, content: t.content, author: t.author, createdAt: t.created_at })),
    notes: r.notes.map((n) => ({ id: n.id, topic: n.topic, body: n.body, author: n.author, createdAt: n.created_at })),
    requirements: r.docs.map(docOut),
    tasks: r.tasks.map(taskOut),
    requests: r.requests.map((q) => ({
      id: q.id, categoryId: q.category_id, category: q.category, brief: q.brief, budgetNote: q.budget_note, dueDate: q.due_date, status: q.status, createdAt: q.created_at,
      recipients: r.recipients.filter((x) => x.request_id === q.id).map((x) => ({ vendorId: x.vendor_id, vendorName: x.vendor_name, status: x.status })),
      proposals: r.proposals.filter((p) => p.request_id === q.id).map(proposalOut),
    })),
    agreements: r.agreements.map(agreementOut),
    payments: r.payments.map((p) => ({ ...paymentOut(p), status: p.status, method: p.method, reference: p.reference })),
    events: r.events.map((e) => ({ ...eventOut(e), internalNote: e.internal_note, ownerLabel: e.owner_label, shared: Boolean(e.shared) })),
    runItems: r.runItems.map((x) => ({ id: x.id, eventId: x.event_id, date: x.item_date, time: x.item_time, label: x.label, ownerLabel: x.owner_label, status: x.status })),
    ...sum,
    next: S.plannerNext(w, r, sum.milestones),
    alerts: S.alerts(w, r),
    agreementGate: agreementGate(w, r),
  };
}

// The agreement follows vendor selection only when the agency is sourcing
// vendors; "own vendors", "not needed" and "later" proceed on confirmed scope.
function agreementGate(w, r) {
  const approved = r.docs.some((d) => d.status === 'approved');
  if (!approved) return { ok: false, reason: 'Approve the requirements first.' };
  if (w.vendor_sourcing === 'help' && !S.vendorsResolved(w, r.requests, r.proposals)) {
    return { ok: false, reason: 'The couple asked the agency to source vendors. Finish vendor selection (or mark it complete) before sending the agreement.' };
  }
  return { ok: true };
}

// List rows for the planner's wedding list.
function plannerListRow(w) {
  const r = records(w.id);
  const sum = summary(w, r);
  return {
    caseCode: w.case_code, coupleLabel: w.couple_label || 'Name not shared yet', isDemo: Boolean(w.is_demo),
    dateMode: w.date_mode, weddingDate: w.wedding_date, weddingMonth: w.wedding_month, location: w.location, guestEstimate: w.guest_estimate,
    plannerId: w.planner_id, stage: sum.stage, next: S.plannerNext(w, r, sum.milestones), alerts: S.alerts(w, r), createdAt: w.created_at,
  };
}

// ---------- couple: an explicit allow-list ----------
function coupleView(w) {
  const r = records(w.id);
  const planner = w.planner_id ? one('SELECT name FROM users WHERE id = ?', w.planner_id) : null;
  const appt = r.appointments.find((a) => a.status !== 'cancelled') || null;
  const doc = r.docs.find((d) => d.status === 'approved' && d.shared_at);
  const agreement = r.agreements.find((a) => a.status === 'sent' || a.status === 'accepted');
  const sharedProposals = r.proposals.filter((p) => p.shared_at && p.agency_status === 'shortlisted');
  const shortlist = r.requests
    .filter((q) => sharedProposals.some((p) => p.request_id === q.id))
    .map((q) => ({
      requestId: q.id, category: q.category,
      options: sharedProposals.filter((p) => p.request_id === q.id).map((p) => ({
        id: p.id, vendorName: p.vendor_name, amount: p.amount, scope: p.scope, inclusions: lines(p.inclusions), exclusions: lines(p.exclusions),
        extras: lines(p.extras), validUntil: p.valid_until, plannerNote: p.note_for_couple, decision: p.couple_decision,
        questions: r.questions.filter((x) => x.proposal_id === p.id).map((x) => ({ question: x.question, answer: x.answer, createdAt: x.created_at, answeredAt: x.answered_at })),
      })),
    }));
  return {
    wedding: {
      caseCode: w.case_code, inviteCode: w.invite_code, planner: planner ? { name: planner.name } : null, ...profile(w),
      detailsShared: Boolean(w.details_shared_at), scheduleFinal: Boolean(w.schedule_final_at), completed: Boolean(w.completed_at),
    },
    appointment: appt && {
      status: appt.status, preferredAt: appt.preferred_at, otherTimes: appt.other_times, scheduledAt: appt.scheduled_at,
      durationMin: appt.duration_min, format: appt.format, place: appt.place, coupleNote: appt.couple_note, plannerMessage: appt.planner_message,
      meetingLink: appt.status === 'confirmed' ? appt.meeting_link : '',
    },
    requirements: doc ? { id: doc.id, version: doc.version, sections: parse(doc.sections_json, []), sharedAt: doc.shared_at, response: doc.couple_response, comment: doc.couple_comment } : null,
    vendorsResolved: S.vendorsResolved(w, r.requests, r.proposals),
    shortlist,
    agreement: agreement ? agreementOut(agreement) : null,
    payments: r.payments.map(paymentOut),
    events: r.events.filter((e) => e.shared).map(eventOut),
    tasks: r.tasks.filter((t) => t.shared).map((t) => ({ id: t.id, title: t.title, ownerType: t.owner_type, dueDate: t.due_date, status: t.status })),
    ...summary(w, r),
  };
}

const touch = (weddingId) => run('UPDATE weddings SET updated_at = ? WHERE id = ?', nowISO(), weddingId);

module.exports = { records, plannerCase, plannerListRow, coupleView, agreementGate, touch };
