import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import {
  createRiverlineColorPicker,
  hexToHsv,
  hsvToHex,
} from '../app/src/application/riverline-color-picker.mjs';

const html = fs.readFileSync(new URL('../app/index.html', import.meta.url), 'utf8');
const css = fs.readFileSync(new URL('../app/styles.css', import.meta.url), 'utf8');
const bootstrap = fs.readFileSync(new URL('../app/src/application/presentation-density-bootstrap.mjs', import.meta.url), 'utf8');
const translations = fs.readFileSync(new URL('../app/src/locales/analysis-translations.js', import.meta.url), 'utf8');

class FakeElement {
  constructor(dataset = {}, ownerDocument = null) {
    this.dataset = { ...dataset };
    this.hidden = false;
    this.disabled = false;
    this.value = '';
    this.attributes = new Map();
    this.listeners = new Map();
    this.styleValues = new Map();
    this.style = { setProperty: (name, value) => this.styleValues.set(name, value) };
    this.ownerDocument = ownerDocument ?? { activeElement: null, documentElement: { dir: 'ltr' } };
    this.rect = { left: 0, top: 0, width: 100, height: 100, right: 100, bottom: 100 };
    this.capturedPointers = new Set();
  }
  addEventListener(type, listener) {
    const group = this.listeners.get(type) ?? [];
    group.push(listener);
    this.listeners.set(type, group);
  }
  removeEventListener(type, listener) {
    this.listeners.set(type, (this.listeners.get(type) ?? []).filter((entry) => entry !== listener));
  }
  dispatch(type, properties = {}) {
    const event = {
      type,
      key: '',
      shiftKey: false,
      pointerId: 1,
      clientX: 0,
      clientY: 0,
      prevented: false,
      stopped: false,
      preventDefault() { this.prevented = true; },
      stopPropagation() { this.stopped = true; },
      ...properties,
    };
    for (const listener of this.listeners.get(type) ?? []) listener(event);
    return event;
  }
  setAttribute(name, value) { this.attributes.set(name, String(value)); }
  getAttribute(name) { return this.attributes.get(name) ?? null; }
  focus() { this.ownerDocument.activeElement = this; this.focused = true; }
  querySelectorAll() { return this.focusables ?? []; }
  getBoundingClientRect() { return { ...this.rect }; }
  setPointerCapture(pointerId) { this.capturedPointers.add(pointerId); }
  releasePointerCapture(pointerId) { this.capturedPointers.delete(pointerId); }
  scrollIntoView(options) { this.scrolledWith = options; }
}

function fixture({
  colors = { accent: '#42ad7b', surface: '#111827', felt: '#285a45' },
  dir = 'ltr',
  acceptPreview = (token, color) => ({ [token]: color }),
} = {}) {
  const ownerDocument = { activeElement: null, documentElement: { dir } };
  const element = (dataset) => new FakeElement(dataset, ownerDocument);
  const dialog = element();
  dialog.hidden = true;
  const triggers = {
    accent: element({ themeColorToken: 'accent', labelKey: 'Accent color' }),
    surface: element({ themeColorToken: 'surface', labelKey: 'Surface tone' }),
    felt: element({ themeColorToken: 'felt', labelKey: 'Table accent' }),
  };
  const title = element();
  const saturationValue = element();
  const handle = element();
  const hue = element();
  const hexInput = element();
  const currentPreview = element();
  const newPreview = element();
  const preset = element({ colorPickerPreset: '#7897c8' });
  const applyButton = element();
  const cancelButton = element();
  dialog.focusables = [saturationValue, hue, hexInput, preset, cancelButton, applyButton];
  const previews = [];
  const applies = [];
  const cancels = [];
  const picker = createRiverlineColorPicker({
    dialog,
    triggers: Object.values(triggers),
    title,
    saturationValue,
    saturationValueHandle: handle,
    hue,
    hexInput,
    currentPreview,
    newPreview,
    presets: [preset],
    applyButton,
    cancelButton,
    getColor: (token) => colors[token],
    onPreview: (token, color) => {
      previews.push([token, color]);
      return acceptPreview(token, color);
    },
    onApply: (token, color) => applies.push([token, color]),
    onCancel: (token, color) => cancels.push([token, color]),
    translate: (key) => `t:${key}`,
  });
  return {
    applyButton, applies, cancelButton, cancels, currentPreview, dialog,
    handle, hexInput, hue, newPreview, picker, preset, previews, saturationValue, title,
    trigger: triggers.accent, triggers,
  };
}

