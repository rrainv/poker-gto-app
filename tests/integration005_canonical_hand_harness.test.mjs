import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import {
  ACTION_TYPES,
  GAME_MODES,
  PHASES,
  STREETS,
} from '../shared/poker-domain/index.js';
import {
  buildCanonicalHarnessViewModel,
  renderCanonicalHarnessMarkup,
} from '../app/src/application/canonical-hand-harness.mjs';
import { createCanonicalLiveController } from '../app/src/application/canonical-live-controller.mjs';
import { installCanonicalLiveBridge } from '../app/src/application/canonical-live-bootstrap.mjs';

const HOLE_CARDS = Object.freeze([
  ['As', 'Ad'], ['Kh', 'Kd'], ['Qh', 'Qd'], ['Jh', 'Jd'], ['Th', 'Td'],
  ['9h', '9d'], ['8h', '8d'], ['7h', '7d'], ['6h', '6d'], ['5h', '5d'],
]);
const FLOP = Object.freeze(['2c', '3d', '4s']);
const TURN = Object.freeze(['9c']);
const RIVER = Object.freeze(['Tc']);

function configuration(overrides = {}) {
  return {
    tableSize: 2,
    gameMode: GAME_MODES.HOME,
    stackBb: 100,
    stackMode: 'hero',
    buttonSeat: 0,
    heroSeat: 0,
    anteType: 'none',
    anteBb: 0,
    straddleBb: 0,
    ...overrides,
  };
}

function enabledController(overrides = {}) {
  const controller = createCanonicalLiveController({ enabled: true });
  assert.ok(controller.initialize(configuration(overrides)));
  return controller;
}

function cardsByPlayer(state) {
  return Object.fromEntries(
    state.players.map((player, index) => [player.playerId, HOLE_CARDS[index]]),
  );
}

function deal(controller) {
  const state = controller.dealHoleCards(cardsByPlayer(controller.getState()));
  assert.ok(state, controller.getDiagnostics().error?.message);
  return state;
}

function view(controller, diagnostics = controller.getDiagnostics()) {
  return buildCanonicalHarnessViewModel({
    enabled: controller.isEnabled(),
    state: controller.getState(),
    heroPlayerId: controller.getHeroPlayerId(),
    diagnostics,
    legalActions: controller.getLegalActions(),
  });
}

const MARKUP_DRAFT = Object.freeze({
  configurationDraft: {
    tableSize: 2,
    gameMode: 'home',
    stackBb: 100,
    buttonSeat: 0,
    heroSeat: 0,
    anteType: 'none',
    anteBb: 0,
  },
});

function createFakeBrowser() {
  const windowListeners = new Map();
  const bodyListeners = new Map();
  const panel = {
    hidden: false,
    attributes: {},
    setAttribute(name, value) { this.attributes[name] = value; },
  };
  const body = {
    innerHTML: '',
    addEventListener(type, listener) { bodyListeners.set(type, listener); },
  };
  const values = new Map(Object.entries({
    players: '2', stack: '100', stackMode: 'hero', heroPos: 'BTN',
    rakeMode: 'off', ante: '0', straddle: '0',
  }));
  const document = {
    getElementById(id) {
      if (id === 'canonicalDevHarness') return panel;
      if (id === 'canonicalDevHarnessBody') return body;
      return values.has(id) ? { value: values.get(id) } : null;
    },
  };
  class FakeCustomEvent {
    constructor(type, init) {
      this.type = type;
      this.detail = init?.detail;
    }
  }
  const browserWindow = {
    app: { decisionContext: null },
    console: { debug() {} },
    CustomEvent: FakeCustomEvent,
    document,
    addEventListener(type, listener) { windowListeners.set(type, listener); },
    dispatchEvent(event) {
      windowListeners.get(event.type)?.(event);
      return true;
    },
  };
  return { browserWindow, panel, body, bodyListeners };
}

