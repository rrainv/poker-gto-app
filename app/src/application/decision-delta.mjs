import { freezeLanguageData as freeze, createNaturalLanguageEnvelope } from './natural-language-envelope.mjs';
import { preflopHandClassForCards } from '../../../shared/poker-domain/index.js';

export const DECISION_DELTA_VERSION = 'decision-delta/v1';
export const REVIEW_PRIORITY_POLICY = Object.freeze({
  version: 'review-priority/v1', review_later: 100, uncertain: 90, difficult: 85,
  normative_remediation: 80, personal_difference: 70, reference_difference: 60,
  import_uncertainty: 55, exploit_sensitive: 40, large_economics: 30,
  largeCallBb: 20, largeCommitBb: 20, patternMinimum: 3,
});
const slot = (role, evidence, reason = 'unavailable', basis = 'historical') => ({ role, basis,
  availability: evidence == null ? 'unavailable' : 'available', evidence, reason: evidence == null ? reason : null });

// Reads already projected canonical facts and Strategy Truth. No provider, storage or poker calculation.
export function projectDecisionDelta(decision, { importProvenance = null, annotations = null,
  studyMetadata = null, learningEvidence = null, personal = null, strategyBasis = null } = {}) {
  if (!decision?.decisionId || !decision.durable?.decisionContext) throw new TypeError('Projected Review decision required');
  const context = decision.durable.decisionContext;
  const uncertainty = ['ambiguous', 'missing', 'unsupported'].flatMap(kind =>
    (importProvenance?.factSummary?.[kind] ?? []).map(ref => ({ kind, ref })));
  // Current import contracts reject incomplete Hands. A future partial source without
  // dependency mapping must conservatively disable all affected comparisons.
  const blocked = uncertainty.length > 0;
  const truth = decision.truth;
  const sourceBasis = strategyBasis ?? (truth?.historical ? 'historical' : 'current');
  const reference = !blocked && truth?.claims?.reference === true;
  const heuristic = !blocked && truth?.state === 'heuristic_comparison';
  const intent = !blocked && personal?.personalStatus === 'available' ? personal : null;
  const exploit = decision.exploitReview?.roles;
  const reasons = [];
  const add = (code, facts) => reasons.push({ code, priority: REVIEW_PRIORITY_POLICY[code], facts,
    evidenceRefs: [`decision:${decision.decisionId}`, ...(facts.evidenceIds ?? [])] });
  if (annotations?.reviewState === 'review_later' || studyMetadata?.review) add('review_later', { owner: annotations ? 'saved_study_objects' : 'training_memory' });
  if (learningEvidence?.uncertainty?.value === 'uncertain') add('uncertain', { owner: 'training_memory' });
  if (studyMetadata?.difficult) add('difficult', { owner: 'training_memory' });
  if (!blocked && truth?.state === 'normative_assessment' && truth.learningEligibility?.remediation === true) add('normative_remediation', { owner: 'strategy_truth', outcome: truth.outcome });
  if (intent?.actionTypeRelationship === 'different_action_type') add('personal_difference', { evidenceIds: intent.evidenceIds, basis: 'current', precision: intent.precision });
  if (reference && truth.comparison?.kind === 'differs') add('reference_difference', { source: truth.source, basis: truth.comparison.basis });
  if (blocked) add('import_uncertainty', { uncertainty });
  if (exploit?.exploitAnalysis?.availability === 'partial' && !blocked) add('exploit_sensitive', { assumptions: exploit.exploitAnalysis.assumptions });
  const committedBb = Number.isSafeInteger(decision.chosenAction?.committedMilliBb) ? decision.chosenAction.committedMilliBb / 1000 : null;
  if (!blocked && (context.callAmountBb >= REVIEW_PRIORITY_POLICY.largeCallBb || committedBb >= REVIEW_PRIORITY_POLICY.largeCommitBb)) {
    add('large_economics', { callAmountBb: context.callAmountBb ?? null, committedBb, thresholdBb: 20 });
  }
  reasons.sort((a, b) => b.priority - a.priority || a.code.localeCompare(b.code));
  const roles = {
    observedAction: slot('observed_action', decision.chosenAction),
    personalIntent: slot('personal_intent', intent, blocked ? 'import_uncertainty' : personal?.reason ?? 'personal_not_inspected', 'current'),
    selectedReference: slot('selected_reference', reference ? { source: decision.source, distribution: decision.distribution, comparison: truth.comparison } : null, blocked ? 'import_uncertainty' : 'reference_unavailable', sourceBasis),
    heuristicBaseline: slot('heuristic_baseline', heuristic ? { source: decision.source, distribution: decision.distribution, comparison: truth.comparison } : null, blocked ? 'import_uncertainty' : 'unavailable', sourceBasis),
    opponentPolicy: slot('opponent_policy', exploit?.opponentPolicy?.evidence ?? null, 'explicit_opponent_policy_unavailable'),
    exploitAnalysis: slot('exploit_analysis', !blocked && exploit?.exploitAnalysis?.availability === 'partial' ? exploit.exploitAnalysis : null, blocked ? 'import_uncertainty' : 'explicit_opponent_policy_unavailable'),
    normativeAssessment: slot('normative_assessment', !blocked && truth?.state === 'normative_assessment' ? truth : null, blocked ? 'import_uncertainty' : 'assessment_unavailable', sourceBasis),
  };
  return freeze(structuredClone({ schemaVersion: DECISION_DELTA_VERSION, decisionId: decision.decisionId,
    decisionIndex: decision.decisionIndex, street: decision.street, replayFrameTarget: decision.replayFrameTarget,
    context, roles, reasons, priority: reasons[0]?.priority ?? 0, importProvenance, uncertainty,
    situational: annotations?.tags?.some(tag => (tag.key ?? tag) === 'situational') ?? false,
    combinedVerdict: null, persistence: 'projection_only',
    summary: createNaturalLanguageEnvelope({ claimClass: 'factual', subject: { role: 'decision_review' },
      evidenceRefs: [`decision:${decision.decisionId}`, ...reasons.flatMap(reason => reason.evidenceRefs)],
      scope: { decisionId: decision.decisionId }, uncertainty, basis: 'historical',
      facts: { observedAction: decision.chosenAction, reasons, personalBasis: 'current', combinedVerdict: null } }),
  }));
}

