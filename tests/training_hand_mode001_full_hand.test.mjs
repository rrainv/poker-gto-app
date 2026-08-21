import test from 'node:test';
import assert from 'node:assert/strict';

import {
  ACTION_TYPES,
  ANTE_TYPES,
  GAME_MODES,
  createGameRulesSnapshotFromLegacyGameConfiguration,
} from '../shared/poker-domain/index.js';
import {
  FULL_HAND_TRAINING_ERROR_CODES,
  FULL_HAND_TRAINING_ANALYSIS_HANDOFF_SCHEMA_VERSION,
  FULL_HAND_TRAINING_REVIEW_SCHEMA_VERSION,
  FULL_HAND_TRAINING_SESSION_SCHEMA_VERSION,
  FULL_HAND_TRAINING_STATUSES,
  FULL_HAND_TRAINING_PROGRESSION_MODES,
  createFullHandTrainingStartConfigurationFromTrainingConfig,
  createFullHandTrainingSessionController,
} from '../app/src/application/full-hand-training-session-controller.mjs';
import { createStrategyProvider } from '../app/src/application/strategy-provider.mjs';
import { STRATEGY_SOURCES } from '../app/src/application/strategy-result.mjs';

function handConfiguration({
  handId = 'training-full-hand',
  playerCount = 2,
  mode = GAME_MODES.HOME,
  stackMilliBb = 100_000,
} = {}) {
  return {
    handId,
    rulesSnapshot: createGameRulesSnapshotFromLegacyGameConfiguration({
      mode,
      smallBlindMilliBb: 500,
      bigBlindMilliBb: 1000,
      chipUnitMilliBb: 100,
      ante: { type: ANTE_TYPES.NONE, amountMilliBb: 0 },
    }, playerCount),
    buttonSeat: 0,
    players: Array.from({ length: playerCount }, (_, seat) => ({
      playerId: `P${seat}`,
      seat,
      startingStackMilliBb: stackMilliBb,
    })),
  };
}

function strategyProvider(counter = { calls: 0 }) {
  return createStrategyProvider({
    fallbackResolver() {
      counter.calls += 1;
      return {
        source: STRATEGY_SOURCES.HEURISTIC_PREFLOP,
        modelVersion: 'training-hand-mode-focused-test/v1',
        actions: [
          { action: { type: ACTION_TYPES.FOLD }, label: 'Fold', probability: 0.1 },
          { action: { type: ACTION_TYPES.CHECK }, label: 'Check', probability: 0.2 },
          { action: { type: ACTION_TYPES.CALL }, label: 'Call', probability: 0.2 },
          { action: { type: ACTION_TYPES.BET }, label: 'Bet', probability: 0.2 },
          { action: { type: ACTION_TYPES.RAISE }, label: 'Raise', probability: 0.2 },
          { action: { type: ACTION_TYPES.ALL_IN }, label: 'All-in', probability: 0.1 },
        ],
      };
    },
  });
}

function start(controller, provider, overrides = {}) {
  return controller.start({
    handSeed: overrides.handSeed ?? 17,
    heroPosition: overrides.heroPosition ?? 'BTN',
    handConfiguration: overrides.handConfiguration ?? handConfiguration(),
    decisionContextOptions: { stackMode: 'hero' },
  }, {
    strategyProvider: provider,
    progressionMode: overrides.progressionMode,
  });
}

function advanceStepwiseToBoundary(controller, observedEvents = []) {
  let snapshot = controller.getSnapshot();
  for (let transition = 0; transition < 256; transition += 1) {
    if (snapshot.status !== FULL_HAND_TRAINING_STATUSES.ADVANCING) return snapshot;
    const step = controller.advanceOneAutomatedEvent();
    assert.equal(step.ok, true);
    if (step.event) observedEvents.push(step.event);
    snapshot = step.snapshot;
  }
  assert.fail('Stepwise Full-Hand progression exceeded the focused test boundary');
}

