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
import { createCanonicalHandSession } from '../app/src/application/canonical-hand-session.mjs';
import { reconstructCanonicalHandReplaySource } from '../app/src/application/canonical-hand-replay-source.mjs';

import {
  HAND_REVIEW_FRAME_CONVENTION,
  createHandReviewAnalysisHandoff,
  createHandReviewProjector,
} from '../app/src/application/hand-review.mjs';
import {
  createStrategyResult,
  createUnavailableStrategyResult,
} from '../app/src/application/strategy-result.mjs';

function decisionContext(overrides = {}) {
  return {
    schemaVersion: 'decision-context/v1',
    tableSize: 6,
    opponentCount: 1,
    heroPosition: 'BTN',
    positionRelation: 'in_position',
    street: 'preflop',
    heroCards: ['As', 'Ks'],
    board: [],
    deadCards: [],
    stackBb: 100,
    heroStackBb: 99,
    stackMode: 'hero',
    potBb: 1.5,
    currentPotBb: 1.5,
    effectiveStackBb: 99,
    effectiveStackByOpponent: [],
    lastAction: 'unopened',
    priorActionSummary: {
      facingActionFamily: 'unopened',
      aggressorPosition: null,
    },
    facingSizeBb: 0,
    callAmountBb: null,
    heroStreetContributionBb: 0,
    rakeMode: 'off',
    forcedContributionPerPlayerBb: 0,
    totalForcedContributionBb: 0,
    ...overrides,
  };
}

function legalActions(types = ['fold', 'call', 'raise', 'all_in']) {
  const available = new Set(types);
  return {
    fold: { available: available.has('fold') },
    check: { available: available.has('check') },
    call: { available: available.has('call'), commitMilliBb: 1000, allIn: false },
    bet: { available: available.has('bet'), minToMilliBb: 2000, maxToMilliBb: 99000 },
    raise: { available: available.has('raise'), minToMilliBb: 3000, maxToMilliBb: 99000 },
    allIn: { available: available.has('all_in'), amountToMilliBb: 99000 },
  };
}

function strategy(actions, source = 'heuristic_preflop') {
  return createStrategyResult({
    source,
    actions: actions.map(([type, probability]) => ({
      action: { type },
      label: type === 'all_in' ? 'All-in' : type[0].toUpperCase() + type.slice(1),
      probability,
    })),
  });
}

function decision({
  ordinal,
  eventSequence,
  actionSequence,
  street = 'preflop',
  chosenType = 'call',
  strategyResult = null,
  context = {},
  board = [],
  amountToMilliBb = null,
} = {}) {
  const resolvedContext = decisionContext({ street, board, ...context });
  return {
    schemaVersion: 'hero-decision-record/v1',
    decisionId: `hand-review-test:hero-decision:${ordinal}`,
    handId: 'hand-review-test',
    decisionOrdinal: ordinal,
    street,
    occurrence: {
      replayPoint: {
        schemaVersion: 'canonical-replay-point/v1',
        eventSequence,
        actionSequence,
      },
    },
    decisionContext: resolvedContext,
    legalActions: legalActions(chosenType === 'check' ? ['check', 'bet', 'all_in'] : undefined),
    currentActor: { playerId: 'hero', seat: 0, position: resolvedContext.heroPosition },
    canonicalFacts: {
      potMilliBb: Math.round(resolvedContext.currentPotBb * 1000),
      heroCurrentStackMilliBb: Math.round(resolvedContext.heroStackBb * 1000),
    },
    heroCards: [...resolvedContext.heroCards],
    board: [...board],
    rulesSnapshot: { schemaVersion: 'poker-rules/v1', semanticFingerprint: 'review-test' },
    chosenAction: {
      type: chosenType,
      ...(Number.isSafeInteger(amountToMilliBb) ? { amountToMilliBb } : {}),
    },
    chosenActionResult: {
      schemaVersion: 'hero-decision-action-result/v1',
      actionSequence,
      committedMilliBb: chosenType === 'call' ? 1000 : 0,
      streetContributionAfterMilliBb: chosenType === 'all_in' ? 99000 : amountToMilliBb ?? 0,
      wasAllIn: chosenType === 'all_in',
    },
    strategyResult,
    evaluation: null,
  };
}

