import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import {
  createGuestHomeViewModel,
  createHomeViewModelController,
} from '../app/src/application/home-view-model.mjs';
import { installHomeWorkspaceBridge } from '../app/src/application/home-workspace-bootstrap.mjs';

const [html, css, logic, modelSource, bootstrapSource, translations] = await Promise.all([
  readFile(new URL('../app/index.html', import.meta.url), 'utf8'),
  readFile(new URL('../app/styles.css', import.meta.url), 'utf8'),
  readFile(new URL('../app/src/core/logic.js', import.meta.url), 'utf8'),
  readFile(new URL('../app/src/application/home-view-model.mjs', import.meta.url), 'utf8'),
  readFile(new URL('../app/src/application/home-workspace-bootstrap.mjs', import.meta.url), 'utf8'),
  readFile(new URL('../app/src/locales/home-translations.js', import.meta.url), 'utf8'),
]);

function savedQueries({ mistakes = [] } = {}) {
  return {
    getById: async () => null,
    listRecent: async () => [],
    listForReview: async () => [],
    listMistakes: async () => mistakes,
  };
}

function emptyStrategy() {
  return {
    profileCount: 0,
    selectedProfile: null,
    selectedMode: null,
    context: null,
    answeredCount: 0,
    directEvidenceCount: 0,
    contradictionCount: 0,
    totalCount: 169,
    session: null,
    resumable: false,
  };
}

test('Guest Home exposes useful tools and only a genuine in-memory continuation', () => {
  const empty = createGuestHomeViewModel();
  assert.equal(empty.sessionMode, 'guest');
  assert.deepEqual(empty.sections.quickStart.destinations, ['hand', 'analyze', 'training', 'equity']);
  assert.deepEqual(empty.sections.continue.items, []);
  assert.equal(empty.sections.personalStrategy.status, 'unavailable');

  const withHand = createGuestHomeViewModel({ continuation: { hasLiveHand: true } });
  assert.deepEqual(withHand.sections.continue.items.map((item) => item.kind), ['live_hand']);
  assert.equal(withHand.sections.recent.status, 'unavailable');
});

test('Guest bridge never queries account-owned Saved or Personal Strategy data', async () => {
  let durableReads = 0;
  const browserWindow = {
    localStorage: { getItem: () => null, setItem() {} },
    RiverlineAuthentication: {
      ready: async () => {},
      getState: () => ({ status: 'guest', profile: null }),
    },
    RiverlineAccountIdentity: {
      getProfileSummary: async () => { durableReads += 1; return null; },
    },
    RiverlinePlaybookState: {
      hasLiveHand: () => true,
      openSavedHand() {},
    },
  };
  const guardedSaved = {
    getById: async () => null,
    listRecent: async () => { durableReads += 1; return []; },
    listForReview: async () => { durableReads += 1; return []; },
    listMistakes: async () => { durableReads += 1; return []; },
  };
  const home = installHomeWorkspaceBridge(browserWindow, {
    savedStudyQueries: guardedSaved,
    personalStrategyQueries: {
      loadSummary: async () => { durableReads += 1; return emptyStrategy(); },
    },
  });
  const model = await home.load();
  assert.equal(durableReads, 0);
  assert.deepEqual(model.sections.continue.items.map((item) => item.kind), ['live_hand']);
});

