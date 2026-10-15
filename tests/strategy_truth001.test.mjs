import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { deriveDecisionContextFromPlaybookScenario } from '../app/src/application/playbook-state-source.mjs';
import { deriveDecisionContextFromPokerState } from '../app/src/application/decision-context-from-poker-state.mjs';
import { createPreflopRoleAuditFixtures } from './fixtures/preflop-role001-fixtures.mjs';
import { createStrategyProvider } from '../app/src/application/strategy-provider.mjs';
import { createStrategyResult, createUnavailableStrategyResult } from '../app/src/application/strategy-result.mjs';
import { resolveHeuristicStrategy } from '../app/src/strategy/heuristic-strategy.mjs';
import { resolveStrategyClaimPolicy, STRATEGY_CLAIMS } from '../app/src/application/strategy-claim-policy.mjs';
import { createStrategySourceDescriptor, createStrategySourceAcceptanceRegistry } from '../app/src/application/strategy-source-authority.mjs';
import { ASSESSMENT_POLICY_VERSION, assessmentContextIdentity, createAssessmentPolicyAcceptanceRegistry } from '../app/src/application/strategy-assessment-policy.mjs';
import { projectStrategyTruth, historicalStrategyTruth, summarizeStrategyTruth, strategyTruthPresentation } from '../app/src/application/strategy-truth.mjs';
import { evaluateTrainingAnswer } from '../app/src/application/training-answer-evaluation.mjs';
import { createTrainingStrategyEvidence } from '../app/src/training-memory/domain.mjs';
import { trainingStudyAudioMeaning } from '../app/src/application/experience-events.mjs';
import { applyChance, CHANCE_TYPES, GAME_MODES, createGameRulesSnapshotFromLegacyGameConfiguration, initializeHandFromGameRulesSnapshot } from '../shared/poker-domain/index.js';
import { TRAINING_BASIC_TUTORIAL_DEFINITION, TRAINING_FEEDBACK_TUTORIAL_DEFINITION } from '../app/src/tutorial/current-app-tutorials.mjs';
import { validatedHistoricalTruth } from '../app/src/application/strategy-truth.mjs';
import { appStyleSheet, bootApp, indexDocument, precedes } from './helpers/app-under-test.mjs';

// Use the actual actor from the canonical fixture, independently of seat labels.
const state = createPreflopRoleAuditFixtures().bbVsButtonOpen;
const ctx = deriveDecisionContextFromPokerState(state, state.actingPlayerId);
function fixture({ assessment = true, coverage = 'exact', policyChanges = {}, sourceChanges = {}, actions } = {}) {
  const descriptor = createStrategySourceDescriptor({ id: 'truth_test_only', version: 'v1', displayName: 'Test only', family: 'reference_pack', authority: 'validated_reference',
    capabilities: { actionDistribution: 'exact', actionSizing: 'complete', grading: 'normative', actionEv: false, optimality: false }, defaultCoverage: 'unsupported' });
  const sourceAcceptanceRegistry = createStrategySourceAcceptanceRegistry([{ sourceId: descriptor.id, allowedFamily: descriptor.family, acceptedVersion: 'v1', acceptedFingerprint: 'test-only', acceptedAuthority: descriptor.authority, acceptedCapabilities: descriptor.capabilities, acceptedCoverageCeiling: 'exact', validationStatus: 'test-only', ...sourceChanges }]);
  const criterion = { schemaVersion: ASSESSMENT_POLICY_VERSION, id: 'action-set-test-only', version: 'v1', acceptanceDecisionId: 'test-only',
    sourceId: descriptor.id, sourceVersion: 'v1', sourceFingerprint: 'test-only', contextIdentity: assessmentContextIdentity(ctx),
    criterion: 'positive_probability_action_set/v1', sizingSemantics: 'exact_total_to', missingUniverseMember: 'explicit_zero_support',
    requiredCapabilities: { actionDistribution: 'exact', grading: 'normative', actionSizing: 'complete' },
    actionUniverse: [{ type: 'fold' }, { type: 'call' }, { type: 'raise', amountBb: 11 }, { type: 'all_in', amountBb: ctx.allInToBb }],
    ambiguousActionKeys: [], claimPermissions: { supported: true, unsupported: true, remediation: true }, ...policyChanges };
  const provider = createStrategyProvider({ sourceAcceptanceRegistry,
    assessmentPolicyRegistry: assessment ? createAssessmentPolicyAcceptanceRegistry([criterion]) : null,
    fallbackResolver: () => ({ source: descriptor.id, sourceDescriptor: descriptor, provenance: { contentHash: 'test-only' }, contextCoverage: { kind: coverage },
      actions: actions ?? [{ action: { type: 'raise', amountBb: 11 }, probability: 0.7 }, { action: { type: 'call' }, probability: 0.3 }] }) });
  return { result: provider.resolve(ctx), provider, criterion };
}
const answer = (result, type, amountBb) => evaluateTrainingAnswer({ exerciseId: 'truth-test', chosenActionType: type, chosenAction: { type, amountBb }, strategyResult: result, decisionContext: ctx });

