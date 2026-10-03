import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import {
  ACTION_TYPES,
  ANTE_TYPES,
  GAME_MODES,
  createGameRulesSnapshotFromLegacyGameConfiguration,
} from '../shared/poker-domain/index.js';
import {
  RIVERLINE_IDENTITY_KINDS,
  createRiverlineIdentity,
  riverlineOwnershipRefForIdentity,
} from '../app/src/account-identity/domain.mjs';
import {
  TRAINING_DECISION_TYPES,
  createTrainingConfigFromLegacyCompatibility,
  generateTrainingExercise,
} from '../app/src/application/training-generator.mjs';
import { evaluateTrainingAnswer } from '../app/src/application/training-answer-evaluation.mjs';
import { createStrategyProvider } from '../app/src/application/strategy-provider.mjs';
import { STRATEGY_SOURCES } from '../app/src/application/strategy-result.mjs';
import {
  FULL_HAND_TRAINING_STATUSES,
  createFullHandTrainingSessionController,
} from '../app/src/application/full-hand-training-session-controller.mjs';
import { createTrainingMemoryService } from '../app/src/application/training-memory-service.mjs';
import { createTrainingMemoryPresentationGate } from '../app/src/application/training-memory-presentation.mjs';
import { createMemoryTrainingMemoryDatabase } from '../app/src/training-memory/indexeddb-storage.mjs';
import { createSavedStudyObjectApplication } from '../app/src/application/saved-study-object-service.mjs';
import { createMemorySavedStudyDatabase } from '../app/src/saved-study-objects/indexeddb-storage.mjs';
import { createSavedStudyOwnerRef, validateSavedStudyObject } from '../app/src/saved-study-objects/index.mjs';
import {
  SAVED_TRAINING_HISTORY_LIMIT,
  SAVED_TRAINING_HISTORY_SOURCE_LABELS,
  buildSavedTrainingHistorySpotInput,
  savedTrainingHistorySourceLabelKey,
  createSavedTrainingHistoryView,
  partitionSavedTrainingHistory,
  projectSavedTrainingHistoryItem,
  savedTrainingHistorySpotObjectId,
} from '../app/src/application/saved-training-history.mjs';
import {
  formatTrainingMemoryDate,
  trainingMemoryContextSummary,
  trainingMemoryModeLabelKey,
} from '../app/src/application/training-memory-row-format.mjs';
import { mountSavedTrainingHistory } from '../app/src/application/saved-training-history-workspace.mjs';
import { createFakeDom, descendants } from './fixtures/saved-library-fake-dom.mjs';

const [projectionSource, workspaceSource, formatSource, logic, html] = await Promise.all([
  readFile(new URL('../app/src/application/saved-training-history.mjs', import.meta.url), 'utf8'),
  readFile(new URL('../app/src/application/saved-training-history-workspace.mjs', import.meta.url), 'utf8'),
  readFile(new URL('../app/src/application/training-memory-row-format.mjs', import.meta.url), 'utf8'),
  readFile(new URL('../app/src/core/logic.js', import.meta.url), 'utf8'),
  readFile(new URL('../app/index.html', import.meta.url), 'utf8'),
]);

// ---------------------------------------------------------------- fixtures

function clock(start = '2026-09-20T08:00:00.000Z') {
  let tick = Date.parse(start);
  return () => new Date(tick += 1000);
}

function identity(identityId = 'history-player') {
  return createRiverlineIdentity({
    identityId,
    kind: RIVERLINE_IDENTITY_KINDS.LOCAL,
    displayName: identityId,
    localDeviceIdentityId: 'history-device',
    createdAt: '2026-08-01T00:00:00.000Z',
  });
}

function ownerProvider(activeIdentity) {
  const snapshot = Object.freeze({
    authStatus: 'signed_in',
    generation: 0,
    ownerRef: riverlineOwnershipRefForIdentity(activeIdentity),
  });
  return Object.freeze({
    async capture() { return snapshot; },
    assertCurrent(candidate) {
      if (candidate !== snapshot) throw new Error('Unexpected Training Memory owner snapshot');
      return candidate;
    },
  });
}

function strategyProvider() {
  return createStrategyProvider({
    fallbackResolver(context) {
      const passive = context.facingSizeBb > 0 ? ACTION_TYPES.CALL : ACTION_TYPES.CHECK;
      const aggressive = context.street === 'preflop' || context.facingSizeBb > 0 ? ACTION_TYPES.RAISE : ACTION_TYPES.BET;
      return {
        source: context.street === 'preflop' ? STRATEGY_SOURCES.HEURISTIC_PREFLOP : STRATEGY_SOURCES.HEURISTIC_POSTFLOP,
        modelVersion: 'history-fixture/v1',
        actions: [
          { action: { type: ACTION_TYPES.FOLD }, label: 'Fold', probability: 0.05 },
          { action: { type: passive }, label: passive, probability: 0.25 },
          { action: { type: aggressive }, label: aggressive, probability: 0.60 },
          { action: { type: ACTION_TYPES.ALL_IN }, label: 'All-in', probability: 0.10 },
        ],
        details: { decisionRole: context.street === 'preflop' ? 'rfi' : 'postflop_response' },
      };
    },
  });
}

function exercise(seed) {
  const result = generateTrainingExercise(createTrainingConfigFromLegacyCompatibility({
    tableSize: 6, stackBb: 100, streets: ['preflop'], gameMode: GAME_MODES.HOME, heroPositions: ['BTN'],
    allowedDecisionTypes: [TRAINING_DECISION_TYPES.PREFLOP_UNOPENED], difficulty: 'hard', seed,
  }), { strategyProvider: strategyProvider() });
  assert.equal(result.ok, true, result.error?.message);
  return result.exercise;
}

