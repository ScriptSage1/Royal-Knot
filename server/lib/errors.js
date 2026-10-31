// Errors that are safe to show to the user. Anything else becomes a generic
// message in the error handler, so SQL errors, paths and stack traces never
// reach the browser.
class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
    this.expose = true;
  }
}

const badRequest = (m) => new HttpError(400, m);
const forbidden = (m = 'You do not have access to this.') => new HttpError(403, m);
const notFound = (m = 'Not found.') => new HttpError(404, m);
const conflict = (m) => new HttpError(409, m);

module.exports = { HttpError, badRequest, forbidden, notFound, conflict };
