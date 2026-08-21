import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import { ACTION_TYPES, PREFLOP_HAND_CLASSES } from '../shared/poker-domain/index.js';
import {
  createRangeObservation,
  createRfiCalibrationContext,
} from '../app/src/personal-strategy/domain.mjs';
import { createPersonalStrategyEvidenceView } from '../app/src/personal-strategy/evidence-view.mjs';
import {
  PERSONAL_STRATEGY_ESTIMATE_STATUSES,
  createPersonalStrategySnapshot,
} from '../app/src/personal-strategy/rfi-inference.mjs';
import {
  RFI_CONTEXT_TRANSFER_ESTIMATE_STATES,
  createRfiContextTransferProjection,
  createRfiContextTransferRelationship,
} from '../app/src/personal-strategy/rfi-context-transfer.mjs';
import {
  RFI_PROFILE_READINESS_STATES,
  assessCalibrationProgress,
  assessRfiProfileReadiness,
  getNextCalibrationQuestion,
  rankCalibrationCandidates,
  rfiCalibrationStructuralFamily,
} from '../app/src/personal-strategy/rfi-question-selection.mjs';
import { rangeCal002bFixtureById } from './fixtures/range_cal002b_synthetic_truth.mjs';

const PROFILE_ID = 'playstyle-quick-profile';
const MODE_ID = 'playstyle-quick-mode';
const TARGET_CONTEXT = createRfiCalibrationContext({
  gameRulesId: 'playstyle-quick-profile/v1',
  tableSize: 6,
  heroPosition: 'BTN',
  effectiveStackBb: 100,
});
const DONOR_CONTEXT = createRfiCalibrationContext({
  gameRulesId: 'playstyle-quick-profile/v1',
  tableSize: 6,
  heroPosition: 'BTN',
  effectiveStackBb: 110,
});
let sequence = 0;

function direct(context, handClass, actionType, suffix = '') {
  sequence += 1;
  return createRangeObservation({
    id: `playstyle-${sequence}${suffix}`,
    profileId: PROFILE_ID,
    modeId: MODE_ID,
    context,
    handClass,
    dominantAction: { type: actionType },
    createdAt: `2026-08-21T18:${String(sequence % 60).padStart(2, '0')}:00.000Z`,
  });
}

function snapshot(context = TARGET_CONTEXT, rangeObservations = []) {
  return createPersonalStrategySnapshot(createPersonalStrategyEvidenceView({
    profileId: PROFILE_ID,
    modeId: MODE_ID,
    context,
    rangeObservations,
  }));
}

function adaptiveFixtureProfile(fixtureId, answerLimit) {
  const fixture = rangeCal002bFixtureById(fixtureId);
  const observations = [];
  const askedHandClasses = [];
  let current = snapshot(TARGET_CONTEXT, observations);
  let readiness = assessRfiProfileReadiness(current);
  while (!readiness.profileReady && observations.length < answerLimit) {
    const candidate = getNextCalibrationQuestion(current, {
      recentQuestionHistory: askedHandClasses,
    });
    if (!candidate) break;
    askedHandClasses.push(candidate.handClass);
    observations.push(direct(TARGET_CONTEXT, candidate.handClass, fixture.labels[candidate.handClass]));
    current = snapshot(TARGET_CONTEXT, observations);
    readiness = assessRfiProfileReadiness(current, {
      recentQuestionHistory: askedHandClasses,
    });
  }
  return { fixture, observations, askedHandClasses, snapshot: current, readiness };
}

function transferProjection(targetSnapshot, donorSnapshot) {
  return createRfiContextTransferProjection({
    targetSnapshot,
    relationships: [createRfiContextTransferRelationship({
      profileId: PROFILE_ID,
      modeId: MODE_ID,
      context: DONOR_CONTEXT,
    }, {
      profileId: PROFILE_ID,
      modeId: MODE_ID,
      context: TARGET_CONTEXT,
    })],
    donors: [{
      relationship: createRfiContextTransferRelationship({
        profileId: PROFILE_ID,
        modeId: MODE_ID,
        context: DONOR_CONTEXT,
      }, {
        profileId: PROFILE_ID,
        modeId: MODE_ID,
        context: TARGET_CONTEXT,
      }),
      snapshot: donorSnapshot,
    }],
  });
}