function clickCommand(listener, command) {
  listener({
    target: {
      closest(selector) {
        return selector === '[data-canonical-command]'
          ? { dataset: { canonicalCommand: command } }
          : null;
      },
    },
  });
}

test('harness is hidden by default, follows the existing flag, and reload state is off', () => {
  const environment = createFakeBrowser();
  const bridge = installCanonicalLiveBridge(environment.browserWindow);
  assert.equal(bridge.isEnabled(), false);
  assert.equal(environment.panel.hidden, true);
  assert.equal(environment.panel.attributes['aria-hidden'], 'true');
  assert.equal(environment.body.innerHTML, '');

  bridge.setEnabled(true);
  assert.equal(environment.panel.hidden, false);
  assert.equal(environment.panel.attributes['aria-hidden'], 'false');
  assert.match(environment.body.innerHTML, /Start \/ reset hand/);

  bridge.setEnabled(false);
  assert.equal(environment.panel.hidden, true);
  assert.equal(environment.body.innerHTML, '');

  const reloaded = createFakeBrowser();
  installCanonicalLiveBridge(reloaded.browserWindow);
  assert.equal(reloaded.panel.hidden, true);
});

test('harness Start/reset and Clear controls own only the canonical session', () => {
  const environment = createFakeBrowser();
  const bridge = installCanonicalLiveBridge(environment.browserWindow);
  bridge.setEnabled(true);
  const click = environment.bodyListeners.get('click');

  clickCommand(click, 'start');
  assert.equal(bridge.getState().players.length, 2);
  assert.equal(bridge.getState().game.mode, GAME_MODES.HOME);
  assert.equal(bridge.getHeroPlayerId(), 'seat-0');

  const first = bridge.getState();
  clickCommand(click, 'start');
  assert.notEqual(bridge.getState(), first);

  clickCommand(click, 'clear');
  assert.equal(bridge.getState(), null);
  assert.match(environment.body.innerHTML, /No canonical session/);
});

test('explicit button and hero seats initialize HU and six-max layouts', () => {
  const hu = enabledController({ buttonSeat: 1, heroSeat: 0 });
  assert.equal(hu.getState().buttonSeat, 1);
  assert.equal(hu.getHeroPlayerId(), 'seat-0');
  assert.equal(hu.getState().players.find((player) => player.seat === 1).position, 'BTN');

  const sixMax = enabledController({ tableSize: 6, buttonSeat: 3, heroSeat: 5 });
  assert.equal(sixMax.getState().players.length, 6);
  assert.equal(sixMax.getState().buttonSeat, 3);
  assert.equal(sixMax.getHeroPlayerId(), 'seat-5');
  assert.equal(view(sixMax).players.filter((player) => player.isButton).length, 1);
  assert.equal(view(sixMax).players.filter((player) => player.isHero).length, 1);
});

test('ClubGG harness sessions accept 7, 9, and 10 players and expose deductions outside pot', () => {
  for (const tableSize of [7, 9, 10]) {
    const controller = enabledController({
      tableSize,
      gameMode: GAME_MODES.CLUBGG,
      stackBb: 200,
      heroSeat: 0,
    });
    const model = view(controller);
    assert.equal(model.deductionBb, tableSize / 10);
    assert.equal(model.potBb, 1.5);
    assert.equal(controller.getState().game.forcedContributionPerPlayerMilliBb, 100);
  }
});

test('invalid harness configuration fails closed with no canonical state', () => {
  const controller = createCanonicalLiveController({ enabled: true });
  assert.equal(controller.initialize(configuration({ buttonSeat: 3 })), null);
  assert.equal(controller.getState(), null);
  assert.match(controller.getDiagnostics().error.message, /buttonSeat/);

  assert.equal(controller.initialize(configuration({
    tableSize: 6,
    gameMode: GAME_MODES.CLUBGG,
  })), null);
  assert.equal(controller.getState(), null);
  assert.match(controller.getDiagnostics().error.message, /7 through 10/);
});

