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

test('source UX is explicit, accessible, localized, cancel-safe, and isolated from compute authorities', async () => {
  // TEST-HYGIENE-001: markup is parsed, styles are read through the cascade,
  // and placement / editor behaviour runs in the booted app, instead of
  // regex-matching index.html / logic.js / styles.css.
  const { appStyleSheet, bootApp, indexDocument, precedes, text } = await import('./helpers/app-under-test.mjs');
  const markup = indexDocument();
  const css = appStyleSheet();
  const app = await bootApp();
  const translations = fs.readFileSync(new URL('../app/src/locales/product-translations.js', import.meta.url), 'utf8');
  const controller = fs.readFileSync(new URL('../app/src/application/saved-study-object-source-controller.mjs', import.meta.url), 'utf8');

  assert.equal(markup.getElementById('savedStudySaveButton').getAttribute('aria-describedby'), 'savedStudySourceStatus');
  const globalWorkflow = markup.querySelector('.playbook-state-source');
  assert.equal(globalWorkflow.querySelector('#savedStudySourceActions, #savedStudySaveButton'), null);
  assert.ok(precedes(markup.getElementById('handStateSection'), markup.getElementById('handSavedStudyActionMount')));
  assert.ok(precedes(markup.getElementById('handReplayControls'), markup.getElementById('replaySavedStudyActionMount')));
  assert.ok(precedes(markup.getElementById('sharedControls'), markup.getElementById('scenarioSavedStudyActionMount')));
  assert.ok(markup.getElementById('savedStudySourceActions').parentElement === markup.getElementById('scenarioSavedStudyActionMount'));
  // The one action group moves to the mount for the current workflow.
  const actions = () => app.byId('savedStudySourceActions');
  await app.startHand(['As', 'Kd']);
  app.call('placeSavedStudySourceActions');
  assert.equal(actions().parentElement.id, 'handSavedStudyActionMount');
  app.call('placeSavedStudySourceActions', { readOnly: true, viewerContext: { kind: 'live_hand' } });
  assert.equal(actions().parentElement.id, 'replaySavedStudyActionMount');
  app.call('placeSavedStudySourceActions', { readOnly: true, viewerContext: { kind: 'saved_hand' } });
  assert.equal(actions().hidden, true, 'a saved-hand viewer offers no save action');
  await app.call('requestPlaybookMode', 'scenario');
  await app.settle(200);
  app.call('placeSavedStudySourceActions');
  assert.equal(actions().parentElement.id, 'scenarioSavedStudyActionMount');
  assert.equal(actions().hidden, false);
  // Empty mounts collapse; hidden actions inside the group stay hidden.
  const emptyMount = markup.getElementById('handSavedStudyActionMount');
  assert.equal(emptyMount.children.length, 0);
  assert.equal(css.cascaded(emptyMount, 'display'), 'none');
  const hiddenAction = markup.querySelector('#savedStudySourceActions [hidden]');
  assert.ok(hiddenAction);
  assert.equal(css.cascaded(hiddenAction, 'display'), 'none');
  // The editor is an accessible modal dialog with fields in reading order and
  // an explicit archive confirmation.
  const form = markup.getElementById('savedStudyForm');
  assert.equal(form.getAttribute('role'), 'dialog');
  assert.equal(form.getAttribute('aria-modal'), 'true');
  const fields = ['savedStudyTitle', 'savedStudyNote', 'savedStudyTags', 'savedStudyReviewLater', 'savedStudyMistake'].map((id) => markup.getElementById(id));
  fields.slice(1).forEach((field, index) => assert.ok(precedes(fields[index], field), field.id));
  const confirmation = markup.getElementById('savedStudyArchiveConfirmation');
  assert.match(text(confirmation), /Confirm archive[\s\S]*Keep saved item/);
  // Cancel, Close and Escape close the editor without writing; Tab is trapped.
  const bridge = app.window.callSavedStudyBridge;
  const writes = [];
  app.window.callSavedStudyBridge = async (method, ...args) => { writes.push(method); return null; };
  const object = { id: 'saved-ux', kind: 'spot', revision: 1, lifecycle: { state: 'active' }, source: {}, payload: {},
    annotations: { title: 'Saved', note: '', tags: [], reviewState: 'none', classifications: [] } };
  const modal = app.byId('savedStudyModal');
  try {
    for (const close of [
      () => app.click('#savedStudyCancelButton'),
      () => app.click('#savedStudyCloseButton'),
      () => app.key(modal, 'Escape'),
    ]) {
      app.call('openSavedStudyEditor', object);
      assert.equal(modal.hidden, false);
      await close();
      await app.settle(50);
      assert.equal(modal.hidden, true);
    }
    assert.deepEqual(writes.filter((method) => /updateAnnotations|archiveCurrent/.test(method)), []);
    app.call('openSavedStudyEditor', object);
    await app.settle(100);
    const focusable = app.call('savedStudyDialogFocusableElements');
    const active = () => app.document.activeElement?.id;
    focusable.at(-1).focus();
    await app.key(modal, 'Tab');
    assert.equal(active(), focusable[0].id, 'Tab wraps to the first control');
    focusable[0].focus();
    await app.key(modal, 'Tab', { shiftKey: true });
    assert.equal(active(), focusable.at(-1).id, 'Shift+Tab wraps to the last control');
    app.call('closeSavedStudyEditor');
  } finally {
    app.window.callSavedStudyBridge = bridge;
  }
  // RTL mirrors the actor marker with logical sides.
  const row = markup.createElement('div');
  row.className = 'hand-seat-row is-actor';
  markup.getElementById('handSeatList').appendChild(row);
  const ltrShadow = css.cascaded(row, 'box-shadow');
  markup.documentElement.setAttribute('dir', 'rtl');
  try {
    assert.notEqual(css.cascaded(row, 'box-shadow'), ltrShadow);
  } finally {
    markup.documentElement.removeAttribute('dir');
    row.remove();
  }
  for (const key of ['Save hand', 'Save spot', 'Saved', 'Edit saved item', 'Review later', 'Save changes', 'Archive failed']) {
    assert.match(translations, new RegExp(`"${key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"`, 'u'));
  }
  assert.doesNotMatch(controller, /StrategyProvider|Equity|Matrix|Training|document\.|querySelector/);
});
