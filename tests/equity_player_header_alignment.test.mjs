// TEST-HYGIENE-001: behavioural rewrite. Resolves the cascade on the rendered
// Equity player header instead of matching styles.css text.
import assert from 'node:assert/strict';
import test from 'node:test';

import { appStyleSheet, bootApp } from './helpers/app-under-test.mjs';

const app = await bootApp();
await app.navigate('equity');
const css = appStyleSheet();

test('the compact player header resets global semantic-header padding', () => {
  // Protects: semantic <header> keeps its global padding, but the Equity
  // player header (a <header>) resolves to a compact, centred, unpadded row.
  const genericHeader = app.document.createElement('header');
  app.document.body.appendChild(genericHeader);
  assert.equal(css.cascaded(genericHeader, 'padding'), 'var(--space-5) var(--space-6)');
  genericHeader.remove();

  const heads = app.$$('#equityPlayers .equity-player-head');
  assert.ok(heads.length >= 2);
  for (const head of heads) {
    assert.equal(head.localName, 'header');
    assert.equal(css.cascaded(head, 'min-block-size'), '28px');
    assert.equal(css.cascaded(head, 'align-items'), 'center');
    assert.equal(css.cascaded(head, 'margin'), '0');
    for (const side of ['padding-top', 'padding-right', 'padding-bottom', 'padding-left']) {
      assert.equal(css.cascaded(head, side), '0', side);
    }
  }
});
