import test from 'node:test';
import assert from 'node:assert/strict';
import { createRangeCalibrationApplication, createContextFromSelection } from '../app/src/application/range-calibration-service.mjs';
import { createMemoryPersonalStrategyDatabase } from '../app/src/personal-strategy/indexeddb-storage.mjs';
import { createRangeObservation, createRfiCalibrationContext } from '../app/src/personal-strategy/domain.mjs';
import { createPersonalStrategyEvidenceView } from '../app/src/personal-strategy/evidence-view.mjs';
import { createPersonalStrategySnapshot } from '../app/src/personal-strategy/rfi-inference.mjs';
import { rankCalibrationCandidates, assessCalibrationProgress, getCalibrationQuestionExplanation } from '../app/src/personal-strategy/rfi-question-selection.mjs';
import { createRfiStructuralMappingFacts, RFI_MAPPING_FAMILIES } from '../app/src/personal-strategy/structural-range-mapping.mjs';

const context = createRfiCalibrationContext({ gameRulesId: 'mapping-test', tableSize: 6, heroPosition: 'BTN', effectiveStackBb: 100 });
let id = 0;
const direct = (handClass, action = 'raise') => createRangeObservation({ id: `answer-${++id}`, profileId: 'setup', modeId: 'approach', context,
  handClass, dominantAction: { type: action }, createdAt: '2026-09-05T12:00:00Z' });
const bundle = (observations = []) => {
  const evidenceView = createPersonalStrategyEvidenceView({ profileId: 'setup', modeId: 'approach', context, rangeObservations: observations });
  return { evidenceView, snapshot: createPersonalStrategySnapshot(evidenceView) };
};
const rank = (observations, focus = null) => {
  const { snapshot, evidenceView } = bundle(observations);
  return rankCalibrationCandidates(snapshot, { intent: 'mapping', mappingFocus: focus, mappingEvidenceView: evidenceView });
};

test('mapping has no fixed question quota and coverage comes only from direct evidence', () => {
  const { snapshot, evidenceView } = bundle([direct('AA'), direct('AKs')]);
  const early = assessCalibrationProgress(snapshot, { intent: 'mapping', mappingEvidenceView: evidenceView, sessionQuestionCount: 2 });
  const late = assessCalibrationProgress(snapshot, { intent: 'mapping', mappingEvidenceView: evidenceView, sessionQuestionCount: 9999 });
  assert.equal(late.shouldStop, false);
  assert.equal(late.questionBudget, null);
  assert.deepEqual(early.coverage, late.coverage);
  assert.equal(late.coverage.directCount, 2);
  assert.equal(late.coverage.families.find((entry) => entry.id === 'premium_pairs').state, 'partial');
  assert.equal(late.coverage.families.find((entry) => entry.id === 'small_pairs').state, 'unknown');
  assert.equal(late.coverage.permitsWholeRegionClaim, false);
});

test('neighbor direction and boundary midpoint adapt to the actual preceding preferred action', () => {
  assert.equal(rank([direct('K9s', 'raise')], 'suited_kx')[0].handClass, 'K8s');
  assert.equal(rank([direct('K9s', 'fold')], 'suited_kx')[0].handClass, 'KTs');
  const gap = rank([direct('K9s', 'raise'), direct('K7s', 'fold')], 'suited_kx')[0];
  assert.equal(gap.handClass, 'K8s');
  assert.match(gap.mappingReasonKey, /family you chose/);
  const { snapshot, evidenceView } = bundle([direct('KTs'), direct('K9s'), direct('K8s', 'fold')]);
  const family = createRfiStructuralMappingFacts({ snapshot, evidenceView }).families.find((entry) => entry.id === 'suited_kx');
  assert.equal(family.state, 'initially_sampled');
  assert.equal(family.boundaries[0].stronger, 'K9s');
  assert.equal(family.boundaries[0].weaker, 'K8s');
  assert.equal(family.permitsWholeRegionClaim, false);
});

test('deterministic initial mapping visits major families then samples their boundaries without repeating direct hands', () => {
  const observations = [], asked = [];
  let coverage;
  for (let turn = 0; turn < 169; turn += 1) {
    const { snapshot, evidenceView } = bundle(observations);
    const candidates = rankCalibrationCandidates(snapshot, { intent: 'mapping', mappingEvidenceView: evidenceView, recentQuestionHistory: asked });
    const progress = assessCalibrationProgress(snapshot, { intent: 'mapping', mappingEvidenceView: evidenceView, rankedCandidates: candidates, sessionQuestionCount: turn });
    coverage = progress.coverage;
    if (progress.shouldStop) break;
    const next = candidates.find((candidate) => candidate.ordinaryQuestionEligible);
    assert.ok(next);
    assert.ok(!asked.includes(next.handClass));
    const reason = getCalibrationQuestionExplanation(next).messageKey;
    assert.doesNotMatch(reason, /_[a-z]|debug|selector|optimal|Question.*of/);
    asked.push(next.handClass);
    observations.push(direct(next.handClass));
  }
  assert.ok(asked.length > 5, asked.join(','));
  assert.ok(asked.length < 169, 'Initial sampling must not demand a completed range');
  assert.equal(coverage.initialMapReady, true);
  assert.equal(coverage.completeRange, false);
  assert.deepEqual(coverage.families.map((entry) => entry.state), RFI_MAPPING_FAMILIES.map(() => 'initially_sampled'));
  assert.ok(coverage.families.every((entry) => entry.directCount >= 2));
});

