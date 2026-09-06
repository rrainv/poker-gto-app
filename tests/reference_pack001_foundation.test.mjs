import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import {
  PREFLOP_HAND_CLASSES,
  getHoldemCombosForHandClass,
} from '../shared/poker-domain/index.js';
import {
  deriveDecisionContextFromPokerState,
} from '../app/src/application/decision-context-from-poker-state.mjs';
import {
  REFERENCE_PACK_MATCHER_VERSION,
  REFERENCE_PACK_SCHEMA_VERSION,
  REFERENCE_PACK_VALIDATION_STATUSES,
  attachReferencePackIntegrity,
  computeReferencePackContentHash,
  createReferencePackAdapter,
  isReferencePackProductionEligible,
  matchReferencePackContext,
  validateReferencePack,
} from '../app/src/application/reference-pack-v1.mjs';
import { createStrategyProvider } from '../app/src/application/strategy-provider.mjs';
import {
  STRATEGY_EXACT_DISTRIBUTION_TOLERANCE,
  createStrategySourceAcceptanceRegistry,
} from '../app/src/application/strategy-source-authority.mjs';
import {
  STRATEGY_CLAIMS,
  canStrategyClaim,
  resolveStrategyClaimPolicy,
} from '../app/src/application/strategy-claim-policy.mjs';
import { createAnalysisExplanation } from '../app/src/application/analysis-explanation.mjs';
import { evaluateTrainingAnswer } from '../app/src/application/training-answer-evaluation.mjs';
import {
  HAND_REVIEW_SOURCES,
  createHandReviewProjector,
} from '../app/src/application/hand-review.mjs';
import {
  PLAYBOOK_MODES,
  createPlaybookViewModel,
} from '../app/src/application/playbook-state-source.mjs';
import { resolveHeuristicStrategy } from '../app/src/strategy/heuristic-strategy.mjs';
import { createReferenceBenchmarkRoleFixtures } from './fixtures/preflop-role001-fixtures.mjs';

const REFERENCE_PACK_SOURCE = fs.readFileSync(
  new URL('../app/src/application/reference-pack-v1.mjs', import.meta.url),
  'utf8',
);
const PROVIDER_SOURCE = fs.readFileSync(
  new URL('../app/src/application/strategy-provider.mjs', import.meta.url),
  'utf8',
);
const LOGIC_SOURCE = fs.readFileSync(
  new URL('../app/src/core/logic.js', import.meta.url),
  'utf8',
);

import { exactContext, syntheticPack } from './fixtures/reference-pack-synthetic.mjs';

function changedPack(change) {
  const draft = structuredClone(syntheticPack());
  change(draft);
  return attachReferencePackIntegrity(draft);
}

function acceptanceRegistryForPack(referencePack) {
  const descriptor = validateReferencePack(referencePack).manifest.sourceDescriptor;
  return createStrategySourceAcceptanceRegistry([{
    sourceId: descriptor.id,
    allowedFamily: descriptor.family,
    acceptedAuthority: descriptor.authority,
    acceptedCapabilities: referencePack.manifest.capabilities,
    acceptedCoverageCeiling: 'exact',
    validationStatus: 'synthetic_test_only',
    acceptanceDecisionId: 'reference_pack001_synthetic_test_acceptance',
    acceptedVersion: descriptor.version,
    acceptedFingerprint: referencePack.integrity.contentHash,
  }]);
}

function providerWithPack() {
  const referencePack = syntheticPack();
  return createStrategyProvider({
    fallbackResolver: resolveHeuristicStrategy,
    referencePack,
    allowTestReferencePack: true,
    sourceAcceptanceRegistry: acceptanceRegistryForPack(referencePack),
  });
}

