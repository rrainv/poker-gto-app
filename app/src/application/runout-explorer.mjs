import { calculateWeightedEquity, prepareWeightedEquity, WEIGHTED_EQUITY_REQUEST_VERSION } from '../../../shared/poker-domain/weighted-equity.js';
import { HOLDEM_DECK, getHoldemComboById } from '../../../shared/poker-domain/holdem-combos.js';
import { conditionHoldemRange } from '../../../shared/poker-domain/holdem-range.js';
import { deepFreeze } from '../../../shared/poker-domain/freeze.js';
import { createExactEnteredHandOutcomeFacts, evaluateAvailableCards as rank } from './equity-hand-analysis.mjs';

export const RUNOUT_EXPLORER_VERSION = 'runout-explorer/v1';
export function asWeightedEquityRequest(input) {
  if (input?.schemaVersion === WEIGHTED_EQUITY_REQUEST_VERSION) return structuredClone(input);
  if (input?.schemaVersion !== 'equity-request/v1') throw new TypeError('Canonical Equity request required');
  return { ...structuredClone(input), schemaVersion: WEIGHTED_EQUITY_REQUEST_VERSION,
    players: input.players.map(player => player.cards === null
      ? { id: player.id, kind: 'uniform_unknown' } : { ...player, kind: 'exact' }) };
}
export function rangeStandingFacts(request, heroId = request.players[0].id) {
  const hero = request.players.find(player => player.id === heroId);
  const opponent = request.players.find(player => player.id !== heroId);
  if (request.players.length !== 2 || hero?.kind !== 'exact' || opponent?.kind !== 'range'
    || request.board.length < 3) return null;
  const removal = conditionHoldemRange(opponent.range, [...request.board, ...request.deadCards, ...hero.cards]);
  const heroRank = rank([...hero.cards, ...request.board]);
  let ahead = 0, tied = 0, behind = 0;
  const categories = {};
  for (const entry of removal.eligibleEntries) {
    if (entry.state !== 'known' || entry.weight <= 0) continue;
    const other = rank([...getHoldemComboById(entry.comboId).cards, ...request.board]);
    if (heroRank.score > other.score) ahead += entry.weight;
    else if (heroRank.score === other.score) tied += entry.weight; else behind += entry.weight;
    categories[other.category] = (categories[other.category] ?? 0) + entry.weight;
  }
  const mass = ahead + tied + behind;
  return mass > 0 ? { definition: 'current_made_hand_vs_known_eligible_opponent_mass',
    ahead: ahead / mass, tied: tied / mass, behind: behind / mass,
    conditionalOnKnownMass: removal.facts.unknownEligibleCombos > 0,
    categories, knownMass: mass, futureLock: null, percentile: null } : null;
}
export function runoutCardFacts(request, cards, heroId = request.players[0].id) {
  const hero = request.players.find(player => player.id === heroId);
  const board = [...request.board, ...cards];
  const current = hero?.kind === 'exact' ? rank([...hero.cards, ...request.board]) : null;
  const resulting = hero?.kind === 'exact' ? rank([...hero.cards, ...board]) : null;
  const exactPlayers = request.players.every(player => player.kind === 'exact');
  const outcomes = exactPlayers ? createExactEnteredHandOutcomeFacts({
    players: request.players.map(player => ({ id: player.id, cards: player.cards })),
    board, deadCards: request.deadCards }).players : [];
  return { cards, resultingHand: resulting, categoryImproved: current && resulting ? resulting.categoryRank > current.categoryRank : null,
    completion: current && resulting && resulting.categoryRank > current.categoryRank
      ? { category: resulting.category, fromCategory: current.category, redraw: null } : null,
    enteredStanding: outcomes.find(player => player.id === heroId)?.currentStanding ?? null,
    standing: rangeStandingFacts({ ...request, board }, heroId),
    removal: request.players.filter(player => player.kind === 'range').map(player => ({ playerId: player.id,
      before: conditionHoldemRange(player.range, [...request.board, ...request.deadCards,
        ...request.players.filter(p => p.kind === 'exact').flatMap(p => p.cards)]).facts,
      after: conditionHoldemRange(player.range, [...board, ...request.deadCards,
        ...request.players.filter(p => p.kind === 'exact').flatMap(p => p.cards)]).facts,
      derivation: 'public_card_removal_only_no_action_conditioning' })) };
}

