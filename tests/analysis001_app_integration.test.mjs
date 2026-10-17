import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import { appStyleSheet, bootApp, indexDocument, precedes, text } from './helpers/app-under-test.mjs';

// TEST-HYGIENE-001: index.html / styles.css / logic.js assertions are
// behavioural: Playbook and Training analysis, unavailable states, hints and
// the shared renderer are exercised in the booted app (spying on the page's
// own functions); markup is parsed and styling resolved through the cascade.
// teacher.js and service sources are outside this ticket.
const teacher = fs.readFileSync(new URL('../app/src/ui/teacher.js', import.meta.url), 'utf8');
const markup = indexDocument();
const css = appStyleSheet();
const app = await bootApp();
// Imported after boot: the bootstrap module installs the page's bridge on load.
const { installAnalysisExplanationBridge } = await import('../app/src/application/analysis-explanation-bootstrap.mjs');
const training = markup.getElementById('trainingMode');
function probe(html, parent = markup.body) {
  const host = markup.createElement('div');
  host.innerHTML = html;
  parent.appendChild(host);
  return host.firstElementChild;
}
async function openAnalysis() {
  if (app.byId('toggleTeacher').getAttribute('aria-expanded') !== 'true') await app.click('#toggleTeacher');
}
async function closeAnalysis() {
  if (app.byId('toggleTeacher').getAttribute('aria-expanded') === 'true') await app.click('#toggleTeacher');
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

  const scripts = markup.querySelectorAll('script[src]');
  const bridgeScript = scripts.find((script) => script.getAttribute('src').endsWith('src/application/analysis-explanation-bootstrap.mjs'));
  const logicScript = scripts.find((script) => script.getAttribute('src').split('?')[0] === 'src/core/logic.js');
  assert.ok(bridgeScript && logicScript && precedes(bridgeScript, logicScript));
});

test('Playbook replaces the legacy HTML teacher with current contracts and trusted facts', async () => {
  await app.navigate('analyze');
  await app.pickCards('#gtoMode [data-card-set-edit="hero"]', ['As', 'Kd']);
  await openAnalysis();
  const spy = app.spy(['invalidatePlaybookDerivedSurfaces', 'renderVisiblePlaybookDerivedSurfaces', 'renderPlaybookDecisionAnalysis', 'trustedAnalysisFacts', 'canonicalActionHistoryForAnalysis', 'rangeAnalysisFactsForDecision', 'renderDecisionAnalysis']);
  try {
    await app.call('updateContext', 'test');
    assert.ok(spy.sequence.indexOf('invalidatePlaybookDerivedSurfaces') < spy.sequence.indexOf('renderVisiblePlaybookDerivedSurfaces'));
    const [context, result, resolution] = spy.calls.renderPlaybookDecisionAnalysis.at(-1);
    assert.equal(context, app.window.app.decisionContext);
    assert.equal(result, app.window.app.strategyResult);
    assert.equal(resolution, app.window.app.playbookResolution);
    assert.ok(spy.count('canonicalActionHistoryForAnalysis') >= 1 && spy.count('trustedAnalysisFacts') >= 1);
    const [, authority] = spy.calls.rangeAnalysisFactsForDecision.at(-1);
    assert.equal(authority, 'scenario');
    const [, options] = spy.calls.renderDecisionAnalysis.at(-1);
    assert.equal(options.authority, 'scenario');
    assert.equal(options.surface, 'playbook');
  } finally {
    spy.restore();
  }
  // In Hand mode the authority is the canonical hand. (Hand exposes no
  // Analysis toggle; the panel's open state carries over from Analyze.)
  await closeAnalysis();
  await app.startHand(['As', 'Kd']);
  const hand = app.spy(['rangeAnalysisFactsForDecision']);
  try {
    app.call('renderPlaybookDecisionAnalysis', app.window.app.decisionContext, app.window.app.strategyResult, app.window.app.playbookResolution);
    assert.ok(hand.count('rangeAnalysisFactsForDecision') >= 1, 'Hand analysis derives range facts');
    assert.equal(hand.calls.rangeAnalysisFactsForDecision.at(-1)[1], 'hand');
  } finally {
    hand.restore();
  }
  assert.equal(app.evaluate('typeof generateTeacherText'), 'undefined');
  assert.doesNotMatch(teacher, /Math\.random|\bGTO\b|\bCFR\b|equilibrium|solver says/i);
});

