// Sign-in, sign-up (with a new or joined wedding workspace) and sign-out.
// Plain HTML forms posted to the server, so they work without JavaScript.
const express = require('express');
const { one, run, tx } = require('../db');
const { hashPassword, verifyPassword, dummyHash, passwordProblem, MIN_LENGTH } = require('../auth/passwords');
const { createSession, destroySession } = require('../auth/sessions');
const { homeFor } = require('../auth/guards');
const { hit, clear } = require('../auth/rate-limit');
const { caseCode, inviteCode } = require('../lib/ids');
const v = require('../lib/validate');

const router = express.Router();
const form = express.urlencoded({ extended: false, limit: '20kb' });

// Only same-site paths are allowed as a post-sign-in destination.
const safeNext = (n) => (typeof n === 'string' && /^\/(?!\/)[\w\-/?=&#.%]*$/.test(n) ? n : null);
const ip = (req) => req.ip || 'unknown';

// Each role has its own session, so signing in here never signs anyone else
// out. If the destination's area already has a session, go straight there.
const areaOf = (url) => (/^\/agent/.test(url || '') ? 'planner' : /^\/vendor/.test(url || '') ? 'vendor' : /^\/couple/.test(url || '') ? 'couple' : null);

router.get('/login', (req, res) => {
  const nextUrl = safeNext(req.query.next);
  const area = areaOf(nextUrl);
  if (area && req.sessions[area]) return res.redirect(nextUrl);
  res.render('auth/login', { title: 'Sign in', iface: 'site', error: null, email: '', next: nextUrl });
});

router.post('/login', form, async (req, res, next) => {
  try {
    const email = String(req.body.email || '').trim().toLowerCase().slice(0, 254);
    const password = String(req.body.password || '');
    const nextUrl = safeNext(req.body.next);
    const fail = (status, error) => res.status(status).render('auth/login', { title: 'Sign in', iface: 'site', error, email, next: nextUrl });

    // 10 attempts per account and 30 per address in 15 minutes.
    const limited = hit(`login:${email}`, { windowMs: 15 * 60000, max: 10 }) | hit(`login-ip:${ip(req)}`, { windowMs: 15 * 60000, max: 30 });
    if (limited) return fail(429, 'Too many sign-in attempts. Please wait a few minutes and try again.');

    const user = one('SELECT id, role, password_hash FROM users WHERE email = ?', email);
    const ok = await verifyPassword(password, user ? user.password_hash : await dummyHash());
    if (!user || !ok) return fail(401, 'That email and password don’t match an account.');

    clear(`login:${email}`);
    createSession(req, res, user);
    res.redirect(nextUrl && areaOf(nextUrl) === user.role ? nextUrl : homeFor(user));
  } catch (err) { next(err); }
});

// Always shows the form, so a new couple can sign up during a demo even if
// another couple is signed in on this browser (sign-up replaces that couple
// session only).
router.get('/signup', (req, res) => {
  res.render('auth/signup', { title: 'Start planning', iface: 'site', error: null, values: { mode: req.query.invite ? 'join' : 'new', invite: String(req.query.invite || '').slice(0, 12) }, minLength: MIN_LENGTH });
});

router.post('/signup', form, async (req, res, next) => {
  const values = { name: String(req.body.name || '').slice(0, 80), email: String(req.body.email || '').slice(0, 254), mode: req.body.mode === 'join' ? 'join' : 'new', invite: String(req.body.invite || '').slice(0, 12), coupleLabel: String(req.body.coupleLabel || '').slice(0, 80) };
  const fail = (status, error) => res.status(status).render('auth/signup', { title: 'Start planning', iface: 'site', error, values, minLength: MIN_LENGTH });
  try {
    if (hit(`signup-ip:${ip(req)}`, { windowMs: 60 * 60000, max: 10 })) return fail(429, 'Too many accounts created from this connection. Please try again later.');
    let name, email, coupleLabel;
    try {
      name = v.line(req.body.name, { field: 'Your name', max: 80, required: true });
      email = v.email(req.body.email);
      coupleLabel = v.line(req.body.coupleLabel, { field: 'Names for the celebration', max: 80 });
    } catch (e) { return fail(400, e.message); }
    const problem = passwordProblem(req.body.password);
    if (problem) return fail(400, problem);
    if (one('SELECT 1 FROM users WHERE email = ?', email)) return fail(409, 'An account with this email already exists. Try signing in instead.');

    let wedding = null;
    if (values.mode === 'join') {
      wedding = one('SELECT id FROM weddings WHERE invite_code = ?', values.invite.trim().toUpperCase());
      if (!wedding) return fail(400, 'That invite code doesn’t match a wedding workspace. Check it with your partner.');
    }
    const hash = await hashPassword(req.body.password);
    const userId = tx(() => {
      const uid = Number(run('INSERT INTO users (email, password_hash, name, role) VALUES (?, ?, ?, ?)', email, hash, name, 'couple').lastInsertRowid);
      let wid = wedding && wedding.id;
      if (!wid) {
        wid = Number(run('INSERT INTO weddings (case_code, invite_code, couple_label) VALUES (?, ?, ?)', caseCode(), inviteCode(), coupleLabel || name).lastInsertRowid);
      }
      run('INSERT INTO wedding_members (wedding_id, user_id) VALUES (?, ?)', wid, uid);
      return uid;
    });
    createSession(req, res, { id: userId, role: 'couple' });
    res.redirect('/couple');
  } catch (err) { next(err); }
});

// Signs out one role (the area the form came from). The form carries that
// session's CSRF token, checked here because /logout is not inside an area.
router.post('/logout', form, (req, res) => {
  const role = ['couple', 'planner', 'vendor'].includes(req.body.area) ? req.body.area : null;
  const s = role && req.sessions[role];
  if (s && safeEqual(req.body._csrf, s.csrfToken)) destroySession(req, res, role);
  // Couples return to the public site; staff return to their own sign-in.
  res.redirect({ planner: '/agent', vendor: '/vendor' }[role] || '/');
});

function safeEqual(a, b) {
  const x = Buffer.from(String(a || '')), y = Buffer.from(String(b || ''));
  return x.length === y.length && require('crypto').timingSafeEqual(x, y);
}

module.exports = router;
