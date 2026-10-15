import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import { appStyleSheet, freshIndexDocument, text } from './helpers/app-under-test.mjs';

// TEST-HYGIENE-001: the Personal Strategy template is queried as parsed markup
// (instantiated into a document) and styled through the cascade, instead of
// slicing index.html / matching styles.css. Module sources keep their checks.
const workspace = fs.readFileSync(new URL('../app/src/application/range-calibration-workspace.mjs', import.meta.url), 'utf8');
const service = fs.readFileSync(new URL('../app/src/application/range-calibration-service.mjs', import.meta.url), 'utf8');
const repository = fs.readFileSync(new URL('../app/src/personal-strategy/repository.mjs', import.meta.url), 'utf8');
const translations = fs.readFileSync(new URL('../app/src/locales/range-calibration-translations.js', import.meta.url), 'utf8');
const css = appStyleSheet();
const document = freshIndexDocument();
const mount = document.getElementById('rangeCalibrationMount') || document.body;
mount.appendChild(document.getElementById('rangeCalibrationTemplate').content.cloneNode(true));
const root = mount.querySelector('.range-calibration-workspace');
const byId = (id) => mount.querySelector(`#${id}`);
const leafTexts = () => new Set(mount.querySelectorAll('*').filter((node) => node.childElementCount === 0).map((node) => text(node)));

function calibrationTemplate() {
  return root;
}

test('question UI exposes one dominant hand-class prompt with canonical RFI actions and no grading semantics', () => {
  const template = calibrationTemplate();
  for (const id of [
    'calibrationStartQuestions',
    'calibrationQuestionTitle',
    'calibrationActionGrid',
    'calibrationOpenMix',
    'calibrationReadinessState',
    'calibrationReadinessReason',
    'calibrationRecommendedClarifications',
    'calibrationUndoAnswer',
    'calibrationPauseQuestions',
    'calibrationStopQuestions',
    'calibrationSkipQuestion',
    'calibrationNotSure',
    'calibrationQuestionReason',
    'calibrationAskAnother',
    'calibrationCompleteState',
    'calibrationCompleteOpenMatrix',
    'calibrationCompleteDirectCount',
    'calibrationCompleteModeledCount',
    'calibrationCompleteUncertainRegionCount',
    'calibrationCompleteClarificationCount',
    'calibrationRetryAnswer',
    'calibrationMixRetry',
  ]) assert.ok(byId(id), id);
  assert.match(workspace, /button\.dataset\.calibrationAction = action\.type/);
  assert.match(workspace, /calibrationState\?\.availableActions/);
  for (const label of leafTexts()) assert.doesNotMatch(label, /^(?:Correct|Optimal|Mistake|EV lost)$/i);
});

test('adaptive setup, transparent question value, truthful model progress, and completion controls are present', () => {
  const template = calibrationTemplate();
  assert.ok(root.querySelector('input[name="calibration-intent"][value="mapping"]'));
  const copy = text(root);
  assert.match(copy, /Map hand families and boundaries. Stop whenever you want/);
  assert.ok(byId('personalMappingCoverage'));
  assert.doesNotMatch(copy, /About 5 questions|About 30 questions|Up to 75 questions/);
  assert.match(copy, /Riverline chooses informative hands first/);
  assert.ok(root.querySelector('[data-tutorial-anchor="calibration-question-reason"]'));
  const labels = leafTexts();
  for (const category of ['Direct', 'Locally inferred', 'Transferred', 'Uncertain', 'Unknown', 'Conflicting']) {
    assert.ok(labels.has(category), category);
  }
  assert.equal(byId('calibrationProgressBar'), null);
  assert.doesNotMatch(copy, /high-value questions remain/);
  assert.match(copy, /Initial map/);
  assert.equal(byId('calibrationCompleteOpenMatrix').dataset.i18n, 'Review understanding');
  assert.doesNotMatch(text(byId('calibrationCompleteState')), /169|remaining cells/i);
  assert.doesNotMatch(copy, /confidence percentage|GTO confidence|solved range/i);
  assert.match(workspace, /application\.skipCalibrationQuestion/);
  assert.match(workspace, /skipQuestion\(true\)/);
  assert.match(workspace, /application\.requestAdditionalQuestion/);
  assert.match(workspace, /completionCopy\(progressAssessment\)/);
});

test('keyboard shortcuts are question-scoped, ignore editable targets, and retain accessible buttons', () => {
  assert.match(workspace, /query\('#calibrationQuestionView'\)\.contains\(target\)/);
  assert.match(workspace, /target\.matches\('input, textarea, select, \[contenteditable="true"\]'\)/);
  assert.match(workspace, /event\.ctrlKey \|\| event\.metaKey \|\| event\.altKey \|\| event\.repeat/);
  assert.match(workspace, /calibrationState\.availableActions\.find/);
  assert.match(service, /\[ACTION_TYPES\.FOLD\]: 'F'/);
  assert.match(service, /\[ACTION_TYPES\.RAISE\]: 'R'/);
});

