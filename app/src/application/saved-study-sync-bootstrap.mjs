import {
  getRiverlineSupabaseBrowserClient,
  resolveRiverlineAuthConfig,
} from '../authentication/index.mjs';
import {
  PERSONAL_STRATEGY_SYNC_DOMAIN,
  SYNC_UI_STATES,
  createIndexedDbSyncDatabase,
  createPersonalStrategySyncAdapter,
  createRangeCalibrationSyncAdapter,
  createSavedStudySyncDomainAdapter,
  createSupabaseRemoteSyncAdapter,
  createSyncCoordinator,
  createSyncRepository,
} from '../sync/index.mjs';
import { RIVERLINE_OWNED_DOMAINS } from '../account-identity/index.mjs';
import { createPersonalStrategySyncPort } from './personal-strategy-sync-port.mjs';
import './authentication-bootstrap.mjs';
import './saved-study-object-bootstrap.mjs';

export const PERSONAL_STRATEGY_SYNC_UPGRADE_MESSAGE = 'Personal Strategy is saved locally. Cloud sync needs a compatible server version.';
const PERSONAL_STRATEGY_LOCAL_SUMMARY = '{profiles} setups, {observations} direct observations, and {sessions} active teaching sessions are saved on this device.';

function translated(key, parameters = undefined) {
  return globalThis.t?.(key, parameters) ?? key.replace(/\{([^}]+)\}/g, (token, name) => (
    parameters?.[name] === undefined ? token : String(parameters[name])
  ));
}

function setTranslatedText(element, key, parameters = undefined) {
  if (!element) return;
  element.dataset.i18n = key;
  element.textContent = translated(key, parameters);
}

function focusableIn(element) {
  return [...element.querySelectorAll(
    'button:not(:disabled), input:not(:disabled), [tabindex]:not([tabindex="-1"])',
  )].filter((entry) => !entry.hidden && !entry.closest('[hidden]') && entry.getClientRects().length > 0);
}

function unavailableRemoteAdapter() {
  const fail = () => {
    const error = new Error('Saved study sync is not configured');
    error.code = 'remote_not_configured';
    error.kind = 'permanent';
    return Promise.reject(error);
  };
  return Object.freeze({ pushOperation: fail, pullChanges: fail });
}

