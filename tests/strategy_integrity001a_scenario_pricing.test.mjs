import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import fs from 'node:fs';

import { createAnalysisExplanation } from '../app/src/application/analysis-explanation.mjs';

const require = createRequire(import.meta.url);
const qa = require('./qa002_adapters.js');
const LOGIC = fs.readFileSync(new URL('../app/src/core/logic.js', import.meta.url), 'utf8');
const PREFLOP = fs.readFileSync(new URL('../app/src/strategy/preflop-heuristic.mjs', import.meta.url), 'utf8');
const POSTFLOP = fs.readFileSync(new URL('../app/src/strategy/postflop-heuristic.mjs', import.meta.url), 'utf8');

function scenario(overrides = {}) {
  return qa.deriveDecisionContext({
    tableSize: 6,
    heroPosition: 'BTN',
    heroCards: ['As', 'Kh'],
    board: [],
    deadCards: [],
    stackBb: 100,
    stackMode: 'hero',
    potBb: 4.5,
    lastAction: 'raise',
    facingSizeBb: 3,
    rakeMode: 'off',
    ...overrides,
  });
}

function assertAvailableScenarioStrategy(context, expectedSource) {
  assert.equal(context.schemaVersion, 'decision-context/v1');
  assert.equal(context.callAmountBb, null);
  assert.equal(context.heroStreetContributionBb, null);
  assert.ok(context.facingSizeBb > 0);

  const result = qa.strategyResult(context);
  assert.equal(result.schemaVersion, 'strategy-result/v1');
  assert.equal(result.source, expectedSource);
  assert.ok(result.recommendation);
  assert.ok(result.actions.length > 0);
  assert.ok(result.actions.every((entry) => (
    Number.isFinite(entry.probability)
    && entry.probability >= 0
    && entry.probability <= 1
    && (entry.action.amountBb === null || Number.isFinite(entry.action.amountBb))
    && (entry.action.potFraction === null || Number.isFinite(entry.action.potFraction))
  )));
  assert.ok(Math.abs(result.actions.reduce((sum, entry) => sum + entry.probability, 0) - 1) < 1e-12);

  const explanation = createAnalysisExplanation({
    decisionContext: context,
    strategyResult: result,
    authority: 'scenario',
  });
  const potOdds = explanation.sections.find((section) => section.key === 'pot_odds');
  assert.equal(potOdds.facts.find((fact) => fact.key === 'call_price_availability')?.value,
    'unavailable');
  assert.equal(potOdds.facts.some((fact) => fact.key === 'call_amount'), false);
  assert.equal(potOdds.facts.some((fact) => fact.key === 'pot_after_call'), false);
  assert.equal(potOdds.facts.some((fact) => fact.key === 'required_raw_equity'), false);
  return result;
}

function assertUnavailablePostflopScenarioStrategy(context) {
  assert.equal(context.schemaVersion, 'decision-context/v1');
  assert.equal(context.callAmountBb, null);
  assert.equal(context.heroStreetContributionBb, null);
  assert.ok(context.facingSizeBb > 0);

  const result = qa.strategyResult(context);
  assert.equal(result.schemaVersion, 'strategy-result/v1');
  assert.equal(result.source, 'unavailable');
  assert.equal(result.sourceDescriptor.authority, 'none');
  assert.deepEqual(result.actions, []);
  assert.equal(result.recommendation, null);
  assert.equal(result.details.providerReason, 'exact_call_price_unavailable');
  assert.equal(result.contextCoverage.kind, 'unsupported');
  assert.equal(result.contextCoverage.basis, 'missing_trusted_call_price');
  assert.deepEqual(result.contextCoverage.limitationCodes, [
    'heuristic_exact_call_price_unavailable',
  ]);

  const explanation = createAnalysisExplanation({
    decisionContext: context,
    strategyResult: result,
    authority: 'scenario',
  });
  assert.equal(explanation.availability, 'unavailable');
  assert.equal(explanation.unavailableReason, 'strategy_unavailable');
  const potOdds = explanation.sections.find((section) => section.key === 'pot_odds');
  assert.equal(potOdds.facts.find((fact) => fact.key === 'call_price_availability')?.value,
    'unavailable');
  return result;
}

test('Scenario BTN facing a 3bb open retains an available normalized preflop strategy', () => {
  const context = scenario();
  assert.equal(context.lastAction, 'raise');
  assert.equal(context.facingSizeBb, 3);
  assertAvailableScenarioStrategy(context, 'heuristic_preflop');
});

test('Scenario facing a 3-bet retains an available normalized preflop strategy', () => {
  const context = scenario({
    heroCards: ['Qs', 'Qh'],
    potBb: 12,
    lastAction: '3bet',
    facingSizeBb: 9,
  });
  assert.equal(context.lastAction, '3bet');
  assert.equal(context.facingSizeBb, 9);
  assertAvailableScenarioStrategy(context, 'heuristic_preflop');
});

test('Scenario facing a postflop bet abstains when exact call price is unavailable', () => {
  const context = scenario({
    board: ['Qs', '7d', '2c'],
    potBb: 10,
    lastAction: 'bet',
    facingSizeBb: 5,
  });
  assert.equal(context.street, 'flop');
  assert.equal(context.lastAction, 'bet');
  assert.equal(context.facingSizeBb, 5);
  assertUnavailablePostflopScenarioStrategy(context);
});

test('Scenario facing a postflop raise abstains when exact call price is unavailable', () => {
  const context = scenario({
    board: ['Qs', '7d', '2c'],
    potBb: 20,
    lastAction: 'raise',
    facingSizeBb: 15,
  });
  assert.equal(context.street, 'flop');
  assert.equal(context.lastAction, 'raise');
  assert.equal(context.facingSizeBb, 15);
  assertUnavailablePostflopScenarioStrategy(context);
});

test('fallback price mathematics never defaults missing call price to nominal facing size', () => {
  const fallback = `${PREFLOP}\n${POSTFLOP}`;
  assert.doesNotMatch(fallback, /callAmountBb\s*=\s*facingSize/);
  assert.doesNotMatch(fallback, /trustedCallAmount\s*===\s*null\s*\?\s*0/);
  assert.doesNotMatch(fallback, /potSize\s*\/\s*\(potSize\s*\+\s*facingSize\)/);
  assert.match(POSTFLOP, /requiredRawEquity[\s\S]*trustedCallAmount\s*\/\s*\(potSize\s*\+\s*trustedCallAmount\)/);
  assert.match(PREFLOP, /const potOdds = callAmountBb \/ priceDenominator/);
  assert.match(PREFLOP, /Facing aggression lacks a proven legal minimum/);
  assert.doesNotMatch(PREFLOP, /facingSizeBb\s*\/\s*|const raiseAmount/);
  assert.doesNotMatch(LOGIC, /requiredRawEquity|cheapOddsDefenseBoost/);
});
