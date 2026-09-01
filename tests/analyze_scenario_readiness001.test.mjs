import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import vm from 'node:vm';

import {
  PLAYBOOK_MODES,
  createPlaybookScenarioInput,
  resolvePlaybookDecisionContext,
} from '../app/src/application/playbook-state-source.mjs';
import {
  validatePlaybookScenarioReadiness,
} from '../app/src/application/playbook-scenario-readiness.mjs';
import * as RiverlineCardClearSemantics from '../app/src/application/card-clear-semantics.mjs';
import { createProductionPickerHarness } from './uiqa001r_card_picker_adapter.mjs';

const require = createRequire(import.meta.url);
const qa = require('./qa002_adapters.js');
const LOGIC = fs.readFileSync(new URL('../app/src/core/logic.js', import.meta.url), 'utf8');
const TRANSLATIONS = fs.readFileSync(
  new URL('../app/src/locales/product-translations.js', import.meta.url),
  'utf8',
);

function scenario(overrides = {}) {
  return createPlaybookScenarioInput({
    tableSize: 6,
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
    ...overrides,
  });
}

function resolveScenario(input) {
  return resolvePlaybookDecisionContext({
    mode: PLAYBOOK_MODES.SCENARIO,
    scenarioInput: input,
  });
}

function reasonCodes(input) {
  return validatePlaybookScenarioReadiness(input).reasons.map(({ code }) => code);
}

test('Turn without a complete Flop remains a draft but is not provider-ready', () => {
  const draft = scenario({
    street: 'invalid',
    board: [null, null, null, 'Jh'],
    lastAction: 'check',
  });
  assert.deepEqual(draft.board, [null, null, null, 'Jh']);
  assert.ok(reasonCodes(draft).includes('turn_requires_flop'));
  const result = resolveScenario(draft);
  assert.equal(result.status, 'unavailable');
  assert.equal(result.reason, 'scenario_not_ready');
  assert.equal(result.decisionContext, null);
  assert.equal(result.readiness.message, 'Add the flop before choosing a turn card.');
});

test('River without Turn is unavailable with a structured chronology reason', () => {
  const draft = scenario({
    street: 'invalid',
    board: ['2c', '7d', 'Th', null, 'Qs'],
    lastAction: 'check',
  });
  assert.ok(reasonCodes(draft).includes('river_requires_turn'));
  assert.equal(resolveScenario(draft).status, 'unavailable');
});

test('duplicate physical cards across Hero, board, and dead cards are unavailable', () => {
  const drafts = [
    scenario({ street: 'flop', board: ['2c', '7d', 'As'], lastAction: 'check' }),
    scenario({ deadCards: ['As'] }),
    scenario({ street: 'flop', board: ['2c', '7d', 'Th'], deadCards: ['7d'], lastAction: 'check' }),
  ];
  for (const draft of drafts) {
    assert.ok(reasonCodes(draft).includes('duplicate_known_card'));
    assert.equal(resolveScenario(draft).status, 'unavailable');
  }
});

test('street/action and facing/action contradictions fail closed', () => {
  const preflopBet = scenario({ lastAction: 'bet', lastActionLabel: 'Bet', facingSizeBb: 4 });
  assert.ok(reasonCodes(preflopBet).includes('action_not_valid_for_street'));
  assert.equal(resolveScenario(preflopBet).reason, 'scenario_not_ready');

  const postflopThreeBet = scenario({
    street: 'flop',
    board: ['2c', '7d', 'Th'],
    lastAction: '3bet',
    lastActionLabel: '3-Bet',
    facingSizeBb: 8,
  });
  assert.ok(reasonCodes(postflopThreeBet).includes('action_not_valid_for_street'));
  assert.equal(resolveScenario(postflopThreeBet).status, 'unavailable');

  const staleFacing = scenario({ facingSizeBb: 4 });
  assert.ok(reasonCodes(staleFacing).includes('facing_amount_without_aggression'));
  assert.equal(resolveScenario(staleFacing).status, 'unavailable');
});

