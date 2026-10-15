import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import {
  createGuestHomeViewModel,
  createHomeViewModelController,
} from '../app/src/application/home-view-model.mjs';

import { appStyleSheet, bootApp, indexDocument, text } from './helpers/app-under-test.mjs';

// TEST-HYGIENE-001: index.html / styles.css / logic.js assertions are
// behavioural (parsed markup, the cascade, Home refresh behaviour in the
// running app). View-model/bootstrap/translation sources are outside this
// ticket.
const markup = indexDocument();
const css = appStyleSheet();
const app = await bootApp();
// Imported after boot: the bootstrap module graph self-installs page bridges.
const { installHomeWorkspaceBridge } = await import('../app/src/application/home-workspace-bootstrap.mjs');
const [modelSource, bootstrapSource, translations] = await Promise.all([
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

test('Home v2 UI is responsive, accessible, coalesced, and remains a lightweight consumer', async () => {
  const overview = markup.getElementById('homeAccountOverview');
  assert.equal(overview.querySelector('#homeSyncStatus').getAttribute('aria-live'), 'polite');
  assert.match(text(markup.body), /Saved study, Personal Strategy, and Training Memory stay on this device in Guest Mode\. Guest data does not sync\./);
  assert.ok(markup.querySelector('[data-home-destination="review_mistakes"]'));
  // The overview spans the dashboard. Superseded (TEST-HYGIENE-F03): the
  // two-column "overview overview" areas are overridden by the Home canvas
  // rule, so the product dashboard is a single full-width column.
  const grid = markup.querySelector('.home-dashboard-grid');
  assert.equal(css.cascaded(grid, 'display', { width: 1440 }), 'grid');
  assert.equal(css.cascaded(grid, 'grid-template-columns', { width: 1440 }), 'minmax(0, 1fr)');
  assert.equal(css.cascaded(grid, 'grid-template-columns', { width: 700 }), 'minmax(0, 1fr)');

  // Refreshes are sequenced: only the latest of overlapping loads renders.
  await app.navigate('home');
  await app.settle(300);
  const spy = app.spy(['renderHomeWorkspace', 'callHomeBridge', 'requestPlaybookMode', 'scheduleHomeRefresh']);
  try {
    const first = app.call('refreshHomeWorkspace');
    const second = app.call('refreshHomeWorkspace');
    await Promise.all([first, second]);
    await app.settle(100);
    assert.equal(spy.count('callHomeBridge'), 2);
    assert.equal(spy.count('renderHomeWorkspace'), 1, 'a superseded load does not render');
    // Scheduled refreshes are timer-deferred and coalesced.
    spy.reset();
    app.call('scheduleHomeRefresh');
    app.call('scheduleHomeRefresh');
    assert.equal(spy.count('callHomeBridge'), 0, 'deferred');
    await app.settle(1000);
    assert.equal(spy.count('callHomeBridge'), 1, 'coalesced');
    // Study sync changes schedule a refresh.
    spy.reset();
    app.window.dispatchEvent(new app.window.Event('riverline:studysyncchange'));
    assert.equal(spy.count('scheduleHomeRefresh'), 1);
    // Returning to a live hand goes through the Hand Playbook mode.
    spy.reset();
    await app.call('returnToHomeLiveHand');
    assert.ok(spy.count('requestPlaybookMode') >= 1);
    assert.ok(spy.calls.requestPlaybookMode.every(([mode]) => mode === 'hand'));
  } finally {
    spy.restore();
    await app.navigate('home');
  }
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
