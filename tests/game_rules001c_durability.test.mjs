import test from 'node:test';
import assert from 'node:assert/strict';

import {
  ACTION_TYPES,
  CHANCE_TYPES,
  GAME_RULES_SNAPSHOT_SOURCE_KINDS,
  applyAction,
  applyChance,
  applyPrivateReveal,
  createAction,
  createGameRulesSnapshot,
  createGameRulesSnapshotFromLegacyGameConfiguration,
  initializeHand,
  initializeHandFromGameRulesSnapshot,
  resolveShowdown,
} from '../shared/poker-domain/index.js';
import {
  CANONICAL_HAND_REPLAY_EVENT_SCHEMA_VERSION,
  CANONICAL_HAND_REPLAY_EVENT_V2_SCHEMA_VERSION,
  CANONICAL_HAND_REPLAY_SOURCE_SCHEMA_VERSION,
  CANONICAL_HAND_REPLAY_SOURCE_V2_SCHEMA_VERSION,
  canonicalPokerStatesEqual,
  reconstructCanonicalHandReplaySource,
  validateCanonicalHandReplaySource,
} from '../app/src/application/canonical-hand-replay-source.mjs';
import {
  REPLAY_FRAME_OPERATIONS,
  createReplayProjectionController,
} from '../app/src/application/replay-projection-controller.mjs';
import { createSavedStudyObjectApplication } from '../app/src/application/saved-study-object-service.mjs';
import { createSavedStudyObjectOpenController } from '../app/src/application/saved-study-object-open-controller.mjs';
import { createHomeSavedItem } from '../app/src/application/home-view-model.mjs';
import { createPlaybookScenarioInput } from '../app/src/application/playbook-state-source.mjs';
import {
  SAVED_HAND_SNAPSHOT_SCHEMA_VERSION,
  SAVED_HAND_SNAPSHOT_V2_SCHEMA_VERSION,
  SAVED_SPOT_SNAPSHOT_SCHEMA_VERSION,
  SAVED_SPOT_SNAPSHOT_V2_SCHEMA_VERSION,
  createMemorySavedStudyDatabase,
  createSavedHandSnapshot,
  createSavedSpotSnapshot,
  createSavedStudyOwnerRef,
  parseSavedStudyLibraryExport,
  serializeSavedStudyLibraryExport,
  validateSavedHandSnapshot,
  validateSavedSpotSnapshot,
} from '../app/src/saved-study-objects/index.mjs';
import {
  fromRemoteSavedStudyObject,
  toRemoteSavedStudyObject,
  validateRemoteSavedStudyObject,
} from '../app/src/sync/index.mjs';
import {
  LEGACY_V1_LIBRARY_EXPORT_JSON,
  LEGACY_V1_REMOTE_HAND_JSON,
  LEGACY_V1_REPLAY_JSON,
} from './fixtures/game_rules001c_legacy.mjs';

const T0 = '2026-08-20T10:00:00.000Z';
const T1 = '2026-08-20T10:01:00.000Z';
const HERO_CARDS = Object.freeze(['As', 'Kh']);
const VILLAIN_CARDS = Object.freeze(['Qd', 'Qc']);
const BOARD = Object.freeze(['2s', '3h', '4d', '5c', '9s']);

function legacyGame(mode = 'home') {
  return {
    mode,
    smallBlindMilliBb: 500,
    bigBlindMilliBb: 1000,
    chipUnitMilliBb: 100,
    ante: { type: 'none', amountMilliBb: 0 },
  };
}

function playerSeeds(count) {
  return Array.from({ length: count }, (_, seat) => ({
    playerId: `P${seat}`,
    seat,
    startingStackMilliBb: 100_000,
  }));
}

function snapshotFor({ count = 2, mode = 'home', source = null } = {}) {
  const compatibility = createGameRulesSnapshotFromLegacyGameConfiguration(
    legacyGame(mode),
    count,
  );
  if (source === null) return compatibility;
  return createGameRulesSnapshot({
    source,
    setup: compatibility.setup,
    definition: compatibility.definition,
  });
}

function initializedV1Hand(handId = 'game-rules-001c-v1') {
  return initializeHand({
    handId,
    game: legacyGame(),
    buttonSeat: 0,
    players: playerSeeds(2),
  });
}

function initializedV2Hand({
  handId = 'game-rules-001c-v2',
  count = 2,
  mode = 'home',
  source = null,
} = {}) {
  return initializeHandFromGameRulesSnapshot({
    handId,
    rulesSnapshot: snapshotFor({ count, mode, source }),
    buttonSeat: 0,
    players: playerSeeds(count),
  });
}

