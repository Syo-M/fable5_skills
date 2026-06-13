# Security Policy

This repository contains **AI coding rules** (a CLAUDE.md and skills) that govern how an
AI agent writes frontend code. The rules themselves are a security control surface: a
weakened or malicious rule propagates to all AI-generated code in every consuming project.
This policy covers both (a) the rules repo and (b) the security posture the rules mandate.

## Supported versions

The latest tagged release is supported. Consuming projects must pin a tagged version
(git submodule / package / template copy) rather than tracking `main` — see `README.md`
and the `governance` skill.

## Reporting a vulnerability

Report suspected vulnerabilities — in these rules, or a class of insecure code the rules
fail to prevent — privately to **security@your-org.example** (replace with your channel).
Do not open a public issue for an unfixed vulnerability.

- Acknowledgement target: 2 business days.
- Triage & severity (CVSS-style) target: 5 business days.
- Include: affected file/skill, the insecure pattern it permits or produces, and a
  minimal example.

## Change control for the rules

- `CLAUDE.md` and `.claude/**` require CODEOWNERS review (security + platform). See `CODEOWNERS`.
- Security and accessibility rules are exempt from the "prune rules that are followed"
  maintenance policy — a control that is working is not redundant.
- Sensitive paths an AI agent must not modify without human sign-off are listed in the
  `governance` skill (CI workflows, auth/payment, security headers/CSP, `.claude/**`,
  lockfile-only changes, release/deploy config).

## Incident response (secrets / supply chain)

1. **Leaked secret** → rotate immediately (rotation is the fix; history rewrite is cleanup),
   record the incident, notify the named approver/owner.
2. **Compromised dependency** → pin to a known-good version, run the dependency audit gate,
   open an incident; the cooldown break-glass (see `governance`) applies for the fix.
3. A named approver and an audit record (PR + incident log) are required for any
   sensitive-path override or cooldown bypass.

## The security floor

If no skill loads, the always-resident `CLAUDE.md` "Non-negotiables" are the guaranteed
minimum (validation at the boundary, no secrets/PII in logs, CSRF on route handlers, SSRF
host allow-listing, upload/SVG handling, session-cookie flags, security headers, untrusted
content treated as data). The full ruleset lives in `.claude/skills/frontend-security`.
