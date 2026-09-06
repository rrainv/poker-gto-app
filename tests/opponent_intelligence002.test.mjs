import test from 'node:test';
import assert from 'node:assert/strict';
import { createGameRulesSnapshotFromLegacyGameConfiguration, createHoldemWeightedRangeFromEntries } from '../shared/poker-domain/index.js';
import { multiplyHoldemRangeByActionFrequencies } from '../shared/poker-domain/holdem-range-action.js';
import { createOpponentPracticeRequest, createSyntheticConfiguration, createSyntheticResponseFacts, SYNTHETIC_PRESETS } from '../app/src/application/synthetic-opponent-policy.mjs';
import { createPolicyTrainingIntent, validatePolicyTrainingIntent, POLICY_STUDY_THEMES } from '../app/src/application/policy-conditioned-training.mjs';
import { compareOpponentLearningPolicies, createOpponentDecisionReviewFacts, createPersonalOpponentStudy } from '../app/src/application/opponent-learning-facts.mjs';
import { describeOpponentTeaching, OPPONENT_LEARNING_COPY } from '../app/src/application/opponent-learning-language.mjs';
import { createFullHandTrainingSessionController } from '../app/src/application/full-hand-training-session-controller.mjs';
import { createStrategyProvider } from '../app/src/application/strategy-provider.mjs';
import { evaluateTrainingAnswer } from '../app/src/application/training-answer-evaluation.mjs';
import { createPersonalHandBranch, createPersonalRangePrior, createExactNodeActionRange,
  conditionPersonalRangeAction, advancePersonalRangeToNode, createPersonalRangeNodeStudy } from '../app/src/application/personal-hand-study.mjs';
import { createExactNodeIntent } from '../app/src/personal-strategy/exact-node-intent.mjs';
import { createHandReviewProjector, createHandReviewAnalysisHandoff } from '../app/src/application/hand-review.mjs';

const policyRequest = (preset = 'calling-heavy') => createOpponentPracticeRequest({
  configuration: createSyntheticConfiguration(SYNTHETIC_PRESETS[preset]), policySeed: 735, target: 'BB' });
function configuration() {
  return { handId: 'policy-study-test', buttonSeat: 0,
    rulesSnapshot: createGameRulesSnapshotFromLegacyGameConfiguration({ mode: 'home', smallBlindMilliBb: 500,
      bigBlindMilliBb: 1000, chipUnitMilliBb: 100, ante: { type: 'none', amountMilliBb: 0 } }, 2),
    players: [0, 1].map(seat => ({ playerId: `P${seat}`, seat, startingStackMilliBb: 20000 })) };
}
function provider(calls = []) {
  return createStrategyProvider({ fallbackResolver(context) { calls.push(context);
    return { source: 'heuristic_preflop', modelVersion: 'policy-study-fixture/v1',
      actions: [{ action: { type: 'call' }, label: 'Call', probability: 1 }] }; } });
}
async function play(theme, preset = 'calling-heavy') {
  const requests = [], evaluations = [];
  const controller = createFullHandTrainingSessionController({ evaluateAnswer(input) {
    evaluations.push(input); return evaluateTrainingAnswer(input);
  } });
  const opponentPractice = policyRequest(preset), intent = createPolicyTrainingIntent({ opponentPractice, theme });
  let result = controller.start({ handSeed: 29, heroPosition: 'BTN', handConfiguration: configuration(),
    opponentPractice, policyTrainingIntent: intent }, { strategyProvider: provider(requests) });
  const firstContext = result.snapshot.currentDecision.decisionContext;
  let steps = 0;
  while (result.snapshot.status === 'awaiting_hero' && steps++ < 128) {
    const decision = result.snapshot.currentDecision;
    result = await controller.answer(decision.decisionId, { type: decision.legalActions.check.available ? 'check' : 'call' });
    assert.equal(result.ok, true, JSON.stringify(result.error));
  }
  assert.equal(result.snapshot.status, 'terminal');
  return { snapshot: result.snapshot, controller, firstContext, requests, evaluations, intent };
}

