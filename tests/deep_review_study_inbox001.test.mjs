import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { createSavedStudyObjectApplication } from '../app/src/application/saved-study-object-service.mjs';
import { createMemorySavedStudyDatabase, createSavedStudyOwnerRef } from '../app/src/saved-study-objects/index.mjs';
import { createHandReviewProjector } from '../app/src/application/hand-review.mjs';
import { installPlaybookStateSourceBridge } from '../app/src/application/playbook-mode-bootstrap.mjs';
import { createStrategyProvider } from '../app/src/application/strategy-provider.mjs';
import { resolveHeuristicStrategy } from '../app/src/strategy/heuristic-strategy.mjs';
import { projectDecisionDelta, selectImportantDecisions, projectReviewPatterns } from '../app/src/application/decision-delta.mjs';
import { createStudyInboxReader, projectStudyInbox } from '../app/src/application/study-inbox.mjs';
import { renderDeepReview, renderStudyInbox } from '../app/src/application/study-workspace.mjs';
import { installStudyWorkspaceBridge } from '../app/src/application/study-workspace-bootstrap.mjs';
import { STUDY_COPY } from '../app/src/application/study-language.mjs';
import { createTrainingMemoryService } from '../app/src/application/training-memory-service.mjs';
import { createMemoryTrainingMemoryDatabase } from '../app/src/training-memory/indexeddb-storage.mjs';
import { createRiverlineIdentity, riverlineOwnershipRefForIdentity } from '../app/src/account-identity/domain.mjs';
import { createTrainingConfigFromLegacyCompatibility, generateTrainingExercise } from '../app/src/application/training-generator.mjs';
import { evaluateTrainingAnswer } from '../app/src/application/training-answer-evaluation.mjs';
import { importHandHistory } from '../app/src/application/hand-history-import.mjs';

const provider = () => createStrategyProvider({ fallbackResolver: resolveHeuristicStrategy });
function hand() {
  const browser = { dispatchEvent() {}, CustomEvent: class { constructor(type, input) { this.type = type; this.detail = input.detail; } } };
  const bridge = installPlaybookStateSourceBridge(browser);
  bridge.setMode('hand', { tableSize: 2, rakeMode: 'off', straddleBb: 0 });
  bridge.initializeHand({ tableSize: 2, gameMode: 'home', stackBb: 100, stackMode: 'hero', heroSeat: 0,
    buttonSeat: 0, anteType: 'none', anteBb: 0, straddleBb: 0 });
  bridge.dealObservedHoleCards({ 'seat-0': ['As', 'Kh'] }); bridge.applyAction('fold');
  const journal = bridge.getHeroDecisionJournal();
  const input = { source: 'canonical_hand', handId: journal.handId, heroPlayerId: bridge.getHeroPlayerId(),
    decisions: journal.decisions, completedHandResult: bridge.getCompletedHandResult() };
  let calls = 0; const resolver = provider();
  const projector = createHandReviewProjector({ resolveStrategy: context => { calls++; return resolver.resolve(context); } });
  return { input, bridge, projector, review: projector.project(input), calls: () => calls };
}
const savedObject = (id, reviewState = 'none') => ({ id, kind: 'spot', lifecycle: { state: 'active' },
  annotations: { title: id, reviewState, tags: [] }, source: { sourceId: id }, payload: {} });

async function memoryFixture() {
  const identity = createRiverlineIdentity({ identityId: 'study-owner', kind: 'device_guest', displayName: 'Study',
    localDeviceIdentityId: 'device', createdAt: '2026-09-01T00:00:00.000Z' });
  const scope = { ownerRef: riverlineOwnershipRefForIdentity(identity), generation: 0, authStatus: 'signed_in' };
  let tick = Date.parse('2026-09-01T00:00:00.000Z'), id = 0;
  const database = createMemoryTrainingMemoryDatabase();
  const service = createTrainingMemoryService({ database,
    ownerProvider: { capture: async () => scope, assertCurrent: value => assert.equal(value, scope) },
    clock: () => new Date(tick += 1000), idFactory: kind => `${kind}-${++id}` });
  const generated = generateTrainingExercise(createTrainingConfigFromLegacyCompatibility({
    tableSize: 6, stackBb: 100, streets: ['preflop'], heroPositions: ['BTN'], gameMode: 'home',
    allowedDecisionTypes: ['preflop_unopened'], difficulty: 'hard', seed: 123 }), { strategyProvider: provider() });
  assert.equal(generated.ok, true, generated.error?.message);
  const exercise = generated.exercise;
  const session = await service.startSession({ mode: 'focused', requestedLength: 1, sessionSeed: exercise.seed, focus: {} });
  const shown = await service.recordExerciseShown({ sessionId: session.id, exercise });
  const actionType = 'fold';
  const evaluation = evaluateTrainingAnswer({ exerciseId: exercise.id, chosenActionType: actionType,
    strategyResult: exercise.strategyResult, decisionContext: exercise.decisionContext });
  await service.recordExerciseAnswered({ recordId: shown.id, evaluation, strategyResult: exercise.strategyResult, actionType });
  await service.updateStudyMetadata(shown.id, { review: true, difficult: true });
  return { service, session, record: await service.getDecision(shown.id), database };
}

