import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const html = fs.readFileSync(new URL('../app/index.html', import.meta.url), 'utf8');
const logic = fs.readFileSync(new URL('../app/src/core/logic.js', import.meta.url), 'utf8');
const css = fs.readFileSync(new URL('../app/styles.css', import.meta.url), 'utf8');
const teacher = fs.readFileSync(new URL('../app/src/ui/teacher.js', import.meta.url), 'utf8');
const randomSpot = fs.readFileSync(
  new URL('../docs/project/capabilities/RANDOM_SPOT_GENERATOR.md', import.meta.url),
  'utf8',
);
const training = html.slice(html.indexOf('id="trainingMode"'), html.indexOf('<!-- Equity workspace -->'));

function between(source, start, end) {
  const first = source.indexOf(start);
  const last = source.indexOf(end, first + start.length);
  assert.ok(first >= 0, start);
  assert.ok(last > first, end);
  return source.slice(first, last);
}

test('accepted Training skeleton and its one start/answer/progression authorities remain intact', () => {
  for (const id of [
    'trainingSetupPanel', 'trainingExerciseSurface', 'trainingDecisionControls',
    'trainingFeedback', 'trainingContinuationRow',
    'trainingNextHandBtn', 'trainingMemoryPanel',
  ]) assert.equal((training.match(new RegExp(`id="${id}"`, 'g')) || []).length, 1, id);
  assert.equal((training.match(/id="trainingNewHand"/g) || []).length, 1);
  assert.equal((training.match(/class="training-insight-column"/g) || []).length, 1);
});

test('live Full Hand records neutrally and cannot render verdict, source, Facts, or deep analysis', () => {
  const renderer = between(logic, 'function renderFullHandDecisionRecorded(', 'function updateTrainingButtons(');
  const answer = between(logic, 'async function handleFullHandTrainingGuess(', 'function toggleFullHandTrainingReview(');
  assert.match(renderer, /Decision recorded/);
  assert.match(renderer, /facts\.hidden = true/);
  assert.match(renderer, /explain\.hidden = true/);
  assert.doesNotMatch(renderer, /evaluation|strategyResult|canonicalTrainingFeedback|renderTrainingRelevantFacts|renderDecisionAnalysis/);
  assert.match(answer, /renderFullHandDecisionRecorded\(result\)/);
  assert.doesNotMatch(answer, /renderFullHandDecisionFeedback/);
  assert.match(logic, /Hidden until review[\s\S]*Comparison and source details are available after the Hand in Review/);
});

test('completed Full Hand still enters the shared evidence-rich Review contract', () => {
  const review = between(logic, 'function toggleFullHandTrainingReview(', 'async function openFullHandDecisionInAnalysis(');
  assert.match(review, /getFullHandReview/);
  assert.match(review, /refreshActiveHandReviewModel/);
  assert.match(review, /selectActiveHandReviewDecision/);
  assert.match(review, /renderActiveHandReview/);
  for (const id of [
    'handReviewChosenAction', 'handReviewComparisonBadge', 'handReviewFrequencyRows',
    'handReviewPreviousDecision', 'handReviewNextDecision',
    'handReviewPreviousEvent', 'handReviewNextEvent',
  ]) assert.match(html, new RegExp(`id="${id}"`), id);
  assert.match(html, /class="hand-review-decision-facts"/);
});

test('Abort is live-only, confirmed, resets transient Full Hand state, and never fabricates completion', () => {
  assert.match(training, /id="trainingFullHandEndHand"[^>]+hidden[^>]+data-i18n="Abort hand"/);
  const phase = between(logic, 'function setFullHandTrainingPhase(', 'function trainingSessionLength(');
  const abort = between(logic, 'function abortFullHandTraining(', 'function replayCurrentTrainingSeed(');
  assert.match(phase, /abort\.hidden = nextPhase !== 'live'/);
  assert.match(logic, /fullHandDock\.insertBefore\(fullHandLifecycle/);
  assert.match(abort, /dataset\.trainingFullHandPhase !== 'live'/);
  assert.match(abort, /window\.confirm/);
  assert.match(abort, /clearTrainingSessionState\(\)/);
  assert.match(abort, /Recorded decisions remain in Training Memory/);
  assert.doesNotMatch(abort, /completed|showdown|renderFullHandTrainingCompletion|finishTrainingMemorySession\('completed'/);
  assert.match(logic, /bind\('#trainingFullHandEndHand', 'click', abortFullHandTraining\)/);
});

test('answered Varied/Focused puts one primary progression row before study controls, Facts, and Explain', () => {
  const feedback = training.slice(training.indexOf('id="trainingFeedback"'), training.indexOf('id="trainingFullHandCompletion"'));
  const ordered = [
    'id="trainingFeedbackProgressionMount"', 'id="trainingMemoryDecisionActions"',
    'id="trainingRelevantFacts"', 'id="trainingAnalysis"',
  ].map((token) => feedback.indexOf(token));
  assert.ok(ordered.every((index) => index >= 0));
  assert.deepEqual([...ordered].sort((a, b) => a - b), ordered);
  const projection = between(logic, 'function projectTrainingContinuationControls(', 'function selectedTrainingControlLabel(');
  assert.match(projection, /trainingFeedbackProgressionMount/);
  assert.match(projection, /destination\.append\(row\)/);
  assert.match(logic, /projectTrainingContinuationControls\([\s\S]*state === 'feedback'/);
  assert.equal((training.match(/id="trainingNextHandBtn"/g) || []).length, 1);
});

test('normal drills remain immediate-feedback consumers with relevant Facts and optional Explain', () => {
  const answer = between(logic, 'function handleTrainingGuess(', 'function replayTrainingExercise(');
  assert.match(answer, /showTrainingFeedback/);
  assert.match(answer, /renderTrainingDecisionAnalysis/);
  assert.match(answer, /showTrainingSolution/);
  assert.match(teacher, /TRAINING_RELEVANT_FACT_PRIORITY/);
  assert.match(teacher, /analysisDisclosure = 'supporting-detail'/);
});

test('normal modes are content-height while Full Hand retains its large shared-table sizing', () => {
  assert.match(css, /data-training-full-hand-phase="off"[^}]+training-decision-column[\s\S]*align-self:\s*start/);
  assert.match(css, /data-training-full-hand-phase="off"[^}]+training-decision-panel[\s\S]*min-block-size:\s*0/);
  assert.match(css, /data-training-full-hand-phase="live"[^}]+#visual-table-container[\s\S]*1320px[\s\S]*100dvh/);
});

test('future stack randomization is bounded under one shared reproducible Random Spot authority', () => {
  for (const phrase of [
    'Bounded effective-stack randomization', 'shared randomization contract',
    'legal minimum and maximum', 'short / medium / standard / deep',
    'Stack lock', 'deterministic', 'Training-specific stack randomizer',
    'not implemented',
  ]) assert.match(randomSpot, new RegExp(phrase.replaceAll('/', '\\/'), 'i'), phrase);
});
