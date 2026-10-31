// The Royal Knot — Express server.
// Pages are EJS templates; each interface's browser script loads its data from
// a role-specific JSON API. Authentication, authorisation, validation and
// persistence (SQLite) all live on the server; see server/ and SECURITY.md.
const path = require('path');
const express = require('express');
const config = require('./server/config');
const { migrate, one } = require('./server/db');
const { seedDemo } = require('./server/db/seed');
const { sessionMiddleware, purgeExpiredSessions } = require('./server/auth/sessions');
const { csrfProtection } = require('./server/auth/guards');
const { securityHeaders, noStore, errorHandler } = require('./server/security');
const { notFound } = require('./server/lib/errors');

const app = express();
app.disable('x-powered-by');
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
if (config.production) app.set('trust proxy', 1);

app.use(securityHeaders);
app.use('/static', express.static(path.join(__dirname, 'public'), { maxAge: config.production ? '1d' : 0 }));
app.use('/vendor/three', express.static(path.join(__dirname, 'node_modules', 'three', 'build'), { maxAge: '7d' }));

app.use(sessionMiddleware);
// Templates (including the error page) can read who is signed in and the
// session's CSRF token, so this runs before anything that can fail.
// `user` is the signed-in user for this URL's area only (null on public
// pages). The public site is couple-facing, so its links only ever point to
// the couple space (when a couple is signed in) or to sign-up; staff reach
// their areas through the explicit footer links.
app.use((req, res, next) => {
  res.locals.user = req.user && { name: req.user.name, role: req.user.role };
  res.locals.csrfToken = req.csrfToken || '';
  res.locals.coupleSignedIn = Boolean(req.sessions.couple);
  if (Object.keys(req.sessions).length) res.setHeader('Cache-Control', 'no-store');
  next();
});
app.use(express.urlencoded({ extended: false, limit: '20kb' }));
app.use('/api', express.json({ limit: '400kb' }), noStore);
app.use(csrfProtection);

app.use(require('./server/routes/auth'));
app.use('/api/couple', require('./server/routes/couple-api'));
app.use('/api/planner', require('./server/routes/planner-api'));
app.use('/api/vendor', require('./server/routes/vendor-api'));
app.use(require('./server/routes/pages'));

app.use((req, res, next) => next(notFound('That page isn’t here.')));
app.use(errorHandler);

// ---------- start ----------
const ran = migrate();
if (ran.length) console.log(`Database migrated: ${ran.join(', ')}`);
if (config.autoSeedDemo && config.allowDemoSeed && !one('SELECT 1 FROM users LIMIT 1')) {
  seedDemo().then(() => console.log('Seeded demo data (development). See README for demo accounts.')).catch((e) => console.error('Demo seed failed:', e.message));
}
if (config.production && one('SELECT 1 FROM users WHERE is_demo = 1 LIMIT 1')) {
  console.warn('WARNING: demo accounts exist in a production database. Remove them (npm run db:reset with AUTO_SEED_DEMO=false) before going live.');
}
purgeExpiredSessions();
setInterval(purgeExpiredSessions, 60 * 60 * 1000).unref();

app.listen(config.port, () => {
  console.log(`The Royal Knot → http://localhost:${config.port}`);
});
