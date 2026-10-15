import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

import {
  createPlaybookModeController,
  createPlaybookScenarioInput,
} from '../app/src/application/playbook-state-source.mjs';

import { appStyleSheet, bootApp, indexDocument, text } from './helpers/app-under-test.mjs';

// TEST-HYGIENE-001: index.html / styles.css / logic.js assertions are
// behavioural: navigation, destination presentation and Playbook mode
// transitions run in the booted app (the page's own resolve* functions are
// called instead of vm-sliced logic.js); markup is parsed and styling
// resolved through the cascade. Home model, bootstrap and translation sources
// are outside this ticket.
const homeModel = fs.readFileSync(new URL('../app/src/application/home-view-model.mjs', import.meta.url), 'utf8');
const personalStrategyBootstrap = fs.readFileSync(new URL('../app/src/application/range-calibration-bootstrap.mjs', import.meta.url), 'utf8');
const translations = fs.readFileSync(new URL('../app/src/locales/home-translations.js', import.meta.url), 'utf8');
const markup = indexDocument();
const css = appStyleSheet();
const app = await bootApp();
const navigation = markup.querySelector('nav.mode-navigation');
const resolveHomeDestination = (destination, options) => app.call('resolveHomeDestinationPresentation', destination, options);
const resolvePlaybookDestination = (destination, mode) => app.call('resolvePlaybookDestinationPresentation', destination, mode);
const allTemplates = () => [markup, ...markup.querySelectorAll('template').map((template) => template.content)];

test('Core Flow navigation presents six primary study destinations and three grouped support destinations', () => {
  const destinations = navigation.querySelectorAll('[data-navigation-id]').map((node) => node.dataset.navigationId);
  assert.deepEqual(destinations, [
    'hand', 'analyze', 'training', 'personal-strategy', 'equity', 'saved',
    'home', 'home-game', 'guide',
  ]);
  assert.match(text(navigation.querySelector('.mode-nav-group--core')), /Core study/);
  assert.match(text(navigation.querySelector('.mode-nav-group--support')), /Riverline/);
  assert.ok(navigation.querySelector('.mode-nav-item.mode-nav-item--hand'));
  const support = navigation.querySelector('.mode-nav-group--support .mode-nav-item:not([aria-current="page"])');
  // Superseded: support items were --text-muted; the shell now gives every
  // inactive item --text-secondary (groups are distinguished by headings).
  assert.equal(css.cascaded(support, 'color'), 'var(--text-secondary)');
});

test('Hand, Analyze, and Saved remain destinations over existing mounted workspace authorities', async () => {
  for (const [destination, mode] of [['hand', 'gto'], ['analyze', 'gto'], ['saved', 'home']]) {
    assert.equal(navigation.querySelector(`[data-navigation-id="${destination}"]`).dataset.mode, mode, destination);
  }
  for (const id of ['gtoMode', 'homeMode', 'trainingMode', 'calibrationMode']) assert.equal(markup.querySelectorAll(`#${id}`).length, 1, id);
  // The registry routes each destination to its mounted mode view.
  for (const [destination, view] of [['hand', 'gtoMode'], ['analyze', 'gtoMode'], ['saved', 'homeMode']]) {
    app.call('navigateToProductDestination', destination);
    await app.settle(100);
    assert.equal(app.$('.riverline-shell').dataset.activeDestination, destination);
    assert.ok(app.byId(view).classList.contains('active'), destination);
  }
});