test('assessment never exceeds an individual accepted source claim ceiling, including historical re-drill', () => {
  for (const denied of ['objective_correctness', 'mistake', 'recommendation', 'normative_grading', 'comparative_grading', 'strategy_presentation']) {
    const { result } = fixture({ sourceChanges: { acceptedClaimClasses: Object.values(STRATEGY_CLAIMS).filter(key => key !== denied) } });
    const policy = resolveStrategyClaimPolicy(result);
    assert.equal(policy.claims[denied], false);
    for (const type of ['call', 'fold']) {
      const evaluation = answer(result, type), truth = evaluation.truth;
      if (denied === 'objective_correctness' || denied === 'mistake' && type === 'fold') assert.equal(evaluation.grade, null);
      if (denied !== 'recommendation') {
        assert.equal(truth.claims.mistake, false, denied);
        assert.equal(truth.claims.remediation, false, denied);
        assert.equal(truth.learningEligibility.remediation, false);
        if (denied !== 'mistake') {
          assert.equal(truth.claims.correct, false);
          assert.equal(truth.claims.incorrect, false);
          assert.equal(strategyTruthPresentation(truth).tone, 'neutral');
        }
      }
      const stored = JSON.parse(JSON.stringify(createTrainingStrategyEvidence({ strategyResult: result, claimPolicy: policy, evaluation })));
      const replayed = historicalStrategyTruth(stored, { chosenAction: { type }, decisionContext: ctx });
      assert.deepEqual(replayed.claims, truth.claims);
      assert.equal(replayed.claimPolicy.claims[denied], false);
    }
  }
  const { result } = fixture({ policyChanges: { claimPermissions: { supported: true, unsupported: true, remediation: false } } });
  assert.equal(answer(result, 'fold').truth.claims.remediation, false);
});

test('A2o HU 60bb stays deterministic Fold 100%, with baseline-only permissions and neutral presentation', () => {
  const provider = createStrategyProvider({ fallbackResolver: resolveHeuristicStrategy });
  for (const a of ['s', 'h', 'd', 'c']) for (const b of ['s', 'h', 'd', 'c'].filter((s) => s !== a)) {
    const dc = deriveDecisionContextFromPlaybookScenario({ tableSize: 2, heroPosition: 'BTN', heroCards: [`A${a}`, `2${b}`], board: [], deadCards: [], stackBb: 60, stackMode: 'hero', potBb: 1.5, lastAction: 'unopened', facingSizeBb: 0, rakeMode: 'off', ante: 0 });
    const result = provider.resolve(dc);
    assert.deepEqual(provider.resolve(dc), result);
    assert.equal(result.actions[0].action.type, 'fold'); assert.equal(result.actions[0].probability, 1);
    assert.equal(result.details.legacyHandStrength, -7);
    const policy = resolveStrategyClaimPolicy(result);
    for (const claim of ['reference_match', 'reference_deviation', 'recommendation', 'normative_grading', 'accuracy', 'mistake']) assert.equal(policy.claims[claim], false, claim);
    for (const type of ['fold', 'raise']) {
      const evaluation = evaluateTrainingAnswer({ exerciseId: 'a2o', chosenActionType: type, strategyResult: result, decisionContext: dc });
      assert.equal(evaluation.truth.state, 'heuristic_comparison'); assert.equal(evaluation.truth.claims.correct, false);
      assert.equal(evaluation.truth.learningEligibility.remediation, false); assert.equal(evaluation.scoreDelta, 0);
      const view = strategyTruthPresentation(evaluation.truth);
      assert.match(view.title, /heuristic baseline/); assert.equal(view.tone, 'neutral'); assert.equal(view.audio, 'neutral');
    }
  }
});

