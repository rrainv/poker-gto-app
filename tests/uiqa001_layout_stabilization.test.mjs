import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import {
  CARD_PRESENTATION_STORAGE_KEY,
  createCardPresentationController,
  displayCardRank,
  tableCardSvgMarkup,
} from '../app/src/application/card-presentation.mjs';

import { StyleSheetModel, appStyleSheet, bootApp, indexDocument, precedes, text } from './helpers/app-under-test.mjs';

// TEST-HYGIENE-001: index.html / styles.css / logic.js assertions are
// behavioural: parsed markup, the cascade at the relevant widths, and the
// running shell (sidebar, table collapse, Equity count, language). Strategy
// and SoundFX sources are outside this ticket.
const strategy = [
  '../app/src/strategy/preflop-heuristic.mjs',
  '../app/src/strategy/postflop-heuristic.mjs',
].map((url) => fs.readFileSync(new URL(url, import.meta.url), 'utf8')).join('\n');
const sound = fs.readFileSync(new URL('../app/src/core/SoundFX.js', import.meta.url), 'utf8');
// SOURCE-SHAPE: "the UI-QA-001 block is fluid (named breakpoints only, no
// device-resolution queries, no pure-black surfaces, no poker code)" is a
// policy lint over the block as authored — parsed, not regex-matched.
const uiQa = (() => {
  const raw = fs.readFileSync(new URL('../app/styles.css', import.meta.url), 'utf8');
  const start = raw.indexOf('*/', raw.indexOf('UI-QA-001: responsive shell')) + 2;
  return new StyleSheetModel(raw.slice(start, raw.indexOf('/* UI-QA-002B:')));
})();
const markup = indexDocument();
const css = appStyleSheet();
const app = await bootApp();
const shell = markup.querySelector('.riverline-shell');
const rail = markup.getElementById('modeRail');
const header = markup.querySelector('header.workspace-header');
const probe = (html) => {
  const host = markup.createElement('div');
  host.innerHTML = html;
  markup.body.appendChild(host);
  return host.firstElementChild;
};

test('sidebar has explicit expanded and collapsed states with accessible control', async () => {
  const toggle = rail.querySelector('#sidebarCollapseBtn');
  assert.equal(toggle.getAttribute('aria-expanded'), 'true');
  assert.equal(toggle.getAttribute('aria-controls'), 'modeRail');
  assert.equal(css.cascaded(shell, '--sidebar-expanded-width'), '208px');
  assert.equal(css.cascaded(shell, '--sidebar-collapsed-width'), '64px');
  assert.equal(css.cascaded(shell, 'grid-template-columns'), 'var(--sidebar-expanded-width) minmax(0, 1fr)');
  shell.classList.add('is-sidebar-collapsed');
  assert.equal(css.cascaded(shell, 'grid-template-columns'), 'var(--sidebar-collapsed-width) minmax(0, 1fr)');
  shell.classList.remove('is-sidebar-collapsed');
  // The running toggle switches state and persists it.
  await app.click('#sidebarCollapseBtn');
  assert.ok(app.$('.riverline-shell').classList.contains('is-sidebar-collapsed'));
  assert.equal(app.$('.riverline-shell').dataset.sidebarState, 'collapsed');
  assert.equal(app.window.localStorage.getItem('riverline_sidebar_collapsed'), 'true');
  await app.click('#sidebarCollapseBtn');
  assert.equal(app.window.localStorage.getItem('riverline_sidebar_collapsed'), 'false');
  assert.equal(app.byId('sidebarCollapseBtn').getAttribute('aria-expanded'), 'true');
});

