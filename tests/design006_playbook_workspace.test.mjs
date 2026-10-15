import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import { StyleSheetModel, appStyleSheet, bootApp, indexDocument, precedes, text } from './helpers/app-under-test.mjs';

// TEST-HYGIENE-001: index.html / styles.css / logic.js assertions are
// behavioural: parsed markup, the cascade, and the Hand/Analyze flows in the
// booted app (bridge calls observed through spies). Strategy-source, table
// renderer and bootstrap sources are outside this ticket.
const markup = indexDocument();
const css = appStyleSheet();
const gto = markup.getElementById('gtoMode');
// SOURCE-SHAPE: "the DESIGN-006 block is tokenized (no hex literals, no
// per-theme selectors)" is a policy lint over the block as authored (parsed,
// not regex-matched); a resolved colour cannot tell a token from a literal.
const designSheet = (() => {
  const raw = fs.readFileSync(new URL('../app/styles.css', import.meta.url), 'utf8');
  const start = raw.indexOf('DESIGN-006: Playbook analysis workspace');
  assert.ok(start > 0);
  return new StyleSheetModel(raw.slice(raw.indexOf('*/', start) + 2, raw.lastIndexOf('/*', raw.indexOf('SAVED-OBJECTS-002:', start))));
})();
function withDestination(destination, callback) {
  const previous = gto.dataset.productDestination;
  gto.dataset.productDestination = destination;
  try { return callback(); } finally { gto.dataset.productDestination = previous; }
}
const order = (selector, width = 1440) => Number(css.cascaded(markup.querySelector(selector), 'order', { width }));
const app = await bootApp({ width: 1440 });
// Imported after boot: the bootstrap module graph self-installs page bridges.
const { installPlaybookStateSourceBridge } = await import('../app/src/application/playbook-mode-bootstrap.mjs');
const strategySourceAuthority = fs.readFileSync(
  new URL('../app/src/application/strategy-source-authority.mjs', import.meta.url),
  'utf8',
);
const table = fs.readFileSync(new URL('../app/src/ui/TableRenderer.js', import.meta.url), 'utf8');
const tablePresence = fs.readFileSync(
  new URL('../app/src/application/table-presence-view-model.mjs', import.meta.url),
  'utf8',
);
const bootstrap = fs.readFileSync(
  new URL('../app/src/application/playbook-mode-bootstrap.mjs', import.meta.url),
  'utf8',
);

const cards = Object.freeze([
  ['As', 'Ad'], ['Kh', 'Kd'], ['Qh', 'Qd'], ['Jh', 'Jd'], ['Th', 'Td'],
  ['9h', '9d'], ['8h', '8d'], ['7h', '7d'], ['6h', '6d'], ['5h', '5d'],
]);

function browserBridge() {
  const events = [];
  const browserWindow = {
    CustomEvent: class CustomEvent {
      constructor(type, init) { this.type = type; this.detail = init.detail; }
    },
    dispatchEvent(event) { events.push(event); },
  };
  return { bridge: installPlaybookStateSourceBridge(browserWindow), events };
}

function configuration(overrides = {}) {
  return {
    tableSize: 2,
    gameMode: 'home',
    stackBb: 100,
    stackMode: 'hero',
    heroSeat: 0,
    buttonSeat: 0,
    anteType: 'none',
    anteBb: 0,
    straddleBb: 0,
    ...overrides,
  };
}

function dealAll(bridge) {
  const state = bridge.getState();
  return bridge.dealHoleCards(Object.fromEntries(
    state.players.map((player, index) => [player.playerId, cards[index]]),
  ));
}

test('Playbook exposes prominent semantic Scenario Analysis and Hand Mode workflows', () => {
  assert.equal(markup.getElementById('playbookModeControl').getAttribute('role'), 'group');
  const scenario = markup.getElementById('playbookScenarioMode');
  const hand = markup.getElementById('playbookHandMode');
  assert.equal(scenario.getAttribute('aria-pressed'), 'true');
  assert.match(text(scenario), /Scenario Analysis/);
  assert.equal(hand.getAttribute('aria-pressed'), 'false');
  assert.match(text(hand), /Hand Mode/);
  assert.match(text(markup.body), /Build any study spot/);
  assert.match(text(markup.body), /Play a legal hand/);
});