test('accepted source alone is reference comparison; accepted action-set supports both 70% and 30%', () => {
  const noCriterion = fixture({ assessment: false }).result;
  assert.equal(resolveStrategyClaimPolicy(noCriterion).claims.normative_grading, false);
  assert.equal(answer(noCriterion, 'call').truth.state, 'accepted_reference_comparison');
  const { result } = fixture();
  for (const [type, size] of [['raise', 11], ['call', null]]) {
    const evaluation = answer(result, type, size);
    assert.equal(evaluation.truth.state, 'normative_assessment'); assert.equal(evaluation.truth.outcome, 'supported');
    assert.equal(evaluation.truth.learningEligibility.remediation, false);
    assert.equal(evaluation.truth.claims.evLoss, false); assert.equal(evaluation.truth.claims.retention, false);
  }
  const unsupported = answer(result, 'fold');
  assert.equal(unsupported.truth.outcome, 'unsupported'); assert.equal(unsupported.truth.learningEligibility.remediation, true);
  assert.equal(answer(noCriterion, 'fold').truth.outcome, 'unassessed');
});

test('missing size, out-of-tree action, explicit ambiguous boundary, source and context mismatch fail closed', () => {
  const { result, provider } = fixture();
  for (const evaluation of [answer(result, 'raise'), answer(result, 'raise', 12), answer(result, 'check')]) {
    assert.notEqual(evaluation.truth.state, 'normative_assessment'); assert.equal(evaluation.truth.claims.mistake, false);
  }
  assert.notEqual(answer(fixture({ policyChanges: { ambiguousActionKeys: ['call:-'] } }).result, 'call').truth.state, 'normative_assessment');
  const wrongContext = { ...ctx, effectiveStackBb: ctx.effectiveStackBb - 1 };
  const wrong = provider.resolve(wrongContext);
  assert.equal(resolveStrategyClaimPolicy(wrong).claims.normative_grading, false);
  assert.equal(resolveStrategyClaimPolicy(fixture({ sourceChanges: { acceptedFingerprint: 'different' } }).result).claims.normative_grading, false);
  assert.notEqual(projectStrategyTruth({ strategyResult: result, chosenAction: { type: 'call' }, decisionContext: wrongContext }).state, 'normative_assessment');
  assert.notEqual(projectStrategyTruth({ strategyResult: result, chosenAction: { type: 'raise', amountBb: 11, potFraction: 0.5 }, decisionContext: ctx }).state, 'normative_assessment');
  for (const coverage of ['generalized', 'unsupported']) assert.equal(answer(fixture({ coverage }).result, 'call').truth.state, 'unassessed');
});

test('forged or cloned live authority cannot become normative; malformed exact distributions fail closed', () => {
  const { result, criterion } = fixture();
  const cloned = structuredClone(result);
  assert.equal(resolveStrategyClaimPolicy(cloned).claims.normative_grading, false);
  assert.equal(projectStrategyTruth({ strategyResult: cloned, chosenAction: { type: 'call' }, decisionContext: ctx }).state, 'unassessed');
  assert.equal(fixture({ actions: [{ action: { type: 'call' }, probability: 30 }] }).result.source, 'unavailable');
  assert.throws(() => createAssessmentPolicyAcceptanceRegistry([{ ...criterion, ambiguousActionKeys: ['invented'] }]));
});

