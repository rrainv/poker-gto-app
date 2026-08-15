import test from 'node:test';
import assert from 'node:assert/strict';

import {
  ACTION_TYPES,
  ANTE_TYPES,
  CHANCE_TYPES,
  GAME_MODES,
  applyAction,
  applyChance,
  applyPrivateReveal,
  createAction,
  initializeHand,
  resolveShowdown,
} from '../shared/poker-domain/index.js';
import {
  REPLAY_FRAME_OPERATIONS,
  REPLAY_PROJECTION_SCHEMA_VERSION,
  createReplayProjectionController,
} from '../app/src/application/replay-projection-controller.mjs';
import { createTablePresenceViewModel } from '../app/src/application/table-presence-view-model.mjs';
import { installPlaybookStateSourceBridge } from '../app/src/application/playbook-mode-bootstrap.mjs';

const HOLE_CARDS = Object.freeze([
  ['As', 'Ad'], ['Kh', 'Kd'], ['Qh', 'Qd'], ['Jh', 'Jd'], ['Th', 'Td'],
  ['9h', '9d'], ['8h', '8d'], ['7h', '7d'], ['6h', '6d'], ['5h', '5d'],
]);
const BOARD = Object.freeze(['2c', '3c', '4c', '9s', 'Jc']);

function configuration(playerCount = 2, { stacks = null, handId = null } = {}) {
  return {
    handId: handId || `replay-001b-${playerCount}`,
    game: {
      mode: GAME_MODES.HOME,
      smallBlindMilliBb: 500,
      bigBlindMilliBb: 1000,
      chipUnitMilliBb: 100,
      ante: { type: ANTE_TYPES.NONE, amountMilliBb: 0 },
    },
    buttonSeat: 0,
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

function knownDeal(state) {
  return applyChance(state, {
    type: CHANCE_TYPES.DEAL_HOLE,
    cardsByPlayer: Object.fromEntries(
      state.players.map((player, index) => [player.playerId, HOLE_CARDS[index]]),
    ),
  });
}

function observedDeal(state, heroPlayerId = 'P0') {
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

function assertDeeplyFrozen(value) {
  if (!value || typeof value !== 'object') return;
  assert.equal(Object.isFrozen(value), true);
  for (const child of Object.values(value)) assertDeeplyFrozen(child);
}

function harness(heroPlayerId = 'P0') {
  let liveState = null;
  const controller = createReplayProjectionController({
    getLiveState: () => liveState,
    getHeroPlayerId: () => heroPlayerId,
  });
  return {
    controller,
    replace(state) {
      liveState = state;
      return controller.replaceHand({
        state,
        heroPlayerId,
        operation: REPLAY_FRAME_OPERATIONS.INITIALIZE_HAND,
      });
    },
    record(state, operation) {
      liveState = state;
      return controller.recordTransition({ state, heroPlayerId, operation });
    },
    live: () => liveState,
  };
}

function browserWindow() {
  const events = [];
  class FakeCustomEvent {
    constructor(type, options) {
      this.type = type;
      this.detail = options?.detail;
    }
  }
  return {
    events,
    window: {
      CustomEvent: FakeCustomEvent,
      dispatchEvent(event) { events.push(event); },
    },
  };
}

function handModeScenario(tableSize = 2) {
  return {
    tableSize,
    rakeMode: 'none',
    straddleBb: 0,
  };
}

function bridgeConfiguration(tableSize = 2, stackBb = 100) {
  return {
    tableSize,
    gameMode: 'home',
    stackBb,
    stackMode: 'hero',
    heroSeat: 0,
    buttonSeat: 0,
    anteType: 'none',
    anteBb: 0,
    straddleBb: 0,
  };
}

test('replay-projection/v1 has a deeply frozen empty state without public raw frames', () => {
  const projection = createReplayProjectionController().getProjection();

  assert.equal(projection.schemaVersion, REPLAY_PROJECTION_SCHEMA_VERSION);
  assert.equal(projection.mode, 'empty');
  assert.equal(projection.totalFrameCount, 0);
  assert.equal(projection.currentStep, 0);
  assert.equal(projection.canPrevious, false);
  assert.equal(projection.canNext, false);
  assert.equal(projection.canReturnToLive, false);
  assert.equal(projection.tablePresence.empty, true);
  assert.equal(Object.hasOwn(projection, 'frames'), false);
  assertDeeplyFrozen(projection);
});

test('initialization and private-deal frames preserve exact visibility and bounded cursor order', () => {
  const journal = harness();
  const initial = initialized();
  const initialSnapshot = structuredClone(initial);
  journal.replace(initial);
  const dealt = observedDeal(initial);
  journal.record(dealt, REPLAY_FRAME_OPERATIONS.DEAL_HOLE_OBSERVED);

  let projection = journal.controller.getProjection();
  assert.equal(projection.mode, 'live');
  assert.equal(projection.totalFrameCount, 2);
  assert.equal(projection.currentStep, 2);
  assert.equal(projection.selectedFrame.kind, 'private_deal');
  assert.equal(projection.tablePresence.seats[0].cardVisibility, 'known');
  assert.equal(projection.tablePresence.seats[1].cardVisibility, 'hidden');

  projection = journal.controller.previous();
  assert.equal(projection.mode, 'replay');
  assert.equal(projection.currentStep, 1);
  assert.equal(projection.atStart, true);
  assert.equal(projection.canPrevious, false);
  assert.equal(projection.canNext, true);
  assert.equal(projection.selectedFrame.kind, 'initialization');
  assert.equal(projection.tablePresence.seats.every((seat) => seat.cardVisibility === 'undealt'), true);
  assert.deepEqual(initial, initialSnapshot);

  assert.equal(journal.controller.previous().currentStep, 1);
  projection = journal.controller.next();
  assert.equal(projection.mode, 'live');
  assert.equal(projection.currentStep, 2);
  assert.equal(projection.canNext, false);
  assert.equal(journal.controller.next().currentStep, 2);
});

test('application-provided timeline progress marks selected actions and chance frames exactly', () => {
  const journal = harness();
  let state = initialized();
  journal.replace(state);
  state = knownDeal(state);
  journal.record(state, REPLAY_FRAME_OPERATIONS.DEAL_HOLE);
  state = act(state, ACTION_TYPES.CALL);
  journal.record(state, REPLAY_FRAME_OPERATIONS.ACTION);
  state = act(state, ACTION_TYPES.CHECK);
  journal.record(state, REPLAY_FRAME_OPERATIONS.ACTION);
  state = applyChance(state, { type: CHANCE_TYPES.DEAL_FLOP, cards: BOARD.slice(0, 3) });
  journal.record(state, REPLAY_FRAME_OPERATIONS.DEAL_BOARD);
  state = act(state, ACTION_TYPES.CHECK);
  journal.record(state, REPLAY_FRAME_OPERATIONS.ACTION);

  let projection = journal.controller.previous();
  assert.equal(projection.selectedFrame.kind, 'flop_deal');
  assert.equal(projection.selectedFrame.actionSequence, null);
  assert.equal(projection.timeline.showCurrentMarker, true);
  assert.deepEqual(
    projection.timeline.groups.flatMap((group) => group.entries)
      .map((entry) => entry.presentationState),
    ['completed', 'completed', 'future'],
  );

  projection = journal.controller.previous();
  assert.equal(projection.selectedFrame.kind, 'action');
  assert.equal(projection.selectedFrame.actionSequence, 1);
  assert.equal(projection.timeline.showCurrentMarker, false);
  assert.equal(projection.timeline.selectedAction.actionType, 'check');
  assert.deepEqual(
    projection.timeline.groups.flatMap((group) => group.entries)
      .map((entry) => entry.presentationState),
    ['completed', 'current', 'future'],
  );
});

test('checks, calls, bets, raises, all-ins, folds, and stack-exhausting calls remain canonical frames', () => {
  const journal = harness();
  let state = initialized();
  journal.replace(state);
  state = knownDeal(state);
  journal.record(state, REPLAY_FRAME_OPERATIONS.DEAL_HOLE);

  for (const [type, amount] of [
    [ACTION_TYPES.CALL, null],
    [ACTION_TYPES.CHECK, null],
  ]) {
    state = act(state, type, amount);
    const projection = journal.record(state, REPLAY_FRAME_OPERATIONS.ACTION);
    assert.equal(projection.selectedFrame.kind, 'action');
    assert.equal(projection.liveTimeline.groups.flatMap((group) => group.entries).at(-1).actionType, type);
  }
  state = applyChance(state, { type: CHANCE_TYPES.DEAL_FLOP, cards: BOARD.slice(0, 3) });
  journal.record(state, REPLAY_FRAME_OPERATIONS.DEAL_BOARD);
  for (const [type, amount] of [
    [ACTION_TYPES.CHECK, null],
    [ACTION_TYPES.BET, 2000],
    [ACTION_TYPES.RAISE, 5000],
    [ACTION_TYPES.ALL_IN, null],
  ]) {
    state = act(state, type, amount);
    const projection = journal.record(state, REPLAY_FRAME_OPERATIONS.ACTION);
    assert.equal(projection.liveTimeline.groups.flatMap((group) => group.entries).at(-1).actionType, type);
  }

  const foldedJournal = harness();
  let folded = initialized();
  foldedJournal.replace(folded);
  folded = knownDeal(folded);
  foldedJournal.record(folded, REPLAY_FRAME_OPERATIONS.DEAL_HOLE);
  folded = act(folded, ACTION_TYPES.FOLD);
  const foldProjection = foldedJournal.record(folded, REPLAY_FRAME_OPERATIONS.ACTION);
  assert.equal(foldProjection.selectedPhase, 'terminal');
  assert.equal(foldProjection.tablePresence.status, 'terminal');
  assert.equal(foldProjection.liveTimeline.groups[0].entries[0].actionType, 'fold');

  const shortJournal = harness();
  let short = initialized(2, { stacks: [1000, 100_000] });
  shortJournal.replace(short);
  short = knownDeal(short);
  shortJournal.record(short, REPLAY_FRAME_OPERATIONS.DEAL_HOLE);
  short = act(short, ACTION_TYPES.CALL);
  const shortProjection = shortJournal.record(short, REPLAY_FRAME_OPERATIONS.ACTION);
  const last = shortProjection.liveTimeline.groups[0].entries.at(-1);
  assert.equal(last.actionType, 'call');
  assert.equal(last.wasAllIn, true);
});

test('flop, turn, and river chance frames carry no action sequence', () => {
  const journal = harness();
  let state = initialized();
  journal.replace(state);
  state = knownDeal(state);
  journal.record(state, REPLAY_FRAME_OPERATIONS.DEAL_HOLE);

  const expected = [
    [CHANCE_TYPES.DEAL_FLOP, BOARD.slice(0, 3), 'flop_deal'],
    [CHANCE_TYPES.DEAL_TURN, [BOARD[3]], 'turn_deal'],
    [CHANCE_TYPES.DEAL_RIVER, [BOARD[4]], 'river_deal'],
  ];
  for (const [chanceType, cards, frameKind] of expected) {
    state = act(
      state,
      state.street === 'preflop' ? ACTION_TYPES.CALL : ACTION_TYPES.CHECK,
    );
    journal.record(state, REPLAY_FRAME_OPERATIONS.ACTION);
    state = act(state, ACTION_TYPES.CHECK);
    journal.record(state, REPLAY_FRAME_OPERATIONS.ACTION);
    state = applyChance(state, { type: chanceType, cards });
    const projection = journal.record(state, REPLAY_FRAME_OPERATIONS.DEAL_BOARD);
    assert.equal(projection.selectedFrame.kind, frameKind);
    assert.equal(projection.selectedFrame.actionSequence, null);
  }
});

test('private reveal and showdown terminal frames never leak revealed cards backward', () => {
  const journal = harness();
  let state = initialized();
  journal.replace(state);
  state = observedDeal(state);
  journal.record(state, REPLAY_FRAME_OPERATIONS.DEAL_HOLE_OBSERVED);

  state = act(state, ACTION_TYPES.CALL);
  journal.record(state, REPLAY_FRAME_OPERATIONS.ACTION);
  state = act(state, ACTION_TYPES.CHECK);
  journal.record(state, REPLAY_FRAME_OPERATIONS.ACTION);
  for (const [chanceType, cards] of [
    [CHANCE_TYPES.DEAL_FLOP, BOARD.slice(0, 3)],
    [CHANCE_TYPES.DEAL_TURN, [BOARD[3]]],
    [CHANCE_TYPES.DEAL_RIVER, [BOARD[4]]],
  ]) {
    state = applyChance(state, { type: chanceType, cards });
    journal.record(state, REPLAY_FRAME_OPERATIONS.DEAL_BOARD);
    state = act(state, ACTION_TYPES.CHECK);
    journal.record(state, REPLAY_FRAME_OPERATIONS.ACTION);
    state = act(state, ACTION_TYPES.CHECK);
    journal.record(state, REPLAY_FRAME_OPERATIONS.ACTION);
  }
  assert.equal(state.showdown.status, 'awaiting_private_reveal');
  state = applyPrivateReveal(state, { playerId: 'P1', cards: HOLE_CARDS[1] });
  let projection = journal.record(state, REPLAY_FRAME_OPERATIONS.REVEAL_HOLE);
  assert.equal(projection.selectedFrame.kind, 'private_reveal');
  assert.equal(projection.tablePresence.seats[1].cardVisibility, 'known');

  state = resolveShowdown(state);
  projection = journal.record(state, REPLAY_FRAME_OPERATIONS.SHOWDOWN);
  assert.equal(projection.selectedFrame.kind, 'showdown_resolution');
  assert.equal(projection.selectedPhase, 'terminal');

  while (projection.currentStep > 2) projection = journal.controller.previous();
  assert.equal(projection.selectedFrame.kind, 'private_deal');
  assert.equal(projection.tablePresence.seats[1].cardVisibility, 'hidden');
  assert.deepEqual(projection.tablePresence.seats[1].cards, []);
  assert.equal(projection.tablePresence.board.length, 0);
});

test('selected historical table exactly equals Table Presence for its canonical snapshot', () => {
  const journal = harness();
  let initial = initialized(6);
  journal.replace(initial);
  const dealt = observedDeal(initial);
  journal.record(dealt, REPLAY_FRAME_OPERATIONS.DEAL_HOLE_OBSERVED);
  const acted = act(dealt, ACTION_TYPES.FOLD);
  journal.record(acted, REPLAY_FRAME_OPERATIONS.ACTION);

  let projection = journal.controller.previous();
  assert.equal(projection.selectedFrame.kind, 'private_deal');
  assert.deepEqual(
    projection.tablePresence,
    createTablePresenceViewModel({ state: dealt, heroPlayerId: 'P0' }),
  );
  projection = journal.controller.returnToLive();
  assert.deepEqual(
    projection.tablePresence,
    createTablePresenceViewModel({ state: acted, heroPlayerId: 'P0' }),
  );
});

test('2-player, 6-player, and 10-player snapshots preserve every canonical seat', () => {
  for (const playerCount of [2, 6, 10]) {
    const heroPlayerId = `P${playerCount - 1}`;
    const journal = harness(heroPlayerId);
    let state = initialized(playerCount);
    journal.replace(state);
    state = observedDeal(state, heroPlayerId);
    const projection = journal.record(state, REPLAY_FRAME_OPERATIONS.DEAL_HOLE_OBSERVED);
    assert.equal(projection.tablePresence.seats.length, playerCount);
    assert.equal(projection.tablePresence.seats.find((seat) => seat.isHero).playerId, heroPlayerId);
  }
});

test('bridge records only successful operations, replaces a new hand, and clears on reset', () => {
  const fake = browserWindow();
  const bridge = installPlaybookStateSourceBridge(fake.window);
  assert.equal(bridge.createReplayProjectionViewModel(), null);
  bridge.setMode('hand', handModeScenario());

  bridge.initializeHand(bridgeConfiguration());
  assert.equal(bridge.createReplayProjectionViewModel().totalFrameCount, 1);
  assert.equal(bridge.dealBoardCards(BOARD.slice(0, 3)), null);
  assert.equal(bridge.createReplayProjectionViewModel().totalFrameCount, 1);
  bridge.dealObservedHoleCards({ 'seat-0': HOLE_CARDS[0] });
  assert.equal(bridge.createReplayProjectionViewModel().totalFrameCount, 2);

  bridge.initializeHand(bridgeConfiguration(6));
  let projection = bridge.createReplayProjectionViewModel();
  assert.equal(projection.totalFrameCount, 1);
  assert.equal(projection.currentStep, 1);
  assert.equal(projection.tablePresence.seats.length, 6);

  bridge.resetHand();
  projection = bridge.createReplayProjectionViewModel();
  assert.equal(projection.mode, 'empty');
  assert.equal(projection.totalFrameCount, 0);
});

test('historical cursor never mutates or invisibly advances the live canonical hand', () => {
  const fake = browserWindow();
  const bridge = installPlaybookStateSourceBridge(fake.window);
  bridge.setMode('hand', handModeScenario());
  bridge.initializeHand(bridgeConfiguration());
  bridge.dealObservedHoleCards({ 'seat-0': HOLE_CARDS[0] });
  const liveState = bridge.getState();
  const liveSnapshot = structuredClone(liveState);
  const legalActions = bridge.getLegalActions();

  let projection = bridge.previousReplayFrame();
  assert.equal(projection.mode, 'replay');
  assert.equal(bridge.applyAction(ACTION_TYPES.CALL), null);
  assert.strictEqual(bridge.getState(), liveState);
  assert.deepEqual(bridge.getState(), liveSnapshot);
  assert.deepEqual(bridge.getLegalActions(), legalActions);
  assert.equal(bridge.createReplayProjectionViewModel().totalFrameCount, 2);

  projection = bridge.returnReplayToLive();
  assert.equal(projection.mode, 'live');
  assert.ok(bridge.applyAction(ACTION_TYPES.CALL));
  assert.equal(bridge.createReplayProjectionViewModel().totalFrameCount, 3);
  assert.deepEqual(
    fake.events.filter((event) => event.detail.operation.startsWith('replay_'))
      .map((event) => event.detail.operation),
    ['replay_previous', 'replay_live'],
  );
});
