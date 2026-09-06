import { createCanonicalLiveController } from './canonical-live-controller.mjs';
import { createCanonicalHandLifecycleRecorder } from './canonical-hand-lifecycle.mjs';
import { canonicalPokerStatesEqual, reconstructCanonicalHandReplaySource } from './canonical-hand-replay-source.mjs';
import { isHandResumable } from '../../../shared/poker-domain/index.js';
import {
  PLAYBOOK_MODES,
  createPlaybookModeController,
  createPlaybookScenarioInput,
  createPlaybookScenarioInputFromLegacyCompatibility,
  createPlaybookViewModel,
} from './playbook-state-source.mjs';
import { createTablePresenceViewModel } from './table-presence-view-model.mjs';
import { createReplayTimelineViewModel } from './replay-timeline-view-model.mjs';
import {
  REPLAY_FRAME_OPERATIONS,
  createTablePresenceTransitionMotion,
  createReplayProjectionController,
} from './replay-projection-controller.mjs';
import { createReplayPlaybackController } from './replay-playback-controller.mjs';
import {
  EXPERIENCE_EVENT_ORIGINS,
  EXPERIENCE_EVENT_TYPES,
  createPokerWorldExperienceEvents,
  createStudyExperienceEvent,
  installExperienceEventsBridge,
} from './experience-events.mjs';
import {
  TABLE_INTERACTIONS,
  TABLE_PROJECTIONS,
  TABLE_VISUAL_STATES,
  createTablePresentation,
} from './table-presentation.mjs';
import {
  ANALYZE_RANDOMIZATION_REQUEST_VERSION,
  ANALYZE_RANDOMIZATION_TARGETS,
  randomizeAnalyzeScenario,
} from './analyze-scenario-randomization.mjs';
import {
  HAND_PENDING_RANDOMIZATION_REQUEST_VERSION,
  randomizeHandPendingDraft,
} from './hand-pending-randomization.mjs';

export const PLAYBOOK_STATE_CHANGE_EVENT = 'riverline:playbook-state-change';

let handSourceSequence = 0;
function defaultHandSourceIdFactory() {
  const uuid = globalThis.crypto?.randomUUID?.();
  if (uuid) return `hand-session-${uuid}`;
  handSourceSequence += 1;
  return `hand-session-${Date.now().toString(36)}-${handSourceSequence.toString(36)}`;
}

