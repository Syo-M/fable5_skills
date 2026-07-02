# fable-frontend plugin (GENERATED — do not edit)

Generated from `.claude/` by `scripts/build-plugin.mjs` (source of truth: the repo root).
Version 3.0.2. Install:

```
/plugin marketplace add Syo-M/fable5_skills
/plugin install fable-frontend@fable-skills
```

Included: 21 skills, 4 agents, sign-off hooks (with test suites), 2 output styles.

NOT included (plugin limitations — use `install.sh` from the repo for the full set):
- `.claude/rules/` path-scoped tripwires (plugins cannot bundle rules)
- `CLAUDE.md` project floor (a plugin-root CLAUDE.md is not loaded)
- `.claude/workflows/` (harness-specific)
- Styling profiles: this plugin ships the DEFAULT (css-modules) profile only; for
  `--styling tailwind` / `minimal`, install via `install.sh` instead.

Note: agents inject skills by bare name (e.g. `test-author` → `testing-vitest`); verify injection
resolves in your Claude Code version when running agents from the namespaced plugin context.
Note: plugin-loaded agents IGNORE frontmatter `hooks:` — the reviewer agents' tool-level
read-only guard therefore does not apply here (instruction-level contract only). For the
enforced version, install via install.sh with CLI >= 2.1.145.
