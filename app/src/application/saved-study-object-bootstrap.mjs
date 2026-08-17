import { createSavedStudyObjectApplication } from './saved-study-object-service.mjs';
import { createSavedStudyObjectSourceController } from './saved-study-object-source-controller.mjs';
import './authentication-bootstrap.mjs';
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
      await browserWindow.RiverlineAuthentication?.ready?.();
      if (browserWindow.RiverlineAuthentication?.getState?.().status !== 'signed_in') {
        const error = new RangeError('A persistent Account Profile is required');
        error.code = 'persistent_identity_required';
        throw error;
      }
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
  const authentication = options.authentication ?? browserWindow.RiverlineAuthentication;
  const gate = options.persistentIdentityGate ?? browserWindow.RiverlinePersistentIdentity;
  const signedIn = () => authentication?.getState?.().status === 'signed_in';
  const guestStatus = () => Promise.resolve(Object.freeze({
    schemaVersion: 'saved-study-source-controller/v1',
    state: 'unsaved',
    identity: null,
    object: null,
  }));
  const requireIdentity = (intent, resumeAction) => {
    if (!gate?.requirePersistentIdentity) {
      const error = new RangeError('A persistent Account Profile is required');
      error.code = 'persistent_identity_required';
      return Promise.reject(error);
    }
    return gate.requirePersistentIdentity({ intent, resumeAction });
  };
  const bridge = Object.freeze({
    ...controller,
    getCurrentStatus: (...args) => (signedIn() ? controller.getCurrentStatus(...args) : guestStatus()),
    saveCurrent: (...args) => requireIdentity('save-study-object', () => controller.saveCurrent(...args)),
    updateAnnotations: (...args) => requireIdentity('update-saved-study-object', () => (
      controller.updateAnnotations(...args)
    )),
    archiveCurrent: (...args) => requireIdentity('archive-saved-study-object', () => (
      controller.archiveCurrent(...args)
    )),
    getById: (...args) => (signedIn() ? application.getById(...args) : Promise.resolve(null)),
    listRecent: (...args) => (signedIn() ? application.listRecent(...args) : Promise.resolve([])),
    listForReview: (...args) => (signedIn() ? application.listForReview(...args) : Promise.resolve([])),
    listMistakes: (...args) => (signedIn() ? application.listMistakes(...args) : Promise.resolve([])),
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
