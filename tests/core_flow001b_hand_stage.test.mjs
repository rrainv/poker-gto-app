import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import { ACTION_TYPES, GAME_MODES } from '../shared/poker-domain/index.js';
import { createCanonicalLiveController } from '../app/src/application/canonical-live-controller.mjs';
import { installPlaybookStateSourceBridge } from '../app/src/application/playbook-mode-bootstrap.mjs';
import { createPlaybookScenarioInput } from '../app/src/application/playbook-state-source.mjs';

const HTML = fs.readFileSync(new URL('../app/index.html', import.meta.url), 'utf8');
const CSS = fs.readFileSync(new URL('../app/styles.css', import.meta.url), 'utf8');
const LOGIC = fs.readFileSync(new URL('../app/src/core/logic.js', import.meta.url), 'utf8');
const PRODUCT_TRANSLATIONS = fs.readFileSync(
  new URL('../app/src/locales/product-translations.js', import.meta.url),
  'utf8',
);

function sourceBetween(source, startToken, endToken) {
  const start = source.indexOf(startToken);
  const end = source.indexOf(endToken, start);
  assert.ok(start >= 0, `Missing ${startToken}`);
  assert.ok(end > start, `Missing ${endToken}`);
  return source.slice(start, end);
}

function scenario() {
  return createPlaybookScenarioInput({
    tableSize: 2,
    heroPosition: 'BTN',
    street: 'preflop',
    heroCards: ['As', 'Kd'],
    board: [],
    deadCards: [],
    stackBb: 100,
    stackMode: 'hero',
    potBb: 1.5,
    lastAction: 'unopened',
    lastActionLabel: 'Unopened',
    facingSizeBb: 0,
    rakeMode: 'off',
    forcedContributionPerPlayerBb: 0,
    totalForcedContributionBb: 0,
    anteBb: 0,
    straddleBb: 0,
  });
}

function fakeWindow() {
  return {
    events: [],
    CustomEvent: class {
      constructor(type, init = {}) {
        this.type = type;
        this.detail = init.detail;
      }
    },
    dispatchEvent(event) {
      this.events.push(event);
      return true;
    },
  };
}

function createHandBridge(id = 'core-flow-hand') {
  const controller = createCanonicalLiveController({ enabled: true });
  const browserWindow = fakeWindow();
  const bridge = installPlaybookStateSourceBridge(browserWindow, {
    canonicalController: controller,
    handSourceIdFactory: () => id,
  });
  bridge.setMode('hand', scenario());
  const initial = bridge.initializeHand({
    tableSize: 2,
    gameMode: GAME_MODES.HOME,
    stackBb: 100,
    stackMode: 'hero',
    heroSeat: 0,
    buttonSeat: 0,
    anteType: 'none',
    anteBb: 0,
    straddleBb: 0,
  });
  return { bridge, controller, initial, browserWindow };
}

test('setup stays compact while private cards and actions share the table-adjacent Hand rail', () => {
  const setupStart = HTML.indexOf('id="handSetupDisclosure"');
  const railStart = HTML.indexOf('class="side-stack playbook-context-rail"');
  const railEnd = HTML.indexOf('</aside>', railStart);
  const privateCardsStart = HTML.indexOf('id="handDealSection"');
  const tableStart = HTML.indexOf('id="table-wrapper"');
  const interactionStart = HTML.indexOf('id="handInteractionRail"');
  const dockStart = HTML.indexOf('id="handStageDock"');
  const actionStart = HTML.indexOf('id="handActionSection"');
  assert.ok(railStart >= 0 && setupStart > railStart);
  assert.ok(tableStart > railEnd && interactionStart > tableStart);
  assert.ok(dockStart > interactionStart && privateCardsStart > dockStart && actionStart > privateCardsStart);
  assert.equal((HTML.match(/id="handSetupDisclosure"/g) || []).length, 1);
  assert.equal((HTML.match(/id="handDealSection"/g) || []).length, 1);
  assert.equal((HTML.match(/id="handActionSection"/g) || []).length, 1);
  assert.match(HTML, /id="handSetupDisclosure"[^>]*open/);
  assert.match(HTML, /id="handHistoryDisclosure"[^>]*open/);
  assert.match(HTML, /id="handHistorySelectionSummary"/);
  assert.match(HTML, /id="handHistoryDisclosureAction"/);
  assert.match(HTML, /id="handHistorySection"[^>]*hand-replay-rail/);
  assert.match(HTML, /id="handLiveStageHeader"[^>]*data-playbook-hand/);
  assert.match(HTML, /id="handStageDock"[^>]*data-playbook-hand[^>]*data-tutorial-anchor="hand-action-controls"/);
  assert.match(
    sourceBetween(HTML, 'id="handStageDock"', 'id="playbookAnalysisNavigation"'),
    /id="handDealSection"/,
  );

  const stageResolver = sourceBetween(
    LOGIC,
    'function canonicalHandStageKey(',
    'function canonicalActionHistoryLabel(',
  );
  assert.match(stageResolver, /if \(!state\) return 'setup'/);
  assert.match(stageResolver, /phase === 'terminal'\) return 'complete'/);
  assert.match(stageResolver, /pendingChance\?\.type === 'deal_hole'\) return 'private-cards'/);
  assert.match(stageResolver, /phase === 'chance'\) return 'chance'/);
  assert.match(stageResolver, /phase === 'betting'\) return 'action'/);
  assert.match(LOGIC, /previousStage === 'setup' && stage !== 'setup'\) setCanonicalTableExpanded\(true\)/);
  assert.match(LOGIC, /stageDock\.querySelector\('\.hand-control-section:not\(\[hidden\]\)'\)/);
  const stageRenderer = sourceBetween(
    LOGIC,
    'function renderCanonicalHandStage(',
    'function renderCanonicalPrivateDeal(',
  );
  assert.ok(
    stageRenderer.indexOf("completed.hidden = !terminal")
      < stageRenderer.indexOf("stageDock.querySelector('.hand-control-section:not([hidden])')"),
    'main-stage visibility must account for the completed-Hand actions',
  );
});

