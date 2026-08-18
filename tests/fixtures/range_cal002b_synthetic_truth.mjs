import { ACTION_TYPES, PREFLOP_HAND_CLASSES } from '../../shared/poker-domain/index.js';
import { describeRfiHandClass } from '../../app/src/personal-strategy/rfi-inference.mjs';

export const RANGE_CAL002B_FIXTURE_SCHEMA_VERSION = 'synthetic-personal-strategy-fixture/v1';
export const RANGE_CAL002B_FIXTURE_VERSION = 'range-cal002b-hard-fixtures/v1';

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
}

function structuralScore(handClass) {
  const feature = describeRfiHandClass(handClass);
  if (feature.kind === 'pair') return 31 - feature.highRankIndex * 1.9;
  const high = 12 - feature.highRankIndex;
  const low = 12 - feature.lowRankIndex;
  const suited = feature.kind === 'suited' ? 2.2 : 0;
  const connected = Math.max(0, 4 - feature.gap) * 0.6;
  return high * 1.3 + low * 0.7 + suited + connected;
}

const STRUCTURAL_ORDER = Object.freeze([...PREFLOP_HAND_CLASSES].sort((left, right) => (
  structuralScore(right) - structuralScore(left)
  || PREFLOP_HAND_CLASSES.indexOf(left) - PREFLOP_HAND_CLASSES.indexOf(right)
)));

function topCount(count) {
  const raises = new Set(STRUCTURAL_ORDER.slice(0, count));
  return Object.fromEntries(PREFLOP_HAND_CLASSES.map((handClass) => [
    handClass,
    raises.has(handClass) ? ACTION_TYPES.RAISE : ACTION_TYPES.FOLD,
  ]));
}

function irregularLabels() {
  return Object.fromEntries(PREFLOP_HAND_CLASSES.map((handClass, index) => {
    const feature = describeRfiHandClass(handClass);
    const value = (feature.highRankIndex * 17
      + feature.lowRankIndex * 31
      + feature.gap * 13
      + (feature.kind === 'suited' ? 7 : feature.kind === 'offsuit' ? 19 : 3)
      + index * 23) % 41;
    return [handClass, value < 20 ? ACTION_TYPES.RAISE : ACTION_TYPES.FOLD];
  }));
}

function islandLabels() {
  const labels = Object.fromEntries(PREFLOP_HAND_CLASSES.map((handClass) => [handClass, ACTION_TYPES.FOLD]));
  for (const handClass of PREFLOP_HAND_CLASSES) {
    const feature = describeRfiHandClass(handClass);
    const premiumPairIsland = feature.kind === 'pair' && feature.highRankIndex <= 4;
    const suitedConnectorIsland = feature.kind === 'suited'
      && feature.highRankIndex >= 4 && feature.highRankIndex <= 9 && feature.gap <= 1;
    const suitedAceIsland = feature.kind === 'suited'
      && feature.highRankIndex === 0 && feature.lowRankIndex >= 7;
    if (premiumPairIsland || suitedConnectorIsland || suitedAceIsland) {
      labels[handClass] = ACTION_TYPES.RAISE;
    }
  }
  return labels;
}

function suitedOffsuitAnomalyLabels() {
  const labels = topCount(72);
  for (const handClass of PREFLOP_HAND_CLASSES) {
    const feature = describeRfiHandClass(handClass);
    if (feature.kind === 'suited' && feature.highRankIndex >= 1 && feature.highRankIndex <= 4
      && feature.lowRankIndex >= 6) labels[handClass] = ACTION_TYPES.FOLD;
    if (feature.kind === 'offsuit' && feature.highRankIndex >= 1 && feature.highRankIndex <= 4
      && feature.lowRankIndex >= 6 && feature.lowRankIndex <= 9) labels[handClass] = ACTION_TYPES.RAISE;
  }
  return labels;
}

function pairAnomalyLabels() {
  const labels = topCount(65);
  const anomaly = {
    TT: ACTION_TYPES.FOLD,
    '99': ACTION_TYPES.RAISE,
    '88': ACTION_TYPES.FOLD,
    '77': ACTION_TYPES.RAISE,
    '66': ACTION_TYPES.FOLD,
    '55': ACTION_TYPES.RAISE,
  };
  return { ...labels, ...anomaly };
}

function exactBoundaryMixes(labels) {
  const boundary = STRUCTURAL_ORDER.slice(58, 80);
  return Object.fromEntries(boundary.map((handClass, index) => {
    if (index % 3 === 0) return [handClass, { fold: 0.5, raise: 0.5 }];
    const raise = labels[handClass] === ACTION_TYPES.RAISE ? 0.55 : 0.45;
    return [handClass, { fold: 1 - raise, raise }];
  }));
}

function fixture(id, description, labels, options = {}) {
  if (Object.keys(labels).length !== 169
    || PREFLOP_HAND_CLASSES.some((handClass) => !Object.hasOwn(labels, handClass))) {
    throw new Error(`002B fixture ${id} must label all 169 hand classes`);
  }
  return deepFreeze({
    schemaVersion: RANGE_CAL002B_FIXTURE_SCHEMA_VERSION,
    fixtureVersion: RANGE_CAL002B_FIXTURE_VERSION,
    id,
    description,
    synthetic: true,
    labels,
    exactMixes: options.exactMixes ?? {},
    conflictingHandClass: options.conflictingHandClass ?? null,
  });
}

export const RANGE_CAL002B_SYNTHETIC_FIXTURES = deepFreeze([
  fixture(
    'smooth-tight',
    'Synthetic locally smooth tight RFI target; evaluation mechanics only, not poker truth.',
    topCount(38),
  ),
  fixture(
    'smooth-loose',
    'Synthetic locally smooth loose RFI target; evaluation mechanics only, not poker truth.',
    topCount(108),
  ),
  fixture(
    'irregular-reproducible',
    'Deterministic deliberately non-local user target expected to cause broad abstention.',
    irregularLabels(),
  ),
  fixture(
    'islands-gapped',
    'Separated pair, suited-connector, and suited-Ace islands with large gaps.',
    islandLabels(),
  ),
  fixture(
    'suited-offsuit-anomaly',
    'Deliberately inverted suited/offsuit region inside an otherwise smooth target.',
    suitedOffsuitAnomalyLabels(),
  ),
  fixture(
    'pair-anomaly',
    'Alternating mid-pair intent that violates a smooth pair ordering prior.',
    pairAnomalyLabels(),
  ),
  fixture(
    'contradictory-direct',
    'Smooth target with two incompatible independent active heads at K9s.',
    topCount(72),
    { conflictingHandClass: 'K9s' },
  ),
  (() => {
    const labels = topCount(69);
    return fixture(
      'sparse-exact-boundary',
      'Smooth categorical target with sparse exact and tied mixes around its boundary.',
      labels,
      { exactMixes: exactBoundaryMixes(labels) },
    );
  })(),
]);

export function rangeCal002bFixtureById(id) {
  const fixtureValue = RANGE_CAL002B_SYNTHETIC_FIXTURES.find((entry) => entry.id === id);
  if (!fixtureValue) throw new RangeError(`Unknown RANGE-CAL-002B fixture: ${id}`);
  return fixtureValue;
}