test('seven roles stay separate; heuristic disagreement alone cannot select a decision', () => {
  const f = hand(), decision = f.review.selectedDecision;
  const delta = projectDecisionDelta(decision);
  assert.equal(Object.keys(delta.roles).length, 7);
  assert.equal(delta.roles.heuristicBaseline.availability, 'available');
  assert.equal(delta.roles.selectedReference.availability, 'unavailable');
  assert.equal(delta.roles.normativeAssessment.availability, 'unavailable');
  assert.equal(delta.combinedVerdict, null);
  assert.deepEqual(selectImportantDecisions([delta]), []);
  for (let i = 0; i < 5; i++) f.projector.project({ ...f.input, replayProjection: { selectedFrameIndex: i } });
  assert.equal(f.calls(), 1, 'Review/Replay performs no extra strategy work');
});

test('explicit priorities are deterministic, capped at three, and keep Personal preference qualitative and immutable', () => {
  const decision = hand().review.selectedDecision;
  const personal = { personalStatus: 'available', intendedAction: 'call', precision: 'dominant_only',
    actionTypeRelationship: 'different_action_type', frequency: null, evidenceIds: ['intent-1'] };
  const before = structuredClone(personal);
  const delta = projectDecisionDelta(decision, { personal });
  assert.equal(delta.roles.personalIntent.basis, 'current');
  assert.equal(delta.roles.personalIntent.evidence.frequency, null);
  assert.deepEqual(personal, before);
  assert.equal(delta.roles.normativeAssessment.availability, 'unavailable');
  const other = [0, 1, 2, 3].map(index => projectDecisionDelta({ ...decision, decisionId: `d${index}`, decisionIndex: index },
    { annotations: { reviewState: 'review_later' }, learningEvidence: { uncertainty: { value: 'uncertain' } } }));
  assert.deepEqual(selectImportantDecisions([...other].reverse()).map(item => item.decisionIndex), [0, 1, 2]);
  assert.equal(selectImportantDecisions([delta, ...other])[0].reasons[0].code, 'review_later');
  assert.ok(delta.summary.evidenceRefs.includes('intent-1'));
});

test('ambiguous imports disable comparisons throughout shared Review and preserve source facts', () => {
  const f = hand(); const provenance = { sourceHandId: '123', parserVersion: 'parser/v1', reconstructionVersion: 'replay/v3',
    factSummary: { exact: ['cards'], inferred: [], ambiguous: ['river-price'], missing: [], unsupported: [] } };
  const review = f.projector.project({ ...f.input, importProvenance: provenance });
  assert.equal(review.selectedDecision.comparison.state, 'unavailable');
  assert.deepEqual(review.selectedDecision.distribution, []);
  assert.equal(review.deepReview.deltas[0].reasons[0].code, 'import_uncertainty');
  assert.deepEqual(review.importProvenance, provenance);
  assert.equal(f.calls(), 1);
});

