import test from 'node:test';
import assert from 'node:assert/strict';

import {
  ACTION_TYPES,
  ANTE_TYPES,
  CHANCE_TYPES,
  GAME_MODES,
  createAction,
  createGameRulesSnapshotFromLegacyGameConfiguration,
  getLegalActionSpec,
} from '../shared/poker-domain/index.js';
import {
  HERO_DECISION_ACTION_RESULT_SCHEMA_VERSION,
} from '../app/src/application/canonical-hand-lifecycle.mjs';
import { createCanonicalHandSession } from '../app/src/application/canonical-hand-session.mjs';
import {
  FULL_HAND_TRAINING_ERROR_CODES,
  createFullHandTrainingSessionController,
} from '../app/src/application/full-hand-training-session-controller.mjs';
import {
  FULL_HAND_TRAINING_SIZING_INPUT_ERRORS,
  FULL_HAND_TRAINING_SIZING_MODEL_SCHEMA_VERSION,
  createFullHandTrainingSizingModel,
  validateFullHandTrainingSizingInput,
} from '../app/src/application/full-hand-training-sizing.mjs';
import { createStrategyProvider } from '../app/src/application/strategy-provider.mjs';
import { STRATEGY_SOURCES } from '../app/src/application/strategy-result.mjs';

const HOLE_CARDS = Object.freeze({
  P0: ['As', 'Kd'],
  P1: ['Qh', 'Jd'],
});

function rulesSnapshot() {
  return createGameRulesSnapshotFromLegacyGameConfiguration({
    mode: GAME_MODES.HOME,
    smallBlindMilliBb: 500,
    bigBlindMilliBb: 1000,
    chipUnitMilliBb: 100,
    ante: { type: ANTE_TYPES.NONE, amountMilliBb: 0 },
  }, 2);
}

function handConfiguration(handId = 'full-hand-sizing') {
  return {
    handId,
    rulesSnapshot: rulesSnapshot(),
    buttonSeat: 0,
    players: [
      { playerId: 'P0', seat: 0, startingStackMilliBb: 100_000 },
      { playerId: 'P1', seat: 1, startingStackMilliBb: 100_000 },
    ],
  };
}

function dealtSession(handId = 'full-hand-sizing-state') {
  const session = createCanonicalHandSession();
  session.initializeFromGameRulesSnapshot(handConfiguration(handId));
  session.configureHero({ heroPlayerId: 'P0', decisionContextOptions: { stackMode: 'hero' } });
  session.applyChance({ type: CHANCE_TYPES.DEAL_HOLE, cardsByPlayer: HOLE_CARDS });
  return session;
}

function applyCurrent(session, type, amountToMilliBb = null) {
  const playerId = session.getState().actingPlayerId;
  return session.applyAction(createAction(playerId, type, amountToMilliBb));
}

function reachFlop(handId = 'full-hand-sizing-flop') {
  const session = dealtSession(handId);
  applyCurrent(session, ACTION_TYPES.CALL);
  applyCurrent(session, ACTION_TYPES.CHECK);
  session.applyChance({ type: CHANCE_TYPES.DEAL_FLOP, cards: ['2c', '7d', '9s'] });
  return session;
}

function provider(counter = { calls: 0 }) {
  return createStrategyProvider({
    fallbackResolver() {
      counter.calls += 1;
      return {
        source: STRATEGY_SOURCES.HEURISTIC_PREFLOP,
        modelVersion: 'full-hand-sizing-family-only-test/v1',
        actions: [
          { action: { type: ACTION_TYPES.RAISE }, label: 'Raise', probability: 0.8 },
          { action: { type: ACTION_TYPES.FOLD }, label: 'Fold', probability: 0.2 },
        ],
      };
    },
  });
}

function startController(controller, strategyProvider, handId) {
  return controller.start({
    handSeed: 71,
    heroPosition: 'BTN',
    handConfiguration: handConfiguration(handId),
    decisionContextOptions: { stackMode: 'hero' },
  }, { strategyProvider });
}

test('amount-to validation accepts canonical min, arbitrary intermediate, and max non-all-in', () => {
  const state = dealtSession().getState();
  const bounds = getLegalActionSpec(state).raise;
  const amounts = [bounds.minToMilliBb, bounds.minToMilliBb + 1700, bounds.maxToMilliBb];

  for (const amountToMilliBb of amounts) {
    const validation = validateFullHandTrainingSizingInput(
      state,
      ACTION_TYPES.RAISE,
      String(amountToMilliBb / 1000),
    );
    assert.equal(validation.valid, true);
    assert.deepEqual(validation.actionInput, {
      type: ACTION_TYPES.RAISE,
      amountToMilliBb,
    });

    const session = dealtSession(`full-hand-sizing-valid-${amountToMilliBb}`);
    applyCurrent(session, ACTION_TYPES.RAISE, amountToMilliBb);
    assert.equal(
      session.getState().actionHistory.at(-1).submittedAction.amountToMilliBb,
      amountToMilliBb,
    );
  }
});

