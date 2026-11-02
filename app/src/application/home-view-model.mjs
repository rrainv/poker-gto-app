import { createSavedStudyPreviewFacts } from './saved-study-preview-facts.mjs';

export const HOME_VIEW_MODEL_SCHEMA_VERSION = 'home-view-model/v2';
export const HOME_RECENT_LIMIT = 6;
export const HOME_REVIEW_LIMIT = 3;
export const HOME_MISTAKE_LIMIT = 3;

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
}

function serializedError(error) {
  return deepFreeze({
    name: error instanceof Error ? error.name : 'Error',
    message: error instanceof Error ? error.message : String(error),
    code: typeof error?.code === 'string' ? error.code : null,
  });
}

export function createHomeSavedItem(object) {
  if (!object || object.schemaVersion !== 'saved-study-object/v1') {
    throw new TypeError('Home requires SavedStudyObject v1');
  }
  const annotations = object.annotations;
  const {
    schemaVersion: previewSchemaVersion,
    ...previewFacts
  } = createSavedStudyPreviewFacts(object);
  return deepFreeze({
    schemaVersion: 'home-saved-item/v1',
    previewSchemaVersion,
    id: object.id,
    title: annotations.title,
    note: annotations.note,
    hasNote: Boolean(annotations.note),
    tags: annotations.tags.map((tag) => tag.display),
    reviewState: annotations.reviewState,
    isMistake: annotations.classifications.includes('mistake'),
    createdAt: object.createdAt,
    updatedAt: object.updatedAt,
    ...previewFacts,
  });
}

function mapSavedItems(objects) {
  const items = [];
  const itemErrors = [];
  for (const object of objects) {
    try {
      items.push(createHomeSavedItem(object));
    } catch (error) {
      itemErrors.push(serializedError(error));
    }
  }
  return deepFreeze({ items, itemErrors });
}

function sectionFrom(result, mapValue) {
  if (result.status === 'rejected') {
    return deepFreeze({ status: 'error', error: serializedError(result.reason) });
  }
  try {
    return deepFreeze({ status: 'ready', ...mapValue(result.value) });
  } catch (error) {
    return deepFreeze({ status: 'error', error: serializedError(error) });
  }
}

function personalStrategySection(result) {
  return sectionFrom(result, (summary) => ({
    profileCount: summary.profileCount,
    selectedProfile: summary.selectedProfile,
    selectedMode: summary.selectedMode,
    context: summary.context,
    answeredCount: summary.answeredCount,
    directEvidenceCount: summary.directEvidenceCount ?? summary.answeredCount,
    contradictionCount: summary.contradictionCount ?? 0,
    totalCount: summary.totalCount,
    session: summary.session,
    resumable: summary.resumable,
  }));
}

function liveHandContinueItem(continuation) {
  if (!continuation?.hasLiveHand) return null;
  return deepFreeze({
    schemaVersion: 'home-continue-item/v1',
    kind: 'live_hand',
  });
}

function continueSection(personalStrategy, continuation = null) {
  const items = [];
  if (personalStrategy.status === 'error') {
    const liveHand = liveHandContinueItem(continuation);
    if (liveHand) items.push(liveHand);
    return deepFreeze({ status: 'ready', items, partialError: personalStrategy.error });
  }
  if (personalStrategy.resumable) {
    items.push({
      schemaVersion: 'home-continue-item/v1',
      kind: 'range_calibration',
      profileId: personalStrategy.selectedProfile.id,
      profileName: personalStrategy.selectedProfile.displayName,
      modeId: personalStrategy.selectedMode.id,
      modeName: personalStrategy.selectedMode.displayName,
      context: personalStrategy.context,
      answeredCount: personalStrategy.answeredCount,
      totalCount: personalStrategy.totalCount,
      sessionState: personalStrategy.session.state,
      updatedAt: personalStrategy.session.updatedAt,
    });
  }
  const liveHand = liveHandContinueItem(continuation);
  if (liveHand) items.push(liveHand);
  return deepFreeze({ status: 'ready', items });
}

