import { createPersonalRangeLanguageFacts, personalRangeRegionLabel } from './range-language-facts.mjs';
import { calibrationContextsEquivalent } from './domain.mjs';
import { createNaturalLanguageEnvelope, freezeLanguageData as freeze } from '../application/natural-language-envelope.mjs';

export const PERSONAL_COACH_VERSION = 'personal-strategy-coach/v1';
export const PERSONAL_COACH_HANDOFF_VERSION = 'personal-coach-request/v1';
export const PERSONAL_COACH_KINDS = Object.freeze([
  'unmapped_boundary', 'sparse_hand_family', 'internal_inconsistency', 'mixed_frequency_ambiguity',
  'approach_difference', 'heuristic_difference', 'accepted_reference_difference',
  'continuation_range_gap', 'observed_intended_conflict', 'concept_teaching',
]);

// A presentation of canonical candidate order, never a second question selector.
export function createPersonalCoach({ evidenceView, candidates = [], comparison = null } = {}) {
  const facts = createPersonalRangeLanguageFacts({ evidenceView });
  const points = new Map(evidenceView.points.map((point) => [point.handClass, point]));
  const opportunities = [], seen = new Set();
  const subject = { role: 'personal_intended', profileId: facts.scope.profileId, modeId: facts.scope.modeId };
  function add(kind, region, handClass, supporting = {}) {
    const point = points.get(handClass);
    if (!point || !region.handClasses.includes(handClass)) return;
    const evidenceRefs = [...new Set([`evidence-view:${facts.evidenceFingerprint}`,
      ...region.evidenceRefs, ...point.sourceEvidenceIds, ...(supporting.evidenceRefs ?? [])])];
    const uncertainty = [region.directClasses < region.totalClasses ? 'partial_region' : null,
      kind === 'mixed_frequency_ambiguity' ? 'exact_frequency_unknown' : null,
      kind === 'internal_inconsistency' ? 'conflicting_heads' : null].filter(Boolean);
    const comparative = kind.endsWith('_difference');
    const permission = { normative: false, comparison: comparative, wholeRegionFrequency: false,
      criterion: 'current_direct_region_and_canonical_question/v1' };
    const variation = candidates.find((candidate) => candidate.handClass !== handClass
      && region.handClasses.includes(candidate.handClass) && candidate.questionKind !== 'conflict_resolution')?.handClass ?? null;
    const opportunity = {
      schemaVersion: 'personal-coaching-opportunity/v1', id: `${facts.evidenceFingerprint}:${kind}:${region.id}:${handClass}`,
      kind, subject, scope: facts.scope, region: { id: region.id, handClasses: region.handClasses, handClass },
      evidenceFingerprint: facts.evidenceFingerprint, evidenceRefs,
      density: { directClasses: region.directClasses, exactClasses: region.exactClasses, totalClasses: region.totalClasses },
      uncertainty, permission, supporting,
      suggestedAction: { destination: kind === 'internal_inconsistency' || kind === 'mixed_frequency_ambiguity' ? 'matrix' : 'teach_riverline',
        handClass, focus: region.id, intent: 'mapping' },
      unavailableConditions: ['scope_changed', 'evidence_changed', 'owner_changed'],
      lesson: { reason: kind, question: comparative ? 'difference' : kind === 'internal_inconsistency' ? 'conflict'
        : kind === 'mixed_frequency_ambiguity' ? 'mix' : 'boundary',
        explanation: kind, whatChanges: 'context_or_exception',
        variation: variation ? { kind: 'nearby_hand', handClass: variation, unchanged: 'exact_decision_context' } : null },
    };
    opportunity.envelope = createNaturalLanguageEnvelope({ claimClass: comparative ? 'strategic_normative' : 'interpretive',
      subject, scope: { ...facts.scope, region: opportunity.region }, evidenceRefs, uncertainty,
      wordingStrength: comparative ? 'comparative' : 'descriptive', permission,
      derivation: { version: PERSONAL_COACH_VERSION, criterion: permission.criterion },
      facts: { kind, density: opportunity.density, supporting } });
    opportunities.push(opportunity);
  }
  for (const candidate of candidates) {
    const region = facts.regions.find((item) => item.id === candidate.mappingFamilyId)
      ?? facts.regions.find((item) => item.handClasses.includes(candidate.handClass));
    const point = points.get(candidate.handClass);
    if (!region || !point || seen.has(region.id)) continue;
    let kind = point.resolution === 'conflicting' ? 'internal_inconsistency'
      : point.resolution === 'direct_dominant' ? 'mixed_frequency_ambiguity'
        : region.structure.transitions.some((entry) => entry.unresolvedBetween.includes(candidate.handClass))
          || region.structure.unresolvedLowerNeighbors.includes(candidate.handClass) ? 'unmapped_boundary'
          : point.resolution === 'unanswered' ? 'sparse_hand_family' : null;
    if (!kind) continue; // A known exact tied mix is an answer, never ambiguity.
    seen.add(region.id);
    add(kind, region, candidate.handClass, { selectionPolicyVersion: candidate.selectionPolicyVersion,
      transitions: region.structure.transitions });
    if (seen.size === 2) break;
  }
  // Optional precision inspection is a Matrix command, not a new next-question
  // policy. Use a stated example in the first displayed region; when fully
  // mapped, use the first canonical region still containing dominant-only intent.
  const refinementRegion = facts.regions.find((region) => region.id === opportunities[0]?.region.id)
    ?? facts.regions.find((region) => region.dominantOnlyClasses > 0);
  const refinement = refinementRegion?.selectedSample.find((point) => point.precision === 'dominant_only');
  if (refinement && !opportunities.some((entry) => entry.kind === 'mixed_frequency_ambiguity')) {
    add('mixed_frequency_ambiguity', refinementRegion, refinement.handClass, { optionalPrecisionRefinement: true });
  }
  const currentComparison = comparison?.schemaVersion === 'personal-range-language-comparison/v1'
    && comparison.compatible && comparison.leftEvidenceFingerprint === facts.evidenceFingerprint
    && comparison.leftScope?.profileId === facts.scope.profileId && comparison.leftScope?.modeId === facts.scope.modeId
    && calibrationContextsEquivalent(comparison.leftScope.context, facts.scope.context);
  if (currentComparison) {
    // Overlapping regions cannot inflate a difference into a whole-range claim.
    const comparedHands = new Set();
    for (const other of comparison.regions) {
      if (!other.permission?.comparison || other.permission.normative !== false) continue;
      const difference = other.differences.find((entry) => !comparedHands.has(entry.handClass));
      const region = facts.regions.find((item) => item.id === other.id);
      const kind = comparison.kind === 'personal_to_personal' ? 'approach_difference'
        : other.sourceKind === 'heuristic' ? 'heuristic_difference'
          : other.sourceKind === 'reference' ? 'accepted_reference_difference' : null;
      if (!difference || !region || !kind) continue;
      comparedHands.add(difference.handClass);
      add(kind, region, difference.handClass, { ...difference, rightScope: comparison.rightScope ?? null,
        rightEvidenceFingerprint: comparison.rightEvidenceFingerprint ?? null,
        criterion: other.permission.criterion, representativeClassesOnly: comparison.kind === 'personal_to_source' });
      break;
    }
  }
  return freeze(structuredClone({ schemaVersion: PERSONAL_COACH_VERSION, subject, scope: facts.scope,
    evidenceFingerprint: facts.evidenceFingerprint, opportunities,
    unavailable: { continuation_range_gap: 'no_action_conditioned_trajectory', observed_intended_conflict: 'no_observed_intent_join',
      concept_teaching: 'no_postflop_context_in_rfi_coach', training_region: 'planner_has_no_hand_region_target' } }));
}

