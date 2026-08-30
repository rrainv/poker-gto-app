import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const logic = fs.readFileSync(new URL('../app/src/core/logic.js', import.meta.url), 'utf8');
const css = fs.readFileSync(new URL('../app/styles.css', import.meta.url), 'utf8');

function sourceBetween(start, end) {
  const from = logic.indexOf(start);
  const to = logic.indexOf(end, from);
  assert.ok(from >= 0, `missing ${start}`);
  assert.ok(to > from, `missing ${end}`);
  return logic.slice(from, to);
}

test('the card picker builds its deck only while open and detaches it on close', () => {
  const open = sourceBetween('function openPicker(', 'function renderDeck(');
  const render = sourceBetween('function renderDeck()', 'function updateDeckCardStates(');
  const update = sourceBetween('function updateDeckCardStates(', 'function cardSetPickerScope(');
  const select = sourceBetween('function selectCard(', 'function cardSetPickerFocusTarget(');
  const clear = sourceBetween('function clearPrivateHandPicker(', 'function cardPickerFocusableElements(');
  const close = sourceBetween('function closePicker(', 'function clearGroup(');
  assert.match(open, /renderDeck\(\)/);
  assert.match(render, /deck\.innerHTML = SUITS\.map/);
  assert.match(update, /!Array\.isArray\(changedCards\) \|\| changedCards\.length === 0/);
  assert.match(update, /changedCards\s*\.map\(\(card\) => document\.querySelector/);
  assert.doesNotMatch(update, /querySelectorAll/);
  assert.match(update, /classList\.toggle\('is-selected', isSelected\)/);
  assert.match(update, /control\.disabled = isUnavailable/);
  assert.match(update, /setAttribute\('aria-pressed', String\(isSelected\)\)/);
  assert.doesNotMatch(update, /innerHTML|replaceChildren/);
  assert.match(select, /updateDeckCardStates\(\[card\]\)/);
  assert.doesNotMatch(select, /renderDeck\(\)|innerHTML|replaceChildren/);
  assert.match(clear, /const changedCards = picker\.draft\.slice\(\)/);
  assert.match(clear, /updateDeckCardStates\(changedCards\)/);
  assert.doesNotMatch(clear, /renderDeck\(\)|innerHTML|replaceChildren/);
  assert.doesNotMatch(`${select}\n${clear}`, /createRangeAnalysisFacts|equityRangeAnalysisFacts|setEquityPending/);
  assert.match(close, /\$\('#deck'\)\?\.replaceChildren\?\.\(\)/);
  assert.match(css, /#cardModal\s*\{\s*backdrop-filter:\s*none/);
  assert.match(css, /#cardModal \.deck-card\s*\{[^}]*box-shadow:\s*none[^}]*transition:\s*none/s);
});

test('picker keeps focus in the draft deck and restores it to the originating set editor on close', () => {
  const open = sourceBetween('function openPicker(', 'function renderDeck(');
  const select = sourceBetween('function selectCard(', 'function closePicker(');
  const close = sourceBetween('function closePicker(', 'function clearGroup(');
  assert.match(open, /pickerFocusTarget\?\.focus\?\.\(\{ preventScroll: true \}\)/);
  assert.match(select, /const selectedControl = document\.querySelector\(`\[data-deck-card="\$\{card\}"\]`\)/);
  assert.match(select, /document\.activeElement !== selectedControl/);
  assert.match(select, /function finishCardSetCommit[\s\S]*closePicker\(\{ restoreFocus: false \}\)/);
  assert.match(select, /focusTarget\?\.focus\?\.\(\{ preventScroll: true \}\)/);
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
