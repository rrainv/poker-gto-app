import test from 'node:test';
import assert from 'node:assert/strict';

import {
  ACTION_TYPES,
  ANTE_TYPES,
  CHANCE_TYPES,
  GAME_MODES,
  applyAction,
  applyChance,
  createAction,
  initializeHand,
  resolveShowdown,
} from '../shared/poker-domain/index.js';
import {
  REPLAY_PLAYBACK_SCHEMA_VERSION,
  REPLAY_PLAYBACK_TIMING_POLICY,
  createReplayPlaybackController,
  replayPlaybackDelayForProjection,
} from '../app/src/application/replay-playback-controller.mjs';
import { installPlaybookStateSourceBridge } from '../app/src/application/playbook-mode-bootstrap.mjs';
import {
  REPLAY_FRAME_OPERATIONS,
  createReplayProjectionController,
} from '../app/src/application/replay-projection-controller.mjs';

function timeoutHarness() {
  let nextHandle = 1;
  const scheduled = new Map();
  const cleared = [];
  return {
    schedule(callback, delayMs) {
      const handle = nextHandle++;
      scheduled.set(handle, { callback, delayMs, active: true });
      return handle;
    },
    clear(handle) {
      const entry = scheduled.get(handle);
      if (entry) entry.active = false;
      cleared.push(handle);
    },
    pendingCount() {
      return [...scheduled.values()].filter((entry) => entry.active).length;
    },
    latestHandle() {
      return [...scheduled.keys()].at(-1) || null;
    },
    latestDelay() {
      return scheduled.get(this.latestHandle())?.delayMs ?? null;
    },
    fire(handle = this.latestHandle(), { force = false } = {}) {
      const entry = scheduled.get(handle);
      if (!entry || (!entry.active && !force)) return false;
      entry.active = false;
      entry.callback();
      return true;
    },
    cleared,
  };
}

function projection(index, total = 4) {
  return {
    schemaVersion: 'replay-projection/v1',
    mode: 'replay',
    selectedFrameIndex: index,
    canPlaybackAdvance: index < total - 1,
  };
}

function controllerHarness(total = 4) {
  const timers = timeoutHarness();
  const advances = [];
  let current = projection(0, total);
  const controller = createReplayPlaybackController({
    getProjection: () => current,
    advance: () => {
      current = projection(current.selectedFrameIndex + 1, total);
      return current;
    },
    onAdvance: (next, state) => advances.push({ next, state }),
    scheduleTimeout: timers.schedule,
    clearScheduledTimeout: timers.clear,
    delayMs: 500,
  });
  return { controller, timers, advances, current: () => current };
}

function fakeWindow() {
  const events = [];
  class FakeCustomEvent {
    constructor(type, options) {
      this.type = type;
      this.detail = options?.detail;
    }
  }
  return {
    events,
    CustomEvent: FakeCustomEvent,
    dispatchEvent(event) { events.push(event); },
  };
}

function bridgeConfiguration() {
  return {
    tableSize: 2,
    gameMode: GAME_MODES.HOME,
    stackBb: 100,
    stackMode: 'hero',
    heroSeat: 0,
    buttonSeat: 0,
    anteType: ANTE_TYPES.NONE,
    anteBb: 0,
    straddleBb: 0,
  };
}

function initializedBridge() {
  const timers = timeoutHarness();
  const browserWindow = fakeWindow();
  const bridge = installPlaybookStateSourceBridge(browserWindow, {
    replayPlaybackOptions: {
      scheduleTimeout: timers.schedule,
      clearScheduledTimeout: timers.clear,
      delayMs: 500,
    },
  });
  bridge.setMode('hand', { tableSize: 2, rakeMode: 'none', straddleBb: 0 });
  bridge.initializeHand(bridgeConfiguration());
  bridge.dealObservedHoleCards({ 'seat-0': ['As', 'Ad'] });
  bridge.applyAction(ACTION_TYPES.CALL);
  return { bridge, timers, browserWindow };
}