function startReplay(state, heroPlayerId = 'P0') {
  const controller = createReplayProjectionController();
  controller.replaceHand({
    state,
    heroPlayerId,
    operation: REPLAY_FRAME_OPERATIONS.INITIALIZE_HAND,
  });
  return controller;
}

function observedActiveHand({ version = 2, count = 2, mode = 'home', source = null } = {}) {
  let state = version === 1
    ? initializedV1Hand()
    : initializedV2Hand({ count, mode, source });
  const replay = startReplay(state);
  state = applyChance(state, {
    type: CHANCE_TYPES.DEAL_HOLE,
    cardsByPlayer: { P0: HERO_CARDS },
    hiddenPlayerIds: state.players.filter((player) => player.playerId !== 'P0')
      .map((player) => player.playerId),
  });
  replay.recordTransition({
    state,
    heroPlayerId: 'P0',
    operation: REPLAY_FRAME_OPERATIONS.DEAL_HOLE_OBSERVED,
  });
  return { state, replaySource: replay.createCanonicalHandReplaySource() };
}

function completeObservedV2Hand({ source = null } = {}) {
  let state = initializedV2Hand({ source });
  const replay = startReplay(state);
  const record = (nextState, operation) => {
    state = nextState;
    replay.recordTransition({ state, heroPlayerId: 'P0', operation });
  };
  const act = (type) => record(
    applyAction(state, createAction(state.actingPlayerId, type)),
    REPLAY_FRAME_OPERATIONS.ACTION,
  );
  const dealBoard = (type, cards) => record(
    applyChance(state, { type, cards }),
    REPLAY_FRAME_OPERATIONS.DEAL_BOARD,
  );

  record(applyChance(state, {
    type: CHANCE_TYPES.DEAL_HOLE,
    cardsByPlayer: { P0: HERO_CARDS },
    hiddenPlayerIds: ['P1'],
  }), REPLAY_FRAME_OPERATIONS.DEAL_HOLE_OBSERVED);
  act(ACTION_TYPES.CALL);
  act(ACTION_TYPES.CHECK);
  for (const [type, cards] of [
    [CHANCE_TYPES.DEAL_FLOP, BOARD.slice(0, 3)],
    [CHANCE_TYPES.DEAL_TURN, [BOARD[3]]],
    [CHANCE_TYPES.DEAL_RIVER, [BOARD[4]]],
  ]) {
    dealBoard(type, cards);
    act(ACTION_TYPES.CHECK);
    act(ACTION_TYPES.CHECK);
  }
  record(
    applyPrivateReveal(state, { playerId: 'P1', cards: VILLAIN_CARDS }),
    REPLAY_FRAME_OPERATIONS.REVEAL_HOLE,
  );
  record(resolveShowdown(state), REPLAY_FRAME_OPERATIONS.SHOWDOWN);
  return { state, replaySource: replay.createCanonicalHandReplaySource() };
}

function noRakeScenario() {
  const scenarioInput = createPlaybookScenarioInput({
    tableSize: 6,
    heroPosition: 'BTN',
    street: 'flop',
    heroCards: HERO_CARDS,
    board: ['Qc', '7d', '2h'],
    deadCards: [],
    stackBb: 100,
    stackMode: 'hero',
    potBb: 6.5,
    lastAction: 'check',
    lastActionLabel: 'Checked to Hero',
    facingSizeBb: 0,
    rakeMode: 'off',
    forcedContributionPerPlayerBb: 0,
    totalForcedContributionBb: 0,
    anteBb: 0,
    straddleBb: 0,
  });
  return {
    scenarioInput,
    decisionContext: {
      schemaVersion: 'decision-context/v1',
      tableSize: 6,
      opponentCount: null,
      heroPosition: 'BTN',
      street: 'flop',
      heroCards: [...HERO_CARDS],
      board: ['Qc', '7d', '2h'],
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
    },
  };
}

function application(label) {
  return createSavedStudyObjectApplication({
    database: createMemorySavedStudyDatabase({ name: `game-rules-001c-${label}` }),
    ownerRef: createSavedStudyOwnerRef(`game-rules-001c-${label}-owner`),
    clock: () => T0,
  });
}

