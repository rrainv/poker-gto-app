import {
  HOLDEM_DECK,
  POSITIONS_BY_TABLE_SIZE,
  createGameRulesSnapshot,
  isCard,
} from '../../../shared/poker-domain/index.js';
import { createSeededRandom } from './deterministic-random.mjs';
import {
  RANDOMIZATION_RECIPE_VERSION,
  deepFreezeRandomization,
  randomizationFingerprint,
  stableRandomizationValue,
} from './randomization-recipe.mjs';
import {
  createPlaybookScenarioInput,
} from './playbook-state-source.mjs';
import {
  playbookScenarioStreetFromBoard,
  validatePlaybookScenarioReadiness,
} from './playbook-scenario-readiness.mjs';

export const ANALYZE_RANDOMIZATION_REQUEST_VERSION = 'analyze-randomization-request/v2';
export const ANALYZE_RANDOMIZATION_RESULT_VERSION = 'analyze-randomization-result/v2';
export const ANALYZE_RANDOMIZATION_RECIPE_VERSION = RANDOMIZATION_RECIPE_VERSION;
export const ANALYZE_RANDOMIZER_VERSION = 'analyze-scenario-randomizer/v2';
export const ANALYZE_WHOLE_SPOT_POLICY_VERSION = 'analyze-whole-spot-policy/v2';
export const ANALYZE_BETTING_CONTEXT_POLICY_VERSION = 'analyze-betting-context-policy/v1';

export const ANALYZE_RANDOMIZATION_TARGETS = Object.freeze({
  SPOT: 'spot',
  HERO: 'hero',
  BOARD: 'board',
  POSITION: 'position',
  STACK: 'stack',
  BETTING_CONTEXT: 'betting_context',
});

const TARGETS = new Set(Object.values(ANALYZE_RANDOMIZATION_TARGETS));
const BOARD_COUNTS = Object.freeze({ preflop: 0, flop: 3, turn: 4, river: 5 });
const SPOT_STREETS = Object.freeze(['flop', 'flop', 'turn', 'river', 'preflop']);
const SPOT_TABLE_SIZES = Object.freeze([6, 6, 8, 9, 2, 5, 7, 10, 4, 3]);
const SPOT_STACKS_BB = Object.freeze([30, 50, 75, 100, 150, 200]);
const AGGRESSIVE_ACTIONS = new Set(['raise', '3bet', '4bet', 'bet']);
const ACTION_LABELS = Object.freeze({
  unopened: 'Unopened',
  check: 'Check',
  raise: 'Raise',
  '3bet': '3-Bet',
  '4bet': '4-Bet',
  bet: 'Bet',
});

const deepFreeze = deepFreezeRandomization;
const stableValue = stableRandomizationValue;
const fingerprint = randomizationFingerprint;

function unavailable(code, details = {}) {
  return deepFreeze({
    schemaVersion: ANALYZE_RANDOMIZATION_RESULT_VERSION,
    status: 'unavailable',
    code,
    scenario: null,
    recipe: null,
    changedGroups: [],
    preservedGroups: [],
    ...details,
  });
}

function normalizeKeeps(keeps) {
  return Object.freeze({
    hero: keeps?.hero === true,
    board: keeps?.board === true,
    position: keeps?.position === true,
    stack: keeps?.stack === true,
    betting_context: keeps?.betting_context === true,
  });
}

function rulesIdentity(scenario) {
  if (scenario.rulesSnapshot) {
    return Object.freeze({
      schemaVersion: scenario.rulesSnapshot.schemaVersion,
      semanticFingerprint: scenario.rulesSnapshot.semanticFingerprint,
    });
  }
  return Object.freeze({
    schemaVersion: 'legacy-scenario-rules/v1',
    rakeMode: scenario.rakeMode ?? null,
    tableSize: scenario.tableSize,
    anteBb: scenario.anteBb ?? 0,
    straddleBb: scenario.straddleBb ?? 0,
  });
}

function sameHero(left, right) {
  return [...left].sort().join('|') === [...right].sort().join('|');
}

function copyScenario(scenario, changes = {}) {
  return {
    ...scenario,
    heroCards: [...scenario.heroCards],
    board: [...scenario.board],
    deadCards: [...scenario.deadCards],
    ...changes,
  };
}

