import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import { bootApp, precedes, strategyProviderProbe } from './helpers/app-under-test.mjs';

// ANALYZE-001b: the Spot is a sentence built only from known inputs, and the old
// Spot rail is a drawer (focus trap, Escape, focus restore). The three handoffs,
// the readiness gate and PERF-001 keep their behaviour (pinned by their own tests).

const probe = strategyProviderProbe();
const app = await bootApp({ width: 1920, beforeScripts: probe.beforeScripts });
// Imported after boot: the module registers its page bridge when the page loads it.
const { describeSpot, SPOT_POSITION_SENTENCES } = await import('../app/src/application/analyze-spot-setup.mjs');

// ---------------------------------------------------------------------------
// The sentence says only what the inputs say
// ---------------------------------------------------------------------------

test('the sentence is built from known inputs: position, prior action and its size', () => {
  const parts = describeSpot({ heroPosition: 'BTN', lastAction: 'raise', facingSizeBb: 2.5, potBb: 4, stackBb: 100, tableSize: 9 });
  assert.equal(parts.position.key, SPOT_POSITION_SENTENCES.BTN);
  assert.deepEqual(parts.action, { key: 'Facing a raise to {size} bb.', values: { size: 2.5 } });
  assert.deepEqual(parts.chips.map((chip) => [chip.id, chip.control]), [
    ['pot', 'potSizeNum'], ['stack', 'stackNum'], ['table', 'playersNum'],
  ]);
});

test('a Scenario is lossy: nothing about who opened or who folded is ever claimed', () => {
  const keys = Object.values(SPOT_POSITION_SENTENCES);
  ['raise', '3bet', '4bet', 'bet', 'check', 'unopened'].forEach((lastAction) => {
    const parts = describeSpot({ heroPosition: 'BB', lastAction, facingSizeBb: 6, potBb: 9, stackBb: 80, tableSize: 6 });
    keys.push(parts.action.key);
  });
  keys.forEach((key) => {
    assert.doesNotMatch(key, /\bopens?\b|folded|\bCO\b|\bUTG\b.*raise/i, `"${key}" must not infer an opener or the folds`);
  });
});

test('a missing size or number is left out, never guessed or shown as zero', () => {
  const unknownSize = describeSpot({ heroPosition: 'CO', lastAction: 'raise', facingSizeBb: 0, potBb: Number.NaN, stackBb: null, tableSize: 6 });
  assert.deepEqual(unknownSize.action, { key: 'Facing a raise.', values: {} });
  assert.deepEqual(unknownSize.chips.map((chip) => chip.id), ['facing', 'table'], 'only the known pieces, plus the offer to set the size');
  const unnamedSeat = describeSpot({ heroPosition: 'UTG+1', lastAction: 'unopened', facingSizeBb: 0, potBb: 1.5, stackBb: 30, tableSize: 8 });
  assert.deepEqual(unnamedSeat.position, { key: "You're in {position}.", values: { position: 'UTG+1' } });
  assert.equal(unnamedSeat.action.key, 'Nobody has raised yet.');
  const nothing = describeSpot({ heroPosition: '', lastAction: 'weird', facingSizeBb: undefined });
  assert.equal(nothing.position, null);
  assert.equal(nothing.action, null);
});

// ---------------------------------------------------------------------------
// The booted Analyze workspace
// ---------------------------------------------------------------------------

await app.navigate('analyze');
await app.pickCards('#gtoMode [data-card-set-edit="hero"]', ['As', 'Kd']);
const drawer = () => app.byId('analyzeSpotDrawer');
const focused = () => app.document.activeElement;

test('the sentence, hole cards and chips follow the controls', async () => {
  await app.setValue('#heroPos', 'BTN', { events: ['change'] });
  await app.setValue('#lastAction', 'raise', { events: ['change'] });
  await app.setValue('#facingSizeNum', '2.5');
  await app.settle(300);
  assert.equal(app.byId('analyzeSpotSentence').textContent, "You're on the button. Facing a raise to 2.5 bb.");
  assert.equal(app.byId('analyzeSpotCards').dataset.heroKnown, 'true');
  assert.equal(app.byId('analyzeSpotCards').children.length, 2);
  const chips = [...app.document.querySelectorAll('#analyzeSpotChips [data-spot-chip]')];
  assert.ok(chips.length >= 3 && chips.every((chip) => chip.tagName === 'BUTTON'), 'chips are real buttons');
  assert.ok(app.byId('analyzeSpotEdit').tagName === 'BUTTON', 'Edit spot is a real button');
});

test('the Spot rail leaves the always-visible layout: closed, hidden, and not in the workspace grid', () => {
  assert.equal(drawer().hasAttribute('hidden'), true);
  assert.equal(drawer().getAttribute('role'), 'dialog');
  assert.equal(drawer().getAttribute('aria-modal'), 'true');
  assert.ok(drawer().querySelector('#playbookSpotPanel'), 'the existing rail sections live in the drawer unchanged');
  assert.equal(app.$('.playbook-workspace').contains(drawer()), false);
  for (const id of ['scenarioCardsPanel', 'sharedControls', 'scenarioConfigurationPanel', 'playbookGameAccounting']) {
    assert.ok(drawer().contains(app.byId(id)), `${id} is in the drawer`);
  }
});

