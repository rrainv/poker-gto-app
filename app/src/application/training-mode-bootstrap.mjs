import { createTrainingSessionController } from './training-session-controller.mjs';

export function installTrainingModeBridge(browserWindow, {
  controller = createTrainingSessionController(),
} = {}) {
  if (!browserWindow) return null;
  const bridge = Object.freeze({
    generate(config, options) {
      return controller.generate(config, options);
    },
    answer(exerciseId, chosenActionType) {
      return controller.answer(exerciseId, chosenActionType);
    },
    getSnapshot() {
      return controller.getSnapshot();
    },
    reset() {
      return controller.reset();
    },
  });
  Object.defineProperty(browserWindow, 'RiverlineTraining', {
    configurable: true,
    enumerable: false,
    value: bridge,
    writable: false,
  });
  return bridge;
}

if (typeof window !== 'undefined') installTrainingModeBridge(window);
