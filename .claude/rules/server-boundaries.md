---
paths:
  - "**/api/**"
  - "**/route.*"
  - "**/actions.*"
  - "**/actions/**"
  - "**/server/**"
  - "**/*.server.*"
  - "**/middleware.*"
  - "**/webhooks/**"
  - "**/auth/**"
  - "**/oauth/**"
  - "**/oauth2/**"
  - "**/sessions/**"
  - "**/login/**"
  - "**/payments/**"
  - "**/billing/**"
---

# Server-boundary tripwire

You are likely editing server-side boundary code (if this file is client-only — e.g. a client fetch wrapper — these rules apply to the endpoint it calls instead). Load the `frontend-security` skill now if it isn't loaded — this file is the tripwire, not the rulebook. The invariants that most often get skipped:

- Parse ALL external input (body, params, cookies, headers, third-party API responses) with a zod schema before use — `z.strictObject`, `.max(n)` on strings.
- Client-supplied IDs are claims, not facts: authorize per resource for *this* user, in the policy helper (IDOR).
- Cookie-authenticated state-changing **route handlers** need explicit CSRF protection (Next.js covers Server Actions only).
- Webhooks: verify the provider's HMAC signature (constant-time) before trusting the payload.
- Outbound fetch of a user-influenced URL: host allow-list + block private/link-local/metadata ranges (IPv4 and IPv6) + pinned resolved IP.
- No secret/PII/token in responses, logs, or error payloads.

Before finishing, run the `frontend-security` "Self-check before shipping boundary code" against what you touched.
