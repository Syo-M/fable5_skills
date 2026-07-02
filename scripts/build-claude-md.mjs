#!/usr/bin/env node
// Generates CLAUDE.md from core/CLAUDE.base.md + a styling profile's fragments.
// The repo-root CLAUDE.md is the generated artifact for the DEFAULT profile
// (css-modules) — never edit it directly; edit core/ or profiles/ and rebuild.
//   node scripts/build-claude-md.mjs                     regenerate root CLAUDE.md (default profile)
//   node scripts/build-claude-md.mjs --check             CI freshness gate (exit 1 on drift)
//   node scripts/build-claude-md.mjs --profile tailwind --stdout   print another profile's CLAUDE.md
import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const arg = (name, dflt) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : dflt;
};
const PROFILE = arg('profile', 'css-modules');
const CHECK = process.argv.includes('--check');
const STDOUT = process.argv.includes('--stdout');

const profileDir = join(root, 'profiles', PROFILE);
if (!existsSync(join(profileDir, 'profile.json'))) {
  console.error(`FAIL  unknown profile "${PROFILE}" — available: ${readdirSync(join(root, 'profiles')).join(', ')}`);
  process.exit(1);
}

const frag = (f) => readFileSync(join(profileDir, f), 'utf8').replace(/\n$/, '');
let out = readFileSync(join(root, 'core', 'CLAUDE.base.md'), 'utf8');
for (const [marker, file] of [
  ['<!-- @profile:stack-styling -->', 'stack-line.md'],
  ['<!-- @profile:skill-rows -->', 'skill-rows.md'],
]) {
  if (!out.includes(marker)) { console.error(`FAIL  core is missing marker ${marker}`); process.exit(1); }
  const content = frag(file);
  // an empty fragment removes the marker line entirely (e.g. minimal has no skill rows)
  out = content === '' ? out.replace(marker + '\n', '').replace(marker, '') : out.replace(marker, content);
}

if (STDOUT) { process.stdout.write(out); process.exit(0); }
if (PROFILE !== 'css-modules') {
  console.error('FAIL  only the default profile may be written to the repo root; use --stdout for others');
  process.exit(1);
}
if (CHECK) {
  const current = readFileSync(join(root, 'CLAUDE.md'), 'utf8');
  if (current !== out) {
    console.error('FAIL  CLAUDE.md is stale — edit core/ or profiles/css-modules/ then run: node scripts/build-claude-md.mjs');
    process.exit(1);
  }
  console.log('OK  CLAUDE.md is fresh (matches core + css-modules profile)');
} else {
  writeFileSync(join(root, 'CLAUDE.md'), out);
  console.log('OK  CLAUDE.md generated (css-modules profile)');
}
