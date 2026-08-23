import test from 'node:test';
import assert from 'node:assert/strict';

import {
  ACTION_TYPES,
  CHANCE_TYPES,
  applyAction,
  applyChance,
  createAction,
} from '../shared/poker-domain/index.js';
import {
  deriveDecisionContextFromPokerState,
} from '../app/src/application/decision-context-from-poker-state.mjs';
import {
  deriveDecisionContextFromPlaybookScenario,
} from '../app/src/application/playbook-state-source.mjs';
import { createStrategyProvider } from '../app/src/application/strategy-provider.mjs';
import {
  TRAINING_CONFIG_SCHEMA_VERSION,
  TRAINING_DECISION_TYPES,
  generateTrainingExercise,
} from '../app/src/application/training-generator.mjs';
import { resolveHeuristicStrategy } from '../app/src/strategy/heuristic-strategy.mjs';
import {
  PREFLOP_DECISION_FAMILIES,
  PREFLOP_DECISION_ROLES,
  preflopDecisionRoleFor,
  preflopFallbackCalibrationFor,
} from '../app/src/strategy/preflop-heuristic.mjs';
import {
  canonicalPreflopActionHistory,
  createPreflopRoleAuditFixtures,
  createReferenceBenchmarkRoleFixtures,
} from './fixtures/preflop-role001-fixtures.mjs';

function provider() {
  return createStrategyProvider({ fallbackResolver: resolveHeuristicStrategy });
}

function context(state) {
  return deriveDecisionContextFromPokerState(state, state.actingPlayerId);
}

function strategyDistribution(result) {
  return Object.fromEntries(result.actions.map((entry) => [
    entry.action.type,
    entry.probability,
  ]));
}

function withoutRoleFacts(decisionContext) {
  const {
    heroPreviousVoluntaryActionFamily: _heroPrevious,
    initialAggressorPosition: _initialAggressor,
    distinctAggressorCount: _aggressorCount,
    latestAggressionWasCold: _latestCold,
    heroActionWouldBeCold: _heroCold,
    ...priorActionSummary
  } = decisionContext.priorActionSummary;
  return { ...decisionContext, priorActionSummary };
}

const EXPECTED_ROLES = Object.freeze({
  rfi: PREFLOP_DECISION_ROLES.UNOPENED_RFI,
  bbVsButtonOpen: PREFLOP_DECISION_ROLES.COLD_RESPONSE_TO_OPEN,
  bbVsSmallBlindOpen: PREFLOP_DECISION_ROLES.BLIND_VS_BLIND_RESPONSE_TO_SB_OPEN,
  openerFacingThreeBet: PREFLOP_DECISION_ROLES.OPENED_FACING_THREE_BET,
  coldThreeBetOpportunity: PREFLOP_DECISION_ROLES.COLD_RESPONSE_TO_OPEN,
  openerFacingColdFourBet: PREFLOP_DECISION_ROLES.OPENER_FACING_COLD_FOUR_BET,
  threeBettorFacingOrdinaryFourBet:
    PREFLOP_DECISION_ROLES.THREE_BETTOR_FACING_FOUR_BET,
  coldFourBetOpportunity: PREFLOP_DECISION_ROLES.COLD_FOUR_BET_OPPORTUNITY,
  oneLimpIsolationOpportunity: PREFLOP_DECISION_ROLES.ISOLATION_OPPORTUNITY,
  limperFacingIsolation: PREFLOP_DECISION_ROLES.LIMPER_FACING_ISOLATION,
  multipleLimpers: PREFLOP_DECISION_ROLES.ISOLATION_OPPORTUNITY,
  bbOptionAfterLimps: PREFLOP_DECISION_ROLES.BB_OPTION_AFTER_LIMPS,
});

