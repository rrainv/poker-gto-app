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

test('BTN, UTG, and SB use their zero-facing unopened fallback paths', async () => {
  const expected = {
    BTN: { open: 0.95, call: 0, fold: 0.050000000000000044 },
    UTG: { open: 0.8289050497374995, call: 0, fold: 0.17109495026250054 },
    SB: { open: 0.85, call: 0.1, fold: 0.05 },
  };

  for (const [heroPos, strategy] of Object.entries(expected)) {
    const capture = await qa.captureContext({ heroPos, lastAction: 'unopened', facingSize: 1, potSize: 1.5, stack: 30 });
    assert.deepEqual(
      qa.fallback('T', '9', false, true, heroPos, capture.decisionContext.lastAction, capture.decisionContext.facingSizeBb, 1.5, 30),
      strategy,
    );
  }
});

test('BB unopened context retains its separate free-check fallback behavior', async () => {
  const capture = await qa.captureContext({ heroPos: 'BB', lastAction: 'unopened', facingSize: 4, potSize: 1.5, stack: 30 });
  assert.equal(capture.decisionContext.facingSizeBb, 0);
  assert.deepEqual(
    qa.fallback('T', '9', false, true, 'BB', 'unopened', capture.decisionContext.facingSizeBb, 1.5, 30),
    { open: 0.85, call: 0.15000000000000002, fold: 0 },
  );
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

test('six-max and full-ring position outputs are otherwise unchanged', () => {
  const positions = ['UTG', 'UTG+1', 'UTG+2', 'MP', 'LJ', 'HJ', 'CO', 'BTN', 'SB', 'BB'];
  const expectedOpen = [
    0.7635148952387287,
    0.7874053287886007,
    0.8109096821195613,
    0.8289050497374995,
    0.8574442516811659,
    0.8817574476193645,
    0.9134470710684999,
    0.95,
    0.85,
    0.85,
  ];

  assert.deepEqual(
    positions.map((position) => qa.fallback('T', '8', false, true, position, 'unopened', 0, 1.5, 30).open),
    expectedOpen,
  );
});
