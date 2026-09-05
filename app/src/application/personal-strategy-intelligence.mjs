import { PREFLOP_HAND_CLASSES } from '../../../shared/poker-domain/index.js';
import { createCanonicalPreflopStateFromSelection } from './range-calibration-service.mjs';
import { deriveDecisionContextFromPokerState } from './decision-context-from-poker-state.mjs';
import { createStrategyProvider } from './strategy-provider.mjs';
import { resolveHeuristicStrategy } from '../strategy/heuristic-strategy.mjs';
import { calibrationContextsEquivalent } from '../personal-strategy/domain.mjs';
import { createStrategyRangeLanguageFacts } from '../personal-strategy/range-language-facts.mjs';

export const PERSONAL_TEACH_NEXT_POLICY = 'personal-teach-next/v1';
// Presentation routing only: candidates arrive in the order established by the
// canonical mapping selector. Focus, coverage and repetition are handled there.
export function choosePersonalTeachingNext({ candidates = [], userTopic = null, provisional = null } = {}) {
  const candidate = candidates[0] ?? null;
  return Object.freeze({ schemaVersion: PERSONAL_TEACH_NEXT_POLICY, candidate,
    reasonKey: candidate?.mappingReasonKey ?? candidate?.reasons?.[0]?.messageKey
      ?? 'Choose an exact example or refine an existing answer.',
    provisional: Boolean(!userTopic && provisional), topic: userTopic ?? provisional?.followupTopic ?? null,
    action: candidate?.questionKind === 'conflict_resolution' ? 'inspect' : 'ask' });
}

// Explicit, bounded request only. No startup/hidden-surface provider work and
// no Equity invocation. Each representative is a legally generated decision.
export async function comparePersonalStrategyWithSource({ facts, selection, scope, provider = null, expectedRole = 'heuristic', assertCurrent = () => {} } = {}) {
  if (scope.context.decisionFamily !== 'preflop_rfi') {
    return { schemaVersion: 'personal-range-language-comparison/v1', kind: 'personal_to_source', compatible: false,
      reason: 'source_comparison_rfi_only', regions: [] };
  }
  const resolver = provider ?? createStrategyProvider({ fallbackResolver: resolveHeuristicStrategy });
  const entries = [];
  for (const handClass of PREFLOP_HAND_CLASSES) {
    assertCurrent();
    const generated = createCanonicalPreflopStateFromSelection(selection, { handClass });
    if (!calibrationContextsEquivalent(scope.context, generated.context)) throw new RangeError('Comparison context changed');
    const decisionContext = deriveDecisionContextFromPokerState(generated.state, generated.heroPlayerId);
    const strategyResult = await resolver.resolve(decisionContext);
    assertCurrent();
    entries.push({ handClass, strategyResult, decisionContext, calibrationContext: generated.context });
    if (entries.length % 8 === 0) {
      await new Promise((resolve) => setTimeout(resolve, 0));
      assertCurrent();
    }
  }
  return createStrategyRangeLanguageFacts({ personalFacts: facts, entries, sourceContext: scope.context, expectedRole });
}
