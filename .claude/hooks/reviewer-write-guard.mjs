#!/usr/bin/env node
/**
 * Agent-scoped PreToolUse guard for the READ-ONLY reviewer agents
 * (security-reviewer / a11y-auditor / dependency-vetter):
 *   - Edit/Write/NotebookEdit: DENIED unless the resolved path is inside the
 *     agent-memory directory (path is normalized first — string prefixes are
 *     NOT trusted, so `.../agent-memory-local/../../README.md` is denied).
 *   - Bash: ALLOWLIST — only known read-only commands pass; everything else is
 *     denied (deny-by-default is correct for a read-only reviewer; a denylist
 *     would miss node -e / perl -pi / find -delete / tar -xf / custom scripts).
 *
 * Honest scope: Edit/Write/NotebookEdit are a hard technical block. Bash is an
 * allowlist (stronger than the old heuristic, but a compound/obfuscated command
 * that starts with an allowed verb could still do more — see README).
 *
 * Wired via agent frontmatter `hooks:` (Claude Code — see README for the verified
 * version note). Older CLIs and plugin-loaded agents ignore agent hooks, where the
 * contract falls back to instruction level. Fail-open on parse errors.
 * Tested by reviewer-write-guard.test.mjs.
 */
import { resolve, relative, isAbsolute } from 'node:path';

// Read-only Bash commands a reviewer legitimately needs. Matched against the
// first word of each ;/|/&&-separated segment.
const ALLOWED_BASH = new Set([
  'git', 'grep', 'rg', 'ag', 'find', 'cat', 'head', 'tail', 'less', 'wc', 'ls',
  'sed', 'awk', 'cut', 'sort', 'uniq', 'diff', 'tree', 'file', 'stat', 'echo',
  'semgrep', 'gitleaks', 'npm', 'pnpm', 'yarn', 'npx', 'node', 'python3', 'jq',
  'test', 'true', 'cd', 'pwd', 'which', 'env',
]);
// Even an allowed leading verb can be a write when used with these — deny.
const WRITE_SUBCOMMANDS = {
  git: /\b(apply|restore|checkout\s+--|commit|push|reset|clean|stash\s+(pop|apply|drop)|rm|mv|add)\b/,
  npm: /\b(i|install|ci|add|uninstall|update|publish|link|run)\b/,
  pnpm: /\b(add|install|i|remove|update|publish|run)\b/,
  yarn: /\b(add|remove|install|up|upgrade|publish|run)\b/,
  npx: /.*/, // npx runs arbitrary packages — deny for a reviewer
  node: /\b(-e|--eval|-p|--print)\b/, // node -e can write; plain `node script` also runs code → deny below
  python3: /\b(-c|-m)\b/,
  sed: /\s-i\b/, // in-place edit
  find: /-(delete|exec|execdir|fprint|fput)\b/,
};
// Commands that execute arbitrary code — a reviewer may only READ, so deny these
// two entirely (their allow-list membership above is for reference; overridden here).
const EXEC_DENY = new Set(['node', 'python3', 'npx']);
// Bare shell write operators always deny.
const WRITE_OPERATORS = /(^|[^0-9])>{1,2}|\btee\b|\bdd\b/;

const deny = (reason) => {
  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        permissionDecision: 'deny',
        permissionDecisionReason: reason,
      },
    }),
  );
};

function pathInsideMemory(p, cwd) {
  if (!p) return false;
  const abs = isAbsolute(p) ? resolve(p) : resolve(cwd, p);
  // agent memory lives at <project>/.claude/agent-memory[-local]/...
  for (const dir of ['.claude/agent-memory', '.claude/agent-memory-local']) {
    const root = resolve(cwd, dir);
    const rel = relative(root, abs);
    if (rel === '' || (!rel.startsWith('..') && !isAbsolute(rel))) return true;
  }
  return false;
}

function bashIsReadOnly(cmd) {
  if (WRITE_OPERATORS.test(cmd)) return false;
  // split on shell separators; every segment must be an allowed read-only command
  const segments = cmd.split(/(?:&&|\|\||\||;|\n)/).map((s) => s.trim()).filter(Boolean);
  for (const seg of segments) {
    const m = seg.match(/^([A-Za-z0-9_./-]+)/);
    if (!m) return false;
    const verb = m[1].replace(/^.*\//, ''); // basename of the command
    if (EXEC_DENY.has(verb)) return false;
    if (!ALLOWED_BASH.has(verb)) return false;
    const sub = WRITE_SUBCOMMANDS[verb];
    if (sub && sub.test(seg)) return false;
  }
  return true;
}

let raw = '';
process.stdin.on('data', (c) => (raw += c));
process.stdin.on('end', () => {
  try {
    const input = JSON.parse(raw);
    const tool = input?.tool_name ?? '';
    const cwd = input?.cwd ?? process.cwd();

    if (tool === 'Edit' || tool === 'Write' || tool === 'NotebookEdit') {
      const p = input?.tool_input?.file_path ?? input?.tool_input?.notebook_path ?? '';
      if (pathInsideMemory(p, cwd)) process.exit(0); // agent-memory writes only
      deny(
        `This reviewer agent is read-only: repository writes are tool-blocked (only its agent memory, path-normalized, is writable). Report the finding instead of fixing it.`,
      );
      process.exit(0);
    }

    if (tool === 'Bash') {
      const command = input?.tool_input?.command ?? '';
      if (!bashIsReadOnly(command)) {
        deny(
          `This reviewer agent is read-only: only allow-listed read-only Bash is permitted (git diff/show/status, grep, rg, semgrep, npm view, test runners). Blocked: "${command.slice(0, 120)}".`,
        );
        process.exit(0);
      }
    }
    process.exit(0);
  } catch (err) {
    console.error(`reviewer-write-guard: failing open (${err?.message ?? err})`);
    process.exit(0);
  }
});
