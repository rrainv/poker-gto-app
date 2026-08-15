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
  createTablePresenceViewModel({ state: snapshot, heroPlayerId });
  const presentation = framePresentation(operation, snapshot);
  return deepFreeze({
    state: snapshot,
    heroPlayerId,
    operation,
    kind: presentation.kind,
    labelKey: presentation.labelKey,
    actionSequence: actionSequenceForFrame(operation, snapshot),
  });
}

function actionPresentationState(entry, selectedFrame, atLive) {
  if (atLive) return 'completed';
  if (selectedFrame.actionSequence !== null) {
    if (entry.sequence < selectedFrame.actionSequence) return 'completed';
    if (entry.sequence === selectedFrame.actionSequence) return 'current';
    return 'future';
  }
  return entry.sequence < selectedFrame.state.actionHistory.length ? 'completed' : 'future';
}

function createTimelineProgress({ liveTimeline, selectedTimeline, selectedFrame, atLive }) {
  const counts = { completed: 0, current: 0, future: 0 };
  let selectedAction = null;
  const groups = liveTimeline.groups.map((group) => ({
    street: group.street,
    headingKey: group.headingKey,
    isSelectedStreet: group.street === selectedFrame.state.street,
    entries: group.entries.map((entry) => {
      const presentationState = actionPresentationState(entry, selectedFrame, atLive);
      counts[presentationState] += 1;
      const projected = { ...entry, presentationState };
      if (presentationState === 'current') selectedAction = projected;
      return projected;
    }),
  }));

  return deepFreeze({
    empty: liveTimeline.empty,
    emptyState: liveTimeline.emptyState,
    status: selectedTimeline.status,
    entryCount: liveTimeline.entryCount,
    groups,
    currentMarker: selectedTimeline.currentMarker,
    showCurrentMarker: atLive || selectedFrame.actionSequence === null,
    selectedAction,
    completedCount: counts.completed,
    currentCount: counts.current,
    futureCount: counts.future,
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
      groups: [],
      currentMarker: liveTimeline.currentMarker,
      showCurrentMarker: true,
      selectedAction: null,
      completedCount: 0,
      currentCount: 0,
      futureCount: 0,
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
      selectedFrame,
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
