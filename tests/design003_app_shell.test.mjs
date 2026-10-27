import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import { appStyleSheet, bootApp, indexDocument, text } from './helpers/app-under-test.mjs';

// TEST-HYGIENE-001: index.html / styles.css / logic.js assertions are
// behavioural (parsed markup, the running shell, the cascade). SoundFX, i18n
// and workspace-header sources are outside this ticket.
const sound = fs.readFileSync(new URL('../app/src/core/SoundFX.js', import.meta.url), 'utf8');
const i18n = fs.readFileSync(new URL('../app/src/locales/i18n.js', import.meta.url), 'utf8');
const headerModule = fs.readFileSync(new URL('../app/src/application/workspace-header.mjs', import.meta.url), 'utf8');
const markup = indexDocument();
const css = appStyleSheet();
const app = await bootApp();
const shellMarkup = () => markup.querySelector('.riverline-shell');

test('the application opens directly into the workstation', () => {
  for (const id of ['mainMenuOverlay', 'enterWorkstationBtn']) assert.equal(markup.getElementById(id), null, id);
  assert.equal(markup.querySelector('.valorant-menu-overlay'), null);
  assert.equal(css.rulesMentioning('valorant-menu-overlay').length + css.rulesMentioning('valorant-btn').length, 0);
  const shell = shellMarkup();
  assert.equal(shell.dataset.activeMode, 'home');
  assert.equal(shell.dataset.activeDestination, 'home');
  const home = markup.getElementById('homeMode');
  assert.equal(home.localName, 'section');
  assert.ok(home.classList.contains('mode-view') && home.classList.contains('active'));
  assert.equal(app.byId('homeMode').classList.contains('active'), true, 'the running app opens on Home');
});

test('the shell exposes a deliberate core and support hierarchy with structural active semantics', async () => {
  // Protects: the variant 4 groups (SHELL-002);
  // aria-current and data attributes follow the active destination and the
  // active mode view is shown.
  const shell = shellMarkup();
  for (const destination of ['hand', 'analyze', 'training', 'personal-strategy', 'equity', 'saved', 'home', 'home-game', 'guide']) {
    assert.ok(shell.querySelector(`[data-navigation-id="${destination}"]`), destination);
  }
  // SHELL-002: Study, Tools and Library groups; Home first, Game night apart.
  const study = shell.querySelector('.mode-nav-group--study');
  const tools = shell.querySelector('.mode-nav-group--tools');
  const library = shell.querySelector('.mode-nav-group--library');
  assert.ok(study.querySelector('[data-navigation-id="training"]') && study.querySelector('[data-navigation-id="guide"]'));
  assert.ok(tools.querySelector('[data-navigation-id="hand"]') && tools.querySelector('[data-navigation-id="equity"]'));
  assert.ok(library.querySelector('[data-navigation-id="saved"]'));
  assert.ok(shell.querySelector('.mode-nav-list--apart [data-navigation-id="home-game"]'));
  assert.equal(shell.querySelector('[data-navigation-id="home"]').getAttribute('aria-current'), 'page');
  assert.equal(shell.querySelector('[data-navigation-id="hand"]').getAttribute('aria-current'), 'false');

  await app.navigate('training');
  const items = app.$$('.mode-nav-item[data-mode]');
  for (const item of items) {
    assert.equal(item.getAttribute('aria-current'), item.dataset.navigationId === 'training' ? 'page' : 'false', item.dataset.navigationId);
  }
  assert.equal(app.byId('trainingMode').style.display, 'block');
  assert.ok(app.byId('trainingMode').classList.contains('active'));
  assert.equal(app.byId('homeMode').style.display, 'none');
});

test('mode switching updates workspace context without touching poker state', async () => {
  // Protects: the header title/context follow the destination; switching
  // workspaces resolves no strategy or Equity and changes no poker state.
  const title = markup.getElementById('workspaceTitle');
  assert.equal(text(title), 'Home');
  // SHELL-001: the header bar shows a context line; the description moved to Help.
  assert.ok(markup.getElementById('workspaceContext'));
  assert.equal(markup.getElementById('workspaceSubtitle'), null);
  assert.equal(markup.getElementById('workspaceEyebrow'), null);

  const state = { decisionContext: app.window.app.decisionContext, strategyResult: app.window.app.strategyResult };
  const spy = app.spy(['calculateEquity', 'updateContext']);
  try {
    for (const [destination, expectedTitle] of [['equity', 'Equity'], ['training', 'Training'], ['home', 'Home'], ['saved', 'Saved'], ['guide', 'Learn'], ['study', 'Study'], ['tools', 'Tools'], ['library', 'Library']]) {
      await app.navigate(destination);
      const shell = app.$('.riverline-shell');
      const button = app.$(`.mode-nav-item[data-navigation-id="${destination}"]`);
      assert.equal(shell.dataset.activeMode, button.dataset.mode);
      assert.equal(shell.dataset.activeDestination, destination);
      assert.equal(text(app.byId('workspaceTitle')), expectedTitle, `${destination} header title`);
    }
    assert.equal(spy.total(), 0, JSON.stringify(spy.sequence));
  } finally {
    spy.restore();
  }
  assert.equal(app.window.app.decisionContext, state.decisionContext);
  assert.equal(app.window.app.strategyResult, state.strategyResult);
  assert.match(headerModule, /title\.textContent = translate\(titleKey\)/);
});