test('global utilities live in the lower sidebar and not the workspace header', () => {
  const utilities = rail.querySelector('.rail-utilities');
  const [language, audio, settings] = ['langToggle', 'audioToggleBtn', 'openSettings'].map((id) => utilities.querySelector(`#${id}`));
  assert.ok(precedes(language, audio) && precedes(audio, settings));
  for (const id of ['langToggle', 'audioToggleBtn', 'openSettings']) assert.equal(header.querySelector(`#${id}`), null, id);
  const status = header.querySelector('#strategySourceStatus');
  assert.equal(status.getAttribute('aria-label'), 'Strategy source: Heuristic fallback');
  assert.notEqual(status.localName, 'button');
  assert.equal(header.querySelector('#connectApiBtn'), null);
  // SHELL-001: one translated tooltip per footer icon; the audio label is
  // written by SoundFX (Mute/Enable sound). QA-SWEEP-029: expanded nav items
  // carry no self-tooltip; the collapsed rail sets one at runtime.
  assert.ok(rail.querySelector('#langToggle'));
  assert.ok(rail.querySelector('[data-tooltip="Settings"][data-i18n-tooltip="Settings"]'));
  assert.equal(rail.querySelector('#audioToggleBtn').dataset.tooltip, 'Mute sound');
  for (const item of rail.querySelectorAll('.mode-nav-item')) {
    for (const attribute of ['title', 'data-tooltip', 'data-i18n-title']) assert.equal(item.hasAttribute(attribute), false, attribute);
  }
});

test('collapsed utility access and mobile navigation remain structural', () => {
  // SHELL-001: the footer is an icon row in both rail states; the native
  // language select overlays the globe icon.
  assert.equal(css.cascaded(rail.querySelector('.rail-language select'), 'opacity'), '0');
  const navigation = markup.querySelector('.mode-navigation');
  for (const width of [800, 700, 500]) {
    assert.equal(css.cascaded(navigation, 'display', { width }), 'flex', width);
    assert.equal(css.cascaded(navigation, 'overflow-x', { width }), 'auto', width);
  }
  // Superseded: the 3-column utility grid became one wrapping icon row.
  const utilities = rail.querySelector('.rail-utilities');
  assert.equal(css.cascaded(utilities, 'display', { width: 800 }), 'flex');
  for (const button of utilities.querySelectorAll('button, label')) assert.notEqual(css.cascaded(button, 'display', { width: 500 }), 'none');
});

test('language selector presents flags with full accessible names', async () => {
  const select = rail.querySelector('select#langToggle');
  assert.deepEqual(select.querySelectorAll('option').map((option) => text(option)), ['🇺🇸 English', '🇷🇺 Русский', '🇮🇱 עברית']);
  assert.equal(select.getAttribute('aria-label'), 'Language');
  // The chosen language is persisted under 'language'.
  await app.setValue('#langToggle', 'ru', { events: ['change'] });
  assert.equal(app.window.localStorage.getItem('language'), 'ru');
  await app.setValue('#langToggle', 'en', { events: ['change'] });
  assert.equal(app.window.localStorage.getItem('language'), 'en');
});

