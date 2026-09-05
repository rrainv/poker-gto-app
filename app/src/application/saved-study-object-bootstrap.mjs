import { createSavedStudyObjectApplication } from './saved-study-object-service.mjs';
import { createSavedStudyObjectSourceController, savedStudyClassificationsWithMistake } from './saved-study-object-source-controller.mjs';
import './authentication-bootstrap.mjs';
import { RIVERLINE_OWNED_DOMAINS, scopedDomainDatabaseName, scopedPreferenceKey } from '../account-identity/index.mjs';
import { SAVED_STUDY_DATABASE_NAME, createIndexedDbSavedStudyDatabase, createSavedStudyOwnerRef } from '../saved-study-objects/index.mjs';

export function installSavedStudyObjectBridge(browserWindow, options = {}) {
  if (!browserWindow) return null;
  const identity = options.accountIdentity ?? browserWindow.RiverlineAccountIdentity;
  const mutationListeners = new Set();
  const bundles = new Map();
  const storage = options.storage ?? browserWindow.localStorage;
  function bundleFor(scope) {
    scope?.assertCurrent();
    const key = scope ? scope.identityId + ':' + scope.lifecycleGeneration : 'provided';
    if (bundles.has(key)) return bundles.get(key);
    const binding = scope?.domainOwnerBinding;
    const application = options.application ?? createSavedStudyObjectApplication({
      ownerRef: createSavedStudyOwnerRef(binding.domainOwnerId),
      database: options.databaseResolver?.(binding) ?? createIndexedDbSavedStudyDatabase({
        name: scopedDomainDatabaseName(SAVED_STUDY_DATABASE_NAME, binding),
      }),
      lifecycleScope: scope,
      onLocalMutation: async (mutation) => {
        scope?.assertCurrent();
        for (const listener of mutationListeners) {
          scope?.assertCurrent();
          await listener(mutation);
        }
      },
    });
    const scopedStorage = binding ? Object.freeze(Object.fromEntries(
      ['getItem', 'setItem', 'removeItem'].map((method) => [method, (key, ...args) => {
        scope.assertCurrent();
        return storage[method](scopedPreferenceKey(key, binding), ...args);
      }]),
    )) : storage;
    const controller = createSavedStudyObjectSourceController({
      application, storage: scopedStorage, lifecycleScope: scope,
      getPlaybookBridge: options.getPlaybookBridge ?? (() => browserWindow.RiverlinePlaybookState),
      clock: options.clock,
    });
    const bundle = { application, controller };
    bundles.set(key, bundle);
    scope?.signal.addEventListener('abort', () => {
      bundles.delete(key);
      void application.close().catch(() => {});
    }, { once: true });
    return bundle;
  }
  async function capture() {
    if (!identity?.captureLifecycleScope) {
      if (options.application) return null;
      throw new Error('Saved lifecycle ownership is unavailable');
    }
    return identity.captureLifecycleScope(RIVERLINE_OWNED_DOMAINS.SAVED_STUDY_OBJECTS);
  }
  async function invoke(target, method, args) {
    const scope = await capture();
    const result = await bundleFor(scope)[target][method](...args);
    scope?.assertCurrent();
    return result;
  }
  const bridge = Object.freeze({
    schemaVersion: 'saved-study-source-controller/v1',
    classificationsWithMistake: savedStudyClassificationsWithMistake,
    ...Object.fromEntries(['getCurrentStatus', 'saveCurrent', 'updateAnnotations', 'archiveCurrent']
      .map((method) => [method, (...args) => invoke('controller', method, args)])),
    ...Object.fromEntries(['saveReviewedDecisionSpot', 'getById', 'listRecent', 'listForReview',
      'listMistakes', 'exportLibrary', 'importLibrary']
      .map((method) => [method, (...args) => invoke('application', method, args)])),
    subscribeLocalMutations(listener) {
      if (typeof listener !== 'function') throw new TypeError('Saved mutation listener must be a function');
      mutationListeners.add(listener);
      return () => mutationListeners.delete(listener);
    },
    createSyncPort(scope) {
      // Sync ports are fixed to their authenticated generation, never dynamically rerouted.
      const call = async (method, ...args) => {
        if (scope?.identityKind !== 'authenticated_account') throw new Error('Account sync scope required');
        scope.assertCurrent();
        const result = await bundleFor(scope).application[method](...args);
        scope.assertCurrent();
        return result;
      };
      return Object.freeze({
        listAll: () => call('listAllForSync'),
        getById: (id) => call('getById', id),
        applyRemote: (object, syncOptions) => call('applySyncedObject', object, syncOptions),
        saveObject: (object) => call('applySyncedObject', object, { expectedRevision: null }),
        activate: () => call('activate'),
      });
    },
  });
  Object.defineProperty(browserWindow, 'RiverlineSavedStudyObjects', {
    configurable: true, enumerable: false, value: bridge, writable: false,
  });
  return bridge;
}
if (typeof window !== 'undefined') installSavedStudyObjectBridge(window);
