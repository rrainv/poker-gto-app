import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const html = fs.readFileSync(new URL('../app/index.html', import.meta.url), 'utf8');
const css = fs.readFileSync(new URL('../app/styles.css', import.meta.url), 'utf8');
const logic = fs.readFileSync(new URL('../app/src/core/logic.js', import.meta.url), 'utf8');
const bootstrap = fs.readFileSync(
  new URL('../app/src/application/training-mode-bootstrap.mjs', import.meta.url),
  'utf8',
);
const sizing = fs.readFileSync(
  new URL('../app/src/application/full-hand-training-sizing.mjs', import.meta.url),
  'utf8',
);
const i18n = fs.readFileSync(new URL('../app/src/locales/i18n.js', import.meta.url), 'utf8');
const training = html.slice(html.indexOf('id="trainingMode"'), html.indexOf('id="equityMode"'));
const fullHandLogic = logic.slice(
  logic.indexOf('function setFullHandTrainingLoadingCopy'),
  logic.indexOf('async function startConfiguredTrainingSession'),
);

test('Training exposes Full Hand beside preserved Varied Session and Focused Drill modes', () => {
  assert.match(training, /data-training-session-mode="varied"/);
  assert.match(training, /data-training-session-mode="focused"/);
  assert.match(training, /data-training-session-mode="full_hand"[^>]+data-i18n="Full Hand"/);
  assert.match(logic, /\['varied', 'focused', 'full_hand'\]\.includes/);
  assert.match(logic, /trainingFocusedControls[^\n]+nextMode === 'varied'/);
  assert.match(training, /id="trainingFullHandSetupNote"[^>]+hidden/);
  for (const preserved of [
    'trainingVariedControls', 'trainingFocusedControls', 'trainingStreet',
    'trainingDecisionTarget', 'trainingHeroPos', 'trainingPlayers', 'trainingStack',
  ]) assert.match(training, new RegExp(`id="${preserved}"`), preserved);
});

