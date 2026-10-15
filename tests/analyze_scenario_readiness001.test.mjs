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

const require = createRequire(import.meta.url);
const qa = require('./qa002_adapters.js');
// TEST-HYGIENE-001: the scenario clear paths run in the booted app (real
// clear controls and picker) instead of vm-evaluated slices of logic.js.
const { bootApp } = await import('./helpers/app-under-test.mjs');
const app = await bootApp();
// Imported after boot: the adapter's module graph self-installs page bridges.
const { createProductionPickerHarness } = await import('./uiqa001r_card_picker_adapter.mjs');
async function riverScenario() {
  await app.navigate('analyze');
  await app.pickCards('#gtoMode [data-card-set-edit="hero"]', ['As', 'Kd']);
  await app.pickCards('#gtoMode [data-card-set-edit="board"]', ['2c', '7d', 'Th']);
  for (const [id, value] of [['lastAction', 'bet'], ['facingSize', '8'], ['facingSizeNum', '8'], ['potSize', '18'], ['potSizeNum', '18']]) {
    const control = app.byId(id);
    if (control.localName === 'select' && ![...control.options].some((option) => option.value === value)) {
      const option = app.document.createElement('option');
      option.value = value;
      control.appendChild(option);
    }
    control.value = value;
  }
}
const scenarioControls = () => Object.fromEntries([['lastAction', 'lastAction'], ['facing', 'facingSize'], ['facingNumber', 'facingSizeNum'], ['pot', 'potSize'], ['potNumber', 'potSizeNum']]
  .map(([key, id]) => [key, app.byId(id).value]));
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

test('clearing a postflop board transactionally resets action, facing, and preflop pot controls', async () => {
  await riverScenario();
  const spy = app.spy(['handleExplicitCardClear']);
  try {
    // The scenario board's Clear control dispatches the explicit clear.
    await app.click('[data-card-clear-command="clear_board"][data-card-clear-surface="scenario"]');
    await app.settle(200);
    assert.equal(spy.count('handleExplicitCardClear'), 1);
  } finally {
    spy.restore();
  }
  assert.deepEqual(Array.from(app.window.app.gto.board), []);
  assert.deepEqual(Array.from(app.window.app.gto.hero), ['As', 'Kd']);
  assert.deepEqual(scenarioControls(), {
    lastAction: 'unopened',
    facing: '0',
    facingNumber: '0',
    pot: '1.5',
    potNumber: '1.5',
  });
});

test('the card-set picker Clear action clears the edited set', async () => {
  await riverScenario();
  await app.click('#gtoMode [data-card-set-edit="board"]');
  const spy = app.spy(['clearCardSetPicker']);
  try {
    await app.click('#cardSetPickerClear');
    await app.settle(200);
    assert.equal(spy.count('clearCardSetPicker'), 1);
  } finally {
    spy.restore();
  }
  assert.deepEqual(Array.from(app.window.app.gto.board), []);
  assert.deepEqual(Array.from(app.window.app.gto.hero), ['As', 'Kd']);
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
  // (The explicit-clear dispatch from a Clear control is exercised in the
  // booted app above.)

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
    'Set Facing size to 0 or choose a bet or raise as the prior action.',
    'Enter the Facing size for this bet or raise.',
    'Enter a valid Facing size.',
    'Enter a valid Ante.',
    'This spot is still incomplete, so Riverline won\'t give strategy advice yet.',
  ];
  for (const key of keys) {
    assert.notEqual(translations.ru[key], key, `Russian translation missing: ${key}`);
    assert.notEqual(translations.he[key], key, `Hebrew translation missing: ${key}`);
  }
});