function syncSection(result) {
  if (!result) return deepFreeze({ status: 'unavailable', state: 'unavailable' });
  if (result.status === 'rejected') {
    return deepFreeze({ status: 'error', state: 'error', error: serializedError(result.reason) });
  }
  const state = result.value;
  if (!state) return deepFreeze({ status: 'unavailable', state: 'unavailable' });
  return deepFreeze({
    status: 'ready',
    state: state.state,
    enabled: Boolean(state.enabled),
    pendingCount: Number.isSafeInteger(state.pendingCount) ? state.pendingCount : 0,
    conflictCount: Number.isSafeInteger(state.conflictCount) ? state.conflictCount : 0,
    errorCount: Number.isSafeInteger(state.errorCount) ? state.errorCount : 0,
  });
}

function identitySection(profileResult, accountResult) {
  if (profileResult?.status === 'fulfilled' && profileResult.value) {
    return deepFreeze({ status: 'ready', profile: profileResult.value });
  }
  if (accountResult?.status === 'fulfilled' && accountResult.value) {
    return deepFreeze({ status: 'ready', profile: accountResult.value });
  }
  if (profileResult || accountResult) return deepFreeze({ status: 'error', profile: null });
  return deepFreeze({ status: 'unavailable', profile: null });
}

// HOME-001: the last game night, as the Home card needs it. Only fields the
// Game night workspace already stores; there is no link between hands and a
// night yet, so no hand results, luck or plan axes exist to show.
function nightAfterSection(result) {
  if (!result) return deepFreeze({ status: 'unavailable', night: null });
  if (result.status === 'rejected') {
    return deepFreeze({ status: 'error', night: null, error: serializedError(result.reason) });
  }
  const night = result.value;
  if (!night) return deepFreeze({ status: 'ready', night: null });
  return deepFreeze({
    status: 'ready',
    night: {
      sessionId: String(night.sessionId),
      title: String(night.title ?? ''),
      state: night.state === 'active' ? 'active' : 'completed',
      endedAt: night.endedAt ?? null,
      updatedAt: night.updatedAt ?? null,
      playerCount: Number.isSafeInteger(night.playerCount) ? night.playerCount : 0,
      transferCount: Number.isSafeInteger(night.transferCount) ? night.transferCount : null,
      settledText: typeof night.settledText === 'string' ? night.settledText : null,
    },
  });
}

// HOME-001: "What Riverline noticed" comes from played hands only. No source
// is wired yet (the aggregate plan-vs-played query is HOME-NOTICED-SOURCE), so
// without one the section is empty and the card shows its honest empty state.
// The sample gates are applied at render time (home-cards.mjs), not here.
function noticedSection(result) {
  if (!result) return deepFreeze({ status: 'ready', items: [] });
  if (result.status === 'rejected') {
    return deepFreeze({ status: 'error', items: [], error: serializedError(result.reason) });
  }
  const items = Array.isArray(result.value) ? result.value : [];
  return deepFreeze({ status: 'ready', items: structuredClone(items) });
}

function futureHistorySeams() {
  return deepFreeze({
    status: 'unsupported',
    training: { status: 'unsupported' },
    analysis: { status: 'unsupported' },
  });
}

export function createGuestHomeViewModel({ continuation = null, nightAfter = undefined, noticed = undefined } = {}) {
  const liveHand = liveHandContinueItem(continuation);
  return deepFreeze({
    schemaVersion: HOME_VIEW_MODEL_SCHEMA_VERSION,
    sessionMode: 'guest',
    identity: { status: 'guest', profile: null },
    sync: { status: 'unavailable', state: 'unavailable' },
    sections: {
      continue: { status: 'ready', items: liveHand ? [liveHand] : [] },
      recent: { status: 'unavailable', items: [] },
      review: {
        status: 'unavailable',
        reviewLater: { status: 'unavailable', items: [] },
        mistakes: { status: 'unavailable', items: [] },
      },
      personalStrategy: { status: 'unavailable' },
      quickStart: { status: 'ready', destinations: ['hand', 'analyze', 'training', 'equity'] },
      // Resolved values (undefined = no query wired; null = nothing to show).
      nightAfter: nightAfterSection(nightAfter === undefined ? null : { status: 'fulfilled', value: nightAfter }),
      noticed: noticedSection(noticed === undefined ? null : { status: 'fulfilled', value: noticed }),
      history: futureHistorySeams(),
    },
  });
}

