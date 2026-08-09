import test from 'node:test';
import assert from 'node:assert/strict';

import {
  ACTION_TYPES,
  ANTE_TYPES,
  CHANCE_TYPES,
  GAME_MODES,
  LEDGER_KINDS,
  PHASES,
  POKER_ACTION_SCHEMA_VERSION,
  applyAction,
  applyChance,
  amountToCallMilliBb,
  createAction,
  currentActor,
  getLegalActionSpec,
  hasRaisingRights,
  initializeHand,
  isChipConserved,
  isPlayerAllIn,
  ledgerTotals,
  maximumAmountToMilliBb,
  minimumBetToMilliBb,
  minimumRaiseToMilliBb,
  playerById,
} from '../shared/poker-domain/index.js';

const cards = Object.freeze({
  P0: Object.freeze(['As', 'Kh']),
  P1: Object.freeze(['Qd', 'Jc']),
});

function initializedHu(stacks = [100_000, 100_000], chipUnitMilliBb = 100) {
  return initializeHand({
    handId: 'engine-003-test',
    game: {
      mode: GAME_MODES.HOME,
      smallBlindMilliBb: 500,
      bigBlindMilliBb: 1000,
      chipUnitMilliBb,
      ante: { type: ANTE_TYPES.NONE, amountMilliBb: 0 },
    },
    buttonSeat: 0,
    players: [
      { playerId: 'P0', seat: 0, startingStackMilliBb: stacks[0] },
      { playerId: 'P1', seat: 1, startingStackMilliBb: stacks[1] },
    ],
  });
}

function bettingHu(stacks, chipUnitMilliBb) {
  return applyChance(initializedHu(stacks, chipUnitMilliBb), {
    type: CHANCE_TYPES.DEAL_HOLE,
    cardsByPlayer: cards,
  });
}

function noWagerHu(stacks = [100_000, 100_000]) {
  const state = structuredClone(bettingHu(stacks));
  state.potMilliBb = 0;
  state.currentBetMilliBb = 0;
  state.lastFullRaiseIncrementMilliBb = state.game.bigBlindMilliBb;
  state.lastAggressorPlayerId = null;
  state.ledger = [];
  state.actionHistory = [];
  for (const player of state.players) {
    player.currentStackMilliBb = player.startingStackMilliBb;
    player.streetContributionMilliBb = 0;
    player.totalPotContributionMilliBb = 0;
    player.actedThisStreet = false;
    player.raiseReopenAtMilliBb = null;
  }
  state.actingPlayerId = 'P0';
  return state;
}

function action(playerId, type, amountToMilliBb = null) {
  return createAction(playerId, type, amountToMilliBb);
}

function assertDeeplyFrozen(value) {
  if (!value || typeof value !== 'object') return;
  assert.equal(Object.isFrozen(value), true);
  for (const child of Object.values(value)) assertDeeplyFrozen(child);
}

function assertAccounting(state) {
  const ledger = ledgerTotals(state);
  assert.equal(ledger.potMilliBb, state.potMilliBb);
  assert.equal(ledger.deductionMilliBb, state.deductionTotalMilliBb);
  assert.equal(isChipConserved(state), true);
  assert.equal(state.players.every((player) => player.currentStackMilliBb >= 0), true);
}

test('deal_hole is deterministic, immutable, and starts HU betting with BTN/SB', () => {
  const before = initializedHu();
  const beforeJson = JSON.stringify(before);
  const state = applyChance(before, { type: CHANCE_TYPES.DEAL_HOLE, cardsByPlayer: cards });

  assert.equal(JSON.stringify(before), beforeJson);
  assert.deepEqual(playerById(state, 'P0').holeCards, ['As', 'Kh']);
  assert.deepEqual(playerById(state, 'P1').holeCards, ['Qd', 'Jc']);
  assert.equal(state.phase, PHASES.BETTING);
  assert.equal(state.actingPlayerId, 'P0');
  assert.equal(currentActor(state).position, 'BTN');
  assert.equal(state.pendingChance, null);
  assertDeeplyFrozen(state);
  assertAccounting(state);
});

