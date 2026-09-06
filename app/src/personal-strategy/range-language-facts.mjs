import { PREFLOP_HAND_CLASSES, getHoldemCombosForHandClass, preflopHandClassForCards } from '../../../shared/poker-domain/index.js';
import { validatePersonalStrategyEvidenceView } from './evidence-view.mjs';
import { calibrationContextsEquivalent } from './domain.mjs';
import { describeRfiHandClass, validatePersonalStrategySnapshot } from './rfi-inference.mjs';
import { RFI_MAPPING_FAMILIES } from './structural-range-mapping.mjs';
import { projectStrategyTruth } from '../application/strategy-truth.mjs';
import { createNaturalLanguageEnvelope, freezeLanguageData as freeze } from '../application/natural-language-envelope.mjs';

export const PERSONAL_RANGE_LANGUAGE_FACTS_VERSION = 'personal-range-language-facts/v1';
const FEATURES = new Map(PREFLOP_HAND_CLASSES.map((hand) => [hand, describeRfiHandClass(hand)]));
const REGIONS = {
  suited: (f) => f.kind === 'suited', offsuit: (f) => f.kind === 'offsuit', pairs: (f) => f.kind === 'pair',
  broadway: (f) => f.kind !== 'pair' && f.lowRankIndex <= 4,
  suited_broadway: (f) => f.kind === 'suited' && f.lowRankIndex <= 4,
  offsuit_broadway: (f) => f.kind === 'offsuit' && f.lowRankIndex <= 4,
  ax: (f) => f.kind !== 'pair' && f.highRankIndex === 0,
  kx: (f) => f.kind !== 'pair' && (f.highRankIndex === 1 || f.lowRankIndex === 1),
  qx: (f) => f.kind !== 'pair' && (f.highRankIndex === 2 || f.lowRankIndex === 2),
  suited_connectors: (f) => f.kind === 'suited' && f.gap === 0,
  suited_one_gappers: (f) => f.kind === 'suited' && f.gap === 1,
  low_cards: (f) => f.highRankIndex >= 7,
};
// Reuse the mapping taxonomy for additional families. The pre-existing all-rank
// connector regions retain their scope; mapping probes additionally distinguish
// their below-Broadway subset. No mapping readiness state grants prose authority.
for (const family of RFI_MAPPING_FAMILIES) {
  if (!Object.hasOwn(REGIONS, family.id)) REGIONS[family.id] = (f) => family.handClasses.includes(f.handClass);
}
export const PERSONAL_RANGE_REGIONS = freeze(Object.fromEntries(Object.entries(REGIONS)
  .map(([id, predicate]) => [id, PREFLOP_HAND_CLASSES.filter((hand) => predicate(FEATURES.get(hand)))])));
const actionOf = (point) => point.strategyValue?.dominantAction?.type ?? null;
const isDirect = (point) => ['direct_dominant', 'direct_exact'].includes(point?.resolution);
const isExact = (point) => point?.resolution === 'direct_exact' && Array.isArray(point.strategyValue.exactFrequencies);
const sum = (values) => values.reduce((total, value) => total + value, 0);
const uniq = (values) => [...new Set(values)];
const comboCount = (hand) => getHoldemCombosForHandClass(hand).length;
const countActions = (points) => Object.fromEntries(['fold', 'call', 'check', 'raise', 'bet', 'all_in']
  .map((action) => [action, points.filter((p) => actionOf(p) === action).length]));
const continues = (action) => action !== null && action !== undefined && action !== 'fold';
const aggressive = (action) => ['raise', 'bet', 'all_in'].includes(action);
// Rank adjacency is structural only. These chains describe stated transitions;
// they establish neither equity ordering nor a strategically correct boundary.
const BOUNDARY_CHAINS = [
  PERSONAL_RANGE_REGIONS.pairs,
  ...['suited', 'offsuit'].flatMap((kind) => Array.from({ length: 12 }, (_, highRankIndex) =>
    PREFLOP_HAND_CLASSES.filter((hand) => FEATURES.get(hand).kind === kind && FEATURES.get(hand).highRankIndex === highRankIndex))),
  ...['suited', 'offsuit'].flatMap((kind) => [0, 1].map((gap) =>
    PREFLOP_HAND_CLASSES.filter((hand) => FEATURES.get(hand).kind === kind && FEATURES.get(hand).gap === gap))),
];

