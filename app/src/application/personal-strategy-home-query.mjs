import {
  createLocalOwnerRef,
  createPersonalStrategyBrowserStorage,
  createPersonalStrategyRepository,
} from '../personal-strategy/index.mjs';
import {
  RANGE_CALIBRATION_OWNER_KEY,
  RANGE_CALIBRATION_PREFERENCES_KEY,
  createContextFromSelection,
} from './range-calibration-service.mjs';

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
  clock = () => new Date(),
} = {}) {
  let repository = null;

  return Object.freeze({
    async loadSummary() {
      const ownerId = storage.getItem(RANGE_CALIBRATION_OWNER_KEY);
      if (typeof ownerId !== 'string' || !ownerId.trim()) return emptySummary(0);
      if (!repository) {
        repository = createPersonalStrategyRepository({
          database,
          legacyStorage: storage,
          ownerRef: createLocalOwnerRef(ownerId),
          clock,
        });
      }
      const scope = preferredScope(storage);
      const summary = await repository.loadHomeSummary(scope || {});
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
      if (repository) await repository.close();
      repository = null;
    },
  });
}
