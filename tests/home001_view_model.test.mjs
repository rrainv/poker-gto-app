import test from 'node:test';
import assert from 'node:assert/strict';

import {
  HOME_MISTAKE_LIMIT,
  HOME_RECENT_LIMIT,
  HOME_REVIEW_LIMIT,
  createHomeViewModelController,
} from '../app/src/application/home-view-model.mjs';
import { createPersonalStrategyHomeQuery } from '../app/src/application/personal-strategy-home-query.mjs';
import {
  CALIBRATION_ENVIRONMENTS,
  createRangeCalibrationApplication,
} from '../app/src/application/range-calibration-service.mjs';
import { createMemoryPersonalStrategyDatabase } from '../app/src/personal-strategy/indexeddb-storage.mjs';

const T0 = '2026-08-16T10:00:00.000Z';

class MemoryStorage {
  constructor() { this.values = new Map(); }
  getItem(key) { return this.values.has(key) ? this.values.get(key) : null; }
  setItem(key, value) { this.values.set(key, String(value)); }
}

function annotations(overrides = {}) {
  return {
    schemaVersion: 'saved-study-annotations/v1',
    title: null,
    note: null,
    tags: [],
    reviewState: 'none',
    classifications: [],
    ...overrides,
  };
}

function savedHand(id = 'home-hand') {
  return {
    schemaVersion: 'saved-study-object/v1',
    id,
    createdAt: T0,
    updatedAt: T0,
    annotations: annotations({
      title: 'Sunday final table',
      note: 'Check the turn line',
      tags: [{ key: 'mtt', display: 'MTT' }],
      reviewState: 'review_later',
      classifications: ['mistake'],
    }),
    kind: 'hand',
    payload: {
      heroPlayerId: 'Hero',
      pokerState: {
        players: [
          { playerId: 'Hero', position: 'BTN' },
          { playerId: 'Villain', position: 'BB' },
        ],
        game: { mode: 'home' },
        street: 'turn',
        phase: 'betting',
        board: ['As', '7h', '2c', 'Kd'],
        potMilliBb: 8500,
      },
    },
  };
}

function savedSpot(id = 'home-spot') {
  return {
    schemaVersion: 'saved-study-object/v1',
    id,
    createdAt: T0,
    updatedAt: T0,
    annotations: annotations(),
    kind: 'spot',
    payload: {
      derivation: 'scenario',
      decisionContext: {
        tableSize: 6,
        rakeMode: 'off',
        heroPosition: 'CO',
        street: 'flop',
        board: ['Qs', '8h', '2d'],
        stackBb: 100,
        potBb: 6.5,
        facingSizeBb: 2,
        callAmountBb: null,
      },
      truth: { historyStatus: 'not_available' },
    },
  };
}

test('Home uses only bounded Saved Study queries and builds truthful recent/review/continue state', async () => {
  const calls = [];
  const savedStudyQueries = {
    listRecent(options) { calls.push(['recent', options]); return [savedHand(), savedSpot()]; },
    listForReview(options) { calls.push(['review', options]); return [savedHand()]; },
    listMistakes(options) { calls.push(['mistakes', options]); return [savedHand()]; },
  };
  const personalStrategyQueries = {
    async loadSummary() {
      return {
        profileCount: 1,
        selectedProfile: { id: 'profile-1', displayName: 'Home Game' },
        selectedMode: { id: 'mode-1', displayName: 'Normal' },
        context: {},
        answeredCount: 37,
        totalCount: 169,
        session: { state: 'paused', updatedAt: T0 },
        resumable: true,
      };
    },
  };
  const model = await createHomeViewModelController({
    savedStudyQueries,
    personalStrategyQueries,
  }).load();

  assert.deepEqual(calls, [
    ['recent', { limit: HOME_RECENT_LIMIT }],
    ['review', { limit: HOME_REVIEW_LIMIT }],
    ['mistakes', { limit: HOME_MISTAKE_LIMIT }],
  ]);
  assert.equal(model.sections.recent.items.length, 2);
  assert.equal(model.sections.recent.items[0].potBb, 8.5);
  assert.equal(model.sections.recent.items[0].isMistake, true);
  assert.equal(model.sections.recent.items[1].historyStatus, 'not_available');
  assert.equal(model.sections.continue.items[0].kind, 'range_calibration');
  assert.equal(model.sections.continue.items[0].answeredCount, 37);
  assert.equal(Object.isFrozen(model), true);
});

test('one failed Home section is isolated from the other bounded sections', async () => {
  const model = await createHomeViewModelController({
    savedStudyQueries: {
      async listRecent() { throw Object.assign(new Error('repository unavailable'), { code: 'open_failed' }); },
      async listForReview() { return []; },
      async listMistakes() { return [savedHand()]; },
    },
    personalStrategyQueries: {
      async loadSummary() {
        return {
          profileCount: 0,
          selectedProfile: null,
          selectedMode: null,
          context: null,
          answeredCount: 0,
          totalCount: 169,
          session: null,
          resumable: false,
        };
      },
    },
  }).load();

  assert.equal(model.sections.recent.status, 'error');
  assert.equal(model.sections.review.status, 'ready');
  assert.equal(model.sections.review.mistakes.items.length, 1);
  assert.deepEqual(model.sections.continue.items, []);
  assert.equal(model.sections.personalStrategy.profileCount, 0);
});

test('Personal Strategy Home query reads one selected exact scope and reports resumable direct progress', async () => {
  const storage = new MemoryStorage();
  const database = createMemoryPersonalStrategyDatabase();
  let id = 0;
  const application = createRangeCalibrationApplication({
    storage,
    database,
    idFactory: (prefix) => `${prefix}-${++id}`,
    clock: () => T0,
  });
  const bundle = await application.createProfile({
    displayName: 'Six Max Cash',
    description: null,
    environment: CALIBRATION_ENVIRONMENTS.HOME,
    modeNames: ['Normal', 'Cautious', 'Pressure'],
  });
  const context = {
    environment: CALIBRATION_ENVIRONMENTS.HOME,
    tableSize: 6,
    heroPosition: 'BTN',
    effectiveStackBb: 100,
  };
  await application.saveWorkspaceSelection({
    selectedProfileId: bundle.profile.id,
    activeModeId: bundle.modes[0].id,
    context,
  });
  let session = await application.startOrResumeSession({
    selectedProfileId: bundle.profile.id,
    activeModeId: bundle.modes[0].id,
    context,
  });
  session = await application.answerCalibrationQuestion(session, { actionType: 'raise' });
  session = await application.pauseSession(session);

  const summary = await createPersonalStrategyHomeQuery({ storage, database }).loadSummary();
  assert.equal(summary.selectedProfile.displayName, 'Six Max Cash');
  assert.equal(summary.selectedMode.displayName, 'Normal');
  assert.equal(summary.answeredCount, 1);
  assert.equal(summary.session.state, 'paused');
  assert.equal(summary.resumable, true);
  assert.equal(summary.totalCount, 169);
});