test('destination switching changes presentation without recreating or resetting mounted study state', async () => {
  // A live hand and an active Training session survive a tour of every
  // destination; nothing is reset, disposed or cleared.
  await app.startHand(['As', 'Kd']);
  const handId = app.call('callPlaybookStateBridge', 'getState').handId;
  await app.training.start('focused');
  const exercise = app.window.app.training.currentExercise;
  const storageKeys = app.window.localStorage.length;
  const spy = app.spy(['resetCanonicalPlaybookHand', 'clearTrainingSessionState', 'renderFullHandTrainingSnapshot']);
  try {
    for (const destination of ['hand', 'analyze', 'personal-strategy', 'equity', 'saved', 'home', 'home-game', 'guide', 'training']) await app.navigate(destination);
    assert.equal(spy.count('resetCanonicalPlaybookHand') + spy.count('clearTrainingSessionState'), 0);
  } finally {
    spy.restore();
  }
  assert.equal(app.call('callPlaybookStateBridge', 'getState').handId, handId);
  assert.equal(app.window.app.training.currentExercise, exercise);
  assert.ok(app.window.localStorage.length >= storageKeys);
  assert.match(personalStrategyBootstrap, /navigationButton = document\.querySelector\('\.mode-nav-item\[data-mode="calibration"\]'\)/);
  assert.match(personalStrategyBootstrap, /createRangeCalibrationLifecycle/);
});

test('Hand entry uses the canonical Playbook mode transition and Analyze selects the existing Decision view', async () => {
  await app.navigate('analyze');
  // Analyze selects the Decision (context) view.
  assert.equal(app.$('.sub-tab[data-gto-view="context"]').getAttribute('aria-selected'), 'true');
  const spy = app.spy(['requestPlaybookMode', 'capturePlaybookScenarioPresentation', 'restorePlaybookScenarioPresentation', 'callPlaybookStateBridge']);
  try {
    await app.navigate('hand');
    assert.deepEqual(spy.calls.requestPlaybookMode.map(([mode]) => mode), ['hand']);
    assert.ok(spy.count('capturePlaybookScenarioPresentation') >= 1, 'the Scenario presentation is captured');
    assert.ok(spy.calls.callPlaybookStateBridge.some(([method, mode]) => method === 'setMode' && mode === 'hand'));
    spy.reset();
    await app.navigate('analyze');
    assert.deepEqual(spy.calls.requestPlaybookMode.map(([mode]) => mode), ['scenario']);
    assert.ok(spy.count('restorePlaybookScenarioPresentation') >= 1, 'and restored on return');
  } finally {
    spy.restore();
  }
});

test('Home and Saved resolve to distinct visible states over the same Home authority', async () => {
  const home = resolveHomeDestination('home', { sessionMode: 'account', hasContinuation: true });
  const saved = resolveHomeDestination('saved', { sessionMode: 'account', hasContinuation: true });
  const homeAgain = resolveHomeDestination('home', { sessionMode: 'account', hasContinuation: true });
  assert.equal(home.destination, 'home');
  assert.equal(saved.destination, 'saved');
  // SHELL-001: Home's Destinations ('quick') panel was removed; the sidebar holds those links.
  assert.deepEqual(Array.from(home.visibleSections), ['overview', 'continue', 'review', 'recent']);
  // SAVED-LIBRARY-001: Saved owns an independent library section instead of reusing Home Recent.
  // Retargeted by SAVED-COMPOSITION-002: the duplicated "Saved Hands & Spots" overview
  // panel was removed; its sentence is the library's empty state.
  assert.deepEqual(Array.from(saved.visibleSections), ['library']);
  assert.deepEqual(Array.from(homeAgain.visibleSections), Array.from(home.visibleSections));
  // Navigating applies the destination's presentation over the Home view.
  const spy = app.spy(['applyHomeDestinationPresentation']);
  try {
    await app.navigate('saved');
    await app.navigate('home');
    const applied = spy.calls.applyHomeDestinationPresentation.map(([destination]) => destination).filter(Boolean);
    assert.deepEqual(applied.filter((destination, index) => destination !== applied[index - 1]), ['saved', 'home']);
  } finally {
    spy.restore();
  }
  assert.equal(markup.getElementById('homeSavedOverview'), null);
  const content = markup.getElementById('homeWorkspaceContent');
  content.dataset.productDestination = 'saved';
  assert.equal(css.cascaded(content, 'grid-template-columns'), 'minmax(0, 1fr)');
  delete content.dataset.productDestination;
});

