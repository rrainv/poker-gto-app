import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import { bootApp, strategyProviderProbe } from './helpers/app-under-test.mjs';

// EXTRACT-ANALYZE-002: the Range Matrix and the Range Category Comparison are
// mounted modules (app/src/application/analyze-matrix.mjs and
// analyze-range-comparison.mjs). The behaviour is pinned by
// extract_analyze_000_characterization and the Matrix/Range suites; this file
// pins the module contract: controller interface, visibility pushed in with
// setVisible, the PERF-001 resolve counts, and no provider access.

const probe = strategyProviderProbe();
const app = await bootApp({ beforeScripts: probe.beforeScripts });
const matrix = () => app.call('matrixView');
const comparison = () => app.call('rangeComparisonView');

test('both tabs mount with the controller interface, one controller each', async () => {
  await app.navigate('analyze');
  for (const [name, controller] of [['matrix', matrix()], ['comparison', comparison()]]) {
    assert.ok(controller, `${name} mounted`);
    for (const method of ['dispose', 'refreshLanguage', 'handleKey', 'setVisible']) {
      assert.equal(typeof controller[method], 'function', `${name}.${method}`);
    }
  }
  assert.equal(app.call('matrixView'), matrix(), 'one matrix controller per page');
  assert.equal(app.call('rangeComparisonView'), comparison(), 'one comparison controller per page');
});

test('tab visibility is pushed with setVisible by the tab switch, never read from display', async () => {
  await app.navigate('analyze');
  assert.equal(matrix().isVisible(), false);
  assert.equal(comparison().isVisible(), false);
  await app.click('[data-gto-view="chart"]');
  assert.equal(matrix().isVisible(), true);
  assert.equal(comparison().isVisible(), false);
  await app.click('[data-gto-view="range"]');
  assert.equal(matrix().isVisible(), false);
  assert.equal(comparison().isVisible(), true);
  await app.click('[data-gto-view="context"]');
  assert.equal(matrix().isVisible(), false);
  assert.equal(comparison().isVisible(), false);
});

test('PERF-001: 169 resolves only when the preflop matrix renders, none while hidden or for a cached model', async () => {
  await app.navigate('analyze');
  await app.pickCards('#gtoMode [data-card-set-edit="hero"]', ['As', 'Kd']);
  await app.settle(200);
  await app.click('[data-gto-view="context"]');
  app.evaluate('app.matrixModel = null');
  const hidden = await probe.count(async () => {
    app.call('invalidatePlaybookDerivedSurfaces');
    app.call('renderVisiblePlaybookDerivedSurfaces');
  });
  assert.equal(hidden.length, 0, 'a hidden matrix is not prepared');
  assert.equal(app.evaluate('app.matrixModel'), null);

  const shown = await probe.count(() => app.click('[data-gto-view="chart"]'));
  assert.equal(shown.length, 169, 'one provider resolve per hand class when shown');
  assert.ok(shown.every((cell) => cell.heroCards.length === 2));

  const cached = await probe.count(() => app.call('renderChart'));
  assert.equal(cached.length, 0, 'the memoised model is reused');

  const heroOnly = await probe.count(() => {
    const context = app.window.app.decisionContext;
    matrix().prepareModel({ ...context, heroCards: ['2c', '7d'] });
  });
  assert.equal(heroOnly.length, 0, 'the key excludes the Hero cards');
});

test('the matrix reaches the provider only through the injected resolveCell', () => {
  for (const file of ['analyze-matrix.mjs', 'analyze-range-comparison.mjs']) {
    const source = fs.readFileSync(new URL(`../app/src/application/${file}`, import.meta.url), 'utf8');
    const code = source.replace(/^\s*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
    assert.doesNotMatch(code, /strategyProvider|RiverlineStrategy/, `${file}: no provider access`);
    assert.doesNotMatch(code, /window\.app\b|globalThis\.app\b/, `${file}: no window.app access`);
    assert.doesNotMatch(code, /getElementById|document\.querySelector/, `${file}: queries stay inside the mounted container`);
  }
  const matrixSource = fs.readFileSync(new URL('../app/src/application/analyze-matrix.mjs', import.meta.url), 'utf8');
  assert.match(matrixSource, /deps\.resolveCell\(/);
});

test('language refresh does not render a hidden tab and keeps idle copy translatable', async () => {
  await app.navigate('analyze');
  await app.click('[data-gto-view="context"]');
  app.evaluate('app.matrixModel = null');
  const resolves = await probe.count(() => {
    matrix().refreshLanguage();
    comparison().refreshLanguage();
  });
  assert.equal(resolves.length, 0);
  assert.equal(app.evaluate('app.matrixModel'), null);
});

test('dispose stops the controller from reporting visible', () => {
  matrix().setVisible(true);
  assert.equal(matrix().isVisible(), true);
  matrix().dispose();
  assert.equal(matrix().isVisible(), false);
});
