import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import {
  ANALYSIS_EXPLANATION_SCHEMA_VERSION,
  ANALYSIS_THRESHOLDS,
  createAnalysisExplanation,
  deriveBoardTextureFacts,
} from '../app/src/application/analysis-explanation.mjs';

const SERVICE_SOURCE = fs.readFileSync(
  new URL('../app/src/application/analysis-explanation.mjs', import.meta.url),
  'utf8',
);

function context(overrides = {}) {
  return {
    schemaVersion: 'decision-context/v1',
    tableSize: 6,
    heroPosition: 'BTN',
    street: 'preflop',
    heroCards: ['As', 'Kh'],
    board: [],
    deadCards: [],
    stackBb: 100,
    stackMode: 'hero',
    potBb: 1.5,
    lastAction: 'unopened',
    facingSizeBb: 0,
    rakeMode: 'off',
    forcedContributionPerPlayerBb: 0,
    totalForcedContributionBb: 0,
    legacyRakePercent: 0,
    ...overrides,
  };
}

function action(label, type, probability, options = {}) {
  return {
    action: {
      type,
      amountBb: options.amountBb ?? null,
      potFraction: options.potFraction ?? null,
    },
    label,
    probability,
    evBb: options.evBb ?? null,
  };
}

function strategy(overrides = {}) {
  return {
    schemaVersion: 'strategy-result/v1',
    source: 'heuristic_preflop',
    actions: [action('Open', 'raise', 0.8), action('Fold', 'fold', 0.2)],
    recommendation: { action: { type: 'raise', amountBb: null, potFraction: null }, label: 'Open' },
    explanation: null,
    confidence: null,
    coverage: null,
    modelVersion: null,
    warnings: [],
    details: null,
    ...overrides,
  };
}

function explanation(options = {}) {
  return createAnalysisExplanation({
    decisionContext: context(),
    strategyResult: strategy(),
    authority: 'scenario',
    ...options,
  });
}

function findSection(result, key) {
  return result.sections.find((entry) => entry.key === key);
}

function findFact(result, sectionKey, factKey) {
  return findSection(result, sectionKey)?.facts.find((entry) => entry.key === factKey);
}

test('AnalysisExplanation v1 is normalized, deeply immutable, and leaves inputs unchanged', () => {
  const decisionContext = context();
  const strategyResult = strategy();
  const before = structuredClone({ decisionContext, strategyResult });
  const result = createAnalysisExplanation({ decisionContext, strategyResult });

  assert.equal(result.schemaVersion, ANALYSIS_EXPLANATION_SCHEMA_VERSION);
  assert.equal(result.schemaVersion, 'analysis-explanation/v1');
  assert.equal(result.availability, 'partial');
  assert.ok(Object.isFrozen(result));
  assert.ok(Object.isFrozen(result.sections));
  assert.ok(Object.isFrozen(result.sections[0].facts));
  assert.ok(Object.isFrozen(result.actionAnalysis[0].action));
  assert.deepEqual({ decisionContext, strategyResult }, before);
});

