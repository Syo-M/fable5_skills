#!/usr/bin/env node
// Eval-harness hook: appends one JSON line per hook event to
// $CLAUDE_PROJECT_DIR/.eval-log.jsonl so run-eval.mjs can measure which
// skills/agents/rules actually activated. Fail-open, dependency-free.
import { appendFileSync } from 'node:fs';
import { join } from 'node:path';

let raw = '';
process.stdin.on('data', (c) => (raw += c));
process.stdin.on('end', () => {
  try {
    const e = JSON.parse(raw);
    const line = {
      event: e.hook_event_name ?? null,
      tool: e.tool_name ?? null,
      skill: e.tool_input?.skill ?? null,
      agent: e.tool_input?.subagent_type ?? e.agent_type ?? e.agent_name ?? null,
      instructions: e.file_path ?? e.path ?? e.instructions_path ?? null,
      prompt_head: typeof e.tool_input?.prompt === 'string' ? e.tool_input.prompt.slice(0, 80) : null,
    };
    const dir = process.env.CLAUDE_PROJECT_DIR ?? process.cwd();
    appendFileSync(join(dir, '.eval-log.jsonl'), JSON.stringify(line) + '\n');
  } catch {
    /* fail open */
  }
  process.exit(0);
});
