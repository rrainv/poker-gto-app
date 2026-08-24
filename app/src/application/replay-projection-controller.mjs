import { createReplayTimelineViewModel } from './replay-timeline-view-model.mjs';
import { createTablePresenceViewModel } from './table-presence-view-model.mjs';
import {
  REPLAY_FRAME_OPERATIONS,
  createCanonicalHandReplaySource,
  deriveCanonicalHandReplayEvent,
  reconstructCanonicalHandReplaySource,
} from './canonical-hand-replay-source.mjs';

export { REPLAY_FRAME_OPERATIONS } from './canonical-hand-replay-source.mjs';

export const REPLAY_PROJECTION_SCHEMA_VERSION = 'replay-projection/v1';
export const REPLAY_MOTION_SCHEMA_VERSION = 'replay-motion/v1';

const SUPPORTED_OPERATIONS = new Set(Object.values(REPLAY_FRAME_OPERATIONS));
const TIMELINE_GROUP_ORDER = Object.freeze(['preflop', 'flop', 'turn', 'river', 'showdown']);
const SUIT_SYMBOLS = Object.freeze({ s: '♠', h: '♥', d: '♦', c: '♣' });
const SUIT_TONES = Object.freeze({ s: 'spade', h: 'heart', d: 'diamond', c: 'club' });

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value)) deepFreeze(child);
  return value;
}

function framePresentation(operation, state) {
  if (operation === REPLAY_FRAME_OPERATIONS.INITIALIZE_HAND) {
    return { kind: 'initialization', labelKey: 'replay.transition.initialization' };
  }
  if (operation === REPLAY_FRAME_OPERATIONS.DEAL_HOLE
    || operation === REPLAY_FRAME_OPERATIONS.DEAL_HOLE_OBSERVED) {
    return { kind: 'private_deal', labelKey: 'replay.transition.privateDeal' };
  }
  if (operation === REPLAY_FRAME_OPERATIONS.REVEAL_HOLE) {
    return { kind: 'private_reveal', labelKey: 'replay.transition.privateReveal' };
  }
  if (operation === REPLAY_FRAME_OPERATIONS.ACTION) {
    return { kind: 'action', labelKey: 'replay.transition.action' };
  }
  if (operation === REPLAY_FRAME_OPERATIONS.SHOWDOWN) {
    return { kind: 'showdown_resolution', labelKey: 'replay.transition.showdown' };
  }
  if (operation === REPLAY_FRAME_OPERATIONS.DEAL_BOARD) {
    const boardTransition = {
      flop: { kind: 'flop_deal', labelKey: 'replay.transition.flopDeal' },
      turn: { kind: 'turn_deal', labelKey: 'replay.transition.turnDeal' },
      river: { kind: 'river_deal', labelKey: 'replay.transition.riverDeal' },
    }[state.street];
    if (boardTransition) return boardTransition;
  }
  throw new RangeError(`Unsupported Replay transition: ${operation}`);
}

function actionSequenceForFrame(operation, state) {
  if (operation !== REPLAY_FRAME_OPERATIONS.ACTION) return null;
  const sequence = state.actionHistory?.at(-1)?.sequence;
  if (!Number.isInteger(sequence) || sequence < 0) {
    throw new RangeError('A Replay action frame requires a canonical action sequence');
  }
  return sequence;
}

function publicBoardCardsForFrame(kind, tablePresence) {
  const cards = {
    flop_deal: tablePresence.board.slice(0, 3),
    turn_deal: tablePresence.board.slice(3, 4),
    river_deal: tablePresence.board.slice(4, 5),
  }[kind] || [];
  return cards.map((card) => ({
    ...card,
    token: `${card.rank}${SUIT_SYMBOLS[card.suit] || card.suit}`,
    tone: SUIT_TONES[card.suit] || 'spade',
  }));
}

