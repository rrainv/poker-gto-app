import { motionIntentForExperienceEvent } from './experience-motion.mjs';

export const EXPERIENCE_EVENT_SCHEMA_VERSION = 'experience-event/v1';
export const EXPERIENCE_EVENTS_SCHEMA_VERSION = 'experience-events/v1';

export const EXPERIENCE_EVENT_FAMILIES = Object.freeze({
  POKER_WORLD: 'poker_world',
  STUDY: 'study',
});

export const STUDY_AUDIO_MEANINGS = Object.freeze({
  POSITIVE: 'positive',
  NEUTRAL: 'neutral',
  CORRECTIVE: 'corrective',
});

export const EXPERIENCE_EVENT_ORIGINS = Object.freeze({
  LIVE: 'live',
  REPLAY_PLAYBACK: 'replay_playback',
  DIRECT_SEEK: 'direct_seek',
  INITIAL_RENDER: 'initial_render',
  HYDRATION: 'hydration',
  REVIEW_SELECTION: 'review_selection',
});

export const EXPERIENCE_EVENT_TYPES = Object.freeze({
  CARD_DEALT: 'card_dealt',
  BOARD_REVEALED: 'board_revealed',
  HOLE_CARDS_REVEALED: 'hole_cards_revealed',
  ACTION_FOLD: 'action_fold',
  ACTION_CHECK: 'action_check',
  ACTION_CALL: 'action_call',
  ACTION_BET: 'action_bet',
  ACTION_RAISE: 'action_raise',
  ACTION_ALL_IN: 'action_all_in',
  CHIPS_COMMITTED: 'chips_committed',
  POT_COLLECTED: 'pot_collected',
  POT_AWARDED: 'pot_awarded',
  ACTOR_CHANGED: 'actor_changed',
  STREET_ADVANCED: 'street_advanced',
  SHOWDOWN_STARTED: 'showdown_started',
  HAND_COMPLETED: 'hand_completed',
  DECISION_SUBMITTED: 'decision_submitted',
  REFERENCE_COMPARISON_REVEALED: 'reference_comparison_revealed',
  REVIEW_DECISION_SELECTED: 'review_decision_selected',
  SESSION_STARTED: 'session_started',
  REPLAY_STARTED: 'replay_started',
  REPLAY_PAUSED: 'replay_paused',
});

const POKER_EVENT_TYPES = new Set([
  EXPERIENCE_EVENT_TYPES.CARD_DEALT,
  EXPERIENCE_EVENT_TYPES.BOARD_REVEALED,
  EXPERIENCE_EVENT_TYPES.HOLE_CARDS_REVEALED,
  EXPERIENCE_EVENT_TYPES.ACTION_FOLD,
  EXPERIENCE_EVENT_TYPES.ACTION_CHECK,
  EXPERIENCE_EVENT_TYPES.ACTION_CALL,
  EXPERIENCE_EVENT_TYPES.ACTION_BET,
  EXPERIENCE_EVENT_TYPES.ACTION_RAISE,
  EXPERIENCE_EVENT_TYPES.ACTION_ALL_IN,
  EXPERIENCE_EVENT_TYPES.CHIPS_COMMITTED,
  EXPERIENCE_EVENT_TYPES.POT_COLLECTED,
  EXPERIENCE_EVENT_TYPES.POT_AWARDED,
  EXPERIENCE_EVENT_TYPES.ACTOR_CHANGED,
  EXPERIENCE_EVENT_TYPES.STREET_ADVANCED,
  EXPERIENCE_EVENT_TYPES.SHOWDOWN_STARTED,
  EXPERIENCE_EVENT_TYPES.HAND_COMPLETED,
]);

const ACTION_EVENT_TYPES = Object.freeze({
  fold: EXPERIENCE_EVENT_TYPES.ACTION_FOLD,
  check: EXPERIENCE_EVENT_TYPES.ACTION_CHECK,
  call: EXPERIENCE_EVENT_TYPES.ACTION_CALL,
  bet: EXPERIENCE_EVENT_TYPES.ACTION_BET,
  raise: EXPERIENCE_EVENT_TYPES.ACTION_RAISE,
  all_in: EXPERIENCE_EVENT_TYPES.ACTION_ALL_IN,
});

