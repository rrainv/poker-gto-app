import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const html = fs.readFileSync(new URL('../app/index.html', import.meta.url), 'utf8');
const css = fs.readFileSync(new URL('../app/styles.css', import.meta.url), 'utf8');
const logic = fs.readFileSync(new URL('../app/src/core/logic.js', import.meta.url), 'utf8');
const table = fs.readFileSync(new URL('../app/src/ui/TableRenderer.js', import.meta.url), 'utf8');
const trainingPresentation = fs.readFileSync(new URL('../app/src/application/training-presentation.mjs', import.meta.url), 'utf8');

const trainingHtml = html.slice(html.indexOf('id="trainingMode"'), html.indexOf('id="equityMode"'));
const solution = logic.match(/function showTrainingSolution\(solution\)[\s\S]*?\n\}/)?.[0] ?? '';

test('known cards share Riverline presentation hooks across primary, Training, picker, and table surfaces', () => {
  assert.match(logic, /class="card-slot[^"`]*riverline-card/);
  assert.match(logic, /class="training-readonly-card riverline-card"/);
  assert.match(logic, /class="deck-card[^"`]*riverline-card/);
  assert.match(table, /poker-card-svg riverline-card card--known/);
  assert.match(table, /riverline-card-face table-card-face/);
  assert.match(table, /riverline-card-rank table-card-rank/);
  assert.match(table, /riverline-card-suit table-card-suit/);
  assert.match(css, /\.riverline-card\s*\{[^}]*--riverline-card-face:\s*var\(--card-face\)[^}]*--riverline-card-border:\s*var\(--card-border\)/);
});