test('reference-pack/v1 validates identity, source legality, provenance, integrity, and all 169 rows', () => {
  const raw = syntheticPack();
  const pack = validateReferencePack(raw);
  assert.equal(pack.schemaVersion, REFERENCE_PACK_SCHEMA_VERSION);
  assert.equal(pack.manifest.identity.packVersion, '1.0.0-test');
  assert.equal(pack.manifest.source.license.identifier, 'riverline-test-fixture');
  assert.equal(pack.manifest.source.redistribution.status, 'permitted');
  assert.equal(pack.representation.rows.length, 169);
  assert.equal(pack.manifest.capabilities.dominantAction, true);
  assert.deepEqual(
    pack.representation.rows.map((row) => row.handClass),
    PREFLOP_HAND_CLASSES,
  );
  assert.equal(raw.integrity.contentHash, computeReferencePackContentHash(raw));
  assert.equal(isReferencePackProductionEligible(pack), false);
  assert.ok(Object.isFrozen(pack));
  assert.ok(Object.isFrozen(pack.manifest.gameAssumptions));
});

test('synthetic packs cannot register in production and require an explicit test-only gate', () => {
  assert.throws(
    () => createReferencePackAdapter(syntheticPack()),
    /not eligible for production registration/,
  );
  const adapter = createReferencePackAdapter(syntheticPack(), { allowTestPack: true });
  assert.equal(adapter.productionEligible, false);
  assert.equal(adapter.lookupKind, 'canonical_preflop_hand_class_map');
});

test('pack manifest acceptance evidence grants no authority without registry acceptance', () => {
  const selfDeclaredAccepted = changedPack((pack) => {
    pack.manifest.sourceDescriptor.authority = 'validated_reference';
    pack.manifest.capabilities.grading = 'normative';
    pack.manifest.validation.status = REFERENCE_PACK_VALIDATION_STATUSES.ACCEPTED_VALIDATED;
    pack.manifest.validation.authorityDecision = 'validated_reference';
    pack.manifest.validation.acceptanceDate = '2026-08-31';
  });
  const provider = createStrategyProvider({
    fallbackResolver: resolveHeuristicStrategy,
    referencePack: selfDeclaredAccepted,
  });
  const result = provider.resolve(exactContext());
  const policy = resolveStrategyClaimPolicy(result);

  assert.equal(result.source, 'reference_pack.synthetic.bb-vs-btn-open-2.5.test');
  assert.equal(result.sourceAuthoritySnapshot, null);
  assert.equal(policy.mode, 'exploratory');
  assert.equal(canStrategyClaim(policy, STRATEGY_CLAIMS.COMPARATIVE_GRADING), false);
  assert.equal(canStrategyClaim(policy, STRATEGY_CLAIMS.EXACT_FREQUENCIES), false);
  assert.equal(canStrategyClaim(policy, STRATEGY_CLAIMS.NORMATIVE_GRADING), false);
  assert.equal(canStrategyClaim(policy, STRATEGY_CLAIMS.OPTIMALITY), false);
});

test('reference acceptance is exact-fingerprint bound and cannot survive changed pack bytes', () => {
  const acceptedPack = syntheticPack();
  const registry = acceptanceRegistryForPack(acceptedPack);
  const changed = changedPack((pack) => {
    pack.manifest.source.provenanceNotes += ' changed bytes';
  });
  const result = createStrategyProvider({
    fallbackResolver: resolveHeuristicStrategy,
    referencePack: changed,
    allowTestReferencePack: true,
    sourceAcceptanceRegistry: registry,
  }).resolve(exactContext());

  assert.notEqual(changed.integrity.contentHash, acceptedPack.integrity.contentHash);
  assert.equal(result.sourceAuthoritySnapshot, null);
  assert.equal(resolveStrategyClaimPolicy(result).mode, 'exploratory');
});

test('pack and StrategyResult share one exact-distribution tolerance', () => {
  const nearTolerance = changedPack((pack) => {
    pack.representation.rows[0].actions[0].probability += (
      STRATEGY_EXACT_DISTRIBUTION_TOLERANCE / 2
    );
  });
  assert.doesNotThrow(() => validateReferencePack(nearTolerance));
  const handClass = nearTolerance.representation.rows[0].handClass;
  const decisionContext = {
    ...exactContext(),
    heroCards: [...getHoldemCombosForHandClass(handClass)[0].cards],
  };
  const result = createStrategyProvider({
    fallbackResolver: resolveHeuristicStrategy,
    referencePack: nearTolerance,
    allowTestReferencePack: true,
    sourceAcceptanceRegistry: acceptanceRegistryForPack(nearTolerance),
  }).resolve(decisionContext);

  assert.equal(result.source, nearTolerance.manifest.sourceDescriptor.id);
  assert.equal(resolveStrategyClaimPolicy(result).mode, 'comparative');
});

