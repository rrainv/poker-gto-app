import { createHoldemWeightedRangeFromEntries, createHoldemWeightedRangeFromHandClassWeights } from '../../../shared/poker-domain/holdem-range.js';
import { holdemComboIdForCards } from '../../../shared/poker-domain/holdem-combos.js';
import { calculateWeightedEquity, WEIGHTED_EQUITY_REQUEST_VERSION } from '../../../shared/poker-domain/weighted-equity.js';
import { exactIntentFingerprint, validateExactRangeNode } from '../personal-strategy/exact-node-intent.mjs';
import { createNaturalLanguageEnvelope } from './natural-language-envelope.mjs';

export function weightedRangePlayer(id, range, sourceRole = 'user_supplied', sourceId = 'explicit-user-range') {
  return { id, kind: 'range', range, sourceRole, sourceId, weightSemantics: 'relative_combo_likelihood' };
}
// Deliberately explicit syntax, no implicit '+' expansion or unlisted zero.
export function parseExplicitEquityRange(text, unlistedState = 'unknown') {
  const entries = [], classes = {}, seen = new Set();
  for (const token of text.trim().split(/[\s,;]+/).filter(Boolean)) {
    const match = /^([2-9TJQKA]{2}[so]?|[2-9TJQKA][shdc][2-9TJQKA][shdc]):(0(?:\.\d+)?|1(?:\.0+)?|\.\d+)$/.exec(token);
    if (!match || seen.has(match[1])) throw new RangeError('Use AA:1, AKs:0.5 or AsKh:0.2; weights 0–1');
    seen.add(match[1]);
    const [, key, weight] = match;
    if (key.length === 4) entries.push({ comboId: holdemComboIdForCards([key.slice(0, 2), key.slice(2)]), state: 'known', weight: Number(weight), provenanceId: 'manual' });
    else classes[key] = { weight: Number(weight), provenanceId: 'manual' };
  }
  const sources = [{ id: 'manual', kind: 'manual', operation: 'explicit_equity_input' }];
  const expanded = createHoldemWeightedRangeFromHandClassWeights({ handClassWeights: classes, provenanceSources: sources, unlistedState });
  const overrides = new Map(entries.map(entry => [entry.comboId, entry]));
  if (overrides.size !== entries.length) throw new RangeError('Duplicate physical combo');
  return createHoldemWeightedRangeFromEntries({ entries: expanded.entries.map(entry => overrides.get(entry.comboId) ?? entry), provenanceSources: sources });
}
export function personalTrajectoryEquityPlayer(trajectory, id = 'hero') {
  const { fingerprint, ...content } = trajectory ?? {};
  if (trajectory?.schemaVersion !== 'personal-range-trajectory/v1'
    || trajectory.sourceRole !== 'personal_intended' || trajectory.massSemantics !== 'unnormalized_action_conditioned_reach'
    || fingerprint !== exactIntentFingerprint(content)) throw new RangeError('Current exact Personal trajectory required');
  validateExactRangeNode(trajectory.node);
  return weightedRangePlayer(id, trajectory.range, 'personal_intended', fingerprint);
}
export function createPersonalEquityRequest({ trajectory, opponent, seed = 1, samples = 10000 }) {
  return { schemaVersion: WEIGHTED_EQUITY_REQUEST_VERSION,
    players: [personalTrajectoryEquityPlayer(trajectory), opponent], board: [...trajectory.node.board],
    deadCards: [...trajectory.node.deadCards], seed, samples, method: 'auto', partialPolicy: 'known_only' };
}
export async function comparePersonalRangeEquity({ left, right, opponent, seed = 1, samples = 10000 }, options) {
  if (JSON.stringify(left.node.board) !== JSON.stringify(right.node.board)
    || left.node.fingerprint !== right.node.fingerprint) return { status: 'incomparable', reason: 'different_nodes' };
  const a = await calculateWeightedEquity(createPersonalEquityRequest({ trajectory: left, opponent, seed, samples }), options);
  if (options?.signal?.aborted) return a;
  const b = await calculateWeightedEquity(createPersonalEquityRequest({ trajectory: right, opponent, seed, samples }), options);
  return { schemaVersion: 'personal-equity-comparison/v1', left: a, right: b, strategyRanking: null,
    equityDelta: a.players?.length && b.players?.length && !a.conditionalOnKnownMass && !b.conditionalOnKnownMass
      ? b.players[0].equity - a.players[0].equity : null,
    partialComparison: Boolean(a.conditionalOnKnownMass || b.conditionalOnKnownMass) };
}

export async function calculateExploitRangeEquity({ decisionContext, action, range, semantic,
  modelId, modelVersion, evidenceRefs, seed = 1, samples = 10000 }, options) {
  if (decisionContext?.schemaVersion !== 'decision-context/v1' || !['calling', 'value', 'bluffs', 'facing_bet'].includes(semantic)
    || typeof modelId !== 'string' || !modelId || typeof modelVersion !== 'string' || !modelVersion
    || !Array.isArray(evidenceRefs) || !evidenceRefs.length || evidenceRefs.some(ref => typeof ref !== 'string' || !ref)
    || (semantic === 'calling' && !['bet', 'raise'].includes(action?.type))) throw new TypeError('Explicit context/action and quantitative response range required');
  const result = await calculateWeightedEquity({ schemaVersion: WEIGHTED_EQUITY_REQUEST_VERSION,
    players: [{ id: 'hero', kind: 'exact', cards: decisionContext.heroCards }, weightedRangePlayer('opponent', range, 'explicit_opponent_model', `${modelId}:${modelVersion}:${semantic}`)],
    board: decisionContext.board, deadCards: decisionContext.deadCards ?? [], partialPolicy: 'known_only', seed, samples, method: 'auto' }, options);
  return { schemaVersion: 'exploit-range-equity/v1', semantic, result, modelId, modelVersion,
    context: structuredClone(decisionContext), action: structuredClone(action ?? null), evidenceRefs,
    assumptions: ['explicit_supplied_response_range', 'showdown_share_not_realized_action_ev'],
    roleConfirmed: false, recommendation: null,
    envelope: createNaturalLanguageEnvelope({ claimClass: 'factual', subject: { role: 'explicit_opponent_model' },
      evidenceRefs, scope: { semantic, modelId, modelVersion }, uncertainty: result.conditionalOnKnownMass ? ['known_mass_only'] : [],
      facts: { result }, permission: { normative: false } }) };
}
