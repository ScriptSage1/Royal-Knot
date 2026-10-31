// Human-friendly random identifiers. Case codes are unique labels, not
// secrets: every request is still authorised on the server.
const crypto = require('crypto');

// No 0/O/1/I/L to avoid misreading.
const ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
const randomCode = (n) => Array.from(crypto.randomBytes(n), (b) => ALPHABET[b % ALPHABET.length]).join('');

const caseCode = () => `RK-${randomCode(6)}`;
const inviteCode = () => `${randomCode(4)}-${randomCode(4)}`;
const token = () => crypto.randomBytes(32).toString('base64url');
const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex');

module.exports = { caseCode, inviteCode, token, sha256 };
