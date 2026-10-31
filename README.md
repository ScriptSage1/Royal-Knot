# The Royal Knot

A wedding-planning product for a premium Indian wedding agency. Couples move from a first enquiry to a fully coordinated plan in a private planning space. Planners work each wedding as one case file, and invited vendors quote through their own portal.

**Stack:**
- Node.js 22.13+ (tested on 24) and Express
- EJS templates
- Browser ES modules, with Three.js for the Shared Garden
- SQLite through Node's built-in `node:sqlite`, so there is no native database package
- Three npm dependencies: `express`, `ejs` and `three`

## Run it locally

```bash
npm install
cp .env.example .env    # optional: the defaults work for a local demo
npm start
```

Open http://localhost:3000.

- On first start, the server creates `data/royal-knot.db`, applies the migrations in `server/db/migrations/`, and seeds the demo data when the database is empty.
- `npm run dev` restarts the server automatically when files change.

| Command | What it does |
| --- | --- |
| `npm run db:migrate` | Apply any new migrations |
| `npm run db:seed` | Add the demo accounts and weddings to an empty database |
| `npm run db:reset` | Delete the local database and uploads, then migrate and seed (development only) |
| `NEW_PASSWORD=… node server/db/cli.js create-user planner a@agency.in "Name"` | Create a planner account. Planners and vendors cannot self-register. |
| `NEW_PASSWORD=… node server/db/cli.js create-user vendor v@vendor.in "Vendor" <vendorId>` | Create a vendor account linked to a directory entry |

All configuration lives in environment variables; see `.env.example`. Never commit a real `.env` file (it is listed in `.gitignore`).

## Demo accounts (development seed only)

You can be signed in as a couple, a planner and a vendor **at the same time in one browser**; each role has its own session. Open `/couple`, `/agent` and `/vendor` in separate tabs.

**Where to sign in:**
- **Couples:** "Sign in" or "Start planning" in the landing page header.
- **Planners:** "Planner workspace" in the footer, or go straight to `/agent`.
- **Vendors:** "Vendor portal" in the footer, or `/vendor`.

Each of these asks for that role's sign-in if needed, then returns you to the page you wanted. The public site is couple-facing, so its buttons only ever lead to sign-up or the couple's own space, never to a staff dashboard. Signing out ends only that role's session: couples return to the home page, and staff return to their sign-in.

Every demo account uses the password **`royal-knot-demo`**, unless you set `DEMO_PASSWORD`. These records are flagged `is_demo`, labelled "demo record" in the planner UI, and refused in production.

| Role | Email | What you'll see |
| --- | --- | --- |
| Planner | `priya@royalknot.test` | Asha & Kiran (planning underway), plus new enquiries |
| Planner | `daniel@royalknot.test` | Naina & Rohan (consultation held, ready to draft requirements) |
| Couple | `asha@couples.test` (or `kiran@…`) | A wedding with the agreement accepted, payments, vendors and schedule |
| Couple | `naina@couples.test` | Consultation held; waiting for the plan |
| Couple | `meera@couples.test` | New enquiry with a consultation requested; no planner yet |
| Vendor | `raag@vendors.test` | An open music brief for Asha & Kiran, waiting for a quote |
| Vendor | `saffron@`, `fernwood@`, `northlight@vendors.test` | Briefs they have already quoted on |

| Case ID | Couple | Planner | Stage |
| --- | --- | --- | --- |
| `RK-DEMO-A` | Asha & Kiran | Priya | Agreement accepted, planning underway |
| `RK-DEMO-B` | Naina & Rohan | Daniel | Consultation held. Their own vendors, so vendor sourcing is skipped |
| `RK-DEMO-C` | Meera & Arjun | Unassigned | Consultation requested |

## Roles

- **Visitor:** sees the landing page and wedding inspiration, then signs up.
- **Couple:**
  - creates an account and a wedding space, or joins a partner's with an invite code
  - shares their story and requests a consultation
  - reviews the plan, compares the shortlist, asks questions and chooses vendors
  - accepts the agreement
  - follows payments, their tasks and the schedule
- **Planner:**
  - takes on new enquiries and works each wedding as one case file
  - handles consultation, transcript and private notes, requirements and checklist, vendors, agreement, payments, tasks, and schedule with the run sheet
- **Vendor:** sees only the briefs they were invited to and submits or updates a proposal.

## Routes

| Route | Who | |
| --- | --- | --- |
| `/` | Everyone | Landing page with "A look at the celebrations we love" |
| `/inspiration/:slug` | Everyone | One inspiration story |
| `/credits` | Everyone | Photo credits and licences |
| `/login`, `/signup`, `POST /logout` | Everyone | |
| `/couple` | Couple | Sections by hash: `#story`, `#consultation`, `#plan`, `#vendors`, `#agreement`, `#payments`, `#schedule`, `#account` |
| `/agent/weddings` | Planner | Your weddings and new enquiries |
| `/agent/weddings/:caseId` | Planner | The case file: `#overview`, `#consultation`, `#requirements`, `#vendors`, `#agreement`, `#payments`, `#tasks`, `#schedule` |
| `/vendor` | Vendor | Invited briefs and proposals |
| `/api/couple/*`, `/api/planner/*`, `/api/vendor/*` | Per role | JSON APIs; see `server/routes/` |