function captureFrame(state, heroPlayerId, operation) {
  if (!state || typeof state !== 'object' || Array.isArray(state)) {
    throw new TypeError('A canonical PokerState is required for a Replay frame');
  }
  if (typeof heroPlayerId !== 'string' || !heroPlayerId.trim()) {
    throw new TypeError('heroPlayerId is required for a Replay frame');
  }
  if (!SUPPORTED_OPERATIONS.has(operation)) {
    throw new RangeError(`Unsupported Replay operation: ${operation}`);
  }

  // The journal owns an immutable value snapshot rather than a mutable or reconstructable delta.
  // PokerState v2 transitions intentionally share one normalized immutable rules snapshot.
  let snapshot;
  if (Object.hasOwn(state, 'rulesSnapshot')) {
    snapshot = structuredClone(state);
    snapshot.rulesSnapshot = state.rulesSnapshot;
    deepFreeze(snapshot);
  } else {
    snapshot = deepFreeze(structuredClone(state));
  }
  const tablePresence = createTablePresenceViewModel({ state: snapshot, heroPlayerId });
  const presentation = framePresentation(operation, snapshot);
  return deepFreeze({
    state: snapshot,
    tablePresence,
    heroPlayerId,
    operation,
    kind: presentation.kind,
    labelKey: presentation.labelKey,
    actionSequence: actionSequenceForFrame(operation, snapshot),
    publicBoardCards: publicBoardCardsForFrame(presentation.kind, tablePresence),
  });
}

function cardIds(cards) {
  return Array.isArray(cards) ? cards.map((card) => card.id) : [];
}

function changedCards(previousSeat, nextSeat) {
  return JSON.stringify(cardIds(previousSeat?.cards)) !== JSON.stringify(cardIds(nextSeat.cards));
}

/**
 * Projects lightweight motion facts between two authoritative Table Presence
 * snapshots. Replay and live Full-Hand pacing share this presentation contract;
 * neither consumer infers poker state transitions in its renderer.
 */
export function createTablePresenceTransitionMotion({
  previousTablePresence = null,
  tablePresence,
  token,
  direction = 'forward',
  transitionKind,
  frameIndex = null,
  actorPlayerId = null,
  actionType = null,
  actionFamily = null,
  wasAllIn = false,
  boardCards = [],
  winnerPlayerIds = [],
} = {}) {
  if (tablePresence?.schemaVersion !== 'table-presence/v1') {
    throw new TypeError('A Table Presence v1 destination is required for motion');
  }
  const previousSeats = new Map(
    (previousTablePresence?.seats || []).map((seat) => [seat.playerId, seat]),
  );
  const seatChanges = tablePresence.seats.map((seat) => {
    const previous = previousSeats.get(seat.playerId);
    return {
      playerId: seat.playerId,
      visualSeatIndex: seat.visualSeatIndex,
      stack: {
        changed: previous?.currentStackMilliBb !== seat.currentStackMilliBb,
        previousMilliBb: previous?.currentStackMilliBb ?? null,
        nextMilliBb: seat.currentStackMilliBb,
      },
      contribution: {
        changed: previous?.streetContributionMilliBb !== seat.streetContributionMilliBb,
        previousMilliBb: previous?.streetContributionMilliBb ?? null,
        nextMilliBb: seat.streetContributionMilliBb,
      },
      foldedChanged: previous?.isFolded !== seat.isFolded,
      allInChanged: previous?.isAllIn !== seat.isAllIn,
      cardsChanged: changedCards(previous, seat),
      cardVisibilityChanged: previous?.cardVisibility !== seat.cardVisibility,
    };
  }).filter((change) => change.stack.changed
    || change.contribution.changed
    || change.foldedChanged
    || change.allInChanged
    || change.cardsChanged
    || change.cardVisibilityChanged);
  const nextActor = tablePresence.seats.find((seat) => seat.isCurrentActor) || null;

  return deepFreeze({
    schemaVersion: REPLAY_MOTION_SCHEMA_VERSION,
    active: true,
    token,
    direction,
    transitionKind,
    frameIndex,
    actorPlayerId,
    nextActorPlayerId: nextActor?.playerId || null,
    actionType,
    actionFamily,
    wasAllIn,
    boardCards: [...boardCards],
    winnerPlayerIds: [...winnerPlayerIds],
    seatChanges,
    pot: {
      changed: previousTablePresence?.potMilliBb !== tablePresence.potMilliBb,
      previousMilliBb: previousTablePresence?.potMilliBb ?? null,
      nextMilliBb: tablePresence.potMilliBb,
    },
  });
}

