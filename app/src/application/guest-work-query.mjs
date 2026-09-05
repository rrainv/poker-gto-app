import { scopedDomainDatabaseName, scopedPreferenceKey } from '../account-identity/domain.mjs';
import { SAVED_STUDY_DATABASE_NAME, createIndexedDbSavedStudyDatabase, createSavedStudyRepository, createSavedStudyOwnerRef } from '../saved-study-objects/index.mjs';
import { PERSONAL_STRATEGY_DATABASE_NAME, createIndexedDbPersonalStrategyDatabase, createPersonalStrategyRepository, createLocalOwnerRef, createPersonalStrategyBrowserStorage } from '../personal-strategy/index.mjs';
import { createIndexedDbTrainingMemoryDatabase } from '../training-memory/indexeddb-storage.mjs';
import { createTrainingMemoryRepository } from '../training-memory/repository.mjs';

export function createGuestWorkQuery({ accountIdentity, databaseResolver = null, storage = null } = {}) {
  return async function hasMeaningfulGuestWork() {
    const scopes = await Promise.all(['saved_study_objects', 'personal_strategy', 'training_memory']
      .map((domain) => accountIdentity.captureLifecycleScope(domain)));
    if (scopes.some((scope) => scope.identityKind !== 'device_guest'
      || scope.identityId !== scopes[0].identityId)) throw new Error('Guest ownership changed');
    const repositories = [];
    const ownedDatabases = [];
    try {
      for (const scope of scopes) {
        scope.assertCurrent();
        const binding = scope.domainOwnerBinding;
        let database = await databaseResolver?.(binding);
        if (binding.domain === 'saved_study_objects') {
          database ??= createIndexedDbSavedStudyDatabase({ name: scopedDomainDatabaseName(SAVED_STUDY_DATABASE_NAME, binding) });
          repositories.push(createSavedStudyRepository({ database, ownerRef: createSavedStudyOwnerRef(binding.domainOwnerId), lifecycleScope: scope }));
        } else if (binding.domain === 'personal_strategy') {
          database ??= createIndexedDbPersonalStrategyDatabase({ name: scopedDomainDatabaseName(PERSONAL_STRATEGY_DATABASE_NAME, binding) });
          const preferences = storage ?? createPersonalStrategyBrowserStorage();
          repositories.push(createPersonalStrategyRepository({ database, ownerRef: createLocalOwnerRef(binding.domainOwnerId), lifecycleScope: scope,
            legacyStorage: { getItem: (key) => preferences.getItem(scopedPreferenceKey(key, binding)) } }));
        } else {
          // Training Memory is one owner-indexed database, not the Saved/Strategy namespace model.
          database ??= createIndexedDbTrainingMemoryDatabase();
          repositories.push(createTrainingMemoryRepository({ database, ownerRef: binding.domainOwnerRef }));
        }
        if (!databaseResolver) ownedDatabases.push(database);
      }
      const results = await Promise.all(repositories.map((repository) => repository.hasMeaningfulData()));
      scopes.forEach((scope) => scope.assertCurrent());
      if (results.some((value) => typeof value !== 'boolean')) throw new Error('Guest work could not be determined');
      return results.some(Boolean);
    } finally {
      await Promise.allSettled(ownedDatabases.map((database) => database.close()));
    }
  };
}