test('policy study requests freeze exact behavior and reject semantic/authority/version substitution', () => {
  const opponentPractice = policyRequest();
  const intent = createPolicyTrainingIntent({ opponentPractice, theme: 'thin_value_questions' });
  assert.equal(Object.isFrozen(intent.opponentPractice.configuration.parameters), true);
  assert.deepEqual(validatePolicyTrainingIntent(structuredClone(intent)), intent);
  assert.throws(() => validatePolicyTrainingIntent({ ...intent, assessment: 'policy_owned' }), /Incompatible/);
  assert.throws(() => validatePolicyTrainingIntent(intent, policyRequest('aggressive')), /Incompatible/);
  assert.throws(() => createPolicyTrainingIntent({ opponentPractice, theme: 'frequent_check_raises' }), /unavailable/);
  assert.throws(() => createPolicyTrainingIntent({ opponentPractice: { ...opponentPractice, policyVersion: 'future/v9' } }), /Unsupported/);
  const controller = createFullHandTrainingSessionController();
  const missing = controller.start({ handSeed: 29, heroPosition: 'BTN', handConfiguration: configuration(), policyTrainingIntent: intent }, { strategyProvider: provider() });
  assert.equal(missing.ok, false, 'an educational intent must not silently run baseline opponents');
});

test('study themes preserve canonical actions, seed replay and all provider/grader inputs', async () => {
  const baseline = await play('play_policy');
  for (const theme of POLICY_STUDY_THEMES.slice(1)) {
    const current = await play(theme);
    assert.deepEqual(current.snapshot.replaySource, baseline.snapshot.replaySource);
    assert.deepEqual(current.snapshot.botDecisionJournal, baseline.snapshot.botDecisionJournal);
    assert.deepEqual(current.requests, baseline.requests);
    assert.deepEqual(current.evaluations, baseline.evaluations);
    assert.equal(current.requests.length, current.snapshot.summary.decisionsAnswered);
    assert.deepEqual(current.snapshot.review.policyTrainingIntent, current.intent);
    current.controller.reset(); assert.equal(current.controller.getSnapshot().policyTrainingIntent, null);
    assert.equal(current.controller.getReview(), null);
  }
  const aggressive = await play('bluff_catching_questions', 'aggressive');
  assert.deepEqual(aggressive.firstContext, baseline.firstContext);
  assert.deepEqual(aggressive.evaluations[0], baseline.evaluations[0], 'same decision/answer has the same grading inputs across policies');
  assert.notDeepEqual(aggressive.snapshot.botDecisionJournal.decisions.map(row => row.chosenAction),
    baseline.snapshot.botDecisionJournal.decisions.map(row => row.chosenAction));
});

test('completed review preserves branch influences, exact actor inputs and original policy provenance', async () => {
  const { snapshot } = await play('raise_response_questions', 'aggressive');
  assert.deepEqual(snapshot.review.opponentPractice, snapshot.opponentPractice);
  const review = createHandReviewProjector().project({ source: 'training_full_hand', handId: snapshot.review.handId,
    heroPlayerId: snapshot.review.heroPlayerId, decisions: snapshot.review.decisions, completedHandResult: snapshot.review.completedHandResult });
  for (const decision of review.decisions) {
    assert.deepEqual(decision.exploitReview.roles.opponentPolicy.evidence, snapshot.opponentPractice);
    assert.deepEqual(decision.exploitReview.roles.observedAction.evidence, decision.durable.chosenAction);
    assert.deepEqual(decision.exploitReview.roles.normativeAssessment.truth, decision.truth);
    assert.equal(decision.exploitReview.roles.personalIntent.availability, 'unavailable');
    assert.equal(decision.exploitReview.combinedVerdict, null);
  }
  assert.deepEqual(createHandReviewAnalysisHandoff(review).exploitReview, review.selectedDecision.exploitReview);
  for (const record of snapshot.botDecisionJournal.decisions) {
    const facts = createOpponentDecisionReviewFacts(record);
    assert.deepEqual(facts.actorInformation, record.actorInformation);
    assert.deepEqual(facts.replayReference, record.replayReference);
    assert.equal(facts.decisionSeed, record.decisionSeed);
    assert.equal(facts.policyVersion, snapshot.opponentPractice.policyVersion);
    assert.deepEqual(facts.weights, record.selectionProvenance.weights);
    for (const influence of facts.influences) assert.equal(influence.value, record.policyConfiguration.parameters[influence.parameter]);
    assert.equal(facts.actorInformation.players.some(player => 'holeCards' in player), false);
    assert.equal(facts.quantitativeRangeResponse, 'unavailable');
    assert.equal(facts.normativeAssessment, false);
    assert.equal(Object.isFrozen(facts.actorInformation.actionHistory), true);
  }
});