test('start, duplicate start, pause, and continuation keep exactly one one-shot timer', () => {
  const { controller, timers, advances } = controllerHarness();
  const started = controller.start();

  assert.equal(started.schemaVersion, REPLAY_PLAYBACK_SCHEMA_VERSION);
  assert.equal(started.playing, true);
  assert.equal(started.hasPendingTick, true);
  assert.equal(timers.pendingCount(), 1);
  assert.equal(timers.latestDelay(), 500);
  controller.start();
  controller.scheduleNext();
  assert.equal(timers.pendingCount(), 1);

  controller.pause();
  assert.equal(controller.getState().playing, false);
  assert.equal(controller.getState().hasPendingTick, false);
  assert.equal(timers.pendingCount(), 0);
  assert.equal(timers.cleared.length, 1);

  controller.start();
  assert.equal(timers.pendingCount(), 1);
  timers.fire();
  assert.equal(advances.length, 1);
  assert.equal(controller.getState().playing, true);
  assert.equal(timers.pendingCount(), 1);
});

test('default study pacing gives deals and showdown more weight than ordinary actions', () => {
  const delayFor = (kind) => replayPlaybackDelayForProjection({ selectedFrame: { kind } });
  assert.equal(delayFor('action'), REPLAY_PLAYBACK_TIMING_POLICY.action);
  assert.ok(delayFor('action') >= 1000 && delayFor('action') <= 1100);
  for (const kind of ['flop_deal', 'turn_deal', 'river_deal']) {
    assert.ok(delayFor(kind) >= 1200 && delayFor(kind) <= 1300, kind);
    assert.ok(delayFor(kind) > delayFor('action'), kind);
  }
  assert.ok(delayFor('showdown_resolution') >= 1350);
  assert.ok(delayFor('showdown_resolution') > delayFor('flop_deal'));
  assert.equal(delayFor('unknown_transition'), REPLAY_PLAYBACK_TIMING_POLICY.default);
});

test('the coordinator schedules each dwell from the currently visible transition', () => {
  const timers = timeoutHarness();
  let current = {
    ...projection(0),
    selectedFrame: { kind: 'action' },
  };
  const controller = createReplayPlaybackController({
    getProjection: () => current,
    advance: () => {
      current = {
        ...projection(1),
        selectedFrame: { kind: 'flop_deal' },
      };
      return current;
    },
    scheduleTimeout: timers.schedule,
    clearScheduledTimeout: timers.clear,
  });

  controller.start();
  assert.equal(timers.latestDelay(), REPLAY_PLAYBACK_TIMING_POLICY.action);
  timers.fire();
  assert.equal(timers.latestDelay(), REPLAY_PLAYBACK_TIMING_POLICY.flop_deal);
  assert.equal(controller.getState().delayMs, REPLAY_PLAYBACK_TIMING_POLICY.flop_deal);
});

test('endpoint stops on the final recorded frame without looping or leaving a timer', () => {
  const { controller, timers, advances, current } = controllerHarness(3);
  controller.start();
  timers.fire();
  assert.equal(current().selectedFrameIndex, 1);
  assert.equal(timers.pendingCount(), 1);

  timers.fire();
  assert.equal(current().selectedFrameIndex, 2);
  assert.equal(controller.getState().status, 'paused');
  assert.equal(controller.getState().hasPendingTick, false);
  assert.equal(timers.pendingCount(), 0);
  assert.equal(advances.length, 2);
  assert.equal(controller.start().playing, false);
  assert.equal(timers.pendingCount(), 0);
});

test('generation invalidates a callback even if a cancelled timeout is forced to fire', () => {
  const { controller, timers, advances, current } = controllerHarness();
  controller.start();
  const staleHandle = timers.latestHandle();
  controller.pause();
  assert.equal(timers.fire(staleHandle, { force: true }), true);
  assert.equal(current().selectedFrameIndex, 0);
  assert.deepEqual(advances, []);

  controller.start();
  const secondStaleHandle = timers.latestHandle();
  controller.cancel();
  timers.fire(secondStaleHandle, { force: true });
  assert.equal(current().selectedFrameIndex, 0);
  assert.deepEqual(advances, []);
});