function structuralPattern(handClasses, points) {
  const members = new Set(handClasses);
  const selected = handClasses.map((hand) => points.get(hand)).filter(isDirect);
  const preferred = selected.filter((point) => actionOf(point) !== null);
  const actionCounts = countActions(preferred);
  const complete = preferred.length === handClasses.length;
  const sameAction = preferred.length >= 2 && preferred.length === selected.length
    && new Set(preferred.map(actionOf)).size === 1 ? actionOf(preferred[0]) : null;
  const majority = complete ? Object.entries(actionCounts).find(([, count]) => count > handClasses.length / 2)?.[0] ?? null : null;
  const transitions = [], lowerUnknown = new Set(), seen = new Set();
  for (const chain of BOUNDARY_CHAINS) {
    const known = chain.map((hand, index) => ({ point: points.get(hand), index }))
      .filter(({ point }) => members.has(point.handClass) && isDirect(point) && actionOf(point) !== null);
    for (const { point, index } of known) {
      const nextHand = chain[index + 1];
      if (nextHand && points.get(nextHand)?.resolution === 'unanswered') lowerUnknown.add(nextHand);
    }
    for (let index = 1; index < known.length; index += 1) {
      const upper = known[index - 1], lower = known[index];
      if (actionOf(upper.point) === actionOf(lower.point)) continue;
      const identity = `${upper.point.handClass}:${lower.point.handClass}`;
      if (seen.has(identity)) continue;
      const between = chain.slice(upper.index + 1, lower.index);
      // A conflicted point interrupts a boundary hypothesis. Exact tied mixes
      // remain known mixed evidence between the two preferred actions.
      if (between.some((hand) => points.get(hand)?.resolution === 'conflicting')) continue;
      seen.add(identity);
      const unresolvedBetween = between.filter((hand) => points.get(hand)?.resolution === 'unanswered');
      const mixedBetween = between.filter((hand) => isDirect(points.get(hand)) && actionOf(points.get(hand)) === null);
      transitions.push({ upperHandClass: upper.point.handClass, lowerHandClass: lower.point.handClass,
        upperAction: actionOf(upper.point), lowerAction: actionOf(lower.point),
        kind: unresolvedBetween.length ? 'unresolved_bracket' : mixedBetween.length ? 'explicit_mixed_transition' : 'adjacent_stated_transition',
        unresolvedBetween, mixedBetween,
        evidenceRefs: uniq([upper.point, ...mixedBetween.map((hand) => points.get(hand)), lower.point].flatMap((point) => point.sourceEvidenceIds)) });
    }
  }
  return { criterion: 'explicit_preferred_actions_rank_adjacency/v1', preferredClasses: preferred.length,
    completePreferredCoverage: complete, consistentSelectedAction: sameAction, wholeRegionMajorityAction: majority,
    preferredContinueClasses: preferred.filter((p) => continues(actionOf(p))).length,
    preferredAggressiveClasses: preferred.filter((p) => aggressive(actionOf(p))).length,
    transitions, unresolvedLowerNeighbors: [...lowerUnknown],
    conflictingHandClasses: handClasses.filter((hand) => points.get(hand)?.resolution === 'conflicting'),
    unknownHandClasses: handClasses.filter((hand) => points.get(hand)?.resolution === 'unanswered') };
}

function preferredComparison(rows, totalClasses) {
  const comparable = rows.filter((row) => row.leftAction !== null && row.leftAction !== undefined
    && row.rightAction !== null && row.rightAction !== undefined);
  return { criterion: 'shared_explicit_preferred_action_participation/v1', sharedClasses: comparable.length,
    completeRegion: comparable.length === totalClasses,
    leftContinueClasses: comparable.filter((row) => continues(row.leftAction)).length,
    rightContinueClasses: comparable.filter((row) => continues(row.rightAction)).length,
    removedContinues: comparable.filter((row) => !continues(row.leftAction) && continues(row.rightAction)).map((row) => row.handClass),
    addedContinues: comparable.filter((row) => continues(row.leftAction) && !continues(row.rightAction)).map((row) => row.handClass),
    preservedContinues: comparable.filter((row) => continues(row.leftAction) && continues(row.rightAction)).map((row) => row.handClass) };
}
function exactMetrics(points) {
  const totalCombos = sum(points.map((p) => comboCount(p.handClass)));
  const actionMass = {};
  for (const point of points) for (const entry of point.strategyValue.exactFrequencies) {
    actionMass[entry.action.type] = (actionMass[entry.action.type] ?? 0) + entry.probability * comboCount(point.handClass);
  }
  return { basis: 'complete_explicit_class_mix_canonical_combo_weight/v1', totalCombos,
    participation: 1 - (actionMass.fold ?? 0) / totalCombos,
    aggression: ((actionMass.raise ?? 0) + (actionMass.bet ?? 0) + (actionMass.all_in ?? 0)) / totalCombos,
    call: (actionMass.call ?? 0) / totalCombos, actionMass };
}

