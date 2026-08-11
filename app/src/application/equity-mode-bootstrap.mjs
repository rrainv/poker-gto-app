import { createEquityController } from './equity-controller.mjs';

export function installEquityModeBridge(browserWindow, {
  controller = createEquityController(),
} = {}) {
  if (!browserWindow) return null;
  const bridge = Object.freeze({
    calculate(request, options) {
      return controller.calculate(request, options);
    },
    cancel() {
      return controller.cancel();
    },
    getCurrentRequestId() {
      return controller.getCurrentRequestId();
    },
    isWorkerBacked() {
      return controller.isWorkerBacked();
    },
  });
  Object.defineProperty(browserWindow, 'RiverlineEquity', {
    configurable: true,
    enumerable: false,
    value: bridge,
    writable: false,
  });
  return bridge;
}

if (typeof window !== 'undefined') installEquityModeBridge(window);
