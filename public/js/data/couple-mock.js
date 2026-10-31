// MOCK DATA — couple-facing projection. Held in browser memory only.
// This is deliberately a separate file from agency-mock.js: the couple portal
// never loads internal notes, transcripts, internal vendor comments or vendor
// arrival tracking. A later API should apply the same projection server-side.

export const COUPLE = {
  planner: { name: 'Priya N.', role: 'Your planner' },

  // Empty until the couple shares details (kept in memory only).
  profile: {
    names: '',
    dateMode: 'month',     // 'exact' | 'month' | 'undecided'
    date: '', month: '',
    location: '',
    guests: 200,
    budget: '',
    eventsCount: '',
    whatMatters: '',
    traditionsNote: '',
    traditionsDeciding: false,
    traditionsDiscuss: false,
  },

  consultation: {
    // Slots a planner has offered. INTEGRATION: scheduling module.
    slots: [
      { date: '2026-11-04', time: '11:00', mode: 'Video call' },
      { date: '2026-11-04', time: '16:30', mode: 'Video call' },
      { date: '2026-11-06', time: '12:00', mode: 'In person · Studio' },
      { date: '2026-11-07', time: '10:00', mode: 'Video call' },
    ],
    booked: null,
    heldSlot: { date: '2026-09-18', time: '16:00', mode: 'Video call' },
  },

  requirementsSummary: {
    updated: '2026-09-29',
    sections: [
      { title: 'Your celebration', items: ['Three days, five events', 'About 250 guests on the main day, ~120 on other days', 'Lakeside or garden venue'] },
      { title: 'Style & feel', items: ['Relaxed and warm, lots of greenery', 'Soft evening lighting', 'Live acoustic music at the welcome evening'] },
      { title: 'Food', items: ['Vegetarian menu across all events', 'A no-onion/no-garlic counter', 'Allergens clearly labelled'] },
      { title: 'Traditions & customs', items: ['A morning ceremony that brings in elements from both families', 'You’ll share the order of proceedings by December'] },
      { title: 'Accessibility', items: ['Step-free access at every venue', 'Seating for elders near the front'] },
    ],
  },

  // Only options the agency has shortlisted for the couple. No internal notes.
  shortlist: [
    {
      category: 'Catering',
      options: [
        { vendor: 'Saffron Table Caterers', total: 1462500, perPlate: 1950, scope: 'All 5 events, full service staff', inclusions: ['Live counters at reception', 'No-onion counter', 'Crockery & service staff'], exclusions: ['Bar service', 'Venue kitchen fees'], extras: [{ label: 'Late-night snack counter', amount: 85000 }], plannerNote: 'Our recommendation — very strong on timing and the tasting.' },
        { vendor: 'Green Leaf Kitchens', total: 1305000, perPlate: 1740, scope: 'All 5 events, buffet format', inclusions: ['Buffet setup', 'Service staff'], exclusions: ['Live counters', 'Crockery upgrade', 'Venue kitchen fees'], extras: [{ label: 'Live counters', amount: 120000 }, { label: 'Crockery upgrade', amount: 60000 }], plannerNote: 'Lower base price; add-ons bring it closer.' },
      ],
    },
    {
      category: 'Décor',
      options: [
        { vendor: 'Fernwood Studio', total: 1180000, perPlate: null, scope: 'All venues, 5 events', inclusions: ['Floral & greenery', 'Lighting', 'Seating layouts'], exclusions: ['Generator hire'], extras: [{ label: 'Extra lighting for rain plan', amount: 75000 }], plannerNote: 'Covers every event with one team.' },
        { vendor: 'Lumen & Bloom', total: 1040000, perPlate: null, scope: 'Main day + reception', inclusions: ['Floral', 'Lighting'], exclusions: ['Welcome evening', 'Brunch'], extras: [], plannerNote: 'Would need a second vendor for the other days.' },
      ],
    },
  ],
  // The option the couple picked per category once vendors are selected.
  selectedVendors: { Catering: 'Saffron Table Caterers', 'Décor': 'Fernwood Studio' },

  agreement: {
    title: 'Wedding planning service agreement',
    summary: [
      ['Services', 'Full planning and day-of coordination for 5 events over 3 days'],
      ['Planning fee', '₹6,50,000 + taxes'],
      ['Payments', 'Booking, pre-wedding advance, and final payment after the event'],
    ],
    file: null,
  },

  payments: [
    { label: 'Booking payment', kind: 'booking', amount: 195000, due: '2026-10-05' },
    { label: 'Planning advance', kind: 'advance', amount: 1850000, due: '2026-12-15' },
    { label: 'Pre-wedding advance', kind: 'advance', amount: 2400000, due: '2027-01-25' },
    { label: 'Final payment (after the event)', kind: 'final', amount: 980000, due: '2027-02-28' },
  ],

  // Couple-relevant event info only — no vendor arrival tracking.
  events: [
    { date: '2027-02-11', label: 'Day 1', items: [
      { name: 'Guest arrivals & welcome evening', start: '17:00', end: '22:00', venue: 'Lakeside lawn', note: 'Relaxed dress. Acoustic music from 7 pm.' } ] },
    { date: '2027-02-12', label: 'Day 2', items: [
      { name: 'Morning ceremony', start: '09:30', end: '12:30', venue: 'Garden pavilion', note: 'Please arrive by 9:00.' },
      { name: 'Family lunch', start: '13:00', end: '15:00', venue: 'Courtyard', note: '' },
      { name: 'Evening reception', start: '19:00', end: '23:30', venue: 'Lakeside lawn', note: 'Shuttle from hotel at 6:30 pm.' } ] },
    { date: '2027-02-13', label: 'Day 3', items: [
      { name: 'Farewell brunch', start: '10:30', end: '13:00', venue: 'Terrace', note: 'Checkout by 12 pm.' } ] },
  ],
  dayOf: [
    { role: 'Lead planner on the day', name: 'Priya N.' },
    { role: 'Guest logistics', name: 'Daniel R.' },
    { role: 'Family point of contact', name: 'You choose — share with your planner' },
  ],
};
