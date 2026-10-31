// Authorisation. Every protected page and API route passes through one of
// these; the browser's idea of roles is never trusted.
const crypto = require('crypto');
const { one } = require('../db');
const { HttpError, forbidden, notFound } = require('../lib/errors');

const HOME = { couple: '/couple', planner: '/agent/weddings', vendor: '/vendor' };
const homeFor = (user) => (user ? HOME[user.role] : '/');

// Pages: redirect to sign-in (or the user's own area) instead of erroring.
function pageFor(...roles) {
  return (req, res, next) => {
    // Each area has its own session, so a missing or mismatched one simply
    // means "sign in for this area"; other roles' sessions are untouched.
    if (!req.user || !roles.includes(req.user.role)) return res.redirect(`/login?next=${encodeURIComponent(req.originalUrl)}`);
    next();
  };
}

// APIs: 401 when signed out, 403 for the wrong role.
function apiFor(...roles) {
  return (req, res, next) => {
    if (!req.user) return next(new HttpError(401, 'Please sign in again.'));
    if (!roles.includes(req.user.role)) return next(forbidden());
    next();
  };
}

// CSRF: every state-changing request must come from this site (Origin, or
// Referer as a fallback) and, when signed in, carry the session's CSRF token.
// API mutations must also be JSON (or a same-site upload with a custom
// header), which a cross-site HTML form cannot send.
function sameOrigin(req) {
  const source = req.headers.origin || req.headers.referer;
  if (!source) return false;
  try { return new URL(source).host === req.headers.host; } catch { return false; }
}
function safeEqual(a, b) {
  const x = Buffer.from(String(a || '')), y = Buffer.from(String(b || ''));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}
function csrfProtection(req, res, next) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  if (!sameOrigin(req)) return next(new HttpError(403, 'This request came from another site and was blocked.'));
  if (req.user) {
    const sent = req.get('x-csrf-token') || (req.body && req.body._csrf);
    if (!safeEqual(sent, req.csrfToken)) return next(new HttpError(403, 'Your session has changed. Refresh the page and try again.'));
  }
  if (req.path.startsWith('/api/') && !req.is('application/json') && !req.get('x-upload-name')) {
    return next(new HttpError(415, 'Unsupported request format.'));
  }
  next();
}

// Planner access to one wedding: the assigned planner has full access; an
// unassigned enquiry can be viewed (and taken on) by any planner.
function plannerWedding(caseCode, user, { allowUnassigned = false } = {}) {
  const w = one('SELECT * FROM weddings WHERE case_code = ?', String(caseCode || ''));
  if (!w) throw notFound('No wedding with this case ID.');
  if (w.planner_id === user.id) return w;
  if (allowUnassigned && w.planner_id == null) return w;
  throw forbidden('This wedding is assigned to another planner.');
}

// A couple can only ever reach their own wedding, found through membership.
function coupleWedding(user) {
  const w = user.weddingId && one('SELECT * FROM weddings WHERE id = ?', user.weddingId);
  if (!w) throw notFound('No wedding workspace yet.');
  return w;
}

module.exports = { pageFor, apiFor, csrfProtection, plannerWedding, coupleWedding, homeFor };
