import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const logic = fs.readFileSync(new URL('../app/src/core/logic.js', import.meta.url), 'utf8');
const html = fs.readFileSync(new URL('../app/index.html', import.meta.url), 'utf8');

const legacyGeneratorStart = logic.indexOf('function newRandomTrainingHandLegacy');
const generatorStart = legacyGeneratorStart >= 0
  ? legacyGeneratorStart
  : logic.indexOf('function newRandomTrainingHand');
const generatorEnd = logic.indexOf('function handleTrainingGuessLegacy', generatorStart) >= 0
  ? logic.indexOf('function handleTrainingGuessLegacy', generatorStart)
  : logic.indexOf('function handleTrainingGuess', generatorStart);
const legacyGenerator = logic.slice(generatorStart, generatorEnd);
const legacyGradingStart = logic.indexOf('function handleTrainingGuessLegacy');
const gradingStart = legacyGradingStart >= 0
  ? legacyGradingStart
  : logic.indexOf('function handleTrainingGuess');
const canonicalBoundary = logic.indexOf('const TRAINING_CONFIG_SCHEMA_VERSION', gradingStart);
const gradingEnd = canonicalBoundary >= 0
  ? canonicalBoundary
  : logic.indexOf('// Expose training functions globally', gradingStart);
const legacyGrading = logic.slice(gradingStart, gradingEnd);

test('legacy Training independently manufactures a final scenario rather than replaying PokerState', () => {
  for (const source of [
    'streetRoll', 'randomTrainingTableSize', 'randomTrainingPosition',
    'sampleRealisticTrainingHand', 'sampleRealisticBoard',
    'potSize', 'facingSize', 'lastAction',
  ]) assert.match(legacyGenerator, new RegExp(source), source);
  assert.doesNotMatch(legacyGenerator, /initializeHand|getLegalActionSpec|applyAction|applyChance/);
});

test('legacy Training street and stack distributions are characterized', () => {
  assert.match(legacyGenerator, /streetRoll > 0\.95/);
  assert.match(legacyGenerator, /streetRoll > 0\.85/);
  assert.match(legacyGenerator, /streetRoll > 0\.60/);
  assert.match(legacyGenerator, /\[15, 20, 30, 50, 100\]/);
  assert.match(logic, /Math\.floor\(Math\.random\(\) \* 9\) \+ 2/);
});

test('legacy Training action and pot construction can combine unrelated synthetic values', () => {
  assert.match(legacyGenerator, /\['unopened', 'raise', '3bet'\]/);
  assert.match(legacyGenerator, /\['check', 'bet', 'raise'\]/);
  assert.match(legacyGenerator, /basePot = boardCount === 3 \? 6\.5 : boardCount === 4 \? 16\.0 : 35\.0/);
  assert.match(legacyGenerator, /potSize \* 0\.75/);
});

test('legacy Training answer scoring is highest-action family binary', () => {
  assert.match(legacyGrading, /Object\.entries\(solution\)\.sort/);
  assert.match(legacyGrading, /let isCorrect = uLower === bLower/);
  assert.match(legacyGrading, /app\.training\.stats\.totalHands\+\+/);
  assert.match(legacyGrading, /app\.training\.stats\.streak = 0/);
  assert.doesNotMatch(legacyGrading, /chosenProbability|bestProbability|acceptable/);
});

test('legacy feedback contains overstated solver and GTO labels', () => {
  const feedback = logic.slice(
    logic.indexOf('function generateFeedback'),
    logic.indexOf('function updateAssistanceDisplay'),
  );
  assert.match(feedback, /Optimal GTO Decision|Textbook GTO Play/);
  assert.match(feedback, /Solver heavily favors|GTO strongly prefers/);
  assert.match(feedback, /Math\.random/);
});

test('current Training controls cover canonical filters, 2 through 10, 10 through 500bb, and assistance', () => {
  const trainingHtml = html.slice(html.indexOf('id="trainingMode"'), html.indexOf('id="infoMode"'));
  assert.match(trainingHtml, /id="trainingPlayers"[^>]+min="2" max="10"/);
  assert.match(trainingHtml, /id="trainingStack"[^>]+min="10" max="500"/);
  assert.match(trainingHtml, /id="trainingHeroPos"/);
  assert.match(trainingHtml, /id="trainingStreet"/);
  assert.match(trainingHtml, /id="trainingDecisionTarget"/);
  assert.match(trainingHtml, /id="trainingDifficulty"/);
  assert.match(trainingHtml, /value="hard"[\s\S]*value="easy"[\s\S]*value="guided"/);
  assert.match(trainingHtml, /id="trainingSeedInput"/);
  assert.doesNotMatch(legacyGenerator, /difficulty|trainingDifficulty/);
});

test('legacy session metrics are in-memory totals, accepted count, accuracy, and streak', () => {
  assert.match(logic, /stats: \{ totalHands: 0, correct: 0, streak: 0 \}/);
  assert.match(logic, /correct \/ app\.training\.stats\.totalHands \* 100/);
  assert.doesNotMatch(logic.slice(
    logic.indexOf('function updateTrainingStats'),
    logic.indexOf('function formatHand'),
  ), /localStorage|indexedDB|fetch/);
});
