# eval/ — golden-prompt trigger evaluation

"The rule exists" and "the rule fires" are different claims. Everything else in this repo is
machine-verified by CI; this harness measures the one thing CI can't — **trigger reliability**:
do representative user prompts actually activate the intended skill / agent / rule?

## How it measures (observed, not self-reported)

1. `run-eval.mjs` builds a disposable Vite+React fixture project and installs the rules into it
   via `install.sh` (so the eval exercises the real install path too).
2. It wires `log-event.mjs` into the project's hooks: `PreToolUse`/`PostToolUse` (matcher
   `Skill|Task|Agent`), `SubagentStart`, `InstructionsLoaded`, plus `PermissionDenied`/
   `PostToolUseFailure` for diagnosis. Every activation is appended to `.eval-log.jsonl` by the
   harness itself — the model cannot fake or forget it. **Activation = invoked or attempted**
   (a PreToolUse attempt proves the trigger fired even if headless permissions then block it).
3. Each prompt in `golden-prompts.json` runs headless (`claude -p … --max-turns 3`); the log is
   scored against the prompt's expectations.

## Scoring

- `skills_all` — every listed skill must fire.
- `skills_any` / `agents_any` / `rules_any` — at least one per non-empty group must fire
  (all groups, unless `any_group_mode: "either"` — then any one group satisfying passes,
  used where skill-vs-agent routing is legitimately either/or).
- `forbid_skills` — negative expectation (e.g. `nextjs` must NOT fire in the Vite fixture).

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

## Interpreting failures

- Expected skill didn't fire → widen that skill's `description` (add the phrasing that failed);
  do NOT bloat CLAUDE.md. This is the same guidance as CLAUDE.md's skill-table note.
- Wrong layer fired (skill instead of agent, or vice versa) → check the routing language in
  CLAUDE.md "Automation layers" and the agent's description for overlap.
- `forbid` fired → a description is over-broad; tighten it (framework skills must stay exclusive).
- Timeouts → increase `--max-turns` is usually wrong; the trigger happens in turn 1-2. Investigate
  the prompt instead.
