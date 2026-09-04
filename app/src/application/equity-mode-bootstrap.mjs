import { createEquityController } from './equity-controller.mjs';
import {
  EQUITY_RANDOMIZATION_REQUEST_VERSION,
  EQUITY_RANDOMIZATION_TARGETS,
  randomizeEquityInput,
} from './equity-input-randomization.mjs';

export function installEquityModeBridge(browserWindow, {
  controller = createEquityController(),
} = {}) {
  if (!browserWindow) return null;
  const bridge = Object.freeze({
    estimate(request) {
      return controller.estimate(request);
    },
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
    randomizationRequestVersion: EQUITY_RANDOMIZATION_REQUEST_VERSION,
    randomizationTargets: EQUITY_RANDOMIZATION_TARGETS,
    randomizeInput: randomizeEquityInput,
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
