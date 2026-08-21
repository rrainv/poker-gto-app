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
  ]) assert.match(template, new RegExp(`id="${id}"`));
  assert.match(workspace, /button\.dataset\.calibrationAction = action\.type/);
  assert.match(workspace, /calibrationState\?\.availableActions/);
  assert.doesNotMatch(template, />\s*(?:Correct|Optimal|Mistake|EV lost)\s*</i);
});

test('adaptive setup, transparent question value, truthful model progress, and completion controls are present', () => {
  const template = calibrationTemplate();
  for (const intent of ['quick', 'standard', 'deep']) {
    assert.match(template, new RegExp(`name="calibration-intent" value="${intent}"`));
  }
  assert.match(template, /Question counts are session goals, not time promises/);
  assert.match(template, /Riverline chooses informative hands first/);
  assert.match(template, /data-tutorial-anchor="calibration-question-reason"/);
  for (const category of [
    'Direct', 'Locally inferred', 'Transferred', 'Uncertain', 'Unknown', 'Conflicting',
  ]) assert.match(template, new RegExp(`>${category}<`));
  assert.doesNotMatch(template, /id="calibrationProgressBar"|high-value questions remain/);
  assert.match(template, /Your starter profile is ready/);
  assert.match(template, /Review profile/);
  assert.doesNotMatch(template.slice(
    template.indexOf('id="calibrationCompleteState"'),
    template.indexOf('<div class="calibration-personal-column">'),
  ), /169|remaining cells/i);
  assert.doesNotMatch(template, /confidence percentage|GTO confidence|solved range/i);
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
  assert.match(template, /id="calibrationMixDialog"[^>]+role="dialog"[^>]+aria-modal="true"/);
  assert.match(template, /id="calibrationMixSlider"[^>]+type="range"[^>]+min="0" max="100"/);
  assert.match(template, /id="calibrationMultiMix"/);
  assert.doesNotMatch(template, /id="calibrationMix(?:Fold|Raise)"[^>]+type="number"/);
  assert.match(template, /id="calibrationMixFoldValue"/);
  assert.match(template, /id="calibrationMixRaiseValue"/);
  assert.match(workspace, /complementaryRfiMixFromFold/);
  assert.match(workspace, /setMultiMixValue/);
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
  assert.match(html, /id="calibrationQuestionCards"[^>]+role="img"/);
  assert.match(css, /\.calibration-question-cards[^{]*\{[^}]*--poker-card-width/);
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
