import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { GAME_MODES } from '../shared/poker-domain/index.js';
import { createTrainingConfigFromLegacyCompatibility, generateTrainingExercise } from '../app/src/application/training-generator.mjs';
import { createStrategyProvider } from '../app/src/application/strategy-provider.mjs';
import { evaluateTrainingAnswer } from '../app/src/application/training-answer-evaluation.mjs';
import { createTrainingMemoryService } from '../app/src/application/training-memory-service.mjs';
import { createMemoryTrainingMemoryDatabase } from '../app/src/training-memory/indexeddb-storage.mjs';
import { createTrainingMemoryRepository } from '../app/src/training-memory/repository.mjs';
import { validateTrainingDecisionRecord } from '../app/src/training-memory/domain.mjs';
import { deriveTrainingSchedulingProposal, deriveTrainingLearningEligibility } from '../app/src/application/training-intelligence.mjs';

function fixture() {
  let time = Date.parse('2026-09-05T10:00:00.000Z');
  let id = 0;
  let generation = 0;
  let controller = new AbortController();
  const ownerRef = { schemaVersion: 'riverline-ownership-ref/v1', ownerType: 'local_identity', ownerId: 'learning-owner' };
  const database = createMemoryTrainingMemoryDatabase();
  const ownerProvider = {
    async capture() { return { ownerRef, generation, signal: controller.signal }; },
    assertCurrent(scope) { if (scope.generation !== generation) throw new Error('stale owner'); },
  };
  const service = createTrainingMemoryService({ ownerProvider, database,
    clock: () => new Date(time), idFactory: (kind) => `${kind}-${++id}` });
  const provider = createStrategyProvider({ fallbackResolver() {
    return { source: 'heuristic_preflop', actions: [
      { action: { type: 'fold' }, label: 'Fold', probability: 0.1 },
      { action: { type: 'raise' }, label: 'Raise', probability: 0.9 },
    ] };
  } });
  const generated = generateTrainingExercise(createTrainingConfigFromLegacyCompatibility({
    tableSize: 6, stackBb: 100, streets: ['preflop'], gameMode: GAME_MODES.HOME,
    heroPositions: ['BTN'], allowedDecisionTypes: ['preflop_unopened'], difficulty: 'hard', seed: 7,
  }), { strategyProvider: provider });
  assert.equal(generated.ok, true, generated.error?.message);
  const exercise = generated.exercise;
  const evaluation = evaluateTrainingAnswer({ exerciseId: exercise.id,
    chosenActionType: 'fold', strategyResult: exercise.strategyResult });
  async function answer({ uncertain = true } = {}) {
    const session = await service.startSession({ mode: 'focused', sessionSeed: 7, requestedLength: 1 });
    const shown = await service.recordExerciseShown({ sessionId: session.id, exercise });
    const record = await service.recordExerciseAnswered({ recordId: shown.id, evaluation,
      strategyResult: exercise.strategyResult, actionType: 'fold',
      uncertainty: uncertain ? { value: 'uncertain', phase: 'before_reveal', capturedAt: new Date(time).toISOString() } : null });
    return { record, session, shown };
  }
  return { service, database, ownerRef, exercise, evaluation, answer,
    clock: () => new Date(time), advance: (ms) => { time += ms; },
    invalidate() { controller.abort(); generation += 1; controller = new AbortController(); } };
}

