// Where a wedding is, derived from its records rather than stored, so the
// stage can never drift from the data. The milestone keys match
// public/js/core/progress.js, which turns them into garden progress.
const { today, daysBetween } = require('../lib/dates');

const STAGE_LABELS = [
  'New enquiry', 'Details shared', 'Consultation booked', 'Consultation held', 'Requirements shared',
  'Vendors settled', 'Agreement accepted', 'Planning underway', 'Schedule final', 'Wedding complete',
];

function vendorsResolved(w, requests, proposals) {
  if (w.vendors_complete_at) return true;
  if (w.vendor_sourcing === 'own' || w.vendor_sourcing === 'not_needed') return true;
  return requests.length > 0 && requests.every((r) => proposals.some((p) => p.request_id === r.id && p.couple_decision === 'chosen'));
}

// Payment state shown to everyone: paid, overdue, due (within 14 days) or upcoming.
function paymentState(p, now = today()) {
  if (p.status === 'paid') return 'paid';
  if (p.status === 'cancelled') return 'cancelled';
  const d = daysBetween(now, p.due_date);
  return d < 0 ? 'overdue' : d <= 14 ? 'due' : 'upcoming';
}

function milestones(w, r) {
  const done = [];
  const live = r.appointments.filter((a) => a.status !== 'cancelled');
  if (w.details_shared_at) done.push('enquiry');
  if (live.length) done.push('consultBooked');
  if (live.some((a) => a.status === 'completed')) done.push('consultHeld');
  if (r.docs.some((d) => d.status === 'approved' && d.shared_at)) done.push('requirements');
  if (vendorsResolved(w, r.requests, r.proposals)) done.push('vendors');
  if (r.agreements.some((a) => a.status === 'accepted')) done.push('agreement');
  const counted = r.tasks.filter((t) => t.status !== 'blocked');
  const taskFraction = counted.length ? counted.filter((t) => t.status === 'done').length / counted.length : 0;
  if (done.includes('agreement') && counted.length && taskFraction === 1) done.push('tasks');
  if (w.schedule_final_at) done.push('schedule');
  if (w.completed_at) done.push('tasks', 'schedule', 'complete');
  return { done: [...new Set(done)], tasks: taskFraction };
}

function stageIndex(m) {
  const has = (k) => m.done.includes(k);
  if (has('complete')) return 9;
  if (has('schedule')) return 8;
  if (has('agreement')) return m.tasks >= 0.5 ? 7 : 6;
  if (has('vendors') && has('requirements')) return 5;
  if (has('requirements')) return 4;
  if (has('consultHeld')) return 3;
  if (has('consultBooked')) return 2;
  if (has('enquiry')) return 1;
  return 0;
}

