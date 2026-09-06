import { resolveStrategyClaimPolicy } from './strategy-claim-policy.mjs';
import { isStrategyResultV1 } from './strategy-result.mjs';
import { selectedReferenceFacts } from './reference-coverage.mjs';
import {
  acceptedAssessmentPolicyFor, assessmentActionKey, assessmentContextIdentity,
  freezeAssessmentData as freeze, sizedAssessmentAction, validateAssessmentPolicy,
} from './strategy-assessment-policy.mjs';

export const STRATEGY_TRUTH_VERSION = 'strategy-truth/v1';
export const TRUTH_STATES = Object.freeze({
  UNASSESSED: 'unassessed', HEURISTIC: 'heuristic_comparison',
  REFERENCE: 'accepted_reference_comparison', NORMATIVE: 'normative_assessment',
});
const denied = () => ({ reference: false, correct: false, incorrect: false, mistake: false,
  accuracy: false, remediation: false, retention: false, transfer: false, optimality: false, evLoss: false });

function comparisonFor(result, chosenAction) {
  const actions = result?.actions ?? [];
  const highest = Math.max(0, ...actions.map((a) => a.probability));
  const candidates = actions.filter((a) => a.action.type === chosenAction?.type);
  const selected = candidates.find((a) => !sizedAssessmentAction(chosenAction)
    || a.action.amountBb === chosenAction.amountBb) ?? candidates[0];
  const probability = chosenAction ? selected?.probability ?? 0 : null;
  const gap = probability === null ? null : Math.max(0, highest - probability);
  return { kind: gap === null ? null : gap <= 0.05 ? 'matches'
    : probability > 0 && gap <= 0.15 + Number.EPSILON ? 'close' : 'differs',
  chosenProbability: probability, highestProbability: highest,
  preferredAction: actions.find((a) => a.probability === highest)?.label ?? null,
  basis: 'descriptive_action_family_probability_gap/v1' };
}

