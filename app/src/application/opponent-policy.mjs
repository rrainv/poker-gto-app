import {
  ACTION_TYPES,
  applyAction as applyPokerAction,
  createAction,
  playerById,
  validateAction,
  validatePokerState,
} from '../../../shared/poker-domain/index.js';
import { createOpponentActorInformation } from './opponent-actor-information.mjs';

export const OPPONENT_POLICY_SCHEMA_VERSION = 'opponent-policy/v1';
export const OPPONENT_POLICY_V2_SCHEMA_VERSION = 'opponent-policy/v2';
export const OPPONENT_POLICY_PROVENANCE_SCHEMA_VERSION = 'opponent-policy-provenance/v1';
export const OPPONENT_POLICY_SELECTION_SCHEMA_VERSION = 'opponent-policy-selection/v1';
export const OPPONENT_POLICY_DECISION_SCHEMA_VERSION = 'opponent-policy-decision/v1';
export const OPPONENT_POLICY_TRANSITION_SCHEMA_VERSION = 'opponent-policy-transition/v1';

export const BASELINE_OPPONENT_POLICY_ID = 'riverline.basic-opponent';
export const BASELINE_OPPONENT_POLICY_VERSION = 'deterministic-legal-heuristic/actor-safe-v2';

const UINT32_MAX = 0xffffffff;
const SAMPLE_SPACE = 10_000;
const POLICY_KEYS = Object.freeze([
  'policyId',
  'policyVersion',
  'provenance',
  'schemaVersion',
  'select',
]);
const PROVENANCE_KEYS = Object.freeze([
  'description',
  'equilibriumClaim',
  'kind',
  'populationModelClaim',
  'schemaVersion',
  'solverBacked',
]);
const SELECTION_KEYS = Object.freeze([
  'action',
  'schemaVersion',
  'selectionMetadata',
  'sizingMetadata',
]);

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
}

function frozenClone(value) {
  return deepFreeze(structuredClone(value));
}

function requireExactKeys(value, expectedKeys, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError(`${label} must be an object`);
  }
  const actualKeys = Object.keys(value).sort();
  if (actualKeys.length !== expectedKeys.length
    || actualKeys.some((key, index) => key !== expectedKeys[index])) {
    throw new RangeError(`${label} contains unsupported fields`);
  }
  return value;
}

function requireNonEmptyString(value, label) {
  if (typeof value !== 'string' || !value.trim()) throw new TypeError(`${label} is required`);
  return value;
}

function requireUint32(value, label) {
  if (!Number.isSafeInteger(value) || value < 0 || value > UINT32_MAX) {
    throw new RangeError(`${label} must be an unsigned 32-bit integer`);
  }
  return value >>> 0;
}

function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stableValue(value[key])]));
}

function stableStringify(value) {
  return JSON.stringify(stableValue(value));
}

function avalanche32(value) {
  let hash = value >>> 0;
  hash ^= hash >>> 16;
  hash = Math.imul(hash, 0x7feb352d);
  hash ^= hash >>> 15;
  hash = Math.imul(hash, 0x846ca68b);
  hash ^= hash >>> 16;
  return hash >>> 0;
}

function hashString32(value, initialState = 0x811c9dc5) {
  let hash = initialState >>> 0;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return avalanche32(hash);
}

function actorInformationFingerprint(information) {
  const hash = hashString32(stableStringify(information));
  return `actor-information-fnv1a32:${hash.toString(16).padStart(8, '0')}`;
}

function mixedDecisionSeed({ decisionSeed, stateFingerprint, policy }) {
  return hashString32([
    OPPONENT_POLICY_DECISION_SCHEMA_VERSION,
    policy.policyId,
    policy.policyVersion,
    stableStringify(policy.configuration ?? null),
    stateFingerprint,
    `seed:${decisionSeed}`,
  ].join('|'));
}

