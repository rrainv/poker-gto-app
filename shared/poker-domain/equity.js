import {
  CARD_RANKS,
  CARD_SUITS,
  assertCardArray,
  assertUniqueKnownCards,
} from './cards.js';
import { evaluateSeven } from './evaluator.js';
import { deepFreeze } from './freeze.js';

export const EQUITY_REQUEST_SCHEMA_VERSION = 'equity-request/v1';
export const EQUITY_RESULT_SCHEMA_VERSION = 'equity-result/v1';
export const EQUITY_ERROR_SCHEMA_VERSION = 'equity-error/v1';
export const EQUITY_ESTIMATE_SCHEMA_VERSION = 'equity-estimate/v1';

export const EQUITY_METHODS = Object.freeze({
  AUTO: 'auto',
  EXACT: 'exact',
  MONTE_CARLO: 'monte_carlo',
});

export const EQUITY_ERROR_CODES = Object.freeze({
  INVALID_REQUEST: 'invalid_request',
  DUPLICATE_CARD: 'duplicate_card',
  IMPOSSIBLE_DECK: 'impossible_deck',
  EXACT_LIMIT_EXCEEDED: 'exact_limit_exceeded',
  ABORTED: 'aborted',
  INTERNAL_ERROR: 'internal_error',
});

export const DEFAULT_EQUITY_SAMPLES = 10_000;
export const DEFAULT_EQUITY_SEED = 0x6d2b79f5;
export const MIN_EQUITY_SAMPLES = 1;
export const MAX_EQUITY_SAMPLES = 1_000_000;
export const EXACT_EQUITY_COMBINATION_LIMIT = 100_000;
export const DEFAULT_EQUITY_BATCH_SIZE = 250;

const EQUITY_SHARE_UNIT_SCALE = 2520; // LCM(1..10), exact split shares for supported tables.
const MAX_SAFE_BIGINT = BigInt(Number.MAX_SAFE_INTEGER);
const FULL_DECK = Object.freeze(
  [...CARD_RANKS].flatMap((rank) => [...CARD_SUITS].map((suit) => `${rank}${suit}`)),
);

class EquityValidationError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'EquityValidationError';
    this.code = code;
  }
}

function equityError(code, message, details = {}) {
  return deepFreeze({
    schemaVersion: EQUITY_ERROR_SCHEMA_VERSION,
    code,
    message,
    details: { ...details },
  });
}

function failure(code, message, details = {}) {
  return deepFreeze({ ok: false, error: equityError(code, message, details) });
}

export function createEquityFailure(code, message, details = {}) {
  if (!Object.values(EQUITY_ERROR_CODES).includes(code)) {
    throw new RangeError(`Unsupported equity error code: ${code}`);
  }
  return failure(code, message, details);
}

function validationSuccess(request) {
  return deepFreeze({ ok: true, request });
}

function requirePlainObject(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError(`${label} must be an object`);
  }
}

function normalizeSeed(value) {
  const seed = value ?? DEFAULT_EQUITY_SEED;
  if (!Number.isInteger(seed) || seed < 0 || seed > 0xffffffff) {
    throw new RangeError('seed must be an unsigned 32-bit integer');
  }
  return seed >>> 0;
}

function normalizeSamples(value) {
  const samples = value ?? DEFAULT_EQUITY_SAMPLES;
  if (!Number.isInteger(samples)
    || samples < MIN_EQUITY_SAMPLES
    || samples > MAX_EQUITY_SAMPLES) {
    throw new RangeError(
      `samples must be an integer from ${MIN_EQUITY_SAMPLES} through ${MAX_EQUITY_SAMPLES}`,
    );
  }
  return samples;
}

