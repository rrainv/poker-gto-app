import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const html = fs.readFileSync(new URL('../app/index.html', import.meta.url), 'utf8');
const logic = fs.readFileSync(new URL('../app/src/core/logic.js', import.meta.url), 'utf8');
const css = fs.readFileSync(new URL('../app/styles.css', import.meta.url), 'utf8');
const i18n = fs.readFileSync(new URL('../app/src/locales/i18n.js', import.meta.url), 'utf8');
const trainingMarkup = html.slice(html.indexOf('id="trainingMode"'), html.indexOf('<!-- Equity workspace -->'));
const ticketCss = css.slice(css.indexOf('TRAINING-COMPOSITION-001'));

function sourceBetween(start, end) {
  return logic.slice(logic.indexOf(start), logic.indexOf(end));
}

test('Training exposes one selected-configuration start action and retains a guarded lifecycle', () => {
  assert.equal((trainingMarkup.match(/id="trainingNewHand"/g) || []).length, 1);
  assert.equal((trainingMarkup.match(/data-i18n="Start Training"/g) || []).length, 1);
  assert.doesNotMatch(trainingMarkup, /id="trainingIdleStart"/);
  assert.doesNotMatch(trainingMarkup, /id="trainingNewHand"[^>]*data-i18n="(?:Generate exercise|Start varied session)"/);
  assert.match(logic, /bind\('#trainingNewHand', 'click', \(\) => startConfiguredTrainingSessionWithGuard\(\)\)/);
  assert.match(sourceBetween('function startConfiguredTrainingSessionWithGuard(', 'async function startConfiguredTrainingSession('), /trainingSessionIsActive\(\)[\s\S]*window\.confirm/);
  assert.match(sourceBetween('function requestTrainingSessionModeChange(', 'function openTrainingMemoryView('), /trainingSessionIsActive\(\)[\s\S]*window\.confirm[\s\S]*setTrainingSessionMode/);
});

test('one stable decision and study-rail skeleton owns ready and feedback states', () => {
  assert.match(trainingMarkup, /<main class="training-decision-column">/);
  assert.match(trainingMarkup, /<aside class="training-insight-column">/);
  assert.ok(trainingMarkup.indexOf('id="trainingExerciseSurface"') < trainingMarkup.indexOf('id="trainingFeedback"'));
  assert.match(sourceBetween('function composeTrainingWorkspace(', 'function selectedTrainingControlLabel('), /classList\.add\('training-study-rail'\)/);
  assert.match(ticketCss, /grid-template-columns:\s*minmax\(0, 1fr\) minmax\(320px, 360px\)/);
  assert.doesNotMatch(ticketCss, /data-training-state="feedback"[^}]*grid-template-(?:columns|areas)/);
});

test('setup is a single disclosure that compacts on start and Adjust Drill reopens', () => {
  assert.equal((trainingMarkup.match(/id="trainingSetupPanel"/g) || []).length, 1);
  assert.match(trainingMarkup, /<details id="trainingSetupPanel"[^>]*open>/);
  assert.match(trainingMarkup, /class="training-setup-summary"/);
  assert.match(logic, /async function startConfiguredTrainingSession[\s\S]*setTrainingSetupExpanded\(false\)/);
  assert.match(sourceBetween("bind('#trainingAdjustDrill'", "bind('#trainingRevealHint'"), /setTrainingSetupExpanded\(true, \{ focus: true \}\)/);
  assert.match(logic, /setTrainingWorkspaceState\('idle'\);[\s\S]*setTrainingSetupExpanded\(true\)/);
});

