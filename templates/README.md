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
| `.size-limit.json` | `.size-limit.json` | Bundle-budget config (~170 kB/route); needs a preset + `size` script (see below) |

**Copy it as a dotfile.** `size-limit` auto-discovers `.size-limit.json` (leading dot); a
plain `size-limit.json` is silently ignored — you'd get a passing run that measures nothing.

`size-limit` does nothing on its own — install a preset so it knows how to measure. The shipped
config is **file-preset shaped** (`path` + `gzip`), so the lightweight match is:
`npm i -D size-limit @size-limit/file`, add `"size": "size-limit"` to `package.json` scripts.
Then **set `path` to your framework's build output** — the shipped default is Next.js:

| Framework | `path` |
|---|---|
| Next.js | `.next/static/chunks/*.js` (shipped default) |
| Vite | `dist/assets/*.js` |
| Astro | `dist/_astro/*.js` |

Only reach for `@size-limit/preset-app` if you want real-browser (Time-to-Interactive) numbers:
it loads the page in headless Chrome, so it pulls a `puppeteer-core` tree (~40–60 packages) and
needs Chrome in CI — run it past the `dependency-vetter` first. With `preset-app` the `gzip`
field is redundant (it already reports gzip/brotli) and `path` points at a URL/entry, not files.

After copying, replace placeholder org/team handles, pin tool versions, and verify each gate
actually runs against your stack. The configs encode policy from the skills — when a skill
changes, update the matching config (or vice versa) and note it in `CHANGELOG.md`.

Detection of the honor-system rules (zod-at-boundary, IDOR, webhook signature verification)
that lint cannot catch: wire the `/security-review` gate in CI and/or a semgrep ruleset — see
`ci.yml` for the placeholder job.
