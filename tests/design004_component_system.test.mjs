import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import { appStyleSheet, bootApp, indexDocument, text } from './helpers/app-under-test.mjs';

// TEST-HYGIENE-001: index.html / styles.css / logic.js assertions are
// behavioural: component probes are resolved through the cascade (the
// DS-FOUNDATION-001 component layer replaced the DESIGN-004 section), markup
// is parsed, and runtime updates are exercised in the running app. Strategy
// module sources are outside this ticket.
const strategy = [
  '../app/src/strategy/preflop-heuristic.mjs',
  '../app/src/strategy/postflop-heuristic.mjs',
].map((url) => fs.readFileSync(new URL(url, import.meta.url), 'utf8')).join('\n');
const markup = indexDocument();
const css = appStyleSheet();
const app = await bootApp();
const root = markup.documentElement;

function probe(html) {
  const host = markup.createElement('div');
  host.dataset.probe = '';
  host.innerHTML = html;
  markup.body.appendChild(host);
  return host.firstElementChild;
}
const cascaded = (element, property, options) => css.cascaded(element, property, options);
function eachTheme(callback) {
  const previous = root.dataset.theme;
  try {
    return ['midnight', 'graphite', 'daylight'].map((theme) => {
      root.dataset.theme = theme;
      return callback(theme);
    });
  } finally {
    root.dataset.theme = previous;
  }
}

test('the shared button system exposes all approved semantic variants', () => {
  const base = probe('<button class="ui-button">Base</button>');
  const baseLook = [cascaded(base, 'background'), cascaded(base, 'color'), cascaded(base, 'border-color')].join('|');
  const looks = new Map();
  for (const variant of ['primary', 'secondary', 'tertiary', 'quiet', 'destructive', 'icon', 'poker-fold', 'poker-passive', 'poker-aggressive', 'poker-all-in']) {
    const button = probe(`<button class="ui-button ui-button--${variant}">${variant}</button>`);
    looks.set(variant, [cascaded(button, 'background'), cascaded(button, 'color'), cascaded(button, 'border-color'), cascaded(button, 'width')].join('|'));
  }
  // Each variant is styled; secondary/tertiary/icon share the base surface
  // (icon differs by its square target).
  for (const variant of ['primary', 'quiet', 'destructive', 'poker-fold', 'poker-passive', 'poker-aggressive', 'poker-all-in']) {
    assert.notEqual(looks.get(variant).split('|').slice(0, 3).join('|'), baseLook, variant);
  }
  assert.equal(new Set([...looks.values()]).size >= 8, true);
  assert.equal(cascaded(root, '--control-height-md'), '36px');
  assert.equal(cascaded(root, '--control-height'), 'var(--control-height-md)');
  assert.equal(cascaded(probe('<button class="ui-button is-loading">x</button>'), 'cursor'), 'progress');
  assert.equal(cascaded(probe('<button class="ui-button" disabled>x</button>'), 'cursor'), 'not-allowed');
});

test('icon buttons have bounded targets and accessible names', () => {
  for (const attributes of ['class="ui-button ui-button--icon"', 'class="ui-button" data-variant="icon"', 'class="ui-button ui-button-icon"']) {
    assert.equal(cascaded(probe(`<button ${attributes}>i</button>`), 'width'), 'var(--control-height)', attributes);
  }
  assert.equal(cascaded(probe('<button class="close">x</button>'), 'width'), '42px');
  const iconButtons = markup.querySelectorAll('button.ui-button--icon').filter((button) => !button.closest('[data-probe]'));
  assert.ok(iconButtons.length >= 2);
  for (const button of iconButtons) {
    assert.ok(button.getAttribute('aria-label'), button.id);
    assert.ok(button.getAttribute('title'), button.id);
    assert.equal(button.getAttribute('type'), 'button', button.id);
  }
});

