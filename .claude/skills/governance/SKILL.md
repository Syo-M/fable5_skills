---
name: governance
description: Repository governance — CI merge gates, toolchain pinning, dependency lifecycle and license policy, secrets scanning, change control for rules and sensitive paths, Git/PR conventions, observability, performance budgets, browser support. Use when setting up CI/CD, repo configuration, releases, adding dependencies, or defining team policy. 日本語の依頼例:「CI/CD設定」「リリース手順」「依存ライセンス確認」「秘密情報スキャン」「リポジトリ設定」「ブランチ/PR運用」「パフォーマンスバジェット」。
---

# Governance

## CI gates — merge-blocking, in this order

1. Typecheck (`tsc --noEmit`) and lint (ESLint + Stylelint per `tooling`).
2. Unit + story tests (Vitest incl. Storybook Vitest addon), with a11y violations at serious/critical failing.
3. E2E on critical paths (Playwright) + axe scan spec.
4. Dependency audit — high + critical block.
5. Secrets scan (gitleaks or equivalent) — any finding blocks.
6. License check — denied license blocks (policy below).
7. Bundle-size budget check (`size-limit` or Lighthouse CI).
8. Security-review (Semgrep heuristics in `templates/.semgrep/` for webhook-missing-verification, SSRF, secret exposure, and unsanitized HTML; zod-at-boundary and IDOR have no reliable static rule and stay review-only).

A change is mergeable only when all gates pass; gates may not be skipped or marked optional to "unblock" a PR without human sign-off. Starter configs implementing these gates (CI workflow, gitleaks, ESLint, Stylelint) live in `templates/` — copy and adapt them rather than authoring from scratch.

## Toolchain pinning

- Node: `engines` in package.json + `.nvmrc` (same version); CI uses the same pin.
- Package manager: `packageManager` field + corepack; enforce a single PM with `only-allow` in `preinstall`. Never mix lockfiles.

## Dependency lifecycle

- Updates via Renovate/Dependabot: grouped, with a minimum release age of 3 days (cooldown) so freshly-published compromised versions don't auto-merge. Break-glass: a fix for a known exploited/critical CVE may bypass the cooldown with a named approver's sign-off recorded on the PR.
- Emit an SBOM (CycloneDX) in CI for release builds.
- Pin GitHub Actions (and other CI plugins) by commit SHA; pin CI container images (e.g. the Semgrep job's `semgrep/semgrep`) by digest (`@sha256:…`), not a floating tag.
- Add-time vetting rules live in `frontend-security` (install scripts, typosquatting, registry pinning).

## License policy

- Allowed for shipped frontend code: MIT, Apache-2.0, BSD-2/3-Clause, ISC, 0BSD.
- Denied: GPL/LGPL/AGPL, SSPL, BUSL, unlicensed/unknown. Anything else: ask before adding.
- Enforce in CI (`license-checker` / FOSSA / Snyk). Dev-only tooling may be reviewed case-by-case, but default to the same list.

## Secrets scanning

- gitleaks (or equivalent) in pre-commit AND CI; enable push protection on the hosting platform.
- A detected leak = rotate immediately, then purge; rotation is the fix, history rewriting is cleanup.

## Change control — the rules themselves

- `CLAUDE.md` and `.claude/**` are privileged instructions: a careless edit silently changes every AI agent's behavior. Protect them with CODEOWNERS (this repo ships a `CODEOWNERS`) requiring platform/security-team review, and require CODEOWNERS review in branch protection.
- Disclosure and incident response are defined in `SECURITY.md`; every release is recorded in `CHANGELOG.md`.
- This rules repo is versioned (git + CHANGELOG); projects consume a tagged version, not ad-hoc copies, so audits can tell which rules governed which commits.
- Security and a11y rules are EXEMPT from "prune rules that are being followed" maintenance — a control that is working is not redundant.

## Sensitive paths — human sign-off required

AI agents must not modify without explicit human approval: CI workflow files, auth/session/payment modules, security headers/CSP config, `.claude/**`, lockfile-only changes, and release/deploy configuration. Propose the diff and wait. This list is machine-backstopped by the shipped PreToolUse hook (`.claude/hooks/sensitive-paths.mjs` → permission prompt) for the file-editing tools (Edit/Write/NotebookEdit); Bash-tool writes are NOT intercepted and rely on this rule plus CODEOWNERS/branch protection. The prompt IS the sign-off — never restructure a change (e.g. into a Bash write) to avoid triggering it. The hook's regex list is the canonical sensitive-path list.

## Git & PR conventions

- Conventional Commits (`feat:`, `fix:`, `chore:`…); imperative subject ≤ 72 chars; body explains why.
- Branch naming: `feat/<slug>`, `fix/<slug>`, `chore/<slug>`.
- PRs: small and single-purpose; description includes what/why and test evidence (commands run + result); note AI assistance where the org requires disclosure. Squash-merge to keep main linear.

## Observability

- One error-monitoring tool (e.g. Sentry) wired in every app: release tagging, source maps uploaded privately (never publicly served — pairs with the Vite sourcemap rule), `beforeSend` PII scrubbing, sampling configured, alerts owned by a named team.

## Performance budgets

- Core Web Vitals targets: LCP ≤ 2.5 s, INP ≤ 200 ms, CLS ≤ 0.1 (p75, field data).
- Client JS budget per route enforced in CI (`size-limit`); a sensible default initial-load ceiling is ~170 kB gzipped JS per route (tune per product/device profile). Adding a dependency that breaks the budget requires the `frontend-security`/governance dependency review, not a budget bump.

## Browser support

- Define a `browserslist` (default: Baseline Widely Available) — it drives transpilation/polyfills, which CSS features are usable without fallback, and the Playwright browser matrix. Don't leave support implicit.
