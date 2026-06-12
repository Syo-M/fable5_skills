---
name: frontend-security
description: Frontend security rules — XSS, injection, validation, CSRF, SSRF, CORS, secrets, sessions/JWT, rate limiting, headers, uploads, third-party scripts, dependency hygiene. Use whenever code touches user input, HTML rendering, auth, cookies, URLs, outbound fetch, webhooks, env vars, file uploads, logging, or new dependencies.
---

# Frontend Security

Order of defense: don't accept untrusted data → validate at the boundary → encode/sanitize at output → restrict with platform policy (CSP, cookies, headers). Apply all layers, not one. These rules are policy: changing or weakening them requires human security review (see `governance`).

## XSS

- Framework escaping is the default protection — keep it. `dangerouslySetInnerHTML` (React), `set:html` (Astro), `innerHTML`/`insertAdjacentHTML` (DOM) with anything non-static require sanitization with **DOMPurify** at output time, using one shared hardened config — not ad-hoc per-call options. SSR/build-time paths need `isomorphic-dompurify` (DOMPurify requires a DOM). No home-made regex sanitizers, ever.
- URLs are an injection vector: any `href`/`src` from user data → parse with `new URL`, allow only `http:`/`https:` protocols (blocks `javascript:` URLs that escaping does not stop).
- Never build HTML/CSS/JS by string concatenation with user data. No `eval`, `new Function`, string `setTimeout`.
- Don't render raw user input into `<script>` contexts, JSON-LD blocks, or inline event handlers.

## Validation — server-side, schema-first

- Every boundary parses input with zod before use: Server Actions, route handlers, URL/search params, cookies, third-party API responses, webhook payloads (after signature verification — see below).
- Client-side validation is UX only; the server must reject independently.
- Default to closed shapes: `z.strictObject({...})` (zod 4; `.strict()` is the legacy spelling) — unknown keys are **rejected**, blocking mass-assignment (`isAdmin: true` in a profile update). Plain `z.object()` silently strips unknown keys, which also prevents mass-assignment but hides client bugs. Document any exception.
- Bound every user-supplied string with `.max(n)` — unbounded input is a DoS/ReDoS vector.
- ReDoS: never execute user-controlled regex; cap input length before any regex; avoid nested quantifiers (`(a+)+`).
- Prototype pollution: never recursively merge user JSON into existing objects; reject `__proto__` / `constructor` / `prototype` keys; prefer `Map` or `Object.create(null)` for user-keyed lookups.
- IDs from the client are claims, not facts: after auth, check the resource belongs to / is permitted for this user (IDOR). Per-resource, in every action/handler — middleware route guards are not enough.

## Sessions, cookies, JWT

- Session cookies: `HttpOnly`, `Secure`, `SameSite=Lax` (or `Strict`), `__Host-` prefix where possible (enforces `Path=/`, no `Domain`). Never store session tokens in `localStorage`.
- Rotate the session ID on login and on privilege change (session fixation).
- JWT, if used: decode ≠ verify — always verify the signature with an `alg` allow-list (reject `none`); check `exp` / `aud` / `iss`; short-lived access tokens + rotated refresh tokens; no PII in claims that reach the client.
- Security-relevant randomness (tokens, nonces, IDs): `crypto.randomUUID()` / `crypto.getRandomValues()` — never `Math.random()`. No hand-rolled crypto; Web Crypto only.

## CSRF & redirects

- Framework protection covers less than you think: Next.js verifies Origin for **Server Actions only**. **Route handlers have no built-in CSRF protection** — every cookie-authenticated state-changing route handler needs explicit Origin/Referer validation or a CSRF token. `SameSite` is defense-in-depth, not sufficient alone (subdomains, legacy clients).
- Mutations are POST-family only; a state-changing GET is a bug regardless of other protections.
- Open redirects: never `redirect(userInput)` raw — allow-list relative paths or known origins. Same rule for OAuth `redirect_uri`; always validate the OAuth `state` parameter.

## Outbound requests — SSRF & webhooks

