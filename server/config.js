// Runtime configuration. Values come from environment variables, optionally
// loaded from a local `.env` file (see .env.example). Nothing here is ever sent
// to the browser.
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const envFile = path.join(ROOT, '.env');
if (fs.existsSync(envFile)) process.loadEnvFile(envFile);

const env = process.env;
const bool = (v, d = false) => (v == null || v === '' ? d : /^(1|true|yes|on)$/i.test(v));
const int = (v, d) => (Number.isFinite(parseInt(v, 10)) ? parseInt(v, 10) : d);
const inRoot = (p, d) => path.resolve(ROOT, p || d);

const production = env.NODE_ENV === 'production';

module.exports = {
  root: ROOT,
  production,
  port: int(env.PORT, 3000),
  cookieSecure: production || bool(env.COOKIE_SECURE),
  sessionTtlHours: int(env.SESSION_TTL_HOURS, 72),
  databasePath: inRoot(env.DATABASE_PATH, 'data/royal-knot.db'),
  uploadDir: inRoot(env.UPLOAD_DIR, 'storage/uploads'),
  maxUploadBytes: int(env.MAX_UPLOAD_KB, 512) * 1024,
  demoPassword: env.DEMO_PASSWORD || 'royal-knot-demo',
  autoSeedDemo: bool(env.AUTO_SEED_DEMO, true),
  allowDemoSeed: !production || bool(env.ALLOW_DEMO_SEED),
  claudeCliCommand: (env.CLAUDE_CLI_COMMAND || '').trim(),
  claudeCliTimeoutMs: int(env.CLAUDE_CLI_TIMEOUT_MS, 120000),
  claudeCliModel: (env.CLAUDE_CLI_MODEL || 'haiku').trim(),
  claudeCliEffort: env.CLAUDE_CLI_EFFORT == null ? 'medium' : env.CLAUDE_CLI_EFFORT.trim(),
  claudeCliRetryEffort: env.CLAUDE_CLI_RETRY_EFFORT == null ? 'high' : env.CLAUDE_CLI_RETRY_EFFORT.trim(),
  defaultMeetingLink: (env.DEFAULT_MEETING_LINK || '').trim(),
};
