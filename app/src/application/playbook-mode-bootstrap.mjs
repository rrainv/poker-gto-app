import { createCanonicalLiveController } from './canonical-live-controller.mjs';
import {
  PLAYBOOK_MODES,
  createPlaybookModeController,
  createPlaybookScenarioInput,
  createPlaybookViewModel,
} from './playbook-state-source.mjs';
import { createTablePresenceViewModel } from './table-presence-view-model.mjs';
import { createReplayTimelineViewModel } from './replay-timeline-view-model.mjs';
import {
  REPLAY_FRAME_OPERATIONS,
  createReplayProjectionController,
} from './replay-projection-controller.mjs';

export const PLAYBOOK_STATE_CHANGE_EVENT = 'riverline:playbook-state-change';

export function installPlaybookStateSourceBridge(browserWindow, {
  canonicalController = createCanonicalLiveController({ enabled: true }),
} = {}) {
  if (!browserWindow) return null;
  const modeController = createPlaybookModeController({ canonicalController });
  const replayController = createReplayProjectionController({
    getLiveState: () => canonicalController.getState(),
    getHeroPlayerId: () => canonicalController.getHeroPlayerId(),
  });

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
    if (replayController.isReplayActive()) return null;
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

  const bridge = Object.freeze({
    getMode: () => modeController.getMode(),

    setMode(mode, scenarioInput) {
      const result = modeController.setMode(mode, scenarioInput);
      if (result?.mode === PLAYBOOK_MODES.SCENARIO) replayController.returnToLive();
      return publish('mode', result);
    },

    createScenarioInput: createPlaybookScenarioInput,

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
      return createTablePresenceViewModel({
        state: canonicalController.getState(),
        heroPlayerId: canonicalController.getHeroPlayerId(),
      });
    },

    createReplayTimelineViewModel() {
      return createReplayTimelineViewModel({
        state: canonicalController.getState(),
        heroPlayerId: canonicalController.getHeroPlayerId(),
      });
    },

    createReplayProjectionViewModel() {
      return modeController.getMode() === PLAYBOOK_MODES.HAND
        ? replayController.getProjection()
        : null;
    },

    previousReplayFrame() {
      if (modeController.getMode() !== PLAYBOOK_MODES.HAND) return null;
      return publish('replay_previous', replayController.previous());
    },

    nextReplayFrame() {
      if (modeController.getMode() !== PLAYBOOK_MODES.HAND) return null;
      return publish('replay_next', replayController.next());
    },

    returnReplayToLive() {
      if (modeController.getMode() !== PLAYBOOK_MODES.HAND) return null;
      return publish('replay_live', replayController.returnToLive());
    },

    getResolution: () => modeController.getResolution(),
    getScenarioInput: () => modeController.getLastScenarioInput(),

    initializeHand(configuration) {
      const result = canonicalController.initialize(configuration);
      replayController.replaceHand({
        state: result,
        heroPlayerId: canonicalController.getHeroPlayerId(),
        operation: REPLAY_FRAME_OPERATIONS.INITIALIZE_HAND,
      });
      return publish('initialize_hand', result);
    },

    resetHand() {
      canonicalController.reset();
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

    getState: () => canonicalController.getState(),
    getHeroPlayerId: () => canonicalController.getHeroPlayerId(),
    getLegalActions: () => canonicalController.getLegalActions(),
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
