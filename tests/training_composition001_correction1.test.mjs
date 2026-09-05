import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const html = fs.readFileSync(new URL('../app/index.html', import.meta.url), 'utf8');
const logic = fs.readFileSync(new URL('../app/src/core/logic.js', import.meta.url), 'utf8');
const css = fs.readFileSync(new URL('../app/styles.css', import.meta.url), 'utf8');
const teacher = fs.readFileSync(new URL('../app/src/ui/teacher.js', import.meta.url), 'utf8');
const sound = fs.readFileSync(new URL('../app/src/core/SoundFX.js', import.meta.url), 'utf8');
const tablePresentation = fs.readFileSync(
  new URL('../app/src/application/table-presentation.mjs', import.meta.url),
  'utf8',
);
const rangeBootstrap = fs.readFileSync(
  new URL('../app/src/application/range-calibration-bootstrap.mjs', import.meta.url),
  'utf8',
);
const training = html.slice(html.indexOf('id="trainingMode"'), html.indexOf('<!-- Equity workspace -->'));
const correctionCss = css.slice(css.indexOf('TRAINING-COMPOSITION-001 HUMAN QA CORRECTION #1'));

function sourceBetween(source, start, end) {
  return source.slice(source.indexOf(start), source.indexOf(end));
}

test('accepted Varied skeleton stays intact while idle state yields fake vertical space', () => {
  assert.match(training, /<main class="training-decision-column">/);
  assert.match(training, /<aside class="training-insight-column">/);
  assert.equal((training.match(/id="trainingNewHand"/g) || []).length, 1);
  assert.match(correctionCss, /data-training-state="idle"[^}]*\.training-decision-panel[\s\S]*min-block-size:\s*0/);
  assert.match(correctionCss, /data-training-state="idle"[^}]*\.training-state-message[\s\S]*min-block-size:\s*0/);
  for (const selector of [
    '.training-session-panel', '.training-reference-summary',
    '.training-history-panel', '.training-assistance-panel',
  ]) assert.match(correctionCss, new RegExp(selector.replace('.', '\\.') + '[\\s\\S]*display: none !important'));
  assert.match(correctionCss, /training-memory-panel > summary\.panel-head[\s\S]*min-block-size:\s*46px/);
});

