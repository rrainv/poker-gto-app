import {
  ACTION_TYPES,
  applyAction as previewCanonicalAction,
  bbToMilliBb,
  createAction,
  validateGameRulesSnapshot,
} from '../../../shared/poker-domain/index.js';
import {
  AUTOMATED_HAND_PROGRESSION_STATUSES,
  createAutomatedHandProgression,
} from './automated-hand-progression.mjs';
import { createCanonicalHandSession } from './canonical-hand-session.mjs';
import {
  STRATEGY_PROVIDER_SCHEMA_VERSION,
} from './strategy-provider.mjs';
import { isStrategyResultV1 } from './strategy-result.mjs';
import { evaluateTrainingAnswer } from './training-answer-evaluation.mjs';
import {
  TRAINING_CONFIG_V2_SCHEMA_VERSION,
  createTrainingConfig,
  resolveTrainingRulesCapability,
} from './training-generator.mjs';
import {
  PLAYBOOK_SCENARIO_V2_SCHEMA_VERSION,
  createPlaybookScenarioInput,
} from './playbook-state-source.mjs';

export const FULL_HAND_TRAINING_SESSION_SCHEMA_VERSION =
  'full-hand-training-session/v1';
export const FULL_HAND_TRAINING_REVIEW_SCHEMA_VERSION =
  'full-hand-training-review/v1';
export const FULL_HAND_TRAINING_ERROR_SCHEMA_VERSION =
  'full-hand-training-error/v1';
export const FULL_HAND_TRAINING_ANALYSIS_HANDOFF_SCHEMA_VERSION =
  'full-hand-training-analysis-handoff/v1';

export const FULL_HAND_TRAINING_PROGRESSION_MODES = Object.freeze({
  FAST: 'fast',
  STEPWISE: 'stepwise',
});

export const FULL_HAND_TRAINING_STATUSES = Object.freeze({
  IDLE: 'idle',
  ADVANCING: 'advancing',
  AWAITING_HERO: 'awaiting_hero',
  GRADING: 'grading',
  TERMINAL: 'terminal',
  ERROR: 'error',
});

export const FULL_HAND_TRAINING_ERROR_CODES = Object.freeze({
  INVALID_CONFIGURATION: 'invalid_configuration',
  UNSUPPORTED_RULES: 'unsupported_rules',
  NOT_READY: 'not_ready',
  STALE_DECISION: 'stale_decision',
  STALE_EVALUATION: 'stale_evaluation',
  ILLEGAL_ACTION: 'illegal_action',
  STRATEGY_EVALUATION_FAILED: 'strategy_evaluation_failed',
  PROGRESSION_FAILED: 'progression_failed',
});

const UINT32_MAX = 0xffffffff;
const ACTION_TYPE_VALUES = new Set(Object.values(ACTION_TYPES));
const SIZED_ACTIONS = new Set([ACTION_TYPES.BET, ACTION_TYPES.RAISE]);

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
}

function serializedError(error) {
  return deepFreeze({
    name: error instanceof Error ? error.name : 'Error',
    message: error instanceof Error ? error.message : String(error),
  });
}

function failure(code, message, details = {}, snapshot = null) {
  return deepFreeze({
    ok: false,
    error: {
      schemaVersion: FULL_HAND_TRAINING_ERROR_SCHEMA_VERSION,
      code,
      message,
      details: { ...details },
    },
    snapshot,
  });
}

function requireUint32(value, label) {
  if (!Number.isSafeInteger(value) || value < 0 || value > UINT32_MAX) {
    throw new RangeError(`${label} must be an unsigned 32-bit integer`);
  }
  return value >>> 0;
}

function requireStrategyProvider(strategyProvider) {
  if (!strategyProvider
    || strategyProvider.schemaVersion !== STRATEGY_PROVIDER_SCHEMA_VERSION
    || typeof strategyProvider.resolve !== 'function') {
    throw new TypeError(`Full-Hand Training requires ${STRATEGY_PROVIDER_SCHEMA_VERSION}`);
  }
  return strategyProvider;
}