function replayProjection(selectedFrameIndex = 8, totalSteps = 20) {
  return {
    selectedFrameIndex,
    currentStep: selectedFrameIndex + 1,
    totalSteps,
    canPrevious: selectedFrameIndex > 0,
    canNext: selectedFrameIndex < totalSteps - 1,
  };
}

function completedResult(overrides = {}) {
  return {
    schemaVersion: 'canonical-completed-hand-result/v1',
    terminalReason: 'showdown',
    finalBoard: ['2c', '7d', 'Th', 'Js', 'Qc'],
    stackDeltasMilliBbByPlayer: { hero: 12500, villain: -12500 },
    accounting: { payoutTotalMilliBb: 42000 },
    ...overrides,
  };
}

test('consumes the real canonical journal and maps every Hero decision to its before-action frame', () => {
  const session = createCanonicalHandSession();
  const rulesSnapshot = createGameRulesSnapshotFromLegacyGameConfiguration({
    mode: GAME_MODES.HOME,
    smallBlindMilliBb: 500,
    bigBlindMilliBb: 1000,
    chipUnitMilliBb: 100,
    ante: { type: ANTE_TYPES.NONE, amountMilliBb: 0 },
  }, 2);
  session.initializeFromGameRulesSnapshot({
    handId: 'canonical-review-hand',
    rulesSnapshot,
    buttonSeat: 0,
    players: [
      { playerId: 'P0', seat: 0, startingStackMilliBb: 100000 },
      { playerId: 'P1', seat: 1, startingStackMilliBb: 100000 },
    ],
  });
  session.configureHero({ heroPlayerId: 'P0', decisionContextOptions: { stackMode: 'hero' } });
  session.applyChance({
    type: CHANCE_TYPES.DEAL_HOLE,
    cardsByPlayer: { P0: ['As', 'Ad'], P1: ['Kh', 'Kd'] },
  });
  session.applyAction(createAction('P0', ACTION_TYPES.CALL));
  const raiseSpec = getLegalActionSpec(session.getState());
  session.applyAction(createAction('P1', ACTION_TYPES.RAISE, raiseSpec.raise.minToMilliBb));
  session.applyAction(createAction('P0', ACTION_TYPES.FOLD));

  const journal = session.getHeroDecisionJournal();
  const reconstruction = reconstructCanonicalHandReplaySource(
    session.createCanonicalHandReplaySource(),
  );
  const projector = createHandReviewProjector({
    resolveStrategy: () => strategy([['call', 0.55], ['fold', 0.45]]),
  });
  const review = projector.project({
    source: 'canonical_hand',
    handId: journal.handId,
    heroPlayerId: journal.heroPlayerId,
    decisions: journal.decisions,
    completedHandResult: session.getCompletedHandResult(),
    replayProjection: replayProjection(journal.decisions[0].occurrence.replayPoint.eventSequence),
  });

  assert.deepEqual(review.decisions.map((entry) => entry.chosenAction.type), ['call', 'fold']);
  review.decisions.forEach((entry, index) => {
    const frame = reconstruction.frames[entry.replayFrameTarget.frameIndex];
    assert.equal(frame.state.actingPlayerId, 'P0');
    assert.equal(frame.state.actionHistory.length, entry.replayFrameTarget.actionSequence);
    assert.deepEqual(entry.durable.decisionContext, journal.decisions[index].decisionContext);
  });
});

