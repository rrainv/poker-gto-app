import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

import {
  ACTION_TYPES,
  ANTE_TYPES,
  CHANCE_TYPES,
  GAME_MODES,
  HAND_CATEGORIES,
  LEDGER_KINDS,
  LEDGER_MOVEMENTS,
  PHASES,
  STREETS,
  applyAction,
  applyChance,
  compareHandRanks,
  createAction,
  evaluateFive,
  evaluateSeven,
  initializeHand,
  isChipConserved,
  resolveShowdown,
  validatePokerState,
} from '../shared/poker-domain/index.js';

const require = createRequire(import.meta.url);
const { evaluateProduction } = require('./qa001_adapters.js');

const DRY_BOARD = Object.freeze(['2c', '3d', '4h', '9s', 'Jc']);
const ROYAL_BOARD = Object.freeze(['As', 'Ks', 'Qs', 'Js', 'Ts']);
const CLUB_HOLES = Object.freeze([
  ['Ah', 'Ad'], ['Kh', 'Qd'], ['Kc', 'Td'], ['Qh', '8d'], ['Qc', '7d'],
  ['Jh', '6d'], ['Jd', '5d'], ['Th', '8c'], ['Tc', '7c'], ['9h', '6c'],
]);

function showdownState({
  contributions,
  holeCards,
  board = DRY_BOARD,
  foldedPlayerIds = [],
  refundsByPlayerId = {},
  mode = GAME_MODES.HOME,
  chipUnitMilliBb = 100,
  buttonSeat = 0,
}) {
  const forcedDeduction = mode === GAME_MODES.CLUBGG ? 100 : 0;
  const state = structuredClone(initializeHand({
    handId: 'engine-008-showdown',
    game: {
      mode,
      smallBlindMilliBb: 500,
      bigBlindMilliBb: 1000,
      chipUnitMilliBb,
      ante: { type: ANTE_TYPES.NONE, amountMilliBb: 0 },
    },
    buttonSeat,
    players: contributions.map((contribution, seat) => ({
      playerId: `P${seat}`,
      seat,
      startingStackMilliBb: contribution + forcedDeduction,
    })),
  }));

  const deductionEntries = state.ledger.filter((entry) => (
    entry.kind === LEDGER_KINDS.CLUBGG_FORCED_CONTRIBUTION
  ));
  state.ledger = deductionEntries.map((entry, sequence) => ({ ...entry, sequence }));
  state.potMilliBb = 0;
  for (const [index, player] of state.players.entries()) {
    const contribution = contributions[index];
    const refund = refundsByPlayerId[player.playerId] || 0;
    player.currentStackMilliBb = player.startingStackMilliBb
      - player.totalDeductionMilliBb - contribution + refund;
    player.streetContributionMilliBb = 0;
    player.totalPotContributionMilliBb = contribution;
    player.folded = foldedPlayerIds.includes(player.playerId);
    player.actedThisStreet = false;
    player.raiseReopenAtMilliBb = null;
    player.holeCards = [...holeCards[index]];
    if (contribution > 0) {
      state.ledger.push({
        sequence: state.ledger.length,
        playerId: player.playerId,
        street: STREETS.PREFLOP,
        kind: LEDGER_KINDS.ACTION,
        movement: LEDGER_MOVEMENTS.STACK_TO_POT,
        amountMilliBb: contribution,
      });
      state.potMilliBb += contribution;
    }
    if (refund > 0) {
      state.ledger.push({
        sequence: state.ledger.length,
        playerId: player.playerId,
        street: STREETS.PREFLOP,
        kind: LEDGER_KINDS.UNCALLED_REFUND,
        movement: LEDGER_MOVEMENTS.POT_TO_STACK,
        amountMilliBb: refund,
      });
      state.potMilliBb -= refund;
    }
  }

  state.phase = PHASES.SHOWDOWN;
  state.street = STREETS.RIVER;
  state.board = [...board];
  state.actingPlayerId = null;
  state.pendingChance = null;
  state.currentBetMilliBb = 0;
  state.lastFullRaiseIncrementMilliBb = state.game.bigBlindMilliBb;
  state.lastAggressorPlayerId = null;
  state.showdown = {
    status: 'ready',
    eligiblePlayerIds: state.players
      .filter((player) => !player.folded)
      .map((player) => player.playerId),
    pots: [],
    handRanksByPlayer: null,
    layerResults: [],
  };
  validatePokerState(state);
  return state;
}