test('complete private deal is canonical and duplicate cards leave state unchanged', () => {
  const controller = enabledController({ tableSize: 6 });
  const initial = controller.getState();
  const mapping = cardsByPlayer(initial);
  mapping['seat-1'] = [...mapping['seat-0']];

  assert.equal(controller.dealHoleCards(mapping), null);
  assert.equal(controller.getState(), initial);
  assert.match(controller.getDiagnostics().error.message, /Duplicate.*card/i);

  assert.ok(controller.dealHoleCards(cardsByPlayer(initial)));
  assert.equal(controller.getState().phase, PHASES.BETTING);
  assert.equal(controller.getState().players.every((player) => player.holeCards.length === 2), true);
});

test('pending chance view enables only flop, turn, and river in sequence', () => {
  const controller = enabledController();
  deal(controller);
  controller.applyAction({ type: ACTION_TYPES.CALL });
  controller.applyAction({ type: ACTION_TYPES.CHECK });
  assert.equal(view(controller).pendingChance, 'deal_flop');
  assert.equal(view(controller).pendingCardCount, 3);
  assert.match(renderCanonicalHarnessMarkup(view(controller), MARKUP_DRAFT), /data-canonical-command="deal-board"/);

  controller.dealBoardCards(FLOP);
  controller.applyAction({ type: ACTION_TYPES.CHECK });
  controller.applyAction({ type: ACTION_TYPES.CHECK });
  assert.equal(view(controller).pendingChance, 'deal_turn');
  assert.equal(view(controller).pendingCardCount, 1);

  controller.dealBoardCards(TURN);
  controller.applyAction({ type: ACTION_TYPES.CHECK });
  controller.applyAction({ type: ACTION_TYPES.CHECK });
  assert.equal(view(controller).pendingChance, 'deal_river');
  assert.equal(view(controller).pendingCardCount, 1);
});

test('legal-action UI is sourced from canonical spec with call and raise-to bounds', () => {
  const controller = enabledController();
  deal(controller);
  const spec = controller.getLegalActions();
  const model = view(controller);
  const markup = renderCanonicalHarnessMarkup(model, MARKUP_DRAFT);

  assert.equal(spec.call.commitMilliBb, 500);
  assert.equal(spec.raise.minToMilliBb, 2000);
  assert.equal(spec.raise.maxToMilliBb, 99_900);
  assert.deepEqual(model.actions.map((action) => action.type), ['fold', 'call', 'raise', 'all_in']);
  assert.match(markup, /Call 0\.5bb/);
  assert.match(markup, /min 2 · max 99\.9/);
  assert.doesNotMatch(markup, /data-canonical-action="check"/);
  assert.doesNotMatch(markup, /data-canonical-action="bet"/);
});

test('actions update actor, phase, pot, and seat status while illegal actions are atomic', () => {
  const controller = enabledController({ tableSize: 6 });
  deal(controller);
  const initialActor = controller.getState().actingPlayerId;
  const initialPot = view(controller).potBb;
  assert.ok(controller.applyAction({ type: ACTION_TYPES.FOLD }));
  assert.notEqual(controller.getState().actingPlayerId, initialActor);
  assert.equal(view(controller).players.find((player) => player.playerId === initialActor).folded, true);
  assert.equal(view(controller).potBb, initialPot);

  const beforeInvalid = controller.getState();
  assert.equal(controller.applyAction({ type: ACTION_TYPES.CHECK }), null);
  assert.equal(controller.getState(), beforeInvalid);
  assert.equal(controller.getDiagnostics().status, 'error');

  const beforeInvalidShowdown = controller.getState();
  assert.equal(controller.resolveShowdown(), null);
  assert.equal(controller.getState(), beforeInvalidShowdown);
  assert.equal(controller.getDiagnostics().status, 'error');
});

