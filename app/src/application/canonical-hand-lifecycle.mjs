import {
  PHASES,
  POKER_STATE_SCHEMA_VERSION,
  POKER_STATE_V2_SCHEMA_VERSION,
  createGameRulesSnapshotFromLegacyGameConfiguration,
  getLegalActionSpec,
  playerById,
  validatePokerState,
} from '../../../shared/poker-domain/index.js';
import { deriveDecisionContextFromPokerState } from './decision-context-from-poker-state.mjs';
import {
  CANONICAL_HAND_REPLAY_SOURCE_SCHEMA_VERSION,
  CANONICAL_HAND_REPLAY_SOURCE_V2_SCHEMA_VERSION,
  REPLAY_FRAME_OPERATIONS,
  createCanonicalHandReplaySource,
  deriveCanonicalHandReplayEvent,
} from './canonical-hand-replay-source.mjs';
import {
  STRATEGY_PROVIDER_SCHEMA_VERSION,
} from './strategy-provider.mjs';
import { STRATEGY_SOURCES, isStrategyResultV1 } from './strategy-result.mjs';
import { evaluateTrainingAnswer } from './training-answer-evaluation.mjs';

export const COMPLETED_HAND_RESULT_SCHEMA_VERSION = 'canonical-completed-hand-result/v1';
export const HERO_DECISION_RECORD_SCHEMA_VERSION = 'hero-decision-record/v1';
export const HERO_DECISION_JOURNAL_SCHEMA_VERSION = 'hero-decision-journal/v1';
export const HERO_DECISION_EVALUATION_SCHEMA_VERSION = 'hero-decision-evaluation/v1';
export const CANONICAL_REPLAY_POINT_SCHEMA_VERSION = 'canonical-hand-replay-point/v1';

function deepFreeze(value) {
  if (!value || typeof value !== 'object') return value;
  if (!Object.isFrozen(value)) Object.freeze(value);
  Object.values(value).forEach(deepFreeze);
  return value;
}

function clone(value) {
  return structuredClone(value);
}

function frozenClone(value) {
  return deepFreeze(clone(value));
}

function dataEquals(left, right) {
  if (Object.is(left, right)) return true;
  if (!left || !right || typeof left !== 'object' || typeof right !== 'object') return false;
  if (Array.isArray(left) || Array.isArray(right)) {
    return Array.isArray(left) && Array.isArray(right)
      && left.length === right.length
      && left.every((entry, index) => dataEquals(entry, right[index]));
  }
  const leftKeys = Object.keys(left).sort();
  const rightKeys = Object.keys(right).sort();
  return leftKeys.length === rightKeys.length
    && leftKeys.every((key, index) => (
      key === rightKeys[index] && dataEquals(left[key], right[key])
    ));
}

function requireNonEmptyString(value, label) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new TypeError(`${label} is required`);
  }
  return value;
}

function sumRecord(record) {
  return Object.values(record).reduce((sum, amount) => sum + amount, 0);
}

function rulesSnapshotFromState(state) {
  if (state.schemaVersion === POKER_STATE_V2_SCHEMA_VERSION) return state.rulesSnapshot;
  if (state.schemaVersion !== POKER_STATE_SCHEMA_VERSION) {
    throw new TypeError(`Unsupported PokerState version: ${state.schemaVersion}`);
  }
  return createGameRulesSnapshotFromLegacyGameConfiguration({
    mode: state.game.mode,
    smallBlindMilliBb: state.game.smallBlindMilliBb,
    bigBlindMilliBb: state.game.bigBlindMilliBb,
    chipUnitMilliBb: state.game.chipUnitMilliBb,
    ante: state.game.ante,
  }, state.players.length);
}

function replaySourceSchemaVersionForState(state) {
  return state.schemaVersion === POKER_STATE_V2_SCHEMA_VERSION
    ? CANONICAL_HAND_REPLAY_SOURCE_V2_SCHEMA_VERSION
    : CANONICAL_HAND_REPLAY_SOURCE_SCHEMA_VERSION;
}

function recordByPlayer(players, project) {
  return Object.fromEntries(players.map((player) => [player.playerId, project(player)]));
}