test('responsive strategy is fluid rather than resolution-specific', () => {
  const values = uiQa.rules.flatMap((rule) => rule.declarations.map(({ value }) => value)).join(' ');
  assert.match(values, /minmax\(/);
  assert.match(values, /clamp\(/);
  // SHELL-001: one canvas width (--canvas-max) replaces the 1840px canvas cap.
  assert.equal(css.cascaded(markup.documentElement, '--canvas-max'), '1640px');
  assert.equal(css.rules.filter((rule) => rule.declarations.some(({ property, value }) => property === 'max-width' && value === '1840px')).length, 0);
  const queries = new Set(uiQa.rules.flatMap((rule) => rule.conditions.filter(({ type }) => type === 'media').map(({ query }) => query)));
  const widths = [...queries].join(' ');
  for (const breakpoint of [1500, 1320, 1280, 1180, 1100, 900, 820, 700, 520]) {
    assert.match(widths, new RegExp(`(?:min|max)-width: ${breakpoint}px`), String(breakpoint));
  }
  assert.doesNotMatch(widths, /\((?:min|max)-width:\s*(?:2200|1920|1536|1440|1024|768|390)px\)/);
});

test('Playbook workflow and betting context use compact structural strips', () => {
  const playbook = markup.getElementById('gtoMode');
  assert.ok(playbook.querySelector('.playbook-state-source'));
  // ANALYZE-COMPOSITION-001: position and prior action moved from the center strip into the Spot rail pair.
  assert.ok(playbook.querySelector('.playbook-field-pair'));
  assert.ok(playbook.querySelector('.fields.playbook-context-sliders'));
  // SHELL-001: the Hand/Scenario switch is a small segmented control in the
  // header bar (superseded literal: --control-height-sm became 28px).
  const tab = header.querySelector('#workspaceModeSwitch #playbookModeControl .ui-tab');
  assert.ok(tab);
  assert.ok(Number.parseFloat(css.cascaded(tab, 'min-height')) <= 32);
  // ANALYZE-COMPOSITION-001 amendment 2 removed the dead .playbook-context-primary CSS.
  assert.equal(css.rules.filter((rule) => rule.selectors.some((selector) => /\.playbook-context-primary\b/.test(selector))).length, 0);
});

test('Playbook table collapse releases its entire layout region', async () => {
  const toggle = markup.getElementById('toggleTableBtn');
  assert.equal(toggle.getAttribute('aria-expanded'), 'true');
  assert.equal(toggle.getAttribute('aria-controls'), 'table-wrapper');
  assert.equal(markup.getElementById('table-wrapper').dataset.collapsibleRegion, 'poker-table');
  // The toggle flips the region and its aria-expanded state.
  await app.navigate('hand');
  const wrapper = app.byId('table-wrapper');
  const button = app.byId('toggleTableBtn');
  const before = wrapper.classList.contains('collapsed');
  await app.click(button);
  assert.equal(wrapper.classList.contains('collapsed'), !before);
  assert.equal(button.getAttribute('aria-expanded'), String(before));
  await app.click(button);
  assert.equal(wrapper.classList.contains('collapsed'), before);
  // Collapsed, the region takes no space (superseded literal: height 0 became
  // height auto with max-height 0 and hidden visibility).
  const collapsed = probe('<div class="table-wrapper collapsed"></div>');
  assert.equal(css.cascaded(collapsed, 'min-height'), '0');
  assert.equal(css.cascaded(collapsed, 'max-height'), '0');
  assert.equal(css.cascaded(collapsed, 'visibility'), 'hidden');
});

test('Action Path is sticky on wide desktop and returns to normal flow below it', () => {
  assert.ok(markup.getElementById('playbookDecisionPathPanel'));
  const supportRail = markup.querySelector('.playbook-support-rail');
  assert.equal(css.cascaded(supportRail, 'position', { width: 1600 }), 'sticky');
  assert.equal(css.cascaded(supportRail, 'position', { width: 1200 }), 'static');
});

test('Equity board is an explicit horizontal Holdem flow', () => {
  const equity = markup.getElementById('equityMode');
  const board = equity.querySelector('.cards-row.equity-board-cards');
  assert.ok(board);
  const flop = equity.querySelector('.equity-street-flop');
  assert.equal(text(flop), 'Flop');
  const copy = text(flop.parentElement);
  assert.ok(copy.indexOf('Flop') < copy.indexOf('Turn') && copy.indexOf('Turn') < copy.indexOf('River'));
  assert.equal(css.cascaded(board, 'flex-direction'), 'row');
  assert.equal(css.cascaded(board, 'flex-wrap'), 'nowrap');
  assert.equal(css.cascaded(board, 'direction'), 'ltr');
  assert.equal(css.cascaded(board, 'overflow-x'), 'auto');
});

test('Equity communicates arbitrary 2 through 10 counts with a stepper and optional presets', async () => {
  const equity = markup.getElementById('equityMode');
  assert.ok(equity.querySelector('[aria-label="Player count, from 2 through 10"]'));
  assert.ok(equity.querySelector('[data-equity-player-delta="-1"]'));
  assert.ok(equity.querySelector('[data-equity-player-delta="1"]'));
  assert.ok(equity.querySelector('[aria-label="Quick player count presets"]'));
  await app.navigate('equity');
  app.call('setEquityPlayerCount', 2);
  await app.click('[data-equity-player-delta="-1"]');
  assert.equal(app.window.app.equity.players.length, 2, 'never below 2');
  await app.click('[data-equity-player-delta="1"]');
  assert.equal(text(app.byId('equityPlayerCount')), '3 players');
  app.call('setEquityPlayerCount', 10);
  await app.click('[data-equity-player-delta="1"]');
  assert.equal(app.window.app.equity.players.length, 10, 'never above 10');
  assert.equal(text(app.byId('equityPlayerCount')), '10 players');
  app.call('setEquityPlayerCount', 2);
});

test('Equity keeps calculation in the primary input workflow and coexists with results on desktop', () => {
  const equity = markup.getElementById('equityMode');
  const center = equity.querySelector('.equity-center-column');
  assert.ok(center.querySelector('.panel.equity-controls-panel.equity-calculation-strip #calculate'));
  const players = equity.querySelector('.panel.equity-player-panel');
  const dossier = equity.querySelector('.panel.equity-dossier-panel.equity-hand-analysis-panel');
  assert.ok(precedes(players, center) && precedes(center, dossier));
  // Superseded: the three fixed columns became the two-column Equity canvas.
  const workspace = equity.querySelector('.equity-workspace');
  assert.equal(css.cascaded(workspace, 'display', { width: 1600 }), 'grid');
  assert.equal(css.cascaded(center, 'display'), 'grid');
  assert.equal(css.cascaded(workspace, 'display', { width: 1000 }), 'flex');
  assert.equal(css.cascaded(workspace, 'flex-direction', { width: 1000 }), 'column');
});

test('Training centers the decision between support and setup on wide desktop', () => {
  const training = markup.getElementById('trainingMode');
  const [decision, insight, setup] = ['.training-decision-column', '.training-insight-column', '.training-setup-column'].map((selector) => training.querySelector(selector));
  assert.ok(decision && insight && setup);
  // Superseded: the 3-area "insight decision setup" grid became the decision
  // column with a study rail; the decision leads on narrow screens.
  assert.equal(css.cascaded(training.querySelector('.training-workspace'), 'grid-template-areas', { width: 1400 }), '"decision insight"');
  assert.equal(css.cascaded(decision, 'order', { width: 800 }), '1');
  const button = probe('<button class="training-action-button">x</button>');
  assert.ok(css.matchingRules(button, { states: ['hover'] }).some((rule) => rule.selectorText.includes('.training-action-button:hover')));
});

test('Settings expose clearer switches, aligned solver icon, and persisted T versus 10 preference', () => {
  assert.ok(markup.getElementById('cardRankStyleControl'));
  assert.ok(markup.querySelector('#cardRankStyleControl [data-card-rank-style="poker"], [data-card-rank-style="poker"]'));
  assert.ok(markup.querySelector('[data-card-rank-style="full-ten"]'));
  const values = new Map();
  const controller = createCardPresentationController({
    root: { dataset: {} },
    storage: {
      getItem: (key) => values.get(key) ?? null,
      setItem: (key, value) => values.set(key, value),
      removeItem: (key) => values.delete(key),
    },
  });
  const state = controller.apply({ rankStyle: 'full-ten' });
  assert.equal(state.rankStyle, 'full-ten');
  assert.equal(JSON.parse(values.get(CARD_PRESENTATION_STORAGE_KEY)).rankStyle, 'full-ten');
  // DS-FOUNDATION-001: the Switch component owns the thumb. Off: the thumb paints
  // the track's --text-secondary (currentColor); on: --text-on-accent on the accent.
  const toggle = probe('<button class="ui-switch"><b></b></button>');
  assert.equal(css.cascaded(toggle, 'color'), 'var(--text-secondary)');
  assert.equal(css.cascaded(toggle.firstElementChild, 'background'), 'currentColor');
  // (TEST-HYGIENE-001-F09: nothing renders .solver-import-btn any more; its icon
  // rule is kept aligned.)
  const icon = probe('<button class="solver-import-btn"><span class="button-icon"></span></button>').firstElementChild;
  assert.equal(css.cascaded(icon, 'width'), '18px');
  assert.equal(css.cascaded(icon, 'display'), 'block');
  assert.match(sound, /settingsBtn\.setAttribute\('aria-pressed', String\(soundEnabled\)\)/);
});

test('full-ten preference changes presentation but preserves canonical card identities', async () => {
  assert.equal(displayCardRank('T', 'poker'), 'T');
  assert.equal(displayCardRank('T', 'full-ten'), '10');
  // The picker keeps canonical identities ("Th") whatever the rank style.
  await app.navigate('analyze');
  await app.click('#gtoMode [data-card-set-edit="hero"]');
  assert.ok(app.$('[data-deck-card="Th"]'));
  assert.equal(app.$('[data-deck-card="10h"]'), null);
  await app.click('#cardSetPickerCancel');
  const tableTen = tableCardSvgMarkup({ rank: 'T', suit: 'h', rankStyle: 'full-ten' });
  assert.match(tableTen, /table-card-rank--ten/);
  assert.match(tableTen, />10<\/text>/);
  assert.doesNotMatch(tableTen, />T<\/text>/);
});

test('broken free-form layout editor is no longer presented or bootstrapped', () => {
  assert.equal(markup.getElementById('lockUiBtn'), null);
  assert.equal(markup.querySelector('script[src="src/ui/dragAndDrop.js"], [data-layout-fixed]'), null);
  assert.ok(rail.querySelectorAll('*').every((node) => node.childElementCount > 0 || text(node) !== 'Layout'));
});

test('stabilization uses semantic stepped surfaces and softened Daylight tokens', () => {
  const declarations = uiQa.rules.flatMap((rule) => rule.declarations);
  assert.ok(declarations.some(({ property, value }) => property === 'background' && value === 'var(--surface-section)'));
  for (const { property, value } of declarations) {
    if (/^background(?:-color)?$/.test(property)) assert.doesNotMatch(value, /^(?:#000(?:000)?|rgb\(0\s*,\s*0\s*,\s*0\))$/i);
  }
  // TOKEN-TUNING (SAVED-COMPOSITION-002 Part 3): the owner's Final Daylight surfaces; still never pure white.
  const root = markup.documentElement;
  const previous = root.dataset.theme;
  root.dataset.theme = 'daylight';
  try {
    assert.equal(css.cascaded(root, '--surface-canvas'), '#e2ddd2');
    assert.equal(css.cascaded(root, '--surface-panel'), '#fbfaf6');
    for (const surface of ['canvas', 'shell', 'panel', 'elevated', 'interactive', 'inset']) {
      assert.doesNotMatch(css.cascaded(root, `--surface-${surface}`) || '', /^#fff(?:fff)?$/i, surface);
    }
  } finally {
    root.dataset.theme = previous;
  }
});

test('RTL, reduced motion, and interaction-versus-state affordances remain explicit', () => {
  const root = markup.documentElement;
  const board = markup.querySelector('.equity-board-cards');
  const icon = markup.querySelector('.rail-collapse-icon');
  const ltr = [css.cascaded(board, 'direction'), css.cascaded(icon, 'transform')];
  root.setAttribute('dir', 'rtl');
  const rtl = [css.cascaded(board, 'direction'), css.cascaded(icon, 'transform')];
  root.setAttribute('dir', 'ltr');
  assert.equal(rtl[0], 'ltr', 'the board stays left-to-right');
  assert.notEqual(rtl[1], ltr[1], 'the collapse icon mirrors');
  // Reduced rules follow the Motion setting (MOTION-FOUNDATION-001).
  assert.ok(uiQa.rules.some((rule) => rule.selectors.some((selector) => selector.includes('[data-motion-mode="reduced"]'))));
  const derived = markup.querySelector('[data-state-surface="derived"]');
  assert.ok(derived);
  assert.ok(markup.querySelector('[data-interaction-surface="interactive"]'));
  assert.equal(css.cascaded(derived, 'cursor'), 'default');
});

test('UI-QA-001 presentation section contains no poker, strategy, Equity-math, Training-generation, or solver code', () => {
  const authored = uiQa.rules.map((rule) => `${rule.selectorText}{${rule.declarations.map(({ property, value }) => `${property}:${value}`).join(';')}}`).join('\n');
  assert.doesNotMatch(authored, /DecisionContext|StrategyResult|PokerState|calculateEquity|evaluateSeven|MCCFR|regret|TrainingConfig/);
  assert.equal(typeof app.window.RiverlinePlaybookState, 'object');
  assert.equal(app.evaluate('typeof calculateEquity'), 'function');
  assert.match(strategy, /calculatePreflopFallbackStrategy/);
  assert.match(strategy, /calculatePostflopHeuristicStrategy/);
});
