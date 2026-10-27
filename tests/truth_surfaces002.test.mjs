import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

import {
  ESTIMATED_MIX_STEP_PERCENT,
  VERDICT_CLOSE_MARGIN,
  VERDICT_MEANINGFUL_SHARE,
  describeAnalyzeVerdict,
  presentStrategyMixActions,
} from '../app/src/application/analyze-verdict.mjs';
import { shouldShowSourceBadge } from '../app/src/application/workspace-header.mjs';
import { strategyTruthPresentation } from '../app/src/application/strategy-truth.mjs';
import { installLocaleNumbers, logicNumberHelpersSource } from './helpers/locale-number-sandbox.cjs';

const read = (path) => fs.readFileSync(new URL(path, import.meta.url), 'utf8');
const html = read('../app/index.html');
const css = read('../app/styles.css');
const logic = read('../app/src/core/logic.js');
const personalWorkspace = read('../app/src/application/personal-strategy-understanding-workspace.mjs');

function sourceBetween(source, start, end) {
  const from = source.indexOf(start);
  const to = source.indexOf(end, from + start.length);
  assert.ok(from >= 0 && to > from, `missing slice ${start} -> ${end}`);
  return source.slice(from, to);
}

test('QA-SHELL-004 / OWNER-19: one provenance indicator per surface across Analyze, Training, Hand Review, and Personal Strategy', () => {
  for (const destination of ['analyze', 'training', 'hand', 'personal-strategy']) {
    assert.equal(shouldShowSourceBadge({
      destination,
      handReviewOpen: true,
      trainingFeedbackShown: true,
      trainingFullHandPhase: 'review',
      personalComparisonOpen: true,
    }), false, `${destination} names its source once in-surface`);
  }

  // Training: single provenance eyebrow above feedback title; legacy header/rail/grade pills hidden.
  assert.match(html, /id="trainingStrategySource"[^>]*data-i18n="Source unavailable" hidden/);
  assert.match(html, /id="trainingReferenceSummary"[^>]*hidden/);
  assert.match(html, /id="trainingGradeBadge"[^>]*hidden/);
  assert.match(html, /id="trainingFeedbackProvenance" class="eyebrow training-feedback-provenance"><span id="trainingTruthHeading"[^>]*>Heuristic baseline<\/span><span id="trainingTier"> · <span id="trainingTierLabel"[^>]*>Estimated<\/span><\/span> · <span id="trainingFeedbackStreet"[^>]*>Preflop<\/span><\/div><h3 id="feedbackTitle"/);

  const renderTrainingSummary = sourceBetween(logic, 'function renderTrainingEvaluationSummary(', 'function handleTrainingGuess(');
  const elements = new Map();
  const el = (sel) => {
    if (!elements.has(sel)) elements.set(sel, { dataset: {}, hidden: false, textContent: '' });
    return elements.get(sel);
  };
  const heuristicTruth = { state: 'heuristic_comparison', outcome: 'unassessed', claims: {}, comparison: { kind: 'matches' } };
  const ctx = {
    $: el,
    t: (k) => k,
    trainingTruth: () => heuristicTruth,
    truthPresentation: strategyTruthPresentation,
    trainingActionLabel: (type) => type,
    evaluation: { chosenAction: { type: 'raise' }, chosenProbability: 0.7, bestProbability: 0.7, bestStrategyAction: { label: 'Open' } },
    exercise: { decisionContext: { street: 'flop' } },
    window: installLocaleNumbers({}),
  };
  vm.runInNewContext(`${logicNumberHelpersSource()}\n${renderTrainingSummary}; renderTrainingEvaluationSummary(evaluation, exercise);`, ctx);
  assert.equal(el('#trainingTruthHeading').textContent, 'Heuristic baseline');
  assert.equal(el('#trainingTier').hidden, false);
  assert.equal(el('#trainingFeedbackStreet').textContent, 'Flop');

  const refTruth = { state: 'accepted_reference_comparison', outcome: 'unassessed', claims: { reference: true }, comparison: { kind: 'matches' } };
  ctx.trainingTruth = () => refTruth;
  ctx.exercise = { decisionContext: { street: 'turn' } };
  vm.runInNewContext('renderTrainingEvaluationSummary(evaluation, exercise);', ctx);
  assert.equal(el('#trainingTruthHeading').textContent, 'Selected reference');
  assert.equal(el('#trainingTier').hidden, true);
  assert.equal(el('#trainingFeedbackStreet').textContent, 'Turn');

  // Hand Review: single provenance eyebrow above decision title; duplicate source badge and overview row hidden.
  assert.match(html, /id="handReviewProvenance" class="eyebrow hand-review-provenance-eyebrow"><span id="handReviewTruthHeading"[^>]*>Heuristic baseline<\/span><span id="handReviewTier"> · <span id="handReviewTierLabel"[^>]*>Estimated<\/span><\/span> · <span id="handReviewDecisionStreet"/);
  assert.match(html, /id="handReviewSourceBadge"[^>]*hidden/);
  assert.match(html, /<div hidden><dt data-i18n="Strategy source">Strategy source<\/dt><dd id="handReviewOverviewSource">-<\/dd><\/div>/);
  const reviewRender = sourceBetween(logic, 'function renderActiveHandReview()', 'function selectActiveHandReviewDecision(');
  assert.match(reviewRender, /#handReviewTruthHeading/);
  assert.match(reviewRender, /#handReviewTier'\)\.hidden = decision\.truth\?\.state !== 'heuristic_comparison'/);

  // Personal Strategy: single provenance eyebrow in source comparison only.
  assert.match(html, /id="personalComparisonProvenance" class="eyebrow personal-comparison-provenance" hidden/);
  assert.match(personalWorkspace, /const provenance = q\('personalComparisonProvenance'\)/);
  assert.match(personalWorkspace, /\[t\('Heuristic baseline'\), t\('Estimated'\), t\('Preflop'\)\]/);
  assert.match(css, /:is\(\.training-feedback-provenance, \.hand-review-provenance-eyebrow, \.personal-comparison-provenance\)/);
});

test('REVIEW-MATH-03: estimated mixes round to 5% and hide actions under 5% without mutating StrategyResult or Review data', () => {
  assert.equal(ESTIMATED_MIX_STEP_PERCENT, 5);
  const helper = sourceBetween(logic, 'function strategyResultPresentationActions(', 'function strategyResultToLegacyProfile(');
  const vmCtx = {};
  vm.runInNewContext(`${helper}\nglobalThis.present = strategyResultPresentationActions;`, vmCtx);

  const estimated = {
    schemaVersion: 'strategy-result/v1',
    source: 'heuristic_preflop',
    sourceDescriptor: { capabilities: { actionDistribution: 'heuristic' } },
    actions: [
      { label: 'Raise', probability: 0.68, action: { type: 'raise' } },
      { label: 'Call', probability: 0.29, action: { type: 'call' } },
      { label: 'Fold', probability: 0.03, action: { type: 'fold' } },
    ],
  };
  const beforeBytes = JSON.stringify(estimated);
  const presented = Array.from(vmCtx.present(estimated), (item) => ({ ...item }));
  assert.equal(JSON.stringify(estimated), beforeBytes, 'underlying StrategyResult is never mutated');
  assert.deepEqual(presented.map((item) => [item.name, item.value]), [
    ['Raise', 70],
    ['Call', 30],
  ], 'trace action under 5% is excluded and remaining shares round to 5% steps summing to 100%');
  assert.deepEqual(
    presentStrategyMixActions(estimated).map((item) => [item.name, item.value]),
    [['Raise', 70], ['Call', 30]],
  );

  // Exact mixes keep 1% precision and keep actions under 5%.
  const exact = {
    schemaVersion: 'strategy-result/v1',
    source: 'reference_pack',
    sourceDescriptor: { capabilities: { actionDistribution: 'exact' } },
    actions: [
      { label: 'Raise', probability: 0.68, action: { type: 'raise' } },
      { label: 'Call', probability: 0.29, action: { type: 'call' } },
      { label: 'Fold', probability: 0.03, action: { type: 'fold' } },
    ],
  };
  const exactPresented = Array.from(vmCtx.present(exact), (item) => ({ ...item }));
  assert.deepEqual(exactPresented.map((item) => [item.name, item.value]), [
    ['Raise', 68],
    ['Call', 29],
    ['Fold', 3],
  ]);

  // Hand Review frequency comparison rounds estimated mixes to 5% and hides < 5%, while keeping exact frequencies unrounded.
  const reviewFreqSource = sourceBetween(logic, 'function formatReviewFrequency(', 'function reviewLimitationLabel(');
  const makeNode = (tag = 'div') => ({
    tag,
    className: '',
    textContent: '',
    dataset: {},
    style: {},
    attributes: {},
    children: [],
    classList: {
      classes: new Set(),
      add(c) { this.classes.add(c); },
      remove(c) { this.classes.delete(c); },
      toggle(c, on) { if (on) this.classes.add(c); else this.classes.delete(c); },
    },
    setAttribute(k, v) { this.attributes[k] = v; },
    replaceChildren(...items) { this.children = items; },
    appendChild(child) { this.children.push(child); },
    append(...items) { this.children.push(...items); },
  });
  const stack = makeNode('div');
  const rows = makeNode('div');
  const reviewVm = {
    $: (sel) => (sel === '#handReviewFrequencyStack' ? stack : sel === '#handReviewFrequencyRows' ? rows : null),
    t: (k) => k,
    document: { createElement: (tag) => makeNode(tag) },
    trainingActionLabel: (type) => type,
    visualActionKind: (entry) => entry.action?.type || 'aggressive',
    window: installLocaleNumbers({}),
  };
  vm.runInNewContext(`${logicNumberHelpersSource()}\n${reviewFreqSource}\nglobalThis.renderReviewFreq = renderHandReviewFrequencyComparison;`, reviewVm);

  const reviewDecisionEstimated = {
    source: { exactFrequencies: false },
    chosenAction: { type: 'raise' },
    durable: { decisionContext: {} },
    distribution: [
      { type: 'raise', label: 'Raise', probability: 0.67 },
      { type: 'call', label: 'Call', probability: 0.29 },
      { type: 'fold', label: 'Fold', probability: 0.04 },
    ],
  };
  const distSnapshot = JSON.stringify(reviewDecisionEstimated.distribution);
  reviewVm.renderReviewFreq(reviewDecisionEstimated);
  assert.equal(JSON.stringify(reviewDecisionEstimated.distribution), distSnapshot, 'Review distribution is never mutated');
  assert.equal(rows.children.length, 2, '4% Fold action is hidden in estimated Review mix');
  assert.deepEqual(
    rows.children.map((row) => [row.children[0].textContent, row.children[3].textContent, row.children[2].children[0].style.width]),
    [
      ['Raise', '70%', '70%'],
      ['Call', '30%', '30%'],
    ],
  );

  const reviewDecisionExact = {
    source: { exactFrequencies: true },
    chosenAction: { type: 'raise' },
    durable: { decisionContext: {} },
    distribution: [
      { type: 'raise', label: 'Raise', probability: 0.67 },
      { type: 'call', label: 'Call', probability: 0.29 },
      { type: 'fold', label: 'Fold', probability: 0.04 },
    ],
  };
  reviewVm.renderReviewFreq(reviewDecisionExact);
  assert.equal(rows.children.length, 3, '4% action is kept when exactFrequencies is true');
  assert.deepEqual(
    rows.children.map((row) => [row.children[0].textContent, row.children[3].textContent]),
    [
      ['Raise', '67%'],
      ['Call', '29%'],
      ['Fold', '4%'],
    ],
  );
});

test('Verdict dominance rule (NORTH_STAR §7.3): strictly two states (dominant or close) with 20-point margin and 5% threshold', () => {
  assert.equal(VERDICT_CLOSE_MARGIN, 0.2);
  assert.equal(VERDICT_MEANINGFUL_SHARE, 0.05);

  const makeResult = (entries) => ({
    schemaVersion: 'strategy-result/v1',
    recommendation: { label: entries[0][0].toUpperCase(), action: { type: entries[0][1] } },
    actions: entries.map(([label, type, probability]) => ({ label, probability, action: { type } })),
  });

  // Floating-point 5% boundary (0.35 - 0.30 = 0.04999999999999999) counts as meaningful (>= 5%).
  const fpFivePercent = makeResult([['Raise', 'raise', 0.2], ['Call', 'call', 0.35 - 0.3]]);
  assert.equal(describeAnalyzeVerdict(fpFivePercent).kind, 'close');

  // Under 5% secondary action is always dominant even if primary is < 25%.
  const underFivePercent = makeResult([['Raise', 'raise', 0.22], ['Call', 'call', 0.049]]);
  assert.equal(describeAnalyzeVerdict(underFivePercent).kind, 'dominant');

  // Render verdict with a filtered < 5% action at index 0 still matches the right 5%-rounded shares.
  const verdictRender = sourceBetween(logic, 'function renderAnalyzeVerdict(strategyResult)', '// Technical source id/version');
  const helper = sourceBetween(logic, 'function strategyResultPresentationActions(', 'function strategyResultToLegacyProfile(');
  const bestAction = { textContent: '', dataset: {} };
  const bestActionClose = {
    hidden: true,
    children: [],
    replaceChildren(...nodes) { this.children = nodes; },
    get textContent() { return this.children.map((n) => n.textContent || '').join(''); },
  };
  const renderVm = {
    $: (sel) => (sel === '#bestAction' ? bestAction : sel === '#bestActionClose' ? bestActionClose : null),
    t: (key, vars = {}) => String(key).replace(/\{(\w+)\}/g, (m, k) => vars[k] ?? m),
    window: { RiverlineAnalyzeVerdict: { describe: describeAnalyzeVerdict } },
    document: {
      createTextNode: (text) => ({ textContent: text }),
      createElement: () => ({
        className: '',
        dataset: {},
        textContent: '',
        children: [],
        setAttribute() {},
        append(...items) {
          this.children = items;
          this.textContent = items.map((i) => i.textContent || '').join('');
        },
      }),
    },
  };
  vm.runInNewContext(`${helper}\n${verdictRender}\nglobalThis.renderVerdict = renderAnalyzeVerdict;`, renderVm);

  const closeWithLeadingTrace = makeResult([
    ['Fold', 'fold', 0.03],
    ['Raise', 'raise', 0.52],
    ['Call', 'call', 0.45],
  ]);
  const verdict = renderVm.renderVerdict(closeWithLeadingTrace);
  assert.equal(verdict.kind, 'close');
  assert.equal(bestAction.textContent, 'Raise or Call');
  assert.equal(bestActionClose.hidden, false);
  assert.equal(bestActionClose.textContent, 'Close mix · Raise 55% · Call 45%');
});
