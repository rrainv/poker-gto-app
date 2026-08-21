import test from 'node:test';
import assert from 'node:assert/strict';

import {
  ACTION_TYPES,
  ANTE_TYPES,
  CHANCE_TYPES,
  GAME_MODES,
  PHASES,
  createAction,
  createGameRulesSnapshotFromLegacyGameConfiguration,
  firstPreflopActorId,
  getLegalActionSpec,
} from '../shared/poker-domain/index.js';
import {
  COMPLETED_HAND_RESULT_SCHEMA_VERSION,
  HERO_DECISION_JOURNAL_SCHEMA_VERSION,
  HERO_DECISION_RECORD_SCHEMA_VERSION,
} from '../app/src/application/canonical-hand-lifecycle.mjs';
import { createCanonicalHandSession } from '../app/src/application/canonical-hand-session.mjs';
import { reconstructCanonicalHandReplaySource } from '../app/src/application/canonical-hand-replay-source.mjs';
import { createCanonicalLiveController } from '../app/src/application/canonical-live-controller.mjs';
import { deriveDecisionContextFromPokerState } from '../app/src/application/decision-context-from-poker-state.mjs';
import { createStrategyProvider } from '../app/src/application/strategy-provider.mjs';
import { STRATEGY_SOURCES } from '../app/src/application/strategy-result.mjs';

const HOLE_CARDS = Object.freeze([
  ['As', 'Ad'], ['Kh', 'Kd'], ['Qh', 'Qd'], ['Jh', 'Jd'], ['Th', 'Td'],
  ['9h', '9d'], ['8h', '8d'], ['7h', '7d'], ['6h', '6d'], ['5h', '5d'],
]);

function rulesSnapshot(playerCount, mode = GAME_MODES.HOME) {
  return createGameRulesSnapshotFromLegacyGameConfiguration({
    mode,
    smallBlindMilliBb: 500,
    bigBlindMilliBb: 1000,
    chipUnitMilliBb: 100,
    ante: { type: ANTE_TYPES.NONE, amountMilliBb: 0 },
  }, playerCount);
}

function configuration({
  handId,
  playerCount = 2,
  mode = GAME_MODES.HOME,
  startingStackMilliBb = 100_000,
} = {}) {
  return {
    handId,
    rulesSnapshot: rulesSnapshot(playerCount, mode),
    buttonSeat: 0,
    players: Array.from({ length: playerCount }, (_, seat) => ({
      playerId: `P${seat}`,
      seat,
      startingStackMilliBb,
    })),
  };
}

function dealAllKnown(session) {
  const state = session.getState();
  return session.applyChance({
    type: CHANCE_TYPES.DEAL_HOLE,
    cardsByPlayer: Object.fromEntries(
      state.players.map((player, index) => [player.playerId, HOLE_CARDS[index]]),
    ),
  });
}

function apply(session, type, amountToMilliBb = null) {
  const state = session.getState();
  return session.applyAction(createAction(state.actingPlayerId, type, amountToMilliBb));
}

function minimumRaise(session) {
  const state = session.getState();
  const spec = getLegalActionSpec(state);
  return apply(session, ACTION_TYPES.RAISE, spec.raise.minToMilliBb);
}

function trackedHuSession(handId) {
  const session = createCanonicalHandSession();
  session.initializeFromGameRulesSnapshot(configuration({ handId }));
  session.configureHero({ heroPlayerId: 'P0', decisionContextOptions: { stackMode: 'hero' } });
  dealAllKnown(session);
  return session;
}

function completeHuFoldHand(handId = 'full-hand-fold') {
  const session = trackedHuSession(handId);
  apply(session, ACTION_TYPES.CALL);
  minimumRaise(session);
  apply(session, ACTION_TYPES.FOLD);
  return session;
}

function checkThroughBoard(session) {
  apply(session, ACTION_TYPES.CALL);
  apply(session, ACTION_TYPES.CHECK);
  session.applyChance({ type: CHANCE_TYPES.DEAL_FLOP, cards: ['2c', '3d', '4s'] });
  apply(session, ACTION_TYPES.CHECK);
  apply(session, ACTION_TYPES.CHECK);
  session.applyChance({ type: CHANCE_TYPES.DEAL_TURN, cards: ['5c'] });
  apply(session, ACTION_TYPES.CHECK);
  apply(session, ACTION_TYPES.CHECK);
  session.applyChance({ type: CHANCE_TYPES.DEAL_RIVER, cards: ['9s'] });
  apply(session, ACTION_TYPES.CHECK);
  apply(session, ACTION_TYPES.CHECK);
}

