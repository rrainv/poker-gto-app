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
  isHiddenHoleCards,
  validatePokerState,
} from '../shared/poker-domain/index.js';
import { createReplayTimelineViewModel } from '../app/src/application/replay-timeline-view-model.mjs';
import {
  REPLAY_FRAME_OPERATIONS,
  createReplayProjectionController,
} from '../app/src/application/replay-projection-controller.mjs';
import {
  PLAYBOOK_SCENARIO_SCHEMA_VERSION,
  createPlaybookScenarioInput,
} from '../app/src/application/playbook-state-source.mjs';
import { createSavedStudyObjectApplication } from '../app/src/application/saved-study-object-service.mjs';
import {
  SAVED_HAND_SNAPSHOT_SCHEMA_VERSION,
  SAVED_SPOT_DERIVATIONS,
  SAVED_STUDY_CLASSIFICATIONS,
  SAVED_STUDY_KINDS,
  SAVED_STUDY_OBJECT_SCHEMA_VERSION,
  SAVED_STUDY_REVIEW_STATES,
  SAVED_STUDY_SOURCE_SURFACES,
  archiveSavedStudyObject,
  createMemorySavedStudyDatabase,
  createSavedHandSnapshot,
  createSavedSpotSnapshot,
  createSavedStudyAnnotations,
  createSavedStudyObject,
  createSavedStudyOwnerRef,
  createSavedStudySource,
  updateSavedStudyAnnotations,
  validateSavedHandSnapshot,
  validateSavedSpotSnapshot,
  validateSavedStudyObject,
} from '../app/src/saved-study-objects/index.mjs';

const T0 = '2026-08-16T08:00:00.000Z';
const T1 = '2026-08-16T08:01:00.000Z';
const OWNER = createSavedStudyOwnerRef('saved-objects-domain-owner');

function initializedHand() {
  return initializeHand({
    handId: 'saved-objects-hand-1',
    game: {
      mode: GAME_MODES.HOME,
      smallBlindMilliBb: 500,
      bigBlindMilliBb: 1000,
      chipUnitMilliBb: 100,
      ante: { type: ANTE_TYPES.NONE, amountMilliBb: 0 },
    },
    buttonSeat: 0,
    players: [
      { playerId: 'Hero', seat: 0, startingStackMilliBb: 100_000 },
      { playerId: 'Villain', seat: 1, startingStackMilliBb: 100_000 },
    ],
  });
}

function activeObservedHand() {
  return applyChance(initializedHand(), {
    type: CHANCE_TYPES.DEAL_HOLE,
    cardsByPlayer: { Hero: ['As', 'Kh'] },
    hiddenPlayerIds: ['Villain'],
  });
}