test('canonical phase and actor transitions supply the live table stage without a second state authority', () => {
  const { bridge, controller, initial } = createHandBridge('core-flow-progression');
  assert.equal(initial.pendingChance.type, 'deal_hole');
  assert.equal(bridge.createTablePresenceViewModel().status, 'awaiting_private_cards');

  const dealt = bridge.dealObservedHoleCards({ [controller.getHeroPlayerId()]: ['As', 'Kd'] });
  assert.equal(dealt.phase, 'betting');
  assert.equal(dealt.actingPlayerId, controller.getHeroPlayerId());
  assert.equal(bridge.createTablePresenceViewModel().status, 'active');
  assert.equal(bridge.getLegalActions().playerId, dealt.actingPlayerId);

  const called = bridge.applyAction(ACTION_TYPES.CALL);
  assert.equal(called.phase, 'betting');
  assert.notEqual(called.actingPlayerId, controller.getHeroPlayerId());
  assert.equal(bridge.getLegalActions().playerId, called.actingPlayerId);

  const chance = bridge.applyAction(ACTION_TYPES.CHECK);
  assert.equal(chance.phase, 'chance');
  assert.equal(chance.pendingChance.type, 'deal_flop');
  assert.equal(bridge.getLegalActions(), null);
  assert.equal(bridge.createTablePresenceViewModel().status, 'awaiting_board');
});

test('action dock renders only canonical legal options and keeps amount-to presets plus custom sizing', () => {
  const { bridge, controller } = createHandBridge('core-flow-sizing');
  bridge.dealObservedHoleCards({ [controller.getHeroPlayerId()]: ['As', 'Kd'] });
  const spec = bridge.getLegalActions();
  assert.equal(spec.call.available, true);
  assert.equal(spec.call.commitMilliBb, 500);
  assert.equal(spec.raise.available, true);
  assert.equal(spec.raise.minToMilliBb, 2_000);
  assert.equal(spec.raise.maxToMilliBb, 99_900);
  const raised = bridge.applyAction(ACTION_TYPES.RAISE, spec.raise.minToMilliBb / 1000);
  assert.equal(raised.currentBetMilliBb, spec.raise.minToMilliBb);
  assert.equal(raised.actionHistory.at(-1).submittedAction.amountToMilliBb, spec.raise.minToMilliBb);

  const legalRenderer = sourceBetween(
    LOGIC,
    'function renderCanonicalLegalActions(',
    'function canonicalHandStatus(',
  );
  assert.match(legalRenderer, /\['fold', spec\.fold\].*\['check', spec\.check\].*\['call', spec\.call\]/s);
  assert.match(legalRenderer, /\['bet', spec\.bet\].*\['raise', spec\.raise\].*\['all_in', spec\.allIn\]/s);
  assert.match(legalRenderer, /filter\(\(\[, option\]\) => option\?\.available\)/);
  assert.match(legalRenderer, /chooseCanonicalSizedAction\(type, option\)/);
  assert.doesNotMatch(legalRenderer, /potMilliBb\s*[*/+-]|stackBb\s*[*/+-]|Math\.(?:round|floor|ceil)/);

  assert.match(HTML, /id="handSizingMinPreset"[^>]*data-hand-sizing-preset="min"/);
  assert.match(HTML, /id="handSizingMaxPreset"[^>]*data-hand-sizing-preset="max"/);
  assert.match(HTML, /id="handActionAmountBb"[^>]*type="number"/);
  assert.match(LOGIC, /minimumPreset\.dataset\.amountToBb = String\(min\)/);
  assert.match(LOGIC, /maximumPreset\.dataset\.amountToBb = String\(max\)/);
  assert.match(LOGIC, /callPlaybookStateBridge\('applyAction', type, amountToBb\)/);
});