test('uncertainty is separate from action/assessment, versioned, immutable after answer; legacy survives', async () => {
  const f = fixture();
  const legacy = await f.answer({ uncertain: false });
  const { record } = await f.answer();
  assert.equal(legacy.record.schemaVersion, 'training-decision-record/v1');
  assert.equal(record.schemaVersion, 'training-decision-record/v1.1');
  assert.deepEqual(record.userResponse, legacy.record.userResponse);
  assert.deepEqual(record.strategyEvidence, legacy.record.strategyEvidence);
  assert.equal(deriveTrainingSchedulingProposal(record), null);
  const retry = await f.service.recordExerciseAnswered({ recordId: record.id, uncertainty: null });
  assert.deepEqual(retry, record);
  const reopened = createTrainingMemoryRepository({ ownerRef: f.ownerRef, database: f.database });
  await reopened.initialize();
  assert.deepEqual(await reopened.getDecision(legacy.record.id), legacy.record);
  assert.equal(f.database.inspectStore('metadata')[0].decisionSchemaVersion, 'training-decision-record/v1.1');
  await f.answer({ uncertain: false });
  assert.equal(f.database.inspectStore('metadata')[0].decisionSchemaVersion, 'training-decision-record/v1.1');
});

test('only explicit uncertain request schedules; UTC boundary, Practice now, snooze and dismiss preserve evidence', async () => {
  const f = fixture();
  const { record } = await f.answer();
  assert.deepEqual((await f.service.listLearningRevisits()).proposals, []);
  const requested = await f.service.requestUncertainRevisit(record.id);
  const proposal = deriveTrainingSchedulingProposal(requested, f.clock());
  const eligibility = deriveTrainingLearningEligibility(requested);
  assert.equal(eligibility.heuristicComparison, true);
  assert.equal(eligibility.userRequestedRevisit, true);
  assert.equal(eligibility.uncertaintyRevisit, true);
  assert.equal(eligibility.remediation, false);
  assert.equal(eligibility.retention, false);
  assert.equal(eligibility.transfer, false);
  assert.equal(proposal.due, false);
  assert.equal(Date.parse(proposal.dueAt) - f.clock().getTime(), 86400000);
  assert.equal((await f.service.createSameSpot(record.id, { handoff: proposal.handoff })).revisit.sourceDecisionRecordId, record.id);
  f.advance(86400000 - 1);
  assert.equal((await f.service.listLearningRevisits()).proposals.length, 0);
  f.advance(1);
  assert.equal((await f.service.listLearningRevisits()).proposals.length, 1);
  await f.service.snooze(record.id, 1);
  await assert.rejects(f.service.createSameSpot(record.id, { handoff: proposal.handoff }), /changed/);
  assert.equal((await f.service.listLearningRevisits()).proposals.length, 0);
  await f.service.markReviewed(record.id);
  const dismissed = await f.service.getDecision(record.id);
  assert.deepEqual(dismissed.learningEvidence.uncertainty, record.learningEvidence.uncertainty);
  assert.equal(deriveTrainingSchedulingProposal(dismissed), null);
});

test('legacy disagreement and manual difficult do not become learning proposals', async () => {
  const f = fixture();
  const { record } = await f.answer({ uncertain: false });
  await f.service.updateStudyMetadata(record.id, { difficult: true });
  await assert.rejects(f.service.requestUncertainRevisit(record.id), /uncertainty/);
  assert.equal((await f.service.listLearningRevisits()).proposals.length, 0);
});

async function startRevisit(f, recordId) {
  const requested = await f.service.requestUncertainRevisit(recordId);
  const proposal = deriveTrainingSchedulingProposal(requested, f.clock());
  const same = await f.service.createSameSpot(recordId, { handoff: proposal.handoff });
  const session = await f.service.startSession({ mode: 'review', sessionSeed: same.exercise.seed, requestedLength: 1 });
  const shown = await f.service.recordExerciseShown({ sessionId: session.id, exercise: same.exercise,
    parentDecisionRecordId: recordId, redrillKind: 'same_spot', revisit: same.revisit });
  return { same, session, shown };
}

async function answerRevisit(f, attempt) {
  return f.service.recordExerciseAnswered({ recordId: attempt.shown.id,
    strategyResult: attempt.same.exercise.strategyResult, actionType: 'fold',
    evaluation: evaluateTrainingAnswer({ exerciseId: attempt.same.exercise.id, chosenActionType: 'fold',
      strategyResult: attempt.same.exercise.strategyResult }) });
}