function normalizeStartInput(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new TypeError('Full-Hand Training start configuration is required');
  }
  const handSeed = requireUint32(input.handSeed, 'handSeed');
  const handConfiguration = input.handConfiguration;
  if (!handConfiguration || typeof handConfiguration !== 'object'
    || Array.isArray(handConfiguration)) {
    throw new TypeError('handConfiguration is required');
  }
  const rulesSnapshot = validateGameRulesSnapshot(handConfiguration.rulesSnapshot);
  if (!Array.isArray(handConfiguration.players)) {
    throw new TypeError('handConfiguration.players must be an array');
  }
  const hasHeroSeat = input.heroSeat !== undefined
    && input.heroSeat !== null
    && input.heroSeat !== '';
  const heroSeat = hasHeroSeat ? Number(input.heroSeat) : null;
  if (heroSeat !== null && (!Number.isSafeInteger(heroSeat) || heroSeat < 0)) {
    throw new RangeError('heroSeat must be a nonnegative safe integer');
  }
  const heroPosition = typeof input.heroPosition === 'string' && input.heroPosition.trim()
    ? input.heroPosition.trim()
    : null;
  if (heroSeat === null && heroPosition === null) {
    throw new TypeError('heroSeat or heroPosition is required');
  }
  const decisionContextOptions = input.decisionContextOptions ?? {};
  if (!decisionContextOptions || typeof decisionContextOptions !== 'object'
    || Array.isArray(decisionContextOptions)) {
    throw new TypeError('decisionContextOptions must be an object');
  }
  return {
    handSeed,
    handConfiguration: {
      ...structuredClone(handConfiguration),
      rulesSnapshot,
    },
    heroSeat,
    heroPosition,
    decisionContextOptions: structuredClone(decisionContextOptions),
  };
}

function normalizeHeroAction(actionInput, heroPlayerId) {
  if (!actionInput || typeof actionInput !== 'object' || Array.isArray(actionInput)) {
    throw new TypeError('A canonical Hero action choice is required');
  }
  if (!ACTION_TYPE_VALUES.has(actionInput.type)) {
    throw new RangeError(`Unsupported Hero action type: ${actionInput.type}`);
  }
  if (actionInput.playerId !== undefined && actionInput.playerId !== heroPlayerId) {
    throw new RangeError('Hero action player does not match the active Full-Hand session');
  }
  const amountToMilliBb = SIZED_ACTIONS.has(actionInput.type)
    ? actionInput.amountToMilliBb
    : null;
  return createAction(heroPlayerId, actionInput.type, amountToMilliBb);
}

function gradeCounts(decisions) {
  const counts = { optimal: 0, acceptable: 0, mistake: 0 };
  for (const decision of decisions) {
    const grade = decision.evaluation?.answerEvaluation?.grade;
    if (Object.hasOwn(counts, grade)) counts[grade] += 1;
  }
  return deepFreeze(counts);
}

function createReview({ journal, replaySource, botDecisionJournal, completedHandResult }) {
  if (!journal || !replaySource) return null;
  const decisions = journal.decisions.map((decision) => deepFreeze({
    schemaVersion: decision.schemaVersion,
    decisionId: decision.decisionId,
    handId: decision.handId,
    decisionOrdinal: decision.decisionOrdinal,
    street: decision.street,
    replayPoint: decision.occurrence.replayPoint,
    decisionContext: decision.decisionContext,
    currentActor: decision.currentActor,
    canonicalFacts: decision.canonicalFacts,
    heroCards: decision.heroCards,
    board: decision.board,
    rulesSnapshot: decision.rulesSnapshot,
    rulesSemanticFingerprint: decision.rulesSemanticFingerprint,
    chosenAction: decision.chosenAction,
    chosenActionResult: decision.chosenActionResult,
    legalActions: decision.legalActions,
    strategyResult: decision.evaluation?.strategyResult ?? null,
    grade: decision.evaluation?.answerEvaluation?.grade ?? null,
    evaluation: decision.evaluation,
  }));
  return deepFreeze({
    schemaVersion: FULL_HAND_TRAINING_REVIEW_SCHEMA_VERSION,
    handId: journal.handId,
    heroPlayerId: journal.heroPlayerId,
    status: completedHandResult === null ? 'open' : 'ready',
    replaySource,
    decisions,
    botDecisionJournal,
    completedHandResult,
  });
}

