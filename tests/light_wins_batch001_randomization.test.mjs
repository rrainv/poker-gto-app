import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

import { POSITIONS_BY_TABLE_SIZE, isCard } from '../shared/poker-domain/index.js';
import {
  ANALYZE_RANDOMIZATION_RECIPE_VERSION, ANALYZE_RANDOMIZATION_REQUEST_VERSION,
  ANALYZE_RANDOMIZATION_TARGETS, ANALYZE_RANDOMIZER_VERSION,
  ANALYZE_WHOLE_SPOT_POLICY_VERSION, randomizeAnalyzeScenario,
} from '../app/src/application/analyze-scenario-randomization.mjs';
import {
  PLAYBOOK_MODES, createPlaybookScenarioInput,
  createPlaybookScenarioInputFromLegacyCompatibility, resolvePlaybookDecisionContext,
} from '../app/src/application/playbook-state-source.mjs';
import { validatePlaybookScenarioReadiness } from '../app/src/application/playbook-scenario-readiness.mjs';
import { installStrategyProviderBridge } from '../app/src/application/strategy-provider-bootstrap.mjs';

const EMPTY_KEEPS = Object.freeze({
  hero: false, board: false, position: false, stack: false, betting_context: false,
});

function scenario(overrides = {}) {
  return createPlaybookScenarioInput({
    tableSize: 6, heroPosition: 'BTN', street: 'flop',
    heroCards: ['As', 'Kd'], board: ['2c', '7d', 'Th'], deadCards: ['Jc'],
    stackBb: 100, stackMode: 'hero', potBb: 6,
    lastAction: 'check', lastActionLabel: 'Check', facingSizeBb: 0,
    rakeMode: 'off', forcedContributionPerPlayerBb: 0,
    totalForcedContributionBb: 0, anteBb: 0, straddleBb: 0,
    ...overrides,
  });
}

function request(target, overrides = {}) {
  return {
    schemaVersion: ANALYZE_RANDOMIZATION_REQUEST_VERSION,
    scenario: scenario(), seed: 0, target, keeps: { ...EMPTY_KEEPS }, ...overrides,
  };
}

function assertReadyUnique(candidate) {
  const cards = [...candidate.heroCards, ...candidate.board, ...candidate.deadCards];
  assert.ok(cards.every(isCard));
  assert.equal(new Set(cards).size, cards.length);
  assert.equal(validatePlaybookScenarioReadiness(candidate).ready, true);
  assert.equal(candidate.street, ({ 0: 'preflop', 3: 'flop', 4: 'turn', 5: 'river' })[candidate.board.length]);
}

test('fresh empty Analyze becomes a complete spot and resolves strategy exactly once', () => {
  const empty = scenario({
    street: 'preflop', heroCards: [], board: [], deadCards: [],
    lastAction: 'unopened', lastActionLabel: 'Unopened', facingSizeBb: 0, potBb: 1.5,
  });
  assert.equal(validatePlaybookScenarioReadiness(empty).ready, false);
  const generated = randomizeAnalyzeScenario(request('spot', { scenario: empty, seed: 41 }));
  assert.equal(generated.status, 'available');
  assertReadyUnique(generated.scenario);
  const resolution = resolvePlaybookDecisionContext({
    mode: PLAYBOOK_MODES.SCENARIO, scenarioInput: generated.scenario,
  });
  assert.equal(resolution.status, 'available');
  let providerCalls = 0;
  const provider = installStrategyProviderBridge({}).createProvider();
  providerCalls += 1;
  const strategy = provider.resolve(resolution.decisionContext);
  assert.equal(providerCalls, 1);
  assert.equal(strategy.schemaVersion, 'strategy-result/v1');
  assert.notEqual(strategy.source, 'unavailable');
});