test('settings, language, audio, and sidebar collapse controls remain available', async () => {
  const shell = shellMarkup();
  for (const id of ['openSettings', 'langToggle', 'audioToggleBtn', 'sidebarCollapseBtn']) assert.ok(shell.querySelector(`#${id}`), id);
  await app.click('#openSettings');
  assert.ok(app.byId('settingsModal').classList.contains('show'), 'Settings opens');
  app.byId('settingsModal').classList.remove('show');
  assert.equal(markup.getElementById('langToggle').hasAttribute('onchange'), false);
  assert.match(i18n, /languageSelect\.addEventListener\('change'/);
  assert.match(sound, /btn\.setAttribute\('aria-pressed', String\(soundEnabled\)\)/);
  const collapse = app.byId('sidebarCollapseBtn');
  await app.click(collapse);
  assert.equal(collapse.getAttribute('aria-expanded'), 'false');
  await app.click(collapse);
  assert.equal(collapse.getAttribute('aria-expanded'), 'true');
  assert.equal(shell.querySelector('#lockUiBtn'), null);
  assert.equal(markup.querySelector('script[src="src/ui/dragAndDrop.js"]'), null);
});

test('utility controls use coherent SVG icons and accessible flag-and-name language options', () => {
  const shell = shellMarkup();
  for (const id of ['audioToggleBtn', 'sidebarCollapseBtn', 'openSettings']) {
    assert.ok(shell.querySelector(`#${id} svg`), `${id} has an SVG icon`);
  }
  assert.doesNotMatch(text(shell), /🔊|🔇|🔒|🔓|⚙/u);
  for (const language of ['English', 'Русский', 'עברית']) assert.match(text(shell), new RegExp(language));
  assert.doesNotMatch(sound, /btn\.textContent\s*=/);
});

test('strategy source status is truthful, noninteractive fallback copy', () => {
  // SHELL-001: the header badge is the Badge component (source variant).
  const status = markup.getElementById('strategySourceStatus');
  assert.equal(status.localName, 'div');
  assert.ok(status.classList.contains('strategy-source-status') && status.classList.contains('ui-badge'));
  assert.equal(status.dataset.variant, 'source');
  assert.equal(text(status.querySelector('strong')), 'Heuristic fallback');
  assert.ok(css.rulesMentioning('.strategy-source-status').length > 0);
  for (const id of ['connectApiBtn', 'apiStatusText']) assert.equal(markup.getElementById(id), null);
  assert.equal(markup.querySelector('#strategySourceStatus [data-status]'), null);
  assert.equal(app.evaluate('typeof setStrategySourceStatus'), 'undefined');
  assert.doesNotMatch(text(app.document.body), /Loading model|Model unavailable/);
});

test('mobile navigation and utilities remain visible and reachable', () => {
  // Protects: at <=820px navigation scrolls horizontally instead of hiding,
  // and utilities become a three-column row.
  const narrow = { width: 800 };
  const navigation = markup.querySelector('.mode-navigation');
  assert.equal(css.cascaded(navigation, 'display', narrow), 'flex');
  assert.equal(css.cascaded(navigation, 'overflow-x', narrow), 'auto');
  // SHELL-001: utilities are one wrapping row of icon buttons at every width.
  const utilities = markup.querySelector('.rail-utilities');
  assert.equal(css.cascaded(utilities, 'display', narrow), 'flex');
  assert.equal(css.cascaded(utilities, 'flex-wrap', narrow), 'wrap');
  for (const button of utilities.querySelectorAll('button')) assert.notEqual(css.cascaded(button, 'display', narrow), 'none');
});

test('the shell consumes semantic tokens and remains theme-independent', () => {
  // Protects: the rail and active navigation use semantic tokens, and the
  // shell's declared styling is the same in every theme (only tokens change).
  const rail = markup.querySelector('.mode-rail');
  const active = markup.querySelector('.mode-nav-item[aria-current="page"]');
  const root = markup.documentElement;
  const previous = root.dataset.theme;
  const snapshot = () => [
    css.cascaded(rail, 'background'), css.cascaded(rail, 'border-inline-end'),
    ...markup.querySelectorAll('.mode-nav-item').map((item) => css.cascaded(item, 'background')),
  ];
  root.dataset.theme = 'midnight';
  assert.match(css.cascaded(rail, 'background'), /var\(--surface-shell\)/);
  const border = css.cascaded(rail, 'border-inline-end');
  assert.match(border, /var\(--/, 'the rail border is token-driven');
  assert.doesNotMatch(border, /#[0-9a-f]{3,8}\b|rgba?\(/i);
  assert.ok(active);
  const baseline = snapshot();
  for (const theme of ['graphite', 'daylight']) {
    root.dataset.theme = theme;
    assert.deepEqual(snapshot(), baseline, theme);
  }
  root.dataset.theme = previous;
  const accentRules = css.rules.filter((rule) => rule.selectorText.includes('mode-nav') && rule.declarations.some((declaration) => declaration.value === 'var(--accent-primary)'));
  assert.ok(accentRules.length > 0, 'navigation accents use the accent token');
});
