import { createTrainingSessionController } from './training-session-controller.mjs';
import {
  createTrainingConfigFromLegacyCompatibility,
  resolveTrainingRulesCapability,
} from './training-generator.mjs';
import { createTrainingPresentationModel } from './training-presentation.mjs';
import { createTrainingSessionIntent } from './training-practice-planner.mjs';

export function installTrainingModeBridge(browserWindow, {
  controller = createTrainingSessionController(),
} = {}) {
  if (!browserWindow) return null;
  const bridge = Object.freeze({
    createConfigFromLegacyCompatibility(input) {
      return createTrainingConfigFromLegacyCompatibility(input);
    },
    generate(config, options) {
      return controller.generate(config, options);
    },
    replay(config, options) {
      return controller.replay(config, options);
    },
    createPracticeIntent(input) {
      return createTrainingSessionIntent(input);
    },
    resolveRulesCapability(rulesSnapshot) {
      return resolveTrainingRulesCapability(rulesSnapshot);
    },
    startPracticeSession(intent) {
      return controller.startPracticeSession(intent);
    },
    generatePlanned(options) {
      return controller.generatePlanned(options);
    },
    getPracticePlannerState() {
      return controller.getPracticePlannerState();
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
