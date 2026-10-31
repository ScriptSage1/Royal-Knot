// Security headers and the error handler.
//
// CSP: scripts only from this origin (no inline scripts, no eval). Three.js is
// served from /vendor/three on the same origin. Styles from this origin and
// Google Fonts; inline style *attributes* are allowed for small layout values
// (e.g. a progress bar width) but inline <style> blocks are not. Images may
// be data:/blob: because the garden rasterises its SVG art in the browser.
const config = require('./config');
const { HttpError } = require('./lib/errors');
const { homeFor } = require('./auth/guards');

const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' https://fonts.googleapis.com",
  "style-src-attr 'unsafe-inline'",
  "font-src 'self' https://fonts.gstatic.com",
  "img-src 'self' data: blob:",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "worker-src 'none'",
  "manifest-src 'self'",
].join('; ');

function securityHeaders(req, res, next) {
  res.setHeader('Content-Security-Policy', CSP);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'same-origin');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=(), usb=()');
  if (config.cookieSecure) res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  next();
}

// API responses and signed-in pages are private and must not be cached.
function noStore(req, res, next) {
  res.setHeader('Cache-Control', 'no-store');
  next();
}

// Safe, useful errors. Messages from HttpError (and body-parser's own client
// errors) are shown; anything else is logged briefly and replaced with a
// generic message. Stack traces only appear in development logs.
// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  let status = err.status || err.statusCode || 500;
  let message = 'Something went wrong on our side. Please try again.';
  if (err instanceof HttpError) message = err.message;
  else if (status === 413) message = `That file or request is too large (limit ${Math.round(config.maxUploadBytes / 1024)} KB).`;
  else if (status === 400 && err.type === 'entity.parse.failed') message = 'The request could not be read.';
  else if (status >= 400 && status < 500 && err.expose) message = 'The request could not be processed.';
  else {
    status = 500;
    console.error(`[error] ${req.method} ${req.path}: ${config.production ? err.message : err.stack}`);
  }
  if (req.path.startsWith('/api/')) return res.status(status).json({ error: message });
  res.status(status).render('error', { title: status === 404 ? 'Not found' : 'Something went wrong', iface: 'site', status, message, back: req.user ? homeFor(req.user) : '/' }, (renderErr, html) => {
    // Never fall through to Express's default page, which prints stack traces.
    if (renderErr) {
      console.error(`[error] could not render error page: ${renderErr.message}`);
      return res.type('text/plain').send(message);
    }
    res.send(html);
  });
}

module.exports = { securityHeaders, noStore, errorHandler };
