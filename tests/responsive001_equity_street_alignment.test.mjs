// TEST-HYGIENE-001: behavioural rewrite. The Equity and Analyze boards are
// rendered by the running app and their layout is resolved via the cascade.
import assert from 'node:assert/strict';
import test from 'node:test';

import { appStyleSheet, bootApp, precedes } from './helpers/app-under-test.mjs';

const app = await bootApp();
await app.navigate('equity');
const css = appStyleSheet();
const equityLayout = () => app.$('.equity-board-layout');
const editor = (root, index) => root.querySelector(`.board-card-set-editor[data-card-set-index="${index}"]`);

test('Equity street labels and live board slots share one five-column layout', () => {
  // Protects: one LTR layout holds the street guide and the board slots, as a
  // five-column card grid whose two children dissolve into it.
  const layout = equityLayout();
  assert.ok(layout.classList.contains('equity-board-order'));
  assert.equal(layout.getAttribute('dir'), 'ltr');
  const guide = layout.querySelector(':scope > .equity-street-guide');
  const cards = layout.querySelector(':scope > .equity-board-cards[data-slots="eqboard"]');
  assert.ok(guide && cards && precedes(guide, cards));
  assert.equal(css.cascaded(layout, 'grid-template-columns'), 'repeat(5, var(--poker-card-width, 48px))');
  assert.equal(css.cascaded(guide, 'display'), 'contents');
  assert.equal(css.cascaded(cards, 'display'), 'contents');
});

test('the Flop set spans columns one through three while Turn and River map to four and five', () => {
  // Protects: street labels and rendered board editors share column mapping.
  const layout = equityLayout();
  assert.equal(css.cascaded(layout.querySelector('[data-equity-street="flop"]'), 'grid-column'), '1 / span 3');
  assert.equal(css.cascaded(layout.querySelector('[data-equity-street="turn"]'), 'grid-column'), '4');
  assert.equal(css.cascaded(layout.querySelector('[data-equity-street="river"]'), 'grid-column'), '5');
  const flop = layout.querySelector('.equity-board-cards > .board-card-set-editor--flop');
  assert.ok(flop, 'the Flop set editor is rendered');
  assert.equal(css.cascaded(flop, 'grid-column'), '1 / span 3');
  assert.equal(css.cascaded(editor(layout, 3), 'grid-column'), '4');
  assert.equal(css.cascaded(editor(layout, 4), 'grid-column'), '5');
});

test('Hebrew preserves the LTR Flop to Turn to River semantic and slot order', () => {
  // Protects: DOM order is Flop, Turn, River and the layout stays LTR-isolated
  // inside an RTL document.
  const layout = equityLayout();
  const [flop, turn, river] = ['flop', 'turn', 'river'].map((street) => layout.querySelector(`[data-equity-street="${street}"]`));
  assert.ok(precedes(flop, turn) && precedes(turn, river));
  app.document.documentElement.setAttribute('dir', 'rtl');
  try {
    assert.equal(css.cascaded(layout, 'direction'), 'ltr');
    assert.equal(css.cascaded(layout, 'unicode-bidi'), 'isolate');
  } finally {
    app.document.documentElement.setAttribute('dir', 'ltr');
  }
});

test('Analyze and Equity Board compositions scope set-editor geometry without internal scrollbars', async () => {
  // Protects: Analyze board layout gap/overflow, Flop editor span and three
  // card columns, Turn/River columns, and no Equity board overflow clipping.
  await app.navigate('analyze');
  const layout = app.$('.playbook-board-layout');
  assert.equal(css.cascaded(layout, 'column-gap'), 'var(--space-3)');
  assert.equal(css.cascaded(layout, 'overflow'), 'visible');
  const flop = layout.querySelector('.playbook-board-cards > .board-card-set-editor--flop');
  assert.ok(flop, 'the Analyze Flop set editor is rendered');
  assert.equal(css.cascaded(flop, 'grid-column'), '1 / span 3');
  assert.equal(css.cascaded(flop, 'grid-template-columns'), 'repeat(3, var(--poker-card-width))');
  assert.equal(css.cascaded(editor(layout, 3), 'grid-column'), '4');
  assert.equal(css.cascaded(editor(layout, 4), 'grid-column'), '5');
  assert.equal(css.cascaded(equityLayout(), 'overflow'), 'visible');
});