test('empty Analyze dice adapter commits once and requests one normal resolution', async () => {
  const logic = fs.readFileSync(new URL('../app/src/core/logic.js', import.meta.url), 'utf8');
  const start = logic.indexOf('async function randomizeCurrentAnalyzeScenario(');
  const end = logic.indexOf('async function copyScenarioRandomizationRecipe(', start);
  const empty = scenario({ street: 'preflop', heroCards: [], board: [], deadCards: [] });
  const controls = new Map([
    ['#scenarioRandomizeButton', {
      disabled: false, setAttribute() {}, removeAttribute() {},
    }],
    ['#scenarioRandomizationMenu', { open: true }],
  ]);
  const context = {
    app: { gto: { randomizationKeeps: { ...EMPTY_KEEPS }, randomizationPending: false } },
    controls,
    bridgeCalls: 0,
    commits: 0,
    resolutions: 0,
    generated: null,
    console,
  };
  context.RiverlinePlaybookState = {
    randomizationRequestVersion: ANALYZE_RANDOMIZATION_REQUEST_VERSION,
    randomizeScenario(input) {
      context.bridgeCalls += 1;
      return randomizeAnalyzeScenario(input);
    },
  };
  vm.runInNewContext(`
    const $ = (selector) => controls.get(selector) || null;
    const isHandMode = () => false;
    const readPlaybookScenarioInput = () => empty;
    const scenarioRandomizationSeed = () => 41;
    const setScenarioRandomizationStatus = () => {};
    const scenarioRandomizationFailureMessage = () => '';
    const scenarioRandomizationSuccessMessage = () => '';
    const applyRandomizedScenarioToControls = (scenario) => { commits += 1; generated = scenario; };
    const renderScenarioRandomizationRecipe = () => {};
    const renderScenarioRandomizationControls = () => {};
    const updateContext = async () => { resolutions += 1; };
    ${logic.slice(start, end)}
    this.promise = randomizeCurrentAnalyzeScenario('spot');
  `, Object.assign(context, { empty }));
  assert.equal(await context.promise, true);
  assert.equal(context.bridgeCalls, 1);
  assert.equal(context.commits, 1);
  assert.equal(context.resolutions, 1);
  assertReadyUnique(context.generated);
});

test('repeated New Spot results are coherent, provider-ready, and card-unique', () => {
  const provider = installStrategyProviderBridge({}).createProvider();
  for (let seed = 0; seed < 40; seed += 1) {
    const result = randomizeAnalyzeScenario(request('spot', { seed }));
    assert.equal(result.status, 'available', `seed ${seed}`);
    assertReadyUnique(result.scenario);
    assert.ok(POSITIONS_BY_TABLE_SIZE[result.scenario.tableSize].includes(result.scenario.heroPosition));
    if (['unopened', 'check'].includes(result.scenario.lastAction)) assert.equal(result.scenario.facingSizeBb, 0);
    else assert.ok(result.scenario.facingSizeBb > 0);
    const resolution = resolvePlaybookDecisionContext({
      mode: PLAYBOOK_MODES.SCENARIO, scenarioInput: result.scenario,
    });
    assert.equal(resolution.status, 'available');
    assert.notEqual(provider.resolve(resolution.decisionContext).source, 'unavailable');
  }
});

test('preflop New Spot with Board/street free can reroll into postflop streets', () => {
  const preflop = scenario({
    street: 'preflop', board: [], potBb: 1.5,
    lastAction: 'unopened', lastActionLabel: 'Unopened', facingSizeBb: 0,
  });
  const streets = new Set(Array.from({ length: 20 }, (_, seed) => {
    const result = randomizeAnalyzeScenario(request('spot', {
      scenario: preflop, seed, keeps: { ...EMPTY_KEEPS, board: false },
    }));
    assert.equal(result.status, 'available');
    assertReadyUnique(result.scenario);
    return result.scenario.street;
  }));
  assert.ok([...streets].some((street) => street !== 'preflop'));
});

test('postflop New Spot with Board/street free may select a different street', () => {
  const flop = scenario();
  const streets = new Set(Array.from({ length: 20 }, (_, seed) => (
    randomizeAnalyzeScenario(request('spot', {
      scenario: flop, seed, keeps: { ...EMPTY_KEEPS, board: false },
    })).scenario.street
  )));
  assert.ok([...streets].some((street) => street !== flop.street));
});

test('New Spot preserves rules definition while rebuilding table setup', () => {
  const source = createPlaybookScenarioInputFromLegacyCompatibility({
    tableSize: 6, heroPosition: 'BTN', street: 'flop',
    heroCards: ['As', 'Kd'], board: ['2c', '7d', 'Th'], deadCards: [],
    stackBb: 100, stackMode: 'hero', potBb: 6,
    lastAction: 'check', lastActionLabel: 'Check', facingSizeBb: 0,
    rakeMode: 'off', anteBb: 0, straddleBb: 0,
  });
  const result = randomizeAnalyzeScenario(request('spot', { scenario: source, seed: 9 }));
  assert.equal(result.status, 'available');
  assert.deepEqual(result.scenario.rulesSnapshot.definition, source.rulesSnapshot.definition);
  assert.equal(result.scenario.rulesSnapshot.setup.seatedPlayers, result.scenario.tableSize);
  assert.equal(result.recipe.rulesIdentity.semanticFingerprint, source.rulesSnapshot.semanticFingerprint);
});

