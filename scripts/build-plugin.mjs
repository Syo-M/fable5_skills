#!/usr/bin/env node
// Generates plugin/ (a Claude Code plugin) FROM .claude/ — the single source of
// truth. Never edit plugin/ by hand; edit .claude/ and re-run this script.
//   node scripts/build-plugin.mjs           regenerate plugin/
//   node scripts/build-plugin.mjs --check   verify plugin/ is fresh (CI gate; exit 1 on drift)
//
// Deliberate exclusions (documented in the generated plugin/README.md):
//   - .claude/rules/     — plugins cannot bundle path-scoped rules (docs-confirmed)
//   - .claude/workflows/ — harness-specific, not a plugin concept
//   - CLAUDE.md          — a plugin-root CLAUDE.md is not loaded as project context
// Full installs (rules + CLAUDE.md) use ./install.sh instead.
import { readFileSync, writeFileSync, readdirSync, mkdirSync, rmSync, cpSync, existsSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const check = process.argv.includes('--check');
const outDir = check ? join(root, '.plugin-check-tmp') : join(root, 'plugin');

const version = readFileSync(join(root, 'CHANGELOG.md'), 'utf8')
  .match(/^## \[(\d+\.\d+\.\d+)\]/m)?.[1];
if (!version) { console.error('FAIL  cannot read version from CHANGELOG.md'); process.exit(1); }

rmSync(outDir, { recursive: true, force: true });
mkdirSync(join(outDir, '.claude-plugin'), { recursive: true });

// 1. components copied verbatim from the source of truth (OS junk filtered —
//    a stray .DS_Store must never become a plugin diff)
const noJunk = (src) => !src.split('/').pop().startsWith('.DS_Store');
for (const dir of ['skills', 'agents', 'output-styles']) {
  cpSync(join(root, '.claude', dir), join(outDir, dir), { recursive: true, filter: noJunk });
}
// Plugin-loaded subagents IGNORE frontmatter `hooks:` (Claude Code strips them
// for security). Leaving them in would read as "configured but silently inert",
// so strip the block from the generated agents and rely on the instruction-level
// contract there (the reviewer-write-guard tool-block only applies to install.sh installs).
for (const f of readdirSync(join(outDir, 'agents'))) {
  if (!f.endsWith('.md')) continue;
  const p = join(outDir, 'agents', f);
  const src = readFileSync(p, 'utf8');
  const stripped = src.replace(
    /# AGENT-HOOKS-START[\s\S]*?# AGENT-HOOKS-END\n/,
    '# NOTE: agent-scoped hooks are omitted here — plugin-loaded subagents ignore frontmatter\n' +
      '# `hooks:`, so the read-only contract in this plugin is instruction-level only. For the\n' +
      '# tool-enforced version (Edit/Write blocked, Bash allow-listed), install via install.sh.\n',
  );
  if (stripped !== src) writeFileSync(p, stripped);
}
// hook scripts (+ their tests, so the plugin's claims stay verifiable)
mkdirSync(join(outDir, 'hooks'), { recursive: true });
for (const f of readdirSync(join(root, '.claude/hooks'))) {
  cpSync(join(root, '.claude/hooks', f), join(outDir, 'hooks', f));
}

// 2. hooks.json — same three-level schema as settings.json, paths rebased
//    from "$CLAUDE_PROJECT_DIR/.claude/hooks/…" to "${CLAUDE_PLUGIN_ROOT}/hooks/…"
const settings = JSON.parse(readFileSync(join(root, '.claude/settings.json'), 'utf8'));
const rebased = JSON.parse(
  JSON.stringify({ hooks: settings.hooks }).replaceAll(
    '$CLAUDE_PROJECT_DIR/.claude/hooks/',
    '${CLAUDE_PLUGIN_ROOT}/hooks/',
  ),
);
writeFileSync(join(outDir, 'hooks', 'hooks.json'), JSON.stringify(rebased, null, 2) + '\n');

// 3. manifest
// keys restricted to what `claude plugin validate` accepts — "displayName" was
// rejected as unrecognized (caught by eval/plugin-smoke.mjs step 1)
const manifest = {
  name: 'fable-frontend',
  version,
  description:
    'Frontend rules for React/Next.js/Vite/Astro + CSS Modules + Vitest/Playwright/Storybook: ' +
    'skills, adversarial review agents, and sensitive-path sign-off hooks. ' +
    'Path-scoped rules and CLAUDE.md are NOT bundleable in plugins — use install.sh for those.',
  author: { name: 'Syo-M', url: 'https://github.com/Syo-M' },
  repository: 'https://github.com/Syo-M/fable-frontend-skills',
  license: 'MIT',
  keywords: ['frontend', 'react', 'nextjs', 'astro', 'security', 'a11y', 'testing'],
};
writeFileSync(join(outDir, '.claude-plugin', 'plugin.json'), JSON.stringify(manifest, null, 2) + '\n');

// 4. generated README (English — ships to plugin consumers)
writeFileSync(
  join(outDir, 'README.md'),
  `# fable-frontend plugin (GENERATED — do not edit)

Generated from \`.claude/\` by \`scripts/build-plugin.mjs\` (source of truth: the repo root).
Version ${version}. Install:

\`\`\`
/plugin marketplace add Syo-M/fable-frontend-skills
/plugin install fable-frontend@fable-skills
\`\`\`

Included: ${readdirSync(join(outDir, 'skills')).length} skills, ${readdirSync(join(outDir, 'agents')).filter((f) => f.endsWith('.md')).length} agents, sign-off hooks (with test suites), 2 output styles.

NOT included (plugin limitations — use \`install.sh\` from the repo for the full set):
- \`.claude/rules/\` path-scoped tripwires (plugins cannot bundle rules)
- \`CLAUDE.md\` project floor (a plugin-root CLAUDE.md is not loaded)
- \`.claude/workflows/\` (harness-specific)
- Styling profiles: this plugin ships the DEFAULT (css-modules) profile only; for
  \`--styling tailwind\` / \`minimal\`, install via \`install.sh\` instead.

Note: agents inject skills by bare name (e.g. \`test-author\` → \`testing-vitest\`); verify injection
resolves in your Claude Code version when running agents from the namespaced plugin context.
Note: plugin-loaded agents IGNORE frontmatter \`hooks:\` — the reviewer agents' tool-level
read-only guard therefore does not apply here (instruction-level contract only). For the
enforced version, install via install.sh with CLI >= 2.1.145.
`,
);

if (!check) {
  console.log(`OK  plugin/ generated (v${version})`);
  process.exit(0);
}

// --check: diff freshly-built tree against committed plugin/
try {
  if (!existsSync(join(root, 'plugin'))) throw new Error('plugin/ does not exist — run: node scripts/build-plugin.mjs');
  execFileSync('diff', ['-r', join(root, 'plugin'), outDir], { encoding: 'utf8' });
  console.log(`OK  plugin/ is fresh (matches a rebuild from .claude/, v${version})`);
} catch (e) {
  console.error('FAIL  plugin/ is stale — edit .claude/ then run: node scripts/build-plugin.mjs');
  if (e.stdout) console.error(String(e.stdout).slice(0, 2000));
  process.exitCode = 1;
} finally {
  rmSync(outDir, { recursive: true, force: true });
}