test('fold terminal state and payouts render from canonical state', () => {
  const controller = enabledController();
  deal(controller);
  controller.applyAction({ type: ACTION_TYPES.FOLD });
  const model = view(controller);
  const markup = renderCanonicalHarnessMarkup(model, MARKUP_DRAFT);

  assert.equal(model.phase, PHASES.TERMINAL);
  assert.equal(model.terminalReason, 'fold');
  assert.deepEqual(model.terminalWinners, ['seat-1']);
  assert.match(markup, /Terminal · fold/);
  assert.match(markup, /Payout seat-1/);
});

test('HU checkdown reaches explicit showdown settlement with winners, payouts, and ranks', () => {
  const controller = enabledController();
  deal(controller);
  controller.applyAction({ type: ACTION_TYPES.CALL });
  controller.applyAction({ type: ACTION_TYPES.CHECK });
  controller.dealBoardCards(FLOP);
  controller.applyAction({ type: ACTION_TYPES.CHECK });
  controller.applyAction({ type: ACTION_TYPES.CHECK });
  controller.dealBoardCards(TURN);
  controller.applyAction({ type: ACTION_TYPES.CHECK });
  controller.applyAction({ type: ACTION_TYPES.CHECK });
  controller.dealBoardCards(RIVER);
  controller.applyAction({ type: ACTION_TYPES.CHECK });
  controller.applyAction({ type: ACTION_TYPES.CHECK });

  assert.equal(controller.getState().phase, PHASES.SHOWDOWN);
  assert.match(renderCanonicalHarnessMarkup(view(controller), MARKUP_DRAFT), /Settle showdown/);
  assert.ok(controller.resolveShowdown());
  const model = view(controller);
  const markup = renderCanonicalHarnessMarkup(model, MARKUP_DRAFT);
  assert.equal(model.phase, PHASES.TERMINAL);
  assert.equal(model.terminalReason, 'showdown');
  assert.deepEqual(model.terminalWinners, ['seat-0']);
  assert.equal(model.payouts[0].amountBb, 2);
  assert.equal(model.handRanks.find((entry) => entry.playerId === 'seat-0').category, 'one_pair');
  assert.match(markup, /Payout seat-0: 2bb/);
  assert.match(markup, /one pair/);
});

test('diagnostic display distinguishes match, mismatch, unavailable, and error', () => {
  const base = { enabled: true, state: null, heroPlayerId: null, legalActions: null };
  const cases = [
    [{ status: 'compared', matches: true, comparison: { mismatches: [] } }, /Match/],
    [{ status: 'compared', matches: false, comparison: { mismatches: [{ field: 'potBb', legacyValue: 2, canonicalValue: 1.5 }] } }, /potBb: legacy 2 · canonical 1\.5/],
    [{ status: 'unavailable', reason: 'hero_not_actor' }, /Unavailable · hero_not_actor/],
    [{ status: 'error', error: { message: 'bad transition' } }, /bad transition/],
  ];
  for (const [diagnostics, pattern] of cases) {
    const model = buildCanonicalHarnessViewModel({ ...base, diagnostics });
    assert.match(renderCanonicalHarnessMarkup(model, MARKUP_DRAFT), pattern);
  }
});

test('harness remains isolated from legacy StrategyResult and poker rules', () => {
  const htmlSource = fs.readFileSync(new URL('../app/index.html', import.meta.url), 'utf8');
  const logicSource = fs.readFileSync(new URL('../app/src/core/logic.js', import.meta.url), 'utf8');
  const harnessSource = fs.readFileSync(
    new URL('../app/src/application/canonical-hand-harness.mjs', import.meta.url),
    'utf8',
  );

  assert.match(htmlSource, /id="canonicalDevHarness"[^>]*hidden/);
  assert.match(logicSource, /const strategyResult = actionProfile\(null, decisionContext\);/);
  assert.doesNotMatch(harnessSource, /actionProfile|StrategyResult|calculatePreflop|calculateUnified/);
  assert.doesNotMatch(harnessSource, /minimumRaise|minimumBet|amountToCall|applyChance\(/);
  assert.match(harnessSource, /bridge\.getLegalActions\(\)/);
  assert.match(harnessSource, /bridge\.applyAction\(action, amount\)/);
});
