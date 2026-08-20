import {
  GAME_RULES_COLLECTION_TYPES,
  POKER_STATE_SCHEMA_VERSION,
  POKER_STATE_V2_SCHEMA_VERSION,
} from '../../../shared/poker-domain/index.js';

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

function bbFromMilli(value) {
  return Number.isSafeInteger(value) ? value / 1000 : null;
}

function neutralSavedHandGameMode(state) {
  if (state.schemaVersion === POKER_STATE_SCHEMA_VERSION
    || (state.schemaVersion === undefined && typeof state.game?.mode === 'string')) {
    return state.game.mode;
  }
  if (state.schemaVersion !== POKER_STATE_V2_SCHEMA_VERSION) {
    throw new TypeError(`Unsupported Saved Hand PokerState version: ${String(state.schemaVersion)}`);
  }
  const policyType = state.rulesSnapshot.definition.collectionPolicy.type;
  if (policyType === GAME_RULES_COLLECTION_TYPES.FIXED_PER_SEATED_PLAYER) return 'fixed';
  if (policyType === GAME_RULES_COLLECTION_TYPES.NONE) return 'off';
  throw new RangeError(`Unsupported Saved Hand collection policy: ${String(policyType)}`);
}

function savedHandItem(object) {
  const snapshot = object.payload;
  const state = snapshot.pokerState;
  const hero = state.players.find((player) => player.playerId === snapshot.heroPlayerId);
  if (!hero) throw new RangeError('Saved Hand Hero is unavailable');
  return {
    kind: 'hand',
    derivation: 'canonical_hand',
    tableSize: state.players.length,
    gameMode: neutralSavedHandGameMode(state),
    heroPosition: hero.position,
    street: state.street,
    phase: state.phase,
    board: [...state.board],
    potBb: bbFromMilli(state.potMilliBb),
    historyStatus: 'canonical_replay',
  };
}

function savedSpotItem(object) {
  const snapshot = object.payload;
  const context = snapshot.decisionContext;
  return {
    kind: 'spot',
    derivation: snapshot.derivation,
    tableSize: context.tableSize,
    gameMode: context.rakeMode,
    heroPosition: context.heroPosition,
    street: context.street,
    board: [...context.board],
    stackBb: context.stackBb,
    potBb: context.potBb,
    facingSizeBb: context.facingSizeBb,
    callAmountBb: context.callAmountBb,
    historyStatus: snapshot.truth.historyStatus,
  };
}

export function createHomeSavedItem(object) {
  if (!object || object.schemaVersion !== 'saved-study-object/v1') {
    throw new TypeError('Home requires SavedStudyObject v1');
  }
  const annotations = object.annotations;
  const details = object.kind === 'hand'
    ? savedHandItem(object)
    : object.kind === 'spot'
      ? savedSpotItem(object)
      : { kind: object.kind, derivation: 'unsupported', historyStatus: 'not_available' };
  return deepFreeze({
    schemaVersion: 'home-saved-item/v1',
    id: object.id,
    title: annotations.title,
    hasNote: Boolean(annotations.note),
    tags: annotations.tags.map((tag) => tag.display),
    reviewState: annotations.reviewState,
    isMistake: annotations.classifications.includes('mistake'),
    createdAt: object.createdAt,
    updatedAt: object.updatedAt,
    ...details,
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

function futureHistorySeams() {
  return deepFreeze({
    status: 'unsupported',
    training: { status: 'unsupported' },
    analysis: { status: 'unsupported' },
  });
}

export function createGuestHomeViewModel({ continuation = null } = {}) {
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
      quickStart: { status: 'ready', destinations: ['gto', 'training', 'equity'] },
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

  return Object.freeze({
    async load() {
      const [recentResult, reviewResult, mistakeResult, personalResult,
        accountResult, profileResult, syncResult, continuationResult] = await Promise.allSettled([
        savedStudyQueries.listRecent({ limit: HOME_RECENT_LIMIT }),
        savedStudyQueries.listForReview({ limit: HOME_REVIEW_LIMIT }),
        savedStudyQueries.listMistakes({ limit: HOME_MISTAKE_LIMIT }),
        personalStrategyQueries.loadSummary(),
        accountQueries?.getProfileSummary?.() ?? null,
        profileQueries?.getProfileSummary?.() ?? null,
        syncQueries?.getState?.() ?? null,
        continuationQueries?.getSummary?.() ?? null,
      ]);
      const recent = sectionFrom(recentResult, mapSavedItems);
      const reviewLater = sectionFrom(reviewResult, mapSavedItems);
      const mistakes = sectionFrom(mistakeResult, mapSavedItems);
      const personalStrategy = personalStrategySection(personalResult);
      const continuation = continuationResult.status === 'fulfilled' ? continuationResult.value : null;
      const identity = identitySection(profileQueries ? profileResult : null, accountQueries ? accountResult : null);
      const quickStartDestinations = ['gto', 'training', 'equity', 'calibration'];
      if (mistakes.status === 'ready' && mistakes.items.length > 0) {
        quickStartDestinations.push('review_mistakes');
      }
      return deepFreeze({
        schemaVersion: HOME_VIEW_MODEL_SCHEMA_VERSION,
        sessionMode: 'account',
        identity,
        sync: syncSection(syncQueries ? syncResult : null),
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
          history: futureHistorySeams(),
        },
      });
    },
  });
}
