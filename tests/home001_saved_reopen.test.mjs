import test from 'node:test';
import assert from 'node:assert/strict';

import {
  ACTION_TYPES,
  ANTE_TYPES,
  CHANCE_TYPES,
  GAME_MODES,
  applyChance,
  initializeHand,
} from '../shared/poker-domain/index.js';
import { installPlaybookStateSourceBridge } from '../app/src/application/playbook-mode-bootstrap.mjs';
import {
  REPLAY_FRAME_OPERATIONS,
  createReplayProjectionController,
} from '../app/src/application/replay-projection-controller.mjs';
import { createSavedStudyObjectApplication } from '../app/src/application/saved-study-object-service.mjs';
import { createSavedStudyObjectOpenController } from '../app/src/application/saved-study-object-open-controller.mjs';
import { createPlaybookScenarioInput } from '../app/src/application/playbook-state-source.mjs';
import {
  createMemorySavedStudyDatabase,
  createSavedStudyOwnerRef,
} from '../app/src/saved-study-objects/index.mjs';

const T0 = '2026-08-16T12:00:00.000Z';
const OWNER = createSavedStudyOwnerRef('home-001-owner');

function fakeWindow() {
  class FakeCustomEvent {
    constructor(type, options) { this.type = type; this.detail = options?.detail; }
  }
  return { CustomEvent: FakeCustomEvent, dispatchEvent() {} };
}

function savedHandSource() {
  const configuration = {
    handId: 'home-001-saved-hand',
    game: {
      mode: GAME_MODES.HOME,
      smallBlindMilliBb: 500,
      bigBlindMilliBb: 1000,
      chipUnitMilliBb: 100,
      ante: { type: ANTE_TYPES.NONE, amountMilliBb: 0 },
    },
    buttonSeat: 0,
    players: [
      { playerId: 'Hero', seat: 0, startingStackMilliBb: 100000 },
      { playerId: 'Villain', seat: 1, startingStackMilliBb: 100000 },
    ],
  };
  let state = initializeHand(configuration);
  const replay = createReplayProjectionController({
    getLiveState: () => state,
    getHeroPlayerId: () => 'Hero',
  });
  replay.replaceHand({
    state,
    heroPlayerId: 'Hero',
    operation: REPLAY_FRAME_OPERATIONS.INITIALIZE_HAND,
  });
  state = applyChance(state, {
    type: CHANCE_TYPES.DEAL_HOLE,
    cardsByPlayer: { Hero: ['As', 'Kh'] },
    hiddenPlayerIds: ['Villain'],
  });
  replay.recordTransition({
    state,
    heroPlayerId: 'Hero',
    operation: REPLAY_FRAME_OPERATIONS.DEAL_HOLE_OBSERVED,
  });
  return { state, replaySource: replay.createCanonicalHandReplaySource() };
}