test('answer feedback stays compact and deep analysis is progressive disclosure', () => {
  assert.match(trainingMarkup, /class="training-verdict"[^>]*role="status"[^>]*aria-live="polite"[^>]*aria-atomic="true"/);
  assert.doesNotMatch(trainingMarkup, /id="trainingFeedback"[^>]*role="status"/);
  assert.match(trainingMarkup, /data-i18n="Facts">Facts/);
  assert.match(trainingMarkup, /<details class="training-analysis-region"[^>]*><summary id="trainingAnalysisTitle"[^>]*>Explain/);
  assert.match(trainingMarkup, /id="trainingFeedbackReferenceMount"/);
  assert.match(sourceBetween('function composeTrainingWorkspace(', 'function selectedTrainingControlLabel('), /feedbackReferenceMount\.append\(solution\)/);
  assert.match(logic, /trainingAnalysisTitle'\)\?\.closest\('details'\)\?\.removeAttribute\('open'\)/);
  assert.match(ticketCss, /training-analysis-region\[open\] #trainingAnalysis[^}]*max-block-size:[^}]*overflow:\s*auto/s);
  assert.doesNotMatch(trainingMarkup, />Coach</);
});

test('current-session progress and restrained source truth remain visible in the rail', () => {
  assert.match(trainingMarkup, /id="trainingSessionProgress"[^>]*aria-live="polite"/);
  assert.match(logic, /Exercise \{current\} of \{total\}/);
  assert.match(trainingMarkup, /id="trainingReferenceSummary"/);
  assert.match(logic, /strategyPolicySummary\(policy\)/);
  assert.match(logic, /referenceValue\.dataset\.sourceFamily = policy\.source\.family/);
  assert.match(trainingMarkup, /Reference-aligned/);
  assert.doesNotMatch(trainingMarkup, />Accuracy</);
  assert.match(ticketCss, /training-session-panel \.training-stat-grid[^}]*repeat\(2,/s);
});

test('Memory, History, and Assistance are bounded study tools near the exercise', () => {
  const composition = sourceBetween('function composeTrainingWorkspace(', 'function selectedTrainingControlLabel(');
  const expectedOrder = [
    "$('#trainingSetupPanel')",
    "document.querySelector('.training-session-panel')",
    "$('#trainingReferenceSummary')",
    "$('#trainingHistoryPanel')",
    "document.querySelector('.training-assistance-panel')",
    "$('#trainingMemoryPanel')",
  ];
  assert.ok(expectedOrder.every((entry, index) => index === 0 || composition.indexOf(entry) > composition.indexOf(expectedOrder[index - 1])));
  assert.match(trainingMarkup, /id="trainingMemoryPanel"[^>]*data-training-availability="ready-to-load"/);
  assert.match(logic, /if \(event\.currentTarget\.open\) void refreshTrainingMemoryPanel\(\)/);
  assert.match(ticketCss, /training-memory-panel \.panel-body[^}]*max-block-size:[^}]*overflow:\s*auto/s);
  assert.match(trainingMarkup, /id="trainingAssistanceLevel"[^>]*class="badge/);
});

test('completion routes to existing longitudinal views without inventing mastery', () => {
  assert.match(trainingMarkup, /id="trainingCompletionReview"[^>]*>Review due items/);
  assert.match(trainingMarkup, /id="trainingCompletionRecent"[^>]*>Recent sessions/);
  assert.match(trainingMarkup, /id="trainingRestartSession"[^>]*>Start another session/);
  assert.match(logic, /trainingCompletionReview'[\s\S]*openTrainingMemoryView\('review'\)/);
  assert.match(logic, /trainingCompletionRecent'[\s\S]*openTrainingMemoryView\('recent'\)/);
  assert.doesNotMatch(trainingMarkup, /mastery|mastered/i);
});

test('Focused and Full Hand retain their canonical controls within the shared composition', () => {
  assert.match(trainingMarkup, /data-training-session-mode="varied"/);
  assert.match(trainingMarkup, /data-training-session-mode="focused"/);
  assert.match(trainingMarkup, /data-training-session-mode="full_hand"/);
  assert.match(logic, /mode === 'focused'[\s\S]*trainingDecisionTarget/);
  assert.match(logic, /trainingSessionMode\(\) === 'full_hand' \? '#trainingHeroPos'/);
  assert.match(trainingMarkup, /id="trainingFullHandTableMount"/);
  assert.match(trainingMarkup, /id="trainingFullHandTimeline"/);
  assert.match(ticketCss, /training-workspace\[data-training-full-hand-phase="live"\]/);
});

test('new composition copy is complete for English, Russian, and Hebrew', () => {
  for (const key of [
    'Choose a mode in Session setup, then start Training.',
    'Facts',
    'Explain',
    'Review due items',
    'Start another session',
    'Reference source',
    'Session setup',
    'Session and study tools',
    'Exercise {current} of {total}',
  ]) {
    assert.ok((i18n.match(new RegExp(`"${key.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&')}"`, 'g')) || []).length >= 3, `${key} is registered in EN/RU/HE`);
  }
  assert.match(ticketCss, /min-inline-size/);
  assert.doesNotMatch(ticketCss, /margin-left|margin-right|padding-left|padding-right|\bleft\s*:|\bright\s*:/);
});

test('keyboard answers, disclosures, focus, and reduced motion remain explicit', () => {
  assert.match(trainingMarkup, /id="trainingNextHandBtn"[^>]*aria-keyshortcuts="Enter"/);
  assert.match(logic, /handleTrainingKeyboardShortcut/);
  assert.match(trainingMarkup, /id="trainingHistoryPanel"[^>]*>\s*<summary/);
  assert.match(trainingMarkup, /id="trainingMemoryPanel"[^>]*>\s*<summary/);
  assert.match(ticketCss, /cursor:\s*pointer/);
  assert.match(css, /prefers-reduced-motion:\s*reduce/);
  assert.match(logic, /focus\(\{ preventScroll: false \}\)/);
});
