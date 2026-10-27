import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

import { appStyleSheet, bootApp, indexDocument, text } from './helpers/app-under-test.mjs';

// TEST-HYGIENE-001: index.html / styles.css / logic.js assertions are
// behavioural (the parsed Settings dialog, the cascade, and opening Settings
// in the running app). Settings/theme/sound/tutorial/translation sources are
// outside this ticket.
const markup = indexDocument();
const css = appStyleSheet();
const app = await bootApp();
const settings = markup.getElementById('settingsModal');
const settingsSource = fs.readFileSync(new URL('../app/src/application/settings-ia-bootstrap.mjs', import.meta.url), 'utf8');
const themeSource = fs.readFileSync(new URL('../app/src/application/presentation-theme.mjs', import.meta.url), 'utf8');
const presentationBootstrap = fs.readFileSync(new URL('../app/src/application/presentation-density-bootstrap.mjs', import.meta.url), 'utf8');
const soundSource = fs.readFileSync(new URL('../app/src/core/SoundFX.js', import.meta.url), 'utf8');
const tutorialSource = fs.readFileSync(new URL('../app/src/tutorial/current-app-tutorials.mjs', import.meta.url), 'utf8');
const productTranslations = fs.readFileSync(new URL('../app/src/locales/product-translations.js', import.meta.url), 'utf8');

const EXPECTED_SETTINGS = Object.freeze({
  appearance: Object.freeze([
    'workspace-layout',
    'card-suit-colors',
    'card-rank-style',
    'card-face-style',
    'card-back-style',
    'workstation-theme',
  ]),
  audio: Object.freeze(['audio-enabled', 'audio-volume', 'audio-poker', 'audio-study', 'motion']),
  language: Object.freeze(['language']),
  account: Object.freeze([]),
});


test('every visible preference has exactly one category and the inventory stays intentionally small', () => {
  const inventory = Object.fromEntries(Object.keys(EXPECTED_SETTINGS).map((category) => [category, []]));
  const occurrences = settings.querySelectorAll('[data-setting-id]');
  assert.equal(new Set(occurrences.map((node) => node.dataset.settingId)).size, occurrences.length, 'no preference is duplicated');
  occurrences.forEach((node) => inventory[node.closest('[data-settings-panel]').dataset.settingsPanel].push(node.dataset.settingId));
  for (const category of Object.keys(inventory)) inventory[category].sort();
  for (const category of Object.keys(EXPECTED_SETTINGS)) {
    assert.deepEqual(inventory[category], [...EXPECTED_SETTINGS[category]].sort(), category);
  }
  assert.equal(occurrences.length, 12);
  for (const id of ['tutorial', 'guide', 'account-status', 'sound-preview', 'reduced-motion']) {
    assert.equal(settings.querySelector(`[data-setting-id="${id}"]`), null, id);
  }
});

test('four category tabs reveal one focused panel with vertical keyboard navigation', () => {
  assert.equal(settings.querySelectorAll('[role="tab"]').length, 4);
  assert.equal(settings.querySelectorAll('[role="tabpanel"]').length, 4);
  assert.equal(settings.querySelector('[role="tablist"]').getAttribute('aria-orientation'), 'vertical');
  for (const category of Object.keys(EXPECTED_SETTINGS)) {
    assert.ok(settings.querySelector(`[data-settings-category="${category}"]`), category);
    assert.ok(settings.querySelector(`[data-settings-panel="${category}"]`), category);
  }
  assert.match(settingsSource, /ArrowDown/);
  assert.match(settingsSource, /ArrowUp/);
  assert.match(settingsSource, /event\.key === 'Home'/);
  assert.match(settingsSource, /event\.key === 'End'/);
  assert.match(settingsSource, /panel\.hidden = panel\.dataset\.settingsPanel !== nextCategory/);
  assert.doesNotMatch(settingsSource, /localStorage|sessionStorage/);
});