export function createHomeViewModelController({
  savedStudyQueries,
  personalStrategyQueries,
  accountQueries = null,
  profileQueries = null,
  syncQueries = null,
  continuationQueries = null,
  gameNightQueries = null,
  noticedQueries = null,
} = {}) {
  if (!savedStudyQueries
    || typeof savedStudyQueries.listRecent !== 'function'
    || typeof savedStudyQueries.listForReview !== 'function'
    || typeof savedStudyQueries.listMistakes !== 'function') {
    throw new TypeError('Home requires bounded Saved Study queries');
  }
  if (!personalStrategyQueries || typeof personalStrategyQueries.loadSummary !== 'function') {
    throw new TypeError('Home requires a Personal Strategy summary query');
  }
  if (accountQueries !== null && typeof accountQueries.getProfileSummary !== 'function') {
    throw new TypeError('Home account query must provide getProfileSummary');
  }
  if (profileQueries !== null && typeof profileQueries.getProfileSummary !== 'function') {
    throw new TypeError('Home profile query must provide getProfileSummary');
  }
  if (syncQueries !== null && typeof syncQueries.getState !== 'function') {
    throw new TypeError('Home sync query must provide getState');
  }
  if (continuationQueries !== null && typeof continuationQueries.getSummary !== 'function') {
    throw new TypeError('Home continuation query must provide getSummary');
  }

  if (gameNightQueries !== null && typeof gameNightQueries.getLatest !== 'function') {
    throw new TypeError('Home game night query must provide getLatest');
  }
  if (noticedQueries !== null && typeof noticedQueries.getItems !== 'function') {
    throw new TypeError('Home noticed query must provide getItems');
  }

  return Object.freeze({
    async load({ guest = false } = {}) {
      const [recentResult, reviewResult, mistakeResult, personalResult,
        accountResult, profileResult, syncResult, continuationResult,
        nightResult, noticedResult] = await Promise.allSettled([
        savedStudyQueries.listRecent({ limit: HOME_RECENT_LIMIT }),
        savedStudyQueries.listForReview({ limit: HOME_REVIEW_LIMIT }),
        savedStudyQueries.listMistakes({ limit: HOME_MISTAKE_LIMIT }),
        personalStrategyQueries.loadSummary(),
        guest ? null : accountQueries?.getProfileSummary?.() ?? null,
        guest ? null : profileQueries?.getProfileSummary?.() ?? null,
        guest ? null : syncQueries?.getState?.() ?? null,
        continuationQueries?.getSummary?.() ?? null,
        gameNightQueries?.getLatest?.() ?? null,
        noticedQueries?.getItems?.() ?? null,
      ]);
      const recent = sectionFrom(recentResult, mapSavedItems);
      const reviewLater = sectionFrom(reviewResult, mapSavedItems);
      const mistakes = sectionFrom(mistakeResult, mapSavedItems);
      const personalStrategy = personalStrategySection(personalResult);
      const continuation = continuationResult.status === 'fulfilled' ? continuationResult.value : null;
      const identity = identitySection(profileQueries ? profileResult : null, accountQueries ? accountResult : null);
      const quickStartDestinations = ['hand', 'analyze', 'training', 'equity'];
      if (mistakes.status === 'ready' && mistakes.items.length > 0) {
        quickStartDestinations.push('review_mistakes');
      }
      return deepFreeze({
        schemaVersion: HOME_VIEW_MODEL_SCHEMA_VERSION,
        sessionMode: guest ? 'guest' : 'account',
        identity: guest ? { status: 'guest', profile: null } : identity,
        sync: guest ? { status: 'unavailable', state: 'unavailable' } : syncSection(syncQueries ? syncResult : null),
        sections: {
          continue: continueSection(personalStrategy, continuation),
          recent,
          review: {
            status: reviewLater.status === 'error' && mistakes.status === 'error' ? 'error' : 'ready',
            reviewLater,
            mistakes,
          },
          personalStrategy,
          quickStart: {
            status: 'ready',
            destinations: quickStartDestinations,
          },
          nightAfter: nightAfterSection(gameNightQueries ? nightResult : null),
          noticed: noticedSection(noticedQueries ? noticedResult : null),
          history: futureHistorySeams(),
        },
      });
    },
  });
}