function createReplayMotion({
  atLive,
  frame,
  frameIndex,
  previousFrame,
  tablePresence,
  timeline,
  selectionDirection,
  selectionRevision,
}) {
  const active = !atLive
    && ['playback', 'restart'].includes(selectionDirection)
    && frame.kind !== 'initialization';
  if (!active) {
    return deepFreeze({
      schemaVersion: REPLAY_MOTION_SCHEMA_VERSION,
      active: false,
      token: selectionRevision,
      direction: selectionDirection,
      transitionKind: frame.kind,
      frameIndex,
    });
  }

  const selectedAction = timeline.selectedAction;
  return createTablePresenceTransitionMotion({
    previousTablePresence: previousFrame?.tablePresence || null,
    tablePresence,
    token: selectionRevision,
    direction: selectionDirection,
    transitionKind: frame.kind,
    frameIndex,
    actorPlayerId: selectedAction?.playerId || null,
    actionType: selectedAction?.actionType || null,
    actionFamily: selectedAction?.actionFamily || null,
    wasAllIn: selectedAction?.wasAllIn === true,
    boardCards: frame.publicBoardCards.map((card) => card.id),
    winnerPlayerIds: frame.state?.terminal?.winnerPlayerIds || [],
  });
}

function itemPresentationState(frameIndex, selectedFrameIndex, atLive) {
  if (atLive) return 'completed';
  if (frameIndex < selectedFrameIndex) return 'completed';
  if (frameIndex === selectedFrameIndex) return 'current';
  return 'future';
}

function timelineGroupForFrame(frame, actionEntry = null) {
  if (actionEntry) return actionEntry.street;
  if (frame.kind === 'flop_deal') return 'flop';
  if (frame.kind === 'turn_deal') return 'turn';
  if (frame.kind === 'river_deal') return 'river';
  if (frame.kind === 'private_reveal' || frame.kind === 'showdown_resolution') return 'showdown';
  return 'preflop';
}

function createTimelineProgress({
  liveTimeline,
  selectedTimeline,
  selectedFrameIndex,
  journalFrames,
  atLive,
}) {
  const actionCounts = { completed: 0, current: 0, future: 0 };
  const itemCounts = { completed: 0, current: 0, future: 0 };
  const actionEntriesBySequence = new Map(
    liveTimeline.groups.flatMap((group) => group.entries)
      .map((entry) => [entry.sequence, entry]),
  );
  const groupedItems = new Map(TIMELINE_GROUP_ORDER.map((street) => [street, []]));
  let selectedAction = null;
  let selectedTransition = null;
  let selectedGroup = 'preflop';

  journalFrames.forEach((frame, frameIndex) => {
    const presentationState = itemPresentationState(frameIndex, selectedFrameIndex, atLive);
    const actionEntry = frame.actionSequence === null
      ? null
      : actionEntriesBySequence.get(frame.actionSequence);
    if (frame.actionSequence !== null && !actionEntry) {
      throw new RangeError(`Replay frame ${frameIndex} has no canonical action entry`);
    }
    const street = timelineGroupForFrame(frame, actionEntry);
    const item = actionEntry
      ? {
        ...actionEntry,
        itemKind: 'action',
        source: 'canonical_action_history',
        frameIndex,
        presentationState,
      }
      : {
        itemKind: 'transition',
        source: 'replay_frame',
        frameIndex,
        street,
        operation: frame.operation,
        transitionKind: frame.kind,
        labelKey: frame.labelKey,
        cards: frame.publicBoardCards,
        cardVisibility: frame.publicBoardCards.length > 0 ? 'public_board' : 'none',
        presentationState,
      };
    groupedItems.get(street).push(item);
    itemCounts[presentationState] += 1;
    if (actionEntry) {
      actionCounts[presentationState] += 1;
      if (presentationState === 'current') selectedAction = item;
    } else if (presentationState === 'current') {
      selectedTransition = item;
    }
    if (frameIndex === selectedFrameIndex) selectedGroup = street;
  });

  const groups = TIMELINE_GROUP_ORDER.map((street) => {
    const items = groupedItems.get(street);
    if (items.length === 0) return null;
    return {
      street,
      headingKey: `replay.street.${street}`,
      isSelectedStreet: street === selectedGroup,
      items,
      entries: items.filter((item) => item.itemKind === 'action'),
      transitions: items.filter((item) => item.itemKind === 'transition'),
    };
  }).filter(Boolean);
  const hasShowdownGroup = groupedItems.get('showdown').length > 0;
  const currentMarkerGroup = hasShowdownGroup
    && ['terminal', 'showdown', 'reveal_required'].includes(selectedTimeline.currentMarker.kind)
    ? 'showdown'
    : selectedTimeline.currentMarker.street;

  return deepFreeze({
    empty: groups.length === 0,
    emptyState: groups.length === 0 ? liveTimeline.emptyState : null,
    status: selectedTimeline.status,
    entryCount: liveTimeline.entryCount,
    transitionCount: journalFrames.length - liveTimeline.entryCount,
    itemCount: journalFrames.length,
    groups,
    currentMarker: selectedTimeline.currentMarker,
    currentMarkerGroup,
    showCurrentMarker: atLive,
    selectedAction,
    selectedTransition,
    completedCount: actionCounts.completed,
    currentCount: actionCounts.current,
    futureCount: actionCounts.future,
    completedItemCount: itemCounts.completed,
    currentItemCount: itemCounts.current,
    futureItemCount: itemCounts.future,
  });
}

