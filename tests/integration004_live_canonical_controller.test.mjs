import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import fs from 'node:fs';

import {
  ACTION_TYPES,
  GAME_MODES,
  PHASES,
  STREETS,
} from '../shared/poker-domain/index.js';
import {
  CANONICAL_LIVE_DEFAULT_ENABLED,
  createCanonicalLiveController,
} from '../app/src/application/canonical-live-controller.mjs';
import {
  installCanonicalLiveBridge,
  readCanonicalPlaybookConfiguration,
} from '../app/src/application/canonical-live-bootstrap.mjs';
import { deriveDecisionContextFromPokerState } from '../app/src/application/decision-context-from-poker-state.mjs';

const require = createRequire(import.meta.url);
const legacy = require('./qa002_adapters.js');

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
    heroPosition: 'BTN',
    anteType: 'none',
    anteBb: 0,
    straddleBb: 0,
    ...overrides,
  };
}

function enabledController(overrides = {}) {
  const controller = createCanonicalLiveController({ enabled: true });
  const state = controller.initialize(configuration(overrides));
  assert.ok(state, controller.getDiagnostics().error?.message);
  return controller;
}

function cardsByPlayer(state) {
  return Object.fromEntries(
    state.players.map((player, index) => [player.playerId, HOLE_CARDS[index]]),
  );
}

function deal(controller) {
  const state = controller.getState();
  const heroCards = cardsByPlayer(state)[controller.getHeroPlayerId()];
  controller.setHeroHoleCards(heroCards);
  const dealt = controller.dealHoleCards(cardsByPlayer(state));
  assert.ok(dealt, controller.getDiagnostics().error?.message);
  return dealt;
}

function legacyEquivalent(projected) {
  return legacy.deriveDecisionContext({
    tableSize: projected.tableSize,
    heroPosition: projected.heroPosition,
    heroCards: projected.heroCards,
    board: projected.board,
    deadCards: projected.deadCards,
    stackBb: projected.stackBb,
    stackMode: projected.stackMode,
    potBb: projected.potBb,
    lastAction: projected.lastAction,
    facingSizeBb: projected.facingSizeBb,
    rakeMode: projected.rakeMode,
    legacyRakeValue: projected.legacyRakePercent,
  });
}

test('feature flag defaults off and off operations have no session or shadow side effects', () => {
  assert.equal(CANONICAL_LIVE_DEFAULT_ENABLED, false);
  const controller = createCanonicalLiveController();
  const legacyContext = Object.freeze({ marker: 'authoritative' });

  assert.equal(controller.initialize(configuration()), null);
  assert.equal(controller.getState(), null);
  assert.equal(controller.setHeroHoleCards(['As', 'Ad']), null);
  assert.equal(controller.compare(legacyContext).status, 'disabled');
  assert.deepEqual(legacyContext, { marker: 'authoritative' });
});

test('controller creates Home HU and six-max sessions with stable seats and hero mapping', () => {
  for (const [tableSize, heroPosition] of [[2, 'BTN'], [6, 'CO']]) {
    const controller = enabledController({ tableSize, heroPosition });
    const state = controller.getState();
    assert.equal(state.game.mode, GAME_MODES.HOME);
    assert.equal(state.players.length, tableSize);
    assert.deepEqual(state.players.map((player) => player.playerId),
      Array.from({ length: tableSize }, (_, seat) => `seat-${seat}`));
    assert.deepEqual(state.players.map((player) => player.seat),
      Array.from({ length: tableSize }, (_, seat) => seat));
    assert.equal(
      state.players.find((player) => player.playerId === controller.getHeroPlayerId()).position,
      heroPosition,
    );
    assert.equal(state.deductionTotalMilliBb, 0);
  }
});

test('10-max maps every canonical position and selected hero without fallback', () => {
  const positions = ['UTG', 'UTG+1', 'UTG+2', 'MP', 'LJ', 'HJ', 'CO', 'BTN', 'SB', 'BB'];
  for (const heroPosition of positions) {
    const controller = enabledController({ tableSize: 10, heroPosition });
    const state = controller.getState();
    assert.deepEqual([...new Set(state.players.map((player) => player.position))].sort(),
      [...positions].sort());
    const hero = state.players.find((player) => player.playerId === controller.getHeroPlayerId());
    assert.equal(hero.position, heroPosition);
  }
});