function act(state, type, amountToMilliBb = null) {
  return applyAction(state, createAction(state.actingPlayerId, type, amountToMilliBb));
}

function initializedHu(stacks) {
  return initializeHand({
    handId: 'engine-008-runtime',
    game: {
      mode: GAME_MODES.HOME,
      smallBlindMilliBb: 500,
      bigBlindMilliBb: 1000,
      chipUnitMilliBb: 100,
      ante: { type: ANTE_TYPES.NONE, amountMilliBb: 0 },
    },
    buttonSeat: 0,
    players: stacks.map((startingStackMilliBb, seat) => ({
      playerId: `P${seat}`,
      seat,
      startingStackMilliBb,
    })),
  });
}

function dealtHu(stacks = [100_000, 100_000]) {
  return applyChance(initializedHu(stacks), {
    type: CHANCE_TYPES.DEAL_HOLE,
    cardsByPlayer: {
      P0: ['Ah', 'Ad'],
      P1: ['Kh', 'Kd'],
    },
  });
}

function dealBoard(state, type, cards) {
  return applyChance(state, { type, cards });
}

function checkedThroughRiver() {
  let state = dealtHu();
  state = act(state, ACTION_TYPES.CALL);
  state = act(state, ACTION_TYPES.CHECK);
  state = dealBoard(state, CHANCE_TYPES.DEAL_FLOP, DRY_BOARD.slice(0, 3));
  state = act(act(state, ACTION_TYPES.CHECK), ACTION_TYPES.CHECK);
  state = dealBoard(state, CHANCE_TYPES.DEAL_TURN, [DRY_BOARD[3]]);
  state = act(act(state, ACTION_TYPES.CHECK), ACTION_TYPES.CHECK);
  state = dealBoard(state, CHANCE_TYPES.DEAL_RIVER, [DRY_BOARD[4]]);
  return act(act(state, ACTION_TYPES.CHECK), ACTION_TYPES.CHECK);
}

function assertTerminalAccounting(state) {
  assert.equal(state.phase, PHASES.TERMINAL);
  assert.equal(state.terminal.isTerminal, true);
  assert.equal(state.terminal.reason, 'showdown');
  assert.equal(state.potMilliBb, 0);
  assert.equal(state.actingPlayerId, null);
  assert.equal(state.pendingChance, null);
  assert.equal(isChipConserved(state), true);
  assert.equal(
    state.players.reduce((sum, player) => sum + player.startingStackMilliBb, 0),
    state.players.reduce((sum, player) => sum + player.currentStackMilliBb, 0)
      + state.deductionTotalMilliBb,
  );
  validatePokerState(state);
}

const categoryFixtures = [
  ['high card', ['As', 'Kd', '9h', '7c', '3s'], HAND_CATEGORIES.HIGH_CARD],
  ['one pair', ['As', 'Ad', 'Kc', 'Qd', '2s'], HAND_CATEGORIES.ONE_PAIR],
  ['two pair', ['As', 'Ad', 'Kc', 'Kd', '2s'], HAND_CATEGORIES.TWO_PAIR],
  ['trips', ['Qs', 'Qh', 'Qd', 'Ac', '2s'], HAND_CATEGORIES.THREE_OF_A_KIND],
  ['straight', ['As', 'Kd', 'Qh', 'Jc', 'Ts'], HAND_CATEGORIES.STRAIGHT],
  ['wheel straight', ['As', '2d', '3h', '4c', '5s'], HAND_CATEGORIES.STRAIGHT],
  ['flush', ['As', 'Js', '8s', '5s', '2s'], HAND_CATEGORIES.FLUSH],
  ['full house', ['Ts', 'Th', 'Td', '9c', '9s'], HAND_CATEGORIES.FULL_HOUSE],
  ['quads', ['8s', '8h', '8d', '8c', 'As'], HAND_CATEGORIES.FOUR_OF_A_KIND],
  ['straight flush', ['9s', '8s', '7s', '6s', '5s'], HAND_CATEGORIES.STRAIGHT_FLUSH],
  ['top straight flush', ['As', 'Ks', 'Qs', 'Js', 'Ts'], HAND_CATEGORIES.STRAIGHT_FLUSH],
];

for (const [name, cards, category] of categoryFixtures) {
  test(`canonical evaluator: ${name}`, () => {
    const result = evaluateFive(cards);
    assert.equal(result.category, category);
    assert.equal(result.score, evaluateProduction(cards));
    assert.equal(Object.isFrozen(result), true);
  });
}

