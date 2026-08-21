import {
  CHANCE_TYPES,
  HOLDEM_DECK,
  PHASES,
  isHiddenHoleCards,
  playerById,
  validatePokerState,
} from '../../../shared/poker-domain/index.js';
import { createCanonicalHandSession } from './canonical-hand-session.mjs';
import { createSeededRandom } from './deterministic-random.mjs';
import {
  BASELINE_OPPONENT_POLICY_ID,
  BASELINE_OPPONENT_POLICY_VERSION,
  applyOpponentPolicyAction,
  createBasicOpponentPolicy,
} from './opponent-policy.mjs';

export const AUTOMATED_OPPONENT_ASSIGNMENT_SCHEMA_VERSION =
  'automated-opponent-assignment/v1';
export const BOT_DECISION_RECORD_SCHEMA_VERSION = 'bot-decision-record/v1';
export const BOT_DECISION_JOURNAL_SCHEMA_VERSION = 'bot-decision-journal/v1';
export const AUTOMATED_HAND_CHANCE_PROVENANCE_SCHEMA_VERSION =
  'automated-hand-chance-provenance/v1';
export const AUTOMATED_HAND_PROGRESSION_RESULT_SCHEMA_VERSION =
  'automated-hand-progression-result/v1';
export const AUTOMATED_HAND_STEP_RESULT_SCHEMA_VERSION =
  'automated-hand-step-result/v1';
export const AUTOMATED_HAND_VISIBLE_EVENT_SCHEMA_VERSION =
  'automated-hand-visible-event/v1';
export const AUTOMATED_COMPLETED_HAND_RESULT_SCHEMA_VERSION =
  'automated-completed-hand-result/v1';

export const AUTOMATED_HAND_PROGRESSION_STATUSES = Object.freeze({
  ADVANCING: 'advancing',
  HERO_DECISION: 'hero_decision',
  TERMINAL: 'terminal',
  ERROR: 'error',
});

export const AUTOMATED_HAND_PROGRESSION_ERROR_CODES = Object.freeze({
  TRANSITION_LIMIT_EXCEEDED: 'transition_limit_exceeded',
  BOT_ASSIGNMENT_ACTOR_MISMATCH: 'bot_assignment_actor_mismatch',
  POLICY_RESOLUTION_FAILED: 'policy_resolution_failed',
  POLICY_TRANSITION_FAILED: 'policy_transition_failed',
  CHANCE_TRANSITION_FAILED: 'chance_transition_failed',
  SHOWDOWN_TRANSITION_FAILED: 'showdown_transition_failed',
  UNSUPPORTED_CANONICAL_PHASE: 'unsupported_canonical_phase',
  SESSION_STATE_DIVERGED: 'session_state_diverged',
});

const UINT32_MAX = 0xffffffff;
const DEFAULT_MAX_AUTOMATED_TRANSITIONS = 256;
const ASSIGNMENT_KEYS = Object.freeze([
  'archetype',
  'baseSeed',
  'config',
  'playerId',
  'policyId',
  'policyVersion',
  'schemaVersion',
  'seat',
]);

class AutomatedProgressionError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'AutomatedProgressionError';
    this.code = code;
    this.details = details;
  }
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
}

function frozenClone(value) {
  return deepFreeze(structuredClone(value));
}

function requireExactKeys(value, expectedKeys, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError(`${label} must be an object`);
  }
  const actualKeys = Object.keys(value).sort();
  if (actualKeys.length !== expectedKeys.length
    || actualKeys.some((key, index) => key !== expectedKeys[index])) {
    throw new RangeError(`${label} contains unsupported fields`);
  }
  return value;
}

function requireNonEmptyString(value, label) {
  if (typeof value !== 'string' || !value.trim()) throw new TypeError(`${label} is required`);
  return value;
}

function requireUint32(value, label) {
  if (!Number.isSafeInteger(value) || value < 0 || value > UINT32_MAX) {
    throw new RangeError(`${label} must be an unsigned 32-bit integer`);
  }
  return value >>> 0;
}

function avalanche32(value) {
  let hash = value >>> 0;
  hash ^= hash >>> 16;
  hash = Math.imul(hash, 0x7feb352d);
  hash ^= hash >>> 15;
  hash = Math.imul(hash, 0x846ca68b);
  hash ^= hash >>> 16;
  return hash >>> 0;
}