function createCompletedHandResult({ state, events, initialBoundary }) {
  validatePokerState(state);
  if (state.phase !== PHASES.TERMINAL || state.terminal.isTerminal !== true) {
    throw new RangeError('CompletedHandResult requires a terminal canonical Hand');
  }
  if (!Array.isArray(events) || events.length === 0) {
    throw new RangeError('CompletedHandResult requires the exact canonical Replay events');
  }

  const rulesSnapshot = rulesSnapshotFromState(state);
  const initialStacksMilliBbByPlayer = recordByPlayer(
    state.players,
    (player) => player.startingStackMilliBb,
  );
  const finalStacksMilliBbByPlayer = recordByPlayer(
    state.players,
    (player) => player.currentStackMilliBb,
  );
  const stackDeltasMilliBbByPlayer = recordByPlayer(
    state.players,
    (player) => player.currentStackMilliBb - player.startingStackMilliBb,
  );
  const potContributionsMilliBbByPlayer = recordByPlayer(
    state.players,
    (player) => player.totalPotContributionMilliBb,
  );
  const deductionsMilliBbByPlayer = recordByPlayer(
    state.players,
    (player) => player.totalDeductionMilliBb,
  );
  const payoutsMilliBbByPlayer = clone(state.terminal.payoutsMilliBbByPlayer);
  const refundsMilliBbByPlayer = clone(state.terminal.refundsMilliBbByPlayer);
  const terminalEventSequence = events.length - 1;

  return deepFreeze({
    schemaVersion: COMPLETED_HAND_RESULT_SCHEMA_VERSION,
    handId: state.handId,
    pokerStateSchemaVersion: state.schemaVersion,
    rulesSnapshot,
    rulesSemanticFingerprint: rulesSnapshot.semanticFingerprint,
    participants: state.players.map((player) => ({
      playerId: player.playerId,
      seat: player.seat,
      position: player.position,
      dealtIn: player.dealtIn,
      folded: player.folded,
    })),
    initialStacksMilliBbByPlayer,
    finalStacksMilliBbByPlayer,
    stackDeltasMilliBbByPlayer,
    terminalReason: state.terminal.reason,
    terminal: clone(state.terminal),
    finalBoard: [...state.board],
    accounting: {
      initialStackTotalMilliBb: sumRecord(initialStacksMilliBbByPlayer),
      finalStackTotalMilliBb: sumRecord(finalStacksMilliBbByPlayer),
      finalPotMilliBb: state.potMilliBb,
      potContributionsMilliBbByPlayer,
      potContributionTotalMilliBb: sumRecord(potContributionsMilliBbByPlayer),
      deductionsMilliBbByPlayer,
      deductionTotalMilliBb: state.deductionTotalMilliBb,
      payoutsMilliBbByPlayer,
      payoutTotalMilliBb: sumRecord(payoutsMilliBbByPlayer),
      refundsMilliBbByPlayer,
      refundTotalMilliBb: sumRecord(refundsMilliBbByPlayer),
    },
    showdownResult: state.terminal.reason === 'showdown' ? clone(state.showdown) : null,
    replay: {
      sourceSchemaVersion: replaySourceSchemaVersionForState(state),
      eventSchemaVersion: events[0].schemaVersion,
      eventCount: events.length,
      events: [...events],
    },
    startBoundary: clone(initialBoundary),
    endBoundary: {
      replayEventSequence: terminalEventSequence,
      actionSequence: state.actionHistory.length,
      ledgerSequence: state.ledger.length,
      street: state.street,
      phase: state.phase,
    },
  });
}

function createDecisionRecord({ state, heroPlayerId, decisionOrdinal, eventSequence, options }) {
  const hero = playerById(state, heroPlayerId);
  const decisionContext = deriveDecisionContextFromPokerState(state, heroPlayerId, options);
  const legalActions = getLegalActionSpec(state);
  const rulesSnapshot = rulesSnapshotFromState(state);
  const callAmountMilliBb = legalActions.call.commitMilliBb;

  return deepFreeze({
    schemaVersion: HERO_DECISION_RECORD_SCHEMA_VERSION,
    decisionId: `${state.handId}:hero-decision:${decisionOrdinal}`,
    handId: state.handId,
    decisionOrdinal,
    street: state.street,
    occurrence: {
      occurred: true,
      replayPoint: {
        schemaVersion: CANONICAL_REPLAY_POINT_SCHEMA_VERSION,
        replaySourceSchemaVersion: replaySourceSchemaVersionForState(state),
        eventSequence,
        actionSequence: state.actionHistory.length,
      },
    },
    decisionContext: frozenClone(decisionContext),
    legalActions: frozenClone(legalActions),
    currentActor: {
      playerId: hero.playerId,
      seat: hero.seat,
      position: hero.position,
    },
    canonicalFacts: {
      potMilliBb: state.potMilliBb,
      currentBetMilliBb: state.currentBetMilliBb,
      callAmountMilliBb,
      heroStartingStackMilliBb: hero.startingStackMilliBb,
      heroCurrentStackMilliBb: hero.currentStackMilliBb,
      heroStreetContributionMilliBb: hero.streetContributionMilliBb,
      heroTotalPotContributionMilliBb: hero.totalPotContributionMilliBb,
      heroTotalDeductionMilliBb: hero.totalDeductionMilliBb,
    },
    heroCards: [...hero.holeCards],
    board: [...state.board],
    rulesSnapshot,
    rulesSemanticFingerprint: rulesSnapshot.semanticFingerprint,
    chosenAction: null,
    evaluation: null,
  });
}