const SUPPRESSED_POKER_ORIGINS = new Set([
  EXPERIENCE_EVENT_ORIGINS.DIRECT_SEEK,
  EXPERIENCE_EVENT_ORIGINS.INITIAL_RENDER,
  EXPERIENCE_EVENT_ORIGINS.HYDRATION,
  EXPERIENCE_EVENT_ORIGINS.REVIEW_SELECTION,
]);

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value)) deepFreeze(child);
  return value;
}

function isDeeplyFrozen(value) {
  if (!value || typeof value !== 'object') return true;
  if (!Object.isFrozen(value)) return false;
  return Object.values(value).every(isDeeplyFrozen);
}

function immutableValue(value) {
  if (value === null || value === undefined || isDeeplyFrozen(value)) return value;
  return deepFreeze(structuredClone(value));
}

function requireEnum(value, source, label) {
  if (!Object.values(source).includes(value)) {
    throw new RangeError(`Unsupported ${label}: ${String(value)}`);
  }
}

function eventFamily(type) {
  return POKER_EVENT_TYPES.has(type)
    ? EXPERIENCE_EVENT_FAMILIES.POKER_WORLD
    : EXPERIENCE_EVENT_FAMILIES.STUDY;
}

export function createExperienceEvent({
  type,
  origin,
  source,
  token,
  ordinal = 0,
  payload = {},
} = {}) {
  requireEnum(type, EXPERIENCE_EVENT_TYPES, 'experience event type');
  requireEnum(origin, EXPERIENCE_EVENT_ORIGINS, 'experience event origin');
  if (typeof source !== 'string' || !source.trim()) {
    throw new TypeError('Experience event source is required');
  }
  if ((!Number.isSafeInteger(token) && typeof token !== 'string') || String(token).length === 0) {
    throw new TypeError('Experience event token must be a non-empty string or safe integer');
  }
  if (!Number.isSafeInteger(ordinal) || ordinal < 0) {
    throw new RangeError('Experience event ordinal must be a nonnegative safe integer');
  }
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new TypeError('Experience event payload must be an object');
  }
  const family = eventFamily(type);
  return deepFreeze({
    schemaVersion: EXPERIENCE_EVENT_SCHEMA_VERSION,
    eventId: `${source}:${String(token)}:${ordinal}:${type}`,
    family,
    type,
    origin,
    source: source.trim(),
    token,
    ordinal,
    payload: immutableValue(payload),
  });
}

function createBatch({ origin, source, token, descriptors }) {
  const events = descriptors.map((descriptor, ordinal) => createExperienceEvent({
    ...descriptor,
    origin,
    source,
    token,
    ordinal,
  }));
  return deepFreeze({
    schemaVersion: EXPERIENCE_EVENTS_SCHEMA_VERSION,
    origin,
    source,
    token,
    events,
  });
}

function transitionOperation(operation, transitionKind) {
  if (operation) return operation;
  return {
    private_deal: 'deal_hole',
    private_reveal: 'reveal_hole',
    flop_deal: 'deal_board',
    turn_deal: 'deal_board',
    river_deal: 'deal_board',
    showdown_resolution: 'showdown',
  }[transitionKind] || transitionKind;
}

function terminalState(state) {
  return state?.phase === 'terminal' || state?.terminal?.isTerminal === true;
}

function actorContribution(motion, actorPlayerId) {
  const change = motion?.seatChanges?.find((entry) => entry.playerId === actorPlayerId);
  if (!change?.contribution?.changed) return null;
  const previous = change.contribution.previousMilliBb;
  const next = change.contribution.nextMilliBb;
  if (!Number.isSafeInteger(previous) || !Number.isSafeInteger(next) || next <= previous) return null;
  return Object.freeze({
    previousMilliBb: previous,
    nextMilliBb: next,
    deltaMilliBb: next - previous,
    visualSeatIndex: change.visualSeatIndex,
  });
}

function sharedPayload({
  operation,
  transitionKind,
  motion,
  actorPlayerId,
  actionType,
  boardCardIds,
  previousState,
  state,
  winnerPlayerIds,
  frameIndex,
  replaySpeed,
}) {
  return {
    operation,
    transitionKind,
    frameIndex: Number.isSafeInteger(frameIndex) ? frameIndex : null,
    replaySpeed: Number.isFinite(replaySpeed) && replaySpeed > 0 ? replaySpeed : 1,
    actorPlayerId: actorPlayerId ?? null,
    nextActorPlayerId: motion?.nextActorPlayerId ?? state?.actingPlayerId ?? null,
    actionType: actionType ?? null,
    boardCardIds: [...(boardCardIds || [])],
    streetBefore: previousState?.street ?? null,
    streetAfter: state?.street ?? null,
    terminalReason: state?.terminal?.reason ?? null,
    winnerPlayerIds: [...(winnerPlayerIds ?? state?.terminal?.winnerPlayerIds ?? [])],
    motion: motion ?? null,
  };
}