test('explicit mix editor is labeled, focus-trapped, cancellable, and validated by application semantics', () => {
  const template = calibrationTemplate();
  const dialog = byId('calibrationMixDialog');
  assert.equal(dialog.getAttribute('role'), 'dialog');
  assert.equal(dialog.getAttribute('aria-modal'), 'true');
  const slider = byId('calibrationMixSlider');
  assert.equal(slider.type, 'range');
  assert.equal(slider.getAttribute('min'), '0');
  assert.equal(slider.getAttribute('max'), '100');
  assert.ok(byId('calibrationMultiMix'));
  for (const id of ['calibrationMixFold', 'calibrationMixRaise']) assert.notEqual(byId(id)?.type, 'number', id);
  assert.ok(byId('calibrationMixFoldValue'));
  assert.ok(byId('calibrationMixRaiseValue'));
  assert.match(workspace, /complementaryRfiMixFromFold/);
  assert.match(workspace, /setMultiMixValue/);
  assert.match(workspace, /mixFocusableElements/);
  assert.match(workspace, /if \(event\.key === 'Escape'\)/);
  assert.match(service, /Fold and Raise frequencies must total 100%/);
  assert.match(service, /const tied = values\[0\] === values\[1\]/);
  assert.match(workspace, /previousAnswerLabel/);
  assert.match(workspace, /observation\.dominantAction/);
  assert.match(text(root), /An exact tie is stored as a tied mix with no dominant action/);
  assert.doesNotMatch(text(root), /Fold is stored as the deterministic dominant action/);
});

test('question state locks configuration, preserves LTR poker data in RTL, and fits desktop breakpoints', () => {
  // Protects: the question view hides configuration; hand classes stay LTR
  // in RTL; a short-desktop layout applies; question cards size the card token.
  const configuration = root.querySelector('.calibration-configuration-view');
  root.dataset.sessionView = 'questions';
  assert.equal(css.cascaded(configuration, 'display'), 'none');
  delete root.dataset.sessionView;
  assert.notEqual(css.cascaded(configuration, 'display'), 'none');
  const handClass = root.querySelector('.calibration-hand-class') || (() => {
    const node = document.createElement('strong');
    node.className = 'calibration-hand-class';
    byId('calibrationQuestionView').appendChild(node);
    return node;
  })();
  document.documentElement.setAttribute('dir', 'rtl');
  assert.equal(css.cascaded(handClass, 'direction'), 'ltr');
  document.documentElement.removeAttribute('dir');
  const shortDesktop = { width: 1366, height: 760 };
  root.dataset.sessionView = 'questions';
  const compact = mount.querySelectorAll('*').some((node) => css.matchingRules(node, shortDesktop)
    .some((rule) => rule.conditions.some((entry) => entry.query.replace(/\s+/g, ' ') === '(max-height: 800px) and (min-width: 821px)')));
  delete root.dataset.sessionView;
  assert.ok(compact, 'short desktop screens use the compact question layout');
  const cards = byId('calibrationQuestionCards');
  assert.equal(cards.getAttribute('role'), 'img');
  assert.ok(css.cascaded(cards, '--poker-card-width'));
  assert.match(workspace, /representativeCardsForHandClass/);
  assert.match(workspace, /calibrationReturnToContext[^\n]+focus/);
});

test('accepted observation and cursor use one atomic repository commit and failures stay on the same prompt', () => {
  assert.match(repository, /saveCalibrationAnswer\(\{[\s\S]*?expectedSession = undefined/);
  assert.match(repository, /JSON\.stringify\(durableSession\) !== JSON\.stringify\(expectedSession\)/);
  assert.match(repository, /Calibration answer must append exactly one session observation/);
  assert.match(service, /repository\.saveCalibrationAnswer\(\{[\s\S]*?expectedSession: state\.session/);
  assert.match(service, /supersedesObservationId: latestObservation\?\.id \?\? null/);
  assert.match(workspace, /const nextState = await application\.answerCalibrationQuestion/);
  assert.match(workspace, /answerPending/);
  assert.match(workspace, /operation: application\.createAnswerOperation\(calibrationState\)/);
  assert.match(workspace, /catch \(error\)[\s\S]*?calibrationAnswerError/);
});

test('new elicitation strings have Russian and Hebrew catalog coverage', () => {
  for (const key of [
    'Pause questions',
    'What is your dominant action?',
    'Set frequencies',
    'Undo previous answer',
    'Building your profile',
    'Profile ready',
    'Profile needs conflict review',
    'Fold and Raise frequencies must total 100%.',
    'Move one slider to set Fold; Raise updates automatically so the exact mix always totals 100%.',
    'Fold percentage; Raise updates automatically',
    'Selected from your Matrix',
    'An exact tie is stored as a tied mix with no dominant action.',
    'Why this hand?',
    'Near a Raise/Fold boundary',
    'Riverline has a useful first approximation.',
    '{count} recommended clarifications',
    'Continue refining',
    'Open Teacher',
    'Question counts are session goals, not time promises.',
  ]) {
    assert.equal(translations.split(`'${key}':`).length, 3, `${key} must exist once in RU and once in HE`);
  }
});
