import { conditionHoldemRange, assertCardArray, assertUniqueKnownCards } from '../../../shared/poker-domain/index.js';
import { validatePersonalActionFamilyRange, rangeFoundationFingerprint } from './personal-strategy-weighted-range.mjs';
import { freezeLanguageData as freeze } from './natural-language-envelope.mjs';

export const RANGE_CONTINUATION_FACTS_VERSION = 'range-continuation-facts/v1';

// An unavailable trajectory checkpoint is useful evidence. This foundation does
// NOT multiply family frequencies into a reached-street range. A future exact
// combo/size frequency owner must own that separate quantitative operation.
export function createRangeContinuationFacts({ priorRange, priorNode = null, subject = priorRange?.subject,
  sourceRole = 'personal_intended', action = null, decisionContext = null, board = decisionContext?.board ?? [] } = {}) {
  validatePersonalActionFamilyRange(priorRange);
  if (sourceRole !== priorRange.sourceRole || rangeFoundationFingerprint(subject) !== rangeFoundationFingerprint(priorRange.subject)) {
    throw new RangeError('Continuation subject/source mismatch');
  }
  if (priorNode !== null) throw new RangeError('No reached-range node exists to continue in foundation v1');
  assertCardArray(board, 'continuation board'); assertUniqueKnownCards([{ label: 'continuation board', cards: board }]);
  const street = ({ 0: 'preflop', 3: 'flop', 4: 'turn', 5: 'river' })[board.length];
  if (!street) throw new RangeError('Invalid continuation board length');
  const reasons = ['selected_action_size_frequency_unavailable', 'prior_is_action_family_mass_not_reached_range'];
  if (action !== null) {
    if (!['fold', 'check', 'call', 'bet', 'raise', 'all_in'].includes(action.type)
      || action.semantics !== 'exact_action'
      || !['none', 'incremental_call', 'street_total_to'].includes(action.amountSemantics)) {
      throw new RangeError('Exact action and amount semantics required');
    }
    const passive = ['fold', 'check'].includes(action.type);
    if (passive ? action.amountBb !== null || action.amountSemantics !== 'none'
      : !Number.isFinite(action.amountBb) || action.amountBb <= 0
        || action.amountSemantics !== (action.type === 'call' ? 'incremental_call' : 'street_total_to')) {
      throw new RangeError('Incompatible action/size semantics');
    }
    if (action.type !== priorRange.action.type) throw new RangeError('Action family mismatch');
  } else reasons.push('exact_action_missing');
  if (!decisionContext) reasons.push('exact_decision_context_missing');
  else {
    if (decisionContext.schemaVersion !== 'decision-context/v1'
      || decisionContext.derivation?.source !== 'canonical_hand') throw new RangeError('Canonical DecisionContext required');
    if (decisionContext.street !== street || JSON.stringify(decisionContext.board) !== JSON.stringify(board)) {
      throw new RangeError('DecisionContext board/street mismatch');
    }
    // Calibration is not an exact historical decision identity; its equality
    // cannot certify a preflop action or a trajectory edge.
    reasons.push('calibration_to_exact_history_identity_unavailable');
  }
  const blockers = conditionHoldemRange(priorRange.range, board);
  const value = { schemaVersion: RANGE_CONTINUATION_FACTS_VERSION, derivationVersion: RANGE_CONTINUATION_FACTS_VERSION,
    subject, sourceRole, priorNode: null, priorRangeFingerprint: priorRange.fingerprint,
    action, board, street, decisionContext, availability: 'unavailable', unavailableReasons: reasons,
    conditionedRange: null, coverage: blockers.facts,
    boardRemoval: { basis: 'physical_removal_only_not_action_history', facts: blockers },
    provenance: { sourceVersions: priorRange.versions, sourceRange: priorRange.range.provenance },
  };
  return freeze(structuredClone({ ...value, fingerprint: rangeFoundationFingerprint(value) }));
}
