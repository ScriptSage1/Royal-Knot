// Small in-memory rate limiter for sign-in and sign-up. Enough for a single
// process; a multi-instance deployment would move this to a shared store.
const buckets = new Map();

// Returns true when the key has exceeded `max` hits in the window.
function hit(key, { windowMs, max }) {
  const now = Date.now();
  const b = buckets.get(key);
  if (!b || b.reset < now) { buckets.set(key, { count: 1, reset: now + windowMs }); return false; }
  b.count += 1;
  return b.count > max;
}

const clear = (key) => buckets.delete(key);

setInterval(() => {
  const now = Date.now();
  for (const [k, b] of buckets) if (b.reset < now) buckets.delete(k);
}, 60000).unref();

module.exports = { hit, clear };
