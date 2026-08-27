import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

import { createTutorialController } from '../app/src/tutorial/controller.mjs';
import { HOME_TUTORIAL_DEFINITION } from '../app/src/tutorial/home-tutorial.mjs';
import { SAVED_TUTORIAL_DEFINITION } from '../app/src/tutorial/saved-tutorial.mjs';
import { CURRENT_APP_TUTORIAL_DEFINITIONS } from '../app/src/tutorial/current-app-tutorials.mjs';

const [html, bootstrap, logic, css, translationSource] = await Promise.all([
  readFile(new URL('../app/index.html', import.meta.url), 'utf8'),
  readFile(new URL('../app/src/application/tutorial-bootstrap.mjs', import.meta.url), 'utf8'),
  readFile(new URL('../app/src/core/logic.js', import.meta.url), 'utf8'),
  readFile(new URL('../app/styles.css', import.meta.url), 'utf8'),
  readFile(new URL('../app/src/locales/tutorial-translations.js', import.meta.url), 'utf8'),
]);

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
  const anchors = new Set([...html.matchAll(/data-tutorial-anchor="([^"]+)"/g)].map((match) => match[1]));
  for (const definition of definitions) {
    for (const step of definition.steps) assert.ok(anchors.has(step.anchor), `${definition.id}: ${step.anchor}`);
  }
  for (const precondition of [
    'saved-spot-open', 'saved-hand-open', 'hand-save-ready', 'training-answered',
    'calibration-empty', 'calibration-configured', 'calibration-question-ready',
  ]) {
    assert.match(bootstrap, new RegExp(`['"]${precondition}['"]`));
  }
  assert.doesNotMatch(html, /data-tutorial-anchor="(?:left|right|top|bottom|column|row)-/);
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
  assert.match(copy['training.feedback'], /not a claim of mathematically proven universal optimality/);
  assert.match(copy['calibration.answers'], /never means the action is played at a pure 100% frequency/);
  assert.match(copy['calibration.setup'], /selects high-value hands from current direct evidence/);
  assert.match(copy['calibration.answers'], /question value, not poker confidence/);
  assert.match(copy['home-game.organizer'], /do not change PokerState or Riverline strategy/);
  assert.match(copy['home-game.organizer'], /Money and chips stay separate/);
  assert.doesNotMatch(Object.values(copy).join('\n'), /EV loss is|solver accuracy is|exploitability score|confidence: \d+%/i);
});

test('first-use policy offers only contextual basics while advanced tours remain discoverable', () => {
  const prompted = definitions.filter((definition) => definition.firstUsePolicy === 'prompt').map((definition) => definition.id);
  assert.deepEqual(prompted, [
    'home.first-use', 'playbook.scenario-basics', 'playbook.hand-mode',
    'equity.basics', 'training.first-spot', 'calibration.setup', 'home-game.organizer', 'settings.preferences',
  ]);
  assert.match(bootstrap, /availableDefinitions\(workspace\)\.find/);
  assert.match(bootstrap, /candidate\.firstUsePolicy === 'prompt'/);
  assert.match(bootstrap, /persistence\.shouldOffer\(candidate\)/);
  assert.match(bootstrap, /controller\.getState\(\)\.status === 'active'/);
  assert.match(logic, /offerForWorkspace\?\.\(mode, activeView\)/);
  assert.match(logic, /offerForWorkspace\?\.\('gto'/);
});

test('workspace discovery supports one direct restart or a compact accessible chooser', () => {
  assert.match(bootstrap, /getDefinitionsForWorkspace/);
  assert.match(bootstrap, /definitions\.length === 1/);
  assert.match(bootstrap, /className = 'tutorial-chooser'/);
  assert.match(bootstrap, /setAttribute\('role', 'dialog'\)/);
  assert.match(bootstrap, /event\.key === 'Escape'/);
  assert.match(bootstrap, /list\.querySelector\('button'\)\?\.focus/);
  assert.match(bootstrap, /tutorialInvoker\?\.focus/);
  assert.match(html, /id="settingsTutorialButton"/);
  assert.match(css, /\.tutorial-chooser[\s\S]*?max-height: calc\(100dvh/);
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
  assert.match(css, /prefers-reduced-motion: reduce[\s\S]*?\.tutorial-spotlight/);
  assert.match(css, /body:has\(#settingsModal\.show\) \.tutorial-layer/);
});
