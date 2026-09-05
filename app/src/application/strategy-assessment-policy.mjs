import { liveStrategyResultAcceptanceFor } from './strategy-source-authority.mjs';

export const ASSESSMENT_POLICY_VERSION = 'strategy-assessment-policy/v1';
const acceptedPolicies = new WeakSet();
const bindings = new WeakMap();
const types = new Set(['fold', 'check', 'call', 'bet', 'raise', 'all_in']);
export const sizedAssessmentAction = (action) => ['bet', 'raise', 'all_in'].includes(action?.type);
export function freezeAssessmentData(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(freezeAssessmentData);
  return Object.freeze(value);
}
function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]));
}
// Exact portable identity, not a cryptographic proof. No lossy spot matching.
export const assessmentContextIdentity = (context) => JSON.stringify(stable(context));
export const assessmentActionKey = (action) => `${action?.type}:${sizedAssessmentAction(action) ? action.amountBb ?? '?' : '-'}`;

export function validateAssessmentPolicy(policy) {
  if (policy?.schemaVersion !== ASSESSMENT_POLICY_VERSION
    || policy.criterion !== 'positive_probability_action_set/v1'
    || policy.sizingSemantics !== 'exact_total_to'
    || policy.missingUniverseMember !== 'explicit_zero_support'
    || policy.requiredCapabilities?.actionDistribution !== 'exact'
    || policy.requiredCapabilities?.grading !== 'normative') throw new TypeError('Unsupported assessment criterion');
  for (const key of ['id', 'version', 'acceptanceDecisionId', 'sourceId', 'sourceVersion', 'sourceFingerprint', 'contextIdentity']) {
    if (typeof policy[key] !== 'string' || !policy[key]) throw new TypeError(`Assessment requires ${key}`);
  }
  if (!Array.isArray(policy.actionUniverse) || !policy.actionUniverse.length
    || policy.actionUniverse.some((a) => !types.has(a?.type)
      || (a.potFraction !== null && a.potFraction !== undefined)
      || (sizedAssessmentAction(a) && (!Number.isFinite(a.amountBb) || a.amountBb < 0)))) {
    throw new TypeError('Assessment requires an explicit complete sized action universe');
  }
  const keys = policy.actionUniverse.map(assessmentActionKey);
  if (policy.actionUniverse.some(sizedAssessmentAction)
    && policy.requiredCapabilities.actionSizing !== 'complete') throw new TypeError('Sized assessment requires complete sizing capability');
  if (new Set(keys).size !== keys.length || !Array.isArray(policy.ambiguousActionKeys)
    || policy.ambiguousActionKeys.some((key) => !keys.includes(key))) throw new TypeError('Invalid assessment action boundaries');
  for (const key of ['supported', 'unsupported', 'remediation']) {
    if (typeof policy.claimPermissions?.[key] !== 'boolean') throw new TypeError('Explicit assessment claim permissions required');
  }
  return policy;
}

// Only the application composition root supplies reviewed entries. A provider
// declaration, persisted snapshot, or schema-shaped object cannot mint acceptance.
export function createAssessmentPolicyAcceptanceRegistry(entries = []) {
  const policies = entries.map((entry) => {
    const policy = freezeAssessmentData(structuredClone(validateAssessmentPolicy(entry)));
    acceptedPolicies.add(policy);
    return policy;
  });
  if (new Set(policies.map((p) => `${p.sourceId}:${p.contextIdentity}`)).size !== policies.length) {
    throw new RangeError('Ambiguous assessment-policy registration');
  }
  return Object.freeze({
    acceptanceFor(result, context) {
      return policies.find((p) => p.sourceId === result?.source
        && p.sourceVersion === result?.sourceVersion
        && p.sourceFingerprint === result?.provenance?.contentHash
        && p.contextIdentity === assessmentContextIdentity(context)) ?? null;
    },
  });
}

export function bindStrategyAssessmentPolicy(result, context, registry) {
  const policy = registry?.acceptanceFor(result, context);
  const source = liveStrategyResultAcceptanceFor(result, result?.sourceDescriptor, result?.provenance?.contentHash);
  if (acceptedPolicies.has(policy) && source?.acceptedAuthority === 'validated_reference'
    && result.sourceDescriptor?.authority === 'validated_reference'
    && result.sourceDescriptor?.family !== 'heuristic'
    && source.acceptedCoverageCeiling === 'exact' && result.contextCoverage?.kind === 'exact'
    && policy.sourceId === result.source && policy.sourceVersion === result.sourceVersion
    && policy.sourceFingerprint === result.provenance?.contentHash
    && Object.entries(policy.requiredCapabilities).every(([key, value]) =>
      source.acceptedCapabilities[key] === value && result.capabilities?.[key] === value)
    && result.actions.every((entry) => policy.actionUniverse.some((action) => assessmentActionKey(action) === assessmentActionKey(entry.action)))
    && new Set(result.actions.map((entry) => assessmentActionKey(entry.action))).size === result.actions.length
    && result.actions.every((entry) => entry.action.potFraction === null || entry.action.potFraction === undefined)
    && context?.derivation?.source === 'canonical_hand'
    && context?.contractVersion === 'decision-context/v1.1' && context?.gameRules
    && typeof context.gameRules.semanticFingerprint === 'string' && context.gameRules.semanticFingerprint.length > 0
    && policy.contextIdentity === assessmentContextIdentity(context)) bindings.set(result, policy);
  return result;
}
export function acceptedAssessmentPolicyFor(result) {
  return bindings.get(result) ?? null;
}