export function createPersonalRangeLanguageFacts({ evidenceView, snapshot = null } = {}) {
  validatePersonalStrategyEvidenceView(evidenceView);
  if (snapshot) {
    validatePersonalStrategySnapshot(snapshot);
    if (snapshot.evidenceRevision.fingerprint !== evidenceView.evidenceFingerprint
      || snapshot.scope.profileId !== evidenceView.scope.profileId || snapshot.scope.modeId !== evidenceView.scope.modeId
      || !calibrationContextsEquivalent(snapshot.scope.context, evidenceView.scope.context)) throw new RangeError('Range snapshot is stale or belongs to another scope');
  }
  const points = new Map(evidenceView.points.map((p) => [p.handClass, p]));
  const estimates = new Map((snapshot?.estimates ?? []).map((p) => [p.handClass, p]));
  const regions = Object.entries(PERSONAL_RANGE_REGIONS).map(([id, handClasses]) => {
    const selected = handClasses.map((hand) => points.get(hand));
    const direct = selected.filter(isDirect), exact = selected.filter(isExact);
    const quantitative = exact.length === handClasses.length ? exactMetrics(exact) : null;
    return { id, handClasses, totalClasses: handClasses.length, directClasses: direct.length,
      exactClasses: exact.length, dominantOnlyClasses: direct.length - exact.length,
      estimatedClasses: handClasses.filter((hand) => ['inferred_high', 'inferred_medium', 'uncertain'].includes(estimates.get(hand)?.status)).length,
      conflictClasses: selected.filter((p) => p.resolution === 'conflicting').length,
      unknownClasses: selected.filter((p) => p.resolution === 'unanswered').length,
      selectedSample: direct.map((p) => ({ handClass: p.handClass, dominantAction: actionOf(p),
        precision: isExact(p) ? 'exact_mix' : 'dominant_only', evidenceRefs: p.sourceEvidenceIds })),
      dominantActionCounts: countActions(direct), quantitative, structure: structuralPattern(handClasses, points),
      permission: { sampleDescription: direct.length > 0, wholeRegionFrequency: quantitative !== null,
        normative: false, criterion: 'complete_explicit_region_coverage/v1' },
      evidenceRefs: uniq(direct.flatMap((p) => p.sourceEvidenceIds)) };
  });
  const aggressivePoints = evidenceView.points.filter((p) => isDirect(p) && aggressive(actionOf(p)));
  const coreHands = new Set([...PERSONAL_RANGE_REGIONS.premium_pairs, ...PERSONAL_RANGE_REGIONS.broadway]);
  const coreAggressive = aggressivePoints.filter((p) => coreHands.has(p.handClass));
  return freeze(structuredClone({ schemaVersion: PERSONAL_RANGE_LANGUAGE_FACTS_VERSION,
    scope: evidenceView.scope, evidenceFingerprint: evidenceView.evidenceFingerprint,
    basis: 'current_intended_direct_evidence', regions,
    actionConcentration: { criterion: 'majority_of_specified_aggressive_preferences/v1', scope: 'specified_hand_classes',
      aggressiveHandClasses: aggressivePoints.map((p) => p.handClass), coreAggressiveHandClasses: coreAggressive.map((p) => p.handClass),
      majorityInPremiumPairsAndBroadways: aggressivePoints.length >= 3 && coreAggressive.length > aggressivePoints.length / 2,
      evidenceRefs: uniq(aggressivePoints.flatMap((p) => p.sourceEvidenceIds)) },
    exclusions: ['observed_behavior', 'qualitative_frequency_conversion', 'normative_range_shape', 'card_removal'] }));
}

export function comparePersonalRangeLanguageFacts(left, right) {
  if (left?.schemaVersion !== PERSONAL_RANGE_LANGUAGE_FACTS_VERSION || right?.schemaVersion !== PERSONAL_RANGE_LANGUAGE_FACTS_VERSION) throw new TypeError('Personal range facts required');
  const compatible = calibrationContextsEquivalent(left.scope.context, right.scope.context);
  const regions = compatible ? left.regions.map((region) => {
    const other = right.regions.find((r) => r.id === region.id);
    const rightPoints = new Map(other.selectedSample.map((p) => [p.handClass, p]));
    const overlap = region.selectedSample.filter((p) => rightPoints.has(p.handClass));
    const differences = overlap.filter((p) => p.dominantAction !== rightPoints.get(p.handClass).dominantAction)
      .map((p) => ({ handClass: p.handClass, leftAction: p.dominantAction, rightAction: rightPoints.get(p.handClass).dominantAction,
        evidenceRefs: uniq([...p.evidenceRefs, ...rightPoints.get(p.handClass).evidenceRefs]) }));
    const quantitative = region.quantitative && other.quantitative ? {
      participationDelta: region.quantitative.participation - other.quantitative.participation,
      aggressionDelta: region.quantitative.aggression - other.quantitative.aggression,
      callDelta: region.quantitative.call - other.quantitative.call } : null;
    return { id: region.id, totalClasses: region.totalClasses, sharedDirectClasses: overlap.length,
      differences, quantitative, preferredParticipation: preferredComparison(overlap.map((p) => ({ handClass: p.handClass,
        leftAction: p.dominantAction, rightAction: rightPoints.get(p.handClass).dominantAction })), region.totalClasses),
      evidenceRefs: uniq([...region.evidenceRefs, ...other.evidenceRefs]),
      permission: { comparison: overlap.length > 0, wholeRegionFrequency: quantitative !== null,
        normative: false, criterion: 'compatible_direct_region_comparison/v1' } };
  }) : [];
  return freeze({ schemaVersion: 'personal-range-language-comparison/v1', kind: 'personal_to_personal',
    compatible, reason: compatible ? null : 'incompatible_decision_context', leftScope: left.scope, rightScope: right.scope,
    leftEvidenceFingerprint: left.evidenceFingerprint, rightEvidenceFingerprint: right.evidenceFingerprint, regions });
}