test('Hand context and Saved banners sit above the sentence, outside the drawer', () => {
  const card = app.byId('analyzeSpotCard');
  for (const id of ['analyzeHandContext', 'savedSpotViewerBanner']) {
    const banner = app.byId(id);
    assert.ok(banner, id);
    assert.equal(drawer().contains(banner), false, `${id} is not in the drawer`);
    assert.ok(precedes(banner, card), `${id} precedes the sentence card`);
  }
});

test('Edit spot opens the drawer on the Hero hand, traps focus, and Escape restores focus', async () => {
  const edit = app.byId('analyzeSpotEdit');
  await app.click(edit);
  assert.equal(drawer().hasAttribute('hidden'), false);
  assert.equal(drawer().dataset.open, 'true');
  assert.equal(edit.getAttribute('aria-expanded'), 'true');
  assert.ok(drawer().contains(focused()), 'focus moves into the drawer');
  assert.equal(focused().getAttribute('data-card-set-edit'), 'hero', 'focus lands on the first thing to set');
  assert.equal(app.$('.playbook-workspace').hasAttribute('inert'), true, 'the page behind is inert while the drawer is open');
  await app.key(drawer(), 'Escape');
  await app.settle(400);
  assert.equal(drawer().hasAttribute('hidden'), true, 'closed');
  assert.equal(edit.getAttribute('aria-expanded'), 'false');
  assert.equal(app.$('.playbook-workspace').hasAttribute('inert'), false);
  assert.equal(focused(), edit, 'focus returns to the opener');
});

test('a chip opens the same controls and focuses its slider input; the close button closes', async () => {
  const chip = app.document.querySelector('[data-spot-chip="pot"]');
  await app.click(chip);
  assert.equal(drawer().hasAttribute('hidden'), false);
  assert.equal(focused(), app.byId('potSizeNum'), 'the Pot control, slider pair included, is focused');
  assert.ok(drawer().contains(app.byId('potSize')), 'the slider is in the same drawer');
  await app.click('#analyzeSpotClose');
  await app.settle(400);
  assert.equal(drawer().hasAttribute('hidden'), true);
  assert.equal(focused().dataset.spotChip, 'pot', 'focus returns to the (rebuilt) chip');
});

test('Tab wraps inside the open drawer (focus trap)', async () => {
  await app.click('#analyzeSpotEdit');
  const items = [...drawer().querySelectorAll('button, input, select, summary')].filter((node) => !node.disabled && app.isShown(node));
  assert.ok(items.length > 4);
  items.at(-1).focus();
  await app.key(items.at(-1), 'Tab');
  assert.equal(focused(), items[0], 'Tab from the last control wraps to the first');
  await app.key(items[0], 'Tab', { shiftKey: true });
  assert.equal(focused(), items.at(-1), 'Shift+Tab from the first wraps to the last');
  await app.key(drawer(), 'Escape');
  await app.settle(400);
});

test('PERF-001: opening and closing the drawer never resolves strategy', async () => {
  const resolves = await probe.count(async () => {
    await app.click('#analyzeSpotEdit');
    await app.key(drawer(), 'Escape');
    await app.settle(400);
  });
  assert.equal(resolves.length, 0);
});

test('with no Hero hand the empty state has one primary action, Pick your hand, which opens the drawer', async () => {
  await app.click('[data-card-clear-command="clear_hero"]');
  await app.settle(300);
  const empty = app.byId('analysisInputState');
  assert.equal(empty.hasAttribute('hidden'), false);
  assert.equal(empty.dataset.emptyKind, 'hand');
  const primary = app.byId('analysisEditInputs');
  assert.equal(primary.textContent.trim(), 'Pick your hand');
  assert.equal(app.byId('analyzeSpotCards').dataset.heroKnown, 'false', 'unknown hand = two face-down backs');
  assert.equal(app.byId('analyzeSpotCards').querySelectorAll('.riverline-card-back').length, 2);
  await app.click(primary);
  assert.equal(drawer().hasAttribute('hidden'), false, 'the drawer is open');
  await app.click('#cardSetPickerApply').catch(() => {});
  await app.settle(200);
});

test('ANALYZE-001b CSS: the drawer slides on the drawer curve with transform and opacity only', () => {
  const css = fs.readFileSync(new URL('../app/styles.css', import.meta.url), 'utf8');
  const section = css.slice(css.indexOf('/* ANALYZE-001b: the Spot is a sentence'));
  assert.ok(section.length > 1000, 'the ANALYZE-001b section exists');
  assert.doesNotMatch(section, /transition:\s*all/, 'never transition: all');
  assert.doesNotMatch(section, /scale\(0\)/, 'no scale(0) entrances');
  assert.match(section, /\.analyze-spot-drawer[\s\S]*?var\(--ease-drawer\)/, 'drawer curve');
  const drawerRules = section.match(/\.analyze-spot-drawer(?:\[[^\]]*\])? \{[^}]*\}/g) || [];
  drawerRules.forEach((rule) => {
    const props = [...rule.matchAll(/transition(?:-property)?:\s*([a-z-]+)/g)].map((match) => match[1]);
    props.forEach((property) => assert.ok(['transform', 'opacity'].includes(property), `drawer transitions ${property}`));
  });
  assert.match(section, /:where\(:root\[data-motion-mode="reduced"\]\)[^{]*\.analyze-spot-drawer \{ transform: none; \}/, 'Reduced fades instead of travelling');
});
