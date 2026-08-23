import test from 'node:test';
import assert from 'node:assert/strict';

import {
  deriveDecisionContextFromPokerState,
} from '../app/src/application/decision-context-from-poker-state.mjs';
import { createStrategyProvider } from '../app/src/application/strategy-provider.mjs';
import {
  TRAINING_CONFIG_SCHEMA_VERSION,
  TRAINING_DECISION_TYPES,
  generateTrainingExercise,
} from '../app/src/application/training-generator.mjs';
import { resolveHeuristicStrategy } from '../app/src/strategy/heuristic-strategy.mjs';
import {
  PREFLOP_DECISION_ROLES,
  calculatePreflopFallbackStrategy,
  extractPreflopHandFeatures,
  preflopFallbackCalibrationFor,
} from '../app/src/strategy/preflop-heuristic.mjs';
import { getHoldemCombosForHandClass } from '../shared/poker-domain/holdem-combos.js';
import {
  createPreflopRoleAuditFixtures,
} from './fixtures/preflop-role001-fixtures.mjs';
import {
  PREFLOP_HAND_CLASSES,
  POSTFLOP_NAMED_CORPUS,
  representativeCardsForClass,
} from './tooling/strategy-calibration-corpora.mjs';
import {
  COLD_RESPONSE_PAIRWISE_PROBES,
  actionVectorForResult,
  buildColdResponseToOpenDiagnostic,
} from './tooling/strategy-calibration-harness.mjs';

function provider() {
  return createStrategyProvider({ fallbackResolver: resolveHeuristicStrategy });
}

function context(state) {
  return deriveDecisionContextFromPokerState(state, state.actingPlayerId);
}

function targetContext(handClass) {
  const state = createPreflopRoleAuditFixtures().bbVsButtonOpen;
  return {
    ...context(state),
    heroCards: representativeCardsForClass(handClass),
  };
}

function resultFor(handClass) {
  return provider().resolve(targetContext(handClass));
}

function vectorFor(handClass) {
  return actionVectorForResult(resultFor(handClass));
}

function strategicDepth(decisionContext) {
  if (decisionContext.contractVersion !== 'decision-context/v1.1') {
    return decisionContext.stackBb;
  }
  return Number.isFinite(decisionContext.effectiveStackBb)
    ? decisionContext.effectiveStackBb
    : decisionContext.heroStackBb;
}

function legacyVector(decisionContext) {
  const [first, second] = decisionContext.heroCards;
  const fallback = calculatePreflopFallbackStrategy(
    first[0],
    second[0],
    first[0] === second[0],
    first[1] === second[1],
    decisionContext.heroPosition,
    decisionContext.lastAction,
    decisionContext.facingSizeBb,
    decisionContext.currentPotBb,
    decisionContext.startingStackBb,
    decisionContext.callAmountBb,
    decisionContext.tableSize,
    preflopFallbackCalibrationFor(decisionContext),
    decisionContext.priorActionSummary?.limperCount ?? 0,
    strategicDepth(decisionContext),
  );
  return {
    fold: fallback.fold,
    passive: fallback.call,
    aggression: fallback.open,
  };
}

function structuralVector(strategyResult) {
  const probability = (types) => strategyResult.actions.reduce((sum, entry) => (
    types.includes(entry.action.type) ? sum + entry.probability : sum
  ), 0);
  return {
    fold: probability(['fold']),
    passive: probability(['call', 'check']),
    aggression: probability(['raise', 'bet', 'all_in']),
  };
}

test('reusable feature extraction exposes structural facts without selecting a role', () => {
  const k3s = extractPreflopHandFeatures('K', '3', false, true);
  const k4s = extractPreflopHandFeatures('K', '4', false, true);
  const pair = extractPreflopHandFeatures('5', '5', true, false);
  const qjo = extractPreflopHandFeatures('Q', 'J', false, false);

  assert.equal(Object.isFrozen(k3s), true);
  assert.equal(Object.isFrozen(k3s.legacyScoreComponents), true);
  assert.equal(k3s.blockerPressure, k4s.blockerPressure);
  assert.ok(k3s.normalizedLowRank < k4s.normalizedLowRank);
  assert.equal(pair.pairRank, 5);
  assert.ok(pair.pairSetValue > 0);
  assert.equal(qjo.bothBroadway, true);
  assert.equal(qjo.connectionQuality, 1);
  assert.equal(Object.hasOwn(k3s, 'decisionRole'), false);
  assert.equal(Object.hasOwn(k3s, 'action'), false);
});