function withChosenAction(record, action) {
  return deepFreeze({
    ...record,
    chosenAction: frozenClone(action),
  });
}

function withEvaluation(record, strategyProvider) {
  if (!strategyProvider || strategyProvider.schemaVersion !== STRATEGY_PROVIDER_SCHEMA_VERSION
    || typeof strategyProvider.resolve !== 'function') {
    throw new TypeError(`Hero decision evaluation requires ${STRATEGY_PROVIDER_SCHEMA_VERSION}`);
  }
  const strategyResult = strategyProvider.resolve(record.decisionContext);
  if (!isStrategyResultV1(strategyResult)) {
    throw new TypeError('Hero decision evaluation requires StrategyResult v1');
  }
  const answerEvaluation = strategyResult.source === STRATEGY_SOURCES.UNAVAILABLE
    ? null
    : evaluateTrainingAnswer({
      exerciseId: record.decisionId,
      chosenActionType: record.chosenAction.type,
      strategyResult,
      decisionContext: record.decisionContext,
    });

  return deepFreeze({
    ...record,
    evaluation: {
      schemaVersion: HERO_DECISION_EVALUATION_SCHEMA_VERSION,
      provider: {
        schemaVersion: strategyProvider.schemaVersion,
        resultSchemaVersion: strategyProvider.resultSchemaVersion,
      },
      source: strategyResult.source,
      modelVersion: strategyResult.modelVersion,
      strategyResult,
      answerEvaluation,
    },
  });
}

/**
 * Session-owned, storage-neutral lifecycle facts for one canonical Hand.
 * It records only successful canonical transitions and never resolves strategy
 * unless evaluateHeroDecision() is called explicitly.
 */