test('amount-to validation rejects below-min, above-max, and chip-unit misalignment', () => {
  const state = dealtSession().getState();
  const bounds = getLegalActionSpec(state).raise;
  const cases = [
    [String((bounds.minToMilliBb - 100) / 1000), FULL_HAND_TRAINING_SIZING_INPUT_ERRORS.BELOW_MINIMUM],
    [String((bounds.maxToMilliBb + 100) / 1000), FULL_HAND_TRAINING_SIZING_INPUT_ERRORS.ABOVE_MAXIMUM],
    [String((bounds.minToMilliBb + 50) / 1000), FULL_HAND_TRAINING_SIZING_INPUT_ERRORS.CHIP_UNIT_MISALIGNED],
  ];

  for (const [value, errorCode] of cases) {
    const validation = validateFullHandTrainingSizingInput(state, ACTION_TYPES.RAISE, value);
    assert.equal(validation.valid, false);
    assert.equal(validation.errorCode, errorCode);
    assert.equal(validation.actionInput, null);
  }
});

test('preflop custom open and re-raise preserve their exact canonical amount-to', () => {
  const session = dealtSession('full-hand-sizing-preflop');
  const openAmountToMilliBb = 3700;
  applyCurrent(session, ACTION_TYPES.RAISE, openAmountToMilliBb);
  assert.equal(session.getState().actionHistory.at(-1).currentBetAfterMilliBb, 3700);

  const reraiseBounds = getLegalActionSpec(session.getState()).raise;
  const reraiseAmountToMilliBb = reraiseBounds.minToMilliBb + 500;
  applyCurrent(session, ACTION_TYPES.RAISE, reraiseAmountToMilliBb);
  const record = session.getState().actionHistory.at(-1);
  assert.equal(record.submittedAction.type, ACTION_TYPES.RAISE);
  assert.equal(record.submittedAction.amountToMilliBb, reraiseAmountToMilliBb);
  assert.equal(record.currentBetAfterMilliBb, reraiseAmountToMilliBb);
});

test('postflop custom bet and raise preserve their exact canonical amount-to', () => {
  const session = reachFlop();
  const betAmountToMilliBb = 1700;
  applyCurrent(session, ACTION_TYPES.BET, betAmountToMilliBb);
  assert.equal(session.getState().actionHistory.at(-1).submittedAction.amountToMilliBb, 1700);

  const raiseBounds = getLegalActionSpec(session.getState()).raise;
  const raiseAmountToMilliBb = raiseBounds.minToMilliBb + 500;
  applyCurrent(session, ACTION_TYPES.RAISE, raiseAmountToMilliBb);
  const record = session.getState().actionHistory.at(-1);
  assert.equal(record.submittedAction.type, ACTION_TYPES.RAISE);
  assert.equal(record.submittedAction.amountToMilliBb, raiseAmountToMilliBb);
  assert.equal(record.currentBetAfterMilliBb, raiseAmountToMilliBb);
});

test('quick presets round to canonical chips, remain legal, and deduplicate collapsed amounts', () => {
  const preflop = createFullHandTrainingSizingModel(dealtSession().getState());
  assert.equal(preflop.schemaVersion, FULL_HAND_TRAINING_SIZING_MODEL_SCHEMA_VERSION);
  assert.equal(preflop.semantics, 'amount_to');
  assert.deepEqual(
    preflop.actions.raise.presets
      .filter((preset) => preset.kind === 'amount_to')
      .map((preset) => preset.amountToMilliBb),
    [2000, 2200, 2500, 3000, 3500],
  );

  const postflopState = reachFlop().getState();
  const postflop = createFullHandTrainingSizingModel(postflopState);
  const presets = postflop.actions.bet.presets;
  const identities = presets.map((preset) => `${preset.actionType}:${preset.amountToMilliBb}`);
  assert.equal(new Set(identities).size, identities.length);
  for (const preset of presets.filter((entry) => entry.kind === 'amount_to')) {
    assert.equal(preset.amountToMilliBb % postflop.chipUnitMilliBb, 0);
    assert.equal(preset.amountToMilliBb >= postflop.actions.bet.minToMilliBb, true);
    assert.equal(preset.amountToMilliBb <= postflop.actions.bet.maxToMilliBb, true);
  }
  assert.equal(
    presets.filter((preset) => preset.amountToMilliBb === 1000).length,
    1,
    '33% and 50% shortcuts collapse into the canonical minimum only once',
  );
  assert.deepEqual(
    presets.filter((preset) => preset.kind === 'amount_to').map((preset) => preset.amountToMilliBb),
    [1000, 1300, 1500, 2000, 3000],
  );
});