function memoryFixture(owner = identity(), database = createMemoryTrainingMemoryDatabase()) {
  let sequence = 0;
  const service = createTrainingMemoryService({
    ownerProvider: ownerProvider(owner),
    database,
    clock: clock(),
    idFactory: (kind) => `${owner.identityId}-${kind}-${++sequence}`,
  });
  return { service, database };
}

async function answerGenerated(service, { mode = 'focused', seed = 11, uncertain = false, actionType = ACTION_TYPES.FOLD } = {}) {
  const current = exercise(seed);
  const session = await service.startSession({ mode, requestedLength: 1, sessionSeed: seed });
  const shown = await service.recordExerciseShown({ sessionId: session.id, exercise: current });
  const answered = await service.recordExerciseAnswered({
    recordId: shown.id,
    evaluation: evaluateTrainingAnswer({ exerciseId: current.id, chosenActionType: actionType,
      strategyResult: current.strategyResult, decisionContext: current.decisionContext }),
    strategyResult: current.strategyResult,
    actionType,
    uncertainty: uncertain ? { value: 'uncertain', phase: 'before_reveal', capturedAt: '2026-09-20T07:00:00.000Z' } : null,
  });
  await service.finishSession(session.id, 'completed');
  return { session, answered };
}

function fullHandConfiguration() {
  return {
    handId: 'history-full-hand',
    rulesSnapshot: createGameRulesSnapshotFromLegacyGameConfiguration({
      mode: GAME_MODES.HOME, smallBlindMilliBb: 500, bigBlindMilliBb: 1000, chipUnitMilliBb: 100,
      ante: { type: ANTE_TYPES.NONE, amountMilliBb: 0 },
    }, 2),
    buttonSeat: 0,
    players: [
      { playerId: 'Hero', seat: 0, startingStackMilliBb: 20_000 },
      { playerId: 'Villain', seat: 1, startingStackMilliBb: 20_000 },
    ],
  };
}

// Answers the first Hero decision of a Full Hand and leaves its Memory session active.
async function answerFullHand(service, { finish = false } = {}) {
  const controller = createFullHandTrainingSessionController();
  const started = controller.start({ handSeed: 707, heroPosition: 'BTN', handConfiguration: fullHandConfiguration(),
    decisionContextOptions: { stackMode: 'hero' } }, { strategyProvider: strategyProvider() });
  assert.equal(started.ok, true);
  const session = await service.startSession({ mode: 'full_hand', sessionSeed: 707 });
  const snapshot = started.snapshot;
  assert.equal(snapshot.status, FULL_HAND_TRAINING_STATUSES.AWAITING_HERO);
  const shown = await service.recordFullHandDecisionShown({ sessionId: session.id, decision: snapshot.currentDecision,
    replaySource: snapshot.replaySource, handSeed: snapshot.handSeed });
  const spec = snapshot.currentDecision.legalActions;
  const action = spec.check.available ? { type: ACTION_TYPES.CHECK, amountToMilliBb: null }
    : spec.call.available ? { type: ACTION_TYPES.CALL, amountToMilliBb: null } : { type: ACTION_TYPES.FOLD, amountToMilliBb: null };
  const result = await controller.answer(snapshot.currentDecision.decisionId, action);
  assert.equal(result.ok, true, result.error?.message);
  const answered = await service.recordFullHandDecisionAnswered({ recordId: shown.id, decision: result.decision,
    replaySource: result.snapshot.replaySource, handSeed: result.snapshot.handSeed });
  if (finish) {
    await service.finishSession(session.id, 'completed', { fullHandSource: {
      handId: result.snapshot.state.handId, heroPlayerId: result.snapshot.heroPlayerId,
      replaySource: result.snapshot.replaySource } });
  }
  return { session, answered };
}

function storeSnapshot(database) {
  return JSON.stringify(['metadata', 'sessions', 'decisions'].map((name) => database.inspectStore(name)));
}

// ---------------------------------------------------------------- Training Memory read method

test('owner-scoped answered history returns answered decisions only, newest first, with their sessions', async () => {
  const { service, database } = memoryFixture();
  const first = await answerGenerated(service, { mode: 'varied', seed: 11 });
  const second = await answerGenerated(service, { mode: 'focused', seed: 12 });
  const unansweredSession = await service.startSession({ mode: 'varied', requestedLength: 1, sessionSeed: 13 });
  await service.recordExerciseShown({ sessionId: unansweredSession.id, exercise: exercise(13) });
  const third = await answerGenerated(service, { mode: 'focused', seed: 14 });

  const page = await service.listRecentAnsweredDecisions({ limit: SAVED_TRAINING_HISTORY_LIMIT });
  assert.equal(page.schemaVersion, 'training-answered-history-page/v1');
  assert.deepEqual(page.decisions.map((record) => record.id), [third.answered.id, second.answered.id, first.answered.id]);
  assert.equal(page.decisions.every((record) => record.status === 'answered'), true);
  assert.deepEqual(new Set(page.sessions.map((session) => session.id)),
    new Set([first.session.id, second.session.id, third.session.id]));
  assert.equal(page.bounded, false);
  assert.deepEqual(page.decisions[0], third.answered, 'records are returned unchanged');

  const limited = await service.listRecentAnsweredDecisions({ limit: 2 });
  assert.deepEqual(limited.decisions.map((record) => record.id), [third.answered.id, second.answered.id]);
  assert.equal(limited.bounded, true, 'the bound is disclosed when more answered history may exist');
  await assert.rejects(service.listRecentAnsweredDecisions({ limit: 201 }), /limit/);

  const other = memoryFixture(identity('other-player'), database);
  const otherPage = await other.service.listRecentAnsweredDecisions({ limit: 200 });
  assert.deepEqual(otherPage.decisions, [], 'another owner never sees this history');
  assert.deepEqual(otherPage.sessions, []);
});

