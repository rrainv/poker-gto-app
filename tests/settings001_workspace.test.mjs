import test from 'node:test';
import assert from 'node:assert/strict';

import { bootApp } from './helpers/app-under-test.mjs';

// SETTINGS-001: the mounted workspace in the running app. Instant apply with a
// modified marker and a per-row reset, search and the modified filter across
// categories, the sidebar gear and Escape, the deep link, and that leaving
// Settings restores the workspace exactly as it was left.
const app = await bootApp();
const $ = (selector) => app.$(selector);
const row = (id) => $(`[data-setting-id="${id}"]`);
const reset = (id) => row(id).querySelector('[data-settings-reset]');
const settle = () => app.settle(30);

async function open(category) {
  if (!app.window.RiverlineSettings.isOpen()) await app.click('#openSettings');
  if (category) await app.click(`#settingsTab${category[0].toUpperCase()}${category.slice(1)}`);
  await settle();
}

test('mount follows the controller contract and the shell owns navigation', async () => {
  await open();
  const controller = app.window.RiverlineSettings.getController();
  for (const method of ['dispose', 'refreshLanguage', 'handleKey', 'setVisible']) {
    assert.equal(typeof controller[method], 'function', method);
  }
  assert.equal(app.window.RiverlineSettingsWorkspace.schemaVersion, 'settings-workspace/v1');
  assert.equal(controller.getActiveCategory(), 'appearance');
});

test('a changed preference gets a marker, a count and its own Reset; Reset restores the default', async () => {
  await open('appearance');
  assert.equal(row('card-face-style').dataset.modified, 'false');
  assert.ok(reset('card-face-style').hasAttribute('hidden'));
  assert.equal($('#settingsModifiedFilter').hasAttribute('disabled'), true, 'nothing to filter yet');

  await app.click('[data-card-face-style="classic"]');
  await settle();
  assert.equal(app.document.documentElement.dataset.cardFaceStyle, 'classic', 'applied instantly, no Save');
  assert.equal(row('card-face-style').dataset.modified, 'true');
  assert.equal(reset('card-face-style').hasAttribute('hidden'), false);
  assert.equal($('[data-settings-count="appearance"]').textContent, '1');
  assert.equal($('#settingsModifiedLabel').textContent, 'Modified · 1');
  assert.equal($('#settingsWorkspace').dataset.settingsModifiedCount, '1');

  await app.click(reset('card-face-style'));
  await settle();
  assert.equal(app.document.documentElement.dataset.cardFaceStyle, 'minimal');
  assert.equal(row('card-face-style').dataset.modified, 'false');
  assert.equal($('#settingsModifiedLabel').textContent, 'Nothing modified');
  assert.equal($('[data-settings-count="appearance"]').hasAttribute('hidden'), true);
});

test('Motion defaults to "match this device", so choosing one marks it and Reset clears the stored choice', async () => {
  await open('audio');
  assert.equal(row('motion').dataset.modified, 'false');
  await app.click('#settingsMotionControl [data-motion-option="reduced"]');
  await settle();
  assert.equal(row('motion').dataset.modified, 'true');
  assert.equal(app.window.localStorage.getItem('riverline_motion_preference'), 'reduced');
  await app.click(reset('motion'));
  await settle();
  assert.equal(row('motion').dataset.modified, 'false');
  assert.equal(app.window.localStorage.getItem('riverline_motion_preference'), null);
});

test('search spans categories, the modified filter narrows to changed rows, and an empty result says so', async () => {
  await open('appearance');
  await app.click('[data-card-back-style="geometric"]');
  const volume = $('#audioMasterVolume');
  volume.value = '30';
  volume.dispatchEvent(new app.window.Event('input', { bubbles: true }));
  await settle();
  const search = $('#settingsSearch');

  search.value = 'volume';
  search.dispatchEvent(new app.window.Event('input', { bubbles: true }));
  assert.equal($('#settingsWorkspace').dataset.settingsView, 'search');
  assert.deepEqual(app.$$('.settings-panel').filter((panel) => !panel.hidden).map((panel) => panel.dataset.settingsPanel), ['audio']);
  assert.equal(row('audio-volume').dataset.settingsFiltered, 'false');
  assert.equal(row('audio-poker').dataset.settingsFiltered, 'true');

  search.value = '';
  search.dispatchEvent(new app.window.Event('input', { bubbles: true }));
  await app.click('#settingsModifiedFilter');
  assert.equal($('#settingsModifiedFilter').getAttribute('aria-pressed'), 'true');
  const shown = app.$$('[data-setting-id]').filter((node) => node.dataset.settingsFiltered === 'false' && !node.closest('[hidden]')).map((node) => node.dataset.settingId);
  assert.deepEqual(shown.sort(), ['audio-volume', 'card-back-style']);

  search.value = 'zzzz';
  search.dispatchEvent(new app.window.Event('input', { bubbles: true }));
  assert.equal($('#settingsEmpty').hasAttribute('hidden'), false);
  assert.match($('#settingsEmptyTitle').textContent, /No settings match “zzzz”\./);
  await app.click('#settingsEmptyClear');
  assert.equal(search.value, '');

  // Clean up: Reset every row we changed; the filter switches itself off at zero.
  await app.click('#settingsModifiedFilter');
  await app.click(reset('audio-volume'));
  await app.click(reset('card-back-style'));
  await settle();
  assert.equal($('#settingsWorkspace').dataset.settingsModifiedCount, '0');
  assert.equal($('#settingsModifiedFilter').getAttribute('aria-pressed'), 'false');
});

