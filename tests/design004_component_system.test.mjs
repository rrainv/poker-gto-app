import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const html = fs.readFileSync(new URL('../app/index.html', import.meta.url), 'utf8');
const css = fs.readFileSync(new URL('../app/styles.css', import.meta.url), 'utf8');
const logic = fs.readFileSync(new URL('../app/src/core/logic.js', import.meta.url), 'utf8');
const strategy = [
  '../app/src/strategy/preflop-heuristic.mjs',
  '../app/src/strategy/postflop-heuristic.mjs',
].map((url) => fs.readFileSync(new URL(url, import.meta.url), 'utf8')).join('\n');

const componentStart = css.indexOf('DESIGN-004: shared component system');
assert.ok(componentStart >= 0, 'DESIGN-004 component section must exist');
const components = css.slice(componentStart);

test('the shared button system exposes all approved semantic variants', () => {
  for (const variant of [
    'primary', 'secondary', 'tertiary', 'quiet', 'destructive', 'icon',
    'poker-fold', 'poker-passive', 'poker-aggressive', 'poker-all-in',
  ]) {
    assert.match(components, new RegExp(`\\.ui-button--${variant}`), variant);
  }
  assert.match(components, /--control-height:\s*40px/);
  assert.match(components, /\.ui-button\.is-loading/);
  assert.match(components, /button:disabled/);
});

test('icon buttons have bounded targets and accessible names', () => {
  assert.match(components, /\.ui-button--icon[\s\S]*?width:\s*42px/);
  const iconButtons = [...html.matchAll(/<button\b[^>]*class="[^"]*ui-button--icon[^"]*"[^>]*>/g)];
  assert.ok(iconButtons.length >= 2);
  for (const [tag] of iconButtons) {
    assert.match(tag, /aria-label="[^"]+"/);
    assert.match(tag, /title="[^"]+"/);
    assert.match(tag, /type="button"/);
  }
});

test('inputs and selects share semantic control primitives', () => {
  assert.match(html, /id="playersNum" class="control-input control-input--inline"/);
  assert.match(html, /id="stackMode" class="control-select"/);
  assert.match(components, /\.control-input\[aria-invalid="true"\]/);
  assert.match(components, /\.control-message--invalid/);
  assert.match(components, /font-variant-numeric:\s*tabular-nums/);
  assert.match(components, /select option \{ color: var\(--text-primary\); background: var\(--surface-elevated\); \}/);
});

test('range controls use shared track, thumb, focus, and disabled semantics', () => {
  assert.match(html, /id="players" class="control-range" type="range"/);
  assert.match(components, /\.control-range::\-webkit-slider-runnable-track/);
  assert.match(components, /\.control-range::\-webkit-slider-thumb/);
  assert.match(components, /\.control-range:disabled/);
  assert.match(components, /accent-color:\s*var\(--accent-primary\)/);
});

test('remaining switches expose labels and pressed states without replacing behavior', () => {
  const switches = [...html.matchAll(/<button\b[^>]*class="[^"]*ui-switch[^"]*"[^>]*>/g)];
  // Study Preview was intentionally replaced with a non-solution hint button.
  assert.ok(switches.length >= 3);
  for (const [tag] of switches) {
    assert.match(tag, /type="button"/);
    assert.match(tag, /aria-label="[^"]+"/);
    assert.match(tag, /aria-pressed="(?:true|false)"/);
  }
  assert.match(components, /\.ui-switch\[aria-pressed="true"\]/);
  assert.match(components, /transform:\s*translateX\(18px\)/);
});

test('tabs use structural selected semantics in markup and updates', () => {
  assert.match(html, /class="sub-tabs ui-segments" role="tablist"/);
  assert.match(html, /class="sub-tab ui-tab active"[^>]*role="tab"[^>]*aria-selected="true"/);
  assert.match(components, /\.ui-tab\[aria-selected="true"\]/);
  assert.match(components, /box-shadow:\s*inset 0 -2px 0 var\(--accent-primary\)/);
  assert.match(logic, /item\.setAttribute\('aria-selected', String\(isSelected\)\)/);
});

