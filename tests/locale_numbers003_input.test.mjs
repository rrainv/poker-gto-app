// LOCALE-NUMBERS-003: amount fields follow the app language, not the browser's.
// Typed or pasted text accepts "." and "," in every language; the field shows
// the value in the app language (EN/HE "1.5", RU "1,5"); `input.value` stays
// plain dot-decimal text for every reader in the app.
import test from 'node:test';
import assert from 'node:assert/strict';

import { bootApp } from './helpers/app-under-test.mjs';

// The app boots first: its module graph installs the page bridges on import.
const app = await bootApp({ width: 1920 });
const {
  formatLocaleInputNumber,
  parseLocaleNumber,
} = await import('../app/src/application/locale-number-format.mjs');
const { bindLocaleNumberInput } = await import('../app/src/application/locale-number-input.mjs');
const {
  mountRangeCalibrationWorkspace,
} = await import('../app/src/application/range-calibration-workspace.mjs');
await mountRangeCalibrationWorkspace();

const AMOUNT_FIELD_IDS = [
  'facingSizeNum', 'potSizeNum', 'stackNum', 'anteNum',
  'handStackBb', 'handAnteBb', 'handActionAmountBb', 'trainingStackNum',
  'personalCollectionBb', 'personalAnteBb', 'calibrationEffectiveStack', 'personalSetupStack',
];

const setLanguage = async (language) => {
  app.window.setLanguage(language);
  await app.settle();
};

// What a user does: put text in the field without any app normalisation, then fire `input`.
function nativeValueSetter(input) {
  for (let proto = Object.getPrototypeOf(input); proto; proto = Object.getPrototypeOf(proto)) {
    const descriptor = Object.getOwnPropertyDescriptor(proto, 'value');
    if (descriptor?.set) return descriptor.set;
  }
  throw new Error('no native value setter');
}
async function typeText(selector, text, { commit = true } = {}) {
  const input = app.$(selector);
  nativeValueSetter(input).call(input, text);
  input.dispatchEvent(new app.window.Event('input', { bubbles: true }));
  if (commit) input.dispatchEvent(new app.window.Event('change', { bubbles: true }));
  await app.flush();
  return input;
}
const shownText = (selector) => {
  const input = app.$(selector);
  for (let proto = Object.getPrototypeOf(input); proto; proto = Object.getPrototypeOf(proto)) {
    const descriptor = Object.getOwnPropertyDescriptor(proto, 'value');
    if (descriptor?.get) return descriptor.get.call(input);
  }
  throw new Error('no native value getter');
};

test('parser: "." and "," both work as the decimal mark; groups and junk are handled', () => {
  for (const [text, expected] of [
    ['1.5', 1.5], ['1,5', 1.5], ['  2,50 ', 2.5], ['2.', 2], ['.5', 0.5], [',5', 0.5], ['100', 100],
    ['1,234.5', 1234.5], ['1.234,5', 1234.5], ['1,234,567', 1234567], ['1.234.567', 1234567],
    ['1 234,5', 1234.5], [`1 234,5`, 1234.5], ['-1,5', -1.5], ['−1.5', -1.5], ['+3', 3], ['0,0', 0],
    [`‎1.5`, 1.5],
  ]) assert.equal(parseLocaleNumber(text), expected, `parse ${JSON.stringify(text)}`);
  for (const text of ['', ' ', '.', ',', '-', 'abc', '1,2,3', '1.2.3', '12,34,567', '1,5.', '1e3', '1,5bb', '--1', null, undefined, Number.NaN]) {
    assert.ok(Number.isNaN(parseLocaleNumber(text)), `reject ${JSON.stringify(text)}`);
  }
  assert.equal(parseLocaleNumber(2.5), 2.5);
  assert.equal(Object.is(parseLocaleNumber('-0'), 0), true, 'negative zero is zero');
});

test('input formatter: app-language decimal mark, no grouping, no padding, unknown is empty', () => {
  assert.equal(formatLocaleInputNumber(1.5, 'en'), '1.5');
  assert.equal(formatLocaleInputNumber(1.5, 'ru'), '1,5');
  assert.equal(formatLocaleInputNumber(1.5, 'he'), '1.5');
  assert.equal(formatLocaleInputNumber(1234.5, 'ru'), '1234,5');
  assert.equal(formatLocaleInputNumber(100, 'ru'), '100');
  assert.equal(formatLocaleInputNumber('2,50', 'en'), '2.5');
  assert.equal(formatLocaleInputNumber(0.1 + 0.2, 'en'), '0.3');
  for (const unknown of ['', 'abc', null, undefined, Number.NaN]) assert.equal(formatLocaleInputNumber(unknown, 'en'), '');
});