test('browsing history and preparing detail/Save state never writes Training Memory', async () => {
  const { service, database } = memoryFixture();
  const { answered } = await answerGenerated(service, { uncertain: true });
  await answerFullHand(service);
  const before = storeSnapshot(database);
  const writesBefore = database.getMetrics().readwrite;

  const page = await service.listRecentAnsweredDecisions({ limit: 200 });
  const items = partitionSavedTrainingHistory(page.decisions, page.sessions).visible.map(projectSavedTrainingHistoryItem);
  createSavedTrainingHistoryView({ items, query: { mode: 'focused', unsureOnly: true, queuedOnly: false } });
  await service.getDecision(answered.id);
  await service.createSameSpot(answered.id);

  assert.equal(database.getMetrics().readwrite, writesBefore, 'no repository write transaction');
  assert.equal(storeSnapshot(database), before, 'stats, review state, revisit scheduling and records are unchanged');
});

// ---------------------------------------------------------------- projection, embargo, filters

test('items reuse frozen facts: mode, Unsure, review/revisit state and the historical source', async () => {
  const { service } = memoryFixture();
  const plain = await answerGenerated(service, { mode: 'varied', seed: 21 });
  const unsure = await answerGenerated(service, { mode: 'focused', seed: 22, uncertain: true });
  const revisit = await answerGenerated(service, { mode: 'focused', seed: 23, uncertain: true });
  await service.requestUncertainRevisit(revisit.answered.id);
  const queued = await answerGenerated(service, { mode: 'varied', seed: 24 });
  await service.updateStudyMetadata(queued.answered.id, { review: true });
  const reviewed = await answerGenerated(service, { mode: 'varied', seed: 25 });
  await service.updateStudyMetadata(reviewed.answered.id, { review: true });
  await service.markReviewed(reviewed.answered.id);

  const page = await service.listRecentAnsweredDecisions({ limit: 200 });
  const byId = new Map(page.decisions.map((record) => [record.id, projectSavedTrainingHistoryItem(record)]));
  const item = (fixture) => byId.get(fixture.answered.id);

  assert.equal(item(plain).mode, 'varied');
  assert.equal(item(plain).unsure, false);
  assert.equal(item(plain).review.kind, 'none');
  assert.equal(item(plain).action.type, ACTION_TYPES.FOLD);
  assert.deepEqual(item(plain).source, { id: plain.answered.strategyEvidence.strategyResult.source,
    version: plain.answered.strategyEvidence.strategyResult.sourceVersion });
  assert.equal(item(unsure).unsure, true);
  assert.equal(item(unsure).queued, false, 'Unsure alone does not queue a decision');
  assert.equal(item(revisit).review.kind, 'revisit');
  assert.ok(item(revisit).review.dueAt);
  assert.equal(item(revisit).queued, true);
  assert.equal(item(queued).review.kind, 'queued');
  assert.equal(item(reviewed).review.kind, 'reviewed');
  assert.equal(item(reviewed).queued, false);
  for (const projected of byId.values()) {
    assert.equal(Object.hasOwn(projected, 'correct'), false);
    assert.equal(Object.hasOwn(projected, 'accuracy'), false);
    assert.equal(projected.record, page.decisions.find((record) => record.id === projected.id), 'frozen record kept by reference');
  }
  assert.throws(() => projectSavedTrainingHistoryItem({ ...plain.answered, status: 'shown' }), /answered/);
});

test('the existing presentation gate withholds an active Full Hand and releases it once finished', async () => {
  const { service } = memoryFixture();
  const generated = await answerGenerated(service, { mode: 'varied', seed: 31 });
  const hand = await answerFullHand(service);

  let page = await service.listRecentAnsweredDecisions({ limit: 200 });
  let partition = partitionSavedTrainingHistory(page.decisions, page.sessions);
  assert.deepEqual(partition.visible.map((record) => record.id), [generated.answered.id]);
  assert.equal(partition.withheldCount, 1);
  let view = createSavedTrainingHistoryView({ items: partition.visible.map(projectSavedTrainingHistoryItem),
    withheldCount: partition.withheldCount });
  assert.equal(view.withheldCount, 1);
  assert.equal(view.counts.full_hand, 0, 'withheld decisions never enter counts');

  // The same gate the Training Memory panel uses may unlock the active Hand's Review.
  const unlocked = partitionSavedTrainingHistory(page.decisions, page.sessions,
    (session) => createTrainingMemoryPresentationGate(session, { fullHandReviewUnlocked: true }));
  assert.equal(unlocked.withheldCount, 0);

  const onlyHand = createSavedTrainingHistoryView({ items: [], withheldCount: 1 });
  assert.equal(onlyHand.status, 'withheld_only');
  const missingSession = partitionSavedTrainingHistory([hand.answered], []);
  assert.equal(missingSession.withheldCount, 1, 'an unproven Full Hand stays withheld');

  await service.finishSession(hand.session.id, 'completed');
  page = await service.listRecentAnsweredDecisions({ limit: 200 });
  partition = partitionSavedTrainingHistory(page.decisions, page.sessions);
  assert.equal(partition.withheldCount, 0);
  view = createSavedTrainingHistoryView({ items: partition.visible.map(projectSavedTrainingHistoryItem) });
  assert.equal(view.counts.full_hand, 1);
  assert.equal(view.results[0].id, hand.answered.id, 'most recently answered first');
});

function syntheticItem(id, { mode = 'varied', answeredAt, unsure = false, queued = false } = {}) {
  return { id, mode, answeredAt, shownAt: answeredAt, unsure, queued, review: { kind: queued ? 'queued' : 'none' } };
}

