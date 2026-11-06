// LOCALE-NUMBERS-001: exposes the shared number formatter to the classic page
// scripts (logic.js, teacher.js, TableRenderer.js). Loaded before them.
// LOCALE-NUMBERS-003: also exposes the amount-entry binder and binds every
// [data-locale-number] field in the page before logic.js reads them.
import { createLocaleNumberFormatBridge } from './locale-number-format.mjs';
import { bindLocaleNumberInputs, createLocaleNumberInputBridge } from './locale-number-input.mjs';

const PERSONAL_STRATEGY_TEMPLATE_IDS = [
  'rangeCalibrationTemplate',
  'calibrationProfileModalTemplate',
];
const PERSONAL_STRATEGY_BB_INPUT_SELECTORS = [
  '#personalCollectionBb',
  '#personalAnteBb',
  '#calibrationEffectiveStack',
  '#personalSetupStack',
];

function markTemplateLocaleNumberInputs(doc) {
  for (const templateId of PERSONAL_STRATEGY_TEMPLATE_IDS) {
    const content = doc.getElementById?.(templateId)?.content;
    if (!content) continue;
    for (const selector of PERSONAL_STRATEGY_BB_INPUT_SELECTORS) {
      const input = content.querySelector?.(selector);
      if (!input) continue;
      input.type = 'text';
      input.setAttribute('inputmode', 'decimal');
      input.setAttribute('autocomplete', 'off');
      input.setAttribute('spellcheck', 'false');
      input.setAttribute('data-locale-number', '');
    }
  }
}

export function installLocaleNumberFormatBridge(browserWindow) {
  if (!browserWindow) return null;
  const bridge = createLocaleNumberFormatBridge();
  Object.defineProperty(browserWindow, 'RiverlineLocaleNumberFormat', {
    configurable: true,
    enumerable: false,
    value: bridge,
    writable: false,
  });
  Object.defineProperty(browserWindow, 'RiverlineLocaleNumberInput', {
    configurable: true,
    enumerable: false,
    value: createLocaleNumberInputBridge({ view: browserWindow }),
    writable: false,
  });
  if (browserWindow.document) {
    markTemplateLocaleNumberInputs(browserWindow.document);
    bindLocaleNumberInputs(browserWindow.document, { view: browserWindow });
  }
  return bridge;
}

if (typeof window !== 'undefined') installLocaleNumberFormatBridge(window);
