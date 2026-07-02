#!/usr/bin/env node
// Test for reviewer-write-guard.mjs. Run: node .claude/hooks/reviewer-write-guard.test.mjs
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const hook = join(dirname(fileURLToPath(import.meta.url)), 'reviewer-write-guard.mjs');

const CASES = [
  // [description, payload, expectDeny]
  ['Edit repo file', { tool_name: 'Edit', tool_input: { file_path: '/r/src/auth/login.ts' } }, true],
  ['Write repo file', { tool_name: 'Write', tool_input: { file_path: '/r/README.md' } }, true],
  ['Write agent memory (allowed)', { tool_name: 'Write', tool_input: { file_path: '/r/.claude/agent-memory-local/security-reviewer/MEMORY.md' } }, false],
  ['Write shared agent memory (allowed)', { tool_name: 'Edit', tool_input: { file_path: '/r/.claude/agent-memory/security-reviewer/notes.md' } }, false],
  ['Bash sed -i', { tool_name: 'Bash', tool_input: { command: "sed -i 's/a/b/' src/x.ts" } }, true],
  ['Bash redirect', { tool_name: 'Bash', tool_input: { command: 'echo x > out.txt' } }, true],
  ['Bash git commit', { tool_name: 'Bash', tool_input: { command: 'git commit -m x' } }, true],
  ['Bash npm install', { tool_name: 'Bash', tool_input: { command: 'npm install lodash' } }, true],
  ['Bash git diff (allowed)', { tool_name: 'Bash', tool_input: { command: 'git diff HEAD~1' } }, false],
  ['Bash grep (allowed)', { tool_name: 'Bash', tool_input: { command: 'grep -r token src/' } }, false],
  ['Bash semgrep (allowed)', { tool_name: 'Bash', tool_input: { command: 'semgrep --config .semgrep/' } }, false],
  ['Bash npm view (allowed)', { tool_name: 'Bash', tool_input: { command: 'npm view lodash license' } }, false],
  ['Read tool (allowed)', { tool_name: 'Read', tool_input: { file_path: '/r/src/x.ts' } }, false],
];

let failed = 0;
for (const [desc, payload, expectDeny] of CASES) {
  const out = execFileSync('node', [hook], { input: JSON.stringify(payload), encoding: 'utf8' });
  const denied = out.includes('"permissionDecision":"deny"');
  const ok = denied === expectDeny;
  if (!ok) failed++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${desc} (expected ${expectDeny ? 'deny' : 'allow'}, got ${denied ? 'deny' : 'allow'})`);
}
const garbage = execFileSync('node', [hook], { input: 'not json', encoding: 'utf8' });
const failOpenOk = garbage === '';
if (!failOpenOk) failed++;
console.log(`${failOpenOk ? 'PASS' : 'FAIL'}  garbage input fails open with no stdout`);

console.log(failed === 0 ? `\nAll ${CASES.length + 1} cases passed.` : `\n${failed} case(s) FAILED.`);
process.exit(failed === 0 ? 0 : 1);
