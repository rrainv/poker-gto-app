import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

import { StyleSheetModel, appStyleSheet, bootApp } from './helpers/app-under-test.mjs';
import {
  MOTION_PREFERENCE_STORAGE_KEY,
  createMotionPreferenceController,
  motionAllowsTravel,
  motionDurationMs,
  resolveMotionMode,
} from '../app/src/application/motion-preference.mjs';

// MOTION-FOUNDATION-001: the global Motion setting, the per-moment tempo hook
// and the keyboard rule, observed in the booted app and the cascade.
const css = appStyleSheet();
const app = await bootApp();
const root = app.document.documentElement;
const probe = (html) => {
  const host = app.document.createElement('div');
  host.innerHTML = html;
  app.document.body.appendChild(host);
  return host.firstElementChild;
};

// Evaluates a resolved calc() of ms/s literals and plain numbers to ms.
function ms(value) {
  const expression = String(value)
    .replace(/calc\(/g, '(')
    .replace(/(\d*\.?\d+)ms\b/g, '($1)')
    .replace(/(\d*\.?\d+)s\b/g, '($1*1000)');
  assert.match(expression, /^[\d\s.()*/+-]+$/, `not a duration: ${value}`);
  return Number(vm.runInNewContext(expression).toFixed(3));
}
const duration = (element, token) => ms(css.resolved(element, token));

async function chooseMotion(mode) {
  await app.click(`[data-motion-option="${mode}"]`, { force: true });
}

function fakeQuery(matches) {
  const listeners = new Set();
  return {
    matches,
    addEventListener: (_, listener) => listeners.add(listener),
    removeEventListener: (_, listener) => listeners.delete(listener),
    flip(next) { this.matches = next; listeners.forEach((listener) => listener()); },
  };
}

function fakeStorage(initial = {}) {
  const map = new Map(Object.entries(initial));
  return {
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => map.set(key, String(value)),
    removeItem: (key) => map.delete(key),
    map,
  };
}

test('durations scale with the Motion setting and the moment tempo', () => {
  assert.equal(motionDurationMs(260, { mode: 'standard' }), 260);
  assert.equal(motionDurationMs(260, { mode: 'standard', moment: 'table' }), 371);
  assert.equal(motionDurationMs(260, { mode: 'faster', moment: 'table' }), 232);
  assert.equal(motionDurationMs(340, { mode: 'standard', moment: 'nav' }), 680);
  assert.equal(motionDurationMs(260, { mode: 'instant', moment: 'table' }), 0);
  assert.ok(motionDurationMs(600, { mode: 'reduced', moment: 'rare' }) <= 200);
  assert.equal(motionDurationMs(260, { mode: 'faster', keyboard: true }), 0);
  assert.equal(motionAllowsTravel({ mode: 'standard' }), true);
  assert.equal(motionAllowsTravel({ mode: 'faster' }), true);
  assert.equal(motionAllowsTravel({ mode: 'reduced' }), false);
  assert.equal(motionAllowsTravel({ mode: 'instant' }), false);
  assert.equal(motionAllowsTravel({ mode: 'standard', keyboard: true }), false);
});

test('Reduced follows the system by default; an explicit choice persists and wins', () => {
  assert.equal(resolveMotionMode(null, false), 'standard');
  assert.equal(resolveMotionMode(null, true), 'reduced');
  assert.equal(resolveMotionMode('faster', true), 'faster');

  const element = { dataset: {}, ownerDocument: null };
  const system = fakeQuery(false);
  const storage = fakeStorage();
  const controller = createMotionPreferenceController({ root: element, storage, systemQuery: system }).init();
  assert.equal(element.dataset.motionMode, 'standard');
  system.flip(true);
  assert.equal(element.dataset.motionMode, 'reduced', 'a system change applies immediately');
  controller.apply('standard');
  assert.equal(storage.getItem(MOTION_PREFERENCE_STORAGE_KEY), 'standard');
  assert.equal(element.dataset.motionSource, 'user');
  system.flip(false);
  system.flip(true);
  assert.equal(element.dataset.motionMode, 'standard', 'an explicit choice is not overridden by the system');
  controller.apply(null);
  assert.equal(storage.getItem(MOTION_PREFERENCE_STORAGE_KEY), null);
  assert.equal(element.dataset.motionMode, 'reduced');

  // A stored choice is restored on the next visit; junk is ignored.
  const restored = { dataset: {} };
  createMotionPreferenceController({ root: restored, storage: fakeStorage({ [MOTION_PREFERENCE_STORAGE_KEY]: 'instant' }), systemQuery: fakeQuery(true) }).init();
  assert.equal(restored.dataset.motionMode, 'instant');
  const junk = { dataset: {} };
  createMotionPreferenceController({ root: junk, storage: fakeStorage({ [MOTION_PREFERENCE_STORAGE_KEY]: 'warp' }), systemQuery: fakeQuery(false) }).init();
  assert.equal(junk.dataset.motionMode, 'standard');
});

test('the Settings control persists per device and applies to the app', async () => {
  assert.equal(root.dataset.motionMode, 'standard');
  assert.equal(root.dataset.motionSource, 'system');
  const options = app.$$('[data-motion-option]').map((button) => button.dataset.motionOption);
  assert.deepEqual(options, ['instant', 'faster', 'standard', 'reduced']);
  assert.equal(app.byId('settingsMotionFollowDevice').hidden, true);

  await chooseMotion('faster');
  assert.equal(root.dataset.motionMode, 'faster');
  assert.equal(app.storage.getItem(MOTION_PREFERENCE_STORAGE_KEY), 'faster');
  assert.equal(app.$('[data-motion-option="faster"]').getAttribute('aria-pressed'), 'true');
  assert.equal(app.$('[data-motion-option="standard"]').getAttribute('aria-pressed'), 'false');
  assert.equal(app.byId('settingsMotionFollowDevice').hidden, false);
  assert.equal(app.byId('settingsMotionSource').hidden, true);

  await app.click('#settingsMotionFollowDevice', { force: true });
  assert.equal(app.storage.getItem(MOTION_PREFERENCE_STORAGE_KEY), null);
  assert.equal(root.dataset.motionMode, 'standard');
  assert.equal(root.dataset.motionSource, 'system');
});

test('CSS durations follow the setting and each data-motion tempo', async () => {
  await chooseMotion('standard');
  const plain = probe('<div></div>');
  const drill = probe('<div data-motion="drill"><span></span></div>');
  const nav = probe('<div data-motion="nav"></div>');
  assert.equal(duration(plain, '--motion-panel'), 180);
  assert.equal(duration(drill.firstElementChild, '--motion-panel'), Number((180 / 0.7).toFixed(3)), 'tempo reaches descendants');
  assert.equal(duration(nav, '--motion-table'), 520);
  // A legacy literal keeps its Standard timing and scales with the setting.
  const legacy = probe('<button class="btn"></button>');
  assert.equal(duration(legacy, 'transition-duration'), 200);

  await chooseMotion('faster');
  assert.equal(duration(plain, '--motion-panel'), 112.5);
  assert.equal(duration(drill, '--motion-table'), Number((260 * 0.625 / 0.7).toFixed(3)));
  assert.equal(duration(legacy, 'transition-duration'), 125);

  await chooseMotion('instant');
  assert.equal(duration(plain, '--motion-panel'), 0);
  assert.equal(css.cascaded(legacy, 'transition-duration'), '0s');
  assert.equal(css.cascaded(probe('<div class="animate-feedback"></div>'), 'animation-duration'), '.01ms');
  assert.equal(app.window.RiverlineMotion.allowsTravel(), false);
  await chooseMotion('standard');
});

test('Reduced keeps opacity fades of 200 ms or less and nothing else', async () => {
  await chooseMotion('reduced');
  for (const html of ['<button class="btn"></button>', '<div class="toast"></div>', '<button class="ui-button"></button>']) {
    const element = probe(html);
    assert.equal(css.cascaded(element, 'transition-property'), 'opacity', html);
    assert.ok(duration(element, 'transition-duration') <= 200, html);
    assert.match(css.cascaded(element, 'animation-duration'), /^(?:\.01ms|0\.001ms)$/, html);
  }
  assert.equal(css.cascaded(probe('<button class="ui-button"></button>'), 'translate', { states: ['hover'] }), 'none');
  assert.equal(app.window.RiverlineMotion.allowsTravel(), false);
  assert.equal(app.window.RiverlineMotion.scrollBehavior(), 'auto');
  await chooseMotion('standard');
  assert.equal(app.window.RiverlineMotion.allowsTravel(), true);
});

test('actions triggered by keys never animate (one shared mechanism)', async () => {
  await chooseMotion('standard');
  const legacy = probe('<button class="btn"></button>');
  const spinner = probe('<div class="training-spinner"></div>');
  assert.equal(duration(legacy, 'transition-duration'), 200);

  await app.key(app.document.body, 'f');
  assert.equal(root.dataset.motionInput, 'key');
  assert.equal(css.cascaded(legacy, 'transition-duration'), '0s');
  assert.equal(app.window.RiverlineMotion.allowsTravel(), false);
  assert.equal(app.window.RiverlineMotion.durationMs(260, 'table'), 0);
  // Loading indicators report work and keep turning.
  assert.notEqual(css.cascaded(spinner, 'animation-duration'), '.01ms');
  // Modifier keys alone do not count as a keyboard action.
  root.dataset.motionInput = 'pointer';
  await app.key(app.document.body, 'Shift');
  assert.equal(root.dataset.motionInput, 'pointer');

  await app.key(app.document.body, 'Enter');
  app.document.dispatchEvent(new app.window.PointerEvent('pointermove', { bubbles: true }));
  assert.equal(root.dataset.motionInput, 'pointer');
  assert.equal(duration(legacy, 'transition-duration'), 200);
});

test('Motion copy exists in EN, RU and HE and sound stays separate', () => {
  const sandbox = { riverlineProductTranslations: null };
  vm.runInNewContext(fs.readFileSync(new URL('../app/src/locales/product-translations.js', import.meta.url), 'utf8'), { window: sandbox });
  for (const key of ['Motion', 'Instant', 'Faster', 'Reduced', 'Scales every animation. Keyboard actions are always instant.',
    "Matches this device's reduced-motion setting until you choose.", "Match this device's setting"]) {
    for (const language of ['en', 'ru', 'he']) assert.ok(sandbox.riverlineProductTranslations[language][key], `${language}: ${key}`);
  }
  for (const node of app.$$('[data-motion-option], #settingsMotionTitle, #settingsMotionHint, #settingsMotionSource, #settingsMotionFollowDevice')) {
    assert.ok(node.dataset.i18n, node.id || node.dataset.motionOption);
  }
  // The Motion control lives in the Audio & Motion panel next to, not inside, the sound switches.
  const panel = app.byId('settingsPanelAudio');
  assert.ok(panel.contains(app.byId('settingsMotionControl')));
  assert.equal(app.byId('settingsMotionControl').querySelector('#audioSettingsSwitch'), null);
});

test('guardrails: one reduced-motion source, no transition: all, foundation animates only cheap properties', () => {
  // SOURCE-SHAPE: policy lints over the stylesheet as authored (parsed).
  for (const rule of css.rules) {
    assert.ok(!rule.conditions.some(({ query }) => /prefers-reduced-motion/.test(query || '')), rule.selectors.join(', '));
    for (const { property, value } of rule.declarations) {
      if (property === 'transition' || property === 'transition-property') {
        assert.doesNotMatch(` ${value} `, /(?:^|[\s,])all(?:[\s,]|$)/, rule.selectors.join(', '));
      }
    }
  }
  const raw = fs.readFileSync(new URL('../app/styles.css', import.meta.url), 'utf8');
  const foundation = new StyleSheetModel(raw.slice(raw.indexOf('/* MOTION-FOUNDATION-001 ----')));
  for (const rule of foundation.rules) {
    for (const { property, value } of rule.declarations) {
      if (property === 'transition-property') assert.equal(value, 'opacity');
      if (property === 'transition') assert.match(value, /^(?:opacity|transform|clip-path)\b/);
    }
    assert.ok(!rule.selectors.some((selector) => selector.includes(':hover')), 'hover lives under (hover:hover) and (pointer:fine)');
  }
});