export function createStudySyncAggregate(savedCoordinator, strategyCoordinator, strategyPort) {
  const listeners = new Set();
  let state = null;
  const rank = Object.freeze({
    [SYNC_UI_STATES.CONFLICT]: 8,
    [SYNC_UI_STATES.ERROR]: 7,
    [SYNC_UI_STATES.AUTH_PAUSED]: 6,
    [SYNC_UI_STATES.OFFLINE]: 5,
    [SYNC_UI_STATES.SYNCING]: 4,
    [SYNC_UI_STATES.SAVED_LOCALLY]: 3,
    [SYNC_UI_STATES.SYNCED]: 2,
    [SYNC_UI_STATES.DISABLED]: 1,
  });

  function publish() {
    const saved = savedCoordinator.getState();
    const strategy = strategyCoordinator.getState();
    const enabledStates = [saved, strategy].filter((entry) => entry.enabled);
    const selected = (enabledStates.length ? enabledStates : [saved, strategy])
      .sort((left, right) => (rank[right.state] ?? 0) - (rank[left.state] ?? 0))[0];
    state = Object.freeze({
      schemaVersion: 'riverline-study-sync-status/v1',
      state: selected.state,
      enabled: saved.enabled || strategy.enabled,
      decided: saved.decided && strategy.decided,
      pendingCount: saved.pendingCount + strategy.pendingCount,
      conflictCount: saved.conflictCount + strategy.conflictCount,
      errorCount: saved.errorCount + strategy.errorCount,
      saved,
      strategy,
    });
    for (const listener of listeners) listener(state);
    return state;
  }
  savedCoordinator.subscribe(publish);
  strategyCoordinator.subscribe(publish);
  publish();
  return Object.freeze({
    getState: () => state,
    getEnableSummary: () => savedCoordinator.getEnableSummary(),
    async getStrategyEnableSummary() {
      const summary = await strategyPort.getSummary();
      try {
        await strategyPort.assertCompatible?.();
        return Object.freeze({ ...summary, cloudSyncCompatible: true });
      } catch (error) {
        if (error?.code !== 'unsupported_schema') throw error;
        return Object.freeze({ ...summary, cloudSyncCompatible: false });
      }
    },
    enable: () => savedCoordinator.enable(),
    disable: () => savedCoordinator.disable(),
    enableStrategy: () => strategyCoordinator.enable(),
    disableStrategy: () => strategyCoordinator.disable(),
    async syncNow() {
      await strategyCoordinator.syncNow();
      await savedCoordinator.syncNow();
      return publish();
    },
    async listConflicts() {
      const [saved, strategy] = await Promise.all([
        savedCoordinator.listConflicts(), strategyCoordinator.listConflicts(),
      ]);
      return [
        ...saved.map((entry) => ({ ...entry, syncDomain: 'saved_study_objects' })),
        ...strategy.map((entry) => ({ ...entry, syncDomain: PERSONAL_STRATEGY_SYNC_DOMAIN })),
      ];
    },
    resolveConflict(objectId, choice, domain = 'saved_study_objects') {
      return domain === PERSONAL_STRATEGY_SYNC_DOMAIN
        ? strategyCoordinator.resolveConflict(objectId, choice)
        : savedCoordinator.resolveConflict(objectId, choice);
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  });
}

export function bindSyncUi(browserWindow, coordinator) {
  const document = browserWindow.document;
  const conflictModal = document.querySelector('#syncConflictModal');
  let conflictFocus = null;
  let currentConflict = null;
  let dismissedConflictId = null;
  let summarySequence = 0;
  let identityUiGeneration = 0;
  let strategyUpgradeRequired = null;
  setTranslatedText(document.querySelector('#accountStrategySyncItemSummary'), 'Saved locally');

  const statusKeys = Object.freeze({
    [SYNC_UI_STATES.DISABLED]: 'Saved locally',
    [SYNC_UI_STATES.SAVED_LOCALLY]: 'Saved locally',
    [SYNC_UI_STATES.SYNCING]: 'Syncing…',
    [SYNC_UI_STATES.SYNCED]: 'Synced',
    [SYNC_UI_STATES.OFFLINE]: 'Offline — will sync later',
    [SYNC_UI_STATES.ERROR]: 'Sync error',
    [SYNC_UI_STATES.CONFLICT]: 'Conflict',
    [SYNC_UI_STATES.AUTH_PAUSED]: 'Sync error',
  });

  function closeConflict({ restoreFocus = true, dismissed = true } = {}) {
    if (!conflictModal || conflictModal.hidden) return;
    if (dismissed) dismissedConflictId = currentConflict?.objectId ?? dismissedConflictId;
    conflictModal.hidden = true;
    conflictModal.classList.remove('show');
    if (document.querySelector('#accountProfileModal')?.hidden !== false) {
      document.body.classList.remove('modal-open');
    }
    if (restoreFocus) conflictFocus?.focus?.({ preventScroll: true });
    conflictFocus = null;
  }

  async function openFirstConflict({ force = false } = {}) {
    const sequence = summarySequence;
    const [conflict] = await coordinator.listConflicts();
    if (sequence !== summarySequence || !conflict || (!force && conflict.objectId === dismissedConflictId)) return;
    currentConflict = conflict;
    conflictFocus = document.activeElement;
    const title = conflict.localObject?.annotations?.title
      ?? conflict.remoteObject?.annotations?.title
      ?? conflict.localObject?.profile?.displayName
      ?? conflict.remoteObject?.payload?.profile?.displayName
      ?? conflict.objectId;
    document.querySelector('#syncConflictObjectTitle').textContent = title;
    const strategyConflict = conflict.syncDomain === PERSONAL_STRATEGY_SYNC_DOMAIN;
    setTranslatedText(
      document.querySelector('#syncConflictDescription'),
      strategyConflict
        ? 'This profile or mode was changed differently on another device. Choose which metadata to keep; strategic evidence is preserved separately.'
        : 'This saved item changed on another device. Choose which version to preserve; Riverline will not discard one silently.',
    );
    document.querySelector('#syncConflictKeepBoth').hidden = strategyConflict;
    document.querySelector('#syncConflictStatus').textContent = '';
    conflictModal.hidden = false;
    conflictModal.classList.add('show');
    document.body.classList.add('modal-open');
    browserWindow.RiverlineI18n?.translateNode?.(conflictModal);
    browserWindow.requestAnimationFrame(() => document.querySelector('#syncConflictKeepDevice')?.focus());
  }

  function setBusy(busy) {
    for (const control of document.querySelectorAll(
      '#accountSyncEnable, #accountSyncNotNow, #accountSyncToggle, #accountStrategySyncEnable, #accountStrategySyncNotNow, #accountStrategySyncToggle, #accountSyncNow, #accountMenuSyncNow',
    )) control.disabled = busy;
  }

  async function updateInitialSummary(state) {
    if (browserWindow.RiverlineAuthentication?.getState?.().status !== 'signed_in') return;
    if (strategyUpgradeRequired !== null && ((state.saved.decided && state.strategy.decided)
      || document.querySelector('#accountProfileModal')?.hidden !== false)) return;
    const sequence = ++summarySequence;
    let summary;
    let strategySummary;
    try {
      [summary, strategySummary] = await Promise.all([
        coordinator.getEnableSummary(), coordinator.getStrategyEnableSummary(),
      ]);
    } catch { return; }
    if (sequence !== summarySequence) return;
    strategyUpgradeRequired = strategySummary.cloudSyncCompatible === false;
    setTranslatedText(
      document.querySelector('#accountSyncItemSummary'),
      '{count} items on this device will be synced.',
      { count: summary.itemCount },
    );
    setTranslatedText(
      document.querySelector('#accountStrategySyncItemSummary'),
      strategyUpgradeRequired ? PERSONAL_STRATEGY_SYNC_UPGRADE_MESSAGE : PERSONAL_STRATEGY_LOCAL_SUMMARY,
      {
        profiles: strategySummary.profileCount,
        observations: strategySummary.directObservationCount,
        sessions: strategySummary.activeSessionCount,
      },
    );
    renderStrategyAvailability(coordinator.getState());
  }

  function renderStrategyAvailability(state) {
    const message = strategyUpgradeRequired
      ? PERSONAL_STRATEGY_SYNC_UPGRADE_MESSAGE
      : 'Inference is recomputed locally from synced evidence. Generic Training history is not synced.';
    setTranslatedText(document.querySelector('#accountStrategySyncConsequence'), message);
    if (!strategyUpgradeRequired) return;
    setTranslatedText(document.querySelector('#accountStrategySyncItemSummary'), message);
    document.querySelector('#accountStrategySyncEnable').disabled = true;
    document.querySelector('#accountStrategySyncToggle').disabled = !state.strategy.enabled;
    setTranslatedText(document.querySelector('#settingsSyncDescription'), message);
    if (state.strategy.enabled && state.strategy.state === SYNC_UI_STATES.ERROR) {
      setTranslatedText(document.querySelector('#accountSyncStatus')?.querySelector('span'), message);
    }
  }

  function render(state) {
    const signedIn = browserWindow.RiverlineAuthentication?.getState?.().status === 'signed_in';
    const statusKey = statusKeys[state.state] ?? 'Saved locally';
    const menuStatus = document.querySelector('#accountMenuSyncStatus');
    const panelStatus = document.querySelector('#accountSyncStatus');
    const badge = document.querySelector('#accountSyncStateBadge');
    for (const element of [menuStatus, panelStatus]) {
      if (!element) continue;
      element.dataset.syncState = state.state;
      setTranslatedText(element.querySelector('span'), statusKey);
    }
    menuStatus.hidden = !signedIn;
    setTranslatedText(badge, statusKey);
    badge.classList.toggle('status-badge--available', state.state === SYNC_UI_STATES.SYNCED);
    badge.classList.toggle('status-badge--error', [SYNC_UI_STATES.ERROR, SYNC_UI_STATES.CONFLICT].includes(state.state));
    badge.classList.toggle('status-badge--neutral', ![
      SYNC_UI_STATES.SYNCED, SYNC_UI_STATES.ERROR, SYNC_UI_STATES.CONFLICT,
    ].includes(state.state));

    document.querySelector('#accountSyncOptIn').hidden = state.saved.decided;
    document.querySelector('#accountSyncToggleRow').hidden = !state.saved.decided;
    document.querySelector('#accountSyncToggle').checked = state.saved.enabled;
    document.querySelector('#accountStrategySyncOptIn').hidden = state.strategy.decided;
    document.querySelector('#accountStrategySyncToggleRow').hidden = !state.strategy.decided;
    document.querySelector('#accountStrategySyncToggle').checked = state.strategy.enabled;
    document.querySelector('#accountSyncNow').disabled = !state.enabled || state.state === SYNC_UI_STATES.SYNCING;
    const menuAction = document.querySelector('#accountMenuSyncNow');
    menuAction.hidden = !signedIn || !state.enabled;
    setTranslatedText(menuAction, state.state === SYNC_UI_STATES.CONFLICT ? 'Conflict' : 'Sync now');
    const settingsHeading = document.querySelector('#settingsSyncHeading');
    const settingsDescription = document.querySelector('#settingsSyncDescription');
    setTranslatedText(
      settingsHeading,
      state.enabled ? 'Cloud study sync is enabled' : 'Cloud sync is not enabled',
    );
    setTranslatedText(
      settingsDescription,
      state.enabled
        ? 'Enabled study domains sync across signed-in devices. Each domain remains local-first and can be turned off separately.'
        : 'Study data is still stored locally. Signing in does not create a cloud backup.',
    );
    if (signedIn) {
      setTranslatedText(
        document.querySelector('#settingsAccountDescription'),
        state.enabled
          ? 'Enabled study domains sync across signed-in devices. Each domain remains local-first and can be turned off separately.'
          : 'Study data is separated by this account on this device. Cloud sync is not enabled.',
      );
    }
    setBusy(state.state === SYNC_UI_STATES.SYNCING);
    renderStrategyAvailability(state);
    void updateInitialSummary(state);
    if (state.state === SYNC_UI_STATES.CONFLICT) void openFirstConflict();
  }

  async function manualSync() {
    if (coordinator.getState().state === SYNC_UI_STATES.CONFLICT) {
      await openFirstConflict({ force: true });
      return;
    }
    await coordinator.syncNow();
  }

  async function changeStrategySync(enabled) {
    const identityGeneration = identityUiGeneration;
    try {
      await (enabled ? coordinator.enableStrategy() : coordinator.disableStrategy());
    } catch (error) {
      if (identityGeneration !== identityUiGeneration
        || browserWindow.RiverlineAuthentication?.getState?.().status !== 'signed_in') return;
      if (error?.code === 'unsupported_schema') strategyUpgradeRequired = true;
      renderStrategyAvailability(coordinator.getState());
      if (!strategyUpgradeRequired) setTranslatedText(
        document.querySelector('#accountSyncStatus')?.querySelector('span'), 'Sync error',
      );
    }
  }

  document.querySelector('#accountSyncEnable')?.addEventListener('click', () => void coordinator.enable());
  document.querySelector('#accountSyncNotNow')?.addEventListener('click', () => void coordinator.disable());
  document.querySelector('#accountSyncToggle')?.addEventListener('change', (event) => {
    void (event.currentTarget.checked ? coordinator.enable() : coordinator.disable());
  });
  document.querySelector('#accountStrategySyncEnable')?.addEventListener('click', () => void changeStrategySync(true));
  document.querySelector('#accountStrategySyncNotNow')?.addEventListener('click', () => void changeStrategySync(false));
  document.querySelector('#accountStrategySyncToggle')?.addEventListener('change', (event) => {
    void changeStrategySync(event.currentTarget.checked);
  });
  document.querySelector('#accountSyncNow')?.addEventListener('click', () => void manualSync());
  document.querySelector('#accountMenuSyncNow')?.addEventListener('click', () => void manualSync());
  document.addEventListener('click', (event) => {
    if (!event.target.closest('#accountMenuOpenProfile, #settingsOpenAccount, #homeGuestSignIn')) return;
    browserWindow.queueMicrotask(() => void updateInitialSummary(coordinator.getState()));
  });
  browserWindow.addEventListener('riverline:openaccount', () => {
    browserWindow.queueMicrotask(() => void updateInitialSummary(coordinator.getState()));
  });
  document.querySelector('#syncConflictClose')?.addEventListener('click', () => closeConflict());
  conflictModal?.addEventListener('click', (event) => {
    if (event.target === conflictModal) closeConflict();
  });
  for (const control of conflictModal?.querySelectorAll('[data-choice]') ?? []) {
    control.addEventListener('click', async () => {
      if (!currentConflict) return;
      const sequence = summarySequence;
      for (const button of conflictModal.querySelectorAll('button')) button.disabled = true;
      setTranslatedText(document.querySelector('#syncConflictStatus'), 'Resolving conflict…');
      try {
        await coordinator.resolveConflict(
          currentConflict.objectId, control.dataset.choice, currentConflict.syncDomain,
        );
        if (sequence !== summarySequence) return;
        dismissedConflictId = null;
        closeConflict({ dismissed: false });
        currentConflict = null;
        await openFirstConflict();
      } catch {
        if (sequence !== summarySequence) return;
        setTranslatedText(document.querySelector('#syncConflictStatus'), 'Sync error');
      } finally {
        if (sequence === summarySequence) {
          for (const button of conflictModal.querySelectorAll('button')) button.disabled = false;
        }
      }
    });
  }
  document.addEventListener('keydown', (event) => {
    if (!conflictModal || conflictModal.hidden) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      closeConflict();
      return;
    }
    if (event.key !== 'Tab') return;
    const focusable = focusableIn(conflictModal);
    const first = focusable[0];
    const last = focusable.at(-1);
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault(); last?.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault(); first?.focus();
    }
  });
  browserWindow.addEventListener('riverline:identitychange', () => {
    summarySequence += 1;
    identityUiGeneration += 1;
    strategyUpgradeRequired = null;
    closeConflict({ restoreFocus: false, dismissed: false });
    currentConflict = null;
    dismissedConflictId = null;
    for (const button of conflictModal?.querySelectorAll('button') ?? []) button.disabled = false;
    const title = document.querySelector('#syncConflictObjectTitle');
    if (title) title.textContent = '';
  });
  browserWindow.addEventListener('riverline:languagechange', () => render(coordinator.getState()));
  browserWindow.addEventListener('online', () => void coordinator.syncNow());
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && coordinator.getState().enabled) {
      void coordinator.syncNow();
    }
  });
  coordinator.subscribe((state) => {
    render(state);
    browserWindow.dispatchEvent(new CustomEvent('riverline:studysyncchange', {
      detail: {
        state: state.state,
        pendingCount: state.pendingCount,
        conflictCount: state.conflictCount,
      },
    }));
  });
  render(coordinator.getState());
}

