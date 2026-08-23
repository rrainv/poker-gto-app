import path from 'node:path';
import { pathToFileURL } from 'node:url';

import { createStrategyProvider as createCurrentStrategyProvider } from '../../app/src/application/strategy-provider.mjs';
import {
  TRAINING_DECISION_TYPES,
  generateTrainingExercise,
} from '../../app/src/application/training-generator.mjs';
import { resolveHeuristicStrategy as resolveCurrentHeuristicStrategy } from '../../app/src/strategy/heuristic-strategy.mjs';
import { POSITIONS_BY_TABLE_SIZE } from '../../shared/poker-domain/positions.js';

const TARGETS = Object.freeze(Object.values(TRAINING_DECISION_TYPES));
const ACTION_ORDER = Object.freeze(['fold', 'check', 'call', 'bet', 'raise', 'all_in']);
const RANK_ORDER = '23456789TJQKA';

function argumentValue(name) {
  const prefix = `--${name}=`;
  return process.argv.find((argument) => argument.startsWith(prefix))?.slice(prefix.length) ?? null;
}

function requiredArgument(name) {
  const value = argumentValue(name);
  if (!value) throw new TypeError(`Missing required --${name}=... argument`);
  return value;
}

function requestedCount() {
  const value = Number(argumentValue('count') ?? 25);
  if (!Number.isInteger(value) || value < 1 || value > 1_000) {
    throw new RangeError('--count must be an integer from 1 through 1000');
  }
  return value;
}

function trainingConfig(target, seed) {
  const postflop = target.startsWith('postflop_');
  return {
    schemaVersion: 'training-config/v1',
    tableSize: 6,
    stackBb: 100,
    streets: [postflop ? 'flop' : 'preflop'],
    gameMode: 'home',
    heroPositions: [...POSITIONS_BY_TABLE_SIZE[6]],
    allowedDecisionTypes: [target],
    difficulty: 'hard',
    seed: seed >>> 0,
  };
}

function actionVector(strategyResult) {
  const byType = Object.fromEntries(ACTION_ORDER.map((type) => [type, 0]));
  for (const action of strategyResult.actions) {
    byType[action.action.type] += action.probability;
  }
  return byType;
}

function dominantAction(vector) {
  return ACTION_ORDER.reduce((best, type) => (
    vector[type] > vector[best] ? type : best
  ), ACTION_ORDER[0]);
}

function vectorDistance(left, right) {
  const absoluteDeltas = ACTION_ORDER.map((type) => Math.abs(left[type] - right[type]));
  return {
    maximumActionDelta: Math.max(...absoluteDeltas),
    totalVariationDistance: absoluteDeltas.reduce((sum, value) => sum + value, 0) / 2,
  };
}

function round(value) {
  return Number(value.toFixed(12));
}

function preflopSanityBucket(cards, street) {
  if (street !== 'preflop' || !Array.isArray(cards) || cards.length !== 2) return null;
  const values = cards.map((card) => RANK_ORDER.indexOf(card[0]));
  const high = Math.max(...values);
  const low = Math.min(...values);
  const pair = high === low;
  const suited = cards[0][1] === cards[1][1];
  if ((pair && high >= RANK_ORDER.indexOf('Q'))
    || (high === RANK_ORDER.indexOf('A') && low === RANK_ORDER.indexOf('K'))) {
    return 'premium_qq_plus_or_ak';
  }
  if (!pair && !suited && high <= RANK_ORDER.indexOf('9') && high - low >= 3) {
    return 'coarse_low_disconnected_offsuit';
  }
  return 'other';
}

function sanitySlice(rows, bucket) {
  const selected = rows.filter((row) => row.sanityBucket === bucket);
  const mean = (side, action) => selected.length
    ? round(selected.reduce((sum, row) => sum + row[side][action], 0) / selected.length)
    : null;
  return {
    definition: bucket === 'premium_qq_plus_or_ak'
      ? 'QQ+, AKs, or AKo; broad strength boundary only'
      : 'offsuit, nine-high-or-lower, and at least a three-rank gap; broad weakness boundary only',
    sampleCount: selected.length,
    beforeMeanFold: mean('before', 'fold'),
    afterMeanFold: mean('after', 'fold'),
    beforeMeanAggression: selected.length
      ? round(selected.reduce((sum, row) => sum + row.before.raise + row.before.all_in, 0)
        / selected.length)
      : null,
    afterMeanAggression: selected.length
      ? round(selected.reduce((sum, row) => sum + row.after.raise + row.after.all_in, 0)
        / selected.length)
      : null,
    beforeDominantFoldCount: selected.filter((row) => row.beforeDominant === 'fold').length,
    afterDominantFoldCount: selected.filter((row) => row.afterDominant === 'fold').length,
    beforeDominantAggressionCount: selected.filter((row) => (
      ['raise', 'all_in'].includes(row.beforeDominant)
    )).length,
    afterDominantAggressionCount: selected.filter((row) => (
      ['raise', 'all_in'].includes(row.afterDominant)
    )).length,
  };
}

async function baselineProviderFrom(root) {
  const providerUrl = pathToFileURL(path.join(root, 'app/src/application/strategy-provider.mjs')).href;
  const heuristicUrl = pathToFileURL(path.join(root, 'app/src/strategy/heuristic-strategy.mjs')).href;
  const [{ createStrategyProvider }, { resolveHeuristicStrategy }] = await Promise.all([
    import(providerUrl),
    import(heuristicUrl),
  ]);
  return createStrategyProvider({ fallbackResolver: resolveHeuristicStrategy });
}

