import test from 'node:test';
import assert from 'node:assert/strict';

import { bootApp, strategyProviderProbe } from './helpers/app-under-test.mjs';

// EXTRACT-ANALYZE-003 (step 1): characterization of the Analyze Spot rail paths
// that EXTRACT-ANALYZE-000 does not pin: the slider pairs and selects (which
// update each asks for, latest-frame coalescing, the final change flushing at
// once), the Advanced rules switch, the randomize menu (Escape, outside click,
// pending guard, copy recipe), the Scenario control authority and the readiness
// gate's focus. Written against the code BEFORE it moved into
// app/src/application/analyze-spot-setup.mjs and kept green after the move
// (behaviour only: no module names here).

const probe = strategyProviderProbe();
const app = await bootApp({ beforeScripts: probe.beforeScripts });

const byId = (id) => app.byId(id);
const t = (key, values) => app.call('t', key, values);
const text = (id) => byId(id).textContent;
const input = (element, type) => app.dispatch(element, new app.window.Event(type, { bubbles: true }));

async function restore(rangeId, numberId, value) {
  byId(rangeId).value = value;
  byId(numberId).value = value;
  input(byId(rangeId), 'input');
  input(byId(rangeId), 'change');
  await app.settle(300);
}

/* ------------------------------------------------------------------ */
/* slider pairs: which update each asks for, and PERF-001               */
/* ------------------------------------------------------------------ */

const PAIRS = [
  { range: 'players', number: 'playersNum', reason: 'Table size changed', value: '5', positions: true },
  { range: 'stack', number: 'stackNum', reason: 'Stack changed', value: '77' },
  { range: 'ante', number: 'anteNum', reason: 'Ante changed', value: '0.5' },
  { range: 'facingSize', number: 'facingSizeNum', reason: 'Facing size changed', value: '3' },
  { range: 'potSize', number: 'potSizeNum', reason: 'Pot size changed', value: '4' },
];

for (const pair of PAIRS) {
  test(`slider pair ${pair.range}: typing is coalesced, the final change flushes at once with "${pair.reason}"`, async () => {
    await app.navigate('analyze');
    const number = byId(pair.number);
    const range = byId(pair.range);
    const initial = range.value;
    const spy = app.spy(['updateContext', 'updatePositions']);
    try {
      // Typing in the number field: scheduled, not run; the pair stays in sync.
      number.value = pair.value;
      input(number, 'input');
      assert.equal(spy.count('updateContext'), 0, 'input only schedules the update');
      assert.equal(byId('recommendation').dataset.recomputing, 'true', 'calm loading mark while pending');
      assert.equal(range.value, pair.value, 'the slider follows the typed value');
      if (pair.positions) assert.ok(spy.count('updatePositions') >= 1, 'table size refreshes the positions on input');

      // The final change flushes at once (no waiting for the next frame), exactly one update.
      spy.reset();
      input(number, 'change');
      assert.equal(spy.count('updateContext'), 1, 'change flushes immediately');
      assert.equal(spy.calls.updateContext[0][0], pair.reason);
      if (pair.positions) assert.ok(spy.count('updatePositions') >= 1, 'table size refreshes the positions on change');
      await app.settle(300);
      assert.equal(spy.count('updateContext'), 1, 'the flushed update is not run a second time');
      assert.equal(byId('recommendation').dataset.recomputing, undefined);
    } finally {
      spy.restore();
      await restore(pair.range, pair.number, initial);
    }
  });

  test(`slider pair ${pair.range}: dragging the slider schedules, releasing it flushes`, async () => {
    await app.navigate('analyze');
    const range = byId(pair.range);
    const initial = range.value;
    const spy = app.spy(['updateContext']);
    try {
      range.value = pair.value;
      input(range, 'input');
      assert.equal(byId(pair.number).value, pair.value, 'the number follows the slider');
      assert.equal(spy.count('updateContext'), 0);
      input(range, 'change');
      assert.equal(spy.count('updateContext'), 1);
      assert.equal(spy.calls.updateContext[0][0], pair.reason);
    } finally {
      spy.restore();
      await restore(pair.range, pair.number, initial);
    }
  });
}

