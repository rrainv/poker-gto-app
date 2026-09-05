import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const html = fs.readFileSync(new URL('../app/index.html', import.meta.url), 'utf8');
const css = fs.readFileSync(new URL('../app/styles.css', import.meta.url), 'utf8');
const settingsSource = fs.readFileSync(new URL('../app/src/application/settings-ia-bootstrap.mjs', import.meta.url), 'utf8');
const themeSource = fs.readFileSync(new URL('../app/src/application/presentation-theme.mjs', import.meta.url), 'utf8');
const presentationBootstrap = fs.readFileSync(new URL('../app/src/application/presentation-density-bootstrap.mjs', import.meta.url), 'utf8');
const soundSource = fs.readFileSync(new URL('../app/src/core/SoundFX.js', import.meta.url), 'utf8');
const tutorialSource = fs.readFileSync(new URL('../app/src/tutorial/current-app-tutorials.mjs', import.meta.url), 'utf8');
const productTranslations = fs.readFileSync(new URL('../app/src/locales/product-translations.js', import.meta.url), 'utf8');
const logicSource = fs.readFileSync(new URL('../app/src/core/logic.js', import.meta.url), 'utf8');

const settingsHtml = html.slice(html.indexOf('id="settingsModal"'), html.indexOf('<template id="calibrationProfileModalTemplate"'));

const EXPECTED_SETTINGS = Object.freeze({
  appearance: Object.freeze([
    'workspace-layout',
    'card-suit-colors',
    'card-rank-style',
    'card-face-style',
    'card-back-style',
    'workstation-theme',
  ]),
  audio: Object.freeze(['audio-enabled', 'audio-volume', 'audio-poker', 'audio-study']),
  language: Object.freeze(['language']),
  account: Object.freeze([]),
});

function categoryForIndex(index) {
  const panels = [...settingsHtml.matchAll(/data-settings-panel="([^"]+)"/g)]
    .map((match) => ({ category: match[1], index: match.index }));
  return panels.filter((panel) => panel.index < index).at(-1)?.category ?? null;
}

test('every visible preference has exactly one category and the inventory stays intentionally small', () => {
  const inventory = Object.fromEntries(Object.keys(EXPECTED_SETTINGS).map((category) => [category, []]));
  const occurrences = [...settingsHtml.matchAll(/data-setting-id="([^"]+)"/g)];
  assert.equal(new Set(occurrences.map((match) => match[1])).size, occurrences.length, 'no preference is duplicated');
  occurrences.forEach((match) => inventory[categoryForIndex(match.index)].push(match[1]));
  for (const category of Object.keys(inventory)) inventory[category].sort();
  for (const category of Object.keys(EXPECTED_SETTINGS)) {
    assert.deepEqual(inventory[category], [...EXPECTED_SETTINGS[category]].sort(), category);
  }
  assert.equal(occurrences.length, 11);
  assert.doesNotMatch(settingsHtml, /data-setting-id="(?:tutorial|guide|account-status|sound-preview|reduced-motion)"/);
});

test('four category tabs reveal one focused panel with vertical keyboard navigation', () => {
  assert.equal((settingsHtml.match(/role="tab"/g) || []).length, 4);
  assert.equal((settingsHtml.match(/role="tabpanel"/g) || []).length, 4);
  assert.match(settingsHtml, /role="tablist" aria-orientation="vertical"/);
  for (const category of Object.keys(EXPECTED_SETTINGS)) {
    assert.match(settingsHtml, new RegExp(`data-settings-category="${category}"`));
    assert.match(settingsHtml, new RegExp(`data-settings-panel="${category}"`));
  }
  assert.match(settingsSource, /ArrowDown/);
  assert.match(settingsSource, /ArrowUp/);
  assert.match(settingsSource, /event\.key === 'Home'/);
  assert.match(settingsSource, /event\.key === 'End'/);
  assert.match(settingsSource, /panel\.hidden = panel\.dataset\.settingsPanel !== nextCategory/);
  assert.doesNotMatch(settingsSource, /localStorage|sessionStorage/);
});

test('retired density and layout modes stay absent while accepted contextual presets remain bounded', () => {
  assert.doesNotMatch(settingsHtml, /data-density-option|id="densityControl"|Comfortable|Compact/);
  assert.doesNotMatch(settingsHtml, /data-layout-preset-option="controls-first"/);
  assert.equal((settingsHtml.match(/data-layout-preset-option=/g) || []).length, 3);
  assert.match(settingsHtml, /data-layout-preset-field hidden/);
  assert.match(presentationBootstrap, /createPresentationLayoutController/);
  assert.match(presentationBootstrap, /getDensity\(\) !== 'comfortable'/);
});

