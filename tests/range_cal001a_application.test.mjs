import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CALIBRATION_ENVIRONMENTS,
  RANGE_CALIBRATION_OWNER_KEY,
  RANGE_CALIBRATION_PREFERENCES_KEY,
  createContextFromSelection,
  createRangeCalibrationApplication,
  normalizeRfiContextSelection,
  rfiPositionsForTableSize,
  tableSizesForEnvironment,
} from '../app/src/application/range-calibration-service.mjs';
import { PERSONAL_STRATEGY_STORAGE_KEY } from '../app/src/personal-strategy/index.mjs';

class MemoryStorage {
  constructor(entries = {}) { this.values = new Map(Object.entries(entries)); this.reads = []; this.writes = []; }
  getItem(key) { this.reads.push(key); return this.values.has(key) ? this.values.get(key) : null; }
  setItem(key, value) { this.writes.push(key); this.values.set(key, String(value)); }
}

function idFactory() {
  let next = 0;
  return (prefix) => `${prefix}-${++next}`;
}

function appFor(storage, { start = '2026-08-14T09:00:00.000Z' } = {}) {
  let tick = 0;
  return createRangeCalibrationApplication({
    storage,
    idFactory: idFactory(),
    clock: () => new Date(Date.parse(start) + tick++ * 1000),
  });
}

const profileInput = {
  displayName: 'Home Game with Friends',
  description: 'Friday game',
  environment: CALIBRATION_ENVIRONMENTS.HOME,
  modeNames: ['Normal', 'Cautious', 'Pressure'],
};

test('first activation creates one stable local owner and starts with a truthful empty library', () => {
  const storage = new MemoryStorage();
  const first = appFor(storage);
  assert.equal(first.readWorkspace().profiles.length, 0);
  const ownerId = storage.getItem(RANGE_CALIBRATION_OWNER_KEY);
  assert.match(ownerId, /^local-owner-/);

  const reconstructed = appFor(storage);
  assert.equal(reconstructed.ownerRef.id, ownerId);
  assert.equal(storage.writes.filter((key) => key === RANGE_CALIBRATION_OWNER_KEY).length, 1);
});

test('profile creation persists exactly three custom discrete modes through repository reconstruction', () => {
  const storage = new MemoryStorage();
  const application = appFor(storage);
  const bundle = application.createProfile(profileInput);
  assert.equal(bundle.profile.modeIds.length, 3);
  assert.deepEqual(bundle.modes.map((mode) => mode.displayName), profileInput.modeNames);
  assert.equal(bundle.modes.some((mode) => 'styleValue' in mode || 'interpolationCoordinate' in mode), false);

  const reconstructed = appFor(storage).readWorkspace();
  assert.equal(reconstructed.profiles.length, 1);
  assert.deepEqual(reconstructed.profiles[0].modes.map((mode) => mode.displayName), profileInput.modeNames);
  assert.ok(storage.writes.includes(PERSONAL_STRATEGY_STORAGE_KEY));
});

test('profile and mode renames are one validated repository mutation and duplicate mode names fail atomically', () => {
  const storage = new MemoryStorage();
  const application = appFor(storage);
  const bundle = application.createProfile(profileInput);
  const beforeRevision = application.readWorkspace().snapshot.revision;
  application.updateProfileConfiguration(bundle.profile.id, {
    displayName: 'Friday Home Game',
    description: 'Deep and friendly',
    modeNames: ['Steady', 'Careful', 'Pressure'],
  });
  const updated = application.readWorkspace();
  assert.equal(updated.snapshot.revision, beforeRevision + 1);
  assert.equal(updated.profiles[0].profile.displayName, 'Friday Home Game');
  assert.deepEqual(updated.profiles[0].modes.map((mode) => mode.displayName), ['Steady', 'Careful', 'Pressure']);

  const durableBeforeFailure = storage.getItem(PERSONAL_STRATEGY_STORAGE_KEY);
  assert.throws(() => application.updateProfileConfiguration(bundle.profile.id, {
    displayName: 'Should not persist',
    description: '',
    modeNames: ['Same', 'same', 'Third'],
  }), /different/i);
  assert.equal(storage.getItem(PERSONAL_STRATEGY_STORAGE_KEY), durableBeforeFailure);
});

