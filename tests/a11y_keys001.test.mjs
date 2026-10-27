import test from 'node:test';
import assert from 'node:assert/strict';

import { appStyleSheet, bootApp } from './helpers/app-under-test.mjs';

// A11Y-KEYS-001 (QA-SWEEP-016, A11Y-MATRIX-KEYS): the card picker deck and
// the 13 by 13 matrices are each one Tab stop with arrow-key navigation.
const css = appStyleSheet();
const app = await bootApp();

const press = (target, key, init = {}) => {
  const event = new app.window.KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init });
  target.dispatchEvent(event);
  return event;
};
// Elements are compared by identity and reported by a short name; printing a
// DOM node in an assertion diff exhausts memory.
const name = (element) => element?.dataset?.deckCard || element?.dataset?.hand || element?.id || String(element?.tagName);
const assertFocus = (expected, message) => {
  const actual = app.document.activeElement;
  assert.ok(actual === expected, `${message || 'focus'}: expected ${name(expected)}, got ${name(actual)}`);
};
const assertOnlyStop = (stops, expected, message) => {
  assert.equal(stops.length, 1, message);
  assert.ok(stops[0] === expected, `${message || 'tab stop'}: expected ${name(expected)}, got ${name(stops[0])}`);
};
const deckCard = (card) => app.$(`[data-deck-card="${card}"]`);
const deckTabStops = () => app.$$('[data-deck-card]').filter((card) => card.tabIndex === 0);

test('card picker deck is one Tab stop with arrow navigation that never scrolls the page', async () => {
  await app.navigate('analyze');
  await app.pickCards('#gtoMode [data-card-set-edit="hero"]', ['As', 'Kd']);
  await app.click('#gtoMode [data-card-set-edit="board"]');
  assert.ok(app.byId('cardModal').classList.contains('show'));

  // One deck card in the Tab order; the focus trap ignores the other 51.
  assert.equal(app.$$('[data-deck-card]').length, 52);
  assert.equal(deckTabStops().length, 1);
  const trapped = app.call('cardPickerFocusableElements').filter((element) => element.matches('[data-deck-card]'));
  assert.equal(trapped.length, 1);
  const start = deckCard('Ah');
  assertFocus(start, 'focus opens on the first enabled card');
  assert.equal(start.tabIndex, 0);

  // Rows are suits (h, s, d, c), columns are ranks (A to 2).
  let event = press(start, 'ArrowRight');
  assert.equal(event.defaultPrevented, true);
  assertFocus(deckCard('Kh'));
  assertOnlyStop(deckTabStops(), deckCard('Kh'), 'the Tab stop follows focus');
  press(deckCard('Kh'), 'ArrowLeft');
  assertFocus(deckCard('Ah'));

  // ArrowDown skips the unavailable As (Hero holds it) and is always consumed.
  assert.equal(deckCard('As').disabled, true);
  event = press(deckCard('Ah'), 'ArrowDown');
  assert.equal(event.defaultPrevented, true, 'ArrowDown never scrolls the page');
  assertFocus(deckCard('Ad'));
  press(deckCard('Ad'), 'ArrowUp');
  assertFocus(deckCard('Ah'));

  // At an edge focus stays put and the key is still consumed.
  event = press(deckCard('Ah'), 'ArrowUp');
  assert.equal(event.defaultPrevented, true);
  assertFocus(deckCard('Ah'));

  press(deckCard('Ah'), 'End');
  assertFocus(deckCard('2h'));
  press(deckCard('2h'), 'Home');
  assertFocus(deckCard('Ah'));
  press(deckCard('Ah'), 'End', { ctrlKey: true });
  assertFocus(deckCard('2c'));

  // Enter and Space are left to the native button, which picks the card.
  const target = deckCard('2c');
  assert.equal(target.tagName, 'BUTTON');
  assert.equal(press(target, 'Enter').defaultPrevented, false);
  assert.equal(press(target, ' ').defaultPrevented, false);
  await app.click(target);
  assert.equal(target.getAttribute('aria-pressed'), 'true');
  assertOnlyStop(deckTabStops(), target);

  // Arrow keys on other picker controls do not scroll the page either.
  assert.equal(press(app.byId('closeModal'), 'ArrowDown').defaultPrevented, true);

  // Escape closes the picker.
  await app.key(target, 'Escape');
  assert.equal(app.byId('cardModal').classList.contains('show'), false);
});