test('v1 Replay source/event bytes keep their exact schemas and still reconstruct', () => {
  const original = observedActiveHand({ version: 1 });
  const serialized = JSON.stringify(original.replaySource);
  const parsed = JSON.parse(serialized);
  assert.equal(parsed.schemaVersion, CANONICAL_HAND_REPLAY_SOURCE_SCHEMA_VERSION);
  assert.ok(parsed.events.every((event) => (
    event.schemaVersion === CANONICAL_HAND_REPLAY_EVENT_SCHEMA_VERSION
  )));
  assert.deepEqual(reconstructCanonicalHandReplaySource(parsed).finalState, original.state);
  assert.equal(JSON.stringify(parsed), serialized);
});

test('static historical v1 Replay, Saved Hand/Spot export, and synced entity remain readable byte-for-byte', async () => {
  const replaySource = JSON.parse(LEGACY_V1_REPLAY_JSON);
  const replay = reconstructCanonicalHandReplaySource(replaySource);
  assert.equal(replay.finalState.schemaVersion, 'poker-state/v1');
  assert.equal(JSON.stringify(replaySource), LEGACY_V1_REPLAY_JSON);

  const portable = parseSavedStudyLibraryExport(LEGACY_V1_LIBRARY_EXPORT_JSON);
  assert.equal(serializeSavedStudyLibraryExport(portable), LEGACY_V1_LIBRARY_EXPORT_JSON);
  assert.deepEqual(portable.objects.map((object) => [object.kind, object.payload.schemaVersion]), [
    ['hand', 'saved-hand-snapshot/v1'],
    ['spot', 'saved-spot-snapshot/v1'],
  ]);

  const remoteDocument = JSON.parse(LEGACY_V1_REMOTE_HAND_JSON);
  assert.equal(validateRemoteSavedStudyObject(remoteDocument), remoteDocument);
  const localObject = fromRemoteSavedStudyObject(
    remoteDocument,
    createSavedStudyOwnerRef('legacy-v1-cold-owner'),
  );
  assert.equal(JSON.stringify(toRemoteSavedStudyObject(localObject)), LEGACY_V1_REMOTE_HAND_JSON);

  const fresh = application('legacy-fixture');
  assert.equal((await fresh.importLibrary(LEGACY_V1_LIBRARY_EXPORT_JSON)).importedCount, 2);
  const opened = createSavedStudyObjectOpenController({
    application: fresh,
    playbookBridge: {
      openSavedHand(input) {
        const projection = createReplayProjectionController()
          .replaceFromCanonicalHandReplaySource(input.replaySource, { readOnly: true });
        return Object.freeze({
          ...projection,
          viewerContext: Object.freeze({ kind: 'saved_hand' }),
        });
      },
    },
  });
  assert.equal((await opened.open('legacy-v1-saved-hand')).projection.mode, 'saved');
  assert.equal((await opened.open('legacy-v1-saved-spot')).derivation, 'scenario');
});

test('v2 Replay serializes its exact snapshot initialization and cold-reconstructs terminal semantics', () => {
  const source = {
    kind: GAME_RULES_SNAPSHOT_SOURCE_KINDS.PRESET,
    presetId: 'deleted:offline-preset',
    presetRevision: 47,
  };
  const original = completeObservedV2Hand({ source });
  const parsed = JSON.parse(JSON.stringify(original.replaySource));
  assert.equal(parsed.schemaVersion, CANONICAL_HAND_REPLAY_SOURCE_V2_SCHEMA_VERSION);
  assert.ok(parsed.events.every((event) => (
    event.schemaVersion === CANONICAL_HAND_REPLAY_EVENT_V2_SCHEMA_VERSION
  )));
  assert.deepEqual(parsed.events[0].payload.configuration.rulesSnapshot.source, source);

  const reconstruction = reconstructCanonicalHandReplaySource(parsed);
  assert.deepEqual(reconstruction.finalState, original.state);
  assert.equal(reconstruction.finalState.schemaVersion, 'poker-state/v2');
  assert.equal(reconstruction.finalState.terminal.isTerminal, true);
  assert.ok(reconstruction.finalState.showdown.layerResults.length > 0);
  const rulesIdentity = reconstruction.frames[0].state.rulesSnapshot;
  assert.ok(reconstruction.frames.every((frame) => frame.state.rulesSnapshot === rulesIdentity));
});

