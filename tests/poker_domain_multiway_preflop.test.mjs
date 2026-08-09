import test from 'node:test';
import assert from 'node:assert/strict';

import {
  ACTION_TYPES,
  ANTE_TYPES,
  CHANCE_TYPES,
  GAME_MODES,
  LEDGER_KINDS,
  LEDGER_MOVEMENTS,
  PHASES,
  applyAction,
  applyChance,
  createAction,
  getLegalActionSpec,
  hasRaisingRights,
  initializeHand,
  isChipConserved,
  isPlayerAllIn,
  ledgerTotals,
  playerById,
  validatePokerState,
} from '../shared/poker-domain/index.js';

const DECK = Object.freeze([
  'As', 'Kh', 'Qd', 'Jc', 'Ts', '9h', '8d', '7c', '6s', '5h',
  '4d', '3c', '2s', 'Ah', 'Kd', 'Qc', 'Js', 'Th', '9d', '8c',
]);

function cardsFor(playerCount) {
  return Object.fromEntries(Array.from({ length: playerCount }, (_, index) => [
    `P${index}`,
    [DECK[index * 2], DECK[index * 2 + 1]],
  ]));
}

function initializedTable(playerCount, {
  mode = GAME_MODES.HOME,
  stacks = Array.from({ length: playerCount }, () => 100_000),
} = {}) {
  return initializeHand({
    handId: `engine-004-${playerCount}`,
    game: {
      mode,
      smallBlindMilliBb: 500,
      bigBlindMilliBb: 1000,
      chipUnitMilliBb: 100,
      ante: { type: ANTE_TYPES.NONE, amountMilliBb: 0 },
    },
    buttonSeat: 0,
    players: Array.from({ length: playerCount }, (_, seat) => ({
      playerId: `P${seat}`,
      seat,
      startingStackMilliBb: stacks[seat],
    })),
  });
}

function bettingTable(playerCount, options) {
  return applyChance(initializedTable(playerCount, options), {
    type: CHANCE_TYPES.DEAL_HOLE,
    cardsByPlayer: cardsFor(playerCount),
  });
}

function action(playerId, type, amountToMilliBb = null) {
  return createAction(playerId, type, amountToMilliBb);
}

function act(state, type, amountToMilliBb = null) {
  return applyAction(state, action(state.actingPlayerId, type, amountToMilliBb));
}

function assertAccounting(state) {
  const totals = ledgerTotals(state);
  assert.equal(totals.potMilliBb, state.potMilliBb);
  assert.equal(totals.deductionMilliBb, state.deductionTotalMilliBb);
  assert.equal(isChipConserved(state), true);
  assert.equal(state.players.every((player) => player.currentStackMilliBb >= 0), true);
}

function assertValidActor(state) {
  validatePokerState(state);
  if (state.phase !== PHASES.BETTING) {
    assert.equal(state.actingPlayerId, null);
    return;
  }
  const actor = playerById(state, state.actingPlayerId);
  assert.equal(actor.folded, false);
  assert.equal(isPlayerAllIn(actor), false);
}

function assertDeeplyFrozen(value) {
  if (!value || typeof value !== 'object') return;
  assert.equal(Object.isFrozen(value), true);
  for (const child of Object.values(value)) assertDeeplyFrozen(child);
}

function limpToBigBlind(state) {
  const seen = [];
  while (playerById(state, state.actingPlayerId).position !== 'BB') {
    seen.push(state.actingPlayerId);
    state = act(state, ACTION_TYPES.CALL);
    assertValidActor(state);
  }
  return { state, seen };
}

test('deal_hole maps every private card and selects the first actor for 3 through 10 players', () => {
  for (let playerCount = 3; playerCount <= 10; playerCount += 1) {
    const before = initializedTable(playerCount);
    const beforeSnapshot = structuredClone(before);
    const mapping = cardsFor(playerCount);
    const state = applyChance(before, { type: CHANCE_TYPES.DEAL_HOLE, cardsByPlayer: mapping });
    assert.deepEqual(before, beforeSnapshot);
    assert.equal(state.actingPlayerId, playerCount === 3 ? 'P0' : 'P3');
    for (let index = 0; index < playerCount; index += 1) {
      assert.deepEqual(playerById(state, `P${index}`).holeCards, mapping[`P${index}`]);
    }
    assertDeeplyFrozen(state);
    assertValidActor(state);
    assertAccounting(state);
  }
});

