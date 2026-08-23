import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { performance } from 'node:perf_hooks';

import {
  ACTION_TYPES,
  PHASES,
  applyAction,
  applyChance,
  getLegalActionSpec,
  initializeHand,
  isPlayerLive,
  validatePokerState,
} from '../shared/poker-domain/index.js';
import { deriveDecisionContextFromPokerState } from '../app/src/application/decision-context-from-poker-state.mjs';
import {
  TRAINING_CONFIG_SCHEMA_VERSION,
  TRAINING_DECISION_TYPES,
  TRAINING_EXERCISE_SCHEMA_VERSION,
  TRAINING_GENERATION_ERROR_CODES,
  createSeededTrainingRandom,
  createTrainingConfig,
  generateTrainingExercise,
} from '../app/src/application/training-generator.mjs';
import {
  TRAINING_ANSWER_EVALUATION_SCHEMA_VERSION,
  evaluateTrainingAnswer,
  mapCanonicalActionToStrategyAction,
} from '../app/src/application/training-answer-evaluation.mjs';
import {
  TRAINING_SESSION_ERROR_CODES,
  createTrainingSessionController,
} from '../app/src/application/training-session-controller.mjs';
import { installTrainingModeBridge } from '../app/src/application/training-mode-bootstrap.mjs';

const strategyProvider = Object.freeze({
  resolve(context) {
  const passiveType = context.facingSizeBb > 0
    ? ACTION_TYPES.CALL
    : context.street === 'preflop' && context.heroPosition === 'BB'
      ? ACTION_TYPES.CHECK
      : ACTION_TYPES.CHECK;
  const aggressiveType = context.street === 'preflop'
    ? ACTION_TYPES.RAISE
    : context.facingSizeBb > 0 ? ACTION_TYPES.RAISE : ACTION_TYPES.BET;
  const passiveLabel = passiveType === ACTION_TYPES.CALL ? 'Call' : 'Check';
  const aggressiveLabel = aggressiveType === ACTION_TYPES.RAISE ? 'Raise' : 'Bet';
    return {
    schemaVersion: 'strategy-result/v1',
    source: context.street === 'preflop' ? 'heuristic_preflop' : 'heuristic_postflop',
    actions: [
      {
        action: { type: ACTION_TYPES.FOLD, amountBb: null, potFraction: null },
        label: 'Fold', probability: 0.2, evBb: null,
      },
      {
        action: { type: passiveType, amountBb: null, potFraction: null },
        label: passiveLabel, probability: 0.35, evBb: null,
      },
      {
        action: { type: aggressiveType, amountBb: null, potFraction: null },
        label: aggressiveLabel, probability: 0.45, evBb: null,
      },
    ],
    recommendation: {
      action: { type: aggressiveType, amountBb: null, potFraction: null },
      label: aggressiveLabel,
    },
    explanation: null,
    confidence: null,
    coverage: null,
    modelVersion: null,
    warnings: [],
    details: null,
    };
  },
});

function config(overrides = {}) {
  return {
    schemaVersion: TRAINING_CONFIG_SCHEMA_VERSION,
    tableSize: 6,
    stackBb: 100,
    streets: ['preflop'],
    gameMode: 'home',
    heroPositions: ['BTN'],
    allowedDecisionTypes: [TRAINING_DECISION_TYPES.PREFLOP_UNOPENED],
    difficulty: 'hard',
    seed: 0x12345678,
    ...overrides,
  };
}

function requireExercise(input) {
  const result = generateTrainingExercise(input, { strategyProvider });
  assert.equal(result.ok, true, result.error?.message);
  return result.exercise;
}

function replay(exercise) {
  let state = initializeHand(exercise.generationMetadata.initialConfiguration);
  for (const event of exercise.generationMetadata.events) {
    if (event.kind === 'chance') {
      state = applyChance(state, event.event);
    } else {
      assert.deepEqual(getLegalActionSpec(state), event.legalActionSpec);
      assert.equal(event.action.playerId, state.actingPlayerId);
      state = applyAction(state, event.action);
    }
  }
  return state;
}

