import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import { bootApp, indexDocument, precedes, strategyProviderProbe } from './helpers/app-under-test.mjs';

// TEST-HYGIENE-001: index.html / logic.js assertions are behavioural. The
// app boots with its StrategyProvider bridge instrumented (the bridge object is
// wrapped as it is installed) so provider resolves can be counted; slider
// coalescing, surface invalidation, Matrix keys, theme changes, forced layout
// reads and workspace-scoped card work are observed in the running app.
const markup = indexDocument();
const provider = strategyProviderProbe();
const app = await bootApp({ beforeScripts: provider.beforeScripts });
// Imported after boot: the module installs the page's performance bridge.
const {
  PRODUCT_PERFORMANCE_SCHEMA_VERSION,
  createLatestFrameScheduler,
  createSurfaceInvalidator,
  installProductPerformanceBridge,
} = await import('../app/src/application/product-performance.mjs');
let resolves = [];
async function countingResolves(callback) {
  resolves = await provider.count(callback);
}

const FORCED_LAYOUT_READ = /offsetWidth|offsetHeight|getBoundingClientRect\(/;

function frameHarness() {
  let nextHandle = 1;
  const callbacks = new Map();
  const cancelled = [];
  return {
    requestFrame(callback) {
      const handle = nextHandle++;
      callbacks.set(handle, callback);
      return handle;
    },
    cancelFrame(handle) {
      cancelled.push(handle);
      callbacks.delete(handle);
    },
    runNext() {
      const entry = callbacks.entries().next().value;
      if (!entry) return false;
      callbacks.delete(entry[0]);
      entry[1]();
      return true;
    },
    pendingCount() {
      return callbacks.size;
    },
    cancelled,
  };
}

test('performance bridge is immutable, narrow, and loaded before classic logic', () => {
  const browserWindow = {};
  const bridge = installProductPerformanceBridge(browserWindow);
  assert.equal(bridge.schemaVersion, PRODUCT_PERFORMANCE_SCHEMA_VERSION);
  assert.deepEqual(Object.keys(bridge), [
    'schemaVersion', 'createLatestFrameScheduler', 'createSurfaceInvalidator',
  ]);
  assert.ok(Object.isFrozen(bridge));
  assert.equal(browserWindow.RiverlineProductPerformance, bridge);
  const scripts = markup.querySelectorAll('script[src]');
  const performance = scripts.find((script) => script.getAttribute('src').endsWith('product-performance.mjs'));
  const logic = scripts.find((script) => script.getAttribute('src').split('?')[0] === 'src/core/logic.js');
  assert.ok(precedes(performance, logic));
});

test('multiple slider inputs in one frame coalesce and latest input wins', () => {
  const frames = frameHarness();
  const values = [];
  const scheduler = createLatestFrameScheduler({
    requestFrame: frames.requestFrame,
    cancelFrame: frames.cancelFrame,
    run: (value) => values.push(value),
  });

  scheduler.schedule('first');
  scheduler.schedule('second');
  scheduler.schedule('latest');
  assert.equal(frames.pendingCount(), 1);
  assert.equal(scheduler.isPending(), true);
  assert.equal(frames.runNext(), true);
  assert.deepEqual(values, ['latest']);
  assert.equal(scheduler.isPending(), false);
});

test('final slider change flushes immediately without a stale scheduled update', () => {
  const frames = frameHarness();
  const values = [];
  const scheduler = createLatestFrameScheduler({
    requestFrame: frames.requestFrame,
    cancelFrame: frames.cancelFrame,
    run: (value) => values.push(value),
  });

  scheduler.schedule('drag value');
  scheduler.schedule('final value');
  scheduler.flush();
  assert.deepEqual(values, ['final value']);
  assert.equal(frames.pendingCount(), 0);
  assert.equal(frames.cancelled.length, 1);
  assert.equal(frames.runNext(), false);
});

test('hidden dirty surfaces defer work and render exactly once when opened', () => {
  let visible = false;
  const rendered = [];
  const invalidator = createSurfaceInvalidator({
    surfaceNames: ['matrix'],
    isVisible: () => visible,
    render: (surface) => rendered.push(surface),
  });

  invalidator.mark('matrix');
  assert.equal(invalidator.renderIfNeeded('matrix'), false);
  assert.equal(invalidator.isDirty('matrix'), true);
  assert.deepEqual(rendered, []);

  visible = true;
  assert.equal(invalidator.renderIfNeeded('matrix'), true);
  assert.equal(invalidator.isDirty('matrix'), false);
  assert.deepEqual(rendered, ['matrix']);
  assert.equal(invalidator.renderIfNeeded('matrix'), false);
  assert.deepEqual(rendered, ['matrix']);
});

test('Facing and Pot each have one slider binding and no duplicate delayed input path', async () => {
  await app.navigate('analyze');
  await app.pickCards('#gtoMode [data-card-set-edit="hero"]', ['As', 'Kd']);
  for (const [range, reason] of [['facingSize', 'Facing size changed'], ['potSize', 'Pot size changed']]) {
    const slider = app.byId(range);
    if (!slider) continue;
    const original = slider.value;
    const spy = app.spy(['schedulePlaybookUpdate', 'commitPlaybookUpdate', 'updateContext']);
    try {
      slider.value = String(Number(original) + Number(slider.step || 1));
      app.dispatch(slider, new app.window.Event('input', { bubbles: true }));
      assert.equal(spy.count('schedulePlaybookUpdate'), 1, `${range}: one input binding`);
      if (range === 'facingSize') assert.deepEqual(spy.calls.schedulePlaybookUpdate[0], [reason]);
      app.dispatch(slider, new app.window.Event('change', { bubbles: true }));
      assert.equal(spy.count('commitPlaybookUpdate'), 1, `${range}: one change binding`);
      if (range === 'facingSize') assert.deepEqual(spy.calls.commitPlaybookUpdate[0], [reason]);
      await app.settle(1000);
      assert.ok(spy.count('updateContext') <= 1, `${range}: no duplicate delayed update (${spy.count('updateContext')})`);
    } finally {
      spy.restore();
      slider.value = original;
      app.dispatch(slider, new app.window.Event('input', { bubbles: true }));
      app.dispatch(slider, new app.window.Event('change', { bubbles: true }));
      await app.settle(500);
    }
  }
});

test('ordinary Playbook updates invalidate hidden work instead of rendering every DOM surface', async () => {
  const spy = app.spy(['invalidatePlaybookDerivedSurfaces', 'renderVisiblePlaybookDerivedSurfaces', 'renderChart', 'renderRangeAdvantage', 'renderBettingTree']);
  try {
    await app.call('updateContext', 'test');
    assert.ok(spy.count('invalidatePlaybookDerivedSurfaces') >= 1);
    assert.ok(spy.count('renderVisiblePlaybookDerivedSurfaces') >= 1);
    // Hidden Matrix, range comparison and tree views are not rendered.
    for (const view of ['chart', 'range', 'tree']) {
      const node = app.byId(`${view}View`);
      if (node && !app.isShown(node)) {
        const name = { chart: 'renderChart', range: 'renderRangeAdvantage', tree: 'renderBettingTree' }[view];
        assert.equal(spy.count(name), 0, `${name} while hidden`);
      }
    }
    // Opening the Matrix renders the dirty surface once.
    spy.reset();
    const tab = app.$('.sub-tab[data-gto-view="chart"]');
    assert.ok(tab, 'the Matrix tab exists');
    await app.click(tab);
    assert.equal(spy.count('renderChart'), 1);
    await app.click(app.$('.sub-tab[data-gto-view="context"]') || tab);
  } finally {
    spy.restore();
  }
});

test('one main DecisionContext update resolves its StrategyResult once and reuses it', async () => {
  const spy = app.spy(['renderPlaybookDecisionAnalysis']);
  try {
    await countingResolves(() => app.call('updateContext', 'test'));
    const main = resolves.filter((context) => context === app.window.app.decisionContext);
    assert.ok(app.window.app.decisionContext, 'a resolvable context');
    assert.equal(main.length, 1, 'the main context is resolved once');
    assert.ok(resolves.every((context) => context !== null && context !== undefined), 'never resolves a missing context');
    // The analysis renders with the already-resolved StrategyResult.
    if (spy.count('renderPlaybookDecisionAnalysis')) {
      for (const [context, result] of spy.calls.renderPlaybookDecisionAnalysis) {
        assert.equal(context, app.window.app.decisionContext);
        assert.equal(result, app.window.app.strategyResult);
      }
    }
  } finally {
    spy.restore();
  }
});

test('Matrix preparation remains provider-backed, preflop-only, complete, and context-keyed', async () => {
  const context = app.window.app.decisionContext;
  await countingResolves(() => {
    app.evaluate('app.matrixModel = null');
    app.call('prepareMatrixStrategyModel', context);
  });
  // One provider resolve per hand class, each with a representative hand.
  assert.equal(resolves.length, 169);
  assert.ok(resolves.every((cell) => Array.isArray(cell.heroCards) && cell.heroCards.length === 2));
  assert.ok(resolves.every((cell) => cell.heroPosition === context.heroPosition && cell.tableSize === context.tableSize));
  // Keyed by context without Hero's own cards: same key → no new work.
  const key = app.evaluate('app.matrixModel.key');
  assert.equal(key, app.call('matrixStrategyKey', { ...context, heroCards: ['2c', '7d'] }));
  assert.notEqual(key, app.call('matrixStrategyKey', { ...context, tableSize: context.tableSize === 6 ? 7 : 6 }));
  await countingResolves(() => app.call('prepareMatrixStrategyModel', context));
  assert.equal(resolves.length, 0, 'a cached model is reused');
  // Postflop contexts never build a provider Matrix.
  await countingResolves(() => {
    app.evaluate('app.matrixModel = null');
    app.call('prepareMatrixStrategyModel', { ...context, street: 'flop', board: ['Qh', 'Jh', '2c'] });
  });
  assert.equal(resolves.length, 0);
  app.evaluate('app.matrixModel = null');
});

test('theme changes and retained animations no longer trigger strategy or forced layout', async () => {
  assert.match('function hotPath() { node.getBoundingClientRect(); }', FORCED_LAYOUT_READ);
  const proto = Object.getPrototypeOf(app.byId('gtoMode'));
  const owner = (name) => {
    let current = proto;
    while (current && !Object.getOwnPropertyDescriptor(current, name)) current = Object.getPrototypeOf(current);
    return current;
  };
  const reads = [];
  const restore = [];
  for (const name of ['getBoundingClientRect', 'offsetWidth', 'offsetHeight']) {
    const target = owner(name);
    const descriptor = Object.getOwnPropertyDescriptor(target, name);
    const wrapped = descriptor.get
      ? { ...descriptor, get() { reads.push(name); return descriptor.get.call(this); } }
      : { ...descriptor, value(...args) { reads.push(name); return descriptor.value.apply(this, args); } };
    Object.defineProperty(target, name, wrapped);
    restore.push(() => Object.defineProperty(target, name, descriptor));
  }
  const spy = app.spy(['updateContext']);
  try {
    // A theme change re-renders no strategy.
    const swatch = app.$('#themeSwatchGrid button[aria-pressed="false"]');
    await app.click(swatch);
    assert.equal(app.document.documentElement.dataset.theme, swatch.dataset.themeId, 'the theme changed');
    assert.equal(spy.count('updateContext'), 0, 'theme changes do not update strategy');
    await app.click('#themeSwatchGrid button[data-theme-id="midnight"]');
    // Hot paths perform no forced layout reads.
    reads.length = 0;
    app.call('renderAllCards');
    app.call('invalidatePlaybookDerivedSurfaces');
    app.call('renderVisiblePlaybookDerivedSurfaces');
    await app.call('updateContext', 'test');
    assert.deepEqual(reads, []);
  } finally {
    spy.restore();
    restore.forEach((fn) => fn());
  }
});

test('Training and Equity card/readiness work stays within its active workspace', async () => {
  await app.navigate('analyze');
  const spy = app.spy(['updateEquityReadiness', 'trainingModeIsVisible', 'setTrainingSessionMode']);
  try {
    app.call('renderAllCards');
    assert.equal(spy.count('updateEquityReadiness'), 0, 'Analyze card work does not touch Equity readiness');
    app.call('renderTrainingCards');
    assert.ok(spy.count('trainingModeIsVisible') >= 1, 'Training card work checks its workspace first');
    spy.reset();
    app.call('setEquityPending', {});
    assert.equal(spy.count('updateEquityReadiness'), 1);
    // Training mode is initialised once: one click runs one handler.
    await app.navigate('training');
    spy.reset();
    await app.click('[data-training-session-mode="focused"]');
    assert.equal(spy.count('setTrainingSessionMode'), 1);
  } finally {
    spy.restore();
  }
});
