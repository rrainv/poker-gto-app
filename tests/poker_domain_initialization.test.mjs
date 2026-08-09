import test from 'node:test';
import assert from 'node:assert/strict';

import {
  blindAssignments,
  initializeHand,
  isChipConserved,
  isPlayerAllIn,
  ledgerTotals,
  totalHandContributionMilliBb,
  validateInitializedPokerState,
  validatePokerState,
} from '../shared/poker-domain/index.js';

function players(count, stack = 100000) {
  return Array.from({ length: count }, (_, seat) => ({
    playerId: `P${seat}`,
    seat,
    startingStackMilliBb: typeof stack === 'function' ? stack(seat) : stack,
  }));
}

function configuration({
  count = 2,
  mode = 'home',
  stack = 100000,
  buttonSeat = 0,
  ante = { type: 'none', amountMilliBb: 0 },
  chipUnitMilliBb = 1,
  playerSeeds = null,
} = {}) {
  return {
    handId: 'fixture-hand',
    game: {
      mode,
      smallBlindMilliBb: 500,
      bigBlindMilliBb: 1000,
      chipUnitMilliBb,
      ante,
    },
    buttonSeat,
    players: playerSeeds || players(count, stack),
  };
}

test('Home HU 100bb initialization matches the approved golden state', () => {
  const state = initializeHand(configuration());
  const button = state.players.find((player) => player.playerId === 'P0');
  const bigBlind = state.players.find((player) => player.playerId === 'P1');

  assert.equal(state.schemaVersion, 'poker-state/v1');
  assert.equal(state.phase, 'chance');
  assert.equal(state.street, 'preflop');
  assert.equal(state.actingPlayerId, null);
  assert.deepEqual(state.pendingChance, {
    type: 'deal_hole',
    cardCount: 4,
    playerOrder: ['P1', 'P0'],
  });
  assert.equal(button.currentStackMilliBb, 99500);
  assert.equal(bigBlind.currentStackMilliBb, 99000);
  assert.equal(state.potMilliBb, 1500);
  assert.equal(state.deductionTotalMilliBb, 0);
  assert.equal(state.currentBetMilliBb, 1000);
  assert.equal(state.lastFullRaiseIncrementMilliBb, 1000);
  assert.deepEqual(blindAssignments(state), {
    buttonPlayerId: 'P0',
    smallBlindPlayerId: 'P0',
    bigBlindPlayerId: 'P1',
  });
  assert.equal(isChipConserved(state), true);
  assert.equal(Object.isFrozen(state), true);
  assert.equal(Object.isFrozen(state.players), true);
  assert.equal(Object.hasOwn(state, 'minimumBetToMilliBb'), false);
  assert.equal(Object.hasOwn(state, 'minimumRaiseToMilliBb'), false);
  assert.equal(Object.hasOwn(button, 'allIn'), false);
  assert.equal(Object.hasOwn(button, 'totalHandContributionMilliBb'), false);
  assert.equal(totalHandContributionMilliBb(button), 500);
});

test('Home mode always initializes with zero forced deduction', () => {
  for (let count = 2; count <= 10; count += 1) {
    const state = initializeHand(configuration({ count }));
    assert.equal(state.game.forcedContributionPerPlayerMilliBb, 0);
    assert.equal(state.deductionTotalMilliBb, 0);
    assert.ok(state.players.every((player) => player.totalDeductionMilliBb === 0));
    assert.ok(state.ledger.every((entry) => entry.kind !== 'clubgg_forced_contribution'));
    assert.equal(isChipConserved(state), true);
  }
});