test('Saved guest and empty presentation remains intentionally Saved instead of falling back to Home', () => {
  const savedGuest = resolveHomeDestination('saved', { sessionMode: 'guest' });
  assert.deepEqual(Array.from(savedGuest.visibleSections), ['library']);
  assert.equal(savedGuest.guestCopy.eyebrow, 'Saved study');
  assert.equal(savedGuest.guestCopy.title, 'Saved Hands & Spots');
  assert.match(savedGuest.guestCopy.primary, /stay on this device in Guest Mode/);
  assert.match(savedGuest.guestCopy.secondary, /does not enable sync or cloud backup/);
  // An empty Recent section offers Analyze a Hand.
  app.call('renderHomeRecent', { status: 'ready', items: [] });
  const empty = app.$('#homeRecentContent .home-empty-state');
  assert.equal(text(empty.querySelector('p')), 'No saved study yet.');
  assert.equal(text(empty.querySelector('button')), 'Analyze a Hand');
  assert.equal(empty.querySelector('button').dataset.homeDestination, 'analyze');
});

test('Hand and Analyze resolve to observably different presentation modes', async () => {
  const handFromScenario = resolvePlaybookDestination('hand', 'scenario');
  const hand = resolvePlaybookDestination('hand', 'hand');
  const analyzeHand = resolvePlaybookDestination('analyze', 'hand');
  const analyze = resolvePlaybookDestination('analyze', 'scenario');
  assert.equal(handFromScenario.requestedMode, 'hand');
  assert.equal(hand.requestedMode, null);
  assert.equal(hand.primarySurface, 'hand-controls-and-table');
  assert.equal(analyzeHand.requestedMode, 'scenario');
  assert.equal(analyze.requestedMode, null);
  assert.equal(analyzeHand.primarySurface, 'decision-analysis');
  // The mounted view records the mode and hides Scenario-only controls in Hand.
  await app.navigate('hand');
  assert.equal(app.byId('gtoMode').dataset.playbookMode, 'hand');
  assert.ok(app.$$('[data-playbook-scenario]').every((node) => node.hidden));
  await app.navigate('analyze');
  assert.equal(app.byId('gtoMode').dataset.playbookMode, 'scenario');
  assert.ok(app.$$('[data-playbook-scenario]').every((node) => !node.hidden));
  const gto = markup.getElementById('gtoMode');
  gto.dataset.productDestination = 'hand';
  const contextView = markup.getElementById('contextView');
  contextView.style.display = 'block';
  assert.equal(css.cascaded(contextView, 'display'), 'none');
  contextView.style.removeProperty('display');
});

test('Hand to Analyze to Hand enters the matching internal mode and preserves the exact canonical Hand', () => {
  const canonicalState = Object.freeze({ handId: 'core-flow-preserved-hand' });
  const canonicalController = Object.freeze({
    getState: () => canonicalState,
    getHeroPlayerId: () => 'Hero',
    getProjectionOptions: () => Object.freeze({}),
  });
  const controller = createPlaybookModeController({ canonicalController });
  const scenario = createPlaybookScenarioInput({
    tableSize: 2,
    heroPosition: 'BTN',
    heroCards: ['As', 'Ad'],
    board: [],
    deadCards: [],
    street: 'preflop',
    stackBb: 100,
    stackMode: 'hero',
    potBb: 1.5,
    lastAction: 'unopened',
    lastActionLabel: 'Unopened',
    facingSizeBb: 0,
    rakeMode: 'off',
    forcedContributionPerPlayerBb: 0,
    totalForcedContributionBb: 0,
    anteBb: 0,
    straddleBb: 0,
  });
  assert.equal(controller.setMode('hand', scenario).mode, 'hand');
  const controllerIdentity = controller;
  for (const destination of ['analyze', 'hand', 'analyze', 'hand']) {
    const transition = resolvePlaybookDestination(destination, controller.getMode());
    if (transition.requestedMode) controller.setMode(transition.requestedMode, scenario);
    assert.equal(controller.getMode(), destination === 'hand' ? 'hand' : 'scenario');
    assert.equal(controller, controllerIdentity);
    assert.strictEqual(canonicalController.getState(), canonicalState);
  }
  assert.equal(controller.getMode(), 'hand');
});

