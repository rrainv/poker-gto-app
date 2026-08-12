import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const LOGIC = fs.readFileSync(new URL('../app/src/core/logic.js', import.meta.url), 'utf8');

test('Range Matrix gives every cell a local action list and never writes window.actions', () => {
  const renderStart = LOGIC.indexOf('function renderChart()');
  const renderEnd = LOGIC.indexOf('function renderRangeAdvantage()', renderStart);
  assert.ok(renderStart >= 0 && renderEnd > renderStart);
  const renderChart = LOGIC.slice(renderStart, renderEnd);

  assert.match(renderChart, /const hand = handCode\(row, column\);\s+let actions = \[\];/);
  assert.doesNotMatch(renderChart, /(?:window|globalThis)\.actions\s*=/);
  assert.equal((renderChart.match(/\blet actions\s*=/g) || []).length, 1);
  assert.match(renderChart, /const type = \(actions\[0\] && actions\[0\]\.kind\) \|\| 'unavailable';/);
});
