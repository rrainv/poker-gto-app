import { projectStrategyTruth, historicalStrategyTruth, strategyTruthPresentation } from './strategy-truth.mjs';
import { referenceCoveragePresentation } from './reference-source-language.mjs';
import {
  STRATEGY_RESULT_SCHEMA_VERSION,
  STRATEGY_SOURCES,
} from './strategy-result.mjs';
import {
  STRATEGY_CLAIMS,
  resolveStrategyClaimPolicy,
} from './strategy-claim-policy.mjs';
import {
  RANGE_ANALYSIS_FACTS_SCHEMA_VERSION,
} from './range-analysis.mjs';
import {
  BLUFF_ANALYSIS_FACTS_SCHEMA_VERSION,
} from './bluff-analysis.mjs';
import {
  formatExactPokerAmountBb,
  formatSuggestedSizingBb,
} from './poker-sizing-presentation.mjs';

export { deriveBoardStructureFacts as deriveBoardTextureFacts } from './range-analysis.mjs';

export const ANALYSIS_EXPLANATION_SCHEMA_VERSION = 'analysis-explanation/v1';

export const ANALYSIS_THRESHOLDS = Object.freeze({
  pureProbability: 0.95,
  dominantProbability: 0.70,
  meaningfulProbability: 0.10,
});

const DECISION_CONTEXT_SCHEMA_VERSION = 'decision-context/v1';
const AUTHORITY_TYPES = Object.freeze(['scenario', 'hand', 'training']);

const UNAVAILABLE_COPY = Object.freeze({
  missing_hero_cards: 'Select two Hero cards to explain this decision.',
  waiting_for_board: 'Complete the board cards required for this street.',
  hero_not_actor: 'The canonical hand is waiting for another player to act.',
  waiting_for_hero: 'The current state is waiting for Hero to act.',
  terminal_hand: 'The hand is complete, so there is no decision to explain.',
  strategy_unavailable: 'No valid strategy recommendation is available for this state.',
  invalid_scenario: 'The supplied scenario cannot be analyzed safely.',
  invalid_context: 'The current decision context is unavailable.',
});

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
}

function finiteNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function boundedProbability(value) {
  const numeric = finiteNumber(value);
  return numeric === null ? null : Math.min(1, Math.max(0, numeric));
}

function rounded(value, digits = 1) {
  return Number(Number(value).toFixed(digits));
}

function percent(value, digits = 0) {
  return `${(Number(value) * 100).toFixed(digits)}%`;
}

function bb(value) {
  return `${rounded(value, 2)}bb`;
}

export function formatAnalysisTemplate(fallback, values = {}) {
  return String(fallback || '').replace(/\{([a-zA-Z0-9_]+)\}/g, (match, key) => (
    Object.hasOwn(values, key) ? String(values[key]) : match
  ));
}

function textPart(key, fallback, values = {}, kind = 'interpretation') {
  const safeValues = { ...values };
  return {
    key,
    kind,
    templateKey: key,
    values: safeValues,
    text: formatAnalysisTemplate(fallback, safeValues),
  };
}

function fact(key, {
  kind = 'fact',
  label,
  labelKey,
  value,
  unit = null,
  templateKey,
  fallback,
  values = {},
}) {
  const safeValues = { ...values };
  return {
    key,
    kind,
    label,
    labelKey,
    value,
    unit,
    templateKey,
    values: safeValues,
    text: formatAnalysisTemplate(fallback, safeValues),
  };
}

function section(key, title, importance, facts, textParts = []) {
  return {
    key,
    title,
    titleKey: `analysis.section.${key}`,
    importance,
    facts,
    textParts,
  };
}

function warning(code, message, severity = 'info', values = {}, messageKey = null) {
  return {
    code,
    severity,
    messageKey: messageKey || `analysis.warning.${code}`,
    message,
    values,
  };
}

