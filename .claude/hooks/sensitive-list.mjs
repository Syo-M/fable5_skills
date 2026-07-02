/**
 * THE canonical sensitive-path list (single source of truth).
 * Consumed by: sensitive-paths.mjs (Edit/Write hook), sensitive-bash.mjs
 * (Bash heuristic hook), and scripts/check-sync.mjs (drift test in CI).
 * Keep CLAUDE.md (Workflow), the governance skill, and
 * .claude/rules/sensitive-config.md in sync — check-sync.mjs enforces the
 * rule-glob side.
 */
export const SENSITIVE = [
  // CI/CD and deploy configuration
  /(^|\/)\.github\//,
  /(^|\/)(vercel\.json|netlify\.toml)$/,
  // Framework config and middleware (carry security headers / CSP)
  /(^|\/)(next|astro|vite)\.config\.[^/]+$/,
  /(^|\/)middleware\.[^/]+$/,
  // Privileged agent instructions
  /(^|\/)\.claude\//,
  /(^|\/)CLAUDE\.md$/,
  // Auth / session / payment code
  /(^|\/)(auth|oauth|sessions?|login|payments?|billing)(\/|\.)/i,
  // Lockfiles (lockfile-only changes are a supply-chain red flag)
  /(^|\/)(package-lock\.json|pnpm-lock\.yaml|bun\.lock|bun\.lockb|yarn\.lock)$/,
];

export const REASON_SUFFIX =
  `(CI/deploy config, framework config/middleware with security headers, ` +
  `auth/session/payment code, lockfiles, or .claude/** privileged instructions). ` +
  `Approve only if you reviewed this specific diff — see CLAUDE.md "Workflow" and the governance skill.`;