test('pack validation rejects malformed mass, duplicate/missing classes, illegal actions, false sizing, and false EV', () => {
  const malformedMass = changedPack((pack) => {
    pack.representation.rows[0].actions[0].probability = 0.5;
  });
  assert.throws(() => validateReferencePack(malformedMass), /probability mass must equal 1/);

  const duplicate = changedPack((pack) => {
    pack.representation.rows[1].handClass = pack.representation.rows[0].handClass;
  });
  assert.throws(() => validateReferencePack(duplicate), /duplicate hand rows/);

  const missing = changedPack((pack) => {
    pack.representation.rows.pop();
  });
  assert.throws(() => validateReferencePack(missing), /all 169 canonical classes/);

  const impossible = changedPack((pack) => {
    pack.representation.rows[0].handClass = 'A1s';
  });
  assert.throws(() => validateReferencePack(impossible), /Impossible preflop hand class/);

  const illegal = changedPack((pack) => {
    pack.representation.rows[0].actions[0].type = 'bet';
  });
  assert.throws(() => validateReferencePack(illegal), /unsupported action bet/);

  const impossibleLegalSupport = changedPack((pack) => {
    pack.manifest.gameAssumptions.legalActionBounds.canRaise = false;
  });
  assert.throws(
    () => validateReferencePack(impossibleLegalSupport),
    /cannot declare raise bounds or sizes/,
  );

  const falseSizing = changedPack((pack) => {
    pack.manifest.capabilities.actionSizing = 'none';
  });
  assert.throws(() => validateReferencePack(falseSizing), /declares no sizing/);

  const falseEv = changedPack((pack) => {
    pack.manifest.capabilities.actionEv = true;
  });
  assert.throws(() => validateReferencePack(falseEv), /evBb must be a finite number/);
});

test('pack validation requires explicit licensing/redistribution and rejects content/version tampering', () => {
  const missingLicense = changedPack((pack) => {
    delete pack.manifest.source.license.identifier;
  });
  assert.throws(() => validateReferencePack(missingLicense), /license must contain exactly/);

  const ambiguousRedistribution = changedPack((pack) => {
    pack.manifest.source.redistribution.status = 'unknown';
  });
  assert.throws(
    () => validateReferencePack(ambiguousRedistribution),
    /Repository inclusion cannot be permitted/,
  );

  const tampered = syntheticPack();
  tampered.manifest.identity.packVersion = 'mutated-under-same-integrity';
  assert.throws(() => validateReferencePack(tampered), /contentHash does not match/);
});

test('exact matcher accepts only the canonical BB cold response to BTN 2.5bb node', () => {
  const context = exactContext();
  const match = matchReferencePackContext(syntheticPack(), context);
  assert.equal(match.schemaVersion, REFERENCE_PACK_MATCHER_VERSION);
  assert.equal(match.matched, true);
  assert.equal(match.coverage.kind, 'exact');
  assert.equal(match.handClass, 'QJo');
  assert.deepEqual(match.coverage.limitationCodes, []);
});

test('legacy total-pot-only pack remains readable but cannot claim an exact actor-price match', () => {
  const legacyPack = syntheticPack();
  delete legacyPack.manifest.gameAssumptions.priorActionTree.actorContestablePotAfterCallBb;
  delete legacyPack.manifest.gameAssumptions.priorActionTree.actorIneligiblePotAfterCallBb;
  delete legacyPack.manifest.gameAssumptions.priorActionTree.requiredRawEquity;
  legacyPack.integrity.contentHash = null;
  const readable = attachReferencePackIntegrity(legacyPack);
  assert.doesNotThrow(() => validateReferencePack(readable));
  const match = matchReferencePackContext(readable, exactContext());
  assert.equal(match.matched, false);
  assert.ok(match.coverage.limitationCodes.includes(
    'reference_pack_actor_call_economics_mismatch',
  ));
});

