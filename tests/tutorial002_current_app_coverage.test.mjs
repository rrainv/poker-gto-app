import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

import { createTutorialController } from '../app/src/tutorial/controller.mjs';
import { HOME_TUTORIAL_DEFINITION } from '../app/src/tutorial/home-tutorial.mjs';
import { SAVED_TUTORIAL_DEFINITION } from '../app/src/tutorial/saved-tutorial.mjs';
import { CURRENT_APP_TUTORIAL_DEFINITIONS } from '../app/src/tutorial/current-app-tutorials.mjs';

import { appStyleSheet, bootApp, indexDocument } from './helpers/app-under-test.mjs';

// TEST-HYGIENE-001: index.html / styles.css / logic.js assertions are
// behavioural (parsed markup, the cascade, the running shell's tutorial
// offers). The tutorial bootstrap and translation sources are outside this
// ticket.
const [bootstrap, translationSource] = await Promise.all([
  readFile(new URL('../app/src/application/tutorial-bootstrap.mjs', import.meta.url), 'utf8'),
  readFile(new URL('../app/src/locales/tutorial-translations.js', import.meta.url), 'utf8'),
]);
const markup = indexDocument();
const css = appStyleSheet();
const app = await bootApp();
const probe = (html) => {
  const host = markup.createElement('div');
  host.innerHTML = html;
  markup.body.appendChild(host);
  return host.firstElementChild;
};

const definitions = [HOME_TUTORIAL_DEFINITION, SAVED_TUTORIAL_DEFINITION, ...CURRENT_APP_TUTORIAL_DEFINITIONS];
const byId = new Map(definitions.map((definition) => [definition.id, definition]));

function translationCatalog() {
  const context = { window: {} };
  vm.runInNewContext(translationSource, context);
  return context.window.riverlineTutorialTranslations;
}

test('current tutorial inventory has stable unique IDs and bounded tours', () => {
  assert.equal(definitions.length, 14);
  assert.equal(byId.size, definitions.length);
  assert.deepEqual([...byId.keys()], [
    'home.first-use',
    'saved.library',
    'playbook.scenario-basics',
    'playbook.hand-mode',
    'playbook.replay',
    'playbook.analysis-views',
    'equity.basics',
    'equity.advanced',
    'training.first-spot',
    'training.feedback',
    'calibration.setup',
    'calibration.answers',
    'home-game.organizer',
    'settings.preferences',
  ]);
  for (const definition of definitions) {
    assert.equal(definition.schemaVersion, 'tutorial-definition/v1');
    assert.ok(definition.steps.length >= 3 && definition.steps.length <= 7, definition.id);
    assert.equal(new Set(definition.steps.map((step) => step.id)).size, definition.steps.length, definition.id);
  }
  assert.equal(definitions.some((definition) => definition.workspace === 'info'), false, 'Guide is persistent reference, not a redundant tour');
  assert.equal(SAVED_TUTORIAL_DEFINITION.workspace, 'saved');
  assert.equal(SAVED_TUTORIAL_DEFINITION.version, 1);
  assert.doesNotMatch(JSON.stringify(SAVED_TUTORIAL_DEFINITION), /A quick tour of Home|My Riverline shows/);
});

test('all definition copy is complete in EN, RU, and HE with no runtime fallback', () => {
  const catalog = translationCatalog();
  const referenced = new Set(definitions.flatMap((definition) => [
    definition.titleKey,
    definition.descriptionKey,
    ...definition.steps.flatMap((step) => [step.titleKey, step.bodyKey, step.interactionLabelKey].filter(Boolean)),
  ]));
  for (const language of ['en', 'ru', 'he']) {
    for (const key of referenced) {
      assert.equal(typeof catalog[language][key], 'string', `${language}: ${key}`);
      assert.ok(catalog[language][key].trim(), `${language}: ${key}`);
    }
  }
  assert.match([...referenced].map((key) => catalog.ru[key]).join(' '), /[А-Яа-я]{2,}/u);
  assert.match([...referenced].map((key) => catalog.he[key]).join(' '), /[א-ת]{2,}/u);
});