/**
 * Select presentation events from one already-completed canonical transition.
 * This function never mutates or advances PokerState.
 */
export function createPokerWorldExperienceEvents({
  origin = EXPERIENCE_EVENT_ORIGINS.LIVE,
  source = 'canonical_hand',
  token,
  operation = null,
  transitionKind = null,
  motion = null,
  previousState = null,
  state = null,
  actorPlayerId = null,
  actionType = null,
  boardCardIds = [],
  holeCardCount = null,
  frameIndex = null,
  replaySpeed = 1,
  winnerPlayerIds = null,
  streetClosedOverride = false,
  streetAdvancedOverride = false,
  showdownStartedOverride = false,
  terminalOverride = false,
  potAwardedOverride = false,
} = {}) {
  requireEnum(origin, EXPERIENCE_EVENT_ORIGINS, 'experience event origin');
  if ((!Number.isSafeInteger(token) && typeof token !== 'string') || String(token).length === 0) {
    throw new TypeError('A transition token is required');
  }
  if (SUPPRESSED_POKER_ORIGINS.has(origin)) {
    return createBatch({ origin, source, token, descriptors: [] });
  }

  const resolvedOperation = transitionOperation(operation, transitionKind);
  const resolvedActor = actorPlayerId ?? motion?.actorPlayerId ?? previousState?.actingPlayerId ?? null;
  const common = sharedPayload({
    operation: resolvedOperation,
    transitionKind,
    motion,
    actorPlayerId: resolvedActor,
    actionType,
    boardCardIds,
    previousState,
    state,
    winnerPlayerIds,
    frameIndex,
    replaySpeed,
  });
  const descriptors = [];
  const push = (type, payload = {}) => descriptors.push({
    type,
    payload: { ...common, ...payload },
  });

  if (resolvedOperation === 'deal_hole' || resolvedOperation === 'deal_hole_observed') {
    push(EXPERIENCE_EVENT_TYPES.CARD_DEALT, {
      cardCount: Number.isSafeInteger(holeCardCount) && holeCardCount > 0 ? holeCardCount : null,
    });
  } else if (resolvedOperation === 'reveal_hole') {
    push(EXPERIENCE_EVENT_TYPES.HOLE_CARDS_REVEALED);
  } else if (resolvedOperation === 'deal_board') {
    push(EXPERIENCE_EVENT_TYPES.BOARD_REVEALED, { cardCount: boardCardIds.length });
    if (streetAdvancedOverride || previousState?.street !== state?.street) {
      push(EXPERIENCE_EVENT_TYPES.STREET_ADVANCED);
    }
  } else if (resolvedOperation === 'action') {
    const actionEventType = ACTION_EVENT_TYPES[actionType];
    if (!actionEventType) throw new RangeError(`Unsupported semantic poker action: ${String(actionType)}`);
    push(actionEventType);
    const contribution = actorContribution(motion, resolvedActor);
    if (contribution) push(EXPERIENCE_EVENT_TYPES.CHIPS_COMMITTED, { contribution });
  }

  const streetClosed = streetClosedOverride || (previousState?.phase === 'betting'
    && state?.phase === 'chance'
    && state?.pendingChance?.type !== 'deal_hole');
  if (streetClosed) push(EXPERIENCE_EVENT_TYPES.POT_COLLECTED);

  if (motion?.nextActorPlayerId && motion.nextActorPlayerId !== resolvedActor) {
    push(EXPERIENCE_EVENT_TYPES.ACTOR_CHANGED);
  }
  if (showdownStartedOverride
    || (previousState?.phase !== 'showdown' && state?.phase === 'showdown')) {
    push(EXPERIENCE_EVENT_TYPES.SHOWDOWN_STARTED);
  }
  if (terminalOverride || (!terminalState(previousState) && terminalState(state))) {
    if (potAwardedOverride || (state?.terminal?.winnerPlayerIds || []).length > 0) {
      push(EXPERIENCE_EVENT_TYPES.POT_AWARDED);
    }
    push(EXPERIENCE_EVENT_TYPES.HAND_COMPLETED);
  }

  return createBatch({ origin, source, token, descriptors });
}