test('inputs and selects share semantic control primitives', () => {
  const players = markup.getElementById('playersNum');
  assert.ok(players.classList.contains('control-input') && players.classList.contains('control-input--inline'));
  assert.ok(markup.getElementById('stackMode').classList.contains('control-select'));
  const valid = probe('<input class="control-input">');
  const invalid = probe('<input class="control-input" aria-invalid="true">');
  assert.equal(cascaded(invalid, 'border-color'), 'var(--border-invalid)');
  assert.notEqual(cascaded(valid, 'border-color'), 'var(--border-invalid)');
  assert.equal(cascaded(probe('<p class="control-message control-message--invalid">x</p>'), 'color'), 'var(--status-danger)');
  assert.equal(cascaded(valid, 'font-variant-numeric'), 'tabular-nums');
  const option = probe('<select><option>a</option></select>').firstElementChild;
  assert.equal(cascaded(option, 'color'), 'var(--text-primary)');
  assert.equal(cascaded(option, 'background'), 'var(--surface-elevated)');
});

test('range controls use shared track, thumb, focus, and disabled semantics', () => {
  const players = markup.getElementById('players');
  assert.ok(players.classList.contains('control-range'));
  assert.equal(players.getAttribute('type'), 'range');
  const range = probe('<input class="control-range" type="range">');
  assert.equal(cascaded(range, 'accent-color'), 'var(--accent-primary)');
  assert.ok(cascaded(range, 'background', { pseudoElement: '-webkit-slider-runnable-track' }), 'styled track');
  assert.equal(cascaded(range, 'background', { pseudoElement: '-webkit-slider-thumb' }), 'var(--accent-primary)');
  assert.equal(cascaded(probe('<input class="control-range" type="range" disabled>'), 'cursor'), 'not-allowed');
});

test('remaining switches expose labels and pressed states without replacing behavior', async () => {
  const switches = markup.querySelectorAll('button.ui-switch').filter((button) => !button.closest('[data-probe]'));
  // Study Preview was intentionally replaced with a non-solution hint button.
  assert.ok(switches.length >= 3);
  for (const control of switches) {
    assert.equal(control.getAttribute('type'), 'button', control.id);
    assert.ok(control.getAttribute('aria-label'), control.id);
    assert.match(control.getAttribute('aria-pressed') || '', /^(?:true|false)$/, control.id);
  }
  // Protects: on/pressed/checked switches take the accent and move the knob.
  for (const state of ['class="ui-switch on"', 'class="ui-switch" aria-pressed="true"', 'class="ui-switch" aria-checked="true"']) {
    const control = probe(`<button ${state}><b></b></button>`);
    assert.equal(cascaded(control, 'background'), 'var(--accent-primary)', state);
    assert.equal(cascaded(control.firstElementChild, 'transform'), 'translateX(18px)', state);
  }
  const off = probe('<button class="ui-switch" aria-pressed="false"><b></b></button>');
  assert.equal(cascaded(off.firstElementChild, 'transform'), 'translateX(0)');
  // The running toggle keeps aria-pressed in sync.
  const toggle = app.byId('toggleAdvanced');
  const before = toggle.getAttribute('aria-pressed');
  await app.click(toggle);
  assert.notEqual(toggle.getAttribute('aria-pressed'), before);
  await app.click(toggle);
  assert.equal(toggle.getAttribute('aria-pressed'), before);
});

test('tabs use structural selected semantics in markup and updates', async () => {
  // ANALYZE-COMPOSITION-001: Analyze view navigation moved to the underline Tabs component.
  const list = markup.querySelector('.sub-tabs.ui-tabs');
  assert.equal(list.getAttribute('role'), 'tablist');
  const active = list.querySelector('.sub-tab.ui-tab.active');
  assert.equal(active.getAttribute('role'), 'tab');
  assert.equal(active.getAttribute('aria-selected'), 'true');
  for (const state of ['class="ui-tab active"', 'class="ui-tab" aria-selected="true"', 'class="ui-tab" aria-pressed="true"']) {
    assert.equal(cascaded(probe(`<button ${state}>t</button>`), 'box-shadow'), 'inset 0 -2px 0 var(--accent-primary)', state);
  }
  assert.equal(cascaded(probe('<button class="ui-tab">t</button>'), 'box-shadow'), 'none');
  // Selecting a tab updates aria-selected structurally.
  await app.navigate('analyze');
  const tabs = app.$$('.sub-tabs.ui-tabs [role="tab"]');
  const target = tabs.find((tab) => tab.getAttribute('aria-selected') !== 'true' && !tab.disabled && app.isShown(tab));
  assert.ok(target, 'an unselected tab is available');
  await app.click(target);
  assert.equal(target.getAttribute('aria-selected'), 'true');
  for (const tab of tabs.filter((tab) => tab !== target)) assert.equal(tab.getAttribute('aria-selected'), 'false', tab.textContent);
  await app.click(tabs[0]);
});

