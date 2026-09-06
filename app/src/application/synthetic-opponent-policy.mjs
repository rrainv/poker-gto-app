import { createAction } from '../../../shared/poker-domain/index.js';
import { createOpponentPolicy, OPPONENT_POLICY_PROVENANCE_SCHEMA_VERSION,
  OPPONENT_POLICY_SELECTION_SCHEMA_VERSION } from './opponent-policy.mjs';
import { freezeOpponentData as freeze } from './opponent-actor-information.mjs';

export const SYNTHETIC_POLICY_ID = 'riverline.synthetic-opponent';
export const SYNTHETIC_POLICY_VERSION = 'context-action-selection/v2';
export const SYNTHETIC_CONFIGURATION_VERSION = 'synthetic-opponent-parameters/v1';
export const OPPONENT_PRACTICE_REQUEST_VERSION = 'opponent-practice-request/v1';
export const SYNTHETIC_PARAMETER_KEYS = freeze([
  'smallPriceCallPercent', 'largePriceCallPercent', 'freeAggressionPercent', 'facingRaisePercent',
]);
export const SYNTHETIC_PRESETS = freeze({
  'calling-heavy': { smallPriceCallPercent: 90, largePriceCallPercent: 65, freeAggressionPercent: 15, facingRaisePercent: 5 },
  aggressive: { smallPriceCallPercent: 65, largePriceCallPercent: 45, freeAggressionPercent: 65, facingRaisePercent: 35 },
  'tight-passive': { smallPriceCallPercent: 45, largePriceCallPercent: 15, freeAggressionPercent: 10, facingRaisePercent: 5 },
});

export function createSyntheticConfiguration(parameters = SYNTHETIC_PRESETS['calling-heavy']) {
  if (!parameters || Object.keys(parameters).length !== SYNTHETIC_PARAMETER_KEYS.length
    || SYNTHETIC_PARAMETER_KEYS.some(key => !Number.isInteger(parameters[key]) || parameters[key] < 0 || parameters[key] > 100)) {
    throw new RangeError('Four explicit integer policy percentages from 0 to 100 are required');
  }
  return freeze({ schemaVersion: SYNTHETIC_CONFIGURATION_VERSION,
    parameters: Object.fromEntries(SYNTHETIC_PARAMETER_KEYS.map(key => [key, parameters[key]])),
    sizing: 'minimum_legal_to', capability: 'action_selection_only',
    context: 'canonical_holdem_betting_2_to_10',
    quantitativeRangeResponse: 'unavailable_no_combo_likelihood_contract',
    cardConditioning: 'none', normativeAssessment: false });
}

export function validateSyntheticConfiguration(configuration) {
  if (!configuration?.parameters) throw new RangeError('Explicit synthetic parameters are required');
  const normalized = createSyntheticConfiguration(configuration?.parameters);
  if (!configuration || Object.keys(configuration).length !== Object.keys(normalized).length
    || Object.keys(normalized).some(key => key !== 'parameters' && configuration[key] !== normalized[key])) {
    throw new RangeError('Unsupported synthetic policy configuration/version/context');
  }
  return normalized;
}

// Single behavior owner shared by the selector and policy teaching. The call
// parameter is conditional on not raising, never an unconditional call rate.
export function syntheticActionWeights(configuration, { checkAvailable, aggression, smallPrice }) {
  const { parameters: p } = validateSyntheticConfiguration(configuration);
  const raiseWeight = aggression === null ? 0
    : (checkAvailable ? p.freeAggressionPercent : p.facingRaisePercent) * 100;
  const remaining = 10000 - raiseWeight;
  const callWeight = checkAvailable ? 0
    : remaining * (smallPrice ? p.smallPriceCallPercent : p.largePriceCallPercent) / 100;
  const weights = checkAvailable
    ? [{ type: 'check', weight: remaining }]
    : [{ type: 'fold', weight: remaining - callWeight }, { type: 'call', weight: callWeight }];
  if (aggression !== null) weights.push({ type: aggression, weight: raiseWeight });
  return freeze(weights);
}

export function createSyntheticResponseFacts(configuration = createSyntheticConfiguration()) {
  const config = validateSyntheticConfiguration(configuration);
  const branches = [];
  for (const smallPrice of [true, false]) for (const raiseAvailable of [true, false]) {
    branches.push({ kind: smallPrice ? 'small_price' : 'large_price', raiseAvailable,
      weights: syntheticActionWeights(config, { checkAvailable: false, smallPrice,
        aggression: raiseAvailable ? 'raise' : null }) });
  }
  for (const aggressionAvailable of [true, false]) branches.push({ kind: 'check_available', aggressionAvailable,
    weights: syntheticActionWeights(config, { checkAvailable: true, smallPrice: false,
      aggression: aggressionAvailable ? 'bet' : null }) });
  return freeze({ schemaVersion: 'synthetic-response-facts/v1', policyId: SYNTHETIC_POLICY_ID,
    policyVersion: SYNTHETIC_POLICY_VERSION, configuration: config, branches, sampleSpace: 10000,
    smallPriceDefinition: '3_times_stack_capped_call_at_most_current_pot_including_wager',
    scope: 'conditional_branch_weights_not_current_opponent_prediction',
    cardConditioning: 'none', rangeResponse: 'unavailable', checkRaiseSpecific: false,
    normativeAssessment: false });
}

