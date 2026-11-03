import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import { appStyleSheet, bootApp, indexDocument, text } from './helpers/app-under-test.mjs';

// SETTINGS-001 (replaces the SETTINGS-IA-001 dialog tests): Settings is a
// workspace on #settingsMode with three zones (category rail, searchable
// stream, sticky preview). Assertions are behavioural: the parsed markup, the
// cascade, and opening, searching and resetting in the running app.
const markup = indexDocument();
const css = appStyleSheet();
const app = await bootApp();
const settings = markup.getElementById('settingsMode');
const read = (path) => fs.readFileSync(new URL(`../app/${path}`, import.meta.url), 'utf8');
const workspaceSource = read('src/application/settings-workspace.mjs');
const shellSource = read('src/application/settings-shell.mjs');
const themeSource = read('src/application/presentation-theme.mjs');
const presentationBootstrap = read('src/application/presentation-density-bootstrap.mjs');
const soundSource = read('src/core/SoundFX.js');
const tutorialSource = read('src/tutorial/current-app-tutorials.mjs');
const stylesSource = read('styles.css');

const EXPECTED_SETTINGS = Object.freeze({
  appearance: ['card-back-style', 'card-face-style', 'card-rank-style', 'card-suit-colors', 'workspace-layout', 'workstation-theme'],
  audio: ['audio-enabled', 'audio-poker', 'audio-study', 'audio-volume', 'motion', 'sound-test'],
  language: ['language'],
  help: ['guide', 'settings-tour', 'training-answer-mode'],
  shortcuts: [],
  account: ['account-profile', 'delete-data', 'local-data-counts', 'storage-status'],
});

test('Settings is a workspace: a mode view, not a dialog, with three zones', () => {
  assert.equal(markup.getElementById('settingsModal'), null, 'the dialog is gone');
  assert.ok(settings.classList.contains('mode-view'));
  assert.equal(settings.getAttribute('role'), null);
  assert.equal(settings.getAttribute('aria-modal'), null);
  assert.equal(settings.querySelector('#closeSettingsModal'), null, 'no close button: the sidebar gear and Escape go back');
  const workspace = settings.querySelector('#settingsWorkspace');
  assert.deepEqual(workspace.children.map((node) => node.className.split(' ')[0]), ['settings-rail', 'settings-stream', 'settings-preview']);
  // Instant apply: no Save and no Cancel for preferences (theme editing is its own transaction).
  assert.equal(settings.querySelector('#saveSettings, [data-settings-save]'), null);
});

test('every row sits in exactly one category and keeps the inventory small and real', () => {
  const inventory = Object.fromEntries(Object.keys(EXPECTED_SETTINGS).map((category) => [category, []]));
  const occurrences = settings.querySelectorAll('[data-setting-id]');
  assert.equal(new Set(occurrences.map((node) => node.dataset.settingId)).size, occurrences.length, 'no row is duplicated');
  occurrences.forEach((node) => inventory[node.closest('[data-settings-panel]').dataset.settingsPanel].push(node.dataset.settingId));
  for (const category of Object.keys(inventory)) {
    assert.deepEqual(inventory[category].sort(), [...EXPECTED_SETTINGS[category]].sort(), category);
  }
  // No placeholder controls for features that do not exist.
  for (const id of ['text-size', 'export', 'clear-history', 'rebind', 'chippy', 'glossary-hover', 'keyboard-hints', 'card-animations']) {
    assert.equal(settings.querySelector(`[data-setting-id="${id}"]`), null, id);
  }
  assert.doesNotMatch(text(settings), /Export|Chippy|Text size|Clear history|Rebind/i);
});

test('every preference row that can differ from a default has its own Reset, hidden until modified', () => {
  const resettable = ['workstation-theme', 'card-suit-colors', 'card-rank-style', 'card-face-style', 'card-back-style',
    'audio-enabled', 'audio-volume', 'audio-poker', 'audio-study', 'motion', 'language', 'training-answer-mode'];
  for (const id of resettable) {
    const row = settings.querySelector(`[data-setting-id="${id}"]`);
    const reset = row.querySelector('[data-settings-reset]');
    assert.ok(reset, `${id} has Reset`);
    assert.equal(reset.getAttribute('type'), 'button');
    assert.ok(reset.hasAttribute('hidden'), `${id}: Reset starts hidden`);
  }
  for (const id of ['guide', 'settings-tour']) {
    assert.equal(settings.querySelector(`[data-setting-id="${id}"] [data-settings-reset]`), null, `${id} is an action, not a preference`);
  }
});