test('fold terminal produces one immutable completed-Hand result with stable accounting', () => {
  const session = completeHuFoldHand();
  const state = session.getState();
  const result = session.getCompletedHandResult();

  assert.equal(state.phase, PHASES.TERMINAL);
  assert.equal(result.schemaVersion, COMPLETED_HAND_RESULT_SCHEMA_VERSION);
  assert.equal(result.handId, 'full-hand-fold');
  assert.equal(result.terminalReason, 'fold');
  assert.deepEqual(result.initialStacksMilliBbByPlayer, { P0: 100_000, P1: 100_000 });
  assert.deepEqual(result.finalStacksMilliBbByPlayer, { P0: 99_000, P1: 101_000 });
  assert.deepEqual(result.stackDeltasMilliBbByPlayer, { P0: -1000, P1: 1000 });
  assert.deepEqual(result.accounting.payoutsMilliBbByPlayer, { P1: 2000 });
  assert.deepEqual(result.accounting.refundsMilliBbByPlayer, { P1: 1000 });
  assert.equal(result.accounting.finalPotMilliBb, 0);
  assert.equal(result.accounting.deductionTotalMilliBb, 0);
  assert.equal(result.showdownResult, null);
  assert.equal(result.replay.eventCount, result.replay.events.length);
  assert.equal(result.endBoundary.replayEventSequence, result.replay.eventCount - 1);
  assert.equal(Object.isFrozen(result), true);
  assert.equal(Object.isFrozen(result.accounting), true);
  assert.strictEqual(session.getCompletedHandResult(), result);
});

test('Hero decisions have stable ordinals, immutable updates, deduplication, and exact Replay points', () => {
  const session = trackedHuSession('full-hand-decisions');
  const firstJournal = session.getHeroDecisionJournal();
  const firstRecord = firstJournal.decisions[0];

  assert.equal(firstJournal.schemaVersion, HERO_DECISION_JOURNAL_SCHEMA_VERSION);
  assert.equal(firstRecord.schemaVersion, HERO_DECISION_RECORD_SCHEMA_VERSION);
  assert.equal(firstRecord.decisionOrdinal, 0);
  assert.equal(firstRecord.chosenAction, null);
  assert.equal(firstRecord.evaluation, null);
  assert.equal(Object.isFrozen(firstRecord), true);
  session.captureCurrentHeroDecision();
  session.captureCurrentHeroDecision();
  assert.equal(session.getHeroDecisionJournal().decisions.length, 1);

  apply(session, ACTION_TYPES.CALL);
  assert.equal(firstRecord.chosenAction, null);
  assert.equal(session.getHeroDecisionJournal().decisions[0].chosenAction.type, ACTION_TYPES.CALL);
  minimumRaise(session);
  session.captureCurrentHeroDecision();
  session.captureCurrentHeroDecision();
  assert.deepEqual(
    session.getHeroDecisionJournal().decisions.map((record) => record.decisionOrdinal),
    [0, 1],
  );
  apply(session, ACTION_TYPES.FOLD);

  const journal = session.getHeroDecisionJournal();
  const source = session.createCanonicalHandReplaySource();
  const reconstruction = reconstructCanonicalHandReplaySource(source);
  assert.equal(journal.status, 'complete');
  assert.equal(journal.decisions.length, 2);
  assert.deepEqual(journal.decisions.map((record) => record.chosenAction.type), [
    ACTION_TYPES.CALL,
    ACTION_TYPES.FOLD,
  ]);
  for (const record of journal.decisions) {
    const frame = reconstruction.frames[record.occurrence.replayPoint.eventSequence];
    assert.equal(frame.state.actingPlayerId, 'P0');
    assert.equal(frame.state.actionHistory.length, record.occurrence.replayPoint.actionSequence);
    assert.deepEqual(
      deriveDecisionContextFromPokerState(frame.state, 'P0', { stackMode: 'hero' }),
      record.decisionContext,
    );
  }
});

test('HU showdown result retains final board, payout, showdown, and four Hero boundaries', () => {
  const session = trackedHuSession('full-hand-showdown');
  checkThroughBoard(session);
  assert.equal(session.getState().phase, PHASES.SHOWDOWN);
  assert.equal(session.getCompletedHandResult(), null);
  const settled = session.resolveShowdown();
  const result = session.getCompletedHandResult();
  const journal = session.getHeroDecisionJournal();

  assert.equal(settled.phase, PHASES.TERMINAL);
  assert.equal(result.terminalReason, 'showdown');
  assert.deepEqual(result.finalBoard, ['2c', '3d', '4s', '5c', '9s']);
  assert.deepEqual(result.accounting.payoutsMilliBbByPlayer, { P0: 2000 });
  assert.deepEqual(result.finalStacksMilliBbByPlayer, { P0: 101_000, P1: 99_000 });
  assert.deepEqual(result.stackDeltasMilliBbByPlayer, { P0: 1000, P1: -1000 });
  assert.equal(result.showdownResult.status, 'settled');
  assert.deepEqual(result.showdownResult.layerResults[0].winnerPlayerIds, ['P0']);
  assert.deepEqual(journal.decisions.map((record) => record.street), [
    'preflop', 'flop', 'turn', 'river',
  ]);
});