test('deal_hole rejects wrong events, malformed cards, duplicates, missing players, and replay', () => {
  const before = initializedHu();
  assert.throws(() => applyChance(before, { type: CHANCE_TYPES.DEAL_FLOP, cardsByPlayer: cards }));
  assert.throws(() => applyChance(before, {
    type: CHANCE_TYPES.DEAL_HOLE,
    cardsByPlayer: { P0: ['A', 'Kh'], P1: ['Qd', 'Jc'] },
  }));
  assert.throws(() => applyChance(before, {
    type: CHANCE_TYPES.DEAL_HOLE,
    cardsByPlayer: { P0: ['As', 'Kh'], P1: ['As', 'Jc'] },
  }));
  assert.throws(() => applyChance(before, {
    type: CHANCE_TYPES.DEAL_HOLE,
    cardsByPlayer: { P0: ['As', 'Kh'] },
  }));
  const dealt = applyChance(before, { type: CHANCE_TYPES.DEAL_HOLE, cardsByPlayer: cards });
  assert.throws(() => applyChance(dealt, { type: CHANCE_TYPES.DEAL_HOLE, cardsByPlayer: cards }));
});

test('core selectors expose exact HU initial call and raise-to bounds', () => {
  const state = bettingHu();
  const spec = getLegalActionSpec(state);
  assert.equal(amountToCallMilliBb(state), 500);
  assert.equal(maximumAmountToMilliBb(state), 100_000);
  assert.equal(minimumBetToMilliBb(state), null);
  assert.equal(minimumRaiseToMilliBb(state), 2000);
  assert.equal(hasRaisingRights(state), true);
  assert.deepEqual(spec.fold, { available: true });
  assert.deepEqual(spec.call, {
    available: true,
    toCallMilliBb: 500,
    commitMilliBb: 500,
    allIn: false,
  });
  assert.deepEqual(spec.raise, {
    available: true,
    minToMilliBb: 2000,
    maxToMilliBb: 99_900,
  });
  assert.deepEqual(spec.allIn, { available: true, amountToMilliBb: 100_000 });
  assertDeeplyFrozen(spec);
});

test('SB fold settles contestable pot, refunds uncalled blind excess, and preserves chips', () => {
  const before = bettingHu();
  const state = applyAction(before, action('P0', ACTION_TYPES.FOLD));

  assert.equal(state.phase, PHASES.TERMINAL);
  assert.equal(state.terminal.reason, 'fold');
  assert.deepEqual(state.terminal.winnerPlayerIds, ['P1']);
  assert.deepEqual(state.terminal.payoutsMilliBbByPlayer, { P1: 1000 });
  assert.deepEqual(state.terminal.refundsMilliBbByPlayer, { P1: 500 });
  assert.equal(state.potMilliBb, 0);
  assert.equal(playerById(state, 'P1').currentStackMilliBb, 100_500);
  assert.deepEqual(state.ledger.slice(-2).map((entry) => entry.kind), [
    LEDGER_KINDS.UNCALLED_REFUND,
    LEDGER_KINDS.POT_AWARD,
  ]);
  assertAccounting(state);
  assertDeeplyFrozen(state);
});

test('SB limp gives BB its check-or-raise option', () => {
  const state = applyAction(bettingHu(), action('P0', ACTION_TYPES.CALL));
  const spec = getLegalActionSpec(state);
  assert.equal(state.actingPlayerId, 'P1');
  assert.equal(playerById(state, 'P0').streetContributionMilliBb, 1000);
  assert.equal(state.potMilliBb, 2000);
  assert.equal(spec.check.available, true);
  assert.equal(spec.fold.available, false);
  assert.equal(spec.call.available, false);
  assert.equal(spec.raise.available, true);
  assertAccounting(state);
});

test('limp then BB check completes preflop at explicit deal_flop chance', () => {
  const limped = applyAction(bettingHu(), action('P0', ACTION_TYPES.CALL));
  const state = applyAction(limped, action('P1', ACTION_TYPES.CHECK));
  assert.equal(state.phase, PHASES.CHANCE);
  assert.equal(state.actingPlayerId, null);
  assert.deepEqual(state.pendingChance, { type: CHANCE_TYPES.DEAL_FLOP, cardCount: 3 });
  assert.equal(state.terminal.isTerminal, false);
  assertAccounting(state);
});

