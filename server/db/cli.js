// Database commands:
//   npm run db:migrate   apply new migrations
//   npm run db:seed      add the demo accounts and weddings to an empty database
//   npm run db:reset     delete the local database and uploads, migrate, then seed
//   NEW_PASSWORD=... node server/db/cli.js create-user planner email@agency.in "Full Name"
//   NEW_PASSWORD=... node server/db/cli.js create-user vendor email@vendor.in "Vendor Name" <vendorId>
// Planner and vendor accounts are created by the agency, never self-registered.
const fs = require('fs');
const config = require('../config');

const cmd = process.argv[2];

if (cmd === 'reset') {
  if (config.production) { console.error('Refusing to reset a production database.'); process.exit(1); }
  for (const suffix of ['', '-wal', '-shm']) fs.rmSync(config.databasePath + suffix, { force: true });
  fs.rmSync(config.uploadDir, { recursive: true, force: true });
  console.log('Deleted the local database and uploads.');
}

const { migrate } = require('./index');
const ran = migrate();
console.log(ran.length ? `Applied migrations: ${ran.join(', ')}` : 'Database schema is up to date.');

if (cmd === 'seed' || (cmd === 'reset' && config.autoSeedDemo)) {
  require('./seed').seedDemo()
    .then(() => console.log('Seeded demo data. Demo accounts are listed in the README.'))
    .catch((e) => { console.error(`Seed skipped: ${e.message}`); process.exitCode = 1; });
}

if (cmd === 'create-user') {
  const [role, email, name, vendorId] = process.argv.slice(3);
  const { hashPassword, passwordProblem } = require('../auth/passwords');
  const { one, run } = require('./index');
  const problem = passwordProblem(process.env.NEW_PASSWORD);
  if (!['planner', 'vendor'].includes(role) || !email || !name) { console.error('Usage: NEW_PASSWORD=... node server/db/cli.js create-user <planner|vendor> <email> "<name>" [vendorId]'); process.exit(1); }
  if (problem) { console.error(problem); process.exit(1); }
  if (role === 'vendor' && !one('SELECT 1 FROM vendors WHERE id = ?', Number(vendorId))) { console.error('Vendor accounts need an existing vendor id from the directory.'); process.exit(1); }
  hashPassword(process.env.NEW_PASSWORD).then((hash) => {
    run('INSERT INTO users (email, password_hash, name, role, vendor_id) VALUES (?, ?, ?, ?, ?)', email.toLowerCase(), hash, name, role, role === 'vendor' ? Number(vendorId) : null);
    console.log(`Created ${role} account for ${email}.`);
  }).catch((e) => { console.error(e.message.includes('UNIQUE') ? 'An account with that email already exists.' : e.message); process.exitCode = 1; });
}