export function createFullHandTrainingAnalysisHandoff(review, decisionOrdinal) {
  if (!review || review.schemaVersion !== FULL_HAND_TRAINING_REVIEW_SCHEMA_VERSION
    || review.status !== 'ready') {
    throw new TypeError('A ready Full-Hand Training review is required');
  }
  if (!Number.isSafeInteger(decisionOrdinal) || decisionOrdinal < 0) {
    throw new RangeError('decisionOrdinal must be a nonnegative safe integer');
  }
  const decision = review.decisions[decisionOrdinal];
  if (!decision || decision.decisionOrdinal !== decisionOrdinal) {
    throw new RangeError(`Unknown Full-Hand review decision ordinal: ${decisionOrdinal}`);
  }
  const context = decision.decisionContext;
  const scenarioInput = createPlaybookScenarioInput({
    schemaVersion: PLAYBOOK_SCENARIO_V2_SCHEMA_VERSION,
    rulesSnapshot: decision.rulesSnapshot,
    tableSize: context.tableSize,
    heroPosition: context.heroPosition,
    street: context.street,
    heroCards: [...context.heroCards],
    board: [...context.board],
    deadCards: [...context.deadCards],
    stackBb: context.stackBb,
    stackMode: context.stackMode,
    potBb: context.currentPotBb ?? context.potBb,
    lastAction: context.lastAction,
    lastActionLabel: null,
    facingSizeBb: context.facingSizeBb,
  });
  return deepFreeze({
    schemaVersion: FULL_HAND_TRAINING_ANALYSIS_HANDOFF_SCHEMA_VERSION,
    derivation: 'canonical_full_hand_decision',
    historyAvailability: 'exact_replay_point_only',
    decisionId: decision.decisionId,
    decisionOrdinal,
    replayPoint: decision.replayPoint,
    decisionContext: context,
    rulesSnapshot: decision.rulesSnapshot,
    scenarioInput,
  });
}

function initialSnapshot() {
  return deepFreeze({
    schemaVersion: FULL_HAND_TRAINING_SESSION_SCHEMA_VERSION,
    status: FULL_HAND_TRAINING_STATUSES.IDLE,
    sessionId: null,
    requestId: null,
    handSeed: null,
    heroSeat: null,
    heroPlayerId: null,
    opponentAssignments: [],
    state: null,
    currentDecision: null,
    answeredDecisions: [],
    lastEvaluation: null,
    gradeCounts: { optimal: 0, acceptable: 0, mistake: 0 },
    completedHandResult: null,
    automatedCompletedHandResult: null,
    botDecisionJournal: null,
    chanceProvenance: null,
    replaySource: null,
    summary: {
      decisionsAnswered: 0,
      gradeCounts: { optimal: 0, acceptable: 0, mistake: 0 },
      chosenActions: [],
      replayReferences: [],
    },
    review: null,
    error: null,
  });
}

