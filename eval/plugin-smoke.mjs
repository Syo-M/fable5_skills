#!/usr/bin/env node
// Plugin runtime smoke: does the GENERATED plugin/ actually load and fire?
//   1. `claude plugin validate plugin/`      — deterministic manifest/structure check
//   2. headless run with `--plugin-dir`      — a security prompt in a project with NO
//      rules installed; any skill/agent observed can therefore ONLY come from the plugin.
//
//   node eval/plugin-smoke.mjs [--runs N] [--model X] [--keep]
//
// Release-time protocol (step 2 is a real model run), not CI. Complements the
// build-plugin --check freshness gate (bytes) with a does-it-load check (runtime).
import { execFileSync, spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync, rmSync, existsSync, cpSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const arg = (n, d) => {
  const i = process.argv.indexOf(`--${n}`);
  return i > -1 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : d;
};
const RUNS = Number(arg('runs', '2'));
const MODEL = arg('model', '');
const KEEP = process.argv.includes('--keep');
const PLUGIN = join(root, 'plugin');
const WORKDIR = join(tmpdir(), 'fable-plugin-smoke');

// ---- step 1: deterministic validation ----
const val = spawnSync('claude', ['plugin', 'validate', PLUGIN], { encoding: 'utf8', timeout: 60_000 });
const validateOk = val.status === 0;
console.log(`validate: ${validateOk ? 'OK' : 'FAIL'}\n${(val.stdout || val.stderr || '').trim().split('\n').slice(0, 6).join('\n')}\n`);
if (!validateOk) process.exit(1);

// ---- step 2: runtime load — fixtures WITHOUT install.sh, logger-only hooks ----
rmSync(WORKDIR, { recursive: true, force: true });
mkdirSync(join(WORKDIR, '.claude'), { recursive: true });
cpSync(join(here, 'fixtures'), WORKDIR, { recursive: true });
const logger = { type: 'command', command: `node "${join(here, 'log-event.mjs')}"` };
writeFileSync(
  join(WORKDIR, '.claude', 'settings.json'),
  JSON.stringify(
    {
      hooks: {
        PreToolUse: [{ matcher: 'Skill|Task|Agent', hooks: [logger] }],
        PostToolUse: [{ matcher: 'Skill|Task|Agent', hooks: [logger] }],
        SubagentStart: [{ hooks: [logger] }],
      },
    },
    null,
    2,
  ),
);

// The prompt targets the plugin's most reliably-firing components (canary class):
// the security-reviewer agent / frontend-security skill. Nothing in WORKDIR
// provides them — an observation proves the plugin loaded and triggered.
const PROMPT = 'src/api/users/route.ts のセキュリティチェックして';
const EXPECT = /security/;

let passes = 0;
const observations = [];
for (let i = 0; i < RUNS; i++) {
  const logFile = join(WORKDIR, '.eval-log.jsonl');
  rmSync(logFile, { force: true });
  const args = ['-p', PROMPT, '--max-turns', '4', '--output-format', 'json', '--plugin-dir', PLUGIN];
  if (MODEL) args.push('--model', MODEL);
  const res = spawnSync('claude', args, { cwd: WORKDIR, encoding: 'utf8', timeout: 300_000, env: { ...process.env } });
  const valid = res.status === 0 && !res.error && res.stdout?.includes('"result"');
  const fired = new Set();
  if (existsSync(logFile)) {
    for (const line of readFileSync(logFile, 'utf8').split('\n').filter(Boolean)) {
      try {
        const e = JSON.parse(line);
        if (e.skill) fired.add(`skill:${e.skill}`); // raw, namespace intact — proves plugin origin
        if (e.agent) fired.add(`agent:${e.agent}`);
      } catch { /* skip bad line */ }
    }
  }
  const hit = valid && [...fired].some((f) => EXPECT.test(f));
  if (hit) passes++;
  observations.push([...fired].join(', ') || (valid ? '(nothing fired)' : 'INVALID run'));
  console.log(`run ${i + 1}: ${hit ? 'PASS' : valid ? 'FAIL' : 'INVALID'}  [${observations.at(-1)}]`);
}

const version = execFileSync('git', ['-C', root, 'describe', '--tags', '--always', '--dirty'], { encoding: 'utf8' }).trim();
mkdirSync(join(root, 'eval', 'reports'), { recursive: true });
let reportPath = join(root, 'eval', 'reports', `${version}-plugin-smoke.md`);
for (let n = 2; existsSync(reportPath); n++) reportPath = join(root, 'eval', 'reports', `${version}-plugin-smoke-${n}.md`);
writeFileSync(reportPath, `# Plugin runtime smoke — plugin under test: ${version}

- Step 1 \`claude plugin validate plugin/\`: **OK** (deterministic)
- Step 2 \`--plugin-dir\` runtime trigger: **${passes}/${RUNS} runs fired** a plugin security component
  (project has NO rules installed — observed skills/agents can only come from the plugin;
  namespaced names below prove origin)
- Model: ${MODEL || 'session default'} · prompt: ${PROMPT}

| run | observed (raw, namespaced) |
|---|---|
${observations.map((o, i) => `| ${i + 1} | ${o} |`).join('\n')}
`);
console.log(`\n${passes}/${RUNS} runtime PASS — report: ${reportPath.slice(root.length + 1)}`);
if (!KEEP) rmSync(WORKDIR, { recursive: true, force: true });
process.exit(passes > 0 ? 0 : 1);
