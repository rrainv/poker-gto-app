export const STRATEGY_SOURCE_DESCRIPTOR_SCHEMA_VERSION =
  'strategy-source-descriptor/v1';
export const STRATEGY_CONTEXT_COVERAGE_SCHEMA_VERSION =
  'strategy-context-coverage/v1';
export const STRATEGY_RESULT_CAPABILITIES_SCHEMA_VERSION =
  'strategy-result-capabilities/v1';

export const STRATEGY_SOURCE_AUTHORITIES = Object.freeze({
  NONE: 'none',
  EXPLORATORY: 'exploratory',
  COMPARATIVE_REFERENCE: 'comparative_reference',
  VALIDATED_REFERENCE: 'validated_reference',
  PERSONAL: 'personal',
  OBSERVED: 'observed',
});

export const STRATEGY_SOURCE_FAMILIES = Object.freeze({
  HEURISTIC: 'heuristic',
  EQUITY: 'equity',
  REFERENCE_PACK: 'reference_pack',
  LEARNED: 'learned',
  PERSONAL: 'personal',
  MANUAL: 'manual',
  UNAVAILABLE: 'unavailable',
});

export const STRATEGY_COVERAGE_KINDS = Object.freeze({
  EXACT: 'exact',
  GENERALIZED: 'generalized',
  UNSUPPORTED: 'unsupported',
});

export const STRATEGY_ACTION_DISTRIBUTION_CAPABILITIES = Object.freeze({
  NONE: 'none',
  QUALITATIVE: 'qualitative',
  QUANTITATIVE: 'quantitative',
  EXACT: 'exact',
});

export const STRATEGY_ACTION_SIZING_CAPABILITIES = Object.freeze({
  NONE: 'none',
  PARTIAL: 'partial',
  COMPLETE: 'complete',
});

export const STRATEGY_GRADING_CAPABILITIES = Object.freeze({
  NONE: 'none',
  COMPARATIVE: 'comparative',
  NORMATIVE: 'normative',
});

const AUTHORITY_VALUES = Object.freeze(Object.values(STRATEGY_SOURCE_AUTHORITIES));
const COVERAGE_VALUES = Object.freeze(Object.values(STRATEGY_COVERAGE_KINDS));
const DISTRIBUTION_VALUES = Object.freeze(
  Object.values(STRATEGY_ACTION_DISTRIBUTION_CAPABILITIES),
);
const SIZING_VALUES = Object.freeze(Object.values(STRATEGY_ACTION_SIZING_CAPABILITIES));
const GRADING_VALUES = Object.freeze(Object.values(STRATEGY_GRADING_CAPABILITIES));

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
}

function stableId(value, label) {
  const normalized = String(value || '');
  if (!/^[a-z0-9][a-z0-9._/-]*$/.test(normalized)) {
    throw new TypeError(`${label} must be a stable lowercase ID`);
  }
  return normalized;
}

function requiredString(value, label) {
  const normalized = String(value || '').trim();
  if (!normalized) throw new TypeError(`${label} is required`);
  return normalized;
}

