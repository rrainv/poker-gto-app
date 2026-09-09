import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
test('expanded Explain owns pointer hit testing, wheel scroll, and nested controls', () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'riverline-explain-panel-'));
  const resultPath = path.join(temp, 'result.json');
  const env = { ...process.env }; delete env.ELECTRON_RUN_AS_NODE;
  const run = spawnSync(path.join(root, 'node_modules', 'electron', 'dist', 'electron.exe'), [
    path.join(root, 'tests', 'tooling', 'explain_panel_interaction001_worker.cjs'),
    `--user-data=${path.join(temp, 'user-data')}`, `--result=${resultPath}`
  ], { cwd: root, env, encoding: 'utf8', timeout: 30_000 });
  assert.equal(run.error, undefined, run.error?.message);
  assert.equal(run.status, 0, run.stderr || run.stdout);
  assert.ok(fs.existsSync(resultPath), 'Explain browser worker must produce interaction evidence');
  const observed = JSON.parse(fs.readFileSync(resultPath, 'utf8'));
  assert.equal(observed.error, undefined, observed.error);
  assert.ok(observed.scrollHeight > observed.clientHeight);
  assert.equal(observed.panelHitOwned, true);
  assert.equal(observed.summaryHitOwned, true);
  assert.equal(observed.wheelReceived, true, 'a real browser wheel event must reach Explain');
  assert.equal(observed.scrollObserved, true, 'the overflowing panel must emit a scroll event');
  assert.ok(observed.scrollTop > 0);
  assert.equal(observed.detailOpen, true);
});
