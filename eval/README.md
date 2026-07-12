# eval/ — measured evaluation (trigger / outcome / adversarial)

"The rule exists", "the rule fires", and "the work is correct and safe" are three different
claims. CI machine-verifies the first; this directory measures the other two with real model
runs, release-time (not per-commit — model behavior is stochastic and runs cost money):

| Bench | Question | Runner |
|---|---|---|
| **Trigger** | do prompts activate the intended skill/agent/rule? | `run-eval.mjs` |
| **Outcome** | does the security review catch PLANTED vulns without flagging benign decoys? does a fix leave the project typechecking? (+ `--baseline` rules-off A/B control) | `outcome/run-outcome.mjs` |
| **Adversarial** | injection-in-content, obfuscated sensitive writes, secret pastes, typosquats — defended? benign controls NOT over-blocked? | `adversarial/run-adversarial.mjs` |
| **Plugin smoke** | does the generated `plugin/` validate AND actually fire via `--plugin-dir`? | `plugin-smoke.mjs` |

## How it measures (observed, not self-reported)

1. `run-eval.mjs` builds a disposable fixture project (Vite+React by default; `--fixture next|astro`
   for framework overlays) and installs the rules into it via `install.sh` (so the eval exercises
   the real install path too).
2. It wires `log-event.mjs` into the project's hooks: `PreToolUse`/`PostToolUse` (matcher
   `Skill|Task|Agent`), `SubagentStart`, and `InstructionsLoaded` — deliberately NOTHING else:
   an event name the installed CLI doesn't know silently disables the whole settings file
   (verified on 2.1.87 with `PermissionDenied`/`PostToolUseFailure`). Every activation is appended
   to `.eval-log.jsonl` by the harness itself — the model cannot fake or forget it.
   **Activation = invoked or attempted** (a PreToolUse attempt proves the trigger fired even if
   headless permissions then block it).
3. Each prompt in `golden-prompts.json` runs headless (`claude -p … --max-turns 3`); the log is
   scored against the prompt's expectations.

## Scoring

- `skills_all` — every listed skill must fire.
- `skills_any` / `agents_any` / `rules_any` — at least one per non-empty group must fire
  (all groups, unless `any_group_mode: "either"` — then any one group satisfying passes,
  used where skill-vs-agent routing is legitimately either/or).
- `forbid_skills` — negative expectation (e.g. `nextjs` must NOT fire in the Vite fixture).
- `forbid_all` — over-trigger negative: NO skill and NO agent may load (doc typos, config
  line-adds, pure questions). This is the counterweight to CLAUDE.md's load-first directive —
  it measures whether "always load the rulebook" degrades into "load something for everything".
  Path rules are exempt (read-triggered, cheap).

## Running

```bash
node eval/run-eval.mjs                 # all prompts, 1 run each (first signal)
node eval/run-eval.mjs --runs 3        # release-grade rates (do this before a MAJOR release)
node eval/run-eval.mjs --styling tailwind --runs 3   # evaluate under the tailwind profile
node eval/run-eval.mjs --fixture next --runs 3       # Next.js App Router fixture series
node eval/run-eval.mjs --fixture astro --runs 3      # Astro fixture series
node eval/run-eval.mjs --only dep-vet-jp,preship-jp --keep   # debug specific prompts
node eval/plugin-smoke.mjs                           # plugin validate + --plugin-dir runtime trigger
```

**Styling profiles**: prompts may carry `styling_profile` — they only run when it matches
`--styling` (default `css-modules`); unmarked prompts run under every profile. Non-default
profiles apply a fixture overlay from `eval/fixtures-<profile>/` (overwrites files;
`_delete.txt` lists removals) and install via `install.sh --styling <profile>`.

**Framework fixtures**: prompts may carry `fixture: next|astro` — they only run under
`--fixture next|astro`, which applies the same overlay mechanism from `eval/fixtures-next/` /
`eval/fixtures-astro/` (Next 16 App Router / Astro 5 + React islands — matching the versions the
skills assume). Unmarked prompts belong to the default Vite series. This tests framework
precedence positively (nextjs/astro fire in their own fixture, with `forbid` cross-checks),
not only via the Vite-side negative.

**Cost & cadence**: every run is a real model invocation on your account (~26 prompts × runs).
This is a RELEASE-TIME protocol, not a per-commit CI gate — trigger behavior is stochastic, so a
single-run red would make CI flaky. Reports land in `eval/reports/` and are committed as
measurement records (see `MAINTENANCE.md` release checklist).

## Outcome bench (`outcome/`)