function pointerClick(element, clientX, clientY, pointerId = 1) {
  element.dispatch('pointerdown', { pointerId, clientX, clientY });
  element.dispatch('pointerup', { pointerId, clientX, clientY });
}

const percent = (styleValue) => Number.parseFloat(styleValue);

test('HSV conversion has exact canonical hues and stable hex round-trips', () => {
  const canonical = new Map([
    [0, '#ff0000'], [60, '#ffff00'], [120, '#00ff00'], [180, '#00ffff'],
    [240, '#0000ff'], [300, '#ff00ff'], [360, '#ff0000'],
  ]);
  for (const [hue, expected] of canonical) {
    assert.equal(hsvToHex({ h: hue, s: 100, v: 100 }), expected);
  }
  for (const color of ['#336699', '#42ad7b', '#abcdef', '#ffffff', '#000000']) {
    assert.equal(hsvToHex(hexToHsv(color)), color);
  }
  assert.equal(hexToHsv('var(--accent)'), null);
});

test('SV coordinates use the live bounding rectangle and match displayed HSV axes', () => {
  const view = fixture({ colors: { accent: '#ff0000', surface: '#111827', felt: '#285a45' } });
  view.saturationValue.rect = {
    left: 400, top: 900, width: 200, height: 200, right: 600, bottom: 1100,
  };
  view.trigger.dispatch('click');

  pointerClick(view.saturationValue, 400, 900);
  assert.equal(view.hexInput.value, '#FFFFFF');
  assert.equal(view.handle.styleValues.get('--picker-saturation'), '0%');
  assert.equal(view.handle.styleValues.get('--picker-value'), '0%');

  pointerClick(view.saturationValue, 500, 1000);
  assert.equal(view.hexInput.value, '#804040');
  assert.equal(view.handle.styleValues.get('--picker-saturation'), '50%');
  assert.equal(view.handle.styleValues.get('--picker-value'), '50%');

  pointerClick(view.saturationValue, 600, 1100);
  assert.equal(view.hexInput.value, '#000000');
  assert.equal(view.handle.styleValues.get('--picker-saturation'), '100%');
  assert.equal(view.handle.styleValues.get('--picker-value'), '100%');

  pointerClick(view.saturationValue, 900, 700);
  assert.equal(view.hexInput.value, '#FF0000');
  assert.equal(view.handle.styleValues.get('--picker-saturation'), '100%');
  assert.equal(view.handle.styleValues.get('--picker-value'), '0%');
});

test('hue slider position, displayed hue, and resulting canonical color agree', () => {
  const view = fixture({ colors: { accent: '#ff0000', surface: '#111827', felt: '#285a45' } });
  view.trigger.dispatch('click');
  const canonical = new Map([
    [0, '#ff0000'], [60, '#ffff00'], [120, '#00ff00'],
    [180, '#00ffff'], [240, '#0000ff'], [300, '#ff00ff'],
  ]);
  for (const [position, expected] of canonical) {
    view.hue.value = String(position);
    view.hue.dispatch('input');
    assert.equal(view.hue.value, String(position));
    assert.equal(view.saturationValue.styleValues.get('--picker-hue'), expected);
    assert.equal(view.hexInput.value, expected.toUpperCase());
  }
});

test('hex input and picker marker round-trip through the same HSV state', () => {
  const view = fixture({ colors: { accent: '#ff0000', surface: '#111827', felt: '#285a45' } });
  view.saturationValue.rect = {
    left: 320, top: 640, width: 240, height: 180, right: 560, bottom: 820,
  };
  view.trigger.dispatch('click');
  view.hexInput.value = '#336699';
  view.hexInput.dispatch('input');
  assert.equal(view.hexInput.value, '#336699');
  assert.equal(Number(view.hue.value), 210);
  assert.ok(Math.abs(percent(view.handle.styleValues.get('--picker-saturation')) - (2 / 3 * 100)) < 0.001);
  assert.ok(Math.abs(percent(view.handle.styleValues.get('--picker-value')) - 40) < 0.001);

  const markerX = 320 + (2 / 3 * 240);
  const markerY = 640 + (0.4 * 180);
  pointerClick(view.saturationValue, markerX, markerY);
  assert.equal(view.hexInput.value, '#336699');
  assert.equal(view.picker.getColor(), '#336699');
});

