import {
  PERSONAL_STRATEGY_DATABASE_NAME,
  createLocalOwnerRef,
  createIndexedDbPersonalStrategyDatabase,
  createPersonalStrategyBrowserStorage,
  createPersonalStrategyRepository,
} from '../personal-strategy/index.mjs';
import {
  RANGE_CALIBRATION_OWNER_KEY,
  RANGE_CALIBRATION_PREFERENCES_KEY,
  createContextFromSelection,
} from './range-calibration-service.mjs';
import {
  scopedDomainDatabaseName,
  scopedPreferenceKey,
} from '../account-identity/index.mjs';

const TOTAL_RFI_HAND_CLASSES = 169;

function emptySummary(profileCount = 0) {
  return Object.freeze({
    schemaVersion: 'personal-strategy-home-summary/v1',
    profileCount,
    selectedProfile: null,
    selectedMode: null,
    context: null,
    answeredCount: 0,
    totalCount: TOTAL_RFI_HAND_CLASSES,
    session: null,
    resumable: false,
  });
}

function preferredScope(storage) {
  const serialized = storage.getItem(RANGE_CALIBRATION_PREFERENCES_KEY);
  if (serialized === null) return null;
  try {
    const preferences = JSON.parse(serialized);
    const profileId = preferences?.selectedProfileId;
    const entry = typeof profileId === 'string' ? preferences?.byProfile?.[profileId] : null;
    if (!entry || typeof entry.activeModeId !== 'string') return null;
    return {
      profileId,
      modeId: entry.activeModeId,
      context: createContextFromSelection(entry.context),
    };
  } catch {
    return null;
  }
}

export function createPersonalStrategyHomeQuery({
  storage = createPersonalStrategyBrowserStorage(),
  database = null,
  ownershipResolver = null,
  databaseResolver = null,
  clock = () => new Date(),
} = {}) {
  const repositories = new Map();
  const databases = new Map();

  function scopedStorage(binding) {
    if (!binding) return storage;
    return Object.freeze({
      getItem(key) { return storage.getItem(scopedPreferenceKey(key, binding)); },
      setItem(key, value) { return storage.setItem(scopedPreferenceKey(key, binding), value); },
    });
  }

  async function resolveOwnership() {
    if (ownershipResolver) {
      const binding = await ownershipResolver();
      const ownerId = binding?.domainOwnerId;
      if (typeof ownerId !== 'string' || !ownerId.trim()) return null;
      let resolvedDatabase = database;
      if (databaseResolver) resolvedDatabase = await databaseResolver(binding);
      else if (!resolvedDatabase) {
        const name = scopedDomainDatabaseName(PERSONAL_STRATEGY_DATABASE_NAME, binding);
        if (!databases.has(name)) {
          databases.set(name, createIndexedDbPersonalStrategyDatabase({ name }));
        }
        resolvedDatabase = databases.get(name);
      }
      return { binding, ownerId, database: resolvedDatabase, storage: scopedStorage(binding) };
    }
    const ownerId = storage.getItem(RANGE_CALIBRATION_OWNER_KEY);
    if (typeof ownerId !== 'string' || !ownerId.trim()) return null;
    return { binding: null, ownerId, database, storage };
  }

  return Object.freeze({
    async loadSummary() {
      const ownership = await resolveOwnership();
      if (!ownership) return emptySummary(0);
      const key = `${ownership.database?.name ?? 'default'}:local:${ownership.ownerId}`;
      if (!repositories.has(key)) {
        repositories.set(key, createPersonalStrategyRepository({
          database: ownership.database,
          legacyStorage: ownership.storage,
          ownerRef: createLocalOwnerRef(ownership.ownerId),
          clock,
        }));
      }
      const scope = preferredScope(ownership.storage);
      const summary = await repositories.get(key).loadHomeSummary(scope || {});
      if (!summary.selectedProfile || !summary.selectedMode) return emptySummary(summary.profileCount);
      const session = summary.session;
      return Object.freeze({
        schemaVersion: 'personal-strategy-home-summary/v1',
        profileCount: summary.profileCount,
        selectedProfile: summary.selectedProfile,
        selectedMode: summary.selectedMode,
        context: summary.context,
        answeredCount: summary.answeredCount,
        totalCount: TOTAL_RFI_HAND_CLASSES,
        session,
        resumable: Boolean(session
          && ['active', 'paused'].includes(session.state)
          && summary.answeredCount < TOTAL_RFI_HAND_CLASSES),
      });
    },

    async close() {
      await Promise.all([...repositories.values()].map((repository) => repository.close()));
      repositories.clear();
      databases.clear();
    },
  });
}
