import {
  STRATEGY_ACTION_DISTRIBUTION_CAPABILITIES,
  STRATEGY_ACTION_SIZING_CAPABILITIES,
  STRATEGY_COVERAGE_KINDS,
  STRATEGY_GRADING_CAPABILITIES,
  STRATEGY_SOURCE_AUTHORITIES,
  createStrategyContextCoverage,
  deriveStrategyResultCapabilities,
  strategyLimitationForCode,
  strategySourceDescriptorFor,
} from './strategy-source-authority.mjs';

export const STRATEGY_CLAIM_POLICY_SCHEMA_VERSION = 'strategy-claim-policy/v1';

export const STRATEGY_CLAIMS = Object.freeze({
  STRATEGY_PRESENTATION: 'strategy_presentation',
  PREFERRED_ACTION: 'preferred_action',
  RECOMMENDATION: 'recommendation',
  REFERENCE_MATCH: 'reference_match',
  REFERENCE_DEVIATION: 'reference_deviation',
  COMPARATIVE_GRADING: 'comparative_grading',
  NORMATIVE_GRADING: 'normative_grading',
  OBJECTIVE_CORRECTNESS: 'objective_correctness',
  MISTAKE: 'mistake',
  ACCURACY: 'accuracy',
  OPTIMALITY: 'optimality',
  EXACT_FREQUENCIES: 'exact_frequencies',
  ACTION_SIZING: 'action_sizing',
  ACTION_EV: 'action_ev',
  EV_LOSS: 'ev_loss',
  NORMATIVE_CURRICULUM_WEIGHTING: 'normative_curriculum_weighting',
  SOURCE_LIMITATIONS: 'source_limitations',
});

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
}

function descriptorForResult(result) {
  return strategySourceDescriptorFor(result?.source, result?.sourceDescriptor ?? null)
    || strategySourceDescriptorFor('unavailable');
}

function coverageForResult(result, descriptor) {
  const candidate = result?.contextCoverage;
  if (candidate?.kind && candidate?.schemaVersion) return candidate;
  return createStrategyContextCoverage({ kind: descriptor.defaultCoverage });
}

function limitationsFor(descriptor, coverage) {
  const codes = [
    ...(coverage.kind === STRATEGY_COVERAGE_KINDS.UNSUPPORTED ? ['context_unsupported'] : []),
    ...(coverage.limitationCodes || []),
    ...descriptor.limitations.map((entry) => entry.code),
  ];
  return [...new Set(codes)]
    .map(strategyLimitationForCode)
    .sort((left, right) => right.priority - left.priority || left.code.localeCompare(right.code));
}

export function resolveStrategyClaimPolicy(strategyResult) {
  const descriptor = descriptorForResult(strategyResult);
  const coverage = coverageForResult(strategyResult, descriptor);
  const capabilities = strategyResult?.capabilities
    || deriveStrategyResultCapabilities(descriptor, strategyResult?.actions);
  const supported = coverage.kind !== STRATEGY_COVERAGE_KINDS.UNSUPPORTED;
  const exactCoverage = coverage.kind === STRATEGY_COVERAGE_KINDS.EXACT;
  const distributionAvailable = capabilities.actionDistribution
    !== STRATEGY_ACTION_DISTRIBUTION_CAPABILITIES.NONE;
  const available = supported && distributionAvailable
    && Array.isArray(strategyResult?.actions) && strategyResult.actions.length > 0;
  const referenceAuthority = [
    STRATEGY_SOURCE_AUTHORITIES.COMPARATIVE_REFERENCE,
    STRATEGY_SOURCE_AUTHORITIES.VALIDATED_REFERENCE,
  ].includes(descriptor.authority);
  const comparative = available
    && referenceAuthority
    && capabilities.grading !== STRATEGY_GRADING_CAPABILITIES.NONE;
  const normative = comparative
    && exactCoverage
    && descriptor.authority === STRATEGY_SOURCE_AUTHORITIES.VALIDATED_REFERENCE
    && capabilities.grading === STRATEGY_GRADING_CAPABILITIES.NORMATIVE;
  const claims = {
    [STRATEGY_CLAIMS.STRATEGY_PRESENTATION]: available,
    [STRATEGY_CLAIMS.PREFERRED_ACTION]: available && capabilities.dominantAction,
    [STRATEGY_CLAIMS.RECOMMENDATION]: available && referenceAuthority,
    [STRATEGY_CLAIMS.REFERENCE_MATCH]: comparative,
    [STRATEGY_CLAIMS.REFERENCE_DEVIATION]: comparative,
    [STRATEGY_CLAIMS.COMPARATIVE_GRADING]: comparative,
    [STRATEGY_CLAIMS.NORMATIVE_GRADING]: normative,
    [STRATEGY_CLAIMS.OBJECTIVE_CORRECTNESS]: normative,
    [STRATEGY_CLAIMS.MISTAKE]: normative,
    [STRATEGY_CLAIMS.ACCURACY]: normative,
    [STRATEGY_CLAIMS.OPTIMALITY]: normative && capabilities.optimality,
    [STRATEGY_CLAIMS.EXACT_FREQUENCIES]: available
      && exactCoverage
      && capabilities.actionDistribution
        === STRATEGY_ACTION_DISTRIBUTION_CAPABILITIES.EXACT,
    [STRATEGY_CLAIMS.ACTION_SIZING]: available
      && capabilities.actionSizing !== STRATEGY_ACTION_SIZING_CAPABILITIES.NONE,
    [STRATEGY_CLAIMS.ACTION_EV]: available && capabilities.actionEv,
    [STRATEGY_CLAIMS.EV_LOSS]: normative && capabilities.actionEv,
    [STRATEGY_CLAIMS.NORMATIVE_CURRICULUM_WEIGHTING]: normative,
    [STRATEGY_CLAIMS.SOURCE_LIMITATIONS]: true,
  };
  const limitations = limitationsFor(descriptor, coverage);
  let mode = 'unavailable';
  if (available) {
    if (normative) mode = 'normative';
    else if (comparative) mode = 'comparative';
    else if (descriptor.authority === STRATEGY_SOURCE_AUTHORITIES.PERSONAL) mode = 'personal';
    else if (descriptor.authority === STRATEGY_SOURCE_AUTHORITIES.OBSERVED) mode = 'observed';
    else mode = 'exploratory';
  }
  return deepFreeze({
    schemaVersion: STRATEGY_CLAIM_POLICY_SCHEMA_VERSION,
    source: descriptor,
    sourceVersion: strategyResult?.sourceVersion ?? descriptor.version,
    authority: descriptor.authority,
    coverage,
    capabilities,
    availability: available ? 'available' : 'unavailable',
    mode,
    trainingSemantics: normative ? 'normative' : comparative ? 'comparative' : 'unavailable',
    claims,
    limitations,
    primaryLimitation: limitations[0] || null,
  });
}

export function canStrategyClaim(strategyResultOrPolicy, claim) {
  const policy = strategyResultOrPolicy?.schemaVersion === STRATEGY_CLAIM_POLICY_SCHEMA_VERSION
    ? strategyResultOrPolicy
    : resolveStrategyClaimPolicy(strategyResultOrPolicy);
  return policy.claims[String(claim)] === true;
}