test('multiway hole dealing rejects duplicate, missing, and misassigned mappings', () => {
  const before = initializedTable(10);
  const duplicate = cardsFor(10);
  duplicate.P9 = ['As', '8c'];
  assert.throws(() => applyChance(before, {
    type: CHANCE_TYPES.DEAL_HOLE,
    cardsByPlayer: duplicate,
  }));
  const missing = cardsFor(10);
  delete missing.P5;
  assert.throws(() => applyChance(before, {
    type: CHANCE_TYPES.DEAL_HOLE,
    cardsByPlayer: missing,
  }));
  const extra = { ...cardsFor(10), PX: ['2h', '2d'] };
  assert.throws(() => applyChance(before, {
    type: CHANCE_TYPES.DEAL_HOLE,
    cardsByPlayer: extra,
  }));
});

test('3 through 10 players act clockwise and preserve the BB option after all limps', () => {
  for (let playerCount = 3; playerCount <= 10; playerCount += 1) {
    const { state: atBigBlind, seen } = limpToBigBlind(bettingTable(playerCount));
    const expected = playerCount === 3
      ? ['P0', 'P1']
      : [...Array.from({ length: playerCount - 3 }, (_, index) => `P${index + 3}`), 'P0', 'P1'];
    assert.deepEqual(seen, expected);
    const spec = getLegalActionSpec(atBigBlind);
    assert.equal(atBigBlind.actingPlayerId, 'P2');
    assert.equal(spec.check.available, true);
    assert.equal(spec.raise.available, true);
    assert.equal(spec.fold.available, false);
    const complete = act(atBigBlind, ACTION_TYPES.CHECK);
    assert.equal(complete.phase, PHASES.CHANCE);
    assert.deepEqual(complete.pendingChance, { type: CHANCE_TYPES.DEAL_FLOP, cardCount: 3 });
    assert.equal(complete.potMilliBb, playerCount * 1000);
    assertAccounting(complete);
  }
});

test('clockwise progression skips folded and initially all-in players', () => {
  const stacks = [100_000, 100_000, 100_000, 100_000, 0, 100_000];
  let state = bettingTable(6, { stacks });
  assert.equal(state.actingPlayerId, 'P3');
  state = act(state, ACTION_TYPES.FOLD);
  assert.equal(state.actingPlayerId, 'P5');
  state = act(state, ACTION_TYPES.CALL);
  assert.equal(state.actingPlayerId, 'P0');
  assert.equal(isPlayerAllIn(playerById(state, 'P4')), true);
  assertValidActor(state);
});

test('an entirely forced-all-in table requests the flop without selecting an actor', () => {
  const state = bettingTable(3, { stacks: [0, 500, 500] });
  assert.equal(state.phase, PHASES.CHANCE);
  assert.equal(state.actingPlayerId, null);
  assert.deepEqual(state.pendingChance, { type: CHANCE_TYPES.DEAL_FLOP, cardCount: 3 });
  assert.equal(state.potMilliBb, 1000);
  assertAccounting(state);
});

test('open raise, folds, and a BB call complete a multiway preflop round', () => {
  let state = bettingTable(6);
  state = act(state, ACTION_TYPES.RAISE, 3000);
  for (const playerId of ['P4', 'P5', 'P0', 'P1']) {
    assert.equal(state.actingPlayerId, playerId);
    state = act(state, ACTION_TYPES.FOLD);
  }
  assert.equal(state.actingPlayerId, 'P2');
  state = act(state, ACTION_TYPES.CALL);
  assert.equal(state.phase, PHASES.CHANCE);
  assert.equal(state.potMilliBb, 6500);
  assertAccounting(state);
});