test('RFI table sizes reuse canonical positions, exclude the impossible BB check option, and correct shrinkage predictably', () => {
  assert.deepEqual(tableSizesForEnvironment(CALIBRATION_ENVIRONMENTS.HOME), [2, 3, 4, 5, 6, 7, 8, 9, 10]);
  assert.deepEqual(tableSizesForEnvironment(CALIBRATION_ENVIRONMENTS.CLUBGG), [7, 8, 9, 10]);
  assert.deepEqual(rfiPositionsForTableSize(6), ['UTG', 'HJ', 'CO', 'BTN', 'SB']);
  assert.deepEqual(rfiPositionsForTableSize(2), ['BTN']);

  const corrected = normalizeRfiContextSelection({
    environment: CALIBRATION_ENVIRONMENTS.HOME,
    tableSize: 4,
    heroPosition: 'UTG+2',
    effectiveStackBb: 100,
  });
  assert.equal(corrected.heroPosition, 'BTN');
});

test('effective stack and accounting validation use the current 10–500bb and Home/ClubGG rules', () => {
  for (const effectiveStackBb of [10, 20, 100, 500]) {
    assert.equal(createContextFromSelection({
      environment: CALIBRATION_ENVIRONMENTS.HOME,
      tableSize: 6,
      heroPosition: 'BTN',
      effectiveStackBb,
    }).effectiveStackBb, effectiveStackBb);
  }
  for (const effectiveStackBb of [0, 9.9, 500.1, Number.NaN]) {
    assert.throws(() => createContextFromSelection({
      environment: CALIBRATION_ENVIRONMENTS.HOME,
      tableSize: 6,
      heroPosition: 'BTN',
      effectiveStackBb,
    }), /10 through 500/);
  }
  const home = createContextFromSelection({ environment: 'home', tableSize: 6, heroPosition: 'BTN', effectiveStackBb: 100 });
  const club = createContextFromSelection({ environment: 'clubgg', tableSize: 8, heroPosition: 'BTN', effectiveStackBb: 100 });
  assert.deepEqual(home.accounting, { anteType: 'none', anteBb: 0, forcedContributionPerPlayerBb: 0, rakeMode: 'off' });
  assert.deepEqual(club.accounting, { anteType: 'none', anteBb: 0, forcedContributionPerPlayerBb: 0.1, rakeMode: 'fixed_per_seated_player' });
});

test('selected mode and exact context persist separately from profile defaults', () => {
  const storage = new MemoryStorage();
  const application = appFor(storage);
  const bundle = application.createProfile(profileInput);
  application.saveWorkspaceSelection({
    selectedProfileId: bundle.profile.id,
    activeModeId: bundle.modes[2].id,
    context: { environment: 'clubgg', tableSize: 9, heroPosition: 'CO', effectiveStackBb: 30 },
  });
  const reconstructed = appFor(storage).readWorkspace();
  const preference = reconstructed.preferences.byProfile[bundle.profile.id];
  assert.equal(preference.activeModeId, bundle.modes[2].id);
  assert.deepEqual(preference.context, { environment: 'clubgg', tableSize: 9, heroPosition: 'CO', effectiveStackBb: 30 });
  assert.equal(reconstructed.profiles[0].profile.tags.includes('riverline:environment:home'), true);
  assert.ok(storage.writes.includes(RANGE_CALIBRATION_PREFERENCES_KEY));
});

test('each selected profile exposes only its own three custom modes', () => {
  const storage = new MemoryStorage();
  const application = appFor(storage);
  const home = application.createProfile(profileInput);
  const club = application.createProfile({
    displayName: 'Club nights',
    description: '',
    environment: CALIBRATION_ENVIRONMENTS.CLUBGG,
    modeNames: ['Default club', 'Short-handed', 'Late session'],
  });
  const workspace = application.readWorkspace();
  const homeEntry = workspace.profiles.find((entry) => entry.profile.id === home.profile.id);
  const clubEntry = workspace.profiles.find((entry) => entry.profile.id === club.profile.id);
  assert.deepEqual(homeEntry.modes.map((mode) => mode.displayName), profileInput.modeNames);
  assert.deepEqual(clubEntry.modes.map((mode) => mode.displayName), ['Default club', 'Short-handed', 'Late session']);
  assert.equal(homeEntry.modes.some((mode) => club.profile.modeIds.includes(mode.id)), false);
});

test('injected storage adapter is observed while profile mutations remain repository-backed', () => {
  const storage = new MemoryStorage();
  const application = appFor(storage);
  application.createProfile(profileInput);
  const metrics = application.getStorageMetrics();
  assert.ok(metrics.readsByKey[PERSONAL_STRATEGY_STORAGE_KEY] >= 1);
  assert.equal(metrics.writesByKey[PERSONAL_STRATEGY_STORAGE_KEY], 1);
});