test('canonical evaluator preserves kicker ordering and exact tie comparison', () => {
  const better = evaluateFive(['As', 'Ad', 'Kc', 'Qd', '2s']);
  const worse = evaluateFive(['Ah', 'Ac', 'Jc', 'Td', '9s']);
  const tied = evaluateFive(['Ac', 'Ah', 'Ks', 'Qh', '2d']);
  assert.equal(compareHandRanks(better, worse), 1);
  assert.equal(compareHandRanks(worse, better), -1);
  assert.equal(compareHandRanks(better, tied), 0);
});

test('canonical evaluator selects the best five out of seven', () => {
  const result = evaluateSeven(['As', 'Ad', 'Ac', 'Kc', 'Kd', '2s', '3h']);
  assert.equal(result.category, HAND_CATEGORIES.FULL_HOUSE);
  assert.deepEqual(result.tiebreakers, [14, 13]);
  assert.equal(result.score, evaluateProduction(['As', 'Ad', 'Ac', 'Kc', 'Kd', '2s', '3h']));
});

test('different hole cards tie exactly when the board plays', () => {
  const first = evaluateSeven(['2c', '3d', ...ROYAL_BOARD]);
  const second = evaluateSeven(['4c', '5d', ...ROYAL_BOARD]);
  assert.equal(compareHandRanks(first, second), 0);
  assert.equal(first.score, second.score);
});

test('canonical evaluator rejects malformed, duplicate, and wrong-count inputs', () => {
  assert.throws(() => evaluateFive(['As', 'Kd', 'Qh', 'Jc']));
  assert.throws(() => evaluateSeven(['As', 'Kd', 'Qh', 'Jc', 'Ts']));
  assert.throws(() => evaluateSeven(['As', 'As', 'Qh', 'Jc', 'Ts', '9d', '8c']));
  assert.throws(() => evaluateSeven(['AS', 'Kd', 'Qh', 'Jc', 'Ts', '9d', '8c']));
});

test('canonical evaluator scores match the characterized production evaluator', () => {
  const fixtures = [
    ['As', 'Kd', '9h', '7c', '3s', '2d', '4c'],
    ['As', 'Ad', 'Kc', 'Qd', '2s', 'Jh', '9c'],
    ['As', '2d', '3h', '4c', '5s', 'Kd', 'Qh'],
    ['9s', '8s', '7s', '6s', '5s', 'Ad', 'Kc'],
    ['8s', '8h', '8d', '8c', 'As', 'Kd', 'Qh'],
  ];
  for (const cards of fixtures) assert.equal(evaluateSeven(cards).score, evaluateProduction(cards));
});

test('HU showdown awards the entire pot to the stronger hand immutably', () => {
  const state = showdownState({
    contributions: [1000, 1000],
    holeCards: [['Ah', 'Ad'], ['Kh', 'Kd']],
  });
  const snapshot = structuredClone(state);
  const settled = resolveShowdown(state);
  assert.deepEqual(state, snapshot);
  assert.deepEqual(settled.terminal.winnerPlayerIds, ['P0']);
  assert.deepEqual(settled.terminal.payoutsMilliBbByPlayer, { P0: 2000 });
  assert.deepEqual(settled.showdown.layerResults[0].winnerPlayerIds, ['P0']);
  assert.equal(settled.showdown.status, 'settled');
  assert.equal(Object.isFrozen(settled), true);
  assert.equal(Object.isFrozen(settled.showdown.layerResults), true);
  assertTerminalAccounting(settled);
});

test('HU board-playing tie splits the pot exactly', () => {
  const settled = resolveShowdown(showdownState({
    contributions: [1000, 1000],
    holeCards: [['2c', '3d'], ['4c', '5d']],
    board: ROYAL_BOARD,
  }));
  assert.deepEqual(settled.terminal.payoutsMilliBbByPlayer, { P1: 1000, P0: 1000 });
  assert.deepEqual(settled.showdown.layerResults[0].winnerPlayerIds, ['P1', 'P0']);
  assertTerminalAccounting(settled);
});

test('river check-through showdown resolves through the canonical transition', () => {
  const ready = checkedThroughRiver();
  assert.equal(ready.phase, PHASES.SHOWDOWN);
  const settled = resolveShowdown(ready);
  assert.deepEqual(settled.terminal.winnerPlayerIds, ['P0']);
  assert.deepEqual(settled.terminal.payoutsMilliBbByPlayer, { P0: 2000 });
  assertTerminalAccounting(settled);
});