test('raise-to 3bb commits 2.5bb and makes the next full raise-to 5bb', () => {
  const before = bettingHu();
  const state = applyAction(before, action('P0', ACTION_TYPES.RAISE, 3000));
  const record = state.actionHistory[0];
  assert.equal(state.actingPlayerId, 'P1');
  assert.equal(playerById(state, 'P0').streetContributionMilliBb, 3000);
  assert.equal(playerById(state, 'P0').currentStackMilliBb, 97_000);
  assert.equal(state.potMilliBb, 4000);
  assert.equal(state.currentBetMilliBb, 3000);
  assert.equal(state.lastFullRaiseIncrementMilliBb, 2000);
  assert.equal(minimumRaiseToMilliBb(state), 5000);
  assert.equal(record.committedMilliBb, 2500);
  assert.equal(record.currentBetBeforeMilliBb, 1000);
  assert.equal(record.currentBetAfterMilliBb, 3000);
  assert.equal(record.wasFullRaise, true);
  assert.equal(record.reopenedBetting, true);
  assert.equal(record.submittedAction.amountToMilliBb, 3000);
  assertAccounting(state);
});

test('minimum open raise is accepted and an under-minimum non-all-in raise is rejected', () => {
  const before = bettingHu();
  const minRaised = applyAction(before, action('P0', ACTION_TYPES.RAISE, 2000));
  assert.equal(minRaised.currentBetMilliBb, 2000);
  assert.throws(() => applyAction(before, action('P0', ACTION_TYPES.RAISE, 1900)));
});

test('raise then sufficient call completes preflop', () => {
  const raised = applyAction(bettingHu(), action('P0', ACTION_TYPES.RAISE, 3000));
  const state = applyAction(raised, action('P1', ACTION_TYPES.CALL));
  assert.equal(state.phase, PHASES.CHANCE);
  assert.equal(state.potMilliBb, 6000);
  assert.equal(state.actionHistory[1].committedMilliBb, 2000);
  assert.equal(state.actionHistory[1].wasAllIn, false);
  assertAccounting(state);
});

test('raise, minimum re-raise, and call follow the original raiser/caller progression', () => {
  const open = applyAction(bettingHu(), action('P0', ACTION_TYPES.RAISE, 3000));
  const reraised = applyAction(open, action('P1', ACTION_TYPES.RAISE, 5000));
  assert.equal(reraised.actingPlayerId, 'P0');
  assert.equal(minimumRaiseToMilliBb(reraised), 7000);
  assert.equal(reraised.lastFullRaiseIncrementMilliBb, 2000);
  const called = applyAction(reraised, action('P0', ACTION_TYPES.CALL));
  assert.equal(called.phase, PHASES.CHANCE);
  assert.equal(called.potMilliBb, 10_000);
  assertAccounting(called);
});

test('aggressive all-in is structural and a matched all-in call remains call', () => {
  const shoved = applyAction(bettingHu(), action('P0', ACTION_TYPES.ALL_IN));
  assert.equal(shoved.currentBetMilliBb, 100_000);
  assert.equal(shoved.actionHistory[0].submittedAction.amountToMilliBb, null);
  assert.equal(shoved.actionHistory[0].wasAllIn, true);
  const spec = getLegalActionSpec(shoved);
  assert.equal(spec.call.available, true);
  assert.equal(spec.call.allIn, true);
  assert.equal(spec.allIn.available, false);
  const called = applyAction(shoved, action('P1', ACTION_TYPES.CALL));
  assert.equal(called.actionHistory[1].submittedAction.type, ACTION_TYPES.CALL);
  assert.equal(called.actionHistory[1].wasAllIn, true);
  assert.equal(called.phase, PHASES.CHANCE);
  assertAccounting(called);
});

test('stack-limited all-in call refunds the uncalled excess before deal_flop', () => {
  const raised = applyAction(bettingHu([100_000, 2000]), action('P0', ACTION_TYPES.RAISE, 3000));
  const spec = getLegalActionSpec(raised);
  assert.deepEqual(spec.call, {
    available: true,
    toCallMilliBb: 2000,
    commitMilliBb: 1000,
    allIn: true,
  });
  const state = applyAction(raised, action('P1', ACTION_TYPES.CALL));
  assert.equal(state.phase, PHASES.CHANCE);
  assert.equal(state.potMilliBb, 4000);
  assert.equal(state.actionHistory[1].committedMilliBb, 1000);
  assert.equal(state.actionHistory[1].wasAllIn, true);
  assert.equal(state.ledger.at(-1).kind, LEDGER_KINDS.UNCALLED_REFUND);
  assert.equal(state.ledger.at(-1).amountMilliBb, 1000);
  assertAccounting(state);
});