test('Keep Hero and Keep Board/street preserve exact grouped values', () => {
  const source = scenario();
  const hero = randomizeAnalyzeScenario(request('spot', {
    scenario: source, seed: 13, keeps: { ...EMPTY_KEEPS, hero: true },
  }));
  assert.equal(hero.status, 'available');
  assert.deepEqual(hero.scenario.heroCards, source.heroCards);
  assertReadyUnique(hero.scenario);
  const board = randomizeAnalyzeScenario(request('spot', {
    scenario: source, seed: 14, keeps: { ...EMPTY_KEEPS, board: true },
  }));
  assert.equal(board.status, 'available');
  assert.deepEqual(board.scenario.board, source.board);
  assert.equal(board.scenario.street, source.street);
  assertReadyUnique(board.scenario);
});

test('Keep Position, Stack, and Betting context preserve each exact group', () => {
  const source = scenario();
  const groups = {
    position: ['heroPosition'], stack: ['stackBb', 'stackMode'],
    betting_context: ['lastAction', 'lastActionLabel', 'facingSizeBb', 'potBb'],
  };
  for (const [group, fields] of Object.entries(groups)) {
    const result = randomizeAnalyzeScenario(request('spot', {
      scenario: source, seed: group.length * 17, keeps: { ...EMPTY_KEEPS, [group]: true },
    }));
    assert.equal(result.status, 'available', group);
    for (const field of fields) assert.deepEqual(result.scenario[field], source[field], `${group}.${field}`);
    assertReadyUnique(result.scenario);
  }
});

test('combined Keep settings survive repeated rerolls without mutation', () => {
  const source = scenario();
  const keeps = { hero: true, board: true, position: false, stack: true, betting_context: false };
  for (let seed = 0; seed < 12; seed += 1) {
    const result = randomizeAnalyzeScenario(request('spot', { scenario: source, seed, keeps }));
    assert.equal(result.status, 'available');
    assert.deepEqual(result.scenario.heroCards, source.heroCards);
    assert.deepEqual(result.scenario.board, source.board);
    assert.equal(result.scenario.street, source.street);
    assert.equal(result.scenario.stackBb, source.stackBb);
    assert.deepEqual(result.recipe.keeps, keeps);
  }
  assert.deepEqual(keeps, { hero: true, board: true, position: false, stack: true, betting_context: false });
});

test('Change only operations mutate exactly one group and honor Keep on target', () => {
  const source = scenario();
  const cases = [
    ['hero', ['heroCards']], ['board', ['board']], ['position', ['heroPosition']],
    ['stack', ['stackBb']],
    ['betting_context', ['lastAction', 'lastActionLabel', 'facingSizeBb', 'potBb']],
  ];
  for (const [target] of cases) {
    const result = randomizeAnalyzeScenario(request(target, { scenario: source, seed: 31 }));
    assert.equal(result.status, 'available', target);
    assert.deepEqual(result.changedGroups, [target]);
    assert.equal(result.scenario.street, source.street, `${target} kept street`);
    for (const [other, fields] of cases) {
      if (other === target) continue;
      for (const field of fields) assert.deepEqual(result.scenario[field], source[field], `${target} kept ${field}`);
    }
    assert.equal(randomizeAnalyzeScenario(request(target, {
      scenario: source, keeps: { ...EMPTY_KEEPS, [target]: true },
    })).code, 'target_locked');
  }
});

test('preflop Change only Board is unavailable with its natural feedback key', () => {
  const preflop = scenario({
    street: 'preflop', board: [], potBb: 1.5,
    lastAction: 'unopened', lastActionLabel: 'Unopened', facingSizeBb: 0,
  });
  const result = randomizeAnalyzeScenario(request('board', { scenario: preflop }));
  assert.equal(result.status, 'unavailable');
  assert.equal(result.code, 'board_not_applicable');
  assert.equal(result.scenario, null);
});