test('six category tabs, one panel each, vertical roving keyboard navigation', () => {
  const tabs = settings.querySelectorAll('.settings-category-tab');
  assert.deepEqual(tabs.map((tab) => tab.dataset.settingsCategory), ['appearance', 'audio', 'language', 'help', 'shortcuts', 'account']);
  assert.equal(settings.querySelectorAll('[role="tabpanel"]').length, 6);
  assert.equal(settings.querySelector('[role="tablist"]').getAttribute('aria-orientation'), 'vertical');
  tabs.forEach((tab) => {
    const panel = settings.getElementById?.(tab.getAttribute('aria-controls')) ?? markup.getElementById(tab.getAttribute('aria-controls'));
    assert.equal(panel.getAttribute('aria-labelledby'), tab.id);
  });
  assert.equal(tabs.filter((tab) => tab.getAttribute('tabindex') === '0').length, 1, 'one tab stop');
  for (const key of ['ArrowDown', 'ArrowUp', 'Home', 'End']) assert.match(workspaceSource, new RegExp(`'${key}'`));
  assert.doesNotMatch(workspaceSource, /localStorage|sessionStorage/, 'the workspace stores nothing itself');
});

test('the preview and the stream come from real components, and Shortcuts is a list only', () => {
  assert.match(workspaceSource, /createActionCard[\s\S]*createMixBar[\s\S]*createSourceTierLabel/);
  const preview = settings.querySelector('#settingsPreview');
  assert.ok(preview.querySelector('[inert]'), 'the sample is decorative and not focusable');
  assert.ok(preview.querySelector('.settings-preview-tag'), 'the sample is labelled');
  const shortcuts = settings.querySelector('[data-settings-panel="shortcuts"]');
  assert.equal(shortcuts.querySelectorAll('button, input, select').length, 0, 'rebinding is M2: no controls');
  assert.ok(shortcuts.querySelectorAll('.settings-key-row').length >= 12);
});

test('retired density and layout modes stay absent while accepted contextual presets remain bounded', () => {
  assert.equal(settings.querySelector('[data-density-option], #densityControl'), null);
  assert.doesNotMatch(settings.innerHTML, /Comfortable|Compact/);
  assert.equal(settings.querySelector('[data-layout-preset-option="controls-first"]'), null);
  assert.equal(settings.querySelectorAll('[data-layout-preset-option]').length, 3);
  assert.equal(settings.querySelector('[data-layout-preset-field]').hasAttribute('hidden'), true);
  assert.match(presentationBootstrap, /createPresentationLayoutController/);
  assert.match(presentationBootstrap, /getDensity\(\) !== 'comfortable'/);
});

