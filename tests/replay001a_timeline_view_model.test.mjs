import test from 'node:test';
import assert from 'node:assert/strict';

import {
  ACTION_TYPES,
  ANTE_TYPES,
  CHANCE_TYPES,
  GAME_MODES,
  PHASES,
  applyAction,
  applyChance,
  createAction,
  initializeHand,
  resolveShowdown,
} from '../shared/poker-domain/index.js';
import {
  REPLAY_TIMELINE_SCHEMA_VERSION,
  createReplayTimelineViewModel,
} from '../app/src/application/replay-timeline-view-model.mjs';

const HOLE_CARDS = Object.freeze([
  ['As', 'Ad'], ['Kh', 'Kd'], ['Qh', 'Qd'], ['Jh', 'Jd'], ['Th', 'Td'],
  ['9h', '9d'], ['8h', '8d'], ['7h', '7d'], ['6h', '6d'], ['5h', '5d'],
]);
const BOARD = Object.freeze(['2c', '3c', '4c', '9s', 'Jc']);

function configuration(playerCount = 2, {
  stacks = null,
  buttonSeat = 0,
  mode = GAME_MODES.HOME,
} = {}) {
  return {
    handId: `replay-001a-${playerCount}`,
    game: {
      mode,
      smallBlindMilliBb: 500,
      bigBlindMilliBb: 1000,
      chipUnitMilliBb: 100,
      ante: { type: ANTE_TYPES.NONE, amountMilliBb: 0 },
    },
    buttonSeat,
    players: Array.from({ length: playerCount }, (_, seat) => ({
      playerId: `P${seat}`,
      seat,
      startingStackMilliBb: stacks?.[seat] ?? 100_000,
    })),
  };
}

function initialized(playerCount = 2, options = {}) {
  return initializeHand(configuration(playerCount, options));
}

function dealt(playerCount = 2, options = {}) {
  const state = initialized(playerCount, options);
  return applyChance(state, {
    type: CHANCE_TYPES.DEAL_HOLE,
    cardsByPlayer: Object.fromEntries(
      state.players.map((player, index) => [player.playerId, HOLE_CARDS[index]]),
    ),
  });
}

function observed(playerCount = 2, heroPlayerId = 'P0') {
  const state = initialized(playerCount);
  return applyChance(state, {
    type: CHANCE_TYPES.DEAL_HOLE,
    cardsByPlayer: { [heroPlayerId]: HOLE_CARDS[Number(heroPlayerId.slice(1))] },
    hiddenPlayerIds: state.players
      .map((player) => player.playerId)
      .filter((playerId) => playerId !== heroPlayerId),
  });
}

function act(state, type, amountToMilliBb = null) {
  return applyAction(state, createAction(state.actingPlayerId, type, amountToMilliBb));
}

function model(state, heroPlayerId = 'P0') {
  return createReplayTimelineViewModel({ state, heroPlayerId });
}

function allEntries(viewModel) {
  return viewModel.groups.flatMap((group) => group.entries);
}

function streetGroup(viewModel, street) {
  return viewModel.groups.find((group) => group.street === street);
}

function assertDeeplyFrozen(value) {
  if (!value || typeof value !== 'object') return;
  assert.equal(Object.isFrozen(value), true);
  for (const child of Object.values(value)) assertDeeplyFrozen(child);
}

function waitingForFlop(state = dealt()) {
  state = act(state, ACTION_TYPES.CALL);
  return act(state, ACTION_TYPES.CHECK);
}

function freshFlop(state = waitingForFlop()) {
  return applyChance(state, {
    type: CHANCE_TYPES.DEAL_FLOP,
    cards: BOARD.slice(0, 3),
  });
}

function waitingForTurn(state = freshFlop()) {
  state = act(state, ACTION_TYPES.CHECK);
  return act(state, ACTION_TYPES.CHECK);
}

function freshTurn(state = waitingForTurn()) {
  return applyChance(state, { type: CHANCE_TYPES.DEAL_TURN, cards: [BOARD[3]] });
}

function waitingForRiver(state = freshTurn()) {
  state = act(state, ACTION_TYPES.CHECK);
  return act(state, ACTION_TYPES.CHECK);
}

function freshRiver(state = waitingForRiver()) {
  return applyChance(state, { type: CHANCE_TYPES.DEAL_RIVER, cards: [BOARD[4]] });
}

function showdownState(state = freshRiver()) {
  state = act(state, ACTION_TYPES.CHECK);
  return act(state, ACTION_TYPES.CHECK);
}

test('replay-timeline/v1 is deeply immutable and never mutates canonical input', () => {
  const state = initialized(6);
  const snapshot = structuredClone(state);
  const viewModel = model(state, 'P3');

  assert.equal(viewModel.schemaVersion, REPLAY_TIMELINE_SCHEMA_VERSION);
  assert.equal(viewModel.mode, 'hand');
  assert.equal(viewModel.handId, 'replay-001a-6');
  assert.equal(viewModel.status, 'awaiting_private_cards');
  assert.deepEqual(state, snapshot);
  assertDeeplyFrozen(viewModel);
});