test('Playbook unavailable states replace stale analysis', async () => {
  // A finished hand has no decision: stale analysis is cleared and the
  // reason rendered, without resolving a strategy.
  // The Analysis panel is opened where its toggle is shown (Analyze); its
  // open state carries into Hand.
  await app.navigate('analyze');
  await openAnalysis();
  await app.startHand(['As', 'Kd']);
  const spy = app.spy(['renderUnavailableStrategy', 'analysisUnavailableReasonForResolution', 'renderDecisionAnalysis']);
  try {
    await app.handAction('fold');
    await app.settle(300);
    assert.ok(spy.count('renderUnavailableStrategy') >= 1);
    assert.equal(app.window.app.decisionContext, null);
    assert.equal(app.window.app.strategyResult, null);
    assert.ok(spy.calls.analysisUnavailableReasonForResolution.some(([resolution]) => resolution === app.window.app.playbookResolution));
    const unavailable = spy.calls.renderDecisionAnalysis.at(-1)?.[1];
    assert.ok(unavailable, 'the terminal hand renders the unavailable analysis');
    assert.equal(unavailable.unavailableReason, 'terminal_hand');
  } finally {
    spy.restore();
  }
  await app.navigate('analyze');
  await closeAnalysis();
  for (const [reason, expected] of [
    ['canonical_hero_cards_unknown', 'missing_hero_cards'], ['canonical_hero_not_actor', 'hero_not_actor'],
    ['canonical_chance_state', 'waiting_for_board'], ['canonical_terminal_state', 'terminal_hand'],
    ['canonical_showdown_state', 'terminal_hand'],
  ]) assert.equal(app.call('analysisUnavailableReasonForResolution', { reason }), expected, reason);
  for (const name of ['renderLoadingStrategy']) assert.equal(app.evaluate(`typeof ${name}`), 'undefined', name);
});

test('Hand Mode supplies canonical history while Scenario remains an authority label only', async () => {
  assert.deepEqual(app.call('canonicalActionHistoryForAnalysis', { mode: 'scenario' }), []);
  await app.startHand(['As', 'Kd']);
  await app.click(app.$('[data-canonical-action="call"]:not([disabled])') || app.$('[data-canonical-action="check"]:not([disabled])'));
  await app.settle(300);
  const history = app.call('canonicalActionHistoryForAnalysis', { mode: 'hand' });
  // Built from the canonical Replay timeline entries, in order.
  const timeline = app.call('callPlaybookStateBridge', 'createReplayTimelineViewModel');
  const entries = timeline.groups.flatMap((group) => group.entries);
  assert.equal(history.length, entries.length);
  history.forEach((entry, index) => {
    const source = entries[index];
    assert.equal(entry.sequence, source.sequence);
    assert.equal(entry.street, source.street);
    assert.equal(entry.actionType, source.actionType);
    assert.equal(entry.isHero, source.isHero);
    assert.equal(entry.position, source.position);
    assert.equal(entry.amountBb, Number.isSafeInteger(source.amountMilliBb) ? source.amountMilliBb / 1000 : null);
    assert.equal(entry.actorLabel, source.isHero ? 'Hero' : (source.position || source.identity));
  });
  const keys = new Set(history.flatMap((entry) => Object.keys(entry)));
  for (const forbidden of ['committedMilliBb', 'streetContributionAfterMilliBb', 'currentBetAfterMilliBb', 'toCallBeforeMilliBb', 'amountToMilliBb', 'submittedAction']) {
    assert.equal(keys.has(forbidden), false, forbidden);
  }
});