test('mode, Unsure and queued filters combine; counts follow the exact-versus-bounded rule', () => {
  const items = [
    syntheticItem('a', { mode: 'varied', answeredAt: '2026-09-20T10:00:00.000Z', unsure: true }),
    syntheticItem('b', { mode: 'focused', answeredAt: '2026-09-20T12:00:00.000Z', queued: true }),
    syntheticItem('c', { mode: 'full_hand', answeredAt: '2026-09-20T11:00:00.000Z', unsure: false, queued: true }),
    syntheticItem('d', { mode: 'focused', answeredAt: '2026-09-20T12:00:00.000Z', unsure: true, queued: true }),
  ];
  const all = createSavedTrainingHistoryView({ items });
  assert.deepEqual(all.results.map((item) => item.id), ['b', 'd', 'c', 'a'], 'answered desc, stable ID tie-break');
  assert.deepEqual({ ...all.counts }, { all: 4, varied: 1, focused: 2, full_hand: 1, unsure: 2, queued: 3 });
  assert.equal(all.countScope, 'history');
  assert.equal(all.filtered, false);
  assert.deepEqual(createSavedTrainingHistoryView({ items, query: { mode: 'focused', unsureOnly: true } }).results.map((item) => item.id), ['d']);
  assert.deepEqual(createSavedTrainingHistoryView({ items, query: { queuedOnly: true } }).results.map((item) => item.id), ['b', 'd', 'c']);
  const none = createSavedTrainingHistoryView({ items, query: { mode: 'varied', queuedOnly: true } });
  assert.equal(none.status, 'no_results');
  assert.equal(none.filtered, true);
  assert.equal(createSavedTrainingHistoryView({ items: [] }).status, 'empty');
  const bounded = createSavedTrainingHistoryView({ items, bounded: true });
  assert.equal(bounded.countScope, 'shown');
  assert.equal(createSavedTrainingHistoryView({ items, query: { mode: 'bogus' } }).query.mode, 'all');
});

test('historical source labels map frozen built-in sources and never upgrade authority', async () => {
  const L = SAVED_TRAINING_HISTORY_SOURCE_LABELS;
  const descriptor = (family, extra = {}) => ({ family, authority: 'exploratory', displayName: 'Heuristic fallback', ...extra });
  assert.equal(savedTrainingHistorySourceLabelKey({ source: 'heuristic_preflop', sourceDescriptor: descriptor('heuristic') }), L.heuristic_preflop);
  assert.equal(savedTrainingHistorySourceLabelKey({ source: 'heuristic_postflop', sourceDescriptor: descriptor('heuristic') }), L.heuristic_postflop);
  assert.equal(savedTrainingHistorySourceLabelKey({ source: 'heuristic_preflop' }), L.heuristic_preflop, 'older records without a descriptor');
  assert.equal(savedTrainingHistorySourceLabelKey({ source: 'equity_fallback', sourceDescriptor: descriptor('equity') }), L.equity_fallback);
  assert.equal(savedTrainingHistorySourceLabelKey({ source: 'unavailable' }), L.unavailable);
  assert.equal(savedTrainingHistorySourceLabelKey(null), L.unavailable);
  // Unknown sources get a neutral fallback, whatever they declare about themselves.
  assert.equal(savedTrainingHistorySourceLabelKey({ source: 'solver.pack.x', sourceDescriptor: descriptor('reference_pack',
    { authority: 'validated_reference', displayName: 'Solved GTO reference' }) }), L.other);
  // A built-in id with a contradicting frozen family is not given the built-in name.
  assert.equal(savedTrainingHistorySourceLabelKey({ source: 'heuristic_preflop', sourceDescriptor: descriptor('reference_pack') }), L.other);
  // Declared authority or display name never changes the label.
  assert.equal(savedTrainingHistorySourceLabelKey({ source: 'heuristic_postflop', sourceDescriptor: descriptor('heuristic',
    { authority: 'normative', displayName: 'Validated solver' }) }), L.heuristic_postflop);
  for (const key of Object.values(L)) {
    assert.match(key, /at the time/);
    assert.doesNotMatch(key, /GTO|solver|solved|optimal|correct|validated|reference/i);
  }
  const translations = await readFile(new URL('../app/src/locales/home-translations.js', import.meta.url), 'utf8');
  for (const key of Object.values(L)) {
    const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    assert.equal((translations.match(new RegExp(`'${escaped}':`, 'g')) ?? []).length, 2, `RU and HE translate "${key}"`);
  }
  const { service } = memoryFixture();
  const { answered } = await answerGenerated(service, { seed: 61 });
  const item = projectSavedTrainingHistoryItem(answered);
  assert.equal(item.sourceLabelKey, L.heuristic_preflop);
  assert.deepEqual(item.heroCards, answered.decisionContext.heroCards);
  assert.deepEqual(item.board, answered.decisionContext.board);
});

// ---------------------------------------------------------------- Save as Spot

async function savedFixture() {
  const application = createSavedStudyObjectApplication({
    ownerRef: createSavedStudyOwnerRef('history-saved-owner'),
    database: createMemorySavedStudyDatabase(),
    clock: () => new Date('2026-09-21T09:00:00.000Z'),
  });
  return application;
}