test('theme transactions and card presentation retain their canonical device authorities', () => {
  for (const id of [
    'themeSwatchGrid', 'customThemeGrid', 'editTheme', 'saveThemeChanges', 'cancelThemeEdit',
    'saveCustomTheme', 'duplicateTheme', 'deleteCustomTheme', 'fourColorDeckToggle',
    'cardRankStyleControl', 'cardFaceStyleControl', 'cardBackStyleControl',
  ]) assert.match(settingsHtml, new RegExp(`id="${id}"`), id);
  assert.match(themeSource, /function beginEdit\(\)/);
  assert.match(themeSource, /function cancelEdit\(\)/);
  assert.match(themeSource, /function saveAsNew\(/);
  assert.match(themeSource, /function duplicateTheme\(/);
  assert.match(themeSource, /editing a built-in preview[\s\S]*built-in stays unchanged/i);
  assert.match(presentationBootstrap, /createCardPresentationController[\s\S]*storage: window\.localStorage/);
});

test('audio remains one hierarchy and preview actions are demoted from preference status', () => {
  for (const id of ['audioSettingsSwitch', 'audioMasterVolume', 'audioPokerSwitch', 'audioStudySwitch']) {
    assert.match(settingsHtml, new RegExp(`id="${id}"`), id);
  }
  assert.match(settingsHtml, /<details class="audio-preview-field settings-detail-disclosure">/);
  assert.match(settingsHtml, /Optional previews; these actions do not change a preference\./);
  assert.match(soundSource, /settingsBtn\.onclick = \(\) => authority\.toggle\(\)/);
  assert.match(soundSource, /pokerBtn\) pokerBtn\.onclick = \(\) => setCategory\(CATEGORIES\.POKER/);
  assert.match(soundSource, /studyBtn\) studyBtn\.onclick = \(\) => setCategory\(CATEGORIES\.STUDY/);
  assert.match(soundSource, /volume\) volume\.oninput = \(event\) => authority\.setMasterVolume/);
});

test('reduced motion is truthful system status rather than invented preference storage', () => {
  assert.match(settingsHtml, /id="settingsReducedMotionStatus"[^>]+aria-live="polite"/);
  assert.match(settingsSource, /matchMedia\?\.\('\(prefers-reduced-motion: reduce\)'\)/);
  assert.match(settingsSource, /System preference: On/);
  assert.match(settingsSource, /System preference: Off/);
  assert.doesNotMatch(settingsSource, /reducedMotion[^\n]+setItem|setItem[^\n]+reducedMotion/);
});

test('language is a shared secondary route and Help does not replace global discovery', () => {
  assert.match(html, /id="langToggle"/);
  assert.match(settingsHtml, /id="settingsLanguageSelect"/);
  assert.match(settingsSource, /RiverlineI18n\?\.setLanguage \?\? browserWindow\.setLanguage/);
  assert.match(settingsSource, /riverline:languagechange/);
  assert.match(html, /id="workspaceLearnButton"[^>]*data-i18n-aria-label="Learn Riverline"/);
  assert.match(settingsHtml, /id="settingsOpenGuide"/);
  assert.match(settingsHtml, /id="settingsTutorialButton"/);
  assert.match(settingsSource, /data-navigation-id="guide"/);
});

test('Account & Data remains a truthful status and route, not a cloud-sync claim', () => {
  assert.match(settingsHtml, /Study data is still stored locally/);
  assert.match(settingsHtml, /Cloud sync is not enabled/);
  assert.match(settingsHtml, /Signing in does not create a cloud backup\./);
  assert.match(settingsHtml, /id="settingsOpenAccount"/);
  assert.equal(EXPECTED_SETTINGS.account.length, 0, 'account status and navigation are not misclassified as preferences');
});

test('EN RU HE copy, RTL logical layout, focus containment, and modal close semantics are explicit', () => {
  const sandbox = { riverlineProductTranslations: null };
  vm.runInNewContext(productTranslations, { window: sandbox });
  const requiredKeys = [
    'Audio & Motion', 'Language & Help', 'Account & Data', 'Settings categories',
    'System preference: On', 'Open Guide', 'Restart Settings tour',
  ];
  for (const language of ['en', 'ru', 'he']) {
    for (const key of requiredKeys) assert.ok(sandbox.riverlineProductTranslations[language][key], `${language}: ${key}`);
  }
  assert.match(css, /border-inline-end: 1px solid var\(--border-subtle\)/);
  assert.match(css, /\[dir="rtl"\] \.settings-category-tab/);
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
    assert.equal((settingsHtml.match(new RegExp(`data-tutorial-anchor="${anchor}"`, 'g')) || []).length, 1, anchor);
  }
});

test('opening Settings performs presentation work only', () => {
  assert.doesNotMatch(settingsSource, /PokerState|StrategyProvider|DecisionContext|calculateEquity|TrainingPracticePlanner|evaluateSeven/);
  const openStart = logicSource.indexOf("if ($('#openSettings'))");
  const openEnd = logicSource.indexOf('const closeSettings', openStart);
  const openHandler = logicSource.slice(openStart, openEnd);
  assert.match(openHandler, /classList\.add\('show'\)/);
  assert.doesNotMatch(openHandler, /calculate|derive|strategy|equity|training/i);
});
