import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import { appStyleSheet, bootApp, indexDocument, text } from './helpers/app-under-test.mjs';

// SHELL-002: sidebar variant 4 (P1-01), hub screens (P1-02), the shared
// header with its context chip, and the workspace-switch motion hooks.
const markup = indexDocument();
const css = appStyleSheet();
const app = await bootApp();
// Self-installing modules: import only after booting (they need the window).
const {
  HUB_DESTINATIONS,
  hubForDestination,
  isHubDestination,
  nextNavigationIndex,
  resolveHubContinuations,
} = await import('../app/src/application/shell-navigation.mjs');
const {
  createWorkspaceHeaderController,
  normalizePlayContext,
  playContextTemplate,
  PLAY_CONTEXT_TEMPLATES,
} = await import('../app/src/application/workspace-header.mjs');
const translations = fs.readFileSync(new URL('../app/src/locales/home-translations.js', import.meta.url), 'utf8');
const homeTutorial = fs.readFileSync(new URL('../app/src/tutorial/home-tutorial.mjs', import.meta.url), 'utf8');
const calibrationWorkspace = fs.readFileSync(new URL('../app/src/application/range-calibration-workspace.mjs', import.meta.url), 'utf8');

test('hub definitions match the sidebar groups and every workspace keeps one route', () => {
  assert.deepEqual(HUB_DESTINATIONS, {
    study: ['training', 'personal-strategy', 'guide'],
    tools: ['hand', 'analyze', 'equity'],
    library: ['saved'],
  });
  for (const [hub, destinations] of Object.entries(HUB_DESTINATIONS)) {
    assert.ok(isHubDestination(hub));
    const group = markup.querySelector(`.mode-nav-group--${hub}`);
    assert.deepEqual(group.querySelectorAll('li > .mode-nav-item').map((item) => item.dataset.navigationId), destinations);
    for (const destination of destinations) {
      assert.equal(hubForDestination(destination), hub);
      assert.ok(markup.querySelector(`#hubMode .hub-card-list[data-hub="${hub}"] [data-hub-target="${destination}"]`), `${hub} card ${destination}`);
    }
  }
  assert.equal(isHubDestination('home'), false);
  // Home first; Game night apart below the groups; no placeholder My poker.
  const nav = markup.querySelector('nav.mode-navigation');
  assert.equal(nav.querySelector('.mode-nav-item').dataset.navigationId, 'home');
  assert.equal(nav.querySelector('.mode-nav-list--apart .mode-nav-item').dataset.navigationId, 'home-game');
  assert.equal(text(nav.querySelector('[data-navigation-id="home-game"] span')), 'Game night');
  assert.equal(text(nav.querySelector('[data-navigation-id="guide"] span')), 'Learn');
  assert.doesNotMatch(text(nav), /My poker|About/);
});

test('a group label opens its hub; a hub card opens its workspace', async () => {
  await app.navigate('study');
  const shell = app.$('.riverline-shell');
  assert.equal(shell.dataset.activeMode, 'hub');
  assert.equal(shell.dataset.activeDestination, 'study');
  assert.equal(text(app.byId('workspaceTitle')), 'Study');
  assert.equal(app.$('[data-navigation-id="study"]').getAttribute('aria-current'), 'page');
  assert.ok(app.byId('hubMode').classList.contains('active'));
  assert.equal(app.byId('homeMode').style.display, 'none');
  for (const list of app.$$('#hubMode .hub-card-list')) assert.equal(list.hidden, list.dataset.hub !== 'study', list.dataset.hub);

  await app.navigate('library');
  assert.equal(app.$('#hubMode .hub-card-list[data-hub="library"]').hidden, false);
  assert.equal(app.$('#hubMode .hub-card-list[data-hub="study"]').hidden, true);

  await app.navigate('tools');
  await app.click('#hubMode .hub-card[data-hub-target="equity"]');
  await app.settle(200);
  assert.equal(shell.dataset.activeDestination, 'equity');
  assert.ok(app.byId('equityMode').classList.contains('active'));
  assert.equal(app.byId('hubMode').style.display, 'none');

  app.call('navigateToProductDestination', 'study');
  await app.settle(200);
  assert.equal(shell.dataset.activeDestination, 'study');
  await app.navigate('home');
});

