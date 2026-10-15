// TEST-HYGIENE-001: behavioural rewrite. Markup is queried as a DOM, styles are
// resolved through the cascade, and the Training context strip is rendered by
// the running app.
import test from 'node:test';
import assert from 'node:assert/strict';

import { appStyleSheet, bootApp } from './helpers/app-under-test.mjs';

const app = await bootApp();
const css = appStyleSheet();
const strip = () => app.byId('trainingPotInfo');

test('Training context marks compact values as atomic without freezing descriptive facing copy', () => {
  // Protects: compact values are atomic (nowrap); descriptive facing copy may
  // wrap normally and never breaks anywhere.
  for (const id of ['trainingStreetLabel', 'trainingPositionVal', 'trainingStackVal', 'trainingPotVal', 'trainingTableVal']) {
    const value = app.byId(id);
    assert.ok(value.classList.contains('training-context-value--atomic'), id);
    assert.ok(strip().contains(value), `${id} sits in the context strip`);
    assert.equal(css.cascaded(value, 'white-space'), 'nowrap', id);
  }
  const facing = app.byId('trainingFacingVal');
  assert.equal(facing.classList.contains('training-context-value--atomic'), false);
  assert.equal(facing.localName, 'strong');
  assert.equal(css.cascaded(facing, 'overflow-wrap'), 'normal');
  assert.equal(css.cascaded(facing, 'word-break'), 'normal');
  assert.notEqual(css.cascaded(facing, 'white-space'), 'nowrap');
});

test('the constrained desktop grid reflows before atomic values can split', async () => {
  // Protects: <=1024px the strip is a two-column grid; odd cells drop the
  // inline-start divider and rows after the first gain a top border; the page
  // never scrolls horizontally; rendering a spot clears (not forces) display.
  const narrow = { width: 1000 };
  assert.equal(css.cascaded(strip(), 'grid-template-columns', narrow), 'repeat(2, minmax(0, 1fr))');
  const cells = strip().children.filter((child) => child.localName === 'div');
  assert.ok(cells.length >= 4);
  cells.forEach((cell, index) => {
    const divider = css.cascaded(cell, 'border-inline-start', narrow);
    if (cell.classList.contains('training-context-fact--headline')) {
      // The headline fact keeps its accent marker instead of a divider.
      assert.equal(divider, '3px solid var(--accent-primary)');
    } else if (index % 2 === 0) {
      assert.equal(divider, '0', `cell ${index + 1} drops the divider`);
    }
    if (index >= 2) assert.match(css.cascaded(cell, 'border-top', narrow) || '', /\dpx solid/, `cell ${index + 1} has a top border`);
  });
  for (const node of [app.document.documentElement, app.document.body, app.$('.riverline-shell')]) {
    for (const width of [1920, 1366, 1000, 800]) {
      assert.doesNotMatch(css.cascaded(node, 'overflow-x', { width }) || '', /scroll|auto/, `${node.localName} at ${width}`);
    }
  }

  await app.navigate('training');
  strip().style.display = 'none';
  await app.click('#trainingNewHand');
  await app.settle(500);
  assert.ok(app.window.app.training.currentExercise, 'a Training spot rendered');
  assert.equal(strip().style.getPropertyValue('display'), '', 'render removes the inline display instead of forcing flex');
});

test('Training numeric and poker context tokens retain LTR isolation in Hebrew', () => {
  // Protects: poker data tokens are LTR-isolated even inside RTL documents.
  app.document.documentElement.setAttribute('dir', 'rtl');
  try {
    for (const id of ['trainingPositionVal', 'trainingStackVal', 'trainingPotVal', 'trainingTableVal']) {
      const token = app.byId(id);
      assert.ok(token.classList.contains('poker-data-token'), id);
      assert.equal(css.cascaded(token, 'direction'), 'ltr', id);
      assert.equal(css.cascaded(token, 'unicode-bidi'), 'isolate', id);
    }
  } finally {
    app.document.documentElement.setAttribute('dir', 'ltr');
  }
});
