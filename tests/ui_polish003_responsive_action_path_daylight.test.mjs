import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import { appStyleSheet, bootApp, indexDocument, text } from './helpers/app-under-test.mjs';
import { parseHTML } from './helpers/mini-dom.mjs';

// TEST-HYGIENE-001: index.html / styles.css / logic.js assertions are
// behavioural: the Action Path is rendered and toggled in the running app and
// styles/tokens are resolved through the cascade. Renderer, locale and Electron
// verifier sources are outside this ticket.
const table = fs.readFileSync(new URL('../app/src/ui/TableRenderer.js', import.meta.url), 'utf8');
const translations = fs.readFileSync(new URL('../app/src/locales/product-translations.js', import.meta.url), 'utf8');
const electronVerifier = fs.readFileSync(new URL('./tooling/verify_ui_polish003_electron.cjs', import.meta.url), 'utf8');
const markup = indexDocument();
const html = markup;
const css = appStyleSheet();
const staticPanel = markup.getElementById('playbookDecisionPathPanel');
const app = await bootApp();
const panel = () => app.byId('playbookDecisionPathPanel');
const compactMount = () => app.byId('playbookCompactActionPathMount');
const CONSTRAINED = { width: 1400 };

await app.navigate('analyze');
await app.pickCards('#gtoMode [data-card-set-edit="hero"]', ['As', 'Kd']);

test('one Action Path panel and renderer move between full and compact mounts', () => {
  // Protects: exactly one panel and path list exist in markup (initially in
  // the rail mount); at runtime that same panel is moved (not cloned) into the
  // compact mount; there is one renderPath renderer.
  assert.equal(markup.querySelectorAll('#playbookDecisionPathPanel').length, 1);
  assert.equal(markup.querySelectorAll('#pathList').length, 1);
  assert.ok(markup.getElementById('playbookCompactActionPathMount'));
  assert.ok(markup.getElementById('playbookActionPathRailMount').contains(staticPanel));
  assert.equal(app.$$('#playbookDecisionPathPanel').length, 1);
  assert.equal(app.$$('#pathList').length, 1);
  assert.equal(panel().parentElement, compactMount());
  const before = panel();
  app.call('applyActionPathPresentation', false);
  assert.equal(panel(), before, 'the panel is moved, not recreated');
  assert.equal(panel().parentElement, app.byId('playbookActionPathRailMount'));
  app.call('applyActionPathPresentation', true);
  assert.equal(panel(), before);
  assert.equal(panel().parentElement, compactMount());
  assert.equal(app.evaluate('typeof renderPath'), 'function');
});

test('the street stepper uses the compact mount at every width (ANALYZE-COMPOSITION-001)', () => {
  // Superseded selection: the Result panel's street stepper replaces the Action path rail, so the
  // same panel and renderer are always placed in the compact mount with every step's context shown.
  let mediaQueries = 0;
  const matchMedia = app.window.matchMedia;
  app.window.matchMedia = (query) => { mediaQueries += 1; return matchMedia(query); };
  try {
    app.call('applyActionPathPresentation', true);
    app.call('renderPath');
  } finally {
    app.window.matchMedia = matchMedia;
  }
  assert.equal(mediaQueries, 0, 'presentation does not depend on viewport queries');
  assert.equal(panel().dataset.actionPathPresentation, 'compact');
  assert.equal(panel().parentElement, compactMount());
  assert.ok(panel().classList.contains('is-expanded'), 'every step shows its context');
  // Constrained desktop: the collapsed stepper is a four-column progression.
  panel().classList.remove('is-expanded');
  assert.equal(css.cascaded(app.$('#pathList .path-progress'), 'grid-template-columns', CONSTRAINED), 'repeat(4, minmax(0, 1fr))');
  panel().classList.add('is-expanded');
  assert.ok(app.$('#pathList .path-current-summary'));
});

test('compact geometry is intrinsic, bounded, and does not mask overflow', () => {
  const mount = compactMount();
  // The Analyze layout preset sizes the mount intrinsically (auto), superseding
  // the earlier min(100%, 720px) cap; it never clips or caps its height.
  assert.equal(css.cascaded(mount, 'width', CONSTRAINED), 'auto');
  assert.equal(css.cascaded(mount, 'min-height', CONSTRAINED), '0');
  assert.equal(css.cascaded(mount, 'max-height', CONSTRAINED), 'none');
  assert.equal(css.cascaded(mount, 'overflow', CONSTRAINED), 'visible');
  assert.equal(css.cascaded(panel(), 'height', CONSTRAINED), 'auto');
  assert.equal(css.cascaded(panel(), 'overflow', CONSTRAINED), 'visible');
  panel().classList.remove('is-expanded');
  assert.equal(css.cascaded(app.$('#pathList .path-current-summary strong'), 'overflow-wrap', CONSTRAINED), 'anywhere', 'the collapsed branch summary wraps');
  panel().classList.add('is-expanded');
  assert.match(electronVerifier, /compact panel vertically clips content/);
  assert.match(electronVerifier, /current branch collides with panel bottom/);
});