export function assertPersonalCoachRequestCurrent(request, { scope, evidenceFingerprint, comparisonEvidenceFingerprint = null } = {}) {
  if (request?.schemaVersion !== PERSONAL_COACH_HANDOFF_VERSION) throw new TypeError('Coach request required');
  if (scope?.profileId !== request.scope.profileId || scope?.modeId !== request.scope.modeId
    || !calibrationContextsEquivalent(scope.context, request.scope.context)
    || evidenceFingerprint !== request.evidenceFingerprint
    || (request.comparisonEvidence && comparisonEvidenceFingerprint !== request.comparisonEvidence.fingerprint)) {
    throw new RangeError('stale_personal_coach_request');
  }
  return request;
}

export function createPersonalCoachRequest(opportunity, { scope, evidenceFingerprint, comparisonEvidenceFingerprint = null,
  destination = opportunity?.suggestedAction.destination, variation = false } = {}) {
  if (opportunity?.schemaVersion !== 'personal-coaching-opportunity/v1') throw new TypeError('Coach opportunity required');
  if (scope?.profileId !== opportunity.scope.profileId || scope?.modeId !== opportunity.scope.modeId
    || !calibrationContextsEquivalent(scope.context, opportunity.scope.context)
    || evidenceFingerprint !== opportunity.evidenceFingerprint) throw new RangeError('stale_personal_coach_request');
  if (!['teach_riverline', 'matrix', 'training'].includes(destination)) throw new RangeError('Unsupported Coach destination');
  if (variation && !opportunity.lesson.variation) throw new RangeError('Controlled variation unavailable');
  const request = { schemaVersion: PERSONAL_COACH_HANDOFF_VERSION, opportunityId: opportunity.id,
    subject: opportunity.subject, scope, evidenceFingerprint, evidenceRefs: opportunity.evidenceRefs,
    destination, availability: destination === 'training' ? 'unavailable' : 'available',
    unavailableReason: destination === 'training' ? 'planner_has_no_hand_region_target' : null,
    target: { handClass: variation ? opportunity.lesson.variation.handClass : opportunity.region.handClass,
      focus: opportunity.region.id, intent: 'mapping' },
    comparisonEvidence: opportunity.supporting.rightScope ? { scope: opportunity.supporting.rightScope,
      fingerprint: opportunity.supporting.rightEvidenceFingerprint } : null,
    assessment: 'none', generatorOwner: 'canonical_training',
  };
  assertPersonalCoachRequestCurrent(request, { scope, evidenceFingerprint, comparisonEvidenceFingerprint });
  return freeze(structuredClone(request));
}

