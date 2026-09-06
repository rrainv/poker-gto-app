import { validateEquityRequest, chooseCards, createSeededRandom, equityWinnerIndexes,
  EXACT_EQUITY_COMBINATION_LIMIT } from './equity.js';
import { conditionHoldemRange } from './holdem-range.js';
import { HOLDEM_COMBOS, HOLDEM_DECK, getHoldemComboById } from './holdem-combos.js';
import { deepFreeze } from './freeze.js';

export const WEIGHTED_EQUITY_REQUEST_VERSION = 'weighted-equity-request/v1';
export const WEIGHTED_EQUITY_RESULT_VERSION = 'weighted-equity-result/v1';
const roles = ['user_supplied', 'personal_intended', 'explicit_opponent_model', 'reference'];
const fail = (reason, status = 'unavailable', coverage = []) => deepFreeze({
  schemaVersion: WEIGHTED_EQUITY_RESULT_VERSION, status, reason, players: [], coverage,
  conditionalOnKnownMass: null, method: null,
});
const choose = (n, k) => {
  let value = 1;
  for (let i = 1; i <= k; i++) value = value * (n - i + 1) / i;
  return value;
};

// Range Core remains the representation. This wrapper declares the meaning of
// its weights for this matchup; it neither authenticates references nor derives
// a holding distribution from action-selection policy weights.
export function prepareWeightedEquity(input) {
  try {
    if (input?.schemaVersion !== WEIGHTED_EQUITY_REQUEST_VERSION) return fail('invalid_request');
    if (!['reject', 'known_only'].includes(input.partialPolicy ?? 'reject')) return fail('invalid_partial_policy');
    const projected = (input.players ?? []).map(player => {
      if (!['exact', 'range', 'uniform_unknown'].includes(player.kind)) throw Error('invalid_player_kind');
      if (player.kind === 'exact' && (!Array.isArray(player.cards) || player.cards.length !== 2)) throw Error('invalid_exact_hand');
      if (player.kind === 'range') {
        if (Object.hasOwn(player, 'cards')) throw Error('ambiguous_range_input');
        if (player.weightSemantics !== 'relative_combo_likelihood' || !roles.includes(player.sourceRole)
          || typeof player.sourceId !== 'string' || !player.sourceId.trim()) throw Error('incompatible_source_semantics');
      } else if (Object.hasOwn(player, 'range') || (player.kind === 'uniform_unknown' && Object.hasOwn(player, 'cards'))) {
        throw Error('ambiguous_player_input');
      }
      return { id: player.id, cards: player.kind === 'exact' ? player.cards : null };
    });
    const validation = validateEquityRequest({ ...input, schemaVersion: 'equity-request/v1', players: projected });
    if (!validation.ok) return fail(validation.error.code);
    const request = { ...validation.request, schemaVersion: WEIGHTED_EQUITY_REQUEST_VERSION,
      players: structuredClone(input.players), partialPolicy: input.partialPolicy ?? 'reject' };
    const fixed = [...request.board, ...request.deadCards, ...projected.flatMap(player => player.cards ?? [])];
    const fixedSet = new Set(fixed), coverage = [];
    const candidates = request.players.map(player => {
      if (player.kind === 'exact') return [{ cards: player.cards, probability: 1 }];
      let entries;
      if (player.kind === 'uniform_unknown') {
        entries = HOLDEM_COMBOS.filter(combo => !combo.cards.some(card => fixedSet.has(card)))
          .map(combo => ({ cards: combo.cards, weight: 1 }));
      } else {
        const removal = conditionHoldemRange(player.range, fixed), f = removal.facts;
        coverage.push({ playerId: player.id, sourceRole: player.sourceRole, sourceId: player.sourceId,
          provenance: player.range.provenance, rangeId: player.range.rangeId,
          knownMass: f.totalEligibleWeight, unknownMass: f.unknownEligibleCombos ? null : 0,
          unknownMassBounds: [0, f.unknownEligibleCombos], blockedKnownMass: f.blockedKnownWeight,
          blockedUnknownCombos: removal.blockedEntries.filter(entry => entry.state === 'unknown').length,
          knownCombos: f.knownEligibleCombos, unknownCombos: f.unknownEligibleCombos,
          eligibleCombos: f.eligibleCombos, comboCoverage: f.eligibleCoverageRatio,
          normalizationAvailable: f.completeAfterConditioning && f.totalEligibleWeight > 0,
          conditionalNormalizationAvailable: f.totalEligibleWeight > 0,
          conditioning: 'fixed_board_dead_and_exact_hands_before_joint_collision_conditioning' });
        entries = removal.eligibleEntries.filter(entry => entry.state === 'known' && entry.weight > 0)
          .map(entry => ({ cards: getHoldemComboById(entry.comboId).cards, weight: entry.weight }));
      }
      const mass = entries.reduce((sum, entry) => sum + entry.weight, 0);
      let cumulative = 0;
      return entries.map(entry => ({ cards: entry.cards, probability: entry.weight / mass,
        cumulative: (cumulative += entry.weight / mass) }));
    });
    const partial = coverage.some(entry => entry.unknownCombos > 0);
    if (partial && request.partialPolicy !== 'known_only') return fail('partial_range_requires_explicit_known_only', 'partial', coverage);
    if (candidates.some(entries => !entries.length)) return fail('no_positive_known_mass', 'unavailable', coverage);
    const remaining = 52 - request.deadCards.length - request.board.length - request.players.length * 2;
    const upper = candidates.reduce((total, entries) => total * entries.length, choose(remaining, 5 - request.board.length));
    return { request: deepFreeze(request), candidates, fixedSet, coverage, partial, upper };
  } catch (error) {
    return fail(error.message === 'incompatible_source_semantics' ? error.message : 'invalid_request',
      error.message === 'incompatible_source_semantics' ? 'incomparable' : 'unavailable');
  }
}