function project(result, policy, criterion, chosenAction, context, historical = false) {
  const reasons = [];
  const valid = isStrategyResultV1(result) && policy?.availability === 'available'
    && policy.claims?.strategy_presentation === true;
  const heuristic = valid && policy.source?.family === 'heuristic'
    && policy.coverage?.kind !== 'unsupported';
  const reference = valid && !['heuristic', 'personal', 'observed', 'opponent'].includes(policy.source?.family)
    && ['validated_reference', 'comparative_reference'].includes(policy.authority)
    && policy.coverage?.kind === 'exact';
  let state = heuristic ? TRUTH_STATES.HEURISTIC : reference ? TRUTH_STATES.REFERENCE : TRUTH_STATES.UNASSESSED;
  const claims = denied();
  // Preserve legacy answer-time semantics; an explicit new source ceiling must
  // also permit comparison before Personal/Review may consume that role.
  claims.reference = reference && (policy.sourceAuthoritySnapshot?.acceptedClaimClasses == null
    || policy.claims?.reference_match === true && policy.claims?.reference_deviation === true);
  let outcome = 'unassessed';
  let acceptedCriterion = null;
  if (reference && criterion && policy.claims?.normative_grading === true) {
    try { validateAssessmentPolicy(criterion); acceptedCriterion = criterion; } catch { reasons.push('assessment_policy_invalid'); }
    if (acceptedCriterion) {
      const source = result.sourceAuthoritySnapshot;
      const universe = criterion.actionUniverse.map(assessmentActionKey);
      if (criterion.sourceId !== result.source || criterion.sourceVersion !== result.sourceVersion
        || criterion.sourceFingerprint !== result.provenance?.contentHash
        || source?.sourceFingerprint !== criterion.sourceFingerprint
        || source?.acceptedAuthority !== 'validated_reference') reasons.push('assessment_source_mismatch');
      if (!context || criterion.contextIdentity !== assessmentContextIdentity(context)
        || context.derivation?.source !== 'canonical_hand' || context.contractVersion !== 'decision-context/v1.1'
        || !context.gameRules?.semanticFingerprint) reasons.push('assessment_context_mismatch');
      for (const [capability, required] of Object.entries(criterion.requiredCapabilities)) {
        if (policy.capabilities?.[capability] !== required) reasons.push('assessment_capability_unavailable');
      }
      const actionKeys = result.actions.map((a) => assessmentActionKey(a.action));
      if (new Set(actionKeys).size !== actionKeys.length || actionKeys.some((key) => !universe.includes(key))) {
        reasons.push('assessment_distribution_incompatible');
      }
      if (result.actions.some((a) => a.action.potFraction !== null && a.action.potFraction !== undefined)) reasons.push('assessment_sizing_incompatible');
      if (!chosenAction) reasons.push('answer_not_submitted');
      else if (chosenAction.potFraction !== null && chosenAction.potFraction !== undefined) reasons.push('chosen_sizing_incompatible');
      else if (sizedAssessmentAction(chosenAction) && !Number.isFinite(chosenAction.amountBb)) reasons.push('chosen_sizing_unavailable');
      else if (!universe.includes(assessmentActionKey(chosenAction))) reasons.push('chosen_action_outside_assessment_universe');
      else if (criterion.ambiguousActionKeys.includes(assessmentActionKey(chosenAction))) reasons.push('assessment_boundary_ambiguous');
      if (reasons.length === 0) {
        state = TRUTH_STATES.NORMATIVE;
        outcome = result.actions.some((a) => assessmentActionKey(a.action) === assessmentActionKey(chosenAction)
          && a.probability > 0) ? 'supported' : 'unsupported';
        claims.correct = criterion.claimPermissions.supported;
        claims.incorrect = claims.mistake = criterion.claimPermissions.unsupported;
        // An individual action-set outcome is not frequency calibration.
        claims.remediation = outcome === 'unsupported' && claims.incorrect && criterion.claimPermissions.remediation;
      }
    }
  } else if (reference) reasons.push('accepted_assessment_policy_unavailable');
  if (state === TRUTH_STATES.UNASSESSED) reasons.push('comparison_authority_unavailable');
  return freeze({ schemaVersion: STRATEGY_TRUTH_VERSION, state, historical,
    chosenAction: chosenAction ? structuredClone(chosenAction) : null,
    contextIdentity: context ? assessmentContextIdentity(context) : null,
    source: { id: result?.source ?? null, version: result?.sourceVersion ?? null,
      fingerprint: result?.provenance?.contentHash ?? null, role: policy?.source?.family ?? 'unavailable' },
    claimPolicy: structuredClone(policy), assessmentPolicy: acceptedCriterion ? structuredClone(acceptedCriterion) : null,
    selectedReference: selectedReferenceFacts(result, policy),
    claims, outcome, comparison: state === TRUTH_STATES.UNASSESSED ? null : comparisonFor(result,
      heuristic || policy.claims?.reference_match && policy.claims?.reference_deviation ? chosenAction : null),
    reasons: [...new Set(reasons)],
    learningEligibility: { comparison: state !== TRUTH_STATES.UNASSESSED, userRequestedRevisit: true,
      uncertaintyRevisit: true, remediation: claims.remediation, retention: false, transfer: false },
  });
}

export function projectStrategyTruth({ strategyResult, chosenAction = null, decisionContext = null } = {}) {
  return project(strategyResult, resolveStrategyClaimPolicy(strategyResult),
    acceptedAssessmentPolicyFor(strategyResult), chosenAction, decisionContext);
}

// Historical reads never consult today's registries. Legacy source comparison
// may be displayed, but legacy grades/permissions cannot become assessments.
export function historicalStrategyTruth(evidence, { chosenAction, decisionContext } = {}) {
  const saved = evidence?.internalEvaluation?.truth;
  const result = evidence?.strategyResult;
  if (saved?.schemaVersion === STRATEGY_TRUTH_VERSION) {
    const validated = validatedHistoricalTruth(evidence);
    if (validated) {
      if (chosenAction === undefined) return validated;
      return project(result, saved.claimPolicy, saved.assessmentPolicy, chosenAction, decisionContext, true);
    }
  }
  const policy = structuredClone(evidence?.claimPolicy ?? resolveStrategyClaimPolicy(result));
  policy.claims = { ...policy.claims, normative_grading: false, objective_correctness: false,
    mistake: false, accuracy: false, optimality: false, ev_loss: false, normative_curriculum_weighting: false };
  if (policy.source?.family === 'heuristic') {
    policy.authority = policy.mode = 'exploratory';
    policy.trainingSemantics = 'unavailable';
    policy.claims.reference_match = policy.claims.reference_deviation = false;
    policy.claims.comparative_grading = policy.claims.recommendation = false;
  }
  return project(result, policy, null, chosenAction ?? evidence?.internalEvaluation?.chosenAction ?? null, decisionContext, true);
}

