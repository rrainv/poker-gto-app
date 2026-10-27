// LOCALE-NUMBERS-001: exposes the shared number formatter to the classic page
// scripts (logic.js, teacher.js, TableRenderer.js). Loaded before them.
import { createLocaleNumberFormatBridge } from './locale-number-format.mjs';

export function installLocaleNumberFormatBridge(browserWindow) {
  if (!browserWindow) return null;
  const bridge = createLocaleNumberFormatBridge();
  Object.defineProperty(browserWindow, 'RiverlineLocaleNumberFormat', {
    configurable: true,
    enumerable: false,
    value: bridge,
    writable: false,
  });
  return bridge;
}

if (typeof window !== 'undefined') installLocaleNumberFormatBridge(window);