function emptyProjection() {
  const tablePresence = createTablePresenceViewModel();
  const liveTimeline = createReplayTimelineViewModel();
  return deepFreeze({
    schemaVersion: REPLAY_PROJECTION_SCHEMA_VERSION,
    mode: 'empty',
    modeLabelKey: 'replay.status.live',
    readOnly: false,
    detachedReadOnly: false,
    selectedFrameIndex: null,
    totalFrameCount: 0,
    currentStep: 0,
    totalSteps: 0,
    canPrevious: false,
    canNext: false,
    canReturnToLive: false,
    canReturnToEndpoint: false,
    endpoint: null,
    endpointLabelKey: 'replay.control.returnToLive',
    atStart: false,
    atLive: false,
    atEndpoint: false,
    canPlayback: false,
    canPlaybackAdvance: false,
    atPlaybackEnd: false,
    selectionRevision: 0,
    selectedStreet: null,
    selectedPhase: null,
    selectedFrame: null,
    motion: null,
    tablePresence,
    timeline: {
      empty: true,
      emptyState: liveTimeline.emptyState,
      status: liveTimeline.status,
      entryCount: 0,
      transitionCount: 0,
      itemCount: 0,
      groups: [],
      currentMarker: liveTimeline.currentMarker,
      currentMarkerGroup: null,
      showCurrentMarker: true,
      selectedAction: null,
      selectedTransition: null,
      completedCount: 0,
      currentCount: 0,
      futureCount: 0,
      completedItemCount: 0,
      currentItemCount: 0,
      futureItemCount: 0,
    },
    liveTimeline,
  });
}

/**
 * Journal successful canonical transitions and project one selected immutable frame.
 * Raw frames and PokerState snapshots remain private to this application boundary.
 */
