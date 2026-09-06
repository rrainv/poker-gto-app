import {
  STRATEGY_ACTION_DISTRIBUTION_CAPABILITIES,
  STRATEGY_ACTION_SIZING_CAPABILITIES,
  STRATEGY_COVERAGE_KINDS,
  STRATEGY_GRADING_CAPABILITIES,
  STRATEGY_SOURCE_AUTHORITIES,
  createStrategyContextCoverage,
  deriveStrategyResultCapabilities,
  liveStrategyResultAcceptanceFor,
  strategyLimitationForCode,
  strategySourceDescriptorFor,
} from './strategy-source-authority.mjs';

import { acceptedAssessmentPolicyFor } from './strategy-assessment-policy.mjs';
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
  const declared = candidate?.kind && candidate?.schemaVersion
    ? candidate
    : createStrategyContextCoverage({ kind: descriptor.defaultCoverage });
  const acceptance = acceptedSourceForResult(result, descriptor);
  const ceiling = acceptance?.acceptedCoverageCeiling
    ?? STRATEGY_COVERAGE_KINDS.GENERALIZED;
  const rank = {
    [STRATEGY_COVERAGE_KINDS.UNSUPPORTED]: 0,
    [STRATEGY_COVERAGE_KINDS.GENERALIZED]: 1,
    [STRATEGY_COVERAGE_KINDS.EXACT]: 2,
  };
  const kind = rank[declared.kind] <= rank[ceiling] ? declared.kind : ceiling;
  return createStrategyContextCoverage({
    kind,
    basis: kind === declared.kind ? declared.basis : 'application_acceptance_ceiling',
    limitationCodes: [
      ...(declared.limitationCodes || []),
      ...(acceptance ? [] : ['source_not_accepted']),
    ],
  });
}

function acceptedSourceForResult(result, descriptor) {
  const fingerprint = result?.provenance?.contentHash ?? null;
  return liveStrategyResultAcceptanceFor(
    result,
    descriptor,
    fingerprint,
  );
}

function capabilitiesForResult(result, descriptor, acceptance) {
  const declared = deriveStrategyResultCapabilities(descriptor, result?.actions);
  if (!acceptance) {
    return deepFreeze({
      ...declared,
      actionDistribution: declared.actionDistribution
        === STRATEGY_ACTION_DISTRIBUTION_CAPABILITIES.NONE
        ? STRATEGY_ACTION_DISTRIBUTION_CAPABILITIES.NONE
        : STRATEGY_ACTION_DISTRIBUTION_CAPABILITIES.QUANTITATIVE,
      actionSizing: STRATEGY_ACTION_SIZING_CAPABILITIES.NONE,
      actionEv: false,
      grading: STRATEGY_GRADING_CAPABILITIES.NONE,
      optimality: false,
    });
  }
  const distributionRank = ['none', 'qualitative', 'quantitative', 'exact'];
  const sizingRank = ['none', 'partial', 'complete'];
  const gradingRank = ['none', 'comparative', 'normative'];
  const ceiling = acceptance.acceptedCapabilities;
  const lower = (value, accepted, order) => (
    order[Math.min(order.indexOf(value), order.indexOf(accepted))]
  );
  return deepFreeze({
    ...declared,
    actionDistribution: lower(
      declared.actionDistribution,
      ceiling.actionDistribution,
      distributionRank,
    ),
    actionSizing: lower(declared.actionSizing, ceiling.actionSizing, sizingRank),
    actionEv: declared.actionEv && ceiling.actionEv,
    grading: lower(declared.grading, ceiling.grading, gradingRank),
    optimality: declared.optimality && ceiling.optimality,
  });
}