function actionInput(type, legalActions) {
  const amountToMilliBb = type === ACTION_TYPES.BET || type === ACTION_TYPES.RAISE
    ? legalActions[type].minToMilliBb
    : null;
  return { type, amountToMilliBb };
}

function passiveAction(snapshot) {
  const spec = snapshot.currentDecision.legalActions;
  if (spec.check.available) return actionInput(ACTION_TYPES.CHECK, spec);
  if (spec.call.available) return actionInput(ACTION_TYPES.CALL, spec);
  return actionInput(ACTION_TYPES.FOLD, spec);
}

test('TrainingConfig v2 start adapter preserves rules and builds one canonical seat configuration', () => {
  const rulesSnapshot = handConfiguration({ playerCount: 6 }).rulesSnapshot;
  const adapted = createFullHandTrainingStartConfigurationFromTrainingConfig({
    trainingConfig: {
      schemaVersion: 'training-config/v2',
      tableSize: 6,
      stackBb: 30,
      streets: ['preflop', 'flop', 'turn', 'river'],
      rulesSnapshot,
      heroPositions: ['CO'],
      allowedDecisionTypes: ['preflop_unopened'],
      difficulty: 'hard',
      seed: 0,
    },
    handSeed: 0,
    heroPosition: 'CO',
  });

  assert.equal(adapted.handSeed, 0);
  assert.equal(adapted.heroPosition, 'CO');
  assert.equal(adapted.handConfiguration.players.length, 6);
  assert.equal(adapted.handConfiguration.players.every(
    (player) => player.startingStackMilliBb === 30_000,
  ), true);
  assert.deepEqual(adapted.handConfiguration.rulesSnapshot, rulesSnapshot);
  assert.deepEqual(adapted.decisionContextOptions, { stackMode: 'hero' });
});

test('start advances bots/chance to one exact canonical Hero boundary', () => {
  const controller = createFullHandTrainingSessionController();
  const result = start(controller, strategyProvider(), {
    handConfiguration: handConfiguration({
      handId: 'training-full-hand-multiway-start',
      playerCount: 6,
    }),
  });
  const snapshot = result.snapshot;

  assert.equal(result.ok, true);
  assert.equal(snapshot.schemaVersion, FULL_HAND_TRAINING_SESSION_SCHEMA_VERSION);
  assert.equal(snapshot.status, FULL_HAND_TRAINING_STATUSES.AWAITING_HERO);
  assert.equal(snapshot.handSeed, 17);
  assert.equal(snapshot.heroSeat, 0);
  assert.equal(snapshot.heroPlayerId, 'P0');
  assert.equal(snapshot.state.actingPlayerId, 'P0');
  assert.equal(snapshot.currentDecision.decisionOrdinal, 0);
  assert.equal(snapshot.currentDecision.currentActor.playerId, 'P0');
  assert.equal(snapshot.currentDecision.heroCards.length, 2);
  assert.strictEqual(
    snapshot.currentDecision.legalActions,
    snapshot.review.decisions[0].legalActions,
  );
  assert.equal(snapshot.opponentAssignments.length, 5);
  assert.equal(snapshot.botDecisionJournal.decisions.length > 0, true);
  assert.equal(snapshot.botDecisionJournal.decisions.some(
    (record) => record.actor.playerId === snapshot.heroPlayerId,
  ), false);
  assert.equal(snapshot.replaySource.events.length > 2, true);
});

