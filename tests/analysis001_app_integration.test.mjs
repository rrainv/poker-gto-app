import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import { installAnalysisExplanationBridge } from '../app/src/application/analysis-explanation-bootstrap.mjs';

const logic = fs.readFileSync(new URL('../app/src/core/logic.js', import.meta.url), 'utf8');
const teacher = fs.readFileSync(new URL('../app/src/ui/teacher.js', import.meta.url), 'utf8');
const html = fs.readFileSync(new URL('../app/index.html', import.meta.url), 'utf8');
const css = fs.readFileSync(new URL('../app/styles.css', import.meta.url), 'utf8');

function sourceBetween(start, end) {
  const from = logic.indexOf(start);
  const to = logic.indexOf(end, from);
  assert.ok(from >= 0, start);
  assert.ok(to > from, end);
  return logic.slice(from, to);
}

test('browser bridge exposes only the immutable local explanation operations before classic logic', () => {
  const browserWindow = {};
  const bridge = installAnalysisExplanationBridge(browserWindow);
  assert.equal(browserWindow.RiverlineAnalysisExplanation, bridge);
  assert.equal(bridge.schemaVersion, 'analysis-explanation/v1');
  assert.equal(typeof bridge.create, 'function');
  assert.equal(typeof bridge.deriveBoardTextureFacts, 'function');
  assert.ok(Object.isFrozen(bridge));

  const bridgeIndex = html.indexOf('src/application/analysis-explanation-bootstrap.mjs');
  const logicIndex = html.indexOf('src/core/logic.js');
  assert.ok(bridgeIndex >= 0);
  assert.ok(bridgeIndex < logicIndex);
});

