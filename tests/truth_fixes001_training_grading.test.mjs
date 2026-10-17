import test from 'node:test';
import assert from 'node:assert/strict';
import { deriveDecisionContextFromPokerState } from '../app/src/application/decision-context-from-poker-state.mjs';
import { createPreflopRoleAuditFixtures } from './fixtures/preflop-role001-fixtures.mjs';
import { createStrategyProvider } from '../app/src/application/strategy-provider.mjs';
import { resolveHeuristicStrategy } from '../app/src/strategy/heuristic-strategy.mjs';
import { createStrategySourceDescriptor, createStrategySourceAcceptanceRegistry } from '../app/src/application/strategy-source-authority.mjs';
import { ASSESSMENT_POLICY_VERSION, assessmentContextIdentity, createAssessmentPolicyAcceptanceRegistry } from '../app/src/application/strategy-assessment-policy.mjs';
import { strategyTruthPresentation, summarizeStrategyTruth } from '../app/src/application/strategy-truth.mjs';
import { evaluateTrainingAnswer } from '../app/src/application/training-answer-evaluation.mjs';
import { createTrainingStrategyEvidence, TRAINING_COMPARISON_STATES } from '../app/src/training-memory/domain.mjs';

const state = createPreflopRoleAuditFixtures().bbVsButtonOpen;
const ctx = deriveDecisionContextFromPokerState(state, state.actingPlayerId);
const answer = (result, type, amountBb = null) => evaluateTrainingAnswer({
  exerciseId: 'truth-fixes-001', chosenActionType: type, chosenAction: { type, amountBb }, strategyResult: result, decisionContext: ctx,
});

function heuristicResult() {
  return createStrategyProvider({ fallbackResolver: resolveHeuristicStrategy }).resolve(ctx);
}

function normativeResult() {
  const descriptor = createStrategySourceDescriptor({ id: 'truth_fixes_test_only', version: 'v1', displayName: 'Test only', family: 'reference_pack', authority: 'validated_reference',
    capabilities: { actionDistribution: 'exact', actionSizing: 'complete', grading: 'normative', actionEv: false, optimality: false }, defaultCoverage: 'unsupported' });
  const sourceAcceptanceRegistry = createStrategySourceAcceptanceRegistry([{ sourceId: descriptor.id, allowedFamily: descriptor.family, acceptedVersion: 'v1', acceptedFingerprint: 'test-only',
    acceptedAuthority: descriptor.authority, acceptedCapabilities: descriptor.capabilities, acceptedCoverageCeiling: 'exact', validationStatus: 'test-only' }]);
  const criterion = { schemaVersion: ASSESSMENT_POLICY_VERSION, id: 'action-set-test-only', version: 'v1', acceptanceDecisionId: 'test-only',
    sourceId: descriptor.id, sourceVersion: 'v1', sourceFingerprint: 'test-only', contextIdentity: assessmentContextIdentity(ctx),
    criterion: 'positive_probability_action_set/v1', sizingSemantics: 'exact_total_to', missingUniverseMember: 'explicit_zero_support',
    requiredCapabilities: { actionDistribution: 'exact', grading: 'normative', actionSizing: 'complete' },
    actionUniverse: [{ type: 'fold' }, { type: 'call' }, { type: 'raise', amountBb: 11 }, { type: 'all_in', amountBb: ctx.allInToBb }],
    ambiguousActionKeys: [], claimPermissions: { supported: true, unsupported: true, remediation: true } };
  return createStrategyProvider({ sourceAcceptanceRegistry, assessmentPolicyRegistry: createAssessmentPolicyAcceptanceRegistry([criterion]),
    fallbackResolver: () => ({ source: descriptor.id, sourceDescriptor: descriptor, provenance: { contentHash: 'test-only' }, contextCoverage: { kind: 'exact' },
      actions: [{ action: { type: 'raise', amountBb: 11 }, probability: 0.7 }, { action: { type: 'call' }, probability: 0.3 }] }) }).resolve(ctx);
}

test('heuristic disagreement is a descriptive comparison, never a mistake, score or error tone', () => {
  const result = heuristicResult();
  const outside = result.actions.reduce((low, entry) => (entry.probability < low.probability ? entry : low));
  const types = new Set(['fold', 'call', 'raise', 'all_in', outside.action.type]);
  const seen = new Set();
  for (const type of types) {
    const evaluation = answer(result, type, type === 'raise' ? 11 : null);
    assert.equal(evaluation.truth.state, 'heuristic_comparison');
    assert.equal(evaluation.grade, null, `${type} must not be graded against a heuristic`);
    assert.equal(Object.hasOwn(evaluation, 'comparisonGrade'), false);
    assert.equal(Object.hasOwn(evaluation, 'comparisonAccepted'), false);
    assert.ok(['matches', 'close', 'differs'].includes(evaluation.comparison));
    assert.equal(evaluation.accepted, false);
    assert.equal(evaluation.scoreDelta, 0);
    assert.equal(evaluation.truth.claims.mistake, false);
    const presentation = strategyTruthPresentation(evaluation.truth);
    assert.equal(presentation.tone, 'neutral');
    assert.equal(presentation.audio, 'neutral');
    assert.doesNotMatch(presentation.title, /mistake|wrong|incorrect|error/i);
    const evidence = createTrainingStrategyEvidence({ strategyResult: result, claimPolicy: evaluation.truth.claimPolicy, evaluation });
    assert.notEqual(evidence.comparisonState, TRAINING_COMPARISON_STATES.DIFFERS_FROM_REFERENCE);
    assert.equal(evidence.internalEvaluation.grade, null);
    seen.add(evaluation.comparison);
  }
  assert.ok(seen.has('differs'), 'fixture must include an action outside the baseline mix');
  const summary = summarizeStrategyTruth([...types].map((type) => answer(result, type, type === 'raise' ? 11 : null).truth));
  assert.equal(summary.groups.heuristic_comparison.unsupported, 0);
  assert.equal(summary.groups.normative_assessment.attempts, 0);
});

test('normative assessments keep optimal and mistake grades exactly as the truth model allows', () => {
  const result = normativeResult();
  const supported = answer(result, 'raise', 11);
  assert.equal(supported.truth.state, 'normative_assessment');
  assert.equal(supported.grade, 'optimal');
  assert.equal(supported.accepted, true);
  assert.equal(supported.scoreDelta, 1);
  const unsupported = answer(result, 'fold');
  assert.equal(unsupported.truth.state, 'normative_assessment');
  assert.equal(unsupported.truth.outcome, 'unsupported');
  assert.equal(unsupported.grade, unsupported.truth.claims.mistake ? 'mistake' : null);
  assert.equal(unsupported.accepted, false);
  assert.equal(unsupported.scoreDelta, 0);
  assert.equal(unsupported.comparison, 'differs');
  assert.equal(strategyTruthPresentation(unsupported.truth).tone, 'error');
});

test('legacy stored comparison grades still map to descriptive Training Memory states', () => {
  const result = normativeResult();
  const current = answer(result, 'fold');
  const policy = current.truth.claimPolicy;
  const legacy = { ...structuredClone(current), comparisonGrade: 'mistake' };
  delete legacy.comparison;
  delete legacy.truth;
  assert.equal(createTrainingStrategyEvidence({ strategyResult: result, claimPolicy: policy, evaluation: current }).comparisonState,
    createTrainingStrategyEvidence({ strategyResult: result, claimPolicy: policy, evaluation: legacy }).comparisonState);
});
