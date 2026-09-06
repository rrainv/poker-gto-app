import {
  GAME_RULES_COLLECTION_TYPES,
  POKER_STATE_SCHEMA_VERSION,
  POKER_STATE_V2_SCHEMA_VERSION,
  POKER_STATE_V3_SCHEMA_VERSION,
} from '../../../shared/poker-domain/index.js';

export const SAVED_STUDY_PREVIEW_FACTS_SCHEMA_VERSION = 'saved-study-preview-facts/v1';

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
}

function bbFromMilli(value) {
  return Number.isSafeInteger(value) ? value / 1000 : null;
}

function neutralSavedHandGameMode(state) {
  if (state.schemaVersion === POKER_STATE_SCHEMA_VERSION
    || (state.schemaVersion === undefined && typeof state.game?.mode === 'string')) {
    return state.game.mode;
  }
  if (![POKER_STATE_V2_SCHEMA_VERSION, POKER_STATE_V3_SCHEMA_VERSION].includes(state.schemaVersion)) {
    throw new TypeError(`Unsupported Saved Hand PokerState version: ${String(state.schemaVersion)}`);
  }
  const policyType = state.rulesSnapshot.definition.collectionPolicy.type;
  if (policyType === GAME_RULES_COLLECTION_TYPES.FIXED_PER_SEATED_PLAYER) return 'fixed';
  if (policyType === GAME_RULES_COLLECTION_TYPES.NONE) return 'off';
  throw new RangeError(`Unsupported Saved Hand collection policy: ${String(policyType)}`);
}

function savedHandPreviewFacts(object) {
  const state = object.payload.pokerState;
  const hero = state.players.find((player) => player.playerId === object.payload.heroPlayerId);
  if (!hero) throw new RangeError('Saved Hand Hero is unavailable');
  return {
    supported: true,
    kind: 'hand',
    derivation: 'canonical_hand',
    tableSize: state.players.length,
    gameMode: neutralSavedHandGameMode(state),
    heroPosition: hero.position,
    street: state.street,
    phase: state.phase,
    heroCards: Array.isArray(hero.holeCards) ? [...hero.holeCards] : null,
    board: [...state.board],
    deadCards: Array.isArray(state.deadCards) ? [...state.deadCards] : [],
    knownOpponentHands: state.players
      .filter((player) => player.playerId !== hero.playerId && Array.isArray(player.holeCards))
      .map((player) => ({
        playerId: player.playerId,
        seat: player.seat,
        position: player.position,
        cards: [...player.holeCards],
      })),
    stackBb: bbFromMilli(hero.currentStackMilliBb),
    potBb: bbFromMilli(state.potMilliBb),
    historyStatus: 'canonical_replay',
  };
}

function savedSpotPreviewFacts(object) {
  const snapshot = object.payload;
  const context = snapshot.decisionContext;
  return {
    supported: true,
    kind: 'spot',
    derivation: snapshot.derivation,
    tableSize: context.tableSize,
    gameMode: context.rakeMode,
    heroPosition: context.heroPosition,
    street: context.street,
    heroCards: Array.isArray(context.heroCards) ? [...context.heroCards] : null,
    board: [...context.board],
    deadCards: Array.isArray(context.deadCards) ? [...context.deadCards] : [],
    stackBb: context.stackBb,
    potBb: context.potBb,
    facingSizeBb: context.facingSizeBb,
    callAmountBb: context.callAmountBb,
    historyStatus: snapshot.truth.historyStatus,
  };
}

export function createSavedStudyPreviewFacts(object) {
  if (!object || object.schemaVersion !== 'saved-study-object/v1') {
    throw new TypeError('Saved preview requires SavedStudyObject v1');
  }
  const facts = object.kind === 'hand'
    ? savedHandPreviewFacts(object)
    : object.kind === 'spot'
      ? savedSpotPreviewFacts(object)
      : {
        supported: false,
        kind: object.kind,
        derivation: 'unsupported',
        historyStatus: 'not_available',
        heroCards: null,
        board: [],
        deadCards: [],
        knownOpponentHands: [],
      };
  return deepFreeze({
    schemaVersion: SAVED_STUDY_PREVIEW_FACTS_SCHEMA_VERSION,
    ...facts,
  });
}
