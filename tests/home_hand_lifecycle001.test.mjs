import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import {
  ACTION_TYPES,
  GAME_MODES,
  isHandResumable,
} from '../shared/poker-domain/index.js';
import { createCanonicalLiveController } from '../app/src/application/canonical-live-controller.mjs';
import { installHomeWorkspaceBridge } from '../app/src/application/home-workspace-bootstrap.mjs';
import { installPlaybookStateSourceBridge } from '../app/src/application/playbook-mode-bootstrap.mjs';

const LOGIC = await readFile(new URL('../app/src/core/logic.js', import.meta.url), 'utf8');

const HOLE_CARDS = Object.freeze({
  'seat-0': Object.freeze(['Ah', 'Ad']),
  'seat-1': Object.freeze(['Kh', 'Kd']),
});

function fakeWindow() {
  const listeners = new Map();
  return {
    localStorage: { getItem: () => null, setItem() {} },
    RiverlineAuthentication: {
      ready: async () => {},
      getState: () => ({ status: 'guest', profile: null }),
    },
    CustomEvent: class CustomEvent {
      constructor(type, options = {}) {
        this.type = type;
        this.detail = options.detail;
      }
    },
    addEventListener(type, listener) {
      const entries = listeners.get(type) || [];
      entries.push(listener);
      listeners.set(type, entries);
    },
    dispatchEvent(event) {
      for (const listener of listeners.get(event.type) || []) listener(event);
      return true;
    },
  };
}

function emptyStrategy() {
  return {
    profileCount: 0,
    selectedProfile: null,
    selectedMode: null,
    context: null,
    answeredCount: 0,
    directEvidenceCount: 0,
    contradictionCount: 0,
    totalCount: 169,
    session: null,
    resumable: false,
  };
}

function createHarness({ stackBb = 100 } = {}) {
  let handSequence = 0;
  const browserWindow = fakeWindow();
  const canonicalController = createCanonicalLiveController({ enabled: true });
  const playbook = installPlaybookStateSourceBridge(browserWindow, {
    canonicalController,
    handSourceIdFactory: () => `home-lifecycle-${++handSequence}`,
  });
  playbook.setMode('hand');
  const home = installHomeWorkspaceBridge(browserWindow, {
    savedStudyQueries: {
      getById: async () => null,
      listRecent: async () => [],
      listForReview: async () => [],
      listMistakes: async () => [],
    },
    personalStrategyQueries: { loadSummary: async () => emptyStrategy() },
  });

  const initialize = () => playbook.initializeHand({
    tableSize: 2,
    gameMode: GAME_MODES.HOME,
    stackBb,
    stackMode: 'hero',
    heroSeat: 0,
    buttonSeat: 0,
    anteType: 'none',
    anteBb: 0,
    straddleBb: 0,
  });

  return { browserWindow, canonicalController, home, initialize, playbook };
}

async function liveContinuationKinds(home) {
  const model = await home.load();
  return model.sections.continue.items.map((item) => item.kind);
}

function checkThroughRiver(playbook) {
  playbook.applyAction(ACTION_TYPES.CALL);
  playbook.applyAction(ACTION_TYPES.CHECK);
  playbook.dealBoardCards(['2c', '7d', 'Js']);
  playbook.applyAction(ACTION_TYPES.CHECK);
  playbook.applyAction(ACTION_TYPES.CHECK);
  playbook.dealBoardCards(['Qc']);
  playbook.applyAction(ACTION_TYPES.CHECK);
  playbook.applyAction(ACTION_TYPES.CHECK);
  playbook.dealBoardCards(['9s']);
  playbook.applyAction(ACTION_TYPES.CHECK);
  playbook.applyAction(ACTION_TYPES.CHECK);
  return playbook.resolveShowdown();
}

function assertCompletedHandUnchanged(actual, expected) {
  assert.deepEqual(actual, expected);
  assert.equal(actual.terminal.isTerminal, true);
}

test('active preflop, flop, turn, and river Hand states remain resumable from Home', async () => {
  const { canonicalController, home, initialize, playbook } = createHarness();
  initialize();
  playbook.dealObservedHoleCards(HOLE_CARDS);

  for (const expectedStreet of ['preflop', 'flop', 'turn', 'river']) {
    const state = canonicalController.getState();
    assert.equal(state.street, expectedStreet);
    assert.equal(isHandResumable(state), true);
    assert.equal(playbook.hasLiveHand(), true);
    assert.deepEqual(await liveContinuationKinds(home), ['live_hand']);

    if (expectedStreet === 'river') break;
    playbook.applyAction(expectedStreet === 'preflop' ? ACTION_TYPES.CALL : ACTION_TYPES.CHECK);
    playbook.applyAction(ACTION_TYPES.CHECK);
    playbook.dealBoardCards({
      preflop: ['2c', '7d', 'Js'],
      flop: ['Qc'],
      turn: ['9s'],
    }[expectedStreet]);
  }
});

test('a completed Hand stays unchanged when Home loads and Hand mode is reopened', async () => {
  const { canonicalController, home, initialize, playbook } = createHarness();
  initialize();
  playbook.dealObservedHoleCards(HOLE_CARDS);
  playbook.applyAction(ACTION_TYPES.FOLD);
  const completed = structuredClone(canonicalController.getState());

  await home.load();
  playbook.setMode('scenario');
  playbook.setMode('hand');

  assertCompletedHandUnchanged(canonicalController.getState(), completed);
  assert.equal(playbook.hasLiveHand(), false);
});

