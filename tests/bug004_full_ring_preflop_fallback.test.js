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

test('six-max unopened outputs are normalized with explicit blind behavior', () => {
  const strategies = Object.fromEntries(['UTG', 'HJ', 'CO', 'BTN', 'SB', 'BB'].map((position) => [
    position,
    qa.fallback('T', '8', false, true, position, 'unopened', 0, 1.5, 30),
  ]));
  for (const strategy of Object.values(strategies)) {
    assert.equal(strategy.open + strategy.call + strategy.fold, 1);
  }
  assert.ok(strategies.UTG.open <= strategies.HJ.open);
  assert.ok(strategies.HJ.open <= strategies.CO.open);
  assert.ok(strategies.CO.open <= strategies.BTN.open);
  assert.equal(strategies.UTG.call, 0);
  assert.ok(strategies.SB.call > 0);
  assert.equal(strategies.BB.fold, 0);
});

test('six-max raised-pot outputs remain finite and normalized', () => {
  for (const position of ['UTG', 'HJ', 'CO', 'BTN', 'SB', 'BB']) {
    const strategy = qa.fallback('7', '7', true, false, position, '3bet', 9, 10, 30, 9);
    assert.ok(Object.values(strategy).every((value) => Number.isFinite(value) && value >= 0));
    assert.equal(strategy.open + strategy.call + strategy.fold, 1);
  }
});

test('SB and BB retain distinct raised-pot overrides', () => {
  const smallBlind = qa.fallback('7', '7', true, false, 'SB', '3bet', 9, 10, 30, 9);
  const bigBlind = qa.fallback('7', '7', true, false, 'BB', '3bet', 9, 10, 30, 9);
  assert.notDeepEqual(smallBlind, bigBlind);
  assert.ok(bigBlind.open > smallBlind.open);
});