export function selectImportantDecisions(deltas, limit = 3) {
  return freeze([...deltas].filter(delta => delta.reasons.length).sort((a, b) =>
    b.priority - a.priority || a.decisionIndex - b.decisionIndex || a.decisionId.localeCompare(b.decisionId)).slice(0, Math.max(0, Math.min(3, limit))));
}

// Narrow descriptive pattern: three distinct encountered decisions in the exact
// same structural context. No skill claim, weight uplift, or persisted synthesis.
export function projectReviewPatterns(items) {
  const groups = new Map();
  for (const item of items) {
    if (!item.context || !item.id) continue;
    for (const code of item.reasons.map(reason => typeof reason === 'string' ? reason : reason.code)) {
      if (!['uncertain', 'personal_difference'].includes(code)) continue;
      const c = item.context;
      let family;
      try { family = preflopHandClassForCards(c.heroCards); } catch { continue; }
      const key = JSON.stringify([code, c.gameRules?.semanticFingerprint, c.street, c.heroPosition,
        c.tableSize, family, c.priorActionSummary?.facingActionFamily, c.effectiveStackBb]);
      if (!c.gameRules?.semanticFingerprint || !Number.isFinite(c.effectiveStackBb)
        || !c.street || !c.heroPosition || !Number.isInteger(c.tableSize) || !c.priorActionSummary?.facingActionFamily) continue;
      const group = groups.get(key) ?? { code, context: c, handClass: family, ids: new Set() };
      group.ids.add(item.id); groups.set(key, group);
    }
  }
  return freeze([...groups.values()].filter(g => g.ids.size >= REVIEW_PRIORITY_POLICY.patternMinimum)
    .map(g => ({ code: g.code, context: g.context, handClass: g.handClass, sample: [...g.ids].sort(), count: g.ids.size,
      minimum: REVIEW_PRIORITY_POLICY.patternMinimum, assessment: 'none', scope: 'loaded_items_only' })));
}
