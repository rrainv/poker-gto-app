import {
  createGuestHomeViewModel,
  createHomeViewModelController,
} from './home-view-model.mjs';
import { createPersonalStrategyHomeQuery } from './personal-strategy-home-query.mjs';
import { createSavedStudyObjectOpenController } from './saved-study-object-open-controller.mjs';
import './saved-study-object-bootstrap.mjs';
import { RIVERLINE_OWNED_DOMAINS } from '../account-identity/index.mjs';

export function installHomeWorkspaceBridge(browserWindow, options = {}) {
  if (!browserWindow) return null;
  const savedStudyQueries = options.savedStudyQueries ?? browserWindow.RiverlineSavedStudyObjects;
  const accountQueries = options.accountQueries ?? browserWindow.RiverlineAccountIdentity ?? null;
  const authentication = options.authentication ?? browserWindow.RiverlineAuthentication ?? null;
  const playbookBridge = options.playbookBridge ?? browserWindow.RiverlinePlaybookState;
  const profileQueries = options.profileQueries ?? (authentication ? Object.freeze({
    async getProfileSummary() {
      await authentication.ready?.();
      const state = authentication.getState?.();
      if (state?.status !== 'signed_in' || !state.profile) return null;
      return Object.freeze({
        schemaVersion: 'home-account-identity/v1',
        displayName: state.profile.displayName,
        username: state.profile.username,
      });
    },
  }) : null);
  const syncQueries = options.syncQueries ?? Object.freeze({
    getState: () => browserWindow.RiverlineStudySync?.getState?.() ?? null,
  });
  const continuationQueries = options.continuationQueries ?? Object.freeze({
    getSummary: () => Object.freeze({
      hasLiveHand: Boolean(playbookBridge?.hasLiveHand?.()),
    }),
  });
  const personalStrategyQueries = options.personalStrategyQueries
    ?? createPersonalStrategyHomeQuery({
      storage: options.storage ?? browserWindow.localStorage,
      ...(accountQueries?.getDomainOwnership ? {
        ownershipResolver: () => accountQueries.getDomainOwnership(
          RIVERLINE_OWNED_DOMAINS.PERSONAL_STRATEGY,
        ),
      } : {}),
    });
  const home = createHomeViewModelController({
    savedStudyQueries,
    personalStrategyQueries,
    accountQueries,
    profileQueries,
    syncQueries,
    continuationQueries,
  });
  const opener = createSavedStudyObjectOpenController({
    application: savedStudyQueries,
    playbookBridge,
  });
  const bridge = Object.freeze({
    schemaVersion: 'home-workspace/v1',
    async load() {
      await authentication?.ready?.();
      const authenticationState = authentication?.getState?.();
      if (authenticationState?.status !== 'signed_in') {
        return createGuestHomeViewModel({
          continuation: await continuationQueries.getSummary(),
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
