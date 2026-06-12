# Project Guide

Frontend project. Detailed conventions live in `.claude/skills/` and load on demand — do not duplicate them here. Sole exception: the security/a11y invariants below are duplicated deliberately so they hold even when no skill loads; do not "clean them up".

## Stack

- TypeScript **strict mode**.
- Framework — decide from `package.json` dependencies with this precedence: `next` present → `nextjs` skill; `astro` present → `astro` skill (even though React/Vite also appear there); neither → standalone Vite + React SPA → `vite-react` skill.
- Package manager: detect from the lockfile (`package-lock.json` / `pnpm-lock.yaml` / `bun.lock`) and use only that one — never hardcode `npm` commands in a pnpm/bun repo.
- Styling: **CSS Modules** (`*.module.css`). No inline styles, no CSS-in-JS, no utility-class frameworks. Sole exception: Astro single-file scoped `<style>` per the `astro` skill.
- Tests by layer: pure logic → **Vitest** unit tests; component behavior → **Storybook play functions** (run as tests via the Storybook Vitest addon); user journeys → **Playwright** E2E. Do not write a plain Vitest component test for behavior a story should own.

## Non-negotiables

- No `any`; `@ts-expect-error` only with a one-line reason (`@ts-ignore` never). Prefer `unknown` + narrowing.
- Never commit secrets; never log or send PII/credentials/tokens to logs, analytics, or error trackers. Client-exposed env vars only via the public prefix (`NEXT_PUBLIC_` / `VITE_` / `PUBLIC_`); everything else stays server-side.
- Validate ALL external input with a zod schema at the boundary (request bodies, params, form data, cookies, API responses). Webhooks additionally require signature verification — see `frontend-security`. Client-side validation alone is never sufficient.
- Cookie-authenticated state-changing endpoints need explicit CSRF protection unless the framework provably provides it for that endpoint type (Next.js covers Server Actions only — NOT route handlers).
- No `dangerouslySetInnerHTML` / `set:html` / `innerHTML` with non-static content unless sanitized — see `frontend-security` first.
- Semantic HTML first; interactive elements must be keyboard-operable. Never remove focus outlines without a visible replacement.

## Workflow

- Before claiming done: typecheck → lint → affected tests. "Affected" = tests colocated with changed files plus anything importing them; run the full suite when shared config, tokens, or shared utilities changed. Report failures verbatim; never label failing work complete.
- New dependencies: prefer platform APIs / zero-dep options. Ask first when a package has install scripts, adds >50 kB min+gzip to the client bundle, pulls a large transitive tree, or has a non-permissive license (see `governance`).
- Never modify CI workflows, auth/payment code, security headers/CSP config, or `.claude/**` without explicit human sign-off.
- Match existing repo conventions over anything written here. Small, focused diffs; no drive-by refactors.
- Destructive actions (deleting files, rewriting configs, force operations): state intent and confirm first.

## Commands

Use the scripts defined in `package.json` (`dev`, `build`, `typecheck`, `lint`, `test`, `test:e2e`, `storybook`). If a script is missing, propose adding it rather than inventing ad-hoc commands.

## Skills (load on demand)

| When working on… | Skill |
|---|---|
| React components / hooks | `react-patterns` |
| Next.js routing, RSC, Server Actions, caching | `nextjs` |
| Standalone Vite SPA setup / config | `vite-react` |
| Astro pages, islands, content collections | `astro` |
| Styles, design tokens, responsive | `css-modules` |
| Unit tests, test utilities | `testing-vitest` |
| Stories, play functions, component tests | `storybook` |
| E2E tests | `testing-playwright` |
| Anything touching auth, user input, HTML injection, outbound fetch, webhooks, env vars, deps | `frontend-security` |
| Accessibility | `a11y` |
| CI gates, dependency policy, licenses, releases, repo config | `governance` |
| ESLint / Stylelint / tsconfig / enforcement setup | `tooling` |