test('projects multiple Hero decisions as immutable pre-action review points with full context', () => {
  const decisions = [
    decision({
      ordinal: 0,
      eventSequence: 3,
      actionSequence: 1,
      chosenType: 'call',
      strategyResult: strategy([['raise', 0.7], ['call', 0.2], ['fold', 0.1]]),
    }),
    decision({
      ordinal: 1,
      eventSequence: 8,
      actionSequence: 5,
      street: 'flop',
      chosenType: 'check',
      board: ['2c', '7d', 'Th'],
      context: { currentPotBb: 8.5, potBb: 8.5, lastAction: 'checked_to', callAmountBb: 0 },
      strategyResult: strategy([['check', 0.52], ['bet', 0.48]], 'heuristic_postflop'),
    }),
    decision({
      ordinal: 2,
      eventSequence: 14,
      actionSequence: 9,
      street: 'river',
      chosenType: 'all_in',
      board: ['2c', '7d', 'Th', 'Js', 'Qc'],
      context: {
        currentPotBb: 28,
        potBb: 28,
        heroStackBb: 22,
        effectiveStackBb: null,
        opponentCount: 2,
        effectiveStackByOpponent: [
          { position: 'SB', effectiveStackBb: 18 },
          { position: 'BB', effectiveStackBb: 22 },
        ],
      },
      strategyResult: createUnavailableStrategyResult('unsupported fixture'),
    }),
  ];
  const before = structuredClone(decisions);
  const projector = createHandReviewProjector();
  const review = projector.project({
    source: 'canonical_hand',
    handId: 'hand-review-test',
    heroPlayerId: 'hero',
    decisions,
    completedHandResult: completedResult(),
    replayProjection: replayProjection(8),
    selectedDecisionIndex: 1,
    actions: { analyze: true, saveHand: true, saveSpot: true },
  });

  assert.equal(review.schemaVersion, 'hand-review/v1');
  assert.equal(review.frameConvention.id, HAND_REVIEW_FRAME_CONVENTION);
  assert.equal(review.status, 'ready');
  assert.equal(review.decisions.length, 3);
  assert.deepEqual(review.decisions.map((entry) => entry.replayFrameTarget.frameIndex), [3, 8, 14]);
  assert.deepEqual(review.decisions.map((entry) => entry.replayFrameTarget.actionSequence), [1, 5, 9]);
  assert.equal(review.decisions[2].chosenAction.amountKind, 'amount_to');
  assert.equal(review.decisions[2].chosenAction.amountMilliBb, 99000);
  assert.equal(review.decisions[2].context.effectiveStackBb, null);
  assert.equal(review.decisions[2].context.effectiveStackByOpponent.length, 2);
  assert.ok(review.decisions[2].limitations.includes('multiway_effective_stacks'));
  assert.equal(review.decisions[2].comparison.state, 'unavailable');
  assert.deepEqual(review.overview.finalBoard, completedResult().finalBoard);
  assert.equal(review.overview.heroStackDeltaMilliBb, 12500);
  assert.equal(review.overview.unavailableDecisionCount, 1);
  assert.equal(review.replay.synchronizedToSelectedDecision, true);
  assert.equal(review.actions.saveHand, true);
  assert.equal(Object.isFrozen(review), true);
  assert.equal(Object.isFrozen(review.decisions[0].durable.decisionContext), true);
  assert.deepEqual(decisions, before, 'projection must not mutate canonical records');
});

test('fold terminals, all-ins, skipped streets, and early completion keep durable review truth', () => {
  const projector = createHandReviewProjector();
  const foldDecision = decision({
    ordinal: 0,
    eventSequence: 2,
    actionSequence: 0,
    chosenType: 'fold',
    strategyResult: strategy([['fold', 0.6], ['call', 0.4]]),
  });
  const foldReview = projector.project({
    source: 'canonical_hand',
    handId: 'fold-hand',
    heroPlayerId: 'hero',
    decisions: [{ ...foldDecision, handId: 'fold-hand', decisionId: 'fold-hand:hero-decision:0' }],
    completedHandResult: completedResult({
      terminalReason: 'fold',
      finalBoard: [],
      stackDeltasMilliBbByPlayer: { hero: -1000 },
    }),
    replayProjection: replayProjection(2, 4),
  });
  assert.equal(foldReview.overview.terminalReason, 'fold');
  assert.deepEqual(foldReview.overview.finalBoard, []);
  assert.equal(foldReview.decisions[0].chosenAction.type, 'fold');
  assert.equal(foldReview.decisions[0].replayFrameTarget.convention, 'pre_action_event_sequence');

  const allIn = decision({
    ordinal: 0,
    eventSequence: 4,
    actionSequence: 2,
    street: 'flop',
    chosenType: 'all_in',
    board: ['2c', '7d', 'Th'],
    strategyResult: strategy([['all_in', 0.55], ['check', 0.45]], 'heuristic_postflop'),
  });
  const allInReview = projector.project({
    source: 'training_full_hand',
    handId: 'all-in-hand',
    heroPlayerId: 'hero',
    decisions: [{ ...allIn, handId: 'all-in-hand', decisionId: 'all-in-hand:hero-decision:0' }],
    completedHandResult: completedResult(),
    replayProjection: replayProjection(4, 12),
    actions: { repeat: true, next: true },
  });
  assert.equal(allInReview.decisions[0].street, 'flop');
  assert.equal(allInReview.decisions[0].chosenAction.wasAllIn, true);
  assert.equal(allInReview.actions.repeat, true);
  assert.equal(allInReview.actions.next, true);
});

