import { HOLDEM_COMBOS, PREFLOP_HAND_CLASSES, applyAction, applyChance, createAction,
  initializeHandFromGameRulesSnapshot, createGameRulesSnapshotFromLegacyGameConfiguration,
  createHoldemWeightedRangeFromEntries, getHoldemComboById, conditionHoldemRange,
  inspectHoldemWeightedRange, getLegalActionSpec, HOLDEM_DECK } from '../../../shared/poker-domain/index.js';
import { multiplyHoldemRangeByActionFrequencies } from '../../../shared/poker-domain/holdem-range-action.js';
import { createCanonicalHandReplaySource, deriveCanonicalHandReplayEvent } from './canonical-hand-replay-source.mjs';
import { createExactRangeNode, validateExactRangeNode, exactNodeState, createExactIntentAction,
  validateExactIntentAction, exactComboDecisionContext, exactActionKey, sameExactRangeNode,
  exactNodeIntentHeads, validateExactNodeIntentHistory, exactIntentFingerprint,
  canonicalIntentContent } from '../personal-strategy/exact-node-intent.mjs';
import { deriveExactHandFacts } from './range-analysis.mjs';
import { freezeLanguageData as freeze } from './natural-language-envelope.mjs';

export const PERSONAL_RANGE_TRAJECTORY_VERSION = 'personal-range-trajectory/v1';
export function personalExactAmountFromBb(value) {
  if (String(value).trim() === '') throw new RangeError('Exact size required');
  const scaled = Number(value) * 1000, amount = Math.round(scaled);
  if (!Number.isSafeInteger(amount) || amount <= 0 || Math.abs(scaled - amount) > 1e-7) throw new RangeError('Exact milli-bb amount required');
  return amount;
}
const signed = value => freeze(structuredClone({ ...value, fingerprint: exactIntentFingerprint(value) }));
function snapshotMatches(record, snapshot) {
  return ['profileId','modeId','setupVersion','approachVersion'].every(key => record[key] === snapshot[key]);
}
export function createPersonalHandBranch({ tableSize = 6, stackBb = 100, board = ['Qs','8c','4h'], rulesSnapshot = null } = {}) {
  if (!Number.isInteger(tableSize) || tableSize < 3 || tableSize > 10 || !Number.isFinite(stackBb) || stackBb < 10 || stackBb > 500) throw new RangeError('Unsupported BTN hand study setup');
  rulesSnapshot ??= createGameRulesSnapshotFromLegacyGameConfiguration({ mode: 'home', smallBlindMilliBb: 500,
    bigBlindMilliBb: 1000, chipUnitMilliBb: 1, ante: { type: 'none', amountMilliBb: 0 } }, tableSize);
  let state = initializeHandFromGameRulesSnapshot({ handId: `personal-btn-open/v1:${tableSize}:${stackBb}`,
    rulesSnapshot, buttonSeat: 0, players: Array.from({ length: tableSize }, (_, seat) => ({
      playerId: `study-player-${seat}`, seat, startingStackMilliBb: Math.round(stackBb * 1000) })) });
  const heroPlayerId = state.players.find(player => player.position === 'BTN').playerId, events = [];
  const push = (operation, next) => {
    events.push(deriveCanonicalHandReplayEvent({ sequence: events.length, operation,
      previousState: events.length ? state : null, state: next })); state = next;
  };
  const source = () => createCanonicalHandReplaySource({ heroPlayerId, events });
  push('initialize_hand', state);
  push('deal_hole_observed', applyChance(state, { type: 'deal_hole', cardsByPlayer: {}, hiddenPlayerIds: state.players.map(player => player.playerId) }));
  while (state.actingPlayerId !== heroPlayerId) push('action', applyAction(state, createAction(state.actingPlayerId, 'fold')));
  const preflopNode = createExactRangeNode({ replaySource: source() });
  const preflopAction = createExactIntentAction(preflopNode, 'raise', 2500);
  const preflopFoldAction = createExactIntentAction(preflopNode, 'fold');
  push('action', applyAction(state, preflopAction.action));
  push('action', applyAction(state, createAction(state.actingPlayerId, 'fold')));
  push('action', applyAction(state, createAction(state.actingPlayerId, 'call')));
  push('deal_board', applyChance(state, { type: 'deal_flop', cards: board }));
  push('action', applyAction(state, createAction(state.actingPlayerId, 'check')));
  const flopNode = createExactRangeNode({ replaySource: source() });
  const actions = personalNodeActions(flopNode);
  const actionSizeHints = actions.map(action => ({ potFraction: action.action.type === 'bet' ? action.amountMilliBb / state.potMilliBb : null }));
  return freeze({ preflopNode, flopNode, preflopAction, preflopFoldAction, actions, actionSizeHints });
}
// Percent-of-pot is a UI recipe; the persisted action is its rounded canonical
// street-total amount. Both requested fraction and actual amount are displayed.
export function personalNodeActions(node) {
  const state = exactNodeState(node), legal = getLegalActionSpec(state), actions = [];
  for (const type of ['fold','check','call']) if (legal[type].available) actions.push(createExactIntentAction(node, type));
  if (legal.bet.available) for (const fraction of [0.25, 0.33, 0.5, 0.75, 1, 1.5]) {
    const amount = Math.round(state.potMilliBb * fraction / state.game.chipUnitMilliBb) * state.game.chipUnitMilliBb;
    if (amount >= legal.bet.minToMilliBb && amount <= legal.bet.maxToMilliBb
      && !actions.some(entry => entry.amountMilliBb === amount)) actions.push(createExactIntentAction(node, 'bet', amount));
  }
  if (legal.raise.available) for (const amount of [legal.raise.minToMilliBb, legal.raise.maxToMilliBb]) {
    if (!actions.some(entry => entry.amountMilliBb === amount)) actions.push(createExactIntentAction(node, 'raise', amount));
  }
  if (legal.allIn.available) actions.push(createExactIntentAction(node, 'all_in'));
  return freeze(actions);
}