test('compact path preserves street progression, current state, branch summary, and truthful unavailable state', async () => {
  // Protects: four streets in order; the current street carries
  // aria-current="step" and a "Current street" prefix; the current branch is
  // "<position> · <last action>"; an unavailable path renders a status message.
  app.call('renderPath');
  const steps = app.$$('#pathList .path-step');
  assert.deepEqual(steps.map((step) => text(step.querySelector('b')).replace(/^Current street: /, '')), ['Preflop', 'Flop', 'Turn', 'River']);
  const current = app.$$('#pathList [aria-current="step"]');
  assert.equal(current.length, 1);
  assert.match(text(current[0]), /^Current street: Preflop/);
  const context = app.window.app.decisionContext;
  const branch = text(app.$('#pathList .path-current-summary strong'));
  assert.ok(branch.startsWith(`${context.heroPosition} · `), branch);
  assert.doesNotMatch(branch, /undefined|null/);
  await app.pickCards('#gtoMode [data-card-set-edit="board"]', ['2c', '7d', '9h']);
  app.call('renderPath');
  assert.match(text(app.$('#pathList [aria-current="step"]')), /Flop/);

  app.call('renderUnavailableActionPath', 'No decision yet');
  const unavailable = app.$('#pathList .action-path-unavailable');
  assert.equal(unavailable.getAttribute('role'), 'status');
  assert.equal(text(unavailable), 'No decision yet');
  assert.equal(panel().dataset.actionPathState, 'unavailable');
  app.call('renderPath');
});

test('details disclosure is localized, keyboard-native, and not globally persisted', async () => {
  const toggle = markup.getElementById('actionPathDetailsToggle');
  assert.equal(toggle.type, 'button');
  assert.equal(toggle.getAttribute('aria-expanded'), 'false');
  assert.equal(toggle.getAttribute('aria-controls'), 'pathList');
  const live = app.byId('actionPathDetailsToggle');
  const writes = [];
  for (const store of [app.window.localStorage, app.window.sessionStorage]) {
    const setItem = store.setItem;
    store.setItem = (key, value) => { writes.push(key); return setItem.call(store, key, value); };
  }
  const expanded = live.getAttribute('aria-expanded');
  await app.click(live);
  assert.notEqual(live.getAttribute('aria-expanded'), expanded);
  assert.equal(text(live), live.getAttribute('aria-expanded') === 'true' ? 'Collapse details' : 'Expand details');
  await app.click(live);
  assert.equal(live.getAttribute('aria-expanded'), expanded);
  assert.equal(text(live), expanded === 'true' ? 'Collapse details' : 'Expand details');
  assert.deepEqual(writes, [], 'the disclosure state is not persisted');
  for (const key of ['Collapse details', 'Expand details', 'Current branch', 'Current street', 'Street progression']) {
    assert.equal((translations.match(new RegExp(`"${key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"`, 'g')) || []).length, 2, `${key} must have RU and HE entries`);
  }
});

test('Daylight and Midnight tables keep the semantic felt-driven token grammar', () => {
  const root = parseHTML('<html><body></body></html>').documentElement;
  const tokenIn = (themeId, name) => {
    if (themeId) root.setAttribute('data-theme', themeId); else root.removeAttribute('data-theme');
    return css.cascaded(root, name) || '';
  };
  assert.match(tokenIn('daylight', '--poker-table-rail-start'), /^color-mix\(in srgb, var\(--surface-shell\)/);
  assert.match(tokenIn('daylight', '--poker-table-surface-start'), /^color-mix\(in srgb, var\(--poker-felt-accent\)/);
  assert.match(tokenIn('daylight', '--poker-table-surface-end'), /^color-mix\(in srgb, var\(--poker-felt-accent\)/);
  assert.equal(tokenIn('daylight', '--poker-table-seat'), 'var(--surface-elevated)');
  assert.equal(tokenIn('daylight', '--poker-table-shadow-opacity'), '0.14');

  // DS-FOUNDATION-001 moved the root poker-table tokens into the single token block.
  assert.match(tokenIn(null, '--poker-table-rail-start'), /^color-mix\(in srgb, var\(--surface-elevated\)/);
  assert.match(tokenIn(null, '--poker-table-rail-end'), /^color-mix\(in srgb, var\(--surface-inset\)/);
  assert.match(tokenIn(null, '--poker-table-surface-start'), /^color-mix\(in srgb, var\(--poker-felt-accent\)/);
  assert.match(tokenIn(null, '--poker-table-surface-end'), /^color-mix\(in srgb, var\(--poker-felt-accent\)/);
  assert.equal(tokenIn(null, '--poker-table-shadow-opacity'), '0.28');
  assert.equal(tokenIn('midnight', '--poker-table-shadow-opacity'), '0.28');
});

test('table physicality and card, chip, seat, dealer, and contribution hooks are readable', () => {
  assert.match(table, /class="table-rail table-rail--outer" x="90" y="98" width="820" height="416" rx="208" ry="208"/);
  assert.match(table, /class="table-surface" x="120" y="128" width="760" height="356" rx="178" ry="178"/);
  assert.doesNotMatch(table, /<(?:rect|ellipse|path)[^>]+(?:id|class)="table-betting-line"/);
  assert.match(table, /class="table-shadow-effect" dx="0" dy="7" stdDeviation="8" flood-opacity="0\.28"/);
  for (const hook of ['table-seat', 'table-hole-cards', 'table-contribution', 'table-pot', 'table-dealer-button']) {
    assert.match(table, new RegExp(hook));
  }
  for (const id of ['savedStudySaveButton', 'handSavedStudyActionMount', 'replaySavedStudyActionMount']) {
    assert.ok(html.getElementById(id), id);
  }
});

test('responsive presentation code does not resolve strategy, Equity, Training, or poker accounting', async () => {
  // Protects: moving, rendering and toggling the Action Path does no strategy,
  // Equity, Training or canonical-state work.
  const spy = app.spy(['updateContext', 'calculateEquity', 'setEquityPending', 'callTrainingServiceBridge', 'callPlaybookStateBridge', 'renderChart']);
  try {
    app.call('applyActionPathPresentation', true);
    app.call('renderPath');
    await app.click('#actionPathDetailsToggle');
    await app.click('#actionPathDetailsToggle');
    app.call('renderUnavailableActionPath', 'Unavailable');
    assert.equal(spy.total(), 0, JSON.stringify(spy.sequence));
  } finally {
    spy.restore();
  }
});