test('active navigation state is applied together with the rendered destination state', async () => {
  const spy = app.spy(['applyHomeDestinationPresentation', 'applyPlaybookDestinationPresentation']);
  try {
    for (const [destination, presenter] of [['saved', 'applyHomeDestinationPresentation'], ['hand', 'applyPlaybookDestinationPresentation'], ['analyze', 'applyPlaybookDestinationPresentation']]) {
      spy.reset();
      await app.navigate(destination);
      assert.equal(app.$('.riverline-shell').dataset.activeDestination, destination);
      assert.ok(spy.calls[presenter].some(([applied]) => applied === destination), `${presenter}(${destination})`);
    }
  } finally {
    spy.restore();
  }
  // Switching the Playbook mode in place moves navigation with it.
  await app.click('#playbookHandMode');
  await app.settle(200);
  assert.equal(app.$('.riverline-shell').dataset.activeDestination, 'hand');
  await app.click('#playbookScenarioMode');
  await app.settle(200);
  assert.equal(app.$('.riverline-shell').dataset.activeDestination, 'analyze');
});

test('Personal Strategy is the umbrella while Calibration, Teacher, Matrix, and Builder remain its tools', () => {
  assert.equal(navigation.querySelector('[data-navigation-id="personal-strategy"]').dataset.modeTitle, 'Personal Strategy');
  assert.ok(navigation.querySelectorAll('*').every((node) => text(node) !== 'Range Calibration'));
  for (const id of ['calibrationStartQuestions', 'calibrationTeacherTab', 'calibrationMatrixTab', 'calibrationBuilderToggle']) {
    assert.ok(allTemplates().some((scope) => scope.querySelector(`#${id}`)), id);
  }
  assert.equal(markup.getElementById('calibrationMode').getAttribute('aria-label'), 'Personal Strategy');
});

test('Home offers real workflow entries and the Core Flow shell has EN, RU, HE, and RTL coverage', async () => {
  // SHELL-001: Home's Destinations links duplicated the sidebar and were removed;
  // the view model's quickStart destinations still gate the Review Mistakes link.
  for (const destination of ['hand', 'analyze', 'training', 'equity']) {
    assert.ok(navigation.querySelector(`.mode-nav-item[data-navigation-id="${destination}"]`), destination);
    assert.match(homeModel, new RegExp(`['"]${destination}['"]`));
  }
  assert.equal(markup.getElementById('homeReviewMistakesLink').dataset.homeDestination, 'review_mistakes');
  // A Personal Strategy summary routes to Personal Strategy.
  await app.navigate('home');
  app.call('renderHomePersonalStrategy', { status: 'unavailable' });
  app.call('renderHomeContinue', { status: 'ready', items: [{ kind: 'range_calibration', profileName: 'P', answeredCount: 1, totalCount: 169 }] });
  assert.ok(app.$('#homeMode [data-home-destination="personal-strategy"]'));
  // 'Hand workflow' / 'Analysis source' remain translated catalog keys (the strip
  // kicker they labelled moved into the SHELL-001 header mode switch).
  for (const key of ['Core study', 'Hand', 'Analyze', 'Saved study', 'Saved Hands & Spots', 'Hand workflow', 'Analysis source', 'Opening Personal Strategy']) {
    const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    assert.match(translations, new RegExp(`'${escaped}'`, 'g'));
  }
  const languages = markup.getElementById('langToggle').querySelectorAll('option').map((option) => option.value);
  assert.ok(languages.includes('ru') && languages.includes('he'));
  // RTL is styled: the shell rail border moves to the inline end.
  const rail = markup.querySelector('.mode-rail');
  markup.documentElement.setAttribute('dir', 'rtl');
  assert.ok(css.matchingRules(rail).some((rule) => rule.selectorText.includes('[dir="rtl"]')));
  markup.documentElement.setAttribute('dir', 'ltr');
});
