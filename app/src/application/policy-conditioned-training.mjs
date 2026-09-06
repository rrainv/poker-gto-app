import { validateOpponentPracticeRequest } from './synthetic-opponent-policy.mjs';
import { freezeOpponentData as freeze } from './opponent-actor-information.mjs';

export const POLICY_TRAINING_INTENT_VERSION = 'policy-conditioned-training-intent/v1';
export const POLICY_STUDY_THEMES = freeze(['play_policy', 'thin_value_questions',
  'bluff_catching_questions', 'raise_response_questions']);

// Training owns this educational envelope. Only opponentPractice crosses the
// bot boundary; no study theme is passed to the provider or answer evaluator.
export function createPolicyTrainingIntent({ opponentPractice, theme = 'play_policy' } = {}) {
  if (!POLICY_STUDY_THEMES.includes(theme)) throw new RangeError('Unsupported policy study theme; exact semantic drills are unavailable');
  return freeze({ schemaVersion: POLICY_TRAINING_INTENT_VERSION, mode: 'full_hand', theme,
    opponentPractice: validateOpponentPracticeRequest(opponentPractice),
    generation: 'new_canonical_full_hand', semanticTarget: 'not_guaranteed',
    assessment: 'existing_training_authority', syntheticAssumptionsOnly: true });
}

export function validatePolicyTrainingIntent(intent, opponentPractice = intent?.opponentPractice) {
  const expected = createPolicyTrainingIntent({ opponentPractice, theme: intent?.theme });
  // Compare structured content independently of caller property order.
  const canonical = value => value && typeof value === 'object'
    ? Array.isArray(value) ? value.map(canonical)
      : Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])])) : value;
  if (JSON.stringify(canonical(intent)) !== JSON.stringify(canonical(expected))) {
    throw new RangeError('Incompatible policy Training intent/request');
  }
  return expected;
}