test('badges and state patterns use a bounded semantic vocabulary', () => {
  const toneColor = {
    heuristic: 'var(--status-warning)', experimental: 'var(--status-warning)', warning: 'var(--status-warning)',
    available: 'var(--status-positive)', success: 'var(--status-positive)',
    unavailable: 'var(--status-danger)', error: 'var(--status-danger)', info: 'var(--status-info)',
  };
  for (const [tone, color] of Object.entries(toneColor)) {
    assert.equal(cascaded(probe(`<span class="status-badge status-badge--${tone}">x</span>`), 'color'), color, tone);
  }
  const stateColor = {
    loading: 'var(--text-muted)', unavailable: 'var(--text-disabled)', disabled: 'var(--text-disabled)',
    error: 'var(--status-danger)', invalid: 'var(--status-danger)', success: 'var(--status-positive)', result: 'var(--status-positive)',
  };
  for (const [state, color] of Object.entries(stateColor)) {
    assert.equal(cascaded(probe(`<div class="state-block state-block--${state}">x</div>`), 'color'), color, state);
  }
  const source = markup.getElementById('sourceBadge');
  assert.equal(text(source), 'HEURISTIC');
  assert.doesNotMatch(text(source), /GTO|DEEP CFR/i);
});

test('modal, tooltip, and toast primitives share semantic surfaces', () => {
  assert.ok(markup.querySelector('.modal.overlay-surface'));
  assert.ok(markup.querySelector('.modal.overlay-surface.settings-modal'));
  assert.equal(cascaded(probe('<span data-tooltip="Tip">x</span>'), 'content', { pseudoElement: 'after' }), 'attr(data-tooltip)');
  const toastNode = markup.getElementById('toast');
  assert.equal(toastNode.getAttribute('role'), 'status');
  assert.equal(toastNode.getAttribute('aria-live'), 'polite');
  assert.equal(toastNode.getAttribute('aria-atomic'), 'true');
  assert.equal(toastNode.dataset.tone, 'info');
  for (const [tone, color] of [['success', 'var(--status-positive)'], ['warning', 'var(--status-warning)'], ['error', 'var(--status-danger)']]) {
    assert.match(cascaded(probe(`<div class="toast" data-tone="${tone}">x</div>`), 'border-color'), new RegExp(color.replace(/[()]/g, '\\$&')), tone);
  }
  // toast(message, tone) defaults to info and sets the tone.
  app.call('toast', 'Saved', 'warning');
  assert.equal(app.byId('toast').dataset.tone, 'warning');
  app.call('toast', 'Hello');
  assert.equal(app.byId('toast').dataset.tone, 'info');
  app.call('clearToast');
});

test('comfortable and compact density share one token mechanism', () => {
  assert.equal(root.dataset.density, 'comfortable');
  assert.equal(cascaded(root, '--control-height-compact'), 'var(--control-height-sm)');
  assert.equal(cascaded(root, '--control-height-sm'), '32px');
  const body = markup.body;
  const comfortable = cascaded(body, '--component-padding');
  assert.ok(comfortable);
  root.dataset.density = 'compact';
  try {
    assert.notEqual(cascaded(body, '--control-height'), 'var(--control-height-md)', 'Compact retunes the shared control token');
  } finally {
    root.dataset.density = 'comfortable';
  }
});

