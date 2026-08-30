import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import {
  createWelcomeOrientationPreference,
  createWelcomeOrientationSession,
} from '../app/src/application/welcome-orientation.mjs';
import {
  createGuestHomeViewModel,
  createHomeViewModelController,
} from '../app/src/application/home-view-model.mjs';

const [html, css, logic, bootstrap, prepaint, translations] = await Promise.all([
  readFile(new URL('../app/index.html', import.meta.url), 'utf8'),
  readFile(new URL('../app/styles.css', import.meta.url), 'utf8'),
  readFile(new URL('../app/src/core/logic.js', import.meta.url), 'utf8'),
  readFile(new URL('../app/src/application/welcome-orientation-bootstrap.mjs', import.meta.url), 'utf8'),
  readFile(new URL('../app/src/application/welcome-orientation-prepaint.js', import.meta.url), 'utf8'),
  readFile(new URL('../app/src/locales/home-translations.js', import.meta.url), 'utf8'),
]);

function memoryStorage() {
  const values = new Map();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
  };
}

test('onboarding preference suppresses only orientation while Home remains the landing destination', () => {
  const preference = createWelcomeOrientationPreference({ storage: memoryStorage() });
  const routes = [];
  const session = createWelcomeOrientationSession({ preference, navigate: (route) => routes.push(route) });
  session.open();
  session.dismiss({ remember: true });
  assert.equal(preference.shouldShowOnStartup(), false);
  assert.deepEqual(routes, ['home']);
  assert.match(html, /data-active-mode="home" data-active-destination="home"/);
  assert.match(html, /data-navigation-id="home"[^>]*aria-current="page"/);
  assert.doesNotMatch(prepaint, /activeMode = 'welcome'|activeDestination = 'welcome'/);
});

test('orientation has no false selected workspace and dismissal restores sensible focus without poker mutation', () => {
  assert.match(bootstrap, /clearNavigationSelection[\s\S]*?classList\.remove\('active'\)[\s\S]*?aria-current', 'false'/);
  assert.doesNotMatch(bootstrap, /shell\.dataset\.activeMode = 'welcome'|shell\.dataset\.activeDestination = 'welcome'/);
  assert.match(bootstrap, /session\.dismiss[\s\S]*?findNavigationControl\('home'\)\?\.focus/);
  assert.doesNotMatch(bootstrap, /PokerState|requestPlaybookMode|TrainingSession|StrategyProvider/);
  assert.doesNotMatch(css, /data-welcome-orientation="(?:unseen|visible)"\] \.workspace-canvas[\s\S]{0,120}display: none/);
  assert.match(logic, /if \(activeWorkspaceMode\(\) === 'home' && !welcomeOrientationIsVisible\(\)\) void refreshHomeWorkspace\(\)/);
  assert.match(logic, /async function refreshHomeWorkspace[\s\S]*?if \(welcomeOrientationIsVisible\(\)\) return;/);
});

test('a rejected navigation aborts before any shared workspace transition', () => {
  const handler = logic.slice(
    logic.indexOf("$$('.mode-nav-item[data-mode]').forEach"),
    logic.indexOf('const revealPlaybookDestination'),
  );
  assert.match(handler, /if \(!activateNavigationItem\(button\)\) return;/);
  assert.ok(handler.indexOf('if (!activateNavigationItem(button)) return;') < handler.indexOf('clearToast()'));
  assert.ok(handler.indexOf('if (!activateNavigationItem(button)) return;') < handler.indexOf("$$('.mode-view')"));
  assert.ok(handler.indexOf('if (!activateNavigationItem(button)) return;') < handler.indexOf('requestPlaybookMode'));
});

test('inactive Hand has identity only and never receives pseudo-selection styling', () => {
  assert.doesNotMatch(css, /\.mode-nav-item--hand:not\(\.active\):not\(\[aria-current="page"\]\)[\s\S]*?(?:background|border-color)/);
  assert.match(css, /\.mode-nav-item--hand \.mode-nav-icon \{ color: var\(--accent-secondary\); \}/);
  assert.match(css, /\.mode-nav-item\.active,[\s\S]*?\.mode-nav-item\[aria-current="page"\][\s\S]*?background: var\(--surface-interactive\)/);
});