test('smooth adaptive profiles become useful after a bounded quick-profile sample', (t) => {
  const coverage = {};
  for (const fixtureId of ['smooth-tight', 'smooth-loose']) {
    const result = adaptiveFixtureProfile(fixtureId, 30);
    assert.equal(result.readiness.profileReady, true, `${fixtureId}: ${JSON.stringify(result.readiness)}`);
    assert.ok(result.observations.length >= 15, fixtureId);
    assert.ok(result.observations.length <= 30, fixtureId);
    assert.equal(result.readiness.majorUnexploredRegions.length, 0);
    assert.ok(result.readiness.directFamilyCount >= 6);
    assert.ok(result.readiness.modeledOrTransferredCount >= 45);
    assert.ok(
      result.readiness.locallyInferredCount >= result.readiness.directCount * 2,
      `${fixtureId}: sparse direct evidence should produce broad derived coverage`,
    );
    assert.ok(new Set(result.askedHandClasses
      .map(rfiCalibrationStructuralFamily)).size >= 6);
    const inferredInterior = result.snapshot.estimates.find((estimate) => (
      estimate.status === PERSONAL_STRATEGY_ESTIMATE_STATUSES.INFERRED_HIGH
      && estimate.support.regionalInterpolation.state === 'supported_run'
      && !result.askedHandClasses.includes(estimate.handClass)
    ));
    assert.ok(inferredInterior, `${fixtureId}: an obvious interior should be inferred, not queried`);
    const rankedInterior = rankCalibrationCandidates(result.snapshot, {
      recentQuestionHistory: result.askedHandClasses,
    }).find((candidate) => candidate.handClass === inferredInterior.handClass);
    assert.ok(rankedInterior.components.modeledRegionPenalty >= 72);
    assert.equal(rankedInterior.recommendedClarification, false);
    coverage[fixtureId] = {
      direct: result.readiness.directCount,
      inferred: result.readiness.locallyInferredCount,
      transferred: result.readiness.transferredCount,
      uncertain: result.readiness.uncertainCount,
      unknown: result.readiness.visibleUnknownCount,
    };
  }
  t.diagnostic(`synthetic starter-profile coverage: ${JSON.stringify(coverage)}`);
});

test('zero and a few answers remain honestly in the building state', () => {
  const empty = assessRfiProfileReadiness(snapshot());
  assert.equal(empty.state, RFI_PROFILE_READINESS_STATES.BUILDING);
  assert.equal(empty.directCount, 0);
  assert.equal(empty.profileReady, false);
  const fixture = rangeCal002bFixtureById('smooth-tight');
  const few = adaptiveFixtureProfile(fixture.id, 5);
  assert.equal(few.readiness.state, RFI_PROFILE_READINESS_STATES.BUILDING);
  assert.equal(few.readiness.directCount, 5);
  assert.ok(few.readiness.blockerReasonCodes.length > 0);
});

test('irregular evidence abstains at the smooth-profile sample size', () => {
  const result = adaptiveFixtureProfile('irregular-reproducible', 30);
  assert.equal(result.readiness.profileReady, false);
  assert.ok(['mixed', 'unstable'].includes(result.readiness.thresholdBand));
  assert.ok(result.readiness.thresholdsApplied.minimumDirectCount > 15);
});

test('raw answer volume in one family cannot manufacture readiness', () => {
  const oneFamily = PREFLOP_HAND_CLASSES
    .filter((handClass) => rfiCalibrationStructuralFamily(handClass) === 'trash_offsuit')
    .slice(0, 30);
  assert.equal(oneFamily.length, 30);
  const current = snapshot(TARGET_CONTEXT, oneFamily.map((handClass) => (
    direct(TARGET_CONTEXT, handClass, ACTION_TYPES.FOLD)
  )));
  const readiness = assessRfiProfileReadiness(current);
  assert.equal(readiness.profileReady, false);
  assert.equal(readiness.directFamilyCount, 1);
  assert.ok(readiness.majorUnexploredRegions.length > 0);
});

test('stable local inference and strong transfer suppress redundant questions', () => {
  const localEvidence = ['AJs', 'ATs', 'KTs', 'K9s', 'Q9s', 'Q8s', 'J8s']
    .map((handClass) => direct(TARGET_CONTEXT, handClass, ACTION_TYPES.RAISE));
  const localSnapshot = snapshot(TARGET_CONTEXT, localEvidence);
  const inferred = localSnapshot.estimates.find((estimate) => (
    estimate.status === PERSONAL_STRATEGY_ESTIMATE_STATUSES.INFERRED_HIGH
  ));
  assert.ok(inferred);
  const localCandidate = rankCalibrationCandidates(localSnapshot)
    .find((candidate) => candidate.handClass === inferred.handClass);
  assert.equal(localCandidate.recommendedClarification, false);

  const target = snapshot();
  const donorState = snapshot(DONOR_CONTEXT, [
    direct(DONOR_CONTEXT, 'K8s', ACTION_TYPES.RAISE),
  ]);
  const transfer = transferProjection(target, donorState);
  const transferredCandidate = rankCalibrationCandidates(target, { transferProjection: transfer })
    .find((candidate) => candidate.handClass === 'K8s');
  assert.equal(transferredCandidate.transferState, RFI_CONTEXT_TRANSFER_ESTIMATE_STATES.TRANSFERRED);
  assert.equal(transferredCandidate.recommendedClarification, false);
  assert.ok(transferredCandidate.transferPriorityAdjustment < 0);
});

