#!/usr/bin/env node
/**
 * PreToolUse hook (matcher: Bash): HEURISTIC companion to sensitive-paths.mjs.
 * Escalates Bash commands that look like writes to sensitive paths — the bypass
 * the Edit/Write hook cannot see (sed -i, tee, redirects, git apply, …) — and
 * package-manager mutations (install/add/remove/update), which change lockfiles.
 *
 * HONESTY: this is a heuristic, not a sandbox. Command strings can be obfuscated
 * past any regex (variables, xargs, scripts); the durable controls remain the
 * prose rule + CODEOWNERS/branch protection. This hook exists to catch the
 * common accidental cases, not a determined adversary.
 *
 * Decision is "ask" (never "deny"): a false positive costs one human click.
 * Fails open with a stderr breadcrumb. Dependency-free Node (>=18).
 * Tested by sensitive-bash.test.mjs — run: node .claude/hooks/sensitive-bash.test.mjs
 */
import { SENSITIVE, REASON_SUFFIX } from './sensitive-list.mjs';

// Commands/patterns that (can) write to files named on the command line.
const WRITE_INDICATORS =
  /(^|[\s;|&(])(sed\s+(-\w*\s+)*-i|tee(\s|$)|mv\s|cp\s|rm\s|chmod\s|chown\s|touch\s|truncate\s|ln\s|dd\s|rsync\s|curl\s+[^|]*(-[a-zA-Z]*o|--output)(\s|=)|wget\s+[^|]*(-O|--output-document)(\s|=)|git\s+(apply|restore|checkout\s+--)|patch(\s|$))|>{1,2}|\bdd\s+[^|]*\bof=/;

// Package-manager invocations that mutate the dependency tree / lockfile.
const PM_MUTATION =
  /(^|[\s;|&(])(npm\s+(i|install|add|uninstall|remove|rm|update|up|audit\s+fix)|pnpm\s+(add|install|i|remove|rm|update|up)|yarn\s+(add|remove|install|up|upgrade)|bun\s+(add|install|i|remove|rm|update))\b/;
// `npm ci` / frozen installs replicate the lockfile rather than mutating it — allowed.
const PM_FROZEN = /(npm\s+ci\b|--frozen-lockfile|--immutable\b|--dry-run\b|--package-lock-only\b)/;

function ask(reason) {
  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        permissionDecision: 'ask',
        permissionDecisionReason: reason,
      },
    }),
  );
}

let raw = '';
process.stdin.on('data', (c) => (raw += c));
process.stdin.on('end', () => {
  try {
    const input = JSON.parse(raw);
    const cmd = input?.tool_input?.command ?? '';
    if (!cmd) process.exit(0);

    if (PM_MUTATION.test(cmd) && !PM_FROZEN.test(cmd)) {
      ask(
        `This command mutates dependencies/lockfile ("${cmd.slice(0, 120)}"). ` +
          `New/changed dependencies require vetting per the governance policy (dependency-vetter agent, ` +
          `ask-first thresholds in CLAUDE.md). Approve only if this dependency change was already agreed.`,
      );
      process.exit(0);
    }

    if (!WRITE_INDICATORS.test(cmd)) process.exit(0);

    // Tokenize roughly and test each path-looking token against the canonical list.
    const tokens = cmd
      .split(/[\s;|&()<>]+/)
      .map((t) =>
        t
          .replace(/^['"]|['"]$/g, '')
          .replace(/^--?[\w-]+=/, '') // --output-document=path, of=path style
          .replace(/^of=/, '')
          .replace(/^\.\//, ''),
      )
      .filter(Boolean);
    const hitToken = tokens.find((t) => SENSITIVE.some((re) => re.test(t)));
    if (!hitToken) process.exit(0);

    ask(
      `This Bash command appears to WRITE to "${hitToken}", which is on the human-sign-off list ` +
        REASON_SUFFIX +
        ` (Heuristic match on: "${cmd.slice(0, 120)}".)`,
    );
    process.exit(0);
  } catch (err) {
    console.error(`sensitive-bash hook: failing open (${err?.message ?? err})`);
    process.exit(0);
  }
});