export function validatedHistoricalTruth(evidence) {
  const saved = evidence?.internalEvaluation?.truth;
  if (saved?.schemaVersion !== STRATEGY_TRUTH_VERSION) return null;
  try {
    if (!Object.hasOwn(saved, 'chosenAction') || !Object.hasOwn(saved, 'contextIdentity')
      || !saved.claimPolicy || !saved.source || !saved.claims || !saved.learningEligibility) return null;
    const context = saved.contextIdentity === null ? null : JSON.parse(saved.contextIdentity);
    const expected = project(evidence.strategyResult, saved.claimPolicy, saved.assessmentPolicy,
      saved.chosenAction, context, true);
    if (saved.selectedReference && assessmentContextIdentity(saved.selectedReference)
      !== assessmentContextIdentity(expected.selectedReference)) return null;
    for (const key of ['state', 'source', 'claims', 'outcome', 'comparison', 'reasons', 'learningEligibility', 'assessmentPolicy']) {
      if (assessmentContextIdentity(saved[key]) !== assessmentContextIdentity(expected[key])) return null;
    }
    return expected;
  } catch { return null; }
}

export function summarizeStrategyTruth(truths = []) {
  const groups = Object.fromEntries(Object.values(TRUTH_STATES).map((state) => [state,
    { attempts: 0, matches: 0, close: 0, differs: 0, supported: 0, unsupported: 0 }]));
  for (const truth of truths) {
    const group = groups[truth?.state] ?? groups.unassessed;
    group.attempts += 1;
    if (truth?.comparison?.kind) group[truth.comparison.kind] += 1;
    if (truth?.outcome === 'supported' && truth.claims?.correct) group.supported += 1;
    if (truth?.outcome === 'unsupported' && truth.claims?.incorrect) group.unsupported += 1;
  }
  return freeze({ schemaVersion: 'training-truth-summary/v1', attempts: truths.length, groups });
}

export function strategyTruthPresentation(truth) {
  const state = truth?.state ?? TRUTH_STATES.UNASSESSED;
  const kind = truth?.comparison?.kind;
  const titles = {
    heuristic_comparison: { matches: 'Matches heuristic baseline', close: 'Close to heuristic baseline', differs: 'Differs from heuristic baseline' },
    accepted_reference_comparison: { matches: 'Matches selected reference', close: 'Close to selected reference', differs: 'Differs from selected reference' },
  };
  const normative = state === TRUTH_STATES.NORMATIVE;
  return freeze({
    title: normative ? truth.outcome === 'supported' && truth.claims.correct ? 'Supported by accepted assessment'
      : truth.outcome === 'unsupported' && truth.claims.incorrect ? 'Unsupported by accepted assessment' : 'Not assessed'
      : titles[state]?.[kind] ?? (state === TRUTH_STATES.HEURISTIC ? 'Heuristic baseline' : state === TRUTH_STATES.REFERENCE ? 'Selected reference' : 'Not assessed'),
    sourceLabel: state === TRUTH_STATES.HEURISTIC ? 'Heuristic baseline' : truth?.claims?.reference ? 'Selected reference' : 'Strategy information',
    description: state === TRUTH_STATES.HEURISTIC ? 'Approximate exploratory guidance. Agreement is not correctness.'
      : normative ? 'This action was assessed using the accepted action-set criterion.'
        : state === TRUTH_STATES.REFERENCE ? 'Source comparison only. No correctness assessment.' : 'Your action can be recorded and revisited without an assessment.',
    tone: normative && truth.outcome === 'supported' && truth.claims.correct ? 'success'
      : normative && truth.outcome === 'unsupported' && truth.claims.incorrect ? 'error' : 'neutral',
    audio: normative && truth.outcome === 'supported' && truth.claims.correct ? 'positive'
      : normative && truth.outcome === 'unsupported' && truth.claims.incorrect ? 'corrective' : 'neutral',
  });
}