// A fixed response is a visible study assumption, never a sampled opponent range.
export function continuePersonalHandNode({ node, action, card, opponentBetMilliBb = null } = {}) {
  validateExactRangeNode(node); validateExactIntentAction(node, action);
  let state = exactNodeState(node);
  const events = [...node.replaySource.events];
  const push = (operation, next) => {
    events.push(deriveCanonicalHandReplayEvent({ sequence: events.length, operation, previousState: state, state: next })); state = next;
  };
  push('action', applyAction(state, action.action));
  while (state.phase === 'betting' && state.actingPlayerId !== node.actorId) {
    const legal = getLegalActionSpec(state);
    push('action', applyAction(state, createAction(state.actingPlayerId, legal.call.available ? 'call' : 'check')));
  }
  if (node.street === 'river' || !['flop','turn'].includes(node.street)
    || state.players.find(player => player.playerId === node.actorId).currentStackMilliBb === 0
    || state.terminal.isTerminal || state.phase === 'showdown') {
    return freeze({ available: false, reason: 'branch_has_no_further_hero_decision', state });
  }
  push('deal_board', applyChance(state, { type: node.street === 'flop' ? 'deal_turn' : 'deal_river', cards: [card] }));
  if (state.phase !== 'betting') return freeze({ available: false, reason: 'branch_has_no_further_hero_decision', state });
  if (state.actingPlayerId !== node.actorId) push('action', applyAction(state,
    createAction(state.actingPlayerId, opponentBetMilliBb === null ? 'check' : 'bet', opponentBetMilliBb)));
  return freeze({ available: true, node: createExactRangeNode({ replaySource: createCanonicalHandReplaySource({ heroPlayerId: node.actorId, events }) }) });
}

