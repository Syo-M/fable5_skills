#!/usr/bin/env node
// Test for sensitive-paths.mjs. Dependency-free; run: node .claude/hooks/sensitive-paths.test.mjs
// Exits non-zero on any failure. Keep cases in sync when editing the SENSITIVE list.
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const hook = join(dirname(fileURLToPath(import.meta.url)), 'sensitive-paths.mjs');

const CASES = [
  // [description, stdin payload, expectAsk]
  ['CI workflow', { cwd: '/r', tool_input: { file_path: '/r/.github/workflows/ci.yml' } }, true],
  ['next.config', { cwd: '/r', tool_input: { file_path: '/r/next.config.mjs' } }, true],
  ['middleware (CSP lives here)', { cwd: '/r', tool_input: { file_path: '/r/src/middleware.ts' } }, true],
  ['auth dir', { cwd: '/r', tool_input: { file_path: '/r/src/features/auth/login.ts' } }, true],
  ['oauth dir', { cwd: '/r', tool_input: { file_path: '/r/src/oauth/callback.ts' } }, true],
  ['oauth2 dir (enterprise naming)', { cwd: '/r', tool_input: { file_path: '/r/src/oauth2/client.ts' } }, true],
  ['authentication file', { cwd: '/r', tool_input: { file_path: '/r/src/lib/authentication.ts' } }, true],
  ['auth-service dir', { cwd: '/r', tool_input: { file_path: '/r/src/auth-service/token.ts' } }, true],
  ['sign-in page', { cwd: '/r', tool_input: { file_path: '/r/src/pages/sign-in.tsx' } }, true],
  ['signup dir', { cwd: '/r', tool_input: { file_path: '/r/src/signup/form.tsx' } }, true],
  ['jwt helper', { cwd: '/r', tool_input: { file_path: '/r/src/lib/jwt.ts' } }, true],
  ['credentials store', { cwd: '/r', tool_input: { file_path: '/r/src/credentials/store.ts' } }, true],
  ['session file', { cwd: '/r', tool_input: { file_path: '/r/src/lib/session.ts' } }, true],
  ['billing dir', { cwd: '/r', tool_input: { file_path: '/r/src/billing/invoice.ts' } }, true],
  ['pnpm lockfile', { cwd: '/r', tool_input: { file_path: '/r/pnpm-lock.yaml' } }, true],
  ['bun binary lockfile', { cwd: '/r', tool_input: { file_path: '/r/bun.lockb' } }, true],
  ['.claude instructions', { cwd: '/r', tool_input: { file_path: '/r/.claude/skills/x/SKILL.md' } }, true],
  ['CLAUDE.md', { cwd: '/r', tool_input: { file_path: '/r/CLAUDE.md' } }, true],
  ['vercel.json', { cwd: '/r', tool_input: { file_path: '/r/vercel.json' } }, true],
  ['notebook_path fallback', { cwd: '/r', tool_input: { notebook_path: '/r/.github/x.ipynb' } }, true],
  ['path outside cwd still matches', { cwd: '/other', tool_input: { file_path: '/r/pnpm-lock.yaml' } }, true],

  // negatives — false-positive guards
  ['author page (not auth)', { cwd: '/r', tool_input: { file_path: '/r/src/pages/author/index.tsx' } }, false],
  ['authors list (not auth)', { cwd: '/r', tool_input: { file_path: '/r/src/authors.ts' } }, false],
  ['sessionStorage util (segment check)', { cwd: '/r', tool_input: { file_path: '/r/src/utils/sessionStorage.ts' } }, false],
  ['design tokens file (token ≠ jwt)', { cwd: '/r', tool_input: { file_path: '/r/src/styles/tokens.css' } }, false],
  ['authorize util (not auth)', { cwd: '/r', tool_input: { file_path: '/r/src/lib/authorize.ts' } }, false],
  ['plain component', { cwd: '/r', tool_input: { file_path: '/r/src/components/Button.tsx' } }, false],
  ['cwd prefix is separator-safe', { cwd: '/x', tool_input: { file_path: '/xyz/components/Button.tsx' } }, false],
  ['no file path at all', { cwd: '/r', tool_input: {} }, false],
];

let failed = 0;
for (const [desc, payload, expectAsk] of CASES) {
  const out = execFileSync('node', [hook], { input: JSON.stringify(payload), encoding: 'utf8' });
  const asked = out.includes('"permissionDecision":"ask"');
  const ok = asked === expectAsk;
  if (!ok) failed++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${desc} (expected ${expectAsk ? 'ask' : 'allow'}, got ${asked ? 'ask' : 'allow'})`);
}

// fail-open on garbage input
const garbage = execFileSync('node', [hook], { input: 'not json', encoding: 'utf8' });
const failOpenOk = garbage === '';
if (!failOpenOk) failed++;
console.log(`${failOpenOk ? 'PASS' : 'FAIL'}  garbage input fails open with no stdout`);

console.log(failed === 0 ? `\nAll ${CASES.length + 1} cases passed.` : `\n${failed} case(s) FAILED.`);
process.exit(failed === 0 ? 0 : 1);