- Server code fetching a user-supplied or user-influenced URL: allow-list hosts; block private/link-local ranges and cloud metadata endpoints (`169.254.169.254`); re-validate after redirects. Constrain `next/image` `remotePatterns` tightly — the image optimizer is a classic SSRF proxy.
- Incoming webhooks: **verify the provider's HMAC signature (constant-time compare) before trusting the payload; reject when the signature header is missing.** Schema validation is not authentication.

## CORS

- Never reflect the request `Origin` while sending `Access-Control-Allow-Credentials: true`; never `*` on authenticated endpoints. Maintain an explicit origin allow-list. "Fixing a CORS error" by widening headers is usually creating a vulnerability — find the legitimate origin instead.

## Rate limiting & auth failures

- Throttle login, signup, password reset, and expensive mutations — per IP and per account.
- Uniform error messages and response timing on login/reset: do not reveal whether an account exists.

## Secrets, env, logging

- Secrets never appear in: client bundles (`NEXT_PUBLIC_`/`VITE_`/`PUBLIC_` vars are public by definition), repo files, logs, client-bound error messages, or URL query strings (query strings leak via logs and referrers).
- `.env*` in `.gitignore`; commit `.env.example` with placeholders. A secret ever committed = rotate it; deleting the file does not unpublish it. Secrets scanning in CI is mandatory (see `governance`).
- No PII, credentials, or tokens in server logs, analytics events, or error-tracker payloads — configure scrubbing (e.g. Sentry `beforeSend`). Server errors: log details server-side, return a generic message + correlation ID. Stack traces and DB errors never cross the wire.

## Headers & platform policy

Set and keep (next.config / astro config / hosting headers):

- `Content-Security-Policy`: nonce/hash-based scripts where the framework supports it; at minimum `object-src 'none'`, `base-uri 'self'`, `form-action 'self'`, no `unsafe-eval`, and `frame-ancestors 'none'` (or explicit allow-list) + `X-Frame-Options: DENY` fallback. Roll out via `Content-Security-Policy-Report-Only` first, with reports routed somewhere monitored.
- `Strict-Transport-Security` with a long max-age (understand the commitment before adding `preload`).
- `Cache-Control: no-store` on authenticated/personalized responses — caching a per-user response is a data leak, not a perf win.
- `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Cross-Origin-Opener-Policy: same-origin`, `Permissions-Policy` denying unused features.

## Third-party scripts & embeds

- Third-party scripts require approval (see `governance`), exact version pinning, and `integrity` (SRI) when loaded from a CDN; prefer self-hosting. Tag managers that load arbitrary scripts defeat CSP — avoid, or strictly govern what they may inject.
- iframes/embeds: explicit `sandbox` attribute; `postMessage` handlers must check `event.origin` against an allow-list.

## Dependencies

- Before adding: maintenance, downloads, install scripts (`postinstall`), transitive weight, license (see `governance`), and the EXACT package name (typosquatting).
- Dependency confusion: publish private packages under the org scope (`@company/`); pin scope→registry mapping in `.npmrc`; assert registry URLs with `lockfile-lint` in CI.
- Prefer a release cooldown: avoid versions published within the last few days (compromise/worm window). Pin CI actions by commit SHA, not tag.
- Lockfile always committed; CI installs frozen (`npm ci` / `pnpm install --frozen-lockfile` per the repo's package manager), with `--ignore-scripts` where the build allows.
- Audit on every dependency change AND on a weekly schedule; high + critical findings block.

## Uploads & user files

- Validate type by content (magic bytes), not extension; cap size; store outside the web root / in object storage.
- SVG passes image checks but executes scripts: deny or sanitize SVG. Serve user uploads from a separate origin — re-encoding raster images through the framework's image optimizer satisfies this intent; anything served as-is (HTML, SVG, PDF, downloads) must use the separate origin. `Content-Disposition: attachment` for non-image types; correct `Content-Type` + `nosniff`.
- Authorize every download per-request — non-guessable names are defense-in-depth, never the access control. Intentionally-public assets (e.g. avatars) may skip per-request auth as an explicit, documented decision — not a default.
- Never trust client-supplied paths/filenames: path traversal, zip-slip when extracting archives.
