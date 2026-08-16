import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import {
  ANTE_TYPES,
  CHANCE_TYPES,
  GAME_MODES,
  applyChance,
  initializeHand,
  isHiddenHoleCards,
} from '../shared/poker-domain/index.js';
import {
  REPLAY_FRAME_OPERATIONS,
  createReplayProjectionController,
} from '../app/src/application/replay-projection-controller.mjs';
import {
  createPlaybookScenarioInput,
} from '../app/src/application/playbook-state-source.mjs';
import { createSavedStudyObjectApplication } from '../app/src/application/saved-study-object-service.mjs';
import {
  createSavedStudyObjectSourceController,
  createSavedStudySourceIdentity,
} from '../app/src/application/saved-study-object-source-controller.mjs';
import {
  SAVED_SPOT_DERIVATIONS,
  SAVED_STUDY_KINDS,
  SAVED_STUDY_REVIEW_STATES,
  SAVED_STUDY_SOURCE_SURFACES,
  createMemorySavedStudyDatabase,
  createSavedStudyOwnerRef,
} from '../app/src/saved-study-objects/index.mjs';

const T0 = '2026-08-16T15:00:00.000Z';
const T1 = '2026-08-16T15:01:00.000Z';
const OWNER = createSavedStudyOwnerRef('saved-objects-002-owner');

function memoryStorage() {
  const values = new Map();
  return {
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, value) { values.set(key, String(value)); },
    removeItem(key) { values.delete(key); },
    entries() { return [...values.entries()]; },
  };
}