test('historical snapshots round-trip without source upgrades; legacy grades never become normative', () => {
  const { result } = fixture({ assessment: false });
  const evaluation = answer(result, 'call');
  const evidence = createTrainingStrategyEvidence({ strategyResult: result, claimPolicy: resolveStrategyClaimPolicy(result), evaluation });
  const stored = JSON.parse(JSON.stringify(evidence)); const before = JSON.stringify(stored);
  fixture(); // A stronger current registration has no bearing on the old answer.
  assert.equal(historicalStrategyTruth(stored).state, 'accepted_reference_comparison');
  assert.equal(historicalStrategyTruth(stored, { chosenAction: { type: 'call' }, decisionContext: ctx }).state, 'accepted_reference_comparison');
  assert.equal(JSON.stringify(stored), before);
  delete stored.internalEvaluation.truth; stored.claimPolicy.claims.normative_grading = true;
  assert.notEqual(historicalStrategyTruth(stored).state, 'normative_assessment');
  const normative = fixture().result; const assessed = answer(normative, 'call');
  const frozen = JSON.parse(JSON.stringify(createTrainingStrategyEvidence({ strategyResult: normative, claimPolicy: assessed.truth.claimPolicy, evaluation: assessed })));
  assert.equal(historicalStrategyTruth(frozen, { chosenAction: { type: 'raise', amountBb: 11 }, decisionContext: ctx }).outcome, 'supported');
});

test('summary categories and non-normative sound remain separate', () => {
  const dc = deriveDecisionContextFromPlaybookScenario({ tableSize: 2, heroPosition: 'BTN', heroCards: ['As', '2h'], board: [], deadCards: [], stackBb: 60, potBb: 1.5, lastAction: 'unopened', rakeMode: 'off' });
  const heuristic = projectStrategyTruth({ strategyResult: createStrategyProvider({ fallbackResolver: resolveHeuristicStrategy }).resolve(dc), chosenAction: { type: 'fold' } });
  const summary = summarizeStrategyTruth([heuristic, answer(fixture({ assessment: false }).result, 'call').truth,
    answer(fixture().result, 'call').truth, projectStrategyTruth({ strategyResult: createUnavailableStrategyResult() })]);
  for (const group of Object.values(summary.groups)) assert.equal(group.attempts, 1);
  for (const feedbackSemantics of ['heuristic_comparison', 'accepted_reference_comparison', 'unassessed', 'comparative', 'normative']) {
    assert.equal(trainingStudyAudioMeaning({ comparisonState: 'mistake', feedbackSemantics }), 'neutral');
  }
});

test('canonical HU BTN A2o 60bb has the same fold-only baseline as Scenario', () => {
  const rulesSnapshot = createGameRulesSnapshotFromLegacyGameConfiguration({ mode: GAME_MODES.HOME,
    smallBlindMilliBb: 500, bigBlindMilliBb: 1000, chipUnitMilliBb: 100, ante: { type: 'none', amountMilliBb: 0 } }, 2);
  const dealt = applyChance(initializeHandFromGameRulesSnapshot({ handId: 'a2o-truth', rulesSnapshot, buttonSeat: 0,
    players: [{ playerId: 'hero', seat: 0, startingStackMilliBb: 60000 }, { playerId: 'opponent', seat: 1, startingStackMilliBb: 60000 }] }),
  { type: CHANCE_TYPES.DEAL_HOLE, cardsByPlayer: { hero: ['As', '2h'], opponent: ['Kc', 'Qd'] } });
  const context = deriveDecisionContextFromPokerState(dealt, 'hero');
  assert.equal(context.heroPosition, 'BTN');
  const result = createStrategyProvider({ fallbackResolver: resolveHeuristicStrategy }).resolve(context);
  assert.deepEqual(result.actions.map((a) => [a.action.type, a.probability]), [['fold', 1]]);
  assert.equal(projectStrategyTruth({ strategyResult: result, chosenAction: { type: 'fold' }, decisionContext: context }).state, 'heuristic_comparison');
});