export const STRATEGY_LIMITATIONS = deepFreeze({
  heuristic_not_validated: {
    code: 'heuristic_not_validated',
    messageKey: 'Useful for comparison and exploration; this source does not prove optimal play.',
    message: 'Useful for comparison and exploration; this source does not prove optimal play.',
    priority: 10,
  },
  equity_not_complete_strategy: {
    code: 'equity_not_complete_strategy',
    messageKey: 'Equity alone does not provide a complete strategy or action-EV comparison.',
    message: 'Equity alone does not provide a complete strategy or action-EV comparison.',
    priority: 20,
  },
  heuristic_hu_rfi_shared_baseline: {
    code: 'heuristic_hu_rfi_shared_baseline',
    messageKey: 'Heads-up opening uses the same broad fallback baseline as larger tables.',
    message: 'Heads-up opening uses the same broad fallback baseline as larger tables.',
    priority: 90,
  },
  heuristic_six_max_first_position_coarse: {
    code: 'heuristic_six_max_first_position_coarse',
    messageKey: 'First-position six-max opening is covered only by a broad fallback estimate.',
    message: 'First-position six-max opening is covered only by a broad fallback estimate.',
    priority: 85,
  },
  heuristic_limp_context_coarse: {
    code: 'heuristic_limp_context_coarse',
    messageKey: 'Limped preflop trees use coarse action-history semantics in this fallback.',
    message: 'Limped preflop trees use coarse action-history semantics in this fallback.',
    priority: 88,
  },
  heuristic_facing_3bet_coarse: {
    code: 'heuristic_facing_3bet_coarse',
    messageKey: 'Facing a 3-bet uses a broad fallback estimate rather than a validated reference tree.',
    message: 'Facing a 3-bet uses a broad fallback estimate rather than a validated reference tree.',
    priority: 86,
  },
  heuristic_facing_4bet_coarse: {
    code: 'heuristic_facing_4bet_coarse',
    messageKey: 'Facing a 4-bet uses a broad fallback estimate rather than a validated reference tree.',
    message: 'Facing a 4-bet uses a broad fallback estimate rather than a validated reference tree.',
    priority: 89,
  },
  heuristic_preflop_role_shared_fallback: {
    code: 'heuristic_preflop_role_shared_fallback',
    messageKey: 'The exact preflop role is preserved, but its frequencies use a shared generalized fallback.',
    message: 'The exact preflop role is preserved, but its frequencies use a shared generalized fallback.',
    priority: 91,
  },
  heuristic_preflop_role_unknown: {
    code: 'heuristic_preflop_role_unknown',
    messageKey: 'The exact preflop role is unavailable in this lossy context, so a broad fallback is used.',
    message: 'The exact preflop role is unavailable in this lossy context, so a broad fallback is used.',
    priority: 93,
  },
  heuristic_postflop_position_ignored: {
    code: 'heuristic_postflop_position_ignored',
    messageKey: 'The postflop fallback does not adjust for in-position or out-of-position play.',
    message: 'The postflop fallback does not adjust for in-position or out-of-position play.',
    priority: 70,
  },
  heuristic_postflop_position_coarse: {
    code: 'heuristic_postflop_position_coarse',
    messageKey: 'Postflop position uses a bounded heuristic adjustment, not a validated betting tree.',
    message: 'Postflop position uses a bounded heuristic adjustment, not a validated betting tree.',
    priority: 70,
  },
  heuristic_postflop_facing_wager_coarse: {
    code: 'heuristic_postflop_facing_wager_coarse',
    messageKey: 'Postflop responses use a broad fallback rather than a validated betting tree.',
    message: 'Postflop responses use a broad fallback rather than a validated betting tree.',
    priority: 80,
  },
  heuristic_postflop_facing_raise_coarse: {
    code: 'heuristic_postflop_facing_raise_coarse',
    messageKey: 'Postflop raise responses use a broad fallback rather than a validated betting tree.',
    message: 'Postflop raise responses use a broad fallback rather than a validated betting tree.',
    priority: 84,
  },
  heuristic_postflop_multiway_coarse: {
    code: 'heuristic_postflop_multiway_coarse',
    messageKey: 'Multiway postflop play is covered only by a coarse shared-range fallback.',
    message: 'Multiway postflop play is covered only by a coarse shared-range fallback.',
    priority: 92,
  },
  heuristic_exact_call_price_unavailable: {
    code: 'heuristic_exact_call_price_unavailable',
    messageKey: 'The exact call price is unavailable, so price-sensitive comparison is limited.',
    message: 'The exact call price is unavailable, so price-sensitive comparison is limited.',
    priority: 95,
  },
  context_unsupported: {
    code: 'context_unsupported',
    messageKey: 'This source does not cover the current decision context.',
    message: 'This source does not cover the current decision context.',
    priority: 100,
  },
  reference_pack_bounded_node: {
    code: 'reference_pack_bounded_node',
    messageKey: 'This reference covers only its exact declared node; nearby contexts use another source.',
    message: 'This reference covers only its exact declared node; nearby contexts use another source.',
    priority: 60,
  },
  reference_pack_no_action_ev: {
    code: 'reference_pack_no_action_ev',
    messageKey: 'This reference pack does not supply per-action EV.',
    message: 'This reference pack does not supply per-action EV.',
    priority: 40,
  },
  reference_pack_not_optimality_evidence: {
    code: 'reference_pack_not_optimality_evidence',
    messageKey: 'This reference pack does not prove optimality.',
    message: 'This reference pack does not prove optimality.',
    priority: 50,
  },
  reference_pack_synthetic_test_only: {
    code: 'reference_pack_synthetic_test_only',
    messageKey: 'Synthetic reference-pack data is test-only and is not production poker truth.',
    message: 'Synthetic reference-pack data is test-only and is not production poker truth.',
    priority: 100,
  },
});