test('hub continue lines use only facts the app already holds', () => {
  const translate = (key, params = {}) => key.replace(/\{(\w+)\}/g, (_, name) => String(params[name]));
  assert.equal(resolveHubContinuations({}).size, 0, 'nothing known, nothing shown');
  const contexts = { hand: ['6-max · 100 bb', 'Flop'], training: ['Focused Drill', ''], analyze: ['Scenario', 'BTN', '100 bb', 'Preflop'] };
  const lines = resolveHubContinuations({
    translate,
    headerContext: (destination) => contexts[destination] ?? [],
    visited: new Set(['training', 'analyze']),
    homeModel: { sections: {
      continue: { items: [
        { kind: 'range_calibration', answeredCount: 12, totalCount: 169 },
        { kind: 'live_hand' },
      ] },
      recent: { status: 'ready', items: [{ title: 'BTN vs BB' }] },
    } },
  });
  assert.equal(lines.get('hand'), 'Hand in progress · 6-max · 100 bb · Flop');
  assert.equal(lines.get('personal-strategy'), '12 of 169 directly answered');
  assert.equal(lines.get('training'), 'Focused Drill');
  assert.equal(lines.get('analyze'), 'Scenario · BTN · 100 bb · Preflop');
  assert.equal(lines.get('saved'), 'Last saved: BTN vs BB');
  assert.equal(lines.has('equity') || lines.has('guide'), false, 'no invented continue state');
  // Training and Analyze lines only for workspaces opened this session.
  const unvisited = resolveHubContinuations({ headerContext: (destination) => contexts[destination] ?? [] });
  assert.equal(unvisited.has('training') || unvisited.has('analyze'), false);
  // A Hand header context alone is setup, not a hand in progress.
  assert.equal(resolveHubContinuations({ headerContext: (destination) => contexts[destination] ?? [] }).has('hand'), false);
  // Saved needs a loaded section with a real title.
  assert.equal(resolveHubContinuations({ homeModel: { sections: { recent: { status: 'error' } } } }).has('saved'), false);
});