test('Play begins at the first recorded frame and stops at the final frame in REPLAY', () => {
  const { bridge, timers } = initializedBridge();
  const liveState = bridge.getState();
  const liveSnapshot = structuredClone(liveState);

  const started = bridge.startReplayPlayback();
  assert.equal(started.playback.playing, true);
  assert.equal(started.projection.mode, 'replay');
  assert.equal(started.projection.selectedFrameIndex, 0);
  assert.equal(timers.pendingCount(), 1);

  while (timers.pendingCount()) timers.fire();
  const endpoint = bridge.createReplayProjectionViewModel();
  assert.equal(endpoint.mode, 'replay');
  assert.equal(endpoint.atPlaybackEnd, true);
  assert.equal(endpoint.selectedFrameIndex, endpoint.totalFrameCount - 1);
  assert.equal(bridge.createReplayPlaybackViewModel().playing, false);
  assert.equal(bridge.createReplayPlaybackViewModel().hasPendingTick, false);
  assert.strictEqual(bridge.getState(), liveState);
  assert.deepEqual(bridge.getState(), liveSnapshot);

  bridge.returnReplayToLive();
  assert.equal(bridge.createReplayProjectionViewModel().atLive, true);
});

test('Previous, Next, Return Live, reset, and new hand defeat forced stale ticks', () => {
  for (const operation of ['previous', 'next', 'live', 'reset', 'new_hand']) {
    const { bridge, timers } = initializedBridge();
    bridge.startReplayPlayback();
    const staleHandle = timers.latestHandle();

    if (operation === 'previous') bridge.previousReplayFrame();
    if (operation === 'next') bridge.nextReplayFrame();
    if (operation === 'live') bridge.returnReplayToLive();
    if (operation === 'reset') bridge.resetHand();
    if (operation === 'new_hand') bridge.initializeHand(bridgeConfiguration());
    const afterOperation = bridge.createReplayProjectionViewModel();

    timers.fire(staleHandle, { force: true });
    assert.deepEqual(
      bridge.createReplayProjectionViewModel(),
      afterOperation,
      `${operation} must win over a stale playback tick`,
    );
    assert.equal(bridge.createReplayPlaybackViewModel().playing, false);
    assert.equal(bridge.createReplayPlaybackViewModel().hasPendingTick, false);
  }
});

test('Hand-mode exit and workspace cancellation leave no live timer', () => {
  const { bridge, timers } = initializedBridge();
  bridge.startReplayPlayback();
  const staleModeHandle = timers.latestHandle();
  bridge.setMode('scenario', { tableSize: 2, rakeMode: 'none', straddleBb: 0 });
  assert.equal(timers.pendingCount(), 0);
  timers.fire(staleModeHandle, { force: true });
  assert.equal(bridge.createReplayProjectionViewModel(), null);

  bridge.setMode('hand', { tableSize: 2, rakeMode: 'none', straddleBb: 0 });
  bridge.startReplayPlayback();
  const staleWorkspaceHandle = timers.latestHandle();
  bridge.cancelReplayPlayback();
  assert.equal(timers.pendingCount(), 0);
  timers.fire(staleWorkspaceHandle, { force: true });
  assert.equal(bridge.createReplayPlaybackViewModel().status, 'idle');
});