test('compatible transfer increases modeled coverage without becoming durable direct evidence', () => {
  const local = adaptiveFixtureProfile('smooth-tight', 24);
  const unknownHands = local.snapshot.estimates.filter((estimate) => (
    estimate.status === PERSONAL_STRATEGY_ESTIMATE_STATUSES.UNKNOWN
  )).slice(0, 30).map((estimate) => estimate.handClass);
  const donorState = snapshot(DONOR_CONTEXT, unknownHands.map((handClass) => (
    direct(DONOR_CONTEXT, handClass, local.fixture.labels[handClass])
  )));
  const transfer = transferProjection(local.snapshot, donorState);
  const ranked = rankCalibrationCandidates(local.snapshot, { transferProjection: transfer });
  const readiness = assessRfiProfileReadiness(local.snapshot, {
    transferProjection: transfer,
    rankedCandidates: ranked,
  });
  assert.ok(readiness.transferredCount > 0);
  assert.ok(readiness.modeledOrTransferredCount > local.readiness.modeledOrTransferredCount);
  assert.equal(readiness.directCount, local.observations.length);
  assert.equal(local.snapshot.summary.directlyKnownCount, local.observations.length);
  assert.equal(readiness.profileReady, true);
});

test('regional interpolation preserves an unusual hole and leaves unsupported shapes unknown', () => {
  const observations = [
    direct(TARGET_CONTEXT, 'AKs', ACTION_TYPES.RAISE),
    direct(TARGET_CONTEXT, 'QJs', ACTION_TYPES.FOLD),
    direct(TARGET_CONTEXT, 'T9s', ACTION_TYPES.RAISE),
    direct(TARGET_CONTEXT, '87s', ACTION_TYPES.FOLD),
  ];
  const current = snapshot(TARGET_CONTEXT, observations);
  const gap = current.estimates.find((estimate) => (
    estimate.status === PERSONAL_STRATEGY_ESTIMATE_STATUSES.UNCERTAIN
    && estimate.reasons.includes('regional_order_discontinuity')
  ));
  assert.ok(gap, 'a direct non-monotonic hole creates an abstention corridor');
  assert.equal(current.estimates.find((estimate) => estimate.handClass === 'QJs').dominantAction.type, ACTION_TYPES.FOLD);
  assert.equal(current.estimates.find((estimate) => estimate.handClass === 'T9s').dominantAction.type, ACTION_TYPES.RAISE);
  assert.equal(
    current.estimates.find((estimate) => estimate.handClass === '72o').status,
    PERSONAL_STRATEGY_ESTIMATE_STATUSES.UNKNOWN,
  );
  const ranked = rankCalibrationCandidates(current);
  const gapCandidate = ranked.find((candidate) => candidate.handClass === gap.handClass);
  const modeledInterior = ranked.find((candidate) => candidate.components.modeledRegionPenalty > 0);
  assert.ok(gapCandidate.boundaryLikelihood === 'high');
  if (modeledInterior) assert.ok(gapCandidate.rank < modeledInterior.rank);
});

test('inference remains derived and never invents durable evidence', () => {
  const result = adaptiveFixtureProfile('smooth-tight', 18);
  const durableIds = new Set(result.observations.map((observation) => observation.id));
  assert.equal(result.snapshot.summary.directlyKnownCount, result.observations.length);
  assert.ok(result.snapshot.summary.inferredHighCount + result.snapshot.summary.inferredMediumCount > 0);
  for (const estimate of result.snapshot.estimates) {
    assert.ok(estimate.sourceEvidenceIds.every((evidenceId) => durableIds.has(evidenceId)));
  }
  assert.equal(result.snapshot.comboOverrides.length, 0);
  assert.equal(JSON.stringify(result.snapshot).includes('range-observation/v1'), false);
});

