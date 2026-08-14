import { createCanonicalLiveController } from './canonical-live-controller.mjs';
import {
  PLAYBOOK_MODES,
  createPlaybookModeController,
  createPlaybookScenarioInput,
  createPlaybookViewModel,
} from './playbook-state-source.mjs';
import { createTablePresenceViewModel } from './table-presence-view-model.mjs';

export const PLAYBOOK_STATE_CHANGE_EVENT = 'riverline:playbook-state-change';

export function installPlaybookStateSourceBridge(browserWindow, {
  canonicalController = createCanonicalLiveController({ enabled: true }),
} = {}) {
  if (!browserWindow) return null;
  const modeController = createPlaybookModeController({ canonicalController });

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

  const bridge = Object.freeze({
    getMode: () => modeController.getMode(),

    setMode(mode, scenarioInput) {
      return publish('mode', modeController.setMode(mode, scenarioInput));
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

    getResolution: () => modeController.getResolution(),
    getScenarioInput: () => modeController.getLastScenarioInput(),

    initializeHand(configuration) {
      return publish('initialize_hand', canonicalController.initialize(configuration));
    },

    resetHand() {
      canonicalController.reset();
      return publish('reset_hand', null);
    },

    dealHoleCards(cardsByPlayer) {
      return publish('deal_hole', canonicalController.dealHoleCards(cardsByPlayer));
    },

    dealObservedHoleCards(cardsByPlayer) {
      return publish('deal_hole_observed', canonicalController.dealObservedHoleCards(cardsByPlayer));
    },

    revealHoleCards(playerId, cards) {
      return publish('reveal_hole', canonicalController.revealHoleCards(playerId, cards));
    },

    dealBoardCards(cards) {
      return publish('deal_board', canonicalController.dealBoardCards(cards));
    },

    applyAction(type, amountToBb = null) {
      return publish('action', canonicalController.applyAction({ type, amountToBb }));
    },

    resolveShowdown() {
      return publish('showdown', canonicalController.resolveShowdown());
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
