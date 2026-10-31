// DEVELOPMENT SEED — demo accounts and three sample weddings for the
// presentation. Every seeded user and wedding is flagged `is_demo = 1`, and
// seeding is refused in production unless ALLOW_DEMO_SEED=true.
// Dates are relative to today so the demo never goes stale.
const config = require('../config');
const { one, run, tx } = require('./index');
const { hashPassword } = require('../auth/passwords');
const { today, addDays } = require('../lib/dates');

const T = today();
const d = (n) => addDays(T, n);
const at = (n, hhmm) => `${d(n)}T${hhmm}`;
const ins = (sql, ...p) => Number(run(sql, ...p).lastInsertRowid);
const json = (x) => JSON.stringify(x);

async function seedDemo() {
  if (!config.allowDemoSeed) throw new Error('Demo seeding is disabled in production (set ALLOW_DEMO_SEED=true to override).');
  if (one('SELECT 1 FROM users LIMIT 1')) throw new Error('The database already has users. Use `npm run db:reset` for a clean demo.');
  const hash = await hashPassword(config.demoPassword);

  tx(() => {
    const user = (email, name, role, vendorId = null) => ins('INSERT INTO users (email, password_hash, name, role, vendor_id, is_demo) VALUES (?, ?, ?, ?, ?, 1)', email, hash, name, role, vendorId);

    // ---------- agency ----------
    const priya = user('priya@royalknot.test', 'Priya Nair', 'planner');
    const daniel = user('daniel@royalknot.test', 'Daniel Rao', 'planner');

    // ---------- vendor directory ----------
    const cat = {};
    for (const name of ['Catering', 'Décor', 'Photography & film', 'Music & entertainment', 'Venue', 'Hair & makeup', 'Guest transport']) cat[name] = ins('INSERT INTO vendor_categories (name) VALUES (?)', name);
    const vendor = (name, category, city, email = '') => ins('INSERT INTO vendors (name, category_id, city, email) VALUES (?, ?, ?, ?)', name, cat[category], city, email);
    const saffron = vendor('Saffron Table Caterers', 'Catering', 'Udaipur', 'saffron@vendors.test');
    const greenLeaf = vendor('Green Leaf Kitchens', 'Catering', 'Udaipur');
    const fernwood = vendor('Fernwood Studio', 'Décor', 'Jaipur', 'fernwood@vendors.test');
    const lumen = vendor('Lumen & Bloom', 'Décor', 'Udaipur');
    const northlight = vendor('Northlight Collective', 'Photography & film', 'Mumbai', 'northlight@vendors.test');
    const monsoon = vendor('Monsoon Frames', 'Photography & film', 'Delhi');
    const raag = vendor('Raag Ensemble', 'Music & entertainment', 'Udaipur', 'raag@vendors.test');
    vendor('Lakeview Haveli', 'Venue', 'Udaipur');
    vendor('Rangoli Rides', 'Guest transport', 'Jaipur');
    user('saffron@vendors.test', 'Saffron Table Caterers', 'vendor', saffron);
    user('fernwood@vendors.test', 'Fernwood Studio', 'vendor', fernwood);
    user('northlight@vendors.test', 'Northlight Collective', 'vendor', northlight);
    user('raag@vendors.test', 'Raag Ensemble', 'vendor', raag);

    // ---------- wedding A: Asha & Kiran — agreement accepted, planning underway ----------
    const A = ins(`INSERT INTO weddings (case_code, invite_code, couple_label, planner_id, date_mode, wedding_date, location, guest_estimate, events_count,
      budget_mode, budget_range, what_matters, priorities, traditions_note, languages, family_note, traditions_discuss, vendor_sourcing, vendor_note,
      details_shared_at, vendors_complete_at, is_demo, created_at) VALUES (?, ?, ?, ?, 'exact', ?, ?, ?, ?, 'range', ?, ?, ?, ?, ?, ?, 1, 'help', ?, ?, ?, 1, ?)`,
    'RK-DEMO-A', 'ASHA-2027', 'Asha & Kiran', priya, d(104), 'Udaipur, Rajasthan', 250, 5, '₹50 L – 1 Cr',
    'Relaxed and warm, with lots of greenery and time to actually talk to people. We want our grandparents to feel looked after.',
    'Lakeside setting, live acoustic music, food everyone can enjoy.',
    'Our families have different customs. We would like a morning ceremony that brings in elements from both, and a separate relaxed evening.',
    'Hindi, Tamil and English', 'Lata (Asha’s aunt) is coordinating for the family.', 'Please help us find caterers, décor and photographers.',
    `${d(-60)}T10:00:00Z`, `${d(-30)}T12:00:00Z`, `${d(-62)}T09:00:00Z`);
    const asha = user('asha@couples.test', 'Asha', 'couple');
    const kiran = user('kiran@couples.test', 'Kiran', 'couple');
    run('INSERT INTO wedding_members (wedding_id, user_id) VALUES (?, ?), (?, ?)', A, asha, A, kiran);

    const apptA = ins(`INSERT INTO appointments (wedding_id, status, preferred_at, scheduled_at, duration_min, format, meeting_link, couple_note, created_by, created_at)
      VALUES (?, 'completed', ?, ?, 60, 'video', '', 'Kiran’s mother may join for the second half.', ?, ?)`, A, at(-45, '16:00'), at(-44, '16:00'), asha, `${d(-58)}T10:00:00Z`);
    ins(`INSERT INTO transcripts (wedding_id, appointment_id, source, status, title, content, created_by, created_at) VALUES (?, ?, 'pasted', 'final', 'First consultation', ?, ?, ?)`,
      A, apptA, [
        'Priya: Thank you both for making time. Tell me how you picture the day.',
        'Asha: Outdoors if we can, by the lake. Green, relaxed, nothing too formal.',
        'Kiran: My grandparents are coming, so we need everything to be step-free, and seating near the front for them.',
        'Asha: Our families have different customs. Mum and Kiran’s parents want a morning ceremony with elements from both sides. We’ll work out the order with them.',
        'Priya: Of course. We’ll leave room for that and you can share the order of proceedings when you’re ready.',
        'Kiran: Food is a big one. Fully vegetarian, and some elders don’t eat onion or garlic.',
        'Asha: And live acoustic music at the welcome evening, please. Not a loud DJ.',
        'Priya: Roughly how many guests?',
        'Kiran: About 250 on the main day, maybe 120 on the other days. Five events over three days.',
        'Priya: Would you like us to source vendors, or do you have some already?',
        'Asha: Please find them for us: catering, décor and photography to start.',
      ].join('\n'), priya, `${d(-44)}T18:00:00Z`);
    const noteA = (topic, body, n) => ins('INSERT INTO planner_notes (wedding_id, author_id, topic, body, created_at) VALUES (?, ?, ?, ?, ?)', A, priya, topic, body, `${d(n)}T12:00:00Z`);
    noteA('emotion', 'Asha lit up talking about the lake at dusk. Kiran is quieter but very focused on his grandparents being comfortable.', -44);
    noteA('family', 'Lata (Asha’s aunt) is the family coordinator. Kiran’s mother wants to be consulted on the ceremony order.', -44);
    noteA('practical', 'Step-free access at every venue is non-negotiable. Budget is firm at the upper end; prefer fewer, better vendors.', -43);
    noteA('culture', 'Do not assume a ceremony format. Families will share their order of proceedings by early December.', -43);

    ins(`INSERT INTO requirements_docs (wedding_id, version, status, generator, sections_json, checklist_json, approved_by, approved_at, shared_at, couple_response, couple_responded_at, created_by, created_at)
      VALUES (?, 1, 'approved', 'manual', ?, '[]', ?, ?, ?, 'confirmed', ?, ?, ?)`, A, json([
      { title: 'Celebration overview', items: ['Three days, five events', 'About 250 guests on the main day, about 120 on other days', 'Lakeside or garden venue in Udaipur'] },
      { title: 'Feel and priorities', items: ['Relaxed, warm, lots of greenery', 'Soft evening lighting', 'Live acoustic set at the welcome evening'] },
      { title: 'Traditions and customs', items: ['A morning ceremony bringing in elements from both families', 'The families will share the order of proceedings by early December'] },
      { title: 'Food and hospitality', items: ['Fully vegetarian menu across all events', 'A no-onion, no-garlic counter for some elders', 'Allergens clearly labelled'] },
      { title: 'Accessibility and care', items: ['Step-free access at every venue', 'Seating for elders near the front at every event'] },
      { title: 'Vendors', items: ['The agency sources catering, décor and photography'] },
    ]), priya, `${d(-40)}T10:00:00Z`, `${d(-40)}T10:05:00Z`, `${d(-38)}T09:00:00Z`, priya, `${d(-41)}T10:00:00Z`);

    const task = (wid, title, owner, label, due, status, shared = 0, notes = '') => ins('INSERT INTO tasks (wedding_id, title, owner_type, owner_label, due_date, status, shared, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', wid, title, owner, label, due, status, shared, notes);
    task(A, 'Collect dietary needs from both families', 'couple', 'Asha & Kiran', d(-20), 'done', 1);
    task(A, 'Catering tasting with Saffron Table', 'agency', 'Priya', d(-12), 'done');
    task(A, 'Venue accessibility walk-through', 'agency', 'Priya', d(-5), 'done', 0, 'Ramp needed at the terrace; Lakeview confirmed.');
    task(A, 'Confirm the décor layout with Fernwood', 'vendor', 'Fernwood Studio', d(4), 'in_progress');
    task(A, 'Share the draft guest list', 'couple', 'Asha & Kiran', d(9), 'in_progress', 1);
    task(A, 'Book the hotel room block', 'agency', 'Daniel', d(16), 'todo');
    task(A, 'Choose welcome-evening music', 'couple', 'Asha & Kiran', d(24), 'todo', 1, 'Raag Ensemble has been asked for a proposal.');
    task(A, 'Rain contingency plan', 'agency', 'Priya', d(38), 'todo');
    task(A, 'Share the ceremony order of proceedings', 'couple', 'Families', d(40), 'todo', 1);
    task(A, 'Guest transport schedule', 'agency', 'Daniel', d(70), 'todo');

    const request = (wid, category, brief, budget, due, recipients) => {
      const id = ins('INSERT INTO vendor_requests (wedding_id, category_id, brief, budget_note, due_date, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)', wid, cat[category], brief, budget, due, priya, `${d(-36)}T10:00:00Z`);
      for (const [vid, status] of recipients) run('INSERT INTO vendor_request_recipients (request_id, vendor_id, status) VALUES (?, ?, ?)', id, vid, status);
      return id;
    };
    const proposal = (rid, vid, f) => ins(`INSERT INTO proposals (request_id, vendor_id, source, amount, scope, inclusions, exclusions, extras, valid_until, vendor_message,
      internal_comment, note_for_couple, agency_status, shared_at, couple_decision, couple_decided_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    rid, vid, f.source || 'vendor_portal', f.amount, f.scope, f.inc, f.exc, f.extras || '', d(60), f.msg || '', f.internal || '', f.note || '',
    f.status, f.shared ? `${d(-33)}T10:00:00Z` : null, f.decision || null, f.decision ? `${d(-31)}T10:00:00Z` : null, `${d(-34)}T10:00:00Z`);

    const catering = request(A, 'Catering', 'Vegetarian menu for five events, 120–250 guests, with a no-onion, no-garlic counter and clear allergen labels.', '₹12–16 L', d(-25), [[saffron, 'responded'], [greenLeaf, 'responded']]);
    const pSaffron = proposal(catering, saffron, { amount: 1462500, scope: 'All five events with full service staff', inc: 'Live counters at the reception\nNo-onion, no-garlic counter\nCrockery and service staff', exc: 'Bar service\nVenue kitchen fees', extras: 'Late-night snack counter · ₹85,000', internal: 'Reliable on timing; tasting went very well.', note: 'Our recommendation: strong on timing and the tasting.', status: 'shortlisted', shared: true, decision: 'chosen' });
    proposal(catering, greenLeaf, { source: 'planner_entry', amount: 1305000, scope: 'All five events, buffet format', inc: 'Buffet setup\nService staff', exc: 'Live counters\nCrockery upgrade\nVenue kitchen fees', extras: 'Live counters · ₹1,20,000\nCrockery upgrade · ₹60,000', internal: 'Cheaper base, but extras close the gap.', note: 'Lower base price; add-ons bring it closer.', status: 'shortlisted', shared: true, decision: 'declined' });
    const decor = request(A, 'Décor', 'Greenery-led décor with soft evening lighting and step-free layouts across three venues.', '₹10–13 L', d(-25), [[fernwood, 'responded'], [lumen, 'responded']]);
    proposal(decor, fernwood, { amount: 1180000, scope: 'All venues, five events', inc: 'Florals and greenery\nLighting\nSeating layouts', exc: 'Generator hire', extras: 'Rain-plan lighting · ₹75,000', internal: 'Strong portfolio for garden venues.', note: 'Covers every event with one team.', status: 'shortlisted', shared: true, decision: 'chosen' });
    proposal(decor, lumen, { source: 'planner_entry', amount: 1040000, scope: 'Main day and reception only', inc: 'Florals\nLighting', exc: 'Welcome evening\nFarewell brunch', internal: 'Would need a second vendor for the other days.', status: 'declined' });
    const photo = request(A, 'Photography & film', 'Candid photography and film across all five events; a printed album.', '₹6–7 L', d(-22), [[northlight, 'responded'], [monsoon, 'invited']]);
    proposal(photo, northlight, { amount: 640000, scope: 'Photo and film, all five events', inc: 'Two photographers and one filmmaker\nEdited album', exc: 'Drone coverage (permit needed)', extras: 'Drone coverage · ₹45,000', internal: 'Best storytelling of the three we looked at.', note: 'Lovely, natural storytelling.', status: 'shortlisted', shared: true, decision: 'chosen' });
    request(A, 'Music & entertainment', 'Live acoustic trio for the welcome evening (2–3 hours, lakeside lawn, about 120 guests). Gentle volume; elders present.', '₹1.5–2.5 L', d(12), [[raag, 'invited']]);
    ins('INSERT INTO proposal_questions (proposal_id, asked_by, question, answer, answered_by, answered_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      pSaffron, asha, 'Can the no-onion counter also be Jain-friendly?', 'Yes. Saffron Table will label a Jain-friendly section on that counter at no extra cost.', priya, `${d(-32)}T15:00:00Z`, `${d(-32)}T11:00:00Z`);

    ins(`INSERT INTO agreements (wedding_id, version, status, title, scope_summary, terms, fee_amount, vendor_path, scope_confirmed_at, sent_at, accepted_at, accepted_by, signatory_name, acceptance_text, created_by, created_at)
      VALUES (?, 1, 'accepted', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, A, 'Wedding planning service agreement',
    'Full planning and day-of coordination for five events over three days in Udaipur, for about 250 guests on the main day. Includes vendor sourcing and management for catering, décor and photography, guest logistics, and a day-of team of four.',
    '1. Fees: the planning fee is payable in the milestones shown in the payment timeline.\n2. Vendor contracts: vendors are contracted with the couple; the agency manages them.\n3. Changes: changes to scope are agreed in writing and may change the fee.\n4. Cancellation: payments made before cancellation are refundable as set out in the schedule the planner shares.',
    650000, 'Vendors sourced by the agency, as selected by the couple.', `${d(-29)}T10:00:00Z`, `${d(-29)}T10:10:00Z`, `${d(-27)}T19:30:00Z`, asha, 'Asha Menon',
    'Asha Menon accepted version 1 of this agreement on behalf of the couple through The Royal Knot portal, signed in as asha@couples.test.', priya, `${d(-29)}T10:00:00Z`);

    const pay = (wid, label, kind, amount, due, status, paidOn = null, method = '', link = '') => ins('INSERT INTO payments (wedding_id, label, kind, amount, due_date, status, paid_on, method, payment_link, recorded_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', wid, label, kind, amount, due, status, paidOn, method, link, priya);
    pay(A, 'Booking payment', 'booking', 195000, d(-26), 'paid', d(-26), 'Bank transfer');
    pay(A, 'Planning advance', 'advance', 1850000, d(10), 'scheduled');
    pay(A, 'Pre-wedding advance', 'advance', 2400000, d(80), 'scheduled');
    pay(A, 'Final payment (after the wedding)', 'final', 980000, d(120), 'scheduled');

    const ev = (wid, name, n, s, e, venue, note, owner, internal = '') => ins('INSERT INTO events (wedding_id, name, event_date, start_time, end_time, venue, couple_note, owner_label, internal_note) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)', wid, name, d(n), s, e, venue, note, owner, internal);
    const welcome = ev(A, 'Welcome evening', 103, '17:00', '22:00', 'Lakeside lawn', 'Relaxed dress. Acoustic music from 7 pm.', 'Daniel');
    const ceremony = ev(A, 'Morning ceremony', 104, '09:30', '12:30', 'Garden pavilion', 'Please arrive by 9:00.', 'Priya', 'Elders seated front-left; ramp at the pavilion entrance.');
    ev(A, 'Family lunch', 104, '13:00', '15:00', 'Courtyard', '', 'Daniel');
    const reception = ev(A, 'Evening reception', 104, '19:00', '23:30', 'Lakeside lawn', 'Shuttle from the hotel at 6:30 pm.', 'Priya');
    ev(A, 'Farewell brunch', 105, '10:30', '13:00', 'Terrace', 'Casual. Checkout by 12 pm.', 'Daniel');
    const item = (wid, eid, n, t, label, owner) => ins('INSERT INTO run_items (wedding_id, event_id, item_date, item_time, label, owner_label) VALUES (?, ?, ?, ?, ?, ?)', wid, eid, d(n), t, label, owner);
    item(A, welcome, 103, '12:00', 'Fernwood Studio arrives to set the lawn', 'Daniel');
    item(A, welcome, 103, '14:30', 'Saffron Table arrives; kitchen walk-through', 'Daniel');
    item(A, ceremony, 104, '05:30', 'Fernwood Studio dresses the pavilion', 'Priya');
    item(A, ceremony, 104, '08:00', 'Northlight Collective arrives', 'Priya');
    item(A, ceremony, 104, '08:45', 'Ramp and front seating checked', 'Priya');
    item(A, reception, 104, '15:00', 'Lighting rig on the lawn', 'Priya');
    item(A, reception, 104, '18:30', 'Shuttles leave the hotel', 'Daniel');

    // ---------- wedding B: Naina & Rohan — consultation held, ready to draft ----------
    const B = ins(`INSERT INTO weddings (case_code, invite_code, couple_label, planner_id, date_mode, wedding_month, location, guest_estimate, events_count,
      budget_mode, what_matters, priorities, traditions_note, languages, traditions_deciding, vendor_sourcing, vendor_note, details_shared_at, is_demo, created_at)
      VALUES (?, ?, ?, ?, 'month', ?, ?, ?, ?, 'prefer_not', ?, ?, ?, ?, 0, 'own', ?, ?, 1, ?)`,
    'RK-DEMO-B', 'NAIN-2027', 'Naina & Rohan', daniel, d(170).slice(0, 7), 'Jaipur', 180, 3,
    'Close-knit and joyful. An evening garden setting, local seasonal food, and room for both families to feel at home.',
    'Good food, an unhurried evening, a beautiful garden.',
    'The families want to include customs from both sides. They are still talking about the order of events.',
    'Hindi, Marathi, English', 'We already have a photographer (a family friend) and a caterer Rohan’s family has used for years.', `${d(-12)}T10:00:00Z`, `${d(-14)}T09:00:00Z`);
    const naina = user('naina@couples.test', 'Naina', 'couple');
    run('INSERT INTO wedding_members (wedding_id, user_id) VALUES (?, ?)', B, naina);
    const apptB = ins(`INSERT INTO appointments (wedding_id, status, preferred_at, scheduled_at, duration_min, format, place, created_by, created_at)
      VALUES (?, 'completed', ?, ?, 60, 'in_person', 'The Royal Knot studio, Jaipur', ?, ?)`, B, at(-3, '13:00'), at(-2, '13:00'), naina, `${d(-10)}T10:00:00Z`);
    ins(`INSERT INTO transcripts (wedding_id, appointment_id, source, status, title, content, created_by, created_at) VALUES (?, ?, 'pasted', 'final', 'Studio consultation', ?, ?, ?)`,
      B, apptB, [
        'Daniel: Welcome, both of you. Where would you like to start?',
        'Naina: With the feeling. We want it close-knit. About 180 people, no more.',
        'Rohan: An evening in a garden. Lanterns, good food, nobody rushing.',
        'Naina: My grandmother doesn’t walk far, so the garden needs to be easy to get around.',
        'Daniel: Noted. And food?',
        'Rohan: Local and seasonal. My family has a caterer they trust, so we’d like to use them.',
        'Naina: We also have a photographer, a family friend. So we mostly need planning and coordination, and help with décor and the venue.',
        'Daniel: How many events are you imagining?',
        'Naina: Three over two days. A small get-together, the main evening, and a lunch.',
        'Rohan: The families are still deciding the order and some customs. We’ll come back to you on that.',
        'Daniel: Budget?',
        'Naina: We’d rather not say a number yet. We care more about getting the important things right.',
      ].join('\n'), daniel, `${d(-2)}T16:00:00Z`);
    const noteB = (topic, body) => ins('INSERT INTO planner_notes (wedding_id, author_id, topic, body, created_at) VALUES (?, ?, ?, ?, ?)', B, daniel, topic, body, `${d(-2)}T16:30:00Z`);
    noteB('family', 'Rohan’s mother mentioned on the phone afterwards that she expects closer to 250 guests. The couple said 180. Needs a gentle conversation.');
    noteB('emotion', 'Naina is anxious about the families agreeing on the order of events; reassure her that the plan can stay flexible.');
    noteB('practical', 'Grandmother uses a walking stick: short, level paths and seating every few metres.');
    noteB('culture', 'Both families have their own customs; avoid suggesting any fixed format. Anita (Naina’s aunt) will send the customs list.');

    // ---------- wedding C: Meera & Arjun — new enquiry, consultation requested, unassigned ----------
    const C = ins(`INSERT INTO weddings (case_code, invite_code, couple_label, date_mode, location, guest_estimate, budget_mode, what_matters, traditions_deciding,
      vendor_sourcing, details_shared_at, is_demo, created_at) VALUES (?, ?, ?, 'undecided', ?, ?, 'no_fixed', ?, 1, 'later', ?, 1, ?)`,
    'RK-DEMO-C', 'MEER-2027', 'Meera & Arjun', 'Goa, or somewhere by the sea', 120,
    'Barefoot and joyful. Sunset by the sea, music, and our friends from all over the world together.', `${d(-1)}T09:00:00Z`, `${d(-1)}T08:30:00Z`);
    const meera = user('meera@couples.test', 'Meera', 'couple');
    run('INSERT INTO wedding_members (wedding_id, user_id) VALUES (?, ?)', C, meera);
    ins(`INSERT INTO appointments (wedding_id, status, preferred_at, other_times, format, couple_note, created_by) VALUES (?, 'requested', ?, ?, 'video', ?, ?)`,
      C, at(3, '18:00'), 'Weekday evenings after 6 pm work best.', 'Arjun is in Singapore, so a video call would be ideal.', meera);
  });
}

module.exports = { seedDemo };