test('denied claim permissions and incompatible representations cannot leak through presentation, sound or metrics', () => {
  const denied = fixture({ policyChanges: { claimPermissions: { supported: false, unsupported: false, remediation: true } } }).result;
  const policy = resolveStrategyClaimPolicy(denied);
  for (const claim of ['objective_correctness', 'mistake', 'accuracy', 'optimality', 'ev_loss', 'normative_curriculum_weighting']) assert.equal(policy.claims[claim], false, claim);
  for (const type of ['call', 'fold']) {
    const truth = answer(denied, type).truth;
    assert.equal(truth.claims.remediation, false);
    assert.equal(strategyTruthPresentation(truth).tone, 'neutral');
    assert.equal(trainingStudyAudioMeaning({ truth }), 'neutral');
    const group = summarizeStrategyTruth([truth]).groups.normative_assessment;
    assert.equal(group.supported + group.unsupported, 0);
  }
  for (const actions of [
    [{ action: { type: 'call' }, probability: 0.7 }, { action: { type: 'call' }, probability: 0.3 }],
    [{ action: { type: 'raise', amountBb: 11, potFraction: 0.5 }, probability: 1 }],
  ]) assert.equal(resolveStrategyClaimPolicy(fixture({ actions }).result).claims.normative_grading, false);
  assert.throws(() => fixture({ policyChanges: { requiredCapabilities: { grading: 'normative', actionDistribution: 'exact' } } }), /sizing/);
  const restricted = fixture({ assessment: false, sourceChanges: { acceptedCapabilities: { actionDistribution: 'exact', actionSizing: 'complete', grading: 'none', actionEv: false, optimality: false } } }).result;
  assert.equal(resolveStrategyClaimPolicy(restricted).claims.reference_match, false);
  const truth = answer(restricted, 'call').truth;
  assert.equal(truth.state, 'accepted_reference_comparison');
  assert.equal(truth.comparison.kind, null);
  assert.equal(strategyTruthPresentation(truth).title, 'Selected reference');
});

test('inconsistent and minimal historical snapshots fail closed without upgrading or rewriting', () => {
  const result = fixture().result;
  const evaluation = answer(result, 'call');
  const evidence = JSON.parse(JSON.stringify(createTrainingStrategyEvidence({ strategyResult: result, claimPolicy: evaluation.truth.claimPolicy, evaluation })));
  assert.equal(validatedHistoricalTruth(evidence).outcome, 'supported');
  evidence.internalEvaluation.truth.outcome = 'unsupported';
  assert.equal(validatedHistoricalTruth(evidence), null);
  assert.notEqual(historicalStrategyTruth(evidence).state, 'normative_assessment');
  evidence.internalEvaluation.truth = { schemaVersion: 'strategy-truth/v1', state: 'normative_assessment' };
  assert.equal(validatedHistoricalTruth(evidence), null);
  assert.notEqual(historicalStrategyTruth(evidence).state, 'normative_assessment');
});