test('an open raise with multiple callers retains every gross contribution', () => {
  let state = bettingTable(6);
  state = act(state, ACTION_TYPES.RAISE, 3000);
  state = act(state, ACTION_TYPES.CALL);
  state = act(state, ACTION_TYPES.CALL);
  state = act(state, ACTION_TYPES.FOLD);
  state = act(state, ACTION_TYPES.FOLD);
  state = act(state, ACTION_TYPES.CALL);
  assert.equal(state.phase, PHASES.CHANCE);
  assert.equal(state.potMilliBb, 12_500);
  assert.deepEqual(state.players.map((player) => player.totalPotContributionMilliBb), [
    0, 500, 3000, 3000, 3000, 3000,
  ]);
  assertAccounting(state);
});

test('raise, re-raise, folds, 4-bet, and call return action to the correct players', () => {
  let state = bettingTable(4);
  state = act(state, ACTION_TYPES.RAISE, 3000); // CO
  assert.equal(state.actingPlayerId, 'P0');
  state = act(state, ACTION_TYPES.RAISE, 5000); // BTN 3-bet
  state = act(state, ACTION_TYPES.FOLD); // SB
  state = act(state, ACTION_TYPES.FOLD); // BB
  assert.equal(state.actingPlayerId, 'P3');
  state = act(state, ACTION_TYPES.RAISE, 7000); // CO 4-bet
  assert.equal(state.actingPlayerId, 'P0');
  state = act(state, ACTION_TYPES.CALL);
  assert.equal(state.phase, PHASES.CHANCE);
  assert.equal(state.potMilliBb, 15_500);
  assertAccounting(state);
});

test('a short-stack multiway call remains an all-in call and does not end action early', () => {
  let state = bettingTable(4, { stacks: [2000, 100_000, 100_000, 100_000] });
  state = act(state, ACTION_TYPES.RAISE, 3000);
  assert.equal(state.actingPlayerId, 'P0');
  state = act(state, ACTION_TYPES.CALL);
  assert.equal(state.actionHistory.at(-1).submittedAction.type, ACTION_TYPES.CALL);
  assert.equal(state.actionHistory.at(-1).wasAllIn, true);
  assert.equal(state.actingPlayerId, 'P1');
  state = act(state, ACTION_TYPES.FOLD);
  state = act(state, ACTION_TYPES.CALL);
  assert.equal(state.phase, PHASES.CHANCE);
  assert.equal(state.potMilliBb, 8500);
  assertAccounting(state);
});

test('several multiway all-ins preserve unequal contributions for future side pots', () => {
  let state = bettingTable(4, { stacks: [4000, 2000, 3000, 100_000] });
  state = act(state, ACTION_TYPES.RAISE, 3000);
  state = act(state, ACTION_TYPES.ALL_IN); // BTN to 4bb
  state = act(state, ACTION_TYPES.CALL); // SB calls short to 2bb
  state = act(state, ACTION_TYPES.CALL); // BB calls short to 3bb
  assert.equal(state.actingPlayerId, 'P3');
  state = act(state, ACTION_TYPES.CALL);
  assert.equal(state.phase, PHASES.CHANCE);
  assert.deepEqual(state.players.map((player) => player.totalPotContributionMilliBb), [4000, 2000, 3000, 4000]);
  assert.equal(state.potMilliBb, 13_000);
  assertAccounting(state);
});

test('one short all-in does not prematurely reopen a prior raiser', () => {
  let state = bettingTable(5, { stacks: [100_000, 100_000, 100_000, 100_000, 4000] });
  state = act(state, ACTION_TYPES.RAISE, 3000); // P3
  state = act(state, ACTION_TYPES.ALL_IN); // P4 to 4bb, short
  assert.equal(state.actionHistory.at(-1).reopenedBetting, false);
  state = act(state, ACTION_TYPES.FOLD); // P0
  state = act(state, ACTION_TYPES.FOLD); // P1
  state = act(state, ACTION_TYPES.FOLD); // P2
  assert.equal(state.actingPlayerId, 'P3');
  assert.equal(hasRaisingRights(state, 'P3'), false);
  assert.equal(getLegalActionSpec(state).raise.available, false);
});