test('retired density and layout modes stay absent while accepted contextual presets remain bounded', () => {
  assert.equal(settings.querySelector('[data-density-option], #densityControl'), null);
  assert.doesNotMatch(settings.innerHTML, /Comfortable|Compact/);
  assert.equal(settings.querySelector('[data-layout-preset-option="controls-first"]'), null);
  assert.equal(settings.querySelectorAll('[data-layout-preset-option]').length, 3);
  assert.equal(settings.querySelector('[data-layout-preset-field]').hidden, true);
  assert.match(presentationBootstrap, /createPresentationLayoutController/);
  assert.match(presentationBootstrap, /getDensity\(\) !== 'comfortable'/);
});

test('theme transactions and card presentation retain their canonical device authorities', () => {
  for (const id of [
    'themeSwatchGrid', 'customThemeGrid', 'editTheme', 'saveThemeChanges', 'cancelThemeEdit',
    'saveCustomTheme', 'duplicateTheme', 'deleteCustomTheme', 'fourColorDeckToggle',
    'cardRankStyleControl', 'cardFaceStyleControl', 'cardBackStyleControl',
  ]) assert.ok(settings.querySelector(`#${id}`), id);
  assert.match(themeSource, /function beginEdit\(\)/);
  assert.match(themeSource, /function cancelEdit\(\)/);
  assert.match(themeSource, /function saveAsNew\(/);
  assert.match(themeSource, /function duplicateTheme\(/);
  assert.match(themeSource, /editing a built-in preview[\s\S]*built-in stays unchanged/i);
  assert.match(presentationBootstrap, /createCardPresentationController[\s\S]*storage: window\.localStorage/);
});

test('audio remains one hierarchy and preview actions are demoted from preference status', () => {
  for (const id of ['audioSettingsSwitch', 'audioMasterVolume', 'audioPokerSwitch', 'audioStudySwitch']) {
    assert.ok(settings.querySelector(`#${id}`), id);
  }
  const previews = settings.querySelector('details.audio-preview-field.settings-detail-disclosure');
  assert.ok(previews);
  assert.match(text(settings), /Optional previews; these actions do not change a preference\./);
  assert.match(soundSource, /settingsBtn\.onclick = \(\) => authority\.toggle\(\)/);
  assert.match(soundSource, /pokerBtn\) pokerBtn\.onclick = \(\) => setCategory\(CATEGORIES\.POKER/);
  assert.match(soundSource, /studyBtn\) studyBtn\.onclick = \(\) => setCategory\(CATEGORIES\.STUDY/);
  assert.match(soundSource, /volume\) volume\.oninput = \(event\) => authority\.setMasterVolume/);
});

test('Motion is one global device setting next to sound, not a second reduced-motion status', () => {
  // P1-09 / MOTION-FOUNDATION-001 replaced the read-only system status with the
  // Motion setting (behaviour: tests/motion_foundation001.test.mjs).
  assert.equal(settings.querySelector('#settingsReducedMotionStatus'), null);
  const control = settings.querySelector('#settingsMotionControl');
  assert.equal(control.closest('[data-settings-panel]').dataset.settingsPanel, 'audio');
  assert.deepEqual(control.querySelectorAll('[data-motion-option]').map((button) => button.dataset.motionOption), ['instant', 'faster', 'standard', 'reduced']);
});

test('language is a shared secondary route and Help does not replace global discovery', () => {
  assert.ok(markup.getElementById('langToggle'));
  assert.ok(settings.querySelector('#settingsLanguageSelect'));
  assert.match(settingsSource, /RiverlineI18n\?\.setLanguage \?\? browserWindow\.setLanguage/);
  assert.match(settingsSource, /riverline:languagechange/);
  assert.equal(markup.getElementById('workspaceLearnButton').getAttribute('data-i18n-aria-label'), 'Learn Riverline');
  assert.ok(settings.querySelector('#settingsOpenGuide'));
  assert.ok(settings.querySelector('#settingsTutorialButton'));
  assert.match(settingsSource, /data-navigation-id="guide"/);
});

test('Account & Data remains a truthful status and route, not a cloud-sync claim', () => {
  const copy = text(settings);
  assert.match(copy, /Study data is still stored locally/);
  assert.match(copy, /Cloud sync is not enabled/);
  assert.match(copy, /Signing in does not create a cloud backup\./);
  assert.ok(settings.querySelector('#settingsOpenAccount'));
  assert.equal(EXPECTED_SETTINGS.account.length, 0, 'account status and navigation are not misclassified as preferences');
});

test('EN RU HE copy, RTL logical layout, focus containment, and modal close semantics are explicit', () => {
  const sandbox = { riverlineProductTranslations: null };
  vm.runInNewContext(productTranslations, { window: sandbox });
  const requiredKeys = [
    'Audio & Motion', 'Language & Help', 'Account & Data', 'Settings categories',
    'Motion', 'Instant', 'Faster', 'Reduced', 'Open Guide', 'Restart Settings tour',
  ];
  for (const language of ['en', 'ru', 'he']) {
    for (const key of requiredKeys) assert.ok(sandbox.riverlineProductTranslations[language][key], `${language}: ${key}`);
  }
  // The category rail separates with a logical (inline-end) border, and the
  // selected tab's indicator mirrors under RTL.
  assert.equal(css.cascaded(settings.querySelector('.settings-category-nav'), 'border-inline-end'), '1px solid var(--border-subtle)');
  const selected = settings.querySelector('.settings-category-tab[aria-selected="true"]');
  const ltr = css.cascaded(selected, 'box-shadow');
  markup.documentElement.setAttribute('dir', 'rtl');
  const rtl = css.cascaded(selected, 'box-shadow');
  markup.documentElement.setAttribute('dir', 'ltr');
  assert.equal(ltr, 'inset 3px 0 0 var(--accent-primary)');
  assert.equal(rtl, 'inset -3px 0 0 var(--accent-primary)');
  assert.match(settingsSource, /event\.key === 'Escape'/);
  assert.match(settingsSource, /event\.key !== 'Tab'/);
  assert.match(settingsSource, /document\.activeElement === first/);
  assert.match(settingsSource, /document\.activeElement === last/);
  assert.match(settingsSource, /openButton\.focus/);
});

test('Settings tutorial v2 follows category anchors without duplicating preference authority', () => {
  assert.match(tutorialSource, /id: 'settings\.preferences', version: 2/);
  for (const anchor of ['settings-overview', 'settings-appearance', 'settings-audio', 'settings-language-help', 'settings-account']) {
    assert.match(tutorialSource, new RegExp(`anchor: '${anchor}'`));
    assert.equal(settings.querySelectorAll(`[data-tutorial-anchor="${anchor}"]`).length, 1, anchor);
  }
});

test('opening Settings performs presentation work only', async () => {
  assert.doesNotMatch(settingsSource, /PokerState|StrategyProvider|DecisionContext|calculateEquity|TrainingPracticePlanner|evaluateSeven/);
  // Opening shows the dialog and runs no calculation, derivation, strategy,
  // Equity or Training work.
  const names = ['calculateEquity', 'updateContext', 'deriveDecisionContext', 'renderTrainingSetup', 'startConfiguredTrainingSession', 'commitPlaybookUpdate']
    .filter((name) => app.evaluate(`typeof ${name}`) === 'function');
  assert.ok(names.length >= 3, names.join());
  const state = { decisionContext: app.window.app.decisionContext, strategyResult: app.window.app.strategyResult };
  const spy = app.spy(names);
  try {
    await app.click('#openSettings');
    assert.ok(app.byId('settingsModal').classList.contains('show'));
    assert.equal(spy.total(), 0, JSON.stringify(spy.sequence));
  } finally {
    spy.restore();
    app.byId('settingsModal').classList.remove('show');
  }
  assert.equal(app.window.app.decisionContext, state.decisionContext);
  assert.equal(app.window.app.strategyResult, state.strategyResult);
});