function deriveStableSeed(parts) {
  let hash = 0x811c9dc5;
  const serialized = parts.join('|');
  for (let index = 0; index < serialized.length; index += 1) {
    hash ^= serialized.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return avalanche32(hash);
}

function normalizeAssignment(assignment) {
  requireExactKeys(assignment, ASSIGNMENT_KEYS, 'Automated opponent assignment');
  if (assignment.schemaVersion !== AUTOMATED_OPPONENT_ASSIGNMENT_SCHEMA_VERSION) {
    throw new TypeError(`Expected ${AUTOMATED_OPPONENT_ASSIGNMENT_SCHEMA_VERSION}`);
  }
  requireNonEmptyString(assignment.playerId, 'Automated opponent playerId');
  if (!Number.isSafeInteger(assignment.seat) || assignment.seat < 0) {
    throw new RangeError('Automated opponent seat must be a nonnegative safe integer');
  }
  requireNonEmptyString(assignment.policyId, 'Automated opponent policyId');
  requireNonEmptyString(assignment.policyVersion, 'Automated opponent policyVersion');
  requireNonEmptyString(assignment.archetype, 'Automated opponent archetype');
  if (assignment.config !== null
    && (!assignment.config || typeof assignment.config !== 'object'
      || Array.isArray(assignment.config))) {
    throw new TypeError('Automated opponent config must be an object or null');
  }
  requireUint32(assignment.baseSeed, 'Automated opponent baseSeed');
  return frozenClone(assignment);
}

function normalizeAssignments(pokerState, heroPlayerId, assignments) {
  if (!Array.isArray(assignments)) throw new TypeError('opponentAssignments must be an array');
  const normalized = assignments.map(normalizeAssignment);
  const byPlayerId = new Map();
  const bySeat = new Map();
  for (const assignment of normalized) {
    if (assignment.playerId === heroPlayerId) {
      throw new RangeError('Hero cannot receive an automated opponent assignment');
    }
    if (byPlayerId.has(assignment.playerId) || bySeat.has(assignment.seat)) {
      throw new RangeError('Automated opponent assignments require unique players and seats');
    }
    const player = playerById(pokerState, assignment.playerId);
    if (!player || player.seat !== assignment.seat) {
      throw new RangeError('Automated opponent assignment must match a canonical Hand seat');
    }
    byPlayerId.set(assignment.playerId, assignment);
    bySeat.set(assignment.seat, assignment);
  }
  const expectedOpponents = pokerState.players.filter((player) => player.playerId !== heroPlayerId);
  if (normalized.length !== expectedOpponents.length
    || expectedOpponents.some((player) => !byPlayerId.has(player.playerId))) {
    throw new RangeError('Every non-Hero seat requires exactly one opponent assignment');
  }
  return Object.freeze(normalized);
}

function createSession({ session, initialConfiguration }) {
  if (session !== null && initialConfiguration !== undefined) {
    throw new RangeError('Supply either session or initialConfiguration, not both');
  }
  if (session !== null) return session;
  if (initialConfiguration === undefined) {
    throw new TypeError('session or initialConfiguration is required');
  }
  const created = createCanonicalHandSession();
  if (initialConfiguration?.rulesSnapshot) {
    created.initializeFromGameRulesSnapshot(initialConfiguration);
  } else {
    created.initialize(initialConfiguration);
  }
  return created;
}

function requireSession(session) {
  const methods = [
    'getState',
    'configureHero',
    'captureCurrentHeroDecision',
    'applyChance',
    'applyAction',
    'revealPrivateCards',
    'resolveShowdown',
    'getHeroDecisionJournal',
    'createCanonicalHandReplaySource',
    'getCompletedHandResult',
  ];
  if (!session || methods.some((method) => typeof session[method] !== 'function')) {
    throw new TypeError('Automated progression requires a CanonicalHandSession');
  }
  return session;
}

function requireFreshHandStart(state) {
  validatePokerState(state);
  if (state.phase !== PHASES.CHANCE
    || state.pendingChance?.type !== CHANCE_TYPES.DEAL_HOLE
    || state.actionHistory.length !== 0
    || state.board.length !== 0) {
    throw new RangeError('Automated progression must attach at the canonical deal-hole Hand boundary');
  }
}

function shuffledChanceSchedule(state, chanceSeed) {
  const deck = createSeededRandom(chanceSeed).shuffle(HOLDEM_DECK);
  const holeCardsByPlayer = Object.fromEntries(
    state.pendingChance.playerOrder.map((playerId) => [playerId, []]),
  );
  for (let round = 0; round < 2; round += 1) {
    for (const playerId of state.pendingChance.playerOrder) {
      holeCardsByPlayer[playerId].push(deck.shift());
    }
  }
  return { deck, holeCardsByPlayer };
}

function defaultPolicyResolver(assignment, basicPolicy) {
  if (assignment.policyId !== BASELINE_OPPONENT_POLICY_ID
    || assignment.policyVersion !== BASELINE_OPPONENT_POLICY_VERSION
    || assignment.archetype !== 'basic') {
    throw new RangeError(
      `Unknown built-in opponent policy: ${assignment.policyId}@${assignment.policyVersion}`,
    );
  }
  return basicPolicy;
}

function errorDetails(error) {
  return deepFreeze({
    name: error instanceof Error ? error.name : 'Error',
    message: error instanceof Error ? error.message : String(error),
  });
}

/**
 * Creates the v1 assignment set. Every non-Hero seat uses the existing basic
 * OpponentPolicy, with an independent deterministic base seed.
 */
export function createBasicOpponentAssignments({ pokerState, heroPlayerId, handSeed } = {}) {
  validatePokerState(pokerState);
  requireNonEmptyString(heroPlayerId, 'heroPlayerId');
  if (!playerById(pokerState, heroPlayerId)) throw new RangeError(`Unknown heroPlayerId: ${heroPlayerId}`);
  const normalizedHandSeed = requireUint32(handSeed, 'handSeed');
  return Object.freeze(pokerState.players
    .filter((player) => player.playerId !== heroPlayerId)
    .map((player) => deepFreeze({
      schemaVersion: AUTOMATED_OPPONENT_ASSIGNMENT_SCHEMA_VERSION,
      playerId: player.playerId,
      seat: player.seat,
      policyId: BASELINE_OPPONENT_POLICY_ID,
      policyVersion: BASELINE_OPPONENT_POLICY_VERSION,
      archetype: 'basic',
      config: null,
      baseSeed: deriveStableSeed([
        AUTOMATED_OPPONENT_ASSIGNMENT_SCHEMA_VERSION,
        `hand-seed:${normalizedHandSeed}`,
        `seat:${player.seat}`,
        BASELINE_OPPONENT_POLICY_ID,
        BASELINE_OPPONENT_POLICY_VERSION,
      ]),
    })));
}

/**
 * Owns only automated application orchestration. CanonicalHandSession remains
 * the state, Replay, Hero-decision, and completed-Hand authority.
 */
export function createAutomatedHandProgression({
  session: suppliedSession = null,
  initialConfiguration,
  heroPlayerId,
  handSeed,
  chanceSeed = null,
  opponentAssignments = null,
  policyResolver = null,
  decisionContextOptions = {},
  maxAutomatedTransitions = DEFAULT_MAX_AUTOMATED_TRANSITIONS,
} = {}) {
  const session = requireSession(createSession({
    session: suppliedSession,
    initialConfiguration,
  }));
  const initialState = session.getState();
  requireFreshHandStart(initialState);
  requireNonEmptyString(heroPlayerId, 'heroPlayerId');
  if (!playerById(initialState, heroPlayerId)) throw new RangeError(`Unknown heroPlayerId: ${heroPlayerId}`);
  const normalizedHandSeed = requireUint32(handSeed, 'handSeed');
  const normalizedChanceSeed = chanceSeed === null
    ? deriveStableSeed([
      AUTOMATED_HAND_CHANCE_PROVENANCE_SCHEMA_VERSION,
      `hand-seed:${normalizedHandSeed}`,
      'stream:physical-cards',
    ])
    : requireUint32(chanceSeed, 'chanceSeed');
  if (!Number.isSafeInteger(maxAutomatedTransitions) || maxAutomatedTransitions < 1) {
    throw new RangeError('maxAutomatedTransitions must be a positive safe integer');
  }

  const assignments = normalizeAssignments(
    initialState,
    heroPlayerId,
    opponentAssignments ?? createBasicOpponentAssignments({
      pokerState: initialState,
      heroPlayerId,
      handSeed: normalizedHandSeed,
    }),
  );
  session.configureHero({ heroPlayerId, decisionContextOptions });
  const assignmentsByPlayerId = new Map(
    assignments.map((assignment) => [assignment.playerId, assignment]),
  );
  const basicPolicy = createBasicOpponentPolicy();
  const resolvePolicy = policyResolver === null
    ? (assignment) => defaultPolicyResolver(assignment, basicPolicy)
    : policyResolver;
  if (typeof resolvePolicy !== 'function') throw new TypeError('policyResolver must be a function');

  const schedule = shuffledChanceSchedule(initialState, normalizedChanceSeed);
  const chanceProvenance = deepFreeze({
    schemaVersion: AUTOMATED_HAND_CHANCE_PROVENANCE_SCHEMA_VERSION,
    handSeed: normalizedHandSeed,
    chanceSeed: normalizedChanceSeed,
    deckAuthority: 'holdem-deck',
    deckSize: HOLDEM_DECK.length,
    schedulePolicy: 'seeded-fisher-yates-round-robin/v1',
  });
  const seatDecisionOrdinals = new Map(assignments.map((assignment) => [assignment.seat, 0]));
  let botDecisions = [];
  let automatedTransitionCount = 0;
  let failedResult = null;
  let terminalResult = null;

  const journal = () => {
    const state = session.getState();
    const status = failedResult !== null ? 'error'
      : state.phase === PHASES.TERMINAL ? 'complete' : 'open';
    return deepFreeze({
      schemaVersion: BOT_DECISION_JOURNAL_SCHEMA_VERSION,
      handId: state.handId,
      heroPlayerId,
      status,
      handSeed: normalizedHandSeed,
      chanceSeed: normalizedChanceSeed,
      assignments: [...assignments],
      decisions: [...botDecisions],
    });
  };

  const completedAutomatedHand = () => {
    const canonicalResult = session.getCompletedHandResult();
    if (canonicalResult === null) return null;
    return deepFreeze({
      schemaVersion: AUTOMATED_COMPLETED_HAND_RESULT_SCHEMA_VERSION,
      canonicalResult,
      botDecisionJournal: journal(),
      chanceProvenance,
    });
  };

  const result = (status, error = null) => Object.freeze({
    schemaVersion: AUTOMATED_HAND_PROGRESSION_RESULT_SCHEMA_VERSION,
    status,
    state: session.getState(),
    session,
    automatedTransitionCount,
    botDecisionJournal: journal(),
    chanceProvenance,
    completedHand: completedAutomatedHand(),
    error,
  });

  const stepResult = (status, event = null, error = null) => Object.freeze({
    schemaVersion: AUTOMATED_HAND_STEP_RESULT_SCHEMA_VERSION,
    status,
    event,
    state: session.getState(),
    automatedTransitionCount,
    error,
  });

  const fail = (code, message, details = {}) => {
    const error = deepFreeze({ code, message, details: frozenClone(details) });
    // Mark failure before projecting the journal so the returned snapshot is
    // terminal for automation and cannot look like a retryable open journal.
    failedResult = Object.freeze({ pending: true });
    failedResult = result(AUTOMATED_HAND_PROGRESSION_STATUSES.ERROR, error);
    return failedResult;
  };

  const requireTransitionBudget = () => {
    if (automatedTransitionCount >= maxAutomatedTransitions) {
      throw new AutomatedProgressionError(
        AUTOMATED_HAND_PROGRESSION_ERROR_CODES.TRANSITION_LIMIT_EXCEEDED,
        `Automated Hand exceeded its ${maxAutomatedTransitions}-transition limit`,
        { maxAutomatedTransitions, automatedTransitionCount },
      );
    }
  };

  const recordTransition = (transition) => {
    requireTransitionBudget();
    transition();
    automatedTransitionCount += 1;
  };

  const dealPendingChance = (state) => {
    const pendingChanceType = state.pendingChance?.type ?? null;
    const boardCountBefore = state.board.length;
    try {
      if (state.pendingChance?.type === CHANCE_TYPES.DEAL_HOLE) {
        recordTransition(() => session.applyChance({
          type: CHANCE_TYPES.DEAL_HOLE,
          cardsByPlayer: { [heroPlayerId]: schedule.holeCardsByPlayer[heroPlayerId] },
          hiddenPlayerIds: state.players
            .filter((player) => player.playerId !== heroPlayerId)
            .map((player) => player.playerId),
        }));
        const nextState = session.getState();
        return deepFreeze({
          schemaVersion: AUTOMATED_HAND_VISIBLE_EVENT_SCHEMA_VERSION,
          kind: 'chance',
          transitionKind: 'private_deal',
          pendingChanceType,
          actor: null,
          chosenAction: null,
          streetBefore: state.street,
          streetAfter: nextState.street,
          boardCardIds: [],
        });
      }
      const pending = state.pendingChance;
      if (!pending || !Number.isSafeInteger(pending.cardCount) || pending.cardCount < 1) {
        throw new AutomatedProgressionError(
          AUTOMATED_HAND_PROGRESSION_ERROR_CODES.CHANCE_TRANSITION_FAILED,
          'Canonical chance phase has no supported pending chance event',
          { pendingChance: pending ?? null },
        );
      }
      requireTransitionBudget();
      const cards = schedule.deck.splice(0, pending.cardCount);
      if (cards.length !== pending.cardCount) {
        throw new AutomatedProgressionError(
          AUTOMATED_HAND_PROGRESSION_ERROR_CODES.CHANCE_TRANSITION_FAILED,
          'Deterministic Hand deck was exhausted',
          { requestedCards: pending.cardCount, remainingCards: cards.length },
        );
      }
      recordTransition(() => session.applyChance({ type: pending.type, cards }));
      const nextState = session.getState();
      const transitionKind = {
        [CHANCE_TYPES.DEAL_FLOP]: 'flop_deal',
        [CHANCE_TYPES.DEAL_TURN]: 'turn_deal',
        [CHANCE_TYPES.DEAL_RIVER]: 'river_deal',
      }[pending.type];
      return deepFreeze({
        schemaVersion: AUTOMATED_HAND_VISIBLE_EVENT_SCHEMA_VERSION,
        kind: 'chance',
        transitionKind,
        pendingChanceType,
        actor: null,
        chosenAction: null,
        streetBefore: state.street,
        streetAfter: nextState.street,
        boardCardIds: nextState.board.slice(boardCountBefore),
      });
    } catch (error) {
      if (error instanceof AutomatedProgressionError) throw error;
      throw new AutomatedProgressionError(
        AUTOMATED_HAND_PROGRESSION_ERROR_CODES.CHANCE_TRANSITION_FAILED,
        'Canonical chance application failed',
        { error: errorDetails(error) },
      );
    }
  };

  const finishShowdown = (state) => {
    try {
      const hiddenLivePlayer = state.players.find((player) => (
        player.dealtIn && !player.folded && isHiddenHoleCards(player.holeCards)
      ));
      if (hiddenLivePlayer) {
        const cards = schedule.holeCardsByPlayer[hiddenLivePlayer.playerId];
        if (!cards) {
          throw new AutomatedProgressionError(
            AUTOMATED_HAND_PROGRESSION_ERROR_CODES.SHOWDOWN_TRANSITION_FAILED,
            'Deterministic hole cards are unavailable for a live showdown player',
            { playerId: hiddenLivePlayer.playerId },
          );
        }
        recordTransition(() => session.revealPrivateCards({
          playerId: hiddenLivePlayer.playerId,
          cards,
        }));
        return deepFreeze({
          schemaVersion: AUTOMATED_HAND_VISIBLE_EVENT_SCHEMA_VERSION,
          kind: 'showdown',
          transitionKind: 'private_reveal',
          pendingChanceType: null,
          actor: {
            playerId: hiddenLivePlayer.playerId,
            seat: hiddenLivePlayer.seat,
            position: hiddenLivePlayer.position,
          },
          chosenAction: null,
          streetBefore: state.street,
          streetAfter: session.getState().street,
          boardCardIds: [],
        });
      }
      recordTransition(() => session.resolveShowdown());
      return deepFreeze({
        schemaVersion: AUTOMATED_HAND_VISIBLE_EVENT_SCHEMA_VERSION,
        kind: 'showdown',
        transitionKind: 'showdown_resolution',
        pendingChanceType: null,
        actor: null,
        chosenAction: null,
        streetBefore: state.street,
        streetAfter: session.getState().street,
        boardCardIds: [],
      });
    } catch (error) {
      if (error instanceof AutomatedProgressionError) throw error;
      throw new AutomatedProgressionError(
        AUTOMATED_HAND_PROGRESSION_ERROR_CODES.SHOWDOWN_TRANSITION_FAILED,
        'Canonical showdown reveal or settlement failed',
        { error: errorDetails(error) },
      );
    }
  };

  const applyBotAction = (state) => {
    const actor = playerById(state, state.actingPlayerId);
    const assignment = assignmentsByPlayerId.get(state.actingPlayerId);
    if (!actor || !assignment || actor.seat !== assignment.seat) {
      throw new AutomatedProgressionError(
        AUTOMATED_HAND_PROGRESSION_ERROR_CODES.BOT_ASSIGNMENT_ACTOR_MISMATCH,
        'Current non-Hero actor has no matching opponent assignment',
        { actingPlayerId: state.actingPlayerId },
      );
    }
    let policy;
    try {
      policy = resolvePolicy(assignment);
      if (policy?.policyId !== assignment.policyId
        || policy?.policyVersion !== assignment.policyVersion) {
        throw new RangeError('Resolved opponent policy ID/version must match its assignment');
      }
    } catch (error) {
      throw new AutomatedProgressionError(
        AUTOMATED_HAND_PROGRESSION_ERROR_CODES.POLICY_RESOLUTION_FAILED,
        'Opponent policy resolution failed',
        { assignment, error: errorDetails(error) },
      );
    }
    const seatDecisionOrdinal = seatDecisionOrdinals.get(actor.seat);
    const replaySourceBefore = session.createCanonicalHandReplaySource();
    const canonicalActionOrdinal = state.actionHistory.length;
    const replayEventOrdinal = replaySourceBefore.events.length;
    const decisionSeed = deriveStableSeed([
      BOT_DECISION_RECORD_SCHEMA_VERSION,
      `hand-seed:${normalizedHandSeed}`,
      `base-seed:${assignment.baseSeed}`,
      `seat:${actor.seat}`,
      `seat-decision:${seatDecisionOrdinal}`,
      `canonical-action:${canonicalActionOrdinal}`,
      `replay-event:${replayEventOrdinal}`,
      assignment.policyId,
      assignment.policyVersion,
    ]);

    let transition;
    try {
      requireTransitionBudget();
      transition = applyOpponentPolicyAction({ session, policy, decisionSeed });
      automatedTransitionCount += 1;
    } catch (error) {
      if (error instanceof AutomatedProgressionError) throw error;
      throw new AutomatedProgressionError(
        AUTOMATED_HAND_PROGRESSION_ERROR_CODES.POLICY_TRANSITION_FAILED,
        'Opponent policy action failed canonical validation or application',
        { assignment, decisionSeed, error: errorDetails(error) },
      );
    }

    const replaySourceAfter = session.createCanonicalHandReplaySource();
    const record = deepFreeze({
      schemaVersion: BOT_DECISION_RECORD_SCHEMA_VERSION,
      decisionOrdinal: botDecisions.length,
      seatDecisionOrdinal,
      actor: {
        playerId: actor.playerId,
        seat: actor.seat,
        position: actor.position,
      },
      policyId: assignment.policyId,
      policyVersion: assignment.policyVersion,
      archetype: assignment.archetype,
      baseSeed: assignment.baseSeed,
      decisionSeed,
      chosenAction: transition.decision.action,
      sizingProvenance: transition.decision.sizingMetadata,
      selectionProvenance: transition.decision.selectionMetadata,
      policyProvenance: transition.decision.provenance,
      replayReference: {
        replaySourceSchemaVersion: replaySourceAfter.schemaVersion,
        replayEventSequence: replaySourceAfter.events.length - 1,
        canonicalActionHistoryIndex: transition.state.actionHistory.length - 1,
      },
    });
    botDecisions = [...botDecisions, record];
    seatDecisionOrdinals.set(actor.seat, seatDecisionOrdinal + 1);
    return deepFreeze({
      schemaVersion: AUTOMATED_HAND_VISIBLE_EVENT_SCHEMA_VERSION,
      kind: 'bot_action',
      transitionKind: 'action',
      pendingChanceType: null,
      actor: record.actor,
      chosenAction: record.chosenAction,
      streetBefore: state.street,
      streetAfter: transition.state.street,
      boardCardIds: [],
    });
  };

  const validatedState = () => {
    const state = session.getState();
    validatePokerState(state);
    if (state.handId !== initialState.handId) {
      throw new AutomatedProgressionError(
        AUTOMATED_HAND_PROGRESSION_ERROR_CODES.SESSION_STATE_DIVERGED,
        'CanonicalHandSession changed to a different Hand',
        { expectedHandId: initialState.handId, actualHandId: state.handId },
      );
    }
    return state;
  };

  const boundaryResult = (state) => {
    if (state.phase === PHASES.TERMINAL) {
      terminalResult = result(AUTOMATED_HAND_PROGRESSION_STATUSES.TERMINAL);
      return terminalResult;
    }
    if (state.phase === PHASES.BETTING && state.actingPlayerId === heroPlayerId) {
      session.captureCurrentHeroDecision();
      return result(AUTOMATED_HAND_PROGRESSION_STATUSES.HERO_DECISION);
    }
    return null;
  };

  const advanceOneTransition = (state) => {
    if (state.phase === PHASES.CHANCE) return dealPendingChance(state);
    if (state.phase === PHASES.SHOWDOWN) return finishShowdown(state);
    if (state.phase === PHASES.BETTING) return applyBotAction(state);
    throw new AutomatedProgressionError(
      AUTOMATED_HAND_PROGRESSION_ERROR_CODES.UNSUPPORTED_CANONICAL_PHASE,
      `Unsupported canonical Hand phase: ${state.phase}`,
      { phase: state.phase },
    );
  };

  const controller = {
    getSession() {
      return session;
    },

    getOpponentAssignments() {
      return assignments;
    },

    getBotDecisionJournal() {
      return journal();
    },

    getChanceProvenance() {
      return chanceProvenance;
    },

    getCompletedHandResult() {
      return session.getCompletedHandResult();
    },

    getCompletedAutomatedHandResult() {
      return completedAutomatedHand();
    },

    applyHeroAction(action) {
      if (failedResult !== null) {
        throw new RangeError('Cannot apply a Hero action after automated progression failed');
      }
      const state = session.getState();
      if (state.phase === PHASES.TERMINAL) {
        throw new RangeError('Cannot apply a Hero action after terminal');
      }
      if (state.phase !== PHASES.BETTING || state.actingPlayerId !== heroPlayerId) {
        throw new RangeError('Hero action requires the configured Hero to be the current actor');
      }
      if (action?.playerId !== heroPlayerId) {
        throw new RangeError('Hero action must identify the configured Hero');
      }
      return session.applyAction(action);
    },

    advanceOneAutomatedEvent() {
      if (failedResult !== null) {
        return stepResult(
          AUTOMATED_HAND_PROGRESSION_STATUSES.ERROR,
          null,
          failedResult.error,
        );
      }
      if (terminalResult !== null) {
        return stepResult(AUTOMATED_HAND_PROGRESSION_STATUSES.TERMINAL);
      }
      try {
        const state = validatedState();
        const boundary = boundaryResult(state);
        if (boundary !== null) return stepResult(boundary.status, null, boundary.error);
        const event = advanceOneTransition(state);
        return stepResult(AUTOMATED_HAND_PROGRESSION_STATUSES.ADVANCING, event);
      } catch (error) {
        const failed = error instanceof AutomatedProgressionError
          ? fail(error.code, error.message, error.details)
          : fail(
            AUTOMATED_HAND_PROGRESSION_ERROR_CODES.SESSION_STATE_DIVERGED,
            'Automated Hand progression failed unexpectedly',
            { error: errorDetails(error) },
          );
        return stepResult(AUTOMATED_HAND_PROGRESSION_STATUSES.ERROR, null, failed.error);
      }
    },

    advanceUntilHeroOrTerminal() {
      if (failedResult !== null) return failedResult;
      if (terminalResult !== null) return terminalResult;
      try {
        while (true) {
          const state = validatedState();
          const boundary = boundaryResult(state);
          if (boundary !== null) return boundary;
          advanceOneTransition(state);
        }
      } catch (error) {
        if (error instanceof AutomatedProgressionError) {
          return fail(error.code, error.message, error.details);
        }
        return fail(
          AUTOMATED_HAND_PROGRESSION_ERROR_CODES.SESSION_STATE_DIVERGED,
          'Automated Hand progression failed unexpectedly',
          { error: errorDetails(error) },
        );
      }
    },
  };

  return Object.freeze(controller);
}

export function advanceAutomatedHandUntilHeroOrTerminal(progression) {
  if (!progression || typeof progression.advanceUntilHeroOrTerminal !== 'function') {
    throw new TypeError('advanceAutomatedHandUntilHeroOrTerminal requires automated progression');
  }
  return progression.advanceUntilHeroOrTerminal();
}