/* ------------------------------------------------------------------ */
/* selects, Advanced rules, disclosure summaries                        */
/* ------------------------------------------------------------------ */

function otherOption(select) {
  return Array.from(select.options).find((option) => option.value !== select.value && !option.disabled).value;
}

for (const id of ['heroPos', 'stackMode', 'rakeMode', 'straddle']) {
  test(`select ${id}: one "Configuration changed" update per change`, async () => {
    await app.navigate('analyze');
    const select = byId(id);
    const initial = select.value;
    const spy = app.spy(['updateContext']);
    try {
      select.value = otherOption(select);
      input(select, 'change');
      assert.equal(spy.count('updateContext'), 1);
      assert.deepEqual(spy.calls.updateContext[0], ['Configuration changed']);
    } finally {
      spy.restore();
      select.value = initial;
      input(select, 'change');
      await app.settle(300);
    }
  });
}

test('select lastAction reconciles the facing size before the one update', async () => {
  await app.navigate('analyze');
  const select = byId('lastAction');
  const initial = select.value;
  const spy = app.spy(['updateContext', 'reconcileScenarioActionDependencies']);
  try {
    select.value = 'raise';
    input(select, 'change');
    assert.deepEqual(spy.sequence, ['reconcileScenarioActionDependencies', 'updateContext']);
    assert.deepEqual(spy.calls.updateContext[0], ['Configuration changed']);
    // An unopened pot has no price to face: the pair is reset to zero.
    spy.reset();
    byId('facingSize').value = '4';
    byId('facingSizeNum').value = '4';
    select.value = 'unopened';
    input(select, 'change');
    assert.equal(byId('facingSize').value, '0');
    assert.equal(byId('facingSizeNum').value, '0');
  } finally {
    spy.restore();
    select.value = initial;
    input(select, 'change');
    await app.settle(300);
  }
});

test('the Advanced rules switch toggles the section, its state and aria-pressed', async () => {
  const toggle = byId('toggleAdvanced');
  const rules = byId('advancedRules');
  const was = toggle.classList.contains('on');
  await app.click(toggle);
  assert.equal(toggle.classList.contains('on'), !was);
  assert.equal(toggle.getAttribute('aria-pressed'), String(!was));
  assert.equal(rules.classList.contains('hidden'), was);
  await app.click(toggle);
  assert.equal(toggle.classList.contains('on'), was);
  assert.equal(rules.classList.contains('hidden'), !was);
});

test('the collapsed Spot disclosures summarize their values and follow a rake change', async () => {
  await app.navigate('analyze');
  const rake = byId('rakeMode');
  const initial = rake.value;
  const label = () => rake.selectedOptions[0].textContent.trim();
  assert.equal(text('playbookGameAccountingSummary'), label());
  rake.value = otherOption(rake);
  input(rake, 'change');
  await app.settle(100);
  assert.equal(text('playbookGameAccountingSummary'), label());
  assert.notEqual(label(), '');
  rake.value = initial;
  input(rake, 'change');
  await app.settle(300);
  assert.equal(text('playbookGameAccountingSummary'), label());
  const adjustment = [text('tightnessLabel'), text('oppTightnessLabel')].map((value) => value.trim()).filter(Boolean).join(' · ');
  assert.equal(text('playbookStrategyAdjustmentSummary'), adjustment);
});

/* ------------------------------------------------------------------ */
/* randomize menu                                                       */
/* ------------------------------------------------------------------ */

