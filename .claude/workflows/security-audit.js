// Multi-agent security audit for Workflow-enabled harnesses (e.g. Claude Code
// desktop app). In plain CLI environments this file is inert — use the
// `security-reviewer` agent or `/pre-ship` instead, which cover the same policy
// single-threaded. Invoke with optional args: { scope: "git ref range or paths" }.
export const meta = {
  name: 'security-audit',
  description:
    'Fan-out security audit: map the boundaries in the change set, review each security dimension in parallel, adversarially verify every finding',
  whenToUse:
    'Before a release, after large boundary changes, or when the user asks for a thorough security audit (「徹底的にセキュリティ監査して」).',
  phases: [
    { title: 'Map', detail: 'inventory boundaries in the change set' },
    { title: 'Review', detail: 'one reviewer per security dimension' },
    { title: 'Verify', detail: 'adversarial verification of each finding' },
  ],
}

const scope = (args && args.scope) || 'the full working tree diff against the default branch'

const FINDINGS_SCHEMA = {
  type: 'object',
  required: ['findings'],
  properties: {
    findings: {
      type: 'array',
      items: {
        type: 'object',
        required: ['file', 'line', 'summary', 'attack', 'severity'],
        properties: {
          file: { type: 'string' },
          line: { type: 'integer' },
          summary: { type: 'string', description: 'the defect in one sentence' },
          attack: { type: 'string', description: 'concrete inputs → wrong outcome' },
          severity: { type: 'string', enum: ['critical', 'high', 'medium', 'low'] },
          rule: { type: 'string', description: 'the frontend-security rule violated' },
        },
      },
    },
  },
}

const VERDICT_SCHEMA = {
  type: 'object',
  required: ['refuted', 'reason'],
  properties: {
    refuted: { type: 'boolean' },
    reason: { type: 'string' },
  },
}

// Dimensions mirror the frontend-security skill sections.
const DIMENSIONS = [
  { key: 'validation-authz', focus: 'boundary validation (zod, strictObject, bounds), IDOR, authorization model, mass assignment, prototype pollution' },
  { key: 'xss-injection', focus: 'XSS, dangerouslySetInnerHTML/set:html/innerHTML, URL injection (javascript:), sanitization, CSP interplay' },
  { key: 'csrf-session', focus: 'CSRF on cookie-authenticated route handlers, session cookie flags, JWT verification, open redirects, OAuth state' },
  { key: 'ssrf-webhooks', focus: 'SSRF (allow-list, private/link-local/metadata IPv4+IPv6, DNS rebinding), webhook HMAC verification, CORS' },
  { key: 'secrets-logging', focus: 'secrets in bundles/logs/URLs, public env prefixes, PII in logs/analytics/error trackers, rate limiting' },
  { key: 'uploads-deps-llm', focus: 'file upload validation, SVG, separate origin, path traversal, dependency hygiene, prompt injection / LLM-bound content' },
]

phase('Map')
const map = await agent(
  `Inventory the security-relevant surface of: ${scope}. List every changed file that touches a boundary ` +
    `(external input, HTML output, outbound fetch, cookies/session/auth, webhook, upload, env vars, LLM-bound content), ` +
    `with one line on what it does. Read the .claude/skills/frontend-security/SKILL.md first if present. ` +
    `Return a compact plain-text inventory; if NOTHING touches a boundary, return exactly "NO-BOUNDARIES".`,
  { label: 'map:boundaries', phase: 'Map' },
)

if (!map || map.includes('NO-BOUNDARIES')) {
  return { verdict: 'NO BOUNDARY CODE IN SCOPE', confirmed: [] }
}

const results = await pipeline(
  DIMENSIONS,
  (d) =>
    agent(
      `You are an adversarial security reviewer. Scope:\n${map}\n\n` +
        `Review ONLY this dimension: ${d.focus}. Follow the frontend-security skill ` +
        `(.claude/skills/frontend-security/SKILL.md). Trace real code paths — report only defects you verified ` +
        `against the code, each with a concrete attack scenario. No speculative advice.`,
      { label: `review:${d.key}`, phase: 'Review', schema: FINDINGS_SCHEMA },
    ),
  (review, d) =>
    parallel(
      (review?.findings ?? []).map((f) => () =>
        agent(
          `Adversarially try to REFUTE this security finding. Read the actual code. ` +
            `Refuted = the attack does not work as described (unreachable, already validated upstream, wrong file/line). ` +
            `Default to refuted=true if you cannot reproduce the reasoning.\n` +
            `Finding [${d.key}] ${f.file}:${f.line} — ${f.summary}\nClaimed attack: ${f.attack}`,
          { label: `verify:${f.file}`, phase: 'Verify', schema: VERDICT_SCHEMA },
        ).then((v) => ({ ...f, dimension: d.key, verified: v && !v.refuted, verifierNote: v?.reason })),
      ),
    ),
)

const all = results.filter(Boolean).flat().filter(Boolean)
const confirmed = all.filter((f) => f.verified)
const refuted = all.length - confirmed.length
log(`${confirmed.length} confirmed finding(s), ${refuted} refuted`)

const order = { critical: 0, high: 1, medium: 2, low: 3 }
confirmed.sort((a, b) => (order[a.severity] ?? 9) - (order[b.severity] ?? 9))

return {
  verdict: confirmed.some((f) => f.severity === 'critical' || f.severity === 'high')
    ? 'DO NOT SHIP'
    : confirmed.length
      ? 'SHIP WITH FIXES'
      : 'SHIP',
  confirmed,
}