test('v2 Replay rejects malformed/missing snapshots, mixed versions, and unknown versions explicitly', () => {
  const original = observedActiveHand();
  const malformed = structuredClone(original.replaySource);
  malformed.events[0].payload.configuration.rulesSnapshot.semanticFingerprint = 'wrong';
  assert.throws(() => validateCanonicalHandReplaySource(malformed), /semanticFingerprint/);

  const missing = structuredClone(original.replaySource);
  delete missing.events[0].payload.configuration.rulesSnapshot;
  assert.throws(() => validateCanonicalHandReplaySource(missing), /exactly|rulesSnapshot/);

  const mixed = structuredClone(original.replaySource);
  mixed.events[1].schemaVersion = CANONICAL_HAND_REPLAY_EVENT_SCHEMA_VERSION;
  assert.throws(() => validateCanonicalHandReplaySource(mixed), /Expected canonical-hand-replay-event\/v2/);

  const futureSource = structuredClone(original.replaySource);
  futureSource.schemaVersion = 'canonical-hand-replay-source/v999';
  assert.throws(() => validateCanonicalHandReplaySource(futureSource), /Unsupported.*v999/);

  const futureEvent = structuredClone(original.replaySource);
  futureEvent.events[0].schemaVersion = 'canonical-hand-replay-event/v999';
  assert.throws(() => validateCanonicalHandReplaySource(futureEvent), /Unsupported|Expected/);
});

test('Saved Hand nested v1 remains v1 while v2 validates exact state/replay rules consistency', () => {
  const v1 = observedActiveHand({ version: 1 });
  const v1Snapshot = createSavedHandSnapshot({
    pokerState: v1.state,
    heroPlayerId: 'P0',
    replaySource: v1.replaySource,
  });
  assert.equal(v1Snapshot.schemaVersion, SAVED_HAND_SNAPSHOT_SCHEMA_VERSION);
  assert.equal(validateSavedHandSnapshot(v1Snapshot), v1Snapshot);

  const v2 = completeObservedV2Hand();
  const v2Snapshot = createSavedHandSnapshot({
    pokerState: v2.state,
    heroPlayerId: 'P0',
    replaySource: v2.replaySource,
  });
  assert.equal(v2Snapshot.schemaVersion, SAVED_HAND_SNAPSHOT_V2_SCHEMA_VERSION);
  assert.equal(validateSavedHandSnapshot(v2Snapshot), v2Snapshot);
  assert.deepEqual(
    reconstructCanonicalHandReplaySource(v2Snapshot.replaySource).finalState,
    v2Snapshot.pokerState,
  );

  const differentProvenance = completeObservedV2Hand({
    source: { kind: GAME_RULES_SNAPSHOT_SOURCE_KINDS.DIRECT },
  });
  const mismatch = structuredClone(v2Snapshot);
  mismatch.replaySource = structuredClone(differentProvenance.replaySource);
  assert.throws(() => validateSavedHandSnapshot(mismatch), /rules snapshots must agree/);
});

test('Saved Spot v1 remains exact and v2 standalone/Hand-derived spots preserve strict rules semantics', async () => {
  const scenario = noRakeScenario();
  const v1 = createSavedSpotSnapshot({
    derivation: 'scenario',
    ...scenario,
  });
  assert.equal(v1.schemaVersion, SAVED_SPOT_SNAPSHOT_SCHEMA_VERSION);
  assert.equal(Object.hasOwn(v1, 'rulesSnapshot'), false);

  const rulesSnapshot = snapshotFor({ count: 6 });
  const v2 = createSavedSpotSnapshot({
    derivation: 'scenario',
    ...scenario,
    rulesSnapshot,
  });
  assert.equal(v2.schemaVersion, SAVED_SPOT_SNAPSHOT_V2_SCHEMA_VERSION);
  assert.deepEqual(v2.rulesSnapshot, rulesSnapshot);
  assert.equal(validateSavedSpotSnapshot(v2), v2);

  const fixedScenario = structuredClone(scenario);
  for (const facts of [fixedScenario.scenarioInput, fixedScenario.decisionContext]) {
    facts.tableSize = 7;
    facts.rakeMode = 'fixed';
    facts.forcedContributionPerPlayerBb = 0.1;
    facts.totalForcedContributionBb = 0.7;
  }
  const fixedV2 = createSavedSpotSnapshot({
    derivation: 'scenario',
    ...fixedScenario,
    rulesSnapshot: snapshotFor({ count: 7, mode: 'clubgg' }),
  });
  assert.equal(validateSavedSpotSnapshot(fixedV2), fixedV2);

  const savedApplication = application('spot-v2');
  const active = observedActiveHand();
  const handSpot = await savedApplication.saveHandDerivedSpot({
    pokerState: active.state,
    heroPlayerId: 'P0',
    operation: { id: 'game-rules-001c-hand-spot', createdAt: T0 },
  });
  assert.equal(handSpot.object.payload.schemaVersion, SAVED_SPOT_SNAPSHOT_V2_SCHEMA_VERSION);
  assert.deepEqual(handSpot.object.payload.rulesSnapshot, active.state.rulesSnapshot);
  assert.equal(handSpot.object.payload.decisionContext.rakeMode, 'off');

  const missing = structuredClone(v2);
  delete missing.rulesSnapshot;
  assert.throws(() => validateSavedSpotSnapshot(missing), /unsupported fields|rulesSnapshot/);
  const malformed = structuredClone(v2);
  malformed.rulesSnapshot.semanticFingerprint = 'wrong';
  assert.throws(() => validateSavedSpotSnapshot(malformed), /semanticFingerprint/);
  const contradictory = structuredClone(v2);
  contradictory.decisionContext.rakeMode = 'fixed';
  assert.throws(() => validateSavedSpotSnapshot(contradictory), /accounting must match/);
});