test('leaving, returning, and repeated mode switches preserve the exact canonical Hand and controller', () => {
  const { bridge, controller } = createHandBridge('core-flow-lifecycle');
  bridge.dealObservedHoleCards({ [controller.getHeroPlayerId()]: ['As', 'Kd'] });
  const handBeforeLeave = controller.getState();
  const sourceId = bridge.getCanonicalHandSourceId();
  const journalBeforeLeave = controller.getHeroDecisionJournal();

  for (let index = 0; index < 5; index += 1) {
    bridge.setMode('scenario');
    assert.strictEqual(controller.getState(), handBeforeLeave);
    bridge.setMode('hand', scenario());
    assert.strictEqual(controller.getState(), handBeforeLeave);
    assert.equal(bridge.getCanonicalHandSourceId(), sourceId);
  }

  assert.deepEqual(controller.getHeroDecisionJournal(), journalBeforeLeave);
  assert.equal((LOGIC.match(/installPlaybookStateSourceBridge/g) || []).length, 0);
  assert.match(LOGIC, /renderCanonicalHandWorkspace\(\)/);
  assert.doesNotMatch(
    sourceBetween(LOGIC, 'function renderCanonicalHandStage(', 'function renderCanonicalPrivateDeal('),
    /createCanonicalLiveController|installPlaybookStateSourceBridge|initializeHand\(/,
  );
});

test('completion exposes Review, Analysis, Replay, and Save through existing bounded handoffs', () => {
  const { bridge, controller } = createHandBridge('core-flow-complete');
  bridge.dealObservedHoleCards({ [controller.getHeroPlayerId()]: ['As', 'Kd'] });
  const terminal = bridge.applyAction(ACTION_TYPES.FOLD);
  assert.equal(terminal.phase, 'terminal');
  assert.equal(bridge.getCompletedHandResult().handId, 'core-flow-complete');
  assert.equal(bridge.getHeroDecisionJournal().decisions.length, 1);
  assert.equal(bridge.createReplayProjectionViewModel().canPlayback, true);

  for (const id of [
    'handCompletedReviewButton',
    'handCompletedAnalysisButton',
    'handCompletedReplayButton',
    'handCompletedSaveButton',
  ]) {
    assert.match(HTML, new RegExp(`id="${id}"[^>]*type="button"`));
  }
  assert.match(LOGIC, /revealCanonicalHandHistory\(\{ replay: true \}\)/);
  assert.match(LOGIC, /callPlaybookStateBridge\('startReplayPlayback'\)/);
  assert.match(LOGIC, /scenarioInputFromHeroDecisionRecord\(record\)/);
  assert.match(LOGIC, /reason: 'completed_hand_hero_decision'/);
  assert.match(LOGIC, /\$\('#savedStudySaveButton'\)\?\.click\(\)/);
});

test('desktop hierarchy, localization, RTL, and secondary disclosures remain structural', () => {
  assert.match(CSS, /CORE-FLOW-001B: canonical Hand live stage/);
  assert.match(CSS, /data-hand-stage]:not\(\[data-hand-stage="setup"\]\) \.playbook-workspace/);
  assert.match(CSS, /@media \(max-width: 1100px\)[\s\S]*?\.playbook-decision-workspace[\s\S]*?order: 1/);
  assert.match(CSS, /@media \(max-width: 1100px\)[\s\S]*?\.playbook-context-rail[\s\S]*?order: 2/);
  assert.match(CSS, /data-hand-stage="private-cards"\] \.playbook-context-rail[\s\S]*?order: 1/);
  assert.match(CSS, /data-hand-stage="private-cards"\] \.playbook-decision-workspace[\s\S]*?order: 2/);
  assert.match(CSS, /\[dir="rtl"\] \.hand-live-stage-header/);
  assert.match(CSS, /\[dir="rtl"\] \.hand-stage-dock/);
  assert.match(CSS, /\.hand-disclosure > summary/);
  assert.match(CSS, /\.hand-inline-disclosure > summary/);

  for (const key of [
    'Hand setup',
    'Current hand stage',
    'Hand table',
    'Current legal actions',
    'Custom amount-to',
    'Hand complete',
    'End hand',
    'Hero to act',
  ]) {
    const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    assert.match(PRODUCT_TRANSLATIONS, new RegExp(`Object\\.assign\\(ru,[\\s\\S]*?"${escaped}"`));
    assert.match(PRODUCT_TRANSLATIONS, new RegExp(`Object\\.assign\\(he,[\\s\\S]*?"${escaped}"`));
  }
});