test('stepwise automated events preserve the exact fast canonical boundary', () => {
  const fastController = createFullHandTrainingSessionController();
  const stepwiseController = createFullHandTrainingSessionController();
  const options = {
    handSeed: 1717,
    heroPosition: 'BTN',
    handConfiguration: handConfiguration({
      handId: 'training-full-hand-stepwise-equivalence',
      playerCount: 6,
    }),
  };
  const fast = start(fastController, strategyProvider(), options).snapshot;
  const stepwiseStart = start(stepwiseController, strategyProvider(), {
    ...options,
    progressionMode: FULL_HAND_TRAINING_PROGRESSION_MODES.STEPWISE,
  }).snapshot;
  const events = [];

  assert.equal(stepwiseStart.status, FULL_HAND_TRAINING_STATUSES.ADVANCING);
  const stepwise = advanceStepwiseToBoundary(stepwiseController, events);

  assert.equal(stepwise.status, FULL_HAND_TRAINING_STATUSES.AWAITING_HERO);
  assert.equal(events.length > 1, true);
  assert.equal(events[0].transitionKind, 'private_deal');
  assert.equal(events.filter((event) => event.kind === 'bot_action').length > 0, true);
  assert.deepEqual(stepwise.state, fast.state);
  assert.deepEqual(stepwise.botDecisionJournal, fast.botDecisionJournal);
  assert.deepEqual(stepwise.replaySource, fast.replaySource);
  assert.deepEqual(
    events.filter((event) => event.kind === 'bot_action').map((event) => ({
      actor: event.actor.playerId,
      action: event.chosenAction,
    })),
    fast.botDecisionJournal.decisions.map((decision) => ({
      actor: decision.actor.playerId,
      action: decision.chosenAction,
    })),
  );
});

test('stepwise continuation grades once and exposes Hero only on a later boundary step', async () => {
  const calls = { calls: 0 };
  const controller = createFullHandTrainingSessionController();
  const startResult = start(controller, strategyProvider(calls), {
    handSeed: 1818,
    progressionMode: FULL_HAND_TRAINING_PROGRESSION_MODES.STEPWISE,
  });
  let snapshot = advanceStepwiseToBoundary(controller);
  const answered = await controller.answer(
    snapshot.currentDecision.decisionId,
    passiveAction(snapshot),
  );

  assert.equal(answered.snapshot.status, FULL_HAND_TRAINING_STATUSES.ADVANCING);
  assert.equal(calls.calls, 1);
  const actionCountAfterHero = answered.snapshot.state.actionHistory.length;
  const firstStep = controller.advanceOneAutomatedEvent();
  assert.equal(firstStep.ok, true);
  assert.equal(firstStep.snapshot.status, FULL_HAND_TRAINING_STATUSES.ADVANCING);
  assert.equal(firstStep.event !== null, true);
  assert.equal(firstStep.snapshot.state.actionHistory.length >= actionCountAfterHero, true);

  snapshot = advanceStepwiseToBoundary(controller);
  assert.equal([
    FULL_HAND_TRAINING_STATUSES.AWAITING_HERO,
    FULL_HAND_TRAINING_STATUSES.TERMINAL,
  ].includes(snapshot.status), true);
  assert.equal(calls.calls, 1);
  assert.equal(startResult.snapshot.summary.decisionsAnswered, 0);
  assert.equal(snapshot.summary.decisionsAnswered, 1);
});