test('cumulative short all-ins reopen action once their total reaches a full raise', () => {
  let state = bettingTable(6, {
    stacks: [100_000, 100_000, 100_000, 100_000, 4000, 5000],
  });
  state = act(state, ACTION_TYPES.RAISE, 3000); // P3 threshold is 5bb
  state = act(state, ACTION_TYPES.ALL_IN); // P4 to 4bb
  assert.equal(state.actionHistory.at(-1).reopenedBetting, false);
  state = act(state, ACTION_TYPES.ALL_IN); // P5 to 5bb cumulatively reopens
  assert.equal(state.currentBetMilliBb, 5000);
  assert.equal(state.lastFullRaiseIncrementMilliBb, 2000);
  assert.equal(state.actionHistory.at(-1).wasFullRaise, false);
  assert.equal(state.actionHistory.at(-1).reopenedBetting, true);
  state = act(state, ACTION_TYPES.FOLD); // P0
  state = act(state, ACTION_TYPES.FOLD); // P1
  state = act(state, ACTION_TYPES.CALL); // P2 remains able to respond to more action
  assert.equal(state.actingPlayerId, 'P3');
  assert.equal(hasRaisingRights(state, 'P3'), true);
  assert.equal(getLegalActionSpec(state).raise.minToMilliBb, 7000);
});

test('a player who has not acted retains normal raising rights after a short all-in', () => {
  let state = bettingTable(5, { stacks: [100_000, 100_000, 100_000, 100_000, 4000] });
  state = act(state, ACTION_TYPES.RAISE, 3000);
  state = act(state, ACTION_TYPES.ALL_IN);
  assert.equal(state.actingPlayerId, 'P0');
  assert.equal(playerById(state, 'P0').actedThisStreet, false);
  assert.equal(hasRaisingRights(state, 'P0'), true);
  assert.equal(getLegalActionSpec(state).raise.available, true);
});

test('a full re-raise reopens action for every prior live actor', () => {
  let state = bettingTable(4);
  state = act(state, ACTION_TYPES.RAISE, 3000);
  state = act(state, ACTION_TYPES.CALL);
  state = act(state, ACTION_TYPES.RAISE, 5000);
  state = act(state, ACTION_TYPES.FOLD);
  assert.equal(state.actingPlayerId, 'P3');
  assert.equal(hasRaisingRights(state, 'P3'), true);
  assert.equal(getLegalActionSpec(state).raise.available, true);
});

test('all but one folding settles multiway dead money and refunds only unmatched excess', () => {
  let state = bettingTable(4);
  state = act(state, ACTION_TYPES.RAISE, 3000); // P3
  state = act(state, ACTION_TYPES.FOLD); // P0
  state = act(state, ACTION_TYPES.FOLD); // P1
  state = act(state, ACTION_TYPES.FOLD); // P2
  assert.equal(state.phase, PHASES.TERMINAL);
  assert.deepEqual(state.terminal.winnerPlayerIds, ['P3']);
  assert.deepEqual(state.terminal.refundsMilliBbByPlayer, { P3: 2000 });
  assert.deepEqual(state.terminal.payoutsMilliBbByPlayer, { P3: 2500 });
  assert.equal(state.potMilliBb, 0);
  assert.deepEqual(state.ledger.slice(-2).map((entry) => entry.kind), [
    LEDGER_KINDS.UNCALLED_REFUND,
    LEDGER_KINDS.POT_AWARD,
  ]);
  assertAccounting(state);
});

test('a uniquely unmatched overbet is refunded when several opponents call all-in short', () => {
  let state = bettingTable(3, { stacks: [100_000, 2000, 2000] });
  state = act(state, ACTION_TYPES.RAISE, 3000);
  state = act(state, ACTION_TYPES.CALL);
  state = act(state, ACTION_TYPES.CALL);
  assert.equal(state.phase, PHASES.CHANCE);
  assert.equal(state.potMilliBb, 6000);
  assert.equal(state.ledger.at(-1).kind, LEDGER_KINDS.UNCALLED_REFUND);
  assert.equal(state.ledger.at(-1).amountMilliBb, 1000);
  assertAccounting(state);
});