test('every tutorial target is a semantic DOM anchor and conditional states are named', () => {
  const anchorNodes = [markup, ...markup.querySelectorAll('template').map((template) => template.content)]
    .flatMap((root) => root.querySelectorAll('[data-tutorial-anchor]'));
  const anchors = new Set(anchorNodes.map((node) => node.dataset.tutorialAnchor));
  for (const definition of definitions) {
    for (const step of definition.steps) assert.ok(anchors.has(step.anchor), `${definition.id}: ${step.anchor}`);
  }
  for (const precondition of [
    'saved-spot-open', 'saved-hand-open', 'hand-save-ready', 'training-answered',
    'calibration-empty', 'calibration-configured', 'calibration-question-ready',
  ]) {
    assert.match(bootstrap, new RegExp(`['"]${precondition}['"]`));
  }
  for (const anchor of anchors) assert.doesNotMatch(anchor, /^(?:left|right|top|bottom|column|row)-/, anchor);
});

test('truthfulness copy preserves Scenario, Replay, strategy, Training, Equity, Matrix, and calibration boundaries', () => {
  const copy = Object.fromEntries(definitions.map((definition) => [definition.id, JSON.stringify(definition)]));
  assert.match(copy['playbook.scenario-basics'], /lossy study snapshot/);
  assert.match(copy['playbook.scenario-basics'], /not solved GTO/);
  assert.match(copy['playbook.scenario-basics'], /does not invent canonical history or Replay/);
  assert.match(copy['playbook.hand-mode'], /canonical PokerState/);
  assert.match(copy['playbook.replay'], /read-only/);
  assert.match(copy['playbook.analysis-views'], /not weighted range-versus-range analysis/);
  assert.match(copy['playbook.analysis-views'], /not claimed as independently solver-resolved/);
  assert.match(copy['equity.basics'], /not by itself a complete strategy recommendation/);
  assert.match(copy['training.feedback'], /Heuristic comparisons describe agreement, not correctness/);
  assert.match(copy['training.feedback'], /Only an accepted assessment can judge/);
  assert.match(copy['calibration.answers'], /never means the action is played at a pure 100% frequency/);
  assert.match(copy['calibration.setup'], /Questions adapt to your answers/);
  assert.match(copy['calibration.setup'], /One example does not establish a region/);
  assert.doesNotMatch(copy['calibration.setup'], /five questions|5 questions|personal-teach-five/i);
  assert.match(copy['calibration.setup'], /Decision examples stay qualitative; they do not fill ranges or copy observed actions/);
  assert.match(copy['calibration.setup'], /Add independent Approaches whenever useful/);
  assert.doesNotMatch(copy['calibration.setup'], /exactly three|range-teacher-tab/);
  assert.match(copy['calibration.answers'], /question value, not poker confidence/);
  assert.match(copy['home-game.organizer'], /do not change PokerState or Riverline strategy/);
  assert.match(copy['home-game.organizer'], /Money and chips stay separate/);
  assert.doesNotMatch(Object.values(copy).join('\n'), /EV loss is|solver accuracy is|exploitability score|confidence: \d+%/i);
});

test('first-use policy offers only contextual basics while advanced tours remain discoverable', async () => {
  const prompted = definitions.filter((definition) => definition.firstUsePolicy === 'prompt').map((definition) => definition.id);
  assert.deepEqual(prompted, [
    'home.first-use', 'playbook.scenario-basics', 'playbook.hand-mode',
    'equity.basics', 'training.first-spot', 'calibration.setup', 'home-game.organizer', 'settings.preferences',
  ]);
  assert.match(bootstrap, /availableDefinitions\(workspace\)\.find/);
  assert.match(bootstrap, /candidate\.firstUsePolicy === 'prompt'/);
  assert.match(bootstrap, /persistence\.shouldOffer\(candidate\)/);
  assert.match(bootstrap, /controller\.getState\(\)\.status === 'active'/);
  // The shell offers a workspace's tutorial with its active view on
  // navigation, and offers the Playbook ('gto') tutorial on mode switches.
  const tutorials = app.window.RiverlineTutorials;
  const offers = [];
  Object.defineProperty(app.window, 'RiverlineTutorials', {
    configurable: true, enumerable: false,
    value: { ...tutorials, offerForWorkspace: (workspace, view) => { offers.push([workspace, view?.id]); } },
  });
  try {
    await app.navigate('equity');
    assert.deepEqual(offers.at(-1), ['equity', 'equityMode']);
    await app.navigate('analyze');
    offers.length = 0;
    await app.call('requestPlaybookMode', 'hand');
    await app.settle(200);
    assert.ok(offers.some(([workspace, view]) => workspace === 'gto' && view === 'gtoMode'), JSON.stringify(offers));
  } finally {
    Object.defineProperty(app.window, 'RiverlineTutorials', { configurable: true, enumerable: false, value: tutorials });
    await app.navigate('home');
  }
});

