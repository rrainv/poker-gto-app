// LOCALE-NUMBERS-003: amount entry that follows the app language.
// <input type="number"> shows and parses numbers in the browser's locale, so a
// Russian browser prints "1,5" inside the English app. These fields are text
// inputs (inputmode="decimal") that accept "." and "," while typing or pasting
// and display the value in the app language (EN/HE "1.5", RU "1,5").
//
// Callers keep reading and writing `input.value` with plain dot-decimal text:
// the getter returns the canonical number text, the setter formats for display.
// Text that is not yet a number is returned as typed, so existing validators
// still see it as incomplete rather than as zero. Presentation only: no poker maths.
import { activeLocale, formatLocaleInputNumber, parseLocaleNumber } from './locale-number-format.mjs';

export const LOCALE_NUMBER_INPUT_SCHEMA_VERSION = 'locale-number-input/v1';
const BOUND = Symbol.for('riverline.localeNumberInput');
const ENTRY_CHARACTERS = /^[\d.,\s'’+\-−–‐‎‏؜]*$/;

function nativeValueDescriptor(input) {
  for (let prototype = Object.getPrototypeOf(input); prototype; prototype = Object.getPrototypeOf(prototype)) {
    const descriptor = Object.getOwnPropertyDescriptor(prototype, 'value');
    if (descriptor?.get && descriptor?.set) return descriptor;
  }
  return null;
}

export function bindLocaleNumberInput(input, { language = () => undefined, fractionDigits = 6, view = globalThis } = {}) {
  if (!input) return null;
  if (input[BOUND]) return input[BOUND];
  const native = nativeValueDescriptor(input);
  if (!native) return null;
  const readDisplay = () => String(native.get.call(input) ?? '');
  const writeDisplay = (text) => { native.set.call(input, text); };
  const locale = () => activeLocale(language());
  const display = (number) => formatLocaleInputNumber(number, locale(), fractionDigits);

  input.type = 'text';
  input.setAttribute('inputmode', 'decimal');
  input.setAttribute('autocomplete', 'off');
  input.setAttribute('spellcheck', 'false');
  input.setAttribute('data-locale-number', '');

  const canonical = () => {
    const text = readDisplay();
    const number = parseLocaleNumber(text);
    if (Number.isFinite(number)) return String(number);
    return text.trim() === '' ? '' : text;
  };
  Object.defineProperty(input, 'value', {
    configurable: true,
    get: canonical,
    set(next) {
      const text = next === null || next === undefined ? '' : String(next);
      const number = parseLocaleNumber(text);
      writeDisplay(Number.isFinite(number) ? display(number) : text);
    },
  });
  Object.defineProperty(input, 'valueAsNumber', {
    configurable: true,
    get: () => parseLocaleNumber(readDisplay()),
    set(next) { writeDisplay(Number.isFinite(next) ? display(next) : ''); },
  });

  // Complete text is rewritten in the app language once the user leaves the field
  // or the language changes; half-typed text ("2,", "abc") is never touched.
  const normalize = () => {
    const number = parseLocaleNumber(readDisplay());
    if (!Number.isFinite(number)) return;
    const text = display(number);
    if (text !== readDisplay()) writeDisplay(text);
  };
  const onPaste = (event) => {
    const pasted = event.clipboardData?.getData?.('text');
    if (typeof pasted !== 'string' || !ENTRY_CHARACTERS.test(pasted)) return;
    const number = parseLocaleNumber(pasted);
    if (!Number.isFinite(number)) return;
    event.preventDefault();
    const text = display(number);
    const start = input.selectionStart ?? readDisplay().length;
    const end = input.selectionEnd ?? start;
    const current = readDisplay();
    writeDisplay(current.slice(0, start) + text + current.slice(end));
    const caret = start + text.length;
    input.setSelectionRange?.(caret, caret);
    input.dispatchEvent(new (view.Event || globalThis.Event)('input', { bubbles: true }));
  };
  const onLanguage = () => normalize();
  input.addEventListener('change', normalize);
  input.addEventListener('blur', normalize);
  input.addEventListener('paste', onPaste);
  view.addEventListener?.('riverline:languagechange', onLanguage);
  normalize();

  const controller = Object.freeze({
    schemaVersion: LOCALE_NUMBER_INPUT_SCHEMA_VERSION,
    refresh: normalize,
    dispose() {
      input.removeEventListener('change', normalize);
      input.removeEventListener('blur', normalize);
      input.removeEventListener('paste', onPaste);
      view.removeEventListener?.('riverline:languagechange', onLanguage);
      delete input.value;
      delete input.valueAsNumber;
      delete input[BOUND];
    },
  });
  Object.defineProperty(input, BOUND, { configurable: true, value: controller });
  return controller;
}

export function bindLocaleNumberInputs(root, options) {
  return [...(root?.querySelectorAll?.('[data-locale-number]') ?? [])]
    .map((input) => bindLocaleNumberInput(input, options))
    .filter(Boolean);
}

export function createLocaleNumberInputBridge(options = {}) {
  return Object.freeze({
    schemaVersion: LOCALE_NUMBER_INPUT_SCHEMA_VERSION,
    bind: (input, overrides) => bindLocaleNumberInput(input, { ...options, ...overrides }),
    bindAll: (root, overrides) => bindLocaleNumberInputs(root, { ...options, ...overrides }),
  });
}