test('legal answer grades once, applies once, and automatically resumes the same Hand', async () => {
  const calls = { calls: 0 };
  const controller = createFullHandTrainingSessionController();
  const boundary = start(controller, strategyProvider(calls)).snapshot;
  const decision = boundary.currentDecision;
  const actionCountBefore = boundary.state.actionHistory.length;
  const botCountBefore = boundary.botDecisionJournal.decisions.length;

  const illegal = await controller.answer(decision.decisionId, {
    type: ACTION_TYPES.BET,
    amountToMilliBb: 1000,
  });
  assert.equal(illegal.ok, false);
  assert.equal(illegal.error.code, FULL_HAND_TRAINING_ERROR_CODES.ILLEGAL_ACTION);
  assert.equal(calls.calls, 0);
  assert.equal(controller.getSnapshot().state.actionHistory.length, actionCountBefore);

  const answered = await controller.answer(
    decision.decisionId,
    actionInput(ACTION_TYPES.RAISE, decision.legalActions),
  );
  assert.equal(answered.ok, true);
  assert.equal(
    [FULL_HAND_TRAINING_STATUSES.AWAITING_HERO, FULL_HAND_TRAINING_STATUSES.TERMINAL]
      .includes(answered.snapshot.status),
    true,
  );
  assert.equal(calls.calls, 1);
  assert.equal(answered.snapshot.state.actionHistory.length > actionCountBefore, true);
  assert.equal(answered.snapshot.botDecisionJournal.decisions.length > botCountBefore, true);
  assert.equal(answered.snapshot.state.actionHistory[actionCountBefore].submittedAction.type, ACTION_TYPES.RAISE);
  assert.equal(
    answered.snapshot.state.actionHistory[actionCountBefore].submittedAction.amountToMilliBb,
    decision.legalActions.raise.minToMilliBb,
  );
  assert.equal(answered.decision.chosenAction.type, ACTION_TYPES.RAISE);
  assert.strictEqual(answered.decision.evaluation.answerEvaluation, answered.evaluation);
  assert.equal(answered.snapshot.summary.decisionsAnswered, 1);
  assert.equal(answered.snapshot.gradeCounts.optimal, 1);
  assert.equal(Object.isFrozen(answered.decision.evaluation), true);

  const duplicate = await controller.answer(
    decision.decisionId,
    actionInput(ACTION_TYPES.RAISE, decision.legalActions),
  );
  assert.equal(duplicate.ok, false);
  assert.equal([
    FULL_HAND_TRAINING_ERROR_CODES.STALE_DECISION,
    FULL_HAND_TRAINING_ERROR_CODES.NOT_READY,
  ].includes(duplicate.error.code), true);
  assert.equal(calls.calls, 1);
  assert.equal(
    controller.getSnapshot().state.actionHistory.length,
    answered.snapshot.state.actionHistory.length,
  );
});

test('one continuous Hand reaches flop/turn/river and canonical showdown with immutable grades', async () => {
  const calls = { calls: 0 };
  const controller = createFullHandTrainingSessionController();
  let snapshot = start(controller, strategyProvider(calls), { handSeed: 33 }).snapshot;
  const seenStreets = new Set();
  let firstEvaluatedRecord = null;
  let firstEvaluatedBytes = null;

  for (let boundary = 0; boundary < 32; boundary += 1) {
    assert.equal(snapshot.status, FULL_HAND_TRAINING_STATUSES.AWAITING_HERO);
    seenStreets.add(snapshot.currentDecision.street);
    const answered = await controller.answer(
      snapshot.currentDecision.decisionId,
      passiveAction(snapshot),
    );
    assert.equal(answered.ok, true);
    if (firstEvaluatedRecord === null) {
      firstEvaluatedRecord = answered.decision;
      firstEvaluatedBytes = JSON.stringify(answered.decision);
    }
    snapshot = answered.snapshot;
    if (snapshot.status === FULL_HAND_TRAINING_STATUSES.TERMINAL) break;
  }

  assert.equal(snapshot.status, FULL_HAND_TRAINING_STATUSES.TERMINAL);
  assert.deepEqual([...seenStreets], ['preflop', 'flop', 'turn', 'river']);
  assert.equal(snapshot.completedHandResult.terminalReason, 'showdown');
  assert.equal(snapshot.automatedCompletedHandResult.canonicalResult, snapshot.completedHandResult);
  assert.equal(snapshot.review.schemaVersion, FULL_HAND_TRAINING_REVIEW_SCHEMA_VERSION);
  assert.equal(snapshot.review.status, 'ready');
  assert.deepEqual(
    snapshot.review.decisions.map((decision) => decision.decisionOrdinal),
    snapshot.review.decisions.map((_, ordinal) => ordinal),
  );
  assert.deepEqual(
    snapshot.review.decisions.map((decision) => decision.street),
    [...seenStreets],
  );
  assert.equal(snapshot.summary.decisionsAnswered, snapshot.review.decisions.length);
  assert.equal(calls.calls, snapshot.summary.decisionsAnswered);
  assert.strictEqual(snapshot.answeredDecisions[0], firstEvaluatedRecord);
  assert.equal(JSON.stringify(snapshot.answeredDecisions[0]), firstEvaluatedBytes);
  assert.equal(
    snapshot.botDecisionJournal.decisions.some(
      (decision) => decision.actor.playerId === snapshot.heroPlayerId,
    ),
    false,
  );
  assert.equal(
    snapshot.review.decisions.every((decision) => (
      decision.replayPoint.eventSequence >= 0
      && decision.chosenAction !== null
      && decision.strategyResult !== null
      && decision.grade !== null
    )),
    true,
  );

  const eventCount = snapshot.replaySource.events.length;
  const botCount = snapshot.botDecisionJournal.decisions.length;
  assert.strictEqual(controller.getReview(), snapshot.review);
  assert.strictEqual(controller.getReview(), snapshot.review);
  assert.equal(controller.getSnapshot().replaySource.events.length, eventCount);
  assert.equal(controller.getSnapshot().botDecisionJournal.decisions.length, botCount);
});