test('Full Hand reuses legal action controls and the canonical table presence renderer', () => {
  for (const reused of [
    'trainingPotInfo', 'trainingGuessButtons', 'trainingActionHistory', 'trainingStrategySource',
  ]) assert.match(training, new RegExp(`id="${reused}"`), reused);
  for (const added of [
    'trainingDecisionNumber', 'trainingFullHandTableMount', 'trainingFullHandCompletion',
    'trainingFullHandResult', 'trainingFullHandDecisionCount', 'trainingFullHandGradeSummary',
    'trainingReviewHand', 'trainingHandReviewMount', 'trainingFullHandActionStatus',
    'trainingFullHandSizing', 'trainingFullHandSizingActions',
  ]) assert.match(training, new RegExp(`id="${added}"`), added);
  assert.match(logic, /mount\.appendChild\(table\)/);
  assert.match(logic, /callTrainingServiceBridge\('createFullHandTablePresence', snapshot\)/);
  assert.match(bootstrap, /createTablePresenceViewModel\(\{/);
  assert.match(logic, /validateFullHandSizingInput/);
  assert.match(logic, /handleFullHandTrainingGuess\(actionType, validation\.amountToMilliBb\)/);
  assert.doesNotMatch(fullHandLogic, /decision\.legalActions\[userAction\]\.minToMilliBb/);
  assert.match(fullHandLogic, /updateTrainingButtons\(exercise\)/);
  assert.match(fullHandLogic, /renderFullHandTrainingHistory\(snapshot\)/);
});

test('Full Hand reveals keyboard-usable canonical amount-to controls only after Bet or Raise', () => {
  assert.match(training, /id="trainingFullHandSizing"[^>]+aria-labelledby="trainingFullHandSizingTitle"/);
  assert.match(training, /Amount-to · not raise-by/);
  assert.match(logic, /input\.type = 'number'/);
  assert.match(logic, /input\.min = sizing\.minValueBb/);
  assert.match(logic, /input\.max = sizing\.maxValueBb/);
  assert.match(logic, /input\.step = sizing\.stepValueBb/);
  assert.match(logic, /event\.key !== 'Enter'/);
  assert.match(logic, /sizing\.presets\.filter\(\(preset\) => preset\.kind !== 'all_in'\)\.forEach/);
  assert.match(sizing, /getLegalActionSpec\(state\)/);
  assert.match(sizing, /kind: 'all_in',[\s\S]*actionType: ACTION_TYPES\.ALL_IN/);
  assert.match(sizing, /seenActions\.has\(identity\)/);
  assert.match(sizing, /roundToChipUnit/);
  assert.match(logic, /function chooseFullHandTrainingSizedAction\(actionType\)[\s\S]*\['bet', 'raise'\]\.includes\(actionType\)/);
  assert.match(logic, /\['bet', 'raise'\]\.includes\(type\)[\s\S]*chooseFullHandTrainingSizedAction\(type\)/);
  assert.match(logic, /const sizing = \['bet', 'raise'\]\.includes\(actionType\)[\s\S]*model\?\.actions\?\.\[actionType\]/);
  assert.doesNotMatch(logic, /if \(fullHand\) renderFullHandTrainingSizingControls\(\)/);
});

test('Hero answer resumes through stepwise automation with no Continue Hand UI', () => {
  for (const method of [
    'createFullHandStartConfiguration', 'startFullHand', 'answerFullHand',
    'advanceFullHandOneEvent', 'createFullHandPresentationOrchestrator',
    'createFullHandTableTransition', 'getFullHandSnapshot', 'getFullHandReview', 'resetFullHand',
    'getFullHandSizingModel', 'validateFullHandSizingInput',
  ]) assert.match(bootstrap, new RegExp(`${method}\\(`), method);
  assert.doesNotMatch(bootstrap, /continueFullHand\(/);
  assert.match(fullHandLogic, /callTrainingServiceBridge\(\s*'startFullHand'/);
  assert.match(fullHandLogic, /callTrainingServiceBridge\('answerFullHand'/);
  assert.match(fullHandLogic, /getFullHandSnapshot/);
  assert.match(fullHandLogic, /appliedSnapshot\?\.status === 'grading'/);
  assert.match(fullHandLogic, /progressionMode: 'stepwise'/);
  assert.match(fullHandLogic, /runFullHandPresentation/);
  assert.doesNotMatch(fullHandLogic, /continueFullHand|Continue Hand/);
  assert.match(logic, /if \(mode !== 'training'\) restoreSharedPokerTable\(\)/);
  assert.match(logic, /mode === 'training'[\s\S]*renderFullHandTrainingSnapshot\(app\.training\.fullHandSnapshot\)/);
});

test('live pacing communicates actor, action, street, and the Hero boundary without unlocking early', () => {
  assert.match(training, /id="trainingFullHandActionStatus"[^>]+aria-live="polite"[^>]+aria-atomic="true"/);
  assert.match(training, /id="trainingDecisionPrompt"/);
  assert.match(fullHandLogic, /setFullHandTrainingInputLocked\(true\)/);
  assert.match(fullHandLogic, /setFullHandTrainingInputLocked\(false\)/);
  assert.match(fullHandLogic, /\{player\} is thinking…/);
  assert.match(fullHandLogic, /Dealing the flop…/);
  assert.match(fullHandLogic, /Your turn · Hero \(\{position\}\) to act/);
  assert.match(fullHandLogic, /fullHandActionAnnouncement\(snapshot\)/);
  assert.match(fullHandLogic, /invalidateFullHandPresentation\(\)[\s\S]*resetFullHand/);
  assert.match(css, /data-presentation-state="hero_turn"/);
  assert.match(css, /data-training-hero-turn="true"/);
  assert.match(css, /training-hero-seat-pulse/);
  assert.match(css, /prefers-reduced-motion: reduce[\s\S]*training-full-hand-action-status/);
});

test('live Full Hand hides the Varied report, defers verdicts, and exposes live-only Abort', () => {
  assert.match(training, /id="trainingFeedback"/);
  assert.match(training, /id="trainingSolution"[\s\S]*Strategy frequencies/);
  assert.doesNotMatch(fullHandLogic, /showTrainingFeedback|showTrainingSolution|renderTrainingEvaluationSummary/);
  assert.match(css, /data-training-full-hand-phase="live"[\s\S]*#trainingFeedback/);
  assert.match(training, /id="trainingFullHandActionDock"/);
  assert.match(logic, /projectTrainingDecisionControls\(nextPhase === 'live'\)/);
  assert.match(css, /data-training-full-hand-phase="live"[\s\S]*\.training-session-panel \{ order: 2; \}/);
  assert.match(css, /#trainingSetupPanel \.training-setup-fields > :not\(#trainingModeSwitch\):not\(#trainingFullHandCompactControls\)/);
  for (const id of ['trainingFullHandCompactControls', 'trainingFullHandLiveNewHand', 'trainingFullHandEndHand']) {
    assert.match(training, new RegExp(`id="${id}"`), id);
  }
  assert.match(training, /id="trainingFullHandEndHand"[^>]+hidden[^>]+data-i18n="Abort hand"/);
  const recorded = logic.slice(
    logic.indexOf('function renderFullHandDecisionRecorded('),
    logic.indexOf('function updateTrainingButtons('),
  );
  assert.match(recorded, /Decision recorded/);
  assert.doesNotMatch(recorded, /canonicalTrainingFeedback|renderDecisionAnalysis|strategyResult/);
  assert.match(logic, /abort\.hidden = nextPhase !== 'live'/);
  assert.match(logic, /function abortFullHandTraining\(\)[\s\S]*window\.confirm[\s\S]*clearTrainingSessionState\(\)/);
});

test('terminal surface provides real decision review navigation and exact Analysis handoff', () => {
  assert.match(training, /id="trainingFullHandCompletion"[^>]+aria-live="polite"/);
  assert.match(training, /id="trainingReviewHand"[^>]+aria-expanded="false"/);
  for (const id of [
    'handReviewPreviousDecision', 'handReviewNextDecision',
    'handReviewChosenAction', 'handReviewComparisonBadge',
    'handReviewFrequencyRows', 'handReviewAnalyze',
    'handReviewPreviousEvent', 'handReviewNextEvent',
  ]) assert.match(html, new RegExp(`id="${id}"`), id);
  assert.match(fullHandLogic, /snapshot\.completedHandResult/);
  assert.match(logic, /decision\.replayFrameTarget\.frameIndex/);
  assert.match(logic, /\{action\} to \{amount\}/);
  assert.match(logic, /reviewActionCopy\(decision\.chosenAction, decision\)/);
  assert.match(fullHandLogic, /createFullHandAnalysisHandoff/);
  assert.match(fullHandLogic, /decisionContext: handoff\.decisionContext/);
  assert.match(fullHandLogic, /reason: 'full_hand_review_decision'/);
  assert.match(css, /\.training-full-hand-completion\s*\{[^}]*display:\s*grid/);
  assert.match(css, /\.hand-review-decision-facts[\s\S]*grid-template-columns/);
});

test('Full Hand primary labels are registered in English, Russian, and Hebrew', () => {
  for (const catalog of ['en', 'ru', 'he']) {
    const start = i18n.indexOf(`Object.assign(trainingWorkspaceTranslations.${catalog}, {`, 2100);
    assert.ok(start >= 0, catalog);
  }
  assert.match(i18n, /"Full Hand": "Full Hand"/);
  assert.match(i18n, /"Full Hand": "Полная раздача"/);
  assert.match(i18n, /"Full Hand": "יד מלאה"/);
  for (const key of [
    'Hand Complete', 'Review Hand', 'New Hand', 'Post-Hand Review',
    'Automating', 'Your turn', '{player} is thinking…', 'Dealing the flop…',
  ]) {
    assert.match(i18n, new RegExp(`"${key}"`), key);
  }
});