export function personalNodeContext(node) {
  const state = exactNodeState(node), hero = state.players.find(player => player.playerId === node.actorId);
  return freeze({ street: node.street, board: node.board, potBb: state.potMilliBb / 1000,
    heroStackBb: hero.currentStackMilliBb / 1000, heroPosition: hero.position,
    players: state.players.map(player => ({ playerId: player.playerId, position: player.position })),
    history: node.history.map(entry => ({ street: entry.street, playerId: entry.playerId, type: entry.submittedAction.type,
      amountMilliBb: ['check','fold'].includes(entry.submittedAction.type) ? null
        : entry.submittedAction.type === 'call' ? entry.committedMilliBb : entry.streetContributionAfterMilliBb })),
    availableCards: HOLDEM_DECK.filter(card => ![...node.board, ...node.deadCards].includes(card)),
    legal: getLegalActionSpec(state), assumption: 'fixed_opponent_actions' });
}

export function inspectPersonalActionBranch({ study, action }) {
  const policy = createExactNodeActionRange({ node: study.node, action, approachSnapshot: study.approachSnapshot,
    records: study.exactNodeIntents.filter(record => sameExactRangeNode(record.node, study.node)) });
  const trajectory = conditionPersonalRangeAction({ prior: study.trajectory, policy });
  return freeze({ action, trajectoryFingerprint: trajectory.fingerprint,
    positive: trajectory.boardRemoval.eligibleEntries.filter(entry => entry.state === 'known' && entry.weight > 0).length,
    unknown: trajectory.coverage.unknownEligibleCombos });
}

