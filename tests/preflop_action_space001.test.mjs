import test from 'node:test';
import assert from 'node:assert/strict';

import {
  ACTION_TYPES,
  CHANCE_TYPES,
  GAME_MODES,
  applyAction,
  applyChance,
  blindAssignments,
  createAction,
  createGameRulesSnapshotFromLegacyGameConfiguration,
  getLegalActionSpec,
  initializeHandFromGameRulesSnapshot,
} from '../shared/poker-domain/index.js';
import {
  CALIBRATION_CONTEXT_SCHEMA_VERSION,
  CALIBRATION_CONTEXT_STACK_BASES,
  CALIBRATION_CONTEXT_V2_SCHEMA_VERSION,
  CALIBRATION_DECISION_FAMILIES,
  PERSONAL_STRATEGY_ACTION_EVIDENCE_CLAIMS,
  PERSONAL_STRATEGY_ACTION_VALUE_STATES,
  RANGE_OBSERVATION_STATES,
  calibrationContextIdentityKey,
  calibrationContextKey,
  calibrationContextKeyAliases,
  createLocalOwnerRef,
  createMemoryPersonalStrategyDatabase,
  createPersonalStrategyEvidenceView,
  createPersonalStrategyRepository,
  createRangeObservation,
  createRfiCalibrationContext,
  createStrategyProfileBundle,
  createTrainingObservation,
  derivePreflopCalibrationContextFromPokerState,
  inferPersonalStrategyActionHand,
  parseCalibrationContextSerialization,
  projectCalibrationContextV1ToV2,
  projectRangeObservationV1ToActionEvidenceV2,
  serializeCalibrationContext,
  validateCalibrationContext,
} from '../app/src/personal-strategy/index.mjs';
import { toRemotePersonalStrategyEntity } from '../app/src/sync/personal-strategy-domain-adapters.mjs';

const OWNER = createLocalOwnerRef('preflop-action-space-owner');
const PROFILE_ID = 'preflop-action-space-profile';
const MODE_ID = 'preflop-action-space-mode-a';
const T0 = '2026-08-21T12:00:00.000Z';
const T1 = '2026-08-21T12:01:00.000Z';
const T2 = '2026-08-21T12:02:00.000Z';

const GAME = Object.freeze({
  mode: GAME_MODES.HOME,
  smallBlindMilliBb: 500,
  bigBlindMilliBb: 1000,
  chipUnitMilliBb: 100,
  ante: { type: 'none', amountMilliBb: 0 },
});

const CARDS_BY_PLAYER = Object.freeze({
  P0: ['As', 'Kd'],
  P1: ['Qs', 'Jd'],
  P2: ['Ts', '9d'],
  P3: ['8s', '7d'],
  P4: ['6s', '5d'],
  P5: ['4s', '3d'],
});

function dealtState(stacks = {}) {
  const rulesSnapshot = createGameRulesSnapshotFromLegacyGameConfiguration(GAME, 6);
  const state = initializeHandFromGameRulesSnapshot({
    handId: 'preflop-action-space-hand',
    rulesSnapshot,
    buttonSeat: 5,
    players: Array.from({ length: 6 }, (_, seat) => ({
      playerId: `P${seat}`,
      seat,
      startingStackMilliBb: stacks[`P${seat}`] ?? 100_000,
    })),
  });
  return applyChance(state, {
    type: CHANCE_TYPES.DEAL_HOLE,
    cardsByPlayer: CARDS_BY_PLAYER,
  });
}

function act(state, type, amountToMilliBb = null) {
  return applyAction(state, createAction(state.actingPlayerId, type, amountToMilliBb));
}

function raiseMinimum(state) {
  return act(state, ACTION_TYPES.RAISE, getLegalActionSpec(state).raise.minToMilliBb);
}

function facingAggressionCount(count) {
  let state = dealtState();
  for (let index = 0; index < count; index += 1) state = raiseMinimum(state);
  return state;
}

function bbOptionState() {
  let state = dealtState();
  const bigBlindPlayerId = blindAssignments(state).bigBlindPlayerId;
  let limped = false;
  while (state.actingPlayerId !== bigBlindPlayerId) {
    if (!limped) {
      state = act(state, ACTION_TYPES.CALL);
      limped = true;
    } else {
      state = act(state, ACTION_TYPES.FOLD);
    }
  }
  return state;
}

function actionTypes(context) {
  return context.legalActions.map((entry) => entry.type);
}