test('authenticated Home composes account, sync, evidence, Continue, and future seams truthfully', async () => {
  const model = await createHomeViewModelController({
    savedStudyQueries: savedQueries(),
    personalStrategyQueries: {
      loadSummary: async () => ({
        profileCount: 2,
        selectedProfile: { id: 'profile-1', displayName: 'Home Game with Friends' },
        selectedMode: { id: 'mode-2', displayName: 'Mode 2' },
        context: { tableSize: 6, environment: 'home' },
        answeredCount: 42,
        directEvidenceCount: 45,
        contradictionCount: 3,
        totalCount: 169,
        session: { state: 'active', updatedAt: '2026-08-18T10:00:00.000Z' },
        resumable: true,
      }),
    },
    profileQueries: {
      getProfileSummary: async () => ({
        schemaVersion: 'home-account-identity/v1',
        displayName: 'Dana River',
        username: 'dana_river',
      }),
    },
    syncQueries: {
      getState: () => ({
        state: 'offline', enabled: true, pendingCount: 3, conflictCount: 0, errorCount: 0,
      }),
    },
    continuationQueries: { getSummary: () => ({ hasLiveHand: true }) },
  }).load();

  assert.equal(model.identity.profile.username, 'dana_river');
  assert.equal(model.sync.state, 'offline');
  assert.equal(model.sync.pendingCount, 3);
  assert.deepEqual(model.sections.continue.items.map((item) => item.kind), [
    'range_calibration', 'live_hand',
  ]);
  assert.equal(model.sections.continue.items[0].answeredCount, 42);
  assert.equal(model.sections.personalStrategy.directEvidenceCount, 45);
  assert.equal(model.sections.personalStrategy.contradictionCount, 3);
  assert.equal(model.sections.history.training.status, 'unsupported');
  assert.equal(model.sections.history.analysis.status, 'unsupported');
  assert.equal(JSON.stringify(model).includes('accuracy'), false);
  assert.equal(JSON.stringify(model).includes('mastery'), false);
  assert.equal(JSON.stringify(model).includes('streak'), false);
});

test('account switches and sync transitions are resolved from current query state on every load', async () => {
  let profile = { displayName: 'Account A', username: 'account_a' };
  let sync = { state: 'synced', enabled: true, pendingCount: 0, conflictCount: 0, errorCount: 0 };
  const controller = createHomeViewModelController({
    savedStudyQueries: savedQueries(),
    personalStrategyQueries: { loadSummary: async () => emptyStrategy() },
    profileQueries: { getProfileSummary: async () => ({ ...profile }) },
    syncQueries: { getState: () => ({ ...sync }) },
  });
  const a = await controller.load();
  profile = { displayName: 'Account B', username: 'account_b' };
  sync = { state: 'conflict', enabled: true, pendingCount: 1, conflictCount: 1, errorCount: 0 };
  const b = await controller.load();
  assert.equal(a.identity.profile.username, 'account_a');
  assert.equal(b.identity.profile.username, 'account_b');
  assert.equal(b.sync.state, 'conflict');
});

test('Home v2 UI is responsive, accessible, coalesced, and remains a lightweight consumer', () => {
  assert.match(html, /id="homeAccountOverview"[\s\S]*?id="homeSyncStatus"[\s\S]*?aria-live="polite"/);
  assert.match(html, /Sign in to save hands, build Personal Strategy, and sync study progress\./);
  assert.match(html, /data-home-destination="review_mistakes"/);
  assert.match(css, /grid-template-areas:[\s\S]*?"overview overview"/);
  assert.match(css, /@media \(max-width: 760px\)/);
  assert.match(css, /border-inline-start|padding-inline-start/);
  assert.match(logic, /homeRefreshSequence/);
  assert.match(logic, /returnToHomeLiveHand[\s\S]*?requestPlaybookMode\(PLAYBOOK_MODES\.HAND\)/);
  assert.match(logic, /scheduleHomeRefresh[\s\S]*?setTimeout/);
  assert.match(logic, /riverline:studysyncchange/);
  assert.match(bootstrapSource, /createGuestHomeViewModel/);
  assert.doesNotMatch(`${modelSource}\n${bootstrapSource}`, /indexedDB|objectStore|StrategyProvider|resolveStrategy|Equity|1326|169-hand|setInterval/);
});

test('HOME-002A copy has structural EN/RU/HE coverage', () => {
  assert.match(translations, /const ru =/);
  assert.match(translations, /const he =/);
  for (const key of [
    'My Riverline', 'Study sync', 'Welcome to Riverline', 'Analyze a Hand', 'Review Mistakes',
    'No saved study yet.', 'Conflict needs attention', 'Syncing', 'Offline', 'Synced',
    '{count} contradictory evidence records',
  ]) {
    const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    assert.equal((translations.match(new RegExp(`'${escaped}'`, 'g')) || []).length, 2, key);
  }
});