// Rebuild every edge from durable intent plus canonical replay. Nothing derived is stored.
export function rebuildPersonalHandTrajectory({ preflopNode, targetNode, records, approachSnapshot }) {
  validateExactRangeNode(targetNode);
  const before = preflopNode.replaySource.events, events = targetNode.replaySource.events;
  if (canonicalIntentContent(events.slice(0, before.length)) !== canonicalIntentContent(before)
    || targetNode.actorId !== preflopNode.actorId) throw new RangeError('Incompatible study history');
  let trajectory = createPersonalRangePrior({ node: preflopNode, approachSnapshot });
  const stages = [];
  for (let i = before.length; i < events.length; i++) {
    const event = events[i];
    if (event.operation !== 'action' || event.payload.action.playerId !== targetNode.actorId) continue;
    const node = createExactRangeNode({ replaySource: createCanonicalHandReplaySource({ heroPlayerId: targetNode.actorId, events: events.slice(0, i) }) });
    if (!sameExactRangeNode(trajectory.node, node)) trajectory = advancePersonalRangeToNode({ prior: trajectory, nextNode: node });
    const action = createExactIntentAction(node, event.payload.action.type, event.payload.action.amountToMilliBb);
    const policy = createExactNodeActionRange({ node, action, approachSnapshot, records: records.filter(record => sameExactRangeNode(record.node, node)) });
    const conditioned = conditionPersonalRangeAction({ prior: trajectory, policy });
    stages.push({ node, incoming: trajectory, conditioned }); trajectory = conditioned;
  }
  trajectory = advancePersonalRangeToNode({ prior: trajectory, nextNode: targetNode });
  return freeze({ trajectory, stages });
}
export function resolveExactComboIntent(records, comboId) {
  const combo = getHoldemComboById(comboId);
  const heads = exactNodeIntentHeads(records).filter(record => record.subject.kind === 'combo'
    ? record.subject.comboId === comboId : record.subject.handClass === combo.handClass);
  const evidenceRefs = heads.map(record => record.id).sort();
  if (!heads.length) return { precision: 'unknown', distribution: null, preferredAction: null, evidenceRefs };
  const exact = heads.filter(record => record.precision === 'exact'), dominant = heads.filter(record => record.precision === 'dominant');
  const distributionKey = record => canonicalIntentContent(record.distribution);
  const exactDisagreement = new Set(exact.map(distributionKey)).size > 1;
  const dominantDisagreement = new Set(dominant.map(record => exactActionKey(record.preferredAction))).size > 1;
  const mix = exact[0]?.distribution;
  const greatest = mix ? Math.max(...mix.map(entry => entry.probability)) : null;
  const leaders = mix?.filter(entry => entry.probability === greatest) ?? [];
  const incompatible = mix && dominant.some(record => leaders.length !== 1 || exactActionKey(leaders[0].action) !== exactActionKey(record.preferredAction));
  if (exactDisagreement || dominantDisagreement || incompatible) return { precision: 'conflict', distribution: null, preferredAction: null, evidenceRefs };
  return { precision: mix ? 'exact' : 'dominant', distribution: mix ?? null,
    preferredAction: mix ? null : dominant[0].preferredAction, evidenceRefs };
}
export function createExactNodeActionRange({ node, action, records = [], approachSnapshot } = {}) {
  validateExactRangeNode(node); validateExactIntentAction(node, action); validateExactNodeIntentHistory(records);
  if (!approachSnapshot || ['profileId','modeId'].some(key => typeof approachSnapshot[key] !== 'string')
    || ['setupVersion','approachVersion'].some(key => !Number.isSafeInteger(approachSnapshot[key]) || approachSnapshot[key] < 1)) throw new TypeError('Approach snapshot required');
  if (records.some(record => !snapshotMatches(record, approachSnapshot) || !sameExactRangeNode(record.node, node))) throw new RangeError('Incompatible node or Approach evidence');
  const lineage = [], entries = [], provenanceSources = [];
  for (const combo of HOLDEM_COMBOS) {
    const policy = resolveExactComboIntent(records, combo.id), provenanceId = `combo:${combo.id}`;
    lineage.push({ comboId: combo.id, precision: policy.precision, evidenceRefs: policy.evidenceRefs });
    provenanceSources.push({ id: provenanceId, kind: 'personal_direct', sourceId: policy.evidenceRefs.join('|') || 'unmapped',
      sourceSchemaVersion: 'personal-exact-node-intent/v1', operation: 'explicit_exact_node_action_frequency/v1' });
    entries.push(policy.precision === 'exact'
      ? { comboId: combo.id, state: 'known', weight: policy.distribution.find(entry => exactActionKey(entry.action) === exactActionKey(action))?.probability ?? 0, provenanceId }
      : { comboId: combo.id, state: 'unknown', provenanceId });
  }
  const range = createHoldemWeightedRangeFromEntries({ entries, provenanceSources });
  return signed({ schemaVersion: 'personal-exact-action-range/v1', node, action, approachSnapshot,
    sourceRole: 'personal_intended', massSemantics: 'exact_action_frequency', range, lineage,
    evidence: records, coverage: inspectHoldemWeightedRange(range) });
}
function assertDerivedFingerprint(value) {
  const { fingerprint, ...content } = value;
  if (fingerprint !== exactIntentFingerprint(content)) throw new RangeError('Stale derived range fingerprint');
}
export function personalRangeNormalizationAvailability(range, removal) {
  // Match Range Core: even if every unknown combo is physically blocked, its
  // incomplete source is not accepted by createNormalizedHoldemDistribution.
  const complete = inspectHoldemWeightedRange(range).complete;
  const positive = removal.facts.totalEligibleWeight > 0;
  return { available: complete && positive,
    reason: !complete ? 'unknown_mass_not_normalized' : positive ? null : 'positive_mass_required' };
}
export function createPersonalRangePrior({ node, approachSnapshot } = {}) {
  validateExactRangeNode(node);
  const state = exactNodeState(node);
  if (node.street !== 'preflop' || state.actionHistory.some(entry => entry.playerId === node.actorId)) throw new RangeError('Prior requires Hero first preflop decision');
  const range = createHoldemWeightedRangeFromEntries({ entries: HOLDEM_COMBOS.map(combo => ({ comboId: combo.id, state: 'known', weight: 1, provenanceId: 'prior' })),
    provenanceSources: [{ id: 'prior', kind: 'derived_filter', operation: 'all_physical_combos_before_subject_first_action/v1' }] });
  return signed({ schemaVersion: 'personal-range-prior/v1', node, approachSnapshot, range,
    sourceRole: 'personal_intended', massSemantics: 'prior_reach_weight',
    assumption: 'opponent_actions_are_fixed_context_not_inferred_hero_card_likelihood' });
}
export function conditionPersonalRangeAction({ prior, policy, action = policy?.action, node = policy?.node } = {}) {
  assertDerivedFingerprint(prior); assertDerivedFingerprint(policy);
  validateExactIntentAction(node, action);
  if (!['personal-range-prior/v1', PERSONAL_RANGE_TRAJECTORY_VERSION].includes(prior.schemaVersion)
    || (prior.schemaVersion === PERSONAL_RANGE_TRAJECTORY_VERSION && prior.derivationVersion !== 'public-card-removal-trajectory/v1')
    || policy.schemaVersion !== 'personal-exact-action-range/v1' || policy.sourceRole !== 'personal_intended'
    || prior.sourceRole !== policy.sourceRole || !sameExactRangeNode(prior.node, node)
    || !sameExactRangeNode(policy.node, node) || exactActionKey(action) !== exactActionKey(policy.action)
    || canonicalIntentContent(prior.approachSnapshot) !== canonicalIntentContent(policy.approachSnapshot)) throw new RangeError('Incompatible exact context/action/size conditioning');
  const range = multiplyHoldemRangeByActionFrequencies(prior.range, policy.range);
  const removal = conditionHoldemRange(range, [...node.board, ...node.deadCards]);
  const priorLineage = new Map((prior.lineage ?? []).map(entry => [entry.comboId,entry]));
  const lineage = policy.lineage.map(entry => ({ ...entry,
    priorEvidenceRefs: priorLineage.get(entry.comboId)?.evidenceRefs ?? [],
    evidenceRefs: [...new Set([...(priorLineage.get(entry.comboId)?.evidenceRefs ?? []), ...entry.evidenceRefs])].sort(),
    currentEvidenceRefs: entry.evidenceRefs }));
  return signed({ schemaVersion: PERSONAL_RANGE_TRAJECTORY_VERSION, derivationVersion: 'range-action-conditioning/v1',
    trajectoryId: prior.trajectoryId ?? `trajectory:${prior.fingerprint}`, nodeId: `action:${policy.fingerprint}`,
    priorNode: prior.nodeId ?? prior.fingerprint, priorFingerprint: prior.fingerprint, policyFingerprint: policy.fingerprint,
    node, action, approachSnapshot: prior.approachSnapshot, sourceRole: 'personal_intended',
    massSemantics: 'unnormalized_action_conditioned_reach', range, lineage,
    coverage: removal.facts, boardRemoval: removal,
    normalization: personalRangeNormalizationAvailability(range, removal) });
}
export function advancePersonalRangeToNode({ prior, nextNode } = {}) {
  assertDerivedFingerprint(prior); validateExactRangeNode(nextNode);
  if (prior.schemaVersion !== PERSONAL_RANGE_TRAJECTORY_VERSION || prior.derivationVersion !== 'range-action-conditioning/v1') throw new RangeError('Action-conditioned prior required');
  const before = prior.node.replaySource.events, after = nextNode.replaySource.events;
  const first = after[before.length];
  if (after.length <= before.length || canonicalIntentContent(after.slice(0,before.length)) !== canonicalIntentContent(before)
    || nextNode.actorId !== prior.node.actorId || first?.operation !== 'action'
    || canonicalIntentContent(first.payload.action) !== canonicalIntentContent(prior.action.action)
    || after.slice(before.length + 1).some(event => event.operation === 'action' && event.payload.action.playerId === nextNode.actorId)) throw new RangeError('Exact action/history continuation mismatch');
  const removal = conditionHoldemRange(prior.range, [...nextNode.board, ...nextNode.deadCards]);
  // Blocked unknown entries remain unknown in the source; physical exclusion is
  // represented separately and never persisted as a newly known zero.
  return signed({ schemaVersion: PERSONAL_RANGE_TRAJECTORY_VERSION, derivationVersion: 'public-card-removal-trajectory/v1',
    trajectoryId: prior.trajectoryId, nodeId: `public:${nextNode.fingerprint}`, priorNode: prior.nodeId,
    priorFingerprint: prior.fingerprint, node: nextNode, action: prior.action,
    approachSnapshot: prior.approachSnapshot, sourceRole: 'personal_intended',
    massSemantics: 'unnormalized_action_conditioned_reach', range: prior.range, lineage: prior.lineage,
    coverage: removal.facts, boardRemoval: removal,
    normalization: personalRangeNormalizationAvailability(prior.range, removal) });
}
export function createPersonalRangeNodeStudy({ trajectory, records = [], questionLimit = 8, recentCombos = [] } = {}) {
  assertDerivedFingerprint(trajectory); validateExactNodeIntentHistory(records);
  const node = trajectory.node;
  if (trajectory.schemaVersion !== PERSONAL_RANGE_TRAJECTORY_VERSION || !['flop','turn','river'].includes(node.street)
    || records.some(record => !sameExactRangeNode(record.node, node) || !snapshotMatches(record, trajectory.approachSnapshot))) throw new RangeError('Incompatible range node study');
  const eligible = conditionHoldemRange(trajectory.range, [...node.board, ...node.deadCards]);
  const entries = eligible.eligibleEntries.filter(entry => entry.state === 'known' && entry.weight > 0).map(entry => {
    const combo = getHoldemComboById(entry.comboId), handFacts = deriveExactHandFacts({ heroCards: combo.cards, board: node.board, deadCards: node.deadCards });
    const policy = resolveExactComboIntent(records, combo.id);
    const previousFacts = node.board.length > 3 ? deriveExactHandFacts({ heroCards: combo.cards, board: node.board.slice(0, -1), deadCards: node.deadCards }) : null;
    const missedDraw = node.street === 'river' && previousFacts.drawOuts.uniqueCompletionCardCount > 0
      && !previousFacts.drawOuts.uniqueCompletionCards.includes(node.board.at(-1));
    const structuralTransition = previousFacts !== null && (previousFacts.primaryCategory !== handFacts.primaryCategory
      || previousFacts.relationship !== handFacts.relationship || previousFacts.draws.tags.join('|') !== handFacts.draws.tags.join('|'));
    const region = `${handFacts.relationship ?? handFacts.primaryCategory}${handFacts.drawOuts.uniqueCompletionCardCount > 0 ? ':draw' : ''}${missedDraw ? ':missed_draw' : ''}`;
    return { comboId: combo.id, cards: combo.cards, handClass: combo.handClass, priorWeight: entry.weight,
      region, handFacts, missedDraw, structuralTransition, previousFacts, ...policy };
  });
  const regions = new Map();
  for (const entry of entries) {
    if (!regions.has(entry.region)) regions.set(entry.region, { id: entry.region, eligibleCombos: 0, mappedCombos: 0, exactCombos: 0, dominantCombos: 0, unknownPolicyCombos: 0 });
    const region = regions.get(entry.region); region.eligibleCombos++;
    if (['exact','dominant'].includes(entry.precision)) region.mappedCombos++;
    if (entry.precision === 'exact') region.exactCombos++;
    if (entry.precision === 'dominant') region.dominantCombos++;
    if (['unknown','conflict'].includes(entry.precision)) region.unknownPolicyCombos++;
  }
  // A boundary is a question raised by neighboring recorded intent, never an inferred answer.
  const regionActions = new Map();
  for (const entry of entries) {
    if (!regionActions.has(entry.region)) regionActions.set(entry.region, new Set());
    for (const action of entry.distribution?.filter(item => item.probability > 0).map(item => item.action) ?? (entry.preferredAction ? [entry.preferredAction] : [])) regionActions.get(entry.region).add(exactActionKey(action));
  }
  for (const entry of entries) entry.actionBoundary = entry.precision === 'unknown' && regionActions.get(entry.region).size > 0;
  const rank = { conflict: 0, unknown: 1, dominant: 2, exact: 3 };
  const sorted = [...entries].sort((a,b) => rank[a.precision] - rank[b.precision]
    || Number(recentCombos.includes(a.comboId)) - Number(recentCombos.includes(b.comboId))
    || Number(b.actionBoundary) - Number(a.actionBoundary)
    || Number(b.structuralTransition) - Number(a.structuralTransition) || a.comboId.localeCompare(b.comboId,'en'));
  const selected = [], seen = new Set();
  for (const entry of sorted) if (!seen.has(entry.region)) { selected.push(entry); seen.add(entry.region); }
  for (const entry of sorted) if (!selected.includes(entry)) selected.push(entry);
  const questions = selected.slice(0, Math.min(24,Math.max(1,questionLimit))).map(entry => ({ ...entry,
    decisionContext: exactComboDecisionContext(node, entry.comboId), selectionVersion: 'personal-node-question/v2',
    questionKind: entry.precision === 'conflict' ? 'contradiction' : entry.precision === 'dominant' ? 'sizing_boundary'
      : node.street === 'river' ? (entry.missedDraw ? 'missed_draw' : exactNodeState(node).currentBetMilliBb > 0 ? 'call_boundary' : 'value_boundary')
        : entry.structuralTransition ? 'card_transition' : entry.handFacts.drawOuts.uniqueCompletionCardCount > 0 ? 'draw_plan' : 'action_boundary',
    applicability: 'this_combo_only', assessment: 'none' }));
  const facts = signed({ eligibleCombos: eligible.facts.eligibleCombos, knownPositiveCombos: entries.length,
    unknownReachCombos: eligible.facts.unknownEligibleCombos, blockedCombos: eligible.facts.blockedCombos,
    mappedCombos: entries.filter(entry => ['exact','dominant'].includes(entry.precision)).length,
    exactCombos: entries.filter(entry => entry.precision === 'exact').length,
    dominantCombos: entries.filter(entry => entry.precision === 'dominant').length,
    conflictingCombos: entries.filter(entry => entry.precision === 'conflict').length,
    missedDrawCombos: entries.filter(entry => entry.missedDraw).length,
    structuralTransitionCombos: entries.filter(entry => entry.structuralTransition).length,
    intentWithoutKnownReachCombos: new Set(exactNodeIntentHeads(records).filter(record => record.subject.kind === 'combo'
      && !entries.some(entry => entry.comboId === record.subject.comboId)).map(record => record.subject.comboId)).size,
    unknownPolicyCombos: entries.filter(entry => ['unknown','conflict'].includes(entry.precision)).length,
    regions: [...regions.values()], evidenceRefs: [...new Set(exactNodeIntentHeads(records).map(record => record.id))].sort(),
    trajectoryFingerprint: trajectory.fingerprint });
  return freeze({ schemaVersion: 'personal-range-node-study/v1', node, facts, questions, entries,
    selectionLimit: questionLimit, roleClassification: 'contextual_roles_unavailable_without_response_premises' });
}

