const test = require('node:test');
const assert = require('node:assert/strict');

const qa = require('./qa002_adapters');

const FULL_RING_ORDER = ['UTG', 'UTG+1', 'UTG+2', 'MP', 'LJ', 'HJ', 'CO', 'BTN'];

test('every supported fallback position has an explicit modifier', () => {
  assert.deepEqual(qa.fallbackPositionModifiers(), {
    UTG: -4,
    'UTG+1': -3.6,
    'UTG+2': -3.2,
    MP: -2.8,
    LJ: -2.4,
    HJ: -2,
    CO: -0.5,
    BTN: 1,
    SB: 1.5,
    BB: 3,
  });
});

test('full-ring non-blind modifiers increase monotonically by table position', () => {
  const modifiers = qa.fallbackPositionModifiers();
  for (let index = 1; index < FULL_RING_ORDER.length; index += 1) {
    assert.ok(modifiers[FULL_RING_ORDER[index]] > modifiers[FULL_RING_ORDER[index - 1]]);
  }
});

test('extended positions no longer produce the UTG fallback output', () => {
  const utg = qa.fallback('T', '8', false, true, 'UTG', 'unopened', 0, 1.5, 30);
  for (const position of ['UTG+1', 'UTG+2', 'MP', 'LJ']) {
    assert.notDeepEqual(qa.fallback('T', '8', false, true, position, 'unopened', 0, 1.5, 30), utg);
  }
});

test('a marginal unopened hand becomes weakly looser from UTG through BTN', () => {
  const strategies = FULL_RING_ORDER.map((position) => (
    qa.fallback('T', '8', false, true, position, 'unopened', 0, 1.5, 30)
  ));

  for (let index = 1; index < strategies.length; index += 1) {
    assert.ok(strategies[index].open >= strategies[index - 1].open);
    assert.ok(strategies[index].fold <= strategies[index - 1].fold);
  }

  for (const strategy of strategies) assert.equal(strategy.call, 0);
});

test('six-max unopened outputs remain unchanged', () => {
  const expected = {
    UTG: { open: 0.7635148952387287, call: 0, fold: 0.23648510476127127 },
    HJ: { open: 0.8817574476193645, call: 0, fold: 0.11824255238063552 },
    CO: { open: 0.9134470710684999, call: 0, fold: 0.08655292893150013 },
    BTN: { open: 0.95, call: 0, fold: 0.050000000000000044 },
    SB: { open: 0.85, call: 0.1, fold: 0.05 },
    BB: { open: 0.85, call: 0.15000000000000002, fold: 0 },
  };

  for (const [position, strategy] of Object.entries(expected)) {
    assert.deepEqual(qa.fallback('T', '8', false, true, position, 'unopened', 0, 1.5, 30), strategy);
  }
});

test('six-max raised-pot outputs remain unchanged', () => {
  const expected = {
    UTG: { open: 0.05596014610110588, call: 0.5178804383033176, fold: 0.1 },
    HJ: { open: 0.13259191841268303, call: 0.6282720543915447, fold: 0.1 },
    CO: { open: 0.29150086743475356, call: 0.5223327550434976, fold: 0.1 },
    BTN: { open: 0.4939509888156627, call: 0.38736600745622485, fold: 0.1 },
    SB: { open: 0.06344707106849976, call: 0.5403412132054992, fold: 0.1 },
    BB: { open: 0.1429072592045993, call: 0.6213951605302672, fold: 0.1 },
  };

  for (const [position, strategy] of Object.entries(expected)) {
    assert.deepEqual(qa.fallback('7', '7', true, false, position, '3bet', 9, 10, 30), strategy);
  }
});

test('SB and BB retain their raised-pot overrides', () => {
  assert.deepEqual(
    qa.fallback('7', '7', true, false, 'SB', '3bet', 9, 10, 30),
    { open: 0.06344707106849976, call: 0.5403412132054992, fold: 0.1 },
  );
  assert.deepEqual(
    qa.fallback('7', '7', true, false, 'BB', '3bet', 9, 10, 30),
    { open: 0.1429072592045993, call: 0.6213951605302672, fold: 0.1 },
  );
});