test('controller preserves exact ClubGG deductions for 7, 9, and 10 players', () => {
  for (const tableSize of [7, 9, 10]) {
    const controller = enabledController({
      tableSize,
      gameMode: GAME_MODES.CLUBGG,
      heroPosition: 'BTN',
    });
    const state = controller.getState();
    assert.equal(state.game.forcedContributionPerPlayerMilliBb, 100);
    assert.equal(state.deductionTotalMilliBb, tableSize * 100);
    assert.equal(state.potMilliBb, 1500);
  }
});

test('configuration changes reset the hand and invalid mappings fail closed', () => {
  const controller = enabledController();
  const first = controller.getState();
  controller.setHeroHoleCards(['As', 'Ad']);
  const replacement = controller.initialize(configuration({ tableSize: 6, heroPosition: 'HJ' }));
  assert.ok(replacement);
  assert.notEqual(replacement, first);
  assert.equal(replacement.players.length, 6);
  assert.deepEqual(controller.getStagedHeroCards(), []);

  assert.equal(controller.initialize(configuration({ tableSize: 6, heroPosition: 'UTG+2' })), null);
  assert.equal(controller.getState(), null);
  assert.equal(controller.getDiagnostics().status, 'error');
  assert.match(controller.getDiagnostics().error.message, /heroPosition/);
});

test('unsupported ClubGG sizes and straddles reject session creation instead of inventing history', () => {
  const controller = createCanonicalLiveController({ enabled: true });
  assert.equal(controller.initialize(configuration({
    tableSize: 6,
    gameMode: GAME_MODES.CLUBGG,
  })), null);
  assert.match(controller.getDiagnostics().error.message, /7 through 10/);

  assert.equal(controller.initialize(configuration({ straddleBb: 2 })), null);
  assert.equal(controller.getState(), null);
  assert.match(controller.getDiagnostics().error.message, /straddles/);
});

test('hero card events stage cards and complete deals use deterministic canonical chance', () => {
  const controller = enabledController({ tableSize: 6, heroPosition: 'CO' });
  const initial = controller.getState();
  assert.deepEqual(controller.setHeroHoleCards(['As', 'Ad']), ['As', 'Ad']);
  assert.equal(controller.getState(), initial);
  assert.equal(initial.phase, PHASES.CHANCE);

  const mapping = cardsByPlayer(initial);
  const heroPlayerId = controller.getHeroPlayerId();
  const aceHolderId = Object.keys(mapping).find((playerId) => mapping[playerId][0] === 'As');
  mapping[aceHolderId] = mapping[heroPlayerId];
  mapping[heroPlayerId] = ['As', 'Ad'];
  const dealt = controller.dealHoleCards(mapping);
  assert.equal(dealt.phase, PHASES.BETTING);
  assert.deepEqual(
    dealt.players.find((player) => player.playerId === controller.getHeroPlayerId()).holeCards,
    ['As', 'Ad'],
  );
});

test('flop, turn, and river advance only through legal explicit chance events', () => {
  const controller = enabledController();
  deal(controller);
  assert.ok(controller.applyAction({ type: ACTION_TYPES.CALL }));
  assert.ok(controller.applyAction({ type: ACTION_TYPES.CHECK }));

  assert.equal(controller.dealBoardCards(FLOP).street, STREETS.FLOP);
  controller.applyAction({ type: ACTION_TYPES.CHECK });
  controller.applyAction({ type: ACTION_TYPES.CHECK });
  assert.equal(controller.dealBoardCards(TURN).street, STREETS.TURN);
  controller.applyAction({ type: ACTION_TYPES.CHECK });
  controller.applyAction({ type: ACTION_TYPES.CHECK });
  assert.equal(controller.dealBoardCards(RIVER).street, STREETS.RIVER);
  assert.deepEqual(controller.getState().board, [...FLOP, ...TURN, ...RIVER]);
});

test('invalid arbitrary scenario sequence leaves canonical and legacy state unchanged', () => {
  const controller = enabledController();
  const canonicalBefore = controller.getState();
  const legacyContext = { potBb: 42, lastAction: '4bet' };
  const legacyBefore = structuredClone(legacyContext);

  assert.equal(controller.dealBoardCards(FLOP), null);
  assert.equal(controller.getState(), canonicalBefore);
  assert.deepEqual(legacyContext, legacyBefore);
  assert.equal(controller.getDiagnostics().status, 'error');

  const dealtController = enabledController();
  deal(dealtController);
  const dealtBefore = dealtController.getState();
  assert.equal(dealtController.setHeroHoleCards(['Qc', 'Qd']), null);
  assert.equal(dealtController.getState(), dealtBefore);
  assert.match(dealtController.getDiagnostics().error.message, /cannot change after/);
});

