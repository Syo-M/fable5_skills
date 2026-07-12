#!/usr/bin/env node
// OUTCOME-QUALITY bench: measures whether the security review actually catches
// planted vulnerabilities (recall) without flagging benign decoys (precision),
// and whether a requested fix leaves the project typechecking.
// Unlike eval/run-eval.mjs (did the rulebook LOAD?), this grades the WORK.
//
//   node eval/outcome/run-outcome.mjs [--runs N] [--skip-fix] [--model X] [--keep] [--baseline]
//
// --baseline: run the SAME prompts/grading WITHOUT installing the rules (no
// .claude/, no CLAUDE.md) — the A/B control that shows what the rules add
// beyond the model's own ability (attribution, not just absolute recall).
//
// Grading is transparent keyword/file matching against expected-findings.json
// (limitations documented in eval/README.md). Release-time protocol, not CI:
// each run is a full multi-turn agent task on your account.
import { execFileSync, spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync, rmSync, existsSync, cpSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..', '..');
const arg = (n, d) => {
  const i = process.argv.indexOf(`--${n}`);
  return i > -1 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : d;
};
const RUNS = Number(arg('runs', '3'));
const MODEL = arg('model', '');
const SKIP_FIX = process.argv.includes('--skip-fix');
const FIX_ONLY = process.argv.includes('--fix-only');
const KEEP = process.argv.includes('--keep');
const BASELINE = process.argv.includes('--baseline');
const WORKDIR = join(tmpdir(), `fable-outcome-project${BASELINE ? '-baseline' : ''}`);

const manifest = JSON.parse(readFileSync(join(here, 'expected-findings.json'), 'utf8'));

function setup() {
  rmSync(WORKDIR, { recursive: true, force: true });
  mkdirSync(WORKDIR, { recursive: true });
  cpSync(join(here, 'fixtures-vuln'), WORKDIR, { recursive: true });
  // baseline = the A/B control: pristine fixtures, no rules installed at all
  if (!BASELINE) execFileSync('bash', [join(root, 'install.sh'), WORKDIR], { stdio: 'pipe' });
}

function claude(prompt, maxTurns, opts = {}) {
  const args = ['-p', prompt, '--max-turns', String(maxTurns), '--output-format', 'json'];
  // The fix task needs real file edits; headless default denies them. acceptEdits
  // auto-approves file edits only (Bash etc. still gated) — scoped to this bench's
  // disposable temp project.
  if (opts.acceptEdits) args.push('--permission-mode', 'acceptEdits');
  if (MODEL) args.push('--model', MODEL);
  const t0 = process.hrtime.bigint();
  const res = spawnSync('claude', args, { cwd: WORKDIR, encoding: 'utf8', timeout: 600_000, env: { ...process.env } });
  const seconds = Number(process.hrtime.bigint() - t0) / 1e9;
  const valid = res.status === 0 && !res.error && res.stdout?.includes('"result"');
  let result = '';
  try { result = JSON.parse(res.stdout).result ?? ''; } catch { result = res.stdout ?? ''; }
  return { valid, result, seconds };
}

// Keyword must appear NEAR the file mention (±300 chars), not anywhere in the
// report — otherwise a report that correctly lists 6 vulns makes every decoy
// mention look like a false positive (grader bug caught in the smoke run).
function nearFile(text, file, kws, window = 300) {
  const names = [file, file.split('/').pop()];
  const lower = text.toLowerCase();
  for (const name of names) {
    let idx = 0;
    const needle = name.toLowerCase();
    while ((idx = lower.indexOf(needle, idx)) !== -1) {
      const ctx = lower.slice(Math.max(0, idx - window), idx + needle.length + window);
      if (kws.some((k) => ctx.includes(k.toLowerCase()))) return true;
      idx += needle.length;
    }
  }
  return false;
}

setup();
console.log(`outcome bench${BASELINE ? ' [BASELINE — rules NOT installed]' : ''}: ${manifest.vulns.length} planted vulns + ${manifest.decoys.length} decoys × ${RUNS} review run(s) in ${WORKDIR}\n`);

const REVIEW_PROMPT =
  'このプロジェクトのセキュリティレビューをしてください。src/ 以下の全ファイルを確認し、見つかった脆弱性を「ファイルパス+内容+深刻度」で漏れなく列挙してください。';

const perVuln = Object.fromEntries(manifest.vulns.map((v) => [v.id, 0]));
const perDecoy = Object.fromEntries(manifest.decoys.map((d) => [d.id, 0]));
let validRuns = 0;
const times = [];

for (let i = 0; i < (FIX_ONLY ? 0 : RUNS); i++) {
  const r = claude(REVIEW_PROMPT, 12);
  if (!r.valid) { console.log(`run ${i + 1}: INVALID (excluded)`); continue; }
  validRuns++;
  times.push(r.seconds);
  const hits = [];
  for (const v of manifest.vulns) {
    if (nearFile(r.result, v.file, v.keywords)) { perVuln[v.id]++; hits.push(v.id); }
  }
  const fps = [];
  for (const d of manifest.decoys) {
    if (nearFile(r.result, d.file, manifest.vuln_claim_keywords)) { perDecoy[d.id]++; fps.push(d.id); }
  }
  console.log(`run ${i + 1}: recall ${hits.length}/${manifest.vulns.length} [${hits.join(', ')}]  decoy-FP: ${fps.length ? fps.join(', ') : 'none'}  (${r.seconds.toFixed(0)}s)`);
}

// ---- fix task: does the requested fix land AND leave the project typechecking? ----
let fixResult = 'skipped';
if (!SKIP_FIX && (validRuns > 0 || FIX_ONLY)) {
  const f = manifest.fix_task;
  const r = claude(f.prompt, 12, { acceptEdits: true });
  if (!r.valid) fixResult = 'INVALID run';
  else {
    const src = readFileSync(join(WORKDIR, f.post_checks.file), 'utf8');
    const fixed = f.post_checks.must_match_any.some((re) => new RegExp(re).test(src));
    let tsOk = 'n/a';
    if (f.post_checks.typecheck) {
      const ts = spawnSync('npx', ['-y', '-p', 'typescript@5.6', 'tsc', '--noEmit'], {
        cwd: WORKDIR, encoding: 'utf8', timeout: 240_000,
      });
      tsOk = ts.status === 0 ? 'PASS' : `FAIL\n${(ts.stdout || ts.stderr || '').slice(0, 500)}`;
    }
    // must_match_any encodes the HOUSE STANDARD (zod at the boundary) — "NO" means
    // the fix isn't standard-conformant, not necessarily that nothing was fixed
    // (verified: the rules-off baseline hand-rolls typeof checks instead of zod).
    fixResult = `standard-conformant fix (zod): ${fixed ? 'YES' : 'NO'} / typecheck: ${tsOk}`;
    console.log(`\nfix task (${f.target}): ${fixResult.split('\n')[0]}`);
  }
}

const version = execFileSync('git', ['-C', root, 'describe', '--tags', '--always', '--dirty'], { encoding: 'utf8' }).trim();
mkdirSync(join(root, 'eval', 'reports'), { recursive: true });
const modeTag = BASELINE ? '-baseline' : '';
let reportPath = join(root, 'eval', 'reports', `${version}-outcome${modeTag}-${RUNS}runs.md`);
for (let n = 2; existsSync(reportPath); n++) reportPath = join(root, 'eval', 'reports', `${version}-outcome${modeTag}-${RUNS}runs-${n}.md`);

const recallTotal = Object.values(perVuln).reduce((a, b) => a + b, 0);
const fpTotal = Object.values(perDecoy).reduce((a, b) => a + b, 0);
writeFileSync(reportPath, `# Outcome-quality bench — ${BASELINE ? `BASELINE (rules NOT installed) — control for: ${version}` : `rules under test: ${version} (working tree)`}

- Mode: planted-vulnerability recall (security review) + fix smoke · runs: ${validRuns}/${RUNS} valid${BASELINE ? ' · **A/B control: no .claude/, no CLAUDE.md — measures the model alone**' : ''}
- Model: ${MODEL || 'session default'} · avg review time: ${times.length ? (times.reduce((a, b) => a + b, 0) / times.length).toFixed(0) : '-'}s
- **Recall: ${recallTotal}/${manifest.vulns.length * validRuns} vuln-detections across runs** · **Decoy false positives: ${fpTotal}/${manifest.decoys.length * validRuns}**
- Grading: transparent file+keyword matching vs expected-findings.json (an LLM-free grader — misses
  paraphrases; treat as a floor, not a ceiling). Fix smoke: ${fixResult.split('\n')[0]}

| planted vuln | detected |
|---|---|
${manifest.vulns.map((v) => `| ${v.id} (${v.file}) | ${perVuln[v.id]}/${validRuns} |`).join('\n')}

| benign decoy | falsely flagged |
|---|---|
${manifest.decoys.map((d) => `| ${d.id} (${d.file}) | ${perDecoy[d.id]}/${validRuns} |`).join('\n')}
`);
console.log(`\nreport: ${reportPath.slice(root.length + 1)}`);
if (!KEEP) rmSync(WORKDIR, { recursive: true, force: true });