test('workspace hierarchy keeps Decision primary and its alternate analytical views adjacent', () => {
  assert.ok(markup.querySelector('.app-grid.playbook-workspace'));
  const recommendation = markup.getElementById('recommendation');
  assert.ok(recommendation.classList.contains('panel') && recommendation.classList.contains('recommend') && recommendation.classList.contains('playbook-primary-decision'));
  assert.ok(markup.getElementById('playbookAnalysisNavigation').classList.contains('playbook-analysis-switcher'));
  // ANALYZE-COMPOSITION-001: view navigation uses the underline Tabs component.
  const tabs = markup.getElementById('playbookAnalysisTabs');
  assert.ok(tabs.classList.contains('sub-tabs') && tabs.classList.contains('ui-tabs'));
  assert.ok(precedes(markup.getElementById('sharedControls'), recommendation));
  // In Analyze the view navigation comes first, the alternate views (context
  // and chart) share one adjacent slot, and the table follows. (Superseded
  // literals: PRODUCT-UI-005's 1/2/3 orders were renumbered by
  // ANALYZE-COMPOSITION-001; the relative order is the preserved guarantee.)
  withDestination('analyze', () => {
    assert.ok(order('#playbookAnalysisNavigation') < order('#chartView'));
    assert.equal(order('#contextView'), order('#chartView'));
    assert.ok(order('#chartView') < order('#table-wrapper'));
    assert.equal(order('#table-wrapper'), 5);
  });
});

test('Scenario organization retains supported product controls only', () => {
  for (const id of [
    'players', 'heroPos', 'stack', 'stackMode', 'potSize', 'facingSize',
    'lastAction', 'rakeMode', 'ante', 'straddle',
  ]) assert.ok(markup.getElementById(id), id);
  assert.ok(markup.querySelector('[data-playbook-scenario]'));
  // ANALYZE-COMPOSITION-001: the Spot rail groups these controls under Action and Table.
  assert.ok(markup.querySelector('#sharedControls [data-i18n="Action"]'));
  assert.ok(markup.querySelector('#scenarioConfigurationPanel [data-i18n="Table"]'));
  assert.match(text(markup.body), /Game and accounting/);
  assert.match(text(markup.body), /Show Advanced Rules/);
  assert.doesNotMatch(markup.documentElement.outerHTML, /Legacy percentage|rakeValue|rakeUnit|rakePot/);
});

test('Hand workspace includes bounded initialization and canonical state summaries', async () => {
  for (const id of [
    'handTableSize', 'handCollectionType', 'handStackBb', 'handButtonSeat', 'handHeroSeat',
    'handAnteType', 'handAnteBb', 'handStartButton', 'handResetButton',
    'handStateStreet', 'handStateActor', 'handStatePot', 'handStateDeduction',
    'handSeatList', 'handActionHistory',
  ]) assert.ok(markup.getElementById(id), id);
  // Starting initializes the canonical hand from the bounded configuration;
  // resetting goes through the bridge.
  const spy = app.spy(['callPlaybookStateBridge']);
  try {
    await app.startHand(['As', 'Kd']);
    const init = spy.calls.callPlaybookStateBridge.find(([name]) => name === 'initializeHand');
    assert.deepEqual(init[1], app.call('readCanonicalHandConfiguration'));
    spy.reset();
    app.call('resetCanonicalPlaybookHand');
    assert.ok(spy.calls.callPlaybookStateBridge.some(([name]) => name === 'resetHand'));
  } finally {
    spy.restore();
  }
});

