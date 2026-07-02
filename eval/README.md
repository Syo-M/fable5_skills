# eval/ — golden-prompt trigger evaluation

"The rule exists" and "the rule fires" are different claims. Everything else in this repo is
machine-verified by CI; this harness measures the one thing CI can't — **trigger reliability**:
do representative user prompts actually activate the intended skill / agent / rule?

## How it measures (observed, not self-reported)

1. `run-eval.mjs` builds a disposable Vite+React fixture project and installs the rules into it
   via `install.sh` (so the eval exercises the real install path too).
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
node eval/run-eval.mjs --only dep-vet-jp,preship-jp --keep   # debug specific prompts
```

**Cost & cadence**: every run is a real model invocation on your account (~26 prompts × runs).
This is a RELEASE-TIME protocol, not a per-commit CI gate — trigger behavior is stochastic, so a
single-run red would make CI flaky. Reports land in `eval/reports/` and are committed as
measurement records (see `MAINTENANCE.md` release checklist).

**Security note**: the harness spawns a headless agent with your credentials, inherited
environment, and tool execution in the fixture project. Prompts and fixtures are repo-controlled;
still, treat `run-eval.mjs` changes as sensitive (the `.claude/**` sign-off flow applies to the
projects it writes into, and long series can hit usage limits — see run-validity below).

## Backlog (known gaps, tracked here)

- Next.js / Astro fixture projects so framework precedence is tested positively, not only via the
  one `forbid` prompt.
- Plugin runtime smoke test: load `plugin/` via `claude --plugin-dir`, verify skills list, agent
  launch, bare-name skill injection, and `${CLAUDE_PLUGIN_ROOT}` hook resolution (CI currently
  gates generation freshness only).
- installer `--uninstall` (requires recording an install manifest at install time).
- Re-test the 3 flaky prompts (`tests-component-jp` 2/3, `chart-jp` 2/3, `motion-jp` 1/3) at
  `--max-turns 6` — the horizon finding below predicts they rate higher too.
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
