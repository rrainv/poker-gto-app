import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { CALIBRATION_SETUP_TUTORIAL_DEFINITION, CALIBRATION_ANSWERS_TUTORIAL_DEFINITION } from '../app/src/tutorial/current-app-tutorials.mjs';
import { RFI_MAPPING_FAMILIES, RFI_MAPPING_REASON_KEYS, RFI_MAPPING_FAMILY_REASON_KEYS } from '../app/src/personal-strategy/structural-range-mapping.mjs';

const [html, workspace, localeSource, tutorialSource, productSource, calibrationWorkspace] = await Promise.all([
  readFile(new URL('../app/index.html', import.meta.url), 'utf8'),
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
const catalog = context.window.riverlineRangeCalibrationTranslations;
const template = html.slice(html.indexOf('<template id="rangeCalibrationTemplate">'))
  .split('</template>')[0];
const keys = new Set([
  ...[...template.matchAll(/data-i18n(?:-placeholder|-aria-label)?="([^"]+)"/g)].map((match) => match[1]),
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
    assert.deepEqual(placeholders(catalog[language][key]), placeholders(key), `${language}: ${key}`);
  }
  assert.match(catalog.ru['Confirm intended meaning'], /Подтвердить/);
  assert.match(catalog.he['Confirm intended meaning'], /אישור/);
});

test('range mapping copy has no fixed onboarding quota or corrupted reason punctuation', () => {
  assert.doesNotMatch(template, /about five questions|5 questions|About 5|Up to 75 questions/i);
  const reasons = [...Object.values(RFI_MAPPING_REASON_KEYS), ...Object.values(RFI_MAPPING_FAMILY_REASON_KEYS)];
  assert.doesNotMatch(reasons.join(' '), /Let\?s|questionKind|boundaryLikelihood/);
  for (const key of reasons) {
    assert.notEqual(catalog.ru[key], key);
    assert.notEqual(catalog.he[key], key);
  }
});

test('Personal Strategy navigation and Approach selection use current product copy in all languages', () => {
  const navigation = html.match(/<button[^>]+data-navigation-id="personal-strategy"[^>]*>/)[0];
  const subtitle = navigation.match(/data-mode-subtitle="([^"]+)"/)[1];
  assert.match(subtitle, /understands.*intended play.*Matrix Edit/);
  for (const language of ['en', 'ru', 'he']) {
    assert.equal(typeof context.window.riverlineProductTranslations[language][subtitle], 'string');
  }
  const approaches = html.match(/<div[^>]+id="calibrationModeOptions"[^>]*>/)[0];
  assert.match(approaches, /aria-label="Approaches"/);
  assert.match(approaches, /data-i18n-aria-label="Approaches"/);
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
    for (const step of definition.steps) assert.ok(html.includes(`data-tutorial-anchor="${step.anchor}"`), step.anchor);
  }
  const content = JSON.stringify(CALIBRATION_SETUP_TUTORIAL_DEFINITION);
  const start = CALIBRATION_SETUP_TUTORIAL_DEFINITION.steps.find((step) => step.id === 'start');
  assert.equal(start.anchor, 'calibration-question');
  assert.equal(start.precondition, 'calibration-question-ready');
  assert.ok(!CALIBRATION_SETUP_TUTORIAL_DEFINITION.steps.some((step) => ['calibration-profile', 'personal-range-mapping'].includes(step.anchor)));
  assert.match(content, /before saving|does not change saved intent/);
  assert.match(content, /A sampled region is not a complete range/);
  assert.match(content, /There is no fixed question quota/);
  assert.match(content, /Concrete answers lead/);
  assert.doesNotMatch(content, /five questions|5 questions|personal-teach-five/i);
  assert.doesNotMatch(content, /exactly three|range-teacher-tab/);
});