test('all six structural action types advance canonical state where legal', () => {
  const called = enabledController();
  deal(called);
  const beforeCall = called.getState();
  assert.notEqual(called.applyAction({ type: ACTION_TYPES.CALL }), beforeCall);
  assert.equal(called.getState().actionHistory.at(-1).submittedAction.type, ACTION_TYPES.CALL);

  const raised = enabledController();
  deal(raised);
  assert.ok(raised.applyAction({ type: ACTION_TYPES.RAISE, amountToBb: 3 }));
  assert.equal(raised.getState().currentBetMilliBb, 3000);

  const checked = enabledController();
  deal(checked);
  checked.applyAction({ type: ACTION_TYPES.CALL });
  assert.ok(checked.applyAction({ type: ACTION_TYPES.CHECK }));
  assert.equal(checked.getState().pendingChance.type, 'deal_flop');

  const folded = enabledController();
  deal(folded);
  assert.ok(folded.applyAction({ type: ACTION_TYPES.FOLD }));
  assert.equal(folded.getState().terminal.isTerminal, true);

  const betted = enabledController();
  deal(betted);
  betted.applyAction({ type: ACTION_TYPES.CALL });
  betted.applyAction({ type: ACTION_TYPES.CHECK });
  betted.dealBoardCards(FLOP);
  assert.ok(betted.applyAction({ type: ACTION_TYPES.BET, amountToBb: 2 }));
  assert.equal(betted.getState().currentBetMilliBb, 2000);

  const allIn = enabledController();
  deal(allIn);
  assert.ok(allIn.applyAction({ type: ACTION_TYPES.ALL_IN }));
  assert.equal(allIn.getState().actionHistory.at(-1).submittedAction.type, ACTION_TYPES.ALL_IN);
});

test('invalid action records an error and does not replace the session state', () => {
  const controller = enabledController();
  deal(controller);
  const before = controller.getState();
  assert.equal(controller.applyAction({ type: ACTION_TYPES.CHECK }), null);
  assert.equal(controller.getState(), before);
  assert.equal(controller.getDiagnostics().status, 'error');
});

test('shadow diagnostics record exact matches and field-level mismatches', () => {
  const controller = enabledController();
  deal(controller);
  const canonical = deriveDecisionContextFromPokerState(
    controller.getState(),
    controller.getHeroPlayerId(),
  );
  const legacyContext = legacyEquivalent(canonical);

  const exact = controller.compare(legacyContext);
  assert.equal(exact.status, 'compared');
  assert.equal(exact.matches, true);
  assert.deepEqual(exact.comparison.mismatches, []);

  const mismatch = controller.compare({ ...legacyContext, potBb: legacyContext.potBb + 1 });
  assert.equal(mismatch.status, 'compared');
  assert.equal(mismatch.matches, false);
  assert.deepEqual(mismatch.comparison.mismatches.map((entry) => entry.field), ['potBb']);
  assert.deepEqual(mismatch.comparison.mismatches[0], {
    field: 'potBb',
    legacyValue: 2.5,
    canonicalValue: 1.5,
  });
});

test('hero-not-actor and chance states are unavailable rather than errors', () => {
  const chance = enabledController();
  assert.deepEqual(
    { status: chance.compare({}).status, reason: chance.getDiagnostics().reason },
    { status: 'unavailable', reason: 'chance_state' },
  );

  const notActor = enabledController({ heroPosition: 'BB' });
  deal(notActor);
  const result = notActor.compare({});
  assert.equal(result.status, 'unavailable');
  assert.equal(result.reason, 'hero_not_actor');
  assert.equal(result.error, null);
});

test('shadow failures are contained as diagnostics and never throw into legacy flow', () => {
  const controller = enabledController();
  deal(controller);
  const hostileLegacyContext = new Proxy({}, {
    get() { throw new Error('legacy read failed'); },
  });
  assert.doesNotThrow(() => controller.compare(hostileLegacyContext));
  assert.equal(controller.getDiagnostics().status, 'error');
  assert.match(controller.getDiagnostics().error.message, /legacy read failed/);
});