function changedTargetCards(random, deck, heroCount, boardCount, priorHero, priorBoard) {
  for (let attempt = 0; attempt < 64; attempt += 1) {
    const shuffled = random.shuffle(deck);
    const heroCards = heroCount ? shuffled.slice(0, heroCount) : priorHero;
    const board = boardCount ? shuffled.slice(heroCount, heroCount + boardCount) : priorBoard;
    const heroChanged = heroCount === 0 || !sameHero(heroCards, priorHero);
    const boardChanged = boardCount === 0 || board.join('|') !== priorBoard.join('|');
    if (heroChanged && boardChanged) return { heroCards, board };
  }
  return null;
}

function roundHalf(value) {
  return Math.round(value * 2) / 2;
}

function boundedPotCandidates(currentPot) {
  const raw = [currentPot * 0.75, currentPot * 1.25, currentPot - 0.5, currentPot + 0.5];
  return [...new Set(raw.map((value) => Math.max(0.5, Math.min(200, roundHalf(value)))))]
    .filter((value) => value !== currentPot);
}

function facingCandidates(street, potBb) {
  if (street === 'preflop') return [2, 2.5, 3, 4, 6, 8, 10, 12, 20, 25];
  return [...new Set([0.33, 0.5, 0.75, 1]
    .map((ratio) => Math.max(0.5, Math.min(100, roundHalf(potBb * ratio)))))];
}

function bettingContextCandidates(scenario, street) {
  const actions = street === 'preflop'
    ? ['unopened', 'raise', '3bet', '4bet']
    : ['check', 'bet', 'raise'];
  const pots = boundedPotCandidates(Number(scenario.potBb));
  const candidates = [];
  for (const potBb of pots) {
    for (const lastAction of actions) {
      const facings = AGGRESSIVE_ACTIONS.has(lastAction)
        ? facingCandidates(street, potBb)
        : [0];
      for (const facingSizeBb of facings) {
        if (lastAction === scenario.lastAction
          && potBb === scenario.potBb
          && facingSizeBb === scenario.facingSizeBb) continue;
        candidates.push({
          lastAction,
          lastActionLabel: ACTION_LABELS[lastAction],
          facingSizeBb,
          potBb,
        });
      }
    }
  }
  return candidates;
}

function spotBettingContexts(street) {
  if (street === 'preflop') {
    return [
      { lastAction: 'unopened', lastActionLabel: ACTION_LABELS.unopened, facingSizeBb: 0, potBb: 1.5 },
      { lastAction: 'raise', lastActionLabel: ACTION_LABELS.raise, facingSizeBb: 2.5, potBb: 4 },
      { lastAction: '3bet', lastActionLabel: ACTION_LABELS['3bet'], facingSizeBb: 7.5, potBb: 11 },
      { lastAction: '4bet', lastActionLabel: ACTION_LABELS['4bet'], facingSizeBb: 18, potBb: 27 },
    ];
  }
  const potBb = { flop: 6, turn: 14, river: 30 }[street];
  return [
    { lastAction: 'check', lastActionLabel: ACTION_LABELS.check, facingSizeBb: 0, potBb },
    { lastAction: 'check', lastActionLabel: ACTION_LABELS.check, facingSizeBb: 0, potBb: roundHalf(potBb * 0.75) },
    { lastAction: 'check', lastActionLabel: ACTION_LABELS.check, facingSizeBb: 0, potBb: roundHalf(potBb * 1.5) },
  ];
}

function actionMatchesStreet(action, street) {
  return street === 'preflop'
    ? ['unopened', 'check', 'limp', 'call', 'raise', '3bet', '4bet'].includes(action)
    : ['check', 'call', 'bet', 'raise'].includes(action);
}

function scenarioWithTable(source, tableSize) {
  if (source.rulesSnapshot) {
    return copyScenario(source, {
      tableSize,
      rulesSnapshot: createGameRulesSnapshot({
        definition: source.rulesSnapshot.definition,
        source: source.rulesSnapshot.source,
        setup: { seatedPlayers: tableSize },
      }),
    });
  }
  const perPlayer = Number(source.forcedContributionPerPlayerBb ?? 0);
  return copyScenario(source, {
    tableSize,
    totalForcedContributionBb: Number((perPlayer * tableSize).toFixed(10)),
  });
}

function spotTableCandidates(source, keeps) {
  const minimum = source.rulesSnapshot?.definition?.tableSize?.minimumSeated
    ?? (source.rakeMode === 'fixed' ? 7 : 2);
  const maximum = source.rulesSnapshot?.definition?.tableSize?.maximumSeated ?? 10;
  return SPOT_TABLE_SIZES.filter((tableSize) => tableSize >= minimum && tableSize <= maximum)
    .filter((tableSize) => !keeps.position
      || POSITIONS_BY_TABLE_SIZE[tableSize]?.includes(source.heroPosition));
}

