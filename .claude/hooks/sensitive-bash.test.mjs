#!/usr/bin/env node
// Test for sensitive-bash.mjs. Dependency-free; run: node .claude/hooks/sensitive-bash.test.mjs
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const hook = join(dirname(fileURLToPath(import.meta.url)), 'sensitive-bash.mjs');

const CASES = [
  // [description, command, expectAsk]
  // writes to sensitive paths → ask
  ['sed -i into CI workflow', "sed -i 's/a/b/' .github/workflows/ci.yml", true],
  ['tee into next.config', 'echo x | tee next.config.mjs', true],
  ['redirect into auth code', 'echo "export {}" > src/auth/session.ts', true],
  ['append to lockfile', 'echo junk >> pnpm-lock.yaml', true],
  ['git apply touching .claude', 'git apply patch.diff .claude/settings.json', true],
  ['mv over CLAUDE.md', 'mv /tmp/x CLAUDE.md', true],
  ['rm middleware', 'rm src/middleware.ts', true],
  ['chmod on payments module', 'chmod 600 src/payments/charge.ts', true],
  // package-manager mutations → ask (even without a sensitive token)
  ['npm install package', 'npm install lodash', true],
  ['pnpm add', 'pnpm add -D vitest', true],
  ['yarn upgrade', 'yarn upgrade react', true],
  // frozen/replicating installs → allow
  ['npm ci', 'npm ci --ignore-scripts', false],
  ['pnpm frozen', 'pnpm install --frozen-lockfile', false],
  // reads / non-sensitive writes → allow
  ['cat a workflow', 'cat .github/workflows/ci.yml', false],
  ['grep in auth dir', 'grep -r "token" src/auth/', false],
  ['git diff', 'git diff HEAD~1 -- .claude/', false],
  ['redirect to scratch', 'echo hi > /tmp/scratch/notes.txt', false],
  ['sed -i on normal component', "sed -i 's/a/b/' src/components/Button.tsx", false],
  ['run tests', 'npm run test', false],
  ['npm view (vetting)', 'npm view lodash license', false],
  ['no command field', '', false],
];

let failed = 0;
for (const [desc, command, expectAsk] of CASES) {
  const payload = JSON.stringify({ cwd: '/r', tool_name: 'Bash', tool_input: command ? { command } : {} });
  const out = execFileSync('node', [hook], { input: payload, encoding: 'utf8' });
  const asked = out.includes('"permissionDecision":"ask"');
  const ok = asked === expectAsk;
  if (!ok) failed++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${desc} (expected ${expectAsk ? 'ask' : 'allow'}, got ${asked ? 'ask' : 'allow'})`);
}

const garbage = execFileSync('node', [hook], { input: 'not json', encoding: 'utf8' });
const failOpenOk = garbage === '';
if (!failOpenOk) failed++;
console.log(`${failOpenOk ? 'PASS' : 'FAIL'}  garbage input fails open with no stdout`);

console.log(failed === 0 ? `\nAll ${CASES.length + 1} cases passed.` : `\n${failed} case(s) FAILED.`);
process.exit(failed === 0 ? 0 : 1);