function observedHandReplay({ call = false } = {}) {
  let state = initializedHand();
  const replay = createReplayProjectionController();
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
  if (call) {
    state = applyAction(state, createAction('Hero', ACTION_TYPES.CALL));
    replay.recordTransition({
      state,
      heroPlayerId: 'Hero',
      operation: REPLAY_FRAME_OPERATIONS.ACTION,
    });
  }
  return {
    state,
    replaySource: replay.createCanonicalHandReplaySource(),
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

function scenarioInput() {
  return createPlaybookScenarioInput({
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
}

test('SavedStudyObject v1 normalizes shared annotations and remains immutable', () => {
  const annotations = createSavedStudyAnnotations({
    title: '  BTN decision  ',
    note: '  Review the turn plan.  ',
    tags: ['  3-Bet   Pot ', 'btn', 'BTN'],
    reviewState: SAVED_STUDY_REVIEW_STATES.REVIEW_LATER,
    classifications: [SAVED_STUDY_CLASSIFICATIONS.MISTAKE],
  });
  const object = createSavedStudyObject({
    id: 'saved-study-domain-1',
    ownerRef: OWNER,
    kind: 'future_range',
    createdAt: T0,
    annotations,
    source: createSavedStudySource({
      surface: SAVED_STUDY_SOURCE_SURFACES.MATRIX,
      sourceId: 'matrix-state-1',
    }),
    payload: { schemaVersion: 'future-range-snapshot/v1', cells: [] },
  });

  assert.equal(object.schemaVersion, SAVED_STUDY_OBJECT_SCHEMA_VERSION);
  assert.equal(object.revision, 1);
  assert.equal(object.annotations.title, 'BTN decision');
  assert.equal(object.annotations.note, 'Review the turn plan.');
  assert.deepEqual(object.annotations.tags.map((tag) => [tag.key, tag.display]), [
    ['3-bet pot', '3-Bet Pot'],
    ['btn', 'btn'],
  ]);
  assert.equal(object.annotations.reviewState, 'review_later');
  assert.deepEqual(object.annotations.classifications, ['mistake']);
  assert.equal(Object.isFrozen(object.payload), true);
  assert.throws(() => { object.annotations.note = 'mutated'; }, TypeError);
  assert.equal(validateSavedStudyObject(object), object);
});

test('annotation revisions preserve identity/payload and archive is a lightweight immutable tombstone', () => {
  const original = createSavedStudyObject({
    id: 'saved-study-domain-2',
    ownerRef: OWNER,
    kind: 'future_drill',
    createdAt: T0,
    source: createSavedStudySource({ surface: SAVED_STUDY_SOURCE_SURFACES.TRAINING }),
    payload: { schemaVersion: 'future-drill/v1', seed: 'abc' },
  });
  const updated = updateSavedStudyAnnotations(original, {
    note: 'Revisit this family',
    tags: ['River'],
    reviewState: SAVED_STUDY_REVIEW_STATES.REVIEW_LATER,
  }, T1);
  assert.equal(updated.id, original.id);
  assert.equal(updated.createdAt, original.createdAt);
  assert.equal(updated.revision, 2);
  assert.deepEqual(updated.payload, original.payload);
  assert.equal(original.annotations.note, null);

  const archived = archiveSavedStudyObject(updated, T1);
  assert.equal(archived.lifecycle.state, 'archived');
  assert.equal(archived.lifecycle.archivedAt, T1);
  assert.equal(archived.revision, 3);
  assert.throws(() => updateSavedStudyAnnotations(archived, { note: 'no' }, T1), /immutable/);
  assert.equal(archiveSavedStudyObject(archived, T1), archived);
});

test('stable IDs, schema versions, revisions, and timestamp chronology validate strictly', () => {
  const common = {
    ownerRef: OWNER,
    kind: 'future_item',
    source: createSavedStudySource({ surface: 'future_surface' }),
    payload: { schemaVersion: 'future-item/v1' },
  };
  assert.throws(() => createSavedStudyObject({
    ...common,
    id: 'contains whitespace',
    createdAt: T0,
  }), /portable stable ID/);
  assert.throws(() => createSavedStudyObject({
    ...common,
    id: 'valid-id',
    createdAt: '2026-08-16',
  }), /normalized ISO timestamp/);
  assert.throws(() => createSavedStudyObject({
    ...common,
    id: 'valid-id',
    createdAt: T1,
    updatedAt: T0,
  }), /cannot precede/);
  assert.throws(() => createSavedStudyObject({
    ...common,
    id: 'valid-id',
    createdAt: T0,
    revision: 0,
  }), /positive integer/);
});

test('saved Hand snapshot round-trips canonical facts and a deterministic Replay source', () => {
  const { state: acted, replaySource } = observedHandReplay({ call: true });
  const snapshot = createSavedHandSnapshot({
    pokerState: acted,
    heroPlayerId: 'Hero',
    replaySource,
  });
  const restored = JSON.parse(JSON.stringify(snapshot));

  assert.equal(snapshot.schemaVersion, SAVED_HAND_SNAPSHOT_SCHEMA_VERSION);
  assert.equal(validateSavedHandSnapshot(restored), restored);
  assert.equal(validatePokerState(restored.pokerState), restored.pokerState);
  assert.equal(restored.pokerState.handId, 'saved-objects-hand-1');
  assert.equal(restored.pokerState.actionHistory.length, 1);
  assert.equal(restored.replaySource.schemaVersion, 'canonical-hand-replay-source/v1');
  assert.deepEqual(restored.replaySource.events.map((event) => event.operation), [
    'initialize_hand',
    'deal_hole_observed',
    'action',
  ]);

  const timeline = createReplayTimelineViewModel({
    state: restored.pokerState,
    heroPlayerId: restored.heroPlayerId,
  });
  assert.equal(timeline.entryCount, 1);
  assert.equal(timeline.groups[0].entries[0].actionType, ACTION_TYPES.CALL);
});

test('saved Hand privacy preserves canonical hidden markers and never invents opponent cards', () => {
  const { state, replaySource } = observedHandReplay();
  const snapshot = createSavedHandSnapshot({
    pokerState: state,
    heroPlayerId: 'Hero',
    replaySource,
  });
  const villain = snapshot.pokerState.players.find((player) => player.playerId === 'Villain');
  assert.equal(isHiddenHoleCards(villain.holeCards), true);
  assert.deepEqual(snapshot.privacy.hiddenPrivateCardPlayerIds, ['Villain']);
  assert.deepEqual(snapshot.privacy.knownPrivateCardPlayerIds, ['Hero']);
  const privateDeal = snapshot.replaySource.events[1].payload.chanceEvent;
  assert.deepEqual(privateDeal.cardsByPlayer, { Hero: ['As', 'Kh'] });
  assert.deepEqual(privateDeal.hiddenPlayerIds, ['Villain']);
  assert.doesNotMatch(JSON.stringify(snapshot), /"Villain"\s*:\s*\[/u);

  const tampered = JSON.parse(JSON.stringify(snapshot));
  tampered.privacy.hiddenPrivateCardPlayerIds = [];
  assert.throws(() => validateSavedHandSnapshot(tampered), /privacy metadata/);
});

test('Hand-derived spot is canonical while Scenario-derived spot is explicitly lossy with no history', async () => {
  const database = createMemorySavedStudyDatabase();
  const app = createSavedStudyObjectApplication({
    database,
    ownerRef: OWNER,
    clock: () => T0,
  });
  const state = activeObservedHand();
  const handResult = await app.saveSpot({
    derivation: SAVED_SPOT_DERIVATIONS.HAND,
    pokerState: state,
    heroPlayerId: 'Hero',
    savedHandObjectId: 'saved-hand-parent-1',
    operation: { id: 'saved-hand-spot-1', createdAt: T0 },
  });
  assert.equal(handResult.object.kind, SAVED_STUDY_KINDS.SPOT);
  assert.equal(handResult.object.payload.derivation, 'hand');
  assert.equal(handResult.object.payload.truth.historyStatus, 'canonical_reference');
  assert.equal(handResult.object.payload.handReference.actionSequenceCount, 0);
  assert.equal(handResult.object.payload.decisionContext.opponentCount, 1);
  assert.equal(handResult.object.payload.scenarioInput, null);
  validateSavedSpotSnapshot(handResult.object.payload);

  const lossyResult = await app.saveSpot({
    derivation: SAVED_SPOT_DERIVATIONS.SCENARIO,
    scenarioInput: scenarioInput(),
    decisionContext: scenarioDecisionContext(),
    operation: { id: 'saved-scenario-spot-1', createdAt: T0 },
  });
  assert.equal(lossyResult.object.payload.derivation, 'scenario');
  assert.equal(lossyResult.object.payload.truth.completeness, 'lossy_scenario');
  assert.equal(lossyResult.object.payload.truth.historyStatus, 'not_available');
  assert.equal(lossyResult.object.payload.handReference, null);
  assert.equal(lossyResult.object.payload.scenarioInput.schemaVersion, PLAYBOOK_SCENARIO_SCHEMA_VERSION);
  assert.equal(lossyResult.object.payload.decisionContext.opponentCount, null);
  assert.equal('actionHistory' in lossyResult.object.payload, false);

  const fakeHistory = JSON.parse(JSON.stringify(scenarioInput()));
  fakeHistory.actionHistory = [];
  assert.throws(() => createSavedSpotSnapshot({
    derivation: SAVED_SPOT_DERIVATIONS.SCENARIO,
    scenarioInput: fakeHistory,
    decisionContext: scenarioDecisionContext(),
  }), /unsupported fields|cannot claim canonical history/);
});

test('known kinds require their strict payload while unknown future kinds remain opaque and portable', () => {
  const common = {
    id: 'saved-study-kind-check',
    ownerRef: OWNER,
    createdAt: T0,
    source: createSavedStudySource({ surface: 'future_surface' }),
  };
  assert.throws(() => createSavedStudyObject({
    ...common,
    kind: SAVED_STUDY_KINDS.HAND,
    payload: { schemaVersion: 'not-a-hand/v1' },
  }), /saved-hand-snapshot\/v1/);

  const future = createSavedStudyObject({
    ...common,
    kind: 'session_review',
    payload: { schemaVersion: 'session-review/v7', facts: { count: 3 } },
  });
  assert.equal(validateSavedStudyObject(JSON.parse(JSON.stringify(future))).kind, 'session_review');
});
