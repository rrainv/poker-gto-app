import test from 'node:test';
import assert from 'node:assert/strict';

import {
  ACTION_TYPES,
  ANTE_TYPES,
  CHANCE_TYPES,
  GAME_MODES,
  applyAction,
  applyChance,
  createAction,
  deriveActorCallEconomics,
  deriveActorPotBeforeActionBb,
  deriveMinimumDefenseFrequency,
  deriveMinimumDefenseFrequencyPercent,
  deriveStackToPotRatio,
  initializeHand,
} from '../shared/poker-domain/index.js';
import { deriveDecisionContextFromPokerState } from '../app/src/application/decision-context-from-poker-state.mjs';
import { createTrainingPresentationModel } from '../app/src/application/training-presentation.mjs';
import { bootApp } from './helpers/app-under-test.mjs';

const app = await bootApp();

function dealtTable(stacksBb) {
  const holeCards = ['As', 'Kh', 'Qd', 'Jc', 'Ts', '9h'];
  let state = initializeHand({
    handId: `domain-math-${stacksBb.join('-')}`,
    game: {
      mode: GAME_MODES.HOME,
      smallBlindMilliBb: 500,
      bigBlindMilliBb: 1000,
      chipUnitMilliBb: 100,
      ante: { type: ANTE_TYPES.NONE, amountMilliBb: 0 },
    },
    buttonSeat: 0,
    players: stacksBb.map((stackBb, seat) => ({
      playerId: `P${seat}`,
      seat,
      startingStackMilliBb: stackBb * 1000,
    })),
  });
  state = applyChance(state, {
    type: CHANCE_TYPES.DEAL_HOLE,
    cardsByPlayer: Object.fromEntries(
      state.players.map((player, index) => [
        player.playerId,
        [holeCards[index * 2], holeCards[index * 2 + 1]],
      ]),
    ),
  });
  return state;
}

test('DOMAIN-MATH-001: shared/poker-domain selectors compute pot-before-action, SPR, and MDF', () => {
  // Heads-up 100bb vs 10bb shove: contestable pot after 9bb call is 20bb, so pot before action is 11bb.
  let huState = dealtTable([100, 10]);
  huState = applyAction(huState, createAction(huState.actingPlayerId, ACTION_TYPES.ALL_IN));
  const economics = deriveActorCallEconomics(huState, 'P1');
  assert.equal(deriveActorPotBeforeActionBb(economics), 11);

  const huContext = deriveDecisionContextFromPokerState(huState, 'P1');
  assert.equal(deriveActorPotBeforeActionBb(huContext), 11);
  assert.ok(Math.abs(deriveMinimumDefenseFrequency(huContext) - 0.55) < 1e-9);
  assert.ok(Math.abs(deriveMinimumDefenseFrequencyPercent(huContext) - 55) < 1e-9);
  // P0 is all-in (0bb remaining), so effectiveStackBb = 0 => SPR = 0 / 11 = 0
  assert.equal(deriveStackToPotRatio(huContext), 0);

  // Non-all-in raise to 6bb: P0 has 94bb remaining, P1 has 9bb remaining => effectiveStackBb = 9, potBeforeAction = 7 => SPR = 9 / 7
  let raiseState = dealtTable([100, 10]);
  raiseState = applyAction(raiseState, createAction(raiseState.actingPlayerId, ACTION_TYPES.RAISE, 6000));
  const raiseContext = deriveDecisionContextFromPokerState(raiseState, 'P1');
  assert.equal(deriveActorPotBeforeActionBb(raiseContext), 7);
  assert.ok(Math.abs(deriveStackToPotRatio(raiseContext) - (9 / 7)) < 1e-9);

  // Free check spot: callAmountBb = 0 => MDF is null, SPR uses contestable pot before action
  let checkState = dealtTable([100, 100]);
  checkState = applyAction(checkState, createAction(checkState.actingPlayerId, ACTION_TYPES.CALL));
  const bbOptionContext = deriveDecisionContextFromPokerState(checkState, 'P1');
  assert.equal(deriveActorPotBeforeActionBb(bbOptionContext), 2);
  assert.equal(deriveMinimumDefenseFrequency(bbOptionContext), null);
  assert.equal(deriveMinimumDefenseFrequencyPercent(bbOptionContext), null);
  assert.equal(deriveStackToPotRatio(bbOptionContext), 99 / 2);

  // Multiway spot: scalar SPR and MDF are null even when potBeforeAction is exact
  let mwState = dealtTable([100, 50, 10]);
  mwState = applyAction(mwState, createAction(mwState.actingPlayerId, ACTION_TYPES.ALL_IN));
  mwState = applyAction(mwState, createAction(mwState.actingPlayerId, ACTION_TYPES.CALL));
  const mwContext = deriveDecisionContextFromPokerState(mwState, 'P2');
  assert.equal(deriveActorPotBeforeActionBb(mwContext), 21);
  assert.equal(deriveStackToPotRatio(mwContext), null);
  assert.equal(deriveMinimumDefenseFrequency(mwContext), null);
  assert.equal(deriveMinimumDefenseFrequencyPercent(mwContext), null);

  // Scenario / missing economics: all return null
  assert.equal(deriveActorPotBeforeActionBb({ actorContestablePotAfterCallBb: null, callAmountBb: null }), null);
  assert.equal(deriveStackToPotRatio({ opponentCount: 1, effectiveStackBb: 100, actorContestablePotAfterCallBb: null, callAmountBb: null }), null);
  assert.equal(deriveMinimumDefenseFrequency({ opponentCount: 1, actorContestablePotAfterCallBb: null, callAmountBb: null }), null);
});