test('empty/not-started and awaiting-private-cards models have truthful markers', () => {
  const empty = createReplayTimelineViewModel();
  assert.equal(empty.empty, true);
  assert.equal(empty.emptyState, 'not_started');
  assert.deepEqual(empty.groups, []);
  assert.deepEqual(empty.currentMarker, {
    kind: 'empty', street: null, targetStreet: null,
    labelKey: 'replay.marker.empty', actor: null,
  });

  const initial = model(initialized());
  assert.equal(initial.empty, false);
  assert.equal(initial.entryCount, 0);
  assert.equal(initial.emptyState, 'no_voluntary_actions');
  assert.equal(initial.currentMarker.kind, 'awaiting_private_cards');
  assert.equal(initial.currentMarker.actor, null);
  assert.deepEqual(initial.groups.map((group) => group.street), ['preflop']);
});

test('forced blinds and ClubGG deductions never become voluntary Replay entries', () => {
  const home = model(dealt());
  assert.equal(home.entryCount, 0);
  assert.deepEqual(allEntries(home), []);

  const club = initialized(7, { mode: GAME_MODES.CLUBGG });
  assert.ok(club.ledger.length > 2);
  assert.equal(model(club, 'P6').entryCount, 0);
});

test('canonical sequence is chronological and street groups retain poker order', () => {
  const state = freshTurn();
  const viewModel = model(state);

  assert.deepEqual(allEntries(viewModel).map((entry) => entry.sequence), [0, 1, 2, 3]);
  assert.deepEqual(viewModel.groups.map((group) => group.street), ['preflop', 'flop', 'turn']);
  assert.deepEqual(streetGroup(viewModel, 'preflop').entries.map((entry) => entry.street), ['preflop', 'preflop']);
  assert.deepEqual(streetGroup(viewModel, 'flop').entries.map((entry) => entry.street), ['flop', 'flop']);
});

test('a newly dealt postflop street gets a current group without a fake action', () => {
  const viewModel = model(freshFlop());
  const flop = streetGroup(viewModel, 'flop');

  assert.ok(flop);
  assert.equal(flop.isCurrentStreet, true);
  assert.deepEqual(flop.entries, []);
  assert.equal(viewModel.currentMarker.kind, 'current_decision');
  assert.equal(viewModel.currentMarker.street, 'flop');
  assert.equal(viewModel.entryCount, 2);
});

test('Fold and Check preserve no-amount semantics', () => {
  const folded = model(act(dealt(), ACTION_TYPES.FOLD));
  const fold = allEntries(folded)[0];
  assert.equal(fold.actionType, 'fold');
  assert.equal(fold.actionFamily, 'fold');
  assert.equal(fold.amountKind, 'none');
  assert.equal(fold.amountMilliBb, null);
  assert.equal(folded.currentMarker.kind, 'terminal');

  const checked = model(waitingForFlop());
  const check = allEntries(checked)[1];
  assert.equal(check.actionType, 'check');
  assert.equal(check.actionFamily, 'passive');
  assert.equal(check.amountKind, 'none');
  assert.equal(check.amountMilliBb, null);
});

test('Call exposes exactly the canonical committed amount', () => {
  const state = act(dealt(), ACTION_TYPES.CALL);
  const call = allEntries(model(state))[0];
  assert.equal(call.actionType, 'call');
  assert.equal(call.amountKind, 'committed');
  assert.equal(call.amountMilliBb, state.actionHistory[0].committedMilliBb);
  assert.equal(call.amountMilliBb, 500);
});

test('Bet and Raise expose canonical amount-to values', () => {
  let state = freshFlop();
  state = act(state, ACTION_TYPES.CHECK);
  state = act(state, ACTION_TYPES.BET, 2000);
  state = act(state, ACTION_TYPES.RAISE, 5000);
  const entries = allEntries(model(state));
  const bet = entries.find((entry) => entry.actionType === 'bet');
  const raise = entries.find((entry) => entry.actionType === 'raise');

  assert.equal(bet.amountKind, 'amount_to');
  assert.equal(bet.amountMilliBb, 2000);
  assert.equal(raise.amountKind, 'amount_to');
  assert.equal(raise.amountMilliBb, 5000);
});

test('explicit All-in uses canonical contribution-after as amount-to', () => {
  const state = act(dealt(2, { stacks: [5000, 100_000] }), ACTION_TYPES.ALL_IN);
  const record = state.actionHistory[0];
  const allIn = allEntries(model(state))[0];

  assert.equal(allIn.actionType, 'all_in');
  assert.equal(allIn.actionFamily, 'all_in');
  assert.equal(allIn.amountKind, 'amount_to');
  assert.equal(allIn.amountMilliBb, record.streetContributionAfterMilliBb);
  assert.equal(allIn.amountMilliBb, 5000);
  assert.equal(allIn.wasAllIn, true);
});