test('Save as Spot builds a valid Saved Spot from the canonical decision with Training source identity', async () => {
  const { service } = memoryFixture();
  const generated = await answerGenerated(service, { seed: 41 });
  const hand = await answerFullHand(service, { finish: true });
  const saved = await savedFixture();

  for (const record of [generated.answered, hand.answered]) {
    const same = await service.createSameSpot(record.id);
    const input = buildSavedTrainingHistorySpotInput(record, same.exercise.pokerState);
    const objectId = await savedTrainingHistorySpotObjectId(record.id);
    assert.equal(objectId, await savedTrainingHistorySpotObjectId(record.id), 'stable per decision');
    assert.match(objectId, /^training-spot-[0-9a-f]{64}$/);
    const result = await saved.saveHandDerivedSpot({ ...input, operation: { id: objectId } });
    validateSavedStudyObject(result.object);
    assert.equal(result.object.id, objectId);
    assert.equal(result.object.kind, 'spot');
    assert.equal(result.object.source.surface, 'training');
    assert.equal(result.object.source.sourceId, `training-memory:${record.id}`);
    assert.equal(result.object.payload.derivation, 'hand');
    assert.deepEqual(result.object.payload.decisionContext.heroCards, record.decisionContext.heroCards);
    assert.deepEqual(result.object.payload.decisionContext.board, record.decisionContext.board);
    assert.equal(result.object.payload.decisionContext.heroPosition, record.decisionContext.heroPosition);
    assert.equal(JSON.stringify(result.object).includes('holeCards'), false, 'no opponent private cards are copied');
  }
  const listed = await saved.listRecent({ limit: 10 });
  assert.equal(listed.length, 2);
  assert.throws(() => buildSavedTrainingHistorySpotInput({ ...generated.answered, status: 'shown' }, {}), /answered/);
  assert.throws(() => buildSavedTrainingHistorySpotInput(generated.answered, null), /canonical state/);
});

// ---------------------------------------------------------------- controller

const settle = () => new Promise((resolve) => setImmediate(resolve));
// Web Crypto digests resolve off the microtask queue; wait for the observable state.
async function until(predicate, label = 'condition') {
  for (let attempt = 0; attempt < 200; attempt += 1) {
    if (predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 2));
  }
  assert.fail(`Timed out waiting for ${label}`);
}
const interpolate = (key, parameters) => (parameters
  ? key.replace(/\{(\w+)\}/g, (_, name) => String(parameters[name]))
  : key);

function mountHistory({ page = { decisions: [], sessions: [], bounded: false }, listRecentAnsweredDecisions,
  createSameSpot, captureScope, existingSaved = null } = {}) {
  const dom = createFakeDom();
  const section = dom.document.createElement('section');
  const controls = dom.document.createElement('div');
  controls.setAttribute('data-saved-library-controls', '');
  const body = dom.document.createElement('div');
  body.setAttribute('data-saved-library-body', '');
  section.append(controls, body);
  dom.document.body.append(section);
  const calls = { list: 0, sameSpot: [], getById: [], save: [], redrill: [], navigate: [], library: [] };
  const errors = [];
  const memory = {
    listRecentAnsweredDecisions: listRecentAnsweredDecisions ?? (async (options) => {
      calls.list += 1;
      assert.equal(options.limit, SAVED_TRAINING_HISTORY_LIMIT);
      return page;
    }),
    createSameSpot: createSameSpot ?? (async (id) => {
      calls.sameSpot.push(id);
      return { exercise: { pokerState: { fixture: id } } };
    }),
  };
  const savedObjects = new Map(existingSaved ? [[existingSaved.id, existingSaved]] : []);
  const savedService = {
    async getById(id) { calls.getById.push(id); return savedObjects.get(id) ?? null; },
    async saveHandDerivedSpot(input) {
      calls.save.push(input);
      const object = { id: input.operation.id, lifecycle: { state: 'active' } };
      savedObjects.set(object.id, object);
      return { object };
    },
  };
  const library = {
    show() { calls.library.push('show'); },
    hide() { calls.library.push('hide'); },
  };
  const baseListeners = dom.listenerCount();
  const controller = mountSavedTrainingHistory(section, {
    library,
    getTrainingMemory: () => memory,
    savedService,
    captureScope,
    translate: interpolate,
    locale: () => 'en',
    actionLabel: (record) => record.userResponse.action.type,
    openRedrill: (id, kind) => calls.redrill.push([id, kind]),
    navigate: (destination) => calls.navigate.push(destination),
    reportError: (error) => errors.push(error),
  });
  const find = (selector) => section.querySelector(selector);
  const selectView = (value) => {
    const input = section.querySelectorAll('[data-saved-view-option]').find((node) => node.value === value);
    section.querySelectorAll('[data-saved-view-option]').forEach((node) => { node.checked = node === input; });
    dom.dispatch(input, 'change');
  };
  const listIds = () => section.querySelectorAll('[data-training-history-id]').map((node) => node.dataset.trainingHistoryId);
  const text = () => descendants(section).map((node) => node.textContent).join('\n');
  return { dom, section, controls, body, controller, calls, errors, find, selectView, listIds, text, baseListeners };
}

async function seededPage() {
  const { service } = memoryFixture();
  const varied = await answerGenerated(service, { mode: 'varied', seed: 51, uncertain: false });
  const focused = await answerGenerated(service, { mode: 'focused', seed: 52, uncertain: true });
  const activeHand = await answerFullHand(service);
  const page = await service.listRecentAnsweredDecisions({ limit: SAVED_TRAINING_HISTORY_LIMIT });
  return { page, varied, focused, activeHand, service };
}

