import { createCanonicalLiveController } from './canonical-live-controller.mjs';
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
  createReplayProjectionController,
} from './replay-projection-controller.mjs';
import { createReplayPlaybackController } from './replay-playback-controller.mjs';
import {
  TABLE_INTERACTIONS,
  TABLE_PROJECTIONS,
  TABLE_VISUAL_STATES,
  createTablePresentation,
} from './table-presentation.mjs';

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

  const publishLiveTransition = (operation, frameOperation, transition) => {
    if (savedHandViewer || replayController.isReplayActive()) return null;
    const result = transition();
    if (result) {
      replayController.recordTransition({
        state: result,
        heroPlayerId: canonicalController.getHeroPlayerId(),
        operation: frameOperation,
      });
    }
    return publish(operation, result);
  };

  const playbackController = createReplayPlaybackController({
    ...replayPlaybackOptions,
    getProjection: () => activeReplayController().getProjection(),
    advance: () => activeReplayController().advancePlayback(),
    onAdvance: (projection) => publish('replay_playback_tick', projection),
  });

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

    resolveDecisionContext(scenarioInput, deriveScenarioDecisionContext) {
      return modeController.resolve({ scenarioInput, deriveScenarioDecisionContext });
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
            kind: 'saved_hand',
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
      return modeController.getMode() === PLAYBOOK_MODES.HAND && !savedHandViewer
        ? canonicalController.createCanonicalHandReplaySource()
        : null;
    },

    getHeroDecisionJournal() {
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
      return modeController.getMode() === PLAYBOOK_MODES.HAND && !savedHandViewer
        ? canonicalController.getCompletedHandResult()
        : null;
    },

    getCanonicalHandSourceId() {
      return canonicalController.getState() && !savedHandViewer ? canonicalHandSourceId : null;
    },

    createReplayPlaybackViewModel() {
      return playbackController.getState();
    },

    startReplayPlayback() {
      if (modeController.getMode() !== PLAYBOOK_MODES.HAND) return null;
      const activeController = activeReplayController();
      if (!activeController.isReplayActive()) activeController.beginPlayback();
      const playback = playbackController.start();
      return publish('replay_playback_start', {
        playback,
        projection: activeController.getProjection(),
      });
    },

    pauseReplayPlayback() {
      if (modeController.getMode() !== PLAYBOOK_MODES.HAND) return null;
      const playback = playbackController.pause();
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

    openSavedHand({ objectId, title = null, pokerState, heroPlayerId, replaySource } = {}) {
      playbackController.cancel();
      const modeResult = modeController.setMode(
        PLAYBOOK_MODES.HAND,
        modeController.getLastScenarioInput() || createPlaybookScenarioInput({}),
      );
      if (modeResult.mode !== PLAYBOOK_MODES.HAND) {
        throw new RangeError('Saved Hand could not enter Hand Mode');
      }
      savedReplayController.replaceFromCanonicalHandReplaySource(replaySource, { readOnly: true });
      savedHandViewer = Object.freeze({
        objectId,
        title,
        pokerState,
        heroPlayerId,
        hasLiveHand: Boolean(canonicalController.getState()),
      });
      return publish('saved_hand_open', bridge.createReplayProjectionViewModel());
    },

    closeSavedHand() {
      if (!savedHandViewer) return bridge.createReplayProjectionViewModel();
      playbackController.cancel();
      closeSavedHandViewer();
      return publish('saved_hand_close', replayController.getProjection());
    },

    hasLiveHand() {
      return Boolean(canonicalController.getState());
    },

    getResolution: () => modeController.getResolution(),
    getScenarioInput: () => modeController.getLastScenarioInput(),

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
      );
    },

    dealObservedHoleCards(cardsByPlayer) {
      return publishLiveTransition(
        'deal_hole_observed',
        REPLAY_FRAME_OPERATIONS.DEAL_HOLE_OBSERVED,
        () => canonicalController.dealObservedHoleCards(cardsByPlayer),
      );
    },

    revealHoleCards(playerId, cards) {
      return publishLiveTransition(
        'reveal_hole',
        REPLAY_FRAME_OPERATIONS.REVEAL_HOLE,
        () => canonicalController.revealHoleCards(playerId, cards),
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
