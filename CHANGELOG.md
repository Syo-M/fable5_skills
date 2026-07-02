# Changelog

All notable changes to this rules repository are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/) in reverse-chronological order; this
repo is versioned so consuming projects can pin a tag and audits can tell which rules governed which commits.

## [3.0.2] - 2026-07-02

Adopts the valid findings from the third external review (ChatGPT, v3.0.1 → **94/100**, up from
92; all prior findings confirmed resolved). Includes a real security fix in code this repo
shipped in v3.0.1.

### Fixed (security)
- **Path traversal in `reviewer-write-guard.mjs`** (introduced v3.0.1): the memory-dir allow-check
  matched the path STRING, so `.claude/agent-memory-local/x/../../../README.md` resolved outside
  the memory dir but passed. Now normalized with `path.resolve`/`relative`; traversal and
  prefix-lookalike (`agent-memory-localEVIL`) cases added. Reproduced before fixing.

### Changed
- **Reviewer Bash is now an ALLOWLIST, not a denylist** (deny-by-default is correct for a
  read-only reviewer): only git diff/show/status, grep/rg, semgrep, gitleaks, npm view, test
  runners, and read filters pass; `node -e`/`npx`/`perl`/`tar -x`/`npm run`/redirects/etc are
  denied. Honestly scoped: Edit/Write/NotebookEdit are a hard technical block; Bash is a
  strengthened best-effort (compound/`$()`/awk-internal writes remain residual). Guard test
  suite 14 → 32 cases.
- Version stamp gains **`state: stale`** + `leftover: N`: styling files left behind from a
  previous profile (e.g. css-modules skill after switching to tailwind) are detected and warned,
  since two styling rulebooks firing at once is worse than a local edit.
- `build-plugin.mjs` now **strips agent-frontmatter `hooks:`** from generated plugin agents
  (plugin subagents ignore them) and inserts a note that the plugin's reviewer contract is
  instruction-level only — no more "configured but silently inert".
- `merge-settings.mjs` dedup key is structured `JSON.stringify([matcher, type, command])`
  (also repaired a stray NUL byte introduced by an earlier edit).
- CI: `check-crossrefs.mjs` now also asserts every `.claude/hooks/*.mjs` is documented in the
  README tree AND that the CHANGELOG top is not behind the latest git tag.

### Fixed (docs/accuracy)
- **Min-version corrected**: agent-frontmatter hooks are documented since **2.1.0** (not 2.1.145 —
  that earlier claim was wrong); a known early bug (anthropics/claude-code#18392) meant subagent
  hooks didn't fire, so docs now say "spec 2.1.0; verify on a recent 2.1.x". Both the prior
  self-verification AND the external reviewer were partly wrong; re-checked against the changelog.
- security-reviewer/a11y-auditor/dependency-vetter bodies rewritten: "instruction, not a tool
  restriction" → the accurate split (tool-blocked on supported installs; instruction-level on
  older CLIs / plugin loads; Bash is best-effort).
- README: test-case total 59 → 91 (three hook suites), reviewer-write-guard added to the tree,
  external score 89 → 94, an "evaluated environments" compatibility matrix, CI + MIT badges.

### Note (owner action)
- v3.0.1 tag IS on the remote (verified); a GitHub *Release* object and further supply-chain
  pinning of CI-template tools (license-checker version, Semgrep image digest) remain owner-side.

## [3.0.1] - 2026-07-02

Adopts the valid findings from the second external review (ChatGPT, v3.0.0 → **92/100**, up from
89; all ten prior P0s confirmed resolved by the reviewer). Self-vs-external gap narrowed from
2.2 to 0.6 points.

### Added
- **Tool-level read-only enforcement for reviewer agents** (the request three review rounds old,
  now spec-verified as possible): agent-frontmatter `hooks:` wire `reviewer-write-guard.mjs`
  (14-case test suite) into security-reviewer / a11y-auditor / dependency-vetter — repo
  Edit/Write and write-like Bash are DENIED; only agent-memory writes pass. Honestly scoped:
  requires CLI >= 2.1.145 (verified against docs); older CLIs and plugin-loaded agents ignore
  agent hooks and fall back to the instruction-level contract (documented in README + plugin).