test('invalid quantitative drafts are unavailable instead of defaulted into advice', () => {
  const draft = scenario({ potBb: -1, stackBb: 0, facingSizeBb: Number.NaN });
  assert.deepEqual(
    reasonCodes(draft).filter((code) => (
      code === 'pot_invalid' || code === 'stack_invalid' || code === 'facing_amount_invalid'
    )).sort(),
    ['facing_amount_invalid', 'pot_invalid', 'stack_invalid'],
  );
  assert.equal(resolveScenario(draft).status, 'unavailable');
});

test('valid preflop and postflop Scenarios still resolve normally', () => {
  const preflop = resolveScenario(scenario());
  assert.equal(preflop.status, 'available');
  assert.equal(preflop.decisionContext.street, 'preflop');

  const postflop = resolveScenario(scenario({
    street: 'flop',
    board: ['2c', '7d', 'Th'],
    potBb: 6,
    lastAction: 'check',
    lastActionLabel: 'Check',
  }));
  assert.equal(postflop.status, 'available');
  assert.equal(postflop.decisionContext.street, 'flop');
});

test('ready lossy Scenario does not gain false exact actor-relative economics', () => {
  const result = resolveScenario(scenario({
    street: 'flop',
    board: ['2c', '7d', 'Th'],
    potBb: 6,
    lastAction: 'check',
    lastActionLabel: 'Check',
  }));
  assert.equal(result.status, 'available');
  assert.equal(result.decisionContext.callAmountBb, 0);
  assert.equal(result.decisionContext.heroStreetContributionBb, null);
  assert.equal(result.decisionContext.actorContestablePotAfterCallBb, null);
  assert.equal(result.decisionContext.requiredRawEquity, null);
});

test('Analyze invokes StrategyProvider zero times for an invalid draft and once for a valid Scenario', async () => {
  const invalid = await qa.captureContext({
    useReadinessResolver: true,
    heroCards: ['As', 'Kd'],
    lastAction: 'bet',
    facingSize: 4,
  });
  assert.equal(invalid.playbookResolution.reason, 'scenario_not_ready');
  assert.equal(invalid.decisionContext, null);
  assert.equal(invalid.strategyResult, null);
  assert.equal(invalid.strategyProviderResolveCount, 0);

  const valid = await qa.captureContext({
    useReadinessResolver: true,
    heroCards: ['As', 'Kd'],
    lastAction: 'unopened',
    facingSize: 0,
  });
  assert.equal(valid.playbookResolution.status, 'available');
  assert.equal(valid.strategyProviderResolveCount, 1);
  assert.equal(valid.strategyResult.schemaVersion, 'strategy-result/v1');
});

test('clearing a postflop board transactionally resets action, facing, and preflop pot controls', () => {
  const slice = (start, end) => LOGIC.slice(LOGIC.indexOf(start), LOGIC.indexOf(end));
  const controls = new Map([
    ['#lastAction', { value: 'bet' }],
    ['#facingSize', { value: '8' }],
    ['#facingSizeNum', { value: '8' }],
    ['#potSize', { value: '18' }],
    ['#potSizeNum', { value: '18' }],
  ]);
  const context = {
    controls,
    result: null,
    RiverlineCardClearSemantics,
  };
  vm.runInNewContext(`
    const app = { gto: { hero: ['As', 'Kd'], board: ['2c', '7d', 'Th'], dead: [] } };
    const PLAYBOOK_DECISION_CARD_GROUPS = ['hero', 'board', 'dead'];
    const $ = (selector) => controls.get(selector) || null;
    const selectedValue = (selector) => $(selector)?.value;
    const groupCards = (group) => app.gto[group];
    const isHandMode = () => false;
    const isEquityGroup = () => false;
    const setEquityPending = () => {};
    const renderCanonicalHandWorkspace = () => {};
    const renderAllCards = () => {};
    const updateContext = () => {};
    const toast = () => {};
    const preflopBasePot = () => 1.5;
    const requireCardClearSemanticsBridge = () => ({
      commands: RiverlineCardClearSemantics.CARD_CLEAR_COMMANDS,
      applyEditableCardClear: RiverlineCardClearSemantics.applyEditableCardClear,
    });
    ${slice('function setScenarioControlPair(', 'function activeWorkspaceMode()')}
    ${slice('function scenarioCardClearTargets()', 'function applyEquityCardClear(')}
    ${slice('function currentStreet(board)', 'function handClass(cards)')}
    applyScenarioCardClear(requireCardClearSemanticsBridge().commands.CLEAR_BOARD);
    result = {
      board: app.gto.board.slice(),
      lastAction: $('#lastAction').value,
      facing: $('#facingSize').value,
      facingNumber: $('#facingSizeNum').value,
      pot: $('#potSize').value,
      potNumber: $('#potSizeNum').value,
    };
  `, context);
  assert.deepEqual(JSON.parse(JSON.stringify(context.result)), {
    board: [],
    lastAction: 'unopened',
    facing: '0',
    facingNumber: '0',
    pot: '1.5',
    potNumber: '1.5',
  });
});

