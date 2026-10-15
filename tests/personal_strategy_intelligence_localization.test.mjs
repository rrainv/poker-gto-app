import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { CALIBRATION_SETUP_TUTORIAL_DEFINITION, CALIBRATION_ANSWERS_TUTORIAL_DEFINITION } from '../app/src/tutorial/current-app-tutorials.mjs';
import { indexDocument, text } from './helpers/app-under-test.mjs';
import { RFI_MAPPING_FAMILIES, RFI_MAPPING_REASON_KEYS, RFI_MAPPING_FAMILY_REASON_KEYS } from '../app/src/personal-strategy/structural-range-mapping.mjs';

const [workspace, localeSource, tutorialSource, productSource, calibrationWorkspace] = await Promise.all([
  readFile(new URL('../app/src/application/personal-strategy-understanding-workspace.mjs', import.meta.url), 'utf8'),
  readFile(new URL('../app/src/locales/range-calibration-translations.js', import.meta.url), 'utf8'),
  readFile(new URL('../app/src/locales/tutorial-translations.js', import.meta.url), 'utf8'),
  readFile(new URL('../app/src/locales/product-translations.js', import.meta.url), 'utf8'),
  readFile(new URL('../app/src/application/range-calibration-workspace.mjs', import.meta.url), 'utf8'),
]);
const context = { window: {} };
vm.runInNewContext(localeSource, context);
vm.runInNewContext(tutorialSource, context);
vm.runInNewContext(productSource, context);
const catalog = Object.fromEntries(['en', 'ru', 'he'].map(language => [language, {
  ...context.window.riverlineProductTranslations[language], ...context.window.riverlineRangeCalibrationTranslations[language],
}]));
// TEST-HYGIENE-001: index.html is queried as parsed markup (template content
// and attributes) instead of being sliced and matched as text.
const markup = indexDocument();
const template = markup.getElementById('rangeCalibrationTemplate').content;
const i18nKeys = (root) => root.querySelectorAll('[data-i18n], [data-i18n-placeholder], [data-i18n-aria-label]')
  .flatMap((node) => ['data-i18n', 'data-i18n-placeholder', 'data-i18n-aria-label']
    .map((name) => node.getAttribute(name)).filter((value) => value !== null));
const anchors = new Set([markup, ...markup.querySelectorAll('template').map((node) => node.content)]
  .flatMap((root) => root.querySelectorAll('[data-tutorial-anchor]').map((node) => node.dataset.tutorialAnchor)));