// Application adapters supply the canonical calibration context associated with
// each provider request. Results are reprojected through shared Strategy Truth;
// caller-provided truth/assessment flags are never consumed.
export function comparePersonalRangeToSource(facts, { entries = [], sourceContext = null, expectedRole = null } = {}) {
  if (facts?.schemaVersion !== PERSONAL_RANGE_LANGUAGE_FACTS_VERSION) throw new TypeError('Personal range facts required');
  const compatible = ['calibration-context/v1', 'calibration-context/v2'].includes(sourceContext?.schemaVersion)
    && sourceContext.decisionFamily === 'preflop_rfi'
    && calibrationContextsEquivalent(facts.scope.context, sourceContext);
  const usable = new Map();
  const duplicate = new Set();
  const seen = new Set();
  for (const entry of compatible ? entries : []) {
    if (seen.has(entry.handClass)) duplicate.add(entry.handClass);
    seen.add(entry.handClass);
    const dc = entry.decisionContext;
    if (!dc || dc.street !== 'preflop' || dc.board?.length || dc.deadCards?.length
      || dc.tableSize !== sourceContext.tableSize || dc.heroPosition !== sourceContext.heroPosition
      || dc.priorActionSummary?.aggressionCount !== 0 || dc.priorActionSummary?.limperCount !== 0
      || dc.priorActionSummary?.facingActionFamily !== 'none') continue;
    if (sourceContext.schemaVersion === 'calibration-context/v1') {
      if (dc.stackBb !== sourceContext.effectiveStackBb
        || dc.rakeMode !== sourceContext.accounting.rakeMode
        || dc.forcedContributionPerPlayerBb !== sourceContext.accounting.forcedContributionPerPlayerBb
        || dc.gameRules?.definition?.ante?.type !== sourceContext.accounting.anteType
        || dc.gameRules?.definition?.ante?.amountMilliBb !== sourceContext.accounting.anteBb * 1000) continue;
    } else {
      // Effective live pot capacity is a canonical PokerState-derived field;
      // DecisionContext's starting/remaining stack fields are not substitutes.
      if (!entry.calibrationContext || !calibrationContextsEquivalent(entry.calibrationContext, sourceContext)
        || sourceContext.gameRules.identity.kind !== 'semantic_fingerprint'
        || dc.derivation?.source !== 'canonical_hand'
        || dc.gameRules?.semanticFingerprint !== sourceContext.gameRules.identity.value
        || dc.opponentCount !== sourceContext.opponentCount
        || dc.callAmountBb !== sourceContext.facing.callAmountBb
        || dc.heroStreetContributionBb !== sourceContext.facing.heroStreetContributionBb
        || dc.minRaiseToBb !== sourceContext.sizing.minimumRaiseToBb
        || dc.allInToBb !== sourceContext.sizing.allInToBb) continue;
    }
    try { if (preflopHandClassForCards(dc.heroCards) !== entry.handClass) continue; } catch { continue; }
    const truth = projectStrategyTruth({ strategyResult: entry.strategyResult, decisionContext: dc });
    if (!['heuristic_comparison', 'accepted_reference_comparison', 'normative_assessment'].includes(truth.state)) continue;
    if (expectedRole === 'heuristic' && truth.state !== 'heuristic_comparison') continue;
    if (expectedRole === 'reference' && truth.claims.reference !== true) continue;
    usable.set(entry.handClass, { ...entry, truth });
  }
  for (const hand of duplicate) usable.delete(hand);
  const regions = facts.regions.map((region) => {
    const selected = region.handClasses.map((hand) => usable.get(hand));
    const available = selected.filter(Boolean);
    const sources = uniq(available.map((e) => JSON.stringify({ source: e.truth.source,
      rules: e.decisionContext.gameRules?.semanticFingerprint })));
    const sourceKind = available.every((e) => e.truth.state === 'heuristic_comparison') ? 'heuristic'
      : available.every((e) => e.truth.claims.reference) ? 'reference' : 'unavailable';
    const complete = available.length === region.totalClasses && sources.length === 1 && sourceKind !== 'unavailable';
    // Source requests are representative hand classes. No suit-invariance or
    // range-mass assumption is inferred from one representative per class.
    const personalPoints = new Map(region.selectedSample.map((p) => [p.handClass, p]));
    const differences = complete ? available.filter((e) => personalPoints.get(e.handClass)?.dominantAction)
      .map((e) => { const highest = Math.max(...e.strategyResult.actions.map((a) => a.probability));
        return { handClass: e.handClass, personalAction: personalPoints.get(e.handClass).dominantAction,
          sourcePreferredActions: uniq(e.strategyResult.actions.filter((a) => a.probability === highest).map((a) => a.action.type)),
          evidenceRefs: [...personalPoints.get(e.handClass).evidenceRefs, `source:${e.truth.source.id}:${e.truth.source.version}:${e.handClass}`] }; })
      .filter((d) => !d.sourcePreferredActions.includes(d.personalAction)) : [];
    return { id: region.id, sourceKind: complete ? sourceKind : 'unavailable', coveredClasses: available.length,
      totalClasses: region.totalClasses, differences, quantitative: null,
      preferredParticipation: preferredComparison(complete ? available.map((e) => {
        const highest = Math.max(...e.strategyResult.actions.map((a) => a.probability));
        const actions = uniq(e.strategyResult.actions.filter((a) => a.probability === highest).map((a) => a.action.type));
        return { handClass: e.handClass, leftAction: personalPoints.get(e.handClass)?.dominantAction,
          rightAction: actions.length === 1 ? actions[0] : null };
      }) : [], region.totalClasses),
      permission: { comparison: complete && region.directClasses > 0, wholeRegionFrequency: false,
        normative: false, criterion: 'complete_source_region_direct_dominant_comparison/v1' },
      reason: !complete ? 'source_region_coverage_unavailable' : !region.directClasses ? 'personal_region_evidence_unavailable' : 'dominant_action_comparison_only' };
  });
  return freeze({ schemaVersion: 'personal-range-language-comparison/v1', kind: 'personal_to_source',
    compatible: Boolean(compatible), reason: compatible ? null : 'incompatible_decision_context',
    leftScope: facts.scope, leftEvidenceFingerprint: facts.evidenceFingerprint, regions });
}

export function createStrategyRangeLanguageFacts({ personalFacts, entries = [], expectedRole,
  sourceContext = personalFacts?.scope.context } = {}) {
  if (!['heuristic', 'reference'].includes(expectedRole)) throw new TypeError('Source comparison role must be explicit');
  return comparePersonalRangeToSource(personalFacts, { entries, sourceContext, expectedRole });
}

