import {
  createGuestHomeViewModel,
  createHomeViewModelController,
} from './home-view-model.mjs';
import { createPersonalStrategyHomeQuery } from './personal-strategy-home-query.mjs';
import { createSavedStudyObjectOpenController } from './saved-study-object-open-controller.mjs';
import './saved-study-object-bootstrap.mjs';
import { RIVERLINE_OWNED_DOMAINS } from '../account-identity/index.mjs';
import { formatMinorUnits } from '../home-game/index.mjs';

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
  // HOME-001: the last game night, read lazily (the Game night bridge can
  // install after this one) and without touching which session it has open.
  const gameNightQueries = options.gameNightQueries ?? Object.freeze({
    async getLatest() {
      const bridge = browserWindow.RiverlineHomeGame;
      if (!bridge?.load) return null;
      const state = await bridge.load();
      const sessions = state?.recentSessions ?? [];
      const night = sessions.find((entry) => entry.status === 'active')
        ?? sessions.find((entry) => entry.status === 'completed');
      if (!night) return null;
      const bundle = state.current?.session?.sessionId === night.sessionId ? state.current : null;
      const settlement = bundle?.settlement ?? null;
      return {
        sessionId: night.sessionId,
        title: night.title,
        state: night.status === 'active' ? 'active' : 'completed',
        endedAt: night.endedAt ?? null,
        updatedAt: night.updatedAt ?? null,
        playerCount: night.participants?.length ?? 0,
        transferCount: settlement ? settlement.transfers.length : null,
        settledText: settlement && night.currency
          ? formatMinorUnits(settlement.totalTransferredMinor, night.currency)
          : null,
      };
    },
  });
  const personalStrategyQueries = options.personalStrategyQueries
    ?? createPersonalStrategyHomeQuery({
      storage: options.storage ?? browserWindow.localStorage,
      ...(accountQueries?.captureLifecycleScope ? {
        lifecycleScopeResolver: () => accountQueries.captureLifecycleScope(RIVERLINE_OWNED_DOMAINS.PERSONAL_STRATEGY),
      } : accountQueries?.getDomainOwnership ? {
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
    gameNightQueries,
    noticedQueries: options.noticedQueries ?? null,
  });
  const opener = createSavedStudyObjectOpenController({
    application: savedStudyQueries,
    playbookBridge,
  });
  const bridge = Object.freeze({
    schemaVersion: 'home-workspace/v1',
    async load() {
      const scope = await accountQueries?.captureLifecycleScope?.();
      await authentication?.ready?.();
      scope?.assertCurrent();
      if (scope) {
        const model = await home.load({ guest: scope.identityKind === 'device_guest' });
        scope.assertCurrent();
        return model;
      }
      const authenticationState = authentication?.getState?.();
      if (authenticationState?.status !== 'signed_in') {
        return createGuestHomeViewModel({
          continuation: await continuationQueries.getSummary(),
          nightAfter: await gameNightQueries.getLatest().catch(() => null),
        });
      }
      return home.load();
    },
    async openSavedItem(id) {
      const lifecycleScope = await accountQueries?.captureLifecycleScope?.();
      const result = await opener.open(id, { lifecycleScope });
      lifecycleScope?.assertCurrent();
      return result;
    },
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
