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
  TABLE_PRESENCE_SCHEMA_VERSION,
  createTablePresenceViewModel,
} from '../app/src/application/table-presence-view-model.mjs';

const HOLE_CARDS = Object.freeze([
  ['As', 'Ad'], ['Kh', 'Kd'], ['Qh', 'Qd'], ['Jh', 'Jd'], ['Th', 'Td'],
  ['9h', '9d'], ['8h', '8d'], ['7h', '7d'], ['6h', '6d'], ['5h', '5d'],
]);
const BOARD = Object.freeze(['2c', '3c', '4c', '9s', 'Jc']);

function configuration(playerCount = 2, { stacks = null, buttonSeat = 0 } = {}) {
  return {
    handId: `table-presence-${playerCount}`,
    game: {
      mode: GAME_MODES.HOME,
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
  return createTablePresenceViewModel({ state, heroPlayerId });
}

function seat(viewModel, playerId) {
  return viewModel.seats.find((entry) => entry.playerId === playerId);
}

function assertDeeplyFrozen(value) {
  if (!value || typeof value !== 'object') return;
  assert.equal(Object.isFrozen(value), true);
  for (const child of Object.values(value)) assertDeeplyFrozen(child);
}

function waitingForFlop() {
  let state = dealt();
  state = act(state, ACTION_TYPES.CALL);
  return act(state, ACTION_TYPES.CHECK);
}

function flopState() {
  return applyChance(waitingForFlop(), {
    type: CHANCE_TYPES.DEAL_FLOP,
    cards: BOARD.slice(0, 3),
  });
}

function showdownState() {
  let state = flopState();
  state = act(act(state, ACTION_TYPES.CHECK), ACTION_TYPES.CHECK);
  state = applyChance(state, { type: CHANCE_TYPES.DEAL_TURN, cards: [BOARD[3]] });
  state = act(act(state, ACTION_TYPES.CHECK), ACTION_TYPES.CHECK);
  state = applyChance(state, { type: CHANCE_TYPES.DEAL_RIVER, cards: [BOARD[4]] });
  return act(act(state, ACTION_TYPES.CHECK), ACTION_TYPES.CHECK);
}

test('table-presence/v1 is deeply frozen and does not mutate canonical input', () => {
  const state = initialized(6);
  const snapshot = structuredClone(state);
  const viewModel = model(state, 'P3');

  assert.equal(viewModel.schemaVersion, TABLE_PRESENCE_SCHEMA_VERSION);
  assert.equal(viewModel.mode, 'hand');
  assert.equal(viewModel.status, 'awaiting_private_cards');
  assert.deepEqual(state, snapshot);
  assertDeeplyFrozen(viewModel);
});

test('canonical seat order is retained while Hero receives visual anchor zero', () => {
  const viewModel = model(initialized(6, { buttonSeat: 4 }), 'P3');
  assert.deepEqual(viewModel.seats.map((entry) => entry.seat), [0, 1, 2, 3, 4, 5]);
  assert.equal(viewModel.heroSeat, 3);
  assert.equal(seat(viewModel, 'P3').visualSeatIndex, 0);
  assert.equal(seat(viewModel, 'P4').visualSeatIndex, 1);
  assert.equal(seat(viewModel, 'P0').visualSeatIndex, 3);
  assert.equal(viewModel.buttonSeat, 4);
  assert.equal(seat(viewModel, 'P4').isButton, true);
});

test('button and current actor map directly to canonical seats with an explicit waiting cue', () => {
  const state = dealt(6, { buttonSeat: 0 });
  const viewModel = model(state, 'P5');
  const actor = state.players.find((player) => player.playerId === state.actingPlayerId);

  assert.equal(viewModel.buttonSeat, state.buttonSeat);
  assert.equal(viewModel.currentActorSeat, actor.seat);
  assert.equal(seat(viewModel, actor.playerId).isCurrentActor, true);
  assert.equal(seat(viewModel, actor.playerId).isWaitingToAct, true);
  assert.equal(viewModel.seats.filter((entry) => entry.isWaitingToAct).length, 1);
});

test('pot, stacks, starting stacks, and contributions are projected as exact integers', () => {
  const state = initialized();
  const viewModel = model(state);

  assert.equal(viewModel.potMilliBb, state.potMilliBb);
  for (const player of state.players) {
    const projected = seat(viewModel, player.playerId);
    assert.equal(projected.currentStackMilliBb, player.currentStackMilliBb);
    assert.equal(projected.startingStackMilliBb, player.startingStackMilliBb);
    assert.equal(projected.streetContributionMilliBb, player.streetContributionMilliBb);
    assert.equal(projected.totalPotContributionMilliBb, player.totalPotContributionMilliBb);
  }
});

test('known Hero cards and hidden opponent cards retain explicit visibility', () => {
  const viewModel = model(observed(6, 'P0'));
  assert.equal(seat(viewModel, 'P0').cardVisibility, 'known');
  assert.deepEqual(seat(viewModel, 'P0').cards.map((card) => card.id), HOLE_CARDS[0]);
  for (const opponent of viewModel.seats.filter((entry) => !entry.isHero)) {
    assert.equal(opponent.cardVisibility, 'hidden');
    assert.equal(opponent.hasCards, true);
    assert.deepEqual(opponent.cards, []);
  }
});

test('supplied presentation names are respected without replacing position facts', () => {
  const state = structuredClone(initialized());
  state.players[1].presentationName = 'Long Analytical Opponent';
  const viewModel = model(state);
  assert.equal(seat(viewModel, 'P1').suppliedName, 'Long Analytical Opponent');
  assert.equal(seat(viewModel, 'P1').identity, 'Long Analytical Opponent');
  assert.equal(seat(viewModel, 'P1').position, state.players[1].position);
});

test('posted blinds stay on felt before and after the private deal', () => {
  const beforeDeal = model(initialized());
  const afterDeal = model(dealt());

  for (const viewModel of [beforeDeal, afterDeal]) {
    assert.equal(viewModel.showStreetContributions, true);
    assert.deepEqual(viewModel.seats.map((entry) => entry.streetContributionMilliBb), [500, 1000]);
    assert.equal(viewModel.seats.every((entry) => entry.latestAction === null), true);
  }
});

test('Hero contribution remains on felt until the canonical opponent call closes betting', () => {
  let canonical = dealt();
  canonical = act(canonical, ACTION_TYPES.RAISE, 2000);
  let viewModel = model(canonical);

  assert.equal(canonical.phase, PHASES.BETTING);
  assert.equal(canonical.actingPlayerId, 'P1');
  assert.equal(viewModel.showStreetContributions, true);
  assert.deepEqual(viewModel.seats.map((entry) => entry.streetContributionMilliBb), [2000, 1000]);

  canonical = act(canonical, ACTION_TYPES.CALL);
  viewModel = model(canonical);
  assert.equal(canonical.phase, PHASES.CHANCE);
  assert.equal(canonical.pendingChance.type, CHANCE_TYPES.DEAL_FLOP);
  assert.equal(viewModel.showStreetContributions, false);
});

test('equal HU contributions stay on felt while the big blind still has its option', () => {
  let canonical = act(dealt(), ACTION_TYPES.CALL);
  let viewModel = model(canonical);

  assert.equal(canonical.phase, PHASES.BETTING);
  assert.equal(canonical.actingPlayerId, 'P1');
  assert.deepEqual(viewModel.seats.map((entry) => entry.streetContributionMilliBb), [1000, 1000]);
  assert.equal(viewModel.showStreetContributions, true);

  canonical = act(canonical, ACTION_TYPES.CHECK);
  viewModel = model(canonical);
  assert.equal(canonical.phase, PHASES.CHANCE);
  assert.equal(viewModel.showStreetContributions, false);
});

test('closing the betting round collects presentation chips before the board is dealt', () => {
  const canonical = waitingForFlop();
  const viewModel = model(canonical);

  assert.equal(canonical.phase, PHASES.CHANCE);
  assert.equal(viewModel.status, 'awaiting_board');
  assert.equal(viewModel.showStreetContributions, false);
  assert.equal(viewModel.potMilliBb, canonical.potMilliBb);
  assert.equal(viewModel.seats.every((entry) => entry.streetContributionMilliBb > 0), true);
});

test('Call uses committed-amount semantics and Check carries no amount', () => {
  let state = dealt();
  state = act(state, ACTION_TYPES.CALL);
  let viewModel = model(state);
  assert.deepEqual(seat(viewModel, 'P0').latestAction, {
    sequence: 0,
    street: 'preflop',
    type: 'call',
    amountKind: 'committed',
    amountMilliBb: 500,
    wasAllIn: false,
  });

  state = act(state, ACTION_TYPES.CHECK);
  viewModel = model(state);
  assert.equal(seat(viewModel, 'P1').latestAction.type, 'check');
  assert.equal(seat(viewModel, 'P1').latestAction.amountKind, 'none');
  assert.equal(seat(viewModel, 'P1').latestAction.amountMilliBb, null);
});

test('Bet, Raise, and All-in use canonical amount-to facts and latest action wins', () => {
  let state = flopState();
  state = act(state, ACTION_TYPES.CHECK);
  state = act(state, ACTION_TYPES.BET, 2000);
  let viewModel = model(state);
  assert.equal(seat(viewModel, 'P0').latestAction.type, 'bet');
  assert.equal(seat(viewModel, 'P0').latestAction.amountKind, 'amount_to');
  assert.equal(seat(viewModel, 'P0').latestAction.amountMilliBb, 2000);

  state = act(state, ACTION_TYPES.RAISE, 5000);
  viewModel = model(state);
  assert.equal(seat(viewModel, 'P1').latestAction.type, 'raise');
  assert.equal(seat(viewModel, 'P1').latestAction.amountMilliBb, 5000);

  state = act(state, ACTION_TYPES.ALL_IN);
  viewModel = model(state);
  assert.equal(seat(viewModel, 'P0').latestAction.type, 'all_in');
  assert.equal(seat(viewModel, 'P0').latestAction.amountKind, 'amount_to');
  assert.equal(
    seat(viewModel, 'P0').latestAction.amountMilliBb,
    state.actionHistory.at(-1).currentBetAfterMilliBb,
  );
  assert.equal(seat(viewModel, 'P0').isAllIn, true);
});

test('Fold has no amount and folded/all-in state persists after street advance', () => {
  let state = dealt(3, { stacks: [100_000, 100_000, 1000] });
  state = act(state, ACTION_TYPES.FOLD);
  let viewModel = model(state);
  assert.equal(seat(viewModel, 'P0').latestAction.type, 'fold');
  assert.equal(seat(viewModel, 'P0').latestAction.amountKind, 'none');
  assert.equal(seat(viewModel, 'P0').isFolded, true);
  assert.equal(seat(viewModel, 'P2').isAllIn, true);

  state = act(state, ACTION_TYPES.CALL);
  state = applyChance(state, { type: CHANCE_TYPES.DEAL_FLOP, cards: BOARD.slice(0, 3) });
  viewModel = model(state);
  assert.equal(seat(viewModel, 'P0').isFolded, true);
  assert.equal(seat(viewModel, 'P2').isAllIn, true);
  assert.equal(viewModel.seats.every((entry) => entry.latestAction === null), true);
});

test('current-street action badges clear exactly when the canonical street advances', () => {
  const preflop = waitingForFlop();
  assert.equal(model(preflop).seats.some((entry) => entry.latestAction !== null), true);

  const flop = applyChance(preflop, {
    type: CHANCE_TYPES.DEAL_FLOP,
    cards: BOARD.slice(0, 3),
  });
  const viewModel = model(flop);
  assert.equal(viewModel.street, 'flop');
  assert.equal(viewModel.seats.every((entry) => entry.latestAction === null), true);
  assert.equal(viewModel.seats.every((entry) => entry.streetContributionMilliBb === 0), true);
});

test('empty, chance, showdown, and terminal states never fabricate an actor', () => {
  const empty = createTablePresenceViewModel();
  assert.equal(empty.empty, true);
  assert.equal(empty.status, 'empty');
  assert.equal(empty.currentActorSeat, null);

  const initial = model(initialized());
  assert.equal(initial.status, 'awaiting_private_cards');
  assert.equal(initial.currentActorSeat, null);
  assert.equal(initial.seats.some((entry) => entry.isWaitingToAct), false);

  const chance = model(waitingForFlop());
  assert.equal(chance.status, 'awaiting_board');
  assert.equal(chance.currentActorSeat, null);

  const showdown = showdownState();
  assert.equal(showdown.phase, PHASES.SHOWDOWN);
  const showdownModel = model(showdown);
  assert.equal(showdownModel.status, 'showdown');
  assert.equal(showdownModel.currentActorSeat, null);

  const terminal = model(resolveShowdown(showdown));
  assert.equal(terminal.status, 'terminal');
  assert.equal(terminal.currentActorSeat, null);
  assert.equal(terminal.seats.some((entry) => entry.isWaitingToAct), false);
});

test('malformed input and missing canonical Hero behavior are explicit', () => {
  assert.equal(createTablePresenceViewModel({ state: null }).empty, true);
  assert.throws(() => createTablePresenceViewModel({ state: {} }), /poker-state\/v1/);
  assert.throws(() => createTablePresenceViewModel({ state: initialized() }), /heroPlayerId/);
  assert.throws(
    () => createTablePresenceViewModel({ state: initialized(), heroPlayerId: 'missing' }),
    /Unknown heroPlayerId/,
  );
});

test('legal 2-player, 6-player, and 10-player states project every seat', () => {
  for (const playerCount of [2, 6, 10]) {
    const heroPlayerId = `P${playerCount - 1}`;
    const state = observed(playerCount, heroPlayerId);
    const viewModel = model(state, heroPlayerId);
    assert.equal(viewModel.seats.length, playerCount);
    assert.equal(viewModel.seats.every((entry) => Number.isInteger(entry.visualSeatIndex)), true);
    assert.deepEqual(
      [...viewModel.seats.map((entry) => entry.visualSeatIndex)].sort((a, b) => a - b),
      Array.from({ length: playerCount }, (_, index) => index),
    );
    assert.equal(seat(viewModel, heroPlayerId).visualSeatIndex, 0);
  }
});