test('table known cards use the DESIGN-005 face family and approximately 0.70 proportions', () => {
  assert.match(table, /class="riverline-card-face table-card-face"[^>]+width="40" height="57" rx="5" ry="5"/);
  assert.match(table, /class="riverline-card-corner-rank table-card-corner-rank/);
  assert.match(css, /\.table-card-face\s*\{[^}]*fill:\s*var\(--riverline-card-face/);
  assert.match(css, /\.table-card-rank\s*\{[^}]*Georgia/);
  assert.match(css, /\.table-card-suit\s*\{[^}]*Georgia/);
  assert.ok(Math.abs((40 / 57) - 0.70) < 0.01);
});

test('T and 10 remain presentation-only and do not affect A K Q or J sizing', () => {
  assert.match(table, /const visualRank = rank === 'T'/);
  assert.match(table, /document\.documentElement\.dataset\.cardRankStyle === 'full-ten'/);
  assert.match(logic, /const card = rank \+ suit\.id/);
  assert.match(logic, /data-deck-card="\$\{card\}"/);
  assert.match(logic, /const rankClass = rank === '10' \? ' rank--ten' : ''/);
  assert.match(table, /const rankClass = visualRank === '10' \? ' table-card-rank--ten' : ''/);
  assert.doesNotMatch(css, /\[data-card-rank-style="full-ten"\][^{]*\.(?:rank|table-card-rank)/);
});

test('unknown table card backs retain their semantic and privacy presentation', () => {
  const back = table.match(/renderCardBack\(index\)\s*\{[\s\S]*?\n  \}/)?.[0] ?? '';
  assert.match(back, /poker-card-back/);
  assert.match(back, /data-card-state="unknown"/);
  assert.match(back, /table-card-back-face/);
  assert.match(back, /table-card-back-line/);
  assert.match(back, /table-card-back-mark/);
  assert.doesNotMatch(back, /data-card-state="known"/);
});

test('Training after-answer keeps the analytical stack and both textual state markers without a wheel', () => {
  assert.match(trainingHtml, /id="trainingFrequencyStack"/);
  assert.match(trainingHtml, /id="trainingFrequencyRows"/);
  assert.doesNotMatch(trainingHtml, /trainingWheel|training-wheel-secondary/);
  assert.match(solution, /training-frequency-label/);
  assert.match(solution, /training-frequency-marker--chosen/);
  assert.match(solution, /textContent:\s*'Chosen'/);
  assert.match(solution, /training-frequency-marker--highest/);
  assert.match(solution, /textContent:\s*'Highest'/);
  assert.match(solution, /setAttribute\('aria-label'/);
});

test('Training leading and chosen rows use calm accents rather than a dominant outline', () => {
  assert.doesNotMatch(css, /\.training-frequency-row\.is-chosen\s*\{[^}]*outline:/);
  assert.match(css, /\.training-frequency-row\.is-best\s*\{[^}]*border-inline-start-color:\s*var\(--action-visual/);
  assert.match(css, /\.training-frequency-row\.is-chosen\s*\{[^}]*background:\s*color-mix/);
  assert.match(css, /\.training-frequency-marker\s*\{[^}]*min-width:[^}]*white-space:\s*nowrap/);
});

test('Training probability normalization and displayed facts are unchanged', () => {
  assert.match(solution, /Array\.isArray\(solution\)/);
  assert.match(logic, /function strategyResultPresentationActions\(result\)/);
  assert.doesNotMatch(solution, /actionsList\.reduce|rem -= act\.pct|act\.pct\s*=/);
  assert.match(logic, /trainingChosenProbability[^\n]*evaluation\.chosenProbability \* 100/);
  assert.match(logic, /trainingBestProbability[^\n]*evaluation\.bestProbability \* 100/);
});

test('Session Progress exposes explicit cells and restrained internal dividers', () => {
  assert.match(trainingHtml, /class="training-stat-grid"[^>]+role="list"[^>]+aria-label="Session summary"/);
  for (const metric of ['attempts', 'accepted', 'acceptance', 'streak', 'best-streak']) {
    assert.match(trainingHtml, new RegExp(`class="training-stat-cell"[^>]+data-training-stat="${metric}"[^>]+role="listitem"`));
  }
  for (const id of ['trainingTotalHands', 'trainingCorrect', 'trainingAccuracy', 'trainingStreak', 'trainingBestStreak']) {
    assert.match(trainingHtml, new RegExp(`id="${id}"`));
  }
  assert.match(css, /\.training-stat-grid\s*\{[^}]*gap:\s*1px[^}]*background:\s*var\(--border-subtle\)/);
  assert.match(css, /\.training-stat-grid strong\s*\{[^}]*font-variant-numeric:\s*tabular-nums/);
  assert.match(css, /\.training-grade-counts\s*\{[^}]*border-top:/);
});

test('muted action tokens retain the stable Fold passive aggressive all-in and mixed mapping', () => {
  const expected = {
    fold: '#68716c',
    passive: '#4f8f99',
    aggressive: '#b27e4d',
    'all-in': '#a85f70',
    mixed: '#796f91',
  };
  for (const [name, color] of Object.entries(expected)) {
    assert.match(css, new RegExp(`--action-${name}:\\s*${color}`, 'i'));
  }
  assert.match(css, /training-action-button--fold[^}]*var\(--action-fold\)/);
  assert.match(css, /training-action-button--call[^}]*var\(--action-passive\)/);
  assert.match(css, /training-action-button--raise[^}]*var\(--action-aggressive\)/);
  assert.match(css, /training-action-button--all_in[^}]*var\(--action-all-in\)/);
  assert.match(css, /\.training-action-button\s*\{[^}]*border-inline-start-width:\s*3px/);
  assert.doesNotMatch(css, /--action-passive:\s*#(?:00ffff|00e5ff|0ff)\b/i);
});

test('UI-QA-002A remains presentation-only and leaves the Range Matrix deferred', () => {
  for (const symbol of ['deriveDecisionContext', 'strategyProvider.resultSchemaVersion', 'calculateEquity', 'handleTrainingGuess']) {
    assert.match(logic, new RegExp(symbol));
  }
  assert.match(trainingPresentation, /schemaVersion/);
  assert.match(css, /grid-template-columns:\s*repeat\(13/);
  assert.match(html, /id="strategyGrid"/);
  assert.doesNotMatch(table, /PokerState|DecisionContext|StrategyResult|calculateEquity|regret|MCCFR/);
});