test('shared feedback renders neutral heuristic state and translates every truth/tutorial label in EN/RU/HE', async () => {
  const sandbox = { window: {} };
  for (const file of ['product-translations.js', 'tutorial-translations.js']) vm.runInNewContext(fs.readFileSync(new URL(`../app/src/locales/${file}`, import.meta.url), 'utf8'), sandbox);
  const product = sandbox.window.riverlineProductTranslations;
  const tutorial = sandbox.window.riverlineTutorialTranslations;
  const keys = new Set();
  for (const state of ['unassessed', 'heuristic_comparison', 'accepted_reference_comparison', 'normative_assessment']) {
    for (const kind of ['matches', 'close', 'differs']) {
      for (const outcome of ['supported', 'unsupported']) {
        const view = strategyTruthPresentation({ state, outcome, comparison: { kind }, claims: { correct: true, incorrect: true, reference: state.includes('reference') } });
        for (const name of ['title', 'sourceLabel', 'description']) keys.add(view[name]);
      }
    }
  }
  // TEST-HYGIENE-001: the feedback summary renders in the booted app (instead
  // of a vm-sliced logic.js function); styles and markup are checked through
  // the cascade and the parsed document.
  const app = await bootApp();
  await app.navigate('training');
  for (const locale of ['en', 'ru', 'he']) {
    for (const key of keys) assert.ok(product[locale][key], `${locale}: ${key}`);
    for (const definition of [TRAINING_BASIC_TUTORIAL_DEFINITION, TRAINING_FEEDBACK_TUTORIAL_DEFINITION]) {
      for (const key of [definition.titleKey, definition.descriptionKey, ...definition.steps.flatMap((s) => [s.titleKey, s.bodyKey])]) assert.ok(tutorial[locale][key], `${locale}: ${key}`);
    }
    app.window.setLanguage(locale);
    const truth = { state: 'heuristic_comparison', outcome: 'unassessed', claims: {}, comparison: { kind: 'differs' } };
    const evaluation = { truth, chosenAction: { type: 'call' }, chosenProbability: 0.3, bestProbability: 0.7, bestStrategyAction: { label: 'Raise' } };
    const exercise = { decisionContext: {} };
    app.byId('trainingScoreBadge').hidden = false;
    app.byId('trainingEvFact').hidden = false;
    app.call('renderTrainingEvaluationSummary', evaluation, exercise);
    assert.equal(app.byId('trainingGradeBadge').textContent, product[locale]['Differs from heuristic baseline']);
    assert.match(app.byId('trainingGradeBadge').className, /--neutral$/);
    assert.equal(app.byId('trainingFeedback').dataset.truthState, 'heuristic_comparison');
    assert.equal(app.byId('trainingScoreBadge').hidden, true);
    assert.equal(app.byId('trainingEvFact').hidden, true);
    evaluation.chosenProbability = evaluation.bestProbability = null;
    app.call('renderTrainingEvaluationSummary', evaluation, exercise);
    assert.doesNotMatch(app.byId('trainingBestProbability').textContent, /0%/);
  }
  app.window.setLanguage('en');
  // Non-normative feedback uses the neutral (info) surface; normative does not.
  const css = appStyleSheet();
  const feedback = app.byId('trainingFeedback');
  assert.equal(css.cascaded(feedback, 'border-inline-start-color'), 'var(--status-info)');
  feedback.dataset.truthState = 'normative_assessment';
  assert.notEqual(css.cascaded(feedback, 'border-inline-start-color'), 'var(--status-info)');
  // Hand review card rows stay LTR (card order) in RTL.
  const markup = indexDocument();
  const row = markup.createElement('div');
  row.className = 'hand-review-card-row';
  markup.body.appendChild(row);
  markup.documentElement.setAttribute('dir', 'rtl');
  try {
    assert.equal(css.cascaded(row, 'direction'), 'ltr');
    assert.equal(css.cascaded(row, 'justify-content'), 'flex-end');
  } finally {
    markup.documentElement.removeAttribute('dir');
    row.remove();
  }
  assert.ok(precedes(markup.getElementById('strategyTruthHeading'), markup.getElementById('bestAction')));
});

test('legacy heuristic permissions are constrained on read while original evidence stays intact', () => {
  const result = createStrategyProvider({ fallbackResolver: resolveHeuristicStrategy }).resolve(ctx);
  const legacy = { strategyResult: structuredClone(result), claimPolicy: structuredClone(resolveStrategyClaimPolicy(result)), internalEvaluation: { chosenAction: { type: 'fold' }, grade: 'mistake' } };
  legacy.claimPolicy.authority = 'comparative_reference';
  legacy.claimPolicy.mode = legacy.claimPolicy.trainingSemantics = 'comparative';
  for (const claim of ['reference_match', 'reference_deviation', 'recommendation', 'normative_grading', 'objective_correctness', 'mistake', 'accuracy', 'optimality', 'ev_loss']) legacy.claimPolicy.claims[claim] = true;
  const bytes = JSON.stringify(legacy);
  const truth = historicalStrategyTruth(legacy);
  assert.equal(truth.state, 'heuristic_comparison');
  assert.equal(truth.claimPolicy.mode, 'exploratory');
  for (const claim of ['reference_match', 'reference_deviation', 'recommendation', 'normative_grading', 'objective_correctness', 'mistake', 'accuracy', 'optimality', 'ev_loss']) assert.equal(truth.claimPolicy.claims[claim], false, claim);
  assert.equal(JSON.stringify(legacy), bytes);
});
