import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import { installPlaybookStateSourceBridge } from '../app/src/application/playbook-mode-bootstrap.mjs';

const html = fs.readFileSync(new URL('../app/index.html', import.meta.url), 'utf8');
const css = fs.readFileSync(new URL('../app/styles.css', import.meta.url), 'utf8');
const logic = fs.readFileSync(new URL('../app/src/core/logic.js', import.meta.url), 'utf8');
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
  assert.match(html, /id="playbookModeControl"[^>]+role="group"/);
  assert.match(html, /id="playbookScenarioMode"[^>]+aria-pressed="true"[^>]*>[\s\S]*?Scenario Analysis/);
  assert.match(html, /id="playbookHandMode"[^>]+aria-pressed="false"[^>]*>[\s\S]*?Hand Mode/);
  assert.match(html, /Build any study spot/);
  assert.match(html, /Play a legal hand/);
});

test('workspace hierarchy keeps Decision primary and its alternate analytical views adjacent', () => {
  assert.match(html, /class="app-grid playbook-workspace"/);
  assert.match(html, /class="panel recommend playbook-primary-decision" id="recommendation"/);
  assert.match(html, /id="playbookAnalysisNavigation" class="playbook-analysis-switcher"/);
  assert.match(html, /id="playbookAnalysisTabs" class="sub-tabs ui-segments"/);
  const sharedIndex = html.indexOf('id="sharedControls"');
  const decisionIndex = html.indexOf('id="recommendation"');
  assert.ok(sharedIndex < decisionIndex);
  assert.match(css, /#contextView\s*\{\s*order:\s*1/);
  const composition = css.slice(css.indexOf('PRODUCT-UI-005: workspace composition'));
  assert.match(composition, /#playbookAnalysisNavigation\s*\{\s*order:\s*2/);
  assert.match(composition, /#chartView,[\s\S]*?order:\s*3/);
  assert.match(composition, /#table-wrapper\s*\{\s*order:\s*5/);
});

test('Scenario organization retains supported product controls only', () => {
  for (const id of [
    'players', 'heroPos', 'stack', 'stackMode', 'potSize', 'facingSize',
    'lastAction', 'rakeMode', 'ante', 'straddle',
  ]) assert.match(html, new RegExp(`id="${id}"`), id);
  assert.match(html, /data-playbook-scenario/);
  assert.match(html, /Spot context/);
  assert.match(html, /Game and accounting/);
  assert.match(html, /Show Advanced Rules/);
  assert.doesNotMatch(html, /Legacy percentage|rakeValue|rakeUnit|rakePot/);
});

test('Hand workspace includes bounded initialization and canonical state summaries', () => {
  for (const id of [
    'handTableSize', 'handGameMode', 'handStackBb', 'handButtonSeat', 'handHeroSeat',
    'handAnteType', 'handAnteBb', 'handStartButton', 'handResetButton',
    'handStateStreet', 'handStateActor', 'handStatePot', 'handStateDeduction',
    'handSeatList', 'handActionHistory',
  ]) assert.match(html, new RegExp(`id="${id}"`), id);
  assert.match(logic, /callPlaybookStateBridge\('initializeHand', readCanonicalHandConfiguration\(\)\)/);
  assert.match(logic, /callPlaybookStateBridge\('resetHand'\)/);
});

test('private and board card controls reuse the picker without mutating PokerState', () => {
  assert.match(html, /id="handPrivateCards"/);
  assert.match(html, /data-slots="hand-board-chance"/);
  assert.match(logic, /group\.startsWith\('hand-seat-'\)/);
  assert.match(logic, /callPlaybookStateBridge\('dealObservedHoleCards', cardsByPlayer\)/);
  assert.match(logic, /callPlaybookStateBridge\('dealBoardCards', cards\)/);
  assert.doesNotMatch(logic, /PokerState\s*=|state\.board\.push|state\.players\[[^\]]+\]\.holeCards\s*=/);
});

test('legal action UI is sourced from canonical specs with amount-to bounds', () => {
  assert.match(logic, /callPlaybookStateBridge\('getLegalActions'\)/);
  for (const action of ['fold', 'check', 'call', 'bet', 'raise', 'all_in']) {
    assert.match(logic, new RegExp(`['"]${action}['"]`));
  }
  assert.match(logic, /option\.minToMilliBb/);
  assert.match(logic, /option\.maxToMilliBb/);
  assert.match(logic, /amount-to/);
  assert.match(logic, /callPlaybookStateBridge\('applyAction', type, amountToBb\)/);
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

test('ClubGG hand initialization exposes exact deduction outside the pot', () => {
  const { bridge } = browserBridge();
  bridge.initializeHand(configuration({ tableSize: 7, gameMode: 'clubgg' }));
  const state = bridge.getState();
  assert.equal(state.schemaVersion, 'poker-state/v2');
  assert.equal(state.rulesSnapshot.definition.collectionPolicy.amountMilliBb, 100);
  assert.equal(state.deductionTotalMilliBb, 700);
  assert.equal(state.potMilliBb, 1500);
  assert.match(logic, /ClubGG · 0\.1 bb per seated player/);
  assert.doesNotMatch(html.slice(html.indexOf('id="playbookHandWorkspace"'), html.indexOf('</aside>', html.indexOf('id="playbookHandWorkspace"'))), /percentage rake/i);
});

test('recommendation uses stacked frequencies first and demotes the wheel', () => {
  const stackIndex = html.indexOf('id="actionFrequencyStack"');
  const wheel = html.match(/id="actionWheelContainer"[^>]+hidden/);
  assert.ok(stackIndex > 0);
  assert.ok(wheel);
  assert.match(html, /id="toggleFrequencyAlternate"[^>]+aria-expanded="false"/);
  assert.match(css, /\.frequency-stack\s*\{\s*height:\s*18px/);
});

test('recommendation states clear stale output and retain truthful provenance', () => {
  assert.match(logic, /setRecommendationState\(waiting \? 'waiting' : 'unavailable'\)/);
  assert.doesNotMatch(logic, /function renderLoadingStrategy\(\)/);
  assert.match(logic, /if \(\$\('#strategyMeta'\)\)[\s\S]*?#strategyWarnings[\s\S]*?#actionWheel/);
  assert.match(strategySourceAuthority, /heuristic_preflop:\s*createStrategySourceDescriptor/);
  assert.match(strategySourceAuthority, /heuristic_postflop:\s*createStrategySourceDescriptor/);
  assert.match(strategySourceAuthority, /equity_fallback:\s*createStrategySourceDescriptor/);
  assert.match(strategySourceAuthority, /displayName:\s*'Heuristic fallback'/);
  assert.match(strategySourceAuthority, /displayName:\s*'Equity fallback'/);
  assert.doesNotMatch(logic, /onnx_model|local_tree|api:\s*'API'/);
  assert.match(html, /Canonical hand state does not imply solved strategy/);
  assert.doesNotMatch(html.slice(html.indexOf('id="recommendation"'), html.indexOf('id="chartView"')), /solved GTO|Deep CFR/i);
});

test('supporting metrics are compact and DecisionContext-backed', () => {
  for (const id of ['mPosition', 'mPot', 'mFacing', 'mStack', 'mPotOdds', 'mSPR', 'mRake']) {
    assert.match(html, new RegExp(`id="${id}"`));
  }
  assert.match(logic, /updateMetrics\(decisionContext\)/);
  assert.match(css, /\.playbook-metric-strip[\s\S]*grid-template-columns:\s*repeat\(4/);
});

test('canonical table projection includes actor, hero, stacks, contributions, and statuses', () => {
  for (const field of [
    'currentActorSeat', 'heroSeat', 'currentStackMilliBb', 'streetContributionMilliBb',
    'totalPotContributionMilliBb', 'isFolded', 'isAllIn', 'latestAction',
  ]) assert.match(tablePresence, new RegExp(`${field}[:,]`), field);
  assert.match(logic, /callPlaybookStateBridge\('createTablePresenceViewModel'\)/);
  assert.match(table, /seat\.classList\.toggle\('is-hero'/);
  assert.match(table, /seat\.classList\.toggle\('is-actor'/);
  assert.match(table, /player\.latestAction/);
  assert.match(table, /state\.schemaVersion === 'table-presence\/v1'/);
});

test('Range Matrix remains 13 by 13, mixed, inspectable, and LTR', () => {
  assert.match(html, /id="strategyGrid"[^>]+13 by 13/);
  assert.match(html, /id="selectedHand"/);
  assert.match(html, /id="selectedMix"/);
  assert.match(logic, /RANKS\.forEach\(\(_, row\) => RANKS\.forEach\(\(__, col\)/);
  assert.match(css, /#gtoMode \.strategy-grid\s*\{[^}]*direction:\s*ltr/);
  assert.match(css, /\[dir="rtl"\] #gtoMode \.strategy-grid\s*\{\s*direction:\s*ltr/);
});

test('responsive rules prioritize the decision and keep Hand controls reachable', () => {
  for (const width of ['1024px', '768px', '480px']) assert.match(css, new RegExp(`max-width:\\s*${width}`));
  assert.match(css, /@media \(max-width: 768px\)[\s\S]*\.playbook-decision-workspace\s*\{\s*order:\s*1/);
  assert.match(css, /@media \(max-width: 768px\)[\s\S]*\.playbook-context-rail\s*\{\s*order:\s*2/);
  assert.match(css, /\.playbook-decision-workspace \.matrix-wrap\s*\{\s*overflow-x:\s*auto/);
  assert.match(logic, /handMode && modeView\) modeView\.classList\.remove\('is-context-collapsed'\)/);
});

test('workflow, legal actions, status, and card inputs expose accessible semantics', () => {
  assert.match(html, /id="playbookModeStatus"[^>]+role="status"[^>]+aria-live="polite"/);
  assert.match(html, /id="handLegalActions"[^>]+role="group"[^>]+aria-label=/);
  assert.match(html, /id="handStateSection"[^>]+aria-labelledby=/);
  assert.match(logic, /button\.setAttribute\('aria-label', `\$\{button\.textContent\}/);
  assert.match(logic, /data-playbook-canonical-display disabled aria-label/);
});

test('Playbook hierarchy does not depend on an arbitrary drag/drop layout implementation', () => {
  assert.doesNotMatch(html, /data-layout-fixed/);
  assert.doesNotMatch(html, /src="src\/ui\/dragAndDrop\.js"/);
});

test('Playbook redesign remains tokenized across Midnight, Graphite, and Daylight', () => {
  const start = css.indexOf('DESIGN-006: Playbook analysis workspace');
  const design = css.slice(start, css.indexOf('SAVED-OBJECTS-002:', start));
  assert.ok(start > 0);
  assert.match(design, /var\(--surface-panel\)/);
  assert.match(design, /var\(--text-primary\)/);
  assert.match(design, /var\(--accent-primary\)/);
  assert.doesNotMatch(design, /#[0-9a-f]{3,8}\b/i);
  assert.doesNotMatch(design, /data-theme=/);
});

test('UI does not duplicate poker rules or introduce Equity and Training dependencies', () => {
  assert.doesNotMatch(logic, /from ['"][^'"]*shared\/poker-domain|require\([^)]*poker-domain/);
  assert.doesNotMatch(bootstrap, /calculateEquity|trainingMode|Training/);
  assert.match(logic, /callPlaybookStateBridge\('getLegalActions'\)/);
  assert.doesNotMatch(logic.match(/function renderCanonicalLegalActions[\s\S]*?\n}\n/)?.[0] || '', /minimumRaise|amountToCall|nextActionable/);
});