test('exact revisit preserves state/source, only persisted answer resolves matching reminder once', async () => {
  const f = fixture();
  const { record } = await f.answer();
  const attempt = await startRevisit(f, record.id);
  assert.deepEqual(attempt.same.exercise.pokerState, f.exercise.pokerState);
  assert.equal((await f.service.getDecision(record.id)).reviewState.state, 'snoozed');
  const answered = await answerRevisit(f, attempt);
  assert.equal(answered.learningEvidence.revisit.sourceDecisionRecordId, record.id);
  assert.equal(answered.learningEvidence.uncertainty, null);
  assert.equal((await f.service.getDecision(record.id)).reviewState.state, 'reviewed');
  await answerRevisit(f, attempt);
  assert.equal((await f.service.getDecision(record.id)).reviewState.reviewCount, 1);
  assert.equal(Object.hasOwn(answered, 'retained'), false);
});

test('abandon and a snooze during an attempt cannot be consumed as completed recall', async () => {
  const f = fixture();
  const { record } = await f.answer();
  const abandoned = await startRevisit(f, record.id);
  await f.service.finishSession(abandoned.session.id, 'abandoned');
  assert.equal((await f.service.getDecision(record.id)).reviewState.state, 'snoozed');
  const attempt = await startRevisit(f, record.id);
  f.advance(5000);
  const snoozed = await f.service.snooze(record.id, 2);
  await answerRevisit(f, attempt);
  assert.deepEqual((await f.service.getDecision(record.id)).reviewState, snoozed.reviewState);
});

test('new mutation rejects stale whole-record updates and owner revocation aborts commit', async () => {
  const f = fixture();
  const { record } = await f.answer();
  const repository = createTrainingMemoryRepository({ ownerRef: f.ownerRef, database: f.database });
  await f.service.requestUncertainRevisit(record.id);
  await assert.rejects(repository.replaceDecision(record, { expectedRecord: record }), /changed/);
  const before = await f.service.getDecision(record.id);
  f.database.delayNextCommit(() => { f.invalidate(); });
  await assert.rejects(f.service.snooze(record.id, 2));
  assert.deepEqual(await f.service.getDecision(record.id), before);
});

test('invalid evidence is rejected without altering the shown record', async () => {
  const f = fixture();
  const { record } = await f.answer();
  const forged = structuredClone(record);
  forged.learningEvidence.uncertainty.phase = 'after_reveal';
  assert.throws(() => validateTrainingDecisionRecord(forged), /pre-reveal/);
  forged.learningEvidence.uncertainty.phase = 'before_reveal';
  forged.learningEvidence.uncertainty.confidence = 0.8;
  assert.throws(() => validateTrainingDecisionRecord(forged), /Incompatible/);
});

const logic = fs.readFileSync(new URL('../app/src/core/logic.js', import.meta.url), 'utf8');
function functionText(name) {
  const start = logic.search(new RegExp(`(?:async )?function ${name}\\(`));
  assert.notEqual(start, -1);
  const rest = logic.slice(start);
  const next = rest.slice(1).search(/\n(?:async )?function /);
  return next < 0 ? rest : rest.slice(0, next + 1);
}

test('earlier answer is absent from DOM until the new answer, then separately rendered', () => {
  const nodes = new Map(['trainingSameSpotComparison', 'trainingSameSpotEarlierAnswer', 'trainingSameSpotThisTry']
    .map((id) => [id, { textContent: 'stale answer', hidden: false }]));
  const sandbox = { app: { training: { sameSpotHistoricalRecord: { userResponse: { action: { type: 'fold' } }, decisionContext: {} } } },
    $: (selector) => nodes.get(selector.slice(1)), sameSpotActionLabel: (value) => value, t: (value) => value };
  vm.runInNewContext(`${functionText('renderSameSpotComparison')}; renderSameSpotComparison();`, sandbox);
  assert.equal(nodes.get('trainingSameSpotEarlierAnswer').textContent, '');
  assert.equal(nodes.get('trainingSameSpotThisTry').textContent, '');
  assert.equal(nodes.get('trainingSameSpotComparison').hidden, true);
  vm.runInNewContext("renderSameSpotComparison({chosenAction:{type:'raise'}});", sandbox);
  assert.equal(nodes.get('trainingSameSpotEarlierAnswer').textContent, 'fold');
  assert.equal(nodes.get('trainingSameSpotThisTry').textContent, 'raise');
  assert.equal(nodes.get('trainingSameSpotComparison').hidden, false);
});