function normalizeProvenance(provenance) {
  requireExactKeys(provenance, PROVENANCE_KEYS, 'OpponentPolicy provenance');
  if (provenance.schemaVersion !== OPPONENT_POLICY_PROVENANCE_SCHEMA_VERSION) {
    throw new TypeError(`Expected ${OPPONENT_POLICY_PROVENANCE_SCHEMA_VERSION}`);
  }
  if (provenance.kind !== 'heuristic_archetype') {
    throw new RangeError('OpponentPolicy v1 supports only explicit heuristic archetype provenance');
  }
  requireNonEmptyString(provenance.description, 'OpponentPolicy provenance description');
  for (const field of ['solverBacked', 'equilibriumClaim', 'populationModelClaim']) {
    if (provenance[field] !== false) {
      throw new RangeError(`Heuristic OpponentPolicy provenance requires ${field}: false`);
    }
  }
  return frozenClone(provenance);
}

function validatePolicy(policy) {
  const v2 = policy?.schemaVersion === OPPONENT_POLICY_V2_SCHEMA_VERSION;
  requireExactKeys(policy, v2 ? [...POLICY_KEYS, 'configuration'].sort() : POLICY_KEYS, 'OpponentPolicy');
  if (!v2 && policy.schemaVersion !== OPPONENT_POLICY_SCHEMA_VERSION) {
    throw new TypeError(`Expected ${OPPONENT_POLICY_SCHEMA_VERSION}`);
  }
  requireNonEmptyString(policy.policyId, 'OpponentPolicy policyId');
  requireNonEmptyString(policy.policyVersion, 'OpponentPolicy policyVersion');
  normalizeProvenance(policy.provenance);
  if (typeof policy.select !== 'function') throw new TypeError('OpponentPolicy select is required');
  return policy;
}

function normalizeSelection(selection, chipUnitMilliBb) {
  requireExactKeys(selection, SELECTION_KEYS, 'OpponentPolicy selection');
  if (selection.schemaVersion !== OPPONENT_POLICY_SELECTION_SCHEMA_VERSION) {
    throw new TypeError(`Expected ${OPPONENT_POLICY_SELECTION_SCHEMA_VERSION}`);
  }
  validateAction(selection.action, chipUnitMilliBb);
  if (!selection.selectionMetadata || typeof selection.selectionMetadata !== 'object'
    || Array.isArray(selection.selectionMetadata)) {
    throw new TypeError('OpponentPolicy selectionMetadata must be an object');
  }
  if (!selection.sizingMetadata || typeof selection.sizingMetadata !== 'object'
    || Array.isArray(selection.sizingMetadata)) {
    throw new TypeError('OpponentPolicy sizingMetadata must be an object');
  }
  return frozenClone(selection);
}

function actorContext(pokerState, actor) {
  return deepFreeze({
    playerId: actor.playerId,
    seat: actor.seat,
    position: actor.position,
    street: pokerState.street,
    startingStackMilliBb: actor.startingStackMilliBb,
    currentStackMilliBb: actor.currentStackMilliBb,
    streetContributionMilliBb: actor.streetContributionMilliBb,
  });
}

/**
 * Creates the strict, DOM-free OpponentPolicy v1 interface. The selector is
 * intentionally separate from StrategyProvider and must return a canonical
 * OpponentPolicySelection v1 for wrapper-level legality validation.
 */
export function createOpponentPolicy({ policyId, policyVersion, provenance, select, configuration = null } = {}) {
  const policy = {
    schemaVersion: configuration === null ? OPPONENT_POLICY_SCHEMA_VERSION : OPPONENT_POLICY_V2_SCHEMA_VERSION,
    ...(configuration === null ? {} : { configuration: frozenClone(configuration) }),
    policyId: requireNonEmptyString(policyId, 'OpponentPolicy policyId'),
    policyVersion: requireNonEmptyString(policyVersion, 'OpponentPolicy policyVersion'),
    provenance: normalizeProvenance(provenance),
    select,
  };
  if (typeof select !== 'function') throw new TypeError('OpponentPolicy select is required');
  return Object.freeze(policy);
}

/**
 * Resolves exactly one legal canonical action for the current actor. A frozen
 * actor-observable allowlist crosses the policy boundary. Canonical applyAction
 * is the final legality authority and runs outside that information boundary.
 */