test('TrainingConfig v1 validates real filters and rejects unsupported modes', () => {
  const normalized = createTrainingConfig(config({
    tableSize: 10,
    stackBb: 150,
    streets: ['flop', 'river'],
    heroPositions: ['UTG+2', 'BTN'],
    allowedDecisionTypes: [TRAINING_DECISION_TYPES.POSTFLOP_FACING_BET],
    difficulty: 'guided',
    seed: 0,
  }));
  assert.equal(normalized.schemaVersion, TRAINING_CONFIG_SCHEMA_VERSION);
  assert.deepEqual(normalized.heroPositions, ['UTG+2', 'BTN']);
  assert.deepEqual(normalized.streets, ['flop', 'river']);
  assert.equal(normalized.difficulty, 'guided');
  assert.equal(Object.isFrozen(normalized), true);
  assert.equal(Object.isFrozen(normalized.streets), true);
  assert.throws(() => createTrainingConfig(config({ gameMode: 'clubgg' })), /Home mode only/);
  assert.throws(() => createTrainingConfig(config({ heroPositions: ['UTG+2'] })), /heroPositions/);
  assert.throws(() => createTrainingConfig(config({ tableSize: 1 })), /tableSize/);
  assert.throws(() => createTrainingConfig(config({ streets: ['showdown'] })), /streets/);
});

test('seeded generator is deterministic and the canonical path contains no Math.random', () => {
  const firstRandom = createSeededTrainingRandom(22);
  const secondRandom = createSeededTrainingRandom(22);
  assert.deepEqual(
    Array.from({ length: 20 }, () => firstRandom.nextUint32()),
    Array.from({ length: 20 }, () => secondRandom.nextUint32()),
  );

  const first = requireExercise(config());
  const second = requireExercise(config());
  assert.deepEqual(first, second);
  assert.equal(Object.isFrozen(first), true);
  assert.equal(Object.isFrozen(first.generationMetadata.events), true);
  assert.deepEqual(first.generationMetadata.trainingConfig, createTrainingConfig(config()));
  assert.notDeepEqual(
    first.presentation.heroCards,
    requireExercise(config({ seed: 0x12345679 })).presentation.heroCards,
  );

  const source = fs.readFileSync(
    new URL('../app/src/application/training-generator.mjs', import.meta.url),
    'utf8',
  );
  assert.doesNotMatch(source, /Math\.random/);
});

test('every required target is a reachable, legal, nonterminal Hero decision', () => {
  const cases = [
    [TRAINING_DECISION_TYPES.PREFLOP_UNOPENED, 'preflop', 'BTN', 'unopened', 0],
    [TRAINING_DECISION_TYPES.PREFLOP_FACING_OPEN, 'preflop', 'BTN', 'raise', 2],
    [TRAINING_DECISION_TYPES.PREFLOP_FACING_3BET, 'preflop', 'BTN', '3bet', 3],
    [TRAINING_DECISION_TYPES.PREFLOP_FACING_4BET, 'preflop', 'BTN', '4bet', 4],
    [TRAINING_DECISION_TYPES.PREFLOP_BB_OPTION, 'preflop', 'BB', 'check', 0],
    [TRAINING_DECISION_TYPES.POSTFLOP_FIRST_ACTION, 'flop', 'BTN', 'check', 0],
    [TRAINING_DECISION_TYPES.POSTFLOP_FACING_BET, 'turn', 'BTN', 'bet', 1],
    [TRAINING_DECISION_TYPES.POSTFLOP_FACING_RAISE, 'river', 'BTN', 'raise', 2],
  ];

  for (const [target, street, position, lastAction, facingSizeBb] of cases) {
    const exercise = requireExercise(config({
      streets: [street],
      heroPositions: [position],
      allowedDecisionTypes: [target],
      seed: 1000 + cases.findIndex((entry) => entry[0] === target),
    }));
    assert.equal(exercise.schemaVersion, TRAINING_EXERCISE_SCHEMA_VERSION);
    validatePokerState(exercise.pokerState);
    assert.equal(exercise.pokerState.phase, PHASES.BETTING);
    assert.equal(exercise.pokerState.terminal.isTerminal, false);
    assert.equal(exercise.pokerState.actingPlayerId, exercise.heroPlayerId);
    assert.equal(exercise.decisionContext.street, street);
    assert.equal(exercise.decisionContext.heroPosition, position);
    assert.equal(exercise.decisionContext.lastAction, lastAction);
    assert.equal(exercise.decisionContext.facingSizeBb, facingSizeBb);
    const hero = exercise.pokerState.players.find(
      (player) => player.playerId === exercise.heroPlayerId,
    );
    assert.equal(exercise.presentation.potBb, exercise.pokerState.potMilliBb / 1000);
    assert.equal(exercise.presentation.stackBb, hero.startingStackMilliBb / 1000);
    assert.equal(exercise.presentation.facingBb, exercise.decisionContext.facingSizeBb);
    assert.equal(exercise.presentation.callBb, exercise.decisionContext.callAmountBb);
    assert.equal(exercise.decisionContext.callAmountBb, exercise.legalActions.call.commitMilliBb / 1000);
    assert.equal(
      exercise.decisionContext.opponentCount,
      exercise.pokerState.players.filter((player) => (
        player.playerId !== exercise.heroPlayerId && isPlayerLive(player)
      )).length,
    );
    assert.equal(exercise.pokerState.board.length, {
      preflop: 0, flop: 3, turn: 4, river: 5,
    }[street]);
    const visibleCards = [...hero.holeCards, ...exercise.pokerState.board];
    assert.equal(new Set(visibleCards).size, visibleCards.length);
    assert.deepEqual(exercise.legalActions, getLegalActionSpec(exercise.pokerState));
    assert.deepEqual(replay(exercise), exercise.pokerState);
    assert.deepEqual(
      deriveDecisionContextFromPokerState(exercise.pokerState, exercise.heroPlayerId),
      exercise.decisionContext,
    );
  }
});

