import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const logic = fs.readFileSync(new URL('../app/src/core/logic.js', import.meta.url), 'utf8');

function sourceBetween(start, end) {
  const from = logic.indexOf(start);
  const to = logic.indexOf(end, from);
  assert.ok(from >= 0, `missing ${start}`);
  assert.ok(to > from, `missing ${end}`);
  return logic.slice(from, to);
}

test('the card picker builds its deck only while open and detaches it on close', () => {
  const open = sourceBetween('function openPicker(', 'function renderDeck(');
  const close = sourceBetween('function closePicker(', 'function clearGroup(');
  assert.match(open, /renderDeck\(\)/);
  assert.match(close, /\$\('#deck'\)\?\.replaceChildren\?\.\(\)/);
});

test('picker unmounting moves focus to the selected or originating card slot', () => {
  const open = sourceBetween('function openPicker(', 'function renderDeck(');
  const select = sourceBetween('function selectCard(', 'function closePicker(');
  const close = sourceBetween('function closePicker(', 'function clearGroup(');
  assert.match(open, /pickerFocusTarget\?\.focus\?\.\(\{ preventScroll: true \}\)/);
  assert.match(select, /closePicker\(\{ restoreFocus: false \}\)/);
  assert.match(select, /appearedCard\.focus\(\{ preventScroll: true \}\)/);
  assert.match(close, /focusWasInsidePicker/);
  assert.match(close, /focusTarget\?\.focus\?\.\(\{ preventScroll: true \}\)/);
});

test('targeted picker cleanup leaves Matrix caching and postflop zero-cell behavior intact', () => {
  const chart = sourceBetween('function renderChart()', 'function matrixStrategyKey(');
  assert.match(chart, /if \(isPostFlop\) \{[\s\S]*grid\.replaceChildren\(\)[\s\S]*return;/);
  assert.match(chart, /if \(grid\.children\.length === 0\)/);
  assert.match(chart, /bindMatrixGridInteractions\(grid\)/);
  assert.doesNotMatch(chart, /#deck|closePicker/);
});