export function renderPersonalCoachLesson(opportunity, { t = (key) => key, language = 'en' } = {}) {
  const titles = {
    unmapped_boundary: 'Teach this boundary', sparse_hand_family: 'Teach this region',
    internal_inconsistency: 'Clarify conflicting answers', mixed_frequency_ambiguity: 'Refine the exact mix',
    approach_difference: 'Explore this Approach difference', heuristic_difference: 'Explore this baseline difference',
    accepted_reference_difference: 'Explore this reference difference',
  };
  const explanations = {
    unmapped_boundary: 'Your examples leave this boundary open. One nearby answer can clarify where your preference changes.',
    sparse_hand_family: 'This family still has unanswered hands. Describe one example before drawing a broader conclusion.',
    internal_inconsistency: 'Active answers disagree for this hand. Review their scope and decide which intention applies.',
    mixed_frequency_ambiguity: 'Your preferred action is known; its exact frequency is not. Refine it only if you intend a specific mix.',
    approach_difference: 'The Approaches differ on this example. Explain which assumption makes you choose differently.',
    heuristic_difference: 'Your preference differs from the heuristic baseline on this example. That difference is a discussion prompt, not a mistake.',
    accepted_reference_difference: 'Your preference differs from the selected reference on this example. Action comparison does not assess the whole range.',
  };
  const questions = { boundary: 'What makes you continue or fold this hand in this exact spot?',
    mix: 'How often do you intend each action, if you want to specify a mix?',
    conflict: 'Do these answers describe different conditions, or has your intention changed?',
    difference: 'Which assumption explains your different choice here?' };
  return { title: t(titles[opportunity.kind]), region: personalRangeRegionLabel(opportunity.region.id, language),
    handClass: opportunity.region.handClass, question: t(questions[opportunity.lesson.question]),
    explanation: t(explanations[opportunity.kind]),
    whatChanges: t('If position, price, players still to act, or opponent assumptions change, describe that as a separate context.'),
    coverage: t('{direct}/{total} hand classes specified; this is evidence coverage, not confidence.',
      { direct: opportunity.density.directClasses, total: opportunity.density.totalClasses }),
    variation: opportunity.lesson.variation?.handClass ?? null };
}