function riverClearHarness() {
  const picker = createProductionPickerHarness();
  picker.app.gto.hero.push('As', 'Kd');
  picker.app.gto.board.push('2c', '7d', 'Th', 'Js', '4c');
  picker.app.gto.dead.push('Jh');
  picker.app.strategyResult = { stale: true };
  picker.renderAllCards();
  picker.setScenarioControls({
    lastAction: 'bet', facing: 8, facingNumber: 8, pot: 18, potNumber: 18,
  });
  return picker;
}

test('A: Hero clear preserves the full board and dead cards', () => {
  const picker = riverClearHarness();
  picker.openPicker('hero', 0);

  assert.equal(picker.clearHand(), true);
  assert.deepEqual([...picker.app.gto.hero], []);
  assert.deepEqual([...picker.app.gto.board], ['2c', '7d', 'Th', 'Js', '4c']);
  assert.deepEqual([...picker.app.gto.dead], ['Jh']);
  assert.deepEqual({ ...picker.scenarioControls() }, {
    lastAction: 'bet', facing: '8', facingNumber: '8', pot: '18', potNumber: '18',
  });
  assert.equal(picker.app.playbookResolution.street, 'river');
});

test('B: Flop clear removes the full board and restores coherent preflop state', () => {
  assert.match(
    LOGIC,
    /cardSetAction\?\.dataset\.cardSetAction === 'clear'\) return clearCardSetPicker\(\)/,
  );
  const picker = riverClearHarness();
  picker.openPicker('board', 0);
  picker.selectCard('2c');

  assert.equal(picker.clearHand(), true);
  assert.deepEqual([...picker.app.gto.hero], ['As', 'Kd']);
  assert.deepEqual([...picker.app.gto.board], []);
  assert.deepEqual([...picker.app.gto.dead], ['Jh']);
  assert.equal(picker.app.picker, null);
  assert.equal(picker.modalOpen(), false);
  assert.equal((picker.slotMarkup('hero').match(/data-card-state="known"/g) || []).length, 2);
  assert.doesNotMatch(picker.slotMarkup('board'), /data-card-state="known"/);
  assert.match(picker.slotMarkup('dead'), /data-card-state="dead"/);
  assert.deepEqual({ ...picker.scenarioControls() }, {
    lastAction: 'unopened',
    facing: '0',
    facingNumber: '0',
    pot: '1.5',
    potNumber: '1.5',
  });
  assert.equal(picker.app.updateCount, 1);
  assert.deepEqual({ ...picker.app.strategyResult }, { recomputed: true, street: 'preflop' });
  assert.deepEqual({ ...picker.app.playbookResolution }, {
    status: 'available',
    reason: null,
    street: 'preflop',
  });
});

