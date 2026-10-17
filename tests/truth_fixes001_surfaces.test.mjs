import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { deriveDecisionContextFromPokerState } from '../app/src/application/decision-context-from-poker-state.mjs';
import { createPreflopRoleAuditFixtures } from './fixtures/preflop-role001-fixtures.mjs';
import { createStrategyProvider } from '../app/src/application/strategy-provider.mjs';
import { resolveHeuristicStrategy } from '../app/src/strategy/heuristic-strategy.mjs';
import { createAnalysisExplanation } from '../app/src/application/analysis-explanation.mjs';
import { bootApp, indexDocument } from './helpers/app-under-test.mjs';

// TEST-HYGIENE-001: index.html / logic.js assertions are behavioural: parsed
// markup and the booted app. Other module sources keep their existing checks.
const app = await bootApp();
// workspace-header installs window.RiverlineWorkspaceHeader when first
// evaluated, so it is imported only after the app has booted.
const { shouldShowSourceBadge } = await import('../app/src/application/workspace-header.mjs');
const markup = indexDocument();
await app.navigate('analyze');
await app.pickCards('#gtoMode [data-card-set-edit="hero"]', ['As', 'Kd']);
await app.settle(300);
const read = (path) => fs.readFileSync(new URL(path, import.meta.url), 'utf8');
const tableRenderer = read('../app/src/ui/TableRenderer.js');
const analysisLocales = read('../app/src/locales/analysis-translations.js');

function between(source, start, end) {
  const from = source.indexOf(start);
  assert.ok(from >= 0, start);
  return source.slice(from, source.indexOf(end, from + start.length));
}

test('OWNER-19: Analyze names its heuristic provenance once, above the verdict, with the tier', async () => {
  assert.equal(shouldShowSourceBadge({ destination: 'analyze' }), false, 'no header pill on Analyze');
  const state = createPreflopRoleAuditFixtures().bbVsButtonOpen;
  const decisionContext = deriveDecisionContextFromPokerState(state, state.actingPlayerId);
  const strategyResult = createStrategyProvider({ fallbackResolver: resolveHeuristicStrategy }).resolve(decisionContext);
  const explanation = createAnalysisExplanation({ decisionContext, strategyResult });
  assert.doesNotMatch(explanation.summary, /Source:|Heuristic/i, 'Explain does not repeat the source');
  assert.doesNotMatch(analysisLocales, /'analysis\.summary\.recommendation': '[^']*\{source\}/, 'no locale repeats the source');
  // Was: the eyebrow markup slice and renderAnalyzeTruth source. Protects:
  // the "Estimated" tier sits beside the source heading above the verdict
  // and shows only for a heuristic comparison.
  const eyebrow = markup.getElementById('strategyTruthHeading').parentNode;
  assert.ok(eyebrow.classList.contains('eyebrow'));
  const tierMarkup = markup.getElementById('strategyTier');
  assert.ok(eyebrow.contains(tierMarkup));
  assert.ok(tierMarkup.querySelector('[data-i18n="Estimated"]'), 'the tier reads Estimated');

  await app.navigate('analyze');
  await app.call('updateContext');
  await app.settle(200);
  const pageResult = app.window.app.strategyResult;
  assert.ok(pageResult, 'Analyze resolved a strategy');
  const truth = app.call('renderAnalyzeTruth', pageResult);
  assert.equal(truth.state, 'heuristic_comparison');
  assert.equal(app.byId('strategyTier').hidden, false);
  const original = app.window.requireStrategyProviderBridge;
  app.window.requireStrategyProviderBridge = () => {
    const bridge = original();
    return { ...bridge, truthFor: (input) => ({ ...bridge.truthFor(input), state: 'accepted_reference_comparison' }) };
  };
  try {
    app.call('renderAnalyzeTruth', pageResult);
    assert.equal(app.byId('strategyTier').hidden, true, 'no tier for a non-heuristic source');
  } finally {
    app.window.requireStrategyProviderBridge = original;
  }
  app.call('renderAnalyzeTruth', pageResult);
  assert.equal(app.byId('strategyTier').hidden, false);
});

test('OWNER-12: strategy adjustment sliders are hidden and dormant; stored values are kept', async () => {
  // Was: the details markup and logic.js source (flag, readHeuristicOptions,
  // settings write). Protects: the disclosure ships hidden, the sliders stay
  // in the document, heuristic options ignore them, and moving a slider
  // still stores its value.
  const disclosure = markup.getElementById('playbookStrategyAdjustment');
  assert.equal(disclosure.tagName, 'DETAILS');
  assert.ok(disclosure.classList.contains('ui-disclosure') && disclosure.classList.contains('playbook-spot-disclosure'));
  assert.equal(disclosure.hasAttribute('hidden'), true);
  assert.ok(markup.getElementById('tightnessSlider'), 'controls stay in the document for the M3 engine');
  assert.equal(app.evaluate('STRATEGY_ADJUSTMENT_ENABLED'), false);
  const previous = app.evaluate('app.settings.tightness');
  try {
    await app.setValue('#tightnessSlider', '90');
    assert.equal(app.evaluate('app.settings.tightness'), 90, 'stored setting writes are untouched');
    assert.deepEqual({ ...app.call('readHeuristicOptions') }, { playStyle: 0, opponentStyle: 0 });
  } finally {
    app.evaluate(`app.settings.tightness = ${JSON.stringify(previous ?? null)}`);
  }
});

test('OWNER-17: the Scenario spot table shows only known stacks and is labelled approximate', async () => {
  // Was: renderPlaybookTableProjection source. Protects: the Scenario table
  // carries Hero's stack only in Hero-stack mode and never copies it to
  // opponents; unknown stacks are flagged.
  await app.navigate('analyze');
  await app.call('updateContext');
  await app.settle(200);
  const projected = () => {
    let detail = null;
    const capture = (event) => { if (event.detail?.players) detail ||= event.detail; };
    app.window.addEventListener('gameStateUpdate', capture);
    try { app.call('renderPlaybookTableProjection'); } finally { app.window.removeEventListener('gameStateUpdate', capture); }
    assert.equal(detail?.mode, 'scenario');
    return detail.players.map(({ stackBb, stackUnknown }) => ({ stackBb, stackUnknown }));
  };
  const context = app.window.app.decisionContext;
  const heroMode = { ...context, stackMode: 'hero', stackBb: 87 };
  app.window.app.decisionContext = heroMode;
  try {
    const players = projected();
    assert.deepEqual(players[0], { stackBb: 87, stackUnknown: false });
    assert.ok(players.slice(1).every((player) => player.stackBb === null && player.stackUnknown), 'opponent stacks are never copied');
    app.window.app.decisionContext = { ...heroMode, stackMode: 'effective' };
    assert.ok(projected().every((player) => player.stackBb === null && player.stackUnknown));
  } finally {
    app.window.app.decisionContext = context;
  }
  const scenarioRender = between(tableRenderer, 'renderScenarioState(state) {', '\n  paintSeatPortrait(');
  assert.match(scenarioRender, /stackUnknown \? '\?' : ''/);
  assert.match(scenarioRender, /table\.stackUnknown/);
  assert.ok(markup.querySelector('[data-i18n="Approximate Scenario view · only the facts you entered"]'));
});