export function createFullHandTrainingStartConfigurationFromTrainingConfig({
  trainingConfig,
  handSeed,
  heroPosition = null,
  handId = null,
} = {}) {
  const config = createTrainingConfig(trainingConfig);
  if (config.schemaVersion !== TRAINING_CONFIG_V2_SCHEMA_VERSION) {
    throw new TypeError('Full-Hand Training requires training-config/v2');
  }
  const normalizedSeed = requireUint32(handSeed, 'handSeed');
  const selectedHeroPosition = heroPosition ?? config.heroPositions[0];
  if (!config.heroPositions.includes(selectedHeroPosition)) {
    throw new RangeError('Full-Hand Hero position must belong to the Training configuration');
  }
  const normalizedHandId = handId ?? `training-full-hand-${normalizedSeed}`;
  if (typeof normalizedHandId !== 'string' || !normalizedHandId.trim()) {
    throw new TypeError('handId must be a non-empty string');
  }
  const startingStackMilliBb = bbToMilliBb(config.stackBb, 'stackBb');
  return deepFreeze({
    handSeed: normalizedSeed,
    heroPosition: selectedHeroPosition,
    handConfiguration: {
      handId: normalizedHandId,
      rulesSnapshot: config.rulesSnapshot,
      buttonSeat: 0,
      players: Array.from({ length: config.tableSize }, (_, seat) => ({
        playerId: `training-seat-${seat}`,
        seat,
        startingStackMilliBb,
      })),
    },
    decisionContextOptions: { stackMode: 'hero' },
  });
}

