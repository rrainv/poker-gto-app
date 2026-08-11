import { createTrainingSessionController } from './training-session-controller.mjs';
import { createTrainingPresentationModel } from './training-presentation.mjs';

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

export function installTrainingPresentationBridge(browserWindow) {
  if (!browserWindow) return null;
  const bridge = Object.freeze({
    createViewModel(exercise) {
      return createTrainingPresentationModel(exercise);
    },
  });
  Object.defineProperty(browserWindow, 'RiverlineTrainingPresentation', {
    configurable: true,
    enumerable: false,
    value: bridge,
    writable: false,
  });
  return bridge;
}

if (typeof window !== 'undefined') {
  installTrainingModeBridge(window);
  installTrainingPresentationBridge(window);
}
