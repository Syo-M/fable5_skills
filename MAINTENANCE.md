# MAINTENANCE — keeping the rules true over time

This repo's value is that its claims are TRUE. Two things rot: version-specific facts
(frameworks move) and rule relevance (teams change). This file is the review protocol.
Session-driven improvements are handled by the `/retro` skill; this is the calendar-driven side.

## Quarterly: version-fact re-verification

Do this every quarter AND whenever a covered framework ships a major version.

**Procedure**

1. For each row below, check the current released major/minor against the docs (web search
   the official changelog — do not trust memory).
2. If a claim drifted: fix the skill, note it in `CHANGELOG.md`, and update this table's
   "verified against" column.
3. Run the full local suite (`scripts/*.mjs`, `check_frontmatter.py`, both hook tests,
   `build-plugin.mjs --check`) before committing.

**Inventory of version-sensitive claims**

| Where | Claim | Verified against | Re-verify by checking |
|---|---|---|---|
| `nextjs` | `cacheLife` / `cacheTag` / `updateTag`; Origin check covers Server Actions only (NOT route handlers) | Next 16 | Next.js caching + security docs |
| `astro` | Content Layer API (`glob()`/`file()` loaders), `<ClientRouter />`, `Astro.glob` removed | Astro 5/6 | Astro changelog |
| `storybook` | `storybook/test` import, `canvas` from play context, Vitest addon as test runner | Storybook 10 | Storybook migration notes |
| `testing-vitest` | `projects` config (workspace successor) | Vitest 4 | Vitest config docs |
| `frontend-security` | `z.strictObject` primary / `.strict()` legacy | zod 4 | zod docs |
| `react-patterns` | React Compiler status hedge (GA but verify project adoption) | React 19.x | React blog |
| `motion` | Motion package naming (ex-Framer Motion) | motion v11+ | motion.dev |
| `templates/github/workflows/ci.yml` + `.github/workflows/verify.yml` | action SHA pins current & non-vulnerable | pinned SHAs in-file | GitHub advisories; re-resolve tags via `git ls-remote` |
| `templates/.semgrep/` | rule syntax against current Semgrep | Semgrep CI container | semgrep releases |
| Claude Code integration (`rules`/`agents`/`memory`/`output-styles`/hooks schema, plugin layout) | formats used across `.claude/` and `scripts/build-plugin.mjs` | Claude Code docs 2026-07 | code.claude.com/docs changelog |

## Per release checklist

1. All local checks green (same list as above — CI runs them too, but don't push red).
2. `CHANGELOG.md` entry at the TOP (strict reverse-chronological; the CI check enforces order).
3. If `.claude/` changed: `node scripts/build-plugin.mjs` and commit the regenerated `plugin/`.
4. `git fetch` before pushing — this repo receives pushes from multiple sessions/machines.
5. Annotated tag `vX.Y.Z` = the CHANGELOG heading; push main + tag together.
6. Trigger evaluation (`eval/` — see its README): `node eval/run-eval.mjs --runs 3` before a MAJOR
   release; 1-run signal checks after big description/trigger changes. Commit the report.
7. Formal 3-persona scoring cadence: at minimum before every MAJOR bump; record results in
   README「品質評価」 (rubric + persona prompts are reproduced there).

## Pruning

Prune rules that stopped earning their tokens (nobody has hit them in months) — EXCEPT
security/a11y rules, which are exempt (`governance`: a control that is working is not redundant).
Deletions go through `/retro`'s proposal flow like additions.
