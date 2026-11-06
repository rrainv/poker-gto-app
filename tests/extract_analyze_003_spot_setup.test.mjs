import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import { bootApp, strategyProviderProbe } from './helpers/app-under-test.mjs';

// EXTRACT-ANALYZE-003: the Spot rail is a mounted module
// (app/src/application/analyze-spot-setup.mjs). The behaviour is pinned by
// extract_analyze_003_characterization.test.mjs (written before the move) and
// extract_analyze_000_characterization.test.mjs; this file covers the module
// contract.

const probe = strategyProviderProbe();
const app = await bootApp({ beforeScripts: probe.beforeScripts });
const spot = () => app.call('spotSetup');

test('the Spot rail mounts on #playbookSpotPanel with the controller interface', () => {
  const controller = spot();
  assert.ok(controller, 'mounted');
  for (const method of ['dispose', 'refreshLanguage', 'handleKey', 'setVisible']) {
    assert.equal(typeof controller[method], 'function', method);
  }
  assert.equal(controller.schemaVersion, 'analyze-spot-setup/v1');
  assert.equal(controller.handleKey({ key: 'x' }), false);
  assert.ok(app.window.RiverlineAnalyzeSpotSetup, 'the module registers itself on window');
  assert.equal(app.call('spotSetup'), controller, 'one controller per page');
});

test('the module never reaches for the provider, window.app, or anything outside its container', () => {
  const source = fs.readFileSync(new URL('../app/src/application/analyze-spot-setup.mjs', import.meta.url), 'utf8');
  const code = source.replace(/^\s*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
  assert.doesNotMatch(code, /strategyProvider|RiverlineStrategy/, 'no provider access');
  assert.doesNotMatch(code, /window\.app\b|globalThis\.app\b/, 'no window.app access');
  assert.doesNotMatch(code, /getElementById|document\.querySelector/, 'queries stay inside the mounted container');
  assert.doesNotMatch(code, /updateContext\(\s*['"][^'"]*['"]\s*,/, 'never passes a resolution override');
});

test('PERF-001: setup input never resolves strategy by itself; one coalesced update resolves once', async () => {
  await app.navigate('analyze');
  await app.pickCards('#gtoMode [data-card-set-edit="hero"]', ['As', 'Kd']);
  const slider = app.byId('potSize');
  const initial = slider.value;
  const dispatch = (type) => app.dispatch(slider, new app.window.Event(type, { bubbles: true }));
  try {
    const resolves = await probe.count(async () => {
      for (const value of ['5', '6', '7']) {
        slider.value = value;
        dispatch('input');
      }
      await app.settle(300);
    });
    assert.equal(resolves.filter((context) => context === app.window.app.decisionContext).length, 1);
    assert.equal(app.window.app.decisionContext.potBb, 7, 'the latest value won');
  } finally {
    slider.value = initial;
    dispatch('input');
    dispatch('change');
    await app.settle(300);
  }
});

test('setVisible is state the page pushes, never read back from the DOM', () => {
  const controller = spot();
  controller.setVisible(true);
  assert.equal(controller.isVisible(), true);
  controller.setVisible(false);
  assert.equal(controller.isVisible(), false);
});

test('refreshLanguage re-syncs the disclosure summaries and does no strategy work', async () => {
  await app.navigate('analyze');
  const resolves = await probe.count(() => { spot().refreshLanguage(); });
  assert.equal(resolves.length, 0);
});

test('dispose removes every listener the module added', async () => {
  await app.navigate('analyze');
  const spy = app.spy(['randomizeCurrentAnalyzeScenario', 'updateContext']);
  try {
    spot().dispose();
    await app.click('#scenarioRandomizeButton');
    await app.settle(50);
    assert.equal(spy.count('randomizeCurrentAnalyzeScenario'), 0, 'the randomize button is no longer bound');
    const select = app.byId('heroPos');
    app.dispatch(select, new app.window.Event('change', { bubbles: true }));
    assert.equal(spy.count('updateContext'), 0, 'selects are no longer bound');
    assert.equal(spot().isVisible(), false);
    spot().dispose();
  } finally {
    spy.restore();
  }
});