test('Training history never loads at mount, on Saved items, or while hidden; each show of the view reloads', async () => {
  const { page } = await seededPage();
  const f = mountHistory({ page });
  assert.equal(f.calls.list, 0, 'no startup load');
  assert.equal(f.find('[data-saved-training-history]').hidden, true);
  f.controller.show();
  await settle();
  assert.equal(f.calls.list, 0, 'Saved items is the default view');
  assert.deepEqual(f.calls.library, ['show']);
  assert.equal(f.controller.getState().view, 'items');

  f.selectView('training');
  await settle();
  assert.equal(f.calls.list, 1);
  assert.equal(f.controls.hidden, true, 'library search and filters are hidden in this view');
  assert.equal(f.body.hidden, true);
  assert.equal(f.find('[data-saved-training-history]').hidden, false);
  assert.equal(f.calls.library.at(-1), 'hide');

  f.controller.hide();
  f.controller.invalidate();
  await settle();
  assert.equal(f.dom.pendingTimers(), 0, 'hidden invalidation schedules nothing');
  assert.equal(f.calls.list, 1);
  f.controller.show();
  await settle();
  assert.equal(f.calls.list, 2, 'no Training Memory change signal exists, so each show reloads');
  assert.equal(f.controller.getState().view, 'training', 'selection persists within the owner session');

  f.selectView('items');
  await settle();
  assert.equal(f.calls.library.at(-1), 'show');
  assert.equal(f.controls.hidden, false);
  assert.equal(f.calls.list, 2);
});

test('rendered history shows frozen facts, the local-only note and the Full Hand embargo note without leaking it', async () => {
  const { page, varied, focused, activeHand } = await seededPage();
  const f = mountHistory({ page });
  f.controller.show();
  f.selectView('training');
  await settle();
  assert.deepEqual(f.listIds(), [focused.answered.id, varied.answered.id]);
  assert.equal(f.listIds().includes(activeHand.answered.id), false);
  const text = f.text();
  assert.match(text, /Training history is stored on this device and is not synced to your account\./);
  assert.match(text, /Decisions from your unfinished Full Hand appear here after that Hand finishes\./);
  assert.equal(f.find('[data-training-history-withheld]').hidden, false);
  assert.match(text, /Marked Unsure/);
  assert.match(text, /Chosen action: fold/);
  assert.match(text, /Riverline heuristic guidance, preflop, at the time/);
  assert.doesNotMatch(text, /correct|accuracy|mastery|\bEV\b/i);
  const card = f.section.querySelectorAll('[data-training-history-id]')[0];
  assert.doesNotMatch(card.textContent, /heuristic_preflop|@riverline-/, 'no raw source id@version on cards');
  // SAVED-COMPOSITION-002 / QA-DECISION-INPUT-009: Saved words the price through the
  // decision-facing summary instead of "Facing N bb".
  const summary = trainingMemoryContextSummary(focused.answered.decisionContext, interpolate, { facing: 'summary' });
  const factSpans = descendants(card).filter((node) => node.className === 'saved-training-fact');
  const separators = descendants(card).filter((node) => node.className === 'saved-training-fact-separator');
  assert.equal(separators.length, summary.spotParts.length - 1);
  assert.ok(separators.every((node) => node.getAttribute('aria-hidden') === 'true'), 'separators are decorative');
  assert.deepEqual(factSpans.map((node) => node.textContent), [...summary.spotParts], 'reuses the Memory row formatter facts');
  assert.ok(factSpans.every((node) => node.dir === 'auto'), 'each fact is its own bidi-isolated span');
  // Same shared card-tile component as Saved items: preview first (left), copy second.
  // Retargeted by SAVED-COMPOSITION-002: dense rows use the row variant inside a cards cell.
  const [cardsCell, copy] = card.children;
  const preview = cardsCell.children[0];
  assert.match(preview.className, /saved-poker-preview saved-poker-preview--row/);
  assert.match(copy.className, /saved-library-item-copy/);
  assert.match(card.className, /saved-library-item/);
  const tiles = preview.querySelectorAll('[data-card-size]').map((node) => node.getAttribute('aria-label'));
  assert.deepEqual(tiles, [...focused.answered.decisionContext.heroCards, ...focused.answered.decisionContext.board]);
  assert.match(preview.textContent, /No board cards/, 'a preflop spot uses the existing empty-board style');
  f.dom.dispatch(card, 'click');
  const detailPreview = f.section.querySelectorAll('[data-saved-preview-kind]').at(-1);
  assert.match(detailPreview.className, /saved-poker-preview--detail/);
  assert.match(f.text(), /Technical source: heuristic_preflop@riverline-preflop-heuristic\/v4/, 'id@version in detail only');
  assert.equal(f.find('[data-training-history-count="full_hand"]').textContent, '0');
  assert.equal(f.find('[data-training-history-count="all"]').textContent, '2');
  assert.equal(f.find('[data-training-history-bound]').hidden, true, 'exact counts below the bound');
  assert.equal(f.section.querySelectorAll('[data-saved-view-option]').length, 2, 'one two-option control');
});

test('filters narrow the view, no-results offers Clear, and Clear restores everything', async () => {
  const { page, varied, focused } = await seededPage();
  const f = mountHistory({ page });
  f.controller.show();
  f.selectView('training');
  await settle();
  f.dom.dispatch(f.find('[data-training-history-mode="varied"]'), 'click');
  assert.deepEqual(f.listIds(), [varied.answered.id]);
  f.dom.dispatch(f.find('[data-training-history-mode="all"]'), 'click');
  // SAVED-COMPOSITION-002: Unsure and review-queue filters are toggle chips.
  const unsure = f.find('[data-training-history-unsure]');
  f.dom.dispatch(unsure, 'click');
  assert.equal(unsure.getAttribute('aria-pressed'), 'true');
  assert.deepEqual(f.listIds(), [focused.answered.id]);
  const queued = f.find('[data-training-history-queued]');
  f.dom.dispatch(queued, 'click');
  assert.deepEqual(f.listIds(), []);
  assert.equal(f.find('[data-training-history-list]').dataset.trainingHistoryState, 'no_results');
  const clears = f.section.querySelectorAll('[data-training-history-clear]');
  assert.equal(clears.length, 2, 'toolbar Clear plus the no-results Clear');
  f.dom.dispatch(clears[1], 'click');
  assert.deepEqual(f.listIds(), [focused.answered.id, varied.answered.id]);
  assert.equal(f.controller.getState().query.unsureOnly, false);
  assert.equal(f.find('[data-training-history-clear]').disabled, true);
  assert.equal(f.calls.list, 1, 'filters never read the repository');
});

