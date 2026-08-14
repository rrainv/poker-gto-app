import {
  ACTION_TYPES,
  PREFLOP_HAND_CLASSES,
} from '../../shared/poker-domain/index.js';
import { describeRfiHandClass } from '../../app/src/personal-strategy/rfi-inference.mjs';

export const SYNTHETIC_RFI_TRUTH_FIXTURE_SCHEMA = 'synthetic-rfi-truth-fixture/v1';
export const SYNTHETIC_RFI_TRUTH_FIXTURE_VERSION = 'range-cal002a-synthetic-truth/v1';

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
}

function structuralScore(handClass) {
  const feature = describeRfiHandClass(handClass);
  if (feature.kind === 'pair') return 30 - feature.highRankIndex * 1.85;
  const highStrength = 12 - feature.highRankIndex;
  const lowStrength = 12 - feature.lowRankIndex;
  const suitedBonus = feature.kind === 'suited' ? 2.15 : 0;
  const connectivityBonus = Math.max(0, 4 - feature.gap) * 0.55;
  return highStrength * 1.25 + lowStrength * 0.72 + suitedBonus + connectivityBonus;
}

const STRENGTH_ORDER = Object.freeze([...PREFLOP_HAND_CLASSES].sort((left, right) => (
  structuralScore(right) - structuralScore(left)
  || PREFLOP_HAND_CLASSES.indexOf(left) - PREFLOP_HAND_CLASSES.indexOf(right)
)));

function topCountLabels(count) {
  const raises = new Set(STRENGTH_ORDER.slice(0, count));
  return Object.fromEntries(PREFLOP_HAND_CLASSES.map((handClass) => [
    handClass,
    raises.has(handClass) ? ACTION_TYPES.RAISE : ACTION_TYPES.FOLD,
  ]));
}

function fixture(id, description, createLabels) {
  const labels = createLabels();
  if (Object.keys(labels).length !== PREFLOP_HAND_CLASSES.length
    || PREFLOP_HAND_CLASSES.some((handClass) => !Object.hasOwn(labels, handClass))) {
    throw new Error(`Synthetic fixture ${id} must label all 169 hand classes`);
  }
  for (const label of Object.values(labels)) {
    if (![ACTION_TYPES.FOLD, ACTION_TYPES.RAISE, null].includes(label)) {
      throw new Error(`Synthetic fixture ${id} contains an unsupported truth label`);
    }
  }
  return deepFreeze({
    schemaVersion: SYNTHETIC_RFI_TRUTH_FIXTURE_SCHEMA,
    fixtureVersion: SYNTHETIC_RFI_TRUTH_FIXTURE_VERSION,
    id,
    synthetic: true,
    description,
    labels,
  });
}

function boundaryHeavyLabels() {
  const labels = topCountLabels(67);
  for (const [rank, handClass] of STRENGTH_ORDER.entries()) {
    if (rank >= 50 && rank < 86 && rank % 4 === 1) {
      labels[handClass] = labels[handClass] === ACTION_TYPES.RAISE
        ? ACTION_TYPES.FOLD
        : ACTION_TYPES.RAISE;
    }
  }
  return labels;
}

function irregularLabels() {
  return Object.fromEntries(PREFLOP_HAND_CLASSES.map((handClass, index) => {
    const feature = describeRfiHandClass(handClass);
    const signal = (
      feature.highRankIndex * 7
      + feature.lowRankIndex * 11
      + feature.gap * 5
      + (feature.kind === 'suited' ? 3 : feature.kind === 'offsuit' ? 8 : 1)
      + index * 13
    ) % 19;
    return [handClass, signal < 9 ? ACTION_TYPES.RAISE : ACTION_TYPES.FOLD];
  }));
}

function exploitativeGappedLabels() {
  const labels = topCountLabels(94);
  for (const handClass of PREFLOP_HAND_CLASSES) {
    const feature = describeRfiHandClass(handClass);
    const deliberateBroadwayGap = feature.kind === 'offsuit'
      && feature.highRankIndex <= 3
      && feature.lowRankIndex >= 5
      && feature.lowRankIndex <= 8;
    const suitedIsland = feature.kind === 'suited'
      && feature.highRankIndex >= 5
      && feature.highRankIndex <= 8
      && feature.gap <= 2;
    const pairGap = feature.kind === 'pair'
      && feature.highRankIndex >= 5
      && feature.highRankIndex <= 7;
    if (deliberateBroadwayGap || pairGap) labels[handClass] = ACTION_TYPES.FOLD;
    if (suitedIsland) labels[handClass] = ACTION_TYPES.RAISE;
  }
  return labels;
}

function tiedBoundaryLabels() {
  const labels = topCountLabels(70);
  for (const handClass of STRENGTH_ORDER.slice(62, 77)) labels[handClass] = null;
  return labels;
}

export const SYNTHETIC_RFI_TRUTH_FIXTURES = deepFreeze([
  fixture(
    'smooth-baseline',
    'Synthetic locally smooth structural threshold; not a poker reference chart.',
    () => topCountLabels(67),
  ),
  fixture(
    'tight',
    'Synthetic compact structural threshold with relatively few Raise labels.',
    () => topCountLabels(32),
  ),
  fixture(
    'loose',
    'Synthetic broad structural threshold with many Raise labels.',
    () => topCountLabels(108),
  ),
  fixture(
    'boundary-heavy',
    'Synthetic range with repeated reversals around its structural boundary.',
    boundaryHeavyLabels,
  ),
  fixture(
    'irregular-non-monotonic',
    'Synthetic deliberately non-monotonic local pattern.',
    irregularLabels,
  ),
  fixture(
    'exploitative-gapped',
    'Synthetic broad range with deliberate gaps and suited islands.',
    exploitativeGappedLabels,
  ),
  fixture(
    'tied-mixed-boundary',
    'Synthetic structural range with explicit 50/50 observations at the boundary.',
    tiedBoundaryLabels,
  ),
]);

export function syntheticFixtureById(id) {
  const found = SYNTHETIC_RFI_TRUTH_FIXTURES.find((entry) => entry.id === id);
  if (!found) throw new RangeError(`Unknown synthetic RFI truth fixture: ${id}`);
  return found;
}