function normalizeRequest(input) {
  requirePlainObject(input, 'EquityRequest');
  if (input.schemaVersion !== EQUITY_REQUEST_SCHEMA_VERSION) {
    throw new TypeError(`Expected ${EQUITY_REQUEST_SCHEMA_VERSION}`);
  }
  if (!Array.isArray(input.players) || input.players.length < 2 || input.players.length > 10) {
    throw new RangeError('players must contain 2 through 10 entries');
  }

  const ids = new Set();
  const players = input.players.map((player, index) => {
    requirePlainObject(player, `players[${index}]`);
    if (typeof player.id !== 'string' || !player.id.trim()) {
      throw new TypeError(`players[${index}].id must be a non-empty string`);
    }
    if (ids.has(player.id)) throw new RangeError(`Duplicate player id: ${player.id}`);
    ids.add(player.id);

    if (player.cards === null) return { id: player.id, cards: null };
    assertCardArray(player.cards, `players[${index}].cards`);
    if (player.cards.length !== 2) {
      throw new RangeError(`players[${index}].cards must be null or contain exactly two cards`);
    }
    return { id: player.id, cards: [...player.cards] };
  });

  const board = [...(input.board ?? [])];
  const deadCards = [...(input.deadCards ?? [])];
  assertCardArray(board, 'board');
  assertCardArray(deadCards, 'deadCards');
  if (board.length > 5) throw new RangeError('board cannot contain more than five cards');

  const method = input.method ?? EQUITY_METHODS.AUTO;
  if (!Object.values(EQUITY_METHODS).includes(method)) {
    throw new RangeError('method must be auto, exact, or monte_carlo');
  }

  const normalized = {
    schemaVersion: EQUITY_REQUEST_SCHEMA_VERSION,
    players,
    board,
    deadCards,
    method,
    samples: normalizeSamples(input.samples),
    seed: normalizeSeed(input.seed),
  };

  // Card syntax has already been checked, so any failure here is specifically duplication.
  try {
    assertUniqueKnownCards([
      ...players
        .filter((player) => player.cards !== null)
        .map((player) => ({ label: `players.${player.id}.cards`, cards: player.cards })),
      { label: 'board', cards: board },
      { label: 'deadCards', cards: deadCards },
    ]);
  } catch (error) {
    throw new EquityValidationError(
      EQUITY_ERROR_CODES.DUPLICATE_CARD,
      error instanceof Error ? error.message : String(error),
    );
  }

  const knownCardCount = players.reduce(
    (sum, player) => sum + (player.cards === null ? 0 : 2),
    board.length + deadCards.length,
  );
  const unknownCardCount = players.filter((player) => player.cards === null).length * 2;
  const boardCardsMissing = 5 - board.length;
  if (knownCardCount + unknownCardCount + boardCardsMissing > 52) {
    throw new EquityValidationError(
      EQUITY_ERROR_CODES.IMPOSSIBLE_DECK,
      'Known, unknown, board, and dead cards cannot fit in one deck',
    );
  }

  return deepFreeze(normalized);
}

export function validateEquityRequest(input) {
  try {
    return validationSuccess(normalizeRequest(input));
  } catch (error) {
    if (error instanceof EquityValidationError) {
      return failure(error.code, error.message);
    }
    return failure(
      EQUITY_ERROR_CODES.INVALID_REQUEST,
      error instanceof Error ? error.message : String(error),
    );
  }
}

function chooseBigInt(total, count) {
  if (!Number.isInteger(total) || !Number.isInteger(count) || count < 0 || count > total) return 0n;
  const reducedCount = Math.min(count, total - count);
  let result = 1n;
  for (let index = 1; index <= reducedCount; index += 1) {
    result = (result * BigInt(total - reducedCount + index)) / BigInt(index);
  }
  return result;
}

function estimateNormalizedRequest(request) {
  const knownCards = request.players.flatMap((player) => player.cards ?? [])
    .concat(request.board, request.deadCards);
  let availableCards = 52 - knownCards.length;
  let combinations = 1n;
  for (const player of request.players) {
    if (player.cards !== null) continue;
    combinations *= chooseBigInt(availableCards, 2);
    availableCards -= 2;
  }
  combinations *= chooseBigInt(availableCards, 5 - request.board.length);
  return combinations;
}

function estimateResult(combinations) {
  return deepFreeze({
    ok: true,
    schemaVersion: EQUITY_ESTIMATE_SCHEMA_VERSION,
    combinations: combinations <= MAX_SAFE_BIGINT ? Number(combinations) : null,
    combinationsText: combinations.toString(),
    exceedsSafeInteger: combinations > MAX_SAFE_BIGINT,
    exactLimit: EXACT_EQUITY_COMBINATION_LIMIT,
    exactFeasible: combinations <= BigInt(EXACT_EQUITY_COMBINATION_LIMIT),
  });
}

export function estimateEquityCombinations(input) {
  const validation = validateEquityRequest(input);
  if (!validation.ok) return validation;
  return estimateResult(estimateNormalizedRequest(validation.request));
}

function remainingDeck(request) {
  const excluded = new Set([
    ...request.players.flatMap((player) => player.cards ?? []),
    ...request.board,
    ...request.deadCards,
  ]);
  return FULL_DECK.filter((card) => !excluded.has(card));
}

export function* chooseCards(cards, count, start = 0, chosen = []) {
  if (chosen.length === count) {
    yield [...chosen];
    return;
  }
  const cardsStillNeeded = count - chosen.length;
  for (let index = start; index <= cards.length - cardsStillNeeded; index += 1) {
    chosen.push(cards[index]);
    yield* chooseCards(cards, count, index + 1, chosen);
    chosen.pop();
  }
}