export async function installSavedStudySyncBridge(browserWindow, options = {}) {
  if (!browserWindow?.RiverlineAuthentication || !browserWindow?.RiverlineSavedStudyObjects) return null;
  const config = options.config ?? await resolveRiverlineAuthConfig(browserWindow);
  let client = options.client ?? null;
  let remoteAdapter = options.remoteAdapter ?? null;
  if (!remoteAdapter && config) {
    try {
      client ??= getRiverlineSupabaseBrowserClient({
        browserWindow,
        config,
        clientFactory: options.clientFactory,
      });
      remoteAdapter = createSupabaseRemoteSyncAdapter({ client });
    } catch { /* visible persistent error if a user explicitly enables sync */ }
  }
  remoteAdapter ??= unavailableRemoteAdapter();
  const database = options.database ?? createIndexedDbSyncDatabase();
  const repository = options.repository ?? createSyncRepository({ database });
  const strategyRepository = options.strategyRepository ?? createSyncRepository({
    database,
    domain: PERSONAL_STRATEGY_SYNC_DOMAIN,
  });
  const syncPort = browserWindow.RiverlineSavedStudyObjects.createSyncPort();
  const coordinator = options.coordinator ?? createSyncCoordinator({
    repository,
    remoteAdapter,
    domainAdapter: createSavedStudySyncDomainAdapter({ syncPort }),
    onRemoteApplied: () => browserWindow.dispatchEvent(new CustomEvent('riverline:savedstudychange', {
      detail: { source: 'remote_sync' },
    })),
  });
  browserWindow.RiverlineSavedStudyObjects.subscribeLocalMutations((mutation) => (
    coordinator.recordLocalMutation(mutation.object, { lifecycleScope: mutation.lifecycleScope })
  ));
  const strategyPort = options.strategyPort ?? createPersonalStrategySyncPort({
    authentication: browserWindow.RiverlineAuthentication,
    accountIdentity: browserWindow.RiverlineAccountIdentity,
    databaseFactory: options.personalStrategyDatabaseFactory,
  });
  const personalStrategyAdapter = createPersonalStrategySyncAdapter({ syncPort: strategyPort });
  const rangeCalibrationAdapter = createRangeCalibrationSyncAdapter({ syncPort: strategyPort });
  let remoteStrategyInvalidation = null;
  const invalidatePersonalStrategy = () => {
    if (remoteStrategyInvalidation !== null) browserWindow.clearTimeout(remoteStrategyInvalidation);
    remoteStrategyInvalidation = browserWindow.setTimeout(() => {
      remoteStrategyInvalidation = null;
      browserWindow.dispatchEvent(new CustomEvent(
        'riverline:personalstrategychange',
        { detail: { source: 'remote_sync' } },
      ));
    }, 100);
  };
  const strategyCoordinator = options.strategyCoordinator ?? createSyncCoordinator({
    repository: strategyRepository,
    remoteAdapter,
    domainAdapter: personalStrategyAdapter,
    onRemoteApplied: invalidatePersonalStrategy,
  });
  browserWindow.addEventListener('riverline:personalstrategymutation', (event) => {
    for (const entity of event.detail?.entities ?? []) {
      if (personalStrategyAdapter.supports(entity) || rangeCalibrationAdapter.supports(entity)) {
        void strategyCoordinator.recordLocalMutation(entity, { lifecycleScope: event.detail?.lifecycleScope });
      }
    }
  });
  let activeStrategyPort = strategyPort;
  const studySync = createStudySyncAggregate(coordinator, strategyCoordinator, {
    getSummary: () => activeStrategyPort.getSummary(),
  });

  let activationSequence = 0;
  const accountIdentity = browserWindow.RiverlineAccountIdentity;
  function deactivate() {
    activationSequence += 1;
    if (remoteStrategyInvalidation !== null) browserWindow.clearTimeout(remoteStrategyInvalidation);
    remoteStrategyInvalidation = null;
    // Both coordinators revoke synchronously, before either asynchronous preference read.
    const strategy = strategyCoordinator.activate({});
    const saved = coordinator.activate({});
    return Promise.all([strategy, saved]);
  }
  async function activateFromAuthentication(state = browserWindow.RiverlineAuthentication.getState()) {
    const sequence = ++activationSequence;
    if (state.status !== 'signed_in' || !state.profile) return deactivate();
    try {
      const [savedScope, strategyScope] = await Promise.all([
        accountIdentity.captureLifecycleScope(RIVERLINE_OWNED_DOMAINS.SAVED_STUDY_OBJECTS),
        accountIdentity.captureLifecycleScope(RIVERLINE_OWNED_DOMAINS.PERSONAL_STRATEGY),
      ]);
      if (sequence !== activationSequence) return coordinator.getState();
      savedScope.assertCurrent();
      strategyScope.assertCurrent();
      if (savedScope.identityKind !== 'authenticated_account'
        || savedScope.identityId !== strategyScope.identityId
        || state.profile.riverlineIdentityId !== savedScope.identityId
        || browserWindow.RiverlineAuthentication.getState() !== state) return deactivate();
      activeStrategyPort = options.strategyPort ?? createPersonalStrategySyncPort({
        authentication: browserWindow.RiverlineAuthentication,
        accountIdentity, lifecycleScope: strategyScope,
        databaseFactory: options.personalStrategyDatabaseFactory,
      });
      const savedAdapter = createSavedStudySyncDomainAdapter({
        syncPort: browserWindow.RiverlineSavedStudyObjects.createSyncPort(savedScope),
      });
      const strategyAdapter = createPersonalStrategySyncAdapter({ syncPort: activeStrategyPort });
      return await Promise.all([
        strategyCoordinator.activate({
          identityId: strategyScope.identityId, authenticated: true, sessionValid: true,
          lifecycleScope: strategyScope, domainAdapter: strategyAdapter,
        }),
        coordinator.activate({
          identityId: savedScope.identityId, authenticated: true, sessionValid: true,
          lifecycleScope: savedScope, domainAdapter: savedAdapter,
        }),
      ]);
    } catch (error) {
      if (sequence === activationSequence) return deactivate();
      return coordinator.getState();
    }
  }

  const bridge = Object.freeze({
    schemaVersion: 'riverline-saved-study-sync-bridge/v1',
    getState: () => coordinator.getState(),
    getEnableSummary: () => coordinator.getEnableSummary(),
    enable: () => coordinator.enable(),
    disable: () => coordinator.disable(),
    syncNow: () => coordinator.syncNow(),
    listConflicts: () => coordinator.listConflicts(),
    resolveConflict: (objectId, choice) => coordinator.resolveConflict(objectId, choice),
    subscribe: (listener) => coordinator.subscribe(listener),
  });
  Object.defineProperty(browserWindow, 'RiverlineSavedStudySync', {
    configurable: true, enumerable: false, value: bridge, writable: false,
  });
  Object.defineProperty(browserWindow, 'RiverlineStudySync', {
    configurable: true, enumerable: false, value: studySync, writable: false,
  });
  accountIdentity.subscribe?.(() => {
    void deactivate();
    if (accountIdentity.getLifecycleState?.().status === 'account_active') {
      void activateFromAuthentication();
    }
  });
  browserWindow.RiverlineAuthentication.subscribe((state) => {
    void deactivate();
    void activateFromAuthentication(state);
  });
  await browserWindow.RiverlineAuthentication.ready();
  await activateFromAuthentication();
  const bind = () => bindSyncUi(browserWindow, studySync);
  if (browserWindow.document.readyState === 'loading') {
    browserWindow.document.addEventListener('DOMContentLoaded', bind, { once: true });
  } else bind();
  return bridge;
}

if (typeof window !== 'undefined') await installSavedStudySyncBridge(window);
