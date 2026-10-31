// The Royal Knot — UI module preview server.
// Serves templates and static assets only. There is no auth, session, database
// or API here yet; every screen renders from mock data held in browser memory
// (see public/js/data/). Later modules plug in behind public/js/data/source.js.

const path = require('path');
const express = require('express');

const app = express();
const PORT = process.env.PORT || 3000;

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use('/static', express.static(path.join(__dirname, 'public')));
app.use('/vendor/three', express.static(path.join(__dirname, 'node_modules', 'three', 'build')));

// Developer preview hub — links to both interfaces. Not a login screen.
app.get('/', (req, res) => {
  res.render('index', { title: 'Developer preview', iface: 'dev' });
});

// Couple-facing client portal.
app.get('/couple', (req, res) => {
  res.render('couple/portal', { title: 'Your planning space', iface: 'couple' });
});

// Agency agent workspace (internal).
app.get('/agent', (req, res) => res.redirect('/agent/weddings'));

app.get('/agent/weddings', (req, res) => {
  res.render('agent/cases', { title: 'Weddings', iface: 'agent', nav: 'weddings' });
});

// :mockKey is a preview route key for mock data, not a workspace ID.
app.get('/agent/weddings/:mockKey', (req, res) => {
  res.render('agent/workspace', {
    title: 'Wedding workspace',
    iface: 'agent',
    nav: 'weddings',
    mockKey: req.params.mockKey,
  });
});

app.get('/agent/season', (req, res) => res.redirect(301, '/agent/weddings'));

app.use((req, res) => {
  res.status(404).render('index', { title: 'Not found', iface: 'dev', notFound: true });
});

app.listen(PORT, () => {
  console.log(`The Royal Knot UI preview → http://localhost:${PORT}`);
});
