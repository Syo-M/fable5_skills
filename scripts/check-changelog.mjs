#!/usr/bin/env node
// CI check: CHANGELOG.md version headings are strictly descending semver
// (the file promises reverse-chronological order — this makes that promise a gate).
// Run: node scripts/check-changelog.mjs
import { readFileSync } from 'node:fs';

const src = readFileSync(new URL('../CHANGELOG.md', import.meta.url), 'utf8');
const versions = [...src.matchAll(/^## \[(\d+)\.(\d+)\.(\d+)\] - (\d{4}-\d{2}-\d{2})/gm)].map(
  (m) => ({ v: [Number(m[1]), Number(m[2]), Number(m[3])], date: m[4], raw: m[0] }),
);

if (versions.length === 0) {
  console.error('FAIL  no version headings found (expected "## [x.y.z] - YYYY-MM-DD")');
  process.exit(1);
}

// Also reject malformed headings that the strict regex above would silently skip.
const looseCount = (src.match(/^## \[/gm) ?? []).length;
if (looseCount !== versions.length) {
  console.error(`FAIL  ${looseCount - versions.length} malformed version heading(s) — must match "## [x.y.z] - YYYY-MM-DD"`);
  process.exit(1);
}

let failed = 0;
for (let i = 1; i < versions.length; i++) {
  const [a, b] = [versions[i - 1], versions[i]];
  const cmp = a.v[0] - b.v[0] || a.v[1] - b.v[1] || a.v[2] - b.v[2];
  if (cmp <= 0) {
    console.error(`FAIL  order broken: "${a.raw}" is not newer than "${b.raw}"`);
    failed++;
  }
  if (a.date < b.date) {
    console.error(`FAIL  date order broken: ${a.raw} dated before ${b.raw}`);
    failed++;
  }
}

if (failed) process.exit(1);
console.log(`OK  CHANGELOG: ${versions.length} versions, strictly reverse-chronological (${versions[0].raw.slice(3)} … ${versions.at(-1).raw.slice(3)})`);