export function estimateWeightedEquity(input) {
  const p = prepareWeightedEquity(input);
  if (!p.request) return p;
  return { ok: true, combinations: p.upper, combinationsText: String(p.upper),
    exactFeasible: p.upper <= EXACT_EQUITY_COMBINATION_LIMIT, exactLimit: EXACT_EQUITY_COMBINATION_LIMIT,
    conservativeUpperBound: true };
}

function* exact(p, index = 0, hands = [], used = new Set([...p.request.board, ...p.request.deadCards]), weight = 1) {
  if (index === p.candidates.length) {
    const deck = HOLDEM_DECK.filter(card => !used.has(card));
    for (const cards of chooseCards(deck, 5 - p.request.board.length)) {
      yield { hands, board: [...p.request.board, ...cards], weight };
    }
    return;
  }
  for (const entry of p.candidates[index]) {
    if (entry.cards.some(card => used.has(card))) { yield null; continue; }
    yield* exact(p, index + 1, [...hands, entry.cards], new Set([...used, ...entry.cards]), weight * entry.probability);
  }
}

function sampleEntry(entries, random) {
  const draw = random.nextFloat();
  let lo = 0, hi = entries.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (draw < entries[mid].cumulative) hi = mid; else lo = mid + 1;
  }
  return entries[lo];
}

function* monteCarlo(p, attemptLimit) {
  const random = createSeededRandom(p.request.seed);
  let accepted = 0;
  for (let attempt = 0; attempt < attemptLimit && accepted < p.request.samples; attempt++) {
    // Reject the entire independently drawn tuple. Sequential re-normalization
    // would bias earlier players toward hands with little compatible mass.
    const hands = p.candidates.map(entries => entries.length === 1 ? entries[0].cards : sampleEntry(entries, random).cards);
    const cards = hands.flat();
    if (new Set(cards).size !== cards.length) { yield null; continue; }
    const used = new Set([...p.request.board, ...p.request.deadCards, ...cards]);
    const deck = HOLDEM_DECK.filter(card => !used.has(card));
    const missing = 5 - p.request.board.length;
    for (let i = 0; i < missing; i++) {
      const j = i + random.nextInt(deck.length - i);
      [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    accepted++;
    yield { hands, board: [...p.request.board, ...deck.slice(0, missing)], weight: 1 };
  }
}

export async function calculateWeightedEquity(input, { signal = null, onProgress = null,
  batchSize = 250, yieldControl = () => new Promise(resolve => setTimeout(resolve, 0)),
  exactLimit = EXACT_EQUITY_COMBINATION_LIMIT } = {}) {
  const p = prepareWeightedEquity(input);
  if (!p.request) return p;
  if (!Number.isInteger(batchSize) || batchSize < 1 || !Number.isInteger(exactLimit)
    || exactLimit < 1 || exactLimit > EXACT_EQUITY_COMBINATION_LIMIT) return fail('invalid_execution_options');
  const method = p.request.method === 'auto' ? (p.upper <= exactLimit ? 'exact' : 'monte_carlo') : p.request.method;
  if (method === 'exact' && p.upper > exactLimit) return fail('exact_limit_exceeded', 'unavailable', p.coverage);
  const limit = Math.min(2_000_000, Math.max(10_000, p.request.samples * 100));
  const iterator = method === 'exact' ? exact(p) : monteCarlo(p, limit);
  const shares = p.request.players.map(() => 0), wins = [...shares], ties = [...shares];
  let mass = 0, trials = 0, attempts = 0;
  try {
    for (const realization of iterator) {
      if (signal?.aborted) return fail('aborted');
      attempts++;
      if (realization) {
        const winners = equityWinnerIndexes(realization), weight = realization.weight;
        mass += weight; trials++;
        for (const i of winners) {
          shares[i] += weight / winners.length;
          (winners.length === 1 ? wins : ties)[i] += weight;
        }
      }
      if (attempts % batchSize === 0) {
        onProgress?.({ completed: trials, total: method === 'exact' ? p.upper : p.request.samples,
          attempts, conservativeUpperBound: method === 'exact' });
        await yieldControl();
      }
    }
    if (signal?.aborted) return fail('aborted');
    if (method === 'monte_carlo' && trials !== p.request.samples) return fail('joint_sampling_limit', 'unavailable', p.coverage);
    if (!(mass > 0)) return fail('no_compatible_joint_mass', 'unavailable', p.coverage);
    return deepFreeze({ schemaVersion: WEIGHTED_EQUITY_RESULT_VERSION,
      status: p.partial ? 'partial' : method === 'exact' ? 'exact' : 'estimated', reason: null,
      method, conditionalOnKnownMass: p.partial, coverage: p.coverage,
      players: p.request.players.map((player, i) => ({ id: player.id, equity: shares[i] / mass,
        winProbability: wins[i] / mass, tieProbability: ties[i] / mass })),
      trials, metadata: { seed: p.request.seed, samplesRequested: p.request.samples, attempts,
        estimatedCombinationsUpperBound: p.upper, sampler: 'independent_weighted_tuple_rejection/v1',
        jointCompatibilityProbability: method === 'exact' ? mass / choose(52 - p.request.deadCards.length - p.request.board.length - p.request.players.length * 2, 5 - p.request.board.length) : null,
        payoff: 'equal_showdown_pot_share_no_rake_or_side_pots' },
      recipe: p.request, permissions: { strategyRecommendation: false, normative: false } });
  } catch { return fail('calculation_failed'); }
}