test('badges and state patterns use a bounded semantic vocabulary', () => {
  for (const tone of ['heuristic', 'experimental', 'available', 'unavailable', 'warning', 'success', 'info', 'error']) {
    assert.match(components, new RegExp(`status-badge--${tone}`), tone);
  }
  for (const state of ['loading', 'unavailable', 'disabled', 'error', 'invalid', 'success', 'result']) {
    assert.match(components, new RegExp(`state-block--${state}`), state);
  }
  assert.match(html, /id="sourceBadge"[^>]*>HEURISTIC</);
  assert.doesNotMatch(html, /id="sourceBadge"[^>]*>(?:GTO|DEEP CFR)/i);
});

test('modal, tooltip, and toast primitives share semantic surfaces', () => {
  assert.match(html, /class="modal overlay-surface"/);
  assert.match(html, /class="modal overlay-surface settings-modal"/);
  assert.match(components, /\[data-tooltip\]::after/);
  assert.match(html, /id="toast" role="status" aria-live="polite" aria-atomic="true" data-tone="info"/);
  for (const tone of ['success', 'warning', 'error']) {
    assert.match(components, new RegExp(`toast\\[data-tone="${tone}"\\]`));
  }
  assert.match(logic, /function toast\(message, tone = 'info'(?:, scope = activeWorkspaceMode\(\))?\)/);
});

test('comfortable and compact density share one token mechanism', () => {
  assert.match(html, /<body data-density="comfortable">/);
  assert.match(components, /\[data-density="compact"\]/);
  assert.match(components, /--control-height-compact:\s*34px/);
  assert.match(components, /--component-padding:/);
});

test('poker actions retain stable semantics across Training and Hand Mode', () => {
  assert.match(html, /id="trainingGuessButtons"[^>]*aria-label="Available actions"/);
  assert.match(logic, /canonicalTrainingLegalActionTypes\(exercise\)\.forEach/);
  assert.match(logic, /training-action-button--\$\{type\}/);
  assert.match(css, /training-action-button--fold[^}]*var\(--action-fold\)/);
  assert.match(css, /training-action-button--check,[\s\S]*training-action-button--call[^}]*var\(--action-passive\)/);
  assert.match(css, /training-action-button--bet,[\s\S]*training-action-button--raise[^}]*var\(--action-aggressive\)/);
  assert.match(css, /training-action-button--all_in[^}]*var\(--action-all-in\)/);
  assert.match(components, /ui-button--poker-fold[\s\S]*?var\(--action-fold\)/);
  assert.match(components, /ui-button--poker-passive[\s\S]*?var\(--action-passive\)/);
  assert.match(components, /ui-button--poker-aggressive[\s\S]*?var\(--action-aggressive\)/);
  assert.match(components, /data-canonical-action="all_in"[\s\S]*?var\(--action-all-in\)/);

  for (const theme of ['midnight', 'graphite', 'daylight']) {
    const block = css.match(new RegExp(`\\[data-theme="${theme}"\\]\\s*\\{([\\s\\S]*?)\\n\\}`))?.[1] ?? '';
    assert.doesNotMatch(block, /--action-/);
  }
});

test('Daylight controls explicitly consume semantic surfaces', () => {
  assert.match(components, /\[data-theme="daylight"\][\s\S]*?background-color:\s*var\(--surface-interactive\)/);
  assert.match(components, /\[data-theme="daylight"\][\s\S]*?\.ui-switch:not\(\.on\)/);
  assert.doesNotMatch(components.slice(components.indexOf('[data-theme="daylight"]')), /background(?:-color)?:\s*#0b1120/);
});

test('mobile rules preserve touch targets, wrapping, and viewport-safe overlays', () => {
  const mobile = components.slice(components.indexOf('@media (max-width: 768px)'));
  assert.match(mobile, /min-height:\s*44px/);
  assert.match(mobile, /\.settings-grid\s*\{\s*grid-template-columns:\s*minmax\(0, 1fr\)/);
  assert.match(mobile, /\.modal\s*\{\s*max-height:\s*calc\(100dvh - 16px\)/);
  assert.match(mobile, /#trainingGuessButtons\s*\{\s*flex-wrap:\s*wrap/);
});

test('component work leaves core poker contracts and function entry points intact', () => {
  for (const symbol of ['deriveDecisionContext', 'calculateEquity']) {
    assert.match(logic, new RegExp(symbol));
  }
  assert.match(strategy, /calculatePreflopFallbackStrategy/);
  assert.match(strategy, /calculatePostflopHeuristicStrategy/);
  assert.doesNotMatch(components, /DecisionContext|StrategyResult|PokerState|calculateEquity/);
});
