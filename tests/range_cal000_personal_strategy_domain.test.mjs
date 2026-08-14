import test from 'node:test';
import assert from 'node:assert/strict';

import {
  ACTION_TYPES,
  PREFLOP_HAND_CLASSES,
  isPreflopHandClass,
  preflopHandClassAt,
  preflopHandClassForCards,
} from '../shared/poker-domain/index.js';
import {
  DIRECT_COMPARISON_RELATIONS,
  PROFILE_EVIDENCE_TYPES,
  RANGE_OBSERVATION_STATES,
  createLocalOwnerRef,
  createRangeObservation,
  createRfiCalibrationContext,
  createStrategyProfileBundle,
  createTrainingObservation,
  updateStrategyMode,
  updateStrategyProfile,
  validateRangeObservation,
  validateStrategyMode,
  validateStrategyProfile,
} from '../app/src/personal-strategy/index.mjs';

const CREATED_AT = '2026-08-14T09:00:00.000Z';
const UPDATED_AT = '2026-08-14T10:00:00.000Z';
const OWNER = createLocalOwnerRef('local-owner-1');

function profileBundle(suffix = '1') {
  return createStrategyProfileBundle({
    profileId: `profile-${suffix}`,
    ownerRef: OWNER,
    displayName: suffix === '1' ? 'Home Game with Friends' : 'Live MTT',
    description: 'A relatable poker environment',
    tags: ['private'],
    modes: ['Normal', 'Cautious', 'Pressure'],
    modeIds: [`mode-${suffix}-a`, `mode-${suffix}-b`, `mode-${suffix}-c`],
    createdAt: CREATED_AT,
  });
}

function context(overrides = {}) {
  return createRfiCalibrationContext({
    gameRulesId: 'home/v1',
    tableSize: 6,
    heroPosition: 'BTN',
    effectiveStackBb: 100,
    accounting: {
      anteType: 'none',
      anteBb: 0,
      forcedContributionPerPlayerBb: 0,
      rakeMode: 'off',
    },
    ...overrides,
  });
}

function direct(overrides = {}) {
  return createRangeObservation({
    id: 'direct-1',
    profileId: 'profile-1',
    modeId: 'mode-1-a',
    context: context(),
    handClass: 'A5s',
    dominantAction: { type: ACTION_TYPES.RAISE },
    createdAt: CREATED_AT,
    ...overrides,
  });
}

test('canonical preflop hand classes match the existing 13x13 Matrix notation', () => {
  assert.equal(PREFLOP_HAND_CLASSES.length, 169);
  assert.equal(new Set(PREFLOP_HAND_CLASSES).size, 169);
  assert.equal(preflopHandClassAt(0, 0), 'AA');
  assert.equal(preflopHandClassAt(0, 1), 'AKs');
  assert.equal(preflopHandClassAt(1, 0), 'AKo');
  assert.equal(preflopHandClassAt(12, 12), '22');
  assert.equal(preflopHandClassForCards(['As', 'Ks']), 'AKs');
  assert.equal(preflopHandClassForCards(['Kd', 'Ah']), 'AKo');
  assert.ok(isPreflopHandClass('TT'));
  assert.equal(isPreflopHandClass('10-10'), false);
});

test('StrategyProfile identity is stable independently of its display name', () => {
  const bundle = profileBundle();
  const renamed = updateStrategyProfile(
    bundle.profile,
    { displayName: 'Friday Home Game' },
    UPDATED_AT,
  );

  assert.equal(renamed.id, bundle.profile.id);
  assert.equal(renamed.createdAt, bundle.profile.createdAt);
  assert.equal(renamed.displayName, 'Friday Home Game');
  assert.deepEqual(renamed.modeIds, bundle.profile.modeIds);
  assert.equal(validateStrategyProfile(JSON.parse(JSON.stringify(renamed))).id, renamed.id);
});

test('StrategyProfile v1 owns exactly three custom-named, discrete modes', () => {
  const bundle = profileBundle();
  assert.deepEqual(bundle.modes.map((mode) => mode.displayName), [
    'Normal', 'Cautious', 'Pressure',
  ]);
  assert.deepEqual(bundle.modes.map((mode) => mode.profileId), [
    bundle.profile.id, bundle.profile.id, bundle.profile.id,
  ]);
  assert.ok(bundle.modes.every((mode) => !Object.hasOwn(mode, 'styleValue')));

  const renamed = updateStrategyMode(
    bundle.modes[1],
    { displayName: 'Survival' },
    UPDATED_AT,
  );
  assert.equal(renamed.id, bundle.modes[1].id);
  assert.equal(renamed.displayName, 'Survival');
  assert.throws(
    () => validateStrategyMode({ ...renamed, styleValue: 0.5 }),
    /does not support numeric style/,
  );
  assert.throws(
    () => createStrategyProfileBundle({
      profileId: 'bad-profile', ownerRef: OWNER, displayName: 'Bad',
      modes: ['Tight', 'Loose'], modeIds: ['one', 'two'], createdAt: CREATED_AT,
    }),
    /exactly three/,
  );
});

