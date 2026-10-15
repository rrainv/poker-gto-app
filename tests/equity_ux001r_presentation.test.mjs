// TEST-HYGIENE-001: behavioural rewrite for styles.css / logic.js. Rendered
// Equity card backs are resolved through the cascade. TableRenderer.js and
// card-presentation.mjs checks are outside this ticket and kept as they were.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import { appStyleSheet, bootApp } from './helpers/app-under-test.mjs';

const table = fs.readFileSync(new URL('../app/src/ui/TableRenderer.js', import.meta.url), 'utf8');
const cardPresentation = fs.readFileSync(new URL('../app/src/application/card-presentation.mjs', import.meta.url), 'utf8');

const app = await bootApp();
await app.navigate('equity');
const css = appStyleSheet();
const COMPACT_1080 = { width: 1600, height: 1000 };
const COMPACT_QUERY = '(min-width: 1500px) and (max-height: 1080px)';

test('Equity DOM card backs own a bounded positioned card box', () => {
  // Protects: Equity renders unknown hands as Riverline DOM card backs whose
  // box is positioned, block, border-box and clipped, sized as standard cards.
  const back = app.$('#equityPlayers .equity-unknown-hand .poker-card-back');
  assert.ok(back, 'the unknown player renders card backs');
  assert.ok(back.classList.contains('riverline-card-back'));
  assert.equal(css.cascaded(back, 'position'), 'relative');
  assert.equal(css.cascaded(back, 'display'), 'block');
  assert.equal(css.cascaded(back, 'box-sizing'), 'border-box');
  assert.equal(css.cascaded(back, 'overflow'), 'hidden');
  assert.equal(css.cascaded(back, 'width'), 'var(--card-size-standard-width)');
  assert.equal(css.cascaded(back, 'height'), 'var(--card-size-standard-height)');
  assert.equal(css.cascaded(back, 'flex'), '0 0 auto');
});

test('the R decoration is contained by its card and no longer targets SVG table groups', () => {
  // Protects: the ::after mark is absolutely inset inside DOM backs; the
  // Riverline back-style preview uses the round inset mark; SVG table backs
  // (poker-card-back without riverline-card-back) get no ::after decoration.
  const back = app.$('#equityPlayers .equity-unknown-hand .poker-card-back');
  const root = app.document.documentElement;
  const backStyle = root.getAttribute('data-card-back-style');
  assert.equal(backStyle, 'riverline', 'the default back style is Riverline');
  assert.equal(css.cascaded(back, 'position', { pseudoElement: 'after' }), 'absolute');
  assert.equal(css.cascaded(back, 'inset', { pseudoElement: 'after' }), '25% 20%');
  // Without a back-style override the generic contained mark applies.
  root.removeAttribute('data-card-back-style');
  try {
    assert.equal(css.cascaded(back, 'position', { pseudoElement: 'after' }), 'absolute');
    assert.equal(css.cascaded(back, 'inset', { pseudoElement: 'after' }), '12%');
  } finally {
    root.setAttribute('data-card-back-style', backStyle);
  }
  const preview = app.$('[data-card-preview-back-style="riverline"].riverline-card-back');
  assert.ok(preview, 'the Riverline back-style preview exists');
  assert.equal(css.cascaded(preview, 'inset', { pseudoElement: 'after' }), '25% 20%');
  assert.equal(css.cascaded(preview, 'border-radius', { pseudoElement: 'after' }), '50%');

  const svgBack = app.document.createElementNS('http://www.w3.org/2000/svg', 'g');
  svgBack.setAttribute('class', 'table-card-back poker-card-svg poker-card-back');
  app.document.body.appendChild(svgBack);
  for (const property of ['content', 'position', 'inset', 'background']) {
    assert.equal(css.cascaded(svgBack, property, { pseudoElement: 'after' }), undefined, `SVG back ::after ${property}`);
  }
  svgBack.remove();

  assert.match(table, /presentation\.tableCardBackSvgMarkup/);
  assert.match(cardPresentation, /class="table-card-back poker-card-svg poker-card-back"/);
  assert.doesNotMatch(cardPresentation, /poker-card-svg riverline-card-back|table-card-back riverline-card-back/);
});

test('shared Equity scenario cards continue to use the accepted face renderer', () => {
  // Protects: read-only Equity cards render through cardMarkup as Riverline
  // faces (same face renderer as Training).
  const markup = app.call('equityReadOnlyCardsMarkup', ['As', 'Kd'], 'Hero');
  const host = app.document.createElement('div');
  host.innerHTML = markup;
  const faces = host.querySelectorAll('.training-readonly-card.riverline-card');
  assert.equal(faces.length, 2);
  faces.forEach((face, index) => {
    const expected = app.document.createElement('div');
    expected.innerHTML = app.call('cardMarkup', ['As', 'Kd'][index]);
    assert.equal(face.innerHTML, expected.innerHTML, 'face markup comes from cardMarkup');
  });
  // SOURCE-SHAPE: `.equity-scenario` is no longer rendered by any markup (dead
  // selector), so its card size can only be checked on the parsed stylesheet.
  assert.equal(css.declared('.equity-scenario .training-readonly-card', 'width'), 'var(--card-size-result-width)');
  assert.equal(css.declared('.equity-scenario .training-readonly-card', 'height'), 'var(--card-size-result-height)');
});

test('1080p result density reclaims vertical space without shrinking cards or typography', () => {
  // Protects: the 1080p compact rules never change font sizes, line heights,
  // fixed sizes or hide anything, and tighten the result spacing.
  const compactRules = css.rules.filter((rule) => rule.conditions.some((entry) => (
    entry.type === 'media' && entry.query.replace(/\s+/g, ' ') === COMPACT_QUERY)));
  assert.ok(compactRules.length > 0, 'the 1080p desktop density contract exists');
  for (const rule of compactRules) {
    for (const { property, value } of rule.declarations) {
      assert.ok(!['font-size', 'line-height', 'font'].includes(property), `${rule.selectorText} ${property}`);
      assert.ok(!(/^(width|height)$/.test(property) && /^\d/.test(value)), `${rule.selectorText} ${property}: ${value}`);
      assert.ok(!(property === 'display' && value === 'none'), `${rule.selectorText} display: none`);
    }
  }
  // SOURCE-SHAPE: the compact rules are scoped to `.equity-results-panel` (and
  // Equity result classes) that no current markup renders (dead selectors), so
  // the spacing can only be checked on the parsed stylesheet, not on the UI.
  assert.equal(app.$('.equity-results-panel'), null);
  const compact = (selector, property) => css.declared(`.equity-results-panel ${selector}`, property, COMPACT_1080);
  assert.equal(compact('.equity-result-head', 'padding-block'), '12px 9px');
  assert.equal(compact('.equity-headline', 'padding-bottom'), 'var(--space-4)');
  assert.equal(compact('.equity-scenario', 'padding-bottom'), 'var(--space-4)');
  assert.equal(compact('.equity-scenario-context', 'gap'), 'var(--space-2)');
  assert.equal(compact('.equity-scenario-context', 'padding'), 'var(--space-3)');
  assert.equal(compact('.equity-result-summary > div', 'padding'), 'var(--space-3) var(--space-4)');
});
