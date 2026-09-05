import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const html = fs.readFileSync(new URL('../app/index.html', import.meta.url), 'utf8');
const css = fs.readFileSync(new URL('../app/styles.css', import.meta.url), 'utf8');
const logic = fs.readFileSync(new URL('../app/src/core/logic.js', import.meta.url), 'utf8');
const i18n = fs.readFileSync(new URL('../app/src/locales/i18n.js', import.meta.url), 'utf8');
const productTranslations = fs.readFileSync(new URL('../app/src/locales/product-translations.js', import.meta.url), 'utf8');
const training = html.slice(html.indexOf('id="trainingMode"'), html.indexOf('id="infoMode"'));

test('Training is a decision-first workspace with compact drill controls', () => {
  assert.match(training, /class="training-workspace"[^>]+data-training-state="idle"/);
  assert.match(training, /class="training-decision-column"/);
  assert.match(training, /class="training-insight-column"/);
  assert.match(training, /class="training-setup-column"/);
  assert.match(training, /id="trainingStreet"/);
  assert.match(training, /id="trainingDecisionTarget"/);
  assert.match(training, /id="trainingAdvanced"/);
  assert.match(training, /id="trainingSeedInput"[^>]+min="0"[^>]+max="4294967295"/);
  assert.doesNotMatch(training, /data-slots="trainingHero"|data-slots="trainingBoard"/);
});

test('Training has explicit lifecycle, feedback, history, provenance, and replay surfaces', () => {
  for (const id of [
    'trainingStateBadge', 'trainingGenerating', 'trainingError', 'trainingFeedback',
    'trainingActionHistory', 'trainingStrategySource', 'trainingFrequencyStack',
    'trainingCurrentSeed', 'trainingCopySeed', 'trainingReplayBtn', 'trainingNextHandBtn',
  ]) assert.match(training, new RegExp(`id="${id}"`), id);
  assert.match(training, /aria-live="polite"/);
  assert.match(training, /role="alert"/);
  assert.match(training, /After-answer comparison[\s\S]*Source frequencies/);
  assert.doesNotMatch(training, /\bOptimal\b/);
  assert.doesNotMatch(training, /\bGTO\b|Deep CFR/i);
});

test('Training controls and feedback remain contract-honest', () => {
  assert.match(logic, /callTrainingServiceBridge\('generate', config/);
  assert.match(logic, /callTrainingServiceBridge\('answer', exercise\.id, userAction\)/);
  assert.match(logic, /callTrainingPresentationBridge\('createViewModel', exercise\)/);
  assert.match(logic, /evaluation\.grade/);
  assert.match(logic, /function trainingGradePresentation\(grade, strategyResult, evaluation = null\)/);
  assert.match(logic, /truthPresentation\(truth\)\.title/);
  assert.match(logic, /truthPresentation\(truth\)\.title/);
  assert.doesNotMatch(logic, /t\(evaluation\.grade\.charAt/);
  assert.match(logic, /truthPresentation\(truth\)/);
  assert.match(logic, /generationMetadata\?\.trainingConfig/);
  assert.doesNotMatch(training, /data-ev-bb|Expected value/);
});

test('Training keyboard handling is mode-scoped and input-safe', () => {
  assert.match(logic, /function handleTrainingKeyboardShortcut/);
  assert.match(logic, /trainingModeIsVisible/);
  assert.match(logic, /ctrlKey|metaKey|altKey/);
  assert.match(logic, /isContentEditable|INPUT|TEXTAREA|SELECT/);
  assert.match(logic, /cardModal/);
  assert.match(logic, /trainingGuessButtons/);
  assert.match(logic, /event\.key === 'Enter'/);
  assert.match(logic, /event\.key\.toLowerCase\(\) === 'r'/);
  assert.match(training, /<kbd>1<\/kbd>/);
});

test('Training layout is responsive, theme-tokenized, RTL-safe, and motion-safe', () => {
  assert.match(css, /DESIGN-008: focused Training workspace/);
  assert.match(css, /\.training-workspace[\s\S]*grid-template-areas/);
  assert.match(css, /@media \(max-width: 1024px\)[\s\S]*training-workspace/);
  assert.match(css, /@media \(max-width: 768px\)[\s\S]*training-workspace/);
  assert.match(css, /@media \(max-width: 480px\)[\s\S]*training-action-grid/);
  assert.match(css, /\[dir="rtl"\][\s\S]*training-frequency-stack/);
  assert.match(css, /prefers-reduced-motion: reduce[\s\S]*training/);
  const workspaceCss = css.slice(
    css.indexOf('DESIGN-008: focused Training workspace'),
    css.indexOf('[data-theme="midnight"]'),
  );
  assert.doesNotMatch(workspaceCss, /#[0-9a-f]{3,8}\b|rgba?\(/i);
});

test('Training session metrics remain in-memory and bounded to this session', () => {
  for (const id of ['trainingTotalHands', 'trainingTruthMetrics']) {
    assert.match(training, new RegExp(`id="${id}"`), id);
  }
  const stats = logic.slice(logic.indexOf('function updateTrainingStats'), logic.indexOf('function formatHand'));
  assert.doesNotMatch(stats, /localStorage|indexedDB|fetch/);
});

test('new static Training copy is registered for English, Russian, and Hebrew', () => {
  assert.match(i18n, /const trainingWorkspaceTranslations/);
  for (const language of ['en', 'ru', 'he']) {
    assert.match(i18n, new RegExp(`${language}: \\{`), language);
  }
  for (const key of ['Training workspace', 'Make the decision', 'Action history']) {
    assert.match(i18n, new RegExp(`"${key}"`), key);
  }
  assert.match(productTranslations, /"Source frequencies"/);
  assert.match(css, /\[dir="rtl"\][\s\S]*training-history-action/);
});