test('empty, withheld-only and error states never show stale data', async () => {
  const empty = mountHistory();
  empty.controller.show();
  empty.selectView('training');
  await settle();
  assert.match(empty.text(), /No answered Training decisions yet/);
  empty.dom.dispatch(empty.find('[data-training-history-navigate]'), 'click');
  assert.deepEqual(empty.calls.navigate, ['training']);

  const { page, activeHand } = await seededPage();
  const onlyHand = mountHistory({ page: { decisions: [activeHand.answered], sessions: page.sessions, bounded: false } });
  onlyHand.controller.show();
  onlyHand.selectView('training');
  await settle();
  assert.doesNotMatch(onlyHand.text(), /No answered Training decisions yet/);
  assert.match(onlyHand.text(), /unfinished Full Hand/);
  assert.deepEqual(onlyHand.listIds(), []);

  let fail = false;
  const failing = mountHistory({ listRecentAnsweredDecisions: async () => {
    if (fail) throw new Error('storage failed');
    return page;
  } });
  failing.controller.show();
  failing.selectView('training');
  await settle();
  assert.equal(failing.listIds().length, 2);
  fail = true;
  failing.controller.hide();
  failing.controller.show();
  await settle();
  assert.deepEqual(failing.listIds(), [], 'the stale list is cleared on error');
  assert.match(failing.text(), /Training history could not be loaded\./);
  assert.equal(failing.errors.length, 1);
});

test('a stale load is discarded after an owner change; the toggle resets to Saved items', async () => {
  const { page } = await seededPage();
  let release;
  const f = mountHistory({ listRecentAnsweredDecisions: () => new Promise((resolve) => { release = resolve; }) });
  f.controller.show();
  f.selectView('training');
  await settle();
  f.controller.ownerChanged();
  assert.equal(f.controller.getState().view, 'items');
  assert.equal(f.controls.hidden, false);
  assert.equal(f.find('[data-saved-training-history]').hidden, true);
  assert.equal(f.calls.library.at(-1), 'show', 'the new owner sees Saved items');
  release(page);
  await settle();
  assert.equal(f.controller.getState().itemCount, 0, 'the previous owner\'s history is never adopted');
  assert.deepEqual(f.listIds(), []);

  let scopeCurrent = true;
  const scoped = mountHistory({ page, captureScope: async () => ({
    assertCurrent() { if (!scopeCurrent) throw new Error('stale'); },
    isCurrent: () => scopeCurrent,
  }), listRecentAnsweredDecisions: async () => { scopeCurrent = false; return page; } });
  scoped.controller.show();
  scoped.selectView('training');
  await settle();
  assert.equal(scoped.controller.getState().itemCount, 0);
  assert.equal(scoped.controller.getState().status, 'loading', 'no error and no adoption for a stale scope');
  assert.equal(scoped.errors.length, 0);
});

test('detail routes Same/Similar Spot and Save as Spot once through the existing services', async () => {
  const { page, focused } = await seededPage();
  const f = mountHistory({ page });
  f.controller.show();
  f.selectView('training');
  await settle();
  const id = focused.answered.id;
  f.dom.dispatch(f.section.querySelectorAll('[data-training-history-id]')[0], 'click');
  assert.equal(f.controller.getState().expandedId, id);
  await until(() => f.controller.getState().savedStates[id] === 'unsaved', 'saved-state check');
  const objectId = await savedTrainingHistorySpotObjectId(id);
  assert.deepEqual(f.calls.getById, [objectId], 'one bounded Saved lookup for the opened decision');

  f.dom.dispatch(f.find('[data-training-history-redrill="same_spot"]'), 'click');
  f.dom.dispatch(f.find('[data-training-history-redrill="similar_spot"]'), 'click');
  assert.deepEqual(f.calls.redrill, [[id, 'same_spot'], [id, 'similar_spot']]);

  const save = f.find('[data-training-history-save]');
  f.dom.dispatch(save, 'click');
  f.dom.dispatch(save, 'click');
  await until(() => f.controller.getState().savedStates[id] === 'saved', 'save');
  assert.equal(f.calls.save.length, 1, 'a double click saves once');
  assert.equal(f.calls.save[0].operation.id, objectId);
  assert.equal(f.calls.save[0].sourceSurface, 'training');
  assert.equal(f.calls.save[0].sourceId, `training-memory:${id}`);
  assert.deepEqual(f.calls.sameSpot, [id]);
  assert.equal(f.find('[data-training-history-save]'), null);
  const markers = f.section.querySelectorAll('[data-training-history-saved]');
  assert.ok(markers.length >= 2, 'list item and detail both show the saved state');
  assert.ok(markers.every((node) => node.textContent.includes('✓')), 'saved state is not color-only');

  const already = mountHistory({ page, existingSaved: { id: objectId, lifecycle: { state: 'active' } } });
  already.controller.show();
  already.selectView('training');
  await settle();
  already.dom.dispatch(already.section.querySelectorAll('[data-training-history-id]')[0], 'click');
  await until(() => Object.values(already.controller.getState().savedStates).includes('saved'), 'existing Spot lookup');
  assert.equal(already.find('[data-training-history-save]'), null, 'an existing Spot is recognised, not duplicated');
  assert.ok(already.find('[data-training-history-saved]'));
  assert.equal(already.calls.save.length, 0);
});

