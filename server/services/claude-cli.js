// Runs the locally installed Claude Code CLI, non-interactively, on the
// server only. The browser never talks to it.
//
// Isolation for each run:
// - an empty temporary working folder, so no project files or CLAUDE.md;
// - `--tools ""` (no built-in tools) and `--strict-mcp-config` with no MCP
//   servers, so no file, shell, browser or other integration access;
// - a minimal environment without ANTHROPIC_API_KEY / ANTHROPIC_AUTH_TOKEN,
//   so the CLI uses the subscription it is signed in with and never silently
//   switches to API billing;
// - a hard timeout that kills the whole process tree.
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn, spawnSync } = require('child_process');
const config = require('../config');

const MAX_OUTPUT = 2 * 1024 * 1024;
const PASS_ENV = ['PATH', 'Path', 'PATHEXT', 'HOME', 'USERPROFILE', 'HOMEDRIVE', 'HOMEPATH', 'APPDATA', 'LOCALAPPDATA',
  'SystemRoot', 'SYSTEMROOT', 'ComSpec', 'TEMP', 'TMP', 'TMPDIR', 'LANG', 'LC_ALL', 'XDG_CONFIG_HOME', 'XDG_RUNTIME_DIR'];

class CliError extends Error {
  constructor(kind, message) { super(message); this.kind = kind; }
}

const isEnabled = () => Boolean(config.claudeCliCommand);

// Windows runs .cmd shims (npm installs) through cmd.exe; a native .exe or a
// POSIX binary runs directly. Every argument is fixed by the server: the
// model and effort names are checked against a strict pattern and the only
// path passed comes from mkdtemp. Nothing from a request reaches the command
// line; the transcript and notes go through stdin.
const SAFE = /^[\w.:-]+$/;
function commandFor(args) {
  const cmd = config.claudeCliCommand;
  if (process.platform !== 'win32' || /\.exe$/i.test(cmd)) return { cmd, args, verbatim: false };
  const q = (a) => `"${String(a).replace(/"/g, '""')}"`;
  const line = [cmd, ...args].map(q).join(' ');
  return { cmd: process.env.ComSpec || 'cmd.exe', args: ['/d', '/s', '/c', `"${line}"`], verbatim: true };
}

function childEnv() {
  const env = {};
  for (const k of PASS_ENV) if (process.env[k] != null) env[k] = process.env[k];
  return env;
}

function killTree(child) {
  if (process.platform === 'win32') spawnSync('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
  else child.kill('SIGKILL');
}

// Classify failures into messages that are safe to show (never the
// transcript, prompt or raw CLI output).
function classify(code, text) {
  if (/not logged in|log ?in|\/login|authenticat|credential|unauthori[sz]ed|401|subscription/i.test(text)) {
    return new CliError('unauthenticated', 'The Claude CLI on the server is not signed in. Run `claude` once on that machine and sign in with the team subscription.');
  }
  if (/unknown option|unrecognized|invalid (value|option)|error: option/i.test(text)) {
    return new CliError('unsupported', 'The installed Claude CLI rejected an option (model, effort or tools). Update the CLI or adjust CLAUDE_CLI_MODEL / CLAUDE_CLI_EFFORT.');
  }
  return new CliError('failed', `The Claude CLI stopped with an error (exit code ${code}).`);
}

// Returns the model's reply text. Throws CliError.
function runClaude({ systemPrompt, input, effort }) {
  return new Promise((resolve, reject) => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rk-claude-'));
    const promptFile = path.join(dir, 'system-prompt.txt');
    fs.writeFileSync(promptFile, systemPrompt, 'utf8');
    const cleanup = () => fs.rm(dir, { recursive: true, force: true }, () => {});

    if (!SAFE.test(config.claudeCliModel) || (effort && !SAFE.test(effort))) {
      return reject(new CliError('unsupported', 'CLAUDE_CLI_MODEL and CLAUDE_CLI_EFFORT may only contain letters, numbers, dots, dashes and colons.'));
    }
    const args = ['-p', '--model', config.claudeCliModel];
    if (effort) args.push('--effort', effort);
    args.push('--output-format', 'json', '--system-prompt-file', promptFile, '--tools', '', '--strict-mcp-config');

    const c = commandFor(args);
    let child;
    try {
      child = spawn(c.cmd, c.args, { cwd: dir, env: childEnv(), windowsVerbatimArguments: c.verbatim, windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
    } catch {
      cleanup();
      return reject(new CliError('unavailable', 'The Claude CLI could not be started on the server.'));
    }

    let out = '', err = '', done = false;
    const finish = (fn) => { if (!done) { done = true; clearTimeout(timer); cleanup(); fn(); } };
    const timer = setTimeout(() => {
      killTree(child);
      finish(() => reject(new CliError('timeout', `The Claude CLI did not finish within ${Math.round(config.claudeCliTimeoutMs / 1000)} seconds.`)));
    }, config.claudeCliTimeoutMs);

    child.stdout.on('data', (d) => { out += d; if (out.length > MAX_OUTPUT) { killTree(child); finish(() => reject(new CliError('failed', 'The Claude CLI returned too much output.'))); } });
    child.stderr.on('data', (d) => { if (err.length < 20000) err += d; });
    child.on('error', (e) => finish(() => reject(e.code === 'ENOENT'
      ? new CliError('unavailable', 'The Claude CLI was not found on the server. Check CLAUDE_CLI_COMMAND.')
      : new CliError('unavailable', 'The Claude CLI could not be started on the server.'))));
    child.on('close', (code) => finish(() => {
      let envelope = null;
      try { envelope = JSON.parse(out); } catch { /* not JSON */ }
      if (code !== 0 || !envelope || envelope.is_error) {
        if (process.platform === 'win32' && code === 1 && /not recognized as an internal or external command/i.test(err)) {
          return reject(new CliError('unavailable', 'The Claude CLI was not found on the server. Check CLAUDE_CLI_COMMAND.'));
        }
        return reject(classify(code, `${err}\n${envelope && typeof envelope.result === 'string' ? envelope.result : ''}`));
      }
      resolve(typeof envelope.result === 'string' ? envelope.result : '');
    }));

    child.stdin.on('error', () => {});
    child.stdin.end(input, 'utf8');
  });
}

module.exports = { runClaude, isEnabled, CliError };
