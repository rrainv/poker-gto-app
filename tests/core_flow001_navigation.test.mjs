import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

import {
  createPlaybookModeController,
  createPlaybookScenarioInput,
} from '../app/src/application/playbook-state-source.mjs';

const html = fs.readFileSync(new URL('../app/index.html', import.meta.url), 'utf8');
const css = fs.readFileSync(new URL('../app/styles.css', import.meta.url), 'utf8');
const logic = fs.readFileSync(new URL('../app/src/core/logic.js', import.meta.url), 'utf8');
const homeModel = fs.readFileSync(new URL('../app/src/application/home-view-model.mjs', import.meta.url), 'utf8');
const personalStrategyBootstrap = fs.readFileSync(new URL('../app/src/application/range-calibration-bootstrap.mjs', import.meta.url), 'utf8');
const translations = fs.readFileSync(new URL('../app/src/locales/home-translations.js', import.meta.url), 'utf8');

function navigationMarkup() {
  const start = html.indexOf('<nav class="mode-navigation"');
  const end = html.indexOf('</nav>', start);
  assert.ok(start >= 0 && end > start);
  return html.slice(start, end + 6);
}

function modeNavigationHandler() {
  const start = logic.indexOf("$$('.mode-nav-item[data-mode]').forEach");
  const end = logic.indexOf('const revealPlaybookDestination', start);
  assert.ok(start >= 0 && end > start);
  return logic.slice(start, end);
}

function logicFunction(name, nextName, context = {}) {
  const start = logic.indexOf(`function ${name}`);
  const end = logic.indexOf(`function ${nextName}`, start);
  assert.ok(start >= 0 && end > start, `${name} must remain independently testable`);
  const sandbox = { ...context };
  vm.runInNewContext(`${logic.slice(start, end)}\nthis.exposed = ${name};`, sandbox);
  return sandbox.exposed;
}

const resolveHomeDestination = logicFunction(
  'resolveHomeDestinationPresentation',
  'setTranslatedElement',
);
const resolvePlaybookDestination = logicFunction(
  'resolvePlaybookDestinationPresentation',
  'applyPlaybookDestinationPresentation',
  { PLAYBOOK_MODES: { HAND: 'hand', SCENARIO: 'scenario' } },
);

test('Core Flow navigation presents six primary study destinations and three grouped support destinations', () => {
  const navigation = navigationMarkup();
  const destinations = [...navigation.matchAll(/data-navigation-id="([^"]+)"/g)].map((match) => match[1]);
  assert.deepEqual(destinations, [
    'hand', 'analyze', 'training', 'personal-strategy', 'equity', 'saved',
    'home', 'home-game', 'guide',
  ]);
  assert.match(navigation, /mode-nav-group--core[\s\S]*?Core study/);
  assert.match(navigation, /mode-nav-group--support[\s\S]*?Riverline/);
  assert.match(navigation, /mode-nav-item mode-nav-item--hand/);
  assert.match(css, /\.mode-nav-group--support \.mode-nav-item[\s\S]*?color: var\(--text-muted\)/);
});

test('Hand, Analyze, and Saved remain destinations over existing mounted workspace authorities', () => {
  const navigation = navigationMarkup();
  assert.match(navigation, /data-mode="gto" data-navigation-id="hand"/);
  assert.match(navigation, /data-mode="gto" data-navigation-id="analyze"/);
  assert.match(navigation, /data-mode="home" data-navigation-id="saved"/);
  assert.equal((html.match(/id="gtoMode"/g) || []).length, 1);
  assert.equal((html.match(/id="homeMode"/g) || []).length, 1);
  assert.equal((html.match(/id="trainingMode"/g) || []).length, 1);
  assert.equal((html.match(/id="calibrationMode"/g) || []).length, 1);
  assert.match(logic, /hand: \['gto', 'hand'\]/);
  assert.match(logic, /analyze: \['gto', 'analyze'\]/);
  assert.match(logic, /saved: \['home', 'saved'\]/);
});

