# Security review — The Royal Knot

This app assumes the browser is untrusted: anyone can read the page source, the DOM, the JavaScript, network traffic and browser storage. Every permission is enforced on the server.

## What a visitor can inspect

| In the browser | What's there | Why it's safe |
| --- | --- | --- |
| HTML and JavaScript | Templates, page scripts and the Three.js garden | No secrets, keys, prompts, private notes or demo passwords are in any served file. Hiding a button is never used as access control. |
| Network responses | JSON from the signed-in role's own API | Each API builds its response on the server for that role (see below). |
| Cookies | One per role: `rk_couple`, `rk_planner`, `rk_vendor` (`__Host-` prefixed over HTTPS) | Each is a random 256-bit token. It is HTTP-only, `SameSite=Lax`, and `Secure` in production. The database stores only its SHA-256 hash. |
| `<meta name="csrf-token">` | The per-session CSRF token | It is only useful together with a same-site request and the session cookie. |
| localStorage / sessionStorage | Nothing | No app data is stored in the browser. |

## What each role can request

| Role | Routes | Server-side check |
| --- | --- | --- |
| Visitor | `/`, `/inspiration/:slug`, `/credits`, `/login`, `/signup` | Public pages only. Every `/api/*` call returns 401. |
| Couple | `/couple`, `/api/couple/*` | The couple session only, then `apiFor('couple')`. The wedding is looked up from the user's membership row, never from an id in the request. Record ids such as a proposal or agreement are matched with `AND wedding_id = ?`. |
| Planner | `/agent/weddings[/:code]`, `/api/planner/*` | The planner session only, then `apiFor('planner')`, then `plannerWedding()` on every `/weddings/:code/*` request. The assigned planner gets full access. Any planner can **view** an unassigned enquiry and take it on, but cannot change it. Every record query is scoped by `wedding_id`. |
| Vendor | `/vendor`, `/api/vendor/*` | The vendor session only, then `apiFor('vendor')`, plus the account's `vendor_id`. A vendor sees only the requests it was invited to: the brief, city, date and guest numbers. It never sees couple names, notes, other proposals or the couple's choice. |

Pages are checked the same way before any template is rendered (`pageFor()`). For example, opening `/agent/weddings/...` without a planner session goes to sign-in, whatever other roles are signed in.

## Private data stays out of couple responses

`server/services/weddings.js → coupleView()` builds the couple's JSON field by field from an allow-list. These are **never** included, whatever the browser asks for:

- transcripts
- planner notes
- internal vendor comments, vendor messages and proposal status
- requirement drafts, the checklist draft, conflicts and generator details
- unshared or declined proposals
- draft agreements
- internal tasks
- unshared events and internal event notes
- the run sheet
- payment methods and references

The automated checks below confirm that known private strings are absent from the couple's raw responses.

Template drafts copy only the couple's own answers. Private notes appear beside the editor for reference and are never copied into a document automatically.

## Input, output and requests

- **Validation:** every API normalises its input on the server (`server/lib/validate.js`): types, lengths, enums, dates, whole numbers, and `http(s)` URLs only, so a stored link can never be `javascript:`.
- **SQL:** every query uses prepared statements with bound parameters through `node:sqlite`. No SQL is ever built from user input; the only dynamic SQL is fixed lists of column names in code.
- **Output escaping:** EJS uses `<%= %>` (escaped) throughout. Browser rendering goes through the `html` tagged template in `public/js/core/ui.js`, which escapes every value. `raw()` is used only for static SVG markup in that file. Toasts use `textContent`.
- **CSRF:** non-GET requests are rejected unless:
  - the `Origin` (or `Referer`) host matches;
  - when signed in, they carry the session's CSRF token, compared in constant time;
  - API calls are JSON, or an upload with a custom header, which a cross-site HTML form cannot send.
- **Sessions:** each role has its own session, so a couple, a planner and a vendor can be signed in on one browser at once (this is used for the demo).
  - The server picks the session from the URL area: `/couple` and `/api/couple` use the couple session; `/agent` and `/api/planner` the planner session; `/vendor` and `/api/vendor` the vendor session. Public pages run signed out.
  - A session is only accepted if its user's role matches the cookie, and each session has its own CSRF token, so one role's token is rejected by another role's API.
  - A new token is issued at every sign-in for that role and the old one is deleted (rotation). Signing out ends only that role's session. Expired sessions are purged hourly.
- **Passwords:** hashed with scrypt from Node's `crypto` module (N=2¹⁵, r=8, p=1, a 16-byte salt per password, a 64-byte key) and verified in constant time. Unknown emails still run a hash, so response timing doesn't reveal which accounts exist. Passwords need at least 10 characters.
- **Rate limits:** sign-in allows 10 attempts per account and 30 per IP address in 15 minutes; sign-up allows 10 per IP per hour. The limiter is in memory, which suits one process.
- **Planner and vendor accounts:** created by the agency with `node server/db/cli.js create-user`. They cannot self-register.

## Security headers

Set on every response in `server/security.js`:

- **Content Security Policy:**
  - Scripts: `script-src 'self'` only, with no inline scripts and no `eval`. Three.js is served from `/vendor/three` on the same origin; there is no import map.
  - Styles: `style-src 'self' https://fonts.googleapis.com`, plus `style-src-attr 'unsafe-inline'` for small style attributes such as table column counts. Inline `<style>` blocks are not allowed.
  - Fonts: `font-src https://fonts.gstatic.com`.
  - Images: `img-src 'self' data: blob:`, because the garden rasterises its own SVG art.
  - Everything else: `connect-src 'self'`, `object-src 'none'`, `frame-ancestors 'none'`, `form-action 'self'`, `base-uri 'self'`.
- **Other headers:**
  - `X-Content-Type-Options: nosniff`
  - `X-Frame-Options: DENY`
  - `Referrer-Policy: same-origin`
  - `Cross-Origin-Opener-Policy` and `Cross-Origin-Resource-Policy`
  - a restrictive `Permissions-Policy`
  - HSTS when cookies are `Secure`
- **Caching:** API and signed-in responses use `Cache-Control: no-store`. `X-Powered-By` is removed.

## Uploads

Transcript uploads go to `POST /api/planner/weddings/:code/transcripts/upload`:

- **Accepted files:** `.txt`, `.vtt`, `.srt` or `.md` only, up to `MAX_UPLOAD_KB` (512 KB by default). Files containing NUL bytes, or that aren't valid UTF-8, are rejected.
- **Storage:** the file is saved as `<uuid>.<ext>` under `UPLOAD_DIR/<wedding id>/` with mode 600. The original name is only stored, after `path.basename` and character filtering, so path traversal isn't possible.
- **Never served or run:** the storage folder is outside `public/` and is never served or executed. Its text is also stored in the database for drafting.

## Errors and logs

- **Messages:** users see `HttpError` messages written to be safe. Any other error becomes "Something went wrong on our side". Stack traces only appear in development logs.
- **No private content in responses or logs:** SQL errors, file paths, transcript text and prompts are never returned. Claude CLI failures are logged as a kind (for example `unauthenticated`) with the wedding id, never with content.

## Claude CLI (server only)

`server/services/claude-cli.js` runs the local Claude Code CLI only when `CLAUDE_CLI_COMMAND` is set.

- **What it receives:** a versioned system prompt from a file (`server/prompts/requirements.v1.txt`). The profile, full transcript and notes are sent on stdin as separately delimited, untrusted blocks, with random boundary tokens.
- **What it can reach:** nothing beyond that input:
  - `--tools ""` (no built-in tools)
  - `--strict-mcp-config` with no MCP servers
  - an empty temporary working folder
  - a minimal environment, without `ANTHROPIC_API_KEY` or `ANTHROPIC_AUTH_TOKEN`, so it uses the CLI's own subscription sign-in and can never silently switch to API billing
- **How it's run:** with a hard timeout that kills the process tree, and a 2 MB output cap.
- **What happens to the output:** it is parsed and schema-validated before saving. Drafts must be edited and approved by a planner before anything is shared.
- **Data handling:** transcripts and notes are sent to Anthropic through the team's Claude subscription when this is enabled. The agency should tell couples about this, or leave it disabled.

## Integrations: honest status

| Integration | Status |
| --- | --- |
| Video meetings | **Not connected.** The planner pastes a meeting link, or sets `DEFAULT_MEETING_LINK`. |
| Live transcription | **Not connected.** Transcripts are pasted or uploaded. |
| E-signature | **Not connected.** Acceptance is a recorded confirmation (name, account, version and time), and the UI says it is not a certified e-signature. |
| Payments | **Not connected.** Planners record payments; an optional per-milestone link opens the provider's own page. |
| Claude CLI | **Connected only when configured** and signed in on the server; otherwise the template path is used. |

## Known limitations

- **Single process:** sessions and the rate limiter are built for one process. A multi-instance deployment needs a shared rate-limit store.
- **No account recovery:** there is no email verification, password reset or MFA yet.
- **Shared planner pool:** any planner can see the list of unassigned enquiries, by design. There is no separate agency-admin role.
- **Agency-wide directory:** the vendor directory is shared across planners.
- **No malware scanning:** uploads are plain text only and never executed, but they aren't scanned.
- **CSP compatibility:** `style-src-attr 'unsafe-inline'` is allowed for style attributes. Very old browsers that don't support `style-src-attr` will fall back to blocking them.
- **Demo data:** demo accounts share one password from `DEMO_PASSWORD` (or a development default) and are flagged `is_demo`. Seeding is refused when `NODE_ENV=production` unless explicitly allowed, and the server warns if demo users exist in production.
- **Photos:** inspiration photos are openly licensed (see `public/img/inspiration/CREDITS.md`). Check each licence again before a public launch.

## How this was checked

Two automated walk-throughs were run against the running server:

- **Authentication and access (29 checks):**
  - wrong password
  - CSRF token required
  - cross-origin requests blocked
  - planners isolated from each other's weddings
  - unassigned weddings read-only
  - couples blocked from planner APIs and pages
  - couple and planner signed in at once, each working, and the couple's CSRF token rejected by the planner API
  - vendors limited to their own invitations
  - 401 when signed out
  - the CSP header is present
- **Workflow (35 checks):**
  - the couple's view never contains the transcript, notes, internal comments, the run sheet or internal event notes
  - upload type, size and traversal handling
  - agreement gating and one-time acceptance
  - `javascript:` links rejected
  - access across weddings blocked, using guessed ids