function* exactRealizations(request) {
  const hands = request.players.map((player) => (
    player.cards === null ? null : [...player.cards]
  ));
  const unknownIndexes = request.players
    .map((player, index) => (player.cards === null ? index : -1))
    .filter((index) => index >= 0);
  const missingBoard = 5 - request.board.length;

  function* assignUnknown(unknownOffset, deck) {
    if (unknownOffset === unknownIndexes.length) {
      for (const boardCards of chooseCards(deck, missingBoard)) {
        yield { hands, board: [...request.board, ...boardCards] };
      }
      return;
    }

    const playerIndex = unknownIndexes[unknownOffset];
    for (const cards of chooseCards(deck, 2)) {
      const chosen = new Set(cards);
      hands[playerIndex] = cards;
      yield* assignUnknown(
        unknownOffset + 1,
        deck.filter((card) => !chosen.has(card)),
      );
    }
    hands[playerIndex] = null;
  }

  yield* assignUnknown(0, remainingDeck(request));
}

export function createSeededRandom(seed) {
  let state = seed >>> 0;
  const nextUint32 = () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return (value ^ (value >>> 14)) >>> 0;
  };
  const nextInt = (upperExclusive) => {
    const range = 0x100000000;
    const limit = Math.floor(range / upperExclusive) * upperExclusive;
    let value;
    do value = nextUint32(); while (value >= limit);
    return value % upperExclusive;
  };
  return Object.freeze({ nextInt, nextFloat: () => nextUint32() / 0x100000000 });
}

function* monteCarloRealizations(request) {
  const deck = remainingDeck(request);
  const unknownIndexes = request.players
    .map((player, index) => (player.cards === null ? index : -1))
    .filter((index) => index >= 0);
  const needed = unknownIndexes.length * 2 + (5 - request.board.length);
  const random = createSeededRandom(request.seed);

  for (let trial = 0; trial < request.samples; trial += 1) {
    const sampledDeck = [...deck];
    for (let index = 0; index < needed; index += 1) {
      const selected = index + random.nextInt(sampledDeck.length - index);
      [sampledDeck[index], sampledDeck[selected]] = [sampledDeck[selected], sampledDeck[index]];
    }

    let offset = 0;
    const hands = request.players.map((player) => {
      if (player.cards !== null) return player.cards;
      const cards = [sampledDeck[offset], sampledDeck[offset + 1]];
      offset += 2;
      return cards;
    });
    const board = [
      ...request.board,
      ...sampledDeck.slice(offset, offset + (5 - request.board.length)),
    ];
    yield { hands, board };
  }
}

function createAccumulator(request) {
  return {
    wins: request.players.map(() => 0),
    ties: request.players.map(() => 0),
    equityShareUnits: request.players.map(() => 0),
    trials: 0,
    splitPotTrials: 0,
  };
}

export function equityWinnerIndexes(realization) {
  const scores = realization.hands.map((hand) => (
    evaluateSeven([...hand, ...realization.board]).score
  ));
  const bestScore = Math.max(...scores);
  const winnerIndexes = scores
    .map((score, index) => (score === bestScore ? index : -1))
    .filter((index) => index >= 0);
  return winnerIndexes;
}

function recordRealization(accumulator, realization) {
  const winnerIndexes = equityWinnerIndexes(realization);
  if (winnerIndexes.length === 1) {
    accumulator.wins[winnerIndexes[0]] += 1;
  } else {
    accumulator.splitPotTrials += 1;
    for (const index of winnerIndexes) accumulator.ties[index] += 1;
  }
  const shareUnits = EQUITY_SHARE_UNIT_SCALE / winnerIndexes.length;
  for (const index of winnerIndexes) accumulator.equityShareUnits[index] += shareUnits;
  accumulator.trials += 1;
}

function buildResult(request, method, estimate, accumulator) {
  const trials = accumulator.trials;
  const players = request.players.map((player, index) => ({
    id: player.id,
    wins: accumulator.wins[index],
    ties: accumulator.ties[index],
    losses: trials - accumulator.wins[index] - accumulator.ties[index],
    equity: accumulator.equityShareUnits[index] / (trials * EQUITY_SHARE_UNIT_SCALE),
    winProbability: accumulator.wins[index] / trials,
    tieProbability: accumulator.ties[index] / trials,
  }));

  return deepFreeze({
    schemaVersion: EQUITY_RESULT_SCHEMA_VERSION,
    method,
    exact: method === EQUITY_METHODS.EXACT,
    players,
    trials,
    combinationsEvaluated: trials,
    metadata: {
      seed: request.seed,
      samplesRequested: method === EQUITY_METHODS.MONTE_CARLO ? request.samples : null,
      samplesCompleted: method === EQUITY_METHODS.MONTE_CARLO ? trials : null,
      unknownPlayers: request.players.filter((player) => player.cards === null).length,
      unknownCards: request.players.filter((player) => player.cards === null).length * 2,
      boardCardsMissing: 5 - request.board.length,
      estimatedCombinations: estimate.combinations,
      estimatedCombinationsText: estimate.combinationsText,
      exactCombinationLimit: EXACT_EQUITY_COMBINATION_LIMIT,
      splitPotTrials: accumulator.splitPotTrials,
      durationMs: null,
    },
  });
}

