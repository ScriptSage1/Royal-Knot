// Server-rendered pages. Role checks happen here, before any template is
// rendered; the browser scripts then load data from the role's own API.
const express = require('express');
const { pageFor, plannerWedding } = require('../auth/guards');
const { STORIES, findStory, CREDITS } = require('../content/inspiration');

const router = express.Router();

router.get('/', (req, res) => {
  res.render('home', { title: 'Weddings, beautifully held', iface: 'site', stories: STORIES });
});

router.get('/inspiration/:slug', (req, res, next) => {
  const story = findStory(req.params.slug);
  if (!story) return next();
  const more = STORIES.filter((s) => s.slug !== story.slug).slice(0, 3);
  res.render('story', { title: story.title, iface: 'site', story, more });
});

router.get('/credits', (req, res) => {
  res.render('credits', { title: 'Photo credits', iface: 'site', credits: CREDITS });
});

router.get('/couple', pageFor('couple'), (req, res) => {
  res.render('couple/portal', { title: 'Your planning space', iface: 'couple' });
});

router.get('/agent', (req, res) => res.redirect('/agent/weddings'));
router.get('/agent/season', (req, res) => res.redirect(301, '/agent/weddings'));

router.get('/agent/weddings', pageFor('planner'), (req, res) => {
  res.render('agent/cases', { title: 'Weddings', iface: 'agent', nav: 'weddings' });
});

router.get('/agent/weddings/:code', pageFor('planner'), (req, res) => {
  // Throws 404/403 (rendered by the error handler) before any page is sent.
  const w = plannerWedding(req.params.code, req.user, { allowUnassigned: true });
  res.render('agent/workspace', { title: w.couple_label || 'Wedding', iface: 'agent', nav: 'weddings', caseCode: w.case_code });
});

router.get('/vendor', pageFor('vendor'), (req, res) => {
  res.render('vendor/portal', { title: 'Vendor requests', iface: 'vendor' });
});

module.exports = router;