export function chooseOpponentAction({
  policy,
  pokerState,
  actorSeat,
  decisionSeed,
  ownCards = null,
} = {}) {
  validatePolicy(policy);
  validatePokerState(pokerState);
  if (!Number.isSafeInteger(actorSeat) || actorSeat < 0) {
    throw new RangeError('actorSeat must be a nonnegative safe integer');
  }
  const actor = playerById(pokerState, pokerState.actingPlayerId);
  if (!actor || actor.seat !== actorSeat) {
    throw new RangeError('OpponentPolicy actorSeat must identify the current actor');
  }
  const normalizedDecisionSeed = requireUint32(decisionSeed, 'decisionSeed');
  const information = createOpponentActorInformation({ pokerState, actorSeat, ownCards });
  const legalActionSpec = information.legalActionSpec;
  const stateFingerprint = actorInformationFingerprint(information);
  const mixedSeed = mixedDecisionSeed({
    decisionSeed: normalizedDecisionSeed,
    stateFingerprint,
    policy,
  });
  const policyInput = deepFreeze({
    information,
    actor: actorContext(information, information.players.find(player => player.seat === actorSeat)),
    legalActionSpec: frozenClone(legalActionSpec),
    decisionSeed: normalizedDecisionSeed,
    stateFingerprint,
    mixedSeed,
  });
  const selection = normalizeSelection(policy.select(policyInput), pokerState.game.chipUnitMilliBb);

  // This validates actor identity, action availability, and exact sizing
  // bounds through the canonical transition authority without mutating state.
  applyPokerAction(pokerState, selection.action);

  return deepFreeze({
    schemaVersion: OPPONENT_POLICY_DECISION_SCHEMA_VERSION,
    policyId: policy.policyId,
    policyVersion: policy.policyVersion,
    action: selection.action,
    provenance: policy.provenance,
    policySchemaVersion: policy.schemaVersion,
    policyConfiguration: policy.configuration ?? null,
    actorInformation: information,
    deterministicMetadata: {
      decisionSeed: normalizedDecisionSeed,
      stateFingerprint,
      mixedSeed,
      // Collision-free equality key for a consumer cache; never a whole-state
      // hash or replay/deal identity. No decision cache is needed by this owner.
      cacheKey: stableStringify({ policyId: policy.policyId, policyVersion: policy.policyVersion,
        configuration: policy.configuration ?? null, information, decisionSeed: normalizedDecisionSeed }),
      sampleSpace: selection.selectionMetadata.sampleSpace ?? null,
      sampleValue: selection.selectionMetadata.sampleValue ?? null,
    },
    selectionMetadata: selection.selectionMetadata,
    sizingMetadata: selection.sizingMetadata,
  });
}

function weightedBaselineCandidates(actor, legalActionSpec) {
  if (legalActionSpec.check.available) {
    const aggressionType = legalActionSpec.bet.available
      ? ACTION_TYPES.BET
      : legalActionSpec.raise.available ? ACTION_TYPES.RAISE : null;
    return {
      reason: 'check_available',
      candidates: [
        { type: ACTION_TYPES.CHECK, weight: aggressionType === null ? SAMPLE_SPACE : 8_500 },
        ...(aggressionType === null ? [] : [{ type: aggressionType, weight: 1_500 }]),
      ],
    };
  }

  const callConsumesStack = legalActionSpec.call.allIn;
  const callConsumesAtLeastHalf = legalActionSpec.call.commitMilliBb * 2 >= actor.currentStackMilliBb;
  const raiseWeight = legalActionSpec.raise.available ? (callConsumesStack ? 0 : 1_000) : 0;
  const callWeight = callConsumesStack ? 2_000 : callConsumesAtLeastHalf ? 3_500 : 5_500;
  return {
    reason: callConsumesStack ? 'facing_stack_capped_call'
      : callConsumesAtLeastHalf ? 'facing_high_commitment' : 'facing_wager',
    candidates: [
      { type: ACTION_TYPES.FOLD, weight: SAMPLE_SPACE - callWeight - raiseWeight },
      { type: ACTION_TYPES.CALL, weight: callWeight },
      ...(raiseWeight === 0 ? [] : [{ type: ACTION_TYPES.RAISE, weight: raiseWeight }]),
    ],
  };
}

function selectedCandidate(candidates, sampleValue) {
  let boundary = 0;
  for (const candidate of candidates) {
    boundary += candidate.weight;
    if (sampleValue < boundary) return candidate;
  }
  throw new RangeError('Baseline OpponentPolicy weights do not cover the sample space');
}