const keys = new Set([
  ...i18nKeys(template),
  ...[...workspace.matchAll(/\b(?:t|button)\((['"])(.*?)\1/g)].map((match) => match[2]),
  ...[...calibrationWorkspace.matchAll(/\btranslated\((['"])(.*?)\1/g)]
    .map((match) => match[2]).filter((key) => !key.startsWith('analysis.')),
  'Confirmed tendency · boundaries unresolved', 'Confirmed qualitative tendency', 'Needs revalidation',
  'Superseded', 'Add an exception to', 'Will supersede after confirmation',
  'First in / Unopened pot', 'Facing limp', 'Facing open', 'Facing 3-bet', 'Facing 4-bet', 'BB option',
  'This follows the topic you chose.', 'This may clarify the boundary in your provisional statement.',
  'Your active answers disagree here. Inspect them before adding another answer.',
  'This may clarify a boundary between your preferred actions.',
  'This may clarify a hand family you have not specified yet.',
  'Choose an exact example or refine an existing answer.',
  ...RFI_MAPPING_FAMILIES.map((family) => family.labelKey),
  ...Object.values(RFI_MAPPING_REASON_KEYS),
  ...Object.values(RFI_MAPPING_FAMILY_REASON_KEYS),
  'Initial map', 'Partly mapped', 'Not explored', 'Sampled, not a complete range',
]);
const placeholders = (text) => [...text.matchAll(/\{([^}]+)\}/g)].map((match) => match[1]).sort();

test('Personal Strategy template and Understanding controls have EN/RU/HE copy with matching placeholders', () => {
  for (const language of ['en', 'ru', 'he']) for (const key of keys) {
    assert.equal(typeof catalog[language][key], 'string', `${language}: ${key}`);
    assert.ok(catalog[language][key].trim(), `${language}: ${key}`);
    assert.doesNotMatch(catalog[language][key], /\?{2,}|\uFFFD/, `${language}: damaged translation: ${key}`);
    assert.deepEqual(placeholders(catalog[language][key]), placeholders(key), `${language}: ${key}`);
  }
  assert.match(catalog.ru['Confirm intended meaning'], /Подтвердить/);
  assert.match(catalog.he['Confirm intended meaning'], /אישור/);
});

test('range mapping copy has no fixed onboarding quota or corrupted reason punctuation', () => {
  assert.doesNotMatch(text(template), /about five questions|5 questions|About 5|Up to 75 questions/i);
  const reasons = [...Object.values(RFI_MAPPING_REASON_KEYS), ...Object.values(RFI_MAPPING_FAMILY_REASON_KEYS)];
  assert.doesNotMatch(reasons.join(' '), /Let\?s|questionKind|boundaryLikelihood/);
  for (const key of reasons) {
    assert.notEqual(catalog.ru[key], key);
    assert.notEqual(catalog.he[key], key);
  }
});

test('Personal Strategy navigation and Approach selection use current product copy in all languages', () => {
  const subtitle = markup.querySelector('button[data-navigation-id="personal-strategy"]').dataset.modeSubtitle;
  assert.match(subtitle, /understands.*intended play.*Matrix Edit/);
  for (const language of ['en', 'ru', 'he']) {
    assert.equal(typeof context.window.riverlineProductTranslations[language][subtitle], 'string');
  }
  const approaches = [markup, template].map((root) => root.getElementById('calibrationModeOptions')).find(Boolean);
  assert.equal(approaches.localName, 'div');
  assert.equal(approaches.getAttribute('aria-label'), 'Approaches');
  assert.equal(approaches.dataset.i18nAriaLabel, 'Approaches');
});

test('Personal Strategy v2 tutorials reference live anchors and translate the confirmation and evidence boundaries', () => {
  const tutorials = context.window.riverlineTutorialTranslations;
  for (const definition of [CALIBRATION_SETUP_TUTORIAL_DEFINITION, CALIBRATION_ANSWERS_TUTORIAL_DEFINITION]) {
    assert.equal(definition.version, 2);
    const referenced = [definition.titleKey, definition.descriptionKey,
      ...definition.steps.flatMap((step) => [step.titleKey, step.bodyKey])];
    for (const language of ['en', 'ru', 'he']) for (const key of referenced) {
      assert.equal(typeof tutorials[language][key], 'string', `${language}: ${key}`);
    }
    for (const step of definition.steps) assert.ok(anchors.has(step.anchor), step.anchor);
  }
  const content = JSON.stringify(CALIBRATION_SETUP_TUTORIAL_DEFINITION);
  const start = CALIBRATION_SETUP_TUTORIAL_DEFINITION.steps.find((step) => step.id === 'start');
  assert.equal(start.anchor, 'calibration-question');
  assert.equal(start.precondition, 'calibration-question-ready');
  assert.ok(!CALIBRATION_SETUP_TUTORIAL_DEFINITION.steps.some((step) => ['calibration-profile', 'personal-range-mapping'].includes(step.anchor)));
  assert.match(content, /before saving|does not change saved intent/);
  assert.match(content, /Coverage counts evidence, not strategy completion/);
  assert.match(content, /There is no fixed question quota/);
  assert.match(content, /Bring a decision from Analyze, Training or Review/);
  assert.match(content, /do not fill ranges or copy observed actions/);
  assert.doesNotMatch(content, /five questions|5 questions|personal-teach-five/i);
  assert.doesNotMatch(content, /exactly three|range-teacher-tab/);
});
