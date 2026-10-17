import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { deriveDecisionContextFromPokerState } from '../app/src/application/decision-context-from-poker-state.mjs';
import { createPreflopRoleAuditFixtures } from './fixtures/preflop-role001-fixtures.mjs';
import { createStrategyProvider } from '../app/src/application/strategy-provider.mjs';
import { resolveHeuristicStrategy } from '../app/src/strategy/heuristic-strategy.mjs';
import { createAnalysisExplanation } from '../app/src/application/analysis-explanation.mjs';
import { shouldShowSourceBadge } from '../app/src/application/workspace-header.mjs';

const read = (path) => fs.readFileSync(new URL(path, import.meta.url), 'utf8');
const html = read('../app/index.html');
const logic = read('../app/src/core/logic.js');
const tableRenderer = read('../app/src/ui/TableRenderer.js');
const analysisLocales = read('../app/src/locales/analysis-translations.js');

function between(source, start, end) {
  const from = source.indexOf(start);
  assert.ok(from >= 0, start);
  return source.slice(from, source.indexOf(end, from + start.length));
}

test('OWNER-19: Analyze names its heuristic provenance once, above the verdict, with the tier', () => {
  assert.equal(shouldShowSourceBadge({ destination: 'analyze' }), false, 'no header pill on Analyze');
  const state = createPreflopRoleAuditFixtures().bbVsButtonOpen;
  const decisionContext = deriveDecisionContextFromPokerState(state, state.actingPlayerId);
  const strategyResult = createStrategyProvider({ fallbackResolver: resolveHeuristicStrategy }).resolve(decisionContext);
  const explanation = createAnalysisExplanation({ decisionContext, strategyResult });
  assert.doesNotMatch(explanation.summary, /Source:|Heuristic/i, 'Explain does not repeat the source');
  assert.doesNotMatch(analysisLocales, /'analysis\.summary\.recommendation': '[^']*\{source\}/, 'no locale repeats the source');
  const eyebrow = between(html, '<div class="eyebrow"><span id="strategyTruthHeading"', '</div>');
  assert.match(eyebrow, /id="strategyTier"/);
  assert.match(eyebrow, /data-i18n="Estimated"/);
  const renderTruth = between(logic, 'function renderAnalyzeTruth(', '\nfunction ');
  assert.match(renderTruth, /tier\.hidden = truth\.state !== 'heuristic_comparison'/);
});

test('OWNER-12: strategy adjustment sliders are hidden and dormant; stored values are kept', () => {
  assert.match(html, /<details id="playbookStrategyAdjustment" class="ui-disclosure playbook-spot-disclosure" hidden>/);
  assert.match(html, /id="tightnessSlider"/, 'controls stay in the document for the M3 engine');
  assert.match(logic, /const STRATEGY_ADJUSTMENT_ENABLED = false;/);
  const reader = between(logic, 'function readHeuristicOptions()', '\n}\n');
  assert.match(reader, /if \(!STRATEGY_ADJUSTMENT_ENABLED\) return \{ playStyle: 0, opponentStyle: 0 \};/);
  assert.match(logic, /app\.settings\.tightness = val;/, 'stored setting writes are untouched');
});

test('OWNER-17: the Scenario spot table shows only known stacks and is labelled approximate', () => {
  const projection = between(logic, 'function renderPlaybookTableProjection()', '\nasync function updateContext(');
  assert.match(projection, /const heroStackKnown = decisionContext\.stackMode === 'hero'/);
  assert.match(projection, /stackBb: seat === 0 && heroStackKnown \? Number\(decisionContext\.stackBb\) : null/);
  assert.doesNotMatch(projection, /stackBb: Number\(decisionContext\.stackBb\),/, 'opponent stacks are never copied');
  const scenarioRender = between(tableRenderer, 'renderScenarioState(state) {', '\n  paintSeatPortrait(');
  assert.match(scenarioRender, /stackUnknown \? '\?' : ''/);
  assert.match(scenarioRender, /table\.stackUnknown/);
  assert.match(html, /data-i18n="Approximate Scenario view · only the facts you entered"/);
});