test('a stack-exhausting Call remains Call and visibly carries all-in status', () => {
  const state = act(dealt(2, { stacks: [1000, 100_000] }), ACTION_TYPES.CALL);
  const call = allEntries(model(state))[0];

  assert.equal(call.actionType, 'call');
  assert.equal(call.actionFamily, 'passive');
  assert.equal(call.amountMilliBb, 500);
  assert.equal(call.wasAllIn, true);
});

test('Hero and opponent entries retain identity, canonical seat, and position facts', () => {
  const state = waitingForFlop();
  const [hero, opponent] = allEntries(model(state, 'P0'));

  assert.equal(hero.playerId, 'P0');
  assert.equal(hero.seat, 0);
  assert.equal(hero.identityKind, 'hero');
  assert.equal(hero.isHero, true);
  assert.equal(hero.position, 'BTN');
  assert.equal(opponent.playerId, 'P1');
  assert.equal(opponent.identityKind, 'player');
  assert.equal(opponent.isHero, false);
  assert.equal(opponent.position, 'BB');
});

test('current betting marker names exactly one canonical actor with Hero emphasis', () => {
  const state = dealt();
  const viewModel = model(state, state.actingPlayerId);
  const actor = viewModel.currentMarker.actor;

  assert.equal(viewModel.currentMarker.kind, 'current_decision');
  assert.equal(actor.playerId, state.actingPlayerId);
  assert.equal(actor.position, 'BTN');
  assert.equal(actor.isHero, true);
  assert.equal(Object.hasOwn(viewModel.currentMarker, 'sequence'), false);
});

test('Flop, Turn, and River chance markers expose the target street and no actor', () => {
  for (const [state, kind, targetStreet] of [
    [waitingForFlop(), 'awaiting_flop', 'flop'],
    [waitingForTurn(), 'awaiting_turn', 'turn'],
    [waitingForRiver(), 'awaiting_river', 'river'],
  ]) {
    const marker = model(state).currentMarker;
    assert.equal(marker.kind, kind);
    assert.equal(marker.targetStreet, targetStreet);
    assert.equal(marker.actor, null);
    assert.equal(Object.hasOwn(marker, 'sequence'), false);
  }
});

test('showdown, reveal-required, and terminal markers never fabricate an actor', () => {
  const showdown = showdownState();
  assert.equal(showdown.phase, PHASES.SHOWDOWN);
  assert.equal(model(showdown).currentMarker.kind, 'showdown');
  assert.equal(model(showdown).currentMarker.actor, null);

  let reveal = observed();
  reveal = waitingForFlop(reveal);
  reveal = freshFlop(reveal);
  reveal = waitingForTurn(reveal);
  reveal = freshTurn(reveal);
  reveal = waitingForRiver(reveal);
  reveal = freshRiver(reveal);
  reveal = showdownState(reveal);
  assert.equal(reveal.showdown.status, 'awaiting_private_reveal');
  assert.equal(model(reveal).currentMarker.kind, 'reveal_required');
  assert.equal(model(reveal).currentMarker.actor, null);

  const terminal = model(resolveShowdown(showdown));
  assert.equal(terminal.currentMarker.kind, 'terminal');
  assert.equal(terminal.currentMarker.actor, null);
});

test('legal 2-player, 6-player, and 10-player histories remain complete', () => {
  for (const playerCount of [2, 6, 10]) {
    const heroPlayerId = `P${playerCount - 1}`;
    const state = act(observed(playerCount, heroPlayerId), ACTION_TYPES.FOLD);
    const viewModel = model(state, heroPlayerId);
    assert.equal(viewModel.entryCount, 1);
    assert.equal(allEntries(viewModel)[0].sequence, 0);
    assert.equal(allEntries(viewModel)[0].street, 'preflop');
    assert.ok(viewModel.currentMarker);
  }
});

test('malformed inputs and unknown action types fail safely without invented semantics', () => {
  assert.throws(() => createReplayTimelineViewModel({ state: {} }), /poker-state\/v1/);
  assert.throws(() => createReplayTimelineViewModel({ state: initialized() }), /heroPlayerId/);
  assert.throws(
    () => createReplayTimelineViewModel({ state: initialized(), heroPlayerId: 'missing' }),
    /Unknown heroPlayerId/,
  );

  const unknown = structuredClone(act(dealt(), ACTION_TYPES.CALL));
  unknown.actionHistory[0].submittedAction.type = 'future_action';
  assert.throws(
    () => createReplayTimelineViewModel({ state: unknown, heroPlayerId: 'P0' }),
    /Unsupported action type/,
  );
});