test('all-in runout showdown resolves after explicit chance events', () => {
  let state = dealtHu([10_000, 10_000]);
  state = act(state, ACTION_TYPES.ALL_IN);
  state = act(state, ACTION_TYPES.CALL);
  state = dealBoard(state, CHANCE_TYPES.DEAL_FLOP, DRY_BOARD.slice(0, 3));
  state = dealBoard(state, CHANCE_TYPES.DEAL_TURN, [DRY_BOARD[3]]);
  state = dealBoard(state, CHANCE_TYPES.DEAL_RIVER, [DRY_BOARD[4]]);
  const settled = resolveShowdown(state);
  assert.deepEqual(settled.terminal.payoutsMilliBbByPlayer, { P0: 20_000 });
  assertTerminalAccounting(settled);
});

test('main-pot and side-pot winners are resolved independently', () => {
  const settled = resolveShowdown(showdownState({
    contributions: [6000, 6000, 2000],
    holeCards: [['Kh', 'Kd'], ['Ah', 'Ad'], ['5s', '6s']],
  }));
  assert.deepEqual(settled.showdown.layerResults.map((result) => result.winnerPlayerIds), [
    ['P2'], ['P1'],
  ]);
  assert.deepEqual(settled.terminal.payoutsMilliBbByPlayer, { P2: 6000, P1: 8000 });
  assertTerminalAccounting(settled);
});

test('nested side pots can have a different winner at every level', () => {
  const settled = resolveShowdown(showdownState({
    contributions: [8000, 6000, 4000, 2000],
    holeCards: [['Kh', 'Kd'], ['Ah', 'Ad'], ['Jh', 'Jd'], ['5s', '6s']],
  }));
  assert.deepEqual(settled.showdown.layerResults.map((result) => result.winnerPlayerIds), [
    ['P3'], ['P2'], ['P1'],
  ]);
  assert.deepEqual(settled.terminal.refundsMilliBbByPlayer, { P0: 2000 });
  assert.deepEqual(settled.terminal.payoutsMilliBbByPlayer, {
    P3: 8000,
    P2: 6000,
    P1: 4000,
  });
  assertTerminalAccounting(settled);
});

test('tied main pot and single side-pot winner settle independently', () => {
  const settled = resolveShowdown(showdownState({
    contributions: [6000, 6000, 2000],
    holeCards: [['As', 'Ad'], ['Ks', 'Kd'], ['Ah', 'Ac']],
  }));
  assert.deepEqual(settled.showdown.layerResults[0].winnerPlayerIds, ['P2', 'P0']);
  assert.deepEqual(settled.showdown.layerResults[0].payoutsMilliBbByPlayer, {
    P2: 3000,
    P0: 3000,
  });
  assert.deepEqual(settled.showdown.layerResults[1].winnerPlayerIds, ['P0']);
  assert.deepEqual(settled.terminal.payoutsMilliBbByPlayer, { P2: 3000, P0: 11_000 });
  assertTerminalAccounting(settled);
});

test('folded contributors fund pots but never receive showdown awards', () => {
  const settled = resolveShowdown(showdownState({
    contributions: [6000, 6000, 2000],
    holeCards: [['5s', '6s'], ['Ah', 'Ad'], ['Kh', 'Kd']],
    foldedPlayerIds: ['P0'],
  }));
  assert.equal(Object.hasOwn(settled.terminal.payoutsMilliBbByPlayer, 'P0'), false);
  assert.deepEqual(settled.showdown.layerResults.map((result) => result.winnerPlayerIds), [
    ['P1'], ['P1'],
  ]);
  assertTerminalAccounting(settled);
});

test('two tied live players split odd dead money clockwise after the button', () => {
  const settled = resolveShowdown(showdownState({
    contributions: [500, 500, 1],
    holeCards: [['2c', '3d'], ['4c', '5d'], ['6c', '7d']],
    board: ROYAL_BOARD,
    foldedPlayerIds: ['P2'],
    chipUnitMilliBb: 1,
  }));
  assert.deepEqual(settled.terminal.payoutsMilliBbByPlayer, { P1: 501, P0: 500 });
  assert.deepEqual(settled.showdown.layerResults[0].winnerPlayerIds, ['P1', 'P0']);
  assertTerminalAccounting(settled);
});