function observation({
  id,
  context,
  handClass = 'A5s',
  dominantAction,
  frequencies = null,
  state = RANGE_OBSERVATION_STATES.ACTIVE,
  supersedesObservationId = null,
  createdAt = T1,
} = {}) {
  return createRangeObservation({
    id,
    profileId: PROFILE_ID,
    modeId: MODE_ID,
    context,
    handClass,
    dominantAction,
    frequencies,
    state,
    supersedesObservationId,
    createdAt,
  });
}

function bundle() {
  return createStrategyProfileBundle({
    profileId: PROFILE_ID,
    ownerRef: OWNER,
    displayName: 'Preflop action space',
    modes: ['Mode A', 'Mode B', 'Mode C'],
    modeIds: [MODE_ID, 'preflop-action-space-mode-b', 'preflop-action-space-mode-c'],
    createdAt: T0,
  });
}

function repository() {
  return createPersonalStrategyRepository({
    database: createMemoryPersonalStrategyDatabase(),
    ownerRef: OWNER,
    clock: () => T2,
  });
}

function reverseObjectKeys(value) {
  if (Array.isArray(value)) return value.map(reverseObjectKeys);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.entries(value).reverse().map(([key, entry]) => [key, reverseObjectKeys(entry)]),
  );
}

test('canonical PokerState derives every bounded v1 preflop decision family', () => {
  const contexts = [
    derivePreflopCalibrationContextFromPokerState(dealtState()),
    derivePreflopCalibrationContextFromPokerState(act(dealtState(), ACTION_TYPES.CALL)),
    derivePreflopCalibrationContextFromPokerState(facingAggressionCount(1)),
    derivePreflopCalibrationContextFromPokerState(facingAggressionCount(2)),
    derivePreflopCalibrationContextFromPokerState(facingAggressionCount(3)),
    derivePreflopCalibrationContextFromPokerState(bbOptionState()),
  ];
  assert.deepEqual(contexts.map((context) => context.decisionFamily), [
    CALIBRATION_DECISION_FAMILIES.PREFLOP_RFI,
    CALIBRATION_DECISION_FAMILIES.PREFLOP_FACING_LIMP,
    CALIBRATION_DECISION_FAMILIES.PREFLOP_FACING_OPEN,
    CALIBRATION_DECISION_FAMILIES.PREFLOP_FACING_3BET,
    CALIBRATION_DECISION_FAMILIES.PREFLOP_FACING_4BET,
    CALIBRATION_DECISION_FAMILIES.PREFLOP_BB_OPTION,
  ]);
  contexts.forEach((context) => {
    assert.equal(context.schemaVersion, CALIBRATION_CONTEXT_V2_SCHEMA_VERSION);
    assert.equal(validateCalibrationContext(context), context);
  });
});

test('derived legal Personal Strategy actions follow canonical legality and contextual identities', () => {
  const rfi = derivePreflopCalibrationContextFromPokerState(dealtState());
  const limp = derivePreflopCalibrationContextFromPokerState(act(dealtState(), ACTION_TYPES.CALL));
  const facingOpen = derivePreflopCalibrationContextFromPokerState(facingAggressionCount(1));
  const bbOption = derivePreflopCalibrationContextFromPokerState(bbOptionState());
  assert.deepEqual(actionTypes(rfi), [ACTION_TYPES.FOLD, ACTION_TYPES.RAISE, ACTION_TYPES.ALL_IN]);
  assert.deepEqual(actionTypes(limp), [
    ACTION_TYPES.FOLD, ACTION_TYPES.CALL, ACTION_TYPES.RAISE, ACTION_TYPES.ALL_IN,
  ]);
  assert.deepEqual(actionTypes(facingOpen), [
    ACTION_TYPES.FOLD, ACTION_TYPES.CALL, ACTION_TYPES.RAISE, ACTION_TYPES.ALL_IN,
  ]);
  assert.deepEqual(actionTypes(bbOption), [
    ACTION_TYPES.CHECK, ACTION_TYPES.RAISE, ACTION_TYPES.ALL_IN,
  ]);
  assert.equal(actionTypes(limp).includes('limp'), false);
  assert.equal(actionTypes(bbOption).includes('complete'), false);
});

