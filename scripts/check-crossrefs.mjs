#!/usr/bin/env node
// CI check: every cross-reference resolves.
//  1. Skill names in agents' `skills:` frontmatter → .claude/skills/<name>/ exists
//  2. Skill names in the CLAUDE.md index table → skill exists
//  3. Path-like references (.claude/…, templates/…, scripts/…) in md files → file/dir exists
// CHANGELOG.md is excluded from (3): it is a historical record.
// Run: node scripts/check-crossrefs.mjs
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const skillDirs = new Set(readdirSync(join(root, '.claude/skills')));
let failed = 0;
const fail = (msg) => { console.error(`FAIL  ${msg}`); failed++; };

// (1) agents' skills: lists
for (const f of readdirSync(join(root, '.claude/agents'))) {
  if (!f.endsWith('.md')) continue;
  const src = readFileSync(join(root, '.claude/agents', f), 'utf8');
  const m = src.match(/^skills:\s*\[([^\]]*)\]/m);
  if (!m) continue;
  for (const name of m[1].split(',').map((s) => s.trim()).filter(Boolean)) {
    if (!skillDirs.has(name)) fail(`agents/${f}: skills entry "${name}" has no .claude/skills/${name}/`);
  }
}

// (2) CLAUDE.md skill index table (second column backticks)
const claudeMd = readFileSync(join(root, 'CLAUDE.md'), 'utf8');
for (const m of claudeMd.matchAll(/^\|[^|]+\|\s*`([a-z0-9-]+)`\s*\|$/gm)) {
  if (!skillDirs.has(m[1])) fail(`CLAUDE.md table: skill "${m[1]}" has no .claude/skills/${m[1]}/`);
}

// (3) path-like references in markdown (repo-relative)
const mdFiles = [];
const walk = (dir) => {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.name === '.git' || e.name === 'node_modules') continue;
    const p = join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else if (e.name.endsWith('.md') && e.name !== 'CHANGELOG.md') mdFiles.push(p);
  }
};
walk(root);

const PATH_RE = /(?:^|[\s(`「])((?:\.claude|templates|scripts)\/[\w.\/-]*[\w\/])/g;
// Paths documentation cites as ANTI-examples ("don't create this") — must not exist.
const ANTI_EXAMPLES = new Set(['.claude/.claude']);
// Artifacts created at install/run time (installer stamps, CLI-managed memory dirs) — not repo files.
const INSTALLED_ARTIFACTS = new Set([
  '.claude/fable-skills-version',
  '.claude/settings.local.json',
  '.claude/agent-memory',
  '.claude/agent-memory-local',
]);
for (const f of mdFiles) {
  const src = readFileSync(f, 'utf8');
  for (const m of src.matchAll(PATH_RE)) {
    const ref = m[1].replace(/\/$/, '');
    if (INSTALLED_ARTIFACTS.has(ref)) continue;
    if (ANTI_EXAMPLES.has(ref)) {
      if (existsSync(join(root, ref))) fail(`anti-example path "${ref}" EXISTS — that's the mistake the docs warn about`);
      continue;
    }
    const abs = join(root, ref);
    if (!existsSync(abs)) fail(`${f.slice(root.length + 1)}: referenced path "${m[1]}" does not exist`);
  }
}

// (4) README structure tree must list every shipped skill, rule, and agent
//     (a new artifact that isn't documented is invisible to adopters — the forms.md lesson)
const readme = readFileSync(join(root, 'README.md'), 'utf8');
for (const name of skillDirs) {
  if (!readme.includes(`${name}/SKILL.md`)) fail(`README tree: skill "${name}" not listed`);
}
for (const f of readdirSync(join(root, '.claude/rules'))) {
  if (f.endsWith('.md') && !readme.includes(f)) fail(`README tree: rule "${f}" not listed`);
}
for (const f of readdirSync(join(root, '.claude/agents'))) {
  if (f.endsWith('.md') && !readme.includes(f)) fail(`README tree: agent "${f}" not listed`);
}

if (failed) { console.error(`\n${failed} broken reference(s).`); process.exit(1); }
console.log(`OK  cross-references: agents' skills, CLAUDE.md table (${skillDirs.size} skills), README tree completeness, and path refs across ${mdFiles.length} md files all resolve`);
