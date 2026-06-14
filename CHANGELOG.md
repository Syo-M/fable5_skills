# Changelog

All notable changes to this rules repository are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/); this repo is versioned so
consuming projects can pin a tag and audits can tell which rules governed which commits.

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