test('scrolled-page pointer mapping stays in client/bounding-rect coordinates', () => {
  const view = fixture({ colors: { accent: '#ff0000', surface: '#111827', felt: '#285a45' } });
  view.saturationValue.rect = {
    left: 40, top: 120, width: 200, height: 200, right: 240, bottom: 320,
  };
  view.trigger.dispatch('click');
  view.saturationValue.dispatch('pointerdown', {
    pointerId: 3,
    clientX: 140,
    clientY: 220,
    pageX: 140,
    pageY: 1220,
  });
  view.saturationValue.dispatch('pointerup', {
    pointerId: 3,
    clientX: 140,
    clientY: 220,
    pageX: 140,
    pageY: 1220,
  });
  assert.equal(view.picker.getColor(), '#804040');
});

test('captured drag clamps outside bounds and stops after pointer cancellation', () => {
  const view = fixture({ colors: { accent: '#ff0000', surface: '#111827', felt: '#285a45' } });
  view.saturationValue.rect = {
    left: 200, top: 300, width: 100, height: 100, right: 300, bottom: 400,
  };
  view.trigger.dispatch('click');
  view.saturationValue.dispatch('pointerdown', { pointerId: 7, clientX: 250, clientY: 350 });
  assert.equal(view.saturationValue.capturedPointers.has(7), true);
  view.saturationValue.dispatch('pointermove', { pointerId: 7, clientX: 500, clientY: 100 });
  assert.equal(view.picker.getColor(), '#ff0000');
  view.saturationValue.dispatch('pointermove', { pointerId: 7, clientX: 250, clientY: 350 });
  assert.equal(view.picker.getColor(), '#804040');
  view.saturationValue.dispatch('pointermove', { pointerId: 7, clientX: 100, clientY: 500 });
  assert.equal(view.picker.getColor(), '#000000');
  view.saturationValue.dispatch('pointercancel', { pointerId: 7 });
  assert.equal(view.saturationValue.capturedPointers.has(7), false);
  view.saturationValue.dispatch('pointermove', { pointerId: 7, clientX: 300, clientY: 300 });
  assert.equal(view.picker.getColor(), '#000000');
});

test('RTL reverses only the saturation axis and remains aligned with the RTL gradient', () => {
  const view = fixture({ dir: 'rtl', colors: { accent: '#ff0000', surface: '#111827', felt: '#285a45' } });
  view.saturationValue.rect = {
    left: 400, top: 900, width: 200, height: 200, right: 600, bottom: 1100,
  };
  view.trigger.dispatch('click');
  pointerClick(view.saturationValue, 600, 900);
  assert.equal(view.picker.getColor(), '#ffffff');
  pointerClick(view.saturationValue, 400, 900);
  assert.equal(view.picker.getColor(), '#ff0000');
});

test('live preview is temporary, Cancel and Escape restore, and Apply commits exactly', () => {
  const view = fixture();
  view.trigger.dispatch('click');
  assert.equal(view.dialog.hidden, false);
  assert.equal(view.dialog.dataset.colorToken, 'accent');
  assert.equal(view.trigger.getAttribute('aria-expanded'), 'true');
  assert.equal(view.title.textContent, 't:Accent color');

  view.preset.dispatch('click');
  assert.deepEqual(view.previews.at(-1), ['accent', '#7897c8']);
  view.cancelButton.dispatch('click');
  assert.deepEqual(view.cancels, [['accent', '#42ad7b']]);
  assert.deepEqual(view.applies, []);
  assert.equal(view.dialog.hidden, true);

  view.trigger.dispatch('click');
  view.picker.setDraft('#9a668f');
  view.applyButton.dispatch('click');
  assert.deepEqual(view.applies, [['accent', '#9a668f']]);
  assert.equal(view.cancels.length, 1);

  view.trigger.dispatch('click');
  view.picker.setDraft('#abcdef');
  const escape = view.dialog.dispatch('keydown', { key: 'Escape' });
  assert.equal(escape.prevented, true);
  assert.equal(escape.stopped, true);
  assert.deepEqual(view.cancels.at(-1), ['accent', '#42ad7b']);
  assert.equal(view.applies.length, 1);
  assert.equal(view.dialog.hidden, true);
});