for (const [count, expectedDeduction] of [[7, 700], [9, 900], [10, 1000]]) {
  test(`ClubGG ${count}-player initialization deducts ${expectedDeduction} milliBb outside the pot`, () => {
    const state = initializeHand(configuration({ count, mode: 'clubgg' }));
    assert.equal(state.game.forcedContributionPerPlayerMilliBb, 100);
    assert.equal(state.deductionTotalMilliBb, expectedDeduction);
    assert.equal(state.potMilliBb, 1500);
    assert.ok(state.players.every((player) => player.totalDeductionMilliBb === 100));
    assert.equal(
      state.ledger.filter((entry) => entry.kind === 'clubgg_forced_contribution').length,
      count,
    );
    assert.ok(state.ledger
      .filter((entry) => entry.kind === 'clubgg_forced_contribution')
      .every((entry) => entry.movement === 'stack_to_deduction'));
    assert.deepEqual(ledgerTotals(state), {
      potMilliBb: 1500,
      deductionMilliBb: expectedDeduction,
    });
    assert.equal(isChipConserved(state), true);
  });
}

test('repeated selectors never reapply ClubGG deductions', () => {
  const state = initializeHand(configuration({ count: 9, mode: 'clubgg' }));
  const before = JSON.stringify(state);
  for (let index = 0; index < 10; index += 1) {
    ledgerTotals(state);
    blindAssignments(state);
    state.players.forEach((player) => totalHandContributionMilliBb(player));
  }
  assert.equal(JSON.stringify(state), before);
  assert.equal(state.deductionTotalMilliBb, 900);
});

test('per-player antes enter the pot but not street contributions', () => {
  const state = initializeHand(configuration({
    count: 3,
    ante: { type: 'per_player', amountMilliBb: 100 },
  }));
  const byPosition = Object.fromEntries(state.players.map((player) => [player.position, player]));

  assert.equal(state.potMilliBb, 1800);
  assert.equal(byPosition.BTN.totalPotContributionMilliBb, 100);
  assert.equal(byPosition.BTN.streetContributionMilliBb, 0);
  assert.equal(byPosition.SB.totalPotContributionMilliBb, 600);
  assert.equal(byPosition.SB.streetContributionMilliBb, 500);
  assert.equal(byPosition.BB.totalPotContributionMilliBb, 1100);
  assert.equal(byPosition.BB.streetContributionMilliBb, 1000);
  assert.equal(state.currentBetMilliBb, 1000);
  assert.equal(state.ledger.filter((entry) => entry.kind === 'ante').length, 3);
  assert.equal(isChipConserved(state), true);
});

test('big-blind ante is posted only by the big blind and does not change price to call', () => {
  const state = initializeHand(configuration({
    count: 6,
    ante: { type: 'big_blind', amountMilliBb: 600 },
  }));
  const { bigBlindPlayerId } = blindAssignments(state);
  const bigBlind = state.players.find((player) => player.playerId === bigBlindPlayerId);

  assert.equal(state.ledger.filter((entry) => entry.kind === 'ante').length, 1);
  assert.equal(state.ledger.find((entry) => entry.kind === 'ante').playerId, bigBlindPlayerId);
  assert.equal(bigBlind.totalPotContributionMilliBb, 1600);
  assert.equal(bigBlind.streetContributionMilliBb, 1000);
  assert.equal(state.potMilliBb, 2100);
  assert.equal(state.currentBetMilliBb, 1000);
  assert.equal(isChipConserved(state), true);
});

test('a short ante posts the remaining stack and derives all-in without storing it', () => {
  const playerSeeds = players(4, (seat) => seat === 3 ? 200 : 100000);
  const state = initializeHand(configuration({
    count: 4,
    playerSeeds,
    ante: { type: 'per_player', amountMilliBb: 300 },
  }));
  const shortPlayer = state.players.find((player) => player.playerId === 'P3');

  assert.equal(shortPlayer.currentStackMilliBb, 0);
  assert.equal(shortPlayer.totalPotContributionMilliBb, 200);
  assert.equal(shortPlayer.streetContributionMilliBb, 0);
  assert.equal(isPlayerAllIn(shortPlayer), true);
  assert.equal(Object.hasOwn(shortPlayer, 'allIn'), false);
  assert.equal(state.ledger.find((entry) => entry.kind === 'ante' && entry.playerId === 'P3').amountMilliBb, 200);
  assert.equal(isChipConserved(state), true);
});

