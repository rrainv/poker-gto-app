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

// Resolution supplies the eligible unknown players; Hero participation is irrelevant.
export function requiredPrivateRevealPlayers(state) {
  if (state?.showdown?.status !== 'awaiting_private_reveal') return [];
  return (state.showdown.requiredRevealPlayerIds ?? [])
    .map(id => state.players.find(player => player.playerId === id))
    .filter(player => player && !player.folded && !Array.isArray(player.holeCards));
}

function randomizePrivateRevealDraft(request) {
  const players = requiredPrivateRevealPlayers(request.state);
  if (!players.length) return unavailable('no_pending_card_stage');
  const bySeat = {};
  const known = [...request.state.board, ...request.state.deadCards,
    ...request.state.players.flatMap(player => Array.isArray(player.holeCards) ? player.holeCards : [])];
  for (const player of players) {
    const draft = request.bySeat?.[player.seat] ?? [];
    if (!Array.isArray(draft) || draft.length > 2) return unavailable('invalid_private_draft');
    bySeat[player.seat] = [draft[0] || null, draft[1] || null];
    known.push(...bySeat[player.seat].filter(Boolean));
  }
  if (known.some(card => !isCard(card)) || new Set(known).size !== known.length) {
    return unavailable('invalid_private_draft');
  }
  const blocked = new Set(known);
  const deck = createSeededRandom(request.seed).shuffle(HOLDEM_DECK.filter(card => !blocked.has(card)));
  const needed = Object.values(bySeat).flat().filter(card => !card).length;
  if (deck.length < needed) return unavailable('insufficient_available_cards');
  for (const cards of Object.values(bySeat)) {
    for (let slot = 0; slot < 2; slot++) if (!cards[slot]) cards[slot] = deck.pop();
  }
  const recipe = createRandomizationRecipe({
    generatorVersion: HAND_PENDING_RANDOMIZER_VERSION,
    requestVersion: HAND_PENDING_RANDOMIZATION_REQUEST_VERSION,
    sourceSurface: 'canonical_hand_pending_draft', target: 'private_reveal', seed: request.seed,
    inputContext: { state: request.state, bySeat: request.bySeat ?? {} },
    resultContext: { bySeat }, details: { generatedCardsBySeat: bySeat },
  });
  return deepFreezeRandomization({ schemaVersion: HAND_PENDING_RANDOMIZATION_RESULT_VERSION,
    status: 'available', code: null, target: 'private_reveal', bySeat, cards: null, recipe });
}

export function canRandomizeHandPublicChance({ state, availableCards, readOnly = false, busy = false } = {}) {
  if (readOnly || busy || state?.phase !== 'chance' || !state.pendingChance) return false;
  const pending = pendingTarget(state.pendingChance);
  return Boolean(pending && pending.target !== 'hero'
    && Array.isArray(availableCards) && availableCards.length >= pending.count);
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
  if (requiredPrivateRevealPlayers(request.state).length) return randomizePrivateRevealDraft(request);
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