Fixture with **6 planted vulnerabilities** (no-validation, webhook-no-signature, XSS, SSRF,
IDOR, hardcoded secret) + **2 benign decoys** (sanitized HTML, harmless `authorize()` helper).
`run-outcome.mjs --runs 3` runs a security review and grades **recall** (vuln mentioned by
file + class keyword) and **decoy false positives**, then a fix task with a typecheck smoke
(`npx tsc --noEmit`, type shims included so no node_modules needed). Grading is transparent
LLM-free matching — it misses paraphrases, so treat recall as a floor.

**Rules-off A/B baseline** (`--baseline`, measured v3.2.0): same prompts/grading with NO rules
installed. Result: recall is IDENTICAL (18/18 — these six plants are findable by the model
alone); the rules' measured contribution is **precision** (decoy false positives 3/6 baseline →
1/6 rules-on; the baseline flags DOMPurify-sanitized HTML every run) and **standard-conformance**
(the baseline fixes V1 functionally with hand-rolled `typeof` checks but not with zod — the fix
grader's `must_match_any` measures house-standard conformance, not mere repair). Separating
recall would need subtler plants — see backlog.

## Adversarial bench (`adversarial/`)

Scenarios graded by **deterministic side effects** (file snapshot diffs, forbidden strings in
changed files, dangerous Bash observed via hooks) — not model self-report. Fresh install per
run. Reports two numbers: **attack runs defended** and **control runs passed** (benign prompts
that must NOT be refused — the false-block counterweight). `run-adversarial.mjs --runs 3`.

**Security note**: the harness spawns a headless agent with your credentials, inherited
environment, and tool execution in the fixture project. Prompts and fixtures are repo-controlled;
still, treat `run-eval.mjs` changes as sensitive (the `.claude/**` sign-off flow applies to the
projects it writes into, and long series can hit usage limits — see run-validity below).

## Plugin smoke (`plugin-smoke.mjs`)

Two steps: (1) `claude plugin validate` on `plugin/` and the marketplace manifest —
deterministic (first run immediately caught an unrecognized `displayName` manifest key);
(2) a headless run with `--plugin-dir plugin/` in a fixture project with NO rules installed
and logger-only hooks — any skill/agent observed can only have come from the plugin, and the
namespaced names in the report prove origin. Release-time (step 2 is a real model run).

## Backlog (known gaps, tracked here)

- Subtler outcome plants (logic-level authz bypass, second-order injection) so RECALL can
  differentiate rules-on from the baseline — the current six are model-findable without rules.
- DONE (v3.3.0): Next.js / Astro fixture overlays (`--fixture next|astro`) — framework precedence
  tested positively with 8 fixture-scoped prompts.
- DONE (v3.3.0): plugin runtime smoke (`plugin-smoke.mjs`) — see section above.
- forms.md tripwire scope (measured v3.0.0): `rule:forms` has zero observed firings — path rules
  inject on READ of matching files, so the tripwire covers edits of EXISTING form files, not
  first creation (first creation is covered by load-first + the react-patterns pointer, measured
  3/3 in reports/v3.0.0-form-tripwire-3runs.md). To measure the rule itself, add a fixture
  containing a pre-existing ContactForm.tsx and a prompt that edits it.
- installer `--uninstall` (requires recording an install manifest at install time).
- Re-test the 3 flaky prompts (`tests-component-jp` 2/3, `chart-jp` 2/3, `motion-jp` 1/3) at
  `--max-turns 6` — the horizon finding below predicts they rate higher too.
- Known-flaky (v3.3.0, measured): `astro-routing-precedence-jp` 0/3 at 3 turns, 1/3 at 6 —
  for the generic「ルーティングを整理したい」phrasing the model tends to load NO framework
  skill (the Vite mirror negative counts that as correct behavior). Kept as an honest probe;
  do not chase with description bloat. `next-server-action-jp` 2/3, `astro-content-jp` 2/3.
- DONE (v2.0.0): over-trigger negatives — 3 prompts, all 3/3 clean; the load-first directive has
  no measured over-loading cost.
- DONE (v2.0.0): max-turns sensitivity experiment — the 3 former 0/3 "structural" gaps are ALL
  3/3 at `--max-turns 6` (reports/v2.0.0-horizon-experiment.md): they were measurement-horizon
  artifacts, not missing triggers. Every golden prompt has demonstrated activation.

## Interpreting failures

- Expected skill didn't fire → widen that skill's `description` (add the phrasing that failed);
  do NOT bloat CLAUDE.md. This is the same guidance as CLAUDE.md's skill-table note.
- Wrong layer fired (skill instead of agent, or vice versa) → check the routing language in
  CLAUDE.md "Automation layers" and the agent's description for overlap.
- `forbid` fired → a description is over-broad; tighten it (framework skills must stay exclusive).
- Timeouts → increase `--max-turns` is usually wrong; the trigger happens in turn 1-2. Investigate
  the prompt instead.