test('family focus outranks unrelated gaps and skipped or already answered hands do not repeat', () => {
  const { snapshot, evidenceView } = bundle([direct('K9s')]);
  const candidates = rankCalibrationCandidates(snapshot, { intent: 'mapping', mappingFocus: 'suited_kx', mappingEvidenceView: evidenceView,
    skippedHandClasses: ['K8s'], recentQuestionHistory: ['K9s'] });
  assert.ok(candidates[0].handClass.startsWith('K') && candidates[0].handClass.endsWith('s'));
  assert.ok(!candidates.some((entry) => ['K8s', 'K9s'].includes(entry.handClass)));
});

async function application() {
  const values = new Map(); let nextId = 0, time = 0;
  const app = createRangeCalibrationApplication({ database: createMemoryPersonalStrategyDatabase(),
    storage: { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) },
    idFactory: (prefix) => `${prefix}-${++nextId}`, clock: () => new Date(Date.parse('2026-09-05T12:00:00Z') + time++ * 1000) });
  const created = await app.createProfile({ displayName: 'Any poker setup', modeNames: ['My approach'] });
  const selection = { environment: 'custom', tableSize: 6, heroPosition: 'BTN', effectiveStackBb: 100,
    decisionFamily: 'preflop_rfi', actionAware: true, collectionBb: 0, anteType: 'none', anteBb: 0 };
  const scope = { profileId: created.profile.id, modeId: created.modes[0].id, context: createContextFromSelection(selection) };
  const start = { selectedProfileId: scope.profileId, activeModeId: scope.modeId, context: selection, intent: 'mapping' };
  return { app, scope, start };
}

test('application mapping exceeds five decisions, counts Call as direct intent, exposes the same selector and permits early pause/resume', async () => {
  const { app, scope, start } = await application();
  let state = await app.startOrResumeSession(start);
  const asked = [];
  for (let index = 0; index < 8; index += 1) {
    assert.ok(state.prompt);
    asked.push(state.prompt.handClass);
    state = await app.answerCalibrationQuestion(state, { actionType: 'call' });
  }
  assert.equal(new Set(asked).size, 8);
  assert.ok(state.prompt);
  assert.equal(state.progress.coverage.directCount, 8);
  assert.equal(state.progressAssessment.questionBudget, null);
  const projection = await app.getRangeMappingProjection(scope, { recentHands: asked });
  assert.deepEqual(projection.coverage, state.progress.coverage);
  assert.equal(projection.candidates.find((entry) => entry.ordinaryQuestionEligible).handClass, state.prompt.handClass);
  const paused = await app.pauseSession(state);
  assert.equal(paused.prompt, null);
  assert.equal(paused.session.state, 'paused');
  assert.deepEqual(paused.progress.coverage, state.progress.coverage);
  const resumed = await app.startOrResumeSession(start);
  assert.ok(resumed.prompt);
  assert.equal(resumed.prompt.handClass, state.prompt.handClass);
});


test('secondary contextual intent binds this hand and corrections preserve the supplied exact hand scope', async () => {
  const { app, scope } = await application();
  const first = await app.confirmQualitativeIntent(await app.previewQualitativeIntent(scope, {
    text: 'I would call this against weaker players.', handClass: 'K9s',
  }));
  assert.equal(first.statedScope.handClass, 'K9s');
  const corrected = await app.confirmQualitativeIntent(await app.previewQualitativeIntent(scope, {
    text: 'Only against smaller opens.', handClass: first.statedScope.handClass, supersedesEvidenceIds: [first.id],
  }));
  assert.equal(corrected.statedScope.handClass, 'K9s');
  await assert.rejects(app.previewQualitativeIntent(scope, { text: 'Invalid hand', handClass: 'K9x' }), /canonical hand/);
  assert.equal((await app.getEvidenceView(scope)).summary.directlyAnsweredHandCount, 0);
});


test('mapping rejects stale or cross-Approach evidence instead of borrowing coverage', () => {
  const first = bundle([direct('AA')]);
  const later = bundle([direct('KK')]);
  assert.throws(() => createRfiStructuralMappingFacts({ snapshot: first.snapshot, evidenceView: later.evidenceView }), /scope and revision/);
  const foreign = { ...first.evidenceView, scope: { ...first.evidenceView.scope, modeId: 'different-approach' } };
  assert.throws(() => createRfiStructuralMappingFacts({ snapshot: first.snapshot, evidenceView: foreign }), /scope and revision/);
});


test('action-aware conflicts survive the Fold/Raise inference subspace and route to inspection', async () => {
  const { app, scope, start } = await application();
  for (const action of ['call', 'fold']) {
    const observation = createRangeObservation({ id: `conflict-${action}`, ...scope, handClass: 'K9s',
      dominantAction: { type: action }, createdAt: '2026-09-05T12:00:00Z' });
    await app.repository.applySyncedEntity(observation, { entityType: 'range_observation' });
  }
  const projection = await app.getRangeMappingProjection(scope, { focus: 'suited_kx' });
  const candidate = projection.candidates.find((entry) => entry.handClass === 'K9s');
  assert.equal(candidate.questionKind, 'conflict_resolution');
  assert.equal(candidate.ordinaryQuestionEligible, false);
  assert.ok(projection.coverage.conflictHands.includes('K9s'));
  const state = await app.startOrResumeSession({ ...start, focus: 'suited_kx' });
  assert.equal(state.progress.coverage.families.find((entry) => entry.id === 'suited_kx').state, 'conflict');
  assert.equal(state.progressAssessment.stopReason, 'conflict_resolution_needed');
  assert.equal(state.prompt, null);
});
