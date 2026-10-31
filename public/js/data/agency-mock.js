// MOCK DATA — internal agency view. Held in browser memory only.
// Shapes mirror the records later modules will load from SQL. Collections are
// arrays on purpose: weddings may have any number of events, vendors,
// proposals, tasks and payment milestones.
//
// `mockKey` is a preview route key for this file only. It is NOT a workspace
// ID; real IDs will be assigned by the workspace module.

export const PLANNERS = ['Priya N.', 'Daniel R.', 'Farah S.'];

export const CASES = [
  { mockKey: 'sample-a', coupleLabel: 'Asha & Kiran', approxDate: '2027-02-12', location: 'Udaipur', guests: 250, budgetRange: '₹50 L – 1 Cr', planner: 'Priya N.', stage: 7, nextStep: 'Confirm décor final layout', moneyDue: 1850000, flags: [] },
  { mockKey: 'sample-b', coupleLabel: 'Meera & Jordan', approxDate: '2027-01-23', location: 'Goa', guests: 140, budgetRange: '₹25 – 50 L', planner: 'Daniel R.', stage: 5, nextStep: 'Send catering shortlist', moneyDue: 600000, flags: ['Vendor quotes pending'] },
  { mockKey: 'sample-c', coupleLabel: 'Noor & Alex', approxDate: '2027-04-10', location: 'Bengaluru', guests: 90, budgetRange: 'Under ₹25 L', planner: 'Farah S.', stage: 3, nextStep: 'Draft requirements document', moneyDue: 0, flags: [] },
  { mockKey: 'sample-d', coupleLabel: 'Ravi & Sam', approxDate: '2026-12-05', location: 'Jaipur', guests: 420, budgetRange: '₹1 – 3 Cr', planner: 'Priya N.', stage: 8, nextStep: 'Day-of run sheet sign-off', moneyDue: 3200000, flags: ['Advance overdue'] },
  { mockKey: 'sample-e', coupleLabel: 'Enquiry · names not shared', approxDate: null, location: 'Kochi (tentative)', guests: 200, budgetRange: 'Not sure yet', planner: null, stage: 1, nextStep: 'Offer consultation slots', moneyDue: 0, flags: ['Unassigned'] },
  { mockKey: 'sample-f', coupleLabel: 'Tara & Ishaan', approxDate: '2026-11-14', location: 'Mussoorie', guests: 160, budgetRange: '₹50 L – 1 Cr', planner: 'Daniel R.', stage: 9, nextStep: 'Final payment & vendor closeout', moneyDue: 950000, flags: [] },
];

