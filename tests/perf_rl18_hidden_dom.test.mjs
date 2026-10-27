// TEST-HYGIENE-001: behavioural rewrite. Drives the real card picker and Range
// Matrix in the running app instead of slicing logic.js functions.
import test from 'node:test';
import assert from 'node:assert/strict';

import { appStyleSheet, bootApp } from './helpers/app-under-test.mjs';

const app = await bootApp();
const css = appStyleSheet();
await app.navigate('analyze');

const deck = () => app.byId('deck');
const deckCards = () => deck().querySelectorAll('[data-deck-card]');
const heroEditor = () => app.$('#gtoMode [data-card-set-edit="hero"]');

function observeDeck() {
  const observer = new app.window.MutationObserver(() => {});
  observer.observe(deck(), { attributes: true, childList: true, subtree: true });
  return observer;
}

test('the card picker builds its deck only while open and detaches it on close', async () => {
  // Protects: no hidden 52-card deck while closed; the deck is built on open;
  // selecting updates only the chosen control in place (class, disabled,
  // aria-pressed) without rebuilding; picker selection does no analysis work;
  // clear applies the semantic clear and closes; close detaches the deck; the
  // open modal has no backdrop blur and deck cards have no shadow/transition.
  assert.equal(deck().children.length, 0, 'closed picker keeps no deck subtree');
  await app.click(heroEditor());
  assert.ok(app.byId('cardModal').classList.contains('show'));
  assert.equal(deckCards().length, 52);
  assert.equal(css.cascaded(app.byId('cardModal'), 'backdrop-filter'), 'none');
  const sample = app.$('#deck [data-deck-card="As"]');
  assert.equal(css.cascaded(sample, 'box-shadow'), 'none');
  assert.equal(css.cascaded(sample, 'transition'), 'none');

  const before = deckCards();
  const observer = observeDeck();
  const spy = app.spy(['renderDeck', 'setEquityPending']);
  try {
    assert.equal(app.call('selectCard', 'As'), true);
    const records = observer.takeRecords();
    assert.ok(records.length > 0);
    assert.equal(records.some((record) => record.type === 'childList'), false, 'selection does not rebuild the deck');
    const selected = app.$('#deck [data-deck-card="As"]');
    // A11Y-KEYS-001: the roving Tab stop may move off the previous stop.
    assert.ok(records.every((record) => record.target === selected
      || (record.attributeName === 'tabindex' && record.target.tabIndex === -1)), 'only the selected control changes');
    assert.equal(spy.count('renderDeck'), 0);
    assert.equal(spy.count('setEquityPending'), 0, 'selection does no analysis work');
    const after = deckCards();
    assert.ok(after.length === 52 && after.every((control, index) => control === before[index]), 'the same 52 controls stay mounted');
    assert.ok(selected.classList.contains('is-selected'));
    assert.equal(selected.getAttribute('aria-pressed'), 'true');
    assert.equal(selected.disabled, false);
    assert.ok(app.document.activeElement === selected, 'focus follows the selected deck card');

    // Empty or invalid updates are no-ops.
    app.call('updateDeckCardStates', []);
    app.call('updateDeckCardStates', null);
    assert.equal(observer.takeRecords().length, 0);
  } finally {
    spy.restore();
    observer.disconnect();
  }

  app.call('selectCard', 'Kd');
  await app.click('#cardSetPickerApply');
  assert.deepEqual(app.window.app.gto.hero, ['As', 'Kd']);
  assert.equal(deck().children.length, 0, 'close detaches the deck');

  // Clear: applies the editable clear and closes without rebuilding the deck.
  await app.click(heroEditor());
  const clearSpy = app.spy(['renderDeck']);
  try {
    await app.click('#cardSetPickerClear');
    assert.equal(clearSpy.count('renderDeck'), 0);
  } finally {
    clearSpy.restore();
  }
  assert.deepEqual(app.window.app.gto.hero, []);
  assert.equal(app.byId('cardModal').classList.contains('show'), false);
  assert.equal(deck().children.length, 0);
});

test('picker keeps focus in the draft deck and restores it to the originating set editor on close', async () => {
  // Protects: open focuses the first enabled (or drafted) deck card; select
  // keeps focus on the chosen card; apply and cancel return focus to the set
  // editor that opened the picker.
  await app.click(heroEditor());
  const firstEnabled = app.$('#deck button:not([disabled])');
  assert.ok(app.document.activeElement === firstEnabled);
  app.call('selectCard', 'Qh');
  assert.ok(app.document.activeElement === app.$('#deck [data-deck-card="Qh"]'));
  app.call('selectCard', 'Qs');
  await app.click('#cardSetPickerApply');
  assert.ok(app.document.activeElement === heroEditor(), 'apply restores focus to the set editor');

  await app.click(heroEditor());
  assert.ok(app.document.activeElement === app.$('#deck [data-deck-card="Qh"]'), 'reopen focuses the drafted card');
  await app.click('#cardSetPickerCancel');
  assert.equal(app.byId('cardModal').classList.contains('show'), false);
  assert.ok(app.document.activeElement === heroEditor(), 'cancel restores focus to the set editor');

  // Focus outside the picker is not stolen on close.
  await app.click(heroEditor());
  const outside = app.byId('openSettings');
  outside.focus();
  app.call('closePicker');
  assert.ok(app.document.activeElement === outside);
});

test('targeted picker cleanup leaves Matrix caching and postflop zero-cell behavior intact', async () => {
  // Protects: the Matrix grid is built once and reused; interactions are bound;
  // a postflop spot empties the grid; Matrix rendering never touches the deck
  // or the picker.
  await app.pickCards(heroEditor(), ['As', 'Kd']);
  await app.click('[data-gto-view="chart"]');
  await app.settle(200);
  const spy = app.spy(['closePicker', 'renderDeck', 'bindMatrixGridInteractions']);
  try {
    app.call('renderChart');
    const cells = app.$$('#strategyGrid .hand-cell');
    assert.equal(cells.length, 169);
    app.call('renderChart');
    assert.ok(app.$$('#strategyGrid .hand-cell').every((cell, index) => cell === cells[index]), 'cells are reused, not rebuilt');
    assert.ok(spy.count('bindMatrixGridInteractions') >= 1);
    assert.equal(spy.count('closePicker'), 0);
    assert.equal(spy.count('renderDeck'), 0);
    assert.equal(deck().children.length, 0);

    await app.pickCards(app.$('#gtoMode [data-card-set-edit="board"]'), ['2c', '7d', '9h']);
    app.call('renderChart');
    assert.notEqual(app.window.app.decisionContext.street, 'preflop');
    assert.equal(app.byId('strategyGrid').children.length, 0, 'postflop Matrix has zero cells');
  } finally {
    spy.restore();
  }
});
