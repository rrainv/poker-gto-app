#!/usr/bin/env node
// Targeted test runner (TEST-RUNNER-001). Plain Node, no dependencies.
//   node tools/run-tests.mjs --area home,training
//   node tools/run-tests.mjs --files tests/a.test.mjs,tests/b.test.mjs
//   node tools/run-tests.mjs --group smoke        (named group from tests/areas.json: css, smoke)
//   node tools/run-tests.mjs --changed            (git diff against the base, mapped through tests/areas.json)
//   node tools/run-tests.mjs --paths app/src/locales/x.js --list   (same mapping as --changed, for explicit paths)
//   node tools/run-tests.mjs --all
//   node tools/run-tests.mjs --check              (manifest covers every test file exactly once; no run)
// Options: --concurrency N (default 2)  --base <ref> (default origin/codex/stabilization)
//          --timings <file> (per-file durations JSON)  --list (print selection, do not run)
import { spawn, execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'tests/areas.json'), 'utf8'));
const args = process.argv.slice(2);
const opt = (name, fallback) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : fallback; };
const flag = (name) => args.includes(name);
const concurrency = Number(opt('--concurrency', 2));
const base = opt('--base', 'origin/codex/stabilization');
const timingsPath = opt('--timings', path.join(os.tmpdir(), 'riverline-test-timings.json'));

const allTests = fs.readdirSync(path.join(root, 'tests'))
  .filter((f) => /\.test\.m?js$/.test(f)).sort().map((f) => `tests/${f}`);
const norm = (p) => p.replace(/\\/g, '/');
const withDir = (f) => (f.includes('/') ? f : `tests/${f}`);

function globToRegExp(glob) {
  let re = '';
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i];
    if (c === '*' && glob[i + 1] === '*') { re += '.*'; i++; if (glob[i + 1] === '/') i++; }
    else if (c === '*') re += '[^/]*';
    else re += c.replace(/[.+?^${}()|[\]\\]/g, '\\$&');
  }
  return new RegExp(`^${re}$`);
}
const areaTests = (name) => (manifest.areas[name]?.tests ?? manifest.groups[name]?.tests ?? null);

function checkManifest() {
  const seen = new Map(); const problems = [];
  for (const [area, v] of Object.entries(manifest.areas)) {
    for (const f of v.tests) {
      const p = withDir(f);
      if (seen.has(p)) problems.push(`${p} is in both ${seen.get(p)} and ${area}`);
      seen.set(p, area);
    }
  }
  for (const p of allTests) if (!seen.has(p)) problems.push(`${p} is in no area`);
  for (const p of seen.keys()) if (!allTests.includes(p)) problems.push(`${p} is listed but does not exist`);
  for (const [g, v] of Object.entries(manifest.groups)) {
    for (const f of v.tests) if (!allTests.includes(withDir(f))) problems.push(`group ${g}: ${f} does not exist`);
  }
  for (const [g, list] of Object.entries(manifest.alsoRun ?? {})) {
    for (const f of list) if (!allTests.includes(withDir(f))) problems.push(`alsoRun ${g}: ${f} does not exist`);
  }
  const css = allTests.filter((p) => fs.readFileSync(path.join(root, p), 'utf8').includes('styles.css'));
  const listed = new Set(manifest.groups.css.tests.map(withDir));
  for (const p of css) if (!listed.has(p)) problems.push(`group css is missing ${p} (reads styles.css)`);
  return problems;
}

function git(...a) { return execFileSync('git', a, { cwd: root, encoding: 'utf8' }); }

function changedSelection() {
  let paths;
  try {
    paths = new Set([
      ...git('diff', '--name-only', base).split('\n'),
      ...git('ls-files', '--others', '--exclude-standard').split('\n'),
    ].map((s) => norm(s.trim())).filter(Boolean));
  } catch (e) { fail(`--changed: cannot diff against ${base} (${e.message.split('\n')[0]}). Use --base <ref>.`); }
  return selectionFromPaths([...paths]);
}

function selectionFromPaths(paths) {
  const areas = new Set(); const reasons = []; const extra = new Set();
  // alsoRun: path globs that must always add named tests (e.g. locale text -> terminology tests).
  const alsoRunMatchers = Object.entries(manifest.alsoRun ?? {}).map(([g, t]) => [globToRegExp(g), t]);
  const matchers = Object.entries(manifest.areas).map(([n, v]) => [n, v.sources.map(globToRegExp)]);
  for (const p of paths) {
    const hit = [];
    if (/^tests\/[^/]+\.test\.m?js$/.test(p)) { reasons.push(`${p} -> itself`); continue; }
    for (const [n, res] of matchers) if (res.some((r) => r.test(p))) hit.push(n);
    if (p === 'app/styles.css') hit.push('css');
    if (p === 'app/src/core/logic.js' || p === 'app/index.html' || p.startsWith('shared/')) hit.push('smoke');
    if (hit.length === 0) hit.push('misc');
    hit.forEach((h) => areas.add(h));
    reasons.push(`${p} -> ${hit.join(', ')}`);
    for (const [re, tests] of alsoRunMatchers) {
      if (re.test(p)) { tests.forEach((t) => extra.add(withDir(t))); reasons.push(`${p} -> alsoRun ${tests.length} test(s)`); }
    }
  }
  const files = new Set(paths.filter((p) => /^tests\/[^/]+\.test\.m?js$/.test(p) && allTests.includes(p)));
  for (const f of extra) files.add(f);
  for (const a of areas) for (const f of areaTests(a) ?? []) files.add(withDir(f));
  return { files: [...files].sort(), reasons, areas: [...areas] };
}

