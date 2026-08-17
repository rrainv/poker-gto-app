export const HOME_VIEW_MODEL_SCHEMA_VERSION = 'home-view-model/v1';
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

function savedHandItem(object) {
  const snapshot = object.payload;
  const state = snapshot.pokerState;
  const hero = state.players.find((player) => player.playerId === snapshot.heroPlayerId);
  if (!hero) throw new RangeError('Saved Hand Hero is unavailable');
  return {
    kind: 'hand',
    derivation: 'canonical_hand',
    tableSize: state.players.length,
    gameMode: state.game.mode,
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
    totalCount: summary.totalCount,
    session: summary.session,
    resumable: summary.resumable,
  }));
}

function continueSection(personalStrategy) {
  if (personalStrategy.status === 'error') {
    return deepFreeze({ status: 'ready', items: [], partialError: personalStrategy.error });
  }
  if (!personalStrategy.resumable) return deepFreeze({ status: 'ready', items: [] });
  return deepFreeze({
    status: 'ready',
    items: [{
      schemaVersion: 'home-continue-item/v1',
      kind: 'range_calibration',
      profileId: personalStrategy.selectedProfile.id,
      profileName: personalStrategy.selectedProfile.displayName,
      modeId: personalStrategy.selectedMode.id,
      modeName: personalStrategy.selectedMode.displayName,
      answeredCount: personalStrategy.answeredCount,
      totalCount: personalStrategy.totalCount,
      sessionState: personalStrategy.session.state,
      updatedAt: personalStrategy.session.updatedAt,
    }],
  });
}

export function createHomeViewModelController({
  savedStudyQueries,
  personalStrategyQueries,
  accountQueries = null,
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

  return Object.freeze({
    async load() {
      const [recentResult, reviewResult, mistakeResult, personalResult, identityResult] = await Promise.allSettled([
        savedStudyQueries.listRecent({ limit: HOME_RECENT_LIMIT }),
        savedStudyQueries.listForReview({ limit: HOME_REVIEW_LIMIT }),
        savedStudyQueries.listMistakes({ limit: HOME_MISTAKE_LIMIT }),
        personalStrategyQueries.loadSummary(),
        accountQueries?.getProfileSummary?.() ?? null,
      ]);
      const recent = sectionFrom(recentResult, mapSavedItems);
      const reviewLater = sectionFrom(reviewResult, mapSavedItems);
      const mistakes = sectionFrom(mistakeResult, mapSavedItems);
      const personalStrategy = personalStrategySection(personalResult);
      const identity = identityResult.status === 'fulfilled' && identityResult.value
        ? { status: 'ready', profile: identityResult.value }
        : { status: accountQueries ? 'error' : 'unavailable', profile: null };
      return deepFreeze({
        schemaVersion: HOME_VIEW_MODEL_SCHEMA_VERSION,
        identity,
        sections: {
          continue: continueSection(personalStrategy),
          recent,
          review: {
            status: reviewLater.status === 'error' && mistakes.status === 'error' ? 'error' : 'ready',
            reviewLater,
            mistakes,
          },
          personalStrategy,
          quickStart: {
            status: 'ready',
            destinations: ['gto', 'training', 'equity', 'calibration'],
          },
        },
      });
    },
  });
}
