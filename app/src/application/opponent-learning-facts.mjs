import { SYNTHETIC_POLICY_ID, SYNTHETIC_POLICY_VERSION, SYNTHETIC_PRESETS,
  createSyntheticConfiguration, validateSyntheticConfiguration } from './synthetic-opponent-policy.mjs';
import { freezeOpponentData as freeze } from './opponent-actor-information.mjs';
import { derivePolicyIncentives } from './opponent-response-facts.mjs';
import { createSyntheticResponseFacts } from './synthetic-opponent-policy.mjs';

// Descriptive educational differences, never response ranges or Hero grades.
export function compareOpponentLearningPolicies(configuration, otherConfiguration) {
  const left = validateSyntheticConfiguration(configuration), right = validateSyntheticConfiguration(otherConfiguration);
  const contexts = [
    ['small_price', 'smallPriceCallPercent', 'thin_value_questions'],
    ['large_price', 'largePriceCallPercent', 'bluff_construction_questions'],
    ['check_available', 'freeAggressionPercent', 'bluff_catching_questions'],
    ['facing_wager', 'facingRaisePercent', 'raise_response_questions'],
  ];
  return freeze({ schemaVersion: 'opponent-learning-comparison/v1', policyId: SYNTHETIC_POLICY_ID,
    policyVersion: SYNTHETIC_POLICY_VERSION, left, right,
    differences: contexts.filter(([, key]) => left.parameters[key] !== right.parameters[key])
      .map(([context, parameter, question]) => ({ context, parameter, question,
        left: left.parameters[parameter], right: right.parameters[parameter] })),
    quantitativeRangeResponse: 'unavailable', normativeAssessment: false });
}

export function createOpponentDecisionReviewFacts(record) {
  if (record?.policyId !== SYNTHETIC_POLICY_ID || record.policyVersion !== SYNTHETIC_POLICY_VERSION) {
    throw new RangeError('Unsupported historical policy review');
  }
  const configuration = validateSyntheticConfiguration(record.policyConfiguration);
  const weights = record.selectionProvenance.weights;
  const check = record.selectionProvenance.reason === 'check_available';
  const parameters = [];
  if (weights.some(item => ['bet', 'raise'].includes(item.type))) {
    parameters.push(check ? 'freeAggressionPercent' : 'facingRaisePercent');
  }
  if (!check && (weights.find(item => item.type === 'raise')?.weight ?? 0) < 10000) {
    parameters.push(record.selectionProvenance.reason === 'small_call_price' ? 'smallPriceCallPercent' : 'largePriceCallPercent');
  }
  return freeze(structuredClone({ schemaVersion: 'opponent-decision-review-facts/v1',
    policyId: record.policyId, policyVersion: record.policyVersion, configuration,
    actor: record.actor, actorInformation: record.actorInformation,
    decisionOrdinal: record.decisionOrdinal, chosenAction: record.chosenAction,
    branch: record.selectionProvenance.reason,
    influences: parameters.map(parameter => ({ parameter, value: configuration.parameters[parameter] })),
    weights, baseSeed: record.baseSeed, decisionSeed: record.decisionSeed,
    deterministicMetadata: record.deterministicMetadata, replayReference: record.replayReference,
    normativeAssessment: false, quantitativeRangeResponse: 'unavailable' }));
}

// A read-only projection of the current intended range. Policy selection cannot
// create action mass, classify value/bluffs, change reach or write intent.
export function createPersonalOpponentStudy({ study, configuration } = {}) {
  const policy = validateSyntheticConfiguration(configuration);
  if (study?.study?.schemaVersion !== 'personal-range-node-study/v1' || !study.approachSnapshot) {
    return freeze({ availability: 'unavailable', reason: 'current_personal_node_study_required' });
  }
  const source = study.study;
  return freeze(structuredClone({ schemaVersion: 'personal-opponent-study/v1', availability: 'available',
    approachSnapshot: study.approachSnapshot, nodeFingerprint: source.node.fingerprint,
    trajectoryFingerprint: study.trajectory?.fingerprint ?? null,
    policy: { policyId: SYNTHETIC_POLICY_ID, policyVersion: SYNTHETIC_POLICY_VERSION, configuration: policy },
    coverage: source.facts.regions,
    exploitIncentives: derivePolicyIncentives(createSyntheticResponseFacts(policy)),
    checkingIntent: source.facts.regions.map(region => {
      const entries = (source.entries ?? []).filter(entry => entry.region === region.id);
      const exact = entries.filter(entry => entry.precision === 'exact' && entry.distribution?.some(row =>
        row.action.type === 'check' && row.probability > 0.5));
      const preferred = entries.filter(entry => entry.precision === 'dominant' && entry.preferredAction?.type === 'check');
      return { region: region.id, scope: 'known_positive_reached_combos_only', exactCheckingCombos: exact.length,
        preferredCheckingCombos: preferred.length, totalKnownReachedCombos: entries.length,
        candidateComboIds: [...exact, ...preferred].map(entry => entry.comboId),
        evidenceRefs: [...new Set([...exact, ...preferred].flatMap(entry => entry.evidenceRefs ?? []))],
        criterion: 'check_probability_above_half_or_explicit_preference/v1',
        rangeCheckFrequency: 'unavailable', strategicRole: 'unclassified', assessment: 'none' };
    }),
    nextQuestions: source.questions.map(question => ({ comboId: question.comboId, cards: question.cards,
      region: question.region, precision: question.precision, evidenceRefs: question.evidenceRefs,
      distribution: question.distribution, preferredAction: question.preferredAction })),
    comparisons: Object.entries(SYNTHETIC_PRESETS).map(([preset, parameters]) => ({ preset,
      ...compareOpponentLearningPolicies(policy, createSyntheticConfiguration(parameters)) })),
    sourceRole: 'personal_intended', quantitativeRangeResponse: 'unavailable',
    normativeAssessment: false, policyChangesIntent: false }));
}
