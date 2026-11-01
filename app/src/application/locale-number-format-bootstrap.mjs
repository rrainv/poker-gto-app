// LOCALE-NUMBERS-001: exposes the shared number formatter to the classic page
// scripts (logic.js, teacher.js, TableRenderer.js). Loaded before them.
// LOCALE-NUMBERS-003: also exposes the amount-entry binder and binds every
// [data-locale-number] field in the page before logic.js reads them.
import { createLocaleNumberFormatBridge } from './locale-number-format.mjs';
import { bindLocaleNumberInputs, createLocaleNumberInputBridge } from './locale-number-input.mjs';

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
  if (browserWindow.document) bindLocaleNumberInputs(browserWindow.document, { view: browserWindow });
  return bridge;
}

if (typeof window !== 'undefined') installLocaleNumberFormatBridge(window);