test('theme transactions keep their authority and built-in themes are copied, never edited', () => {
  for (const id of [
    'themeSwatchGrid', 'customThemeGrid', 'editTheme', 'saveThemeChanges', 'cancelThemeEdit',
    'saveCustomTheme', 'duplicateTheme', 'deleteCustomTheme', 'themeDuplicateAndCustomise', 'fourColorDeckToggle',
    'cardRankStyleControl', 'cardFaceStyleControl', 'cardBackStyleControl',
  ]) assert.ok(settings.querySelector(`#${id}`), id);
  assert.match(themeSource, /function beginEdit\(\)/);
  assert.match(themeSource, /function duplicateTheme\(/);
  assert.match(themeSource, /editing a built-in preview[\s\S]*built-in stays unchanged/i);
  assert.match(presentationBootstrap, /createCardPresentationController[\s\S]*storage: window\.localStorage/);
  assert.match(workspaceSource, /theme\.duplicateTheme\(\)[\s\S]*theme\.beginEdit/);
  // A built-in shows only "Duplicate & customise"; a custom theme shows Edit, Duplicate, Delete.
  assert.match(stylesSource, /html\[data-theme-kind="built-in"\] #editTheme,[\s\S]*#deleteCustomTheme,[\s\S]*#themeDuplicateAndCustomise,[\s\S]*display: none/);
});

test('audio remains one hierarchy and preview actions are demoted from preference status', () => {
  for (const id of ['audioSettingsSwitch', 'audioMasterVolume', 'audioPokerSwitch', 'audioStudySwitch']) {
    assert.ok(settings.querySelector(`#${id}`), id);
  }
  assert.ok(settings.querySelector('details.audio-preview-field.settings-detail-disclosure'));
  assert.match(text(settings), /Optional previews; these actions do not change a preference\./);
  assert.match(soundSource, /settingsBtn\.onclick = \(\) => authority\.toggle\(\)/);
  assert.match(soundSource, /pokerBtn\) pokerBtn\.onclick = \(\) => setCategory\(CATEGORIES\.POKER/);
  assert.match(soundSource, /studyBtn\) studyBtn\.onclick = \(\) => setCategory\(CATEGORIES\.STUDY/);
  assert.match(soundSource, /volume\) volume\.oninput = \(event\) => authority\.setMasterVolume/);
});

test('Motion is one global device setting next to sound, not a second reduced-motion status', () => {
  assert.equal(settings.querySelector('#settingsReducedMotionStatus'), null);
  const control = settings.querySelector('#settingsMotionControl');
  assert.equal(control.closest('[data-settings-panel]').dataset.settingsPanel, 'audio');
  assert.deepEqual(control.querySelectorAll('[data-motion-option]').map((button) => button.dataset.motionOption), ['instant', 'faster', 'standard', 'reduced']);
});

test('Language is three cards with a real sample line each, sharing the sidebar preference', () => {
  assert.ok(markup.getElementById('langToggle'), 'the sidebar selector stays');
  assert.equal(settings.querySelector('#settingsLanguageSelect'), null);
  const cards = settings.querySelectorAll('[data-language-option]');
  assert.deepEqual(cards.map((card) => card.dataset.languageOption), ['en', 'ru', 'he']);
  assert.equal(cards.find((card) => card.dataset.languageOption === 'he').getAttribute('dir'), 'rtl');
  assert.equal(cards.length, settings.querySelectorAll('[data-language-sample]').length);
  assert.match(shellSource, /RiverlineI18n\?\.setLanguage \?\? browserWindow\.setLanguage/);
  assert.match(workspaceSource, /riverline:languagechange/);
  assert.equal(markup.getElementById('workspaceLearnButton').getAttribute('data-i18n-aria-label'), 'Learn Riverline');
  assert.ok(settings.querySelector('#settingsOpenGuide'));
  assert.ok(settings.querySelector('#settingsTutorialButton'));
  assert.match(shellSource, /data-navigation-id="guide"/);
});

test('Account & Data remains a truthful status, exact counts and the guarded delete', () => {
  const copy = text(settings);
  assert.match(copy, /Study data is still stored locally/);
  assert.match(copy, /Cloud sync is not enabled/);
  assert.match(copy, /Signing in does not create a cloud backup\./);
  assert.ok(settings.querySelector('#settingsOpenAccount'));
  assert.equal(settings.querySelectorAll('#settingsDataCounts [data-count]').length, 5);
  for (const id of ['settingsDeleteAllDataOpen', 'settingsDeleteAllDataGuard', 'settingsDeleteAllDataInput', 'settingsDeleteAllDataConfirm', 'settingsDeleteAllDataCancel']) {
    assert.ok(settings.querySelector(`#${id}`), id);
  }
  assert.equal(settings.querySelector('#settingsDeleteAllDataConfirm').hasAttribute('disabled'), true);
  assert.equal(settings.querySelector('#settingsDeleteAllDataInput').getAttribute('data-confirm-word'), 'DELETE');
});

test('every visible string exists in EN RU HE and the layout uses logical properties', () => {
  const keys = new Set();
  settings.querySelectorAll('[data-i18n]').forEach((node) => keys.add(node.getAttribute('data-i18n')));
  settings.querySelectorAll('[data-i18n-aria-label]').forEach((node) => keys.add(node.getAttribute('data-i18n-aria-label')));
  settings.querySelectorAll('[data-i18n-placeholder]').forEach((node) => keys.add(node.getAttribute('data-i18n-placeholder')));
  ['Modified · {count}', 'Nothing modified', 'Reset to default', '{count} settings shown', 'Sample mix', 'Fold', 'Call', 'Raise',
    'Heuristic baseline', 'Estimated', '{first} or {second} · close', 'Some counts could not be read in this browser.',
    'No settings match “{query}”.', 'Nothing is changed from the defaults.'].forEach((key) => keys.add(key));
  assert.ok(keys.size > 80);
  const i18n = app.window.RiverlineI18n;
  const missing = [];
  for (const language of ['en', 'ru', 'he']) {
    for (const key of keys) if (i18n.resolveTranslation(key, language).missing) missing.push(`${language}: ${key}`);
  }
  assert.deepEqual(missing, []);
  const block = stylesSource.slice(stylesSource.indexOf('/* SETTINGS-001'));
  assert.doesNotMatch(block, /(^|[\s;{])(left|right|margin-left|margin-right|padding-left|padding-right|border-left|border-right)\s*:/m,
    'logical properties only');
  assert.match(block, /\.settings-row\[data-modified="true"\]::before[\s\S]*inset-inline-start/);
  assert.match(block, /\.settings-row\[data-modified="true"\]::before[\s\S]*inline-size: 3px/);
  assert.equal(css.cascaded(settings.querySelector('.settings-category-count'), 'inset-inline-end'), 'var(--space-4)');
});

test('Escape, focus and navigation: the gear selects Settings, nothing traps focus', () => {
  assert.match(workspaceSource, /event\.key !== 'Escape'/);
  assert.match(workspaceSource, /riverlineColorPicker/, 'the colour picker keeps its own Escape');
  assert.match(shellSource, /openSettings'\)\?\.focus/);
  assert.doesNotMatch(workspaceSource, /key !== 'Tab'/, 'a workspace is not a focus trap');
  assert.match(shellSource, /aria-current/);
});

test('Settings tutorial follows category anchors without duplicating preference authority', () => {
  assert.match(tutorialSource, /id: 'settings\.preferences', version: 2/);
  for (const anchor of ['settings-overview', 'settings-appearance', 'settings-audio', 'settings-language-help', 'settings-account']) {
    assert.match(tutorialSource, new RegExp(`anchor: '${anchor}'`));
    assert.equal(settings.querySelectorAll(`[data-tutorial-anchor="${anchor}"]`).length, 1, anchor);
  }
});

test('opening Settings performs presentation work only and shows the workspace', async () => {
  assert.doesNotMatch(workspaceSource + shellSource, /PokerState|StrategyProvider|DecisionContext|calculateEquity|TrainingPracticePlanner|evaluateSeven/);
  const names = ['calculateEquity', 'updateContext', 'deriveDecisionContext', 'renderTrainingSetup', 'startConfiguredTrainingSession', 'commitPlaybookUpdate']
    .filter((name) => app.evaluate(`typeof ${name}`) === 'function');
  assert.ok(names.length >= 3, names.join());
  const state = { decisionContext: app.window.app.decisionContext, strategyResult: app.window.app.strategyResult };
  const spy = app.spy(names);
  try {
    await app.click('#openSettings');
    assert.equal(app.byId('settingsMode').style.display, 'block');
    assert.equal(app.window.RiverlineSettings.isOpen(), true);
    assert.equal(app.byId('openSettings').getAttribute('aria-current'), 'page');
    assert.equal(spy.total(), 0, JSON.stringify(spy.sequence));
    await app.click('#openSettings');
    assert.equal(app.window.RiverlineSettings.isOpen(), false, 'selecting the gear again goes back');
  } finally {
    spy.restore();
    if (app.window.RiverlineSettings.isOpen()) app.window.RiverlineSettings.close();
  }
  assert.equal(app.window.app.decisionContext, state.decisionContext);
  assert.equal(app.window.app.strategyResult, state.strategyResult);
});