test('Analysis creates canonical range facts at the visible render seam without promoting heuristic samples', async () => {
  await app.navigate('analyze');
  await app.pickCards('#gtoMode [data-card-set-edit="hero"]', ['As', 'Kd']);
  const context = app.window.app.decisionContext;
  const facts = app.call('rangeAnalysisFactsForDecision', context, 'scenario');
  assert.equal(facts.schemaVersion, app.window.RiverlineAnalysisExplanation.rangeAnalysisFactsSchemaVersion);
  // Facts come from the DecisionContext alone: the same with a different strategy.
  app.evaluate('rangeAnalysisMemo = null');
  assert.deepEqual(JSON.parse(JSON.stringify(app.call('rangeAnalysisFactsForDecision', context, 'scenario'))), JSON.parse(JSON.stringify(facts)));
  assert.doesNotMatch(JSON.stringify(facts), /originalEquity|heroEquity|heuristic_postflop_classifier/);
  assert.equal(app.evaluate('typeof trustedHandClassificationForAnalysis'), 'undefined');
  for (const name of ['simulateEquity', 'evaluateSeven', 'scoreSeven']) assert.equal(app.evaluate(`typeof ${name}`), 'undefined', name);
});

test('Training calls the same service only after answer and retains the grade wrapper', async () => {
  const spy = app.spy(['renderTrainingDecisionAnalysis', 'renderDecisionAnalysis', 'showTrainingFeedback']);
  try {
    await app.training.start('focused');
    // A new exercise clears and hides the analysis without rendering it.
    assert.equal(app.byId('trainingAnalysis').hidden, true);
    assert.equal(app.byId('trainingAnalysis').childElementCount, 0);
    assert.equal(spy.count('renderTrainingDecisionAnalysis'), 0);
    await app.training.answer();
    assert.deepEqual(spy.calls.renderTrainingDecisionAnalysis.map(([exercise]) => exercise), [app.window.app.training.currentExercise]);
    const [container, options] = spy.calls.renderDecisionAnalysis.at(-1);
    assert.equal(container, app.byId('trainingAnalysis'));
    assert.equal(options.authority, 'training');
    assert.equal(options.depth, 'concise');
    assert.equal(options.surface, 'training');
    assert.equal(spy.count('showTrainingFeedback'), 1);
    assert.ok(app.byId('trainingFeedback').dataset.grade, 'the grade wrapper is kept');
  } finally {
    spy.restore();
  }
});

test('Training verdict vocabulary follows the source claim policy', async () => {
  await app.training.next();
  const spy = app.spy(['truthPresentation', 'trainingTruth', 'canonicalTrainingFeedback']);
  let feedback;
  try {
    await app.training.answer();
    assert.ok(spy.count('canonicalTrainingFeedback') >= 1);
    assert.ok(spy.count('trainingTruth') >= 1 && spy.count('truthPresentation') >= 1);
    const evaluation = spy.calls.trainingTruth.at(-1)[0];
    feedback = app.call('canonicalTrainingFeedback', evaluation);
  } finally {
    spy.restore();
  }
  // The verdict title and text come from the claim-policy presentation and
  // never claim optimality or solver authority.
  assert.ok(feedback?.title);
  for (const copy of [feedback.title, feedback.text]) {
    assert.doesNotMatch(copy, /\bOptimal\b|optimal choice|\bGTO\b|\bCFR\b|equilibrium|solver says/i);
  }
  assert.ok(text(app.byId('trainingFeedback')).startsWith(feedback.title));
});