test('DOMAIN-MATH-001: UI updateMetrics and trainingContextPresentationAdapter format domain selector outputs without duplicating math', () => {
  const huContext = {
    schemaVersion: 'decision-context/v1',
    tableSize: 2,
    opponentCount: 1,
    stackBb: 100,
    effectiveStackBb: 31,
    heroPosition: 'BB',
    street: 'flop',
    lastAction: 'bet',
    currentPotBb: 16,
    potBb: 16,
    facingSizeBb: 6,
    callAmountBb: 6,
    actorContestablePotAfterCallBb: 16,
    requiredRawEquity: 6 / 16,
    heroCards: ['As', 'Kd'],
    board: ['Qh', 'Jc', '2s'],
    rakeMode: 'off',
    forcedContributionPerPlayerBb: 0,
    totalForcedContributionBb: 0,
  };

  app.call('updateMetrics', huContext);
  assert.equal(app.byId('mSPR').textContent, '3.1', '31bb effective stack / (16 - 6)bb pot before action = 3.1 SPR');

  const adapted = app.call('trainingContextPresentationAdapter', huContext);
  assert.ok(Math.abs(adapted.mdf - 62.5) < 1e-9, '(16 - 6) / 16 = 62.5% MDF');

  const multiwayContext = { ...huContext, tableSize: 3, opponentCount: 2, effectiveStackBb: null };
  app.call('updateMetrics', multiwayContext);
  assert.equal(app.byId('mSPR').textContent, '-', 'multiway omits scalar SPR');
  assert.equal(app.call('trainingContextPresentationAdapter', multiwayContext).mdf, null);
});