export function createFullHandTrainingSessionController({
  createProgression = createAutomatedHandProgression,
  evaluateAnswer = evaluateTrainingAnswer,
} = {}) {
  if (typeof createProgression !== 'function') {
    throw new TypeError('createProgression must be a function');
  }
  if (typeof evaluateAnswer !== 'function') {
    throw new TypeError('evaluateAnswer must be a function');
  }

  let sequence = 0;
  let operationSequence = 0;
  let snapshot = initialSnapshot();
  let progression = null;
  let strategyProvider = null;
  let sessionId = null;
  let handSeed = null;
  let heroSeat = null;
  let heroPlayerId = null;
  let currentDecisionOrdinal = null;
  let lastEvaluation = null;
  let progressionMode = FULL_HAND_TRAINING_PROGRESSION_MODES.FAST;

  const projection = (status, { requestId = null, error = null } = {}) => {
    if (progression === null) {
      snapshot = deepFreeze({
        ...initialSnapshot(),
        status,
        sessionId,
        requestId,
        handSeed,
        heroSeat,
        heroPlayerId,
        error,
      });
      return snapshot;
    }
    const session = progression.getSession();
    const state = session.getState();
    const journal = session.getHeroDecisionJournal();
    const answeredDecisions = journal.decisions.filter((decision) => (
      decision.chosenAction !== null && decision.evaluation !== null
    ));
    const counts = gradeCounts(answeredDecisions);
    const currentDecision = currentDecisionOrdinal === null
      ? null
      : journal.decisions[currentDecisionOrdinal] ?? null;
    const completedHandResult = progression.getCompletedHandResult();
    const automatedCompletedHandResult = progression.getCompletedAutomatedHandResult();
    const botDecisionJournal = progression.getBotDecisionJournal();
    const replaySource = session.createCanonicalHandReplaySource();
    const review = createReview({
      journal,
      replaySource,
      botDecisionJournal,
      completedHandResult,
    });
    snapshot = deepFreeze({
      schemaVersion: FULL_HAND_TRAINING_SESSION_SCHEMA_VERSION,
      status,
      sessionId,
      requestId,
      handSeed,
      heroSeat,
      heroPlayerId,
      opponentAssignments: progression.getOpponentAssignments(),
      state,
      currentDecision,
      answeredDecisions,
      lastEvaluation,
      gradeCounts: counts,
      completedHandResult,
      automatedCompletedHandResult,
      botDecisionJournal,
      chanceProvenance: progression.getChanceProvenance(),
      replaySource,
      summary: {
        decisionsAnswered: answeredDecisions.length,
        gradeCounts: counts,
        chosenActions: answeredDecisions.map((decision) => decision.chosenAction),
        replayReferences: answeredDecisions.map(
          (decision) => decision.occurrence.replayPoint,
        ),
      },
      review,
      error,
    });
    return snapshot;
  };

  const progressionFailure = (result) => {
    currentDecisionOrdinal = null;
    const error = deepFreeze({
      schemaVersion: FULL_HAND_TRAINING_ERROR_SCHEMA_VERSION,
      code: FULL_HAND_TRAINING_ERROR_CODES.PROGRESSION_FAILED,
      message: 'Canonical bot/chance progression failed.',
      details: { progressionError: result?.error ?? null },
    });
    projection(FULL_HAND_TRAINING_STATUSES.ERROR, { error });
    return failure(error.code, error.message, error.details, snapshot);
  };

  const acceptProgressionResult = (result) => {
    if (result.status === AUTOMATED_HAND_PROGRESSION_STATUSES.ERROR) {
      return progressionFailure(result);
    }
    if (result.status === AUTOMATED_HAND_PROGRESSION_STATUSES.TERMINAL) {
      currentDecisionOrdinal = null;
      projection(FULL_HAND_TRAINING_STATUSES.TERMINAL);
      return deepFreeze({ ok: true, snapshot });
    }
    if (result.status !== AUTOMATED_HAND_PROGRESSION_STATUSES.HERO_DECISION) {
      return progressionFailure({
        error: { code: 'unknown_progression_status', status: result.status },
      });
    }
    const journal = progression.getSession().getHeroDecisionJournal();
    const decision = journal.decisions.at(-1);
    if (!decision || decision.chosenAction !== null) {
      return progressionFailure({
        error: { code: 'missing_hero_decision_boundary' },
      });
    }
    currentDecisionOrdinal = decision.decisionOrdinal;
    projection(FULL_HAND_TRAINING_STATUSES.AWAITING_HERO);
    return deepFreeze({ ok: true, snapshot });
  };

  const setControllerError = (code, message, details) => {
    const error = deepFreeze({
      schemaVersion: FULL_HAND_TRAINING_ERROR_SCHEMA_VERSION,
      code,
      message,
      details: { ...details },
    });
    projection(FULL_HAND_TRAINING_STATUSES.ERROR, { error });
    return failure(code, message, details, snapshot);
  };

  const controller = {
    start(input, {
      strategyProvider: suppliedStrategyProvider,
      progressionMode: suppliedProgressionMode = FULL_HAND_TRAINING_PROGRESSION_MODES.FAST,
    } = {}) {
      sequence += 1;
      operationSequence += 1;
      progression = null;
      strategyProvider = null;
      sessionId = null;
      handSeed = null;
      heroSeat = null;
      heroPlayerId = null;
      currentDecisionOrdinal = null;
      lastEvaluation = null;
      progressionMode = FULL_HAND_TRAINING_PROGRESSION_MODES.FAST;

      let normalized;
      try {
        normalized = normalizeStartInput(input);
        strategyProvider = requireStrategyProvider(suppliedStrategyProvider);
        if (!Object.values(FULL_HAND_TRAINING_PROGRESSION_MODES).includes(suppliedProgressionMode)) {
          throw new RangeError(`Unsupported Full-Hand progression mode: ${suppliedProgressionMode}`);
        }
        progressionMode = suppliedProgressionMode;
        handSeed = normalized.handSeed;
        const capability = resolveTrainingRulesCapability(
          normalized.handConfiguration.rulesSnapshot,
          { tableSize: normalized.handConfiguration.players.length },
        );
        if (!capability.supported) {
          return setControllerError(
            FULL_HAND_TRAINING_ERROR_CODES.UNSUPPORTED_RULES,
            'The supplied Game Rules are outside current Training support.',
            { reasonCode: capability.reasonCode, capability },
          );
        }

        const session = createCanonicalHandSession();
        const initialized = session.initializeFromGameRulesSnapshot(
          normalized.handConfiguration,
        );
        const hero = normalized.heroSeat === null
          ? initialized.players.find((player) => player.position === normalized.heroPosition)
          : initialized.players.find((player) => player.seat === normalized.heroSeat);
        if (!hero) {
          throw new RangeError(normalized.heroSeat === null
            ? `heroPosition ${normalized.heroPosition} is not seated in this Hand`
            : `heroSeat ${normalized.heroSeat} is not seated in this Hand`);
        }
        heroSeat = hero.seat;
        heroPlayerId = hero.playerId;
        sessionId = `full-hand-training-${sequence}:${initialized.handId}`;
        progression = createProgression({
          session,
          heroPlayerId,
          handSeed,
          decisionContextOptions: normalized.decisionContextOptions,
        });
        projection(FULL_HAND_TRAINING_STATUSES.ADVANCING);
        if (progressionMode === FULL_HAND_TRAINING_PROGRESSION_MODES.STEPWISE) {
          return deepFreeze({ ok: true, snapshot });
        }
        return acceptProgressionResult(progression.advanceUntilHeroOrTerminal());
      } catch (error) {
        return setControllerError(
          FULL_HAND_TRAINING_ERROR_CODES.INVALID_CONFIGURATION,
          'Full-Hand Training could not start from the supplied configuration.',
          { error: serializedError(error) },
        );
      }
    },

    async answer(decisionId, actionInput) {
      if (snapshot.status !== FULL_HAND_TRAINING_STATUSES.AWAITING_HERO
        || progression === null || currentDecisionOrdinal === null) {
        return failure(
          FULL_HAND_TRAINING_ERROR_CODES.NOT_READY,
          'No Full-Hand Hero decision is awaiting an answer.',
          {},
          snapshot,
        );
      }
      const decision = snapshot.currentDecision;
      if (decision?.decisionId !== decisionId) {
        return failure(
          FULL_HAND_TRAINING_ERROR_CODES.STALE_DECISION,
          'The answer belongs to an older Full-Hand Hero decision.',
          { expectedDecisionId: decision?.decisionId ?? null, decisionId },
          snapshot,
        );
      }

      let action;
      try {
        action = normalizeHeroAction(actionInput, heroPlayerId);
        previewCanonicalAction(progression.getSession().getState(), action);
      } catch (error) {
        return failure(
          FULL_HAND_TRAINING_ERROR_CODES.ILLEGAL_ACTION,
          'The selected action is not legal at this canonical Hero boundary.',
          { actionInput: structuredClone(actionInput), error: serializedError(error) },
          snapshot,
        );
      }

      const activeSequence = sequence;
      const activeProgression = progression;
      const activeDecisionOrdinal = currentDecisionOrdinal;
      const requestId = `full-hand-evaluation-${++operationSequence}`;
      try {
        activeProgression.applyHeroAction(action);
        projection(FULL_HAND_TRAINING_STATUSES.GRADING, { requestId });
      } catch (error) {
        return failure(
          FULL_HAND_TRAINING_ERROR_CODES.ILLEGAL_ACTION,
          'The selected action could not be applied at this canonical Hero boundary.',
          { actionInput: structuredClone(actionInput), error: serializedError(error) },
          snapshot,
        );
      }

      let strategyResult;
      try {
        // Let presentation consumers paint the already-applied canonical action
        // before the reference resolver and automatic continuation run.
        await Promise.resolve();
        if (sequence !== activeSequence || progression !== activeProgression) {
          return failure(
            FULL_HAND_TRAINING_ERROR_CODES.STALE_EVALUATION,
            'A newer Full-Hand session replaced this evaluation.',
            { requestId },
            snapshot,
          );
        }
        strategyResult = await Promise.resolve(
          strategyProvider.resolve(decision.decisionContext),
        );
      } catch (error) {
        if (sequence !== activeSequence || progression !== activeProgression) {
          return failure(
            FULL_HAND_TRAINING_ERROR_CODES.STALE_EVALUATION,
            'A newer Full-Hand session replaced this evaluation.',
            { requestId },
            snapshot,
          );
        }
        return setControllerError(
          FULL_HAND_TRAINING_ERROR_CODES.STRATEGY_EVALUATION_FAILED,
          'StrategyProvider could not evaluate the Hero decision.',
          { error: serializedError(error) },
        );
      }

      if (sequence !== activeSequence || progression !== activeProgression
        || snapshot.requestId !== requestId
        || snapshot.status !== FULL_HAND_TRAINING_STATUSES.GRADING) {
        return failure(
          FULL_HAND_TRAINING_ERROR_CODES.STALE_EVALUATION,
          'A newer Full-Hand session replaced this evaluation.',
          { requestId },
          snapshot,
        );
      }

      let answerEvaluation;
      try {
        if (!isStrategyResultV1(strategyResult)) {
          throw new TypeError('Full-Hand Training requires StrategyResult v1');
        }
        answerEvaluation = evaluateAnswer({
          exerciseId: decision.decisionId,
          chosenActionType: action.type,
          chosenAction: action,
          strategyResult,
          decisionContext: decision.decisionContext,
        });
        const evaluatedDecision = activeProgression.getSession().attachHeroDecisionEvaluation({
          decisionOrdinal: activeDecisionOrdinal,
          strategyProvider,
          strategyResult,
          answerEvaluation,
        });
        currentDecisionOrdinal = null;
        lastEvaluation = evaluatedDecision.evaluation;
        projection(FULL_HAND_TRAINING_STATUSES.ADVANCING);
        if (progressionMode === FULL_HAND_TRAINING_PROGRESSION_MODES.STEPWISE) {
          return deepFreeze({
            ok: true,
            evaluation: answerEvaluation,
            decision: evaluatedDecision,
            snapshot,
          });
        }
        const progressionResult = acceptProgressionResult(
          activeProgression.advanceUntilHeroOrTerminal(),
        );
        if (!progressionResult.ok) return progressionResult;
        return deepFreeze({
          ok: true,
          evaluation: answerEvaluation,
          decision: evaluatedDecision,
          snapshot,
        });
      } catch (error) {
        return setControllerError(
          FULL_HAND_TRAINING_ERROR_CODES.STRATEGY_EVALUATION_FAILED,
          'The Hero answer could not be graded and applied canonically.',
          { error: serializedError(error) },
        );
      }
    },

    advanceOneAutomatedEvent() {
      if (snapshot.status !== FULL_HAND_TRAINING_STATUSES.ADVANCING
        || progression === null) {
        return failure(
          FULL_HAND_TRAINING_ERROR_CODES.NOT_READY,
          'Full-Hand automated progression is not awaiting a presentation step.',
          {},
          snapshot,
        );
      }
      const step = progression.advanceOneAutomatedEvent();
      if (step.status === AUTOMATED_HAND_PROGRESSION_STATUSES.ADVANCING) {
        projection(FULL_HAND_TRAINING_STATUSES.ADVANCING);
        return deepFreeze({ ok: true, event: step.event, snapshot });
      }
      return acceptProgressionResult(step);
    },

    getSnapshot() {
      return snapshot;
    },

    getReview() {
      return snapshot.review;
    },

    createAnalysisHandoff(decisionOrdinal) {
      return createFullHandTrainingAnalysisHandoff(snapshot.review, decisionOrdinal);
    },

    reset() {
      sequence += 1;
      operationSequence += 1;
      progression = null;
      strategyProvider = null;
      sessionId = null;
      handSeed = null;
      heroSeat = null;
      heroPlayerId = null;
      currentDecisionOrdinal = null;
      lastEvaluation = null;
      progressionMode = FULL_HAND_TRAINING_PROGRESSION_MODES.FAST;
      snapshot = initialSnapshot();
      return snapshot;
    },
  };

  return Object.freeze(controller);
}