const LABELS = {
  en: ['suited hands', 'offsuit hands', 'pocket pairs', 'Broadways', 'suited Broadways', 'offsuit Broadways', 'Ax hands', 'Kx hands', 'Qx hands', 'suited connectors', 'suited one-gappers', 'low-card hands'],
  ru: ['одномастные руки', 'разномастные руки', 'карманные пары', 'бродвей', 'одномастный бродвей', 'разномастный бродвей', 'руки Ax', 'руки Kx', 'руки Qx', 'одномастные коннекторы', 'одномастные гапперы с одним разрывом', 'низкие руки'],
  he: ['ידיים סוטד', 'ידיים אוף־סוט', 'זוגות כיס', 'ברודוויי', 'ברודוויי סוטד', 'ברודוויי אוף־סוט', 'ידיים Ax', 'ידיים Kx', 'ידיים Qx', 'קונקטורים סוטד', 'ידיים סוטד עם פער אחד', 'ידיים עם קלפים נמוכים'],
};
const languageOf = (language) => LABELS[language] ? language : 'en';
const FAMILY_LABELS = {
  premium_pairs: ['premium pocket pairs', 'старшие карманные пары', 'זוגות כיס גבוהים'],
  medium_pairs: ['medium pocket pairs', 'средние карманные пары', 'זוגות כיס בינוניים'],
  small_pairs: ['small pocket pairs', 'младшие карманные пары', 'זוגות כיס נמוכים'],
  suited_ax: ['suited Ax', 'одномастные Ax', 'ידיים Ax סוטד'],
  offsuit_ax: ['offsuit Ax', 'разномастные Ax', 'ידיים Ax אוף־סוט'],
  suited_kx: ['suited Kx', 'одномастные Kx', 'ידיים Kx סוטד'],
  suited_qx: ['suited Qx', 'одномастные Qx', 'ידיים Qx סוטד'],
  weak_suited: ['weaker disconnected suited hands', 'слабые несвязанные одномастные руки', 'ידיים סוטד חלשות ולא מחוברות'],
  offsuit_connectivity: ['connected and one-gap offsuit hands', 'связанные разномастные руки и гапперы', 'ידיים אוף־סוט מחוברות או עם פער אחד'],
  weak_offsuit_high_card: ['offsuit high cards with low kickers', 'разномастные старшие карты с низким кикером', 'קלפים גבוהים אוף־סוט עם קיקר נמוך'],
};
const regionLabel = (id, language) => FAMILY_LABELS[id]?.[['en', 'ru', 'he'].indexOf(language)]
  ?? LABELS[language][Object.keys(REGIONS).indexOf(id)] ?? id;
export const personalRangeRegionLabel = (id, language = 'en') => regionLabel(id, languageOf(language));
const ACTIONS = { en: { fold: 'Fold', call: 'Call', check: 'Check', raise: 'Raise', bet: 'Bet', all_in: 'All-in' },
  ru: { fold: 'Фолд', call: 'Колл', check: 'Чек', raise: 'Рейз', bet: 'Ставка', all_in: 'Олл-ин' },
  he: { fold: 'פולד', call: 'קול', check: 'צ׳ק', raise: 'רייז', bet: 'הימור', all_in: 'אול־אין' } };
const actionLabel = (type, language) => ACTIONS[language][type] ?? '—';
const say = (language, en, ru, he) => ({ en, ru, he })[language];
const handToken = (hand) => `\u2066${hand}\u2069`;
const handList = (hands, limit = 3) => hands.slice(0, limit).map(handToken).join(', ');
const NARRATIVE_REGIONS = ['medium_pairs', 'small_pairs', 'premium_pairs', 'suited_kx', 'suited_qx',
  'suited_ax', 'offsuit_ax', 'suited_connectors', 'suited_one_gappers', 'offsuit_broadway', 'suited_broadway',
  'weak_offsuit_high_card', 'weak_suited', 'offsuit_connectivity', 'low_cards', 'pairs', 'suited', 'offsuit', 'broadway', 'ax', 'kx', 'qx'];
const narrativeRegions = (regions) => [...regions].sort((a, b) => NARRATIVE_REGIONS.indexOf(a.id) - NARRATIVE_REGIONS.indexOf(b.id));