test('Training keeps analysis and exact strategy reference out of normal pre-answer markup', () => {
  const analysis = training.querySelector('#trainingAnalysis');
  assert.equal(analysis.className, 'training-shared-analysis');
  assert.equal(analysis.hidden, true);
  const hints = training.querySelector('#trainingStudyHints');
  assert.ok(hints.classList.contains('training-study-hints'));
  assert.equal(hints.hidden, true);
  assert.ok(training.querySelector('#trainingRevealHint'));
  assert.equal(training.querySelector('#trainingShowSolution'), null);
  assert.doesNotMatch(text(training), /Study mode preview|Strategy preview/);
  assert.doesNotMatch(text(analysis), /Strategy Mix/);
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
  ]) assert.ok(css.rulesMentioning(`.${className}`).length > 0, className);
  assert.match(teacher, /analysisGrammar = 'summary-key-facts-reasons-details-provenance'/);
  assert.match(teacher, /analysisFactGroup\(analysisMessage\('analysis\.ui\.heroState', 'Hero state'\), 'hero'/);
  assert.match(teacher, /analysisFactGroup\(analysisMessage\('analysis\.ui\.board', 'Board'\), 'board'/);
  assert.match(teacher, /analysisFactGroup\(analysisMessage\('analysis\.ui\.decisionEconomics', 'Decision economics'\), 'economics'/);
  assert.match(teacher, /analysisFactGroup\(analysisMessage\('analysis\.ui\.context', 'Context'\), 'context'/);
  assert.match(teacher, /analysisElement\('details', 'analysis-detail-group'\)/);
  const keyFacts = probe('<dl class="analysis-key-facts"></dl>', probe('<article class="analysis-presentation"></article>'));
  assert.match(css.cascaded(keyFacts, 'grid-template-columns', { width: 1440 }) || '', /^repeat\(4/);
  assert.match(css.cascaded(keyFacts, 'grid-template-columns', { width: 1000 }) || '', /^repeat\(2/);
});

test('primary analysis values use readable UI typography while compact cards retain data typography', () => {
  const fact = probe('<div class="analysis-key-fact"><dt>Hand</dt><dd>AKo</dd></div>');
  assert.equal(css.cascaded(fact.querySelector('dd'), 'font-family'), 'var(--font-ui)');
  assert.equal(css.cascaded(probe('<span class="analysis-card-token"></span>'), 'font-family'), 'var(--font-data)');
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
  assert.equal(css.cascaded(probe('<section class="analysis-hero-state"></section>'), 'border-inline-start'), '4px solid var(--accent-primary)');
  assert.doesNotMatch(teacher, /evaluatePostflopHand|deriveBoardTextureFacts|scoreSeven|calculateEquity/);
});

test('economics, reasons, and context retain distinct descending presentation priority', () => {
  assert.doesNotMatch(teacher.match(/economics: new Set\(([^\n]+)/)?.[1] || '', /hero_position|table_size/);
  assert.match(teacher, /context: new Set\(\['hero_position', 'postflop_position_relation', 'heuristic_opponent_count'/);
  const availableRender = teacher.slice(teacher.indexOf('const strategy ='), teacher.indexOf('const selectedKeys'));
  assert.ok(availableRender.indexOf('analysis-reasoning-blocks') < availableRender.indexOf("analysis.ui.context"));
  assert.equal(css.cascaded(probe('<section class="analysis-economics-facts"></section>'), 'border-inline-start'), '3px solid var(--accent-secondary)');
  assert.ok(css.cascaded(probe('<section class="analysis-context-facts"></section>'), 'background'));
});

test('expanded Playbook analysis owns the full Decision-grid row at desktop widths', () => {
  // ANALYZE-COMPOSITION-001: the Explain section keeps .teacher-panel and adds its composition class.
  const panel = markup.querySelector('.teacher-panel');
  assert.ok(panel);
  // The Explain panel spans the whole Decision row. (Superseded: the >=1200px
  // grid became a block flow in which the panel is full-width; it still
  // spans every column wherever the row is a grid.)
  const primary = panel.closest('.playbook-primary-decision');
  assert.ok(primary);
  const display = css.cascaded(primary, 'display', { width: 1440 });
  assert.ok(['block', 'grid'].includes(display), display);
  assert.equal(css.cascaded(panel, 'grid-column', { width: 1440 }), '1 / -1');
  assert.equal(css.cascaded(panel, 'min-width'), '0');
  assert.ok(['auto', '100%'].includes(css.cascaded(panel, 'width', { width: 1440 })));
});

test('unavailable analysis remains compact while retaining only useful facts and provenance', () => {
  assert.match(teacher, /explanation\.availability === 'unavailable'/);
  assert.match(teacher, /article\.classList\.add\('is-unavailable'\)/);
  assert.match(teacher, /analysis-unavailable-note/);
  assert.doesNotMatch(teacher.slice(teacher.indexOf("explanation.availability === 'unavailable'"), teacher.indexOf('const strategy =')), /analysis-detail-group/);
});

test('Study hints consume AnalysisExplanation facts without exposing strategy result probabilities', async () => {
  const spy = app.spy(['resetTrainingStudyHints', 'showTrainingSolution', 'renderAnalysisStudyHints', 'showTrainingFeedback']);
  try {
    await app.training.next();
    const exercise = app.window.app.training.currentExercise;
    assert.ok(spy.calls.resetTrainingStudyHints.some(([argument]) => argument === exercise));
    assert.equal(spy.count('showTrainingSolution'), 0, 'no solution before an answer');
    for (let step = 1; step <= 4; step += 1) await app.click('#trainingRevealHint');
    assert.equal(app.window.app.training.studyHintStep, 3, 'at most three hints');
    assert.ok(spy.count('renderAnalysisStudyHints') >= 1);
    assert.doesNotMatch(text(app.byId('trainingStudyHintContent')), /\d+%/, 'no probabilities in hints');
    spy.reset();
    await app.training.answer();
    const order = spy.sequence;
    assert.ok(order.indexOf('resetTrainingStudyHints') >= 0 && order.indexOf('resetTrainingStudyHints') < order.indexOf('showTrainingFeedback'));
    assert.deepEqual(spy.calls.resetTrainingStudyHints[0], []);
  } finally {
    spy.restore();
  }
});

test('Study hints coach one step at a time and omit implementation-oriented safeguard copy', async () => {
  const hintRenderer = teacher.slice(teacher.indexOf('function studyHintDefinition('), teacher.indexOf('function analysisProvenanceLabel('));
  assert.match(hintRenderer, /What made hand does Hero have here\?/);
  assert.match(hintRenderer, /How much are you being asked to call relative to the pot\?/);
  assert.match(hintRenderer, /How should the board texture and number of opponents affect/);
  assert.match(hintRenderer, /const hint = studyHintDefinition\(explanation, currentStep, options\)/);

  assert.doesNotMatch(hintRenderer, /slice\(0, step\)|strategy_mix|actionAnalysis|recommendation|probability/);
  // The hint button walks Get a hint → Another hint → All hints viewed, and
  // each hint is scoped to the exercise's street.
  await app.training.next();
  const button = app.byId('trainingRevealHint');
  assert.equal(text(button), 'Get a hint');
  const spy = app.spy(['renderAnalysisStudyHints']);
  try {
    await app.click(button);
    assert.equal(spy.calls.renderAnalysisStudyHints[0][3]?.street, app.window.app.training.currentExercise.decisionContext.street);
  } finally {
    spy.restore();
  }
  assert.equal(text(button), 'Another hint');
  await app.click(button);
  await app.click(button);
  assert.equal(text(button), 'All hints viewed');
  assert.doesNotMatch(text(markup.body), /Hints never reveal|never reveal the answer|assistance does not change grading/i);
  assert.match(text(training), /Get a nudge about the spot\./);
});

test('Playbook and Training compose the same renderer without a second strategy visualization', () => {
  // (surface 'playbook' / 'training' are asserted where each renders above.)
  const trainingMarkup = training;
  assert.match(teacher, /analysisSection\.key === 'strategy_mix'\) return/);
  assert.doesNotMatch(teacher, /renderFrequencyStack|frequency-stack|training-frequency-row/);
  assert.ok(trainingMarkup.querySelector('.training-verdict-facts'));
  assert.equal(text(trainingMarkup.querySelector('#trainingAnalysisTitle')), 'Explain');
  assert.equal(trainingMarkup.querySelector('.training-feedback-facts'), null);
  const frequency = trainingMarkup.querySelector('.training-verdict-frequency');
  assert.equal(frequency.hidden, true);
  assert.equal(text(frequency.querySelector('dt')), 'Chosen frequency');
  assert.ok(precedes(trainingMarkup.querySelector('#trainingSolution'), trainingMarkup.querySelector('.training-history-panel')));
});

test('ANALYSIS-001 changes do not touch protected poker, Equity, grading, or solver implementations', () => {
  const service = fs.readFileSync(new URL('../app/src/application/analysis-explanation.mjs', import.meta.url), 'utf8');
  assert.doesNotMatch(service, /applyAction|legalActions|calculateEquity|simulateEquity|scoreFive|evaluateSeven|TrainingAnswerEvaluation/);
  assert.doesNotMatch(teacher, /DecisionContext|StrategyResult|calculateEquity|applyAction|grade/);
});
