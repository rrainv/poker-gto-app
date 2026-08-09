import test from 'node:test';
import assert from 'node:assert/strict';

import {
  ACTION_TYPES,
  ANTE_TYPES,
  CHANCE_TYPES,
  GAME_MODES,
  PHASES,
  STREETS,
  applyAction,
  applyChance,
  createAction,
  initializeHand,
  isChipConserved,
  ledgerTotals,
  playerById,
  validatePokerState,
} from '../shared/poker-domain/index.js';

const HOLE_DECK = Object.freeze([
  'As', 'Kh', 'Qd', 'Jc', 'Ts', '9h', '8d', '7c', '6s', '5h',
  '4d', '3c', '2s', 'Ah', 'Kd', 'Qc', 'Js', 'Th', '9d', '8c',
]);
const FLOP = Object.freeze(['2h', '3h', '4h']);
const TURN = Object.freeze(['5d']);
const RIVER = Object.freeze(['6d']);

function cardsFor(playerCount) {
  return Object.fromEntries(Array.from({ length: playerCount }, (_, index) => [
    `P${index}`,
    [HOLE_DECK[index * 2], HOLE_DECK[index * 2 + 1]],
  ]));
}

function initializedTable(playerCount, {
  mode = GAME_MODES.HOME,
  stacks = Array.from({ length: playerCount }, () => 100_000),
} = {}) {
  return initializeHand({
    handId: `engine-005-${playerCount}`,
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

function dealtTable(playerCount, options) {
  return applyChance(initializedTable(playerCount, options), {
    type: CHANCE_TYPES.DEAL_HOLE,
    cardsByPlayer: cardsFor(playerCount),
  });
}

function act(state, type, amountToMilliBb = null) {
  return applyAction(state, createAction(state.actingPlayerId, type, amountToMilliBb));
}

function limpedPreflop(playerCount, options) {
  let state = dealtTable(playerCount, options);
  while (state.phase === PHASES.BETTING) {
    const actor = playerById(state, state.actingPlayerId);
    state = act(state, actor.position === 'BB' ? ACTION_TYPES.CHECK : ACTION_TYPES.CALL);
  }
  return state;
}

function allInHu() {
  let state = dealtTable(2, { stacks: [10_000, 10_000] });
  state = act(state, ACTION_TYPES.ALL_IN);
  return act(state, ACTION_TYPES.CALL);
}

function dealBoard(state, type, cards) {
  return applyChance(state, { type, cards });
}

function assertAccounting(state) {
  const totals = ledgerTotals(state);
  assert.equal(totals.potMilliBb, state.potMilliBb);
  assert.equal(totals.deductionMilliBb, state.deductionTotalMilliBb);
  assert.equal(isChipConserved(state), true);
}

function assertDeeplyFrozen(value) {
  if (!value || typeof value !== 'object') return;
  assert.equal(Object.isFrozen(value), true);
  for (const child of Object.values(value)) assertDeeplyFrozen(child);
}

function appendCheckRecord(state, playerId) {
  state.actionHistory.push({
    schemaVersion: 'poker-action-record/v1',
    sequence: state.actionHistory.length,
    street: state.street,
    playerId,
    submittedAction: createAction(playerId, ACTION_TYPES.CHECK),
    toCallBeforeMilliBb: 0,
    committedMilliBb: 0,
    streetContributionAfterMilliBb: 0,
    currentBetBeforeMilliBb: 0,
    currentBetAfterMilliBb: 0,
    wasAllIn: false,
    wasFullRaise: false,
    reopenedBetting: false,
  });
  const player = playerById(state, playerId);
  player.actedThisStreet = true;
  player.raiseReopenAtMilliBb = state.game.chipUnitMilliBb;
}

function testOnlyCheckedThroughState(state, nextChanceType) {
  const next = structuredClone(state);
  const ablePlayers = next.players.filter((player) => !player.folded && player.currentStackMilliBb > 0);
  for (const player of ablePlayers) appendCheckRecord(next, player.playerId);
  next.phase = PHASES.CHANCE;
  next.actingPlayerId = null;
  next.pendingChance = {
    type: nextChanceType,
    cardCount: nextChanceType === CHANCE_TYPES.DEAL_FLOP ? 3 : 1,
  };
  validatePokerState(next);
  return next;
}

test('deal_flop deterministically initializes the flop and preserves prior accounting', () => {
  const preflop = limpedPreflop(2);
  const snapshot = structuredClone(preflop);
  const ledgerSnapshot = structuredClone(preflop.ledger);
  const state = dealBoard(preflop, CHANCE_TYPES.DEAL_FLOP, FLOP);

  assert.deepEqual(preflop, snapshot);
  assert.equal(state.street, STREETS.FLOP);
  assert.deepEqual(state.board, FLOP);
  assert.equal(state.phase, PHASES.BETTING);
  assert.equal(state.actingPlayerId, 'P1');
  assert.equal(state.pendingChance, null);
  assert.equal(state.potMilliBb, preflop.potMilliBb);
  assert.deepEqual(state.ledger, ledgerSnapshot);
  assertAccounting(state);
  assertDeeplyFrozen(state);
});

test('new postflop streets reset only street-scoped betting fields', () => {
  const preflop = limpedPreflop(4);
  const stacks = preflop.players.map((player) => player.currentStackMilliBb);
  const totals = preflop.players.map((player) => player.totalPotContributionMilliBb);
  const deductions = preflop.players.map((player) => player.totalDeductionMilliBb);
  const history = structuredClone(preflop.actionHistory);
  const ledger = structuredClone(preflop.ledger);
  const state = dealBoard(preflop, CHANCE_TYPES.DEAL_FLOP, FLOP);

  assert.deepEqual(state.players.map((player) => player.currentStackMilliBb), stacks);
  assert.deepEqual(state.players.map((player) => player.totalPotContributionMilliBb), totals);
  assert.deepEqual(state.players.map((player) => player.totalDeductionMilliBb), deductions);
  assert.equal(state.players.every((player) => player.streetContributionMilliBb === 0), true);
  assert.equal(state.players.every((player) => player.actedThisStreet === false), true);
  assert.equal(state.players.every((player) => player.raiseReopenAtMilliBb === null), true);
  assert.equal(state.currentBetMilliBb, 0);
  assert.equal(state.lastFullRaiseIncrementMilliBb, 1000);
  assert.equal(state.lastAggressorPlayerId, null);
  assert.deepEqual(state.actionHistory, history);
  assert.deepEqual(state.ledger, ledger);
});

test('deterministic turn and river transitions use the same generic reset path', () => {
  const flop = dealBoard(allInHu(), CHANCE_TYPES.DEAL_FLOP, FLOP);
  const turn = dealBoard(flop, CHANCE_TYPES.DEAL_TURN, TURN);
  const river = dealBoard(turn, CHANCE_TYPES.DEAL_RIVER, RIVER);

  assert.equal(turn.street, STREETS.TURN);
  assert.deepEqual(turn.board, [...FLOP, ...TURN]);
  assert.equal(turn.currentBetMilliBb, 0);
  assert.equal(turn.lastFullRaiseIncrementMilliBb, 1000);
  assert.equal(river.street, STREETS.RIVER);
  assert.deepEqual(river.board, [...FLOP, ...TURN, ...RIVER]);
  assert.equal(river.currentBetMilliBb, 0);
  validatePokerState(flop);
  validatePokerState(turn);
  validatePokerState(river);
});

test('board chance rejects wrong types, counts, malformed cards, and replay', () => {
  const preflop = limpedPreflop(2);
  assert.throws(() => dealBoard(preflop, CHANCE_TYPES.DEAL_TURN, TURN));
  assert.throws(() => dealBoard(preflop, CHANCE_TYPES.DEAL_FLOP, ['2h', '3h']));
  assert.throws(() => dealBoard(preflop, CHANCE_TYPES.DEAL_FLOP, ['2h', '3h', 'ZZ']));
  const flop = dealBoard(preflop, CHANCE_TYPES.DEAL_FLOP, FLOP);
  assert.throws(() => dealBoard(flop, CHANCE_TYPES.DEAL_FLOP, FLOP));

  const allInFlop = dealBoard(allInHu(), CHANCE_TYPES.DEAL_FLOP, FLOP);
  assert.throws(() => dealBoard(allInFlop, CHANCE_TYPES.DEAL_TURN, ['5d', '6d']));
  const turn = dealBoard(allInFlop, CHANCE_TYPES.DEAL_TURN, TURN);
  assert.throws(() => dealBoard(turn, CHANCE_TYPES.DEAL_RIVER, []));
});

test('board chance rejects duplicates against hole cards, board, and dead cards', () => {
  const preflop = limpedPreflop(2);
  assert.throws(() => dealBoard(preflop, CHANCE_TYPES.DEAL_FLOP, ['As', '3h', '4h']));

  const deadState = structuredClone(preflop);
  deadState.deadCards = ['7h'];
  validatePokerState(deadState);
  assert.throws(() => dealBoard(deadState, CHANCE_TYPES.DEAL_FLOP, ['7h', '3h', '4h']));

  const flop = dealBoard(allInHu(), CHANCE_TYPES.DEAL_FLOP, FLOP);
  assert.throws(() => dealBoard(flop, CHANCE_TYPES.DEAL_TURN, ['2h']));
});

test('HU big blind is first to act postflop', () => {
  const state = dealBoard(limpedPreflop(2), CHANCE_TYPES.DEAL_FLOP, FLOP);
  assert.equal(playerById(state, state.actingPlayerId).position, 'BB');
});

test('3 through 10 players initialize postflop action left of the button', () => {
  for (let playerCount = 3; playerCount <= 10; playerCount += 1) {
    const state = dealBoard(limpedPreflop(playerCount), CHANCE_TYPES.DEAL_FLOP, FLOP);
    assert.equal(state.actingPlayerId, 'P1');
    validatePokerState(state);
  }
});

test('postflop actor selection skips folded players', () => {
  let state = dealtTable(4);
  state = act(state, ACTION_TYPES.CALL); // P3
  state = act(state, ACTION_TYPES.CALL); // P0
  state = act(state, ACTION_TYPES.FOLD); // P1
  state = act(state, ACTION_TYPES.CHECK); // P2
  const flop = dealBoard(state, CHANCE_TYPES.DEAL_FLOP, FLOP);
  assert.equal(playerById(flop, 'P1').folded, true);
  assert.equal(flop.actingPlayerId, 'P2');
});

test('postflop actor selection skips all-in players', () => {
  let state = dealtTable(4, { stacks: [3000, 1000, 100_000, 100_000] });
  state = act(state, ACTION_TYPES.RAISE, 3000); // P3
  state = act(state, ACTION_TYPES.CALL); // P0 all-in
  state = act(state, ACTION_TYPES.CALL); // P1 all-in short
  state = act(state, ACTION_TYPES.CALL); // P2
  const flop = dealBoard(state, CHANCE_TYPES.DEAL_FLOP, FLOP);
  assert.equal(flop.actingPlayerId, 'P2');
});

test('HU all-in completion runs flop, turn, and river without fake actors', () => {
  const preflop = allInHu();
  const flop = dealBoard(preflop, CHANCE_TYPES.DEAL_FLOP, FLOP);
  assert.equal(flop.phase, PHASES.CHANCE);
  assert.equal(flop.actingPlayerId, null);
  assert.deepEqual(flop.pendingChance, { type: CHANCE_TYPES.DEAL_TURN, cardCount: 1 });
  const turn = dealBoard(flop, CHANCE_TYPES.DEAL_TURN, TURN);
  assert.equal(turn.phase, PHASES.CHANCE);
  assert.equal(turn.actingPlayerId, null);
  assert.deepEqual(turn.pendingChance, { type: CHANCE_TYPES.DEAL_RIVER, cardCount: 1 });
  const river = dealBoard(turn, CHANCE_TYPES.DEAL_RIVER, RIVER);
  assert.equal(river.actingPlayerId, null);
  assert.equal(river.pendingChance, null);
});

test('multiway runout requires no action when only one non-all-in player remains', () => {
  let state = dealtTable(3, { stacks: [3000, 3000, 100_000] });
  state = act(state, ACTION_TYPES.ALL_IN); // P0
  state = act(state, ACTION_TYPES.CALL); // P1 all-in
  state = act(state, ACTION_TYPES.CALL); // P2 remains deep
  const flop = dealBoard(state, CHANCE_TYPES.DEAL_FLOP, FLOP);
  assert.equal(flop.phase, PHASES.CHANCE);
  assert.equal(flop.actingPlayerId, null);
  const turn = dealBoard(flop, CHANCE_TYPES.DEAL_TURN, TURN);
  const river = dealBoard(turn, CHANCE_TYPES.DEAL_RIVER, RIVER);
  assert.equal(river.phase, PHASES.SHOWDOWN);
  assertAccounting(river);
});

test('river enters showdown-ready when betting is impossible', () => {
  const flop = dealBoard(allInHu(), CHANCE_TYPES.DEAL_FLOP, FLOP);
  const turn = dealBoard(flop, CHANCE_TYPES.DEAL_TURN, TURN);
  const river = dealBoard(turn, CHANCE_TYPES.DEAL_RIVER, RIVER);
  assert.equal(river.phase, PHASES.SHOWDOWN);
  assert.equal(river.showdown.status, 'ready');
  assert.deepEqual(river.showdown.eligiblePlayerIds, ['P0', 'P1']);
  assert.deepEqual(river.showdown.pots, []);
  assert.equal(river.showdown.handRanksByPlayer, null);
  assert.throws(() => dealBoard(river, CHANCE_TYPES.DEAL_RIVER, RIVER));
});

test('an actionable turn and river initialize betting with the correct actor', () => {
  const flop = dealBoard(limpedPreflop(2), CHANCE_TYPES.DEAL_FLOP, FLOP);
  const turnPending = testOnlyCheckedThroughState(flop, CHANCE_TYPES.DEAL_TURN);
  const turn = dealBoard(turnPending, CHANCE_TYPES.DEAL_TURN, TURN);
  assert.equal(turn.phase, PHASES.BETTING);
  assert.equal(turn.actingPlayerId, 'P1');

  const riverPending = testOnlyCheckedThroughState(turn, CHANCE_TYPES.DEAL_RIVER);
  const river = dealBoard(riverPending, CHANCE_TYPES.DEAL_RIVER, RIVER);
  assert.equal(river.phase, PHASES.BETTING);
  assert.equal(river.actingPlayerId, 'P1');
  assert.equal(river.showdown.status, 'not_reached');
});

test('validation rejects wrong board lengths and illegal phase/chance combinations', () => {
  const flop = dealBoard(limpedPreflop(2), CHANCE_TYPES.DEAL_FLOP, FLOP);
  const shortBoard = structuredClone(flop);
  shortBoard.board.pop();
  assert.throws(() => validatePokerState(shortBoard));

  const wrongStreet = structuredClone(flop);
  wrongStreet.street = STREETS.TURN;
  assert.throws(() => validatePokerState(wrongStreet));

  const pendingWhileBetting = structuredClone(flop);
  pendingWhileBetting.pendingChance = { type: CHANCE_TYPES.DEAL_TURN, cardCount: 1 };
  assert.throws(() => validatePokerState(pendingWhileBetting));

  const skippedBetting = structuredClone(flop);
  skippedBetting.phase = PHASES.CHANCE;
  skippedBetting.actingPlayerId = null;
  skippedBetting.pendingChance = { type: CHANCE_TYPES.DEAL_TURN, cardCount: 1 };
  assert.throws(() => validatePokerState(skippedBetting));
});

test('board chance preserves folded state, stacks, pot, deductions, history, and ledger', () => {
  let state = dealtTable(4);
  state = act(state, ACTION_TYPES.FOLD);
  state = act(state, ACTION_TYPES.CALL);
  state = act(state, ACTION_TYPES.CALL);
  state = act(state, ACTION_TYPES.CHECK);
  const snapshot = {
    folded: state.players.map((player) => player.folded),
    stacks: state.players.map((player) => player.currentStackMilliBb),
    totals: state.players.map((player) => player.totalPotContributionMilliBb),
    pot: state.potMilliBb,
    deduction: state.deductionTotalMilliBb,
    history: structuredClone(state.actionHistory),
    ledger: structuredClone(state.ledger),
  };
  const flop = dealBoard(state, CHANCE_TYPES.DEAL_FLOP, FLOP);
  assert.deepEqual(flop.players.map((player) => player.folded), snapshot.folded);
  assert.deepEqual(flop.players.map((player) => player.currentStackMilliBb), snapshot.stacks);
  assert.deepEqual(flop.players.map((player) => player.totalPotContributionMilliBb), snapshot.totals);
  assert.equal(flop.potMilliBb, snapshot.pot);
  assert.equal(flop.deductionTotalMilliBb, snapshot.deduction);
  assert.deepEqual(flop.actionHistory, snapshot.history);
  assert.deepEqual(flop.ledger, snapshot.ledger);
});

test('ClubGG deduction and accounting remain unchanged across an all-in runout', () => {
  let state = dealtTable(7, {
    mode: GAME_MODES.CLUBGG,
    stacks: Array.from({ length: 7 }, () => 3100),
  });
  while (state.phase === PHASES.BETTING) {
    const specType = state.actionHistory.length === 0 ? ACTION_TYPES.ALL_IN : ACTION_TYPES.CALL;
    state = act(state, specType);
  }
  assert.equal(state.potMilliBb, 21_000);
  assert.equal(state.deductionTotalMilliBb, 700);
  const ledger = structuredClone(state.ledger);
  const stacks = state.players.map((player) => player.currentStackMilliBb);
  state = dealBoard(state, CHANCE_TYPES.DEAL_FLOP, FLOP);
  state = dealBoard(state, CHANCE_TYPES.DEAL_TURN, TURN);
  state = dealBoard(state, CHANCE_TYPES.DEAL_RIVER, RIVER);
  assert.equal(state.potMilliBb, 21_000);
  assert.equal(state.deductionTotalMilliBb, 700);
  assert.deepEqual(state.ledger, ledger);
  assert.deepEqual(state.players.map((player) => player.currentStackMilliBb), stacks);
  assert.equal(state.phase, PHASES.SHOWDOWN);
  assertAccounting(state);
});