test('Hero fold produces a canonical fold terminal and a review-ready result', async () => {
  const controller = createFullHandTrainingSessionController();
  const boundary = start(controller, strategyProvider(), { handSeed: 44 }).snapshot;
  assert.equal(boundary.currentDecision.legalActions.fold.available, true);
  const answered = await controller.answer(
    boundary.currentDecision.decisionId,
    actionInput(ACTION_TYPES.FOLD, boundary.currentDecision.legalActions),
  );
  assert.equal(answered.snapshot.status, FULL_HAND_TRAINING_STATUSES.TERMINAL);
  assert.equal(answered.snapshot.completedHandResult.terminalReason, 'fold');
  assert.equal(answered.snapshot.review.status, 'ready');
  assert.equal(answered.snapshot.review.decisions.length, 1);
});

test('reset invalidates an async grade before it can mutate or apply to another Hand', async () => {
  const baseProvider = strategyProvider();
  let release;
  let capturedContext;
  let calls = 0;
  const delayedProvider = Object.freeze({
    schemaVersion: baseProvider.schemaVersion,
    resultSchemaVersion: baseProvider.resultSchemaVersion,
    resolve(context) {
      calls += 1;
      capturedContext = context;
      return new Promise((resolve) => { release = resolve; });
    },
  });
  const controller = createFullHandTrainingSessionController();
  const first = start(controller, delayedProvider, { handSeed: 55 }).snapshot;
  const pending = controller.answer(
    first.currentDecision.decisionId,
    passiveAction(first),
  );
  assert.equal(controller.getSnapshot().status, FULL_HAND_TRAINING_STATUSES.GRADING);
  await Promise.resolve();
  assert.equal(calls, 1);
  assert.equal(
    controller.getSnapshot().state.actionHistory.length,
    first.state.actionHistory.length + 1,
  );
  assert.equal(
    controller.getSnapshot().botDecisionJournal.decisions.length,
    first.botDecisionJournal.decisions.length,
  );

  controller.reset();
  const second = start(controller, baseProvider, {
    handSeed: 56,
    handConfiguration: handConfiguration({ handId: 'training-full-hand-new' }),
  }).snapshot;
  const newActionCount = second.state.actionHistory.length;
  release(baseProvider.resolve(capturedContext));
  const stale = await pending;

  assert.equal(stale.ok, false);
  assert.equal(stale.error.code, FULL_HAND_TRAINING_ERROR_CODES.STALE_EVALUATION);
  assert.equal(controller.getSnapshot().handSeed, 56);
  assert.equal(controller.getSnapshot().sessionId, second.sessionId);
  assert.equal(controller.getSnapshot().status, FULL_HAND_TRAINING_STATUSES.AWAITING_HERO);
  assert.equal(controller.getSnapshot().state.actionHistory.length, newActionCount);
});