test('private and board card controls reuse the picker without mutating PokerState', async () => {
  assert.ok(markup.getElementById('handPrivateCards'));
  assert.ok(markup.querySelector('[data-slots="hand-board-chance"]'));
  const spy = app.spy(['callPlaybookStateBridge']);
  try {
    // Hero's private cards are picked into the hand-seat group and dealt
    // through the bridge as observed hole cards.
    await app.startHand(['As', 'Kd']);
    const dealt = spy.calls.callPlaybookStateBridge.find(([name]) => name === 'dealObservedHoleCards');
    assert.ok(dealt);
    assert.deepEqual(Object.values(dealt[1])[0], ['As', 'Kd']);
    // The canonical state handed to the UI is immutable.
    const state = app.call('callPlaybookStateBridge', 'getState');
    assert.ok(Object.isFrozen(state) && Object.isFrozen(state.board) && Object.isFrozen(state.players[0]));
    await app.handAction('call');
    await app.handAction('check');
    spy.reset();
    await app.dealBoard(['2c', '3d', '4s']);
    const board = spy.calls.callPlaybookStateBridge.find(([name]) => name === 'dealBoardCards');
    assert.deepEqual(Array.from(board[1]), ['2c', '3d', '4s']);
    assert.deepEqual(Array.from(app.call('callPlaybookStateBridge', 'getState').board), ['2c', '3d', '4s']);
  } finally {
    spy.restore();
  }
});

test('legal action UI is sourced from canonical specs with amount-to bounds', async () => {
  const spy = app.spy(['callPlaybookStateBridge']);
  try {
    await app.startHand(['As', 'Kd']);
    assert.ok(spy.calls.callPlaybookStateBridge.some(([name]) => name === 'getLegalActions'));
    const state = app.call('callPlaybookStateBridge', 'getState');
    const spec = {
      fold: { available: true }, check: { available: true }, call: { available: true, commitMilliBb: 500, toMilliBb: 1000 },
      bet: { available: true, minToMilliBb: 2000, maxToMilliBb: 7000 }, raise: { available: true, minToMilliBb: 3000, maxToMilliBb: 9000 },
      allIn: { available: true, toMilliBb: 100000, commitMilliBb: 99500 },
    };
    app.call('renderCanonicalLegalActions', state, spec);
    assert.deepEqual(app.$$('#handLegalActions [data-canonical-action]').map((button) => button.dataset.canonicalAction), ['fold', 'check', 'call', 'bet', 'raise', 'all_in']);
    // DECISION-INPUT-TRUTH-001: bounds stay wager-to totals, worded in plain
    // poker terms, and come straight from the spec.
    await app.click('#handLegalActions [data-canonical-action="raise"]');
    assert.match(text(app.byId('handActionAmountBounds')), /^3[–-]9 bb total$/);
    app.call('renderCanonicalHandWorkspace');
    spy.reset();
    await app.handAction('call');
    assert.deepEqual(spy.calls.callPlaybookStateBridge.find(([name]) => name === 'applyAction'), ['applyAction', 'call', null]);
  } finally {
    spy.restore();
  }
});

test('product bridge exposes actual legal raise bounds and fold progression', () => {
  const { bridge } = browserBridge();
  assert.ok(bridge.initializeHand(configuration()));
  assert.ok(dealAll(bridge));
  const legal = bridge.getLegalActions();
  assert.equal(legal.raise.available, true);
  assert.equal(legal.raise.minToMilliBb, 2000);
  assert.equal(legal.raise.maxToMilliBb, 99_900);
  assert.ok(bridge.applyAction('fold'));
  assert.equal(bridge.getState().terminal.isTerminal, true);
  assert.equal(bridge.getState().terminal.reason, 'fold');
});

test('product bridge completes deterministic streets and showdown', () => {
  const { bridge } = browserBridge();
  bridge.initializeHand(configuration());
  dealAll(bridge);
  bridge.applyAction('call');
  bridge.applyAction('check');
  assert.equal(bridge.getState().pendingChance.type, 'deal_flop');
  bridge.dealBoardCards(['2c', '3d', '4s']);
  bridge.applyAction('check');
  bridge.applyAction('check');
  bridge.dealBoardCards(['9c']);
  bridge.applyAction('check');
  bridge.applyAction('check');
  bridge.dealBoardCards(['Tc']);
  bridge.applyAction('check');
  bridge.applyAction('check');
  assert.equal(bridge.getState().phase, 'showdown');
  assert.ok(bridge.resolveShowdown());
  assert.equal(bridge.getState().terminal.isTerminal, true);
});