function spotStreetCandidates(source, keeps) {
  if (keeps.board) {
    const street = playbookScenarioStreetFromBoard(source.board);
    return street === source.street
      && street in BOARD_COUNTS
      && (!keeps.betting_context || actionMatchesStreet(source.lastAction, street))
      ? [street]
      : [];
  }
  return SPOT_STREETS.filter((street) => !keeps.betting_context
    || actionMatchesStreet(source.lastAction, street));
}

function generateWholeSpot(source, keeps, random) {
  // The first xorshift output is correlated for nearby seeds. Warm the
  // whole-spot stream once so street selection stays well dispersed while
  // remaining deterministic and versioned.
  random.nextUint32();
  const supportedTables = spotTableCandidates(source, keeps);
  const tables = Object.values(keeps).every(Boolean)
    ? supportedTables.filter((tableSize) => tableSize !== source.tableSize)
    : supportedTables;
  const streets = spotStreetCandidates(source, keeps);
  if (supportedTables.length === 0) return { unavailableCode: 'kept_position_unavailable' };
  if (tables.length === 0) return { unavailableCode: 'spot_constraints_unavailable' };
  if (streets.length === 0) return { unavailableCode: 'kept_context_incompatible' };
  if (keeps.hero && source.heroCards.length !== 2) {
    return { unavailableCode: 'kept_hero_incomplete' };
  }
  if (keeps.stack && (!Number.isFinite(Number(source.stackBb)) || Number(source.stackBb) <= 0)) {
    return { unavailableCode: 'kept_stack_invalid' };
  }

  for (let attempt = 0; attempt < 128; attempt += 1) {
    const tableSize = random.choose(tables);
    const street = random.choose(streets);
    const base = scenarioWithTable(source, tableSize);
    const heroPosition = keeps.position
      ? source.heroPosition
      : random.choose(POSITIONS_BY_TABLE_SIZE[tableSize]);
    const stackBb = keeps.stack ? source.stackBb : random.choose(SPOT_STACKS_BB);
    const bettingContext = keeps.betting_context
      ? {
        lastAction: source.lastAction,
        lastActionLabel: source.lastActionLabel,
        facingSizeBb: source.facingSizeBb,
        potBb: source.potBb,
      }
      : random.choose(spotBettingContexts(street));
    if (Number(bettingContext.facingSizeBb) > Number(stackBb)) continue;
    const preservedCards = [
      ...source.deadCards,
      ...(keeps.hero ? source.heroCards : []),
      ...(keeps.board ? source.board : []),
    ];
    if (preservedCards.some((card) => !isCard(card))
      || new Set(preservedCards).size !== preservedCards.length) {
      return { unavailableCode: 'kept_cards_invalid' };
    }
    const deck = HOLDEM_DECK.filter((card) => !new Set(preservedCards).has(card));
    const heroCount = keeps.hero ? 0 : 2;
    const boardCount = keeps.board ? 0 : BOARD_COUNTS[street];
    const generated = changedTargetCards(
      random,
      deck,
      heroCount,
      boardCount,
      source.heroCards,
      source.board,
    );
    if (!generated) continue;
    const candidate = copyScenario(base, {
      street,
      heroPosition,
      stackBb,
      ...bettingContext,
      heroCards: keeps.hero ? [...source.heroCards] : generated.heroCards,
      board: keeps.board ? [...source.board] : boardCount === 0 ? [] : generated.board,
    });
    try {
      const normalized = createPlaybookScenarioInput(candidate);
      if (validatePlaybookScenarioReadiness(normalized).ready) return { candidate: normalized };
    } catch {
      // A bounded candidate can be rejected without weakening any Keep setting.
    }
  }
  return { unavailableCode: 'spot_constraints_unavailable' };
}

function actualChangedGroups(source, scenario) {
  return [
    ...(!sameHero(source.heroCards, scenario.heroCards) ? ['hero'] : []),
    ...(source.board.join('|') !== scenario.board.join('|') || source.street !== scenario.street
      ? ['board'] : []),
    ...(source.tableSize !== scenario.tableSize ? ['table'] : []),
    ...(source.heroPosition !== scenario.heroPosition ? ['position'] : []),
    ...(Number(source.stackBb) !== Number(scenario.stackBb) ? ['stack'] : []),
    ...(['lastAction', 'lastActionLabel', 'facingSizeBb', 'potBb']
      .some((field) => source[field] !== scenario[field]) ? ['betting_context'] : []),
  ];
}