test('canonical fixtures preserve the exact required preflop action histories', () => {
  const fixtures = createPreflopRoleAuditFixtures();
  const F = ACTION_TYPES.FOLD;
  const C = ACTION_TYPES.CALL;
  const R = ACTION_TYPES.RAISE;
  const action = (actorPosition, actionType, amountToBb = null) => ({
    actorPosition, actionType, amountToBb,
  });
  const expected = {
    rfi: [],
    bbVsButtonOpen: [
      action('UTG', F), action('HJ', F), action('CO', F),
      action('BTN', R, 2.5), action('SB', F),
    ],
    bbVsSmallBlindOpen: [
      action('UTG', F), action('HJ', F), action('CO', F), action('BTN', F),
      action('SB', R, 3.5),
    ],
    openerFacingThreeBet: [
      action('UTG', F), action('HJ', F), action('CO', F),
      action('BTN', R, 2.5), action('SB', F), action('BB', R, 11),
    ],
    coldThreeBetOpportunity: [action('UTG', R, 2.5)],
    openerFacingColdFourBet: [
      action('UTG', F), action('HJ', F), action('CO', F),
      action('BTN', R, 2.5), action('SB', R, 11), action('BB', R, 24),
    ],
    threeBettorFacingOrdinaryFourBet: [
      action('UTG', F), action('HJ', F), action('CO', F),
      action('BTN', R, 2.5), action('SB', F), action('BB', R, 11),
      action('BTN', R, 24),
    ],
    coldFourBetOpportunity: [
      action('UTG', F), action('HJ', F), action('CO', F),
      action('BTN', R, 2.5), action('SB', R, 11),
    ],
    oneLimpIsolationOpportunity: [action('UTG', C)],
    limperFacingIsolation: [
      action('UTG', F), action('HJ', F), action('CO', F), action('BTN', F),
      action('SB', C), action('BB', R, 3.5),
    ],
    multipleLimpers: [action('UTG', C), action('HJ', C)],
    bbOptionAfterLimps: [
      action('UTG', C), action('HJ', F), action('CO', F), action('BTN', F),
      action('SB', F),
    ],
  };
  for (const [id, state] of Object.entries(fixtures)) {
    assert.deepEqual(canonicalPreflopActionHistory(state), expected[id], id);
  }
});

test('DecisionContext role facts and classifier distinguish every required preflop role', () => {
  const contexts = Object.fromEntries(
    Object.entries(createPreflopRoleAuditFixtures()).map(([id, state]) => [id, context(state)]),
  );
  for (const [id, decisionContext] of Object.entries(contexts)) {
    assert.equal(preflopDecisionRoleFor(decisionContext), EXPECTED_ROLES[id], id);
  }

  assert.deepEqual({
    heroPrevious: contexts.openerFacingColdFourBet.priorActionSummary
      .heroPreviousVoluntaryActionFamily,
    initial: contexts.openerFacingColdFourBet.priorActionSummary.initialAggressorPosition,
    current: contexts.openerFacingColdFourBet.priorActionSummary.aggressorPosition,
    distinctAggressors: contexts.openerFacingColdFourBet.priorActionSummary
      .distinctAggressorCount,
    latestCold: contexts.openerFacingColdFourBet.priorActionSummary.latestAggressionWasCold,
    heroCold: contexts.openerFacingColdFourBet.priorActionSummary.heroActionWouldBeCold,
  }, {
    heroPrevious: 'open',
    initial: 'BTN',
    current: 'BB',
    distinctAggressors: 3,
    latestCold: true,
    heroCold: false,
  });
  assert.equal(
    contexts.coldFourBetOpportunity.priorActionSummary.heroActionWouldBeCold,
    true,
  );
  assert.equal(
    contexts.threeBettorFacingOrdinaryFourBet.priorActionSummary.latestAggressionWasCold,
    false,
  );
  assert.equal(
    contexts.limperFacingIsolation.priorActionSummary.heroPreviousVoluntaryActionFamily,
    'limp',
  );
  assert.notEqual(
    preflopDecisionRoleFor(contexts.bbVsButtonOpen),
    preflopDecisionRoleFor(contexts.bbVsSmallBlindOpen),
  );
});