test('short blinds post only remaining stacks while current bet stays nominal', () => {
  const state = initializeHand(configuration({
    playerSeeds: [
      { playerId: 'P0', seat: 0, startingStackMilliBb: 300 },
      { playerId: 'P1', seat: 1, startingStackMilliBb: 700 },
    ],
  }));
  assert.equal(state.potMilliBb, 1000);
  assert.equal(state.currentBetMilliBb, 1000);
  assert.deepEqual(state.players.map((player) => player.streetContributionMilliBb), [300, 700]);
  assert.ok(state.players.every(isPlayerAllIn));
  assert.equal(isChipConserved(state), true);
});

test('duplicate IDs, duplicate seats, invalid buttons, stacks, and precision are rejected', () => {
  assert.throws(() => initializeHand(configuration({
    playerSeeds: [
      { playerId: 'same', seat: 0, startingStackMilliBb: 100000 },
      { playerId: 'same', seat: 1, startingStackMilliBb: 100000 },
    ],
  })), /Duplicate playerId/);
  assert.throws(() => initializeHand(configuration({
    playerSeeds: [
      { playerId: 'P0', seat: 0, startingStackMilliBb: 100000 },
      { playerId: 'P1', seat: 0, startingStackMilliBb: 100000 },
    ],
  })), /Duplicate seat/);
  assert.throws(() => initializeHand(configuration({ buttonSeat: 9 })), /buttonSeat/);
  assert.throws(() => initializeHand(configuration({ stack: -1 })), /nonnegative safe integer/);
  assert.throws(() => initializeHand(configuration({ stack: 1000.5 })), /nonnegative safe integer/);
  assert.throws(() => initializeHand(configuration({ stack: 1001, chipUnitMilliBb: 10 })), /align/);
});

test('ClubGG rejects a player unable to pay exactly 100 milliBb', () => {
  assert.throws(() => initializeHand(configuration({
    count: 7,
    mode: 'clubgg',
    stack: (seat) => seat === 4 ? 99 : 100000,
  })), /cannot pay exactly 100 milliBb/);
});

test('configuration and caller player arrays remain unchanged', () => {
  const input = configuration({ count: 7, mode: 'clubgg' });
  const original = structuredClone(input);
  Object.freeze(input.game.ante);
  Object.freeze(input.game);
  input.players.forEach(Object.freeze);
  Object.freeze(input.players);
  Object.freeze(input);

  const state = initializeHand(input);
  assert.deepEqual(input, original);
  assert.notEqual(state.players, input.players);
  assert.notEqual(state.game, input.game);
});

test('ledger, player totals, and starting-stack conservation agree across configurations', () => {
  const fixtures = [
    configuration(),
    configuration({ count: 10 }),
    configuration({ count: 7, mode: 'clubgg' }),
    configuration({ count: 9, mode: 'clubgg', ante: { type: 'per_player', amountMilliBb: 125 } }),
    configuration({ count: 6, ante: { type: 'big_blind', amountMilliBb: 1000 } }),
  ];

  for (const fixture of fixtures) {
    const state = initializeHand(fixture);
    assert.equal(validatePokerState(state), state);
    assert.equal(validateInitializedPokerState(state), state);
    assert.deepEqual(ledgerTotals(state), {
      potMilliBb: state.potMilliBb,
      deductionMilliBb: state.deductionTotalMilliBb,
    });
    assert.equal(isChipConserved(state), true);
    for (const player of state.players) {
      assert.equal(
        player.startingStackMilliBb,
        player.currentStackMilliBb + totalHandContributionMilliBb(player),
      );
    }
  }
});

test('PokerState validation rejects duplicated known private cards', () => {
  const state = structuredClone(initializeHand(configuration()));
  state.players[0].holeCards = ['As', 'Kh'];
  state.players[1].holeCards = ['As', 'Qh'];
  assert.throws(() => validatePokerState(state), /Duplicate known card: As/);
});
