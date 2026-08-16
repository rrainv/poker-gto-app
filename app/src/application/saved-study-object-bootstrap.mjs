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
  const bridge = Object.freeze({
    ...controller,
    getById: (...args) => application.getById(...args),
    listRecent: (...args) => application.listRecent(...args),
    listForReview: (...args) => application.listForReview(...args),
    listMistakes: (...args) => application.listMistakes(...args),
  });
  Object.defineProperty(browserWindow, 'RiverlineSavedStudyObjects', {
    configurable: true,
    enumerable: false,
    value: bridge,
    writable: false,
  });
  return bridge;
}

if (typeof window !== 'undefined') installSavedStudyObjectBridge(window);