test('forward projection publishes truthful action, fold, all-in, board, pot, actor, and showdown motion facts', () => {
  const recorded = [];
  let state = initializeHand({
    handId: 'replay-001c-motion',
    game: {
      mode: GAME_MODES.HOME,
      smallBlindMilliBb: 500,
      bigBlindMilliBb: 1000,
      chipUnitMilliBb: 100,
      ante: { type: ANTE_TYPES.NONE, amountMilliBb: 0 },
    },
    buttonSeat: 0,
    players: [0, 1].map((seat) => ({
      playerId: `P${seat}`,
      seat,
      startingStackMilliBb: 10_000,
    })),
  });
  const controller = createReplayProjectionController({
    getLiveState: () => state,
    getHeroPlayerId: () => 'P0',
  });
  const record = (next, operation) => {
    state = next;
    controller.recordTransition({ state, heroPlayerId: 'P0', operation });
  };
  const act = (type) => applyAction(
    state,
    createAction(state.actingPlayerId, type),
  );

  controller.replaceHand({
    state,
    heroPlayerId: 'P0',
    operation: REPLAY_FRAME_OPERATIONS.INITIALIZE_HAND,
  });
  record(applyChance(state, {
    type: CHANCE_TYPES.DEAL_HOLE,
    cardsByPlayer: { P0: ['As', 'Ad'], P1: ['Kh', 'Kd'] },
  }), REPLAY_FRAME_OPERATIONS.DEAL_HOLE);
  record(act(ACTION_TYPES.CALL), REPLAY_FRAME_OPERATIONS.ACTION);
  record(act(ACTION_TYPES.CHECK), REPLAY_FRAME_OPERATIONS.ACTION);
  record(applyChance(state, {
    type: CHANCE_TYPES.DEAL_FLOP,
    cards: ['2c', '3c', '4c'],
  }), REPLAY_FRAME_OPERATIONS.DEAL_BOARD);
  record(act(ACTION_TYPES.ALL_IN), REPLAY_FRAME_OPERATIONS.ACTION);
  record(act(ACTION_TYPES.CALL), REPLAY_FRAME_OPERATIONS.ACTION);
  record(applyChance(state, {
    type: CHANCE_TYPES.DEAL_TURN,
    cards: ['9s'],
  }), REPLAY_FRAME_OPERATIONS.DEAL_BOARD);
  record(applyChance(state, {
    type: CHANCE_TYPES.DEAL_RIVER,
    cards: ['Jc'],
  }), REPLAY_FRAME_OPERATIONS.DEAL_BOARD);
  record(resolveShowdown(state), REPLAY_FRAME_OPERATIONS.SHOWDOWN);

  let projection = controller.beginPlayback();
  while (projection.canPlaybackAdvance) {
    projection = controller.advancePlayback();
    if (projection.motion.active) recorded.push(projection.motion);
  }

  assert.equal(projection.mode, 'replay');
  assert.equal(projection.atPlaybackEnd, true);
  assert.deepEqual(
    recorded.filter((motion) => motion.transitionKind.endsWith('_deal'))
      .map((motion) => motion.boardCards),
    [[], ['2c', '3c', '4c'], ['9s'], ['Jc']],
  );
  const actions = recorded.filter((motion) => motion.transitionKind === 'action');
  assert.deepEqual(actions.map((motion) => motion.actionType), [
    ACTION_TYPES.CALL, ACTION_TYPES.CHECK, ACTION_TYPES.ALL_IN, ACTION_TYPES.CALL,
  ]);
  assert.equal(actions.every((motion) => motion.actorPlayerId), true);
  assert.equal(actions.some((motion) => motion.nextActorPlayerId), true);
  const allIn = actions.find((motion) => motion.actionType === ACTION_TYPES.ALL_IN);
  assert.equal(allIn.wasAllIn, true);
  assert.equal(allIn.seatChanges.some((change) => change.allInChanged), true);
  assert.equal(actions.some((motion) => motion.pot.changed), true);
  assert.equal(recorded.at(-1).transitionKind, 'showdown_resolution');

  let foldedState = initializeHand({
    handId: 'replay-001c-fold-motion',
    game: state.game,
    buttonSeat: 0,
    players: [0, 1].map((seat) => ({
      playerId: `F${seat}`,
      seat,
      startingStackMilliBb: 100_000,
    })),
  });
  const folded = createReplayProjectionController({
    getLiveState: () => foldedState,
    getHeroPlayerId: () => 'F0',
  });
  folded.replaceHand({ state: foldedState, heroPlayerId: 'F0' });
  foldedState = applyChance(foldedState, {
    type: CHANCE_TYPES.DEAL_HOLE,
    cardsByPlayer: { F0: ['As', 'Ad'], F1: ['Kh', 'Kd'] },
  });
  folded.recordTransition({
    state: foldedState,
    heroPlayerId: 'F0',
    operation: REPLAY_FRAME_OPERATIONS.DEAL_HOLE,
  });
  foldedState = applyAction(
    foldedState,
    createAction(foldedState.actingPlayerId, ACTION_TYPES.FOLD),
  );
  folded.recordTransition({
    state: foldedState,
    heroPlayerId: 'F0',
    operation: REPLAY_FRAME_OPERATIONS.ACTION,
  });
  folded.beginPlayback();
  folded.advancePlayback();
  const foldMotion = folded.advancePlayback().motion;
  assert.equal(foldMotion.actionType, ACTION_TYPES.FOLD);
  assert.equal(foldMotion.seatChanges.some((change) => change.foldedChanged), true);
});