function liveConfiguration() {
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

function scenarioDecisionContext() {
  return {
    schemaVersion: 'decision-context/v1',
    tableSize: 6,
    opponentCount: null,
    heroPosition: 'BTN',
    street: 'flop',
    heroCards: ['As', 'Kh'],
    board: ['Qc', '7d', '2s'],
    deadCards: [],
    stackBb: 100,
    stackMode: 'hero',
    potBb: 6.5,
    lastAction: 'check',
    facingSizeBb: 0,
    callAmountBb: 0,
    heroStreetContributionBb: null,
    rakeMode: 'off',
    forcedContributionPerPlayerBb: 0,
    totalForcedContributionBb: 0,
  };
}

test('cold Saved Hand opens in detached read-only Replay and preserves live Hand state and journal', async () => {
  const database = createMemorySavedStudyDatabase();
  const application = createSavedStudyObjectApplication({ database, ownerRef: OWNER, clock: () => T0 });
  const saved = savedHandSource();
  const savedResult = await application.saveHand({
    pokerState: saved.state,
    heroPlayerId: 'Hero',
    replaySource: saved.replaySource,
    title: 'Cold saved replay',
    operation: { id: 'home-001-cold-hand', createdAt: T0 },
  });

  const bridge = installPlaybookStateSourceBridge(fakeWindow());
  bridge.setMode('hand', { tableSize: 2, rakeMode: 'off', straddleBb: 0 });
  bridge.initializeHand(liveConfiguration());
  bridge.dealObservedHoleCards({ 'seat-0': ['Ad', 'Ah'] });
  bridge.applyAction(ACTION_TYPES.CALL);
  const liveStateBefore = structuredClone(bridge.getState());
  const liveSourceBefore = structuredClone(bridge.createCanonicalHandReplaySource());

  const opener = createSavedStudyObjectOpenController({ application, playbookBridge: bridge });
  const opened = await opener.open(savedResult.object.id);
  assert.equal(opened.kind, 'hand');
  assert.equal(opened.projection.mode, 'saved');
  assert.equal(opened.projection.readOnly, true);
  assert.equal(opened.projection.detachedReadOnly, true);
  assert.equal(opened.projection.viewerContext.kind, 'saved_hand');
  assert.equal(opened.projection.viewerContext.hasLiveHand, true);
  assert.equal(opened.projection.tablePresence.seats.find((seat) => seat.playerId === 'Villain').cardVisibility, 'hidden');
  assert.equal(bridge.createCanonicalHandReplaySource(), null, 'saved viewer cannot be resaved as the live hand');

  const previous = bridge.previousReplayFrame();
  assert.equal(previous.atStart, true);
  assert.equal(previous.readOnly, true);
  assert.equal(bridge.nextReplayFrame().atEndpoint, true);
  assert.deepEqual(bridge.getState(), saved.state);

  bridge.closeSavedHand();
  assert.deepEqual(bridge.getState(), liveStateBefore);
  assert.deepEqual(bridge.createCanonicalHandReplaySource(), liveSourceBefore);
});

test('Saved Scenario Spot reopens as a truthful lossy context with no Replay source', async () => {
  const database = createMemorySavedStudyDatabase();
  const application = createSavedStudyObjectApplication({ database, ownerRef: OWNER, clock: () => T0 });
  const scenarioInput = createPlaybookScenarioInput({
    tableSize: 6,
    heroPosition: 'BTN',
    street: 'flop',
    heroCards: ['As', 'Kh'],
    board: ['Qc', '7d', '2s'],
    deadCards: [],
    stackBb: 100,
    stackMode: 'hero',
    potBb: 6.5,
    lastAction: 'check',
    facingSizeBb: 0,
    rakeMode: 'off',
  });
  const saved = await application.saveScenarioDerivedSpot({
    scenarioInput,
    decisionContext: scenarioDecisionContext(),
    operation: { id: 'home-001-scenario-spot', createdAt: T0 },
  });
  let handOpenCalls = 0;
  const opener = createSavedStudyObjectOpenController({
    application,
    playbookBridge: { openSavedHand() { handOpenCalls += 1; } },
  });
  const opened = await opener.open(saved.object.id);
  assert.equal(opened.kind, 'spot');
  assert.equal(opened.derivation, 'scenario');
  assert.equal(opened.truth.historyStatus, 'not_available');
  assert.equal(opened.scenarioInput.schemaVersion, 'playbook-scenario/v1');
  assert.equal(Object.hasOwn(opened.scenarioInput, 'actionHistory'), false);
  assert.equal(handOpenCalls, 0);
});

test('Hand-derived Saved Spot preserves the canonical decision context without inventing history', async () => {
  const database = createMemorySavedStudyDatabase();
  const application = createSavedStudyObjectApplication({ database, ownerRef: OWNER, clock: () => T0 });
  const hand = savedHandSource();
  const saved = await application.saveHandDerivedSpot({
    pokerState: hand.state,
    heroPlayerId: 'Hero',
    savedHandObjectId: null,
    operation: { id: 'home-001-hand-spot', createdAt: T0 },
  });
  const opener = createSavedStudyObjectOpenController({
    application,
    playbookBridge: { openSavedHand() { throw new Error('Spot must not open Replay'); } },
  });
  const opened = await opener.open(saved.object.id);
  assert.equal(opened.kind, 'spot');
  assert.equal(opened.derivation, 'hand');
  assert.equal(opened.truth.historyStatus, 'canonical_reference');
  assert.equal(opened.scenarioInput, null);
  assert.equal(opened.decisionContext.opponentCount, 1);
  assert.equal(opened.decisionContext.callAmountBb, 0.5);
  assert.equal(opened.handReference.actionSequenceCount, 0);
  assert.equal(Object.hasOwn(opened, 'replaySource'), false);
});
