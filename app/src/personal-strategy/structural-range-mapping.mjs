import { PREFLOP_HAND_CLASSES } from '../../../shared/poker-domain/index.js';
import { describeRfiHandClass, validatePersonalStrategySnapshot } from './rfi-inference.mjs';
import { validatePersonalStrategyEvidenceView } from './evidence-view.mjs';
import { calibrationContextsEquivalent } from './domain.mjs';

export const RFI_STRUCTURAL_MAPPING_VERSION = 'rfi-structural-range-mapping/v1';
const features = new Map(PREFLOP_HAND_CLASSES.map((hand) => [hand, describeRfiHandClass(hand)]));
const pair = (f) => f.kind === 'pair';
const suited = (f) => f.kind === 'suited';
const offsuit = (f) => f.kind === 'offsuit';
const broadway = (f) => !pair(f) && f.lowRankIndex <= 4;
const family = (id, labelKey, predicate) => Object.freeze({ id, labelKey,
  handClasses: Object.freeze(PREFLOP_HAND_CLASSES.filter((hand) => predicate(features.get(hand)))) });
export const RFI_MAPPING_FAMILIES = Object.freeze([
  family('premium_pairs', 'Premium pocket pairs', (f) => pair(f) && f.highRankIndex <= 2),
  family('medium_pairs', 'Medium pocket pairs', (f) => pair(f) && f.highRankIndex >= 3 && f.highRankIndex <= 8),
  family('small_pairs', 'Small pocket pairs', (f) => pair(f) && f.highRankIndex >= 9),
  family('suited_broadway', 'Suited Broadways', (f) => suited(f) && broadway(f)),
  family('offsuit_broadway', 'Offsuit Broadways', (f) => offsuit(f) && broadway(f)),
  family('suited_ax', 'Suited Ax', (f) => suited(f) && f.highRankIndex === 0),
  family('offsuit_ax', 'Offsuit Ax', (f) => offsuit(f) && f.highRankIndex === 0),
  family('suited_kx', 'Suited Kx', (f) => suited(f) && f.highRankIndex === 1),
  family('suited_qx', 'Suited Qx', (f) => suited(f) && f.highRankIndex === 2),
  family('suited_connectors', 'Suited connectors', (f) => suited(f) && f.gap === 0 && !broadway(f)),
  family('suited_one_gappers', 'Suited one-gappers', (f) => suited(f) && f.gap === 1 && !broadway(f)),
  family('weak_suited', 'Weaker suited hands', (f) => suited(f) && f.highRankIndex >= 3 && f.lowRankIndex >= 6 && f.gap > 1),
  family('offsuit_connectivity', 'Connected offsuit hands', (f) => offsuit(f) && f.gap <= 1 && !broadway(f)),
  family('weak_offsuit_high_card', 'Weak offsuit high cards', (f) => offsuit(f) && f.highRankIndex <= 2 && f.lowRankIndex >= 6),
  family('low_cards', 'Low-end hands', (f) => f.highRankIndex >= 7),
]);
export const RFI_MAPPING_REASON_KEYS = Object.freeze({
  focus: 'This follows the hand family you chose.',
  unmapped: "Let's explore a hand family you have not described yet.",
  boundary: "Let's clarify where your preferred action changes.",
  nearby: "Let's check a nearby hand before describing this region.",
  gap: "Let's sample another part of this hand family.",
  conflict: 'Your answers conflict here; review them before mapping further.',
});
export const RFI_MAPPING_FAMILY_REASON_KEYS = Object.freeze({
  pairs: "Let's clarify your pocket-pair boundary.",
  suited_broadway: "Let's see which suited Broadways you prefer to continue.",
  offsuit_broadway: "Let's fill in your offsuit Broadway range.",
  ax: "Let's clarify how you treat weaker Ax hands.",
  suited_high_cards: "Let's clarify the lower boundary of your suited high cards.",
  connectivity: "Let's see where connected hands leave your continuing range.",
  lower_end: "Let's check the lower end before describing your range.",
});
export function rfiMappingFamilyReasonKey(familyId) {
  if (familyId?.endsWith('_pairs')) return RFI_MAPPING_FAMILY_REASON_KEYS.pairs;
  if (['suited_broadway', 'offsuit_broadway'].includes(familyId)) return RFI_MAPPING_FAMILY_REASON_KEYS[familyId];
  if (familyId?.endsWith('_ax')) return RFI_MAPPING_FAMILY_REASON_KEYS.ax;
  if (['suited_kx', 'suited_qx'].includes(familyId)) return RFI_MAPPING_FAMILY_REASON_KEYS.suited_high_cards;
  if (['suited_connectors', 'suited_one_gappers', 'offsuit_connectivity'].includes(familyId)) return RFI_MAPPING_FAMILY_REASON_KEYS.connectivity;
  return RFI_MAPPING_FAMILY_REASON_KEYS.lower_end;
}
function freeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.values(value).forEach(freeze); Object.freeze(value);
  }
  return value;
}
function lane(hand) {
  const f = features.get(hand);
  if (pair(f)) return 'pair';
  if (f.gap <= 1 && f.highRankIndex >= 3) return `${f.kind}:gap:${f.gap}`;
  return `${f.kind}:high:${f.highRankIndex}`;
}
function distance(left, right) {
  const a = features.get(left), b = features.get(right);
  return Math.abs(a.highRankIndex - b.highRankIndex) + Math.abs(a.lowRankIndex - b.lowRankIndex);
}
export function matchesRfiMappingFocus(handClass, focus) {
  if (!focus) return false;
  const f = features.get(handClass);
  if (focus === 'suited_boundary') return suited(f);
  if (focus === 'offsuit_boundary') return offsuit(f);
  if (focus === 'pair_boundary') return pair(f);
  return RFI_MAPPING_FAMILIES.find((entry) => entry.id === focus)?.handClasses.includes(handClass) ?? false;
}