test('fixed collection and legacy initialization expose exact deduction outside the pot', () => {
  const { bridge } = browserBridge();
  bridge.initializeHand(configuration({ tableSize: 7, gameMode: 'clubgg' }));
  const state = bridge.getState();
  assert.equal(state.schemaVersion, 'poker-state/v2');
  assert.equal(state.rulesSnapshot.definition.collectionPolicy.amountMilliBb, 100);
  assert.equal(state.deductionTotalMilliBb, 700);
  assert.equal(state.potMilliBb, 1500);
  assert.doesNotMatch(text(markup.getElementById('playbookHandWorkspace')), /percentage rake/i);
});

test('the Hand setup previews fixed collection outside the pot', async () => {
  await app.navigate('hand');
  if (app.call('callPlaybookStateBridge', 'getState')) await app.startHand(['As', 'Kd']);
  app.call('resetCanonicalPlaybookHand');
  await app.settle(200);
  const collection = app.byId('handCollectionType');
  const fixed = [...collection.options].find((option) => option.value === 'fixed_per_seated_player');
  assert.ok(fixed);
  await app.setValue('#handTableSize', '7', { events: ['input', 'change'] });
  await app.setValue(collection, fixed.value, { events: ['input', 'change'] });
  try {
    assert.match(text(app.byId('handAccountingPreview')), /Fixed collection outside the pot/);
  } finally {
    await app.setValue(collection, 'none', { events: ['input', 'change'] });
    await app.setValue('#handTableSize', '2', { events: ['input', 'change'] });
  }
});

test('recommendation uses stacked frequencies first and demotes the wheel', () => {
  const stack = markup.getElementById('actionFrequencyStack');
  assert.ok(stack);
  assert.equal(markup.getElementById('actionWheelContainer').hidden, true);
  assert.equal(markup.getElementById('toggleFrequencyAlternate').getAttribute('aria-expanded'), 'false');
  assert.ok(stack.classList.contains('frequency-stack'));
  withDestination('hand', () => assert.equal(css.cascaded(stack, 'height'), '18px'));
  // (Superseded: ANALYZE-COMPOSITION-001 slims the Analyze bar to 10px.)
  withDestination('analyze', () => assert.equal(css.cascaded(stack, 'height'), '10px'));
});

test('recommendation states clear stale output and retain truthful provenance', async () => {
  await app.navigate('analyze');
  // A canonical-hand wait is "waiting"; anything else is "unavailable"; both
  // clear the meta, surface the reason and reset the wheel.
  app.byId('strategyMeta').hidden = false;
  app.byId('actionWheel').style.background = 'red';
  app.call('renderUnavailableStrategy', { mode: 'hand', reason: 'canonical_hand_missing' });
  assert.equal(app.byId('recommendation').dataset.recommendationState, 'waiting');
  assert.equal(app.byId('strategyMeta').hidden, true);
  assert.equal(app.byId('strategyWarnings').hidden, false);
  assert.ok(text(app.byId('strategyWarnings')));
  assert.equal(app.byId('actionWheel').style.background, 'var(--surface-interactive)');
  app.call('renderUnavailableStrategy', { mode: 'scenario', reason: 'invalid_input' });
  assert.equal(app.byId('recommendation').dataset.recommendationState, 'unavailable');
  assert.equal(app.evaluate('typeof renderLoadingStrategy'), 'undefined');
  assert.match(strategySourceAuthority, /heuristic_preflop:\s*createStrategySourceDescriptor/);
  assert.match(strategySourceAuthority, /heuristic_postflop:\s*createStrategySourceDescriptor/);
  assert.match(strategySourceAuthority, /equity_fallback:\s*createStrategySourceDescriptor/);
  assert.match(strategySourceAuthority, /displayName:\s*'Heuristic fallback'/);
  assert.match(strategySourceAuthority, /displayName:\s*'Equity fallback'/);
  // Retired model/tree/API sources have no product label.
  for (const retired of ['onnx_model', 'local_tree', 'api']) assert.equal(app.call('strategySourceDisplayKey', retired), retired);
  assert.match(text(markup.body), /Canonical hand state does not imply solved strategy/);
  const recommendation = markup.getElementById('recommendation');
  assert.doesNotMatch(text(recommendation), /solved GTO|Deep CFR/i);
  await app.call('updateContext');
  await app.settle(200);
});