function fail(msg, code = 2) { console.error(msg); process.exit(code); }

if (flag('--check')) {
  const problems = checkManifest();
  if (problems.length) fail(`areas.json problems:\n  ${problems.join('\n  ')}`, 1);
  console.log(`areas.json OK: ${allTests.length} test files, ${Object.keys(manifest.areas).length} areas, groups ${Object.keys(manifest.groups).join(', ')}`);
  process.exit(0);
}

let files; let notes = [];
if (flag('--all')) files = allTests;
else if (opt('--area')) {
  files = new Set();
  for (const a of opt('--area').split(',')) {
    const t = areaTests(a); if (!t) fail(`Unknown area "${a}". Areas: ${Object.keys(manifest.areas).join(', ')}`);
    t.forEach((f) => files.add(withDir(f)));
  }
  files = [...files].sort();
} else if (opt('--group')) {
  const g = manifest.groups[opt('--group')]; if (!g) fail(`Unknown group. Groups: ${Object.keys(manifest.groups).join(', ')}`);
  files = g.tests.map(withDir);
} else if (opt('--files')) {
  files = opt('--files').split(',').map((f) => withDir(norm(f.trim())));
  for (const f of files) if (!fs.existsSync(path.join(root, f))) fail(`No such test file: ${f}`);
} else if (opt('--paths')) {
  const s = selectionFromPaths(opt('--paths').split(',').map((f) => norm(f.trim())).filter(Boolean)); files = s.files; notes = s.reasons;
} else if (flag('--changed')) {
  const s = changedSelection(); files = s.files; notes = s.reasons;
} else fail('Usage: node tools/run-tests.mjs --area a,b | --group css|smoke | --files p1,p2 | --changed | --all | --check');

if (notes.length) console.log(`Changed paths (vs ${base}):\n  ${notes.join('\n  ')}`);
console.log(`Selected ${files.length} test file(s):\n  ${files.join('\n  ') || '(none)'}`);
if (flag('--list') || files.length === 0) process.exit(0);

// Lock: one suite at a time.
const lockPath = path.join(os.tmpdir(), 'riverline-run-tests.lock');
function alive(pid) { try { process.kill(pid, 0); return true; } catch { return false; } }
function acquire() {
  for (let attempt = 0; attempt < 2; attempt++) {
    try { fs.writeFileSync(lockPath, JSON.stringify({ pid: process.pid, started: new Date().toISOString() }), { flag: 'wx' }); return; }
    catch (e) {
      if (e.code !== 'EEXIST') throw e;
      let held = {}; try { held = JSON.parse(fs.readFileSync(lockPath, 'utf8')); } catch { /* corrupt lock */ }
      if (held.pid && alive(held.pid)) fail(`Another test run is active (pid ${held.pid}, started ${held.started}). Never run two suites at once. Lock: ${lockPath}`, 3);
      fs.rmSync(lockPath, { force: true });
    }
  }
  fail(`Could not acquire ${lockPath}`, 3);
}
acquire();
const release = () => { try { fs.rmSync(lockPath, { force: true }); } catch { /* ignore */ } };
process.on('exit', release);
for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => process.exit(130));

const results = []; const t0 = Date.now(); let next = 0;
const num = (out, k) => Number((out.match(new RegExp(`^# ${k} (\\d+)`, 'm')) ?? [])[1] ?? 0);
function runOne(file) {
  return new Promise((resolve) => {
    const start = Date.now(); let out = '';
    const child = spawn(process.execPath, ['--test', '--test-reporter=tap', file], { cwd: root });
    child.stdout.on('data', (d) => { out += d; }); child.stderr.on('data', (d) => { out += d; });
    child.on('close', (code) => {
      const r = { file, seconds: +((Date.now() - start) / 1000).toFixed(2), code,
        total: num(out, 'tests'), pass: num(out, 'pass'), fail: num(out, 'fail'), skip: num(out, 'skipped'), todo: num(out, 'todo') };
      if (code !== 0 && r.fail === 0) r.fail = 1;
      if (code !== 0) r.output = out;
      results.push(r); resolve();
    });
  });
}
async function worker() { while (next < files.length) await runOne(files[next++]); }
await Promise.all(Array.from({ length: Math.max(1, concurrency) }, worker));

const sum = (k) => results.reduce((s, r) => s + r[k], 0);
const secs = +((Date.now() - t0) / 1000).toFixed(1);
for (const r of results.filter((x) => x.code !== 0)) console.log(`\n--- FAILED: ${r.file} ---\n${r.output.split('\n').filter((l) => /not ok|error|Error|expected|actual|at /.test(l)).slice(0, 40).join('\n')}`);
fs.writeFileSync(timingsPath, JSON.stringify({ base, concurrency, seconds: secs, files: results.map(({ output, ...r }) => r).sort((a, b) => b.seconds - a.seconds) }, null, 1));
console.log(`\nSUMMARY files=${files.length} total=${sum('total')} pass=${sum('pass')} fail=${sum('fail')} skip=${sum('skip')} todo=${sum('todo')} seconds=${secs} timings=${timingsPath}`);
process.exit(sum('fail') > 0 ? 1 : 0);
