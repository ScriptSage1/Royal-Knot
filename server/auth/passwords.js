// Password hashing with scrypt, the memory-hard key-derivation function in
// Node's crypto module. Stored format: scrypt$N$r$p$salt$hash (base64url).
// Verification is constant-time.
const crypto = require('crypto');
const { promisify } = require('util');

const scrypt = promisify(crypto.scrypt);
const PARAMS = { N: 2 ** 15, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };
const KEYLEN = 64;

async function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const key = await scrypt(password, salt, KEYLEN, PARAMS);
  return ['scrypt', PARAMS.N, PARAMS.r, PARAMS.p, salt.toString('base64url'), key.toString('base64url')].join('$');
}

async function verifyPassword(password, stored) {
  const [alg, N, r, p, salt, hash] = String(stored || '').split('$');
  if (alg !== 'scrypt' || !salt || !hash) return false;
  const expected = Buffer.from(hash, 'base64url');
  const key = await scrypt(String(password), Buffer.from(salt, 'base64url'), expected.length, { N: +N, r: +r, p: +p, maxmem: PARAMS.maxmem });
  return crypto.timingSafeEqual(key, expected);
}

// Compared against when the email is unknown, so response time does not
// reveal which accounts exist.
let dummy;
async function dummyHash() {
  if (!dummy) dummy = await hashPassword(crypto.randomBytes(12).toString('hex'));
  return dummy;
}

const MIN_LENGTH = 10;
function passwordProblem(pw) {
  if (typeof pw !== 'string' || pw.length < MIN_LENGTH) return `Use at least ${MIN_LENGTH} characters for your password.`;
  if (pw.length > 200) return 'Use 200 characters or fewer for your password.';
  return null;
}

module.exports = { hashPassword, verifyPassword, dummyHash, passwordProblem, MIN_LENGTH };
