import { createHomeViewModelController } from './home-view-model.mjs';
import { createPersonalStrategyHomeQuery } from './personal-strategy-home-query.mjs';
import { createSavedStudyObjectOpenController } from './saved-study-object-open-controller.mjs';

export function installHomeWorkspaceBridge(browserWindow, options = {}) {
  if (!browserWindow) return null;
  const savedStudyQueries = options.savedStudyQueries ?? browserWindow.RiverlineSavedStudyObjects;
  const personalStrategyQueries = options.personalStrategyQueries
    ?? createPersonalStrategyHomeQuery({ storage: options.storage ?? browserWindow.localStorage });
  const home = createHomeViewModelController({ savedStudyQueries, personalStrategyQueries });
  const opener = createSavedStudyObjectOpenController({
    application: savedStudyQueries,
    playbookBridge: options.playbookBridge ?? browserWindow.RiverlinePlaybookState,
  });
  const bridge = Object.freeze({
    schemaVersion: 'home-workspace/v1',
    load: () => home.load(),
    openSavedItem: (id) => opener.open(id),
  });
  Object.defineProperty(browserWindow, 'RiverlineHome', {
    configurable: true,
    enumerable: false,
    value: bridge,
    writable: false,
  });
  return bridge;
}

if (typeof window !== 'undefined') installHomeWorkspaceBridge(window);