test('short aggressive all-in raises current bet without changing the full-raise increment', () => {
  const open = applyAction(bettingHu([100_000, 4000]), action('P0', ACTION_TYPES.RAISE, 3000));
  const beforeShoveSpec = getLegalActionSpec(open);
  assert.equal(beforeShoveSpec.raise.available, false);
  assert.deepEqual(beforeShoveSpec.allIn, { available: true, amountToMilliBb: 4000 });
  const shoved = applyAction(open, action('P1', ACTION_TYPES.ALL_IN));
  assert.equal(shoved.currentBetMilliBb, 4000);
  assert.equal(shoved.lastFullRaiseIncrementMilliBb, 2000);
  assert.equal(shoved.actionHistory[1].wasFullRaise, false);
  assert.equal(shoved.actionHistory[1].reopenedBetting, false);
  assert.equal(shoved.actingPlayerId, 'P0');
});

test('short all-in does not reopen aggression to the player who made the prior full raise', () => {
  const open = applyAction(bettingHu([100_000, 4000]), action('P0', ACTION_TYPES.RAISE, 3000));
  const shoved = applyAction(open, action('P1', ACTION_TYPES.ALL_IN));
  const spec = getLegalActionSpec(shoved);
  assert.equal(hasRaisingRights(shoved, 'P0'), false);
  assert.equal(spec.fold.available, true);
  assert.equal(spec.call.available, true);
  assert.equal(spec.raise.available, false);
  assert.equal(spec.allIn.available, false);
  const called = applyAction(shoved, action('P0', ACTION_TYPES.CALL));
  assert.equal(called.phase, PHASES.CHANCE);
  assert.equal(called.potMilliBb, 8000);
  assertAccounting(called);
});

test('full re-raise reopens aggression to the prior raiser', () => {
  const open = applyAction(bettingHu(), action('P0', ACTION_TYPES.RAISE, 3000));
  const reraised = applyAction(open, action('P1', ACTION_TYPES.RAISE, 5000));
  assert.equal(hasRaisingRights(reraised, 'P0'), true);
  assert.equal(getLegalActionSpec(reraised).raise.available, true);
});

test('a no-wager state offers bet bounds and rejects raise semantics', () => {
  const state = noWagerHu();
  const spec = getLegalActionSpec(state);
  assert.equal(spec.check.available, true);
  assert.equal(spec.bet.available, true);
  assert.equal(spec.bet.minToMilliBb, 1000);
  assert.equal(spec.raise.available, false);
  assert.throws(() => applyAction(state, action('P0', ACTION_TYPES.RAISE, 2000)));
  const bet = applyAction(state, action('P0', ACTION_TYPES.BET, 1000));
  assert.equal(bet.currentBetMilliBb, 1000);
  assert.equal(bet.actionHistory[0].wasFullRaise, true);
});

test('a checked player retains raising rights after a short opening all-in', () => {
  const checked = applyAction(noWagerHu([100_000, 500]), action('P0', ACTION_TYPES.CHECK));
  const shortShove = applyAction(checked, action('P1', ACTION_TYPES.ALL_IN));
  assert.equal(shortShove.currentBetMilliBb, 500);
  assert.equal(shortShove.actionHistory[1].wasFullRaise, false);
  assert.equal(hasRaisingRights(shortShove, 'P0'), true);
  const spec = getLegalActionSpec(shortShove);
  assert.equal(spec.call.available, true);
  assert.equal(spec.call.commitMilliBb, 500);
  assert.equal(spec.raise.available, false);
  assert.equal(spec.allIn.available, false);
});

test('every action transition is immutable and deeply frozen', () => {
  const before = bettingHu();
  const snapshot = structuredClone(before);
  const after = applyAction(before, action('P0', ACTION_TYPES.CALL));
  assert.deepEqual(before, snapshot);
  assertDeeplyFrozen(after);
  assert.notEqual(after, before);
  assert.notEqual(after.players, before.players);
});

test('illegal turn, phase, terminal, and basic semantic actions are rejected', () => {
  const chance = initializedHu();
  assert.throws(() => applyAction(chance, action('P0', ACTION_TYPES.CALL)));

  const state = bettingHu();
  assert.throws(() => applyAction(state, action('P1', ACTION_TYPES.CALL)));
  assert.throws(() => applyAction(state, action('P0', ACTION_TYPES.CHECK)));
  assert.throws(() => applyAction(state, action('P0', ACTION_TYPES.BET, 2000)));

  const terminal = applyAction(state, action('P0', ACTION_TYPES.FOLD));
  assert.throws(() => applyAction(terminal, action('P1', ACTION_TYPES.CHECK)));

  const limped = applyAction(state, action('P0', ACTION_TYPES.CALL));
  assert.throws(() => applyAction(limped, action('P1', ACTION_TYPES.CALL)));
  assert.throws(() => applyAction(limped, action('P1', ACTION_TYPES.FOLD)));
});

