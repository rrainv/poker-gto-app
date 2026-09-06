import { validateReferencePack, matchReferencePackContext } from './reference-pack-v1.mjs';

export const REFERENCE_COVERAGE_VERSION = 'reference-coverage-map/v1';
export const REFERENCE_COVERAGE_STATES = Object.freeze(['exact', 'generalized', 'partial', 'incompatible', 'unavailable']);
const freeze = (value) => {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.values(value).forEach(freeze); Object.freeze(value);
  }
  return value;
};

// This is an inventory of the existing pack contract, never a second matcher.
export function createReferenceCoverageMap(rawPack, nodeIdentity = null) {
  const pack = validateReferencePack(rawPack);
  const a = pack.manifest.gameAssumptions;
  return freeze({ schemaVersion: REFERENCE_COVERAGE_VERSION,
    sourceId: pack.manifest.sourceDescriptor.id, sourceVersion: pack.manifest.sourceDescriptor.version,
    nodes: [{ nodeIdentity: nodeIdentity ?? `${pack.integrity.contentHash}:preflop-node`,
      state: 'exact', representation: pack.representation.kind,
      handClasses: pack.representation.rows.map((row) => row.handClass),
      gameFormat: a.gameRulesDefinition.format, variant: a.gameRulesDefinition.variant,
      tableSize: a.tableSize, positions: a.orderedPositions, heroPosition: a.heroPosition,
      aggressorPosition: a.aggressorPosition, startingStackBb: a.startingStackBb,
      effectiveStackBb: a.effectiveStackBb, effectiveStackSemantics: a.effectiveStackSemantics,
      gameRules: a.gameRulesDefinition, gameRulesFingerprint: a.gameRulesSemanticFingerprint,
      rake: a.gameRulesDefinition.collectionPolicy, actionTree: a.priorActionTree,
      sizingTree: a.supportedAggressiveSizes, legalActionBounds: a.legalActionBounds,
      street: 'preflop', board: [], boardFamily: null, decisionRole: a.decisionRole,
      opponentCount: a.opponentCount, opponentBoundary: a.opponentBoundary }],
    summary: { exactNodes: 1, completeHandClasses: 169, streets: ['preflop'],
      generalizedNodes: 0, partialNodes: 0, postflopNodes: 0 },
  });
}

const DIMENSIONS = Object.freeze({
  stack: ['stack'], sizing: ['open_size', 'legal_bounds', 'legal_action_support'],
  rake: ['rake'], rules: ['game_', 'format', 'blinds', 'ante', 'straddle'],
  positions: ['position', 'table_size', 'opponent_count'],
  history: ['prior_action', 'cold_action', 'decision_role'],
  economics: ['economics'], cards: ['hand_unavailable', 'board_mismatch', 'dead_cards_mismatch'],
});

export function referenceCoverageFromMatch(match, nodeIdentity = null) {
  const codes = [...(match?.coverage?.limitationCodes ?? ['reference_pack_unavailable'])];
  const missing = codes.some((code) => /unavailable|required|version_mismatch|resolution_error/.test(code));
  return freeze({ schemaVersion: 'reference-coverage-query/v1',
    state: match?.matched === true ? 'exact' : missing ? 'unavailable' : 'incompatible',
    nodeIdentity, limitationCodes: codes,
    incompatibleDimensions: Object.entries(DIMENSIONS)
      .filter(([, fragments]) => codes.some((code) => fragments.some((part) => code.includes(part))))
      .map(([key]) => key),
  });
}

export function queryReferenceCoverage(pack, decisionContext, nodeIdentity = null) {
  try { return referenceCoverageFromMatch(matchReferencePackContext(pack, decisionContext), nodeIdentity); }
  catch { return referenceCoverageFromMatch(null, nodeIdentity); }
}

// A selected-source diagnostic never changes the resolved fallback's coverage.
export function selectedReferenceFacts(result, policy) {
  const selected = result?.details?.providerSelection?.referencePack;
  const hasPackNode = result?.provenance?.schemaVersion === 'reference-pack/v1'
    && result?.details?.referencePack?.schemaVersion === 'reference-pack/v1';
  const sourceAccepted = ['comparative_reference', 'validated_reference'].includes(policy?.authority)
    && policy.source?.family === 'reference_pack';
  const accepted = sourceAccepted && hasPackNode && policy?.availability === 'available'
    && policy.claims?.strategy_presentation === true && policy.coverage?.kind === 'exact';
  const coverage = selected?.coverageQuery ?? (hasPackNode
    ? { state: 'exact', incompatibleDimensions: [], limitationCodes: [] } : null);
  return freeze({ schemaVersion: 'selected-reference-facts/v1', available: accepted,
    state: accepted ? 'exact' : coverage?.state ?? 'unavailable',
    acceptance: sourceAccepted ? 'accepted' : 'unavailable',
    source: selected ? { id: selected.sourceId ?? null, version: selected.sourceVersion ?? null,
      fingerprint: selected.contentHash ?? null }
      : hasPackNode ? { id: result.source, version: result.sourceVersion,
        fingerprint: result.provenance?.contentHash ?? null } : null,
    incompatibleDimensions: coverage?.incompatibleDimensions ?? [],
    limitationCodes: coverage?.limitationCodes ?? [],
    permittedClaims: Object.keys(policy?.claims ?? {}).filter((key) => accepted && policy.claims[key]),
  });
}