test('facing and sizing facts preserve raise-to, incremental call, contribution, and stack basis', () => {
  const openState = facingAggressionCount(1);
  const context = derivePreflopCalibrationContextFromPokerState(openState);
  const legal = getLegalActionSpec(openState);
  const actor = openState.players.find((player) => player.playerId === openState.actingPlayerId);
  assert.equal(context.facing.sizeBb, openState.currentBetMilliBb / 1000);
  assert.equal(context.facing.callAmountBb, legal.call.commitMilliBb / 1000);
  assert.equal(context.facing.heroStreetContributionBb, actor.streetContributionMilliBb / 1000);
  assert.equal(context.priorAction.lastAggression.raiseToBb, context.facing.sizeBb);
  assert.equal(context.priorAction.lastAggression.level, 'open');
  assert.equal(context.sizing.minimumRaiseToBb, legal.raise.minToMilliBb / 1000);
  assert.equal(context.sizing.maximumNonAllInRaiseToBb, legal.raise.maxToMilliBb / 1000);
  assert.equal(context.sizing.allInToBb, legal.allIn.amountToMilliBb / 1000);
  assert.equal(context.stack.basis, CALIBRATION_CONTEXT_STACK_BASES.EFFECTIVE_LIVE_POT_CAPACITY);
  assert.equal(context.stack.valueBb, 100);
});

test('BB option has a truthful zero call price and Check/raise action space', () => {
  const state = bbOptionState();
  const context = derivePreflopCalibrationContextFromPokerState(state);
  assert.equal(context.decisionFamily, CALIBRATION_DECISION_FAMILIES.PREFLOP_BB_OPTION);
  assert.equal(context.facing.sizeBb, 0);
  assert.equal(context.facing.callAmountBb, 0);
  assert.equal(context.facing.heroStreetContributionBb, 1);
  assert.equal(context.priorAction.family, 'limped');
  assert.deepEqual(actionTypes(context), [
    ACTION_TYPES.CHECK, ACTION_TYPES.RAISE, ACTION_TYPES.ALL_IN,
  ]);
});

test('Game Rules semantic identity is canonical, brand-free, and serialization ignores key order', () => {
  const context = derivePreflopCalibrationContextFromPokerState(facingAggressionCount(2));
  assert.equal(context.gameRules.identity.kind, 'semantic_fingerprint');
  assert.match(context.gameRules.identity.value, /^game-rules-semantic\/v1:/);
  assert.equal(JSON.stringify(context.gameRules).includes('home'), false);
  const serialized = serializeCalibrationContext(context);
  assert.equal(serializeCalibrationContext(reverseObjectKeys(context)), serialized);
  assert.deepEqual(parseCalibrationContextSerialization(serialized), context);
});

test('strict v2 validation rejects illegal family action sets and inconsistent sizing', () => {
  const facingOpen = derivePreflopCalibrationContextFromPokerState(facingAggressionCount(1));
  assert.throws(() => validateCalibrationContext({
    ...structuredClone(facingOpen),
    legalActions: [{ type: ACTION_TYPES.CHECK }, { type: ACTION_TYPES.RAISE }],
  }), /legal actions require Fold and Call/);
  assert.throws(() => validateCalibrationContext({
    ...structuredClone(facingOpen),
    legalActions: [
      { type: ACTION_TYPES.FOLD },
      { type: ACTION_TYPES.RAISE },
      { type: ACTION_TYPES.CALL },
      { type: ACTION_TYPES.ALL_IN },
    ],
  }), /canonical identity order/);
  assert.throws(() => validateCalibrationContext({
    ...structuredClone(facingOpen),
    sizing: { ...structuredClone(facingOpen.sizing), minimumRaiseToBb: null },
  }), /Raise legality and sizing/);
});

test('CalibrationContext v1 projects deterministically to compatible v2 without inventing missing facts', () => {
  const v1 = createRfiCalibrationContext({
    gameRulesId: 'riverline-home-v1',
    tableSize: 6,
    heroPosition: 'BTN',
    effectiveStackBb: 100,
  });
  const v2 = projectCalibrationContextV1ToV2(v1);
  assert.equal(v1.schemaVersion, CALIBRATION_CONTEXT_SCHEMA_VERSION);
  assert.equal(v2.schemaVersion, CALIBRATION_CONTEXT_V2_SCHEMA_VERSION);
  assert.equal(v2.gameRules.identity.kind, 'legacy_opaque_id');
  assert.equal(v2.opponentCount, null);
  assert.equal(v2.facing.callAmountBb, null);
  assert.equal(v2.facing.heroStreetContributionBb, null);
  assert.deepEqual(actionTypes(v2), [ACTION_TYPES.FOLD, ACTION_TYPES.RAISE]);
  assert.equal(v2.compatibility.sourceContextKey, calibrationContextKey(v1));
  assert.equal(calibrationContextIdentityKey(v1), calibrationContextIdentityKey(v2));
  assert.deepEqual(calibrationContextKeyAliases(v2), [
    calibrationContextKey(v2),
    calibrationContextKey(v1),
  ]);
});

