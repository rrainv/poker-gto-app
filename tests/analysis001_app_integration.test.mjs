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
  assert.equal(typeof bridge.createRangeAnalysisRequest, 'function');
  assert.equal(typeof bridge.createRangeAnalysisFacts, 'function');
  assert.equal(bridge.rangeAnalysisRequestSchemaVersion, 'range-analysis-request/v1');
  assert.equal(bridge.rangeAnalysisFactsSchemaVersion, 'range-analysis-facts/v1');
  assert.equal(typeof bridge.deriveBoardTextureFacts, 'function');
  assert.ok(Object.isFrozen(bridge));

  const bridgeIndex = html.indexOf('src/application/analysis-explanation-bootstrap.mjs');
  const logicIndex = html.indexOf('src/core/logic.js');
  assert.ok(bridgeIndex >= 0);
  assert.ok(bridgeIndex < logicIndex);
});

test('Playbook replaces the legacy HTML teacher with current contracts and trusted facts', () => {
  const update = sourceBetween('async function updateContext(', '// Legacy fast evaluator retained for the existing Outs display only.');
  assert.match(update, /invalidatePlaybookDerivedSurfaces\(\)[\s\S]*renderVisiblePlaybookDerivedSurfaces\(\)/);
  assert.match(logic, /surface === 'analysis'[\s\S]*renderPlaybookDecisionAnalysis\(\s*app\.decisionContext,\s*app\.strategyResult,\s*app\.playbookResolution/);
  assert.match(logic, /trustedAnalysisFacts\(canonicalActionHistoryForAnalysis\(resolution\)\)/);
  assert.match(logic, /rangeAnalysisFactsForDecision\(decisionContext, authority, rangeInputs\)/);
  assert.match(logic, /authority = resolution\?\.mode === 'hand' \? 'hand' : 'scenario'/);
  assert.doesNotMatch(update, /generateTeacherText|teacherContent\.innerHTML/);
  assert.doesNotMatch(logic, /generateTeacherText/);
  assert.doesNotMatch(teacher, /Math\.random|\bGTO\b|\bCFR\b|equilibrium|solver says/i);
});

test('Playbook unavailable states replace stale analysis', () => {
  const unavailable = sourceBetween('function renderUnavailableStrategy(', 'async function requestPlaybookMode(');
  assert.match(unavailable, /app\.strategyResult = strategyProvider\.resolve\(null\)/);
  assert.match(unavailable, /playbookSurfaceInvalidator\.renderIfNeeded\('analysis'\)/);
  assert.match(logic, /analysisUnavailableReasonForResolution\(app\.playbookResolution\)/);
  assert.doesNotMatch(logic, /renderLoadingStrategy|strategy_loading/);
  assert.match(logic, /canonical_hero_not_actor'\) return 'hero_not_actor'/);
  assert.match(logic, /canonical_terminal_state'[\s\S]*return 'terminal_hand'/);
});

test('Hand Mode supplies canonical history while Scenario remains an authority label only', () => {
  const history = sourceBetween('function canonicalActionHistoryForAnalysis(', 'function trustedAnalysisFacts(');
  assert.match(history, /resolution\?\.mode !== 'hand'\) return \[\]/);
  assert.match(history, /callPlaybookStateBridge\('createReplayTimelineViewModel'\)/);
  assert.match(history, /timeline\.groups\.flatMap\(\(group\) => group\.entries\)\.map\(\(entry\)/);
  for (const fact of ['sequence', 'street', 'actionType', 'amountMilliBb', 'isHero', 'position']) {
    assert.match(history, new RegExp(`entry\\.${fact}`), fact);
  }
  assert.match(history, /entry\.isHero \? 'Hero' : \(entry\.position \|\| entry\.identity\)/);
  assert.doesNotMatch(history, /bridge\.getState|state\.actionHistory|record\.submittedAction/);
  assert.doesNotMatch(
    history,
    /record\.|committedMilliBb|streetContributionAfterMilliBb|currentBetAfterMilliBb|toCallBeforeMilliBb|amountToMilliBb/,
  );
  assert.doesNotMatch(history, /readPlaybookInputSnapshot|selectedValue|querySelector/);
});

test('Analysis creates canonical range facts at the visible render seam without promoting heuristic samples', () => {
  const facts = sourceBetween('function trustedAnalysisFacts(', 'function bluffAnalysisFactsForDecision(');
  assert.match(facts, /function rangeAnalysisFactsForDecision/);
  assert.match(facts, /bridge\.createRangeAnalysisRequest/);
  assert.match(facts, /bridge\.createRangeAnalysisFacts/);
  assert.match(facts, /decisionContext/);
  assert.match(facts, /ranges/);
  assert.doesNotMatch(facts, /strategyResult|handClassification|heuristic_postflop_classifier/);
  assert.doesNotMatch(facts, /originalEquity|facts\.equity|heroEquity/);
  assert.doesNotMatch(facts, /calculateEquity|simulateEquity|evaluateSeven|scoreSeven/);
  assert.doesNotMatch(logic, /trustedHandClassificationForAnalysis/);
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

test('Training verdict vocabulary follows the source claim policy', () => {
  const feedback = sourceBetween('function canonicalTrainingFeedback(', 'function trainingActionHistoryForAnalysis(');
  assert.match(feedback, /policy\.trainingSemantics === 'normative'/);
  assert.match(feedback, /evaluation\.grade === 'optimal'/);
  assert.match(feedback, /title: t\('Correct'\)/);
  assert.match(feedback, /title: t\('Acceptable'\)/);
  assert.match(feedback, /title: t\('Mistake'\)/);
  assert.match(feedback, /title: t\('Matches Riverline reference'\)/);
  assert.match(feedback, /does not prove the play is objectively wrong, and no EV loss is implied/);
  assert.doesNotMatch(feedback, /title: t\('Optimal'\)|optimal choice|\bGTO\b|\bCFR\b|equilibrium|solver says/i);
});

test('Training keeps analysis and exact strategy reference out of normal pre-answer markup', () => {
  const trainingMarkup = html.slice(html.indexOf('id="trainingMode"'), html.indexOf('id="equityMode"'));
  assert.match(trainingMarkup, /id="trainingAnalysis" class="training-shared-analysis" hidden/);
  assert.match(trainingMarkup, /id="trainingStudyHints" class="training-study-hints"[^>]*hidden/);
  assert.match(trainingMarkup, /id="trainingRevealHint"/);
  assert.doesNotMatch(trainingMarkup, /id="trainingShowSolution"|Study mode preview|Strategy preview/);
  assert.doesNotMatch(trainingMarkup, /id="trainingAnalysis"[^>]*>[\s\S]*?Strategy Mix/);
});

test('shared renderer uses one summary-first grammar with responsive facts and native detail disclosure', () => {
  assert.match(teacher, /container\.replaceChildren\(\)/);
  assert.match(teacher, /element\.textContent = analysisUiText\(text\)/);
  assert.doesNotMatch(teacher, /innerHTML|insertAdjacentHTML|document\.write/);
  for (const className of [
    'analysis-presentation', 'analysis-summary', 'analysis-hero-state', 'analysis-hero-facts',
    'analysis-board-facts',
    'analysis-economics-facts', 'analysis-context-facts', 'analysis-key-facts',
    'analysis-reasoning-blocks', 'analysis-detail-group', 'analysis-provenance',
    'training-shared-analysis',
  ]) assert.match(css, new RegExp(`\\.${className}`), className);
  assert.match(teacher, /analysisGrammar = 'summary-key-facts-reasons-details-provenance'/);
  assert.match(teacher, /analysisFactGroup\(analysisMessage\('analysis\.ui\.heroState', 'Hero state'\), 'hero'/);
  assert.match(teacher, /analysisFactGroup\(analysisMessage\('analysis\.ui\.board', 'Board'\), 'board'/);
  assert.match(teacher, /analysisFactGroup\(analysisMessage\('analysis\.ui\.decisionEconomics', 'Decision economics'\), 'economics'/);
  assert.match(teacher, /analysisFactGroup\(analysisMessage\('analysis\.ui\.context', 'Context'\), 'context'/);
  assert.match(teacher, /analysisElement\('details', 'analysis-detail-group'\)/);
  assert.match(css, /@media \(min-width: 1280px\)[\s\S]*analysis-key-facts[\s\S]*repeat\(4/);
  assert.match(css, /@media \(max-width: 1080px\)[\s\S]*analysis-key-facts[\s\S]*repeat\(2/);
});

test('primary analysis values use readable UI typography while compact cards retain data typography', () => {
  const primaryFacts = css.match(/\.analysis-key-fact dd \{[^}]+\}/)?.[0] || '';
  assert.match(primaryFacts, /font-family: var\(--font-ui\)/);
  assert.doesNotMatch(primaryFacts, /font-family: var\(--font-data\)/);
  assert.match(css, /\.analysis-card-token \{[^}]*font-family: var\(--font-data\)/);
  assert.match(teacher, /analysisFactPrimaryText/);
  assert.match(teacher, /case 'made_hand': return analysisConceptText\(values\.madeHand/);
  assert.match(teacher, /OESD: 'analysis\.value\.openEndedDraw'/);
});

test('Hero state makes trusted made-hand, draw, and board facts primary without deriving poker facts', () => {
  assert.match(teacher, /hero: new Set\(\['hero_cards', 'preflop_hand_class', 'made_hand', 'hand_components', 'draws', 'draw_outs', 'hero_overcards'\]\)/);
  assert.match(teacher, /board: new Set\(\['board_pairing', 'board_suits', 'board_connectivity', 'board_broadway_count', 'board_flush_state', 'board_straight_state'\]\)/);
  assert.match(teacher, /const heroRegion = analysisHeroState\(explanation\)/);
  assert.match(teacher, /surface === 'training'[\s\S]*\? \['bluff_pressure', 'range'\][\s\S]*: \['bluff_pressure', 'blockers', 'range'\]/);
  assert.match(teacher, /analysisFactSourcesElement/);
  assert.match(css, /\.analysis-hero-state \{[^}]*border-inline-start: 4px solid var\(--accent-primary\)/);
  assert.doesNotMatch(teacher, /evaluatePostflopHand|deriveBoardTextureFacts|scoreSeven|calculateEquity/);
});

test('economics, reasons, and context retain distinct descending presentation priority', () => {
  assert.doesNotMatch(teacher.match(/economics: new Set\(([^\n]+)/)?.[1] || '', /hero_position|table_size/);
  assert.match(teacher, /context: new Set\(\['hero_position', 'postflop_position_relation', 'heuristic_opponent_count'/);
  const availableRender = teacher.slice(teacher.indexOf('const strategy ='), teacher.indexOf('const selectedKeys'));
  assert.ok(availableRender.indexOf('analysis-reasoning-blocks') < availableRender.indexOf("analysis.ui.context"));
  assert.match(css, /\.analysis-economics-facts \{[^}]*border-inline-start: 3px solid var\(--accent-secondary\)/);
  assert.match(css, /\.analysis-context-facts \{[^}]*background:/);
});

test('expanded Playbook analysis owns the full Decision-grid row at desktop widths', () => {
  assert.match(html, /class="teacher-panel"/);
  const desktopGrid = css.slice(css.indexOf('@media (min-width: 1200px)'));
  assert.match(desktopGrid, /\.playbook-primary-decision \{[\s\S]*display: grid/);
  assert.match(desktopGrid, /\.playbook-primary-decision \.teacher-panel \{[\s\S]*grid-column: 1 \/ -1;[\s\S]*grid-row: 3/);
  assert.match(css, /\.teacher-panel,[\s\S]*\.teacher-panel #teacherContent \{ width: 100%; min-width: 0; \}/);
});

test('unavailable analysis remains compact while retaining only useful facts and provenance', () => {
  assert.match(teacher, /explanation\.availability === 'unavailable'/);
  assert.match(teacher, /article\.classList\.add\('is-unavailable'\)/);
  assert.match(teacher, /analysis-unavailable-note/);
  assert.doesNotMatch(teacher.slice(teacher.indexOf("explanation.availability === 'unavailable'"), teacher.indexOf('const strategy =')), /analysis-detail-group/);
});

test('Study hints consume AnalysisExplanation facts without exposing strategy result probabilities', () => {
  const hints = sourceBetween('function resetTrainingStudyHints(', 'function showTrainingFeedback(');
  const exercise = sourceBetween('function renderCanonicalTrainingExercise(', 'async function newRandomTrainingHand(');
  assert.match(hints, /bridge\.create\(/);
  assert.match(hints, /renderAnalysisStudyHints/);
  assert.match(hints, /app\.training\.studyHintStep = Math\.min\(3/);
  assert.doesNotMatch(hints, /currentSolution|showTrainingSolution|chosenProbability|bestProbability|recommendation|probability/);
  assert.match(exercise, /resetTrainingStudyHints\(exercise\)/);
  assert.doesNotMatch(exercise, /showTrainingSolution/);
  assert.match(logic, /resetTrainingStudyHints\(\);[\s\S]*showTrainingFeedback/);
});

test('Study hints coach one step at a time and omit implementation-oriented safeguard copy', () => {
  const hintRenderer = teacher.slice(teacher.indexOf('function studyHintDefinition('), teacher.indexOf('function analysisProvenanceLabel('));
  assert.match(hintRenderer, /What made hand does Hero have here\?/);
  assert.match(hintRenderer, /How much are you being asked to call relative to the pot\?/);
  assert.match(hintRenderer, /How should the board texture and number of opponents affect/);
  assert.match(hintRenderer, /const hint = studyHintDefinition\(explanation, currentStep, options\)/);
  assert.match(logic, /street: exercise\.decisionContext\.street/);
  assert.doesNotMatch(hintRenderer, /slice\(0, step\)|strategy_mix|actionAnalysis|recommendation|probability/);
  assert.match(logic, /button\.textContent = t\('Get a hint'\)/);
  assert.match(logic, /t\(complete \? 'All hints viewed' : 'Another hint'\)/);
  assert.doesNotMatch(html, /Hints never reveal|never reveal the answer|assistance does not change grading/i);
  assert.match(html, /Get a nudge about the spot\./);
});

test('Playbook and Training compose the same renderer without a second strategy visualization', () => {
  const playbook = sourceBetween('function renderPlaybookDecisionAnalysis(', 'function renderPlaybookTableProjection(');
  const training = sourceBetween('function renderTrainingDecisionAnalysis(', 'function handleTrainingGuess(');
  const trainingMarkup = html.slice(html.indexOf('id="trainingMode"'), html.indexOf('id="equityMode"'));
  assert.match(playbook, /surface: 'playbook'/);
  assert.match(training, /surface: 'training'/);
  assert.match(teacher, /analysisSection\.key === 'strategy_mix'\) return/);
  assert.doesNotMatch(teacher, /renderFrequencyStack|frequency-stack|training-frequency-row/);
  assert.match(trainingMarkup, /class="training-verdict-facts"/);
  assert.match(trainingMarkup, /id="trainingAnalysisTitle"[^>]*>Explain/);
  assert.doesNotMatch(trainingMarkup, /class="training-feedback-facts"/);
  assert.match(trainingMarkup, /class="training-verdict-frequency" hidden><dt[^>]*>Chosen frequency/);
  assert.ok(trainingMarkup.indexOf('id="trainingSolution"') < trainingMarkup.indexOf('training-history-panel'));
});

test('ANALYSIS-001 changes do not touch protected poker, Equity, grading, or solver implementations', () => {
  const service = fs.readFileSync(new URL('../app/src/application/analysis-explanation.mjs', import.meta.url), 'utf8');
  assert.doesNotMatch(service, /applyAction|legalActions|calculateEquity|simulateEquity|scoreFive|evaluateSeven|TrainingAnswerEvaluation/);
  assert.doesNotMatch(teacher, /DecisionContext|StrategyResult|calculateEquity|applyAction|grade/);
});
