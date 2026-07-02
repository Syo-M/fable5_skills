---
paths:
  - ".github/**"
  - "**/next.config.*"
  - "**/astro.config.*"
  - "**/vite.config.*"
  - "**/middleware.*"
  - "**/vercel.json"
  - "**/netlify.toml"
  - ".claude/**"
  - "CLAUDE.md"
  - "**/package-lock.json"
  - "**/pnpm-lock.yaml"
  - "**/bun.lock"
  - "**/bun.lockb"
  - "**/yarn.lock"
---

<!-- Keep these globs in sync with the CANONICAL list: the SENSITIVE regexes in
     .claude/hooks/sensitive-paths.mjs (which also covers auth/session/payment code). -->

# Sensitive-path tripwire

This file is on the human-sign-off list (CI workflows, framework/deploy config carrying security headers/CSP, `.claude/**` privileged instructions, lockfiles). The shipped PreToolUse hook will surface an explicit permission prompt — that prompt is the sign-off, not a formality to click through.

- Propose the diff and the reason; wait for approval before writing.
- Never weaken or remove security headers/CSP to "fix" an error — find the legitimate origin/nonce instead (`frontend-security`).
- Lockfile-only changes are a red flag: explain why the lockfile moved with no manifest change.
- Edits to `.claude/**` or `CLAUDE.md` change every agent's behavior — treat as policy changes (`governance`), record in `CHANGELOG.md`.
