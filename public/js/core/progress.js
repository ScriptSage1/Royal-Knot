// Planning-progress model shared by the couple portal, the planner workspace
// and the garden background. A wedding's progress is a set of completed
// milestones plus a task-completion fraction, both derived on the server from
// the wedding's records (server/services/stage.js uses the same keys).

export const MILESTONES = [
  { key: 'enquiry',       label: 'Planning details shared',  coupleLabel: 'Share your details',       weight: 1 },
  { key: 'consultBooked', label: 'Consultation booked',      coupleLabel: 'Book a consultation',      weight: 1 },
  { key: 'consultHeld',   label: 'Consultation held',        coupleLabel: 'Meet your planner',        weight: 1 },
  { key: 'requirements',  label: 'Requirements approved',    coupleLabel: 'Approve your plan summary', weight: 1 },
  { key: 'vendors',       label: 'Vendors selected',         coupleLabel: 'Choose your vendors',      weight: 1.5 },
  { key: 'agreement',     label: 'Service agreement signed', coupleLabel: 'Sign the agreement',       weight: 1 },
  { key: 'tasks',         label: 'Planning tasks complete',  coupleLabel: 'Planning in progress',     weight: 2, partial: true },
  { key: 'schedule',      label: 'Wedding schedule final',   coupleLabel: 'Finalise the schedule',    weight: 1 },
  { key: 'complete',      label: 'Wedding plan complete',    coupleLabel: 'Your plan is complete',    weight: 0.5 },
];

// 0…1. Reaches 1 only when every milestone, including "complete", is done.
export function progressOf(state) {
  let total = 0, got = 0;
  for (const m of MILESTONES) {
    total += m.weight;
    if (state.done.has(m.key)) got += m.weight;
    else if (m.partial) got += m.weight * Math.min(1, state.tasks || 0);
  }
  const p = got / total;
  return state.done.has('complete') ? 1 : Math.min(p, 0.97);
}

// Broadcast progress to the garden background.
export function publishProgress(p) {
  window.dispatchEvent(new CustomEvent('rk:progress', { detail: { progress: p } }));
}