export function strategyLimitationForCode(code) {
  const limitation = STRATEGY_LIMITATIONS[String(code || '')];
  return limitation || deepFreeze({
    code: String(code || 'source_limitation'),
    messageKey: 'The strategy source reports a limitation for this context.',
    message: 'The strategy source reports a limitation for this context.',
    priority: 1,
  });
}

function normalizeCapabilities(capabilities = {}) {
  const actionDistribution = capabilities.actionDistribution
    ?? STRATEGY_ACTION_DISTRIBUTION_CAPABILITIES.NONE;
  const actionSizing = capabilities.actionSizing
    ?? STRATEGY_ACTION_SIZING_CAPABILITIES.NONE;
  const grading = capabilities.grading ?? STRATEGY_GRADING_CAPABILITIES.NONE;
  if (!DISTRIBUTION_VALUES.includes(actionDistribution)) {
    throw new RangeError(`Unsupported action-distribution capability: ${actionDistribution}`);
  }
  if (!SIZING_VALUES.includes(actionSizing)) {
    throw new RangeError(`Unsupported action-sizing capability: ${actionSizing}`);
  }
  if (!GRADING_VALUES.includes(grading)) {
    throw new RangeError(`Unsupported grading capability: ${grading}`);
  }
  return {
    actionDistribution,
    actionSizing,
    actionEv: Boolean(capabilities.actionEv),
    grading,
    optimality: Boolean(capabilities.optimality),
  };
}

export function createStrategySourceDescriptor({
  id,
  version,
  displayName,
  displayNameKey = null,
  family,
  authority,
  capabilities = {},
  defaultCoverage = STRATEGY_COVERAGE_KINDS.UNSUPPORTED,
  limitations = [],
} = {}) {
  const normalizedAuthority = String(authority || '');
  if (!AUTHORITY_VALUES.includes(normalizedAuthority)) {
    throw new RangeError(`Unsupported strategy-source authority: ${authority}`);
  }
  if (!COVERAGE_VALUES.includes(defaultCoverage)) {
    throw new RangeError(`Unsupported default strategy coverage: ${defaultCoverage}`);
  }
  const normalizedLimitations = (Array.isArray(limitations) ? limitations : [])
    .map((entry) => strategyLimitationForCode(
      typeof entry === 'string' ? entry : entry?.code,
    ));
  return deepFreeze({
    schemaVersion: STRATEGY_SOURCE_DESCRIPTOR_SCHEMA_VERSION,
    id: stableId(id, 'Strategy source ID'),
    version: requiredString(version, 'Strategy source version'),
    displayName: requiredString(displayName, 'Strategy source display name'),
    displayNameKey: displayNameKey === null
      ? requiredString(displayName, 'Strategy source display name')
      : requiredString(displayNameKey, 'Strategy source display-name key'),
    family: stableId(family, 'Strategy source family'),
    authority: normalizedAuthority,
    capabilities: normalizeCapabilities(capabilities),
    defaultCoverage,
    limitations: normalizedLimitations,
  });
}