test('cold-response policy separates continue, passive realization, and aggression suitability', () => {
  const probes = Object.fromEntries([
    'K3s', 'K4s', '55', '99', 'QJo', 'AJo', 'JTo', 'KQo', 'AJs', '76s', 'A7o',
  ].map((hand) => [hand, resultFor(hand)]));
  const dimensions = (hand) => probes[hand].details.policyDimensions;
  const raise = (hand) => actionVectorForResult(probes[hand]).raise;

  assert.ok(dimensions('K3s').continueValue < dimensions('K4s').continueValue);
  assert.ok(dimensions('K3s').aggressionSuitability > dimensions('K4s').aggressionSuitability);
  assert.ok(raise('K3s') > raise('K4s'));

  assert.ok(dimensions('55').continueValue < dimensions('99').continueValue);
  assert.ok(dimensions('55').aggressionSuitability > dimensions('99').aggressionSuitability);
  assert.ok(raise('55') > raise('99'));

  assert.ok(dimensions('QJo').continueValue < dimensions('AJo').continueValue);
  assert.ok(dimensions('QJo').aggressionSuitability > dimensions('AJo').aggressionSuitability);
  assert.ok(raise('QJo') > raise('AJo'));

  assert.ok(dimensions('JTo').continueValue < dimensions('KQo').continueValue);
  assert.ok(dimensions('JTo').aggressionSuitability > dimensions('KQo').aggressionSuitability);
  assert.ok(raise('JTo') > raise('KQo'));

  assert.ok(dimensions('AJs').passiveRealization > dimensions('QJo').passiveRealization);
  assert.ok(dimensions('AJs').aggressionSuitability < dimensions('QJo').aggressionSuitability);
  assert.ok(dimensions('76s').passiveRealization > dimensions('A7o').passiveRealization);
  assert.ok(dimensions('76s').aggressionSuitability < dimensions('A7o').aggressionSuitability);
});

test('representative BB-versus-BTN composition repairs pathologies without a hand lookup table', () => {
  const ajs = vectorFor('AJs');
  const suitedConnector = vectorFor('76s');
  const ajo = vectorFor('AJo');
  const kqo = vectorFor('KQo');
  const trash = vectorFor('72o');
  const aa = vectorFor('AA');
  const kk = vectorFor('KK');

  assert.ok(ajs.fold < 0.1);
  assert.ok(ajs.call > ajs.raise);
  assert.ok(suitedConnector.fold < 0.5);
  assert.ok(suitedConnector.call > suitedConnector.raise);
  assert.ok(ajo.call > ajo.fold && ajo.call > ajo.raise);
  assert.ok(kqo.call > kqo.fold && kqo.call > kqo.raise);
  assert.ok(trash.fold > 0.95);
  assert.ok(aa.raise > aa.call);
  assert.ok(kk.raise > kk.call);
});

test('all 169 cold-response classes remain finite, normalized, and deterministic', () => {
  const strategyProvider = provider();
  let physicalComboCount = 0;
  for (const handClass of PREFLOP_HAND_CLASSES) {
    const decisionContext = targetContext(handClass);
    const first = strategyProvider.resolve(decisionContext);
    const second = strategyProvider.resolve(decisionContext);
    assert.deepEqual(first, second, handClass);
    const probabilities = first.actions.map((entry) => entry.probability);
    assert.ok(probabilities.every(Number.isFinite), handClass);
    assert.ok(probabilities.every((value) => value >= 0 && value <= 1), handClass);
    assert.ok(Math.abs(probabilities.reduce((sum, value) => sum + value, 0) - 1) < 1e-12);
    assert.equal(first.details.decisionRole, PREFLOP_DECISION_ROLES.COLD_RESPONSE_TO_OPEN);
    assert.equal(first.details.roleSpecificPolicyApplied, true);
    physicalComboCount += getHoldemCombosForHandClass(handClass).length;
  }
  assert.equal(physicalComboCount, 1326);
});