export function createSyntheticOpponentPolicy(configuration = createSyntheticConfiguration()) {
  const config = validateSyntheticConfiguration(configuration);
  return createOpponentPolicy({ policyId: SYNTHETIC_POLICY_ID, policyVersion: SYNTHETIC_POLICY_VERSION,
    configuration: config,
    provenance: { schemaVersion: OPPONENT_POLICY_PROVENANCE_SCHEMA_VERSION, kind: 'heuristic_archetype',
      description: 'Explicit synthetic action-selection assumptions; card-independent practice only.',
      solverBacked: false, equilibriumClaim: false, populationModelClaim: false },
    select({ information, actor, legalActionSpec: legal, mixedSeed }) {
      if (information.players.length < 2 || information.players.length > 10
        || !['preflop', 'flop', 'turn', 'river'].includes(information.street)) {
        throw new RangeError('Unsupported synthetic policy context');
      }
      const p = config.parameters;
      const small = legal.call.commitMilliBb * 3 <= information.potMilliBb;
      const aggression = legal.check.available
        ? legal.bet.available ? 'bet' : legal.raise.available ? 'raise' : null
        : legal.raise.available ? 'raise' : null;
      const weights = syntheticActionWeights(config, { checkAvailable: legal.check.available,
        aggression, smallPrice: small });
      const sampleValue = mixedSeed % 10000;
      let boundary = 0;
      const selected = weights.find(item => { boundary += item.weight; return sampleValue < boundary; });
      if (!selected) throw new RangeError('Synthetic weights do not cover sample space');
      const sized = selected.type === 'bet' || selected.type === 'raise';
      const amount = sized ? legal[selected.type].minToMilliBb : null;
      return { schemaVersion: OPPONENT_POLICY_SELECTION_SCHEMA_VERSION,
        action: createAction(actor.playerId, selected.type, amount),
        selectionMetadata: { engine: SYNTHETIC_POLICY_VERSION, sampleSpace: 10000, sampleValue, weights,
          reason: legal.check.available ? 'check_available' : small ? 'small_call_price' : 'large_call_price',
          parameters: p, cardConditioning: 'none', quantitativeRangeResponse: config.quantitativeRangeResponse,
          normativeAssessment: false },
        sizingMetadata: { source: 'canonical_legal_action_spec', mode: sized ? config.sizing : 'not_sized',
          amountToMilliBb: amount, minimumToMilliBb: sized ? legal[selected.type].minToMilliBb : null,
          maximumToMilliBb: sized ? legal[selected.type].maxToMilliBb : null } };
    },
  });
}

// Immutable request snapshot, separate from the TrainingConfig/planner/grader.
// The label is presentation only and is intentionally absent from behavior.
export function createOpponentPracticeRequest({ configuration = createSyntheticConfiguration(),
  policySeed = 0, target = 'all_opponents', tableSize = 2 } = {}) {
  if (!Number.isSafeInteger(policySeed) || policySeed < 0 || policySeed > 0xffffffff) throw new RangeError('Invalid policy seed');
  if (!Number.isInteger(tableSize) || tableSize < 2 || tableSize > 10) throw new RangeError('Unsupported table size');
  if (target !== 'all_opponents' && !['BTN', 'SB', 'BB', 'UTG', 'UTG+1', 'UTG+2', 'MP', 'LJ', 'HJ', 'CO'].includes(target)) {
    throw new RangeError('Unsupported opponent role');
  }
  return freeze({ schemaVersion: OPPONENT_PRACTICE_REQUEST_VERSION, policyId: SYNTHETIC_POLICY_ID,
    policyVersion: SYNTHETIC_POLICY_VERSION, configuration: validateSyntheticConfiguration(configuration),
    policySeed, target, allowedContext: 'canonical_holdem_betting_2_to_10',
    handFormat: { tableSize, variant: 'holdem', betting: 'no_limit' } });
}

export function validateOpponentPracticeRequest(request) {
  validateSyntheticConfiguration(request?.configuration);
  const normalized = createOpponentPracticeRequest({ configuration: request?.configuration,
    policySeed: request?.policySeed, target: request?.target, tableSize: request?.handFormat?.tableSize });
  if (!request || Object.keys(request).length !== Object.keys(normalized).length
    || request.policySeed !== normalized.policySeed || request.target !== normalized.target
    || request.schemaVersion !== normalized.schemaVersion || request.policyId !== normalized.policyId
    || request.policyVersion !== normalized.policyVersion || request.allowedContext !== normalized.allowedContext
    || Object.keys(request.handFormat ?? {}).length !== 3
    || Object.keys(normalized.handFormat).some(key => request.handFormat[key] !== normalized.handFormat[key])) {
    throw new RangeError('Unsupported opponent practice request/version/format');
  }
  return normalized;
}
