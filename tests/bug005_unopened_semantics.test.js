const test = require('node:test');
const assert = require('node:assert/strict');

const qa = require('./qa002_adapters');

test('unopened Playbook contexts use zero facing size for BTN, UTG, and SB', async () => {
  for (const heroPos of ['BTN', 'UTG', 'SB']) {
    const capture = await qa.captureContext({ heroPos, lastAction: 'unopened', facingSize: 12 });
    assert.equal(capture.decisionContext.lastAction, 'unopened');
    assert.equal(capture.decisionContext.facingSizeBb, 0);
    assert.equal(capture.facingControl, 0);
    assert.equal(capture.facingNumberControl, 0);
  }
});

test('BTN, UTG, and SB use normalized zero-facing unopened paths', async () => {
  const strategies = {};
  for (const heroPos of ['BTN', 'UTG', 'SB']) {
    const capture = await qa.captureContext({ heroPos, lastAction: 'unopened', facingSize: 1, potSize: 1.5, stack: 30 });
    strategies[heroPos] = qa.fallback(
      'T', '9', false, true, heroPos, capture.decisionContext.lastAction,
      capture.decisionContext.facingSizeBb, 1.5, 30,
    );
    assert.equal(strategies[heroPos].open + strategies[heroPos].call + strategies[heroPos].fold, 1);
  }
  assert.ok(strategies.BTN.open >= strategies.UTG.open);
  assert.equal(strategies.BTN.call, 0);
  assert.equal(strategies.UTG.call, 0);
  assert.ok(strategies.SB.call > 0);
});

test('BB unopened context never folds its free-check option', async () => {
  const capture = await qa.captureContext({ heroPos: 'BB', lastAction: 'unopened', facingSize: 4, potSize: 1.5, stack: 30 });
  assert.equal(capture.decisionContext.facingSizeBb, 0);
  const strategy = qa.fallback(
    'T', '9', false, true, 'BB', 'unopened', capture.decisionContext.facingSizeBb, 1.5, 30,
  );
  assert.equal(strategy.fold, 0);
  assert.equal(strategy.open + strategy.call, 1);
  assert.ok(strategy.call > 0);
});

test('raise, 3-bet, and 4-bet contexts retain their positive facing sizes', async () => {
  for (const [lastAction, facingSize] of [['raise', 2.5], ['3bet', 7.5], ['4bet', 18]]) {
    const capture = await qa.captureContext({ heroPos: 'BTN', lastAction, facingSize });
    assert.equal(capture.decisionContext.lastAction, lastAction);
    assert.equal(capture.decisionContext.facingSizeBb, facingSize);
    assert.equal(Number(capture.facingControl), facingSize);
    assert.equal(Number(capture.facingNumberControl), facingSize);
  }
});

test('canonical Training generation uses zero facing size for an unopened decision', async () => {
  const {
    TRAINING_CONFIG_SCHEMA_VERSION,
    TRAINING_DECISION_TYPES,
    generateTrainingExercise,
  } = await import('../app/src/application/training-generator.mjs');
  const result = generateTrainingExercise({
    schemaVersion: TRAINING_CONFIG_SCHEMA_VERSION,
    tableSize: 6,
    stackBb: 100,
    streets: ['preflop'],
    gameMode: 'home',
    heroPositions: ['BTN'],
    allowedDecisionTypes: [TRAINING_DECISION_TYPES.PREFLOP_UNOPENED],
    difficulty: 'hard',
    seed: 5005,
  }, {
    strategyProvider: { resolve: () => ({
      schemaVersion: 'strategy-result/v1',
      source: 'heuristic_preflop',
      actions: [
        { action: { type: 'fold', amountBb: null, potFraction: null }, label: 'Fold', probability: 0.25, evBb: null },
        { action: { type: 'raise', amountBb: null, potFraction: null }, label: 'Open', probability: 0.75, evBb: null },
      ],
      recommendation: { action: { type: 'raise', amountBb: null, potFraction: null }, label: 'Open' },
      explanation: null,
      confidence: null,
      coverage: null,
      modelVersion: null,
      warnings: [],
      details: null,
    }) },
  });
  assert.equal(result.ok, true, result.error?.message);
  assert.equal(result.exercise.decisionContext.lastAction, 'unopened');
  assert.equal(result.exercise.decisionContext.facingSizeBb, 0);
  assert.equal(result.exercise.presentation.facingBb, 0);
});

test('six-max and full-ring non-blind position outputs remain monotonic', () => {
  const positions = ['UTG', 'UTG+1', 'UTG+2', 'MP', 'LJ', 'HJ', 'CO', 'BTN', 'SB', 'BB'];
  const strategies = positions.map((position) => (
    qa.fallback('T', '8', false, true, position, 'unopened', 0, 1.5, 30)
  ));
  for (let index = 1; index < 8; index += 1) {
    assert.ok(strategies[index].open >= strategies[index - 1].open);
  }
  for (const strategy of strategies) {
    assert.equal(strategy.open + strategy.call + strategy.fold, 1);
  }
});