test('DOMAIN-MATH-001: Training presentation carries numeric bet amounts and never parses localized RU/HE display strings', () => {
  const exercise = {
    schemaVersion: 'training-exercise/v1',
    id: 'domain-math-training-fixture',
    seed: 101,
    heroPlayerId: 'hero',
    decisionContext: {
      schemaVersion: 'decision-context/v1',
      tableSize: 2,
      stackBb: 100,
      heroPosition: 'BB',
      street: 'preflop',
      heroCards: ['As', 'Kh'],
      board: [],
      deadCards: [],
      potBb: 3.5,
      lastAction: 'raise',
      facingSizeBb: 2.5,
      callAmountBb: 1.5,
      rakeMode: 'off',
      forcedContributionPerPlayerBb: 0,
      totalForcedContributionBb: 0,
    },
    legalActions: {
      playerId: 'hero',
      street: 'preflop',
      currentBetMilliBb: 2500,
      playerStreetContributionMilliBb: 1000,
      playerStackMilliBb: 99000,
      fold: { available: true },
      check: { available: false },
      call: { available: true, commitMilliBb: 1500, amountToMilliBb: 2500, isAllIn: false },
      bet: { available: false },
      raise: { available: true, minToMilliBb: 4000, maxToMilliBb: 100000, fullRaiseIncrementMilliBb: 1500 },
      allIn: { available: true, commitMilliBb: 99000, amountToMilliBb: 100000, isRaise: true },
    },
    pokerState: {
      actingPlayerId: 'hero',
      players: [
        { playerId: 'villain', position: 'BTN' },
        { playerId: 'hero', position: 'BB' },
      ],
      actionHistory: [
        {
          sequence: 0,
          street: 'preflop',
          playerId: 'villain',
          submittedAction: { type: 'raise', amountToMilliBb: 2500 },
          committedMilliBb: 2000,
          currentBetAfterMilliBb: 2500,
        },
      ],
    },
    generationMetadata: { attempts: 1, trajectoryLength: 1, policy: 'seeded_legal_random_v1' },
  };

  const presentation = createTrainingPresentationModel(exercise);
  assert.equal(presentation.actionHistory[0].amountMilliBb, 2500);
  assert.equal(presentation.actionHistory[0].amountBb, 2.5);
  assert.equal(presentation.actionHistory[0].amountLabel, '2.5bb');
  assert.equal(presentation.legalActions.find((a) => a.type === 'call').amountMilliBb, 1500);
  assert.equal(presentation.legalActions.find((a) => a.type === 'call').amountBb, 1.5);

  // Localized RU ("2,5 бб") and HE ("ב״ב 2.5") labels in presentation history must never cause truncation or NaN.
  const localizedPresentation = {
    actionHistory: [
      {
        sequence: 0,
        street: 'preflop',
        actorLabel: 'BTN',
        position: 'BTN',
        actionType: 'raise',
        actionLabel: 'Рейз до',
        amountMilliBb: 2500,
        amountBb: 2.5,
        amountLabel: '2,5 бб',
        isHero: false,
      },
      {
        sequence: 1,
        street: 'flop',
        actorLabel: 'BTN',
        position: 'BTN',
        actionType: 'bet',
        actionLabel: 'הימור ל-',
        amountMilliBb: 2500,
        amountBb: 2.5,
        amountLabel: 'ב״ב 2.5',
        isHero: false,
      },
      {
        sequence: 2,
        street: 'turn',
        actorLabel: 'Hero',
        position: 'BB',
        actionType: 'check',
        actionLabel: 'Чек',
        amountMilliBb: null,
        amountBb: null,
        amountLabel: null,
        isHero: true,
      },
    ],
  };

  const historyForAnalysis = app.call('trainingActionHistoryForAnalysis', localizedPresentation);
  assert.equal(historyForAnalysis[0].amountBb, 2.5, 'RU decimal comma "2,5 бб" preserves 2.5 without truncating to 2');
  assert.equal(historyForAnalysis[0].amountLabel, '2,5 бб');
  assert.equal(historyForAnalysis[1].amountBb, 2.5, 'HE label "ב״ב 2.5" preserves 2.5 without producing NaN');
  assert.equal(historyForAnalysis[1].amountLabel, 'ב״ב 2.5');
  assert.equal(historyForAnalysis[2].amountBb, null);

  // Even if an unmigrated caller supplies only a localized display string without numeric fields,
  // it must never parse "2,5 бб" into truncated 2 or "ב״ב 2.5" into NaN.
  const labelOnlyHistory = app.call('trainingActionHistoryForAnalysis', {
    actionHistory: [
      { sequence: 0, street: 'preflop', actorLabel: 'BTN', position: 'BTN', actionType: 'raise', actionLabel: 'Raise to', amountLabel: '2,5 бб', isHero: false },
      { sequence: 1, street: 'flop', actorLabel: 'BTN', position: 'BTN', actionType: 'bet', actionLabel: 'Bet to', amountLabel: 'ב״ב 2.5', isHero: false },
    ],
  });
  assert.equal(labelOnlyHistory[0].amountBb, null, 'never truncates "2,5 бб" to 2');
  assert.equal(labelOnlyHistory[1].amountBb, null, 'never returns NaN for "ב״ב 2.5"');
});