export function createStudyExperienceEvent({
  type,
  origin = EXPERIENCE_EVENT_ORIGINS.LIVE,
  source = 'training',
  token,
  payload = {},
} = {}) {
  if (POKER_EVENT_TYPES.has(type)) {
    throw new RangeError('Study feedback cannot use a poker-world event type');
  }
  return createExperienceEvent({ type, origin, source, token, payload });
}

export function trainingStudyAudioMeaning({ comparisonState, feedbackSemantics } = {}) {
  if (!['comparative', 'normative'].includes(feedbackSemantics)) return null;
  return {
    optimal: STUDY_AUDIO_MEANINGS.POSITIVE,
    acceptable: STUDY_AUDIO_MEANINGS.NEUTRAL,
    mistake: STUDY_AUDIO_MEANINGS.CORRECTIVE,
  }[comparisonState] || null;
}

export function installExperienceEventsBridge(browserWindow) {
  if (!browserWindow) return null;
  if (browserWindow.RiverlineExperienceEvents?.schemaVersion === EXPERIENCE_EVENTS_SCHEMA_VERSION) {
    return browserWindow.RiverlineExperienceEvents;
  }
  const rememberedIds = new Set();
  const rememberedOrder = [];
  const remember = (eventId) => {
    if (rememberedIds.has(eventId)) return false;
    rememberedIds.add(eventId);
    rememberedOrder.push(eventId);
    while (rememberedOrder.length > 256) rememberedIds.delete(rememberedOrder.shift());
    return true;
  };

  const emit = (event) => {
    if (event?.schemaVersion !== EXPERIENCE_EVENT_SCHEMA_VERSION) {
      throw new TypeError(`Expected ${EXPERIENCE_EVENT_SCHEMA_VERSION}`);
    }
    if (!remember(event.eventId)) return Object.freeze({ accepted: false, reason: 'duplicate' });
    browserWindow.SoundFX?.consumeExperienceEvent?.(event);
    const reducedMotion = browserWindow.matchMedia?.('(prefers-reduced-motion: reduce)')
      ?.matches === true;
    const motion = motionIntentForExperienceEvent(event, { reducedMotion });
    if (typeof browserWindow.dispatchEvent === 'function'
      && typeof browserWindow.CustomEvent === 'function') {
      browserWindow.dispatchEvent(new browserWindow.CustomEvent(
        'riverline:experience-event',
        { detail: { event, motion } },
      ));
    }
    return Object.freeze({ accepted: true, reason: null, event, motion });
  };

  const bridge = Object.freeze({
    schemaVersion: EXPERIENCE_EVENTS_SCHEMA_VERSION,
    emit,
    emitBatch(batch) {
      if (batch?.schemaVersion !== EXPERIENCE_EVENTS_SCHEMA_VERSION) {
        throw new TypeError(`Expected ${EXPERIENCE_EVENTS_SCHEMA_VERSION}`);
      }
      return Object.freeze(batch.events.map(emit));
    },
    emitStudy(input) {
      return emit(createStudyExperienceEvent(input));
    },
    emitTrainingDecisionResult({
      origin = EXPERIENCE_EVENT_ORIGINS.LIVE,
      source = 'training_decision',
      token,
      comparisonState,
      feedbackSemantics,
      chosenActionType,
      accepted,
    } = {}) {
      return emit(createStudyExperienceEvent({
        type: EXPERIENCE_EVENT_TYPES.DECISION_SUBMITTED,
        origin,
        source,
        token,
        payload: {
          comparisonState,
          feedbackSemantics,
          studyAudioMeaning: trainingStudyAudioMeaning({ comparisonState, feedbackSemantics }),
          accepted: accepted === true,
          chosenActionType: chosenActionType ?? null,
        },
      }));
    },
    emitPokerAction({
      origin = EXPERIENCE_EVENT_ORIGINS.LIVE,
      source = 'training_decision',
      token,
      actionType,
    } = {}) {
      const batch = createPokerWorldExperienceEvents({
        origin,
        source,
        token,
        operation: 'action',
        transitionKind: 'action',
        actionType,
      });
      return Object.freeze(batch.events.map(emit));
    },
  });
  Object.defineProperty(browserWindow, 'RiverlineExperienceEvents', {
    configurable: true,
    enumerable: false,
    value: bridge,
    writable: false,
  });
  return bridge;
}

if (typeof window !== 'undefined') installExperienceEventsBridge(window);