test('browser configuration adapter reads hand-defining controls and ignores scenario history', () => {
  const values = new Map(Object.entries({
    players: '9', stack: '200', stackMode: 'hero', heroPos: 'LJ',
    rakeMode: 'fixed', ante: '0.2', straddle: '0',
    lastAction: '4bet', facingSize: '20', potSize: '80',
  }));
  const documentObject = {
    getElementById(id) {
      return values.has(id) ? { value: values.get(id) } : null;
    },
  };
  assert.deepEqual(readCanonicalPlaybookConfiguration(documentObject), {
    tableSize: 9,
    gameMode: 'clubgg',
    stackBb: 200,
    stackMode: 'hero',
    heroPosition: 'LJ',
    anteType: 'per_player',
    anteBb: 0.2,
    straddleBb: 0,
  });
});

test('browser bridge is narrow, default-off, and failure-safe', () => {
  const values = new Map(Object.entries({
    players: '2', stack: '100', stackMode: 'hero', heroPos: 'BTN',
    rakeMode: 'off', ante: '0', straddle: '0',
  }));
  const browserWindow = {
    app: { decisionContext: Object.freeze({ legacy: true }) },
    console: { debug() {} },
    document: {
      getElementById(id) {
        return values.has(id) ? { value: values.get(id) } : null;
      },
    },
  };
  const bridge = installCanonicalLiveBridge(browserWindow);
  assert.equal(Object.isFrozen(bridge), true);
  assert.equal(bridge.isEnabled(), false);
  assert.equal(bridge.initializeFromCurrentControls(), null);
  assert.equal(bridge.getState(), null);

  bridge.setEnabled(true);
  assert.ok(bridge.initializeFromCurrentControls());
  const initial = bridge.getState();
  const mapping = cardsByPlayer(initial);
  bridge.heroCardsChanged(mapping[bridge.getHeroPlayerId()]);
  assert.ok(bridge.dealHoleCards(mapping));
  assert.ok(bridge.applyAction(ACTION_TYPES.CALL));
  assert.ok(bridge.applyAction(ACTION_TYPES.CHECK));
  const awaitingFlop = bridge.getState();
  bridge.boardCardsChanged(FLOP.slice(0, 2));
  assert.equal(bridge.getState(), awaitingFlop);
  bridge.boardCardsChanged(FLOP);
  assert.equal(bridge.getState().street, STREETS.FLOP);

  const before = bridge.getState();
  assert.equal(bridge.applyAction('not_an_action'), null);
  assert.equal(bridge.getState(), before);
  assert.equal(bridge.getDiagnostics().status, 'error');
  bridge.setEnabled(false);
  assert.equal(bridge.getState(), null);
});

test('classic/ESM and dependency boundaries remain deliberate', () => {
  const logicSource = fs.readFileSync(new URL('../app/src/core/logic.js', import.meta.url), 'utf8');
  const htmlSource = fs.readFileSync(new URL('../app/index.html', import.meta.url), 'utf8');
  const serverSource = fs.readFileSync(new URL('../server.py', import.meta.url), 'utf8');
  const appPackage = JSON.parse(
    fs.readFileSync(new URL('../app/package.json', import.meta.url), 'utf8'),
  );
  const bootstrapSource = fs.readFileSync(
    new URL('../app/src/application/canonical-live-bootstrap.mjs', import.meta.url),
    'utf8',
  );

  assert.doesNotMatch(logicSource, /^\s*(?:import|export)\s/m);
  assert.match(htmlSource, /<script type="module" src="src\/application\/canonical-live-bootstrap\.mjs"><\/script>/);
  assert.match(logicSource, /readPlaybookInputSnapshot\(\)[\s\S]*deriveDecisionContext\(inputSnapshot\)[\s\S]*actionProfile\(null, decisionContext\)/);
  assert.match(bootstrapSource, /RiverlineCanonicalDev/);
  assert.doesNotMatch(bootstrapSource, /browserWindow\.(?:PokerState|pokerDomain|applyAction|applyChance)\s*=/);
  assert.match(serverSource, /domain_prefix = "\/shared\/poker-domain\/"/);
  assert.deepEqual(appPackage.build.extraResources, [{
    from: '../shared/poker-domain',
    to: 'shared/poker-domain',
    filter: ['**/*'],
  }]);

  const domainFiles = fs.readdirSync(new URL('../shared/poker-domain/', import.meta.url));
  for (const file of domainFiles.filter((name) => name.endsWith('.js'))) {
    const source = fs.readFileSync(new URL(`../shared/poker-domain/${file}`, import.meta.url), 'utf8');
    assert.doesNotMatch(source, /(?:from|import\()\s*['"][^'"]*app\//, file);
  }
});