test('multiway fixed deductions and terminal payouts conserve exact starting stacks', () => {
  const session = createCanonicalHandSession();
  session.initializeFromGameRulesSnapshot(configuration({
    handId: 'full-hand-multiway',
    playerCount: 7,
    mode: GAME_MODES.CLUBGG,
  }));
  const heroPlayerId = firstPreflopActorId(session.getState());
  session.configureHero({ heroPlayerId });
  dealAllKnown(session);
  while (session.getState().phase === PHASES.BETTING) apply(session, ACTION_TYPES.FOLD);

  const result = session.getCompletedHandResult();
  const finalStackTotal = Object.values(result.finalStacksMilliBbByPlayer)
    .reduce((sum, amount) => sum + amount, 0);
  assert.equal(result.participants.length, 7);
  assert.equal(result.terminalReason, 'fold');
  assert.equal(result.accounting.deductionTotalMilliBb, 700);
  assert.deepEqual(Object.values(result.accounting.deductionsMilliBbByPlayer), [
    100, 100, 100, 100, 100, 100, 100,
  ]);
  assert.equal(
    result.accounting.initialStackTotalMilliBb,
    finalStackTotal + result.accounting.deductionTotalMilliBb,
  );
  assert.equal(result.accounting.finalPotMilliBb, 0);
  assert.equal(result.accounting.payoutTotalMilliBb + result.accounting.refundTotalMilliBb > 0, true);
  assert.equal(session.getHeroDecisionJournal().decisions.length, 1);
});

test('strategy and Training grading are opt-in and resolve exactly once per requested decision', () => {
  let providerInvocations = 0;
  const provider = createStrategyProvider({
    fallbackResolver() {
      providerInvocations += 1;
      return {
        source: STRATEGY_SOURCES.HEURISTIC_PREFLOP,
        actions: [
          { action: { type: ACTION_TYPES.CALL }, label: 'Call', probability: 0.3 },
          { action: { type: ACTION_TYPES.FOLD }, label: 'Fold', probability: 0.7 },
        ],
        modelVersion: 'focused-test-only',
      };
    },
  });
  const session = completeHuFoldHand('full-hand-optional-strategy');

  assert.equal(providerInvocations, 0);
  assert.equal(session.getHeroDecisionJournal().decisions[0].evaluation, null);
  const evaluated = session.evaluateHeroDecision({ decisionOrdinal: 0, strategyProvider: provider });
  assert.equal(providerInvocations, 1);
  assert.equal(evaluated.evaluation.source, STRATEGY_SOURCES.HEURISTIC_PREFLOP);
  assert.equal(evaluated.evaluation.strategyResult.modelVersion, 'focused-test-only');
  assert.equal(evaluated.evaluation.answerEvaluation.grade, 'mistake');
  assert.equal(Object.isFrozen(evaluated.evaluation), true);
  assert.strictEqual(
    session.evaluateHeroDecision({ decisionOrdinal: 0, strategyProvider: provider }),
    evaluated,
  );
  assert.equal(providerInvocations, 1);
  assert.equal(session.getHeroDecisionJournal().decisions[1].evaluation, null);
});

test('production live Hand exposes the same completed result, decision journal, and Replay source', () => {
  const controller = createCanonicalLiveController({
    enabled: true,
    handIdFactory: () => 'full-hand-live-controller',
  });
  const initial = controller.initialize({
    tableSize: 2,
    gameMode: GAME_MODES.HOME,
    stackBb: 100,
    stackMode: 'hero',
    heroPosition: 'BTN',
    anteType: ANTE_TYPES.NONE,
    anteBb: 0,
    straddleBb: 0,
  });
  controller.dealHoleCards(Object.fromEntries(
    initial.players.map((player, index) => [player.playerId, HOLE_CARDS[index]]),
  ));
  controller.applyAction({ type: ACTION_TYPES.FOLD });

  const result = controller.getCompletedHandResult();
  const journal = controller.getHeroDecisionJournal();
  const source = controller.createCanonicalHandReplaySource();
  assert.equal(result.handId, 'full-hand-live-controller');
  assert.equal(result.terminalReason, 'fold');
  assert.equal(journal.status, 'complete');
  assert.equal(journal.decisions.length, 1);
  assert.equal(journal.decisions[0].chosenAction.type, ACTION_TYPES.FOLD);
  assert.deepEqual(source.events, result.replay.events);
});
