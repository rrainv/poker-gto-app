import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import { createProductionPickerHarness } from './uiqa001r_card_picker_adapter.mjs';

const logic = fs.readFileSync(new URL('../app/src/core/logic.js', import.meta.url), 'utf8');
const html = fs.readFileSync(new URL('../app/index.html', import.meta.url), 'utf8');
const canonicalStart = logic.indexOf("const TRAINING_CONFIG_SCHEMA_VERSION = 'training-config/v1'");
const canonicalTraining = logic.slice(canonicalStart, logic.indexOf('function calculateOuts(', canonicalStart));

test('production Training route uses the canonical bridge and shared StrategyProvider instance', () => {
  assert.ok(canonicalStart >= 0);
  assert.match(canonicalTraining, /callTrainingServiceBridge\('generate', config/);
  assert.match(canonicalTraining, /callTrainingServiceBridge\('generate', config, \{ strategyProvider \}\)/);
  assert.doesNotMatch(canonicalTraining, /actionProfile\(|Math\.random\s*=/);
  assert.match(canonicalTraining, /callTrainingServiceBridge\('answer', exercise\.id, userAction\)/);
  assert.match(logic, /bind\('#trainingNewHand', 'click', \(\) => startConfiguredTrainingSessionWithGuard\(\)\)/);
  assert.match(canonicalTraining, /function trainingSessionIsActive\(\)/);
  assert.match(canonicalTraining, /window\.confirm\(t\(/);
  assert.match(canonicalTraining, /finishTrainingMemorySession\('abandoned'\)/);
  assert.match(canonicalTraining, /callTrainingServiceBridge\('generatePlanned', \{ strategyProvider \}\)/);
  assert.match(logic, /button\.addEventListener\('click', \(\) => \{[\s\S]*?if \(fullHand && \['bet', 'raise'\]\.includes\(type\)\) chooseFullHandTrainingSizedAction\(type\);[\s\S]*?else handleTrainingGuess\(type\);[\s\S]*?\}\)/);
  assert.doesNotMatch(logic, /window\.(?:newRandomTrainingHand|handleTrainingGuess|replayTrainingExercise|resetTrainingStats)\s*=/);
});

test('Training controls become TrainingConfig filters instead of synthetic final-state fields', () => {
  assert.match(canonicalTraining, /function readTrainingConfig\(seed\)/);
  for (const field of [
    'tableSize', 'stackBb', 'streets', 'gameMode', 'heroPositions',
    'allowedDecisionTypes', 'difficulty', 'seed',
  ]) assert.match(canonicalTraining, new RegExp(`${field}[,:]`), field);
  assert.match(canonicalTraining, /trainingContextPresentationAdapter\(decisionContext\)/);
  assert.match(canonicalTraining, /callAmount/);
  assert.match(logic, /range-level reference, not a threshold for this hand/);
});

test('answer controls are rendered only from canonical legal-action availability', () => {
  assert.match(canonicalTraining, /function canonicalTrainingLegalActionTypes\(exercise\)/);
  assert.match(canonicalTraining, /spec\.allIn\?\.available/);
  assert.match(canonicalTraining, /spec\[type\]\?\.available/);
  assert.match(canonicalTraining, /canonicalTrainingLegalActionTypes\(exercise\)\.forEach/);
  assert.doesNotMatch(canonicalTraining, /isPreflopUnopened[\s\S]*solKeys/);
});

test('Training cards are generated read-only projections and manual mutation paths are guarded', () => {
  const picker = createProductionPickerHarness();
  picker.openPicker('trainingHero', 0);
  assert.equal(picker.app.picker, null);
  assert.match(canonicalTraining, /app\.training\.hero = \[\.\.\.presentation\.heroCards\]/);
  assert.match(canonicalTraining, /app\.training\.board = \[\.\.\.presentation\.board\]/);
});

test('canonical feedback retains source provenance and avoids unsupported GTO or solver claims', () => {
  const feedback = canonicalTraining.slice(
    canonicalTraining.indexOf('function canonicalTrainingFeedback'),
    canonicalTraining.indexOf('function handleTrainingGuess'),
  );
  assert.match(feedback, /truthPresentation\(trainingTruth\(evaluation\)\)/);
  assert.doesNotMatch(feedback, /Riverline reference|Correct action|Mistake/);
  assert.doesNotMatch(feedback, /\bGTO\b|\bsolver\b|Deep CFR/i);
  assert.match(html, /id="trainingStrategySource"/);
  const trainingMarkup = html.slice(html.indexOf('id="trainingMode"'), html.indexOf('id="infoMode"'));
  assert.doesNotMatch(trainingMarkup, /\bGTO\b|Deep CFR/i);
});

test('Training module bridge loads before classic application logic', () => {
  const bridgeIndex = html.indexOf('src/application/training-mode-bootstrap.mjs');
  const logicIndex = html.indexOf('src/core/logic.js');
  assert.ok(bridgeIndex >= 0);
  assert.ok(bridgeIndex < logicIndex);
});

test('canonical Training errors remain explicit without an alternate fallback route', () => {
  assert.match(canonicalTraining, /renderTrainingGenerationError\(result\?\.error\)/);
  assert.match(canonicalTraining, /code: 'service_unavailable'/);
});
