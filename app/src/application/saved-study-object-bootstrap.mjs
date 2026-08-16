import { createSavedStudyObjectApplication } from './saved-study-object-service.mjs';
import { createSavedStudyObjectSourceController } from './saved-study-object-source-controller.mjs';

export function installSavedStudyObjectBridge(browserWindow, options = {}) {
  if (!browserWindow) return null;
  const application = options.application ?? createSavedStudyObjectApplication();
  const controller = createSavedStudyObjectSourceController({
    application,
    storage: options.storage ?? browserWindow.localStorage,
    getPlaybookBridge: options.getPlaybookBridge ?? (() => browserWindow.RiverlinePlaybookState),
    clock: options.clock,
  });
  Object.defineProperty(browserWindow, 'RiverlineSavedStudyObjects', {
    configurable: true,
    enumerable: false,
    value: controller,
    writable: false,
  });
  return controller;
}

if (typeof window !== 'undefined') installSavedStudyObjectBridge(window);