test('multiway tied odd units follow clockwise order rather than player ID order', () => {
  const settled = resolveShowdown(showdownState({
    contributions: [334, 334, 334, 1],
    holeCards: [['2c', '3d'], ['4c', '5d'], ['6c', '7d'], ['8c', '9d']],
    board: ROYAL_BOARD,
    foldedPlayerIds: ['P3'],
    chipUnitMilliBb: 1,
  }));
  assert.deepEqual(settled.terminal.payoutsMilliBbByPlayer, {
    P1: 335,
    P2: 334,
    P0: 334,
  });
  assertTerminalAccounting(settled);
});

test('unique overbet is refunded before contestable layers are awarded', () => {
  const settled = resolveShowdown(showdownState({
    contributions: [10_000, 6000, 2000],
    holeCards: [['Kh', 'Kd'], ['Ah', 'Ad'], ['5s', '6s']],
  }));
  assert.deepEqual(settled.terminal.refundsMilliBbByPlayer, { P0: 4000 });
  assert.deepEqual(settled.terminal.payoutsMilliBbByPlayer, { P2: 6000, P1: 8000 });
  assert.equal(
    settled.ledger.filter((entry) => entry.kind === LEDGER_KINDS.UNCALLED_REFUND).length,
    1,
  );
  assertTerminalAccounting(settled);
});

test('prior recorded refund is not applied twice during showdown', () => {
  const settled = resolveShowdown(showdownState({
    contributions: [10_000, 6000, 2000],
    holeCards: [['Kh', 'Kd'], ['Ah', 'Ad'], ['5s', '6s']],
    refundsByPlayerId: { P0: 4000 },
  }));
  assert.deepEqual(settled.terminal.refundsMilliBbByPlayer, {});
  assert.equal(
    settled.ledger.filter((entry) => entry.kind === LEDGER_KINDS.UNCALLED_REFUND).length,
    1,
  );
  assertTerminalAccounting(settled);
});

test('showdown ledger awards are exact and identify their pot layers', () => {
  const settled = resolveShowdown(showdownState({
    contributions: [6000, 6000, 2000],
    holeCards: [['Kh', 'Kd'], ['Ah', 'Ad'], ['5s', '6s']],
  }));
  const awards = settled.ledger.filter((entry) => (
    entry.kind === LEDGER_KINDS.POT_AWARD && entry.settlementReason === 'showdown'
  ));
  assert.deepEqual(awards.map((entry) => [entry.playerId, entry.amountMilliBb, entry.potLayerIndex]), [
    ['P2', 6000, 0],
    ['P1', 8000, 1],
  ]);
  assert.equal(awards.reduce((sum, entry) => sum + entry.amountMilliBb, 0), 14_000);
});

test('ClubGG 7, 9, and 10-player deductions remain outside showdown settlement', () => {
  for (const count of [7, 9, 10]) {
    const settled = resolveShowdown(showdownState({
      contributions: Array.from({ length: count }, () => 1000),
      holeCards: CLUB_HOLES.slice(0, count),
      mode: GAME_MODES.CLUBGG,
    }));
    assert.equal(settled.deductionTotalMilliBb, count * 100);
    assert.deepEqual(settled.terminal.payoutsMilliBbByPlayer, { P0: count * 1000 });
    assert.equal(settled.players.every((player) => player.currentStackMilliBb >= 0), true);
    assertTerminalAccounting(settled);
  }
});

test('showdown resolution rejects invalid phase, incomplete board, and unknown live cards', () => {
  const ready = showdownState({
    contributions: [1000, 1000],
    holeCards: [['Ah', 'Ad'], ['Kh', 'Kd']],
  });
  assert.throws(() => resolveShowdown(initializedHu([10_000, 10_000])));

  const incomplete = structuredClone(ready);
  incomplete.board.pop();
  assert.throws(() => resolveShowdown(incomplete));

  const unknownLive = structuredClone(ready);
  unknownLive.players[0].holeCards = null;
  assert.throws(() => resolveShowdown(unknownLive));
});

test('PokerState v1 validation does not allow folded hole cards to revert to undealt null', () => {
  const ready = showdownState({
    contributions: [1000, 1000, 1000],
    holeCards: [['Ah', 'Ad'], ['Kh', 'Kd'], ['Qh', 'Qd']],
    foldedPlayerIds: ['P2'],
  });
  const unknownFolded = structuredClone(ready);
  unknownFolded.players[2].holeCards = null;
  assert.throws(() => resolveShowdown(unknownFolded));
});

test('settled showdown cannot be resolved a second time', () => {
  const settled = resolveShowdown(showdownState({
    contributions: [1000, 1000],
    holeCards: [['Ah', 'Ad'], ['Kh', 'Kd']],
  }));
  assert.throws(() => resolveShowdown(settled));
});