// The planner's single next action, and the section that handles it.
function plannerNext(w, r, m) {
  const has = (k) => m.done.includes(k);
  const appt = r.appointments.find((a) => a.status === 'requested' || a.status === 'confirmed');
  const latestDoc = r.docs[0];
  const latestAgreement = r.agreements[0];
  const shared = r.proposals.filter((p) => p.shared_at);
  if (!w.planner_id) return { label: 'Take on this enquiry', section: 'overview' };
  if (!w.details_shared_at && !r.appointments.length) return { label: 'Waiting for the couple to share their details', section: 'overview', waiting: true };
  if (appt && appt.status === 'requested') return { label: 'Confirm the consultation time', section: 'consultation' };
  if (appt && appt.status === 'confirmed') {
    const past = appt.scheduled_at && appt.scheduled_at.slice(0, 10) <= today();
    return past ? { label: 'Mark the consultation as held', section: 'consultation' } : { label: `Consultation on ${appt.scheduled_at ? appt.scheduled_at.slice(0, 10) : 'the agreed date'}`, section: 'consultation', waiting: true };
  }
  if (!has('consultHeld')) return { label: 'Schedule the consultation', section: 'consultation' };
  if (!r.transcripts.length && !r.notes.length) return { label: 'Add the transcript and your notes', section: 'consultation' };
  if (!latestDoc) return { label: 'Draft the requirements', section: 'requirements' };
  if (latestDoc.status === 'draft') return { label: 'Review and approve the requirements', section: 'requirements' };
  if (!latestDoc.shared_at) return { label: 'Share the requirements with the couple', section: 'requirements' };
  if (latestDoc.couple_response === 'changes_requested') return { label: 'The couple asked for changes', section: 'requirements' };
  if (!has('vendors')) {
    if (!w.vendor_sourcing || w.vendor_sourcing === 'later') {
      if (!latestAgreement) return { label: 'Confirm scope, then prepare the agreement', section: 'agreement' };
    } else if (!r.requests.length) return { label: 'Send vendor briefs', section: 'vendors' };
    else if (r.proposals.some((p) => p.agency_status === 'received')) return { label: 'Review new proposals', section: 'vendors' };
    else if (!shared.length) return { label: 'Share a shortlist with the couple', section: 'vendors' };
    else return { label: 'Waiting for the couple’s vendor choices', section: 'vendors', waiting: true };
  }
  if (!latestAgreement || latestAgreement.status === 'superseded') return { label: 'Prepare the agreement', section: 'agreement' };
  if (latestAgreement.status === 'draft') return { label: 'Send the agreement', section: 'agreement' };
  if (latestAgreement.status === 'sent') return { label: 'Waiting for the couple to accept the agreement', section: 'agreement', waiting: true };
  if (!r.payments.length) return { label: 'Add the payment timeline', section: 'payments' };
  if (!r.events.length) return { label: 'Build the event schedule', section: 'schedule' };
  if (!w.schedule_final_at) return { label: 'Share the final schedule', section: 'schedule' };
  if (!w.completed_at) {
    const last = r.events.map((e) => e.event_date).sort().pop();
    if (last && last < today()) return { label: 'Close out the wedding', section: 'payments' };
    return { label: 'Keep tasks and payments on track', section: 'tasks', waiting: true };
  }
  return { label: 'Wedding complete', section: 'overview', waiting: true };
}

// A few alerts that need the planner, most urgent first.
function alerts(w, r) {
  const out = [];
  const now = today();
  r.payments.filter((p) => paymentState(p, now) === 'overdue').forEach((p) => out.push({ level: 'high', label: `${p.label} is overdue`, section: 'payments' }));
  const late = r.tasks.filter((t) => t.status !== 'done' && t.due_date && t.due_date < now);
  if (late.length) out.push({ level: 'high', label: `${late.length} overdue task${late.length > 1 ? 's' : ''}`, section: 'tasks' });
  if (r.docs[0] && r.docs[0].couple_response === 'changes_requested') out.push({ level: 'soon', label: 'Couple asked for changes to the requirements', section: 'requirements' });
  const unanswered = r.questions.filter((q) => !q.answered_at).length;
  if (unanswered) out.push({ level: 'soon', label: `${unanswered} vendor question${unanswered > 1 ? 's' : ''} from the couple`, section: 'vendors' });
  if (r.docs[0] && r.docs[0].status === 'draft' && JSON.parse(r.docs[0].conflicts_json || '[]').some((c) => c.severity === 'significant')) {
    out.push({ level: 'soon', label: 'Draft has conflicts to resolve', section: 'requirements' });
  }
  if (r.proposals.some((p) => p.agency_status === 'received')) out.push({ level: 'normal', label: 'New vendor proposals to review', section: 'vendors' });
  const rank = { high: 0, soon: 1, normal: 2 };
  return out.sort((a, b) => rank[a.level] - rank[b.level]).slice(0, 3);
}

module.exports = { milestones, stageIndex, STAGE_LABELS, plannerNext, alerts, paymentState, vendorsResolved };