test('imported Saved reload reprojects exact Review and Inbox provenance without storing summaries', async () => {
  const text = (await readFile(new URL('./fixtures/hand-history/BasicHand.txt', import.meta.url), 'utf8'))
    .replace('*** HOLE CARDS ***', '*** HOLE CARDS ***\nDealt to H6U5r [Js Jd]');
  const imported = await importHandHistory(text); assert.equal(imported.status, 'complete');
  const database = createMemorySavedStudyDatabase(), ownerRef = createSavedStudyOwnerRef('study-import-owner');
  const application = createSavedStudyObjectApplication({ database, ownerRef });
  const saved = await application.saveHand({ ...imported, reviewState: 'review_later' });
  const reopened = createSavedStudyObjectApplication({ database, ownerRef });
  const cold = await reopened.getById(saved.object.id);
  const f = hand(); f.bridge.openSavedHand({ objectId: cold.id, ...cold.payload });
  const input = { source: 'canonical_hand', handId: imported.pokerState.handId,
    heroPlayerId: imported.heroPlayerId, decisions: f.bridge.getHeroDecisionJournal().decisions,
    completedHandResult: f.bridge.getCompletedHandResult(), importProvenance: f.bridge.getImportProvenance() };
  const review = f.projector.project(input);
  assert.deepEqual(review.importProvenance, imported.importProvenance);
  assert.equal(review.deepReview.deltas[0].roles.opponentPolicy.availability, 'unavailable');
  const inbox = projectStudyInbox({ saved: await reopened.listForReview() });
  assert.equal(inbox.recommendation.sourceFacts.importProvenance.sourceHandId, imported.importProvenance.sourceHandId);
  assert.ok(!JSON.stringify(cold).includes('decision-delta/v1'));
  assert.ok(!JSON.stringify(cold).includes('*** HOLE CARDS ***'));
  await reopened.updateAnnotations(cold.id, { reviewState: 'resolved' });
  assert.equal(projectStudyInbox({ saved: await application.listRecent() }).recommendation, null);
  const other = createSavedStudyObjectApplication({ database, ownerRef: createSavedStudyOwnerRef('different-owner') });
  await assert.rejects(other.listRecent(), error => error.code === 'owner_mismatch');
});

test('large economics and permitted assessment have independent reasons; policy alone never grants grading', () => {
  const decision = hand().review.selectedDecision;
  const economics = projectDecisionDelta({ ...decision, durable: { ...decision.durable,
    decisionContext: { ...decision.durable.decisionContext, callAmountBb: 20 } } });
  assert.equal(economics.reasons[0].code, 'large_economics');
  const forbidden = projectDecisionDelta({ ...decision, truth: { ...decision.truth, learningEligibility: { remediation: true } } });
  assert.equal(forbidden.reasons.length, 0, 'remediation flag without normative state cannot rank');
});

test('Study Inbox reads actual Training and Saved owners without writes and handoffs remain owner-owned', async () => {
  const f = await memoryFixture(); const before = await f.service.getDecision(f.record.id);
  const reader = createStudyInboxReader({ captureScope: async () => ({ assertCurrent() {} }), memory: () => f.service,
    saved: () => ({ listForReview: async () => [savedObject('later', 'review_later')],
      listRecent: async () => [savedObject('later', 'review_later'), savedObject('recent')] }) });
  const inbox = await reader.load();
  assert.equal(inbox.recommendation.owner, 'training_memory');
  assert.deepEqual(inbox.recommendation.reasons, ['due_review', 'review_later', 'difficult']);
  assert.equal(inbox.items.length, 3);
  assert.ok(!('record' in inbox.items[0]), 'does not clone a second evidence record');
  assert.deepEqual(await f.service.getDecision(f.record.id), before);
  assert.equal((await f.service.getSession(f.session.id)).id, f.session.id);
  const same = await f.service.createSameSpot(inbox.recommendation.destination.recordId);
  assert.deepEqual(same.exercise.decisionContext, before.decisionContext);
  await f.service.markReviewed(f.record.id);
  assert.equal((await reader.load()).recommendation.source, 'later');
  await f.service.close();
});

test('missing sessions and active Full Hands fail closed; resolved Saved and heuristic legacy reasons stay out', async () => {
  const f = await memoryFixture(); const [item] = await f.service.listDueReview();
  for (const session of [null, { ...f.session, mode: 'full_hand', status: 'active' }]) {
    assert.equal(projectStudyInbox({ training: [{ item, session }] }).items.length, 0);
  }
  assert.equal(projectStudyInbox({ training: [{ item: { ...item, reasons: ['differs_from_reference'] }, session: f.session }],
    saved: [savedObject('resolved', 'resolved')] }).items.length, 0);
  await f.service.close();
});

