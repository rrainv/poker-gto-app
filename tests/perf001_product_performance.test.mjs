import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import {
  PRODUCT_PERFORMANCE_SCHEMA_VERSION,
  createLatestFrameScheduler,
  createSurfaceInvalidator,
  installProductPerformanceBridge,
} from '../app/src/application/product-performance.mjs';

const logic = fs.readFileSync(new URL('../app/src/core/logic.js', import.meta.url), 'utf8');
const html = fs.readFileSync(new URL('../app/index.html', import.meta.url), 'utf8');

function sourceBetween(start, end) {
  const from = logic.indexOf(start);
  const to = logic.indexOf(end, from);
  assert.ok(from >= 0, start);
  assert.ok(to > from, end);
  return logic.slice(from, to);
}

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
  assert.ok(html.indexOf('product-performance.mjs') < html.indexOf('src/core/logic.js'));
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

test('Facing and Pot each have one slider binding and no duplicate delayed input path', () => {
  const events = sourceBetween('function bindEvents()', 'const THEME_PREVIEWS');
  assert.equal((events.match(/bindSliderPair\('facingSize'/g) || []).length, 1);
  assert.equal((events.match(/bindSliderPair\('potSize'/g) || []).length, 1);
  assert.match(events, /schedulePlaybookUpdate\('Facing size changed'\)/);
  assert.match(events, /commitPlaybookUpdate\('Facing size changed'\)/);
  assert.doesNotMatch(events, /sliderDebounce|setTimeout\(\(\) => updateContext\('Sizing changed'/);
});

test('ordinary Playbook updates invalidate hidden work instead of rendering every DOM surface', () => {
  const update = sourceBetween(
    "async function updateContext(reason = 'Context updated')",
    '// Legacy fast evaluator retained for the existing Outs display only.',
  );
  assert.match(update, /invalidatePlaybookDerivedSurfaces\(\)/);
  assert.match(update, /renderVisiblePlaybookDerivedSurfaces\(\)/);
  assert.doesNotMatch(update, /renderChart\(\)|renderRangeAdvantage\(\)|renderBettingTree\(\)/);
  assert.match(logic, /renderIfNeeded\('matrix'\)/);
});

test('one main DecisionContext update resolves its StrategyResult once and reuses it', () => {
  const update = sourceBetween(
    "async function updateContext(reason = 'Context updated')",
    '// Legacy fast evaluator retained for the existing Outs display only.',
  );
  assert.equal((update.match(/strategyProvider\.resolve\(decisionContext\)/g) || []).length, 1);
  assert.match(logic, /renderPlaybookDecisionAnalysis\(\s*app\.decisionContext,\s*app\.strategyResult/);
  assert.match(logic, /app\.strategyResult \|\| strategyProvider\.resolve\(null\)/);
});

test('Matrix preparation remains provider-backed, preflop-only, complete, and context-keyed', () => {
  const preparation = sourceBetween('function matrixStrategyKey(', 'function visualActionKind(');
  assert.match(preparation, /decisionContext: \{ \.\.\.decisionContext, heroCards: null \}/);
  assert.match(preparation, /providerOptions: readHeuristicOptions\(\)/);
  assert.match(preparation, /RANKS\.flatMap[\s\S]*RANKS\.map/);
  assert.match(preparation, /strategyProvider\.resolve\(cellDecisionContext\)/);
  assert.match(preparation, /if \(!isPostFlop && !matrixContextUnavailable\)/);
  assert.match(preparation, /app\.matrixModel\?\.key === key/);
});

test('theme changes and retained animations no longer trigger strategy or forced layout', () => {
  const events = sourceBetween('function bindEvents()', 'function init()');
  assert.doesNotMatch(events, /updateContext\('Theme changed'\)|updateContext\(`Switched to/);
  assert.doesNotMatch(logic, /offsetWidth|offsetHeight|getBoundingClientRect\(/);
});

test('Training and Equity card/readiness work stays within its active workspace', () => {
  const cards = sourceBetween('function activeWorkspaceMode()', 'function openPicker(');
  const trainingCards = sourceBetween('function renderTrainingCards()', 'function updateAssistanceDisplay(');
  const pending = sourceBetween('function setEquityPending()', 'function resetEquityCalculator()');
  assert.match(cards, /mode === 'gto'[\s\S]*mode === 'equity'[\s\S]*mode === 'training'/);
  assert.doesNotMatch(cards, /updateEquityReadiness/);
  assert.match(trainingCards, /trainingModeIsVisible\(\)/);
  assert.equal((pending.match(/updateEquityReadiness\(\)/g) || []).length, 1);
  assert.equal((logic.match(/\binitTrainingMode\(\);/g) || []).length, 1);
});