test('owner/session invalidation discards delayed recommendation reads and private UI', async () => {
  let release;
  const region = { hidden: false, children: ['private'], replaceChildren() { this.children = []; } };
  const checkbox = { checked: true };
  const app = { training: { memoryGeneration: 1 } };
  const sandbox = { app, $: (key) => key === '#trainingLearningNext' ? region : key === '#trainingUncertain' ? checkbox : null,
    trainingSessionIsActive: () => false, trainingSameSpotIsActive: () => false, trainingSessionMode: () => 'focused',
    callTrainingMemoryBridge: () => new Promise((resolve) => { release = resolve; }) };
  vm.runInNewContext(`${functionText('clearTrainingLearningPresentation')}; ${functionText('refreshTrainingLearningNext')}; this.pending = refreshTrainingLearningNext(1);`, sandbox);
  app.training.memoryGeneration += 1;
  vm.runInNewContext('clearTrainingLearningPresentation();', sandbox);
  release({ proposals: [{ private: true }] });
  await sandbox.pending;
  assert.equal(region.hidden, true);
  assert.equal(region.children.length, 0);
  assert.equal(checkbox.checked, false);
});

test('delayed revisit cannot invoke hints through the hidden handler', () => {
  const sandbox = { app: { training: { learningRevisitActive: true } } };
  vm.runInNewContext(`${functionText('revealNextTrainingStudyHint')}; revealNextTrainingStudyHint();`, sandbox);
});

test('Same Spot keyboard replay entry points cannot replace historical evidence', () => {
  const sandbox = { trainingSameSpotIsActive: () => true };
  vm.runInNewContext(`${functionText('replayCurrentTrainingSeed')}; ${functionText('replayCurrentTrainingDecision')};
    replayCurrentTrainingSeed(); replayCurrentTrainingDecision();`, sandbox);
});

test('unknown handoffs, mismatched exact exercises, and stale dismiss fail closed', async () => {
  const f = fixture();
  const { record } = await f.answer();
  const requested = await f.service.requestUncertainRevisit(record.id);
  const proposal = deriveTrainingSchedulingProposal(requested, f.clock());
  await assert.rejects(f.service.createSameSpot(record.id, { handoff: { ...proposal.handoff, kind: 'full_hand' } }), /Unsupported/);
  const same = await f.service.createSameSpot(record.id, { handoff: proposal.handoff });
  const session = await f.service.startSession({ mode: 'review', sessionSeed: 7, requestedLength: 1 });
  await assert.rejects(f.service.recordExerciseShown({ sessionId: session.id, exercise: f.exercise,
    parentDecisionRecordId: record.id, redrillKind: 'same_spot', revisit: same.revisit }), /historical source/);
  f.advance(1000);
  const changed = await f.service.snooze(record.id, 2);
  await assert.rejects(f.service.changeLearningRevisit(proposal.handoff, 'dismiss'), /changed/);
  assert.deepEqual((await f.service.getDecision(record.id)).reviewState, changed.reviewState);
});

test('request changes immediately before child insertion cannot create a stale relationship', async () => {
  const f = fixture();
  const { record } = await f.answer();
  const attempt = await startRevisit(f, record.id);
  const repository = createTrainingMemoryRepository({ ownerRef: f.ownerRef, database: f.database });
  const second = await f.service.startSession({ mode: 'review', sessionSeed: 7, requestedLength: 1 });
  const staleChild = { ...structuredClone(attempt.shown), id: 'stale-child', sessionId: second.id, ordinal: 0 };
  f.advance(1000);
  await f.service.snooze(record.id, 2);
  await assert.rejects(repository.addShownDecision(staleChild), /changed/);
  assert.equal(await repository.getDecision('stale-child'), null);
  assert.deepEqual((await repository.getSession(second.id)).decisionRecordIds, []);
});