test('opening another token or reopening the same token cancels stale preview state', () => {
  const view = fixture();
  view.trigger.dispatch('click');
  view.picker.setDraft('#abcdef');
  view.triggers.surface.dispatch('click');
  assert.deepEqual(view.cancels, [['accent', '#42ad7b']]);
  assert.equal(view.picker.getToken(), 'surface');
  assert.equal(view.hexInput.value, '#111827');
  assert.equal(view.currentPreview.dataset.color, '#111827');

  view.picker.setDraft('#223344');
  view.triggers.felt.dispatch('click');
  assert.deepEqual(view.cancels.at(-1), ['surface', '#111827']);
  assert.equal(view.hexInput.value, '#285A45');

  view.picker.setDraft('#477765');
  view.triggers.felt.dispatch('click');
  assert.deepEqual(view.cancels.at(-1), ['felt', '#285a45']);
  assert.equal(view.hexInput.value, '#285A45');
});

test('preview preserves the exact selected color and never jumps to a callback-normalized marker', () => {
  const callbackColor = '#9a668f';
  const view = fixture({
    acceptPreview: (token, raw) => ({ [token]: raw === '#ff00ff' ? callbackColor : raw }),
  });
  view.trigger.dispatch('click');
  view.picker.setDraft('#ff00ff');

  const selectedHsv = hexToHsv('#ff00ff');
  assert.deepEqual(view.previews.at(-1), ['accent', '#ff00ff']);
  assert.equal(view.picker.getColor(), '#ff00ff');
  assert.equal(view.hexInput.value, '#FF00FF');
  assert.equal(view.newPreview.dataset.color, '#ff00ff');
  assert.equal(Number(view.hue.value), selectedHsv.h);
  assert.equal(percent(view.handle.styleValues.get('--picker-saturation')), 100);
  assert.equal(percent(view.handle.styleValues.get('--picker-value')), 0);

  view.applyButton.dispatch('click');
  assert.deepEqual(view.applies, [['accent', '#ff00ff']]);
});

test('keyboard controls preview safely and focus remains trapped', () => {
  const view = fixture();
  view.trigger.dispatch('click');
  const before = view.picker.getColor();
  const arrow = view.saturationValue.dispatch('keydown', { key: 'ArrowLeft' });
  assert.equal(arrow.prevented, true);
  assert.notEqual(view.picker.getColor(), before);
  assert.equal(view.previews.length, 1);

  view.dialog.ownerDocument.activeElement = view.saturationValue;
  const reverseTab = view.dialog.dispatch('keydown', { key: 'Tab', shiftKey: true });
  assert.equal(reverseTab.prevented, true);
  assert.equal(view.applyButton.focused, true);
});

test('Settings picker structure, exact-color copy, localization, and RTL gradients stay authoritative', () => {
  assert.doesNotMatch(html, /type="color"/);
  assert.match(html, /id="themeColorSaturationValue"[^>]+role="slider"[^>]+tabindex="0"/);
  assert.match(html, /id="themeColorHue"[^>]+type="range"[^>]+max="360"[^>]+step="0\.1"/);
  assert.match(html, /id="themeColorHex"[^>]+type="text"/);
  assert.doesNotMatch(html, /themeColorGuardrailStatus|Safety adjustment/);
  assert.match(html, /id="themeColorApply"/);
  assert.match(html, /id="themeColorCancel"/);
  assert.match(bootstrap, /onPreview:[\s\S]*themeController\.preview/);
  assert.match(bootstrap, /onApply:[\s\S]*themeController\.customize/);
  assert.match(bootstrap, /onCancel:[\s\S]*themeController\.cancelPreview/);
  assert.match(bootstrap, /riverline:themechange[\s\S]*colorPicker\.cancel/);

  for (const key of [
    'Theme library', 'Custom themes', 'Choose color', 'Saturation and brightness',
    'Hex color', 'Current and new color', 'Preset colors',
    'Custom colors are preserved exactly. Foreground, focus, and borders adapt for readability; poker suits and action meanings do not change.',
    'Save as new', 'Reset theme to base',
  ]) assert.match(translations, new RegExp(`'${key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}'`));
  const pickerCss = css.slice(css.indexOf('.riverline-color-picker'), css.indexOf('/* Tooltips, toasts'));
  assert.match(pickerCss, /linear-gradient\(to right, #fff, transparent\)/);
  assert.match(pickerCss, /linear-gradient\(to left, #fff, transparent\)/);
  assert.match(pickerCss, /linear-gradient\(to right, #f00 0%, #ff0 16\.667%, #0f0 33\.333%, #0ff 50%, #00f 66\.667%, #f0f 83\.333%, #f00 100%\)/);
  assert.match(pickerCss, /::-moz-range-track/);
  assert.match(pickerCss, /inset-inline-start/);
  assert.doesNotMatch(pickerCss, /margin-left|margin-right|padding-left|padding-right|\bleft\s*:|\bright\s*:/);
});