- Version stamp now records **sync state** (`state: synchronized|customized|partial` +
  identical/differing/missing counts) — a v3.0.0 stamp no longer implies full sync when files
  were skipped (external review's audit-integrity catch).
- installer surfaces the profile's template exclusions ("do NOT copy stylelint.config.mjs for
  the tailwind profile") — the previously-dead `excludes.templates` key is now consumed.

### Fixed
- Stale doc numbers/sentences the reviewer caught: README 構成節 85% → 88.5% (+ tailwind 12/12,
  minimal 3/3); "next formal scoring at v3.0.0" (already executed) rephrased in README and
  EVALUATION; README tree's new-component line neutralized (「有効なスタイリング方式」).
- `merge-settings.mjs` dedup key is now matcher+command (was command-only): a target's same
  command under a NARROWER matcher no longer blocks our broader wiring. Collision case added to
  the CI installer smoke.
- EVALUATION.md calibration honestly restated: 90 = adoptable within the declared stack once
  org-specific wiring (CODEOWNERS teams, branch protection, CI template adaptation) is connected —
  not "no-edits for any company".

## [3.0.0] - 2026-07-02

**Styling is now an install-time PROFILE** — the decisive-rules principle is preserved (the
installed AI always sees exactly one ruleset; humans choose at install time), while the biggest
adoption blocker (CSS Modules mandate) becomes a choice. Single main branch, no fork.
Semantically a true MAJOR: the root CLAUDE.md is now a generated artifact, the installer is
profile-parameterized, and the installed skill set varies by profile.

**Final 3-persona scores: Engineer 91.1 / Security 91.2 / LLM 91.9 — average 91.4** (all three
approved the MAJOR; their pre-tag conditions are all addressed in this release). Details, gate
reports, and self-assessment limitations: `EVALUATION.md`.

### Added
- `profiles/` — `css-modules` (default; the repo root IS this profile), `tailwind` (NEW skill:
  Tailwind v4 CSS-first `@theme` tokens, no dynamic class concatenation, aria/data-variant
  styling, prettier-plugin ordering; npm versions verified), `minimal` (floor only, for teams
  with their own styling stack).
- `core/CLAUDE.base.md` + `scripts/build-claude-md.mjs` — root CLAUDE.md is GENERATED
  (byte-identical for the default profile; in-file "generated, do not edit" marker; new CI
  freshness gate `build-claude-md --check`).
- installer `--styling <profile>`: swaps the styling skill/rule/CLAUDE.md section via declarative
  profile.json excludes/adds; profile-aware `--check`; profile stamped in `fable-skills-version`.
  Documented: switching profiles later leaves the old skill behind — remove it manually
  (`--uninstall` backlogged).
- CI: installer smoke test (3 profiles × install + @import append + idempotency) — the mechanism
  that loads the security floor on existing projects can no longer regress silently.
- eval: `styling_profile` prompt field, `--styling` flag, `fixtures-tailwind` overlay, and
  measured gates for ALL THREE profiles:
  - default: 24/29 full-pass, **77/87 = 88.5%**/run (vs 23/29 · 85% at v2.0.0). Both directions
    disclosed: improved — security-form-jp 0/3→1/3, chart-en 0/3→1/3 (first 3-turn activations,
    attributable to cross-pointers); regressed — security-review-jp 3/3→2/3,
    tests-component-jp 2/3→1/3 (n=3 noise, disclosed regardless).
  - tailwind: 4/4 at 3/3 (12/12) — the new skill fires on Japanese prompts first-time,
    the profile-swapped rule loads, the neutralized pipeline resolves it correctly.
  - minimal: 1/1 at 3/3 — component work proceeds with no styling rulebook and no leakage.
- Measured finding (honestly narrowed claim): `rule:forms` has zero observed firings — path rules
  inject on READ, so the tripwire covers edits of existing form files, not first creation; the
  ContactForm-creation prompt still loaded `frontend-security` 3/3 via load-first + cross-pointer.

### Changed
- `new-component` / `react-patterns` / `design-system` neutralized to "the active styling skill",
  with an explicit minimal-profile fallback (follow the Stack styling line).
- `templates/github/workflows/ci.yml`: all actions now SHA-pinned (checkout v6.0.3 peeled commit,
  setup-node v6.4.0, gitleaks-action v2.3.9) — the template now practices the governance it
  preaches.
- Grader-condition fixes: eval report scope line computed from in-scope count (was unfiltered
  total); provenance notes made symmetric; EVALUATION.md carries v3.0.0 results with v2.0.0 kept
  as reference.

## [2.1.0] - 2026-07-02

Adopts the valid findings from an independent external review (ChatGPT, 89/100). Each claim was
re-verified against current official docs before acting ("verify, don't assume" — all three
disputed facts turned out to be spec changes the docs made since our last check).

### Added
- **`LICENSE` (MIT)** — the repo demanded license policy of its dependencies while shipping none
  itself. Propagated to the plugin manifest and marketplace entry; `governance` notes the
  self-application.
- installer: **`--dry-run`** (full plan, zero writes), **`--check`** (installed version stamp +
  identical/differing/missing file counts), **`--no-import`** flags; unknown-flag rejection kept.
- installer: with an existing `CLAUDE.md`, now **appends the official `@CLAUDE.md.fable-skills`
  import** (idempotent, commented) so the resident core — including the security floor —
  actually loads. Previously the sidecar sat inert unless manually merged: the external review's
  most important catch. `--no-import` prints a strong warning instead.
- `EVALUATION.md` — self-assessment honesty: methodology, rubric, raw-report index, explicit
  "these scores are self-evaluation" limitation, the external 89/100 as a bias yardstick, and
  reproduction steps. README's scoring section compressed to a summary linking it.
- CI: `check-crossrefs.mjs` now verifies the README structure tree lists every shipped skill,
  rule, and agent (the forms.md-omission class is now machine-caught).

### Fixed (spec drift — verified against docs current as of 2026-06-30)
- **Agent memory**: `memory: project` now means repo-tracked `.claude/agent-memory/` (git-shareable);
  the machine-local semantics this repo intended is `memory: local`. All four agents switched to
  `memory: local` (also avoids the sign-off hook prompting on every memory write);
  `.claude/agent-memory-local/` gitignored here and by the installer; README corrected.
- **Skill precedence**: current order is Enterprise > Personal > Project — README claimed project
  wins. Corrected with guidance (don't shadow project skills from `~/.claude/skills/`).
- `CLAUDE.md` package-manager detection now includes `yarn.lock` and `bun.lockb` (the hooks
  already covered both — internal consistency).
- `nextjs` skill: "No `<a>`" softened to the correct rule — `<Link>` for internal routes; plain
  `<a>` is right for external links, downloads, and hash anchors.
- README: settings.json install-vs-manual contradiction resolved; `forms.md` added to the tree;
  「確実に発動」 replaced with the measured claim (85% within 3 turns; all 29 within 6);
  an honest 対象/対象外 paragraph added up front (opinionated standard set, profiles planned in v3.0).
- verify.yml: actions bumped to Node 24 runtimes — checkout v6.0.3 (pinned to the PEELED commit
  of the annotated tag) and setup-node v6.4.0; resolves the runner's Node 20 deprecation warnings.

### Deferred to backlog (recorded in eval/README.md)
- Plugin runtime smoke test; installer `--uninstall`; Next/Astro eval fixtures (pre-existing).
- Repo About/topics on GitHub are an owner-side setting (suggested topics listed in the release notes).

## [2.0.0] - 2026-07-02

**Measured-milestone MAJOR — no breaking changes.** Cut only after satisfying MAINTENANCE.md's
own pre-MAJOR gates: the `--runs 3` release-grade trigger evaluation (87/87 valid runs) and the
3-persona formal scoring. Final measured scores: **Engineer 90.4 / Security 91.5 / LLM 91.3 —
average 91.1** (each grader re-verified the deltas by execution before re-rating; details in
README「品質評価」).

### Added
- **Horizon experiment** (`eval/reports/v2.0.0-horizon-experiment.md`): the falsification test
  the v1.9.x reports pre-registered. All three former 0/3 "structural" trigger gaps are **3/3 at
  `--max-turns 6`** (`security-form-jp`→frontend-security, `chart-en`→data-viz,
  `react-state-jp`→react-patterns, loading at turns 4–6): they were measurement-horizon
  artifacts, not missing triggers — every golden prompt has demonstrated activation. The
  conservative 3-turn numbers (23/29 full-pass, 85%/run) remain the headline. Attribution
  verified clean: the new forms rule fired in zero unions, so the flips are the horizon, not
  the new rule.
- `.claude/rules/forms.md` — deterministic path tripwire on form components (`*Form.*`,
  `*-form.*`, `forms/`; hyphen globs avoid `transform.*`): mandates `frontend-security` +
  zod-at-boundary + a11y error association at the exact moment user-input code is written,
  independent of turn horizon.
- Three over-trigger negative prompts (forbid_all) in the golden set — all 3/3 clean: the
  load-first directive has NO measured over-loading cost on non-code asks.
- Eval harness rigor: start-of-series canary, per-run validity guard (non-zero exit / missing
  result JSON → excluded as NO-DATA, never scored), 3-consecutive-invalid abort, scope stamping
  (full vs `--only` subset), `git describe --dirty` provenance, forbid_all rendering in reports.

### Fixed (from the final scoring round, verified by the graders)
- Bash hook: download-write verbs (`curl -o`/`--output` incl. bundled short flags `-sSLo`,
  `wget -O`/`--output-document` incl. the `=` form, `rsync`) now escalate; tokenizer strips
  `--flag=` prefixes so `=`-joined paths are inspected. Canonical list gains
  `signup`/`sign-up`/`jwt`/`credentials` (with a documented `token` exclusion — design-tokens
  collision). Hook suites now 30 + 29 = 59 cases.
- Eval reporting precision: subset/full scope stamped; the untraceable "chart-jp 0/3" denominator
  corrected; agent claim restated as "the 5 agent-only prompts"; like-for-like baseline basis
  (20/26 = 77%) stated beside the 46% comparison; "signups" removed from the data-viz
  description (teach-to-the-test); stale hook-test counts in README corrected.

## [1.9.1] - 2026-07-02

Convergent fixes from the formal 3-persona scoring of v1.9.0 (Engineer 88.1 / Security 89.4 /
LLM 89.3, avg 88.9 — recorded in README「品質評価」). All three graders independently ruled
AGAINST cutting 2.0.0 now: MAINTENANCE.md's own `--runs 3` pre-MAJOR gate is unexecuted and the
additions are semantically MINOR. 2.0.0 is deferred until that protocol is satisfied.

### Fixed
- **Security (live dual-layer bypass)**: `oauth2/`, `authentication.ts`, `auth-service/`,
  `sign-in.tsx` slipped the sensitive-path regex AND the server-boundaries rule globs. Regex
  rebuilt with an explicit suffix set (still excludes `author`), rule gains
  `**/oauth/**`/`**/oauth2/**`/`**/sessions/**`/`**/login/**`, fixtures added to both test
  suites and `check-sync.mjs` (now 25+24 hook cases, 24 must-ask fixtures).
- `sensitive-bash.mjs`: `dd of=…` added to write indicators (was a plain-write omission, not
  obfuscation).
- **Eval reporting rigor** (the LLM grader's recurrence of the overclaim class): summary now
  states 16/20 post-fix-measured vs 22/26 incl.-baseline precisely, discloses the three
  valid-region PASS→FAIL reversals, and the 1.9.0 CHANGELOG wording is corrected; provenance
  notes added to the two reports whose in-file headers stamped the pre-tag version.
- `run-eval.mjs`: run-validity guard — a CLI invocation that exits non-zero or returns no result
  JSON is excluded (NO-DATA) instead of scoring as forbid-PASS/positive-FAIL (the coded version
  of the run-3 lesson); reports now stamp "rules under test: <describe> (working tree)".
- `eval/README.md`: corrected the hook-wiring description (PermissionDenied/PostToolUseFailure
  are deliberately NOT wired — the 2.1.87 gotcha), added the headless-credentials security note,
  and a Backlog section so known trigger gaps have a home.
- `install.sh`: proper flag parsing — `--force` works in any position; unknown flags error
  instead of silently degrading to skip-mode.
- `frontend-security` description: anchors for the persistently-missing form prompt
  (「問い合わせ/お問い合わせフォーム」「送信フォーム」).
- README: stale 「約60行」 claim (CLAUDE.md is 74 lines) → 「1画面程度(80行未満)」.

### Changed
- `verify.yml`: action pin comments now name exact versions (v4.3.1 / v4.4.0 — verified current;
  a grader's "stale pin" claim was itself checked and found wrong); `pyyaml` pinned to 6.0.3.

## [1.9.0] - 2026-07-02

### Added
- `eval/` — golden-prompt trigger evaluation harness: 26 JP/EN prompts with expected
  skill/agent/rule activations, run headless (`claude -p`) in a disposable fixture project
  installed via `install.sh`; activations OBSERVED by hooks (PreToolUse/PostToolUse
  Skill|Task|Agent, SubagentStart, InstructionsLoaded) — the model cannot self-report.
  Scoring supports all/any/either groups and negative expectations (`forbid_skills`:
  `nextjs` must not fire in a Vite fixture). Reports committed under `eval/reports/`.
- First measured trigger-reliability results (consolidated in `eval/reports/v1.9.0-summary.md`):
  baseline 12/26 → root cause identified (model skips loading rulebook skills for directly-doable
  work; anchors were NOT the problem) → fix → 9/14 prior failures flipped; 22/26 prompts have
  observed activation across all valid measurements incl. the baseline (16/20 of the post-fix-
  measured prompts — wording corrected in 1.9.1); 4 persistent stochastic misses documented.
  Layer reliability: agents > path rules > procedure skills > domain-rulebook skills.

### Changed
- `CLAUDE.md`: added the load-first directive ("Loading skills is not optional — find the matching
  row and LOAD that skill before writing code") — the measured fix for the dominant failure mode.
- `MAINTENANCE.md` release checklist: trigger evaluation added (`--runs 3` before a MAJOR release).
- README: hooks caveats gain the verified 2.1.87 gotcha — ONE unknown hook event name in
  settings.json silently disables ALL hooks in that file; fire-test after wiring hooks.

## [1.8.0] - 2026-07-02

### Added
- `install.sh` + `scripts/merge-settings.mjs` — merge-safe, idempotent installer replacing the
  error-prone manual `cp`: skips existing files (local edits survive updates; `--force` to
  overwrite), MERGES hook entries into an existing `settings.json` (dedup by command; user's
  own hooks/outputStyle preserved), keeps an existing `CLAUDE.md` and saves ours as
  `CLAUDE.md.fable-skills`, gitignores `settings.local.json`, and stamps
  `.claude/fable-skills-version` (tag + date) for audits. Verified on fresh/existing/re-run
  scenarios including 3× idempotency.
- Plugin distribution: `scripts/build-plugin.mjs` GENERATES `plugin/` from `.claude/` (single
  source of truth — hand-editing banned; hook paths rebased to `${CLAUDE_PLUGIN_ROOT}`), and
  `.claude-plugin/marketplace.json` makes this repo an installable marketplace
  (`/plugin marketplace add Syo-M/fable5_skills` → `/plugin install fable-frontend@fable-skills`).
  CI gains a `build-plugin.mjs --check` freshness gate so the generated tree can never drift.
  Documented plugin limitations honestly: path-scoped rules and CLAUDE.md cannot ship in plugins
  (docs-confirmed) — full installs use `install.sh`.
- `MAINTENANCE.md` — the calendar-driven half of the improvement loop (the session-driven half is
  `/retro`): quarterly version-fact re-verification protocol with an inventory table of every
  version-sensitive claim (Next 16 caching, Astro Content Layer, Storybook 10, Vitest 4 projects,
  zod 4, action SHA pins, Claude Code integration formats), plus the per-release checklist
  (fetch-before-push, plugin regen, scoring cadence).

### Changed
- README: install section rewritten around the installer + plugin path (manual `cp` guidance
  removed); tree updated; maintenance section now points at `MAINTENANCE.md` as the authority.

## [1.7.0] - 2026-07-02

### Added
- **The repo now applies its own governance to itself**: `.github/workflows/verify.yml` (actions
  SHA-pinned) runs both hook test suites, settings.json parse, CHANGELOG reverse-chronology,
  cross-reference resolution (agents' `skills:`, CLAUDE.md index table, path refs in all md files),
  sensitive-path list sync, workflow-script syntax, and frontmatter validation — every class of
  defect the v1.6.0 scoring caught by hand is now a merge-blocking machine check (`scripts/`).
- `.claude/hooks/sensitive-bash.mjs` — heuristic PreToolUse hook (matcher: Bash) closing the
  headline v1.6.0 gap: write-looking commands (`sed -i`, `tee`, redirects, `git apply`, `mv`/`cp`/
  `rm`/`chmod`…) naming sensitive paths, and dependency-mutating package-manager calls
  (`npm install`/`pnpm add`/… — frozen installs like `npm ci` exempt) now escalate to a human
  prompt. Marked HONESTLY as a heuristic (obfuscatable; durable controls stay prose +
  CODEOWNERS/branch protection). 22-case test suite included.
- `.claude/hooks/sensitive-list.mjs` — the canonical sensitive-path list extracted to a single
  module consumed by both hooks and by `scripts/check-sync.mjs`, which fails CI if the
  `sensitive-config` rule globs drift from it (kills the "four-list drift" defect structurally).
- `retro` skill (also `/retro`) — the self-improvement loop as procedure: gather human corrections /
  repeated fix-ups / agent-memory learnings → filter (twice-occurred, decidable, not already
  covered; trigger fixes go to `description`, not new rules) → propose diffs + machine-enforcement
  alternatives, wait for sign-off.

### Changed
- `governance` sensitive-paths section and CLAUDE.md/README now describe the two-hook reality
  (exact for Edit/Write, heuristic for Bash) instead of the "Bash not intercepted" caveat.
- README: repo tree and hooks caveats updated; audit-logging removed from the remaining-gaps list
  (ruled in `frontend-security` since v1.5.6).

## [1.6.0] - 2026-07-02

### Added
- `.claude/rules/` — path-triggered tripwires that complement task-triggered skills and hold even
  when no skill loads: `server-boundaries` (zod/IDOR/CSRF/webhook/SSRF invariants on server code),
  `styling` (token enforcement on CSS), `tests` (layer map on test files), `sensitive-config`
  (sign-off reminder on CI/framework config/lockfiles/`.claude/**`).
- `.claude/agents/` — four subagents with persistent `memory: project`: `security-reviewer` and
  `a11y-auditor` (read-only adversarial reviewers, use-proactively), `test-author` (layer-correct
  test writing with injected testing skills), `dependency-vetter` (license/install-scripts/cooldown/
  size/typosquat vetting against the `governance` policy, evidence-verbatim verdicts).
- Two pipeline skills doubling as slash commands: `pre-ship` (typecheck → lint → affected tests →
  scoped security/a11y review passes → sensitive-path stop, single verbatim pass/fail table) and
  `new-component` (component + CSS Module + story with play function as one unit of done).
- `.claude/hooks/sensitive-paths.mjs` + `.claude/settings.json` — a PreToolUse hook that machine-
  backstops the CLAUDE.md sensitive-path sign-off rule by returning permissionDecision "ask" on
  Edit/Write/NotebookEdit calls touching CI/deploy config, framework config/middleware,
  auth/session/payment code, lockfiles, and `.claude/**`. Scope documented honestly: Bash-tool
  writes are NOT intercepted (prose rule + CODEOWNERS/branch protection cover those). Dependency-
  free Node, fail-open with a stderr breadcrumb; the hook's regex list is declared the canonical
  sensitive-path list. Ships with a 21-case test suite (`sensitive-paths.test.mjs`, includes
  false-positive guards: `author` ≠ `auth`, `sessionStorage` ≠ `session`).
- `.claude/output-styles/` — `mentor` (onboarding: each decision names the rule it came from) and
  `lead-engineer` (risk-first, evidence-verbatim reporting). Selected via `/config`.
- `.claude/workflows/security-audit.js` — a fan-out map → per-dimension review → adversarial-verify
  audit for Workflow-enabled harnesses (marked harness-dependent; inert on plain CLI).
- `CLAUDE.md`: an "Automation layers" section (rules vs skills triggering, when to delegate to which
  agent, the hook is the sign-off — never route around it) and skill-index rows for the new skills.
- README: a formal-scoring section recording the 3-persona weighted results (v1.6.0 candidate:
  Engineer 86.7 / Security 89.0 / LLM 89.0, avg 88.2; trajectory since v1.1.0) and the convergent
  defects fixed before this release.

### Changed
- `.gitignore` now excludes `.claude/settings.local.json` so consuming projects don't commit
  personal overrides.
- `templates/eslint.config.js`: global `ignores: ['.claude/**']` so the harness-executed workflow
  script can't break repo-wide lint globs.

### Fixed (pre-release, from the 3-persona scoring of the candidate)
- Honest enforcement scope: "machine-enforced" softened to "machine-backstopped for Edit/Write" in
  `governance`, CLAUDE.md, and README, with the Bash-write bypass documented explicitly.
- `server-boundaries` rule now catches App Router boundaries (`**/route.*`, `**/actions.*`) and
  payment/billing paths; client-only file caveat added.
- Hook regexes extended (`oauth`/`session`/`login`/`middleware`/`bun.lockb`/`yarn.lock`) and the
  `startsWith(cwd)` path-normalization bug fixed (separator-safe).
- Sensitive-path lists synced across their four representations, with the hook declared canonical.
- Agent memory data-governance: all four agents now prohibit storing secrets/PII/unremediated
  vulnerability details; `dependency-vetter` hardened against instruction-injection in fetched
  package content; reviewer agents' "read-only" claim reworded to match actual tool grants
  (memory writes exist; the restriction is instruction-level).
- Restored the `[1.5.1]` section heading this entry's first draft had accidentally absorbed.
## [1.5.6] - 2026-06-15

### Fixed
- `gitleaks.toml` (F7, open 3 rounds): removed the whole-file allowlist of `README.md` /
  `CHANGELOG.md` — docs are a top place real keys get pasted (curl examples, sample connection
  strings). They are now scanned; the config shows how to allowlist a single placeholder string
  narrowly instead.

### Added
- `unsanitized-dom-inner-html` now also catches `innerHTML +=` / `outerHTML +=` (a distinct AST
  node and a classic append-user-input XSS sink), with matching static/sanitized exemptions.
- `frontend-security` (F8 / A09 / ASVS V7): an active security-event audit-logging rule — record
  authn success/failure, authz denials (IDOR/403), privilege changes, webhook signature-verify
  failures, and admin actions with actor/action/result/correlation-id. Closes the only OWASP
  category with no rule at all; clarifies that "don't log PII" governs the payload, not the
  security-event metadata.

## [1.5.5] - 2026-06-15

### Fixed
- Regression from the v1.5.3 SSRF extension: the `fetch-url-from-request-input` `$REQ`
  metavariable-regex was unanchored, so a substring match blocked safe internals like
  `requestConfig.url` / `queryClient.baseUrl` / `inputRef.current` (all rules are ERROR =
  merge-blocking). Anchored it to `^(req|request|searchParams|params|body|input|query)$` so it
  only fires when the object identifier IS the request. (The `insecure-random` `$F` regex stays
  unanchored on purpose — it matches descriptive names like `generateSessionToken`.)

## [1.5.4] - 2026-06-15

### Changed
- Instruction-design (C) cleanups from the re-score:
  - `CLAUDE.md`: noted that the skill table is a human index and the frontmatter `description`
    is the authoritative load trigger — removes the table-vs-description dual-maintenance drift.
  - `css-modules`: added an inbound cross-ref to `astro` (scoped `<style>` is the Astro styling
    primitive) so `astro` is no longer an orphan node; added an "Enforcement → `tooling`" back-link.
  - `react-patterns`: added an "Enforcement → `tooling`" back-link (hooks/effect-deps/named-export
    rules are ESLint-enforced), wiring honor-system rules to their machine enforcement.
- Ops/DX (D):
  - `SECURITY.md`: documented bus factor = 1 (single maintainer) — disclosure SLAs are best-effort
    and adopters must staff ≥2 CODEOWNERS for the privileged rule surface.
  - `governance`: pinning guidance now explicitly covers CI container images by digest (`@sha256:…`),
    matching the Semgrep job's image; previously only "Actions by SHA" was stated.

### Deferred
- `vite-react` intentionally keeps zero inbound skill cross-refs — it is framework-exclusive, so an
  artificial back-link would mislead rather than help.
- A machine cross-reference / link checker in CI is still not added: shipping an untested gate would
  violate the repo's own "verify it works" principle. Tracked for a future round.

## [1.5.3] - 2026-06-15

### Fixed
- Side effect of the v1.5.2 WARNING→ERROR promotion: `insecure-random-for-secret` matched the
  bare token `id` (and `key`), so `Math.random()` inside non-security helpers like `buildSlideId`
  would now *block* CI. Narrowed the function-name regex to high-signal words
  (token/secret/nonce/otp/session/password/salt/apikey/csrf) and documented why `id` is omitted.

### Added
- Semgrep XSS coverage closing the gap the re-score flagged (rules existed in the skill but had no
  machine backstop beyond React's `dangerouslySetInnerHTML`):
  - `unsanitized-dom-inner-html`: direct DOM `innerHTML`/`outerHTML`/`insertAdjacentHTML` sinks with
    non-static content (static strings + DOMPurify-sanitized values exempt).
  - `unsanitized-astro-set-html`: Astro `set:html={…}` with a dynamic expression (generic mode,
    scoped to `*.astro`, allows a `sanitize` call).
- Webhook signature-verify detection now also covers raw-body readers
  (`arrayBuffer`/`blob`/`formData`/`rawBody`/`buffer()`), so Stripe-style handlers that read raw
  bytes for HMAC are no longer missed.
- SSRF detection extended from `fetch` to `axios`/`got`/`ky` called inline with request input;
  the indirect `const u = req.body.url; fetch(u)` case is documented as taint-mode/review-only.
- Public-env secret regex widened with high-signal words (CREDENTIAL, ACCESS_KEY,
  CONNECTION_STRING, SIGNING_KEY, PASSPHRASE). Deliberately excludes legitimately-public names
  (Sentry `DSN`, Firebase `AUTH_DOMAIN`) to avoid false-positive blocks.

## [1.5.2] - 2026-06-15

### Fixed
- Multi-agent re-score (technical / security / instruction-design / DX) surfaced that gate 8 (the
  security-review backstop) did not actually block: `templates/.semgrep/frontend-security.yml`
  shipped its webhook-missing-verify, SSRF, and insecure-randomness rules at `severity: WARNING`
  (non-blocking), and `ci.yml` invoked the **archived** `semgrep/semgrep-action@v1`. Promoted the
  three rules to `ERROR` and replaced the dead action with the current `semgrep ci` container
  invocation (blocks on ERROR; `// nosemgrep` after human review is the escape hatch). The
  doc-vs-enforcement claim in `governance` gate 8 is now true.
- `templates/github/workflows/ci.yml`: the `gitleaks-action@v2` secrets-scan job failed on
  organization-owned repos because `GITLEAKS_LICENSE` was unset. Added the env wiring + a note
  that org repos need the (free) license key and `trufflehog` is the no-license alternative.
- `templates/size-limit.json` did nothing without a preset: documented the required
  `@size-limit/preset-app` install in `templates/README.md` and the `ci.yml` size step, so the
  v1.5.1 bundle-budget gate actually runs.
- Doc-vs-enforcement drift: `templates/stylelint.config.mjs` now enforces `var()` on spacing
  (`margin`/`padding`/`gap`) as `tooling` already promised — bare `0`/`auto` layout values exempt.
- `frontend-security` CSP minimum now explicitly forbids `'unsafe-inline'` in `script-src`
  (nonce/hash + `'strict-dynamic'`); the CLAUDE.md floor echoes it. Closes the gap where banning
  only `'unsafe-eval'` left the main XSS path open.

### Changed
- `CLAUDE.md` security floor: split the 450-char SSRF/upload/cookie/CORS run-on into four readable
  bullets. No control removed — security-floor rules remain exempt from pruning per `SECURITY.md`.
- `css-modules` description no longer claims "motion" (it deferred to the `motion` skill in-body
  already); removes the trigger collision with `motion`/`design-system` on styling+animation asks.

## [1.5.1] - 2026-06-15

### Fixed
- Reordered this CHANGELOG to strict reverse-chronological order (it had drifted to 1.3.0 → 1.5.0 →
  1.4.0 …), restoring the tag-to-rules audit trail the file promises.
- Doc-vs-enforcement drift: `governance` (CI gate 8) and `tooling` overstated the Semgrep backstop.
  Corrected to match the shipped `templates/.semgrep/` ruleset — webhook-missing-verification, SSRF,
  secret exposure, and unsanitized HTML are backstopped; zod-at-boundary and IDOR have no reliable
  static rule and are explicitly review-only.
- `frontend-security` self-check: added an authorization-model gate and folded the DNS-rebinding
  pinned-IP step into the SSRF gate, so an all-green checklist can't pass a rebind-vulnerable fetch.

### Added
- `templates/size-limit.json`: a concrete ~170 kB/route bundle budget config so the `governance`
  budget number is enforceable, not just documented; `ci.yml` size step points at it.

## [1.5.0] - 2026-06-15

### Added
- Instruction-design techniques adapted from the Claude Fable 5 system prompt (worked
  examples + Rationale, pre-response self-check lists, anti-confabulation):
  - `frontend-security`: a "Self-check before shipping boundary code" checklist turning the
    honor-system controls (zod-at-boundary, webhook signature, IDOR, SSRF, secrets/PII, XSS,
    cookies/CSRF, untrusted-as-data) into actionable yes/no gates.
  - `testing-vitest`: worked examples for the test-layer decision people get wrong most
    (spinner → story; pure logic → unit; hook timing → unit; prop matrix → unit + key stories).
  - `CLAUDE.md`: a "verify, don't assume" workflow rule — confirm a referenced file/dependency/
    export/flag exists and check the installed major version before relying on it.

## [1.4.0] - 2026-06-14

### Added
- Security depth (the reviewers' remaining "optional" gaps): SSRF DNS-rebinding/TOCTOU
  guidance + IPv6 deny ranges, a data-minimization/retention rule, and an authorization-model
  rule (RBAC vs ownership, deny-by-default, one policy helper) in `frontend-security`; CORS-no-
  credential-reflection and rate-limit-auth/LLM-endpoints added to the always-resident CLAUDE.md
  floor; a default initial-load bundle budget (~170 kB gzipped/route) in `governance`.

### Changed
- This repo's own `CODEOWNERS` now uses the real maintainer handle (`@Syo-M`) instead of
  `@your-org` placeholders, so the change-control control is operative (branch protection must
  still be enabled in repo settings).
- `SECURITY.md` now routes disclosure through GitHub private vulnerability reporting rather than
  a placeholder email.

## [1.3.1] - 2026-06-14

### Fixed
- Reconciled the now-real security-review gate across docs: added it as gate 8 in the `governance`
  CI list, and updated `tooling` so zod-at-boundary / IDOR / webhook-signature are described as
  "Semgrep-backstopped heuristic + review" rather than purely un-enforceable.
- `templates/.semgrep`: corrected the action org name (`returntocorp` → `semgrep`); renamed the
  webhook rule to `webhook-handler-missing-signature-verify` to match what it can actually detect
  (Semgrep can't model call order); widened the DOMPurify allowlist to wrapped/`isomorphic` sanitizers.
- `i18n`: the missing-key CI check now names a concrete tool and is framed as a wired gate, not an
  unenforced claim; added the reciprocal i18n cross-reference in `frontend-security` (parse-then-validate).

## [1.3.0] - 2026-06-14

### Added
- New `i18n` skill: message catalogs, ICU plurals/interpolation, `Intl` formatting, locale
  routing, RTL, and locale-aware input validation — the last major frontend domain the set
  was missing. Cross-referenced from `css-modules` (logical properties), `data-viz` (`Intl`),
  and `frontend-security` (parse-then-validate). Added to the CLAUDE.md skill index (now 18 skills).
- `templates/.semgrep/frontend-security.yml`: real Semgrep heuristics backing the
  `security-review` CI gate — public-env secret exposure, unsanitized `dangerouslySetInnerHTML`,
  insecure randomness for secrets, webhook body used before signature verify, and fetch-from-
  request-input (SSRF). Makes the honor-system controls machine-checkable, not just reviewed.

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
