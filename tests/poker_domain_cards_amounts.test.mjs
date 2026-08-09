import test from 'node:test';
import assert from 'node:assert/strict';

import {
  assertCard,
  assertMilliBb,
  assertUniqueKnownCards,
  bbToMilliBb,
  CARD_RANKS,
  CARD_SUITS,
  isCard,
  milliBbToBb,
} from '../shared/poker-domain/index.js';

test('canonical cards use strict two-character rank/suit casing', () => {
  for (const rank of CARD_RANKS) {
    for (const suit of CARD_SUITS) assert.equal(isCard(`${rank}${suit}`), true);
  }

  for (const card of ['as', 'AS', '10s', '1s', 'Ax', 'A♠', '', null, 14]) {
    assert.equal(isCard(card), false, String(card));
    assert.throws(() => assertCard(card));
  }
  assert.equal(assertCard('As'), 'As');
  assert.equal(assertCard('Kh'), 'Kh');
  assert.equal(assertCard('7d'), '7d');
  assert.equal(assertCard('2c'), '2c');
});

test('known cards reject duplicates within and across card groups', () => {
  assert.doesNotThrow(() => assertUniqueKnownCards([
    { label: 'hero', cards: ['As', 'Kh'] },
    { label: 'board', cards: ['7d', '2c', 'Ts'] },
  ]));
  assert.throws(() => assertUniqueKnownCards([
    { label: 'hero', cards: ['As', 'As'] },
  ]), /Duplicate known card: As/);
  assert.throws(() => assertUniqueKnownCards([
    { label: 'hero', cards: ['As', 'Kh'] },
    { label: 'board', cards: ['As'] },
  ]), /Duplicate known card: As/);
});

test('milliBb amounts are nonnegative safe integers', () => {
  for (const value of [0, 1, 100, 500, 1000, 100000]) assert.equal(assertMilliBb(value), value);
  for (const value of [-1, 0.5, Number.NaN, Number.POSITIVE_INFINITY, Number.MAX_SAFE_INTEGER + 1, '100']) {
    assert.throws(() => assertMilliBb(value));
  }
});

test('bb conversion helpers are explicit boundary adapters', () => {
  assert.equal(bbToMilliBb(0), 0);
  assert.equal(bbToMilliBb(0.1), 100);
  assert.equal(bbToMilliBb(0.5), 500);
  assert.equal(bbToMilliBb(1), 1000);
  assert.equal(bbToMilliBb(100), 100000);
  assert.equal(milliBbToBb(100), 0.1);
  assert.equal(milliBbToBb(1500), 1.5);
  assert.throws(() => bbToMilliBb(0.0001), /cannot be represented/);
  assert.throws(() => bbToMilliBb(-0.1));
});