test('v2 Saved Hand and Spot export/import into a fresh repository and reopen offline', async () => {
  const sourceApplication = application('export-source');
  const complete = completeObservedV2Hand({
    source: {
      kind: GAME_RULES_SNAPSHOT_SOURCE_KINDS.PRESET,
      presetId: 'unavailable:after-save',
      presetRevision: 12,
    },
  });
  const savedHand = await sourceApplication.saveHand({
    pokerState: complete.state,
    heroPlayerId: 'P0',
    replaySource: complete.replaySource,
    operation: { id: 'game-rules-001c-export-hand', createdAt: T0 },
  });
  const scenario = noRakeScenario();
  const savedSpot = await sourceApplication.saveScenarioDerivedSpot({
    ...scenario,
    rulesSnapshot: snapshotFor({ count: 6 }),
    operation: { id: 'game-rules-001c-export-spot', createdAt: T0 },
  });
  const portable = await sourceApplication.exportLibrary({ exportedAt: T1 });
  const serialized = serializeSavedStudyLibraryExport(portable);
  assert.deepEqual(parseSavedStudyLibraryExport(serialized), portable);

  const fresh = application('export-fresh');
  const imported = await fresh.importLibrary(serialized);
  assert.equal(imported.importedCount, 2);
  const importedHand = await fresh.getById(savedHand.object.id);
  const importedSpot = await fresh.getById(savedSpot.object.id);
  assert.deepEqual(importedHand.payload.rulesSnapshot, undefined);
  assert.deepEqual(importedHand.payload.pokerState.rulesSnapshot, complete.state.rulesSnapshot);
  assert.deepEqual(importedSpot.payload.rulesSnapshot, savedSpot.object.payload.rulesSnapshot);

  let openedInput = null;
  const opener = createSavedStudyObjectOpenController({
    application: fresh,
    playbookBridge: {
      openSavedHand(input) {
        openedInput = input;
        const replay = createReplayProjectionController();
        const projection = replay.replaceFromCanonicalHandReplaySource(
          input.replaySource,
          { readOnly: true },
        );
        return Object.freeze({
          ...projection,
          viewerContext: Object.freeze({ kind: 'saved_hand' }),
        });
      },
    },
  });
  const openedHand = await opener.open(savedHand.object.id);
  assert.equal(openedHand.projection.mode, 'saved');
  assert.deepEqual(openedInput.pokerState, complete.state);
  const openedSpot = await opener.open(savedSpot.object.id);
  assert.deepEqual(openedSpot.rulesSnapshot, savedSpot.object.payload.rulesSnapshot);
});

test('v2 observer-safe Saved Hand keeps hidden cards hidden and rules contain no private facts', () => {
  const active = observedActiveHand();
  const snapshot = createSavedHandSnapshot({
    pokerState: active.state,
    heroPlayerId: 'P0',
    replaySource: active.replaySource,
  });
  assert.deepEqual(snapshot.privacy.hiddenPrivateCardPlayerIds, ['P1']);
  assert.equal(JSON.stringify(snapshot.replaySource).includes('Qd'), false);
  assert.equal(JSON.stringify(snapshot.replaySource).includes('Qc'), false);
  const rulesJson = JSON.stringify(snapshot.pokerState.rulesSnapshot);
  assert.equal(rulesJson.includes(HERO_CARDS[0]), false);
  assert.equal(rulesJson.includes(HERO_CARDS[1]), false);
  const reconstruction = reconstructCanonicalHandReplaySource(snapshot.replaySource);
  assert.equal(reconstruction.frames[1].state.players[1].holeCards.status, 'hidden');
});