test('every amount field in Analyze, Hand, Training and Personal Strategy is a decimal text field bound to the app language', () => {
  for (const id of AMOUNT_FIELD_IDS) {
    const input = app.byId(id);
    assert.ok(input, `${id} exists`);
    assert.equal(input.getAttribute('type'), 'text', `${id} is not a browser-locale number field`);
    assert.equal(input.getAttribute('inputmode'), 'decimal', `${id} asks for the decimal keypad`);
    assert.ok(input.hasAttribute('data-locale-number'), `${id} is bound`);
    assert.ok(app.window.RiverlineLocaleNumberInput, 'the page bridge is installed');
  }
});

test('the remaining number fields are counts, seeds and percentages or the exact-money Home Game fields', () => {
  // Left on type="number" on purpose (reported in the ticket): integers (counts, seeds, percentages)
  // and the exact-money Home Game fields.
  const allowed = new Set([
    'handTableSize', 'playersNum', 'trainingPlayersNum', 'equitySeed', 'trainingSeedInput', 'trainingOpponentSeed',
    'opponent-facingRaisePercent', 'opponent-freeAggressionPercent', 'opponent-largePriceCallPercent', 'opponent-smallPriceCallPercent',
    'homeGameAnte', 'homeGameBigBlind', 'homeGameInitialBuyIn', 'homeGameSmallBlind',
    'personalSetupTable',
  ]);
  const remaining = app.$$('input[type="number"]').map((input) => input.id).filter(Boolean);
  assert.deepEqual(remaining.filter((id) => !allowed.has(id)), [], 'no new browser-locale number field appeared');
  assert.deepEqual(remaining.filter((id) => AMOUNT_FIELD_IDS.includes(id)), [], 'no converted field went back to type="number"');
  for (const moneyId of ['homeGameAnte', 'homeGameBigBlind', 'homeGameInitialBuyIn', 'homeGameSmallBlind']) {
    assert.equal(app.byId(moneyId)?.getAttribute('type'), 'number', `${moneyId} remains a Home Game money field`);
  }
});

test('English app: typing "1,5" or "1.5" is the same value and is shown with a point', async () => {
  await setLanguage('en');
  const input = await typeText('#potSizeNum', '2,5');
  assert.equal(input.value, '2.5', 'readers see dot-decimal');
  assert.equal(shownText('#potSizeNum'), '2.5', 'English app shows a point after the field is committed');
  assert.equal(app.evaluate("sliderPairValue('potSize', 0)"), 2.5);
  await typeText('#potSizeNum', '3.25');
  assert.equal(app.evaluate("sliderPairValue('potSize', 0)"), 3.25);
});

test('Russian app: a point is accepted, the comma is shown, readers still get a dot', async () => {
  await setLanguage('ru');
  const input = await typeText('#potSizeNum', '2.5');
  assert.equal(input.value, '2.5');
  assert.equal(shownText('#potSizeNum'), '2,5');
  assert.equal(app.evaluate("sliderPairValue('potSize', 0)"), 2.5);
  const typed = await typeText('#facingSizeNum', '1,5');
  assert.equal(typed.value, '1.5');
  assert.equal(shownText('#facingSizeNum'), '1,5');
});

test('Hebrew app: both separators are accepted and the value is shown with a point', async () => {
  await setLanguage('he');
  const input = await typeText('#anteNum', '0,5');
  assert.equal(input.value, '0.5');
  assert.equal(shownText('#anteNum'), '0.5');
  assert.equal(app.evaluate("sliderPairValue('ante', 0)"), 0.5);
});

test('a language switch keeps the value and only changes how it is shown', async () => {
  await setLanguage('en');
  await typeText('#potSizeNum', '12.5');
  await typeText('#handStackBb', '99,5');
  await setLanguage('ru');
  assert.equal(shownText('#potSizeNum'), '12,5');
  assert.equal(shownText('#handStackBb'), '99,5');
  assert.equal(app.byId('potSizeNum').value, '12.5');
  assert.equal(app.byId('handStackBb').value, '99.5');
  await setLanguage('en');
  assert.equal(shownText('#potSizeNum'), '12.5');
  assert.equal(shownText('#handStackBb'), '99.5');
  assert.equal(app.byId('handStackBb').value, '99.5');
});

test('half-typed text stays visible while typing and unknown text never becomes zero', async () => {
  await setLanguage('en');
  const input = await typeText('#potSizeNum', '2,', { commit: false });
  assert.equal(shownText('#potSizeNum'), '2,', 'a field that is still being typed is not rewritten');
  assert.equal(input.value, '2', 'the draft already parses as 2');
  await typeText('#potSizeNum', 'abc');
  assert.equal(shownText('#potSizeNum'), 'abc', 'text that is not a number is left for the field to flag');
  assert.equal(input.value, 'abc', 'readers see the raw text, never 0');
  assert.ok(Number.isNaN(app.evaluate("sliderPairValue('potSize', 0)")), 'an incomplete field is non-finite, not zero');
  await typeText('#potSizeNum', '');
  assert.equal(input.value, '');
});