test('Save failure is reported calmly and can be retried', async () => {
  const { page } = await seededPage();
  let attempts = 0;
  const f = mountHistory({ page, createSameSpot: async () => {
    attempts += 1;
    if (attempts === 1) throw Object.assign(new Error('incompatible'), { code: 'historical_accounting_incompatible' });
    return { exercise: { pokerState: {} } };
  } });
  f.controller.show();
  f.selectView('training');
  await settle();
  f.dom.dispatch(f.section.querySelectorAll('[data-training-history-id]')[0], 'click');
  await until(() => f.find('[data-training-history-save]')?.disabled === false, 'saved-state check');
  f.dom.dispatch(f.find('[data-training-history-save]'), 'click');
  await until(() => /could not be saved/.test(f.text()), 'save failure');
  assert.match(f.text(), /This decision could not be saved as a Spot\./);
  assert.equal(f.find('[data-training-history-save]').disabled, false);
  assert.equal(f.errors.length, 1);
  f.dom.dispatch(f.find('[data-training-history-save]'), 'click');
  await until(() => f.calls.save.length === 1, 'retry');
  assert.equal(f.calls.save.length, 1);
});

test('dispose is idempotent and removes owned listeners and slots', async () => {
  const { page } = await seededPage();
  const f = mountHistory({ page });
  assert.ok(f.dom.listenerCount() > f.baseListeners);
  f.controller.show();
  f.selectView('training');
  await settle();
  f.controller.dispose();
  assert.equal(f.dom.listenerCount(), f.baseListeners);
  assert.equal(f.controls.hidden, false, 'library slots are restored');
  assert.equal(f.section.querySelector('[data-saved-view-toggle]'), null);
  assert.equal(f.section.querySelector('[data-saved-training-history]'), null);
  assert.doesNotThrow(() => f.controller.dispose());
  f.controller.show();
  f.controller.invalidate();
  f.controller.ownerChanged();
  await settle();
  assert.equal(f.calls.list, 1);
  assert.equal(f.dom.pendingTimers(), 0);
});

// ---------------------------------------------------------------- shared formatter and wiring

test('the extracted Memory row formatter keeps the existing Memory output', () => {
  const t = (value) => `[${value}]`;
  const context = { heroCards: ['As', 'Kh'], board: ['Qc', '7d', '2s'], street: 'flop', heroPosition: 'BTN',
    effectiveStackBb: 97.5, currentPotBb: 6.5, callAmountBb: 2 };
  const full = trainingMemoryContextSummary(context, t);
  // The Memory panel reads only `cards` and `spot`; both keep the pre-extraction output.
  assert.deepEqual({ cards: full.cards, spot: full.spot }, {
    cards: 'As Kh · Qc 7d 2s',
    spot: '[Flop] · BTN · [Effective stack] 97.5 bb · [Pot] 6.5 bb · [Facing] 2 bb',
  });
  assert.deepEqual([...full.spotParts], ['[Flop]', 'BTN', '[Effective stack] 97.5 bb', '[Pot] 6.5 bb', '[Facing] 2 bb']);
  assert.equal(full.spotParts.join(' · '), full.spot, 'parts are the same facts as the joined line');
  const preflop = trainingMemoryContextSummary({ ...context, board: [], street: 'preflop', callAmountBb: 0,
    effectiveStackBb: null, currentPotBb: undefined }, t);
  assert.deepEqual({ cards: preflop.cards, spot: preflop.spot }, { cards: 'As Kh · [Preflop]', spot: '[Preflop] · BTN' });
  assert.equal(trainingMemoryModeLabelKey('full_hand'), 'Full Hand');
  assert.equal(trainingMemoryModeLabelKey('custom_mode'), 'custom_mode');
  assert.equal(formatTrainingMemoryDate(undefined), '');
  assert.equal(formatTrainingMemoryDate('2026-09-20T10:00:00.000Z', 'en'),
    new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date('2026-09-20T10:00:00.000Z')));
  assert.match(logic, /function trainingMemoryDecisionSummary\(record\)[\s\S]*?RiverlineTrainingMemoryFormat\.contextSummary\(context, t\)/);
  assert.match(logic, /function trainingMemoryDate\(isoTimestamp\) \{\s*return window\.RiverlineTrainingMemoryFormat\.formatDate/);
});

test('modules stay DOM-free/pure where required and logic.js only wires and routes', () => {
  for (const source of [projectionSource, formatSource]) {
    assert.doesNotMatch(source, /document\.|indexedDB|localStorage|strategyProvider|\.resolve\(|calculateEquity|computeEquity/);
  }
  assert.doesNotMatch(workspaceSource, /indexedDB|localStorage|resolveStrategy|calculateEquity|updateStudyMetadata|markReviewed|snooze|requestUncertainRevisit/);
  assert.match(logic, /window\.RiverlineSavedTrainingHistory\?\.mount\(section, \{/);
  assert.match(logic, /captureLifecycleScope\?\.\('training_memory'\)/);
  assert.match(logic, /function clearSavedOwnerPresentation[\s\S]*?savedLibraryController\?\.ownerChanged\(\);[\s\S]*?savedTrainingHistoryController\?\.ownerChanged\(\);/);
  assert.match(logic, /function openSavedTrainingHistoryRedrill[\s\S]*?trainingSessionIsActive\(\) \|\| trainingSameSpotIsActive\(\)[\s\S]*?Finish or leave your current session before re-drilling this spot\.[\s\S]*?openTrainingMemoryRedrill\(recordId, kind\)/);
  assert.doesNotMatch(logic, /function renderSavedTrainingHistory|listRecentAnsweredDecisions/);
  assert.match(html, /data-saved-view-toggle data-tutorial-anchor="saved-view-toggle"/);
  assert.match(html, /data-saved-training-history hidden/);
  assert.ok(html.indexOf('src/application/saved-training-history-workspace.mjs') < html.indexOf('src/core/logic.js'));
  assert.ok(html.indexOf('src/application/training-memory-row-format.mjs') < html.indexOf('src/core/logic.js'));
});