test('Training supports 2 through 10 players and honors position, stack, street, and assistance filters', () => {
  for (let tableSize = 2; tableSize <= 10; tableSize += 1) {
    const exercise = requireExercise(config({
      tableSize,
      stackBb: 30 + tableSize,
      heroPositions: ['BTN'],
      difficulty: tableSize % 2 ? 'guided' : 'easy',
      seed: 2000 + tableSize,
    }));
    assert.equal(exercise.decisionContext.tableSize, tableSize);
    assert.equal(exercise.decisionContext.heroPosition, 'BTN');
    assert.equal(exercise.decisionContext.stackBb, 30 + tableSize);
    assert.equal(exercise.presentation.assistanceMode, tableSize % 2 ? 'guided' : 'easy');
    assert.equal(exercise.generationMetadata.curriculum.tableSize, tableSize);
  }
});

test('opponent private cards remain hidden and only known public/Hero cards cross the exercise boundary', () => {
  const exercise = requireExercise(config({ tableSize: 10, seed: 31337 }));
  const hero = exercise.pokerState.players.find((player) => player.playerId === exercise.heroPlayerId);
  assert.deepEqual(hero.holeCards, exercise.presentation.heroCards);
  for (const opponent of exercise.pokerState.players.filter((player) => player !== hero)) {
    assert.equal(Array.isArray(opponent.holeCards), false);
    assert.equal(opponent.holeCards.schemaVersion, 'poker-hidden-hole-cards/v1');
    assert.equal('cards' in opponent.holeCards, false);
  }
  assert.deepEqual(exercise.decisionContext.heroCards, hero.holeCards);
  assert.equal('opponentCards' in exercise.presentation, false);
  assert.equal('cardsByPlayer' in exercise.generationMetadata, false);
  const holeEvent = exercise.generationMetadata.events.find(
    (event) => event.kind === 'chance' && event.event.type === 'deal_hole',
  );
  assert.deepEqual(Object.keys(holeEvent.event.cardsByPlayer), [exercise.heroPlayerId]);
  assert.equal(holeEvent.event.hiddenPlayerIds.length, 9);
});

test('generation policy is provenance-honest and is not labeled as strategy or solver output', () => {
  const exercise = requireExercise(config());
  assert.equal(exercise.strategyResult.source, 'heuristic_preflop');
  assert.equal(exercise.generationMetadata.policy, 'bounded_legal_trajectory_v1');
  assert.equal(exercise.generationMetadata.policyIsStrategy, false);
  assert.doesNotMatch(JSON.stringify(exercise.generationMetadata), /gto|solver|cfr/i);
});

