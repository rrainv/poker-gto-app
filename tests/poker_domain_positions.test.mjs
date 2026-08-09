import test from 'node:test';
import assert from 'node:assert/strict';

import {
  blindAssignments,
  deriveSeatAssignments,
  firstPreflopActorId,
  initializeHand,
  POSITIONS_BY_TABLE_SIZE,
} from '../shared/poker-domain/index.js';

const EXPECTED_VOCABULARY = {
  2: ['BTN', 'BB'],
  3: ['BTN', 'SB', 'BB'],
  4: ['BTN', 'CO', 'SB', 'BB'],
  5: ['BTN', 'HJ', 'CO', 'SB', 'BB'],
  6: ['UTG', 'HJ', 'CO', 'BTN', 'SB', 'BB'],
  7: ['UTG', 'LJ', 'HJ', 'CO', 'BTN', 'SB', 'BB'],
  8: ['UTG', 'UTG+1', 'LJ', 'HJ', 'CO', 'BTN', 'SB', 'BB'],
  9: ['UTG', 'UTG+1', 'MP', 'LJ', 'HJ', 'CO', 'BTN', 'SB', 'BB'],
  10: ['UTG', 'UTG+1', 'UTG+2', 'MP', 'LJ', 'HJ', 'CO', 'BTN', 'SB', 'BB'],
};

const EXPECTED_CLOCKWISE_FROM_BUTTON = {
  2: ['BTN', 'BB'],
  3: ['BTN', 'SB', 'BB'],
  4: ['BTN', 'SB', 'BB', 'CO'],
  5: ['BTN', 'SB', 'BB', 'HJ', 'CO'],
  6: ['BTN', 'SB', 'BB', 'UTG', 'HJ', 'CO'],
  7: ['BTN', 'SB', 'BB', 'UTG', 'LJ', 'HJ', 'CO'],
  8: ['BTN', 'SB', 'BB', 'UTG', 'UTG+1', 'LJ', 'HJ', 'CO'],
  9: ['BTN', 'SB', 'BB', 'UTG', 'UTG+1', 'MP', 'LJ', 'HJ', 'CO'],
  10: ['BTN', 'SB', 'BB', 'UTG', 'UTG+1', 'UTG+2', 'MP', 'LJ', 'HJ', 'CO'],
};

function players(count, stack = 100000) {
  return Array.from({ length: count }, (_, seat) => ({
    playerId: `P${seat}`,
    seat,
    startingStackMilliBb: stack,
  }));
}

function homeConfiguration(count) {
  return {
    game: {
      mode: 'home',
      smallBlindMilliBb: 500,
      bigBlindMilliBb: 1000,
      chipUnitMilliBb: 1,
      ante: { type: 'none', amountMilliBb: 0 },
    },
    buttonSeat: 0,
    players: players(count),
  };
}

for (let count = 2; count <= 10; count += 1) {
  test(`${count}-player vocabulary, positions, blinds, and first actor are exact`, () => {
    assert.deepEqual([...POSITIONS_BY_TABLE_SIZE[count]], EXPECTED_VOCABULARY[count]);

    const state = initializeHand(homeConfiguration(count));
    assert.deepEqual(state.players.map((player) => player.position), EXPECTED_CLOCKWISE_FROM_BUTTON[count]);

    const blinds = blindAssignments(state);
    assert.equal(blinds.buttonPlayerId, 'P0');
    assert.equal(blinds.smallBlindPlayerId, count === 2 ? 'P0' : 'P1');
    assert.equal(blinds.bigBlindPlayerId, count === 2 ? 'P1' : 'P2');
    assert.equal(firstPreflopActorId(state), count <= 3 ? 'P0' : 'P3');
  });
}

test('heads-up button is also small blind and acts first preflop', () => {
  const state = initializeHand(homeConfiguration(2));
  assert.deepEqual(blindAssignments(state), {
    buttonPlayerId: 'P0',
    smallBlindPlayerId: 'P0',
    bigBlindPlayerId: 'P1',
  });
  assert.equal(firstPreflopActorId(state), 'P0');
});

test('seat order, not caller array order, is authoritative', () => {
  const unordered = [
    { playerId: 'BB', seat: 5, startingStackMilliBb: 100000 },
    { playerId: 'BTN', seat: 7, startingStackMilliBb: 100000 },
    { playerId: 'SB', seat: 2, startingStackMilliBb: 100000 },
  ];
  const assignments = deriveSeatAssignments(unordered, 7);
  assert.deepEqual(assignments.map(({ playerId, position }) => [playerId, position]), [
    ['SB', 'SB'],
    ['BB', 'BB'],
    ['BTN', 'BTN'],
  ]);
});