test('the preview is built from the real components and follows the card settings', async () => {
  await open('appearance');
  const preview = $('#settingsPreview');
  assert.ok(preview.querySelector('.rl-action-card[data-kind="fold"]'));
  assert.ok(preview.querySelector('.rl-mix [data-kind="aggressive"]'));
  assert.ok(preview.querySelector('.rl-source-tier[data-tier="estimated"]'));
  assert.equal(preview.querySelectorAll('.riverline-card.card--known').length, 5, 'flop three plus hero two, face up');
  assert.equal(preview.querySelectorAll('.riverline-card-back').length, 2, 'turn and river face down');
  assert.equal(preview.querySelector('[inert]') !== null, true);
  // Every suit is on show so the four-colour deck is visible.
  const suits = new Set(preview.querySelectorAll('.riverline-card').map((card) => card.dataset.previewSuit));
  assert.deepEqual([...suits].sort(), ['c', 'd', 'h', 's']);
});

test('Language cards switch the language and show a real line in each language', async () => {
  await open('language');
  const samples = Object.fromEntries(app.$$('[data-language-sample]').map((node) => [node.dataset.languageSample, node.textContent]));
  assert.equal(samples.en, 'Call or Raise · close');
  assert.match(samples.ru, /Колл или Рейз/);
  assert.match(samples.he, /קול או רייז/);
  assert.equal($('[data-language-option="en"]').getAttribute('aria-pressed'), 'true');
  try {
    await app.click('[data-language-option="ru"]');
    await settle();
    assert.equal(app.window.appLang, 'ru');
    assert.equal($('[data-language-option="ru"]').getAttribute('aria-pressed'), 'true');
    assert.equal(row('language').dataset.modified, 'true', 'Russian is not the default');
    assert.equal(app.document.documentElement.getAttribute('lang'), 'ru');
  } finally {
    await app.click(reset('language'));
    await settle();
  }
  assert.equal(app.window.appLang, 'en');
});

test('Account & Data shows exact counts and the deep link opens it', async () => {
  app.window.RiverlineSettings.close();
  app.window.RiverlineSettings.open('account');
  await app.settle(200);
  assert.equal($('#settingsWorkspace').dataset.settingsCategory, 'account');
  assert.equal($('#settingsAccountProfile').hasAttribute('hidden'), false);
  const states = new Set(['ready', 'error', 'loading']);
  assert.ok(states.has($('#settingsDataCounts').dataset.countsState));
  assert.equal(app.$$('#settingsDataCounts [data-count] dd').length, 5);
});

test('the gear goes back, Escape goes back, and leaving restores the workspace as it was left', async () => {
  app.window.RiverlineSettings.close();
  await app.navigate('training');
  const before = {
    active: app.$('.mode-nav-item.active')?.dataset.navigationId,
    view: app.byId('trainingMode').style.display,
    title: app.byId('workspaceTitle').textContent,
  };
  await app.click('#openSettings');
  assert.equal(app.window.RiverlineSettings.isOpen(), true);
  assert.equal(app.byId('trainingMode').style.display, 'none');
  assert.equal(app.$('.mode-nav-item.active'), null, 'one place is highlighted: the gear');
  assert.equal(app.byId('workspaceTitle').textContent, 'Settings');
  assert.equal(app.byId('shell') ?? app.$('.riverline-shell').dataset.settingsOpen, 'true');

  await app.click('#openSettings');
  assert.equal(app.window.RiverlineSettings.isOpen(), false);
  assert.equal(app.$('.mode-nav-item.active')?.dataset.navigationId, before.active);
  assert.equal(app.byId('trainingMode').style.display, before.view);
  assert.equal(app.byId('workspaceTitle').textContent, before.title);

  await app.click('#openSettings');
  const escape = new app.window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
  app.document.dispatchEvent(escape);
  assert.equal(app.window.RiverlineSettings.isOpen(), false, 'Escape leaves Settings');
  assert.equal(escape.defaultPrevented, true);
  assert.equal(app.$('.mode-nav-item.active')?.dataset.navigationId, before.active);
});

test('Escape clears a search first and leaves the colour picker its own Escape', async () => {
  await open('appearance');
  const search = $('#settingsSearch');
  search.value = 'theme';
  search.dispatchEvent(new app.window.Event('input', { bubbles: true }));
  app.document.dispatchEvent(new app.window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
  assert.equal(app.window.RiverlineSettings.isOpen(), true, 'the first Escape only clears the search');
  assert.equal(search.value, '');

  const picker = $('#riverlineColorPicker');
  picker.removeAttribute('hidden');
  const escape = new app.window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
  app.document.dispatchEvent(escape);
  assert.equal(app.window.RiverlineSettings.isOpen(), true, 'an open picker keeps its Escape');
  picker.setAttribute('hidden', '');
  app.window.RiverlineSettings.close();
});

test('navigating from Settings with a sidebar item drops the chrome and shows that workspace', async () => {
  await open();
  await app.click('.mode-nav-item[data-navigation-id="analyze"]');
  assert.equal(app.window.RiverlineSettings.isOpen(), false);
  assert.equal(app.byId('settingsMode').style.display, 'none');
  assert.equal(app.$('.mode-nav-item.active')?.dataset.navigationId, 'analyze');
  assert.equal(app.byId('openSettings').getAttribute('aria-current'), null);
});