test('workspace discovery supports one direct restart or a compact accessible chooser', () => {
  assert.match(bootstrap, /getDefinitionsForWorkspace/);
  assert.match(bootstrap, /definitions\.length === 1/);
  // SHELL-001: the header Help panel reuses the chooser surface.
  assert.match(bootstrap, /className = help \? 'tutorial-chooser workspace-help-panel' : 'tutorial-chooser'/);
  assert.match(bootstrap, /setAttribute\('role', 'dialog'\)/);
  assert.match(bootstrap, /event\.key === 'Escape'/);
  assert.match(bootstrap, /\(list\.querySelector\('button'\) \?\? close\)\.focus\?\.\(\)/);
  assert.match(bootstrap, /tutorialInvoker\?\.focus/);
  assert.ok(markup.getElementById('settingsTutorialButton'));
  assert.match(css.cascaded(probe('<div class="tutorial-chooser"></div>'), 'max-height'), /^calc\(100dvh/);
});

test('controller exposes all definitions for a workspace without changing start semantics', () => {
  const controller = createTutorialController({
    definitions,
    persistence: { getRecord: () => null, begin() {}, progress() {}, cancel() {}, skip() {}, complete() {} },
    anchorRegistry: { resolve: (anchor) => ({ status: 'ready', anchor, element: { anchor } }) },
    surface: { show() {}, hide() {} },
    getWorkspace: () => 'gto',
  });
  assert.equal(controller.getDefinitionsForWorkspace('gto').length, 4);
  assert.equal(controller.getDefinitionsForWorkspace('equity').length, 2);
  assert.equal(controller.getDefinitionsForWorkspace('info').length, 0);
  assert.equal(controller.start('playbook.scenario-basics').status, 'active');
});

test('inactive tutorial integration stays presentation-only and dormant', () => {
  assert.doesNotMatch(bootstrap, /MutationObserver|setInterval|resolveStrategy|calculateEquity|generateTrainingExercise|indexedDB/);
  assert.doesNotMatch(bootstrap, /from ['"][^'"]*(?:strategy|equity|training|replay|saved-study|poker-domain)/i);
  assert.match(bootstrap, /chooserMounted: Boolean\(chooser\)/);
  // Reduced motion: the spotlight and coach do not animate (the spotlight
  // never interpolates its geometry at all).
  for (const className of ['tutorial-spotlight', 'tutorial-coach']) {
    assert.equal(css.cascaded(probe(`<div class="${className}"></div>`), 'transition', { reducedMotion: true }), 'none', className);
  }
  assert.equal(css.cascaded(probe('<div class="tutorial-spotlight"></div>'), 'transition'), 'none');
  // Over an open Settings dialog the tutorial layer rises above the backdrop.
  const layer = probe('<div class="tutorial-layer"></div>');
  const settings = markup.getElementById('settingsModal');
  const closed = css.cascaded(layer, 'z-index');
  settings.classList.add('show');
  assert.equal(css.cascaded(layer, 'z-index'), 'calc(var(--z-modal-backdrop) + 1)');
  settings.classList.remove('show');
  assert.notEqual(closed, 'calc(var(--z-modal-backdrop) + 1)');
});
