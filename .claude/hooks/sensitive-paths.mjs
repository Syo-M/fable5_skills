#!/usr/bin/env node
/**
 * PreToolUse hook: backs the CLAUDE.md "human sign-off for sensitive paths" rule
 * with a machine gate for Edit/Write/NotebookEdit tool calls. On a write to a
 * sensitive path it returns permissionDecision "ask", which surfaces an explicit
 * approval prompt to the human instead of relying on the model to remember the rule.
 *
 * Honest scope: this intercepts the file-editing tools only. Bash-tool writes
 * (sed -i, tee, git apply, npm install mutating a lockfile) are NOT intercepted —
 * those rely on the prose rule plus CODEOWNERS/branch protection in CI.
 *
 * This regex list is the CANONICAL sensitive-path list; keep CLAUDE.md (Workflow),
 * the governance skill, and .claude/rules/sensitive-config.md in sync with it.
 *
 * Dependency-free Node (>=18). Fails open (exit 0, stderr breadcrumb) on any
 * parse error so a broken hook never bricks the session.
 * Tested by .claude/hooks/sensitive-paths.test.mjs — run: node .claude/hooks/sensitive-paths.test.mjs
 */

const SENSITIVE = [
  // CI/CD and deploy configuration
  /(^|\/)\.github\//,
  /(^|\/)(vercel\.json|netlify\.toml)$/,
  // Framework config and middleware (carry security headers / CSP)
  /(^|\/)(next|astro|vite)\.config\.[^/]+$/,
  /(^|\/)middleware\.[^/]+$/,
  // Privileged agent instructions
  /(^|\/)\.claude\//,
  /(^|\/)CLAUDE\.md$/,
  // Auth / session / payment code
  /(^|\/)(auth|oauth|sessions?|login|payments?|billing)(\/|\.)/i,
  // Lockfiles (lockfile-only changes are a supply-chain red flag)
  /(^|\/)(package-lock\.json|pnpm-lock\.yaml|bun\.lock|bun\.lockb|yarn\.lock)$/,
];

let raw = '';
process.stdin.on('data', (c) => (raw += c));
process.stdin.on('end', () => {
  try {
    const input = JSON.parse(raw);
    const p =
      input?.tool_input?.file_path ?? input?.tool_input?.notebook_path ?? '';
    if (!p) process.exit(0);

    // Normalize to a project-relative path when possible (separator-safe:
    // cwd=/x must not strip the prefix of /xyz/...).
    const cwd = (input?.cwd ?? process.cwd()).replace(/\/+$/, '');
    const rel = p.startsWith(cwd + '/') ? p.slice(cwd.length + 1) : p;

    const hit = SENSITIVE.find((re) => re.test(rel));
    if (!hit) process.exit(0);

    process.stdout.write(
      JSON.stringify({
        hookSpecificOutput: {
          hookEventName: 'PreToolUse',
          permissionDecision: 'ask',
          permissionDecisionReason:
            `"${rel}" is on the human-sign-off list (CI/deploy config, framework config/middleware with security headers, ` +
            `auth/session/payment code, lockfiles, or .claude/** privileged instructions). ` +
            `Approve only if you reviewed this specific diff — see CLAUDE.md "Workflow" and the governance skill.`,
        },
      }),
    );
    process.exit(0);
  } catch (err) {
    // fail open — never brick the session on a hook bug, but leave a trace
    console.error(`sensitive-paths hook: failing open (${err?.message ?? err})`);
    process.exit(0);
  }
});