test('programmatic writes use dot-decimal and are shown in the app language', async () => {
  await setLanguage('ru');
  const input = app.byId('stackNum');
  input.value = '37.5';
  assert.equal(shownText('#stackNum'), '37,5');
  assert.equal(input.value, '37.5');
  input.value = 40;
  assert.equal(shownText('#stackNum'), '40');
  assert.equal(input.valueAsNumber, 40);
  await setLanguage('en');
});

test('pasted text in either convention is inserted as one number', async () => {
  await setLanguage('en');
  const input = app.byId('handAnteBb');
  nativeValueSetter(input).call(input, '');
  const paste = (text) => {
    const event = new app.window.Event('paste', { bubbles: true, cancelable: true });
    event.clipboardData = { getData: () => text };
    input.dispatchEvent(event);
    return event;
  };
  const first = paste('1,234.5');
  assert.equal(first.defaultPrevented, true);
  assert.equal(shownText('#handAnteBb'), '1234.5');
  nativeValueSetter(input).call(input, '');
  paste('0,75');
  assert.equal(input.value, '0.75');
  const junk = paste('bb 12');
  assert.equal(junk.defaultPrevented, false, 'text that is not a number is left to the browser');
  await setLanguage('ru');
  assert.equal(shownText('#handAnteBb'), '0,75');
  await setLanguage('en');
});

test('binding is idempotent and can be undone', () => {
  const input = app.document.createElement('input');
  input.type = 'number';
  input.value = '1.5';
  const first = bindLocaleNumberInput(input);
  assert.equal(bindLocaleNumberInput(input), first);
  assert.equal(input.getAttribute('type'), 'text');
  assert.equal(input.value, '1.5');
  first.dispose();
  assert.equal(Object.prototype.hasOwnProperty.call(input, 'value'), false);
});

test('Personal Strategy bb amount fields accept "." and "," across EN/RU/HE, support paste, and preserve values across language switches', async () => {
  await setLanguage('ru');
  app.byId('calibrationCreateFirstProfile').click();
  await app.flush();
  app.byId('calibrationProfileDisplayName').value = 'Setup Locale Test';
  await typeText('#personalSetupStack', '125,5');
  assert.equal(app.byId('personalSetupStack').value, '125.5');
  assert.equal(shownText('#personalSetupStack'), '125,5');
  await setLanguage('en');
  assert.equal(shownText('#personalSetupStack'), '125.5');
  assert.equal(app.byId('personalSetupStack').value, '125.5');
  await setLanguage('he');
  assert.equal(shownText('#personalSetupStack'), '125.5');
  await setLanguage('ru');
  assert.equal(shownText('#personalSetupStack'), '125,5');

  app.byId('calibrationProfileForm').dispatchEvent(new app.window.Event('submit', { bubbles: true, cancelable: true }));
  await app.settle();
  assert.equal(app.window.RiverlineRangeCalibration.getState().selection.context.effectiveStackBb, 125.5);
  assert.equal(shownText('#calibrationEffectiveStack'), '125,5');

  await typeText('#personalCollectionBb', '0,25');
  assert.equal(app.byId('personalCollectionBb').value, '0.25');
  assert.equal(shownText('#personalCollectionBb'), '0,25');
  assert.equal(app.window.RiverlineRangeCalibration.getState().selection.context.collectionBb, 0.25);

  app.byId('personalAnteType').value = 'big_blind';
  const anteInput = app.byId('personalAnteBb');
  nativeValueSetter(anteInput).call(anteInput, '');
  const pasteEvent = new app.window.Event('paste', { bubbles: true, cancelable: true });
  pasteEvent.clipboardData = { getData: () => '0.125' };
  anteInput.dispatchEvent(pasteEvent);
  anteInput.dispatchEvent(new app.window.Event('change', { bubbles: true }));
  await app.settle();
  assert.equal(pasteEvent.defaultPrevented, true);
  assert.equal(anteInput.value, '0.125');
  assert.equal(shownText('#personalAnteBb'), '0,125');
  assert.equal(app.window.RiverlineRangeCalibration.getState().selection.context.anteBb, 0.125);

  await setLanguage('en');
  assert.equal(shownText('#personalCollectionBb'), '0.25');
  assert.equal(shownText('#personalAnteBb'), '0.125');
  assert.equal(shownText('#calibrationEffectiveStack'), '125.5');
  await typeText('#calibrationEffectiveStack', '45,5');
  assert.equal(app.byId('calibrationEffectiveStack').value, '45.5');
  assert.equal(shownText('#calibrationEffectiveStack'), '45.5');
  assert.equal(app.window.RiverlineRangeCalibration.getState().selection.context.effectiveStackBb, 45.5);

  await setLanguage('he');
  await typeText('#personalCollectionBb', '0,5');
  assert.equal(app.byId('personalCollectionBb').value, '0.5');
  assert.equal(shownText('#personalCollectionBb'), '0.5');
  await setLanguage('ru');
  assert.equal(shownText('#personalCollectionBb'), '0,5');
  assert.equal(shownText('#calibrationEffectiveStack'), '45,5');
  await setLanguage('en');
});