test('exact role metadata survives honest shared fallback calibration without probability changes', () => {
  const strategyProvider = provider();
  for (const [id, state] of Object.entries(createPreflopRoleAuditFixtures())) {
    const decisionContext = context(state);
    const result = strategyProvider.resolve(decisionContext);
    const compatibilityResult = strategyProvider.resolve(withoutRoleFacts(decisionContext));
    assert.equal(result.details.decisionRole, EXPECTED_ROLES[id], id);
    assert.equal(result.details.actualRole, EXPECTED_ROLES[id], id);
    assert.equal(
      result.details.fallbackCalibration,
      preflopFallbackCalibrationFor(decisionContext),
      id,
    );
    assert.deepEqual(
      strategyDistribution(result),
      strategyDistribution(compatibilityResult),
      `${id} probability drift`,
    );
  }

  const contexts = Object.fromEntries(
    Object.entries(createPreflopRoleAuditFixtures()).map(([id, state]) => [id, context(state)]),
  );
  assert.equal(
    provider().resolve(contexts.coldFourBetOpportunity).details.fallbackCalibration,
    PREFLOP_DECISION_FAMILIES.VERSUS_THREE_BET,
  );
  assert.equal(
    provider().resolve(contexts.openerFacingColdFourBet).details.fallbackCalibration,
    PREFLOP_DECISION_FAMILIES.VERSUS_FOUR_BET_OR_MORE,
  );
  assert.equal(
    provider().resolve(contexts.limperFacingIsolation).details.fallbackCalibration,
    PREFLOP_DECISION_FAMILIES.VERSUS_OPEN,
  );
  assert.ok(provider().resolve(contexts.coldFourBetOpportunity)
    .contextCoverage.limitationCodes.includes('heuristic_preflop_role_shared_fallback'));
});

test('lossy Scenario keeps role facts unknown while retaining its legacy fallback route', () => {
  const scenario = {
    tableSize: 6,
    heroPosition: 'BTN',
    street: 'preflop',
    heroCards: ['As', 'Kd'],
    board: [],
    deadCards: [],
    stackBb: 100,
    stackMode: 'hero',
    potBb: 11.5,
    lastAction: '3bet',
    lastActionLabel: '3-bet',
    facingSizeBb: 8,
    rakeMode: 'off',
    forcedContributionPerPlayerBb: 0,
    totalForcedContributionBb: 0,
    anteBb: 0,
    straddleBb: 0,
  };
  const first = deriveDecisionContextFromPlaybookScenario(scenario);
  const second = deriveDecisionContextFromPlaybookScenario(scenario);
  assert.equal(first.priorActionSummary.heroPreviousVoluntaryActionFamily, 'unknown');
  assert.equal(first.priorActionSummary.initialAggressorPosition, null);
  assert.equal(first.priorActionSummary.distinctAggressorCount, null);
  assert.equal(first.priorActionSummary.latestAggressionWasCold, null);
  assert.equal(first.priorActionSummary.heroActionWouldBeCold, null);
  assert.equal(preflopDecisionRoleFor(first), PREFLOP_DECISION_ROLES.UNKNOWN);
  assert.equal(
    preflopFallbackCalibrationFor(first),
    PREFLOP_DECISION_FAMILIES.VERSUS_THREE_BET,
  );
  const result = provider().resolve(first);
  assert.equal(result.details.actualRole, PREFLOP_DECISION_ROLES.UNKNOWN);
  assert.equal(result.details.fallbackCalibration, PREFLOP_DECISION_FAMILIES.VERSUS_THREE_BET);
  assert.ok(result.contextCoverage.limitationCodes.includes('heuristic_preflop_role_unknown'));
  assert.equal(JSON.stringify(first), JSON.stringify(second));
  for (const field of [
    'priorActionSummary.heroPreviousVoluntaryActionFamily',
    'priorActionSummary.initialAggressorPosition',
    'priorActionSummary.distinctAggressorCount',
    'priorActionSummary.latestAggressionWasCold',
    'priorActionSummary.heroActionWouldBeCold',
  ]) {
    assert.ok(first.derivation.events.some((event) => (
      event.field === field && event.quality === 'unavailable'
    )), field);
  }
});

