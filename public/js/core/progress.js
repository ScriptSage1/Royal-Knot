// Planning-progress model shared by the couple portal, the agent workspace and
// the garden background. A wedding's progress is a set of completed milestones
// plus a task-completion fraction. Later this comes from the wedding record.

export const MILESTONES = [
  { key: 'enquiry',       label: 'Planning details shared',  coupleLabel: 'Share your details',       weight: 1 },
  { key: 'consultBooked', label: 'Consultation booked',      coupleLabel: 'Book a consultation',      weight: 1 },
  { key: 'consultHeld',   label: 'Consultation held',        coupleLabel: 'Meet your planner',        weight: 1 },
  { key: 'requirements',  label: 'Requirements approved',    coupleLabel: 'Approve your plan summary', weight: 1 },
  { key: 'agreement',     label: 'Service agreement signed', coupleLabel: 'Sign the agreement',       weight: 1 },
  { key: 'vendors',       label: 'Vendors selected',         coupleLabel: 'Choose your vendors',      weight: 1.5 },
  { key: 'tasks',         label: 'Planning tasks complete',  coupleLabel: 'Planning in progress',     weight: 2, partial: true },
  { key: 'schedule',      label: 'Wedding schedule final',   coupleLabel: 'Finalise the schedule',    weight: 1 },
  { key: 'complete',      label: 'Wedding plan complete',    coupleLabel: 'Your plan is complete',    weight: 0.5 },
];

// Preview stages used by the developer control and `?stage=N`.
export const STAGES = [
  { label: 'New enquiry',            done: [],                                                     tasks: 0 },
  { label: 'Details shared',         done: ['enquiry'],                                            tasks: 0 },
  { label: 'Consultation booked',    done: ['enquiry', 'consultBooked'],                           tasks: 0 },
  { label: 'Consultation held',      done: ['enquiry', 'consultBooked', 'consultHeld'],            tasks: 0 },
  { label: 'Requirements approved',  done: ['enquiry', 'consultBooked', 'consultHeld', 'requirements'], tasks: 0.05 },
  { label: 'Agreement signed',       done: ['enquiry', 'consultBooked', 'consultHeld', 'requirements', 'agreement'], tasks: 0.15 },
  { label: 'Vendors selected',       done: ['enquiry', 'consultBooked', 'consultHeld', 'requirements', 'agreement', 'vendors'], tasks: 0.35 },
  { label: 'Tasks well underway',    done: ['enquiry', 'consultBooked', 'consultHeld', 'requirements', 'agreement', 'vendors'], tasks: 0.7 },
  { label: 'Schedule final',         done: ['enquiry', 'consultBooked', 'consultHeld', 'requirements', 'agreement', 'vendors', 'tasks', 'schedule'], tasks: 1 },
  { label: 'Wedding plan complete',  done: MILESTONES.map((m) => m.key),                           tasks: 1 },
];

export function stageState(i) {
  const s = STAGES[Math.max(0, Math.min(STAGES.length - 1, i))];
  return { done: new Set(s.done), tasks: s.tasks };
}

// Infer the nearest preview stage from a state (for the dev select default).
export function stageIndexOf(state) {
  let best = 0;
  STAGES.forEach((s, i) => { if (s.done.every((k) => state.done.has(k)) && state.tasks >= s.tasks - 1e-6) best = i; });
  return best;
}

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

// Status for a stepper: 'done' | 'current' | 'upcoming'
export function milestoneStatuses(state) {
  let currentSet = false;
  return MILESTONES.map((m) => {
    if (state.done.has(m.key)) return { ...m, status: 'done' };
    if (!currentSet) { currentSet = true; return { ...m, status: 'current' }; }
    return { ...m, status: 'upcoming' };
  });
}

// Read ?stage=N from the URL (developer preview only).
export function stageFromUrl() {
  const v = new URLSearchParams(location.search).get('stage');
  return v == null || v === '' || isNaN(+v) ? null : +v;
}

export function writeStageToUrl(i) {
  const u = new URL(location.href);
  u.searchParams.set('stage', i);
  history.replaceState(null, '', u);
}

// Broadcast progress to the garden background.
export function publishProgress(p) {
  window.dispatchEvent(new CustomEvent('rk:progress', { detail: { progress: p } }));
}