test('the same inputs always create byte-equivalent deterministic output', () => {
  const first = explanation();
  const second = explanation();
  assert.equal(JSON.stringify(first), JSON.stringify(second));
  assert.doesNotMatch(SERVICE_SOURCE, /Math\.random\s*\(/);
});

test('contract validation rejects incompatible DecisionContext and StrategyResult versions', () => {
  assert.throws(() => explanation({ decisionContext: { schemaVersion: 'decision-context/v2' } }), /DecisionContext/);
  assert.throws(() => explanation({ strategyResult: { schemaVersion: 'strategy-result/v2' } }), /StrategyResult/);
  assert.throws(() => explanation({ depth: 'verbose' }), /depth/);
});

test('cards, board, pot, facing, position, street, and StrategyResult each react without stale output', () => {
  const base = explanation();
  const variants = [
    explanation({ decisionContext: context({ heroCards: ['Qh', 'Qs'] }) }),
    explanation({
      decisionContext: context({ street: 'flop', board: ['Ah', '7d', '2c'], potBb: 6.5 }),
      strategyResult: strategy({
        source: 'heuristic_postflop',
        actions: [action('Check', 'check', 1)],
      }),
      trustedFacts: { handClassification: { madeHand: 'Pair', draws: [], source: 'legacy_postflop_classifier' } },
    }),
    explanation({ decisionContext: context({ potBb: 4 }) }),
    explanation({ decisionContext: context({ lastAction: 'raise', facingSizeBb: 2.5, potBb: 4 }) }),
    explanation({ decisionContext: context({ heroPosition: 'UTG' }) }),
    explanation({
      decisionContext: context({ street: 'turn', board: ['Ah', '7d', '2c', '9s'], potBb: 12 }),
      strategyResult: strategy({ source: 'heuristic_postflop', actions: [action('Check', 'check', 1)] }),
    }),
    explanation({ strategyResult: strategy({ actions: [action('Fold', 'fold', 1)] }) }),
  ];
  variants.forEach((variant) => assert.notEqual(JSON.stringify(variant), JSON.stringify(base)));
});

test('facing a bet derives call amount, pot after call, and correct raw required equity', () => {
  const result = explanation({
    decisionContext: context({ lastAction: 'raise', facingSizeBb: 3, potBb: 6.5 }),
  });
  assert.equal(findFact(result, 'pot_odds', 'call_amount').value, 3);
  assert.equal(findFact(result, 'pot_odds', 'pot_before_action').value, 6.5);
  assert.equal(findFact(result, 'pot_odds', 'pot_after_call').value, 9.5);
  assert.equal(findFact(result, 'pot_odds', 'required_raw_equity').value, 3 / 9.5);
  assert.match(findFact(result, 'pot_odds', 'required_raw_equity').text, /31\.6%/);
});

test('an all-in call uses the available stack as the call amount', () => {
  const result = explanation({
    decisionContext: context({ lastAction: 'raise', facingSizeBb: 20, potBb: 10, stackBb: 7 }),
  });
  assert.equal(findFact(result, 'pot_odds', 'call_amount').value, 7);
  assert.equal(findFact(result, 'pot_odds', 'pot_after_call').value, 17);
  assert.equal(findFact(result, 'pot_odds', 'required_raw_equity').value, 7 / 17);
});

test('unopened and free-check states do not create pot-odds or required-equity facts', () => {
  for (const decisionContext of [
    context({ lastAction: 'unopened', facingSizeBb: 0 }),
    context({ heroPosition: 'BB', lastAction: 'unopened', facingSizeBb: 0 }),
    context({ street: 'flop', board: ['Ah', '7d', '2c'], lastAction: 'check', facingSizeBb: 0, potBb: 6 }),
  ]) {
    const result = explanation({
      decisionContext,
      strategyResult: strategy({
        source: decisionContext.street === 'preflop' ? 'heuristic_preflop' : 'heuristic_postflop',
        actions: [action('Check', 'check', 1)],
      }),
    });
    assert.equal(findFact(result, 'pot_odds', 'call_amount'), undefined);
    assert.equal(findFact(result, 'pot_odds', 'required_raw_equity'), undefined);
  }
});

test('SPR is postflop-only and uses explicit low, medium, and high compatibility categories', () => {
  assert.equal(findSection(explanation(), 'spr'), undefined);
  for (const [stackBb, potBb, category] of [[10, 5, 'low'], [30, 5, 'medium'], [100, 5, 'high']]) {
    const result = explanation({
      decisionContext: context({ street: 'flop', board: ['Ah', '7d', '2c'], stackBb, potBb }),
      strategyResult: strategy({ source: 'heuristic_postflop', actions: [action('Check', 'check', 1)] }),
    });
    const spr = findFact(result, 'spr', 'spr');
    assert.equal(spr.value, stackBb / potBb);
    assert.match(spr.text, new RegExp(category));
    assert.ok(result.warnings.some((entry) => entry.code === 'lossy_stack_semantics'));
  }
});

test('pure, dominant, and balanced mixed outputs use centralized thresholds', () => {
  assert.deepEqual(ANALYSIS_THRESHOLDS, {
    pureProbability: 0.95,
    dominantProbability: 0.70,
    meaningfulProbability: 0.10,
  });
  const fixtures = [
    [[action('Check', 'check', 0.95), action('Bet', 'bet', 0.05)], 'pure'],
    [[action('Call', 'call', 0.70), action('Fold', 'fold', 0.30)], 'dominant'],
    [[action('Call', 'call', 0.50), action('Raise', 'raise', 0.30), action('Fold', 'fold', 0.20)], 'mixed'],
  ];
  fixtures.forEach(([actions, expected]) => {
    const result = explanation({ strategyResult: strategy({ actions }) });
    assert.equal(result.actionAnalysis[0].strategyShape, expected);
  });
});

test('StrategyResult sizing is retained without invented rationale or EV', () => {
  const result = explanation({
    decisionContext: context({ potBb: 6.4 }),
    strategyResult: strategy({
      actions: [
        action('Bet 3.2bb', 'bet', 0.75, { amountBb: 3.2 }),
        action('Check', 'check', 0.25),
      ],
    }),
  });
  const sizing = findFact(result, 'sizing', 'sizing_bet_0');
  assert.equal(sizing.value.amountBb, 3.2);
  assert.equal(sizing.value.derivedPotFraction, 0.5);
  assert.match(sizing.text, /3\.2bb.*50%/);
  assert.equal(result.actionAnalysis[0].evBb, null);
  assert.ok(result.warnings.some((entry) => entry.code === 'ev_unavailable'));
  assert.doesNotMatch(JSON.stringify(result), /maximi[sz]es|fold equity/i);
});

test('known EV values pass through without fabricating missing action EVs', () => {
  const result = explanation({
    strategyResult: strategy({
      actions: [action('Call', 'call', 0.8, { evBb: 1.25 }), action('Fold', 'fold', 0.2)],
    }),
  });
  assert.equal(result.actionAnalysis[0].evBb, 1.25);
  assert.equal(result.actionAnalysis[1].evBb, null);
  assert.equal(result.warnings.some((entry) => entry.code === 'ev_unavailable'), false);
});

test('provenance labels remain controlled and never upgrade any source to unsupported language', () => {
  const sources = {
    heuristic_preflop: 'Heuristic estimate',
    heuristic_postflop: 'Heuristic estimate',
    equity_fallback: 'Equity-based fallback',
    unavailable: 'Source unavailable',
  };
  Object.entries(sources).forEach(([source, label]) => {
    const result = explanation({ strategyResult: strategy({ source }) });
    assert.equal(result.provenance.source, source);
    assert.equal(result.provenance.label, label);
    assert.doesNotMatch(JSON.stringify(result), /\bGTO\b|\bCFR\b|equilibrium|optimal by definition/i);
  });
});

test('generic future-provider metadata is retained while unsupported metadata stays null', () => {
  const known = explanation({
    strategyResult: strategy({
      source: 'future_provider', modelVersion: 'riverline-test', confidence: 0.8, coverage: 0.65,
    }),
  });
  assert.equal(known.provenance.modelVersion, 'riverline-test');
  assert.equal(known.provenance.confidence, 0.8);
  assert.equal(known.provenance.coverage, 0.65);

  const unknown = explanation();
  assert.equal(unknown.provenance.modelVersion, null);
  assert.equal(unknown.provenance.confidence, null);
  assert.equal(unknown.provenance.coverage, null);
});

test('arbitrary StrategyResult warnings are retained as a structured count, not repeated as unsafe prose', () => {
  const result = explanation({
    strategyResult: strategy({ warnings: ['Unsupported GTO claim from an old source'] }),
  });
  const sourceWarning = result.warnings.find((entry) => entry.code === 'strategy_source_warning');
  assert.match(sourceWarning.message, /1 additional limitation/);
  assert.doesNotMatch(JSON.stringify(result), /Unsupported GTO claim/);
});

test('board texture facts characterize paired, rainbow, two-tone, connected, and disconnected boards', () => {
  const paired = deriveBoardTextureFacts(['Ah', 'Ad', '7c']);
  assert.equal(paired.paired, true);
  assert.equal(paired.rainbow, true);

  const rainbow = deriveBoardTextureFacts(['Ah', '7d', '2c']);
  assert.equal(rainbow.rainbow, true);
  assert.equal(rainbow.twoTone, false);
  assert.equal(rainbow.connectivity, 'disconnected');

  const twoTone = deriveBoardTextureFacts(['9h', '8h', '7c']);
  assert.equal(twoTone.twoTone, true);
  assert.equal(twoTone.flushDrawPossible, true);
  assert.equal(twoTone.connected, true);
  assert.equal(twoTone.connectivity, 'connected');
});

test('invalid or unavailable board texture fails safely without guessing', () => {
  assert.equal(deriveBoardTextureFacts([]).available, false);
  assert.equal(deriveBoardTextureFacts(['Ah', 'Ah', '2c']).available, false);
  assert.equal(deriveBoardTextureFacts(['Ah', 'not-a-card', '2c']).available, false);
});

test('trusted made-hand and draw labels are reused instead of running another evaluator', () => {
  const result = explanation({
    decisionContext: context({ street: 'flop', board: ['Kh', '7h', '2c'], potBb: 5 }),
    strategyResult: strategy({ source: 'heuristic_postflop', actions: [action('Check', 'check', 1)] }),
    trustedFacts: {
      handClassification: {
        madeHand: 'Top Pair',
        draws: ['Flush Draw'],
        source: 'legacy_postflop_classifier',
      },
    },
  });
  assert.equal(findFact(result, 'hand_board', 'made_hand').value, 'Top Pair');
  assert.deepEqual(findFact(result, 'hand_board', 'draws').value, ['Flush Draw']);
  assert.ok(result.warnings.some((entry) => entry.code === 'legacy_hand_classifier'));
});

test('missing trusted hand classification is omitted and warned rather than guessed', () => {
  const result = explanation({
    decisionContext: context({ street: 'flop', board: ['Kh', '7h', '2c'], potBb: 5 }),
    strategyResult: strategy({ source: 'heuristic_postflop', actions: [action('Check', 'check', 1)] }),
  });
  assert.equal(findFact(result, 'hand_board', 'made_hand'), undefined);
  assert.ok(result.warnings.some((entry) => entry.code === 'hand_classification_unavailable'));
});

test('Scenario authority never accepts fabricated legal history', () => {
  const result = explanation({
    authority: 'scenario',
    trustedFacts: {
      actionHistory: [{ sequence: 0, actorLabel: 'CO', actionLabel: 'Raise to', actionType: 'raise', amountBb: 2.5 }],
    },
  });
  assert.equal(result.authority.historyAvailable, false);
  assert.equal(findSection(result, 'action_context').facts.some((entry) => entry.key.startsWith('history_')), false);
  assert.ok(result.warnings.some((entry) => entry.code === 'lossy_action_history'));
});

test('Hand and Training authority use supplied canonical chronological history facts', () => {
  for (const authority of ['hand', 'training']) {
    const result = explanation({
      authority,
      trustedFacts: {
        actionHistory: [
          { sequence: 1, street: 'preflop', actorLabel: 'BB', actionLabel: 'Call', actionType: 'call', amountBb: 1.5 },
          { sequence: 0, street: 'preflop', actorLabel: 'CO', actionLabel: 'Raise to', actionType: 'raise', amountBb: 2.5 },
        ],
      },
    });
    assert.equal(result.authority.historyAvailable, true);
    const historyFacts = findSection(result, 'action_context').facts.filter((entry) => entry.key.startsWith('history_'));
    assert.equal(historyFacts.length, 2);
    assert.match(historyFacts[0].text, /CO: Raise to 2\.5bb/);
  }
});

test('position statements stay factual and only use a supplied postflop relation', () => {
  const scenario = explanation({
    decisionContext: context({ street: 'flop', board: ['Ah', '7d', '2c'], potBb: 5 }),
    strategyResult: strategy({ source: 'heuristic_postflop', actions: [action('Check', 'check', 1)] }),
  });
  assert.equal(findFact(scenario, 'position', 'postflop_position_relation'), undefined);
  assert.doesNotMatch(JSON.stringify(findSection(scenario, 'position')), /always good|range advantage/i);

  const trusted = explanation({
    decisionContext: context({ street: 'flop', board: ['Ah', '7d', '2c'], potBb: 5 }),
    strategyResult: strategy({ source: 'heuristic_postflop', actions: [action('Check', 'check', 1)] }),
    trustedFacts: { positionRelation: 'out_of_position' },
  });
  assert.equal(findFact(trusted, 'position', 'postflop_position_relation').value, 'out_of_position');
});

test('equity is consumed only when already supplied as a trusted result', () => {
  const absent = explanation();
  assert.equal(findSection(absent, 'equity'), undefined);
  assert.ok(absent.warnings.some((entry) => entry.code === 'equity_unavailable'));

  const supplied = explanation({ trustedFacts: { equity: { heroEquity: 0.625, method: 'already_calculated' } } });
  assert.equal(findFact(supplied, 'equity', 'hero_equity').value, 0.625);
  assert.equal(findFact(supplied, 'equity', 'equity_method').value, 'already_calculated');
  assert.equal(supplied.warnings.some((entry) => entry.code === 'equity_unavailable'), false);
});

test('missing cards, waiting board, Hero-not-actor, terminal, and source-unavailable states are explicit', () => {
  const fixtures = [
    [context({ heroCards: [] }), strategy(), null, 'missing_hero_cards'],
    [context({ street: 'flop', board: [] }), strategy({ source: 'heuristic_postflop' }), null, 'waiting_for_board'],
    [context(), strategy(), 'hero_not_actor', 'hero_not_actor'],
    [context(), strategy(), 'terminal_hand', 'terminal_hand'],
    [context(), strategy({ source: 'unavailable', actions: [] }), null, 'strategy_unavailable'],
  ];
  fixtures.forEach(([decisionContext, strategyResult, unavailableReason, expected]) => {
    const result = explanation({ decisionContext, strategyResult, unavailableReason });
    assert.equal(result.availability, 'unavailable');
    assert.equal(result.unavailableReason, expected);
    assert.equal(result.headline, 'Analysis unavailable');
    assert.ok(result.warnings.some((entry) => entry.code === expected));
  });
});

test('a null decision context returns a calm immutable unavailable contract', () => {
  const result = createAnalysisExplanation({
    decisionContext: null,
    strategyResult: strategy({ source: 'unavailable', actions: [] }),
    unavailableReason: 'hero_not_actor',
    authority: 'hand',
  });
  assert.equal(result.availability, 'unavailable');
  assert.equal(result.unavailableReason, 'hero_not_actor');
  assert.deepEqual(result.sections, []);
  assert.equal(result.authority.type, 'hand');
});

test('concise and detailed depths share the contract while detailed mode retains more facts', () => {
  const options = {
    decisionContext: context({ street: 'flop', board: ['Ah', 'Kd', 'Qc'], potBb: 6 }),
    strategyResult: strategy({
      source: 'heuristic_postflop',
      actions: [action('Check', 'check', 0.6), action('Bet', 'bet', 0.3), action('Fold', 'fold', 0.1)],
    }),
    authority: 'hand',
    trustedFacts: {
      handClassification: { madeHand: 'Pair', draws: [], source: 'legacy_postflop_classifier' },
      actionHistory: [
        { sequence: 0, actorLabel: 'UTG', actionLabel: 'Check', actionType: 'check' },
        { sequence: 1, actorLabel: 'HJ', actionLabel: 'Check', actionType: 'check' },
        { sequence: 2, actorLabel: 'CO', actionLabel: 'Check', actionType: 'check' },
      ],
    },
  };
  const concise = createAnalysisExplanation({ ...options, depth: 'concise' });
  const detailed = createAnalysisExplanation({ ...options, depth: 'detailed' });
  assert.equal(concise.depth, 'concise');
  assert.equal(detailed.depth, 'detailed');
  assert.ok(findSection(detailed, 'hand_board').facts.length > findSection(concise, 'hand_board').facts.length);
  assert.ok(findSection(detailed, 'action_context').facts.length > findSection(concise, 'action_context').facts.length);
});

test('the service is localization-ready structured data with no HTML prose', () => {
  const result = explanation();
  assert.match(result.headlineKey, /^analysis\./);
  result.sections.forEach((entry) => {
    assert.match(entry.titleKey, /^analysis\.section\./);
    entry.facts.forEach((entryFact) => assert.match(entryFact.templateKey, /^analysis\./));
    entry.textParts.forEach((part) => assert.match(part.templateKey, /^analysis\./));
  });
  assert.doesNotMatch(JSON.stringify(result), /<\/?[a-z][^>]*>/i);
  assert.doesNotMatch(SERVICE_SOURCE, /innerHTML|document\.|querySelector|globalThis|window\./);
});