test('donor disagreement becomes a bounded active clarification without re-asking direct hands', () => {
  const smooth = adaptiveFixtureProfile('smooth-tight', 20);
  const local = smooth.snapshot.estimates.find((estimate) => (
    [
      PERSONAL_STRATEGY_ESTIMATE_STATUSES.INFERRED_HIGH,
      PERSONAL_STRATEGY_ESTIMATE_STATUSES.INFERRED_MEDIUM,
    ].includes(estimate.status) && estimate.dominantAction
  ));
  assert.ok(local);
  const opposite = local.dominantAction.type === ACTION_TYPES.RAISE
    ? ACTION_TYPES.FOLD : ACTION_TYPES.RAISE;
  const donorState = snapshot(DONOR_CONTEXT, [
    direct(DONOR_CONTEXT, local.handClass, opposite),
    direct(DONOR_CONTEXT, smooth.observations[0].handClass, opposite),
  ]);
  const transfer = transferProjection(smooth.snapshot, donorState);
  const ranked = rankCalibrationCandidates(smooth.snapshot, { transferProjection: transfer });
  const disagreement = ranked.find((candidate) => candidate.handClass === local.handClass);
  assert.equal(disagreement.transferDisagreement, true);
  assert.equal(disagreement.recommendedClarification, true);
  assert.equal(ranked.some((candidate) => (
    candidate.handClass === smooth.observations[0].handClass
  )), false, 'direct target evidence remains excluded from ordinary ranking');
});

test('readiness is deterministic, derived-only, and exposes a compact clarification queue', () => {
  const result = adaptiveFixtureProfile('smooth-loose', 30);
  const before = JSON.stringify(result.snapshot);
  const ranked = rankCalibrationCandidates(result.snapshot);
  const first = assessRfiProfileReadiness(result.snapshot, { rankedCandidates: ranked });
  const second = assessRfiProfileReadiness(result.snapshot, { rankedCandidates: ranked });
  assert.deepEqual(first, second);
  assert.equal(JSON.stringify(result.snapshot), before);
  assert.ok(first.recommendedClarificationCount <= 6);
  assert.equal(first.nextClarificationPriorities.length, first.recommendedClarificationCount);
  const refining = assessCalibrationProgress(result.snapshot, {
    rankedCandidates: ranked,
    refinementActive: true,
    refinementBatchRemaining: first.recommendedClarificationCount,
  });
  assert.equal(refining.profileReadiness.state, RFI_PROFILE_READINESS_STATES.REFINING);
  assert.equal(refining.shouldStop, first.recommendedClarificationCount === 0);
});

test('starter checkpoint copy has no 169-completion or remaining-cells semantics', () => {
  const html = fs.readFileSync(new URL('../app/index.html', import.meta.url), 'utf8');
  const start = html.indexOf('id="calibrationCompleteState"');
  const end = html.indexOf('<div class="calibration-personal-column">', start);
  const checkpoint = html.slice(start, end);
  assert.match(checkpoint, /Your starter profile is ready/);
  assert.match(checkpoint, /Direct answers/);
  assert.match(checkpoint, /Modeled hands/);
  assert.match(checkpoint, /Uncertain regions/);
  assert.match(checkpoint, /Recommended clarifications/);
  assert.match(checkpoint, /Review profile/);
  assert.match(checkpoint, /Continue refining/);
  assert.match(checkpoint, /Stop for now/);
  assert.doesNotMatch(checkpoint, /169|remaining cells|complete all/i);
});

test('unresolved direct contradictions block readiness and outrank ordinary clarification', () => {
  const evidence = [
    direct(TARGET_CONTEXT, 'K9s', ACTION_TYPES.RAISE, '-raise'),
    direct(TARGET_CONTEXT, 'K9s', ACTION_TYPES.FOLD, '-fold'),
  ];
  const current = snapshot(TARGET_CONTEXT, evidence);
  const readiness = assessRfiProfileReadiness(current);
  assert.equal(readiness.state, RFI_PROFILE_READINESS_STATES.CONFLICTED);
  assert.equal(readiness.profileReady, false);
  assert.equal(readiness.nextClarificationPriorities[0].handClass, 'K9s');
  assert.equal(assessCalibrationProgress(current).shouldStop, true);
});

test('readiness remains isolated when the user switches RFI scope', () => {
  const readyScope = adaptiveFixtureProfile('smooth-loose', 30);
  const otherContext = createRfiCalibrationContext({
    gameRulesId: 'playstyle-quick-profile/v1',
    tableSize: 6,
    heroPosition: 'CO',
    effectiveStackBb: 100,
  });
  const otherScope = assessRfiProfileReadiness(snapshot(otherContext));
  assert.equal(readyScope.readiness.profileReady, true);
  assert.equal(otherScope.profileReady, false);
  assert.equal(otherScope.directCount, 0);
  assert.notEqual(readyScope.snapshot.scope.contextKey, snapshot(otherContext).scope.contextKey);
});