export function createReplayProjectionController({
  getLiveState = () => null,
  getHeroPlayerId = () => null,
} = {}) {
  if (typeof getLiveState !== 'function' || typeof getHeroPlayerId !== 'function') {
    throw new TypeError('Replay providers must be functions');
  }

  let frames = [];
  let sourceEvents = [];
  let replayCursor = null;
  let detachedReadOnly = false;
  let selectionRevision = 0;
  let selectionDirection = 'none';

  const projection = () => {
    if (frames.length === 0) return emptyProjection();

    const atEndpoint = replayCursor === null;
    const atLive = atEndpoint && !detachedReadOnly;
    const selectedFrameIndex = atEndpoint ? frames.length - 1 : replayCursor;
    const selectedFrame = frames[selectedFrameIndex];
    const latestFrame = frames.at(-1);
    const liveState = detachedReadOnly ? latestFrame.state : (getLiveState() || latestFrame.state);
    const liveHeroPlayerId = detachedReadOnly
      ? latestFrame.heroPlayerId
      : (getHeroPlayerId() || latestFrame.heroPlayerId);
    const selectedState = atEndpoint ? liveState : selectedFrame.state;
    const selectedHeroPlayerId = atEndpoint ? liveHeroPlayerId : selectedFrame.heroPlayerId;
    const tablePresence = atEndpoint
      ? createTablePresenceViewModel({
        state: selectedState,
        heroPlayerId: selectedHeroPlayerId,
      })
      : selectedFrame.tablePresence;
    const liveTimeline = createReplayTimelineViewModel({
      state: liveState,
      heroPlayerId: liveHeroPlayerId,
    });
    const selectedTimeline = atEndpoint
      ? liveTimeline
      : createReplayTimelineViewModel({
        state: selectedFrame.state,
        heroPlayerId: selectedFrame.heroPlayerId,
      });
    const timeline = createTimelineProgress({
      liveTimeline,
      selectedTimeline,
      selectedFrameIndex,
      journalFrames: frames.slice(),
      atLive: atEndpoint,
    });
    const motion = createReplayMotion({
      atLive: atEndpoint,
      frame: selectedFrame,
      frameIndex: selectedFrameIndex,
      previousFrame: frames[selectedFrameIndex - 1] || null,
      tablePresence,
      timeline,
      selectionDirection,
      selectionRevision,
    });

    return deepFreeze({
      schemaVersion: REPLAY_PROJECTION_SCHEMA_VERSION,
      mode: detachedReadOnly ? 'saved' : (atLive ? 'live' : 'replay'),
      modeLabelKey: detachedReadOnly
        ? 'replay.status.saved'
        : (atLive ? 'replay.status.live' : 'replay.status.replay'),
      readOnly: detachedReadOnly || !atLive,
      detachedReadOnly,
      selectedFrameIndex,
      totalFrameCount: frames.length,
      currentStep: selectedFrameIndex + 1,
      totalSteps: frames.length,
      canPrevious: frames.length > 1 && (atLive || selectedFrameIndex > 0),
      canNext: !atLive,
      canReturnToLive: !detachedReadOnly && !atLive,
      canReturnToEndpoint: !atEndpoint,
      endpoint: detachedReadOnly ? 'saved_hand' : 'live_hand',
      endpointLabelKey: detachedReadOnly
        ? 'replay.control.returnToSavedHand'
        : 'replay.control.returnToLive',
      atStart: selectedFrameIndex === 0,
      atLive,
      atEndpoint,
      canPlayback: frames.length > 1,
      canPlaybackAdvance: !atLive && selectedFrameIndex < frames.length - 1,
      atPlaybackEnd: !atLive && selectedFrameIndex === frames.length - 1,
      selectionRevision,
      selectedStreet: selectedState.street,
      selectedPhase: selectedState.phase,
      selectedFrame: {
        index: selectedFrameIndex,
        kind: selectedFrame.kind,
        operation: selectedFrame.operation,
        labelKey: selectedFrame.labelKey,
        street: selectedFrame.state.street,
        phase: selectedFrame.state.phase,
        actionSequence: selectedFrame.actionSequence,
      },
      motion,
      tablePresence,
      timeline,
      liveTimeline,
    });
  };

  const controller = {
    clear() {
      frames = [];
      sourceEvents = [];
      replayCursor = null;
      detachedReadOnly = false;
      selectionRevision = 0;
      selectionDirection = 'none';
      return projection();
    },

    replaceHand({
      state = null,
      heroPlayerId = getHeroPlayerId(),
      operation = REPLAY_FRAME_OPERATIONS.INITIALIZE_HAND,
    } = {}) {
      frames = [];
      sourceEvents = [];
      replayCursor = null;
      detachedReadOnly = false;
      selectionRevision = 0;
      selectionDirection = 'none';
      if (state) {
        const event = deriveCanonicalHandReplayEvent({
          sequence: 0,
          operation,
          state,
        });
        frames.push(captureFrame(state, heroPlayerId, operation));
        sourceEvents.push(event);
      }
      return projection();
    },

    recordTransition({ state, heroPlayerId = getHeroPlayerId(), operation } = {}) {
      if (detachedReadOnly) {
        throw new RangeError('A detached read-only Replay cannot record live transitions');
      }
      if (replayCursor !== null) {
        throw new RangeError('Return to the live edge before recording a canonical transition');
      }
      if (!state) return projection();
      if (frames.length === 0) {
        throw new RangeError('Initialize Replay before recording later transitions');
      }
      if (heroPlayerId !== frames[0].heroPlayerId) {
        throw new RangeError('Replay observer perspective cannot change within one hand');
      }
      const event = deriveCanonicalHandReplayEvent({
        sequence: sourceEvents.length,
        operation,
        previousState: frames.at(-1).state,
        state,
      });
      frames.push(captureFrame(state, heroPlayerId, operation));
      sourceEvents.push(event);
      return projection();
    },

    createCanonicalHandReplaySource() {
      if (frames.length === 0) return null;
      return createCanonicalHandReplaySource({
        heroPlayerId: frames[0].heroPlayerId,
        events: sourceEvents,
      });
    },

    replaceFromCanonicalHandReplaySource(source, { readOnly = false } = {}) {
      const durableSource = createCanonicalHandReplaySource({
        schemaVersion: source?.schemaVersion,
        heroPlayerId: source?.heroPlayerId,
        events: source?.events,
      });
      const reconstruction = reconstructCanonicalHandReplaySource(durableSource);
      const restoredFrames = reconstruction.frames.map((frame) => captureFrame(
        frame.state,
        frame.heroPlayerId,
        frame.operation,
      ));
      frames = restoredFrames;
      sourceEvents = [...durableSource.events];
      replayCursor = null;
      detachedReadOnly = readOnly === true;
      selectionRevision = 0;
      selectionDirection = 'none';
      return projection();
    },

    previous() {
      if (frames.length > 1) {
        replayCursor = replayCursor === null
          ? frames.length - 2
          : Math.max(0, replayCursor - 1);
        selectionRevision += 1;
        selectionDirection = 'backward';
      }
      return projection();
    },

    next() {
      if (replayCursor !== null) {
        replayCursor = replayCursor >= frames.length - 2 ? null : replayCursor + 1;
        selectionRevision += 1;
        selectionDirection = 'direct_step';
      }
      return projection();
    },

    selectFrame(frameIndex) {
      if (!Number.isInteger(frameIndex)) {
        throw new TypeError('Replay frame index must be an integer');
      }
      if (frameIndex < 0 || frameIndex >= frames.length) {
        throw new RangeError(`Replay frame index out of range: ${frameIndex}`);
      }
      // The final frame is the existing live/saved endpoint, just as stepping
      // Next from the preceding frame returns to that endpoint.
      replayCursor = frameIndex === frames.length - 1 ? null : frameIndex;
      selectionRevision += 1;
      selectionDirection = 'jump';
      return projection();
    },

    beginPlayback() {
      if (frames.length > 1) {
        replayCursor = 0;
        selectionRevision += 1;
        selectionDirection = 'restart';
      }
      return projection();
    },

    advancePlayback() {
      if (replayCursor !== null && replayCursor < frames.length - 1) {
        replayCursor += 1;
        selectionRevision += 1;
        selectionDirection = 'playback';
      }
      return projection();
    },

    returnToLive() {
      replayCursor = null;
      selectionRevision += 1;
      selectionDirection = 'jump';
      return projection();
    },

    returnToEndpoint() {
      replayCursor = null;
      selectionRevision += 1;
      selectionDirection = 'jump';
      return projection();
    },

    isReplayActive() {
      return replayCursor !== null;
    },

    getProjection: projection,
  };

  return Object.freeze(controller);
}
