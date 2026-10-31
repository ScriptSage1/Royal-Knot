// Server-side sessions, one per role, so a couple, a planner and a vendor
// can all be signed in on the same browser (handy for demos and for staff who
// also test the couple view). Each role has its own cookie; the cookie holds a
// random token and the database stores only its SHA-256 hash, the user id, a
// CSRF token and an expiry. Which session a request uses is decided by the
// server from the URL area, never by the browser:
//   /couple, /api/couple   → couple session
//   /agent,  /api/planner  → planner session
//   /vendor, /api/vendor   → vendor session
// Public pages (landing, sign-in) run signed out. A new token is issued at
// every sign-in (rotation) and deleted at sign-out.
const config = require('../config');
const { one, run } = require('../db');
const { token, sha256 } = require('../lib/ids');

const ROLES = ['couple', 'planner', 'vendor'];
// The __Host- prefix makes browsers insist on Secure, Path=/ and no Domain.
const cookieName = (role) => `${config.cookieSecure ? '__Host-' : ''}rk_${role}`;

function areaOf(path) {
  if (path === '/couple' || path.startsWith('/couple/') || path.startsWith('/api/couple')) return 'couple';
  if (path === '/agent' || path.startsWith('/agent/') || path.startsWith('/api/planner')) return 'planner';
  if (path === '/vendor' || path.startsWith('/vendor/') || path.startsWith('/api/vendor')) return 'vendor';
  return null;
}

function parseCookies(header = '') {
  const out = {};
  for (const part of header.split(';')) {
    const i = part.indexOf('=');
    if (i > 0) {
      try { out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim()); } catch { /* ignore malformed */ }
    }
  }
  return out;
}

function cookieHeader(role, value, maxAgeSec) {
  return [
    `${cookieName(role)}=${value}`, 'Path=/', 'HttpOnly', 'SameSite=Lax',
    config.cookieSecure ? 'Secure' : null,
    `Max-Age=${maxAgeSec}`,
  ].filter(Boolean).join('; ');
}

// Look up one role's session from its cookie; returns null when missing,
// expired, or (defensively) when the user's role doesn't match the cookie.
function load(role, raw) {
  if (!raw) return null;
  const row = one(`
    SELECT s.csrf_token, s.expires_at, u.id, u.name, u.email, u.role, u.vendor_id,
           (SELECT wedding_id FROM wedding_members m WHERE m.user_id = u.id) AS wedding_id
    FROM sessions s JOIN users u ON u.id = s.user_id
    WHERE s.token_hash = ?`, sha256(raw));
  if (!row) return null;
  if (row.expires_at <= new Date().toISOString() || row.role !== role) {
    run('DELETE FROM sessions WHERE token_hash = ?', sha256(raw));
    return null;
  }
  return {
    token: raw,
    csrfToken: row.csrf_token,
    user: { id: row.id, name: row.name, email: row.email, role: row.role, vendorId: row.vendor_id, weddingId: row.wedding_id },
  };
}

// Attaches req.user / req.csrfToken for the URL's area (null on public
// pages), and req.sessions with every role's session for public pages that
// need to know who is signed in (e.g. "Your space" links, sign-out).
function sessionMiddleware(req, res, next) {
  const cookies = parseCookies(req.headers.cookie);
  req.sessions = {};
  for (const role of ROLES) {
    const s = load(role, cookies[cookieName(role)]);
    if (s) req.sessions[role] = s;
  }
  const area = areaOf(req.path);
  const current = area ? req.sessions[area] : null;
  req.area = area;
  req.user = current ? current.user : null;
  req.csrfToken = current ? current.csrfToken : null;
  next();
}

function createSession(req, res, user) {
  const previous = req.sessions[user.role];
  if (previous) run('DELETE FROM sessions WHERE token_hash = ?', sha256(previous.token));
  const raw = token();
  const ttl = config.sessionTtlHours * 3600;
  const expires = new Date(Date.now() + ttl * 1000).toISOString();
  run('INSERT INTO sessions (token_hash, user_id, csrf_token, expires_at) VALUES (?, ?, ?, ?)', sha256(raw), user.id, token(), expires);
  res.append('Set-Cookie', cookieHeader(user.role, raw, ttl));
}

function destroySession(req, res, role) {
  const s = req.sessions[role];
  if (s) run('DELETE FROM sessions WHERE token_hash = ?', sha256(s.token));
  res.append('Set-Cookie', cookieHeader(role, '', 0));
}

function purgeExpiredSessions() {
  run('DELETE FROM sessions WHERE expires_at <= ?', new Date().toISOString());
}

module.exports = { sessionMiddleware, createSession, destroySession, purgeExpiredSessions, ROLES };