test('malformed Action v1 values and aggression beyond stack are rejected', () => {
  const state = bettingHu();
  assert.throws(() => applyAction(state, {
    schemaVersion: 'wrong', playerId: 'P0', type: ACTION_TYPES.CALL, amountToMilliBb: null,
  }));
  assert.throws(() => applyAction(state, {
    schemaVersion: POKER_ACTION_SCHEMA_VERSION, playerId: 'P0', type: ACTION_TYPES.CALL,
  }));
  assert.throws(() => applyAction(state, {
    schemaVersion: POKER_ACTION_SCHEMA_VERSION,
    playerId: 'P0',
    type: ACTION_TYPES.CALL,
    amountToMilliBb: null,
    modelActionIndex: 1,
  }));
  assert.throws(() => applyAction(state, action('P0', ACTION_TYPES.RAISE, -100)));
  assert.throws(() => applyAction(state, action('P0', ACTION_TYPES.RAISE, 2000.5)));
  assert.throws(() => applyAction(state, action('P0', ACTION_TYPES.RAISE, 100_100)));
  assert.throws(() => applyAction(state, action('P0', ACTION_TYPES.ALL_IN, 100_000)));
  assert.throws(() => applyAction(state, action('P0', ACTION_TYPES.CALL, 1000)));
});

test('complete-stack aggression must use all_in instead of a sized raise', () => {
  const state = bettingHu();
  assert.throws(() => applyAction(state, action('P0', ACTION_TYPES.RAISE, 100_000)));
  const shoved = applyAction(state, action('P0', ACTION_TYPES.ALL_IN));
  assert.equal(isPlayerAllIn(playerById(shoved, 'P0')), true);
});

test('ActionRecord is structural, versioned, contiguous, and replay-oriented', () => {
  const limped = applyAction(bettingHu(), action('P0', ACTION_TYPES.CALL));
  const checked = applyAction(limped, action('P1', ACTION_TYPES.CHECK));
  assert.deepEqual(checked.actionHistory.map((record) => record.sequence), [0, 1]);
  assert.deepEqual(checked.actionHistory[0], {
    schemaVersion: 'poker-action-record/v1',
    sequence: 0,
    street: 'preflop',
    playerId: 'P0',
    submittedAction: action('P0', ACTION_TYPES.CALL),
    toCallBeforeMilliBb: 500,
    committedMilliBb: 500,
    streetContributionAfterMilliBb: 1000,
    currentBetBeforeMilliBb: 1000,
    currentBetAfterMilliBb: 1000,
    wasAllIn: false,
    wasFullRaise: false,
    reopenedBetting: false,
  });
});

test('player gross contributions and ledger-directed pot agree through a re-raise line', () => {
  const states = [];
  states.push(bettingHu());
  states.push(applyAction(states.at(-1), action('P0', ACTION_TYPES.RAISE, 3000)));
  states.push(applyAction(states.at(-1), action('P1', ACTION_TYPES.RAISE, 5000)));
  states.push(applyAction(states.at(-1), action('P0', ACTION_TYPES.CALL)));
  for (const state of states) assertAccounting(state);
  const final = states.at(-1);
  assert.deepEqual(final.players.map((player) => player.totalPotContributionMilliBb), [5000, 5000]);
  assert.equal(final.potMilliBb, 10_000);
});

test('ClubGG initialization remains outside the pot and HU transitions reject unsupported table size', () => {
  const club = initializeHand({
    game: {
      mode: GAME_MODES.CLUBGG,
      smallBlindMilliBb: 500,
      bigBlindMilliBb: 1000,
      chipUnitMilliBb: 100,
      ante: { type: ANTE_TYPES.NONE, amountMilliBb: 0 },
    },
    buttonSeat: 0,
    players: Array.from({ length: 7 }, (_, seat) => ({
      playerId: `P${seat}`,
      seat,
      startingStackMilliBb: 100_000,
    })),
  });
  assert.equal(club.deductionTotalMilliBb, 700);
  assert.equal(club.potMilliBb, 1500);
  assertAccounting(club);
  assert.throws(() => applyChance(club, {
    type: CHANCE_TYPES.DEAL_HOLE,
    cardsByPlayer: {},
  }), /heads-up/);
});