export function renderPersonalRangeLanguageFacts(facts, { language = 'en', withPresentation = false } = {}) {
  language = languageOf(language);
  const lines = [], describedHands = new Set(), describedTransitions = new Set();
  // Presentation metadata follows the existing sentence branches; no text parsing
  // or second interpretation of the evidence is involved.
  const kinds = [];
  let kind = 'conflict';
  const push = (text) => { lines.push(text); kinds.push(kind); };
  const prepend = (text) => { lines.unshift(text); kinds.unshift('pattern'); };
  const ordered = narrativeRegions(facts.regions);
  const conflicts = new Set();
  for (const region of ordered) {
    const hands = region.structure.conflictingHandClasses.filter((hand) => !conflicts.has(hand));
    if (!hands.length || conflicts.size >= 3) continue;
    push(say(language,
      `Your active answers conflict at ${handList(hands)}; the ${regionLabel(region.id, language)} boundary remains unresolved there.`,
      `Ваши активные ответы противоречат друг другу для ${handList(hands)}; граница региона «${regionLabel(region.id, language)}» здесь не определена.`,
      `התשובות הפעילות שלכם סותרות זו את זו לגבי ${handList(hands)}; הגבול באזור ${regionLabel(region.id, language)} עדיין לא הוגדר שם.`));
    hands.forEach((hand) => conflicts.add(hand));
  }
  kind = 'boundary';
  for (const region of ordered) {
    const label = regionLabel(region.id, language);
    for (const boundary of region.structure.transitions) {
      const identity = `${boundary.upperHandClass}:${boundary.lowerHandClass}`;
      if (describedTransitions.has(identity) || describedTransitions.size >= 3) continue;
      const upper = handToken(boundary.upperHandClass), lower = handToken(boundary.lowerHandClass);
      const upperAction = actionLabel(boundary.upperAction, language), lowerAction = actionLabel(boundary.lowerAction, language);
      push(say(language,
        `Your ${label} preference changes from ${upperAction} with ${upper} to ${lowerAction} with ${lower}.`,
        `В регионе «${label}» ваше предпочтение меняется с ${upperAction} для ${upper} на ${lowerAction} для ${lower}.`,
        `באזור ${label}, ההעדפה שלכם משתנה מ־${upperAction} עם ${upper} ל־${lowerAction} עם ${lower}.`)
        + (boundary.unresolvedBetween.length ? say(language,
          ` The boundary between them is unresolved: ${handList(boundary.unresolvedBetween)} still needs clarification.`,
          ` Граница между ними пока не определена: нужно уточнить ${handList(boundary.unresolvedBetween)}.`,
          ` הגבול ביניהן עדיין לא ברור: צריך להבהיר את ${handList(boundary.unresolvedBetween)}.`)
          : boundary.mixedBetween.length ? say(language,
            ` The hands between them have explicitly specified tied mixes: ${handList(boundary.mixedBetween)}.`,
            ` Для рук между ними явно заданы смеси без доминирующего действия: ${handList(boundary.mixedBetween)}.`,
            ` לידיים שביניהן הוגדרו תמהילים ללא פעולה מובילה: ${handList(boundary.mixedBetween)}.`)
            : say(language, ' These adjacent answers locate one stated boundary.',
              ' Эти соседние ответы обозначают одну явно заданную границу.', ' התשובות הסמוכות האלה מסמנות גבול אחד שהוגדר במפורש.')));
      describedTransitions.add(identity); describedHands.add(boundary.upperHandClass); describedHands.add(boundary.lowerHandClass);
    }
  }
  kind = 'pattern';
  let patterns = 0;
  for (const region of ordered) {
    const pattern = region.structure, label = regionLabel(region.id, language);
    if (patterns >= 3 || !pattern.preferredClasses || region.selectedSample.every((p) => describedHands.has(p.handClass))) continue;
    const action = pattern.consistentSelectedAction ?? pattern.wholeRegionMajorityAction;
    if (!action) continue;
    const actionText = actionLabel(action, language);
    if (pattern.completePreferredCoverage) push(say(language,
      `${actionText} is your preferred response across ${pattern.consistentSelectedAction ? 'all' : 'most'} ${label}.`,
      `${actionText} — ваше предпочтительное действие для ${pattern.consistentSelectedAction ? 'всех рук' : 'большинства рук'} региона «${label}».`,
      `${actionText} היא התגובה המועדפת שלכם ב${pattern.consistentSelectedAction ? 'כל' : 'רוב'} הידיים באזור ${label}.`));
    else push(say(language,
      `The ${label} you specified share a ${actionText} preference (${handList(region.selectedSample.map((p) => p.handClass))}); the rest of this region remains unresolved.`,
      `Заданные вами руки региона «${label}» объединяет предпочтение ${actionText} (${handList(region.selectedSample.map((p) => p.handClass))}); остальные руки региона ещё не определены.`,
      `הידיים שהגדרתם באזור ${label} חולקות העדפה ל־${actionText} (${handList(region.selectedSample.map((p) => p.handClass))}); שאר האזור עדיין לא הוגדר.`));
    if (pattern.unresolvedLowerNeighbors.length && ['medium_pairs', 'small_pairs', 'suited_kx', 'suited_qx', 'suited_ax'].includes(region.id)) {
      lines[lines.length - 1] += say(language,
        ` The lower boundary still needs evidence at ${handList(pattern.unresolvedLowerNeighbors, 2)}.`,
        ` Для нижней границы ещё нужны ответы по ${handList(pattern.unresolvedLowerNeighbors, 2)}.`,
        ` לגבול התחתון עדיין חסרות תשובות לגבי ${handList(pattern.unresolvedLowerNeighbors, 2)}.`);
    }
    region.selectedSample.forEach((p) => describedHands.add(p.handClass)); patterns += 1;
  }
  if (!lines.length) {
    const region = ordered.find((r) => r.directClasses);
    if (region) {
      const example = region.selectedSample[0], label = regionLabel(region.id, language);
      const action = example.dominantAction ? actionLabel(example.dominantAction, language)
        : say(language, 'an explicit tied mix', 'явно заданная смесь без доминирующего действия', 'תמהיל מפורש ללא פעולה מובילה');
      push(say(language,
        `You specified ${action} for ${handToken(example.handClass)}. That starts the map of ${label}; the region and its boundary still need more examples.`,
        `Вы задали ${action} для ${handToken(example.handClass)}. Это начало изучения региона «${label}»; для самого региона и его границы ещё нужны примеры.`,
        `הגדרתם ${action} עבור ${handToken(example.handClass)}. זו התחלה למיפוי ${label}; לאזור ולגבול שלו עדיין דרושות דוגמאות נוספות.`));
    }
  }
  if (facts.actionConcentration.majorityInPremiumPairsAndBroadways) push(say(language,
    'Among the hands you specified, most aggressive preferences are in premium pairs and Broadways.',
    'Среди заданных вами рук большинство агрессивных предпочтений приходится на старшие пары и бродвей.',
    'מבין הידיים שהגדרתם, רוב ההעדפות האגרסיביות נמצאות בזוגות גבוהים ובברודוויי.'));
  const sparse = ['weak_suited', 'weak_offsuit_high_card', 'small_pairs'].map((id) => ordered.find((r) => r.id === id))
    .filter((r) => r.directClasses < 2);
  kind = 'unresolved';
  if (sparse.length) {
    const names = sparse.slice(0, 2).map((r) => regionLabel(r.id, language)).join(say(language, ' and ', ' и ', ' ו־'));
    push(say(language, `There is not enough direct evidence yet to characterize ${names}.`,
      `Прямых данных пока недостаточно, чтобы описать ${names}.`, `עדיין אין די ראיות ישירות כדי לאפיין ${names}.`));
  }
  const suited = facts.regions.find((r) => r.id === 'suited'), offsuit = facts.regions.find((r) => r.id === 'offsuit');
  if (suited.quantitative && offsuit.quantitative) {
    const a = Math.round(suited.quantitative.participation * 100), b = Math.round(offsuit.quantitative.participation * 100);
    prepend(language === 'ru' ? `По полностью заданным частотам: продолжение с одномастными руками ${a}%, с разномастными ${b}% (с весами канонических комбинаций).`
      : language === 'he' ? `לפי התדירויות המלאות שהוגדרו: המשך עם ידיים סוטד ${a}%, ועם אוף־סוט ${b}% (בשקלול צירופי הקלפים).`
        : `Your complete exact evidence continues suited hands ${a}% and offsuit hands ${b}% (weighted by canonical card combinations).`);
  } else if (suited.structure.completePreferredCoverage && offsuit.structure.completePreferredCoverage
    && suited.structure.preferredContinueClasses !== offsuit.structure.preferredContinueClasses) {
    const more = suited.structure.preferredContinueClasses > offsuit.structure.preferredContinueClasses ? suited : offsuit;
    const less = more === suited ? offsuit : suited;
    prepend(say(language,
      `You mark more ${regionLabel(more.id, language)} than ${regionLabel(less.id, language)} as preferred continues across the fully specified hand classes.`,
      `Среди полностью заданных классов рук вы предпочитаете продолжение с большим числом рук региона «${regionLabel(more.id, language)}», чем региона «${regionLabel(less.id, language)}».`,
      `במחלקות הידיים שהוגדרו במלואן, סימנתם המשך מועדף ביותר ${regionLabel(more.id, language)} מאשר ${regionLabel(less.id, language)}.`));
  } else { kind = 'precision'; push(say(language, 'Overall suited-versus-offsuit participation remains unresolved; unasked hands are not assumed to fold.',
    'Общая частота продолжения с одномастными и разномастными руками пока не определена; неотвеченные руки не считаются фолдами.',
    'תדירות ההמשך הכוללת בסוטד לעומת אוף־סוט עדיין לא נקבעה; ידיים שלא נשאלו אינן נחשבות לפולד.')); }
  kind = 'precision';
  if (facts.regions.some((r) => r.dominantOnlyClasses)) push(say(language,
    'These patterns describe preferred actions, not exact play frequencies.',
    'Эти закономерности описывают предпочтительные действия, а не точные частоты игры.',
    'הדפוסים האלה מתארים פעולות מועדפות, ולא תדירויות משחק מדויקות.'));
  if (!withPresentation) return freeze(lines);
  const labels = {
    conflict: ['Conflicting answers', 'Противоречивые ответы', 'תשובות סותרות'],
    boundary: ['Boundaries', 'Границы', 'גבולות'],
    pattern: ['Stated patterns', 'Заданные закономерности', 'דפוסים שהוגדרו'],
    unresolved: ['Still unresolved', 'Ещё не определено', 'עדיין לא הוגדר'],
    precision: ['Precision', 'Точность', 'דיוק'],
  };
  return freeze(lines.map((text, index) => ({ text, kind: kinds[index],
    label: labels[kinds[index]][['en', 'ru', 'he'].indexOf(language)] })));
}

