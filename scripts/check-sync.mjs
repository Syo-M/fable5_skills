#!/usr/bin/env node
// CI check: the sensitive-path list must not drift between its representations.
//  - .claude/hooks/sensitive-list.mjs (SENSITIVE regexes) is the CANONICAL list
//  - .claude/rules/sensitive-config.md `paths:` globs must be a SUBSET of hook coverage
//    (the rule may cover less — auth code is covered by the server-boundaries rule —
//    but must never cover a path the hook would silently allow)
//  - a canonical fixture table pins what BOTH must cover
// Run: node scripts/check-sync.mjs
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SENSITIVE } from '../.claude/hooks/sensitive-list.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
let failed = 0;
const fail = (msg) => { console.error(`FAIL  ${msg}`); failed++; };

// -- parse the rule's paths: globs --
const ruleSrc = readFileSync(join(root, '.claude/rules/sensitive-config.md'), 'utf8');
const fm = ruleSrc.match(/^---\n([\s\S]*?)\n---/);
const globs = [...(fm?.[1] ?? '').matchAll(/^\s*-\s*"([^"]+)"/gm)].map((m) => m[1]);
if (globs.length === 0) fail('sensitive-config.md: no paths: globs parsed');

// -- minimal **-aware glob → regex (same dialect the rules use) --
const globToRe = (g) => {
  let re = '';
  for (let i = 0; i < g.length; i++) {
    if (g.startsWith('**/', i)) { re += '(?:.*/)?'; i += 2; }
    else if (g.startsWith('**', i)) { re += '.*'; i += 1; }
    else if (g[i] === '*') re += '[^/]*';
    else re += g[i].replace(/[.+?^${}()|[\]\\]/g, '\\$&');
  }
  return new RegExp(`^${re}$`);
};
const ruleRes = globs.map(globToRe);
const hookHit = (p) => SENSITIVE.some((re) => re.test(p));
const ruleHit = (p) => ruleRes.some((re) => re.test(p));

// -- fixture corpus: representative paths, sensitive and not --
const FIXTURES = [
  '.github/workflows/ci.yml', '.github/CODEOWNERS',
  'next.config.mjs', 'apps/web/astro.config.ts', 'vite.config.ts',
  'src/middleware.ts', 'middleware.ts',
  'vercel.json', 'netlify.toml',
  '.claude/settings.json', '.claude/skills/x/SKILL.md', 'CLAUDE.md',
  'package-lock.json', 'pnpm-lock.yaml', 'bun.lock', 'bun.lockb', 'yarn.lock',
  'src/auth/login.ts', 'src/oauth/callback.ts', 'src/oauth2/client.ts',
  'src/lib/authentication.ts', 'src/lib/session.ts',
  'src/payments/charge.ts', 'src/billing/invoice.ts',
  // non-sensitive controls
  'src/components/Button.tsx', 'src/pages/author/index.tsx', 'src/authors.ts',
  'src/utils/sessionStorage.ts', 'README.md', 'package.json', 'vitest.config.ts',
];

// (1) rule ⊆ hook over the corpus
for (const p of FIXTURES) {
  if (ruleHit(p) && !hookHit(p)) fail(`drift: rule glob covers "${p}" but the canonical hook list does not`);
}

// (2) canonical expectations for the hook (must-ask / must-allow)
const MUST_ASK = FIXTURES.slice(0, 24); // everything above the controls
const MUST_ALLOW = FIXTURES.slice(24);
for (const p of MUST_ASK) if (!hookHit(p)) fail(`hook must cover "${p}" but does not`);
for (const p of MUST_ALLOW) if (hookHit(p)) fail(`hook must NOT cover "${p}" (false positive)`);

// (3) config-file globs in the rule must exist for every framework the hook names
for (const fw of ['next', 'astro', 'vite']) {
  if (!globs.some((g) => g.includes(`${fw}.config`))) fail(`sensitive-config.md: missing glob for ${fw}.config.*`);
}

if (failed) { console.error(`\n${failed} sync violation(s).`); process.exit(1); }
console.log(`OK  sensitive-path sync: ${globs.length} rule globs ⊆ hook coverage; ${MUST_ASK.length} must-ask + ${MUST_ALLOW.length} must-allow fixtures hold`);
