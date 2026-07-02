#!/usr/bin/env node
// Golden-prompt trigger evaluation. Measures — via hooks, not guesswork — which
// skills/agents/rules actually activate for representative prompts, using
// headless `claude -p` runs in a disposable fixture project.
//
//   node eval/run-eval.mjs [--runs N] [--only id1,id2] [--workdir DIR] [--keep] [--max-turns N]
//
// Cost note: every run is a real model invocation on your account. Default is
// 1 run/prompt (plumbing + first signal); use --runs 3 for release-grade rates.
// Report written to eval/reports/.
import { execFileSync, spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync, rmSync, existsSync, cpSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const arg = (name, dflt) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : dflt;
};
const RUNS = Number(arg('runs', '1'));
const MAX_TURNS = arg('max-turns', '3');
const ONLY = arg('only', '')?.split(',').filter(Boolean);
const WORKDIR = arg('workdir', join(tmpdir(), 'fable-eval-project'));
const KEEP = process.argv.includes('--keep');

const { prompts } = JSON.parse(readFileSync(join(here, 'golden-prompts.json'), 'utf8'));
const selected = ONLY.length ? prompts.filter((p) => ONLY.includes(p.id)) : prompts;
if (!selected.length) { console.error('no prompts selected'); process.exit(1); }

// ---- set up the disposable fixture project ----
function setup() {
  rmSync(WORKDIR, { recursive: true, force: true });
  mkdirSync(WORKDIR, { recursive: true });
  cpSync(join(here, 'fixtures'), WORKDIR, { recursive: true });
  execFileSync('bash', [join(root, 'install.sh'), WORKDIR], { stdio: 'pipe' });
  // wire the eval logger (absolute path into THIS repo) into the project hooks
  const settingsPath = join(WORKDIR, '.claude', 'settings.json');
  const settings = JSON.parse(readFileSync(settingsPath, 'utf8'));
  const logger = { type: 'command', command: `node "${join(here, 'log-event.mjs')}"` };
  settings.hooks.PostToolUse = [
    ...(settings.hooks.PostToolUse ?? []),
    { matcher: 'Skill|Task|Agent', hooks: [logger] },
  ];
  // PreToolUse too: an ATTEMPTED skill/agent invocation proves the trigger fired,
  // even if the execution environment then denies it.
  settings.hooks.PreToolUse = [
    ...(settings.hooks.PreToolUse ?? []),
    { matcher: 'Skill|Task|Agent', hooks: [logger] },
  ];
  settings.hooks.SubagentStart = [{ hooks: [logger] }];
  settings.hooks.InstructionsLoaded = [{ hooks: [logger] }];
  // CAUTION: wire ONLY events the INSTALLED CLI supports. A single unknown event
  // name silently disables the entire settings file's hooks (verified on 2.1.87
  // with PermissionDenied/PostToolUseFailure — documented but not yet shipped).
  writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
}

// ---- one headless run ----
function runOnce(prompt) {
  const logFile = join(WORKDIR, '.eval-log.jsonl');
  rmSync(logFile, { force: true });
  const res = spawnSync(
    'claude',
    ['-p', prompt, '--max-turns', MAX_TURNS, '--output-format', 'json'],
    { cwd: WORKDIR, encoding: 'utf8', timeout: 240_000, env: { ...process.env } },
  );
  const model =
    res.stdout?.match(/"model"\s*:\s*"([^"]+)"/)?.[1] ??
    res.stdout?.match(/"modelUsage"\s*:\s*\{\s*"([^"]+)"/)?.[1] ??
    null;
  const observed = { skills: new Set(), agents: new Set(), rules: new Set() };
  if (existsSync(logFile)) {
    for (const line of readFileSync(logFile, 'utf8').split('\n').filter(Boolean)) {
      try {
        const e = JSON.parse(line);
        if (e.skill) observed.skills.add(String(e.skill).replace(/^.*:/, ''));
        if (e.agent) observed.agents.add(e.agent);
        const rule = String(e.instructions ?? '').match(/\/rules\/([\w-]+)\.md/);
        if (rule) observed.rules.add(rule[1]);
      } catch { /* skip bad line */ }
    }
  }
  // Run-validity guard (lesson from the invalidated run-3 tail): a failed CLI
  // invocation produces zero events, which would score as forbid-PASS /
  // positive-FAIL. A run counts ONLY if the CLI exited 0 and returned a result.
  const valid =
    res.status === 0 && !res.error && typeof res.stdout === 'string' && res.stdout.includes('"result"');
  return { observed, model, valid, timedOut: res.error?.code === 'ETIMEDOUT', exit: res.status };
}

// ---- scoring ----
function score(p, obs) {
  const has = (set, xs) => xs.some((x) => set.has(x));
  // over-trigger negative: NOTHING (no skill, no agent) may load — path rules exempt,
  // they are read-triggered and cost little. Counterweight to the load-first directive.
  if (p.forbid_all) {
    const fired = [...obs.skills, ...[...obs.agents].map((a) => `@${a}`)];
    return fired.length
      ? { pass: false, why: `over-trigger: ${fired.join(',')}` }
      : { pass: true, why: '' };
  }
  const forbidHit = (p.forbid_skills ?? []).filter((x) => obs.skills.has(x));
  if (forbidHit.length) return { pass: false, why: `forbidden fired: ${forbidHit.join(',')}` };
  const allOk = (p.skills_all ?? []).every((x) => obs.skills.has(x));
  const groups = [];
  if (p.skills_any?.length) groups.push(has(obs.skills, p.skills_any));
  if (p.agents_any?.length) groups.push(has(obs.agents, p.agents_any));
  if (p.rules_any?.length) groups.push(has(obs.rules, p.rules_any));
  const groupsOk = groups.length === 0 ? true
    : p.any_group_mode === 'either' ? groups.some(Boolean) : groups.every(Boolean);
  return { pass: allOk && groupsOk, why: '' };
}

