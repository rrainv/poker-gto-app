import {
  CANONICAL_LIVE_DEFAULT_ENABLED,
  createCanonicalLiveController,
} from './canonical-live-controller.mjs';
import {
  CANONICAL_DEV_CHANGE_EVENT,
  installCanonicalHandHarness,
} from './canonical-hand-harness.mjs';

function controlValue(documentObject, id, fallback = '') {
  const control = documentObject.getElementById(id);
  return control ? control.value : fallback;
}

/**
 * Browser boundary only. A fixed development button seat (seat 0) is used by
 * the controller because Playbook has no button/seat editor. The canonical
 * engine still derives every position and the requested hero position must
 * resolve to exactly one of those stable seats.
 */
export function readCanonicalPlaybookConfiguration(documentObject) {
  const rakeMode = controlValue(documentObject, 'rakeMode', 'off');
  const anteBb = Number(controlValue(documentObject, 'ante', 0));
  return {
    tableSize: Number(controlValue(documentObject, 'players', 0)),
    gameMode: rakeMode === 'off' ? 'home' : rakeMode === 'fixed' ? 'clubgg' : rakeMode,
    stackBb: Number(controlValue(documentObject, 'stack', 0)),
    stackMode: controlValue(documentObject, 'stackMode', 'hero'),
    heroPosition: controlValue(documentObject, 'heroPos', ''),
    anteType: anteBb > 0 ? 'per_player' : 'none',
    anteBb,
    straddleBb: Number(controlValue(documentObject, 'straddle', 0)),
  };
}

export function installCanonicalLiveBridge(browserWindow) {
  if (!browserWindow || !browserWindow.document) return null;

  const controller = createCanonicalLiveController({
    enabled: CANONICAL_LIVE_DEFAULT_ENABLED,
  });

  const emitDiagnostics = (operation) => {
    const result = controller.getDiagnostics();
    if (controller.isEnabled() && browserWindow.console?.debug) {
      browserWindow.console.debug(`[Riverline canonical shadow] ${operation}`, result);
    }
    return result;
  };

  const publish = (operation) => {
    const result = emitDiagnostics(operation);
    if (typeof browserWindow.dispatchEvent === 'function'
      && typeof browserWindow.CustomEvent === 'function') {
      browserWindow.dispatchEvent(new browserWindow.CustomEvent(
        CANONICAL_DEV_CHANGE_EVENT,
        { detail: { operation, diagnostics: result } },
      ));
    }
    return result;
  };

  const compareCurrentContext = () => {
    const result = controller.compare(browserWindow.app?.decisionContext ?? null);
    return publish('compare');
  };

  const bridge = Object.freeze({
    isEnabled() {
      return controller.isEnabled();
    },

    setEnabled(enabled) {
      const result = controller.setEnabled(enabled === true);
      publish(enabled === true ? 'enabled' : 'disabled');
      return result;
    },

    initialize(configuration) {
      const state = controller.initialize(configuration);
      publish('initialize');
      return state;
    },

    initializeFromCurrentControls() {
      const state = controller.initialize(
        readCanonicalPlaybookConfiguration(browserWindow.document),
      );
      publish('initialize');
      return state;
    },

    configurationChanged() {
      if (!controller.isEnabled()) return controller.getDiagnostics();
      return bridge.initializeFromCurrentControls();
    },

    heroCardsChanged(cards) {
      if (!controller.isEnabled()) return controller.getDiagnostics();
      controller.setHeroHoleCards(cards);
      publish('hero_cards');
      return controller.getDiagnostics();
    },

    boardCardsChanged(cards) {
      if (!controller.isEnabled()) return controller.getDiagnostics();
      const state = controller.getState();
      const expectedTotal = state?.pendingChance?.type === 'deal_flop' ? 3
        : state?.pendingChance?.type === 'deal_turn' ? 4
          : state?.pendingChance?.type === 'deal_river' ? 5
            : null;
      const hasCanonicalPrefix = Array.isArray(cards)
        && state
        && state.board.every((card, index) => cards[index] === card);
      if (expectedTotal === null || cards.length !== expectedTotal || !hasCanonicalPrefix) {
        return controller.getDiagnostics();
      }
      controller.dealBoardCards(cards.slice(state.board.length));
      publish('board_cards');
      return controller.getDiagnostics();
    },

    dealHoleCards(cardsByPlayer) {
      const state = controller.dealHoleCards(cardsByPlayer);
      if (state) compareCurrentContext();
      else publish('deal_hole');
      return state;
    },

    dealBoardCards(cards) {
      const state = controller.dealBoardCards(cards);
      if (state) compareCurrentContext();
      else publish('deal_board');
      return state;
    },

    applyAction(type, amountToBb = null) {
      const state = controller.applyAction({ type, amountToBb });
      if (state) compareCurrentContext();
      else publish('action');
      return state;
    },

    resolveShowdown() {
      const state = controller.resolveShowdown();
      if (state) compareCurrentContext();
      else publish('showdown');
      return state;
    },

    compare() {
      return compareCurrentContext();
    },

    reset() {
      controller.reset();
      return publish('reset');
    },

    getState() {
      return controller.getState();
    },

    getHeroPlayerId() {
      return controller.getHeroPlayerId();
    },

    getDiagnostics() {
      return controller.getDiagnostics();
    },

    getLegalActions() {
      return controller.getLegalActions();
    },
  });

  Object.defineProperty(browserWindow, 'RiverlineCanonicalDev', {
    configurable: true,
    enumerable: false,
    value: bridge,
    writable: false,
  });
  installCanonicalHandHarness(browserWindow, bridge);
  return bridge;
}

if (typeof window !== 'undefined') installCanonicalLiveBridge(window);