test('All-in preset and submission remain the canonical unsized ALL_IN action', () => {
  const session = dealtSession('full-hand-sizing-all-in');
  const model = createFullHandTrainingSizingModel(session.getState());
  const preset = model.actions.raise.presets.find((entry) => entry.kind === 'all_in');
  assert.equal(preset.actionType, ACTION_TYPES.ALL_IN);
  assert.equal(preset.amountToMilliBb, model.allInAmountToMilliBb);

  applyCurrent(session, preset.actionType);
  const record = session.getState().actionHistory.at(-1);
  assert.equal(record.submittedAction.type, ACTION_TYPES.ALL_IN);
  assert.equal(record.submittedAction.amountToMilliBb, null);
  assert.equal(record.wasAllIn, true);
  const heroDecision = session.getHeroDecisionJournal().decisions[0];
  assert.equal(heroDecision.chosenAction.type, ACTION_TYPES.ALL_IN);
  assert.equal(heroDecision.chosenAction.amountToMilliBb, null);
  assert.equal(
    heroDecision.chosenActionResult.streetContributionAfterMilliBb,
    preset.amountToMilliBb,
  );
});

test('controller rejects illegal concrete sizes before grading and accepts an arbitrary legal size', async () => {
  const calls = { calls: 0 };
  const controller = createFullHandTrainingSessionController();
  const boundary = startController(controller, provider(calls), 'full-hand-sizing-controller-illegal').snapshot;
  const decision = boundary.currentDecision;
  const bounds = decision.legalActions.raise;
  const actionCount = boundary.state.actionHistory.length;
  const illegalAmounts = [
    bounds.minToMilliBb - 100,
    bounds.maxToMilliBb + 100,
    bounds.minToMilliBb + 50,
  ];

  for (const amountToMilliBb of illegalAmounts) {
    const result = await controller.answer(decision.decisionId, {
      type: ACTION_TYPES.RAISE,
      amountToMilliBb,
    });
    assert.equal(result.ok, false);
    assert.equal(result.error.code, FULL_HAND_TRAINING_ERROR_CODES.ILLEGAL_ACTION);
    assert.equal(controller.getSnapshot().state.actionHistory.length, actionCount);
    assert.equal(calls.calls, 0);
  }

  const amountToMilliBb = bounds.minToMilliBb + 1700;
  const answered = await controller.answer(decision.decisionId, {
    type: ACTION_TYPES.RAISE,
    amountToMilliBb,
  });
  assert.equal(answered.ok, true);
  assert.equal(calls.calls, 1);
  assert.equal(answered.decision.chosenAction.amountToMilliBb, amountToMilliBb);
});

test('exact sizing and resulting commitment are journaled while grading stays family-only once', async () => {
  const calls = { calls: 0 };
  const controller = createFullHandTrainingSessionController();
  const boundary = startController(controller, provider(calls), 'full-hand-sizing-journal').snapshot;
  const decision = boundary.currentDecision;
  const amountToMilliBb = decision.legalActions.raise.minToMilliBb + 1700;
  const answered = await controller.answer(decision.decisionId, {
    type: ACTION_TYPES.RAISE,
    amountToMilliBb,
  });

  assert.equal(calls.calls, 1);
  assert.deepEqual(answered.decision.chosenAction, {
    schemaVersion: 'poker-action/v1',
    playerId: boundary.heroPlayerId,
    type: ACTION_TYPES.RAISE,
    amountToMilliBb,
  });
  assert.equal(
    answered.decision.chosenActionResult.schemaVersion,
    HERO_DECISION_ACTION_RESULT_SCHEMA_VERSION,
  );
  assert.equal(answered.decision.chosenActionResult.committedMilliBb, amountToMilliBb - 500);
  assert.equal(
    answered.decision.chosenActionResult.streetContributionAfterMilliBb,
    amountToMilliBb,
  );
  assert.equal(answered.evaluation.chosenAction.type, ACTION_TYPES.RAISE);
  assert.equal(Object.hasOwn(answered.evaluation.chosenAction, 'amountToMilliBb'), false);
  assert.equal(answered.snapshot.review.decisions[0].chosenAction.amountToMilliBb, amountToMilliBb);
  assert.strictEqual(
    answered.snapshot.review.decisions[0].chosenActionResult,
    answered.decision.chosenActionResult,
  );
});