function compareTarget(target, count, baselineProvider, currentProvider, targetIndex) {
  const rows = [];
  const failures = [];
  for (let ordinal = 0; ordinal < count; ordinal += 1) {
    const seed = (0x1b000000 + (targetIndex * 0x10000) + ordinal) >>> 0;
    const config = trainingConfig(target, seed);
    const baseline = generateTrainingExercise(config, { strategyProvider: baselineProvider });
    const current = generateTrainingExercise(config, { strategyProvider: currentProvider });
    if (!baseline.ok || !current.ok) {
      failures.push({
        seed,
        baselineError: baseline.error?.code ?? null,
        currentError: current.error?.code ?? null,
      });
      continue;
    }

    const sameDecisionContext = JSON.stringify(baseline.exercise.decisionContext)
      === JSON.stringify(current.exercise.decisionContext);
    if (!sameDecisionContext) {
      failures.push({ seed, baselineError: 'context_mismatch', currentError: 'context_mismatch' });
      continue;
    }
    const before = actionVector(baseline.exercise.strategyResult);
    const after = actionVector(current.exercise.strategyResult);
    const distance = vectorDistance(before, after);
    rows.push({
      seed,
      street: current.exercise.decisionContext.street,
      heroPosition: current.exercise.decisionContext.heroPosition,
      hand: current.exercise.decisionContext.heroCards.join(''),
      board: current.exercise.decisionContext.board.join(''),
      sanityBucket: preflopSanityBucket(
        current.exercise.decisionContext.heroCards,
        current.exercise.decisionContext.street,
      ),
      decisionFacts: {
        contractVersion: current.exercise.decisionContext.contractVersion,
        currentPotBb: current.exercise.decisionContext.currentPotBb,
        heroStackBb: current.exercise.decisionContext.heroStackBb,
        effectiveStackBb: current.exercise.decisionContext.effectiveStackBb,
        positionRelation: current.exercise.decisionContext.positionRelation,
        aggressorPositionRelation: current.exercise.decisionContext.aggressorPositionRelation,
        callAmountBb: current.exercise.decisionContext.callAmountBb,
        priorActionSummary: current.exercise.decisionContext.priorActionSummary,
        canRaise: current.exercise.decisionContext.canRaise,
        minRaiseToBb: current.exercise.decisionContext.minRaiseToBb,
        maxRaiseToBb: current.exercise.decisionContext.maxRaiseToBb,
        allInToBb: current.exercise.decisionContext.allInToBb,
      },
      before,
      after,
      beforeDominant: dominantAction(before),
      afterDominant: dominantAction(after),
      ...distance,
      fullStrategyResultChanged: JSON.stringify(baseline.exercise.strategyResult)
        !== JSON.stringify(current.exercise.strategyResult),
    });
  }

  const changed = rows.filter((row) => row.maximumActionDelta > 1e-12);
  const dominantChanged = rows.filter((row) => row.beforeDominant !== row.afterDominant);
  const transitionCounts = new Map();
  for (const row of dominantChanged) {
    const key = `${row.beforeDominant}->${row.afterDominant}`;
    transitionCounts.set(key, (transitionCounts.get(key) ?? 0) + 1);
  }
  return {
    requestedSampleCount: count,
    comparableSampleCount: rows.length,
    failures,
    distributionChangedCount: changed.length,
    distributionChangedProportion: rows.length ? round(changed.length / rows.length) : null,
    dominantActionChangedCount: dominantChanged.length,
    dominantActionChangedProportion: rows.length ? round(dominantChanged.length / rows.length) : null,
    fullStrategyResultChangedCount: rows.filter((row) => row.fullStrategyResultChanged).length,
    meanTotalVariationDistance: rows.length
      ? round(rows.reduce((sum, row) => sum + row.totalVariationDistance, 0) / rows.length)
      : null,
    maximumActionDelta: rows.length
      ? round(Math.max(...rows.map((row) => row.maximumActionDelta)))
      : null,
    dominantTransitions: Object.fromEntries(
      [...transitionCounts.entries()].sort((left, right) => right[1] - left[1]),
    ),
    preflopSanitySlices: target.startsWith('preflop_') ? {
      premium: sanitySlice(rows, 'premium_qq_plus_or_ak'),
      coarseTrash: sanitySlice(rows, 'coarse_low_disconnected_offsuit'),
    } : null,
    largestDistributionChanges: [...rows]
      .sort((left, right) => right.totalVariationDistance - left.totalVariationDistance)
      .slice(0, 5)
      .map((row) => ({
        seed: row.seed,
        heroPosition: row.heroPosition,
        hand: row.hand,
        board: row.board,
        beforeDominant: row.beforeDominant,
        afterDominant: row.afterDominant,
        before: row.before,
        after: row.after,
        decisionFacts: row.decisionFacts,
        totalVariationDistance: round(row.totalVariationDistance),
        maximumActionDelta: round(row.maximumActionDelta),
      })),
  };
}

const baselineRoot = path.resolve(requiredArgument('baseline-root'));
const count = requestedCount();
const baselineProvider = await baselineProviderFrom(baselineRoot);
const currentProvider = createCurrentStrategyProvider({
  fallbackResolver: resolveCurrentHeuristicStrategy,
});
const targets = Object.fromEntries(TARGETS.map((target, index) => [
  target,
  compareTarget(target, count, baselineProvider, currentProvider, index),
]));

const report = {
  schemaVersion: 'strategy-repair001b-training-impact/v1',
  comparison: 'untouched HEAD heuristic versus working-tree heuristic on identical canonical Training contexts',
  baselineRoot,
  sampleCountPerExistingTarget: count,
  targets,
  limped: {
    requestedSampleCount: 0,
    status: 'not_a_canonical_training_target',
    note: 'Training exposes BB option but no separate non-BB limped or isolation target.',
  },
};

console.log(JSON.stringify(report, null, process.argv.includes('--pretty') ? 2 : 0));