const FULL = {
  mockKey: 'sample-a',
  coupleLabel: 'Asha & Kiran',
  people: [
    { name: 'Asha', role: 'Partner', contact: 'Shared via portal' },
    { name: 'Kiran', role: 'Partner', contact: 'Shared via portal' },
    { name: 'Lata', role: 'Family coordinator', contact: 'Shared via portal' },
  ],
  approxDate: '2027-02-12',
  dateNote: 'Mid-February 2027 · flexible by a week',
  location: 'Udaipur, Rajasthan',
  guests: 250,
  budgetRange: '₹50 L – 1 Cr',
  planner: 'Priya N.',
  stage: 7,
  preferences: ['Outdoor where possible', 'Relaxed, warm feel', 'Lots of greenery', 'Live acoustic music'],
  traditions: {
    note: 'Two families with different customs — we’d like a morning ceremony that includes elements from both, and a separate relaxed evening. Some elders need vegetarian and no-onion options.',
    discussWithPlanner: true,
  },

  meeting: {
    status: 'Held',
    date: '2026-09-18', time: '16:00', duration: '60 min',
    mode: 'Video call',
    attendees: ['Asha', 'Kiran', 'Priya N. (planner)'],
    meetLink: null,   // INTEGRATION: Google Meet module
    transcript: null, // INTEGRATION: transcript capture module
  },
  agentNotes: [
    { at: '2026-09-18T17:10', author: 'Priya N.', text: 'Both partners keen on a lakeside venue. Grandparents attending — step-free access needed at every venue.' },
    { at: '2026-09-20T11:30', author: 'Priya N.', text: 'Budget is firm at the upper end; prefer fewer, better vendors over lots of add-ons.' },
  ],

  requirements: {
    status: 'Approved',
    version: 'Mock v2',
    updated: '2026-09-29',
    sections: [
      { title: 'Celebration overview', items: ['Three days, five events', 'Approx. 250 guests on the main day, ~120 on other days', 'Lakeside or garden venue preferred'] },
      { title: 'Style & feel', items: ['Relaxed, warm, lots of greenery', 'Soft evening lighting', 'Live acoustic set at the welcome evening'] },
      { title: 'Food & dietary', items: ['Fully vegetarian menu across all events', 'No-onion/no-garlic counter for some elders', 'Clearly labelled allergens'] },
      { title: 'Traditions & customs', items: ['Morning ceremony blending elements from both families — details to be finalised with families', 'Couple to share order of proceedings by December'] },
      { title: 'Accessibility', items: ['Step-free access at all venues', 'Seating for elders near the front at every event'] },
    ],
  },
  checklist: [
    { label: 'Confirm guest count ranges per event', done: true },
    { label: 'Collect dietary needs list from families', done: true },
    { label: 'Venue accessibility walk-through', done: false },
    { label: 'Share vendor shortlist for photography', done: false },
    { label: 'Agree contingency plan for rain', done: false },
  ],

  agreement: {
    status: 'Signed',
    title: 'Wedding planning service agreement',
    history: [
      { status: 'Draft', at: '2026-09-30' },
      { status: 'Sent', at: '2026-10-01' },
      { status: 'Viewed', at: '2026-10-02' },
      { status: 'Signed', at: '2026-10-04' },
    ],
    summary: [
      ['Services', 'Full planning and day-of coordination for 5 events over 3 days'],
      ['Planning fee', '₹6,50,000 + taxes'],
      ['Payments', 'Booking, pre-wedding advance, and final payment after the event'],
      ['Cancellation', 'Per schedule in clause 9 (placeholder)'],
    ],
    file: null, // INTEGRATION: digital signing module attaches the signed file
  },

  vendorRequests: [
    {
      category: 'Catering', brief: 'Vegetarian menu for 5 events, 120–250 guests, no-onion counter.', sentTo: 4, responses: 3, dueBy: '2026-10-20',
      proposals: [
        { vendor: 'Saffron Table Caterers', status: 'Selected', total: 1462500, perPlate: 1950, plates: 750, scope: 'All 5 events, full service staff', inclusions: ['Live counters at reception', 'No-onion counter', 'Crockery & service staff'], exclusions: ['Bar service', 'Venue kitchen fees'], extras: [{ label: 'Late-night snack counter', amount: 85000 }], lines: [{ label: 'Main day dinner', qty: 250, unit: 'plates', amount: 562500 }, { label: 'Other events', qty: 500, unit: 'plates', amount: 900000 }], internalNote: 'Reliable on timing; tasting went very well.' },
        { vendor: 'Green Leaf Kitchens', status: 'Shortlisted', total: 1305000, perPlate: 1740, plates: 750, scope: 'All 5 events, buffet format', inclusions: ['Buffet setup', 'Service staff'], exclusions: ['Live counters', 'Crockery upgrade', 'Venue kitchen fees'], extras: [{ label: 'Live counters', amount: 120000 }, { label: 'Crockery upgrade', amount: 60000 }], lines: [{ label: 'Main day dinner', qty: 250, unit: 'plates', amount: 480000 }, { label: 'Other events', qty: 500, unit: 'plates', amount: 825000 }], internalNote: 'Cheaper base, but extras close the gap.' },
        { vendor: 'Courtyard Feasts', status: 'Declined', total: 1710000, perPlate: 2280, plates: 750, scope: 'Main day + reception only', inclusions: ['Plated service'], exclusions: ['Welcome & brunch events'], extras: [], lines: [{ label: 'Main day + reception', qty: 750, unit: 'plates', amount: 1710000 }], internalNote: 'Could not cover all days.' },
      ],
    },
    {
      category: 'Décor', brief: 'Greenery-led décor, soft lighting, step-free layouts.', sentTo: 3, responses: 2, dueBy: '2026-10-22',
      proposals: [
        { vendor: 'Fernwood Studio', status: 'Selected', total: 1180000, perPlate: null, scope: 'All venues, 5 events', inclusions: ['Floral & greenery', 'Lighting', 'Seating layouts'], exclusions: ['Generator hire'], extras: [{ label: 'Extra lighting for rain plan', amount: 75000 }], lines: [{ label: 'Main ceremony setup', qty: 1, unit: 'setup', amount: 520000 }, { label: 'Other events', qty: 4, unit: 'setups', amount: 660000 }], internalNote: 'Strong portfolio for garden venues.' },
        { vendor: 'Lumen & Bloom', status: 'Shortlisted', total: 1040000, perPlate: null, scope: 'Main day + reception', inclusions: ['Floral', 'Lighting'], exclusions: ['Welcome evening', 'Brunch'], extras: [], lines: [{ label: 'Main day + reception', qty: 2, unit: 'setups', amount: 1040000 }], internalNote: 'Good, but would need a second vendor for other days.' },
      ],
    },
    {
      category: 'Photography', brief: 'Candid photo + film, all events.', sentTo: 3, responses: 1, dueBy: '2026-11-08',
      proposals: [
        { vendor: 'Northlight Collective', status: 'Received', total: 640000, perPlate: null, scope: 'Photo + film, all 5 events', inclusions: ['2 photographers, 1 filmmaker', 'Edited album'], exclusions: ['Drone (permit needed)'], extras: [{ label: 'Drone coverage', amount: 45000 }], lines: [{ label: 'Coverage, 3 days', qty: 3, unit: 'days', amount: 540000 }, { label: 'Album', qty: 1, unit: 'album', amount: 100000 }], internalNote: 'Waiting on two more quotes.' },
      ],
    },
  ],

  tasks: [
    { title: 'Send consultation summary', owner: 'Priya N.', ownerType: 'Agency', stage: 'Discovery', due: '2026-09-20', status: 'Done' },
    { title: 'Approve requirements summary', owner: 'Asha & Kiran', ownerType: 'Couple', stage: 'Discovery', due: '2026-09-29', status: 'Done' },
    { title: 'Collect catering quotes', owner: 'Priya N.', ownerType: 'Agency', stage: 'Vendors', due: '2026-10-20', status: 'Done' },
    { title: 'Catering tasting', owner: 'Saffron Table Caterers', ownerType: 'Vendor', stage: 'Vendors', due: '2026-10-28', status: 'Done' },
    { title: 'Photography shortlist to couple', owner: 'Priya N.', ownerType: 'Agency', stage: 'Vendors', due: '2026-11-10', status: 'In progress' },
    { title: 'Share guest list (draft)', owner: 'Asha & Kiran', ownerType: 'Couple', stage: 'Guests', due: '2026-11-15', status: 'In progress' },
    { title: 'Room block at hotel', owner: 'Daniel R.', ownerType: 'Agency', stage: 'Logistics', due: '2026-11-20', status: 'Pending' },
    { title: 'Décor final layout', owner: 'Fernwood Studio', ownerType: 'Vendor', stage: 'Design', due: '2026-12-01', status: 'In progress' },
    { title: 'Rain contingency plan', owner: 'Priya N.', ownerType: 'Agency', stage: 'Logistics', due: '2026-12-10', status: 'Pending' },
    { title: 'Order of proceedings for ceremony', owner: 'Asha & Kiran', ownerType: 'Couple', stage: 'Ceremony', due: '2026-12-15', status: 'Pending' },
    { title: 'Guest transport schedule', owner: 'Daniel R.', ownerType: 'Agency', stage: 'Logistics', due: '2027-01-10', status: 'Pending' },
    { title: 'Day-of run sheet', owner: 'Priya N.', ownerType: 'Agency', stage: 'Day-of', due: '2027-02-01', status: 'Pending' },
  ],

  schedule: [
    { date: '2027-02-11', label: 'Day 1', events: [
      { name: 'Guest arrivals & welcome evening', start: '17:00', end: '22:00', venue: 'Lakeside lawn', owner: 'Daniel R.', coupleNote: 'Relaxed dress. Acoustic music from 7 pm.',
        vendors: [ { name: 'Fernwood Studio', role: 'Décor', arrival: '12:00', status: 'Expected' }, { name: 'Saffron Table Caterers', role: 'Catering', arrival: '14:30', status: 'Expected' }, { name: 'Acoustic trio (TBC)', role: 'Music', arrival: '17:30', status: 'Not confirmed' } ] },
    ] },
    { date: '2027-02-12', label: 'Day 2', events: [
      { name: 'Morning ceremony', start: '09:30', end: '12:30', venue: 'Garden pavilion', owner: 'Priya N.', coupleNote: 'Please arrive by 9:00. Order of proceedings to be shared.',
        vendors: [ { name: 'Fernwood Studio', role: 'Décor', arrival: '05:30', status: 'Expected' }, { name: 'Northlight Collective', role: 'Photography', arrival: '08:00', status: 'Expected' } ] },
      { name: 'Family lunch', start: '13:00', end: '15:00', venue: 'Courtyard', owner: 'Daniel R.', coupleNote: '',
        vendors: [ { name: 'Saffron Table Caterers', role: 'Catering', arrival: '10:30', status: 'Expected' } ] },
      { name: 'Evening reception', start: '19:00', end: '23:30', venue: 'Lakeside lawn', owner: 'Priya N.', coupleNote: 'Evening wear. Shuttle from hotel at 6:30 pm.',
        vendors: [ { name: 'Fernwood Studio', role: 'Lighting', arrival: '15:00', status: 'Expected' }, { name: 'Saffron Table Caterers', role: 'Catering', arrival: '16:00', status: 'Expected' }, { name: 'Northlight Collective', role: 'Photography', arrival: '18:30', status: 'Expected' } ] },
    ] },
    { date: '2027-02-13', label: 'Day 3', events: [
      { name: 'Farewell brunch', start: '10:30', end: '13:00', venue: 'Terrace', owner: 'Daniel R.', coupleNote: 'Casual. Checkout by 12 pm.',
        vendors: [ { name: 'Saffron Table Caterers', role: 'Catering', arrival: '08:00', status: 'Expected' } ] },
    ] },
  ],

  payments: [
    { label: 'Booking payment', kind: 'booking', amount: 195000, due: '2026-10-05', status: 'Paid', paidOn: '2026-10-04' },
    { label: 'Planning advance', kind: 'advance', amount: 1850000, due: '2026-12-15', status: 'Due' },
    { label: 'Pre-wedding advance', kind: 'advance', amount: 2400000, due: '2027-01-25', status: 'Upcoming' },
    { label: 'Final payment (after the event)', kind: 'final', amount: 980000, due: '2027-02-28', status: 'Upcoming' },
  ],
  vendorBills: [
    { vendor: 'Saffron Table Caterers', category: 'Catering', amount: 1462500, paid: 300000, due: '2027-01-30', status: 'Partially paid' },
    { vendor: 'Fernwood Studio', category: 'Décor', amount: 1180000, paid: 250000, due: '2027-01-30', status: 'Partially paid' },
    { vendor: 'Northlight Collective', category: 'Photography', amount: 640000, paid: 0, due: '2027-02-05', status: 'Quote pending' },
  ],
  extras: [
    { label: 'Late-night snack counter', amount: 85000, billable: true, status: 'Approved' },
    { label: 'Rain-plan lighting', amount: 75000, billable: true, status: 'Pending' },
    { label: 'Courier for family gifts', amount: 12000, billable: false, status: 'Approved' },
  ],
};