export function renderPersonalRangeComparison(comparison, { language = 'en', leftName = 'A', rightName = 'B' } = {}) {
  language = languageOf(language);
  if (!comparison.compatible) return freeze([language === 'ru' ? 'Контексты решений несовместимы; сравнение диапазонов недоступно.'
    : language === 'he' ? 'הקשרי ההחלטה אינם תואמים; השוואת הטווחים אינה זמינה.' : 'Decision contexts are incompatible; range comparison is unavailable.']);
  const lines = [], described = new Set();
  let preservedLine = false;
  for (const region of narrativeRegions(comparison.regions)) {
    if (!region.permission.comparison) continue;
    const label = regionLabel(region.id, language);
    const source = comparison.kind === 'personal_to_source';
    const namedRight = source ? region.sourceKind === 'heuristic'
      ? ({ en: 'heuristic baseline', ru: 'эвристическая база', he: 'בסיס היוריסטי' })[language]
      : ({ en: 'selected reference', ru: 'выбранный эталон', he: 'אסטרטגיית הייחוס שנבחרה' })[language] : rightName;
    const preferred = region.preferredParticipation;
    const removed = preferred?.removedContinues.filter((hand) => !described.has(hand)) ?? [];
    const added = preferred?.addedContinues.filter((hand) => !described.has(hand)) ?? [];
    if (removed.length || added.length) {
      const part = preferred.completeRegion ? say(language, 'Across', 'Во всём регионе', 'בכל אזור')
        : say(language, 'Among the specified', 'Среди заданных рук региона', 'בידיים שהוגדרו באזור');
      if (removed.length) lines.push(say(language,
        `${part} ${label}, ${leftName} replaces preferred continues in ${namedRight} with Fold at ${handList(removed)}.`,
        `${part} «${label}», ${leftName} заменяет предпочтительное продолжение из ${namedRight} на Фолд для ${handList(removed)}.`,
        `${part} ${label}, ${leftName} מחליף המשך מועדף אצל ${namedRight} בפולד עם ${handList(removed)}.`));
      if (added.length) lines.push(say(language,
        `${part} ${label}, ${leftName} adds preferred continues where ${namedRight} prefers Fold: ${handList(added)}.`,
        `${part} «${label}», ${leftName} предпочитает продолжение там, где ${namedRight} предпочитает Фолд: ${handList(added)}.`,
        `${part} ${label}, ${leftName} מוסיף המשך מועדף במקום שבו ${namedRight} מעדיף פולד: ${handList(added)}.`));
      [...removed, ...added].forEach((hand) => described.add(hand));
    }
    if (!preservedLine && preferred?.completeRegion && ['suited_connectors', 'suited_one_gappers', 'medium_pairs'].includes(region.id)
      && preferred.preservedContinues.length > region.totalClasses / 2) {
      lines.push(say(language,
        `${leftName} keeps the preferred continues from ${namedRight} through most ${label}; both sides specify this whole region.`,
        `${leftName} сохраняет предпочтительное продолжение из ${namedRight} для большинства рук региона «${label}»; обе стороны полностью задали этот регион.`,
        `${leftName} שומר על ההמשך המועדף של ${namedRight} ברוב ${label}; שני המקורות הגדירו את האזור כולו.`));
      preservedLine = true;
    }
    const remainingDifferences = region.differences.filter((d) => !described.has(d.handClass));
    if (remainingDifferences.length) {
      const examples = remainingDifferences.slice(0, 3).map((d) => `\u2066${d.handClass}\u2069: ${actionLabel(d.leftAction ?? d.personalAction, language)} / ${source ? d.sourcePreferredActions.map((a) => actionLabel(a, language)).join(', ') : actionLabel(d.rightAction, language)}`).join('; ');
      lines.push(language === 'ru' ? `${label}: ${leftName} / ${namedRight} — разные предпочтения в выбранных примерах: ${examples}. Это сравнение, а не оценка правильности.`
        : language === 'he' ? `${label}: ${leftName} / ${namedRight} — העדפות שונות בדוגמאות שנבחרו: ${examples}. זו השוואה ללא קביעה מה נכון.`
          : `${label}: ${leftName} / ${namedRight} differ in preferred actions in these selected examples: ${examples}. This is comparative, with no correctness assessment.`);
      remainingDifferences.forEach((d) => described.add(d.handClass));
    }
    if (region.quantitative) {
      const delta = Math.round(region.quantitative.participationDelta * 1000) / 10;
      lines.push(language === 'ru' ? `${label}: ${leftName} − ${namedRight}, разница частоты продолжения ${delta} п.п. по полностью заданным частотам.`
        : language === 'he' ? `${label}: ${leftName} − ${namedRight}, הפרש בתדירות המשך ${delta} נקודות אחוז לפי תדירויות מלאות שהוגדרו.`
          : `${label}: ${leftName} minus ${namedRight} is ${delta} percentage points of participation, from complete explicit frequencies.`);
    }
  }
  if (lines.length && described.size) lines.push(say(language,
    'This compares stated action preferences; it does not establish exact frequencies or strategic correctness.',
    'Это сравнение предпочтительных действий; оно не определяет точные частоты или стратегическую правильность.',
    'זו השוואה של העדפות פעולה; היא אינה קובעת תדירויות מדויקות או נכונות אסטרטגית.'));
  if (!lines.length) lines.push(language === 'ru' ? 'Для различий, подтверждённых данными, пока недостаточно совместимых данных или различий в выбранных ответах.'
    : language === 'he' ? 'עדיין אין די כיסוי תואם או הבדלים בתשובות שנבחרו כדי לתאר הבדל מבוסס.'
      : 'No supported difference to describe yet: compatible coverage is missing or selected answers have no differences.');
  return freeze(lines);
}

export function personalRangeRegionEnvelope(facts, regionId) {
  const region = facts.regions.find((r) => r.id === regionId);
  if (!region?.permission.sampleDescription) return null;
  return createNaturalLanguageEnvelope({ claimClass: 'interpretive', subject: { role: 'personal_intent', id: facts.scope.modeId },
    evidenceRefs: region.evidenceRefs, scope: facts.scope, uncertainty: region.quantitative ? [] : ['incomplete_exact_region_coverage'],
    derivation: { criterion: region.permission.criterion }, permission: region.permission, facts: region });
}