test('Review later and Mark difficult are persisted, reversible, and visibly acknowledged', () => {
  assert.match(training, /id="trainingMarkReview"[^>]*aria-pressed="false"[^>]*>Review later/);
  assert.match(training, /id="trainingMarkDifficult"[^>]*aria-pressed="false"[^>]*>Mark difficult/);
  assert.match(training, /id="trainingMemoryDecisionStatus"[^>]*role="status"[^>]*aria-live="polite"/);
  const update = sourceBetween(logic, 'function updateTrainingMemoryDecisionActions(', 'function startTrainingMemorySession(');
  assert.match(update, /studyMetadata\?\.review[\s\S]*Added to review[\s\S]*Remove from review/);
  assert.match(update, /studyMetadata\?\.difficult[\s\S]*Marked difficult[\s\S]*Clear difficult mark/);
  const toggle = sourceBetween(logic, 'async function toggleCurrentTrainingMemoryMetadata(', 'async function openTrainingMemoryRedrill(');
  assert.match(toggle, /updateStudyMetadata', record\.id/);
  assert.match(toggle, /const enabled = !record\.studyMetadata\[field\]/);
  assert.match(toggle, /Training Memory review queue updated/);
  assert.match(toggle, /refreshTrainingMemoryPanel\(\)/);
  assert.match(correctionCss, /training-memory-decision-actions \.ui-button\[aria-pressed="true"\]/);
});

test('Training Facts project direct decision facts without creating poker authority', () => {
  assert.match(training, /id="trainingRelevantFacts"/);
  const projector = sourceBetween(teacher, 'const TRAINING_RELEVANT_FACT_PRIORITY', 'function studyHintDefinition(');
  for (const key of ['made_hand', 'draws', 'pot_before_action', 'call_amount', 'required_raw_equity', 'spr']) {
    assert.match(projector, new RegExp(`'${key}'`), key);
  }
  assert.doesNotMatch(projector, /hero_blocker_structure|range_blocker_effect|physical combos removed/);
  assert.match(projector, /analysisFactByKey\(explanation, key\)/);
  assert.match(logic, /renderDecisionAnalysis\([\s\S]*renderTrainingRelevantFacts/);
});

test('generic blocker evidence remains available only inside Training supporting detail', () => {
  const renderer = sourceBetween(teacher, 'function renderAnalysisExplanation(', 'window.renderDecisionAnalysis');
  assert.match(renderer, /surface === 'training'[\s\S]*\['bluff_pressure', 'range'\]/);
  assert.match(renderer, /\['bluff_pressure', 'blockers', 'range'\]/);
  assert.match(renderer, /analysisDisclosure = 'supporting-detail'/);
  assert.match(renderer, /explanation\.sections\.forEach/);
  assert.match(renderer, /facts = analysisSection\.facts\.filter/);
});

test('Full Hand keeps one shared table and moves the one canonical action surface beside it', () => {
  assert.equal((training.match(/id="trainingFullHandTableMount"/g) || []).length, 1);
  assert.equal((training.match(/id="trainingDecisionControls"/g) || []).length, 1);
  assert.match(logic, /createFullHandTablePresence/);
  assert.match(logic, /createFullHandTablePresentation/);
  assert.match(logic, /mount\.appendChild\(table\)/);
  assert.match(tablePresentation, /TABLE_PRESENTATION_SCHEMA_VERSION/);
  const projection = sourceBetween(logic, 'function projectTrainingDecisionControls(', 'function selectedTrainingControlLabel(');
  assert.match(projection, /trainingFullHandActionDockMount/);
  assert.match(projection, /trainingDecisionActionMount/);
  assert.match(projection, /destination\.append\(controls\)/);
  assert.match(correctionCss, /grid-template-columns:\s*minmax\(0, 1fr\) minmax\(380px, 410px\)/);
  assert.match(correctionCss, /#visual-table-container[\s\S]*1320px[\s\S]*100dvh/);
  assert.match(correctionCss, /training-full-hand-action-dock \{ order: 1; \}/);
});

test('Full Hand action family selection gates canonical amount-to sizing', () => {
  const sizing = sourceBetween(logic, 'function clearFullHandTrainingSizingControls(', 'function clearFullHandDecisionFeedback(');
  assert.match(sizing, /surface\.hidden = true/);
  assert.match(sizing, /\['bet', 'raise'\]\.includes\(actionType\)/);
  assert.match(sizing, /getFullHandSizingModel/);
  assert.match(sizing, /canonicalActionPresentation\(actionType, option\)/);
  assert.match(sizing, /validateFullHandSizingInput/);
  assert.match(sizing, /input\.min = sizing\.minValueBb/);
  assert.match(sizing, /input\.max = sizing\.maxValueBb/);
  assert.match(sizing, /Apply amount-to/);
  assert.match(sizing, /preset\.kind !== 'all_in'/);
  assert.match(logic, /type === 'all_in' \? exercise\.legalActions\?\.allIn/);
});

test('Full Hand answer keeps table continuity while deferring normative feedback to Review', () => {
  assert.match(training, /id="trainingFullHandDecisionFeedback"[^>]*hidden/);
  assert.match(training, /id="trainingFullHandDecisionFacts"/);
  assert.match(training, /<details class="training-full-hand-decision-explain">/);
  assert.doesNotMatch(logic, /function renderFullHandDecisionFeedback/);
  const recorded = sourceBetween(logic, 'function renderFullHandDecisionRecorded(', 'function updateTrainingButtons(');
  assert.match(recorded, /Decision recorded/);
  assert.match(recorded, /facts\.hidden = true/);
  assert.match(recorded, /explain\.hidden = true/);
  assert.doesNotMatch(recorded, /canonicalTrainingFeedback|renderTrainingRelevantFacts|renderDecisionAnalysis|strategyResult/);
  assert.match(logic, /function toggleFullHandTrainingReview\(\)[\s\S]*getFullHandReview[\s\S]*renderActiveHandReview/);
  assert.match(correctionCss, /training-full-hand-decision-explain\[open\][\s\S]*max-block-size/);
  assert.doesNotMatch(recorded, /restoreSharedPokerTable/);
});

test('Training feedback event precedes deep render and a prepared Study cue avoids async readiness delay', () => {
  const answer = sourceBetween(logic, 'function handleTrainingGuess(', 'function replayTrainingExercise(');
  assert.ok(answer.indexOf('emitTrainingDecisionResultExperience') < answer.indexOf('renderTrainingDecisionAnalysis'));
  const playCue = sourceBetween(sound, 'async function playCue(', 'function setSoundEnabled(');
  assert.match(playCue, /preparedContext\?\.state === 'running'[\s\S]*preparedContext[\s\S]*await ensureAudioReady/);
  assert.match(playCue, /definition\.category === CATEGORIES\.POKER[\s\S]*renderRecordedFoleyCue/);
  assert.match(playCue, /renderProceduralCue\(ctx, cueName\)/);
});

test('Personal Strategy still owns its authenticated lazy bootstrap and recoverable shell', () => {
  assert.match(rangeBootstrap, /createRangeCalibrationLifecycle/);
  assert.match(rangeBootstrap, /async mountAuthenticated\(options\)[\s\S]*mountRangeCalibrationWorkspace\(options\)/);
  assert.match(rangeBootstrap, /calibrationErrorState/);
  assert.match(rangeBootstrap, /lifecycle\.start\(\)/);
  assert.doesNotMatch(logic, /rangeCalibrationRepository|loadSnapshot/);
});
