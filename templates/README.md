# templates/ — starter configs for consuming projects

These are **starter files to copy into a project** that adopts these rules. They are kept
here (not in this repo's own `.github/`) so they don't execute against the rules repo itself.
They make the `governance` and `tooling` skills *executable* rather than merely described —
the gap the rules' own evaluation flagged as the weakest point.

Copy and adapt:

| File | Copy to | Purpose |
|---|---|---|
| `github/workflows/ci.yml` | `.github/workflows/ci.yml` | Merge-blocking CI gates from the `governance` skill |
| `gitleaks.toml` | `.gitleaks.toml` | Secrets-scan config (run in pre-commit + CI) |
| `eslint.config.js` | `eslint.config.js` | Flat-config starter mapping the `tooling` skill rules |
| `stylelint.config.mjs` | `stylelint.config.mjs` | Token-enforcement starter for CSS Modules |
| `.semgrep/frontend-security.yml` | `.semgrep/frontend-security.yml` | Heuristic detectors (webhook-missing-verify, SSRF, secret exposure, unsanitized HTML) |
| `size-limit.json` | `size-limit.json` | Bundle-budget config (~170 kB/route); add a `size` script and wire into CI |

After copying, replace placeholder org/team handles, pin tool versions, and verify each gate
actually runs against your stack. The configs encode policy from the skills — when a skill
changes, update the matching config (or vice versa) and note it in `CHANGELOG.md`.

Detection of the honor-system rules (zod-at-boundary, IDOR, webhook signature verification)
that lint cannot catch: wire the `/security-review` gate in CI and/or a semgrep ruleset — see
`ci.yml` for the placeholder job.