test('the randomize menu closes on Escape (focus returns to its summary) and on an outside click, not on an inside click', async () => {
  await app.navigate('analyze');
  const menu = byId('scenarioRandomizationMenu');
  const summary = menu.querySelector('summary');
  menu.open = true;
  await app.key(menu, 'Enter');
  assert.equal(menu.open, true, 'other keys leave it open');
  await app.key(menu, 'Escape');
  assert.equal(menu.open, false);
  assert.ok(app.document.activeElement === summary, 'focus returns to the summary');

  menu.open = true;
  await app.click(menu.querySelector('[data-scenario-keep="hero"]'));
  assert.equal(menu.open, true, 'a click inside keeps it open');
  await app.click(menu.querySelector('[data-scenario-keep="hero"]'));
  await app.click('#recommendation');
  assert.equal(menu.open, false, 'an outside click closes it');
});

test('a second randomize request while one is pending is refused, the button is busy, and Hand never randomizes', async () => {
  await app.navigate('analyze');
  const button = byId('scenarioRandomizeButton');
  const first = app.call('randomizeCurrentAnalyzeScenario', 'spot');
  assert.equal(app.window.app.gto.randomizationPending, true);
  assert.equal(button.disabled, true);
  assert.equal(button.getAttribute('aria-busy'), 'true');
  const second = await app.call('randomizeCurrentAnalyzeScenario', 'spot');
  assert.equal(second, false, 'refused while pending');
  assert.equal(await first, true);
  assert.equal(app.window.app.gto.randomizationPending, false);
  assert.equal(button.disabled, false);
  assert.equal(button.hasAttribute('aria-busy'), false);
});

test('Copy recipe writes the recorded recipe, and says honestly when the clipboard refuses', async () => {
  await app.navigate('analyze');
  await app.call('randomizeCurrentAnalyzeScenario', 'spot');
  await app.settle(300);
  const recipe = app.window.app.gto.lastRandomizationRecipe;
  assert.ok(recipe);
  assert.equal(byId('scenarioRandomizationDetails').hidden, false);
  const original = Object.getOwnPropertyDescriptor(globalThis.navigator, 'clipboard');
  const stub = (writeText) => Object.defineProperty(globalThis.navigator, 'clipboard', { configurable: true, value: { writeText } });
  try {
    let written = null;
    stub(async (value) => { written = value; });
    await app.click('#scenarioCopyRecipe');
    await app.settle(50);
    assert.deepEqual(JSON.parse(written), JSON.parse(JSON.stringify(recipe)));
    assert.equal(text('scenarioRandomizeStatus'), t('Randomization recipe copied.'));
    stub(async () => { throw new Error('denied'); });
    await app.click('#scenarioCopyRecipe');
    await app.settle(50);
    assert.equal(text('scenarioRandomizeStatus'), t('The randomization recipe could not be copied.'));
  } finally {
    if (original) Object.defineProperty(globalThis.navigator, 'clipboard', original);
    else delete globalThis.navigator.clipboard;
  }
});

/* ------------------------------------------------------------------ */
/* Scenario control authority (Scenario <-> Hand)                       */
/* ------------------------------------------------------------------ */

test('Hand makes every Scenario control read-only with the reason; returning to Scenario restores them', async () => {
  await app.navigate('analyze');
  const ids = app.evaluate('PLAYBOOK_SCENARIO_CONTROL_IDS');
  assert.ok(ids.length >= 14);
  for (const id of ids) {
    assert.equal(byId(id).disabled, false, `${id} starts editable`);
    assert.equal(byId(id).hasAttribute('data-scenario-only'), false);
  }
  await app.call('requestPlaybookMode', 'hand');
  await app.settle(200);
  for (const id of ids) {
    const control = byId(id);
    assert.equal(control.disabled, true, `${id} is read-only in Hand`);
    assert.equal(control.hasAttribute('data-scenario-only'), true);
    assert.equal(control.getAttribute('aria-describedby'), 'playbookModeStatus');
    assert.equal(control.title, t('Scenario-only control; ignored while the canonical hand is authoritative.'));
  }
  for (const button of app.$$('[data-card-clear-surface="scenario"]')) {
    assert.equal(button.disabled, true);
    assert.equal(button.hasAttribute('data-scenario-only'), true);
  }
  assert.equal(byId('gtoMode').dataset.playbookMode, 'hand');
  assert.equal(await app.call('randomizeCurrentAnalyzeScenario', 'spot'), false, 'Hand never randomizes the Scenario');

  await app.call('requestPlaybookMode', 'scenario');
  await app.settle(200);
  for (const id of ids) {
    const control = byId(id);
    assert.equal(control.disabled, false, `${id} is editable again`);
    assert.equal(control.hasAttribute('data-scenario-only'), false);
    assert.equal(control.hasAttribute('aria-describedby'), false);
    assert.equal(control.hasAttribute('title'), false);
  }
  // (Clear buttons may stay disabled when there are no cards to clear; they are no longer Hand-owned.)
  for (const button of app.$$('[data-card-clear-surface="scenario"]')) assert.equal(button.hasAttribute('data-scenario-only'), false);
  assert.equal(byId('gtoMode').dataset.playbookMode, 'scenario');
});

