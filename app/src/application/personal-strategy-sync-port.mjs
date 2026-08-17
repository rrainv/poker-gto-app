import {
  RIVERLINE_OWNED_DOMAINS,
  scopedDomainDatabaseName,
} from '../account-identity/index.mjs';
import {
  PERSONAL_STRATEGY_DATABASE_NAME,
  createIndexedDbPersonalStrategyDatabase,
  createLocalOwnerRef,
  createPersonalStrategyRepository,
} from '../personal-strategy/index.mjs';

export function createPersonalStrategySyncPort({
  authentication,
  accountIdentity,
  databaseFactory = (name) => createIndexedDbPersonalStrategyDatabase({ name }),
} = {}) {
  if (!authentication?.ready || !authentication?.getState || !accountIdentity?.getDomainOwnership) {
    throw new TypeError('Personal Strategy sync port requires authenticated identity services');
  }
  const repositories = new Map();

  async function activate() {
    await authentication.ready();
    if (authentication.getState().status !== 'signed_in') {
      const error = new RangeError('A validated account is required for Personal Strategy sync');
      error.code = 'persistent_identity_required';
      throw error;
    }
    const binding = await accountIdentity.getDomainOwnership(RIVERLINE_OWNED_DOMAINS.PERSONAL_STRATEGY);
    const name = scopedDomainDatabaseName(PERSONAL_STRATEGY_DATABASE_NAME, binding);
    if (!repositories.has(name)) {
      const repository = createPersonalStrategyRepository({
        database: databaseFactory(name),
        ownerRef: createLocalOwnerRef(binding.domainOwnerId),
      });
      repositories.set(name, Object.freeze({ repository, binding }));
    }
    return repositories.get(name);
  }

  return Object.freeze({
    async ownerRef() { return createLocalOwnerRef((await activate()).binding.domainOwnerId); },
    async listEntities() { return (await activate()).repository.listSyncEntities(); },
    async getEntityById(id) { return (await activate()).repository.getSyncEntityById(id); },
    async getSummary() { return (await activate()).repository.getSyncSummary(); },
    async applyRemoteEntity(entity, document) {
      return (await activate()).repository.applySyncedEntity(entity, document);
    },
    async close() {
      await Promise.all([...repositories.values()].map((entry) => entry.repository.close()));
      repositories.clear();
    },
  });
}