test('snapshot source metadata and deleted preset references never select v2 mathematics', () => {
  const compatibility = snapshotFor({ count: 2 });
  const direct = snapshotFor({
    count: 2,
    source: { kind: GAME_RULES_SNAPSHOT_SOURCE_KINDS.DIRECT },
  });
  const deletedPreset = snapshotFor({
    count: 2,
    source: {
      kind: GAME_RULES_SNAPSHOT_SOURCE_KINDS.PRESET,
      presetId: 'deleted:historical-rules',
      presetRevision: 999,
    },
  });
  const initialize = (rulesSnapshot) => initializeHandFromGameRulesSnapshot({
    handId: 'source-neutral',
    rulesSnapshot,
    buttonSeat: 0,
    players: playerSeeds(2),
  });
  const realized = (state) => ({
    game: state.game,
    players: state.players,
    potMilliBb: state.potMilliBb,
    deductionTotalMilliBb: state.deductionTotalMilliBb,
    ledger: state.ledger,
  });
  assert.deepEqual(realized(initialize(compatibility)), realized(initialize(direct)));
  assert.deepEqual(realized(initialize(direct)), realized(initialize(deletedPreset)));
  assert.equal(compatibility.semanticFingerprint, deletedPreset.semanticFingerprint);
});

test('Home preserves v1 gameMode and derives neutral v2 accounting without brand authority', async () => {
  const savedApplication = application('home');
  const v1 = observedActiveHand({ version: 1 });
  const v1Saved = await savedApplication.saveHand({
    pokerState: v1.state,
    heroPlayerId: 'P0',
    replaySource: v1.replaySource,
    operation: { id: 'game-rules-001c-home-v1', createdAt: T0 },
  });
  const fixed = observedActiveHand({ version: 2, count: 8, mode: 'clubgg' });
  const v2Saved = await savedApplication.saveHand({
    pokerState: fixed.state,
    heroPlayerId: 'P0',
    replaySource: fixed.replaySource,
    operation: { id: 'game-rules-001c-home-v2', createdAt: T0 },
  });
  assert.equal(createHomeSavedItem(v1Saved.object).gameMode, 'home');
  assert.equal(createHomeSavedItem(v2Saved.object).gameMode, 'fixed');
  assert.equal(Object.hasOwn(v2Saved.object.payload.pokerState.game, 'mode'), false);
});

test('known Hand/Spot nested future versions fail explicitly rather than downgrading', () => {
  const hand = completeObservedV2Hand();
  const savedHand = createSavedHandSnapshot({
    pokerState: hand.state,
    heroPlayerId: 'P0',
    replaySource: hand.replaySource,
  });
  const futureHand = structuredClone(savedHand);
  futureHand.schemaVersion = 'saved-hand-snapshot/v999';
  assert.throws(() => validateSavedHandSnapshot(futureHand), /Unsupported.*v999/);

  const scenario = noRakeScenario();
  const savedSpot = createSavedSpotSnapshot({
    derivation: 'scenario',
    ...scenario,
    rulesSnapshot: snapshotFor({ count: 6 }),
  });
  const futureSpot = structuredClone(savedSpot);
  futureSpot.schemaVersion = 'saved-spot-snapshot/v999';
  assert.throws(() => validateSavedSpotSnapshot(futureSpot), /Unsupported.*v999/);
});

test('import rejects an unknown nested version atomically', async () => {
  const futureExport = JSON.parse(LEGACY_V1_LIBRARY_EXPORT_JSON);
  futureExport.objects[0].payload.schemaVersion = 'saved-hand-snapshot/v999';
  const fresh = application('future-import');
  await assert.rejects(
    fresh.importLibrary(JSON.stringify(futureExport)),
    /Unsupported SavedHandSnapshot version.*v999/,
  );
  assert.deepEqual(await fresh.listAllForSync(), []);
});

test('canonical state equality remains semantic across v2 serialization boundaries', () => {
  const original = completeObservedV2Hand();
  const restored = reconstructCanonicalHandReplaySource(
    JSON.parse(JSON.stringify(original.replaySource)),
  ).finalState;
  assert.equal(canonicalPokerStatesEqual(restored, original.state), true);
});