test('a saved Hand viewer never offers return to a completed canonical Hand', () => {
  const { canonicalController, initialize, playbook } = createHarness();
  initialize();
  playbook.dealObservedHoleCards(HOLE_CARDS);
  playbook.applyAction(ACTION_TYPES.FOLD);
  const completed = structuredClone(canonicalController.getState());
  const opened = playbook.openSavedHand({
    objectId: 'saved-hand',
    title: 'Saved hand',
    pokerState: completed,
    heroPlayerId: 'seat-0',
    replaySource: canonicalController.createCanonicalHandReplaySource(),
  });

  assert.equal(opened.viewerContext.hasLiveHand, false);
  playbook.closeSavedHand();
  assertCompletedHandUnchanged(canonicalController.getState(), completed);
});

test('terminal fold Hand is completed and never appears as a live Home continuation', async () => {
  const { home, initialize, playbook } = createHarness();
  initialize();
  playbook.dealObservedHoleCards(HOLE_CARDS);
  const terminal = playbook.applyAction(ACTION_TYPES.FOLD);

  assert.equal(terminal.terminal.reason, 'fold');
  assert.equal(isHandResumable(terminal), false);
  assert.equal(playbook.hasLiveHand(), false);
  assert.deepEqual(await liveContinuationKinds(home), []);
});

test('terminal showdown Hand is completed and never appears as a live Home continuation', async () => {
  const { home, initialize, playbook } = createHarness();
  initialize();
  playbook.dealObservedHoleCards(HOLE_CARDS);
  const terminal = checkThroughRiver(playbook);

  assert.equal(terminal.terminal.reason, 'showdown');
  assert.equal(playbook.hasLiveHand(), false);
  assert.deepEqual(await liveContinuationKinds(home), []);
});

test('terminal all-in runout Hand is completed and never appears as a live Home continuation', async () => {
  const { home, initialize, playbook } = createHarness({ stackBb: 10 });
  initialize();
  playbook.dealObservedHoleCards(HOLE_CARDS);
  playbook.applyAction(ACTION_TYPES.CALL);
  playbook.applyAction(ACTION_TYPES.CHECK);
  playbook.dealBoardCards(['2c', '7d', 'Js']);
  playbook.applyAction(ACTION_TYPES.ALL_IN);
  playbook.applyAction(ACTION_TYPES.CALL);
  playbook.dealBoardCards(['Qc']);
  playbook.dealBoardCards(['9s']);
  const terminal = playbook.resolveShowdown();

  assert.equal(terminal.terminal.reason, 'showdown');
  assert.equal(playbook.hasLiveHand(), false);
  assert.deepEqual(await liveContinuationKinds(home), []);
});

test('active to terminal transition changes the Home projection immediately', async () => {
  const { home, initialize, playbook } = createHarness();
  initialize();
  playbook.dealObservedHoleCards(HOLE_CARDS);
  assert.deepEqual(await liveContinuationKinds(home), ['live_hand']);

  playbook.applyAction(ACTION_TYPES.FOLD);

  assert.deepEqual(await liveContinuationKinds(home), []);
  assert.match(
    LOGIC,
    /riverline:playbook-state-change'[\s\S]*?scheduleHomeRefresh\(\)[\s\S]*?renderCanonicalHandWorkspace\(\)/,
  );
});

test('terminal to New Hand restores an active Home continuation', async () => {
  const { home, initialize, playbook } = createHarness();
  initialize();
  playbook.dealObservedHoleCards(HOLE_CARDS);
  playbook.applyAction(ACTION_TYPES.FOLD);
  assert.deepEqual(await liveContinuationKinds(home), []);

  assert.equal(playbook.prepareNewHand().status, 'ready_for_setup');
  assert.deepEqual(await liveContinuationKinds(home), []);
  initialize();

  assert.deepEqual(await liveContinuationKinds(home), ['live_hand']);
});

test('aborting an active Hand removes Home continuation without affecting its query contract', async () => {
  const { home, initialize, playbook } = createHarness();
  initialize();
  assert.deepEqual(await liveContinuationKinds(home), ['live_hand']);

  playbook.resetHand();

  assert.equal(playbook.hasLiveHand(), false);
  assert.deepEqual(await liveContinuationKinds(home), []);
});

test('Personal Strategy continuation remains available without a live Hand', async () => {
  const { browserWindow, playbook } = createHarness();
  const personalStrategyQueries = {
    loadSummary: async () => ({
      ...emptyStrategy(),
      selectedProfile: { id: 'profile-1', displayName: 'My strategy' },
      selectedMode: { id: 'mode-1', displayName: 'Cash' },
      context: { tableSize: 6 },
      answeredCount: 12,
      directEvidenceCount: 12,
      totalCount: 169,
      session: { state: 'paused', updatedAt: '2026-09-01T00:00:00.000Z' },
      resumable: true,
    }),
  };
  const home = installHomeWorkspaceBridge(browserWindow, {
    playbookBridge: playbook,
    savedStudyQueries: {
      getById: async () => null,
      listRecent: async () => [],
      listForReview: async () => [],
      listMistakes: async () => [],
    },
    personalStrategyQueries,
    authentication: {
      ready: async () => {},
      getState: () => ({ status: 'signed_in', profile: { displayName: 'Dana', username: 'dana' } }),
    },
  });

  assert.deepEqual((await home.load()).sections.continue.items.map((item) => item.kind), [
    'range_calibration',
  ]);
});