export function comparePersonalNodeStudies(left, right) {
  if (!sameExactRangeNode(left.node, right.node) || left.approachSnapshot.profileId !== right.approachSnapshot.profileId
    || left.approachSnapshot.setupVersion !== right.approachSnapshot.setupVersion) throw new RangeError('Comparison requires the same exact node and setup');
  const rightEntries = new Map(right.study.entries.map(entry => [entry.comboId, entry]));
  const known = entry => entry && ['exact','dominant'].includes(entry.precision);
  const comparable = left.study.entries.filter(entry => known(entry) && known(rightEntries.get(entry.comboId)));
  const precisionDifferences = comparable.filter(entry => entry.precision !== rightEntries.get(entry.comboId).precision).length;
  const intentionDifferences = comparable.filter(entry => {
    const other = rightEntries.get(entry.comboId);
    return entry.precision === other.precision && canonicalIntentContent(entry.distribution ?? entry.preferredAction)
      !== canonicalIntentContent(other.distribution ?? other.preferredAction);
  }).length;
  return signed({ schemaVersion: 'personal-node-comparison/v1', nodeFingerprint: left.node.fingerprint,
    leftSnapshot: left.approachSnapshot, rightSnapshot: right.approachSnapshot,
    leftEvidenceFingerprint: left.study.facts.fingerprint, rightEvidenceFingerprint: right.study.facts.fingerprint,
    comparableCombos: comparable.length, precisionDifferences, intentionDifferences,
    unavailableCombos: left.study.facts.eligibleCombos - comparable.length,
    assessment: 'none', unknownMassNormalized: false });
}