test('RFI CalibrationContext stores objective spot facts, not profile personality', () => {
  const calibrationContext = context();
  assert.deepEqual(calibrationContext, {
    schemaVersion: 'calibration-context/v1',
    decisionFamily: 'preflop_rfi',
    gameVariant: 'no_limit_texas_holdem',
    gameRulesId: 'home/v1',
    tableSize: 6,
    heroPosition: 'BTN',
    effectiveStackBb: 100,
    accounting: {
      anteType: 'none',
      anteBb: 0,
      forcedContributionPerPlayerBb: 0,
      rakeMode: 'off',
    },
  });
  assert.equal(Object.hasOwn(calibrationContext, 'profileId'), false);
  assert.equal(Object.hasOwn(calibrationContext, 'modeId'), false);
  assert.equal(Object.hasOwn(calibrationContext, 'heroCards'), false);
});

test('dominant action without frequency detail is not represented as a pure strategy', () => {
  const dominantOnly = direct();
  const exactPure = direct({
    id: 'direct-pure',
    frequencies: [
      { action: { type: ACTION_TYPES.RAISE }, probability: 1 },
      { action: { type: ACTION_TYPES.FOLD }, probability: 0 },
    ],
  });

  assert.deepEqual(dominantOnly.dominantAction, { type: ACTION_TYPES.RAISE });
  assert.equal(dominantOnly.hasExplicitFrequencies, false);
  assert.equal(dominantOnly.frequencies, null);
  assert.equal(exactPure.hasExplicitFrequencies, true);
  assert.deepEqual(exactPure.frequencies, [
    { action: { type: ACTION_TYPES.RAISE }, probability: 1 },
  ]);
  assert.notDeepEqual(dominantOnly, exactPure);
});

test('explicit action mixes use structured identities and normalize deterministically', () => {
  const mixed = direct({
    frequencies: [
      { action: { type: ACTION_TYPES.RAISE }, weight: 70 },
      { action: { type: ACTION_TYPES.FOLD }, weight: 30 },
    ],
  });

  assert.equal(mixed.hasExplicitFrequencies, true);
  assert.deepEqual(mixed.frequencies.map((entry) => entry.action), [
    { type: ACTION_TYPES.RAISE },
    { type: ACTION_TYPES.FOLD },
  ]);
  assert.ok(Math.abs(mixed.frequencies[0].probability - 0.7) < 1e-12);
  assert.ok(Math.abs(mixed.frequencies[1].probability - 0.3) < 1e-12);
  assert.equal(mixed.frequencies.reduce((sum, entry) => sum + entry.probability, 0), 1);
  assert.ok(mixed.frequencies.every((entry) => typeof entry.action.type === 'string'));
  assert.equal(JSON.stringify(mixed).includes('Raise'), false);
  assert.throws(
    () => direct({
      dominantAction: { type: ACTION_TYPES.FOLD },
      frequencies: [
        { action: { type: ACTION_TYPES.RAISE }, probability: 0.8 },
        { action: { type: ACTION_TYPES.FOLD }, probability: 0.2 },
      ],
    }),
    /maximum-frequency/,
  );
});

test('retraction is a new history record with no active answer', () => {
  const retraction = direct({
    id: 'direct-2',
    state: RANGE_OBSERVATION_STATES.RETRACTED,
    dominantAction: null,
    supersedesObservationId: 'direct-1',
    createdAt: UPDATED_AT,
  });
  assert.equal(retraction.state, 'retracted');
  assert.equal(retraction.dominantAction, null);
  assert.equal(retraction.hasExplicitFrequencies, false);
  assert.equal(retraction.frequencies, null);
  assert.equal(retraction.revision.supersedesObservationId, 'direct-1');
});

test('direct calibration and Training choice are distinct evidence contracts', () => {
  const rangeObservation = direct();
  const trainingObservation = createTrainingObservation({
    id: 'training-1',
    profileId: rangeObservation.profileId,
    modeId: rangeObservation.modeId,
    context: rangeObservation.context,
    handClass: rangeObservation.handClass,
    chosenAction: { type: ACTION_TYPES.FOLD },
    trainingSessionId: 'current-training-session',
    trainingExerciseId: 'training-exercise-42',
    directCalibrationComparison: {
      observationId: rangeObservation.id,
      relation: DIRECT_COMPARISON_RELATIONS.DEVIATES,
    },
    createdAt: UPDATED_AT,
  });

  assert.equal(rangeObservation.provenance.type, PROFILE_EVIDENCE_TYPES.DIRECT_CALIBRATION);
  assert.equal(trainingObservation.provenance.type, PROFILE_EVIDENCE_TYPES.TRAINING_OBSERVATION);
  assert.deepEqual(rangeObservation.dominantAction, { type: ACTION_TYPES.RAISE });
  assert.deepEqual(trainingObservation.chosenAction, { type: ACTION_TYPES.FOLD });
  assert.equal(Object.hasOwn(trainingObservation, 'dominantAction'), false);
  assert.equal(trainingObservation.directCalibrationComparison.relation, 'deviates');
});

test('serialized domain objects round trip through their validators', () => {
  const bundle = profileBundle();
  const observation = direct({
    frequencies: [
      { action: { type: ACTION_TYPES.RAISE }, probability: 0.6 },
      { action: { type: ACTION_TYPES.FOLD }, probability: 0.4 },
    ],
  });
  const roundTrip = JSON.parse(JSON.stringify({ bundle, observation }));

  validateStrategyProfile(roundTrip.bundle.profile);
  roundTrip.bundle.modes.forEach(validateStrategyMode);
  validateRangeObservation(roundTrip.observation);
  assert.deepEqual(roundTrip, { bundle, observation });
});
