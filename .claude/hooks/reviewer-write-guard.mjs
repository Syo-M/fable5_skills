#!/usr/bin/env node
/**
 * Agent-scoped PreToolUse hook for the READ-ONLY reviewer agents
 * (security-reviewer / a11y-auditor / dependency-vetter). Turns their
 * "never edits" contract from an instruction into a tool-level DENY:
 *   - Edit/Write/NotebookEdit: allowed ONLY under .claude/agent-memory(-local)/
 *   - Bash: write-looking commands are denied
 *
 * Wired via agent frontmatter `hooks:` — supported since Claude Code 2.1.145;
 * OLDER CLIs (and plugin-loaded agents) ignore agent hooks entirely, where the
 * contract falls back to instruction level (documented in README). Fail-open
 * on parse errors, stderr breadcrumb.
 * Tested by reviewer-write-guard.test.mjs.
 */

const WRITE_BASH =
  /(^|[\s;|&(])(sed\s+(-\w*\s+)*-i|tee(\s|$)|mv\s|cp\s|rm\s|chmod\s|chown\s|touch\s|truncate\s|ln\s|dd\s|rsync\s|curl\s+[^|]*(-[a-zA-Z]*o|--output)(\s|=)|wget\s+[^|]*(-O|--output-document)(\s|=)|git\s+(apply|restore|checkout\s+--|commit|push|reset)|patch(\s|$)|npm\s+(i|install|add|uninstall|update)|pnpm\s+(add|i|install|remove|update)|yarn\s+(add|remove|install|up)|bun\s+(add|i|install|remove))\b|>{1,2}|\bdd\s+[^|]*\bof=/;

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

let raw = '';
process.stdin.on('data', (c) => (raw += c));
process.stdin.on('end', () => {
  try {
    const input = JSON.parse(raw);
    const tool = input?.tool_name ?? '';

    if (tool === 'Edit' || tool === 'Write' || tool === 'NotebookEdit') {
      const p = input?.tool_input?.file_path ?? input?.tool_input?.notebook_path ?? '';
      if (/(^|\/)\.claude\/agent-memory(-local)?\//.test(p)) process.exit(0); // memory writes only
      deny(
        `This reviewer agent is read-only: repository writes are tool-blocked (only its agent memory is writable). Report the finding instead of fixing it.`,
      );
      process.exit(0);
    }

    if (tool === 'Bash') {
      const cmd = input?.tool_input?.command ?? '';
      if (WRITE_BASH.test(cmd)) {
        deny(
          `This reviewer agent is read-only: write-like Bash is blocked (heuristic). Use read-only commands (git diff, grep, semgrep, test runners).`,
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
