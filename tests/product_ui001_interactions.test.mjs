import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const logic = fs.readFileSync(new URL('../app/src/core/logic.js', import.meta.url), 'utf8');
const html = fs.readFileSync(new URL('../app/index.html', import.meta.url), 'utf8');
const css = fs.readFileSync(new URL('../app/styles.css', import.meta.url), 'utf8');

function between(start, end) {
  const from = logic.indexOf(start);
  const to = logic.indexOf(end, from);
  assert.ok(from >= 0, `missing ${start}`);
  assert.ok(to > from, `missing ${end}`);
  return logic.slice(from, to);
}

test('toast lifecycle supersedes, expires, and clears stale accessible text', () => {
  const lifecycle = between('function clearToast()', 'function bindEvents()');
  assert.match(lifecycle, /window\.clearTimeout\(toast\.timer\)/);
  assert.match(lifecycle, /element\.textContent = ''/);
  assert.match(lifecycle, /toast\.sequence/);
  assert.match(lifecycle, /element\.dataset\.scope = scope/);
  assert.match(lifecycle, /if \(toast\.sequence === sequence\) clearToast\(\)/);
  assert.match(html, /id="toast" role="status" aria-live="polite" aria-atomic="true"/);
});

test('mode and modal transitions clear workflow-scoped transient feedback', () => {
  const events = between('function bindEvents()', 'const localizedStrategyProfile');
  assert.match(events, /const mode = button\.dataset\.mode;[\s\S]{0,240}?clearToast\(\)/);
  assert.match(events, /#openSettings[\s\S]*?clearToast\(\)/);
  assert.match(logic, /function applyCanonicalHandAction[\s\S]*?else \{\s*clearToast\(\)/);
});

test('analysis navigation selects, reveals, and focuses its actual destination', () => {
  const events = between('function bindEvents()', 'const localizedStrategyProfile');
  assert.match(events, /const revealPlaybookDestination/);
  assert.match(events, /destination\.scrollIntoView/);
  assert.match(events, /control\?\.focus\?\.\(\{ preventScroll: true \}\)/);
  assert.match(events, /selectPlaybookAnalysisView\(el, true\)/);
  assert.match(events, /prefers-reduced-motion/);
});

test('sidebar state has concrete expanded and collapsed layout contracts at narrow desktop widths', () => {
  assert.match(logic, /shell\.dataset\.sidebarState = collapsed \? 'collapsed' : 'expanded'/);
  assert.match(logic, /rail\.dataset\.expanded = String\(!collapsed\)/);
  assert.match(css, /data-sidebar-state="expanded"\] \{ grid-template-columns: var\(--sidebar-expanded-width\)/);
  assert.match(css, /data-sidebar-state="collapsed"\] \{ grid-template-columns: var\(--sidebar-collapsed-width\)/);
  assert.match(css, /data-sidebar-state="expanded"\] \.mode-nav-item > span/);
});

test('Hand presentation reads the isolated canonical deck and gates showdown resolution', () => {
  const cards = between('function renderPlaybookCards()', 'function renderEquityCards()');
  assert.match(cards, /remainingCards\(isHandMode\(\) \? 'hand' : 'gto'\)/);
  assert.match(logic, /const canResolveShowdown = state\?\.phase === 'showdown' && state\?\.showdown\?\.status === 'ready'/);
  assert.match(logic, /handResolveShowdownButton'\)\.disabled = !canResolveShowdown/);
});

test('Training study hints and pricing copy remain truthful before and after an answer', () => {
  assert.match(html, /id="trainingSolutionEyebrow"/);
  assert.match(html, /id="trainingRevealHint"/);
  assert.doesNotMatch(html, /id="trainingShowSolution"|Study mode preview/);
  assert.match(html, /Get a nudge about the spot\./);
  assert.match(html, />Get a hint<\/button>/);
  assert.doesNotMatch(html, /Hints never reveal|never reveal the answer|does not change grading/i);
  const solution = between('function showTrainingSolution(solution)', 'function updateTrainingStats()');
  assert.match(solution, /After-answer reference/);
  assert.doesNotMatch(solution, /Strategy preview|lifecycle === 'ready'/);
  const pricing = between('function formatTrainingFacingCopy', 'function trainingActionLabel');
  assert.match(pricing, /Math\.abs\(facingSize - callAmount\) > 0\.001/);
  assert.match(pricing, /t\('\{value\} bb to call', \{ value: callAmount\.toFixed\(1\) \}\)/);
  assert.doesNotMatch(pricing, /\(\$\{facingSize\.toFixed\(1\)\} bb to\)/);
  const answer = between('function handleTrainingGuess(', 'function replayTrainingExercise(');
  assert.match(answer, /callTrainingServiceBridge\('answer', exercise\.id, userAction\)/);
  assert.match(answer, /renderTrainingDecisionAnalysis\(exercise\)[\s\S]*showTrainingSolution\(app\.training\.currentSolution\)/);
});