test('exact matcher rejects every material near-miss dimension without interpolation', () => {
  const cases = [
    ['game', (context) => { context.gameRules.definition.variant = 'omaha'; }, 'reference_pack_game_mismatch'],
    ['table', (context) => { context.tableSize = 5; }, 'reference_pack_table_size_mismatch'],
    ['positions', (context) => { context.gameRules.orderedPositions.reverse(); }, 'reference_pack_ordered_positions_mismatch'],
    ['hero', (context) => { context.heroPosition = 'SB'; }, 'reference_pack_hero_position_mismatch'],
    ['aggressor', (context) => { context.priorActionSummary.aggressorPosition = 'CO'; }, 'reference_pack_aggressor_position_mismatch'],
    ['role', (context) => { context.priorActionSummary.heroPreviousVoluntaryActionFamily = 'call'; }, 'reference_pack_decision_role_mismatch'],
    ['stack', (context) => { context.startingStackBb = 80; }, 'reference_pack_stack_mismatch'],
    ['ante', (context) => { context.gameRules.definition.ante = { type: 'uniform', amountMilliBb: 100 }; }, 'reference_pack_ante_mismatch'],
    ['rake', (context) => { context.gameRules.definition.collectionPolicy = { type: 'fixed_per_seated_player', amountMilliBb: 100 }; }, 'reference_pack_rake_mismatch'],
    ['history', (context) => { context.priorActionSummary.lastActorPosition = 'BTN'; }, 'reference_pack_prior_action_mismatch'],
    ['open-size', (context) => { context.facingSizeBb = 2.3; }, 'reference_pack_open_size_mismatch'],
    ['aggressors', (context) => { context.priorActionSummary.distinctAggressorCount = 2; }, 'reference_pack_prior_action_mismatch'],
    ['cold', (context) => { context.priorActionSummary.heroActionWouldBeCold = false; }, 'reference_pack_cold_action_mismatch'],
    ['actor-price', (context) => { context.requiredRawEquity = 0.5; }, 'reference_pack_actor_call_economics_mismatch'],
    ['legal-support', (context) => { context.canRaise = false; }, 'reference_pack_legal_action_support_mismatch'],
    ['multiway', (context) => { context.opponentCount = 2; }, 'reference_pack_opponent_count_mismatch'],
  ];
  for (const [name, mutate, expectedCode] of cases) {
    const context = structuredClone(exactContext());
    mutate(context);
    const match = matchReferencePackContext(syntheticPack(), context);
    assert.equal(match.matched, false, name);
    assert.equal(match.coverage.kind, 'unsupported', name);
    assert.ok(match.coverage.limitationCodes.includes(expectedCode), name);
  }
});

test('provider selects the exact pack result and policy remains comparative, non-EV, and non-optimal', () => {
  const result = providerWithPack().resolve(exactContext());
  const policy = resolveStrategyClaimPolicy(result);
  assert.equal(result.source, 'reference_pack.synthetic.bb-vs-btn-open-2.5.test');
  assert.equal(result.contextCoverage.kind, 'exact');
  assert.equal(result.capabilities.actionDistribution, 'exact');
  assert.equal(result.capabilities.actionSizing, 'complete');
  assert.equal(result.capabilities.actionEv, false);
  assert.equal(result.capabilities.optimality, false);
  assert.equal(result.provenance.packVersion, '1.0.0-test');
  assert.equal(result.details.referencePack.handClass, 'QJo');
  assert.equal(policy.mode, 'comparative');
  assert.equal(result.sourceAuthoritySnapshot.validationStatus, 'synthetic_test_only');
  assert.equal(
    result.sourceAuthoritySnapshot.sourceFingerprint,
    syntheticPack().integrity.contentHash,
  );
  assert.equal(policy.authority, 'comparative_reference');
  assert.equal(canStrategyClaim(policy, STRATEGY_CLAIMS.EXACT_FREQUENCIES), true);
  assert.equal(canStrategyClaim(policy, STRATEGY_CLAIMS.COMPARATIVE_GRADING), true);
  assert.equal(canStrategyClaim(policy, STRATEGY_CLAIMS.NORMATIVE_GRADING), false);
  assert.equal(canStrategyClaim(policy, STRATEGY_CLAIMS.ACTION_EV), false);
  assert.equal(canStrategyClaim(policy, STRATEGY_CLAIMS.EV_LOSS), false);
  assert.equal(canStrategyClaim(policy, STRATEGY_CLAIMS.OPTIMALITY), false);
});