test('C: Turn clear preserves Flop and removes Turn and River', () => {
  const picker = riverClearHarness();
  picker.openPicker('board', 3);

  assert.equal(picker.clearHand(), true);
  assert.deepEqual([...picker.app.gto.hero], ['As', 'Kd']);
  assert.deepEqual([...picker.app.gto.board], ['2c', '7d', 'Th']);
  assert.deepEqual([...picker.app.gto.dead], ['Jh']);
  assert.deepEqual({ ...picker.scenarioControls() }, {
    lastAction: 'bet', facing: '8', facingNumber: '8', pot: '18', potNumber: '18',
  });
  assert.equal(picker.app.playbookResolution.street, 'flop');
});

test('D: River clear preserves Flop and Turn and removes only River', () => {
  const picker = riverClearHarness();
  picker.openPicker('board', 4);

  assert.equal(picker.clearHand(), true);
  assert.deepEqual([...picker.app.gto.hero], ['As', 'Kd']);
  assert.deepEqual([...picker.app.gto.board], ['2c', '7d', 'Th', 'Js']);
  assert.deepEqual([...picker.app.gto.dead], ['Jh']);
  assert.deepEqual({ ...picker.scenarioControls() }, {
    lastAction: 'bet', facing: '8', facingNumber: '8', pot: '18', potNumber: '18',
  });
  assert.equal(picker.app.playbookResolution.street, 'turn');
});

test('E: Hero and every board-stage clear preserve dead cards', () => {
  for (const [group, index] of [['hero', 0], ['board', 0], ['board', 3], ['board', 4]]) {
    const picker = riverClearHarness();
    picker.openPicker(group, index);
    assert.equal(picker.clearHand(), true);
    assert.deepEqual([...picker.app.gto.dead], ['Jh']);
  }
});

test('F: dead-card clear preserves Hero and the full board', () => {
  const picker = riverClearHarness();
  assert.match(LOGIC, /if \(clear\) return handleExplicitCardClear\(clear\)/);

  picker.clearGroup('dead');

  assert.deepEqual([...picker.app.gto.hero], ['As', 'Kd']);
  assert.deepEqual([...picker.app.gto.board], ['2c', '7d', 'Th', 'Js', '4c']);
  assert.deepEqual([...picker.app.gto.dead], []);
});

test('G: every stage clear recomputes readiness once and replaces stale strategy', () => {
  const paths = [
    ['hero', 0, 'river', 'unavailable'],
    ['board', 0, 'preflop', 'available'],
    ['board', 3, 'flop', 'available'],
    ['board', 4, 'turn', 'available'],
  ];
  for (const [group, index, street, status] of paths) {
    const picker = riverClearHarness();
    const stale = picker.app.strategyResult;
    picker.openPicker(group, index);
    assert.equal(picker.clearHand(), true);
    assert.equal(picker.app.updateCount, 1);
    assert.equal(picker.app.playbookResolution.street, street);
    assert.equal(picker.app.playbookResolution.status, status);
    assert.notEqual(picker.app.strategyResult, stale);
  }

  const deadPicker = riverClearHarness();
  const stale = deadPicker.app.strategyResult;
  deadPicker.clearGroup('dead');
  assert.equal(deadPicker.app.updateCount, 1);
  assert.equal(deadPicker.app.playbookResolution.street, 'river');
  assert.equal(deadPicker.app.playbookResolution.status, 'available');
  assert.notEqual(deadPicker.app.strategyResult, stale);
});

test('provider-readiness messages have explicit Russian and Hebrew translations', () => {
  const context = { window: {} };
  vm.runInNewContext(TRANSLATIONS, context, { filename: 'product-translations.js' });
  const translations = context.window.riverlineProductTranslations;
  const keys = [
    'Add the flop before choosing a turn card.',
    'Add the turn before choosing a river card.',
    'Each known card can appear only once.',
    'This action does not match the current street.',
    'Clear the amount to call or choose a facing bet or raise.',
    'This spot is still incomplete, so Riverline won\'t give strategy advice yet.',
  ];
  for (const key of keys) {
    assert.notEqual(translations.ru[key], key, `Russian translation missing: ${key}`);
    assert.notEqual(translations.he[key], key, `Hebrew translation missing: ${key}`);
  }
});
