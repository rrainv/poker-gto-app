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
import { unsupportedPersonalStrategySyncSchema } from '../sync/personal-strategy-domain-adapters.mjs';

export function createPersonalStrategySyncPort({
  authentication,
  accountIdentity,
  lifecycleScope = null,
  databaseFactory = (name) => createIndexedDbPersonalStrategyDatabase({ name }),
} = {}) {
  if (!authentication?.ready || !authentication?.getState
    || (!lifecycleScope && !accountIdentity?.captureLifecycleScope)) {
    throw new TypeError('Personal Strategy sync port requires authenticated identity services');
  }
  const repositories = new Map();

  function assertAuthorized(scope) {
    scope?.assertCurrent();
    const state = authentication.getState();
    if (state.status !== 'signed_in' || (scope && (scope.identityKind !== 'authenticated_account'
      || state.profile?.riverlineIdentityId !== scope.identityId))) {
      throw Object.assign(new RangeError('A validated account is required for Personal Strategy sync'), {
        code: 'persistent_identity_required',
      });
    }
  }

  async function activate() {
    await authentication.ready();
    const scope = lifecycleScope ?? await accountIdentity.captureLifecycleScope(
      RIVERLINE_OWNED_DOMAINS.PERSONAL_STRATEGY,
    );
    assertAuthorized(scope);
    const binding = scope.domainOwnerBinding;
    assertAuthorized(scope);
    const name = scopedDomainDatabaseName(PERSONAL_STRATEGY_DATABASE_NAME, binding);
    const key = `${name}:${scope.lifecycleGeneration}`;
    if (!repositories.has(key)) {
      const repository = createPersonalStrategyRepository({
        database: databaseFactory(name),
        ownerRef: createLocalOwnerRef(binding.domainOwnerId),
        lifecycleScope: scope,
      });
      repositories.set(key, Object.freeze({ repository, binding, scope }));
    }
    return repositories.get(key);
  }

  async function withRepository(method, ...args) {
    const { repository, scope } = await activate();
    assertAuthorized(scope);
    const result = await repository[method](...args);
    assertAuthorized(scope);
    return result;
  }

  async function assertCompatible() {
    const { repository, scope } = await activate();
    await repository.initialize();
    assertAuthorized(scope);
    if (repository.schemaVersion !== 'personal-strategy-store/v1') {
      throw unsupportedPersonalStrategySyncSchema();
    }
  }

  return Object.freeze({
    assertCompatible,
    async ownerRef() {
      const { binding, scope } = await activate();
      assertAuthorized(scope);
      return createLocalOwnerRef(binding.domainOwnerId);
    },
    async listEntities() { return withRepository('listSyncEntities'); },
    async getEntityById(id) { return withRepository('getSyncEntityById', id); },
    async getSummary() { return withRepository('getSyncSummary'); },
    async applyRemoteEntity(entity, document) {
      await assertCompatible();
      return withRepository('applySyncedEntity', entity, document);
    },
    async close() {
      await Promise.all([...repositories.values()].map((entry) => entry.repository.close()));
      repositories.clear();
    },
  });
}