test('near misses use the unchanged heuristic source with no pack/heuristic mixing', () => {
  const context = structuredClone(exactContext());
  context.facingSizeBb = 2.3;
  const withPack = providerWithPack().resolve(context);
  const fallbackOnly = createStrategyProvider({
    fallbackResolver: resolveHeuristicStrategy,
  }).resolve(context);
  assert.equal(withPack.source, 'heuristic_preflop');
  assert.equal(withPack.contextCoverage.kind, 'generalized');
  assert.deepEqual(withPack.actions, fallbackOnly.actions);
  assert.equal(withPack.details.providerSelection.referencePack.coverage, 'unsupported');
  assert.ok(withPack.details.providerSelection.referencePack.limitationCodes
    .includes('reference_pack_open_size_mismatch'));
  assert.equal(withPack.details.providerSelection.selectedSource, 'heuristic_preflop');
});

test('Playbook, Training, Matrix, Analyze, and Review consume the same normal StrategyResult path', () => {
  const provider = providerWithPack();
  const context = exactContext();
  const result = provider.resolve(context);

  const playbook = createPlaybookViewModel({
    resolution: {
      mode: PLAYBOOK_MODES.HAND,
      status: 'available',
      reason: null,
      error: null,
      decisionContext: context,
    },
    strategyResult: result,
  });
  assert.equal(playbook.source, result.source);
  assert.equal(playbook.strategyResult, result);

  const training = evaluateTrainingAnswer({
    exerciseId: 'reference-pack001-training',
    chosenActionType: 'call',
    strategyResult: result,
    decisionContext: context,
  });
  assert.equal(training.explanationData.source, result.source);
  assert.equal(resolveStrategyClaimPolicy(result).trainingSemantics, 'comparative');

  const matrixResults = PREFLOP_HAND_CLASSES.map((handClass) => provider.resolve({
    ...context,
    heroCards: [...getHoldemCombosForHandClass(handClass)[0].cards],
  }));
  assert.equal(matrixResults.length, 169);
  assert.deepEqual([...new Set(matrixResults.map((entry) => entry.source))], [result.source]);
  assert.deepEqual(
    matrixResults.map((entry) => entry.details.referencePack.handClass),
    PREFLOP_HAND_CLASSES,
  );

  const analysis = createAnalysisExplanation({ decisionContext: context, strategyResult: result });
  assert.equal(analysis.provenance.source, result.source);
  assert.equal(analysis.provenance.sourceVersion, result.sourceVersion);
  assert.equal(analysis.provenance.capabilities.actionDistribution, 'exact');

  const review = createHandReviewProjector({
    resolveStrategy: (decisionContext) => provider.resolve(decisionContext),
  }).project({
    source: HAND_REVIEW_SOURCES.CANONICAL_HAND,
    handId: 'reference-pack001-hand',
    heroPlayerId: 'P1',
    decisions: [{
      decisionId: 'reference-pack001-decision',
      decisionOrdinal: 0,
      decisionContext: context,
      replayPoint: { eventSequence: 0, actionSequence: 0 },
      chosenAction: { type: 'call' },
    }],
  });
  assert.equal(review.selectedDecision.source.id, result.source);
  assert.equal(review.selectedDecision.source.coverage, 'exact');
  assert.equal(review.selectedDecision.comparison.semantics, 'accepted_reference_comparison');
});

test('pack resolution is deterministic and uses map lookup without consumer source branches', () => {
  const provider = providerWithPack();
  assert.deepEqual(provider.resolve(exactContext()), provider.resolve(exactContext()));
  assert.match(REFERENCE_PACK_SOURCE, /new Map\(/);
  assert.match(REFERENCE_PACK_SOURCE, /rowsByHandClass\.get\(match\.handClass\)/);
  assert.doesNotMatch(REFERENCE_PACK_SOURCE, /\bfetch\s*\(|\beval\s*\(|new Function/);
  assert.match(PROVIDER_SOURCE, /createReferencePackAdapter/);
  assert.doesNotMatch(LOGIC_SOURCE, /reference_pack\.synthetic|packId\s*===|source\s*===\s*['"]reference_pack/);
});
