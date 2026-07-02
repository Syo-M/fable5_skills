---
paths:
  - "**/*Form.*"
  - "**/*Form/**"
  - "**/*-form.*"
  - "**/*-form/**"
  - "**/forms/**"
---
<!-- Hyphenated globs cover kebab-case (contact-form.tsx) without catching transform.* -->


# Form tripwire

You are editing a form component — the single most common place user input enters the system.
Load `frontend-security` now (validation section) if it isn't loaded. Non-negotiable here:

- Client-side validation is UX only; the server rejects independently with a zod schema at the
  boundary (`z.strictObject`, `.max(n)` on every string).
- The submit target (Server Action / route handler) is boundary code — the `server-boundaries`
  rule and its checklist apply there.
- Every input has a programmatic label; errors are associated (`aria-describedby`) and announced,
  not just painted red (see `a11y`).
- Prefer uncontrolled inputs + form submission for plain forms (`react-patterns`).