// Facts only: the existing rfi-question-selection module owns candidate ranking.
// Direct examples support an initial map; no family state grants range frequency
// or complete-region claims. Estimates and qualitative statements never count.
export function createRfiStructuralMappingFacts({ snapshot = null, evidenceView = null } = {}) {
  if (evidenceView) validatePersonalStrategyEvidenceView(evidenceView);
  else validatePersonalStrategySnapshot(snapshot);
  if (snapshot && evidenceView && (snapshot.scope.profileId !== evidenceView.scope.profileId
    || snapshot.scope.modeId !== evidenceView.scope.modeId
    || !calibrationContextsEquivalent(snapshot.scope.context, evidenceView.scope.context)
    || snapshot.evidenceRevision.fingerprint !== evidenceView.evidenceFingerprint)) {
    throw new RangeError('Structural mapping evidence must match the active snapshot scope and revision');
  }
  const direct = new Map(), conflicts = new Set();
  if (evidenceView) {
    for (const point of evidenceView.points) {
      if (['direct_dominant', 'direct_exact'].includes(point.resolution)) direct.set(point.handClass, point.strategyValue?.dominantAction?.type ?? null);
      if (point.resolution === 'conflicting') conflicts.add(point.handClass);
    }
  } else {
    for (const estimate of snapshot?.estimates ?? []) {
      if (estimate.status === 'directly_known') direct.set(estimate.handClass, estimate.dominantAction?.type ?? null);
      if (estimate.status === 'conflicting') conflicts.add(estimate.handClass);
    }
  }
  const families = RFI_MAPPING_FAMILIES.map((definition) => {
    const hands = [...definition.handClasses].sort((a, b) => {
      const x = features.get(a), y = features.get(b);
      return x.highRankIndex + x.lowRankIndex - y.highRankIndex - y.lowRankIndex || PREFLOP_HAND_CLASSES.indexOf(a) - PREFLOP_HAND_CLASSES.indexOf(b);
    });
    const answered = hands.filter((hand) => direct.has(hand));
    const missing = hands.filter((hand) => !direct.has(hand) && !conflicts.has(hand));
    const conflictHands = hands.filter((hand) => conflicts.has(hand));
    const boundaries = [], boundaryProbes = [];
    const lanes = [...new Set(hands.map(lane))];
    for (const key of lanes) {
      const sameLane = hands.filter((hand) => lane(hand) === key);
      const tested = sameLane.filter((hand) => direct.has(hand));
      for (let i = 1; i < tested.length; i += 1) {
        const stronger = tested[i - 1], weaker = tested[i];
        if (direct.get(stronger) === null || direct.get(weaker) === null || direct.get(stronger) === direct.get(weaker)) continue;
        const between = sameLane.slice(sameLane.indexOf(stronger) + 1, sameLane.indexOf(weaker)).filter((hand) => !direct.has(hand));
        boundaries.push({ stronger, weaker, strongerAction: direct.get(stronger), weakerAction: direct.get(weaker), unresolvedHands: between });
        if (between.length) boundaryProbes.push(between[Math.floor((between.length - 1) / 2)]);
      }
    }
    const span = answered.length ? hands.indexOf(answered.at(-1)) - hands.indexOf(answered[0]) : 0;
    const adjacentBoundary = boundaries.some((entry) => entry.unresolvedHands.length === 0);
    const enoughSamples = answered.length >= 2 && (adjacentBoundary
      || (answered.length >= Math.min(3, hands.length) && span >= Math.floor((hands.length - 1) / 2)));
    const state = conflictHands.length ? 'conflict' : !answered.length ? 'unknown'
      : (enoughSamples && !boundaryProbes.length) || answered.length === hands.length ? 'initially_sampled' : 'partial';
    let probeHand = missing[Math.floor(missing.length / 2)] ?? null;
    let probeKind = state === 'unknown' ? 'unmapped' : 'gap';
    if (boundaryProbes.length) { probeHand = boundaryProbes[0]; probeKind = 'boundary'; }
    else if (state === 'partial' && answered.length) {
      const anchor = answered.at(-1), anchorIndex = hands.indexOf(anchor);
      const preferredDirection = direct.get(anchor) === 'fold' ? -1 : 1;
      const nearby = missing.filter((hand) => lane(hand) === lane(anchor))
        .sort((a, b) => (Math.sign(hands.indexOf(a) - anchorIndex) === preferredDirection ? 0 : 1)
          - (Math.sign(hands.indexOf(b) - anchorIndex) === preferredDirection ? 0 : 1) || distance(a, anchor) - distance(b, anchor));
      if (answered.length < 2 && nearby.length) { probeHand = nearby[0]; probeKind = 'nearby'; }
      else if (missing.length) {
        probeHand = [...missing].sort((a, b) => Math.min(...answered.map((hand) => distance(b, hand)))
          - Math.min(...answered.map((hand) => distance(a, hand))))[0];
      }
    }
    return { ...definition, state, directCount: answered.length, totalClasses: hands.length,
      sampledHands: answered, conflictHands, boundaries, probeHand, probeKind,
      completeRegion: answered.length === hands.length, permitsWholeRegionClaim: false };
  });
  const initialMapReady = families.every((entry) => entry.state === 'initially_sampled');
  return freeze({ schemaVersion: RFI_STRUCTURAL_MAPPING_VERSION, phase: initialMapReady ? 'refinement' : 'mapping',
    initialMapReady, families, directHands: [...direct.keys()], conflictHands: [...conflicts], directCount: direct.size, completeRange: direct.size === PREFLOP_HAND_CLASSES.length,
    sampledFamilyCount: families.filter((entry) => entry.state === 'initially_sampled').length,
    familyCount: families.length, permitsWholeRegionClaim: false });
}
