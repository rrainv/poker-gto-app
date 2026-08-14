import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const html = fs.readFileSync(new URL('../app/index.html', import.meta.url), 'utf8');
const css = fs.readFileSync(new URL('../app/styles.css', import.meta.url), 'utf8');
const workspace = fs.readFileSync(new URL('../app/src/application/range-calibration-workspace.mjs', import.meta.url), 'utf8');
const service = fs.readFileSync(new URL('../app/src/application/range-calibration-service.mjs', import.meta.url), 'utf8');
const repository = fs.readFileSync(new URL('../app/src/personal-strategy/repository.mjs', import.meta.url), 'utf8');
const translations = fs.readFileSync(new URL('../app/src/locales/range-calibration-translations.js', import.meta.url), 'utf8');

function calibrationTemplate() {
  const start = html.indexOf('id="rangeCalibrationTemplate"');
  return html.slice(start, html.indexOf('</template>', start));
}

test('question UI exposes one dominant hand-class prompt with canonical RFI actions and no grading semantics', () => {
  const template = calibrationTemplate();
  for (const id of [
    'calibrationStartQuestions',
    'calibrationQuestionTitle',
    'calibrationActionFold',
    'calibrationActionRaise',
    'calibrationOpenMix',
    'calibrationProgressBar',
    'calibrationUndoAnswer',
    'calibrationPauseQuestions',
    'calibrationCompleteState',
  ]) assert.match(template, new RegExp(`id="${id}"`));
  assert.match(template, /data-calibration-action="fold"/);
  assert.match(template, /data-calibration-action="raise"/);
  assert.doesNotMatch(template, /data-calibration-action="(?:call|all_in|check|bet)"/);
  assert.doesNotMatch(template, />\s*(?:Correct|Optimal|Mistake|EV lost)\s*</i);
});

test('keyboard shortcuts are question-scoped, ignore editable targets, and retain accessible buttons', () => {
  assert.match(workspace, /query\('#calibrationQuestionView'\)\.contains\(target\)/);
  assert.match(workspace, /target\.matches\('input, textarea, select, \[contenteditable="true"\]'\)/);
  assert.match(workspace, /event\.ctrlKey \|\| event\.metaKey \|\| event\.altKey \|\| event\.repeat/);
  assert.match(workspace, /RFI_CALIBRATION_ACTIONS\.find/);
  assert.match(html, /<kbd>F<\/kbd>/);
  assert.match(html, /<kbd>R<\/kbd>/);
});

test('explicit mix editor is labeled, focus-trapped, cancellable, and validated by application semantics', () => {
  const template = calibrationTemplate();
  assert.match(template, /id="calibrationMixDialog"[^>]+role="dialog"[^>]+aria-modal="true"/);
  assert.match(template, /id="calibrationMixFold"[^>]+min="0" max="100"/);
  assert.match(template, /id="calibrationMixRaise"[^>]+min="0" max="100"/);
  assert.match(workspace, /mixFocusableElements/);
  assert.match(workspace, /if \(event\.key === 'Escape'\)/);
  assert.match(service, /Fold and Raise frequencies must total 100%/);
  assert.match(service, /const tied = values\[0\] === values\[1\]/);
  assert.match(workspace, /previousAnswerLabel/);
  assert.match(workspace, /observation\.dominantAction/);
  assert.match(template, /An exact tie is stored as a tied mix with no dominant action/);
  assert.doesNotMatch(template, /Fold is stored as the deterministic dominant action/);
});

test('question state locks configuration, preserves LTR poker data in RTL, and fits desktop breakpoints', () => {
  assert.match(css, /data-session-view="questions"[^\n]+\.calibration-configuration-view[^\n]+display: none/);
  assert.match(css, /\[dir="rtl"\] \.calibration-hand-class[\s\S]*?direction: ltr/);
  assert.match(css, /@media \(max-height: 800px\) and \(min-width: 821px\)/);
  assert.match(css, /font: 850 clamp\(4\.2rem, 8vw, 6\.5rem\)/);
  assert.match(workspace, /calibrationReturnToContext[^\n]+focus/);
});

test('accepted observation and cursor use one atomic repository commit and failures stay on the same prompt', () => {
  assert.match(repository, /saveCalibrationAnswer\(\{ observation, session, expectedSessionUpdatedAt \}/);
  assert.match(repository, /Calibration answer must append exactly one session observation/);
  assert.match(service, /repository\.saveCalibrationAnswer/);
  assert.match(service, /supersedesObservationId: latestObservation\?\.id \?\? null/);
  assert.match(workspace, /const nextState = application\.answerCalibrationQuestion/);
  assert.match(workspace, /catch \(error\)[\s\S]*?calibrationAnswerError/);
});

test('new elicitation strings have Russian and Hebrew catalog coverage', () => {
  for (const key of [
    'Pause questions',
    'What is your dominant action?',
    'Set frequencies',
    'Undo previous answer',
    'Direct RFI calibration complete for this spot.',
    'Fold and Raise frequencies must total 100%.',
    'An exact tie is stored as a tied mix with no dominant action.',
  ]) {
    assert.equal(translations.split(`'${key}':`).length, 3, `${key} must exist once in RU and once in HE`);
  }
});