const HEURISTIC_CAPABILITIES = Object.freeze({
  actionDistribution: STRATEGY_ACTION_DISTRIBUTION_CAPABILITIES.QUANTITATIVE,
  actionSizing: STRATEGY_ACTION_SIZING_CAPABILITIES.PARTIAL,
  actionEv: false,
  grading: STRATEGY_GRADING_CAPABILITIES.COMPARATIVE,
  optimality: false,
});

export const STRATEGY_SOURCE_REGISTRY = deepFreeze({
  heuristic_preflop: createStrategySourceDescriptor({
    id: 'heuristic_preflop',
    version: 'riverline-preflop-heuristic/v4',
    displayName: 'Heuristic fallback',
    family: STRATEGY_SOURCE_FAMILIES.HEURISTIC,
    authority: STRATEGY_SOURCE_AUTHORITIES.COMPARATIVE_REFERENCE,
    capabilities: HEURISTIC_CAPABILITIES,
    defaultCoverage: STRATEGY_COVERAGE_KINDS.GENERALIZED,
    limitations: ['heuristic_not_validated'],
  }),
  heuristic_postflop: createStrategySourceDescriptor({
    id: 'heuristic_postflop',
    version: 'riverline-postflop-heuristic/v3',
    displayName: 'Heuristic fallback',
    family: STRATEGY_SOURCE_FAMILIES.HEURISTIC,
    authority: STRATEGY_SOURCE_AUTHORITIES.COMPARATIVE_REFERENCE,
    capabilities: HEURISTIC_CAPABILITIES,
    defaultCoverage: STRATEGY_COVERAGE_KINDS.GENERALIZED,
    limitations: ['heuristic_not_validated'],
  }),
  equity_fallback: createStrategySourceDescriptor({
    id: 'equity_fallback',
    version: 'riverline-equity-fallback/v1',
    displayName: 'Equity fallback',
    family: STRATEGY_SOURCE_FAMILIES.EQUITY,
    authority: STRATEGY_SOURCE_AUTHORITIES.EXPLORATORY,
    capabilities: {
      actionDistribution: STRATEGY_ACTION_DISTRIBUTION_CAPABILITIES.QUANTITATIVE,
      actionSizing: STRATEGY_ACTION_SIZING_CAPABILITIES.NONE,
      actionEv: false,
      grading: STRATEGY_GRADING_CAPABILITIES.NONE,
      optimality: false,
    },
    defaultCoverage: STRATEGY_COVERAGE_KINDS.GENERALIZED,
    limitations: ['equity_not_complete_strategy'],
  }),
  unavailable: createStrategySourceDescriptor({
    id: 'unavailable',
    version: 'unavailable/v1',
    displayName: 'Unavailable',
    family: STRATEGY_SOURCE_FAMILIES.UNAVAILABLE,
    authority: STRATEGY_SOURCE_AUTHORITIES.NONE,
    capabilities: {},
    defaultCoverage: STRATEGY_COVERAGE_KINDS.UNSUPPORTED,
  }),
});

export function strategySourceDescriptorFor(source, explicitDescriptor = null) {
  const sourceId = String(source || '');
  if (explicitDescriptor !== null && explicitDescriptor !== undefined) {
    const descriptor = explicitDescriptor.schemaVersion === STRATEGY_SOURCE_DESCRIPTOR_SCHEMA_VERSION
      ? explicitDescriptor
      : createStrategySourceDescriptor(explicitDescriptor);
    if (descriptor.id !== sourceId) {
      throw new RangeError('StrategyResult source must match its source descriptor ID');
    }
    return descriptor;
  }
  return STRATEGY_SOURCE_REGISTRY[sourceId] || null;
}