test('Guest Home exposes truthful Start, core study, Personal, and supporting destinations', () => {
  const model = createGuestHomeViewModel();
  assert.deepEqual(model.sections.continue.items, []);
  assert.deepEqual(model.sections.quickStart.destinations, ['hand', 'analyze', 'training', 'equity']);
  assert.equal(model.sections.personalStrategy.status, 'unavailable');

  const home = html.slice(html.indexOf('id="homeMode"'), html.indexOf('id="homegameMode"'));
  const core = home.slice(home.indexOf('class="home-quick-links"'), home.indexOf('class="panel home-section home-section--other"'));
  for (const destination of ['hand', 'analyze', 'training', 'equity']) {
    assert.equal((core.match(new RegExp(`data-home-destination="${destination}"`, 'g')) ?? []).length, 1);
  }
  for (const destination of ['saved', 'home-game', 'guide']) {
    assert.match(home, new RegExp(`data-home-destination="${destination}"`));
  }
  assert.match(logic, /homeEmptyAction\('Play or reconstruct a legal hand\.', 'Start a Hand', 'hand', \{ primary: true \}\)/);
  assert.match(logic, /Teach Riverline how you intend to play\. A Riverline profile is required\./);
  assert.match(html, /Signing in does not enable sync or cloud backup\./);
});

test('Continue is derived only from authoritative resumable state and never fabricates recency', () => {
  const withHand = createGuestHomeViewModel({ continuation: { hasLiveHand: true } });
  assert.deepEqual(withHand.sections.continue.items, [{
    schemaVersion: 'home-continue-item/v1',
    kind: 'live_hand',
  }]);
  assert.equal(JSON.stringify(createGuestHomeViewModel()).includes('recent hand'), false);
  const homeRenderer = logic.slice(logic.indexOf('function renderHomeContinue'), logic.indexOf('function scheduleHomeRefresh'));
  assert.doesNotMatch(homeRenderer, /streak|recommendation|last analyzed spot/i);
  assert.match(logic, /hasContinuation \? 'Pick up where you left off' : 'Your next action'/);
  assert.match(logic, /hasContinuation \? 'Continue' : 'Start study'/);
});

test('active Personal Strategy remains a truthful resumable continuation', async () => {
  const controller = createHomeViewModelController({
    savedStudyQueries: {
      listRecent: async () => [],
      listForReview: async () => [],
      listMistakes: async () => [],
    },
    personalStrategyQueries: {
      loadSummary: async () => ({
        profileCount: 1,
        selectedProfile: { id: 'profile-1', displayName: 'My strategy' },
        selectedMode: { id: 'mode-1', displayName: 'Cash' },
        context: { tableSize: 6 },
        answeredCount: 12,
        directEvidenceCount: 12,
        contradictionCount: 0,
        totalCount: 169,
        session: { state: 'active', updatedAt: '2026-08-30T12:00:00.000Z' },
        resumable: true,
      }),
    },
  });
  const model = await controller.load();
  assert.deepEqual(model.sections.continue.items.map((item) => item.kind), ['range_calibration']);
  assert.equal(model.sections.continue.items[0].profileName, 'My strategy');
  assert.equal(model.sections.continue.items[0].answeredCount, 12);
});

test('Home routes every visible job through the existing navigation registry', () => {
  const navigation = logic.slice(
    logic.indexOf('function navigateToProductDestination'),
    logic.indexOf('function revealHomeDestination'),
  );
  for (const destination of ['hand', 'analyze', 'training', 'personal-strategy', 'equity', 'saved', 'home-game', 'guide']) {
    assert.match(navigation, new RegExp(`['"]?${destination}['"]?`));
  }
  assert.match(logic, /navigateToProductDestination\(destination\)/);
});

test('1920 composition is top-packed and localized without equal-weight destination treatment', () => {
  assert.match(css, /@media \(min-width: 1500px\)[\s\S]*?"continue quick quick"[\s\S]*?"strategy other other"/);
  assert.match(css, /\.home-quick-links \{ grid-template-columns: repeat\(4/);
  assert.match(css, /\.home-section--continue,[\s\S]*?\.home-section--quick \{ min-height: 238px/);
  assert.match(css, /\.home-other-link[\s\S]*?min-height: 54px/);
  for (const key of ['Start study', 'Start a Hand', 'Choose a workspace', 'More destinations', 'Play or reconstruct a legal hand.']) {
    const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    assert.equal((translations.match(new RegExp(`'${escaped}'`, 'g')) ?? []).length, 2, key);
  }
});
