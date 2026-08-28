import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const logic = fs.readFileSync(new URL('../app/src/core/logic.js', import.meta.url), 'utf8');
const css = fs.readFileSync(new URL('../app/styles.css', import.meta.url), 'utf8');
const bridge = fs.readFileSync(
  new URL('../app/src/application/training-mode-bootstrap.mjs', import.meta.url),
  'utf8',
);

function between(source, start, end) {
  const first = source.indexOf(start);
  const last = source.indexOf(end, first + start.length);
  assert.ok(first >= 0, start);
  assert.ok(last > first, end);
  return source.slice(first, last);
}

test('Replay this decision remounts the current canonical exercise instead of a generation path', () => {
  assert.match(logic, /bind\('#trainingReplayDecisionBtn', 'click', replayCurrentTrainingDecision\)/);
  const replay = between(
    logic,
    'function replayCurrentTrainingDecision(',
    'function trainingSessionIsActive(',
  );
  assert.match(replay, /const exercise = app\.training\.currentExercise/);
  assert.match(replay, /callTrainingServiceBridge\('replayExercise', exercise\)/);
  assert.match(replay, /attemptKind: 'replay'/);
  assert.doesNotMatch(replay, /generatePlanned|newRandomTrainingHand|replayTrainingExercise|nextSeed/);
  assert.match(bridge, /replayExercise\(exercise\)[\s\S]*controller\.replayExercise\(exercise\)/);
});

test('replay answers retain evidence but are excluded from all headline session counters', () => {
  const answer = between(logic, 'function handleTrainingGuess(', 'function replayTrainingExercise(');
  assert.match(answer, /const countsTowardSession = app\.training\.currentAttemptKind !== 'replay'/);
  const counted = between(answer, 'if (countsTowardSession) {', 'const feedbackSemantics');
  for (const mutation of [
    'stats.totalHands += 1',
    'stats.correct += evaluation.scoreDelta',
    'stats.streak =',
    'bestStreak =',
    'gradeStats[evaluation.grade]',
  ]) assert.ok(counted.includes(mutation), mutation);
  assert.match(answer, /recordTrainingExerciseAnswered\(/);
  assert.match(answer, /if \(countsTowardSession\) completeVariedTrainingSession\(\)/);
});

test('repeated replay evidence keeps same-spot provenance rooted in the primary record', () => {
  const replay = between(
    logic,
    'function replayCurrentTrainingDecision(',
    'function trainingSessionIsActive(',
  );
  assert.match(replay, /currentAttemptKind === 'replay'[\s\S]*replaySourceRecordPromise/);
  assert.match(replay, /redrillKind: 'same_spot'/);
  const shown = between(logic, 'function recordTrainingExerciseShown(', 'function recordTrainingExerciseAnswered(');
  assert.match(shown, /resolvedOrigin[\s\S]*parentDecisionRecordId/);
  assert.match(shown, /resolvedOrigin[\s\S]*redrillKind/);
});

test('Full Hand Review suppresses the horizontal timeline and opens canonical vertical History', () => {
  const timeline = between(
    logic,
    'function renderFullHandCompactTimeline(',
    'function dispatchFullHandTrainingTable(',
  );
  assert.match(timeline, /if \(reviewMode\) \{[\s\S]*root\.hidden = true;[\s\S]*return;/);
  assert.doesNotMatch(timeline, /stepActiveHandReviewReplay/);
  const phase = between(logic, 'function setFullHandTrainingPhase(', 'function trainingSessionLength(');
  assert.match(phase, /nextPhase === 'review'\) history\.open = true/);
  assert.match(logic, /renderFullHandTrainingHistory\(snapshot\)/);
  const review = between(
    logic,
    'function toggleFullHandTrainingReview(',
    'async function openFullHandDecisionInAnalysis(',
  );
  assert.match(review, /trainingRecommendation'\)\?\.scrollIntoView/);
  assert.doesNotMatch(review, /handReviewSurface'\)\?\.scrollIntoView/);
  const renderer = between(
    logic,
    'function renderActiveHandReview(',
    'function selectActiveHandReviewDecision(',
  );
  assert.match(renderer, /model\.source === 'training_full_hand'/);
  assert.match(renderer, /trainingReferenceSummaryValue/);
  assert.match(renderer, /reviewComparisonLabel\(decision\.comparison\)/);
});

test('Full Hand Review retains the live shared-table desktop scale and study rail', () => {
  const normalizedCss = css.replaceAll('\r\n', '\n');
  assert.match(css, /data-table-projection="review"[^}]+--play-stage-reserve:\s*310px[^}]+1320px/s);
  assert.ok(normalizedCss.includes(`.training-workspace[data-training-full-hand-phase="live"],
  .training-workspace[data-training-full-hand-phase="review"] {
    grid-template-columns: minmax(0, 1fr) minmax(380px, 410px) !important;`));
  assert.ok(normalizedCss.includes(`.training-workspace[data-training-full-hand-phase="review"] > .training-study-rail {
    position: sticky;`));
  assert.match(css, /data-training-full-hand-phase="review"\] \.training-full-hand-table-wrapper #visual-table-container[^}]+1320px[^}]+100dvh/s);
});