test('destination switching changes presentation without recreating or resetting mounted study state', () => {
  const handler = modeNavigationHandler();
  assert.match(handler, /activateNavigationItem\(button\)/);
  assert.match(handler, /const activeView = \$\(`#\$\{mode\}Mode`\)/);
  assert.match(handler, /renderFullHandTrainingSnapshot\(app\.training\.fullHandSnapshot\)/);
  assert.doesNotMatch(handler, /new\s+[A-Z]|create[A-Z]\w+Controller|dispose\(|reset(?:Hand|Training|Calibration|Strategy)|localStorage\.clear|indexedDB\.deleteDatabase/);
  assert.match(personalStrategyBootstrap, /navigationButton = document\.querySelector\('\.mode-nav-item\[data-mode="calibration"\]'\)/);
  assert.match(personalStrategyBootstrap, /createRangeCalibrationLifecycle/);
});

test('Hand entry uses the canonical Playbook mode transition and Analyze selects the existing Decision view', () => {
  const handler = modeNavigationHandler();
  assert.match(handler, /destinationState\.requestedMode[\s\S]*?requestPlaybookMode\(destinationState\.requestedMode\)/);
  assert.match(handler, /destination === 'analyze'[\s\S]*?data-gto-view="context"[\s\S]*?selectPlaybookAnalysisView\(decisionView\)/);
  const modeRequest = logic.slice(logic.indexOf('async function requestPlaybookMode'), logic.indexOf('function bindPlaybookModeControl'));
  assert.match(modeRequest, /capturePlaybookScenarioPresentation\(\)/);
  assert.match(modeRequest, /callPlaybookStateBridge\('setMode', mode, scenarioInput\)/);
  assert.match(modeRequest, /restorePlaybookScenarioPresentation\(savedPlaybookScenarioPresentation\)/);
});

test('Home and Saved resolve to distinct visible states over the same Home authority', () => {
  const home = resolveHomeDestination('home', { sessionMode: 'account', hasContinuation: true });
  const saved = resolveHomeDestination('saved', { sessionMode: 'account', hasContinuation: true });
  const homeAgain = resolveHomeDestination('home', { sessionMode: 'account', hasContinuation: true });
  assert.equal(home.destination, 'home');
  assert.equal(saved.destination, 'saved');
  assert.deepEqual(Array.from(home.visibleSections), ['overview', 'continue', 'review', 'recent', 'strategy', 'quick']);
  assert.deepEqual(Array.from(saved.visibleSections), ['saved-overview', 'recent', 'review']);
  assert.deepEqual(Array.from(homeAgain.visibleSections), Array.from(home.visibleSections));
  assert.match(html, /id="homeSavedOverview"[^>]*hidden/);
  assert.match(css, /home-dashboard-grid\[data-product-destination="saved"\][\s\S]*?"recent recent"[\s\S]*?"review review"/);
  assert.match(logic, /applyHomeDestinationPresentation\(destination\)/);
  assert.match(logic, /sequence !== homeRefreshSequence/);
});

test('Saved guest and empty presentation remains intentionally Saved instead of falling back to Home', () => {
  const savedGuest = resolveHomeDestination('saved', { sessionMode: 'guest' });
  assert.deepEqual(Array.from(savedGuest.visibleSections), ['guest']);
  assert.equal(savedGuest.guestCopy.eyebrow, 'Saved study');
  assert.equal(savedGuest.guestCopy.title, 'Saved Hands & Spots');
  assert.equal(savedGuest.guestCopy.secondary, 'No saved study is available in Guest Mode.');
  assert.match(logic, /renderHomeRecent\(model\.sections\.recent\)/);
  assert.match(logic, /homeEmptyAction\('No saved study yet\.', 'Analyze a Hand', 'analyze'\)/);
});

test('Hand and Analyze resolve to observably different presentation modes', () => {
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
  assert.match(css, /data-product-destination="hand"[\s\S]*?#contextView[\s\S]*?display: none !important/);
  assert.match(logic, /modeView\.dataset\.playbookMode = mode/);
  assert.match(logic, /\$\$\('\[data-playbook-scenario\]'\)[\s\S]*?element\.hidden = handMode/);
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

test('active navigation state is applied together with the rendered destination state', () => {
  const activation = logic.slice(logic.indexOf('function activateNavigationItem'), logic.indexOf('function resolveHomeDestinationPresentation'));
  assert.match(activation, /shell\.dataset\.activeDestination = button\.dataset\.navigationId/);
  assert.match(activation, /button\.dataset\.mode === 'home'\) applyHomeDestinationPresentation\(button\.dataset\.navigationId\)/);
  assert.match(activation, /button\.dataset\.mode === 'gto'\) applyPlaybookDestinationPresentation\(button\.dataset\.navigationId\)/);
  assert.match(logic, /syncPlaybookNavigationDestination\(previousMode\)/);
});

test('Personal Strategy is the umbrella while Calibration, Teacher, Matrix, and Builder remain its tools', () => {
  const navigation = navigationMarkup();
  assert.match(navigation, /data-navigation-id="personal-strategy"[^>]*data-mode-title="Personal Strategy"/);
  assert.doesNotMatch(navigation, />Range Calibration</);
  for (const id of ['calibrationStartQuestions', 'calibrationTeacherTab', 'calibrationMatrixTab', 'calibrationBuilderToggle']) {
    assert.match(html, new RegExp(`id="${id}"`));
  }
  assert.match(html, /id="calibrationMode"[^>]*aria-label="Personal Strategy"/);
});

test('Home offers real workflow entries and the Core Flow shell has EN, RU, HE, and RTL coverage', () => {
  for (const destination of ['hand', 'analyze', 'training', 'personal-strategy', 'equity']) {
    assert.match(html, new RegExp(`data-home-destination="${destination}"`));
    assert.match(homeModel, new RegExp(`['"]${destination}['"]`));
  }
  for (const key of ['Core study', 'Hand', 'Analyze', 'Saved study', 'Saved Hands & Spots', 'Hand workflow', 'Analysis source', 'Opening Personal Strategy']) {
    const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    assert.match(translations, new RegExp(`'${escaped}'`, 'g'));
  }
  assert.match(html, /<option value="ru"/);
  assert.match(html, /<option value="he"/);
  assert.match(css, /\[dir="rtl"\]/);
});