test('the header context chip names the known Game and Approach as one isolated template', () => {
  assert.equal(normalizePlayContext({ game: '  ' }), null);
  assert.equal(playContextTemplate(normalizePlayContext({ game: 'Thursday live' })), PLAY_CONTEXT_TEMPLATES.game);
  assert.equal(playContextTemplate(normalizePlayContext({ game: 'Thursday live', approach: 'Serious' })), PLAY_CONTEXT_TEMPLATES.gameAndApproach);

  const chip = app.byId('workspacePlayContext');
  const header = app.window.RiverlineWorkspaceHeader;
  header.setPlayContext({ game: 'Thursday live', approach: 'Serious' });
  assert.equal(chip.hidden, false);
  assert.equal(text(chip), 'Game: Thursday live · Approach: Serious');
  assert.deepEqual(chip.querySelectorAll('bdi').map((node) => [node.getAttribute('dir'), node.textContent]), [['auto', 'Thursday live'], ['auto', 'Serious']]);
  assert.equal(chip.hasAttribute('data-i18n'), false, 'code-owned text carries no static key');
  header.setPlayContext(null);
  assert.equal(chip.hidden, true);

  // Read-only: a note, not a control.
  assert.equal(chip.localName, 'p');
  // Personal Strategy publishes to the chip instead of its context line.
  assert.match(calibrationWorkspace, /setPlayContext\?\.\(\{ game: entry\.profile\.displayName, approach: mode\?\.displayName \|\| '' \}\)/);
  assert.doesNotMatch(calibrationWorkspace, /setContext\('personal-strategy', \[entry\.profile/);

  // The controller re-renders the chip from the translated template.
  const document = { querySelector: (selector) => (selector === '#workspacePlayContext' ? chipStub : null) };
  const chipStub = {
    hidden: true,
    nodes: [],
    replaceChildren() { this.nodes = []; },
    append(node) { this.nodes.push(typeof node === 'string' ? node : `[${node.textContent}]`); },
  };
  const ownerDocument = { ...document, createElement: () => ({ dir: '', textContent: '' }) };
  const controller = createWorkspaceHeaderController({
    document: ownerDocument,
    translate: (key) => ({ 'Game: {game} · Approach: {approach}': 'משחק: {game} · גישה: {approach}' }[key] ?? key),
  });
  controller.setPlayContext({ game: 'Live', approach: 'Fun' });
  assert.deepEqual(chipStub.nodes, ['משחק: ', '[Live]', ' · גישה: ', '[Fun]']);
});

test('header title uses the display face; panel titles keep the body face', () => {
  assert.equal(css.cascaded(markup.getElementById('workspaceTitle'), 'font-family'), 'var(--font-display)');
  assert.equal(css.cascaded(markup.querySelector('.hub-card-title'), 'font-family'), 'var(--font-ui)');
  assert.equal(markup.querySelector('.workspace-header').dataset.motion, 'nav');
  assert.equal(markup.getElementById('modeRail').dataset.motion, 'control');
});

test('the active item has one signal: a tint and the accent bar, in both directions', () => {
  const active = markup.querySelector('.mode-nav-item[aria-current="page"]');
  const root = markup.documentElement;
  for (const dir of ['ltr', 'rtl']) {
    root.setAttribute('dir', dir);
    assert.equal(css.cascaded(active, 'background'), 'var(--navigation-active-surface)', dir);
    assert.equal(css.cascaded(active, 'box-shadow'), 'none', dir);
    assert.equal(css.cascaded(active, 'border-color'), 'transparent', dir);
  }
  root.setAttribute('dir', 'ltr');
  const bar = css.rules.find((rule) => rule.selectorText.includes('.mode-nav-item[aria-current="page"]::before')
    && rule.declarations.some((declaration) => declaration.value === 'var(--accent-primary)'));
  assert.ok(bar, 'accent bar on the active item');
  // Group labels are quiet overlines (uppercase except in Hebrew).
  const hub = markup.querySelector('.mode-nav-item--hub');
  assert.equal(css.cascaded(hub, 'text-transform'), 'uppercase');
  assert.equal(css.cascaded(hub, 'color'), 'var(--text-muted)');
  root.setAttribute('dir', 'rtl');
  assert.equal(css.cascaded(hub, 'text-transform'), 'none');
  root.setAttribute('dir', 'ltr');
});

test('arrow keys move focus through the sidebar; Tab order stays the button order', async () => {
  assert.equal(nextNavigationIndex('ArrowDown', 11, 12), 0);
  assert.equal(nextNavigationIndex('ArrowUp', 0, 12), 11);
  assert.equal(nextNavigationIndex('End', 3, 12), 11);
  assert.equal(nextNavigationIndex('Tab', 3, 12), -1);
  const items = app.$$('.mode-navigation .mode-nav-item');
  items[0].focus();
  await app.key(items[0], 'ArrowDown');
  assert.ok(app.document.activeElement === items[1], 'ArrowDown focuses the next item');
  await app.key(items[1], 'ArrowUp');
  assert.ok(app.document.activeElement === items[0], 'ArrowUp focuses the previous item');
  assert.equal(app.$('.riverline-shell').dataset.activeDestination, 'home', 'arrows move focus only');
});

test('the workspace switch enters from the direction of travel', async () => {
  await app.navigate('home-game');
  assert.equal(app.$('.workspace-canvas').dataset.navDirection, 'forward');
  await app.navigate('training');
  assert.equal(app.$('.workspace-canvas').dataset.navDirection, 'back');
  await app.navigate('home');
  const view = markup.querySelector('#homeMode');
  assert.match(css.cascaded(view, 'animation'), /shell-workspace-enter/);
  markup.querySelector('.workspace-canvas').dataset.navDirection = 'back';
  assert.equal(css.cascaded(markup.querySelector('.workspace-canvas'), '--shell-switch-offset'), '-10px');
});

test('tours keep their sidebar target and new strings exist in RU and HE', () => {
  assert.equal(markup.querySelectorAll('[data-tutorial-anchor="shell-navigation"]').length, 1);
  assert.equal(markup.querySelector('[data-tutorial-anchor="shell-navigation"]').localName, 'nav');
  assert.match(homeTutorial, /anchor: 'shell-navigation'/);
  for (const key of ['Study', 'Tools', 'Learn', 'Game: {game} · Approach: {approach}', 'Game: {game}', 'Hand in progress · {facts}', 'Last saved: {title}',
    'Practice decisions in drills or full hands and see how they compare.', 'Calculate win chances for known hands, ranges and unknown cards.']) {
    const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    assert.equal((translations.match(new RegExp(`['"]${escaped}['"]:`, 'g')) || []).length, 2, key);
  }
  for (const node of markup.querySelectorAll('#hubMode [data-i18n]')) {
    const escaped = node.dataset.i18n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    assert.ok(new RegExp(`['"]${escaped}['"]:`).test(translations) || ['Training', 'Personal Strategy', 'Equity'].includes(node.dataset.i18n), node.dataset.i18n);
  }
});