test('legacy RFI evidence resolves through a v2 alias without ID, provenance, or payload rewrite', async () => {
  const repo = repository();
  await repo.saveProfileBundle(bundle());
  const v1 = createRfiCalibrationContext({
    gameRulesId: 'riverline-home-v1', tableSize: 6, heroPosition: 'BTN', effectiveStackBb: 100,
  });
  const v2 = projectCalibrationContextV1ToV2(v1);
  const old = observation({
    id: 'legacy-rfi-evidence',
    context: v1,
    dominantAction: { type: ACTION_TYPES.RAISE },
  });
  await repo.saveRangeObservation(old);
  const scope = await repo.loadEvidenceScope({ profileId: PROFILE_ID, modeId: MODE_ID, context: v2 });
  const current = await repo.getCurrentRangeObservation({
    profileId: PROFILE_ID, modeId: MODE_ID, context: v2, handClass: old.handClass,
  });
  const exported = await repo.exportPortable({ exportedAt: T2 });
  assert.deepEqual(scope.rangeObservations, [old]);
  assert.deepEqual(current, old);
  assert.deepEqual(exported.rangeObservations, [old]);
  assert.deepEqual(toRemotePersonalStrategyEntity(old).payload, old);
});

test('four-action exact and dominant evidence persist with canonical complete read distributions', async () => {
  const context = derivePreflopCalibrationContextFromPokerState(facingAggressionCount(1));
  const exact = observation({
    id: 'facing-open-exact',
    context,
    dominantAction: { type: ACTION_TYPES.CALL },
    frequencies: [
      { action: { type: ACTION_TYPES.ALL_IN }, probability: 0.1 },
      { action: { type: ACTION_TYPES.CALL }, probability: 0.4 },
      { action: { type: ACTION_TYPES.RAISE }, probability: 0.3 },
      { action: { type: ACTION_TYPES.FOLD }, probability: 0.2 },
    ],
  });
  const dominant = observation({
    id: 'facing-open-dominant',
    context,
    handClass: 'KQs',
    dominantAction: { type: ACTION_TYPES.RAISE },
  });
  const exactEvidence = projectRangeObservationV1ToActionEvidenceV2(exact);
  const dominantEvidence = projectRangeObservationV1ToActionEvidenceV2(dominant);
  assert.equal(exactEvidence.claimKind, PERSONAL_STRATEGY_ACTION_EVIDENCE_CLAIMS.EXACT_DISTRIBUTION);
  assert.deepEqual(exactEvidence.exactDistribution.map((entry) => entry.action.type), [
    ACTION_TYPES.FOLD, ACTION_TYPES.CALL, ACTION_TYPES.RAISE, ACTION_TYPES.ALL_IN,
  ]);
  exactEvidence.exactDistribution.forEach((entry, index) => {
    assert.ok(Math.abs(entry.probability - [0.2, 0.4, 0.3, 0.1][index]) <= 1e-12);
  });
  assert.equal(dominantEvidence.claimKind, PERSONAL_STRATEGY_ACTION_EVIDENCE_CLAIMS.DOMINANT_ACTION);
  assert.equal(dominantEvidence.exactDistribution, null);

  const repo = repository();
  await repo.saveProfileBundle(bundle());
  await repo.saveRangeObservation(exact);
  await repo.saveRangeObservation(dominant);
  const exported = await repo.exportPortable({ exportedAt: T2 });
  assert.deepEqual(exported.rangeObservations, [exact, dominant]);
  assert.deepEqual(toRemotePersonalStrategyEntity(exact).payload, exact);
});