// Lighter cases get empty collections so empty states render naturally.
function lightDetail(c) {
  return {
    ...c,
    people: [],
    dateNote: c.approxDate ? 'Approximate date' : 'Date not decided yet',
    preferences: [],
    traditions: { note: '', discussWithPlanner: false },
    meeting: { status: c.stage >= 2 ? 'Scheduled' : 'Not booked', date: null, time: null, mode: null, attendees: [], meetLink: null, transcript: null },
    agentNotes: [],
    requirements: { status: c.stage >= 4 ? 'Approved' : c.stage >= 3 ? 'Draft' : 'Not started', version: null, updated: null, sections: [] },
    checklist: [],
    agreement: { status: c.stage >= 5 ? 'Signed' : c.stage >= 4 ? 'Sent' : 'Not started', title: 'Wedding planning service agreement', history: [], summary: [], file: null },
    vendorRequests: [], tasks: [], schedule: [], payments: [], vendorBills: [], extras: [],
  };
}

export function weddingDetail(mockKey) {
  if (mockKey === FULL.mockKey) return FULL;
  const c = CASES.find((x) => x.mockKey === mockKey);
  return c ? lightDetail(c) : null;
}

export const SEASON = {
  label: 'Season 2026–27',
  weddings: CASES,
  upcomingMoney: [
    { couple: 'Ravi & Sam', label: 'Pre-wedding advance', amount: 3200000, due: '2026-10-25', status: 'Overdue' },
    { couple: 'Tara & Ishaan', label: 'Final payment', amount: 950000, due: '2026-11-30', status: 'Upcoming' },
    { couple: 'Asha & Kiran', label: 'Planning advance', amount: 1850000, due: '2026-12-15', status: 'Due' },
    { couple: 'Meera & Jordan', label: 'Booking payment', amount: 600000, due: '2026-11-12', status: 'Due' },
  ],
  vendorBillsDue: 4180000,
  vendors: [
    { name: 'Saffron Table Caterers', category: 'Catering', weddings: 6, onTime: 0.97, rating: 4.8, issues: 0 },
    { name: 'Fernwood Studio', category: 'Décor', weddings: 4, onTime: 0.92, rating: 4.6, issues: 1 },
    { name: 'Northlight Collective', category: 'Photography', weddings: 5, onTime: 1, rating: 4.9, issues: 0 },
    { name: 'Green Leaf Kitchens', category: 'Catering', weddings: 3, onTime: 0.81, rating: 4.1, issues: 2 },
    { name: 'Lumen & Bloom', category: 'Décor', weddings: 2, onTime: 0.88, rating: 4.3, issues: 1 },
  ],
};