test('Playbook replaces the legacy HTML teacher with current contracts and trusted facts', () => {
  const update = sourceBetween('async function updateContext(', '// Legacy fast evaluator retained for the existing Outs display only.');
  assert.match(update, /typeof renderPlaybookDecisionAnalysis === 'function'[\s\S]*renderPlaybookDecisionAnalysis\(decisionContext, strategyResult, playbookResolution\)/);
  assert.match(logic, /trustedAnalysisFacts\(\s*decisionContext,\s*result,\s*canonicalActionHistoryForAnalysis\(resolution\)/);
  assert.match(logic, /authority = resolution\?\.mode === 'hand' \? 'hand' : 'scenario'/);
  assert.doesNotMatch(update, /generateTeacherText|teacherContent\.innerHTML/);
  assert.doesNotMatch(logic, /generateTeacherText/);
  assert.doesNotMatch(teacher, /Math\.random|\bGTO\b|\bCFR\b|equilibrium|solver says/i);
});

test('Playbook unavailable states replace stale analysis', () => {
  const unavailable = sourceBetween('function renderUnavailableStrategy(', 'async function requestPlaybookMode(');
  assert.match(unavailable, /renderPlaybookDecisionAnalysis[\s\S]*analysisUnavailableReasonForResolution/);
  assert.doesNotMatch(logic, /renderLoadingStrategy|strategy_loading/);
  assert.match(logic, /canonical_hero_not_actor'\) return 'hero_not_actor'/);
  assert.match(logic, /canonical_terminal_state'[\s\S]*return 'terminal_hand'/);
});

test('Hand Mode supplies canonical history while Scenario remains an authority label only', () => {
  const history = sourceBetween('function canonicalActionHistoryForAnalysis(', 'function trustedAnalysisFacts(');
  assert.match(history, /resolution\?\.mode !== 'hand'\) return \[\]/);
  assert.match(history, /bridge\.getState/);
  assert.match(history, /state\.actionHistory\.map/);
  assert.match(history, /record\.submittedAction/);
  assert.match(history, /amountToMilliBb/);
  assert.doesNotMatch(history, /readPlaybookInputSnapshot|selectedValue|querySelector/);
});

test('trusted analysis adapter reuses classification without promoting heuristic samples to canonical Equity', () => {
  const hand = sourceBetween('function trustedHandClassificationForAnalysis(', 'function canonicalActionHistoryForAnalysis(');
  const facts = sourceBetween('function trustedAnalysisFacts(', 'function renderDecisionAnalysis(');
  assert.match(hand, /evaluatePostflopHand\(decisionContext\.heroCards, decisionContext\.board\)/);
  assert.match(hand, /source: 'legacy_postflop_classifier'/);
  assert.doesNotMatch(facts, /originalEquity|facts\.equity|heroEquity/);
  assert.doesNotMatch(facts, /calculateEquity|simulateEquity|evaluateSeven|scoreSeven/);
});

test('Training calls the same service only after answer and retains the grade wrapper', () => {
  const exerciseRender = sourceBetween('function renderCanonicalTrainingExercise(', 'async function newRandomTrainingHand(');
  const answer = sourceBetween('function handleTrainingGuess(', 'function replayTrainingExercise(');
  const analysis = sourceBetween('function renderTrainingDecisionAnalysis(', 'function handleTrainingGuess(');
  assert.match(exerciseRender, /trainingAnalysis\.replaceChildren\(\)/);
  assert.match(exerciseRender, /trainingAnalysis\.hidden = true/);
  assert.doesNotMatch(exerciseRender, /renderTrainingDecisionAnalysis/);
  assert.match(answer, /renderTrainingDecisionAnalysis\(exercise\)/);
  assert.match(analysis, /renderDecisionAnalysis\(container/);
  assert.match(analysis, /authority: 'training'/);
  assert.match(analysis, /depth: 'concise'/);
  assert.match(answer, /evaluation\.grade/);
  assert.match(answer, /showTrainingFeedback/);
});

test('Training heuristic grade copy is explicitly bounded to the current estimate', () => {
  const feedback = sourceBetween('function canonicalTrainingFeedback(', 'function trainingActionHistoryForAnalysis(');
  assert.match(feedback, /Within the current strategy estimate/);
  assert.match(feedback, /title: 'Optimal'/);
  assert.match(feedback, /title: 'Acceptable'/);
  assert.match(feedback, /title: 'Mistake'/);
  assert.doesNotMatch(feedback, /\bGTO\b|\bCFR\b|equilibrium|solver says/i);
});

test('Training markup exposes no shared strategy explanation before its hidden post-answer container', () => {
  const trainingMarkup = html.slice(html.indexOf('id="trainingMode"'), html.indexOf('id="equityMode"'));
  assert.match(trainingMarkup, /id="trainingAnalysis" class="training-shared-analysis" hidden/);
  assert.match(trainingMarkup, /id="trainingShowSolution"/);
  assert.doesNotMatch(trainingMarkup, /id="trainingAnalysis"[^>]*>[\s\S]*?Strategy Mix/);
});

test('shared renderer uses text nodes and the UI has responsive structured hierarchy', () => {
  assert.match(teacher, /container\.replaceChildren\(\)/);
  assert.match(teacher, /element\.textContent = analysisUiText\(text\)/);
  assert.doesNotMatch(teacher, /innerHTML|insertAdjacentHTML|document\.write/);
  for (const className of [
    'analysis-explanation', 'analysis-explanation-sections', 'analysis-explanation-facts',
    'analysis-explanation-limitations', 'training-shared-analysis',
  ]) assert.match(css, new RegExp(`\\.${className}`), className);
  assert.match(css, /training-shared-analysis[\s\S]*repeat\(auto-fit, minmax\(min\(240px, 100%\), 1fr\)\)/);
});

test('ANALYSIS-001 changes do not touch protected poker, Equity, grading, or solver implementations', () => {
  const service = fs.readFileSync(new URL('../app/src/application/analysis-explanation.mjs', import.meta.url), 'utf8');
  assert.doesNotMatch(service, /applyAction|legalActions|calculateEquity|simulateEquity|scoreFive|evaluateSeven|TrainingAnswerEvaluation/);
  assert.doesNotMatch(teacher, /DecisionContext|StrategyResult|calculateEquity|applyAction|grade/);
});