test('provider work is cached per durable decision and never repeats for Replay-only movement', () => {
  let calls = 0;
  const resolved = strategy([['raise', 0.6], ['call', 0.3], ['fold', 0.1]]);
  const projector = createHandReviewProjector({
    resolveStrategy(context) {
      calls += 1;
      assert.equal(context.schemaVersion, 'decision-context/v1');
      return resolved;
    },
  });
  const decisions = [
    decision({ ordinal: 0, eventSequence: 3, actionSequence: 1, chosenType: 'call' }),
    decision({ ordinal: 1, eventSequence: 7, actionSequence: 4, chosenType: 'raise', amountToMilliBb: 9000 }),
  ];
  const input = {
    source: 'canonical_hand',
    handId: 'cache-hand',
    heroPlayerId: 'hero',
    decisions,
    completedHandResult: completedResult(),
    providerCacheKey: 'heuristic-options-a',
  };

  const first = projector.project({ ...input, replayProjection: replayProjection(3) });
  const moved = projector.project({
    ...input,
    selectedDecisionIndex: first.selectedDecisionIndex,
    replayProjection: replayProjection(9),
  });
  assert.equal(calls, 2);
  assert.equal(projector.getDiagnostics().resolutionCount, 2);
  assert.equal(moved.replay.synchronizedToSelectedDecision, false);
  projector.project({ ...input, providerCacheKey: 'heuristic-options-b' });
  assert.equal(calls, 4, 'a changed provider context invalidates only the review cache key');
});

test('comparison wording state and priority are source-gated rather than EV theater', () => {
  const projector = createHandReviewProjector();
  const review = projector.project({
    source: 'canonical_hand',
    handId: 'priority-hand',
    heroPlayerId: 'hero',
    decisions: [
      decision({
        ordinal: 0,
        eventSequence: 2,
        actionSequence: 0,
        chosenType: 'call',
        strategyResult: strategy([['raise', 0.7], ['call', 0.2], ['fold', 0.1]]),
      }),
      decision({
        ordinal: 1,
        eventSequence: 6,
        actionSequence: 3,
        chosenType: 'check',
        strategyResult: strategy([['check', 0.5], ['bet', 0.5]], 'heuristic_postflop'),
      }),
    ],
    completedHandResult: completedResult(),
    replayProjection: replayProjection(2),
  });

  assert.equal(review.priorityDecisionIndex, 0);
  assert.equal(review.selectedDecisionIndex, 0);
  assert.equal(review.decisions[0].comparison.semantics, 'heuristic_comparison');
  assert.equal(review.decisions[0].reviewPriority, null);
  assert.equal(review.decisions[0].source.coverage, 'generalized');
  assert.equal(review.decisions[0].source.exactFrequencies, false);
  assert.deepEqual(review.extensionSeam.comparisonRoles, [
    'reference',
    'personal_strategy',
    'observed_action',
  ]);
});

test('analysis handoff preserves the selected exact DecisionContext and truthful history boundary', () => {
  const projector = createHandReviewProjector();
  const review = projector.project({
    source: 'canonical_hand',
    handId: 'handoff-hand',
    heroPlayerId: 'hero',
    decisions: [decision({
      ordinal: 0,
      eventSequence: 5,
      actionSequence: 2,
      chosenType: 'call',
      strategyResult: strategy([['call', 0.55], ['fold', 0.45]]),
    })],
    completedHandResult: completedResult(),
    replayProjection: replayProjection(5),
  });
  const handoff = createHandReviewAnalysisHandoff(review, 0);
  assert.equal(handoff.schemaVersion, 'hand-review-analysis-handoff/v1');
  assert.equal(handoff.historyAvailability, 'exact_replay_point_only');
  assert.equal(handoff.decisionId, review.decisions[0].decisionId);
  assert.deepEqual(handoff.decisionContext, review.decisions[0].durable.decisionContext);
  assert.notEqual(handoff.decisionContext, review.decisions[0].durable.decisionContext);
});
