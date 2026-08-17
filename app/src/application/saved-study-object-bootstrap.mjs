import { createSavedStudyObjectApplication } from './saved-study-object-service.mjs';
import { createSavedStudyObjectSourceController } from './saved-study-object-source-controller.mjs';
import {
  RIVERLINE_OWNED_DOMAINS,
  scopedDomainDatabaseName,
} from '../account-identity/index.mjs';
import {
  SAVED_STUDY_DATABASE_NAME,
  createIndexedDbSavedStudyDatabase,
  createSavedStudyOwnerRef,
} from '../saved-study-objects/index.mjs';

export function installSavedStudyObjectBridge(browserWindow, options = {}) {
  if (!browserWindow) return null;
  const databases = new Map();
  const application = options.application ?? createSavedStudyObjectApplication({
    activationResolver: async () => {
      const accountIdentity = options.accountIdentity ?? browserWindow.RiverlineAccountIdentity;
      if (!accountIdentity?.getDomainOwnership) return null;
      const binding = await accountIdentity.getDomainOwnership(
        RIVERLINE_OWNED_DOMAINS.SAVED_STUDY_OBJECTS,
      );
      const name = scopedDomainDatabaseName(SAVED_STUDY_DATABASE_NAME, binding);
      if (!databases.has(name)) databases.set(name, createIndexedDbSavedStudyDatabase({ name }));
      return Object.freeze({
        ownerRef: createSavedStudyOwnerRef(binding.domainOwnerId),
        database: databases.get(name),
      });
    },
  });
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
