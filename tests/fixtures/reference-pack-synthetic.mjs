// Synthetic structure evidence only; never a production poker corpus.
import { PREFLOP_HAND_CLASSES } from '../../shared/poker-domain/index.js';
import { deriveDecisionContextFromPokerState } from '../../app/src/application/decision-context-from-poker-state.mjs';
import { REFERENCE_PACK_SCHEMA_VERSION, REFERENCE_PACK_VALIDATION_STATUSES, attachReferencePackIntegrity } from '../../app/src/application/reference-pack-v1.mjs';
import { createReferenceBenchmarkRoleFixtures } from './preflop-role001-fixtures.mjs';

export function exactContext() {
  const state = createReferenceBenchmarkRoleFixtures().bbVsButtonOpen25;
  return deriveDecisionContextFromPokerState(state, state.actingPlayerId);
}

function syntheticRows() {
  return PREFLOP_HAND_CLASSES.map((handClass) => ({
    handClass,
    actions: [
      { type: 'fold', amountToBb: null, probability: 0.25, evBb: null },
      { type: 'call', amountToBb: null, probability: 0.35, evBb: null },
      { type: 'raise', amountToBb: 11, probability: 0.3, evBb: null },
      { type: 'all_in', amountToBb: 100, probability: 0.1, evBb: null },
    ],
  }));
}

export function syntheticPack() {
  const context = exactContext();
  return attachReferencePackIntegrity({
    schemaVersion: REFERENCE_PACK_SCHEMA_VERSION,
    manifest: {
      identity: {
        packId: 'riverline.synthetic.bb-vs-btn-open-2.5.test',
        packVersion: '1.0.0-test',
      },
      sourceDescriptor: {
        id: 'reference_pack.synthetic.bb-vs-btn-open-2.5.test',
        version: 'reference-pack.synthetic.bb-vs-btn-open-2.5/v1',
        displayName: 'Synthetic bounded reference test pack',
        displayNameKey: 'Synthetic bounded reference test pack',
        family: 'reference_pack',
        authority: 'comparative_reference',
      },
      gameAssumptions: {
        gameRulesDefinition: structuredClone(context.gameRules.definition),
        gameRulesSemanticFingerprint: context.gameRules.semanticFingerprint,
        tableSize: 6,
        orderedPositions: ['UTG', 'HJ', 'CO', 'BTN', 'SB', 'BB'],
        heroPosition: 'BB',
        aggressorPosition: 'BTN',
        decisionRole: 'cold_response_to_open',
        startingStackBb: 100,
        effectiveStackBb: 97.5,
        effectiveStackSemantics: 'chips_behind_at_decision',
        priorActionTree: {
          street: 'preflop',
          lastActionFamily: 'fold',
          lastActorPosition: 'SB',
          facingActionFamily: 'raise',
          aggressionFamily: 'open',
          aggressionCount: 1,
          limperCount: 0,
          heroPreviousVoluntaryActionFamily: 'none',
          initialAggressorPosition: 'BTN',
          distinctAggressorCount: 1,
          latestAggressionWasCold: false,
          heroActionWouldBeCold: true,
          openToBb: 2.5,
          callAmountBb: 1.5,
          heroStreetContributionBb: 1,
          currentPotBb: 4,
          actorContestablePotAfterCallBb: 5.5,
          actorIneligiblePotAfterCallBb: 0,
          requiredRawEquity: 1.5 / 5.5,
        },
        availableActionFamilies: ['fold', 'call', 'raise', 'all_in'],
        supportedAggressiveSizes: [
          { type: 'raise', amountToBb: 11 },
          { type: 'all_in', amountToBb: 100 },
        ],
        legalActionBounds: {
          canRaise: true,
          minRaiseToBb: 4,
          maxRaiseToBb: 100,
          allInToBb: 100,
        },
        opponentBoundary: 'heads_up_at_decision',
        opponentCount: 1,
      },
      source: {
        origin: 'riverline_owned',
        method: 'synthetic_structure_fixture_not_poker_truth',
        sourceIdentity: 'reference-pack001-synthetic-fixture',
        sourceVersion: 'v1',
        sourceDate: '2026-08-26',
        license: {
          name: 'Riverline-owned synthetic test fixture',
          identifier: 'riverline-test-fixture',
          url: null,
        },
        redistribution: {
          status: 'permitted',
          repositoryInclusionPermitted: true,
        },
        provenanceNotes: 'Invented frequencies validate architecture only and are not poker truth.',
      },
      capabilities: {
        actionDistribution: 'exact',
        dominantAction: true,
        actionSizing: 'complete',
        actionEv: false,
        grading: 'comparative',
        optimality: false,
      },
      validation: {
        version: 'reference-pack-validation/v1',
        evidenceId: 'reference-pack001-synthetic-architecture-tests',
        status: REFERENCE_PACK_VALIDATION_STATUSES.SYNTHETIC_TEST_ONLY,
        authorityDecision: 'comparative_reference',
        validationCorpus: ['all_169_classes_synthetic_structure_only'],
        metricDefinitions: ['schema_invariants', 'exact_match_and_fallback_invariants'],
        knownLimitations: ['Invented frequencies are not poker strategy evidence.'],
        acceptanceDate: null,
      },
      limitations: [
        'reference_pack_synthetic_test_only',
        'reference_pack_bounded_node',
        'reference_pack_no_action_ev',
        'reference_pack_not_optimality_evidence',
      ],
    },
    representation: {
      kind: 'preflop_169_class',
      rows: syntheticRows(),
    },
    integrity: {
      algorithm: 'fnv1a32',
      contentHash: null,
    },
  });
}