#!/usr/bin/env node
// Test for reviewer-write-guard.mjs. Run: node .claude/hooks/reviewer-write-guard.test.mjs
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const hook = join(dirname(fileURLToPath(import.meta.url)), 'reviewer-write-guard.mjs');
const CWD = '/proj';

const CASES = [
  // --- Edit/Write: memory-only, PATH-NORMALIZED ---
  ['Edit repo file', { tool_name: 'Edit', tool_input: { file_path: '/proj/src/auth/login.ts' } }, true],
  ['Write README', { tool_name: 'Write', tool_input: { file_path: '/proj/README.md' } }, true],
  ['Write agent memory (allowed)', { tool_name: 'Write', tool_input: { file_path: '/proj/.claude/agent-memory-local/security-reviewer/MEMORY.md' } }, false],
  ['Write shared memory (allowed)', { tool_name: 'Edit', tool_input: { file_path: '/proj/.claude/agent-memory/security-reviewer/notes.md' } }, false],
  ['relative memory path (allowed)', { tool_name: 'Write', tool_input: { file_path: '.claude/agent-memory-local/x/m.md' } }, false],
  ['TRAVERSAL escape via ../ (must DENY)', { tool_name: 'Write', tool_input: { file_path: '/proj/.claude/agent-memory-local/security-reviewer/../../../README.md' } }, true],
  ['TRAVERSAL relative escape (must DENY)', { tool_name: 'Write', tool_input: { file_path: '.claude/agent-memory-local/../../etc/x' } }, true],
  ['prefix-lookalike sibling dir (must DENY)', { tool_name: 'Write', tool_input: { file_path: '/proj/.claude/agent-memory-localEVIL/x' } }, true],
  // --- Bash: ALLOWLIST (deny by default) ---
  ['git diff (allow)', { tool_name: 'Bash', tool_input: { command: 'git diff HEAD~1' } }, false],
  ['git show (allow)', { tool_name: 'Bash', tool_input: { command: 'git show abc123' } }, false],
  ['grep (allow)', { tool_name: 'Bash', tool_input: { command: 'grep -r token src/' } }, false],
  ['rg piped to grep (allow)', { tool_name: 'Bash', tool_input: { command: 'rg token | grep auth' } }, false],
  ['semgrep (allow)', { tool_name: 'Bash', tool_input: { command: 'semgrep --config .semgrep/' } }, false],
  ['npm view (allow)', { tool_name: 'Bash', tool_input: { command: 'npm view lodash license' } }, false],
  ['sed read filter (allow)', { tool_name: 'Bash', tool_input: { command: "sed -n '1,20p' file.ts" } }, false],
  ['git commit (deny)', { tool_name: 'Bash', tool_input: { command: 'git commit -m x' } }, true],
  ['git push (deny)', { tool_name: 'Bash', tool_input: { command: 'git push' } }, true],
  ['npm install (deny)', { tool_name: 'Bash', tool_input: { command: 'npm install lodash' } }, true],
  ['npm run script (deny)', { tool_name: 'Bash', tool_input: { command: 'npm run build' } }, true],
  ['sed -i (deny)', { tool_name: 'Bash', tool_input: { command: "sed -i 's/a/b/' x.ts" } }, true],
  ['find -delete (deny)', { tool_name: 'Bash', tool_input: { command: 'find . -name x -delete' } }, true],
  ['node -e (deny, exec)', { tool_name: 'Bash', tool_input: { command: 'node -e "require(\'fs\').writeFileSync(\'x\',\'y\')"' } }, true],
  ['node script (deny, exec)', { tool_name: 'Bash', tool_input: { command: 'node evil.js' } }, true],
  ['npx anything (deny, exec)', { tool_name: 'Bash', tool_input: { command: 'npx some-writer' } }, true],
  ['perl not in allowlist (deny)', { tool_name: 'Bash', tool_input: { command: 'perl -pi -e s/a/b/ x' } }, true],
  ['tar extract not allowed (deny)', { tool_name: 'Bash', tool_input: { command: 'tar -xf a.tar' } }, true],
  ['redirect write (deny)', { tool_name: 'Bash', tool_input: { command: 'echo x > out.txt' } }, true],
  ['tee (deny)', { tool_name: 'Bash', tool_input: { command: 'echo x | tee out.txt' } }, true],
  ['chained read;write (deny)', { tool_name: 'Bash', tool_input: { command: 'git diff; rm x' } }, true],
  // --- other tools pass through ---
  ['Read (allow)', { tool_name: 'Read', tool_input: { file_path: '/proj/src/x.ts' } }, false],
  ['Grep tool (allow)', { tool_name: 'Grep', tool_input: { pattern: 'x' } }, false],
];

let failed = 0;
for (const [desc, payload, expectDeny] of CASES) {
  const out = execFileSync('node', [hook], { input: JSON.stringify({ cwd: CWD, ...payload }), encoding: 'utf8' });
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