test('post-hand Analysis handoff carries the exact decision and a truthful Scenario v2 projection', async () => {
  const controller = createFullHandTrainingSessionController();
  const boundary = start(controller, strategyProvider(), { handSeed: 57 }).snapshot;
  const terminal = await controller.answer(
    boundary.currentDecision.decisionId,
    actionInput(ACTION_TYPES.FOLD, boundary.currentDecision.legalActions),
  );
  const decision = terminal.snapshot.review.decisions[0];
  const handoff = controller.createAnalysisHandoff(0);

  assert.equal(handoff.schemaVersion, FULL_HAND_TRAINING_ANALYSIS_HANDOFF_SCHEMA_VERSION);
  assert.equal(handoff.derivation, 'canonical_full_hand_decision');
  assert.equal(handoff.historyAvailability, 'exact_replay_point_only');
  assert.strictEqual(handoff.decisionContext, decision.decisionContext);
  assert.strictEqual(handoff.replayPoint, decision.replayPoint);
  assert.strictEqual(handoff.rulesSnapshot, decision.rulesSnapshot);
  assert.equal(handoff.scenarioInput.schemaVersion, 'playbook-scenario/v2');
  assert.deepEqual(handoff.scenarioInput.heroCards, decision.heroCards);
  assert.deepEqual(handoff.scenarioInput.board, decision.board);
  assert.deepEqual(handoff.scenarioInput.deadCards, decision.decisionContext.deadCards);
  assert.deepEqual(handoff.scenarioInput.rulesSnapshot, decision.rulesSnapshot);
  assert.equal(Object.isFrozen(handoff), true);
});

test('reset clears terminal review data and a new Hand starts from a fresh boundary', async () => {
  const controller = createFullHandTrainingSessionController();
  const first = start(controller, strategyProvider(), { handSeed: 58 }).snapshot;
  const terminal = await controller.answer(
    first.currentDecision.decisionId,
    actionInput(ACTION_TYPES.FOLD, first.currentDecision.legalActions),
  );
  assert.equal(terminal.snapshot.review.status, 'ready');

  const idle = controller.reset();
  assert.equal(idle.status, FULL_HAND_TRAINING_STATUSES.IDLE);
  assert.equal(idle.review, null);
  assert.equal(idle.summary.decisionsAnswered, 0);

  const next = start(controller, strategyProvider(), {
    handSeed: 59,
    handConfiguration: handConfiguration({ handId: 'training-full-hand-reset-next' }),
  }).snapshot;
  assert.equal(next.status, FULL_HAND_TRAINING_STATUSES.AWAITING_HERO);
  assert.equal(next.handSeed, 59);
  assert.notEqual(next.sessionId, terminal.snapshot.sessionId);
  assert.equal(next.review.status, 'open');
  assert.equal(next.review.decisions[0].evaluation, null);
});

test('fixed collection remains explicitly unsupported before any strategy invocation', () => {
  const calls = { calls: 0 };
  const controller = createFullHandTrainingSessionController();
  const result = start(controller, strategyProvider(calls), {
    handSeed: 66,
    heroPosition: 'BTN',
    handConfiguration: handConfiguration({
      handId: 'training-full-hand-fixed',
      playerCount: 7,
      mode: GAME_MODES.CLUBGG,
    }),
  });

  assert.equal(result.ok, false);
  assert.equal(result.error.code, FULL_HAND_TRAINING_ERROR_CODES.UNSUPPORTED_RULES);
  assert.equal(result.error.details.reasonCode, 'fixed_collection_training_unsupported');
  assert.equal(result.snapshot.status, FULL_HAND_TRAINING_STATUSES.ERROR);
  assert.equal(result.snapshot.state, null);
  assert.equal(calls.calls, 0);
});