// ---- main ----
setup();

// Canary: prove the environment is alive before burning the series. If a
// known-reliable prompt yields an invalid run or zero events, the harness or
// account (usage limits) is dead — abort instead of producing NO-DATA rows.
function canaryCheck(label) {
  const c = runOnce('セキュリティチェックして: src/api/users/route.ts');
  const alive = c.valid && (c.observed.skills.size + c.observed.agents.size + c.observed.rules.size) > 0;
  if (!alive) {
    console.error(`CANARY DEAD (${label}): exit ${c.exit}, ${c.valid ? 'zero events' : 'invalid run'} — environment/usage-limit failure; aborting series.`);
    process.exit(2);
  }
  console.log(`canary OK (${label})`);
}
canaryCheck('series start');

console.log(`evaluating ${selected.length} prompts × ${RUNS} run(s) in ${WORKDIR}\n`);
const rows = [];
let model = null;
let consecutiveInvalid = 0;
for (const p of selected) {
  let passes = 0;
  let validRuns = 0;
  const union = { skills: new Set(), agents: new Set(), rules: new Set() };
  let notes = [];
  for (let i = 0; i < RUNS; i++) {
    const r = runOnce(p.prompt);
    model ??= r.model;
    if (!r.valid) {
      notes.push(r.timedOut ? 'timeout (run excluded)' : `invalid run (exit ${r.exit}, excluded)`);
      if (++consecutiveInvalid >= 3) {
        console.error('3 consecutive invalid runs — environment/usage-limit death; aborting series (partial results NOT written).');
        process.exit(2);
      }
      continue;
    }
    consecutiveInvalid = 0;
    validRuns++;
    for (const k of ['skills', 'agents', 'rules']) r.observed[k].forEach((v) => union[k].add(v));
    const s = score(p, r.observed);
    if (s.pass) passes++;
    else if (s.why) notes.push(s.why);
  }
  const rate = `${passes}/${validRuns}`;
  rows.push({ ...p, rate, passes, validRuns, union, notes: [...new Set(notes)].join('; ') });
  const label = validRuns === 0 ? 'NO-DATA' : passes === validRuns ? 'PASS' : passes > 0 ? 'FLAKY' : 'FAIL';
  console.log(`${label}  ${p.id}  ${rate}  [skills: ${[...union.skills].join(',') || '-'}] [agents: ${[...union.agents].join(',') || '-'}] [rules: ${[...union.rules].join(',') || '-'}]${rows.at(-1).notes ? '  (' + rows.at(-1).notes + ')' : ''}`);
}

const passCount = rows.filter((r) => r.validRuns > 0 && r.passes === r.validRuns).length;
const noData = rows.filter((r) => r.validRuns === 0).length;
const version = execFileSync('git', ['-C', root, 'describe', '--tags', '--always', '--dirty'], { encoding: 'utf8' }).trim();
const scope = ONLY.length
  ? `SUBSET run (--only ${ONLY.join(',')}): ${selected.length} of ${prompts.length} prompts — NOT a full-series result`
  : `full series: all ${prompts.length} prompts`;

// ---- report ----
mkdirSync(join(here, 'reports'), { recursive: true });
// never clobber an earlier report from the same version — suffix with a counter
let reportPath = join(here, 'reports', `${version}-${RUNS}runs.md`);
for (let n = 2; existsSync(reportPath); n++) {
  reportPath = join(here, 'reports', `${version}-${RUNS}runs-${n}.md`);
}
writeFileSync(reportPath, `# Trigger evaluation — rules under test: ${version} (working tree; ${RUNS} run(s)/prompt)

- Scope: ${scope}
- Model: ${model ?? 'unknown'} · max-turns ${MAX_TURNS} · fixture: Vite+React SPA
- Result: **${passCount}/${rows.length} prompts fully passed** (${rows.filter((r) => r.validRuns > 0 && r.passes > 0 && r.passes < r.validRuns).length} flaky, ${rows.filter((r) => r.validRuns > 0 && r.passes === 0).length} failed${noData ? `, ${noData} NO-DATA (all runs invalid — excluded, not failed)` : ''})
- Method: headless \`claude -p\` in a disposable project installed via install.sh; activations measured
  by hooks (PostToolUse Skill/Task, SubagentStart, InstructionsLoaded) — observed, not self-reported.
- Run count: ${RUNS < 3 ? `${RUNS} (below release-grade — use --runs 3; treat rates as first signal)` : `${RUNS} (release-grade)`}

| id | lang | rate | expected | observed (union) | notes |
|---|---|---|---|---|---|
${rows.map((r) => `| ${r.id} | ${r.lang ?? ''} | ${r.rate} | ${[
  r.skills_any?.length ? `skills:${r.skills_any.join('/')}` : '',
  r.agents_any?.length ? `agents:${r.agents_any.join('/')}` : '',
  r.rules_any?.length ? `rules:${r.rules_any.join('/')}` : '',
  r.forbid_skills?.length ? `forbid:${r.forbid_skills.join('/')}` : '',
  r.forbid_all ? 'forbid:EVERYTHING (over-trigger negative)' : '',
].filter(Boolean).join(' ')} | ${[...r.union.skills, ...[...r.union.agents].map((a) => `@${a}`), ...[...r.union.rules].map((x) => `rule:${x}`)].join(', ') || '-'} | ${r.notes} |`).join('\n')}
`);
console.log(`\n${passCount}/${rows.length} passed — report: ${reportPath.slice(root.length + 1)}`);
if (!KEEP) rmSync(WORKDIR, { recursive: true, force: true });