test('unrelated preflop roles retain the byte-identical legacy probability path', () => {
  const fixtures = createPreflopRoleAuditFixtures();
  const unrelated = Object.keys(fixtures).filter((id) => id !== 'bbVsButtonOpen');
  const strategyProvider = provider();
  for (const id of unrelated) {
    const base = context(fixtures[id]);
    for (const handClass of PREFLOP_HAND_CLASSES) {
      const decisionContext = {
        ...base,
        heroCards: representativeCardsForClass(handClass),
      };
      const actual = strategyProvider.resolve(decisionContext);
      const actualVector = structuralVector(actual);
      const expectedVector = legacyVector(decisionContext);
      for (const action of ['fold', 'passive', 'aggression']) {
        assert.ok(
          Math.abs(actualVector[action] - expectedVector[action]) < 1e-15,
          `${id}:${handClass}:${action} actual=${actualVector[action]} expected=${expectedVector[action]}`,
        );
      }
      assert.equal(actual.details.roleSpecificPolicyApplied, false, `${id}:${handClass}`);
    }
  }
});

test('postflop path and generalized comparative authority remain unchanged', () => {
  const strategyProvider = provider();
  for (const spot of POSTFLOP_NAMED_CORPUS) {
    const first = strategyProvider.resolve(spot.context);
    const second = strategyProvider.resolve(spot.context);
    assert.deepEqual(first.actions, second.actions, spot.id);
    assert.equal(first.source, 'heuristic_postflop');
  }

  const result = resultFor('AJs');
  assert.equal(result.sourceVersion, 'riverline-preflop-heuristic/v4');
  assert.equal(result.sourceDescriptor.authority, 'comparative_reference');
  assert.equal(result.contextCoverage.kind, 'generalized');
  assert.equal(result.capabilities.actionEv, false);
  assert.equal(result.capabilities.optimality, false);
  assert.notEqual(result.capabilities.actionDistribution, 'exact');
  assert.ok(result.provenance.assumptions.includes('not_independently_solver_validated'));
});

test('Training remains compatible and retains legacy math outside the bounded calibrated node', () => {
  const generated = generateTrainingExercise({
    schemaVersion: TRAINING_CONFIG_SCHEMA_VERSION,
    tableSize: 6,
    stackBb: 100,
    streets: ['preflop'],
    gameMode: 'home',
    heroPositions: ['BTN'],
    allowedDecisionTypes: [TRAINING_DECISION_TYPES.PREFLOP_FACING_OPEN],
    difficulty: 'hard',
    seed: 31_337,
  }, { strategyProvider: provider() });

  assert.equal(generated.ok, true, generated.error?.message);
  assert.equal(
    generated.exercise.strategyResult.details.decisionRole,
    PREFLOP_DECISION_ROLES.COLD_RESPONSE_TO_OPEN,
  );
  assert.equal(generated.exercise.strategyResult.details.roleSpecificPolicyApplied, false);
  assert.equal(generated.exercise.strategyResult.sourceDescriptor.authority, 'comparative_reference');
  assert.equal(generated.exercise.strategyResult.capabilities.actionEv, false);
});

test('calibration tooling exposes the feature vector, whole range, and inversion probes', () => {
  const diagnostic = buildColdResponseToOpenDiagnostic();
  assert.equal(diagnostic.privateExternalReferenceDataIncluded, false);
  assert.equal(diagnostic.role, PREFLOP_DECISION_ROLES.COLD_RESPONSE_TO_OPEN);
  assert.equal(diagnostic.classCount, 169);
  assert.equal(diagnostic.classes.length, 169);
  assert.equal(diagnostic.actionMassByWeighting.physicalCombo.totalWeight, 1326);
  assert.equal(diagnostic.pairwiseStrategicInversions.length, COLD_RESPONSE_PAIRWISE_PROBES.length);
  assert.ok(diagnostic.classes.every((row) => row.handFeatures && row.policyDimensions));
  assert.ok(diagnostic.pairwiseStrategicInversions.some((row) => (
    row.left === 'K3s'
      && row.right === 'K4s'
      && row.aggressionSuitabilityDelta > 0
      && row.actionDelta.aggression > 0
  )));
});
