import { createReplayTimelineViewModel } from './replay-timeline-view-model.mjs';
import { createTablePresenceViewModel } from './table-presence-view-model.mjs';

export const REPLAY_PROJECTION_SCHEMA_VERSION = 'replay-projection/v1';

export const REPLAY_FRAME_OPERATIONS = Object.freeze({
  INITIALIZE_HAND: 'initialize_hand',
  DEAL_HOLE: 'deal_hole',
  DEAL_HOLE_OBSERVED: 'deal_hole_observed',
  REVEAL_HOLE: 'reveal_hole',
  DEAL_BOARD: 'deal_board',
  ACTION: 'action',
  SHOWDOWN: 'showdown',
});

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
  const snapshot = deepFreeze(structuredClone(state));
  const tablePresence = createTablePresenceViewModel({ state: snapshot, heroPlayerId });
  const presentation = framePresentation(operation, snapshot);
  return deepFreeze({
    state: snapshot,
    heroPlayerId,
    operation,
    kind: presentation.kind,
    labelKey: presentation.labelKey,
    actionSequence: actionSequenceForFrame(operation, snapshot),
    publicBoardCards: publicBoardCardsForFrame(presentation.kind, tablePresence),
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
    selectedFrameIndex: null,
    totalFrameCount: 0,
    currentStep: 0,
    totalSteps: 0,
    canPrevious: false,
    canNext: false,
    canReturnToLive: false,
    atStart: false,
    atLive: false,
    selectedStreet: null,
    selectedPhase: null,
    selectedFrame: null,
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
  let replayCursor = null;

  const projection = () => {
    if (frames.length === 0) return emptyProjection();

    const atLive = replayCursor === null;
    const selectedFrameIndex = atLive ? frames.length - 1 : replayCursor;
    const selectedFrame = frames[selectedFrameIndex];
    const latestFrame = frames.at(-1);
    const liveState = getLiveState() || latestFrame.state;
    const liveHeroPlayerId = getHeroPlayerId() || latestFrame.heroPlayerId;
    const selectedState = atLive ? liveState : selectedFrame.state;
    const selectedHeroPlayerId = atLive ? liveHeroPlayerId : selectedFrame.heroPlayerId;
    const tablePresence = createTablePresenceViewModel({
      state: selectedState,
      heroPlayerId: selectedHeroPlayerId,
    });
    const liveTimeline = createReplayTimelineViewModel({
      state: liveState,
      heroPlayerId: liveHeroPlayerId,
    });
    const selectedTimeline = atLive
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
      atLive,
    });

    return deepFreeze({
      schemaVersion: REPLAY_PROJECTION_SCHEMA_VERSION,
      mode: atLive ? 'live' : 'replay',
      modeLabelKey: atLive ? 'replay.status.live' : 'replay.status.replay',
      readOnly: !atLive,
      selectedFrameIndex,
      totalFrameCount: frames.length,
      currentStep: selectedFrameIndex + 1,
      totalSteps: frames.length,
      canPrevious: frames.length > 1 && (atLive || selectedFrameIndex > 0),
      canNext: !atLive,
      canReturnToLive: !atLive,
      atStart: selectedFrameIndex === 0,
      atLive,
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
      tablePresence,
      timeline,
      liveTimeline,
    });
  };

  const controller = {
    clear() {
      frames = [];
      replayCursor = null;
      return projection();
    },

    replaceHand({
      state = null,
      heroPlayerId = getHeroPlayerId(),
      operation = REPLAY_FRAME_OPERATIONS.INITIALIZE_HAND,
    } = {}) {
      frames = [];
      replayCursor = null;
      if (state) frames.push(captureFrame(state, heroPlayerId, operation));
      return projection();
    },

    recordTransition({ state, heroPlayerId = getHeroPlayerId(), operation } = {}) {
      if (replayCursor !== null) {
        throw new RangeError('Return to the live edge before recording a canonical transition');
      }
      if (!state) return projection();
      if (frames.length === 0) {
        throw new RangeError('Initialize Replay before recording later transitions');
      }
      frames.push(captureFrame(state, heroPlayerId, operation));
      return projection();
    },

    previous() {
      if (frames.length > 1) {
        replayCursor = replayCursor === null
          ? frames.length - 2
          : Math.max(0, replayCursor - 1);
      }
      return projection();
    },

    next() {
      if (replayCursor !== null) {
        replayCursor = replayCursor >= frames.length - 2 ? null : replayCursor + 1;
      }
      return projection();
    },

    returnToLive() {
      replayCursor = null;
      return projection();
    },

    isReplayActive() {
      return replayCursor !== null;
    },

    getProjection: projection,
  };

  return Object.freeze(controller);
}