test('supporting metrics are compact and DecisionContext-backed', async () => {
  for (const id of ['mPosition', 'mPot', 'mFacing', 'mStack', 'mPotOdds', 'mSPR', 'mRake']) {
    assert.ok(markup.getElementById(id), id);
  }
  await app.navigate('analyze');
  await app.pickCards('#gtoMode [data-card-set-edit="hero"]', ['As', 'Kd']);
  const spy = app.spy(['updateMetrics']);
  try {
    await app.call('updateContext');
    await app.settle(200);
    assert.ok(spy.count('updateMetrics') >= 1);
    assert.equal(spy.calls.updateMetrics.at(-1)[0]?.schemaVersion, app.evaluate('DECISION_CONTEXT_SCHEMA_VERSION'));
  } finally {
    spy.restore();
  }
  // (Superseded: four columns became the eight-column fact strip.)
  assert.equal(css.resolved(markup.querySelector('.playbook-metric-strip'), 'grid-template-columns'), 'repeat(8, minmax(0, 1fr))');
});

test('canonical table projection includes actor, hero, stacks, contributions, and statuses', async () => {
  for (const field of [
    'currentActorSeat', 'heroSeat', 'currentStackMilliBb', 'streetContributionMilliBb',
    'totalPotContributionMilliBb', 'isFolded', 'isAllIn', 'latestAction',
  ]) assert.match(tablePresence, new RegExp(`${field}[:,]`), field);
  const spy = app.spy(['callPlaybookStateBridge']);
  try {
    await app.startHand(['As', 'Kd']);
    // The table is projected from the canonical bridge (presentation model,
    // with the presence model as its fallback).
    assert.ok(spy.calls.callPlaybookStateBridge.some(([name]) => /^createTablePres(?:entation|ence)ViewModel$/.test(name)));
  } finally {
    spy.restore();
  }
  assert.match(table, /seat\.classList\.toggle\('is-hero'/);
  assert.match(table, /seat\.classList\.toggle\('is-actor'/);
  assert.match(table, /player\.latestAction/);
  assert.match(table, /state\.schemaVersion === 'table-presence\/v1'/);
});

test('Range Matrix remains 13 by 13, mixed, inspectable, and LTR', async () => {
  assert.match(markup.getElementById('strategyGrid').getAttribute('aria-label'), /13 by 13/);
  assert.ok(markup.getElementById('selectedHand'));
  assert.ok(markup.getElementById('selectedMix'));
  await app.navigate('analyze');
  app.evaluate('app.matrixModel = null');
  app.call('renderChart');
  assert.equal(app.$$('#strategyGrid .hand-cell').length, 169);
  const grid = markup.getElementById('strategyGrid');
  assert.equal(css.cascaded(grid, 'direction'), 'ltr');
  markup.documentElement.setAttribute('dir', 'rtl');
  try { assert.equal(css.cascaded(grid, 'direction'), 'ltr'); } finally { markup.documentElement.removeAttribute('dir'); }
});

test('responsive rules prioritize the decision and keep Hand controls reachable', async () => {
  // Narrow widths stack the workspace. Hand keeps its canonical controls (the
  // context rail) first; Analyze keeps the spot rail above the result.
  // (Superseded: DESIGN-006's "decision 1 / context 2" at 768px is overridden
  // by CORE-FLOW-001A and ANALYZE-COMPOSITION-001.)
  for (const width of [1024, 768, 480]) {
    assert.equal(css.cascaded(gto.querySelector('.playbook-workspace'), 'flex-direction', { width }), 'column');
    for (const destination of ['hand', 'analyze']) {
      withDestination(destination, () => assert.ok(order('.playbook-context-rail', width) < order('.playbook-decision-workspace', width), `${destination}@${width}`));
    }
  }
  // (Superseded in Analyze: ANALYZE-COMPOSITION-001 fits the Matrix without
  // a scroller.)
  withDestination('hand', () => assert.equal(css.cascaded(markup.querySelector('.playbook-decision-workspace .matrix-wrap'), 'overflow-x', { width: 768 }), 'auto'));
  // Hand mode always expands a collapsed context rail.
  await app.navigate('analyze');
  app.byId('gtoMode').classList.add('is-context-collapsed');
  await app.call('requestPlaybookMode', 'hand');
  await app.settle(200);
  assert.equal(app.byId('gtoMode').classList.contains('is-context-collapsed'), false);
  await app.call('requestPlaybookMode', 'scenario');
  await app.settle(200);
});

test('workflow, legal actions, status, and card inputs expose accessible semantics', async () => {
  const status = markup.getElementById('playbookModeStatus');
  assert.equal(status.getAttribute('role'), 'status');
  assert.equal(status.getAttribute('aria-live'), 'polite');
  const legal = markup.getElementById('handLegalActions');
  assert.equal(legal.getAttribute('role'), 'group');
  assert.ok(legal.getAttribute('aria-label'));
  assert.ok(markup.getElementById('handStateSection').getAttribute('aria-labelledby'));
  await app.startHand(['As', 'Kd']);
  const call = app.$('#handLegalActions [data-canonical-action="call"]');
  assert.equal(call.querySelector('.hand-action-label').textContent, 'Call');
  const amount = call.querySelector('.hand-action-amount');
  assert.ok(amount.classList.contains('poker-data-token'));
  assert.equal(call.getAttribute('aria-label'), `Call, ${amount.textContent}`);
  assert.equal(app.$('#handLegalActions [data-canonical-action="raise"]').getAttribute('aria-label'), 'Raise, choose bet size');
  // Canonical card displays are disabled, labelled slots.
  const slots = app.$$('[data-playbook-canonical-display]');
  assert.ok(slots.length > 0);
  for (const slot of slots) {
    assert.equal(slot.disabled, true);
    assert.ok(slot.getAttribute('aria-label'));
  }
});

test('Playbook hierarchy does not depend on an arbitrary drag/drop layout implementation', () => {
  assert.equal(markup.querySelector('[data-layout-fixed]'), null);
  assert.equal(markup.querySelector('script[src="src/ui/dragAndDrop.js"]'), null);
});

test('Playbook redesign remains tokenized across Midnight, Graphite, and Daylight', () => {
  const values = designSheet.rules.flatMap((rule) => rule.declarations.map(({ value }) => value)).join(' ');
  assert.match(values, /var\(--surface-panel\)/);
  assert.match(values, /var\(--text-primary\)/);
  assert.match(values, /var\(--accent-primary\)/);
  assert.doesNotMatch(values, /#[0-9a-f]{3,8}\b/i);
  for (const rule of designSheet.rules) assert.ok(rule.selectors.every((selector) => !selector.includes('data-theme=')), rule.selectors.join(', '));
});

test('UI does not duplicate poker rules or introduce Equity and Training dependencies', async () => {
  // logic.js is a classic script: poker-domain exports never reach the page.
  for (const name of ['applyChance', 'initializeHandFromGameRulesSnapshot', 'createGameRulesSnapshotFromLegacyGameConfiguration']) {
    assert.equal(app.evaluate(`typeof ${name}`), 'undefined', name);
  }
  assert.doesNotMatch(bootstrap, /calculateEquity|trainingMode|Training/);
  // The legal-action UI presents the bridge's spec verbatim: an arbitrary
  // spec renders exactly its own options and bounds, never derived ones.
  await app.startHand(['As', 'Kd']);
  const state = app.call('callPlaybookStateBridge', 'getState');
  app.call('renderCanonicalLegalActions', state, { fold: { available: false }, check: { available: false }, call: { available: false }, bet: { available: true, minToMilliBb: 4100, maxToMilliBb: 4100 }, raise: { available: false }, allIn: { available: false } });
  assert.deepEqual(app.$$('#handLegalActions [data-canonical-action]').map((button) => button.dataset.canonicalAction), ['bet']);
  await app.click('#handLegalActions [data-canonical-action="bet"]');
  assert.match(text(app.byId('handActionAmountBounds')), /^4\.1[–-]4\.1 bb total$/);
  app.call('renderCanonicalHandWorkspace');
});
