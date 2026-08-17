import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import {
  TUTORIAL_DEFINITION_SCHEMA_VERSION,
  TUTORIAL_STEP_SCHEMA_VERSION,
  createTutorialDefinition,
} from '../app/src/tutorial/domain.mjs';
import { HOME_TUTORIAL_DEFINITION } from '../app/src/tutorial/home-tutorial.mjs';

const translationSource = await readFile(new URL('../app/src/locales/tutorial-translations.js', import.meta.url), 'utf8');

function validInput(overrides = {}) {
  return {
    id: 'test.tour',
    version: 1,
    workspace: 'home',
    titleKey: 'Tour title',
    descriptionKey: 'Tour description',
    firstUsePolicy: 'prompt',
    restartPolicy: 'always',
    steps: [
      { id: 'first', anchor: 'home-first', titleKey: 'First title', bodyKey: 'First body' },
      { id: 'second', anchor: 'home-second', titleKey: 'Second title', bodyKey: 'Second body' },
    ],
    ...overrides,
  };
}

test('TutorialDefinition v1 validates, normalizes, orders, and freezes steps', () => {
  const definition = createTutorialDefinition(validInput());
  assert.equal(definition.schemaVersion, TUTORIAL_DEFINITION_SCHEMA_VERSION);
  assert.equal(definition.steps[0].schemaVersion, TUTORIAL_STEP_SCHEMA_VERSION);
  assert.deepEqual(definition.steps.map((step) => step.id), ['first', 'second']);
  assert.equal(definition.steps[0].placement, 'auto');
  assert.equal(definition.steps[0].emphasis, 'spotlight');
  assert.equal(Object.isFrozen(definition), true);
  assert.equal(Object.isFrozen(definition.steps), true);
});

test('definition validation rejects duplicate IDs, invalid versions, fragile anchors, and incomplete interaction steps', () => {
  assert.throws(() => createTutorialDefinition(validInput({ version: 0 })), /positive safe integer/);
  assert.throws(() => createTutorialDefinition(validInput({
    steps: [
      { id: 'same', anchor: 'home-first', titleKey: 'A', bodyKey: 'B' },
      { id: 'same', anchor: 'home-second', titleKey: 'C', bodyKey: 'D' },
    ],
  })), /Duplicate tutorial step id/);
  assert.throws(() => createTutorialDefinition(validInput({
    steps: [{ id: 'first', anchor: '#home > .panel:nth-child(2)', titleKey: 'A', bodyKey: 'B' }],
  })), /invalid format/);
  assert.throws(() => createTutorialDefinition(validInput({
    steps: [{ id: 'first', anchor: 'home-first', titleKey: 'A', bodyKey: 'B', interactionRequired: true }],
  })), /needs a completionTrigger/);
});

test('localized key validation covers definition and step references', () => {
  const keys = new Set(['Tour title', 'Tour description', 'First title', 'First body', 'Second title', 'Second body']);
  assert.doesNotThrow(() => createTutorialDefinition(validInput(), { hasTranslationKey: (key) => keys.has(key) }));
  assert.throws(() => createTutorialDefinition(validInput(), { hasTranslationKey: (key) => key !== 'Second body' }), /not localized/);
});

test('the production Home tour advances for the account-aware study dashboard', () => {
  assert.equal(HOME_TUTORIAL_DEFINITION.id, 'home.first-use');
  assert.equal(HOME_TUTORIAL_DEFINITION.version, 2);
  assert.equal(HOME_TUTORIAL_DEFINITION.steps.length, 5);
  assert.deepEqual(HOME_TUTORIAL_DEFINITION.steps.map((step) => step.anchor), [
    'home-overview', 'home-recent', 'home-review', 'home-personal-strategy', 'home-quick-start',
  ]);
  const keys = [
    HOME_TUTORIAL_DEFINITION.titleKey,
    HOME_TUTORIAL_DEFINITION.descriptionKey,
    ...HOME_TUTORIAL_DEFINITION.steps.flatMap((step) => [step.titleKey, step.bodyKey]),
  ];
  for (const key of keys) assert.ok(translationSource.includes(key), `missing tutorial translation key: ${key}`);
  assert.doesNotMatch(JSON.stringify(HOME_TUTORIAL_DEFINITION), /click here|GTO|optimal|solver/i);
});