test('poker actions retain stable semantics across Training and Hand Mode', async () => {
  assert.equal(markup.getElementById('trainingGuessButtons').getAttribute('aria-label'), 'Available actions');
  // Training renders one typed button per canonical legal action.
  await app.training.start('focused');
  const buttons = app.training.answerButtons();
  assert.ok(buttons.length >= 2);
  for (const button of buttons) assert.ok(button.classList.contains(`training-action-button--${button.dataset.action}`), button.className);
  const accent = (type) => cascaded(probe(`<button class="training-action-button training-action-button--${type}">x</button>`), 'border-inline-start-color');
  assert.equal(accent('fold'), 'var(--action-fold)');
  for (const type of ['check', 'call']) assert.equal(accent(type), 'var(--action-passive)', type);
  for (const type of ['bet', 'raise']) assert.equal(accent(type), 'var(--action-aggressive)', type);
  assert.equal(accent('all_in'), 'var(--action-all-in)');
  for (const [variant, token] of [['fold', 'fold'], ['passive', 'passive'], ['aggressive', 'aggressive'], ['all-in', 'all-in']]) {
    assert.equal(cascaded(probe(`<button class="ui-button ui-button--poker-${variant}">x</button>`), 'background'), `var(--action-${token})`, variant);
  }
  const allIn = probe('<div class="hand-legal-actions"><button class="ui-button" data-canonical-action="all_in">x</button></div>').firstElementChild;
  assert.equal(cascaded(allIn, 'color'), 'var(--action-all-in)');
  // Themes never redefine the action tokens.
  const tokens = eachTheme(() => ['fold', 'passive', 'aggressive', 'all-in'].map((token) => cascaded(root, `--action-${token}`)).join('|'));
  assert.equal(new Set(tokens).size, 1, tokens.join(' / '));
});

test('Daylight controls explicitly consume semantic surfaces', () => {
  // DS-FOUNDATION-001: every theme (Daylight included) drives the same component
  // rules through semantic primitives; no per-theme component overrides remain.
  const controls = [
    probe('<button class="ui-button">x</button>'),
    probe('<button class="ui-button ui-button--primary">x</button>'),
    probe('<input class="control-input">'),
    probe('<select class="control-select"></select>'),
    probe('<button class="ui-switch"><b></b></button>'),
  ];
  const looks = eachTheme(() => controls.map((control) => ['background', 'background-color', 'color', 'border-color'].map((property) => cascaded(control, property)).join(',')).join('|'));
  assert.equal(new Set(looks).size, 1, 'component declarations are theme-independent');
  assert.equal(cascaded(probe('<input class="control-input">'), 'background-color'), 'var(--surface-inset)');
  assert.equal(cascaded(probe('<button class="ui-switch"><b></b></button>'), 'background'), 'var(--surface-inset)');
  for (const control of controls) assert.doesNotMatch(`${cascaded(control, 'background')}${cascaded(control, 'background-color')}`, /#0b1120/i);
});

test('mobile rules preserve touch targets, wrapping, and viewport-safe overlays', () => {
  const mobile = { width: 700 };
  assert.equal(cascaded(probe('<button class="ui-button">x</button>'), 'min-height', mobile), '44px');
  assert.equal(cascaded(probe('<div class="settings-grid"></div>'), 'grid-template-columns', mobile), 'minmax(0, 1fr)');
  // Viewport-safe modal height (superseded literal: 16px became 2 × --space-6).
  assert.match(cascaded(markup.querySelector('.modal'), 'max-height', mobile), /^calc\(100dvh - /);
  // Training actions never overflow: the action set is a grid, and its
  // narrow-phone fallback wraps (the wrap rule now lives at <=420px).
  const actions = markup.getElementById('trainingGuessButtons');
  assert.equal(cascaded(actions, 'display', mobile), 'grid');
  assert.equal(cascaded(actions, 'flex-wrap', { width: 400 }), 'wrap');
});

test('component work leaves core poker contracts and function entry points intact', () => {
  assert.equal(typeof app.window.RiverlinePlaybookState, 'object');
  assert.equal(app.evaluate('typeof calculateEquity'), 'function');
  assert.match(strategy, /calculatePreflopFallbackStrategy/);
  assert.match(strategy, /calculatePostflopHeuristicStrategy/);
  for (const term of ['DecisionContext', 'StrategyResult', 'PokerState', 'calculateEquity']) {
    assert.equal(css.rulesMentioning(term).length, 0, term);
  }
});