test('ClubGG 7, 9, and 10-player betting keeps deductions outside the pot', () => {
  for (const playerCount of [7, 9, 10]) {
    let state = bettingTable(playerCount, { mode: GAME_MODES.CLUBGG });
    assert.equal(state.deductionTotalMilliBb, playerCount * 100);
    const { state: atBigBlind } = limpToBigBlind(state);
    state = act(atBigBlind, ACTION_TYPES.CHECK);
    assert.equal(state.phase, PHASES.CHANCE);
    assert.equal(state.potMilliBb, playerCount * 1000);
    assert.equal(state.deductionTotalMilliBb, playerCount * 100);
    assert.equal(state.ledger.filter((entry) => (
      entry.kind === LEDGER_KINDS.CLUBGG_FORCED_CONTRIBUTION
    )).every((entry) => entry.movement === LEDGER_MOVEMENTS.STACK_TO_DEDUCTION), true);
    assertAccounting(state);
  }
});

test('ClubGG deductions remain outside fold settlement for 7, 9, and 10 players', () => {
  for (const playerCount of [7, 9, 10]) {
    let state = bettingTable(playerCount, { mode: GAME_MODES.CLUBGG });
    while (state.phase === PHASES.BETTING) state = act(state, ACTION_TYPES.FOLD);
    assert.equal(state.phase, PHASES.TERMINAL);
    assert.equal(state.potMilliBb, 0);
    assert.equal(state.deductionTotalMilliBb, playerCount * 100);
    assert.equal(state.ledger.filter((entry) => (
      entry.movement === LEDGER_MOVEMENTS.STACK_TO_DEDUCTION
    )).reduce((sum, entry) => sum + entry.amountMilliBb, 0), playerCount * 100);
    assertAccounting(state);
  }
});

test('multiway chance and action transitions are immutable and deeply frozen', () => {
  const initialized = initializedTable(8);
  const initializedSnapshot = structuredClone(initialized);
  const dealt = applyChance(initialized, {
    type: CHANCE_TYPES.DEAL_HOLE,
    cardsByPlayer: cardsFor(8),
  });
  assert.deepEqual(initialized, initializedSnapshot);
  const dealtSnapshot = structuredClone(dealt);
  const acted = act(dealt, ACTION_TYPES.CALL);
  assert.deepEqual(dealt, dealtSnapshot);
  assertDeeplyFrozen(dealt);
  assertDeeplyFrozen(acted);
});

test('every available initial and BB-option action accepts a valid concrete action', () => {
  const initial = bettingTable(4);
  const initialSpec = getLegalActionSpec(initial);
  const initialActions = [
    [ACTION_TYPES.FOLD, null],
    [ACTION_TYPES.CALL, null],
    [ACTION_TYPES.RAISE, initialSpec.raise.minToMilliBb],
    [ACTION_TYPES.RAISE, initialSpec.raise.maxToMilliBb],
    [ACTION_TYPES.ALL_IN, null],
  ];
  for (const [type, amount] of initialActions) {
    const next = applyAction(initial, action(initial.actingPlayerId, type, amount));
    assertValidActor(next);
    assertAccounting(next);
  }

  const { state: atBigBlind } = limpToBigBlind(bettingTable(4));
  const bbSpec = getLegalActionSpec(atBigBlind);
  const bbActions = [
    [ACTION_TYPES.CHECK, null],
    [ACTION_TYPES.RAISE, bbSpec.raise.minToMilliBb],
    [ACTION_TYPES.RAISE, bbSpec.raise.maxToMilliBb],
    [ACTION_TYPES.ALL_IN, null],
  ];
  for (const [type, amount] of bbActions) {
    const next = applyAction(atBigBlind, action(atBigBlind.actingPlayerId, type, amount));
    assertValidActor(next);
    assertAccounting(next);
  }
});