function handHarness() {
  let sourceId = 'hand-session-1';
  let state = initializeHand({
    handId: 'saved-objects-002-hand',
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
  return {
    replay,
    bridge: {
      getState: () => state,
      getHeroPlayerId: () => 'Hero',
      getCanonicalHandSourceId: () => sourceId,
      createCanonicalHandReplaySource: () => replay.createCanonicalHandReplaySource(),
      createReplayProjectionViewModel: () => replay.getProjection(),
    },
    setSourceId(nextSourceId) { sourceId = nextSourceId; },
  };
}

function scenario(lastActionLabel = 'Checked to Hero') {
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
    lastActionLabel,
    facingSizeBb: 0,
    rakeMode: 'off',
    forcedContributionPerPlayerBb: 0,
    totalForcedContributionBb: 0,
    anteBb: 0,
    straddleBb: 0,
  });
  const decisionContext = {
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
  return { scenarioInput, decisionContext };
}

function application(database, clock = () => T0) {
  return createSavedStudyObjectApplication({ database, ownerRef: OWNER, clock });
}

test('Hand and historical Replay share one save identity, canonical source, and observer privacy', async () => {
  const database = createMemorySavedStudyDatabase();
  const storage = memoryStorage();
  const hand = handHarness();
  hand.replay.previous();
  assert.equal(hand.replay.getProjection().readOnly, true);
  const app = application(database);
  const controller = createSavedStudyObjectSourceController({
    application: app,
    storage,
    getPlaybookBridge: () => hand.bridge,
    clock: () => T0,
  });

  const [first, rapidRepeat] = await Promise.all([
    controller.saveCurrent({ mode: 'hand' }),
    controller.saveCurrent({ mode: 'hand' }),
  ]);
  assert.equal(first.object.id, rapidRepeat.object.id);
  assert.equal(first.object.source.surface, SAVED_STUDY_SOURCE_SURFACES.REPLAY);
  assert.equal(first.object.payload.pokerState.handId, 'saved-objects-002-hand');
  assert.equal(first.object.payload.replaySource.schemaVersion, 'canonical-hand-replay-source/v1');
  assert.equal(isHiddenHoleCards(first.object.payload.pokerState.players[1].holeCards), true);
  const portableJson = JSON.stringify(first.object);
  assert.doesNotMatch(portableJson, /selectedFrame|cursor|animation|playbackState|className|innerHTML/);

  hand.replay.returnToLive();
  const liveRepeat = await controller.saveCurrent({ mode: 'hand' });
  assert.equal(liveRepeat.created, false);
  assert.equal(liveRepeat.object.id, first.object.id);
  assert.equal((await app.listByKind(SAVED_STUDY_KINDS.HAND)).length, 1);
});

test('metadata updates the same object; reload uses bounded getById; archive clears current state', async () => {
  const database = createMemorySavedStudyDatabase();
  const storage = memoryStorage();
  const hand = handHarness();
  const app = application(database);
  const controller = createSavedStudyObjectSourceController({
    application: app,
    storage,
    getPlaybookBridge: () => hand.bridge,
    clock: () => T0,
  });
  const saved = await controller.saveCurrent({ mode: 'hand' });
  const updated = await controller.updateAnnotations(saved.object.id, {
    title: '  River call  ',
    note: 'First line\nSecond line',
    tags: [' River ', 'review', 'RIVER'],
    reviewState: SAVED_STUDY_REVIEW_STATES.REVIEW_LATER,
    classifications: controller.classificationsWithMistake(saved.object, true),
  }, { expectedRevision: saved.object.revision });
  assert.equal(updated.object.id, saved.object.id);
  assert.equal(updated.object.annotations.title, 'River call');
  assert.equal(updated.object.annotations.note, 'First line\nSecond line');
  assert.deepEqual(updated.object.annotations.tags.map((tag) => tag.display), ['review', 'River']);
  assert.equal(updated.object.annotations.reviewState, SAVED_STUDY_REVIEW_STATES.REVIEW_LATER);
  assert.deepEqual(updated.object.annotations.classifications, ['mistake']);

  let getByIdCount = 0;
  const boundedApplication = {
    ...app,
    async getById(...args) { getByIdCount += 1; return app.getById(...args); },
    listRecent() { throw new Error('whole-library lookup is forbidden'); },
  };
  const reloaded = createSavedStudyObjectSourceController({
    application: boundedApplication,
    storage,
    getPlaybookBridge: () => hand.bridge,
    clock: () => T1,
  });
  const restored = await reloaded.getCurrentStatus({ mode: 'hand' });
  assert.equal(restored.state, 'saved');
  assert.equal(restored.object.annotations.note, 'First line\nSecond line');
  assert.equal(getByIdCount, 1);

  await reloaded.archiveCurrent({ mode: 'hand', expectedRevision: restored.object.revision });
  assert.equal((await reloaded.getCurrentStatus({ mode: 'hand' })).state, 'unsaved');
  assert.equal((await app.listByKind(SAVED_STUDY_KINDS.HAND)).length, 0);
});

test('a newly initialized Hand session does not inherit the prior Hand saved reference', async () => {
  const database = createMemorySavedStudyDatabase();
  const storage = memoryStorage();
  const hand = handHarness();
  const app = application(database);
  const controller = createSavedStudyObjectSourceController({
    application: app,
    storage,
    getPlaybookBridge: () => hand.bridge,
    clock: () => T0,
  });
  const first = await controller.saveCurrent({ mode: 'hand' });
  hand.setSourceId('hand-session-2');
  assert.equal((await controller.getCurrentStatus({ mode: 'hand' })).state, 'unsaved');
  const second = await controller.saveCurrent({ mode: 'hand' });
  assert.notEqual(second.object.id, first.object.id);
  assert.equal(second.object.payload.pokerState.handId, first.object.payload.pokerState.handId);
  assert.equal((await app.listByKind(SAVED_STUDY_KINDS.HAND)).length, 2);
});

test('Scenario Save Spot is stable across localized labels and remains explicitly lossy', async () => {
  const database = createMemorySavedStudyDatabase();
  const storage = memoryStorage();
  const app = application(database);
  const controller = createSavedStudyObjectSourceController({
    application: app,
    storage,
    getPlaybookBridge: () => null,
    clock: () => T0,
  });
  const english = scenario('Checked to Hero');
  const russian = scenario('До Hero сделали чек');
  assert.deepEqual(
    createSavedStudySourceIdentity({ mode: 'scenario', scenarioInput: english.scenarioInput }),
    createSavedStudySourceIdentity({ mode: 'scenario', scenarioInput: russian.scenarioInput }),
  );

  const first = await controller.saveCurrent({ mode: 'scenario', ...english });
  const repeat = await controller.saveCurrent({ mode: 'scenario', ...russian });
  assert.equal(repeat.object.id, first.object.id);
  assert.equal(first.object.payload.derivation, SAVED_SPOT_DERIVATIONS.SCENARIO);
  assert.equal(first.object.payload.truth.historyStatus, 'not_available');
  assert.equal(first.object.payload.handReference, null);
  assert.equal(first.object.payload.decisionContext.opponentCount, null);
  assert.equal(first.object.payload.decisionContext.heroStreetContributionBb, null);
  assert.doesNotMatch(JSON.stringify(first.object.payload), /actionHistory|replaySource|poker-state\/v1/);
  assert.equal((await app.listByKind(SAVED_STUDY_KINDS.SPOT)).length, 1);
});

test('repository failure is surfaced and rapid clicks never start duplicate writes', async () => {
  const storage = memoryStorage();
  const hand = handHarness();
  let saveCalls = 0;
  let releaseFailure;
  const failed = new Promise((_, reject) => { releaseFailure = () => reject(new Error('quota failed')); });
  const failingApplication = {
    async saveHand() { saveCalls += 1; return failed; },
    async saveScenarioDerivedSpot() { throw new Error('unexpected'); },
    async getById() { return null; },
  };
  const controller = createSavedStudyObjectSourceController({
    application: failingApplication,
    storage,
    getPlaybookBridge: () => hand.bridge,
    clock: () => T0,
  });
  const first = controller.saveCurrent({ mode: 'hand' });
  const second = controller.saveCurrent({ mode: 'hand' });
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(saveCalls, 1);
  releaseFailure();
  await assert.rejects(first, /quota failed/);
  await assert.rejects(second, /quota failed/);
});

test('source UX is explicit, accessible, localized, cancel-safe, and isolated from compute authorities', () => {
  const html = fs.readFileSync(new URL('../app/index.html', import.meta.url), 'utf8');
  const logic = fs.readFileSync(new URL('../app/src/core/logic.js', import.meta.url), 'utf8');
  const css = fs.readFileSync(new URL('../app/styles.css', import.meta.url), 'utf8');
  const translations = fs.readFileSync(new URL('../app/src/locales/product-translations.js', import.meta.url), 'utf8');
  const controller = fs.readFileSync(new URL('../app/src/application/saved-study-object-source-controller.mjs', import.meta.url), 'utf8');

  assert.match(html, /id="savedStudySaveButton"[\s\S]*?aria-describedby="savedStudySourceStatus"/);
  const globalWorkflow = html.match(/class="playbook-state-source"[\s\S]*?id="togglePlaybookContext"/)?.[0] || '';
  assert.doesNotMatch(globalWorkflow, /savedStudySourceActions|savedStudySaveButton/);
  assert.match(html, /id="handStateSection"[\s\S]*?id="handSavedStudyActionMount"/);
  assert.match(html, /id="handReplayControls"[\s\S]*?id="replaySavedStudyActionMount"/);
  assert.match(html, /id="sharedControls"[\s\S]*?id="scenarioSavedStudyActionMount"[\s\S]*?id="savedStudySourceActions"/);
  assert.match(logic, /function placeSavedStudySourceActions[\s\S]*?projection\?\.readOnly[\s\S]*?replaySavedStudyActionMount[\s\S]*?handSavedStudyActionMount[\s\S]*?appendChild\(actions\)/);
  assert.match(css, /\.saved-study-action-mount:empty[\s\S]*?\.saved-study-source-actions/);
  assert.match(css, /\.saved-study-source-actions \[hidden\] \{ display: none; \}/);
  assert.match(html, /id="savedStudyForm"[\s\S]*?role="dialog"[\s\S]*?aria-modal="true"/);
  assert.match(html, /savedStudyTitle[\s\S]*?savedStudyNote[\s\S]*?savedStudyTags[\s\S]*?savedStudyReviewLater[\s\S]*?savedStudyMistake/);
  assert.match(html, /id="savedStudyArchiveConfirmation"[\s\S]*?Confirm archive[\s\S]*?Keep saved item/);
  assert.match(logic, /\['savedStudyCancelButton', 'savedStudyCloseButton'\][\s\S]*?closeSavedStudyEditor/);
  assert.doesNotMatch(logic.match(/function closeSavedStudyEditor\(\)[\s\S]*?\n}/)?.[0] || '', /updateAnnotations|archiveCurrent/);
  assert.match(logic, /event\.key === 'Escape'/);
  assert.match(logic, /event\.key !== 'Tab'/);
  assert.match(css, /\[dir="rtl"\][\s\S]*?hand-seat-row|margin-inline-end/);
  for (const key of ['Save hand', 'Save spot', 'Saved', 'Edit saved item', 'Review later', 'Save changes', 'Archive failed']) {
    assert.match(translations, new RegExp(`"${key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"`, 'u'));
  }
  assert.doesNotMatch(controller, /StrategyProvider|Equity|Matrix|Training|document\.|querySelector/);
});