function stableHash(values) {
  const input = JSON.stringify(values);
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function validCard(card) {
  return typeof card === 'string' && /^[2-9TJQKA][cdhs]$/.test(card);
}

function expectedBoardCount(street) {
  return { preflop: 0, flop: 3, turn: 4, river: 5 }[street] ?? null;
}

function normalizeAuthority(authority) {
  const source = typeof authority === 'string' ? { type: authority } : (authority || {});
  const type = AUTHORITY_TYPES.includes(source.type) ? source.type : 'scenario';
  return {
    type,
    label: type === 'hand' ? 'Canonical hand'
      : type === 'training' ? 'Canonical training exercise' : 'Scenario controls',
    labelKey: `analysis.authority.${type}`,
  };
}

function normalizeHistory(history, authorityType) {
  if (authorityType === 'scenario' || !Array.isArray(history)) return [];
  return history.map((entry, index) => {
    const amountBb = finiteNumber(entry?.amountBb);
    return {
      sequence: Number.isInteger(entry?.sequence) ? entry.sequence : index,
      street: String(entry?.street || ''),
      actorLabel: String(entry?.actorLabel || entry?.position || 'Unknown player'),
      position: entry?.position ? String(entry.position) : null,
      actionType: String(entry?.actionType || 'unknown'),
      actionLabel: String(entry?.actionLabel || entry?.actionType || 'Action'),
      amountBb,
      amountLabel: entry?.amountLabel
        ? String(entry.amountLabel)
        : (amountBb === null ? null : formatExactPokerAmountBb(amountBb)),
      isHero: Boolean(entry?.isHero),
    };
  }).sort((left, right) => left.sequence - right.sequence);
}

function provenanceFor(strategyResult, claimPolicy) {
  const descriptor = claimPolicy.source;
  return {
    source: descriptor.id,
    sourceVersion: claimPolicy.sourceVersion,
    sourceFamily: descriptor.family,
    authority: claimPolicy.authority,
    contextCoverage: claimPolicy.coverage,
    capabilities: claimPolicy.capabilities,
    claimMode: claimPolicy.mode,
    label: descriptor.displayName,
    labelKey: descriptor.displayNameKey,
    modelVersion: strategyResult?.modelVersion ?? null,
    confidence: boundedProbability(strategyResult?.confidence),
    coverage: boundedProbability(strategyResult?.coverage),
    limitations: claimPolicy.limitations.map((entry) => entry.code),
  };
}

function strategyShape(actions) {
  if (!actions.length) return 'unavailable';
  const leading = actions[0];
  if (leading.probability >= ANALYSIS_THRESHOLDS.pureProbability) return 'pure';
  if (leading.probability >= ANALYSIS_THRESHOLDS.dominantProbability) return 'dominant';
  const meaningful = actions.filter((entry) => entry.probability >= ANALYSIS_THRESHOLDS.meaningfulProbability);
  return meaningful.length >= 2 ? 'mixed' : 'fragmented';
}

function normalizeActions(strategyResult, includeActionEv = false) {
  return (Array.isArray(strategyResult?.actions) ? strategyResult.actions : [])
    .map((entry, index) => ({
      index,
      action: {
        type: String(entry?.action?.type || 'unknown'),
        amountBb: finiteNumber(entry?.action?.amountBb),
        potFraction: finiteNumber(entry?.action?.potFraction),
      },
      label: String(entry?.label || entry?.action?.type || 'Unknown action'),
      probability: boundedProbability(entry?.probability) ?? 0,
      evBb: includeActionEv ? finiteNumber(entry?.evBb) : null,
    }))
    .filter((entry) => entry.probability > 0)
    .sort((left, right) => right.probability - left.probability || left.index - right.index);
}

function makeActionAnalysis(actions) {
  const shape = strategyShape(actions);
  return actions.map((entry, index) => ({
    action: { ...entry.action },
    label: entry.label,
    probability: entry.probability,
    evBb: entry.evBb,
    role: index === 0 ? 'primary'
      : entry.probability >= ANALYSIS_THRESHOLDS.meaningfulProbability ? 'meaningful_secondary' : 'minor',
    strategyShape: shape,
  }));
}

function drawLabelsForAnalysis(draws) {
  if (!draws?.available) return [];
  return [
    draws.flushDraw ? (draws.nutFlushDraw ? 'nut_flush_draw' : 'flush_draw') : null,
    draws.openEndedStraightDraw ? 'open_ended_straight_draw' : null,
    draws.gutshot ? 'gutshot' : null,
    draws.doubleGutshot ? 'double_gutshot' : null,
    draws.straightFlushDraw
      ? (draws.royalFlushDraw
        ? 'royal_flush_draw'
        : draws.straightFlushDrawType || 'straight_flush_draw')
      : null,
  ].filter(Boolean);
}

function madeHandLabelForAnalysis(exactHand, legacyHand) {
  if (!exactHand?.available) return legacyHand?.madeHand || legacyHand?.label || null;
  if (exactHand.primaryCategory === 'straight') {
    if (exactHand.madeHandSubtype === 'wheel') return 'wheel_straight';
    if (exactHand.madeHandSubtype === 'broadway') return 'broadway_straight';
  }
  if (exactHand.primaryCategory === 'straight_flush') {
    if (exactHand.madeHandSubtype === 'wheel') return 'wheel_straight_flush';
    if (exactHand.madeHandSubtype === 'royal') return 'royal_flush';
  }
  return exactHand.relationship || exactHand.primaryCategory;
}

function handBoardSection(context, trustedFacts, rangeAnalysisFacts, warnings, depth) {
  const heroCards = Array.isArray(context.heroCards) ? [...context.heroCards] : [];
  const facts = [];
  const parts = [];
  if (heroCards.length === 2 && heroCards.every(validCard)) {
    facts.push(fact('hero_cards', {
      label: 'Hero cards', labelKey: 'analysis.fact.heroCards', value: heroCards,
      templateKey: 'analysis.hand.heroCards', fallback: 'Hero holds {cards}.',
      values: { cards: heroCards.join(' ') },
    }));
  }

  const exactHand = rangeAnalysisFacts?.exactHand;
  if (context.street === 'preflop' && exactHand?.available && exactHand.preflopHandClass) {
    const classification = exactHand.preflopKind === 'pair'
      ? 'pocket pair' : exactHand.preflopKind === 'suited' ? 'suited hand' : 'offsuit hand';
    facts.push(fact('preflop_hand_class', {
      label: 'Hand class', labelKey: 'analysis.fact.handClass', value: exactHand.preflopHandClass,
      templateKey: 'analysis.hand.preflopClass', fallback: 'This is a {classification}.',
      values: { classification, handClass: exactHand.preflopHandClass },
    }));
  }

  if (context.street !== 'preflop') {
    const legacyHand = rangeAnalysisFacts ? null : trustedFacts?.handClassification;
    const madeHand = madeHandLabelForAnalysis(exactHand, legacyHand);
    const draws = exactHand?.available
      ? drawLabelsForAnalysis(exactHand.draws)
      : (Array.isArray(legacyHand?.draws) ? legacyHand.draws.filter(Boolean).map(String) : []);
    if (madeHand) {
      facts.push(fact('made_hand', {
        label: 'Made hand', labelKey: 'analysis.fact.madeHand', value: String(madeHand),
        templateKey: 'analysis.hand.madeHand', fallback: 'Current hand classification: {madeHand}.',
        values: {
          madeHand: String(madeHand),
          primaryCategory: exactHand?.primaryCategory ?? null,
          madeHandSubtype: exactHand?.madeHandSubtype ?? null,
          playsBoard: exactHand?.playsBoard ?? false,
        },
      }));
      if (legacyHand?.source === 'heuristic_postflop_classifier') {
        warnings.push(warning(
          'heuristic_hand_classifier',
          'Hero-specific made-hand and draw labels are heuristic strategic features, separate from canonical hand ordering.',
        ));
      }
      if (exactHand?.components?.length) {
        facts.push(fact('hand_components', {
          label: 'Hand components', labelKey: 'analysis.fact.handComponents',
          value: [...exactHand.components],
          templateKey: 'analysis.hand.components', fallback: 'Relevant components: {components}.',
          values: { components: exactHand.components.join(', ') },
        }));
      }
    } else {
      warnings.push(warning('hand_classification_unavailable', 'No trusted made-hand classification was supplied.'));
    }
    if (draws.length) {
      facts.push(fact('draws', {
        label: 'Draws', labelKey: 'analysis.fact.draws', value: draws,
        templateKey: 'analysis.hand.draws', fallback: 'Detected draw labels: {draws}.',
        values: { draws: draws.join(', ') },
      }));
    }
    if (exactHand?.drawOuts?.available && exactHand.drawOuts.uniqueCompletionCardCount > 0) {
      const drawOuts = exactHand.drawOuts;
      facts.push(fact('draw_outs', {
        label: 'Outs', labelKey: 'analysis.fact.outs',
        value: {
          ...drawOuts,
          flush: { ...drawOuts.flush, completionCards: [...drawOuts.flush.completionCards] },
          straight: { ...drawOuts.straight, completionCards: [...drawOuts.straight.completionCards] },
          straightFlush: {
            ...drawOuts.straightFlush,
            completionCards: [...drawOuts.straightFlush.completionCards],
            completionResults: drawOuts.straightFlush.completionResults
              .map((completion) => ({ ...completion })),
          },
          overlaps: drawOuts.overlaps.map((entry) => ({
            card: entry.card, families: [...entry.families],
          })),
          uniqueCompletionCards: [...drawOuts.uniqueCompletionCards],
        },
        templateKey: 'analysis.hand.outs',
        fallback: 'Structural completion cards are not guaranteed winning or clean outs.',
        values: {
          uniqueCount: drawOuts.uniqueCompletionCardCount,
          overlapCount: drawOuts.overlaps.length,
          semantics: drawOuts.semantics,
        },
      }));
    }
    if (exactHand?.draws?.overcardCount > 0) {
      facts.push(fact('hero_overcards', {
        label: 'Overcards', labelKey: 'analysis.fact.overcards', value: exactHand.draws.overcardCount,
        templateKey: 'analysis.hand.overcards', fallback: 'Hero has {count} overcard(s) to the board.',
        values: { count: exactHand.draws.overcardCount },
      }));
    }

    const texture = rangeAnalysisFacts?.board;
    if (texture?.available) {
      facts.push(fact('board_pairing', {
        label: 'Board pairing', labelKey: 'analysis.fact.boardPairing', value: texture.paired,
        templateKey: texture.paired ? 'analysis.board.paired' : 'analysis.board.unpaired',
        fallback: texture.paired ? 'The board is paired.' : 'The board is unpaired.', values: {},
      }));
      const tone = texture.suitTexture === 'two_tone'
        ? 'two-tone' : texture.suitTexture === 'multi_suit' ? 'multi-suit' : texture.suitTexture;
      facts.push(fact('board_suits', {
        label: 'Suit texture', labelKey: 'analysis.fact.boardSuits', value: tone,
        templateKey: `analysis.board.${tone.replace('-', '')}`,
        fallback: 'Suit texture: {tone}.', values: { tone },
      }));
      facts.push(fact('board_connectivity', {
        label: 'Connectivity', labelKey: 'analysis.fact.boardConnectivity', value: texture.connectivity,
        templateKey: `analysis.board.${texture.connectivity}`,
        fallback: 'Rank texture: {connectivity}.', values: { connectivity: texture.connectivity.replace('_', ' ') },
      }));
      if (depth === 'detailed') {
        facts.push(fact('board_broadway_count', {
          label: 'Broadway cards', labelKey: 'analysis.fact.broadwayCount', value: texture.broadwayCount,
          templateKey: 'analysis.board.broadwayCount', fallback: 'The board contains {count} Broadway card(s).',
          values: { count: texture.broadwayCount },
        }));
        facts.push(fact('board_flush_state', {
          label: 'Flush completion', labelKey: 'analysis.fact.boardFlushState',
          value: texture.flushCompletionState,
          templateKey: 'analysis.board.flushState', fallback: 'Board flush state: {state}.',
          values: { state: texture.flushCompletionState },
        }));
        facts.push(fact('board_straight_state', {
          label: 'Straight completion', labelKey: 'analysis.fact.boardStraightState',
          value: {
            completed: texture.straightCompletedOnBoard,
            completionRanks: [...texture.straightCompletionRanks],
          },
          templateKey: 'analysis.board.straightState',
          fallback: 'Board straight-completion ranks: {ranks}.',
          values: {
            completed: texture.straightCompletedOnBoard,
            ranks: texture.straightCompletionRanks.join(', ') || 'none',
          },
        }));
      }
    } else {
      warnings.push(warning('board_analysis_unavailable', 'Board texture is unavailable for the current cards.'));
    }
  }

  return facts.length ? section('hand_board', 'Hand & Board', 'primary', facts, parts) : null;
}

function blockerSection(rangeAnalysisFacts) {
  if (!rangeAnalysisFacts || !rangeAnalysisFacts.blockers.heroCards.length) return null;
  const structural = rangeAnalysisFacts.blockers;
  const facts = [fact('hero_blocker_structure', {
    label: 'Hero card removal', labelKey: 'analysis.fact.heroBlockerStructure',
    value: {
      cards: [...structural.heroCards],
      rawCombosRemoved: structural.rawCombosRemovedByHeroCards,
      perCard: structural.heroCardEffects.map((entry) => ({ ...entry })),
    },
    templateKey: 'analysis.blockers.structural',
    fallback: 'Hero\'s two exact cards remove {count} of the 1,326 raw two-card combinations.',
    values: {
      cards: structural.heroCards.join(' '),
      count: structural.rawCombosRemovedByHeroCards,
    },
  })];
  for (const analysis of Object.values(rangeAnalysisFacts.ranges)) {
    if (!analysis.blockers.heroConditioningApplied) continue;
    facts.push(fact(`range_blocker_effect_${analysis.key}`, {
      label: 'Supplied-range effect', labelKey: 'analysis.fact.rangeBlockerEffect',
      value: {
        rangeKey: analysis.key,
        rangeLabel: analysis.label,
        removedComboCount: analysis.blockers.heroRemovedComboCount,
        removedKnownComboCount: analysis.blockers.heroRemovedKnownComboCount,
        removedKnownComboMass: analysis.blockers.heroRemovedKnownComboMass,
        perHeroCard: analysis.blockers.perHeroCard.map((entry) => ({ ...entry })),
        mostAffectedClasses: analysis.blockers.mostAffectedClasses.map((entry) => ({ ...entry })),
      },
      templateKey: 'analysis.blockers.suppliedRange',
      fallback: 'Hero cards remove known combo mass {mass} from {rangeLabel}.',
      values: {
        rangeLabel: analysis.label,
        mass: rounded(analysis.blockers.heroRemovedKnownComboMass, 2),
        physicalBefore: analysis.blockers.physicalEligibleComboCountBeforeHero,
        physicalAfter: analysis.blockers.physicalEligibleComboCountAfterHero,
        physicalRemoved: analysis.blockers.heroRemovedComboCount,
        knownAffected: analysis.blockers.heroRemovedKnownComboCount,
        knownCoverage: percent(analysis.eligibility.eligibleCoverageRatio, 1),
        knownMassAvailable: analysis.blockers.heroRemovedKnownComboCount > 0,
      },
    }));
  }
  return section('blockers', 'Blockers', 'primary', facts, [
    textPart(
      'analysis.blockers.noStrategicLabel',
      'These are structural card-removal facts, not a judgment that a blocker is good or bad for bluffing.',
      {},
      'limitation',
    ),
  ]);
}

function bluffPressureSection(bluffAnalysisFacts) {
  if (!bluffAnalysisFacts) return null;
  const facts = [];
  const action = bluffAnalysisFacts.action;
  const economics = bluffAnalysisFacts.economics;
  const structure = bluffAnalysisFacts.handStructure;
  if (action) {
    facts.push(fact('bluff_action', {
      label: 'Current action', labelKey: 'analysis.fact.bluffAction', value: action.type,
      templateKey: 'analysis.bluff.action', fallback: 'Current analyzed action: {action}.',
      values: {
        action: action.label,
        actionType: action.type,
        probability: Number.isFinite(action.probability) ? percent(action.probability, 0) : null,
      },
    }));
  }
  if (economics.availability === 'available') {
    facts.push(
      fact('bluff_risk', {
        kind: 'derived', label: 'Risk', labelKey: 'analysis.fact.bluffRisk',
        value: economics.riskBb, unit: 'bb',
        templateKey: 'analysis.bluff.risk', fallback: 'Incremental risk: {risk}.',
        values: { risk: bb(economics.riskBb) },
      }),
      fact('bluff_immediate_reward', {
        kind: 'derived', label: 'Immediate reward', labelKey: 'analysis.fact.bluffReward',
        value: economics.immediateRewardBb, unit: 'bb',
        templateKey: 'analysis.bluff.reward', fallback: 'Immediate reward if all relevant opponents fold: {reward}.',
        values: { reward: bb(economics.immediateRewardBb) },
      }),
      fact('bluff_break_even_folds', {
        kind: 'derived',
        label: economics.foldRequirementKind === 'required_all_opponents_fold_frequency'
          ? 'Required all-opponents-fold frequency' : 'Required fold frequency',
        labelKey: economics.foldRequirementKind === 'required_all_opponents_fold_frequency'
          ? 'analysis.fact.requiredAllOpponentsFoldFrequency'
          : 'analysis.fact.requiredFoldFrequency',
        value: economics.breakEvenFoldFrequency,
        templateKey: 'analysis.bluff.breakEven',
        fallback: 'Break-even folds for a zero-equity bluff: {frequency}.',
        values: {
          frequency: percent(economics.breakEvenFoldFrequency, 1),
          opponentCount: economics.opponentCount,
          requirementKind: economics.foldRequirementKind,
        },
      }),
    );
  } else {
    facts.push(fact('bluff_economics_availability', {
      kind: 'availability',
      label: 'Break-even fold requirement',
      labelKey: 'analysis.fact.breakEvenFoldRequirement',
      value: economics.availability,
      templateKey: 'analysis.bluff.unavailable',
      fallback: 'Break-even fold requirement unavailable: {reason}.',
      values: { reason: economics.unavailableReason },
    }));
  }
  if (structure.availability === 'available') {
    facts.push(fact('semibluff_structure', {
      label: 'Semibluff', labelKey: 'analysis.fact.semibluff',
      value: {
        classification: structure.classification,
        madeHand: structure.madeHand,
        madeHandRelationship: structure.madeHandRelationship,
        drawLabels: [...structure.drawLabels],
        overcardCount: structure.overcardCount,
      },
      templateKey: 'analysis.bluff.structure',
      fallback: 'Structural bluff candidate: {classification}.',
      values: {
        classification: structure.classification,
        drawCount: structure.drawLabels.length,
        structuralCards: structure.structuralImprovementCardCount,
        overcardCount: structure.overcardCount,
      },
    }));
    facts.push(fact('bluff_structural_improvement_cards', {
      label: 'Structural improvement cards',
      labelKey: 'analysis.fact.structuralImprovementCards',
      value: structure.structuralImprovementCardCount,
      templateKey: 'analysis.bluff.structuralCards',
      fallback: '{count} unique structural improvement cards; no Equity is inferred.',
      values: { count: structure.structuralImprovementCardCount },
    }));
  }
  if (bluffAnalysisFacts.riverReference.availability === 'available') {
    const reference = bluffAnalysisFacts.riverReference;
    facts.push(fact('river_bluff_value_reference', {
      kind: 'reference',
      label: 'River balanced-range reference',
      labelKey: 'analysis.fact.riverBalancedRangeReference',
      value: { ...reference, assumptions: [...reference.assumptions] },
      templateKey: 'analysis.bluff.riverReference',
      fallback: 'Simplified river reference: 1 bluff per {valueUnits} value bets; bluff share {share}.',
      values: {
        bluffUnits: 1,
        valueUnits: rounded(1 / reference.bluffToValueRatio, 3),
        share: percent(reference.bluffShareOfBettingRange, 1),
      },
    }));
  }
  return section('bluff_pressure', 'Bluff & Pressure', 'primary', facts, [
    textPart(
      'analysis.bluff.requirementNotPrediction',
      'The break-even requirement is mathematical pressure, not a prediction of how often an opponent folds.',
      {},
      'limitation',
    ),
    textPart(
      'analysis.bluff.blockerQualityUnavailable',
      'Strategic blocker quality is unavailable without an explicit continue/fold or value/bluff partition.',
      {},
      'limitation',
    ),
  ]);
}

function positiveCompositionEntries(group) {
  return Object.entries(group || {})
    .filter(([, metric]) => metric.knownComboMass > 0)
    .sort((left, right) => right[1].knownComboMass - left[1].knownComboMass)
    .map(([key, metric]) => ({
      key,
      knownComboMass: metric.knownComboMass,
      normalizedShare: metric.normalizedShare,
    }));
}

function rangeSection(rangeAnalysisFacts, warnings) {
  if (!rangeAnalysisFacts) return null;
  const analyses = Object.values(rangeAnalysisFacts.ranges);
  if (!analyses.length) {
    warnings.push(warning(
      'range_source_unavailable',
      'No explicit canonical weighted range was supplied. Riverline does not promote heuristic samples or Matrix representatives into range truth.',
    ));
    return section('range', 'Range', 'supporting', [fact('range_availability', {
      kind: 'availability',
      label: 'Supplied range', labelKey: 'analysis.fact.suppliedRange', value: 'unavailable',
      templateKey: 'analysis.range.unavailable',
      fallback: 'No explicit weighted range is attached to this decision.',
      values: {},
    })]);
  }

  const facts = [];
  for (const analysis of analyses) {
    const coveragePercent = percent(analysis.eligibility.eligibleCoverageRatio, 1);
    facts.push(fact(`supplied_range_summary_${analysis.key}`, {
      label: analysis.label, labelKey: 'analysis.fact.suppliedRange',
      value: {
        rangeKey: analysis.key,
        role: analysis.role,
        state: analysis.inspection.state,
        knownEligibleComboMass: analysis.eligibility.knownEligibleComboMass,
        knownEligibleComboCount: analysis.eligibility.knownEligibleComboCount,
        unknownEligibleComboCount: analysis.eligibility.unknownEligibleComboCount,
        eligibleCoverageRatio: analysis.eligibility.eligibleCoverageRatio,
        normalizationAvailable: analysis.normalization.available,
      },
      templateKey: 'analysis.range.summary',
      fallback: '{rangeLabel}: known combo mass after blockers {mass}; known coverage {coverage}.',
      values: {
        rangeLabel: analysis.label,
        mass: rounded(analysis.eligibility.knownEligibleComboMass, 2),
        coverage: coveragePercent,
        state: analysis.inspection.state,
        fullyUnknown: analysis.inspection.fullyUnknown,
        eligible: analysis.eligibility.eligibleComboCount,
        known: analysis.eligibility.knownEligibleComboCount,
        unknown: analysis.eligibility.unknownEligibleComboCount,
      },
    }));
    const primary = analysis.composition.postflop
      ? positiveCompositionEntries(analysis.composition.postflop.primary)
      : positiveCompositionEntries(analysis.composition.preflop.categories);
    if (primary.length) {
      facts.push(fact(`supplied_range_composition_${analysis.key}`, {
        label: 'Known composition', labelKey: 'analysis.fact.rangeComposition',
        value: primary,
        templateKey: 'analysis.range.composition',
        fallback: 'Known composition is reported as combo mass; normalized shares appear only for complete positive-mass ranges.',
        values: { rangeLabel: analysis.label },
      }));
    }
    const rangeDraws = positiveCompositionEntries(analysis.composition.postflop?.draws);
    if (rangeDraws.length) {
      facts.push(fact(`supplied_range_draws_${analysis.key}`, {
        label: 'Known draw mass', labelKey: 'analysis.fact.rangeDraws',
        value: rangeDraws,
        templateKey: 'analysis.range.draws',
        fallback: 'Draw attributes overlap and do not sum to 100%.',
        values: { rangeLabel: analysis.label },
      }));
    }
    if (!analysis.inspection.complete) {
      warnings.push(warning(
        `partial_range_${analysis.key}`,
        `${analysis.label} is partial. Known mass and coverage are shown without extrapolating unresolved combos.`,
        'info',
        { rangeLabel: analysis.label },
        'analysis.warning.partial_range',
      ));
    }
  }
  return section('range', 'Supplied Range', 'supporting', facts, [
    textPart(
      'analysis.range.noAdvantageClaim',
      'Composition and blocker conditioning do not establish range advantage, nut advantage, action EV, or solver frequencies.',
      {},
      'limitation',
    ),
  ]);
}

function analysisFactSources(rangeAnalysisFacts, authority, strategyProvenance) {
  const sources = [{
    group: 'strategy',
    label: 'Strategy',
    labelKey: 'analysis.source.strategy',
    source: strategyProvenance.source,
    sourceLabel: strategyProvenance.label,
    sourceLabelKey: strategyProvenance.labelKey,
    sourceSchemaVersion: STRATEGY_RESULT_SCHEMA_VERSION,
    sourceVersion: strategyProvenance.sourceVersion,
    sourceAuthority: strategyProvenance.authority,
    sourceCoverage: strategyProvenance.contextCoverage.kind,
  }];
  if (!rangeAnalysisFacts) return sources;
  sources.push(
    {
      group: 'exact_hand',
      label: 'Exact hand',
      labelKey: 'analysis.source.exactHand',
      source: rangeAnalysisFacts.provenance.exactHand.kind,
      sourceLabel: rangeAnalysisFacts.provenance.exactHand.label || authority.label,
      sourceLabelKey: `analysis.sourceLabel.${rangeAnalysisFacts.provenance.exactHand.kind}`,
      sourceSchemaVersion: rangeAnalysisFacts.provenance.exactHand.sourceSchemaVersion,
    },
    {
      group: 'board',
      label: 'Board',
      labelKey: 'analysis.source.board',
      source: rangeAnalysisFacts.provenance.board.kind,
      sourceLabel: rangeAnalysisFacts.provenance.board.label || authority.label,
      sourceLabelKey: `analysis.sourceLabel.${rangeAnalysisFacts.provenance.board.kind}`,
      sourceSchemaVersion: rangeAnalysisFacts.provenance.board.sourceSchemaVersion,
    },
  );
  const deadCardCount = rangeAnalysisFacts.blockers.knownCards.length
    - rangeAnalysisFacts.blockers.heroCards.length
    - (rangeAnalysisFacts.board.available ? rangeAnalysisFacts.board.cardCount : 0);
  if (deadCardCount > 0) {
    sources.push({
      group: 'dead_cards',
      label: 'Dead cards',
      labelKey: 'analysis.source.deadCards',
      source: rangeAnalysisFacts.provenance.deadCards.kind,
      sourceLabel: rangeAnalysisFacts.provenance.deadCards.label || authority.label,
      sourceLabelKey: `analysis.sourceLabel.${rangeAnalysisFacts.provenance.deadCards.kind}`,
      sourceSchemaVersion: rangeAnalysisFacts.provenance.deadCards.sourceSchemaVersion,
    });
  }
  if (rangeAnalysisFacts.decision) {
    sources.push({
      group: 'decision_context',
      label: 'Decision context',
      labelKey: 'analysis.source.decisionContext',
      source: authority.type,
      sourceLabel: authority.label,
      sourceLabelKey: authority.labelKey,
      sourceSchemaVersion: rangeAnalysisFacts.decision.sourceSchemaVersion,
    });
  }
  for (const analysis of Object.values(rangeAnalysisFacts.ranges)) {
    sources.push({
      group: `range_${analysis.key}`,
      label: analysis.label,
      labelKey: 'analysis.source.suppliedRange',
      source: analysis.source.kind,
      sourceLabel: analysis.source.label,
      sourceLabelKey: `analysis.sourceLabel.${analysis.source.kind}`,
      sourceSchemaVersion: analysis.source.sourceSchemaVersion,
    });
  }
  return sources;
}

function positionSection(context, trustedFacts) {
  const facts = [
    fact('hero_position', {
      label: 'Hero position', labelKey: 'analysis.fact.heroPosition', value: context.heroPosition,
      templateKey: 'analysis.position.hero', fallback: 'Hero acts from {position}.',
      values: { position: context.heroPosition },
    }),
    fact('table_size', {
      label: 'Table size', labelKey: 'analysis.fact.tableSize', value: context.tableSize, unit: 'players',
      templateKey: 'analysis.position.tableSize', fallback: 'The table has {tableSize} seated players.',
      values: { tableSize: context.tableSize },
    }),
  ];
  if (context.street !== 'preflop' && ['in_position', 'out_of_position'].includes(trustedFacts?.positionRelation)) {
    const inPosition = trustedFacts.positionRelation === 'in_position';
    facts.push(fact('postflop_position_relation', {
      label: 'Postflop relation', labelKey: 'analysis.fact.positionRelation', value: trustedFacts.positionRelation,
      templateKey: inPosition ? 'analysis.position.inPosition' : 'analysis.position.outOfPosition',
      fallback: inPosition ? 'Trusted state marks Hero as in position.' : 'Trusted state marks Hero as out of position.', values: {},
    }));
  }
  if (context.street === 'preflop' && context.heroPosition === 'BB' && context.lastAction === 'unopened') {
    facts.push(fact('big_blind_check_option', {
      label: 'Big blind option', labelKey: 'analysis.fact.bigBlindOption', value: true,
      templateKey: 'analysis.position.bbCheckOption', fallback: 'The Big Blind has a free check option in this supplied context.', values: {},
    }));
  }
  return section('position', 'Position', 'context', facts);
}

function potOddsSection(context) {
  const potBeforeCallBb = finiteNumber(context.currentPotBb ?? context.potBb);
  const callAmountBb = finiteNumber(context.callAmountBb);
  if (potBeforeCallBb === null || potBeforeCallBb < 0) return null;
  const facts = [fact('pot_before_action', {
    label: 'Pot before action', labelKey: 'analysis.fact.potBeforeAction', value: potBeforeCallBb, unit: 'bb',
    templateKey: 'analysis.pot.current', fallback: 'The current pot is {pot}.', values: { pot: bb(potBeforeCallBb) },
  })];
  if (callAmountBb !== null && callAmountBb >= 0) {
    facts.push(fact('call_amount', {
      label: 'Amount to call', labelKey: 'analysis.fact.callAmount', value: callAmountBb, unit: 'bb',
      templateKey: 'analysis.pot.callAmount', fallback: 'The trusted amount to call is {callAmount}.',
      values: { callAmount: bb(callAmountBb) },
    }));
    if (callAmountBb > 0) {
      const potAfterCallBb = finiteNumber(context.actorContestablePotAfterCallBb);
      const requiredEquity = finiteNumber(context.requiredRawEquity);
      if (potAfterCallBb !== null && potAfterCallBb > 0
        && requiredEquity !== null && requiredEquity >= 0 && requiredEquity <= 1) facts.push(
        fact('pot_after_call', {
          kind: 'factual', label: 'Contestable if you call', labelKey: 'analysis.fact.potAfterCall', value: potAfterCallBb, unit: 'bb',
          templateKey: 'analysis.pot.afterCall', fallback: 'Calling {callAmount} makes the contested pot {potAfterCall}.',
          values: { callAmount: bb(callAmountBb), potAfterCall: bb(potAfterCallBb) },
        }),
        fact('required_raw_equity', {
          kind: 'derived', label: 'Required raw equity', labelKey: 'analysis.fact.requiredEquity', value: requiredEquity, unit: 'probability',
          templateKey: 'analysis.pot.requiredEquity', fallback: 'The raw break-even equity is {requiredEquity}.',
          values: { requiredEquity: percent(requiredEquity, 1) },
        }),
      );
      else facts.push(fact('call_price_availability', {
        kind: 'availability', label: 'Contestable call price', labelKey: 'analysis.fact.callPrice', value: 'unavailable',
        templateKey: 'analysis.pot.priceUnavailable',
        fallback: 'Exact actor-relative call economics are unavailable for this context.',
        values: {},
      }));
    }
  } else {
    facts.push(fact('call_price_availability', {
      kind: 'availability', label: 'Call price', labelKey: 'analysis.fact.callPrice', value: 'unavailable',
      templateKey: 'analysis.pot.priceUnavailable',
      fallback: 'The exact call price is unavailable because this context does not supply Hero\'s current-street contribution.',
      values: {},
    }));
  }
  return section('pot_odds', 'Pot & Odds', 'primary', facts, callAmountBb !== null && callAmountBb > 0 ? [
    textPart(
      'analysis.pot.notSufficient',
      'Pot odds are a price, not a complete strategy recommendation.',
      {},
      'interpretation',
    ),
  ] : []);
}

function sprSection(context, warnings) {
  if (context.street === 'preflop' || context.opponentCount !== 1) return null;
  const stackBb = finiteNumber(context.effectiveStackBb);
  const afterCallBb = finiteNumber(context.actorContestablePotAfterCallBb);
  const callAmountBb = finiteNumber(context.callAmountBb);
  const potBb = afterCallBb !== null && callAmountBb !== null
    ? afterCallBb - callAmountBb
    : null;
  if (stackBb === null || potBb === null || stackBb < 0 || potBb <= 0) return null;
  const spr = stackBb / potBb;
  const category = spr < 4 ? 'low' : spr <= 10 ? 'medium' : 'high';
  return section('spr', 'Stack / SPR', 'supporting', [
    fact('stack_bb', {
      label: 'Effective stack', labelKey: 'analysis.fact.stackBb', value: stackBb, unit: 'bb',
      templateKey: 'analysis.spr.stack', fallback: 'The heads-up effective stack is {stack}.',
      values: { stack: bb(stackBb) },
    }),
    fact('spr', {
      kind: 'derived', label: 'SPR', labelKey: 'analysis.fact.spr', value: spr, unit: 'ratio',
      templateKey: 'analysis.spr.value', fallback: 'Stack-to-pot ratio is {spr}, a broadly {category} SPR.',
      values: { spr: rounded(spr, 1), category },
    }),
  ]);
}

function historyText(record) {
  const amount = record.amountLabel ? ` ${record.amountLabel}` : '';
  return `${record.actorLabel}: ${record.actionLabel}${amount}.`;
}

function actionContextSection(context, authority, history, depth, warnings) {
  const facts = [
    fact('context_authority', {
      label: 'Context authority', labelKey: 'analysis.fact.contextAuthority', value: authority.type,
      templateKey: `analysis.authority.${authority.type}`, fallback: '{authority} supplies the decision facts.',
      values: { authority: authority.label },
    }),
    fact('last_action', {
      label: 'Prior-action setting', labelKey: 'analysis.fact.lastAction', value: context.lastAction,
      templateKey: 'analysis.action.lastAction', fallback: 'Prior-action context: {lastAction}.',
      values: { lastAction: String(context.lastAction || 'unavailable').replaceAll('_', ' ') },
    }),
  ];
  if (context.facingSizeBb > 0) {
    facts.push(fact('facing_size', {
      label: 'Facing size', labelKey: 'analysis.fact.facingSize', value: context.facingSizeBb, unit: 'bb',
      templateKey: 'analysis.action.facing', fallback: 'Hero faces {facingSize}.',
      values: { facingSize: bb(context.facingSizeBb) },
    }));
  } else {
    facts.push(fact('no_voluntary_wager_faced', {
      label: 'Facing voluntary wager', labelKey: 'analysis.fact.noFacingWager', value: false,
      templateKey: 'analysis.action.noFacing', fallback: 'Hero is not facing a voluntary wager.', values: {},
    }));
  }

  if (authority.type === 'scenario') {
    warnings.push(warning(
      'lossy_action_history',
      'Scenario Analysis supplies a decision snapshot, not a validated legal action history.',
    ));
  } else if (history.length) {
    const visibleHistory = depth === 'concise' ? history.slice(-2) : history;
    visibleHistory.forEach((record) => facts.push(fact(`history_${record.sequence}`, {
      label: 'Action history', labelKey: 'analysis.fact.actionHistory', value: record,
      templateKey: 'analysis.action.historyRecord', fallback: '{historyText}',
      values: { historyText: historyText(record) },
    })));
  }
  return section('action_context', 'Action Context', 'context', facts);
}

function strategySection(context, actions, source, depth) {
  if (!actions.length) return null;
  const shape = strategyShape(actions);
  const primary = actions[0];
  const secondary = actions.find((entry, index) => index > 0
    && entry.probability >= ANALYSIS_THRESHOLDS.meaningfulProbability) || actions[1] || null;
  const facts = actions
    .filter((entry) => depth === 'detailed'
      || entry === primary
      || entry.probability >= ANALYSIS_THRESHOLDS.meaningfulProbability)
    .map((entry) => fact(`strategy_action_${entry.action.type}_${entry.index}`, {
      label: entry.label, labelKey: 'analysis.fact.actionProbability', value: entry.probability, unit: 'probability',
      templateKey: 'analysis.strategy.actionProbability', fallback: '{action}: {probability}.',
      values: { action: entry.label, probability: percent(entry.probability, 0) },
    }));
  const variant = stableHash([
    context.street, context.heroPosition, context.heroCards, context.board,
    context.potBb, context.facingSizeBb, source, primary.label, rounded(primary.probability, 4), shape,
  ]) % 2;
  let part;
  if (shape === 'pure') {
    part = variant === 0
      ? textPart('analysis.strategy.pure.primary', '{action} is effectively pure at {probability} in the displayed result.', {
        action: primary.label, probability: percent(primary.probability, 0),
      })
      : textPart('analysis.strategy.pure.alternate', 'The displayed result puts {probability} on {action}, above the pure-action threshold.', {
        action: primary.label, probability: percent(primary.probability, 0),
      });
  } else if (shape === 'dominant') {
    part = textPart('analysis.strategy.dominant', 'This is mostly {primary} ({primaryProbability}){secondaryClause}.', {
      primary: primary.label,
      primaryProbability: percent(primary.probability, 0),
      secondaryClause: secondary ? `, with ${secondary.label} at ${percent(secondary.probability, 0)}` : '',
    });
  } else if (shape === 'mixed') {
    part = variant === 0
      ? textPart('analysis.strategy.mixed.between', 'The result mixes between {primary} ({primaryProbability}) and {secondary} ({secondaryProbability}).', {
        primary: primary.label, primaryProbability: percent(primary.probability, 0),
        secondary: secondary?.label || 'another action', secondaryProbability: percent(secondary?.probability || 0, 0),
      })
      : textPart('analysis.strategy.mixed.noDominant', 'No action reaches the dominant threshold; {primary} leads at {primaryProbability}.', {
        primary: primary.label, primaryProbability: percent(primary.probability, 0),
      });
  } else {
    part = textPart('analysis.strategy.fragmented', '{action} leads the displayed result at {probability}; remaining weight is spread across minor actions.', {
      action: primary.label, probability: percent(primary.probability, 0),
    });
  }
  return section('strategy_mix', 'Strategy Mix', 'primary', facts, [part]);
}

function sizingSection(context, actions) {
  const sized = actions.filter((entry) => entry.action.amountBb !== null || entry.action.potFraction !== null);
  if (!sized.length) return null;
  const facts = sized.map((entry, index) => {
    const amount = entry.action.amountBb;
    const explicitFraction = entry.action.potFraction;
    const derivedFraction = explicitFraction === null && amount !== null && context.potBb > 0
      ? amount / context.potBb : null;
    const fraction = explicitFraction ?? derivedFraction;
    const values = {
      action: entry.label,
      amount: amount === null ? 'not supplied' : formatSuggestedSizingBb(amount),
      potShare: fraction === null ? 'not supplied' : percent(fraction, 0),
    };
    return fact(`sizing_${entry.action.type}_${index}`, {
      kind: derivedFraction === null ? 'fact' : 'derived',
      label: entry.label, labelKey: 'analysis.fact.actionSizing',
      value: { amountBb: amount, potFraction: explicitFraction, derivedPotFraction: derivedFraction },
      templateKey: 'analysis.sizing.known',
      fallback: amount !== null && fraction !== null
        ? '{action} reports {amount}, about {potShare} of the current pot.'
        : amount !== null ? '{action} reports {amount}.' : '{action} reports a {potShare} pot fraction.',
      values,
    });
  });
  return section('sizing', 'Sizing', 'supporting', facts, [
    textPart('analysis.sizing.noRationale', 'The source supplies the size, but no sizing rationale metadata.', {}, 'interpretation'),
  ]);
}

function equitySection(trustedFacts, warnings) {
  const equity = boundedProbability(trustedFacts?.equity?.heroEquity);
  if (equity === null) {
    warnings.push(warning('equity_unavailable', 'No already-calculated trusted equity result was supplied.'));
    return null;
  }
  const method = trustedFacts.equity.method ? String(trustedFacts.equity.method) : 'unspecified';
  return section('equity', 'Equity', 'supporting', [
    fact('hero_equity', {
      label: 'Hero equity', labelKey: 'analysis.fact.heroEquity', value: equity, unit: 'probability',
      templateKey: 'analysis.equity.hero', fallback: 'The supplied equity result gives Hero {equity}.',
      values: { equity: percent(equity, 1) },
    }),
    fact('equity_method', {
      label: 'Equity method', labelKey: 'analysis.fact.equityMethod', value: method,
      templateKey: 'analysis.equity.method', fallback: 'Equity source method: {method}.', values: { method },
    }),
  ]);
}

function heuristicSampleSection(strategyResult, warnings) {
  if (strategyResult?.source !== STRATEGY_SOURCES.HEURISTIC_POSTFLOP) return null;
  const sample = strategyResult?.details?.heuristicSample;
  const sampledEquity = boundedProbability(sample?.eq);
  if (sampledEquity === null || sample?.provenance !== 'heuristic_conditional_sample') {
    warnings.push(warning(
      'heuristic_sample_unavailable',
      'The postflop fallback did not supply its already-resolved conditional sample.',
    ));
    return null;
  }
  const facts = [
    fact('heuristic_sampled_equity', {
      label: 'Heuristic sampled equity', labelKey: 'analysis.fact.heuristicSampledEquity',
      value: sampledEquity, unit: 'probability',
      templateKey: 'analysis.heuristicSample.equity',
      fallback: 'The fallback estimated {equity} showdown share against its assumed opponent range.',
      values: { equity: percent(sampledEquity, 1) },
    }),
  ];
  if (Number.isInteger(sample.completedSamples) && sample.completedSamples > 0) {
    facts.push(fact('heuristic_samples_completed', {
      label: 'Completed samples', labelKey: 'analysis.fact.heuristicSamplesCompleted',
      value: sample.completedSamples, unit: 'trials',
      templateKey: 'analysis.heuristicSample.completed',
      fallback: '{samples} valid trials were completed.',
      values: { samples: sample.completedSamples },
    }));
  }
  if (Number.isInteger(sample.opponentCount) && sample.opponentCount > 0) {
    facts.push(fact('heuristic_opponent_count', {
      label: 'Sampled opponents', labelKey: 'analysis.fact.heuristicOpponentCount',
      value: sample.opponentCount, unit: 'players',
      templateKey: 'analysis.heuristicSample.opponents',
      fallback: 'Each valid trial allocated {opponents} opponent(s).',
      values: { opponents: sample.opponentCount },
    }));
  }
  if (boundedProbability(sample.rangeFraction) !== null) {
    facts.push(fact('heuristic_range_fraction', {
      label: 'Assumed candidate range', labelKey: 'analysis.fact.heuristicRangeFraction',
      value: boundedProbability(sample.rangeFraction), unit: 'probability',
      templateKey: 'analysis.heuristicSample.rangeFraction',
      fallback: 'The crude assumed range contains {rangeFraction} of currently unblocked starting combinations.',
      values: { rangeFraction: percent(sample.rangeFraction, 1) },
    }));
  }
  warnings.push(warning(
    'heuristic_conditional_sample',
    'This sampled fact is conditional on crude assumed opponent ranges and is not canonical Equity.',
  ));
  return section('heuristic_sample', 'Estimated Strength', 'supporting', facts, [
    textPart(
      'analysis.heuristicSample.limitation',
      'The strategy and this displayed fact use the same resolved sample; no second sample is calculated for explanation.',
      {},
      'interpretation',
    ),
  ]);
}

function unavailableReasonFor(context, strategyResult, explicitReason) {
  if (explicitReason) return explicitReason;
  if (!context) return 'invalid_context';
  if (!Array.isArray(context.heroCards) || context.heroCards.length !== 2
    || context.heroCards.some((card) => !validCard(card))) return 'missing_hero_cards';
  const boardCount = expectedBoardCount(context.street);
  if (boardCount !== null && (!Array.isArray(context.board) || context.board.length !== boardCount)) {
    return 'waiting_for_board';
  }
  if (!strategyResult || strategyResult.source === 'unavailable'
    || !Array.isArray(strategyResult.actions) || !strategyResult.actions.some((entry) => Number(entry.probability) > 0)) {
    return 'strategy_unavailable';
  }
  return null;
}

export function createAnalysisExplanation({
  decisionContext,
  strategyResult,
  historicalStrategyEvidence = null,
  trustedFacts = {},
  rangeAnalysisFacts = null,
  bluffAnalysisFacts = null,
  authority = 'scenario',
  depth = 'detailed',
  unavailableReason = null,
} = {}) {
  if (decisionContext !== null && decisionContext !== undefined
    && decisionContext.schemaVersion !== DECISION_CONTEXT_SCHEMA_VERSION) {
    throw new TypeError('Expected DecisionContext decision-context/v1');
  }
  if (strategyResult !== null && strategyResult !== undefined
    && strategyResult.schemaVersion !== STRATEGY_RESULT_SCHEMA_VERSION) {
    throw new TypeError('Expected StrategyResult strategy-result/v1');
  }
  if (rangeAnalysisFacts !== null && rangeAnalysisFacts !== undefined
    && rangeAnalysisFacts.schemaVersion !== RANGE_ANALYSIS_FACTS_SCHEMA_VERSION) {
    throw new TypeError(`Expected ${RANGE_ANALYSIS_FACTS_SCHEMA_VERSION}`);
  }
  if (bluffAnalysisFacts !== null && bluffAnalysisFacts !== undefined
    && bluffAnalysisFacts.schemaVersion !== BLUFF_ANALYSIS_FACTS_SCHEMA_VERSION) {
    throw new TypeError(`Expected ${BLUFF_ANALYSIS_FACTS_SCHEMA_VERSION}`);
  }
  if (!['concise', 'detailed'].includes(depth)) throw new TypeError('Analysis depth must be concise or detailed');

  const normalizedAuthority = normalizeAuthority(authority);
  const history = normalizeHistory(trustedFacts?.actionHistory, normalizedAuthority.type);
  const truth = historicalStrategyEvidence ? historicalStrategyTruth(historicalStrategyEvidence)
    : projectStrategyTruth({ strategyResult, decisionContext });
  const claimPolicy = truth.claimPolicy;
  const provenance = provenanceFor(strategyResult, claimPolicy);
  const warnings = [];
  const actions = claimPolicy.claims[STRATEGY_CLAIMS.STRATEGY_PRESENTATION]
    ? normalizeActions(
      strategyResult,
      claimPolicy.claims[STRATEGY_CLAIMS.ACTION_EV],
    )
    : [];
  const actionAnalysis = makeActionAnalysis(actions);
  const reason = unavailableReasonFor(decisionContext, strategyResult, unavailableReason)
    || (claimPolicy.availability === 'unavailable' ? 'strategy_unavailable' : null);
  const sections = [];

  if (decisionContext) {
    const handBoard = handBoardSection(
      decisionContext,
      trustedFacts,
      rangeAnalysisFacts,
      warnings,
      depth,
    );
    if (handBoard) sections.push(handBoard);
    const bluffPressure = bluffPressureSection(bluffAnalysisFacts);
    if (bluffPressure) sections.push(bluffPressure);
    const blockers = blockerSection(rangeAnalysisFacts);
    if (blockers) sections.push(blockers);
    const range = rangeSection(rangeAnalysisFacts, warnings);
    if (range) sections.push(range);
    sections.push(positionSection(decisionContext, trustedFacts));
    const potOdds = potOddsSection(decisionContext);
    if (potOdds) sections.push(potOdds);
    const spr = sprSection(decisionContext, warnings);
    if (spr) sections.push(spr);
    sections.push(actionContextSection(decisionContext, normalizedAuthority, history, depth, warnings));
    const strategy = strategySection(decisionContext, actions, provenance.source, depth);
    if (strategy) sections.push(strategy);
    const heuristicSample = heuristicSampleSection(strategyResult, warnings);
    if (heuristicSample) sections.push(heuristicSample);
    const sizing = claimPolicy.claims[STRATEGY_CLAIMS.ACTION_SIZING]
      ? sizingSection(decisionContext, actions)
      : null;
    if (sizing) sections.push(sizing);
    const equity = equitySection(trustedFacts, warnings);
    if (equity) sections.push(equity);
  } else {
    warnings.push(warning('decision_context_unavailable', 'DecisionContext v1 is unavailable.'));
  }

  claimPolicy.limitations.forEach((limitation) => warnings.push(warning(
    limitation.code,
    limitation.message,
    limitation.priority >= 70 ? 'warning' : 'info',
    {},
    limitation.messageKey,
  )));
  const referenceCoverageCopy = referenceCoveragePresentation(truth.selectedReference);
  warnings.push(warning('selected_reference_coverage', referenceCoverageCopy.messageKey,
    'info', {}, referenceCoverageCopy.messageKey));
  if (actions.length && !claimPolicy.claims[STRATEGY_CLAIMS.ACTION_EV]) {
    warnings.push(warning('ev_unavailable', 'The strategy source supplies no action EV comparison.'));
  }
  if (Array.isArray(strategyResult?.warnings) && strategyResult.warnings.length) {
    warnings.push(warning(
      'strategy_source_warning',
      `The strategy source reported ${strategyResult.warnings.length} additional limitation(s).`,
      'warning',
    ));
  }
  if (reason) warnings.push(warning(reason, UNAVAILABLE_COPY[reason] || UNAVAILABLE_COPY.strategy_unavailable, 'warning'));

  const uniqueWarnings = [...new Map(warnings.map((entry) => [entry.code, entry])).values()];
  const availability = reason ? 'unavailable' : uniqueWarnings.length ? 'partial' : 'available';
  const leadingAction = actions[0] || null;
  const headline = reason ? 'Analysis unavailable' : 'Why this action?';
  const headlineKey = reason ? 'analysis.headline.unavailable' : 'analysis.headline.available';
  const summaryValues = reason ? { reason: UNAVAILABLE_COPY[reason] || UNAVAILABLE_COPY.strategy_unavailable } : {
    action: leadingAction?.label || strategyResult?.recommendation?.label || 'The recommendation',
    probability: leadingAction ? percent(leadingAction.probability, 0) : 'unknown',
    source: strategyTruthPresentation(truth).sourceLabel,
  };
  const summary = reason
    ? summaryValues.reason
    : formatAnalysisTemplate('{action} leads at {probability}. Source: {source}.', summaryValues);

  return deepFreeze({
    schemaVersion: ANALYSIS_EXPLANATION_SCHEMA_VERSION,
    depth,
    availability,
    unavailableReason: reason,
    headline,
    headlineKey,
    summary,
    summaryKey: reason ? `analysis.unavailable.${reason}` : 'analysis.summary.recommendation',
    summaryValues,
    sections,
    actionAnalysis,
    claimPolicy,
    truth,
    warnings: uniqueWarnings,
    provenance: {
      ...provenance,
      limitations: uniqueWarnings.map((entry) => entry.code),
    },
    factSources: analysisFactSources(rangeAnalysisFacts, normalizedAuthority, provenance),
    authority: {
      ...normalizedAuthority,
      historyAvailable: history.length > 0,
    },
  });
}
