import { createHoldemWeightedRangeFromHandClassWeights, inspectHoldemWeightedRange,
  serializeHoldemWeightedRange } from '../../../shared/poker-domain/index.js';
import { validatePersonalStrategyEvidenceView } from '../personal-strategy/evidence-view.mjs';
import { getPersonalStrategyActionSetForContext, normalizePersonalStrategyExactDistribution,
  derivePersonalStrategyDominantAction, personalStrategyActionSetHas } from '../personal-strategy/action-contract.mjs';
import { freezeLanguageData as freeze } from './natural-language-envelope.mjs';

export const PERSONAL_WEIGHTED_RANGE_VERSION = 'personal-action-family-range/v1';
function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])]));
}
// Content identity, not source acceptance or a security digest. Retain canonical
// content to avoid accepting a hash collision at this small foundation boundary.
export const rangeFoundationFingerprint = (value) => `range-foundation-content/v1:${JSON.stringify(canonical(value))}`;

export function createPersonalActionFamilyRange({ evidenceView, actionType, setupVersion = null, approachVersion = null } = {}) {
  validatePersonalStrategyEvidenceView(evidenceView);
  if (evidenceView.scope.context.decisionFamily !== 'preflop_rfi') throw new RangeError('Personal range foundation is RFI only');
  const actionSet = getPersonalStrategyActionSetForContext(evidenceView.scope.context);
  if (!personalStrategyActionSetHas(actionSet, { type: actionType })) throw new RangeError('Action family unavailable');
  for (const version of [setupVersion, approachVersion]) {
    if (version !== null && (!Number.isSafeInteger(version) || version < 1)) throw new TypeError('Invalid Personal Strategy version');
  }
  const sources = [], weights = [], lineage = [];
  for (const point of evidenceView.points) {
    const sourceId = `class:${point.handClass}`;
    const evidenceRefs = point.sourceEvidenceIds;
    if (!Array.isArray(evidenceRefs)) throw new TypeError('Point evidence references required');
    lineage.push({ handClass: point.handClass, sourceId, resolution: point.resolution, evidenceRefs,
      activeHeadIds: point.activeDirectHeadIds, supersededEvidenceIds: point.supersededDirectEvidenceIds,
      retractedHeadIds: point.retractedDirectHeadIds });
    if (point.resolution !== 'direct_exact') continue;
    const heads = evidenceView.directEvidence.filter((entry) => entry.headState === 'active_head'
      && entry.target?.kind === 'hand_class' && entry.target.id === point.handClass);
    if (!evidenceRefs.length || new Set(evidenceRefs).size !== evidenceRefs.length
      || heads.length !== evidenceRefs.length || heads.some((entry) => !evidenceRefs.includes(entry.evidenceId)
        || entry.authority !== 'intentional_strategy' || entry.scope?.profileId !== evidenceView.scope.profileId
        || entry.scope?.modeId !== evidenceView.scope.modeId || entry.scope?.contextKey !== evidenceView.scope.contextKey)) {
      throw new RangeError('Exact mass requires active direct evidence provenance');
    }
    const mix = normalizePersonalStrategyExactDistribution(actionSet, point.strategyValue.exactFrequencies);
    const dominant = derivePersonalStrategyDominantAction(mix)?.type ?? null;
    const exactHeads = heads.filter((entry) => entry.claim?.kind === 'exact_action_mix');
    if (!exactHeads.length || heads.some((entry) => entry.claim?.kind === 'exact_action_mix'
      ? JSON.stringify(normalizePersonalStrategyExactDistribution(actionSet, entry.claim.value.exactFrequencies)) !== JSON.stringify(mix)
      : entry.claim?.kind !== 'dominant_action' || entry.claim.value?.dominantAction?.type !== dominant)) {
      throw new RangeError('Exact mass must match compatible active exact claims for this hand and scope');
    }
    sources.push({ id: sourceId, kind: 'personal_direct', sourceId: evidenceRefs.join('|'),
      sourceSchemaVersion: evidenceView.schemaVersion, operation: 'explicit_class_action_family_frequency' });
    weights.push({ handClass: point.handClass, weight: mix.find((entry) => entry.action.type === actionType).probability,
      provenanceId: sourceId });
  }
  const scope = evidenceView.scope;
  const range = createHoldemWeightedRangeFromHandClassWeights({ handClassWeights: weights,
    provenanceSources: sources, unlistedState: 'unknown' });
  const value = { schemaVersion: PERSONAL_WEIGHTED_RANGE_VERSION, derivationVersion: PERSONAL_WEIGHTED_RANGE_VERSION,
    subject: { profileId: scope.profileId, modeId: scope.modeId }, sourceRole: 'personal_intended', scope,
    versions: { setupVersion, approachVersion, evidenceSchema: evidenceView.schemaVersion,
      evidenceFingerprint: evidenceView.evidenceFingerprint },
    action: { type: actionType, semantics: 'action_family', amountBb: null },
    massSemantics: 'explicit_class_action_family_frequency',
    expansion: 'class_intent_applies_equally_to_physical_combos_not_suit_specific_evidence',
    exactActionConditioning: { permitted: false, reason: 'selected_action_size_frequency_unavailable' },
    range, coverage: inspectHoldemWeightedRange(range), provenance: { lineage, directEvidence: evidenceView.directEvidence },
    estimates: { availability: 'unavailable', reason: 'categorical_inference_has_no_quantitative_bounds' } };
  return freeze(structuredClone({ ...value, fingerprint: rangeFoundationFingerprint(value) }));
}

export function validatePersonalActionFamilyRange(value) {
  if (value?.schemaVersion !== PERSONAL_WEIGHTED_RANGE_VERSION || value.sourceRole !== 'personal_intended'
    || value.action?.semantics !== 'action_family' || value.exactActionConditioning?.permitted !== false) {
    throw new TypeError('Personal action-family range required');
  }
  serializeHoldemWeightedRange(value.range);
  const { fingerprint, ...content } = value;
  if (fingerprint !== rangeFoundationFingerprint(content)) throw new RangeError('Stale Personal range fingerprint');
  return value;
}