export function createCanonicalHandLifecycleRecorder() {
  let events = [];
  let decisions = [];
  let initialBoundary = null;
  let heroPlayerId = null;
  let decisionContextOptions = Object.freeze({});
  let completedHandResult = null;

  const currentReplaySequence = () => events.length - 1;

  const isHeroDecision = (state) => (
    heroPlayerId !== null
    && state.phase === PHASES.BETTING
    && !state.terminal.isTerminal
    && state.actingPlayerId === heroPlayerId
  );

  const decisionAtSequence = (records, eventSequence) => records.find((record) => (
    record.occurrence.replayPoint.eventSequence === eventSequence
  )) || null;

  const newDecision = (state, eventSequence, decisionOrdinal) => createDecisionRecord({
    state,
    heroPlayerId,
    decisionOrdinal,
    eventSequence,
    options: decisionContextOptions,
  });

  const captureDecision = (state) => {
    if (!isHeroDecision(state)) return null;
    const eventSequence = currentReplaySequence();
    const existing = decisionAtSequence(decisions, eventSequence);
    if (existing) return existing;
    const record = newDecision(state, eventSequence, decisions.length);
    decisions = [...decisions, record];
    return record;
  };

  const recorder = {
    reset() {
      events = [];
      decisions = [];
      initialBoundary = null;
      heroPlayerId = null;
      decisionContextOptions = Object.freeze({});
      completedHandResult = null;
    },

    start(state) {
      validatePokerState(state);
      const event = deriveCanonicalHandReplayEvent({
        sequence: 0,
        operation: REPLAY_FRAME_OPERATIONS.INITIALIZE_HAND,
        state,
      });
      events = [event];
      decisions = [];
      heroPlayerId = null;
      decisionContextOptions = Object.freeze({});
      completedHandResult = null;
      initialBoundary = deepFreeze({
        replayEventSequence: 0,
        actionSequence: state.actionHistory.length,
        ledgerSequence: state.ledger.length,
        street: state.street,
        phase: state.phase,
      });
      return event;
    },

    configureHero(state, { heroPlayerId: nextHeroPlayerId, decisionContextOptions: options = {} } = {}) {
      validatePokerState(state);
      requireNonEmptyString(state.handId, 'Canonical Hand handId');
      requireNonEmptyString(nextHeroPlayerId, 'heroPlayerId');
      if (!playerById(state, nextHeroPlayerId)) {
        throw new RangeError(`Unknown heroPlayerId: ${nextHeroPlayerId}`);
      }
      if (heroPlayerId !== null && heroPlayerId !== nextHeroPlayerId) {
        throw new RangeError('Canonical Hand Hero cannot change within one Hand');
      }
      if (!options || typeof options !== 'object' || Array.isArray(options)) {
        throw new TypeError('decisionContextOptions must be an object');
      }
      if (decisions.length > 0 && !dataEquals(options, decisionContextOptions)) {
        throw new RangeError('DecisionContext options cannot change after the first Hero decision');
      }
      heroPlayerId = nextHeroPlayerId;
      decisionContextOptions = frozenClone(options);
      return captureDecision(state);
    },

    captureCurrentHeroDecision(state) {
      validatePokerState(state);
      return captureDecision(state);
    },

    recordTransition({ previousState, state, operation } = {}) {
      validatePokerState(previousState);
      validatePokerState(state);
      if (completedHandResult !== null) {
        throw new RangeError('A completed canonical Hand cannot record another transition');
      }
      const event = deriveCanonicalHandReplayEvent({
        sequence: events.length,
        operation,
        previousState,
        state,
      });

      let nextDecisions = [...decisions];

      if (operation === REPLAY_FRAME_OPERATIONS.ACTION
        && heroPlayerId !== null && previousState.actingPlayerId === heroPlayerId) {
        let decision = decisionAtSequence(nextDecisions, currentReplaySequence());
        if (decision === null && isHeroDecision(previousState)) {
          decision = newDecision(
            previousState,
            currentReplaySequence(),
            nextDecisions.length,
          );
          nextDecisions.push(decision);
        }
        const index = nextDecisions.indexOf(decision);
        const canonicalAction = state.actionHistory.at(-1)?.submittedAction;
        if (index < 0 || !canonicalAction || canonicalAction.playerId !== heroPlayerId) {
          throw new RangeError('Hero action could not be matched to its decision boundary');
        }
        nextDecisions = nextDecisions.map((record, recordIndex) => (
          recordIndex === index ? withChosenAction(record, canonicalAction) : record
        ));
      }

      const nextEvents = [...events, event];
      if (isHeroDecision(state)
        && decisionAtSequence(nextDecisions, nextEvents.length - 1) === null) {
        nextDecisions.push(newDecision(state, nextEvents.length - 1, nextDecisions.length));
      }
      const nextCompletedHandResult = state.phase === PHASES.TERMINAL
        ? createCompletedHandResult({ state, events: nextEvents, initialBoundary })
        : null;
      events = nextEvents;
      decisions = nextDecisions;
      completedHandResult = nextCompletedHandResult;
      return event;
    },

    getHeroDecisionJournal(state) {
      if (heroPlayerId === null) return null;
      return deepFreeze({
        schemaVersion: HERO_DECISION_JOURNAL_SCHEMA_VERSION,
        handId: state.handId,
        heroPlayerId,
        status: completedHandResult === null ? 'open' : 'complete',
        terminalReplayEventSequence: completedHandResult === null
          ? null
          : completedHandResult.endBoundary.replayEventSequence,
        decisions: [...decisions],
      });
    },

    evaluateHeroDecision(state, { decisionOrdinal, strategyProvider } = {}) {
      validatePokerState(state);
      if (!Number.isSafeInteger(decisionOrdinal) || decisionOrdinal < 0) {
        throw new RangeError('decisionOrdinal must be a nonnegative safe integer');
      }
      const record = decisions[decisionOrdinal];
      if (!record || record.decisionOrdinal !== decisionOrdinal) {
        throw new RangeError(`Unknown Hero decision ordinal: ${decisionOrdinal}`);
      }
      if (record.chosenAction === null) {
        throw new RangeError('Hero decision must have a chosen canonical action before evaluation');
      }
      if (record.evaluation !== null) return record;
      const evaluated = withEvaluation(record, strategyProvider);
      decisions = decisions.map((candidate, index) => (
        index === decisionOrdinal ? evaluated : candidate
      ));
      return evaluated;
    },

    createCanonicalHandReplaySource() {
      if (events.length === 0 || heroPlayerId === null) return null;
      return createCanonicalHandReplaySource({ heroPlayerId, events });
    },

    getCompletedHandResult() {
      return completedHandResult;
    },
  };

  return Object.freeze(recorder);
}