test('unsupported targets and unavailable strategy return structured failures without fallback', () => {
  const unsupported = generateTrainingExercise(config({
    streets: ['river'],
    allowedDecisionTypes: [TRAINING_DECISION_TYPES.PREFLOP_UNOPENED],
  }), { strategyProvider });
  assert.equal(unsupported.ok, false);
  assert.equal(unsupported.error.code, TRAINING_GENERATION_ERROR_CODES.UNSUPPORTED_TARGET);
  assert.equal(unsupported.error.schemaVersion, 'training-generation-error/v1');

  const unavailable = generateTrainingExercise(config(), {
    strategyProvider: { resolve: () => null },
  });
  assert.equal(unavailable.ok, false);
  assert.equal(unavailable.error.code, TRAINING_GENERATION_ERROR_CODES.STRATEGY_UNAVAILABLE);
  assert.equal('exercise' in unavailable, false);
});

test('unreachable quality targets stop after the bounded retry budget', () => {
  const exhausted = generateTrainingExercise(config({
    tableSize: 2,
    stackBb: 10,
    heroPositions: ['BTN'],
    allowedDecisionTypes: [TRAINING_DECISION_TYPES.PREFLOP_FACING_4BET],
  }), { strategyProvider });
  assert.equal(exhausted.ok, false);
  assert.equal(exhausted.error.code, TRAINING_GENERATION_ERROR_CODES.GENERATION_EXHAUSTED);
  assert.equal(exhausted.error.details.attempts, 64);
  assert.equal(typeof exhausted.error.details.lastRetryReason, 'string');
});

test('canonical-to-StrategyResult mapping preserves explicit action families including BB Check', () => {
  const result = strategyProvider.resolve({ street: 'preflop', heroPosition: 'BB', facingSizeBb: 0 });
  assert.equal(mapCanonicalActionToStrategyAction(ACTION_TYPES.RAISE, result).type, 'raise');
  assert.equal(mapCanonicalActionToStrategyAction(ACTION_TYPES.FOLD, result).type, 'fold');
  assert.equal(mapCanonicalActionToStrategyAction(
    ACTION_TYPES.CHECK,
    result,
    { street: 'preflop', heroPosition: 'BB', facingSizeBb: 0 },
  ).type, 'check');
  assert.equal(mapCanonicalActionToStrategyAction(ACTION_TYPES.CALL, result), null);
});

test('mixed StrategyResult grading accepts actions within 15 points and never invents EV', () => {
  const result = {
    schemaVersion: 'strategy-result/v1',
    source: 'heuristic_preflop',
    actions: [
      { action: { type: 'raise' }, label: 'Raise', probability: 0.55, evBb: null },
      { action: { type: 'call' }, label: 'Call', probability: 0.45, evBb: null },
    ],
  };
  const acceptable = evaluateTrainingAnswer({
    exerciseId: 'mixed', chosenActionType: 'call', strategyResult: result,
  });
  assert.equal(acceptable.schemaVersion, TRAINING_ANSWER_EVALUATION_SCHEMA_VERSION);
  assert.equal(acceptable.grade, 'acceptable');
  assert.equal(acceptable.accepted, true);
  assert.equal(acceptable.explanationData.evAvailable, false);
  assert.equal(acceptable.explanationData.chosenEvBb, null);

  const optimal = evaluateTrainingAnswer({
    exerciseId: 'mixed', chosenActionType: 'raise', strategyResult: result,
  });
  assert.equal(optimal.grade, 'optimal');
  assert.equal(optimal.accepted, true);

  const mistake = evaluateTrainingAnswer({
    exerciseId: 'mixed', chosenActionType: 'fold', strategyResult: result,
  });
  assert.equal(mistake.grade, 'mistake');
  assert.equal(mistake.accepted, false);
});