test('reopening the picker puts the Tab stop on the first drafted card', async () => {
  await app.click('#gtoMode [data-card-set-edit="hero"]');
  assertOnlyStop(deckTabStops(), deckCard('As'));
  assertFocus(deckCard('As'));
  await app.key('#cardModal', 'Escape');
});

test('the strategy matrix is an ARIA grid with one Tab stop, arrow keys and a focus ring', async () => {
  await app.navigate('analyze');
  await app.click('#gtoMode [data-gto-view="chart"]');
  app.evaluate('app.matrixModel = null');
  app.call('renderChart');
  const grid = app.byId('strategyGrid');
  const rows = [...grid.children];
  assert.equal(rows.length, 13);
  assert.ok(rows.every((row) => row.getAttribute('role') === 'row' && row.children.length === 13));
  assert.equal(css.cascaded(rows[0], 'display'), 'contents', 'rows do not change the 13 column layout');
  assert.equal(grid.closest('.matrix-wrap').hasAttribute('tabindex'), false, 'the scroll wrap is not a second stop');

  const cells = app.$$('#strategyGrid .hand-cell');
  assert.equal(cells.length, 169);
  const stops = () => cells.filter((cell) => cell.tabIndex === 0);
  assert.equal(stops().length, 1);
  assert.equal(stops()[0].getAttribute('aria-pressed'), 'true', 'the Tab stop starts on the selected hand');

  // Per-cell labels name the hand, its kind and its state.
  assert.match(cells[0].getAttribute('aria-label'), /^AA, Pair: /);
  assert.match(cells[1].getAttribute('aria-label'), /^AKs, Suited: /);
  assert.match(cells[13].getAttribute('aria-label'), /^AKo, Offsuit: /);

  cells[0].focus();
  assert.equal(press(cells[0], 'ArrowRight').defaultPrevented, true);
  assertFocus(cells[1]);
  press(cells[1], 'ArrowDown');
  assertFocus(cells[14]);
  press(cells[14], 'End');
  assertFocus(cells[25]);
  press(cells[25], 'ArrowRight');
  assertFocus(cells[25], 'no wrap past the row end');
  press(cells[25], 'Home', { ctrlKey: true });
  assertFocus(cells[0]);
  press(cells[0], 'End', { ctrlKey: true });
  assertFocus(cells[168]);
  assertOnlyStop(stops(), cells[168]);

  // Selecting re-renders the matrix without losing the focused Tab stop.
  await app.click(cells[168]);
  assert.equal(cells[168].getAttribute('aria-pressed'), 'true');
  assertOnlyStop(stops(), cells[168]);

  cells[0].focus();
  assert.match(css.cascaded(cells[0], 'outline', { states: ['focus-visible'] }) || '', /2px solid/);
  const probe = app.document.createElement('div');
  probe.innerHTML = '<div class="strategy-grid range-grid" role="grid"><div class="matrix-grid-row" role="row"><button class="hand-cell range-cell" role="gridcell"></button></div></div>';
  app.document.body.appendChild(probe);
  probe.querySelector('.range-cell').focus();
  try {
    assert.match(css.cascaded(probe.querySelector('.range-cell'), 'outline', { states: ['focus-visible'] }) || '', /2px solid/, 'range comparison cells too');
  } finally {
    probe.remove();
  }
});

test('the matrix keeps physical arrow keys in RTL because it is never mirrored', async () => {
  const root = app.document.documentElement;
  root.setAttribute('dir', 'rtl');
  try {
    const cells = app.$$('#strategyGrid .hand-cell');
    cells[0].focus();
    press(cells[0], 'ArrowRight');
    assertFocus(cells[1]);
  } finally {
    root.setAttribute('dir', 'ltr');
  }
});