/* ------------------------------------------------------------------ */
/* readiness gate: where "Edit decision inputs" focuses                 */
/* ------------------------------------------------------------------ */

const notReady = (field) => ({ mode: 'scenario', reason: 'scenario_not_ready', readiness: { reasons: [{ fields: [field] }] } });

test('the readiness gate focuses the named field, selecting its text', async () => {
  await app.navigate('analyze');
  assert.equal(app.call('focusScenarioReadinessField', notReady('facingSizeBb')), true);
  assert.ok(app.document.activeElement === byId('facingSizeNum'));
  assert.equal(app.call('focusScenarioReadinessField', notReady('stackBb')), true);
  assert.ok(app.document.activeElement === byId('stackNum'));
  assert.equal(app.call('focusScenarioReadinessField', notReady('heroPosition')), true);
  assert.ok(app.document.activeElement === byId('heroPos'));
  byId('heroPos').blur();
});

test('the readiness gate opens the Advanced rules and the collapsed Spot rail before focusing', async () => {
  await app.navigate('analyze');
  if (byId('toggleAdvanced').classList.contains('on')) await app.click('#toggleAdvanced');
  assert.equal(byId('advancedRules').classList.contains('hidden'), true);
  assert.equal(app.call('focusScenarioReadinessField', notReady('anteBb')), true);
  assert.equal(byId('advancedRules').classList.contains('hidden'), false, 'Advanced rules opened for the ante');
  assert.ok(app.document.activeElement === byId('anteNum'));
  await app.click('#toggleAdvanced');
  byId('anteNum').blur();

  // The context toggle is hidden by the layout preset, so collapse the rail the way the toggle does.
  byId('gtoMode').classList.add('is-context-collapsed');
  byId('togglePlaybookContext').setAttribute('aria-expanded', 'false');
  assert.equal(app.call('focusScenarioReadinessField', notReady('tableSize')), true);
  assert.equal(byId('gtoMode').classList.contains('is-context-collapsed'), false, 'the rail was expanded');
  assert.equal(byId('togglePlaybookContext').getAttribute('aria-expanded'), 'true');
  assert.ok(app.document.activeElement === byId('playersNum'));
  byId('playersNum').blur();
});

test('the readiness gate sends a card problem to the card picker and ignores states it does not own', async () => {
  await app.navigate('analyze');
  assert.equal(app.call('focusScenarioReadinessField', notReady('heroCards')), true);
  assert.ok(app.window.app.picker || app.isShown(app.$('[data-deck-card]')), 'the card picker opened');
  if (app.isShown(byId('closeModal'))) await app.click('#closeModal');
  assert.equal(app.call('focusScenarioReadinessField', { mode: 'hand', reason: 'canonical_hero_not_actor' }), false);
  assert.equal(app.call('focusScenarioReadinessField', { mode: 'scenario', reason: 'scenario_not_ready', readiness: { reasons: [] } }), false);
  assert.equal(app.call('focusScenarioReadinessField', null), false);
});
