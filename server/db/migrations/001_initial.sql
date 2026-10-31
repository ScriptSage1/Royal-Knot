-- The Royal Knot — initial schema.
-- One row in `weddings` is one persistent case. Every workflow record below
-- references it, so access checks only ever need the wedding id.

CREATE TABLE vendor_categories (
  id         INTEGER PRIMARY KEY,
  name       TEXT NOT NULL UNIQUE COLLATE NOCASE,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE vendors (
  id          INTEGER PRIMARY KEY,
  name        TEXT NOT NULL,
  category_id INTEGER NOT NULL REFERENCES vendor_categories(id),
  email       TEXT NOT NULL DEFAULT '',
  phone       TEXT NOT NULL DEFAULT '',
  city        TEXT NOT NULL DEFAULT '',
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE users (
  id            INTEGER PRIMARY KEY,
  email         TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_hash TEXT NOT NULL,
  name          TEXT NOT NULL,
  role          TEXT NOT NULL CHECK (role IN ('couple', 'planner', 'vendor')),
  vendor_id     INTEGER REFERENCES vendors(id) ON DELETE SET NULL,
  is_demo       INTEGER NOT NULL DEFAULT 0,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Only a SHA-256 hash of the session token is stored.
CREATE TABLE sessions (
  token_hash TEXT PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  csrf_token TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX sessions_user ON sessions(user_id);

CREATE TABLE weddings (
  id                  INTEGER PRIMARY KEY,
  case_code           TEXT NOT NULL UNIQUE,
  invite_code         TEXT NOT NULL UNIQUE,
  couple_label        TEXT NOT NULL DEFAULT '',
  planner_id          INTEGER REFERENCES users(id) ON DELETE SET NULL,
  -- what the couple shares (all optional)
  date_mode           TEXT NOT NULL DEFAULT 'undecided' CHECK (date_mode IN ('exact', 'month', 'undecided')),
  wedding_date        TEXT,
  wedding_month       TEXT,
  location            TEXT NOT NULL DEFAULT '',
  guest_estimate      INTEGER,
  events_count        INTEGER,
  budget_mode         TEXT NOT NULL DEFAULT 'unanswered' CHECK (budget_mode IN ('unanswered', 'range', 'no_fixed', 'prefer_not', 'unsure')),
  budget_range        TEXT NOT NULL DEFAULT '',
  what_matters        TEXT NOT NULL DEFAULT '',
  priorities          TEXT NOT NULL DEFAULT '',
  traditions_note     TEXT NOT NULL DEFAULT '',
  languages           TEXT NOT NULL DEFAULT '',
  family_note         TEXT NOT NULL DEFAULT '',
  traditions_deciding INTEGER NOT NULL DEFAULT 0,
  traditions_discuss  INTEGER NOT NULL DEFAULT 0,
  vendor_sourcing     TEXT CHECK (vendor_sourcing IN ('help', 'own', 'later', 'not_needed')),
  vendor_note         TEXT NOT NULL DEFAULT '',
  -- workflow markers
  details_shared_at   TEXT,
  vendors_complete_at TEXT,
  schedule_final_at   TEXT,
  completed_at        TEXT,
  is_demo             INTEGER NOT NULL DEFAULT 0,
  created_at          TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at          TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE wedding_members (
  wedding_id INTEGER NOT NULL REFERENCES weddings(id) ON DELETE CASCADE,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  joined_at  TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (wedding_id, user_id)
);
CREATE UNIQUE INDEX wedding_members_one_wedding ON wedding_members(user_id);

CREATE TABLE appointments (
  id           INTEGER PRIMARY KEY,
  wedding_id   INTEGER NOT NULL REFERENCES weddings(id) ON DELETE CASCADE,
  status       TEXT NOT NULL CHECK (status IN ('requested', 'confirmed', 'completed', 'cancelled')),
  preferred_at TEXT,
  other_times  TEXT NOT NULL DEFAULT '',
  scheduled_at TEXT,
  duration_min INTEGER NOT NULL DEFAULT 60,
  format       TEXT NOT NULL CHECK (format IN ('video', 'in_person', 'phone')),
  meeting_link TEXT NOT NULL DEFAULT '',
  place        TEXT NOT NULL DEFAULT '',
  couple_note  TEXT NOT NULL DEFAULT '',
  planner_message TEXT NOT NULL DEFAULT '',
  created_by   INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at   TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at   TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX appointments_wedding ON appointments(wedding_id);

-- Private to the agency.
CREATE TABLE transcripts (
  id             INTEGER PRIMARY KEY,
  wedding_id     INTEGER NOT NULL REFERENCES weddings(id) ON DELETE CASCADE,
  appointment_id INTEGER REFERENCES appointments(id) ON DELETE SET NULL,
  source         TEXT NOT NULL CHECK (source IN ('pasted', 'uploaded')),
  status         TEXT NOT NULL DEFAULT 'final' CHECK (status IN ('draft', 'final')),
  title          TEXT NOT NULL DEFAULT '',
  original_name  TEXT NOT NULL DEFAULT '',
  stored_name    TEXT NOT NULL DEFAULT '',
  content        TEXT NOT NULL,
  created_by     INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at     TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX transcripts_wedding ON transcripts(wedding_id);

-- Private to the agency.
CREATE TABLE planner_notes (
  id         INTEGER PRIMARY KEY,
  wedding_id INTEGER NOT NULL REFERENCES weddings(id) ON DELETE CASCADE,
  author_id  INTEGER REFERENCES users(id) ON DELETE SET NULL,
  topic      TEXT NOT NULL DEFAULT 'general' CHECK (topic IN ('emotion', 'family', 'practical', 'culture', 'general')),
  body       TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX planner_notes_wedding ON planner_notes(wedding_id);

-- sections_json:  [{ "title": "...", "items": ["..."] }]
-- checklist_json: [{ "task", "owner", "dueInDays", "notes" }] — becomes tasks on approval
-- conflicts_json: [{ "topic", "transcript", "notes", "severity" }] — for planner review
CREATE TABLE requirements_docs (
  id                  INTEGER PRIMARY KEY,
  wedding_id          INTEGER NOT NULL REFERENCES weddings(id) ON DELETE CASCADE,
  version             INTEGER NOT NULL,
  status              TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'approved')),
  generator           TEXT NOT NULL CHECK (generator IN ('template', 'claude_cli', 'manual')),
  generator_meta      TEXT NOT NULL DEFAULT '',
  sections_json       TEXT NOT NULL,
  checklist_json      TEXT NOT NULL DEFAULT '[]',
  conflicts_json      TEXT NOT NULL DEFAULT '[]',
  approved_by         INTEGER REFERENCES users(id) ON DELETE SET NULL,
  approved_at         TEXT,
  shared_at           TEXT,
  couple_response     TEXT CHECK (couple_response IN ('confirmed', 'changes_requested')),
  couple_comment      TEXT NOT NULL DEFAULT '',
  couple_responded_at TEXT,
  created_by          INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at          TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at          TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (wedding_id, version)
);

-- Planner checklist and planning tasks share one format.
CREATE TABLE tasks (
  id          INTEGER PRIMARY KEY,
  wedding_id  INTEGER NOT NULL REFERENCES weddings(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  owner_type  TEXT NOT NULL DEFAULT 'agency' CHECK (owner_type IN ('agency', 'couple', 'vendor')),
  owner_label TEXT NOT NULL DEFAULT '',
  due_date    TEXT,
  status      TEXT NOT NULL DEFAULT 'todo' CHECK (status IN ('todo', 'in_progress', 'done', 'blocked')),
  notes       TEXT NOT NULL DEFAULT '',
  shared      INTEGER NOT NULL DEFAULT 0,
  source      TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'requirements')),
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX tasks_wedding ON tasks(wedding_id);

CREATE TABLE vendor_requests (
  id          INTEGER PRIMARY KEY,
  wedding_id  INTEGER NOT NULL REFERENCES weddings(id) ON DELETE CASCADE,
  category_id INTEGER NOT NULL REFERENCES vendor_categories(id),
  brief       TEXT NOT NULL,
  budget_note TEXT NOT NULL DEFAULT '',
  due_date    TEXT,
  status      TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
  created_by  INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX vendor_requests_wedding ON vendor_requests(wedding_id);

CREATE TABLE vendor_request_recipients (
  request_id INTEGER NOT NULL REFERENCES vendor_requests(id) ON DELETE CASCADE,
  vendor_id  INTEGER NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
  status     TEXT NOT NULL DEFAULT 'invited' CHECK (status IN ('invited', 'responded', 'declined')),
  invited_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (request_id, vendor_id)
);

CREATE TABLE proposals (
  id                INTEGER PRIMARY KEY,
  request_id        INTEGER NOT NULL REFERENCES vendor_requests(id) ON DELETE CASCADE,
  vendor_id         INTEGER NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
  source            TEXT NOT NULL CHECK (source IN ('vendor_portal', 'planner_entry')),
  amount            INTEGER NOT NULL CHECK (amount >= 0),
  scope             TEXT NOT NULL DEFAULT '',
  inclusions        TEXT NOT NULL DEFAULT '',
  exclusions        TEXT NOT NULL DEFAULT '',
  extras            TEXT NOT NULL DEFAULT '',
  valid_until       TEXT,
  vendor_message    TEXT NOT NULL DEFAULT '',
  internal_comment  TEXT NOT NULL DEFAULT '',  -- agency only
  note_for_couple   TEXT NOT NULL DEFAULT '',
  agency_status     TEXT NOT NULL DEFAULT 'received' CHECK (agency_status IN ('received', 'shortlisted', 'declined')),
  shared_at         TEXT,
  couple_decision   TEXT CHECK (couple_decision IN ('chosen', 'deferred', 'declined')),
  couple_decided_at TEXT,
  created_at        TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at        TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (request_id, vendor_id)
);

CREATE TABLE proposal_questions (
  id          INTEGER PRIMARY KEY,
  proposal_id INTEGER NOT NULL REFERENCES proposals(id) ON DELETE CASCADE,
  asked_by    INTEGER REFERENCES users(id) ON DELETE SET NULL,
  question    TEXT NOT NULL,
  answer      TEXT NOT NULL DEFAULT '',
  answered_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  answered_at TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE agreements (
  id                 INTEGER PRIMARY KEY,
  wedding_id         INTEGER NOT NULL REFERENCES weddings(id) ON DELETE CASCADE,
  version            INTEGER NOT NULL,
  status             TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'accepted', 'superseded')),
  title              TEXT NOT NULL,
  scope_summary      TEXT NOT NULL,
  terms              TEXT NOT NULL,
  fee_amount         INTEGER,
  vendor_path        TEXT NOT NULL DEFAULT '',
  scope_confirmed_at TEXT,
  sent_at            TEXT,
  accepted_at        TEXT,
  accepted_by        INTEGER REFERENCES users(id) ON DELETE SET NULL,
  signatory_name     TEXT NOT NULL DEFAULT '',
  acceptance_text    TEXT NOT NULL DEFAULT '',
  created_by         INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at         TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at         TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (wedding_id, version)
);

CREATE TABLE payments (
  id           INTEGER PRIMARY KEY,
  wedding_id   INTEGER NOT NULL REFERENCES weddings(id) ON DELETE CASCADE,
  label        TEXT NOT NULL,
  kind         TEXT NOT NULL DEFAULT 'other' CHECK (kind IN ('booking', 'advance', 'final', 'extra', 'other')),
  amount       INTEGER NOT NULL CHECK (amount >= 0),
  due_date     TEXT NOT NULL,
  status       TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'paid', 'cancelled')),
  paid_on      TEXT,
  method       TEXT NOT NULL DEFAULT '',
  reference    TEXT NOT NULL DEFAULT '',
  payment_link TEXT NOT NULL DEFAULT '',
  recorded_by  INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at   TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at   TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX payments_wedding ON payments(wedding_id);

CREATE TABLE events (
  id            INTEGER PRIMARY KEY,
  wedding_id    INTEGER NOT NULL REFERENCES weddings(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  event_date    TEXT NOT NULL,
  start_time    TEXT NOT NULL DEFAULT '',
  end_time      TEXT NOT NULL DEFAULT '',
  venue         TEXT NOT NULL DEFAULT '',
  couple_note   TEXT NOT NULL DEFAULT '',
  internal_note TEXT NOT NULL DEFAULT '',
  owner_label   TEXT NOT NULL DEFAULT '',
  shared        INTEGER NOT NULL DEFAULT 1,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX events_wedding ON events(wedding_id);

-- Day-of run sheet lines (agency only), e.g. vendor arrivals.
CREATE TABLE run_items (
  id          INTEGER PRIMARY KEY,
  wedding_id  INTEGER NOT NULL REFERENCES weddings(id) ON DELETE CASCADE,
  event_id    INTEGER REFERENCES events(id) ON DELETE SET NULL,
  item_date   TEXT NOT NULL,
  item_time   TEXT NOT NULL,
  label       TEXT NOT NULL,
  owner_label TEXT NOT NULL DEFAULT '',
  status      TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'done', 'delayed')),
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX run_items_wedding ON run_items(wedding_id);