export function createStrategyContextCoverage({
  kind,
  basis = 'source_declaration',
  limitationCodes = [],
} = {}) {
  if (!COVERAGE_VALUES.includes(kind)) {
    throw new RangeError(`Unsupported strategy context coverage: ${kind}`);
  }
  return deepFreeze({
    schemaVersion: STRATEGY_CONTEXT_COVERAGE_SCHEMA_VERSION,
    kind,
    basis: requiredString(basis, 'Strategy coverage basis'),
    limitationCodes: [...new Set(
      (Array.isArray(limitationCodes) ? limitationCodes : []).map((entry) => String(entry)),
    )],
  });
}

function facesWager(context) {
  if (context?.callAmountBb === 0) return false;
  const family = String(
    context?.priorActionSummary?.facingActionFamily || '',
  ).toLowerCase();
  if (['bet', 'raise'].includes(family)) return true;
  return Number(context?.facingSizeBb) > 0
    || ['bet', 'raise', '3bet', '4bet'].includes(String(context?.lastAction || '').toLowerCase());
}

export function heuristicContextLimitationCodes(decisionContext) {
  if (!decisionContext || typeof decisionContext !== 'object') return [];
  const street = String(decisionContext.street || '');
  const lastAction = String(decisionContext.lastAction || '').toLowerCase();
  const prior = decisionContext.priorActionSummary;
  const aggressionFamily = String(prior?.aggressionFamily || '').toLowerCase();
  const trustedDecisionPot = decisionContext.contractVersion === 'decision-context/v1.1'
    ? Number.isFinite(decisionContext.currentPotBb)
    : Number.isFinite(decisionContext.potBb);
  const codes = [];
  if (street === 'preflop') {
    const heroPrevious = String(
      prior?.heroPreviousVoluntaryActionFamily || '',
    ).toLowerCase();
    const exactRoleFacts = Number.isInteger(prior?.distinctAggressorCount)
      && Number.isInteger(prior?.aggressionCount)
      && Number.isInteger(prior?.limperCount)
      && !['', 'unknown', 'not_applicable'].includes(heroPrevious);
    if (!exactRoleFacts) {
      codes.push('heuristic_preflop_role_unknown');
    } else {
      const blindVersusBlind = prior.aggressionCount === 1
        && decisionContext.heroPosition === 'BB'
        && (prior.initialAggressorPosition === 'SB'
          || (decisionContext.tableSize === 2
            && prior.initialAggressorPosition === 'BTN'));
      const coldFourBetOpportunity = prior.aggressionCount === 2
        && heroPrevious === 'none'
        && prior.heroActionWouldBeCold === true;
      const openerFacingColdFourBet = prior.aggressionCount === 3
        && heroPrevious === 'open'
        && prior.latestAggressionWasCold === true
        && prior.distinctAggressorCount === 3;
      const threeBettorFacingColdFourBet = prior.aggressionCount === 3
        && heroPrevious === 'three_bet'
        && prior.latestAggressionWasCold === true
        && prior.distinctAggressorCount === 3;
      const limperFacingIsolation = prior.aggressionCount === 1
        && heroPrevious === 'limp';
      if (blindVersusBlind || coldFourBetOpportunity
        || openerFacingColdFourBet || threeBettorFacingColdFourBet
        || limperFacingIsolation) {
        codes.push('heuristic_preflop_role_shared_fallback');
      }
    }
    if ((Number.isInteger(prior?.limperCount) && prior.limperCount > 0)
      || lastAction === 'check'
      || (decisionContext.heroPosition === 'BB'
        && lastAction === 'unopened'
        && decisionContext.callAmountBb === 0)) {
      codes.push('heuristic_limp_context_coarse');
    }
    if (aggressionFamily === 'three_bet' || lastAction === '3bet') {
      codes.push('heuristic_facing_3bet_coarse');
    }
    if (aggressionFamily === 'four_bet_or_more' || lastAction === '4bet') {
      codes.push('heuristic_facing_4bet_coarse');
    }
  } else if (['flop', 'turn', 'river'].includes(street)) {
    codes.push('heuristic_postflop_position_coarse');
    if (aggressionFamily === 'raise' || lastAction === 'raise') {
      codes.push('heuristic_postflop_facing_raise_coarse');
    }
    else if (facesWager(decisionContext)) codes.push('heuristic_postflop_facing_wager_coarse');
    if (Number.isInteger(decisionContext.opponentCount)
      && decisionContext.opponentCount > 1) {
      codes.push('heuristic_postflop_multiway_coarse');
    }
  }
  if (facesWager(decisionContext)
    && (!Number.isFinite(decisionContext.callAmountBb)
      || !trustedDecisionPot)) {
    codes.push('heuristic_exact_call_price_unavailable');
  }
  return [...new Set(codes)];
}