test('owner changes during fan-out reject the entire mixed-owner projection; partial failures remain inspectable', async () => {
  let current = true;
  const scope = { assertCurrent() { if (!current) throw new Error('stale owner'); } };
  const reader = createStudyInboxReader({ captureScope: async () => scope,
    memory: () => ({ listDueReview: async () => { current = false; return []; } }),
    saved: () => ({ listForReview: async () => [], listRecent: async () => [savedObject('private')] }) });
  await assert.rejects(reader.load(), /stale owner/);
  const partial = createStudyInboxReader({ captureScope: async () => ({ assertCurrent() {} }),
    memory: () => null, saved: () => ({ listForReview: async () => [], listRecent: async () => [savedObject('safe')] }),
    readConflicts: async () => { throw new Error('unavailable'); } });
  const model = await partial.load();
  assert.deepEqual(model.unavailable, ['training_memory', 'personal_strategy']);
  assert.equal(model.recommendation.source, 'safe');
});

test('patterns require three unique decisions with explicit matching family/context; no skill deficit or ranking uplift', () => {
  const context = hand().review.selectedDecision.durable.decisionContext;
  const item = id => ({ id, context, reasons: ['uncertain'] });
  assert.deepEqual(projectReviewPatterns([item('a'), item('a'), item('b')]), []);
  const patterns = projectReviewPatterns([item('a'), item('b'), item('c')]);
  assert.equal(patterns.length, 1); assert.equal(patterns[0].assessment, 'none');
  assert.deepEqual(patterns[0].sample, ['a', 'b', 'c']);
  assert.deepEqual(projectReviewPatterns([item('a'), item('b'), { ...item('c'), context: { ...context, street: 'river' } }]), []);
});

class Element {
  constructor(tag, doc) { this.tagName = tag; this.ownerDocument = doc; this.children = []; this.dataset = {}; this.listeners = []; this.isConnected = true; this._text = ''; }
  set textContent(value) { this._text = String(value); this.children = []; }
  get textContent() { return this._text + this.children.map(child => child.textContent).join(' '); }
  append(...nodes) { this.children.push(...nodes); }
  replaceChildren(...nodes) { this._text = ''; this.children = [...nodes]; }
  setAttribute(key, value) { this[key] = value; }
  addEventListener(type, handler) { this.listeners.push({ type, handler }); }
  async fire(type) { for (const entry of this.listeners) if (entry.type === type) await entry.handler(); }
}
const descendants = root => root.children.flatMap(child => [child, ...descendants(child)]);
const rootElement = () => { const doc = { createElement: tag => new Element(tag, doc) }; return new Element('div', doc); };

test('mounted EN/RU/HE Deep Review keeps evidence collapsed, exact seeking, and stale callbacks fenced', async () => {
  for (const language of ['en', 'ru', 'he']) {
    const root = rootElement(), f = hand(); let active = true, selected = null, actions = 0;
    renderDeepReview({ root, review: f.review, language, evidence: { [f.review.selectedDecision.decisionId]: { annotations: { reviewState: 'review_later' } } },
      isCurrent: () => active, onSelect: index => { selected = index; }, onAction: () => { actions++; } });
    assert.equal(root.dir, language === 'he' ? 'rtl' : 'ltr');
    const nodes = descendants(root);
    assert.equal(nodes.filter(node => node.dataset.deltaRole).length, 7);
    assert.ok(nodes.filter(node => node.tagName === 'details').every(node => !node.open));
    const buttons = nodes.filter(node => node.tagName === 'button');
    await buttons[0].fire('click'); assert.equal(selected, 0);
    active = false; await buttons[1].fire('click'); assert.equal(actions, 0);
    assert.ok(nodes.filter(node => node.tagName === 'bdi').every(node => node.dir === 'ltr'));
    for (const text of Object.values(STUDY_COPY)) assert.ok(text.every(value => typeof value === 'string' && value.length));
  }
});