export function personalRangeMutationFacts({ stages, trajectory, study }) {
  const last = stages.at(-1), before = last.incoming;
  const oldRemoval = conditionHoldemRange(before.range, [...last.node.board, ...last.node.deadCards]);
  const conditioned = last.conditioned.boardRemoval;
  const eligible = new Set(oldRemoval.eligibleEntries.map(entry => entry.comboId));
  const actionKnownCombos = conditioned.eligibleEntries.filter(entry => entry.state === 'known').length;
  const cardRemoved = trajectory.boardRemoval.blockedEntries.filter(entry => eligible.has(entry.comboId));
  return signed({ schemaVersion: 'personal-range-mutations/v1',
    actionConditioning: { nodeFingerprint: last.node.fingerprint, action: last.conditioned.action,
      knownBefore: oldRemoval.eligibleEntries.filter(entry => entry.state === 'known').length,
      knownAfter: actionKnownCombos, positiveAfter: conditioned.eligibleEntries.filter(entry => entry.state === 'known' && entry.weight > 0).length,
      knownMassAfter: conditioned.facts.totalEligibleWeight, unknownAfter: conditioned.facts.unknownEligibleCombos },
    cardRemoval: { cards: trajectory.node.board.slice(last.node.board.length), removedCombos: cardRemoved.length,
      removedKnownMass: cardRemoved.filter(entry => entry.state === 'known').reduce((sum, entry) => sum + entry.weight, 0),
      removedUnknownCombos: cardRemoved.filter(entry => entry.state === 'unknown').length },
    userIntent: { nodeFingerprint: study.node.fingerprint, mappedCombos: study.facts.mappedCombos,
      exactCombos: study.facts.exactCombos, preferredCombos: study.facts.dominantCombos, evidenceRefs: study.facts.evidenceRefs,
      affectsIncomingReach: false },
    intentWithoutKnownReachCombos: study.facts.intentWithoutKnownReachCombos,
    structuralTransitions: study.facts.structuralTransitionCombos, missedDrawCombos: study.facts.missedDrawCombos,
    sourceFingerprints: [before.fingerprint, last.conditioned.fingerprint, trajectory.fingerprint, study.facts.fingerprint] });
}
export function personalPreflopCandidates(evidenceView) {
  return PREFLOP_HAND_CLASSES.map(handClass => {
    const point = evidenceView?.points.find(entry => entry.handClass === handClass);
    return { handClass, legacyPrecision: point?.resolution ?? 'unanswered',
      legacyRaiseFrequency: point?.resolution === 'direct_exact'
        ? point.strategyValue.exactFrequencies.find(entry => entry.action.type === 'raise')?.probability ?? null : null };
  });
}
