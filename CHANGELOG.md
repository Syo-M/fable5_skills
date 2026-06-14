# Changelog

All notable changes to this rules repository are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/) in reverse-chronological order; this
repo is versioned so consuming projects can pin a tag and audits can tell which rules governed which commits.

## [1.5.1] - 2026-06-15

### Fixed
- Reordered this CHANGELOG to strict reverse-chronological order (it had drifted to 1.3.0 → 1.5.0 →
  1.4.0 …), restoring the tag-to-rules audit trail the file promises.
- Doc-vs-enforcement drift: `governance` (CI gate 8) and `tooling` overstated the Semgrep backstop.
  Corrected to match the shipped `templates/.semgrep/` ruleset — webhook-missing-verification, SSRF,
  secret exposure, and unsanitized HTML are backstopped; zod-at-boundary and IDOR have no reliable
  static rule and are explicitly review-only.
- `frontend-security` self-check: added an authorization-model gate and folded the DNS-rebinding
  pinned-IP step into the SSRF gate, so an all-green checklist can't pass a rebind-vulnerable fetch.

### Added
- `templates/size-limit.json`: a concrete ~170 kB/route bundle budget config so the `governance`
  budget number is enforceable, not just documented; `ci.yml` size step points at it.

## [1.5.0] - 2026-06-15

### Added
- Instruction-design techniques adapted from the Claude Fable 5 system prompt (worked
  examples + Rationale, pre-response self-check lists, anti-confabulation):
  - `frontend-security`: a "Self-check before shipping boundary code" checklist turning the
    honor-system controls (zod-at-boundary, webhook signature, IDOR, SSRF, secrets/PII, XSS,
    cookies/CSRF, untrusted-as-data) into actionable yes/no gates.
  - `testing-vitest`: worked examples for the test-layer decision people get wrong most
    (spinner → story; pure logic → unit; hook timing → unit; prop matrix → unit + key stories).
  - `CLAUDE.md`: a "verify, don't assume" workflow rule — confirm a referenced file/dependency/
    export/flag exists and check the installed major version before relying on it.

## [1.4.0] - 2026-06-14

### Added
- Security depth (the reviewers' remaining "optional" gaps): SSRF DNS-rebinding/TOCTOU
  guidance + IPv6 deny ranges, a data-minimization/retention rule, and an authorization-model
  rule (RBAC vs ownership, deny-by-default, one policy helper) in `frontend-security`; CORS-no-
  credential-reflection and rate-limit-auth/LLM-endpoints added to the always-resident CLAUDE.md
  floor; a default initial-load bundle budget (~170 kB gzipped/route) in `governance`.

### Changed
- This repo's own `CODEOWNERS` now uses the real maintainer handle (`@Syo-M`) instead of
  `@your-org` placeholders, so the change-control control is operative (branch protection must
  still be enabled in repo settings).
- `SECURITY.md` now routes disclosure through GitHub private vulnerability reporting rather than
  a placeholder email.

## [1.3.1] - 2026-06-14

### Fixed
- Reconciled the now-real security-review gate across docs: added it as gate 8 in the `governance`
  CI list, and updated `tooling` so zod-at-boundary / IDOR / webhook-signature are described as
  "Semgrep-backstopped heuristic + review" rather than purely un-enforceable.
- `templates/.semgrep`: corrected the action org name (`returntocorp` → `semgrep`); renamed the
  webhook rule to `webhook-handler-missing-signature-verify` to match what it can actually detect
  (Semgrep can't model call order); widened the DOMPurify allowlist to wrapped/`isomorphic` sanitizers.
- `i18n`: the missing-key CI check now names a concrete tool and is framed as a wired gate, not an
  unenforced claim; added the reciprocal i18n cross-reference in `frontend-security` (parse-then-validate).

## [1.3.0] - 2026-06-14

### Added
- New `i18n` skill: message catalogs, ICU plurals/interpolation, `Intl` formatting, locale
  routing, RTL, and locale-aware input validation — the last major frontend domain the set
  was missing. Cross-referenced from `css-modules` (logical properties), `data-viz` (`Intl`),
  and `frontend-security` (parse-then-validate). Added to the CLAUDE.md skill index (now 18 skills).
- `templates/.semgrep/frontend-security.yml`: real Semgrep heuristics backing the
  `security-review` CI gate — public-env secret exposure, unsanitized `dangerouslySetInnerHTML`,
  insecure randomness for secrets, webhook body used before signature verify, and fetch-from-
  request-input (SSRF). Makes the honor-system controls machine-checkable, not just reviewed.

## [1.2.1] - 2026-06-14

### Fixed
- `templates/eslint.config.js` failed to load: it used `react/no-array-index-key` without registering
  `eslint-plugin-react`. Registered the plugin and added the two rules the `tooling` table already
  promised — `react/no-danger` and `react/forbid-dom-props` (no inline `style`) — so the starter
  enforces the CLAUDE.md non-negotiables it claims to. (Caught by the v1.2.0 re-score.)
- `templates/github/workflows/ci.yml`: the honor-system `security-review` gate was a commented-out
  stub; wired it to a real Semgrep job (OWASP/React/TS rulesets + a `.semgrep/` hook for
  zod-at-boundary / IDOR / webhook-signature patterns).

### Changed
- `react-patterns`: replaced the surviving "proven-hot paths" hedge with a decidable bar (Profiler
  shows a path exceeding ~16 ms / one frame on a 4–6× throttled CPU); React Compiler claim now hedged
  to "check the installed React version and whether it's enabled" rather than asserting GA outright.

## [1.2.0] - 2026-06-13

### Added
- Japanese trigger anchors (`日本語の依頼例`) to all 17 skill `description` fields, improving
  on-demand loading reliability for Japanese-language prompts without changing the English rule bodies.
- Prompt-injection / untrusted-content section in `frontend-security` (treat external content and
  model output as data, server-side tool authorization, LLM cost-DoS limits).
- Repository governance files: `CODEOWNERS` (privileged-rule review), `SECURITY.md` (disclosure +
  incident response), this `CHANGELOG.md`, and `templates/` starter configs (CI gates, gitleaks,
  ESLint/Stylelint) for consuming projects to copy.

### Changed
- CLAUDE.md "Non-negotiables" floor thickened: SSRF host allow-listing, upload/SVG handling,
  session-cookie flags, security headers, and untrusted-content-as-data now hold even if no skill loads.
- Decidable defaults replacing vague phrasing: single default chart library (Recharts → visx → D3 → uPlot
  escalation) in `data-viz`; prop-matrix unit-test threshold (~≥6 combinations) in `testing-vitest`;
  profile-driven memoization wording in `react-patterns`; 3-day dependency cooldown + break-glass in `governance`.

## [1.1.0] - 2026-06-13

### Added
- Five visual skills: `design-system`, `motion`, `images-media`, `data-viz`, `visual-regression`.

### Changed
- Bidirectional cross-references between new and existing skills (css-modules↔motion,
  storybook↔visual-regression, astro↔data-viz `client:only` exception, etc.).
- VRT added to the resident test-layer map; LCP-safe entrance-animation rule; Next.js `ssr:false`
  client-wrapper note; upload separate-origin clarification.

## [1.0.0] - 2026-06-13

### Added
- Initial release: lean always-resident `CLAUDE.md` + 12 skills (react-patterns, nextjs, vite-react,
  astro, css-modules, testing-vitest, storybook, testing-playwright, frontend-security, a11y,
  governance, tooling), revised after a three-perspective audit (technical accuracy, security/ASVS,
  consistency). English rule bodies, Japanese `README.md`.