function baselineAction(actor, legalActionSpec, candidate) {
  let amountToMilliBb = null;
  let minimumToMilliBb = null;
  let maximumToMilliBb = null;
  if (candidate.type === ACTION_TYPES.BET || candidate.type === ACTION_TYPES.RAISE) {
    const sizingSpec = legalActionSpec[candidate.type];
    amountToMilliBb = sizingSpec.minToMilliBb;
    minimumToMilliBb = sizingSpec.minToMilliBb;
    maximumToMilliBb = sizingSpec.maxToMilliBb;
  }
  return {
    action: createAction(actor.playerId, candidate.type, amountToMilliBb),
    sizingMetadata: {
      source: 'canonical_legal_action_spec',
      mode: amountToMilliBb === null ? 'not_sized' : 'minimum_legal_to',
      amountToMilliBb,
      minimumToMilliBb,
      maximumToMilliBb,
      callCommitMilliBb: candidate.type === ACTION_TYPES.CALL
        ? legalActionSpec.call.commitMilliBb : null,
      callIsStackCappedAllIn: candidate.type === ACTION_TYPES.CALL
        ? legalActionSpec.call.allIn : false,
    },
  };
}

/**
 * Small deterministic baseline for full-hand Training foundations. Its
 * weights are product-policy constants, not GTO, equilibrium, solver, or
 * real-population evidence. It never selects the explicit ALL_IN action.
 */
export function createBasicOpponentPolicy() {
  return createOpponentPolicy({
    policyId: BASELINE_OPPONENT_POLICY_ID,
    policyVersion: BASELINE_OPPONENT_POLICY_VERSION,
    provenance: {
      schemaVersion: OPPONENT_POLICY_PROVENANCE_SCHEMA_VERSION,
      kind: 'heuristic_archetype',
      description: 'Small deterministic legal-action baseline for full-hand Training.',
      solverBacked: false,
      equilibriumClaim: false,
      populationModelClaim: false,
    },
    select({ actor, legalActionSpec, mixedSeed }) {
      const { reason, candidates } = weightedBaselineCandidates(actor, legalActionSpec);
      const sampleValue = mixedSeed % SAMPLE_SPACE;
      const candidate = selectedCandidate(candidates, sampleValue);
      const { action, sizingMetadata } = baselineAction(actor, legalActionSpec, candidate);
      return {
        schemaVersion: OPPONENT_POLICY_SELECTION_SCHEMA_VERSION,
        action,
        selectionMetadata: {
          engine: 'weighted_legal_action_archetype',
          archetype: 'basic',
          reason,
          sampleSpace: SAMPLE_SPACE,
          sampleValue,
          weights: candidates.map(({ type, weight }) => ({ type, weight })),
          explicitAllInSelected: false,
        },
        sizingMetadata,
      };
    },
  });
}

/**
 * Minimal full-hand foundation seam. The configured Hero must exist and the
 * current actor must be a non-Hero seat. Policy provenance is returned to the
 * future orchestrator; the action itself remains an ordinary canonical Replay
 * and action-journal transition.
 */
export function applyOpponentPolicyAction({ session, policy, decisionSeed, ownCards = null } = {}) {
  if (!session || typeof session.getState !== 'function'
    || typeof session.getHeroDecisionJournal !== 'function'
    || typeof session.applyAction !== 'function') {
    throw new TypeError('Opponent policy transition requires a CanonicalHandSession');
  }
  const pokerState = session.getState();
  validatePokerState(pokerState);
  const journal = session.getHeroDecisionJournal();
  if (!journal?.heroPlayerId) {
    throw new RangeError('CanonicalHandSession must configure Hero before opponent progression');
  }
  if (pokerState.actingPlayerId === journal.heroPlayerId) {
    throw new RangeError('Opponent policy cannot act for the configured Hero');
  }
  const actor = playerById(pokerState, pokerState.actingPlayerId);
  const decision = chooseOpponentAction({
    policy,
    pokerState,
    actorSeat: actor.seat,
    decisionSeed,
    ownCards,
  });
  const state = session.applyAction(decision.action);
  return deepFreeze({
    schemaVersion: OPPONENT_POLICY_TRANSITION_SCHEMA_VERSION,
    decision,
    state,
  });
}