test('uncertainty is captured before feedback and remains bound to the submitted action', () => {
  for (const [attemptKind, expectUncertain] of [['primary', true], ['replay', false], ['redrill', false]]) {
    const checkbox = { checked: true };
    const exercise = { id: 'served-exercise', strategyResult: {}, generationMetadata: {} };
    const evaluation = { accepted: false, scoreDelta: 0, grade: 'mistake', truth: { state: 'heuristic_comparison', outcome: 'unassessed' } };
    let persisted;
    const sandbox = { app: { training: { currentExercise: exercise, currentAttemptKind: attemptKind,
      lifecycle: 'ready', stats: { totalHands: 0, correct: 0, streak: 0 }, gradeStats: {} } },
    $: (selector) => selector === '#trainingUncertain' ? checkbox : null,
    trainingSessionMode: () => 'focused', trainingSameSpotIsActive: () => false,
    callTrainingServiceBridge: () => ({ ok: true, evaluation }),
    resetTrainingStudyHints() { checkbox.checked = false; },
    strategyClaimPolicy: () => ({ trainingSemantics: 'unavailable' }),
    truthPresentation: () => ({ tone: 'neutral' }),
    recordTrainingExerciseAnswered: (value) => { persisted = value; },
    t: (value) => value, canonicalTrainingFeedback: () => '',
    };
    for (const name of ['updateTrainingStats', 'renderTrainingEvaluationSummary', 'showTrainingFeedback',
      'emitTrainingDecisionResultExperience', 'renderTrainingDecisionAnalysis', 'showTrainingSolution',
      'setTrainingWorkspaceState', 'completeVariedTrainingSession']) sandbox[name] = () => {};
    vm.runInNewContext(`${functionText('handleTrainingGuess')}; handleTrainingGuess('fold');`, sandbox);
    assert.equal(persisted.actionType, 'fold');
    assert.equal(persisted.exercise.id, exercise.id);
    assert.equal(persisted.uncertainty?.value === 'uncertain', expectUncertain);
    assert.equal(persisted.evaluation, evaluation);
  }
});

test('the new Training tutorial copy is present in all three locales', () => {
  const sandbox = { window: {} };
  const source = fs.readFileSync(new URL('../app/src/locales/tutorial-translations.js', import.meta.url), 'utf8');
  vm.runInNewContext(source, sandbox);
  const key = 'Optionally mark your answer unsure before submitting. After answering, request an exact revisit in 24 hours. Open Training Memory while idle to practice, snooze, or stop reminders. A revisit does not prove retention.';
  for (const locale of ['en', 'ru', 'he']) assert.ok(sandbox.window.riverlineTutorialTranslations[locale][key]);
});

test('failed first extended commit preserves the legacy record and database version marker', async () => {
  const f = fixture();
  const session = await f.service.startSession({ mode: 'focused', requestedLength: 1, sessionSeed: 7 });
  const shown = await f.service.recordExerciseShown({ sessionId: session.id, exercise: f.exercise });
  f.database.delayNextCommit(() => { throw new Error('interrupted write'); });
  await assert.rejects(f.service.recordExerciseAnswered({ recordId: shown.id, evaluation: f.evaluation,
    strategyResult: f.exercise.strategyResult, actionType: 'fold',
    uncertainty: { value: 'uncertain', phase: 'before_reveal', capturedAt: f.clock().toISOString() } }), /interrupted/);
  assert.deepEqual(await f.service.getDecision(shown.id), shown);
  assert.equal(f.database.inspectStore('metadata')[0].decisionSchemaVersion, 'training-decision-record/v1');
});