test('reference benchmark role fixtures carry non-colliding exact tree identity', () => {
  const fixtures = createReferenceBenchmarkRoleFixtures();
  const resolved = Object.fromEntries(Object.entries(fixtures).map(([id, state]) => {
    const decisionContext = context(state);
    return [id, {
      heroPosition: decisionContext.heroPosition,
      role: preflopDecisionRoleFor(decisionContext),
      initialAggressor: decisionContext.priorActionSummary.initialAggressorPosition,
      currentAggressor: decisionContext.priorActionSummary.aggressorPosition,
      heroPrevious: decisionContext.priorActionSummary.heroPreviousVoluntaryActionFamily,
      latestCold: decisionContext.priorActionSummary.latestAggressionWasCold,
      heroCold: decisionContext.priorActionSummary.heroActionWouldBeCold,
    }];
  }));

  assert.deepEqual(resolved.bbVsButtonOpen25, {
    heroPosition: 'BB',
    role: PREFLOP_DECISION_ROLES.COLD_RESPONSE_TO_OPEN,
    initialAggressor: 'BTN', currentAggressor: 'BTN', heroPrevious: 'none',
    latestCold: false, heroCold: true,
  });
  assert.deepEqual(resolved.bbVsSmallBlindOpen35, {
    heroPosition: 'BB',
    role: PREFLOP_DECISION_ROLES.BLIND_VS_BLIND_RESPONSE_TO_SB_OPEN,
    initialAggressor: 'SB', currentAggressor: 'SB', heroPrevious: 'none',
    latestCold: false, heroCold: true,
  });
  assert.equal(
    resolved.buttonOpenSmallBlindThreeBetBigBlindDecision.role,
    PREFLOP_DECISION_ROLES.COLD_FOUR_BET_OPPORTUNITY,
  );
  assert.equal(
    resolved.buttonOpenSmallBlindThreeBetBigBlindColdFourBetButtonDecision.role,
    PREFLOP_DECISION_ROLES.OPENER_FACING_COLD_FOUR_BET,
  );
  assert.equal(
    resolved.smallBlindLimpBigBlindIsolateSmallBlindDecision.role,
    PREFLOP_DECISION_ROLES.LIMPER_FACING_ISOLATION,
  );
  assert.equal(new Set(Object.values(resolved).map((entry) => JSON.stringify(entry))).size, 5);
});

test('Training records the realized decision role separately from its generic target label', () => {
  const strategyProvider = provider();
  const cases = [
    [TRAINING_DECISION_TYPES.PREFLOP_UNOPENED, 'BTN', PREFLOP_DECISION_ROLES.UNOPENED_RFI],
    [TRAINING_DECISION_TYPES.PREFLOP_FACING_OPEN, 'BTN', PREFLOP_DECISION_ROLES.COLD_RESPONSE_TO_OPEN],
    [TRAINING_DECISION_TYPES.PREFLOP_FACING_3BET, 'BTN', PREFLOP_DECISION_ROLES.OPENED_FACING_THREE_BET],
    [TRAINING_DECISION_TYPES.PREFLOP_FACING_4BET, 'BTN', PREFLOP_DECISION_ROLES.THREE_BETTOR_FACING_COLD_FOUR_BET],
    [TRAINING_DECISION_TYPES.PREFLOP_BB_OPTION, 'BB', PREFLOP_DECISION_ROLES.BB_OPTION_AFTER_LIMPS],
  ];
  for (const [target, heroPosition, expectedRole] of cases) {
    const generated = generateTrainingExercise({
      schemaVersion: TRAINING_CONFIG_SCHEMA_VERSION,
      tableSize: 6,
      stackBb: 100,
      streets: ['preflop'],
      gameMode: 'home',
      heroPositions: [heroPosition],
      allowedDecisionTypes: [target],
      difficulty: 'hard',
      seed: 20_000 + cases.findIndex((entry) => entry[0] === target),
    }, { strategyProvider });
    assert.equal(generated.ok, true, generated.error?.message);
    const exercise = generated.exercise;
    assert.equal(exercise.generationMetadata.targetReason, target);
    assert.equal(exercise.generationMetadata.curriculum.actionCategory, target);
    assert.equal(exercise.generationMetadata.curriculum.decisionRole, expectedRole);
    assert.equal(exercise.strategyResult.details.decisionRole, expectedRole);
    assert.equal(
      exercise.generationMetadata.curriculum.fallbackCalibration,
      exercise.strategyResult.details.fallbackCalibration,
    );
  }
});

test('postflop action probabilities remain byte-identical when preflop-only role facts are absent', () => {
  const state = createPreflopRoleAuditFixtures().bbOptionAfterLimps;
  const checked = applyAction(
    state,
    createAction(state.actingPlayerId, ACTION_TYPES.CHECK),
  );
  const flop = applyChance(checked, {
    type: CHANCE_TYPES.DEAL_FLOP,
    cards: ['2c', '7c', 'Jh'],
  });
  const decisionContext = context(flop);
  const current = provider().resolve(decisionContext);
  const stripped = provider().resolve(withoutRoleFacts(decisionContext));
  assert.deepEqual(current.actions, stripped.actions);
});