test('impossible Keep constraints fail atomically with no candidate Scenario', () => {
  const empty = scenario({ street: 'preflop', heroCards: [], board: [] });
  const result = randomizeAnalyzeScenario(request('spot', {
    scenario: empty, keeps: { ...EMPTY_KEEPS, hero: true },
  }));
  assert.equal(result.status, 'unavailable');
  assert.equal(result.code, 'kept_hero_incomplete');
  assert.equal(result.scenario, null);
  assert.deepEqual(empty.heroCards, []);
  assert.deepEqual(empty.board, []);
});

test('whole-spot recipe is versioned and replays deterministically', () => {
  const first = randomizeAnalyzeScenario(request('spot', { seed: 0 }));
  assert.equal(first.recipe.schemaVersion, ANALYZE_RANDOMIZATION_RECIPE_VERSION);
  assert.equal(first.recipe.generatorVersion, ANALYZE_RANDOMIZER_VERSION);
  assert.equal(first.recipe.wholeSpotPolicyVersion, ANALYZE_WHOLE_SPOT_POLICY_VERSION);
  assert.equal(first.recipe.generatedValues.street, first.scenario.street);
  const replay = randomizeAnalyzeScenario({
    schemaVersion: first.recipe.requestVersion, scenario: first.recipe.inputContext,
    seed: first.recipe.seed, target: first.recipe.target, keeps: first.recipe.keeps,
  });
  assert.deepEqual(replay.scenario, first.scenario);
  assert.deepEqual(replay.recipe, first.recipe);
});

test('compact dice/settings UI replaces rejected permanent controls', () => {
  const html = fs.readFileSync(new URL('../app/index.html', import.meta.url), 'utf8');
  const logic = fs.readFileSync(new URL('../app/src/core/logic.js', import.meta.url), 'utf8');
  assert.equal((html.match(/id="scenarioRandomizeButton"/g) || []).length, 1);
  assert.match(html, /id="scenarioRandomizeButton"[\s\S]*?aria-label="New random spot"/);
  assert.match(html, /id="scenarioRandomizationMenu"[\s\S]*?<summary[\s\S]*?aria-label="Randomization settings"/);
  assert.equal((html.match(/data-scenario-keep=/g) || []).length, 5);
  assert.equal((html.match(/data-scenario-randomize-target=/g) || []).length, 5);
  assert.doesNotMatch(html, /scenarioChangeOnlyMenu|data-scenario-lock|>Randomize<|>Change only\.\.\.<\/summary>/);
  assert.match(logic, /event\.key !== 'Escape'[\s\S]*scenarioRandomizationMenu\.open = false[\s\S]*querySelector\('summary'\)\?\.focus/);
  assert.match(logic, /randomizeCurrentAnalyzeScenario\('spot'\)/);
});

test('settings, feedback, and accessible names have EN/RU/HE entries', () => {
  const source = fs.readFileSync(new URL('../app/src/locales/analysis-translations.js', import.meta.url), 'utf8');
  const context = { window: {} };
  vm.runInNewContext(source, context);
  const catalog = context.window.riverlineAnalysisTranslations;
  const keys = [
    'New random spot', 'Randomization settings', 'Keep while generating', 'Board / street',
    'New {table}-max {street} spot.', 'New {street} spot. Kept {groups}.',
    'Changed only the board.', 'These Keep settings leave no supported random spot.',
    'Randomization details', 'Copy recipe',
  ];
  for (const locale of ['en', 'ru', 'he']) {
    for (const key of keys) assert.ok(catalog[locale][key]?.trim(), `${locale}: ${key}`);
  }
  assert.notEqual(catalog.ru['New random spot'], catalog.en['New random spot']);
  assert.notEqual(catalog.he['New random spot'], catalog.en['New random spot']);
});

test('unsupported versions, seeds, and targets fail closed', () => {
  assert.throws(() => randomizeAnalyzeScenario(request('spot', {
    schemaVersion: 'analyze-randomization-request/v1',
  })), /Unsupported Analyze randomization request version/);
  assert.throws(() => randomizeAnalyzeScenario(request('spot', { seed: -1 })), /uint32/);
  assert.throws(() => randomizeAnalyzeScenario(request('future_target')), /Unsupported/);
  assert.equal(ANALYZE_RANDOMIZATION_TARGETS.SPOT, 'spot');
});