function generatedValuesFor(target, scenario, changedGroups) {
  if (target === ANALYZE_RANDOMIZATION_TARGETS.SPOT) {
    return {
      street: scenario.street,
      ...(changedGroups.includes('hero') ? { heroCards: scenario.heroCards } : {}),
      ...(changedGroups.includes('board') ? { board: scenario.board } : {}),
      ...(changedGroups.includes('table') ? { tableSize: scenario.tableSize } : {}),
      ...(changedGroups.includes('position') ? { heroPosition: scenario.heroPosition } : {}),
      ...(changedGroups.includes('stack') ? { stackBb: scenario.stackBb } : {}),
      ...(changedGroups.includes('betting_context') ? {
        lastAction: scenario.lastAction,
        lastActionLabel: scenario.lastActionLabel,
        facingSizeBb: scenario.facingSizeBb,
        potBb: scenario.potBb,
      } : {}),
    };
  }
  if (target === ANALYZE_RANDOMIZATION_TARGETS.HERO) return { heroCards: scenario.heroCards };
  if (target === ANALYZE_RANDOMIZATION_TARGETS.BOARD) return { board: scenario.board };
  if (target === ANALYZE_RANDOMIZATION_TARGETS.POSITION) {
    return { heroPosition: scenario.heroPosition };
  }
  if (target === ANALYZE_RANDOMIZATION_TARGETS.STACK) {
    return { stackBb: scenario.stackBb };
  }
  return {
    lastAction: scenario.lastAction,
    lastActionLabel: scenario.lastActionLabel,
    facingSizeBb: scenario.facingSizeBb,
    potBb: scenario.potBb,
  };
}

function preservedGroupsFor(target, keeps) {
  if (target === ANALYZE_RANDOMIZATION_TARGETS.SPOT) {
    return [
      ...Object.entries(keeps).filter(([, kept]) => kept).map(([group]) => group),
      'rules', 'dead_cards',
    ];
  }
  return ['hero', 'board', 'position', 'stack', 'betting_context', 'rules', 'dead_cards', 'street']
    .filter((group) => group !== target);
}

/**
 * Deterministic, storage-free Analyze Scenario input assistance. It samples
 * supplied Scenario facts only and never constructs PokerState or legal history.
 */
