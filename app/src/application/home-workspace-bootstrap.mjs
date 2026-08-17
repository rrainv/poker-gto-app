import { createHomeViewModelController } from './home-view-model.mjs';
import { createPersonalStrategyHomeQuery } from './personal-strategy-home-query.mjs';
import { createSavedStudyObjectOpenController } from './saved-study-object-open-controller.mjs';
import './saved-study-object-bootstrap.mjs';
import { RIVERLINE_OWNED_DOMAINS } from '../account-identity/index.mjs';

export function installHomeWorkspaceBridge(browserWindow, options = {}) {
  if (!browserWindow) return null;
  const savedStudyQueries = options.savedStudyQueries ?? browserWindow.RiverlineSavedStudyObjects;
  const accountQueries = options.accountQueries ?? browserWindow.RiverlineAccountIdentity ?? null;
  const personalStrategyQueries = options.personalStrategyQueries
    ?? createPersonalStrategyHomeQuery({
      storage: options.storage ?? browserWindow.localStorage,
      ...(accountQueries?.getDomainOwnership ? {
        ownershipResolver: () => accountQueries.getDomainOwnership(
          RIVERLINE_OWNED_DOMAINS.PERSONAL_STRATEGY,
        ),
      } : {}),
    });
  const home = createHomeViewModelController({ savedStudyQueries, personalStrategyQueries, accountQueries });
  const opener = createSavedStudyObjectOpenController({
    application: savedStudyQueries,
    playbookBridge: options.playbookBridge ?? browserWindow.RiverlinePlaybookState,
  });
  const bridge = Object.freeze({
    schemaVersion: 'home-workspace/v1',
    async load() {
      await browserWindow.RiverlineAuthentication?.ready?.();
      const authentication = browserWindow.RiverlineAuthentication?.getState?.();
      if (authentication?.status !== 'signed_in') {
        return Object.freeze({
          schemaVersion: 'home-view-model/v2',
          sessionMode: 'guest',
          identity: { status: 'guest', profile: null },
          sections: {
            continue: { status: 'unavailable', items: [] },
            recent: { status: 'unavailable', items: [] },
            review: {
              status: 'unavailable',
              reviewLater: { status: 'unavailable', items: [] },
              mistakes: { status: 'unavailable', items: [] },
            },
            personalStrategy: { status: 'unavailable' },
            quickStart: {
              status: 'ready',
              destinations: ['gto', 'training', 'equity'],
            },
          },
        });
      }
      return home.load();
    },
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