test('comparison and EN/RU/HE teaching describe actual custom parameters without quantitative range authority', () => {
  const config = createSyntheticConfiguration({ smallPriceCallPercent: 0, largePriceCallPercent: 13,
    freeAggressionPercent: 27, facingRaisePercent: 100 });
  const comparison = compareOpponentLearningPolicies(config, createSyntheticConfiguration());
  assert.equal(comparison.differences.length, 4);
  assert.equal(compareOpponentLearningPolicies(config, config).differences.length, 0);
  for (const locale of ['en', 'ru', 'he']) {
    assert.deepEqual(Object.keys(OPPONENT_LEARNING_COPY[locale]).sort(), Object.keys(OPPONENT_LEARNING_COPY.en).sort());
    const lines = describeOpponentTeaching(config, locale);
    for (const [index, value] of [0, 13, 27, 100].entries()) assert.ok(lines[index].includes(String(value)));
    assert.ok(lines.every(line => !line.includes('{')));
    assert.ok(lines.every(line => line.includes('\u2068')));
  }
  assert.equal(comparison.quantitativeRangeResponse, 'unavailable');
  assert.equal(comparison.normativeAssessment, false);
  const prior = createHoldemWeightedRangeFromEntries();
  assert.throws(() => multiplyHoldemRangeByActionFrequencies(prior, createSyntheticResponseFacts(config)),
    undefined, 'conditional action-selection weights cannot enter canonical combo-frequency multiplication');
});

test('Personal policy questions retain exact Approach/node/intent and coverage across policy changes', () => {
  const branch = createPersonalHandBranch(), approachSnapshot = { profileId: 'p', modeId: 'm', setupVersion: 1, approachVersion: 1 };
  const record = createExactNodeIntent({ ...approachSnapshot, id: 'open-aa', createdAt: '2026-09-06T00:00:00.000Z',
    node: branch.preflopNode, subject: { kind: 'hand_class', handClass: 'AA' }, precision: 'exact',
    distribution: [{ action: branch.preflopAction, probability: 0.75 }, { action: branch.preflopFoldAction, probability: 0.25 }] });
  const prior = createPersonalRangePrior({ node: branch.preflopNode, approachSnapshot });
  const policy = createExactNodeActionRange({ node: branch.preflopNode, action: branch.preflopAction, records: [record], approachSnapshot });
  const trajectory = advancePersonalRangeToNode({ prior: conditionPersonalRangeAction({ prior, policy }), nextNode: branch.flopNode });
  const study = { approachSnapshot, trajectory, study: createPersonalRangeNodeStudy({ trajectory }) };
  const before = structuredClone(study);
  const results = Object.values(SYNTHETIC_PRESETS).map(parameters => createPersonalOpponentStudy({ study, configuration: createSyntheticConfiguration(parameters) }));
  for (const result of results) {
    assert.equal(result.availability, 'available');
    assert.deepEqual(result.coverage, study.study.facts.regions);
    assert.deepEqual(result.nextQuestions, results[0].nextQuestions);
    assert.deepEqual(result.approachSnapshot, approachSnapshot);
    assert.equal(result.nodeFingerprint, branch.flopNode.fingerprint);
    assert.equal(result.quantitativeRangeResponse, 'unavailable');
    assert.equal(result.policyChangesIntent, false);
    assert.ok(result.nextQuestions.every(row => row.distribution === null));
  }
  assert.deepEqual(study, before);
  assert.equal(createPersonalOpponentStudy({ configuration: createSyntheticConfiguration() }).availability, 'unavailable');
});