export function installPlaybookStateSourceBridge(browserWindow, {
  canonicalController = createCanonicalLiveController({ enabled: true }),
  replayPlaybackOptions = {},
  handSourceIdFactory = defaultHandSourceIdFactory,
} = {}) {
  if (!browserWindow) return null;
  if (typeof handSourceIdFactory !== 'function') throw new TypeError('handSourceIdFactory must be a function');
  const modeController = createPlaybookModeController({ canonicalController });
  let canonicalHandSourceId = null;
  const replayController = createReplayProjectionController({
    getLiveState: () => canonicalController.getState(),
    getHeroPlayerId: () => canonicalController.getHeroPlayerId(),
  });
  const savedReplayController = createReplayProjectionController();
  let savedHandViewer = null;
  let experienceSequence = 0;
  const experienceBridge = installExperienceEventsBridge(browserWindow);

  const activeReplayController = () => (savedHandViewer ? savedReplayController : replayController);

  const tableVisualState = (tablePresence, replayProjection) => {
    if (replayProjection?.readOnly) return TABLE_VISUAL_STATES.POST_HAND_REVIEW;
    if (!tablePresence || tablePresence.empty) return TABLE_VISUAL_STATES.SETUP;
    if (tablePresence.status === 'terminal') return TABLE_VISUAL_STATES.HAND_COMPLETE;
    if (tablePresence.status === 'active') return TABLE_VISUAL_STATES.LIVE_DECISION;
    if (tablePresence.status === 'awaiting_board') return TABLE_VISUAL_STATES.STREET_TRANSITION;
    if (tablePresence.status === 'showdown') return TABLE_VISUAL_STATES.STREET_TRANSITION;
    return TABLE_VISUAL_STATES.SETUP;
  };
  const closeSavedHandViewer = () => {
    savedHandViewer = null;
    savedReplayController.clear();
  };

  const publish = (operation, result) => {
    if (typeof browserWindow.dispatchEvent === 'function'
      && typeof browserWindow.CustomEvent === 'function') {
      browserWindow.dispatchEvent(new browserWindow.CustomEvent(
        PLAYBOOK_STATE_CHANGE_EVENT,
        { detail: { operation, result } },
      ));
    }
    return result;
  };

  const transitionKindForOperation = (operation) => ({
    [REPLAY_FRAME_OPERATIONS.DEAL_HOLE]: 'private_deal',
    [REPLAY_FRAME_OPERATIONS.DEAL_HOLE_OBSERVED]: 'private_deal',
    [REPLAY_FRAME_OPERATIONS.REVEAL_HOLE]: 'private_reveal',
    [REPLAY_FRAME_OPERATIONS.ACTION]: 'action',
    [REPLAY_FRAME_OPERATIONS.DEAL_BOARD]: 'board_deal',
    [REPLAY_FRAME_OPERATIONS.SHOWDOWN]: 'showdown_resolution',
  }[operation] || operation);

  const emitPokerTransition = ({
    origin,
    source,
    token,
    operation,
    transitionKind,
    motion,
    previousState,
    state,
    actorPlayerId,
    actionType,
    boardCardIds,
    holeCardCount,
    frameIndex,
    winnerPlayerIds,
    streetClosedOverride = false,
    streetAdvancedOverride = false,
    showdownStartedOverride = false,
    terminalOverride = false,
    potAwardedOverride = false,
  }) => experienceBridge.emitBatch(createPokerWorldExperienceEvents({
    origin,
    source,
    token,
    operation,
    transitionKind,
    motion,
    previousState,
    state,
    actorPlayerId,
    actionType,
    boardCardIds,
    holeCardCount,
    frameIndex,
    winnerPlayerIds,
    streetClosedOverride,
    streetAdvancedOverride,
    showdownStartedOverride,
    terminalOverride,
    potAwardedOverride,
  }));

  const publishLiveTransition = (operation, frameOperation, transition, metadata = {}) => {
    if (savedHandViewer || replayController.isReplayActive()) return null;
    const previousState = canonicalController.getState();
    const heroPlayerId = canonicalController.getHeroPlayerId();
    const previousTablePresence = previousState
      ? createTablePresenceViewModel({ state: previousState, heroPlayerId })
      : null;
    const result = transition();
    if (result) {
      replayController.recordTransition({
        state: result,
        heroPlayerId,
        operation: frameOperation,
      });
      const tablePresence = createTablePresenceViewModel({ state: result, heroPlayerId });
      const token = ++experienceSequence;
      const transitionKind = transitionKindForOperation(frameOperation);
      const boardCardIds = frameOperation === REPLAY_FRAME_OPERATIONS.DEAL_BOARD
        ? result.board.slice(previousState?.board?.length || 0)
        : [];
      const motion = createTablePresenceTransitionMotion({
        previousTablePresence,
        tablePresence,
        token,
        transitionKind,
        actorPlayerId: metadata.actorPlayerId ?? previousState?.actingPlayerId ?? null,
        actionType: metadata.actionType ?? null,
        wasAllIn: metadata.actionType === 'all_in',
        boardCards: boardCardIds,
      });
      emitPokerTransition({
        origin: EXPERIENCE_EVENT_ORIGINS.LIVE,
        source: canonicalHandSourceId || 'canonical_hand',
        token,
        operation,
        transitionKind,
        motion,
        previousState,
        state: result,
        actorPlayerId: metadata.actorPlayerId ?? previousState?.actingPlayerId ?? null,
        actionType: metadata.actionType ?? null,
        boardCardIds,
        holeCardCount: metadata.holeCardCount ?? null,
      });
    }
    return publish(operation, result);
  };

  const emitReplayProjection = (projection) => {
    if (!projection?.motion?.active || !projection.selectedFrame) return;
    const selectedAction = projection.timeline?.selectedAction;
    const transitionKind = projection.selectedFrame.kind;
    const terminal = projection.tablePresence?.status === 'terminal';
    emitPokerTransition({
      origin: EXPERIENCE_EVENT_ORIGINS.REPLAY_PLAYBACK,
      source: `${savedHandViewer?.objectId || canonicalHandSourceId || 'canonical_hand'}:replay`,
      token: projection.selectionRevision,
      operation: projection.selectedFrame.operation,
      transitionKind,
      motion: projection.motion,
      previousState: null,
      state: null,
      actorPlayerId: selectedAction?.playerId ?? projection.motion.actorPlayerId ?? null,
      actionType: selectedAction?.actionType ?? projection.motion.actionType ?? null,
      boardCardIds: projection.motion.boardCards || [],
      frameIndex: projection.selectedFrameIndex,
      winnerPlayerIds: projection.motion.winnerPlayerIds || [],
      streetClosedOverride: transitionKind === 'action'
        && projection.tablePresence?.status === 'awaiting_board',
      streetAdvancedOverride: ['flop_deal', 'turn_deal', 'river_deal'].includes(transitionKind),
      showdownStartedOverride: transitionKind === 'private_reveal',
      terminalOverride: terminal,
      potAwardedOverride: terminal,
    });
  };

  const playbackController = createReplayPlaybackController({
    ...replayPlaybackOptions,
    getProjection: () => activeReplayController().getProjection(),
    advance: () => activeReplayController().advancePlayback(),
    onAdvance: (projection) => {
      emitReplayProjection(projection);
      publish('replay_playback_tick', projection);
    },
  });

  function openDetachedHand({ objectId = null, title = null, pokerState, heroPlayerId, replaySource, importProvenance = null }, kind) {
    // Validate and build the existing canonical journal before replacing any viewer.
    const reconstruction = reconstructCanonicalHandReplaySource(replaySource);
    if (reconstruction.heroPlayerId !== heroPlayerId
      || !canonicalPokerStatesEqual(reconstruction.finalState, pokerState)) {
      throw new RangeError('Hand viewer source must reconstruct its canonical snapshot exactly');
    }
    if (kind === 'imported_hand' && (!importProvenance || importProvenance.canonicalHandId !== pokerState.handId)) {
      throw new RangeError('Imported Hand requires provenance bound to its canonical Hand');
    }
    const lifecycle = createCanonicalHandLifecycleRecorder();
    lifecycle.start(reconstruction.frames[0].state);
    lifecycle.configureHero(reconstruction.frames[0].state, { heroPlayerId });
    for (let index = 1; index < reconstruction.frames.length; index += 1) {
      const frame = reconstruction.frames[index];
      lifecycle.recordTransition({ previousState: reconstruction.frames[index - 1].state,
        state: frame.state, operation: frame.operation });
    }
    playbackController.cancel();
    const modeResult = modeController.setMode(PLAYBOOK_MODES.HAND,
      modeController.getLastScenarioInput() || createPlaybookScenarioInput({}));
    if (modeResult.mode !== PLAYBOOK_MODES.HAND) throw new RangeError('Hand viewer could not enter Hand Mode');
    savedReplayController.replaceFromCanonicalHandReplaySource(replaySource, { readOnly: true });
    savedHandViewer = Object.freeze({ kind, objectId, title,
      pokerState: reconstruction.finalState, heroPlayerId, replaySource: lifecycle.createCanonicalHandReplaySource(),
      lifecycle, importProvenance: importProvenance ? structuredClone(importProvenance) : null,
      hasLiveHand: isHandResumable(canonicalController.getState()) });
    return publish('saved_hand_open', bridge.createReplayProjectionViewModel());
  }

  const bridge = Object.freeze({
    getMode: () => modeController.getMode(),

    setMode(mode, scenarioInput) {
      playbackController.cancel();
      if (mode === PLAYBOOK_MODES.SCENARIO) closeSavedHandViewer();
      const result = modeController.setMode(mode, scenarioInput);
      if (result?.mode === PLAYBOOK_MODES.SCENARIO) replayController.returnToLive();
      return publish('mode', result);
    },

    createScenarioInput: createPlaybookScenarioInput,

    createScenarioInputFromLegacyCompatibility: createPlaybookScenarioInputFromLegacyCompatibility,

    randomizationRequestVersion: ANALYZE_RANDOMIZATION_REQUEST_VERSION,

    randomizationTargets: ANALYZE_RANDOMIZATION_TARGETS,

    randomizeScenario: randomizeAnalyzeScenario,

    handRandomizationRequestVersion: HAND_PENDING_RANDOMIZATION_REQUEST_VERSION,

    randomizeHandPendingDraft,

    resolveDecisionContext(scenarioInput) {
      return modeController.resolve({ scenarioInput });
    },

    createViewModel(strategyResult = null) {
      return createPlaybookViewModel({
        resolution: modeController.getResolution(),
        strategyResult,
      });
    },

    createTablePresenceViewModel() {
      if (savedHandViewer) return savedReplayController.getProjection().tablePresence;
      return createTablePresenceViewModel({
        state: canonicalController.getState(),
        heroPlayerId: canonicalController.getHeroPlayerId(),
      });
    },

    createReplayTimelineViewModel() {
      if (savedHandViewer) return savedReplayController.getProjection().liveTimeline;
      return createReplayTimelineViewModel({
        state: canonicalController.getState(),
        heroPlayerId: canonicalController.getHeroPlayerId(),
      });
    },

    createReplayProjectionViewModel() {
      if (modeController.getMode() !== PLAYBOOK_MODES.HAND) return null;
      const projection = activeReplayController().getProjection();
      return savedHandViewer
        ? Object.freeze({
          ...projection,
          viewerContext: Object.freeze({
            kind: savedHandViewer.kind,
            objectId: savedHandViewer.objectId,
            title: savedHandViewer.title,
            hasLiveHand: savedHandViewer.hasLiveHand,
          }),
        })
        : projection;
    },

    createTablePresentationViewModel({
      projection: requestedProjection = null,
      visualState: requestedVisualState = null,
      interaction: requestedInteraction = null,
      submissionLocked = false,
    } = {}) {
      if (modeController.getMode() !== PLAYBOOK_MODES.HAND) return null;
      const replayProjection = activeReplayController().getProjection();
      const tablePresence = replayProjection.tablePresence;
      const visualState = requestedVisualState
        ?? tableVisualState(tablePresence, replayProjection);
      const projection = requestedProjection
        ?? ((replayProjection.readOnly || visualState === TABLE_VISUAL_STATES.HAND_COMPLETE)
          ? TABLE_PROJECTIONS.REVIEW
          : TABLE_PROJECTIONS.PLAY);
      const interaction = requestedInteraction
        ?? (replayProjection.readOnly
          ? TABLE_INTERACTIONS.REPLAY
          : (visualState === TABLE_VISUAL_STATES.LIVE_DECISION
            ? TABLE_INTERACTIONS.DECISION
            : TABLE_INTERACTIONS.PASSIVE));
      const liveState = savedHandViewer ? null : canonicalController.getState();
      return createTablePresentation({
        projection,
        visualState,
        interaction,
        tablePresence,
        timeline: replayProjection.timeline,
        legalActionSpec: interaction === TABLE_INTERACTIONS.DECISION
          ? canonicalController.getLegalActions()
          : null,
        chipUnitMilliBb: liveState?.game?.chipUnitMilliBb ?? null,
        submissionLocked,
      });
    },

    createCanonicalHandReplaySource() {
      if (savedHandViewer?.kind === 'imported_hand') return savedHandViewer.replaySource;
      return modeController.getMode() === PLAYBOOK_MODES.HAND && !savedHandViewer
        ? canonicalController.createCanonicalHandReplaySource()
        : null;
    },

    getHeroDecisionJournal() {
      if (savedHandViewer) return savedHandViewer.lifecycle.getHeroDecisionJournal(savedHandViewer.pokerState);
      return modeController.getMode() === PLAYBOOK_MODES.HAND && !savedHandViewer
        ? canonicalController.getHeroDecisionJournal()
        : null;
    },

    evaluateHeroDecision(options) {
      return modeController.getMode() === PLAYBOOK_MODES.HAND && !savedHandViewer
        ? canonicalController.evaluateHeroDecision(options)
        : null;
    },

    getCompletedHandResult() {
      if (savedHandViewer) return savedHandViewer.lifecycle.getCompletedHandResult();
      return modeController.getMode() === PLAYBOOK_MODES.HAND && !savedHandViewer
        ? canonicalController.getCompletedHandResult()
        : null;
    },

    getCanonicalHandSourceId() {
      if (savedHandViewer?.kind === 'imported_hand') return savedHandViewer.pokerState.handId;
      return canonicalController.getState() && !savedHandViewer ? canonicalHandSourceId : null;
    },

    getImportProvenance() {
      return savedHandViewer?.importProvenance ? structuredClone(savedHandViewer.importProvenance) : null;
    },

    getHeroDecisionState(decisionIndex) {
      const journal = bridge.getHeroDecisionJournal();
      const decision = Number.isSafeInteger(decisionIndex) ? journal?.decisions?.[decisionIndex] : null;
      if (!decision) return null;
      const source = savedHandViewer?.replaySource ?? canonicalController.createCanonicalHandReplaySource();
      const frame = reconstructCanonicalHandReplaySource(source).frames[decision.occurrence.replayPoint.eventSequence];
      return frame?.state ?? null;
    },

    createReplayPlaybackViewModel() {
      return playbackController.getState();
    },

    startReplayPlayback() {
      if (modeController.getMode() !== PLAYBOOK_MODES.HAND) return null;
      const activeController = activeReplayController();
      if (!activeController.isReplayActive()) activeController.beginPlayback();
      const playback = playbackController.start();
      experienceBridge.emit(createStudyExperienceEvent({
        type: EXPERIENCE_EVENT_TYPES.REPLAY_STARTED,
        origin: EXPERIENCE_EVENT_ORIGINS.REPLAY_PLAYBACK,
        source: savedHandViewer?.objectId || canonicalHandSourceId || 'canonical_hand',
        token: ++experienceSequence,
      }));
      return publish('replay_playback_start', {
        playback,
        projection: activeController.getProjection(),
      });
    },

    pauseReplayPlayback() {
      if (modeController.getMode() !== PLAYBOOK_MODES.HAND) return null;
      const playback = playbackController.pause();
      experienceBridge.emit(createStudyExperienceEvent({
        type: EXPERIENCE_EVENT_TYPES.REPLAY_PAUSED,
        origin: EXPERIENCE_EVENT_ORIGINS.DIRECT_SEEK,
        source: savedHandViewer?.objectId || canonicalHandSourceId || 'canonical_hand',
        token: ++experienceSequence,
      }));
      return publish('replay_playback_pause', {
        playback,
        projection: activeReplayController().getProjection(),
      });
    },

    cancelReplayPlayback() {
      const playback = playbackController.cancel();
      return publish('replay_playback_cancel', {
        playback,
        projection: modeController.getMode() === PLAYBOOK_MODES.HAND
          ? activeReplayController().getProjection()
          : null,
      });
    },

    previousReplayFrame() {
      if (modeController.getMode() !== PLAYBOOK_MODES.HAND) return null;
      playbackController.pause();
      return publish('replay_previous', activeReplayController().previous());
    },

    nextReplayFrame() {
      if (modeController.getMode() !== PLAYBOOK_MODES.HAND) return null;
      playbackController.pause();
      return publish('replay_next', activeReplayController().next());
    },

    selectReplayFrame(frameIndex) {
      if (modeController.getMode() !== PLAYBOOK_MODES.HAND) return null;
      playbackController.pause();
      return publish('replay_select_frame', activeReplayController().selectFrame(frameIndex));
    },

    returnReplayToLive() {
      if (modeController.getMode() !== PLAYBOOK_MODES.HAND) return null;
      playbackController.cancel();
      return publish(
        savedHandViewer ? 'replay_saved_endpoint' : 'replay_live',
        activeReplayController().returnToEndpoint(),
      );
    },

    returnReplayToEndpoint() {
      if (modeController.getMode() !== PLAYBOOK_MODES.HAND) return null;
      playbackController.cancel();
      return publish(
        savedHandViewer ? 'replay_saved_endpoint' : 'replay_live',
        activeReplayController().returnToEndpoint(),
      );
    },

    openSavedHand(input = {}) {
      return openDetachedHand(input, 'saved_hand');
    },

    openImportedHand(input = {}) {
      return openDetachedHand({ ...input, objectId: null }, 'imported_hand');
    },

    closeSavedHand() {
      if (!savedHandViewer) return bridge.createReplayProjectionViewModel();
      playbackController.cancel();
      closeSavedHandViewer();
      return publish('saved_hand_close', replayController.getProjection());
    },

    hasLiveHand() {
      return isHandResumable(canonicalController.getState());
    },

    getResolution: () => modeController.getResolution(),
    getScenarioInput: () => modeController.getLastScenarioInput(),

    prepareNewHand() {
      if (modeController.getMode() !== PLAYBOOK_MODES.HAND || savedHandViewer) return null;
      const completedState = canonicalController.getState();
      if (!completedState
        || (completedState.phase !== 'terminal' && completedState.terminal?.isTerminal !== true)) {
        return null;
      }
      playbackController.cancel();
      canonicalController.reset();
      canonicalHandSourceId = null;
      replayController.clear();
      return publish('prepare_new_hand', Object.freeze({
        previousHandId: completedState.handId,
        status: 'ready_for_setup',
      }));
    },

    initializeHand(configuration) {
      playbackController.cancel();
      closeSavedHandViewer();
      const nextHandSourceId = handSourceIdFactory();
      const result = canonicalController.initialize({
        ...configuration,
        handId: nextHandSourceId,
      });
      canonicalHandSourceId = result?.handId ?? null;
      replayController.replaceHand({
        state: result,
        heroPlayerId: canonicalController.getHeroPlayerId(),
        operation: REPLAY_FRAME_OPERATIONS.INITIALIZE_HAND,
      });
      return publish('initialize_hand', result);
    },

    resetHand() {
      playbackController.cancel();
      closeSavedHandViewer();
      canonicalController.reset();
      canonicalHandSourceId = null;
      replayController.clear();
      return publish('reset_hand', null);
    },

    dealHoleCards(cardsByPlayer) {
      return publishLiveTransition(
        'deal_hole',
        REPLAY_FRAME_OPERATIONS.DEAL_HOLE,
        () => canonicalController.dealHoleCards(cardsByPlayer),
        { holeCardCount: Object.keys(cardsByPlayer || {}).length * 2 },
      );
    },

    dealObservedHoleCards(cardsByPlayer) {
      const state = canonicalController.getState();
      const knownPlayerCount = cardsByPlayer && typeof cardsByPlayer === 'object'
        ? Object.keys(cardsByPlayer).length
        : 0;
      const fullyKnownDeal = knownPlayerCount === state?.players?.length;
      return publishLiveTransition(
        fullyKnownDeal ? 'deal_hole' : 'deal_hole_observed',
        fullyKnownDeal
          ? REPLAY_FRAME_OPERATIONS.DEAL_HOLE
          : REPLAY_FRAME_OPERATIONS.DEAL_HOLE_OBSERVED,
        () => canonicalController.dealObservedHoleCards(cardsByPlayer),
        { holeCardCount: knownPlayerCount * 2 },
      );
    },

    revealHoleCards(playerId, cards) {
      return publishLiveTransition(
        'reveal_hole',
        REPLAY_FRAME_OPERATIONS.REVEAL_HOLE,
        () => canonicalController.revealHoleCards(playerId, cards),
        { actorPlayerId: playerId, holeCardCount: Array.isArray(cards) ? cards.length : null },
      );
    },

    dealBoardCards(cards) {
      return publishLiveTransition(
        'deal_board',
        REPLAY_FRAME_OPERATIONS.DEAL_BOARD,
        () => canonicalController.dealBoardCards(cards),
      );
    },

    applyAction(type, amountToBb = null) {
      return publishLiveTransition(
        'action',
        REPLAY_FRAME_OPERATIONS.ACTION,
        () => canonicalController.applyAction({ type, amountToBb }),
        { actionType: type },
      );
    },

    resolveShowdown() {
      return publishLiveTransition(
        'showdown',
        REPLAY_FRAME_OPERATIONS.SHOWDOWN,
        () => canonicalController.resolveShowdown(),
      );
    },

    getState: () => savedHandViewer?.pokerState ?? canonicalController.getState(),
    getHeroPlayerId: () => savedHandViewer?.heroPlayerId ?? canonicalController.getHeroPlayerId(),
    getLegalActions: () => (savedHandViewer ? null : canonicalController.getLegalActions()),
    getAvailableChanceCards: (pendingCards = []) => (
      savedHandViewer ? null : canonicalController.getAvailableChanceCards(pendingCards)
    ),
    getDiagnostics: () => canonicalController.getDiagnostics(),
  });

  Object.defineProperty(browserWindow, 'RiverlinePlaybookState', {
    configurable: true,
    enumerable: false,
    value: bridge,
    writable: false,
  });
  return bridge;
}

if (typeof window !== 'undefined') installPlaybookStateSourceBridge(window);

export { PLAYBOOK_MODES };