function actualMethod(request, estimate) {
  const fullyKnownRiver = request.board.length === 5
    && request.players.every((player) => player.cards !== null);
  if (fullyKnownRiver) return EQUITY_METHODS.EXACT;
  if (request.method === EQUITY_METHODS.AUTO) {
    return estimate.exactFeasible ? EQUITY_METHODS.EXACT : EQUITY_METHODS.MONTE_CARLO;
  }
  return request.method;
}

function prepareCalculation(input, forcedMethod = null) {
  const validation = validateEquityRequest(input);
  if (!validation.ok) return validation;
  const request = forcedMethod === null
    ? validation.request
    : deepFreeze({ ...validation.request, method: forcedMethod });
  const estimate = estimateResult(estimateNormalizedRequest(request));
  const method = actualMethod(request, estimate);
  if (method === EQUITY_METHODS.EXACT && !estimate.exactFeasible) {
    return failure(
      EQUITY_ERROR_CODES.EXACT_LIMIT_EXCEEDED,
      `Exact enumeration requires ${estimate.combinationsText} realizations, above the ${EXACT_EQUITY_COMBINATION_LIMIT} limit`,
      {
        estimatedCombinations: estimate.combinations,
        estimatedCombinationsText: estimate.combinationsText,
        exactCombinationLimit: EXACT_EQUITY_COMBINATION_LIMIT,
      },
    );
  }
  return { ok: true, request, estimate, method };
}

function executeSync(prepared) {
  const accumulator = createAccumulator(prepared.request);
  const realizations = prepared.method === EQUITY_METHODS.EXACT
    ? exactRealizations(prepared.request)
    : monteCarloRealizations(prepared.request);
  for (const realization of realizations) recordRealization(accumulator, realization);
  return buildResult(prepared.request, prepared.method, prepared.estimate, accumulator);
}

export function calculateEquityExact(input) {
  const prepared = prepareCalculation(input, EQUITY_METHODS.EXACT);
  if (!prepared.ok) return prepared;
  return executeSync(prepared);
}

export function calculateEquityMonteCarlo(input) {
  const prepared = prepareCalculation(input, EQUITY_METHODS.MONTE_CARLO);
  if (!prepared.ok) return prepared;
  return executeSync(prepared);
}

function progressSnapshot(completed, total) {
  return deepFreeze({ completed, total, fraction: total === 0 ? 1 : completed / total });
}

function reportProgress(callback, completed, total) {
  if (typeof callback === 'function') callback(progressSnapshot(completed, total));
}

function defaultYieldControl() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

export async function calculateEquity(input, {
  signal = null,
  onProgress = null,
  batchSize = DEFAULT_EQUITY_BATCH_SIZE,
  yieldControl = defaultYieldControl,
} = {}) {
  const prepared = prepareCalculation(input);
  if (!prepared.ok) return prepared;
  if (!Number.isInteger(batchSize) || batchSize < 1) {
    return failure(EQUITY_ERROR_CODES.INVALID_REQUEST, 'batchSize must be a positive integer');
  }

  const total = prepared.method === EQUITY_METHODS.EXACT
    ? prepared.estimate.combinations
    : prepared.request.samples;
  const accumulator = createAccumulator(prepared.request);
  const realizations = prepared.method === EQUITY_METHODS.EXACT
    ? exactRealizations(prepared.request)
    : monteCarloRealizations(prepared.request);

  reportProgress(onProgress, 0, total);
  try {
    for (const realization of realizations) {
      if (signal?.aborted) {
        return failure(EQUITY_ERROR_CODES.ABORTED, 'Equity calculation was cancelled', {
          completed: accumulator.trials,
          total,
          method: prepared.method,
        });
      }
      recordRealization(accumulator, realization);
      if (accumulator.trials % batchSize === 0 && accumulator.trials < total) {
        reportProgress(onProgress, accumulator.trials, total);
        await yieldControl();
      }
    }
    reportProgress(onProgress, accumulator.trials, total);
    return buildResult(prepared.request, prepared.method, prepared.estimate, accumulator);
  } catch (error) {
    return failure(
      EQUITY_ERROR_CODES.INTERNAL_ERROR,
      error instanceof Error ? error.message : String(error),
    );
  }
}
