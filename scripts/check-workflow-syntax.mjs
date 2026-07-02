#!/usr/bin/env node
// CI check: .claude/workflows/*.js parse when wrapped the way the Workflow
// harness wraps them (async body with injected globals). They are NOT standard
// modules (top-level return) — this is the only valid way to syntax-check them.
// Run: node scripts/check-workflow-syntax.mjs
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = join(dirname(fileURLToPath(import.meta.url)), '..', '.claude', 'workflows');
if (!existsSync(dir)) { console.log('OK  no .claude/workflows/ directory'); process.exit(0); }

let failed = 0;
const files = readdirSync(dir).filter((f) => f.endsWith('.js'));
for (const f of files) {
  let src = readFileSync(join(dir, f), 'utf8').replace(/^export /m, '');
  try {
    new Function(
      `async function main(agent, parallel, pipeline, phase, log, args, budget, workflow) {${src}}`,
    );
    console.log(`OK  ${f} parses under harness wrapping`);
  } catch (e) {
    console.error(`FAIL  ${f}: ${e.message}`);
    failed++;
  }
}
process.exit(failed ? 1 : 0);