export function strategyContextCoverageFor(source, decisionContext, descriptor = null) {
  const resolvedDescriptor = descriptor || strategySourceDescriptorFor(source);
  if (!resolvedDescriptor) {
    throw new TypeError(`Unsupported StrategyResult source: ${source}`);
  }
  const limitationCodes = resolvedDescriptor.family === STRATEGY_SOURCE_FAMILIES.HEURISTIC
    ? heuristicContextLimitationCodes(decisionContext)
    : [];
  return createStrategyContextCoverage({
    kind: resolvedDescriptor.defaultCoverage,
    basis: resolvedDescriptor.family === STRATEGY_SOURCE_FAMILIES.HEURISTIC
      ? 'heuristic_generalization'
      : 'source_default',
    limitationCodes,
  });
}

export function normalizeStrategyContextCoverage(coverage, descriptor) {
  if (coverage === null || coverage === undefined) {
    return createStrategyContextCoverage({ kind: descriptor.defaultCoverage });
  }
  if (coverage.schemaVersion === STRATEGY_CONTEXT_COVERAGE_SCHEMA_VERSION) {
    return createStrategyContextCoverage(coverage);
  }
  return createStrategyContextCoverage(coverage);
}

function hasSizing(actionEntry) {
  return Number.isFinite(actionEntry?.action?.amountBb)
    || Number.isFinite(actionEntry?.action?.potFraction);
}

export function deriveStrategyResultCapabilities(descriptor, actions = []) {
  if (!descriptor || descriptor.schemaVersion !== STRATEGY_SOURCE_DESCRIPTOR_SCHEMA_VERSION) {
    throw new TypeError(`Expected ${STRATEGY_SOURCE_DESCRIPTOR_SCHEMA_VERSION}`);
  }
  const resultActions = Array.isArray(actions) ? actions : [];
  const available = resultActions.length > 0;
  const declared = descriptor.capabilities;
  const sizeRelevant = resultActions.filter((entry) => (
    ['bet', 'raise', 'all_in'].includes(entry?.action?.type)
  ));
  const sizedCount = sizeRelevant.filter(hasSizing).length;
  let actionSizing = STRATEGY_ACTION_SIZING_CAPABILITIES.NONE;
  if (declared.actionSizing !== STRATEGY_ACTION_SIZING_CAPABILITIES.NONE
    && sizedCount > 0) {
    actionSizing = declared.actionSizing === STRATEGY_ACTION_SIZING_CAPABILITIES.COMPLETE
      && sizedCount === sizeRelevant.length
      ? STRATEGY_ACTION_SIZING_CAPABILITIES.COMPLETE
      : STRATEGY_ACTION_SIZING_CAPABILITIES.PARTIAL;
  }
  return deepFreeze({
    schemaVersion: STRATEGY_RESULT_CAPABILITIES_SCHEMA_VERSION,
    actionDistribution: available
      ? declared.actionDistribution
      : STRATEGY_ACTION_DISTRIBUTION_CAPABILITIES.NONE,
    dominantAction: available,
    actionSizing,
    actionEv: available
      && declared.actionEv
      && resultActions.every((entry) => Number.isFinite(entry?.evBb)),
    grading: available ? declared.grading : STRATEGY_GRADING_CAPABILITIES.NONE,
    optimality: available && declared.optimality,
  });
}