## How each workflow works

Each wedding is one row in `weddings`, with a unique case ID (`RK-XXXXXX`) and a partner invite code. Every other record references that row.

The stage is **derived** from the records (`server/services/stage.js`) rather than stored, so it can't drift from the data. The same milestones drive the Shared Garden.

1. **Accounts and the wedding space.** Sign-up creates a `users` row with an scrypt password hash, plus a `weddings` row and a `wedding_members` link. Joining with an invite code links the new user to the existing wedding. Sign-in rotates the session.
2. **The couple's story.** The intake has seven short steps and saves on every Continue (`PATCH /api/couple/profile`). Every field is optional:
   - budget can be a range, "no fixed budget", "not sure" or "prefer not to say"
   - traditions, languages and family are open text, with "still deciding" and "talk it through" options
   - vendor help is one of: help us find vendors, we already have some, decide later, or not needed

   "Share with our planner" sets `details_shared_at`.
3. **Consultation.** The couple requests a time and format (`appointments`, status `requested`). A planner takes the enquiry on, then confirms the time, format and meeting link (or place), and later marks it held. The link is shown to the couple only once confirmed. There is no video integration; the planner pastes the link, or the server offers `DEFAULT_MEETING_LINK`.
4. **Transcript and private notes.** The planner pastes or uploads a finalised transcript. Each transcript records its source (pasted, or the uploaded file's name), its status (draft or final), the author and the time. Private notes are tagged emotions, family, practical, culture or general. Both stay agency-only.
5. **Requirements and checklist.** The planner creates a draft in one of two ways:
   - **Draft with Claude**, when `CLAUDE_CLI_COMMAND` is configured: the server runs the local Claude Code CLI (`haiku`, medium effort by default) with a versioned system prompt and the full transcript and notes as delimited, untrusted input. The reply is validated against a schema. If it is invalid, or reports significant conflicts between the transcript and the notes, it retries once at high effort. Remaining conflicts are shown to the planner.
   - **Start from the template**: the couple's own answers plus "[To complete]" prompts. It is never labelled as AI.

   The planner then works through the draft:
   - edits every section and checklist row (task, owner, due date, notes)
   - approves the draft, which freezes the version and turns the checklist into tasks; couple-owned tasks are shared with the couple
   - shares it with the couple, who confirm it or ask for changes

   New versions copy the previous one.
6. **Vendors.** Vendor briefs need approved requirements. The planner:
   - writes a brief for any category, typing a new category if needed
   - invites vendors from the directory
   - receives proposals through the vendor portal, or enters quotes received by email or phone
   - shortlists or declines, with an internal comment and a note for the couple
   - shares the shortlist

   The couple compares options and chooses, defers ("maybe later") or declines each one, and can ask questions that the planner answers. If the couple chose "own vendors" or "not needed", vendor sourcing is skipped and nothing is blocked.
7. **Agreement.** The planner confirms the scope with the couple, then creates a versioned draft (scope, vendor approach, fee, terms) and sends it.
   - **When it can be sent:** if the agency is sourcing vendors, only after vendor selection; otherwise as soon as the scope is confirmed.
   - **Acceptance:** the couple types their full name and ticks a box. The version, signatory, account, time and an acceptance statement are stored. This is a recorded confirmation, not a certified e-signature, and the UI says so.
8. **Payments.** The planner adds milestones (label, type, amount, due date) and records payments with date, method and reference. The planner can attach a provider payment link to a milestone. The state (paid, overdue, due within 14 days, upcoming) is calculated on the server. No gateway is connected.
9. **Tasks, schedule and run sheet.**
   - **Tasks:** one list with owner, due date, status, notes, and a shared or internal flag. Couples can tick off shared tasks assigned to them.
   - **Events:** each event can be shared with the couple or kept internal.
   - **Run sheet:** the day-of run sheet (arrivals and cues) is agency-only.
   - **Final schedule:** "Share as final" tells the couple the schedule is final. "Mark the wedding complete" finishes the garden story.

## Demo guide (about 8 minutes)

1. **Portfolio.** Open `/`. Scroll "A look at the celebrations we love" and open one story; each page says it is inspiration, not a client wedding. Click **Start planning**.
2. **New couple.** Create an account. Walk the seven questions (point out "no fixed budget", the open traditions question and the vendor choices), then share. The home view changes to one next step, and the garden's runner lights.
3. **Book.** Choose a time and request the consultation.
4. **Planner.** Sign in as `priya@royalknot.test`. The new couple appears under **New enquiries**. Take it on, confirm the time with a meeting link, and mark the consultation as held.
5. **Transcript and notes.** Paste a few lines of transcript and add a private note. Point out the "Agency only" badges.
6. **Requirements.** Draft from the template (or with Claude, if it's configured), complete the "[To complete]" lines, **Save and approve**, then **Share with the couple**.
7. **Vendor path.** For a quick demo, open `RK-DEMO-A` → Vendors.
   - Open `/vendor` in a new tab, sign in as `raag@vendors.test` and send a proposal.
   - Back as Priya, shortlist it, add a note for the couple, and **Share**.
   - Sign in as `asha@couples.test` and choose it on the shortlist.

   Alternatively, show the skip path on `RK-DEMO-B` (own vendors).
8. **Agreement.** As the planner, confirm the scope, create the draft and send it. As the couple, accept it and show the acceptance record.
9. **Delivery.** Show Asha's payments, the couple's tasks and schedule, and Priya's run sheet. Mention privacy: the couple's API responses never include transcripts or notes (see SECURITY.md).

Tip: `npm run db:reset` restores a clean demo between rehearsals.

## Code map

```
server.js                      Express setup, middleware order, startup (migrate + development seed)
server/config.js               Environment configuration (.env loaded with process.loadEnvFile)
server/security.js             Security headers and CSP, plus the safe error handler
server/db/                     node:sqlite connection, migrations/*.sql, seed.js (demo data), cli.js
server/auth/                   passwords (scrypt), sessions (hashed tokens, rotation), guards (roles, CSRF, wedding access), rate limit
server/lib/                    validation, ids, dates, errors
server/services/
  stage.js                     milestones, stage, next action and alerts, derived from records
  weddings.js                  loads one wedding; plannerCase() and the couple allow-list coupleView()
  drafting.js                  template draft, Claude draft, schema validation, retry
  claude-cli.js                isolated, time-limited Claude CLI runner
server/prompts/                versioned system prompt(s)
server/routes/                 pages, auth, couple-api, planner-api (+ documents, vendors, delivery), vendor-api
server/content/inspiration.js  inspiration stories with photo credits and alt text
views/                         EJS: home, story, credits, auth, couple/portal, agent/*, vendor/portal
public/js/core/                ui (escaping html``, formatting, toasts), api (fetch + CSRF), progress, agent-shell
public/js/couple/              story (intake), chapters (consultation → account)
public/js/agent/               one module per case-file section
public/js/components/          shared renderers: requirements doc, proposal comparison, payments, events, agreement
public/js/garden/              the Three.js Shared Garden
public/img/inspiration/        optimised photos + CREDITS.md
```

## Logo

The mark is one continuous thread. An R and a K share a single stem, and the arm and leg wrap once around it (over on the way in, under on the way out), like a thread tied to a post.

- **In pages:** `views/partials/logo.ejs` gives the inline SVG mark plus the wordmark "The Royal Knot" as real text, in DM Serif Display with restrained letter spacing.
  - Tones: `on-dark` (gold mark, ivory name), `on-light` (antique-gold mark, burgundy name) and `mono` (one colour, `currentColor`).
  - Options: `href`, `label` (accessible name) and `sub` (e.g. "Planning studio").
  - Size it with `--rk-size`. The styles are in `public/css/base.css`, under "The Royal Knot logo".
- **Standalone files:** `public/img/brand/mark-gold.svg`, `mark-burgundy.svg`, `mark-ivory.svg` and `favicon.svg` (the compact app icon).
- **Brand sheet:** open `/static/img/brand/` to see every use. A snapshot is in `docs/brand/logo-sheet.jpg`.

## The Shared Garden

`public/js/garden/garden.js` draws a courtyard story from a single progress value, `progressOf()` in `public/js/core/progress.js`. The value comes from the wedding's real milestones on the server:

- dusk at the first enquiry
- the runner lights, flowers bloom and the pavilion forms as planning moves forward
- guests arrive as the wedding approaches
- full light when the wedding is marked complete

It animates only when progress changes, never on load. `prefers-reduced-motion` gets still frames. The art is Indian in dress, textiles, architecture and plants, with no religious symbols.

## Integrations: what's real

| Integration | Status |
| --- | --- |
| SQLite persistence, sign-in, roles, CSRF, uploads | Implemented |
| Claude Code CLI drafting | Implemented. Runs only when `CLAUDE_CLI_COMMAND` points to a CLI signed in on the server; otherwise the template path |
| Video meetings, live transcription | Not connected. Paste a link; paste or upload a transcript |
| E-signature | Not connected. Recorded acceptance only |
| Payment gateway | Not connected. Record payments; optional provider link |
| Email or notifications | Not connected. Couples and planners see changes the next time they open the app |

## Remaining limitations

- **No account recovery or email:** there is no password reset, email verification or MFA, and no email or SMS notifications.
- **Single process:** sessions and rate limits are designed for one server process.
- **Simple roles:** there is no agency-admin role. Any planner can take on an unassigned enquiry, and the vendor directory is shared.
- **Inspiration content:** the photos are openly licensed images by independent photographers (see `/credits`) and the stories are labelled as ideas. Replace them with the agency's own authorised work when it's available.

See [SECURITY.md](SECURITY.md) for the browser-boundary review.