test('three-action tied mix, contradictions, and retractions remain distinct action-aware evidence', async () => {
  const context = derivePreflopCalibrationContextFromPokerState(bbOptionState());
  const tied = observation({
    id: 'bb-tied',
    context,
    dominantAction: null,
    frequencies: [
      { action: { type: ACTION_TYPES.CHECK }, probability: 0.4 },
      { action: { type: ACTION_TYPES.RAISE }, probability: 0.4 },
      { action: { type: ACTION_TYPES.ALL_IN }, probability: 0.2 },
    ],
  });
  const tiedEvidence = projectRangeObservationV1ToActionEvidenceV2(tied);
  assert.equal(tiedEvidence.dominantAction, null);
  tiedEvidence.exactDistribution.forEach((entry, index) => {
    assert.ok(Math.abs(entry.probability - [0.4, 0.4, 0.2][index]) <= 1e-12);
  });

  const check = observation({
    id: 'bb-check-root', context, handClass: 'KQo', dominantAction: { type: ACTION_TYPES.CHECK },
  });
  const raise = observation({
    id: 'bb-raise-root', context, handClass: 'KQo', dominantAction: { type: ACTION_TYPES.RAISE },
  });
  const view = createPersonalStrategyEvidenceView({
    profileId: PROFILE_ID,
    modeId: MODE_ID,
    context,
    rangeObservations: [check, raise],
  });
  assert.equal(view.conflicts.length, 1);
  assert.deepEqual(view.conflicts[0].evidenceReferences, [check.id, raise.id].sort());

  const repo = repository();
  await repo.saveProfileBundle(bundle());
  await repo.saveRangeObservation(tied);
  await repo.saveRangeObservation(check);
  await repo.applySyncedEntity(raise, { entityType: 'range_observation' });
  const heads = await repo.loadRangeHeadsScope({ profileId: PROFILE_ID, modeId: MODE_ID, context });
  const contradictoryHeads = [...heads.current, ...heads.conflicting]
    .filter((entry) => entry.handClass === check.handClass);
  assert.equal(contradictoryHeads.length, 2);
  assert.deepEqual(new Set(contradictoryHeads.map((entry) => entry.id)), new Set([
    check.id, raise.id,
  ]));

  const retracted = observation({
    id: 'bb-check-retracted',
    context,
    handClass: tied.handClass,
    dominantAction: null,
    state: RANGE_OBSERVATION_STATES.RETRACTED,
    supersedesObservationId: tied.id,
    createdAt: T2,
  });
  const retractionEvidence = projectRangeObservationV1ToActionEvidenceV2(retracted);
  assert.equal(retractionEvidence.claimKind, PERSONAL_STRATEGY_ACTION_EVIDENCE_CLAIMS.RETRACTION);
  assert.equal(retractionEvidence.valueState, PERSONAL_STRATEGY_ACTION_VALUE_STATES.UNAVAILABLE);
  await repo.saveRangeObservation(retracted);
  assert.equal(await repo.getCurrentRangeObservation({
    profileId: PROFILE_ID,
    modeId: MODE_ID,
    context,
    handClass: tied.handClass,
  }), null);
  const exported = await repo.exportPortable({ exportedAt: T2 });
  assert.deepEqual(
    exported.rangeObservations.filter((entry) => [tied.id, retracted.id].includes(entry.id)),
    [tied, retracted],
  );
});

test('new-family inference is explicitly unavailable while current Fold/Raise RFI inference remains supported', () => {
  const facingOpen = derivePreflopCalibrationContextFromPokerState(facingAggressionCount(1));
  const unavailable = inferPersonalStrategyActionHand({
    profileId: PROFILE_ID,
    modeId: MODE_ID,
    context: facingOpen,
    requestedHandClass: 'A5s',
  });
  assert.equal(unavailable.valueState, PERSONAL_STRATEGY_ACTION_VALUE_STATES.UNAVAILABLE);
  assert.equal(unavailable.dominantAction, null);
  assert.equal(unavailable.exactDistribution, null);
  assert.equal(unavailable.provenance.reason, 'unsupported_decision_family');
  assert.throws(() => createTrainingObservation({
    id: 'unsupported-training-evidence',
    profileId: PROFILE_ID,
    modeId: MODE_ID,
    context: facingOpen,
    handClass: 'A5s',
    chosenAction: { type: ACTION_TYPES.CALL },
    trainingExerciseId: 'exercise-out-of-scope',
    createdAt: T1,
  }), /supports only legacy preflop_rfi/);

  const rfi = createRfiCalibrationContext({
    gameRulesId: 'riverline-home-v1', tableSize: 6, heroPosition: 'BTN', effectiveStackBb: 100,
  });
  const direct = observation({
    id: 'rfi-direct-unchanged', context: rfi, dominantAction: { type: ACTION_TYPES.RAISE },
  });
  const supported = inferPersonalStrategyActionHand({
    profileId: PROFILE_ID,
    modeId: MODE_ID,
    context: rfi,
    directObservations: [direct],
    requestedHandClass: direct.handClass,
  });
  assert.equal(supported.valueState, PERSONAL_STRATEGY_ACTION_VALUE_STATES.AVAILABLE);
  assert.deepEqual(supported.dominantAction, { type: ACTION_TYPES.RAISE });
  assert.equal(supported.exactDistribution, null);
});

test('contexts beyond facing a 4-bet are rejected instead of entering a fabricated family', () => {
  const facingFourBet = facingAggressionCount(3);
  const next = raiseMinimum(facingFourBet);
  assert.throws(
    () => derivePreflopCalibrationContextFromPokerState(next),
    /beyond facing a 4-bet/,
  );
});