export async function exploreRunouts(input, { sequences = null, heroId = input.players?.[0]?.id,
  signal = null, onProgress = null, samples = 500, calculate = calculateWeightedEquity } = {}) {
  const prepared = prepareWeightedEquity(asWeightedEquityRequest(input));
  if (!prepared.request) return prepared;
  const request = prepared.request;
  if (![3, 4].includes(request.board.length)) return { status: 'unavailable', reason: 'flop_or_turn_required' };
  if (!Number.isInteger(samples) || samples < 1 || samples > 2000) return { status: 'unavailable', reason: 'preview_sample_limit' };
  if (!request.players.some(player => player.id === heroId)) return { status: 'unavailable', reason: 'invalid_hero' };
  const legal = HOLDEM_DECK.filter(card => !prepared.fixedSet.has(card));
  const paths = sequences ?? legal.map(card => [card]);
  if (!Array.isArray(paths) || !paths.length || paths.length > 52 || paths.some(path => !Array.isArray(path)
    || !path.length || path.length > 5 - request.board.length || new Set(path).size !== path.length
    || path.some(card => !legal.includes(card)))) return { status: 'unavailable', reason: 'illegal_runout' };
  // 53 calculations at most, each capped at 2,000 exact realizations or samples.
  const bounded = { ...request, method: 'auto', samples };
  const baseline = await calculate(bounded, { signal, exactLimit: 2000 });
  if (!baseline.players?.length) return baseline;
  const rows = [], base = baseline.players.find(player => player.id === heroId).equity;
  for (const cards of paths) {
    if (signal?.aborted) return { status: 'unavailable', reason: 'aborted' };
    const result = await calculate({ ...bounded, board: [...request.board, ...cards] }, { signal, exactLimit: 2000 });
    if (signal?.aborted) return { status: 'unavailable', reason: 'aborted' };
    const equity = result.players?.find(player => player.id === heroId)?.equity ?? null;
    // One top-level replay request owns large range/provenance values. Do not
    // copy 1,326-entry ranges into every card row sent across the worker boundary.
    const { recipe: _recipe, coverage: resultCoverage, ...rowResult } = result;
    rowResult.coverage = resultCoverage?.map(({ provenance: _provenance, ...coverage }) => coverage) ?? [];
    rows.push({ ...runoutCardFacts(request, cards, heroId), result: rowResult, equity,
      equityDelta: equity === null ? null : equity - base,
      deltaEstimated: baseline.method !== 'exact' || result.method !== 'exact' });
    onProgress?.({ completed: rows.length, total: paths.length });
  }
  return deepFreeze({ schemaVersion: RUNOUT_EXPLORER_VERSION, status: baseline.status,
    baseline, heroId, rows, recipe: { request: bounded, sequences: paths, heroId },
    cardProbabilities: null, scope: 'conditional_hypothetical_runouts_not_equally_likely_cards',
    actionConditioning: 'unchanged', strategyRecommendation: false });
}

export function groupRunouts(rows, by = 'rank') {
  if (!['rank', 'suit', 'category'].includes(by)) throw new RangeError('Unsupported grouping');
  const groups = new Map();
  for (const row of rows) {
    const key = by === 'category' ? row.resultingHand?.category ?? 'range'
      : row.cards.map(card => card[by === 'rank' ? 0 : 1]).join(' → ');
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row);
  }
  return [...groups].map(([key, entries]) => ({ key, rows: entries }));
}