test('mounted Inbox preserves source IDs safely, deterministic recommendation, and owner clearing', async () => {
  const root = rootElement(), model = projectStudyInbox({ saved: [savedObject('<script>source</script>', 'review_later')] });
  for (const language of ['en', 'ru', 'he']) {
    renderStudyInbox({ root, model, language, onOpen() {} });
    assert.ok(root.textContent.includes('<script>source</script>'));
    assert.equal(descendants(root).filter(node => node.dataset.studyRecommendation).length, 1);
    assert.equal(descendants(root).filter(node => node.tagName === 'script').length, 0);
  }
  const listeners = new Map(); let generation = 1;
  const win = { appLang: 'en', addEventListener: (name, handler) => listeners.set(name, handler),
    RiverlineAccountIdentity: { getLifecycleState: () => ({ lifecycleGeneration: generation }),
      captureLifecycleScope: async () => ({ assertCurrent() { if (generation !== 1) throw new Error('stale'); } }) },
    RiverlineSavedStudyObjects: { listRecent: async () => [], listForReview: async () => [] } };
  const bridge = installStudyWorkspaceBridge(win);
  bridge.renderReview({ root, review: hand().review, onSelect() {}, onAction() {}, getMemoryRecords: async () => [] });
  generation++; listeners.get('riverline:identitychange')();
  await new Promise(resolve => setImmediate(resolve)); assert.equal(root.textContent, '');
});

test('exact Personal mixtures render their canonical entries and frozen Training sources keep answer-time labels', () => {
  const root = rootElement(), f = hand();
  const personal = { personalStatus: 'available', intendedAction: 'raise', precision: 'exact', evidenceIds: ['mix'],
    frequency: [{ action: { type: 'fold' }, probability: 0.3 }, { action: { type: 'raise' }, probability: 0.7 }] };
  renderDeepReview({ root, review: { ...f.review, source: 'training_full_hand' },
    evidence: { [f.review.selectedDecision.decisionId]: { personal } }, onSelect() {}, onAction() {} });
  assert.match(root.textContent, /30%/); assert.match(root.textContent, /70%/);
  assert.doesNotMatch(root.textContent, /\[object Object\]/);
  assert.match(root.textContent, /Recorded answer-time source/);
});

test('shared Saved annotation editor binds the reviewed decision, not a changing current Hand or owner', async () => {
  const source = await readFile(new URL('../app/src/core/logic.js', import.meta.url), 'utf8');
  const functions = ['openSavedStudyEditor', 'saveSavedStudyAnnotations', 'archiveSavedStudyObjectFromEditor']
    .map(name => source.match(new RegExp(`(?:async )?function ${name}\\([^]*?\\n}`))[0]).join('\n');
  const nodes = new Map();
  const $ = selector => {
    if (!nodes.has(selector)) nodes.set(selector, { value: '', classList: { add() {} }, focus() {} });
    return nodes.get(selector);
  };
  let owner = 1; const writes = [];
  const object = { ...savedObject('review-decision', 'review_later'), revision: 3,
    annotations: { title: 'Decision', note: 'Keep note', tags: [], reviewState: 'review_later', classifications: [] } };
  const context = vm.createContext({ $, document: { activeElement: null }, savedStudyCurrentObject: savedObject('current-hand'),
    savedStudyEditorObject: null, savedStudyEditorOwnerGeneration: null, savedStudyDialogLastFocus: null,
    window: { RiverlineAccountIdentity: { getLifecycleState: () => ({ lifecycleGeneration: owner }) },
      RiverlineSavedStudyObjects: { classificationsWithMistake: value => value.annotations.classifications }, requestAnimationFrame: callback => callback() },
    hideSavedStudyArchiveConfirmation() {}, setSavedStudyEditorBusy() {}, savedStudyTagsFromEditor: () => [],
    t: value => value, toast() {}, console, app: { handReview: {} }, closeSavedStudyEditor() {},
    callSavedStudyBridge: async (method, id, changes) => { writes.push({ method, id, changes }); return { object: { ...object, annotations: changes } }; },
    renderSavedStudySourceState() { throw new Error('must not retarget the Hand bookmark'); } });
  vm.runInContext(functions, context);
  context.openSavedStudyEditor(object);
  assert.equal($('#savedStudyArchiveButton').hidden, true);
  context.savedStudyCurrentObject = savedObject('new-current-hand');
  await context.saveSavedStudyAnnotations({ preventDefault() {} });
  assert.equal(writes[0].id, object.id); assert.equal(writes[0].changes.note, 'Keep note');
  assert.equal(writes[0].changes.reviewState, 'review_later');
  await context.archiveSavedStudyObjectFromEditor(); assert.equal(writes.length, 1);
  owner++;
  await context.saveSavedStudyAnnotations({ preventDefault() {} }); assert.equal(writes.length, 1);
});