test('session lifecycle rejects stale generations, stale exercises, illegal actions, and double answers', async () => {
  const exercise = requireExercise(config());
  const pending = [];
  const controller = createTrainingSessionController({
    generateExercise: () => new Promise((resolve) => pending.push(resolve)),
  });
  const first = controller.generate(config(), { strategyProvider });
  const second = controller.generate(config({ seed: 2 }), { strategyProvider });
  await Promise.resolve();
  pending[0]({ ok: true, exercise });
  assert.equal((await first).error.code, TRAINING_SESSION_ERROR_CODES.STALE_GENERATION);
  pending[1]({ ok: true, exercise });
  assert.equal((await second).ok, true);
  assert.equal(controller.getSnapshot().status, 'ready');

  assert.equal(
    controller.answer('older-exercise', ACTION_TYPES.RAISE).error.code,
    TRAINING_SESSION_ERROR_CODES.STALE_EXERCISE,
  );
  assert.equal(
    controller.answer(exercise.id, ACTION_TYPES.BET).error.code,
    TRAINING_SESSION_ERROR_CODES.ILLEGAL_ANSWER,
  );
  assert.equal(controller.answer(exercise.id, ACTION_TYPES.RAISE).ok, true);
  assert.equal(controller.getSnapshot().status, 'answered');
  assert.equal(
    controller.answer(exercise.id, ACTION_TYPES.RAISE).error.code,
    TRAINING_SESSION_ERROR_CODES.ALREADY_ANSWERED,
  );

  const nextExercise = { ...exercise, id: `${exercise.id}-next` };
  const third = controller.generate(config({ seed: 3 }), { strategyProvider });
  await Promise.resolve();
  pending[2]({ ok: true, exercise: nextExercise });
  assert.equal((await third).exercise.id, nextExercise.id);
  assert.equal(controller.getSnapshot().status, 'ready');
  assert.equal(controller.getSnapshot().evaluation, null);
});

test('browser bridge exposes only canonical decision-practice and full-Hand lifecycle operations', () => {
  const browserWindow = {};
  const snapshot = { schemaVersion: 'training-session/v1', status: 'idle' };
  const controller = {
    generate: () => Promise.resolve({ ok: false }),
    answer: () => ({ ok: false }),
    getSnapshot: () => snapshot,
    reset: () => snapshot,
  };
  const bridge = installTrainingModeBridge(browserWindow, { controller });
  assert.equal(browserWindow.RiverlineTraining, bridge);
  assert.deepEqual(Object.keys(bridge).sort(), [
    'advanceFullHandOneEvent',
    'answer',
    'answerFullHand',
    'createConfigFromLegacyCompatibility',
    'createFullHandAnalysisHandoff',
    'createFullHandPresentationOrchestrator',
    'createFullHandStartConfiguration',
    'createFullHandTablePresence',
    'createFullHandTablePresentation',
    'createFullHandTableTransition',
    'createPracticeIntent',
    'generate',
    'generatePlanned',
    'getFullHandReview',
    'getFullHandReviewReplayProjection',
    'getFullHandSizingModel',
    'getFullHandSnapshot',
    'getPracticePlannerState',
    'getSnapshot',
    'nextFullHandReviewFrame',
    'previousFullHandReviewFrame',
    'replay',
    'reset',
    'resetFullHand',
    'resolveRulesCapability',
    'returnFullHandReviewToEndpoint',
    'selectFullHandReviewFrame',
    'startFullHand',
    'startPracticeSession',
    'validateFullHandSizingInput',
  ]);
  assert.equal(bridge.getSnapshot(), snapshot);
  assert.equal(Object.getOwnPropertyDescriptor(browserWindow, 'RiverlineTraining').writable, false);
});

test('required performance-smoke batches generate without exhaustion', () => {
  const batches = [
    { count: 100, tableSize: 2, street: 'preflop', target: 'preflop_unopened' },
    { count: 100, tableSize: 6, street: 'preflop', target: 'preflop_facing_open' },
    { count: 50, tableSize: 6, street: 'flop', target: 'postflop_first_action' },
    { count: 50, tableSize: 6, street: 'turn', target: 'postflop_facing_bet' },
    { count: 25, tableSize: 6, street: 'river', target: 'postflop_facing_raise' },
  ];
  const startedAt = performance.now();
  let generated = 0;
  for (const batch of batches) {
    for (let index = 0; index < batch.count; index += 1) {
      const result = generateTrainingExercise(config({
        tableSize: batch.tableSize,
        streets: [batch.street],
        allowedDecisionTypes: [batch.target],
        seed: 100_000 + generated,
      }), { strategyProvider });
      assert.equal(result.ok, true, `${batch.street}/${batch.target}: ${result.error?.message}`);
      generated += 1;
    }
  }
  assert.equal(generated, 325);
  assert.ok(performance.now() - startedAt < 15_000);
});
