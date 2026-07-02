#!/usr/bin/env node
// Merge this repo's hook wiring into an existing .claude/settings.json without
// clobbering the target's own configuration. Used by install.sh.
//   node scripts/merge-settings.mjs <target-settings.json> <source-settings.json>
// Appends source hook entries whose command strings are absent from the target
// (per event), preserves everything else in the target, writes the target in place.
import { readFileSync, writeFileSync } from 'node:fs';

const [targetPath, sourcePath] = process.argv.slice(2);
if (!targetPath || !sourcePath) {
  console.error('usage: merge-settings.mjs <target-settings.json> <source-settings.json>');
  process.exit(1);
}

const target = JSON.parse(readFileSync(targetPath, 'utf8'));
const source = JSON.parse(readFileSync(sourcePath, 'utf8'));

const commandsOf = (matcherGroups) =>
  new Set(
    (matcherGroups ?? []).flatMap((g) => (g.hooks ?? []).map((h) => h.command).filter(Boolean)),
  );

target.hooks ??= {};
let added = 0;
for (const [event, groups] of Object.entries(source.hooks ?? {})) {
  target.hooks[event] ??= [];
  const existing = commandsOf(target.hooks[event]);
  for (const group of groups) {
    const fresh = (group.hooks ?? []).filter((h) => !h.command || !existing.has(h.command));
    if (fresh.length === 0) continue;
    target.hooks[event].push({ ...group, hooks: fresh });
    added += fresh.length;
  }
}

writeFileSync(targetPath, JSON.stringify(target, null, 2) + '\n');
console.log(`merged ${added} hook handler(s) into ${targetPath}`);
