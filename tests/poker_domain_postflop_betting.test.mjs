import test from 'node:test';
import assert from 'node:assert/strict';

import {
  ACTION_TYPES,
  ANTE_TYPES,
  CHANCE_TYPES,
  GAME_MODES,
  LEDGER_KINDS,
  PHASES,
  STREETS,
  applyAction,
  applyChance,
  createAction,
  getLegalActionSpec,
  hasRaisingRights,
  initializeHand,
  isChipConserved,
  ledgerTotals,
  minimumRaiseToMilliBb,
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

function initializedTable(
  playerCount,
  stacks = Array.from({ length: playerCount }, () => 100_000),
  mode = GAME_MODES.HOME,
) {
  return initializeHand({
    handId: `engine-006-${playerCount}`,
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

function dealtTable(playerCount, stacks, mode) {
  return applyChance(initializedTable(playerCount, stacks, mode), {
    type: CHANCE_TYPES.DEAL_HOLE,
    cardsByPlayer: cardsFor(playerCount),
  });
}

function act(state, type, amountToMilliBb = null) {
  return applyAction(
    state,
    createAction(state.actingPlayerId, type, amountToMilliBb),
  );
}

function limpedPreflop(playerCount, stacks, mode) {
  let state = dealtTable(playerCount, stacks, mode);
  while (state.phase === PHASES.BETTING) {
    const actor = playerById(state, state.actingPlayerId);
    state = act(state, actor.position === 'BB' ? ACTION_TYPES.CHECK : ACTION_TYPES.CALL);
  }
  return state;
}

function flopState(playerCount = 2, stacks, mode) {
  return applyChance(limpedPreflop(playerCount, stacks, mode), {
    type: CHANCE_TYPES.DEAL_FLOP,
    cards: FLOP,
  });
}

function huStateAtStreet(street) {
  let state = flopState();
  if (street === STREETS.FLOP) return state;
  state = act(act(state, ACTION_TYPES.CHECK), ACTION_TYPES.CHECK);
  state = applyChance(state, { type: CHANCE_TYPES.DEAL_TURN, cards: TURN });
  if (street === STREETS.TURN) return state;
  state = act(act(state, ACTION_TYPES.CHECK), ACTION_TYPES.CHECK);
  return applyChance(state, { type: CHANCE_TYPES.DEAL_RIVER, cards: RIVER });
}

function assertAccounting(state) {
  const totals = ledgerTotals(state);
  assert.equal(totals.potMilliBb, state.potMilliBb);
  assert.equal(totals.deductionMilliBb, state.deductionTotalMilliBb);
  assert.equal(isChipConserved(state), true);
  assert.equal(state.players.every((player) => player.currentStackMilliBb >= 0), true);
}

function assertDeeplyFrozen(value) {
  if (!value || typeof value !== 'object') return;
  assert.equal(Object.isFrozen(value), true);
  for (const child of Object.values(value)) assertDeeplyFrozen(child);
}

test('postflop no-wager action spec offers check, a one-BB minimum bet, and structural all-in', () => {
  const state = flopState();
  const spec = getLegalActionSpec(state);

  assert.equal(state.currentBetMilliBb, 0);
  assert.equal(spec.fold.available, false);
  assert.equal(spec.check.available, true);
  assert.equal(spec.call.available, false);
  assert.deepEqual(spec.bet, {
    available: true,
    minToMilliBb: 1000,
    maxToMilliBb: 98_900,
  });
  assert.equal(spec.raise.available, false);
  assert.deepEqual(spec.allIn, { available: true, amountToMilliBb: 99_000 });
});

test('a postflop wager exposes fold, call, full raise-to, and all-in choices', () => {
  let state = flopState();
  state = act(state, ACTION_TYPES.BET, 1000);
  const spec = getLegalActionSpec(state);

  assert.equal(spec.check.available, false);
  assert.equal(spec.fold.available, true);
  assert.deepEqual(spec.call, {
    available: true,
    toCallMilliBb: 1000,
    commitMilliBb: 1000,
    allIn: false,
  });
  assert.deepEqual(spec.raise, {
    available: true,
    minToMilliBb: 2000,
    maxToMilliBb: 98_900,
  });
  assert.deepEqual(spec.allIn, { available: true, amountToMilliBb: 99_000 });
});

test('an opening bet establishes its size as the next full-raise increment', () => {
  let state = flopState();
  state = act(state, ACTION_TYPES.BET, 3000);

  assert.equal(state.currentBetMilliBb, 3000);
  assert.equal(state.lastFullRaiseIncrementMilliBb, 3000);
  assert.equal(minimumRaiseToMilliBb(state), 6000);
  assert.equal(state.actionHistory.at(-1).wasFullRaise, true);
  assert.equal(getLegalActionSpec(state).raise.minToMilliBb, 6000);
});

test('a short opening all-in does not replace the nominal one-BB full-bet increment', () => {
  let state = flopState(3, [100_000, 1500, 100_000]);
  assert.equal(state.actingPlayerId, 'P1');
  state = act(state, ACTION_TYPES.ALL_IN);

  assert.equal(state.currentBetMilliBb, 500);
  assert.equal(state.lastFullRaiseIncrementMilliBb, 1000);
  assert.equal(state.actionHistory.at(-1).wasFullRaise, false);
  assert.equal(state.actingPlayerId, 'P2');
  assert.deepEqual(getLegalActionSpec(state).raise, {
    available: true,
    minToMilliBb: 1000,
    maxToMilliBb: 98_900,
  });
  state = act(state, ACTION_TYPES.RAISE, 1000);
  assert.equal(state.actionHistory.at(-1).wasFullRaise, true);
  assert.equal(state.lastFullRaiseIncrementMilliBb, 1000);
  assert.equal(minimumRaiseToMilliBb(state), 2000);
});

test('a player who checked retains aggression rights after a short opening all-in', () => {
  let state = flopState(3, [100_000, 100_000, 1500]);
  state = act(state, ACTION_TYPES.CHECK); // P1
  state = act(state, ACTION_TYPES.ALL_IN); // P2 opens to 0.5bb
  state = act(state, ACTION_TYPES.CALL); // P0

  assert.equal(state.actingPlayerId, 'P1');
  assert.equal(hasRaisingRights(state, 'P1'), true);
  assert.equal(getLegalActionSpec(state).raise.minToMilliBb, 1000);
});

test('HU flop check-through completes to explicit turn chance and resets only when dealt', () => {
  let state = flopState();
  state = act(state, ACTION_TYPES.CHECK);
  const completedFlop = act(state, ACTION_TYPES.CHECK);

  assert.equal(completedFlop.phase, PHASES.CHANCE);
  assert.equal(completedFlop.actingPlayerId, null);
  assert.deepEqual(completedFlop.pendingChance, { type: CHANCE_TYPES.DEAL_TURN, cardCount: 1 });
  assert.equal(completedFlop.players.every((player) => player.actedThisStreet), true);
  assert.equal(completedFlop.actionHistory.at(-1).street, STREETS.FLOP);

  const turn = applyChance(completedFlop, { type: CHANCE_TYPES.DEAL_TURN, cards: TURN });
  assert.equal(turn.street, STREETS.TURN);
  assert.equal(turn.phase, PHASES.BETTING);
  assert.equal(turn.actingPlayerId, 'P1');
  assert.equal(turn.currentBetMilliBb, 0);
  assert.equal(turn.players.every((player) => !player.actedThisStreet), true);
  assert.equal(turn.players.every((player) => player.streetContributionMilliBb === 0), true);
});

test('turn check-through requests the river and river check-through becomes showdown-ready', () => {
  let state = flopState();
  state = act(act(state, ACTION_TYPES.CHECK), ACTION_TYPES.CHECK);
  state = applyChance(state, { type: CHANCE_TYPES.DEAL_TURN, cards: TURN });
  state = act(act(state, ACTION_TYPES.CHECK), ACTION_TYPES.CHECK);
  assert.deepEqual(state.pendingChance, { type: CHANCE_TYPES.DEAL_RIVER, cardCount: 1 });

  state = applyChance(state, { type: CHANCE_TYPES.DEAL_RIVER, cards: RIVER });
  state = act(act(state, ACTION_TYPES.CHECK), ACTION_TYPES.CHECK);
  assert.equal(state.street, STREETS.RIVER);
  assert.equal(state.phase, PHASES.SHOWDOWN);
  assert.equal(state.actingPlayerId, null);
  assert.equal(state.pendingChance, null);
  assert.equal(state.showdown.status, 'ready');
  assert.deepEqual(state.showdown.eligiblePlayerIds, ['P0', 'P1']);
  assert.deepEqual(state.actionHistory.map((record) => record.street), [
    STREETS.PREFLOP, STREETS.PREFLOP,
    STREETS.FLOP, STREETS.FLOP,
    STREETS.TURN, STREETS.TURN,
    STREETS.RIVER, STREETS.RIVER,
  ]);
  assertAccounting(state);
});

test('the same bet/call interface completes flop, turn, and river correctly', () => {
  for (const street of [STREETS.FLOP, STREETS.TURN, STREETS.RIVER]) {
    let state = huStateAtStreet(street);
    const potBefore = state.potMilliBb;
    assert.equal(getLegalActionSpec(state).bet.minToMilliBb, 1000);
    state = act(state, ACTION_TYPES.BET, 1000);
    assert.equal(getLegalActionSpec(state).call.toCallMilliBb, 1000);
    state = act(state, ACTION_TYPES.CALL);

    assert.equal(state.potMilliBb, potBefore + 2000);
    assert.deepEqual(state.actionHistory.slice(-2).map((record) => record.street), [street, street]);
    if (street === STREETS.RIVER) {
      assert.equal(state.phase, PHASES.SHOWDOWN);
      assert.equal(state.showdown.status, 'ready');
    } else {
      assert.equal(state.phase, PHASES.CHANCE);
      assert.equal(state.pendingChance.type, street === STREETS.FLOP
        ? CHANCE_TYPES.DEAL_TURN
        : CHANCE_TYPES.DEAL_RIVER);
    }
    assertAccounting(state);
  }
});

test('the same bet/fold interface settles terminally on flop, turn, and river', () => {
  for (const street of [STREETS.FLOP, STREETS.TURN, STREETS.RIVER]) {
    let state = huStateAtStreet(street);
    state = act(state, ACTION_TYPES.BET, 1000);
    assert.equal(getLegalActionSpec(state).fold.available, true);
    state = act(state, ACTION_TYPES.FOLD);

    assert.equal(state.phase, PHASES.TERMINAL);
    assert.equal(state.terminal.reason, 'fold');
    assert.equal(state.actionHistory.at(-1).street, street);
    assertAccounting(state);
  }
});

test('full raise/call sequences complete turn to river and river to showdown', () => {
  for (const street of [STREETS.TURN, STREETS.RIVER]) {
    let state = huStateAtStreet(street);
    state = act(state, ACTION_TYPES.BET, 1000);
    state = act(state, ACTION_TYPES.RAISE, 2000);
    state = act(state, ACTION_TYPES.CALL);

    assert.equal(state.currentBetMilliBb, 2000);
    assert.equal(state.lastFullRaiseIncrementMilliBb, 1000);
    assert.deepEqual(state.actionHistory.slice(-3).map((record) => record.street), [
      street, street, street,
    ]);
    assert.equal(state.phase, street === STREETS.TURN ? PHASES.CHANCE : PHASES.SHOWDOWN);
    if (street === STREETS.TURN) {
      assert.deepEqual(state.pendingChance, { type: CHANCE_TYPES.DEAL_RIVER, cardCount: 1 });
    } else {
      assert.equal(state.pendingChance, null);
      assert.equal(state.showdown.status, 'ready');
    }
    assertAccounting(state);
  }
});

test('3 through 10 players act clockwise after the button and complete on the last check', () => {
  for (let playerCount = 3; playerCount <= 10; playerCount += 1) {
    let state = flopState(playerCount);
    const actors = [];
    while (state.phase === PHASES.BETTING) {
      actors.push(state.actingPlayerId);
      state = act(state, ACTION_TYPES.CHECK);
    }
    assert.deepEqual(actors, [
      ...Array.from({ length: playerCount - 1 }, (_, index) => `P${index + 1}`),
      'P0',
    ]);
    assert.equal(state.pendingChance.type, CHANCE_TYPES.DEAL_TURN);
    assertAccounting(state);
  }
});

test('postflop actor progression skips folded and all-in seats', () => {
  let folded = dealtTable(4);
  folded = act(folded, ACTION_TYPES.CALL); // P3
  folded = act(folded, ACTION_TYPES.CALL); // P0
  folded = act(folded, ACTION_TYPES.FOLD); // P1
  folded = act(folded, ACTION_TYPES.CHECK); // P2
  folded = applyChance(folded, { type: CHANCE_TYPES.DEAL_FLOP, cards: FLOP });
  assert.equal(folded.actingPlayerId, 'P2');
  folded = act(folded, ACTION_TYPES.CHECK);
  assert.equal(folded.actingPlayerId, 'P3');

  let allIn = flopState(4, [100_000, 1000, 100_000, 100_000]);
  assert.equal(playerById(allIn, 'P1').currentStackMilliBb, 0);
  assert.equal(allIn.actingPlayerId, 'P2');
  allIn = act(allIn, ACTION_TYPES.CHECK);
  assert.equal(allIn.actingPlayerId, 'P3');
});

test('multiway bet and all calls complete only after every live responder matches', () => {
  let state = flopState(4);
  state = act(state, ACTION_TYPES.BET, 1000); // P1
  state = act(state, ACTION_TYPES.CALL); // P2
  state = act(state, ACTION_TYPES.CALL); // P3
  assert.equal(state.phase, PHASES.BETTING);
  assert.equal(state.actingPlayerId, 'P0');
  state = act(state, ACTION_TYPES.CALL);

  assert.equal(state.phase, PHASES.CHANCE);
  assert.deepEqual(state.pendingChance, { type: CHANCE_TYPES.DEAL_TURN, cardCount: 1 });
  assert.equal(state.potMilliBb, 8000);
  assert.equal(state.players.every((player) => player.streetContributionMilliBb === 1000), true);
  assertAccounting(state);
});

test('ClubGG deductions stay outside the pot during postflop betting', () => {
  let state = flopState(7, undefined, GAME_MODES.CLUBGG);
  assert.equal(state.deductionTotalMilliBb, 700);
  assert.equal(state.potMilliBb, 7000);
  state = act(state, ACTION_TYPES.BET, 1000);
  while (state.phase === PHASES.BETTING) state = act(state, ACTION_TYPES.CALL);

  assert.equal(state.potMilliBb, 14_000);
  assert.equal(state.deductionTotalMilliBb, 700);
  assert.equal(state.players.every((player) => player.totalDeductionMilliBb === 100), true);
  assert.equal(state.ledger.filter((entry) => (
    entry.kind === LEDGER_KINDS.CLUBGG_FORCED_CONTRIBUTION
  )).length, 7);
  assertAccounting(state);
});

test('postflop raise and re-raise revisit every prior actor that owes a response', () => {
  let state = flopState(3);
  state = act(state, ACTION_TYPES.BET, 1000); // P1
  state = act(state, ACTION_TYPES.RAISE, 2000); // P2
  state = act(state, ACTION_TYPES.RAISE, 3000); // P0
  assert.equal(state.actingPlayerId, 'P1');
  state = act(state, ACTION_TYPES.CALL);
  assert.equal(state.actingPlayerId, 'P2');
  state = act(state, ACTION_TYPES.CALL);

  assert.equal(state.phase, PHASES.CHANCE);
  assert.equal(state.currentBetMilliBb, 3000);
  assert.equal(state.lastFullRaiseIncrementMilliBb, 1000);
  assert.equal(state.players.every((player) => player.streetContributionMilliBb === 3000), true);
  assertAccounting(state);
});

test('one short postflop all-in does not reopen aggression to prior actors', () => {
  let state = flopState(3, [2500, 100_000, 100_000]);
  state = act(state, ACTION_TYPES.BET, 1000); // P1
  state = act(state, ACTION_TYPES.CALL); // P2
  state = act(state, ACTION_TYPES.ALL_IN); // P0 to 1.5bb

  assert.equal(state.currentBetMilliBb, 1500);
  assert.equal(state.actingPlayerId, 'P1');
  assert.equal(hasRaisingRights(state, 'P1'), false);
  assert.equal(getLegalActionSpec(state).raise.available, false);
  assert.equal(getLegalActionSpec(state).allIn.available, false);
  assert.equal(getLegalActionSpec(state).call.available, true);
});

test('cumulative short postflop all-ins reopen once they reach a full increment', () => {
  let state = flopState(4, [3000, 100_000, 100_000, 2500]);
  state = act(state, ACTION_TYPES.BET, 1000); // P1
  state = act(state, ACTION_TYPES.CALL); // P2
  state = act(state, ACTION_TYPES.ALL_IN); // P3 to 1.5bb
  assert.equal(state.currentBetMilliBb, 1500);
  state = act(state, ACTION_TYPES.ALL_IN); // P0 to 2bb

  assert.equal(state.currentBetMilliBb, 2000);
  assert.equal(state.lastFullRaiseIncrementMilliBb, 1000);
  assert.equal(state.actingPlayerId, 'P1');
  assert.equal(hasRaisingRights(state, 'P1'), true);
  assert.equal(getLegalActionSpec(state).raise.minToMilliBb, 3000);
  assert.equal(state.actionHistory.at(-1).wasFullRaise, false);
  assert.equal(state.actionHistory.at(-1).reopenedBetting, true);
});

test('when only one non-all-in player remains, required responses finish without a fake actor', () => {
  let state = flopState(3, [2000, 100_000, 2500]);
  state = act(state, ACTION_TYPES.BET, 1000); // P1
  state = act(state, ACTION_TYPES.ALL_IN); // P2 to 1.5bb
  state = act(state, ACTION_TYPES.CALL); // P0 calls 1bb all-in
  assert.equal(state.actionHistory.at(-1).wasAllIn, true);
  assert.equal(state.actingPlayerId, 'P1');
  const skippedRequiredResponse = structuredClone(state);
  skippedRequiredResponse.phase = PHASES.CHANCE;
  skippedRequiredResponse.actingPlayerId = null;
  skippedRequiredResponse.pendingChance = { type: CHANCE_TYPES.DEAL_TURN, cardCount: 1 };
  assert.throws(() => validatePokerState(skippedRequiredResponse));
  state = act(state, ACTION_TYPES.CALL); // sole player with chips supplies final response

  assert.equal(state.phase, PHASES.CHANCE);
  assert.equal(state.actingPlayerId, null);
  assert.deepEqual(state.pendingChance, { type: CHANCE_TYPES.DEAL_TURN, cardCount: 1 });
  assert.equal(state.players.filter((player) => !player.folded && player.currentStackMilliBb > 0).length, 1);
  const fakeCheck = structuredClone(state);
  fakeCheck.phase = PHASES.BETTING;
  fakeCheck.actingPlayerId = 'P1';
  fakeCheck.pendingChance = null;
  assert.throws(() => validatePokerState(fakeCheck));
  assertAccounting(state);
});

test('a stack-limited postflop all-in call refunds uniquely unmatched excess once', () => {
  let state = flopState(2, [3000, 10_000]);
  state = act(state, ACTION_TYPES.ALL_IN); // P1 opens to 9bb
  const beforeCallLedgerLength = state.ledger.length;
  const spec = getLegalActionSpec(state);
  assert.equal(spec.call.allIn, true);
  assert.equal(spec.call.commitMilliBb, 2000);
  state = act(state, ACTION_TYPES.CALL);

  assert.equal(state.phase, PHASES.CHANCE);
  assert.equal(state.potMilliBb, 6000);
  assert.equal(state.ledger.length, beforeCallLedgerLength + 2);
  assert.deepEqual(state.ledger.slice(-2).map((entry) => entry.kind), [
    LEDGER_KINDS.ACTION,
    LEDGER_KINDS.UNCALLED_REFUND,
  ]);
  assert.equal(state.ledger.at(-1).amountMilliBb, 7000);
  assert.equal(playerById(state, 'P1').currentStackMilliBb, 7000);
  assertAccounting(state);
});

test('postflop fold terminal uses existing refund and pot settlement', () => {
  let state = flopState();
  state = act(state, ACTION_TYPES.BET, 1000); // P1
  state = act(state, ACTION_TYPES.FOLD); // P0

  assert.equal(state.phase, PHASES.TERMINAL);
  assert.equal(state.terminal.reason, 'fold');
  assert.deepEqual(state.terminal.winnerPlayerIds, ['P1']);
  assert.deepEqual(state.terminal.refundsMilliBbByPlayer, { P1: 1000 });
  assert.deepEqual(state.terminal.payoutsMilliBbByPlayer, { P1: 2000 });
  assert.equal(state.potMilliBb, 0);
  assert.equal(playerById(state, 'P1').currentStackMilliBb, 101_000);
  assert.equal(state.actionHistory.at(-1).street, STREETS.FLOP);
  assertAccounting(state);
});

test('postflop transitions are immutable and deeply frozen', () => {
  const before = flopState(3);
  const snapshot = structuredClone(before);
  const after = act(before, ACTION_TYPES.BET, 1000);

  assert.deepEqual(before, snapshot);
  assertDeeplyFrozen(after);
  assertAccounting(after);
});

test('representative actions advertised by the postflop legal spec are accepted', () => {
  const noWager = flopState(3);
  const noWagerSpec = getLegalActionSpec(noWager);
  const noWagerActions = [
    createAction(noWager.actingPlayerId, ACTION_TYPES.CHECK),
    createAction(noWager.actingPlayerId, ACTION_TYPES.BET, noWagerSpec.bet.minToMilliBb),
    createAction(noWager.actingPlayerId, ACTION_TYPES.ALL_IN),
  ];
  for (const action of noWagerActions) validatePokerState(applyAction(noWager, action));

  const facingWager = act(noWager, ACTION_TYPES.BET, 1000);
  const facingSpec = getLegalActionSpec(facingWager);
  const facingActions = [
    createAction(facingWager.actingPlayerId, ACTION_TYPES.FOLD),
    createAction(facingWager.actingPlayerId, ACTION_TYPES.CALL),
    createAction(facingWager.actingPlayerId, ACTION_TYPES.RAISE, facingSpec.raise.minToMilliBb),
    createAction(facingWager.actingPlayerId, ACTION_TYPES.ALL_IN),
  ];
  for (const action of facingActions) validatePokerState(applyAction(facingWager, action));
});

test('postflop validation rejects incoherent actors, current bets, chance, and showdown states', () => {
  const flop = flopState();
  assert.throws(() => applyAction(flop, createAction('P0', ACTION_TYPES.CHECK)));
  assert.throws(() => applyAction(flop, createAction('P1', ACTION_TYPES.CALL)));
  assert.throws(() => applyAction(flop, createAction('P1', ACTION_TYPES.BET, 500)));
  assert.throws(() => applyAction(flop, createAction('P1', ACTION_TYPES.RAISE, 1000)));

  const mismatchedBet = structuredClone(flop);
  mismatchedBet.actionHistory.push({
    schemaVersion: 'poker-action-record/v1',
    sequence: mismatchedBet.actionHistory.length,
    street: STREETS.FLOP,
    playerId: 'P1',
    submittedAction: createAction('P1', ACTION_TYPES.CHECK),
    toCallBeforeMilliBb: 0,
    committedMilliBb: 0,
    streetContributionAfterMilliBb: 0,
    currentBetBeforeMilliBb: 0,
    currentBetAfterMilliBb: 0,
    wasAllIn: false,
    wasFullRaise: false,
    reopenedBetting: false,
  });
  mismatchedBet.currentBetMilliBb = 1000;
  assert.throws(() => validatePokerState(mismatchedBet));

  const skippedBetting = structuredClone(flop);
  skippedBetting.phase = PHASES.CHANCE;
  skippedBetting.actingPlayerId = null;
  skippedBetting.pendingChance = { type: CHANCE_TYPES.DEAL_TURN, cardCount: 1 };
  assert.throws(() => validatePokerState(skippedBetting));

  let river = flop;
  river = act(act(river, ACTION_TYPES.CHECK), ACTION_TYPES.CHECK);
  river = applyChance(river, { type: CHANCE_TYPES.DEAL_TURN, cards: TURN });
  river = act(act(river, ACTION_TYPES.CHECK), ACTION_TYPES.CHECK);
  river = applyChance(river, { type: CHANCE_TYPES.DEAL_RIVER, cards: RIVER });
  const prematureShowdown = structuredClone(river);
  prematureShowdown.phase = PHASES.SHOWDOWN;
  prematureShowdown.actingPlayerId = null;
  prematureShowdown.showdown = {
    status: 'ready',
    eligiblePlayerIds: ['P0', 'P1'],
    pots: [],
    handRanksByPlayer: null,
  };
  assert.throws(() => validatePokerState(prematureShowdown));
});