function authorityFor(descriptor, acceptance) {
  if (!acceptance) {
    return descriptor.family === 'unavailable'
      ? STRATEGY_SOURCE_AUTHORITIES.NONE
      : STRATEGY_SOURCE_AUTHORITIES.EXPLORATORY;
  }
  const referenceOrder = [
    STRATEGY_SOURCE_AUTHORITIES.NONE,
    STRATEGY_SOURCE_AUTHORITIES.EXPLORATORY,
    STRATEGY_SOURCE_AUTHORITIES.COMPARATIVE_REFERENCE,
    STRATEGY_SOURCE_AUTHORITIES.VALIDATED_REFERENCE,
  ];
  const declaredRank = referenceOrder.indexOf(descriptor.authority);
  const acceptedRank = referenceOrder.indexOf(acceptance.acceptedAuthority);
  if (declaredRank >= 0 && acceptedRank >= 0) {
    return referenceOrder[Math.min(declaredRank, acceptedRank)];
  }
  return descriptor.authority === acceptance.acceptedAuthority
    ? descriptor.authority
    : STRATEGY_SOURCE_AUTHORITIES.EXPLORATORY;
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
  const acceptance = acceptedSourceForResult(strategyResult, descriptor);
  const coverage = coverageForResult(strategyResult, descriptor);
  const capabilities = capabilitiesForResult(strategyResult, descriptor, acceptance);
  const supported = coverage.kind !== STRATEGY_COVERAGE_KINDS.UNSUPPORTED;
  const exactCoverage = coverage.kind === STRATEGY_COVERAGE_KINDS.EXACT;
  const distributionAvailable = capabilities.actionDistribution
    !== STRATEGY_ACTION_DISTRIBUTION_CAPABILITIES.NONE;
  const available = supported && distributionAvailable
    && Array.isArray(strategyResult?.actions) && strategyResult.actions.length > 0;
  const acceptedAuthority = authorityFor(descriptor, acceptance);
  const referenceAuthority = descriptor.family !== 'heuristic' && exactCoverage && [
    STRATEGY_SOURCE_AUTHORITIES.COMPARATIVE_REFERENCE,
    STRATEGY_SOURCE_AUTHORITIES.VALIDATED_REFERENCE,
  ].includes(acceptedAuthority);
  let comparative = available
    && referenceAuthority
    && capabilities.grading !== STRATEGY_GRADING_CAPABILITIES.NONE;
  let normative = comparative
    && exactCoverage
    && acceptedAuthority === STRATEGY_SOURCE_AUTHORITIES.VALIDATED_REFERENCE
    && capabilities.grading === STRATEGY_GRADING_CAPABILITIES.NORMATIVE
    && acceptedAssessmentPolicyFor(strategyResult) !== null;
  const assessmentPermissions = acceptedAssessmentPolicyFor(strategyResult)?.claimPermissions;
  const claims = {
    [STRATEGY_CLAIMS.STRATEGY_PRESENTATION]: available,
    [STRATEGY_CLAIMS.PREFERRED_ACTION]: available && capabilities.dominantAction,
    [STRATEGY_CLAIMS.RECOMMENDATION]: available && referenceAuthority,
    [STRATEGY_CLAIMS.REFERENCE_MATCH]: comparative,
    [STRATEGY_CLAIMS.REFERENCE_DEVIATION]: comparative,
    [STRATEGY_CLAIMS.COMPARATIVE_GRADING]: comparative,
    [STRATEGY_CLAIMS.NORMATIVE_GRADING]: normative,
    [STRATEGY_CLAIMS.OBJECTIVE_CORRECTNESS]: normative && assessmentPermissions.supported,
    [STRATEGY_CLAIMS.MISTAKE]: normative && assessmentPermissions.unsupported,
    [STRATEGY_CLAIMS.ACCURACY]: false,
    [STRATEGY_CLAIMS.OPTIMALITY]: false,
    [STRATEGY_CLAIMS.EXACT_FREQUENCIES]: available
      && exactCoverage
      && capabilities.actionDistribution
        === STRATEGY_ACTION_DISTRIBUTION_CAPABILITIES.EXACT,
    [STRATEGY_CLAIMS.ACTION_SIZING]: available
      && capabilities.actionSizing !== STRATEGY_ACTION_SIZING_CAPABILITIES.NONE,
    [STRATEGY_CLAIMS.ACTION_EV]: available && capabilities.actionEv,
    [STRATEGY_CLAIMS.EV_LOSS]: false,
    [STRATEGY_CLAIMS.NORMATIVE_CURRICULUM_WEIGHTING]: false,
    [STRATEGY_CLAIMS.SOURCE_LIMITATIONS]: true,
  };
  if (acceptance?.acceptedClaimClasses !== null && acceptance?.acceptedClaimClasses !== undefined) {
    for (const key of Object.keys(claims)) {
      if (key !== STRATEGY_CLAIMS.SOURCE_LIMITATIONS) claims[key] &&= acceptance.acceptedClaimClasses.includes(key);
    }
    // Denying a parent permission also denies dependent language and grading.
    if (!claims.strategy_presentation) {
      for (const key of Object.keys(claims)) if (key !== STRATEGY_CLAIMS.SOURCE_LIMITATIONS) claims[key] = false;
    }
    claims.normative_grading &&= claims.comparative_grading;
    if (!claims.normative_grading) {
      for (const key of ['objective_correctness', 'mistake', 'normative_curriculum_weighting']) claims[key] = false;
    }
    comparative &&= claims.comparative_grading;
    normative &&= claims.normative_grading;
  }
  const limitations = limitationsFor(descriptor, coverage);
  let mode = 'unavailable';
  if (available) {
    if (normative) mode = 'normative';
    else if (comparative) mode = 'comparative';
    else if (acceptedAuthority === STRATEGY_SOURCE_AUTHORITIES.PERSONAL) mode = 'personal';
    else if (acceptedAuthority === STRATEGY_SOURCE_AUTHORITIES.OBSERVED) mode = 'observed';
    else mode = 'exploratory';
  }
  return deepFreeze({
    schemaVersion: STRATEGY_CLAIM_POLICY_SCHEMA_VERSION,
    source: descriptor,
    sourceVersion: strategyResult?.sourceVersion ?? descriptor.version,
    authority: acceptedAuthority,
    sourceAuthoritySnapshot: strategyResult?.sourceAuthoritySnapshot ?? null,
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
