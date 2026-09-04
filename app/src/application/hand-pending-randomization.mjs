import {
  CHANCE_TYPES,
  HOLDEM_DECK,
  isCard,
  validatePokerState,
} from '../../../shared/poker-domain/index.js';
import { createSeededRandom } from './deterministic-random.mjs';
import {
  createRandomizationRecipe,
  deepFreezeRandomization,
  randomizationFingerprint,
} from './randomization-recipe.mjs';

export const HAND_PENDING_RANDOMIZATION_REQUEST_VERSION = 'hand-pending-randomization-request/v1';
export const HAND_PENDING_RANDOMIZATION_RESULT_VERSION = 'hand-pending-randomization-result/v1';
export const HAND_PENDING_RANDOMIZER_VERSION = 'hand-pending-randomizer/v1';

function unavailable(code) {
  return deepFreezeRandomization({
    schemaVersion: HAND_PENDING_RANDOMIZATION_RESULT_VERSION,
    status: 'unavailable',
    code,
    cards: null,
    recipe: null,
  });
}

function pendingTarget(pendingChance) {
  if (pendingChance.type === CHANCE_TYPES.DEAL_HOLE) return { target: 'hero', count: 2 };
  const target = ({
    [CHANCE_TYPES.DEAL_FLOP]: 'flop',
    [CHANCE_TYPES.DEAL_TURN]: 'turn',
    [CHANCE_TYPES.DEAL_RIVER]: 'river',
  })[pendingChance.type];
  return target ? { target, count: pendingChance.cardCount } : null;
}

export function randomizeHandPendingDraft(request = {}) {
  if (request.schemaVersion !== HAND_PENDING_RANDOMIZATION_REQUEST_VERSION) {
    throw new TypeError('Unsupported Hand pending randomization request version');
  }
  if (!Number.isInteger(request.seed) || request.seed < 0 || request.seed > 0xffffffff) {
    throw new RangeError('Hand pending randomization seed must be uint32');
  }
  try {
    validatePokerState(request.state);
  } catch {
    return unavailable('invalid_canonical_state');
  }
  if (!request.state.pendingChance) return unavailable('no_pending_card_stage');
  const pending = pendingTarget(request.state.pendingChance);
  if (!pending) return unavailable('unsupported_pending_card_stage');
  const availableCards = Array.isArray(request.availableCards) ? [...request.availableCards] : [];
  if (availableCards.some((card) => !isCard(card) || !HOLDEM_DECK.includes(card))
    || new Set(availableCards).size !== availableCards.length) {
    return unavailable('invalid_available_cards');
  }
  if (availableCards.length < pending.count) return unavailable('insufficient_available_cards');

  const cards = createSeededRandom(request.seed).shuffle(availableCards).slice(0, pending.count);
  const inputContext = {
    canonicalStateFingerprint: randomizationFingerprint(request.state),
    pendingChance: request.state.pendingChance,
    availableCards,
  };
  const recipe = createRandomizationRecipe({
    generatorVersion: HAND_PENDING_RANDOMIZER_VERSION,
    requestVersion: HAND_PENDING_RANDOMIZATION_REQUEST_VERSION,
    sourceSurface: 'canonical_hand_pending_draft',
    target: pending.target,
    seed: request.seed,
    inputContext,
    resultContext: { target: pending.target, cards },
    details: {
      pendingChanceType: request.state.pendingChance.type,
      generatedCards: cards,
    },
  });
  return deepFreezeRandomization({
    schemaVersion: HAND_PENDING_RANDOMIZATION_RESULT_VERSION,
    status: 'available',
    code: null,
    target: pending.target,
    cards,
    recipe,
  });
}