export function randomizeAnalyzeScenario(request = {}) {
  if (request.schemaVersion !== ANALYZE_RANDOMIZATION_REQUEST_VERSION) {
    throw new TypeError('Unsupported Analyze randomization request version');
  }
  if (!Number.isInteger(request.seed) || request.seed < 0 || request.seed > 0xffffffff) {
    throw new RangeError('Analyze randomization seed must be uint32');
  }
  if (!TARGETS.has(request.target)) throw new RangeError('Unsupported Analyze randomization target');

  let source;
  try {
    source = createPlaybookScenarioInput(request.scenario);
  } catch (error) {
    return unavailable('invalid_source', { diagnostics: String(error?.message || error) });
  }
  const keeps = normalizeKeeps(request.keeps);
  const street = playbookScenarioStreetFromBoard(source.board);
  const target = request.target;
  if (target !== ANALYZE_RANDOMIZATION_TARGETS.SPOT
    && (!(street in BOARD_COUNTS) || source.street !== street)) {
    return unavailable('invalid_street_structure');
  }
  if (source.deadCards.some((card) => !isCard(card))
    || new Set(source.deadCards).size !== source.deadCards.length) {
    return unavailable('invalid_dead_cards');
  }
  if (target !== ANALYZE_RANDOMIZATION_TARGETS.SPOT) {
    const knownCards = [...source.heroCards, ...source.board, ...source.deadCards].filter(Boolean);
    if (knownCards.some((card) => !isCard(card))) return unavailable('invalid_known_card');
    if (new Set(knownCards).size !== knownCards.length) return unavailable('duplicate_known_card');
  }
  if (target !== ANALYZE_RANDOMIZATION_TARGETS.SPOT && keeps[target]) {
    return unavailable('target_locked', { lockedTarget: target });
  }
  if (target === 'board' && street === 'preflop') return unavailable('board_not_applicable');

  const random = createSeededRandom(request.seed);
  let candidate = copyScenario(source);
  let changedGroups = [];

  if (target === ANALYZE_RANDOMIZATION_TARGETS.SPOT) {
    const generated = generateWholeSpot(source, keeps, random);
    if (!generated.candidate) return unavailable(generated.unavailableCode);
    candidate = generated.candidate;
    changedGroups = actualChangedGroups(source, candidate);
  } else if (['hero', 'board'].includes(target)) {
    const changeHero = target === 'hero';
    const changeBoard = target === 'board';
    const preservedKnown = [
      ...source.deadCards,
      ...(changeHero ? [] : source.heroCards),
      ...(changeBoard ? [] : source.board),
    ];
    if (new Set(preservedKnown).size !== preservedKnown.length) {
      return unavailable('duplicate_preserved_card');
    }
    const unavailableCards = new Set(preservedKnown);
    const deck = HOLDEM_DECK.filter((card) => !unavailableCards.has(card));
    const heroCount = changeHero ? 2 : 0;
    const boardCount = changeBoard ? BOARD_COUNTS[street] : 0;
    if (deck.length < heroCount + boardCount) return unavailable('insufficient_available_cards');
    const generated = changedTargetCards(
      random,
      deck,
      heroCount,
      boardCount,
      source.heroCards,
      source.board,
    );
    if (!generated) return unavailable('no_alternative_realization');
    candidate = copyScenario(source, {
      heroCards: changeHero ? generated.heroCards : [...source.heroCards],
      board: changeBoard ? generated.board : [...source.board],
    });
    if (changeHero) changedGroups.push('hero');
    if (changeBoard) changedGroups.push('board');
  } else if (target === 'position') {
    const positions = POSITIONS_BY_TABLE_SIZE[source.tableSize] || [];
    const alternatives = positions.filter((position) => position !== source.heroPosition);
    if (alternatives.length === 0) return unavailable('no_alternative_position');
    candidate.heroPosition = random.choose(alternatives);
    changedGroups.push('position');
  } else if (target === 'stack') {
    const alternatives = Array.from({ length: 491 }, (_, index) => index + 10)
      .filter((stackBb) => stackBb !== Number(source.stackBb))
      .filter((stackBb) => validatePlaybookScenarioReadiness(
        copyScenario(source, { stackBb }),
      ).ready);
    if (alternatives.length === 0) return unavailable('no_alternative_stack');
    candidate.stackBb = random.choose(alternatives);
    changedGroups.push('stack');
  } else {
    const alternatives = random.shuffle(bettingContextCandidates(source, street));
    let accepted = null;
    for (const context of alternatives) {
      const attempted = copyScenario(source, context);
      if (validatePlaybookScenarioReadiness(attempted).ready) {
        accepted = attempted;
        break;
      }
    }
    if (!accepted) {
      return unavailable('betting_context_unavailable', {
        policyVersion: ANALYZE_BETTING_CONTEXT_POLICY_VERSION,
      });
    }
    candidate = accepted;
    changedGroups.push('betting_context');
  }

  let scenario;
  try {
    scenario = createPlaybookScenarioInput(candidate);
  } catch (error) {
    return unavailable('candidate_invalid', { diagnostics: String(error?.message || error) });
  }
  const readiness = validatePlaybookScenarioReadiness(scenario);
  if (!readiness.ready) {
    return unavailable('scenario_not_ready', {
      readiness,
    });
  }

  const recipe = deepFreeze({
    schemaVersion: ANALYZE_RANDOMIZATION_RECIPE_VERSION,
    generatorVersion: ANALYZE_RANDOMIZER_VERSION,
    bettingContextPolicyVersion: target === 'betting_context'
      ? ANALYZE_BETTING_CONTEXT_POLICY_VERSION
      : null,
    wholeSpotPolicyVersion: target === ANALYZE_RANDOMIZATION_TARGETS.SPOT
      ? ANALYZE_WHOLE_SPOT_POLICY_VERSION
      : null,
    sourceSurface: 'analyze_scenario',
    requestVersion: ANALYZE_RANDOMIZATION_REQUEST_VERSION,
    seed: request.seed >>> 0,
    inputFingerprint: fingerprint(source),
    resultFingerprint: fingerprint(scenario),
    inputContext: deepFreeze(stableValue(source)),
    rulesIdentity: rulesIdentity(source),
    street: scenario.street,
    target,
    keeps,
    preservedKnownCards: deepFreeze({
      heroCards: keeps.hero || !changedGroups.includes('hero') ? [...source.heroCards] : [],
      board: keeps.board || !changedGroups.includes('board') ? [...source.board] : [],
      deadCards: [...source.deadCards],
    }),
    generatedValues: deepFreeze(generatedValuesFor(target, scenario, changedGroups)),
  });

  return deepFreeze({
    schemaVersion: ANALYZE_RANDOMIZATION_RESULT_VERSION,
    status: 'available',
    code: null,
    scenario,
    recipe,
    changedGroups,
    preservedGroups: preservedGroupsFor(target, keeps),
  });
}
