import { deepFreeze } from './freeze.js';
import { playersBySeat } from './positions.js';
import {
  LEDGER_KINDS,
  POKER_POT_LAYER_SCHEMA_VERSION,
  POKER_POT_LAYER_V2_SCHEMA_VERSION,
  POKER_STATE_SCHEMA_VERSION,
  POKER_STATE_SCHEMA_VERSIONS,
  POKER_STATE_V2_SCHEMA_VERSION,
  POKER_UNMATCHED_CONTRIBUTION_SCHEMA_VERSION,
} from './schema.js';
import { isPlayerLive } from './selectors.js';

function requireContributionState(state) {
  if (!state || !POKER_STATE_SCHEMA_VERSIONS.includes(state.schemaVersion)) {
    throw new TypeError(`Expected ${POKER_STATE_SCHEMA_VERSION} or ${POKER_STATE_V2_SCHEMA_VERSION}`);
  }
  if (!Array.isArray(state.players) || !Array.isArray(state.ledger)) {
    throw new TypeError('Pot derivation requires canonical players and ledger arrays');
  }
  return state;
}

function effectiveContributionsBySeat(state) {
  requireContributionState(state);
  const refundedByPlayerId = new Map(state.players.map((player) => [player.playerId, 0]));
  for (const entry of state.ledger) {
    if (entry.kind === LEDGER_KINDS.UNCALLED_REFUND) {
      refundedByPlayerId.set(
        entry.playerId,
        (refundedByPlayerId.get(entry.playerId) || 0) + entry.amountMilliBb,
      );
    }
  }
  const anteByPlayerId = new Map();
  for (const entry of state.ledger) {
    if (entry.kind === LEDGER_KINDS.ANTE) {
      anteByPlayerId.set(entry.playerId, (anteByPlayerId.get(entry.playerId) || 0) + entry.amountMilliBb);
    }
  }
  return playersBySeat(state.players).map((player) => {
    const anteMilliBb = anteByPlayerId.get(player.playerId) || 0;
    const amountMilliBb = player.totalPotContributionMilliBb
      - refundedByPlayerId.get(player.playerId) - anteMilliBb;
    if (!Number.isSafeInteger(amountMilliBb) || amountMilliBb < 0) {
      throw new RangeError(`Refunds exceed gross pot contribution for ${player.playerId}`);
    }
    return { player, amountMilliBb, anteMilliBb };
  });
}

function potLayersFromContributions(contributions) {
  const thresholds = [...new Set(
    contributions.map((entry) => entry.amountMilliBb).filter((amount) => amount > 0),
  )].sort((left, right) => left - right);
  const layers = [];
  let contributionFloorMilliBb = 0;

  for (const contributionCeilingMilliBb of thresholds) {
    const contributors = contributions.filter((entry) => (
      entry.amountMilliBb >= contributionCeilingMilliBb
    ));
    if (contributors.length >= 2) {
      const amountMilliBb = (contributionCeilingMilliBb - contributionFloorMilliBb)
        * contributors.length;
      if (!Number.isSafeInteger(amountMilliBb)) {
        throw new RangeError('Pot layer amount exceeds safe integer precision');
      }
      layers.push({
        schemaVersion: POKER_POT_LAYER_SCHEMA_VERSION,
        amountMilliBb,
        contributionFloorMilliBb,
        contributionCeilingMilliBb,
        contributorPlayerIds: contributors.map((entry) => entry.player.playerId),
        eligiblePlayerIds: contributors
          .filter((entry) => isPlayerLive(entry.player))
          .map((entry) => entry.player.playerId),
      });
    }
    contributionFloorMilliBb = contributionCeilingMilliBb;
  }
  return layers;
}

export function deriveUnmatchedContribution(state, recipientPlayerId = null) {
  const contributions = effectiveContributionsBySeat(state);
  let candidate;
  if (recipientPlayerId === null) {
    candidate = contributions.reduce((highest, entry) => (
      highest === null || entry.amountMilliBb > highest.amountMilliBb ? entry : highest
    ), null);
  } else {
    candidate = contributions.find((entry) => entry.player.playerId === recipientPlayerId) || null;
    if (candidate === null) throw new RangeError(`Unknown playerId: ${recipientPlayerId}`);
  }
  if (candidate === null || candidate.amountMilliBb === 0) return null;

  const contributionFloorMilliBb = contributions
    .filter((entry) => entry.player.playerId !== candidate.player.playerId)
    .reduce((maximum, entry) => Math.max(maximum, entry.amountMilliBb), 0);
  const amountMilliBb = candidate.amountMilliBb - contributionFloorMilliBb;
  if (amountMilliBb <= 0) return null;

  return deepFreeze({
    schemaVersion: POKER_UNMATCHED_CONTRIBUTION_SCHEMA_VERSION,
    playerId: candidate.player.playerId,
    amountMilliBb,
    contributionFloorMilliBb,
    contributionCeilingMilliBb: candidate.amountMilliBb,
  });
}

export function derivePotLayers(state) {
  const contributions = effectiveContributionsBySeat(state);
  const layers = potLayersFromContributions(contributions);
  const anteMilliBb = contributions.reduce((sum, entry) => sum + entry.anteMilliBb, 0);
  const antePools = [];
  if (anteMilliBb > 0 && state.game.ante.type === 'per_player') {
    let floor = 0;
    const thresholds = [...new Set(contributions.map(entry => entry.anteMilliBb).filter(Boolean))].sort((a, b) => a - b);
    for (const ceiling of thresholds) {
      const funders = contributions.filter(entry => entry.anteMilliBb >= ceiling);
      antePools.push({ amount: (ceiling - floor) * funders.length, funders });
      floor = ceiling;
    }
  } else if (anteMilliBb > 0) {
    // A BBA funds the shared ante for the table, including ante-only all-ins.
    antePools.push({ amount: anteMilliBb, funders: contributions });
  }
  const deadLayers = [];
  for (const pool of antePools) {
    const eligiblePlayerIds = pool.funders.filter(entry => isPlayerLive(entry.player))
      .map(entry => entry.player.playerId);
    // Combine identical eligibility before splitting odd chips.
    const index = layers.findIndex(layer => sameIds(layer.eligiblePlayerIds, eligiblePlayerIds));
    if (index >= 0) {
      layers[index] = { ...layers[index], schemaVersion: POKER_POT_LAYER_V2_SCHEMA_VERSION,
        amountMilliBb: layers[index].amountMilliBb + pool.amount,
        anteMilliBb: (layers[index].anteMilliBb || 0) + pool.amount };
    } else {
      deadLayers.push({ schemaVersion: POKER_POT_LAYER_V2_SCHEMA_VERSION,
        amountMilliBb: pool.amount, anteMilliBb: pool.amount,
        contributionFloorMilliBb: 0, contributionCeilingMilliBb: 0,
        contributorPlayerIds: pool.funders.filter(entry => entry.anteMilliBb > 0)
          .map(entry => entry.player.playerId), eligiblePlayerIds });
    }
  }
  layers.unshift(...deadLayers);
  return deepFreeze(layers);
}

function sameIds(left, right) {
  return Array.isArray(left)
    && Array.isArray(right)
    && left.length === right.length
    && left.every((value, index) => value === right[index]);
}

function samePotLayer(left, right) {
  return left.schemaVersion === right.schemaVersion
    && left.anteMilliBb === right.anteMilliBb
    && left.amountMilliBb === right.amountMilliBb
    && left.contributionFloorMilliBb === right.contributionFloorMilliBb
    && left.contributionCeilingMilliBb === right.contributionCeilingMilliBb
    && sameIds(left.contributorPlayerIds, right.contributorPlayerIds)
    && sameIds(left.eligiblePlayerIds, right.eligiblePlayerIds);
}

function sameUnmatchedContribution(left, right) {
  if (left === null || right === null) return left === right;
  return left.schemaVersion === right.schemaVersion
    && left.playerId === right.playerId
    && left.amountMilliBb === right.amountMilliBb
    && left.contributionFloorMilliBb === right.contributionFloorMilliBb
    && left.contributionCeilingMilliBb === right.contributionCeilingMilliBb;
}

export function validatePotAccounting(state, accounting) {
  requireContributionState(state);
  if (!accounting || typeof accounting !== 'object' || !Array.isArray(accounting.potLayers)) {
    throw new TypeError('Pot accounting requires a potLayers array');
  }
  const playerById = new Map(state.players.map((player) => [player.playerId, player]));
  let previousCeilingMilliBb = 0;
  let contestablePotMilliBb = 0;

  for (const layer of accounting.potLayers) {
    if (layer?.schemaVersion === POKER_POT_LAYER_V2_SCHEMA_VERSION) {
      // v2 dead-money funding/eligibility is checked against canonical ledger
      // derivation below; it is deliberately not a matched-wager threshold.
      if (!Number.isSafeInteger(layer.amountMilliBb) || layer.amountMilliBb <= 0
        || !Number.isSafeInteger(layer.anteMilliBb) || layer.anteMilliBb <= 0
        || layer.amountMilliBb % state.game.chipUnitMilliBb !== 0) {
        throw new RangeError('Ante layer requires positive aligned funding');
      }
      previousCeilingMilliBb = layer.contributionCeilingMilliBb;
      contestablePotMilliBb += layer.amountMilliBb;
      continue;
    }
    if (!layer || layer.schemaVersion !== POKER_POT_LAYER_SCHEMA_VERSION) {
      throw new TypeError(`Expected ${POKER_POT_LAYER_SCHEMA_VERSION}`);
    }
    for (const [field, amount] of [
      ['amountMilliBb', layer.amountMilliBb],
      ['contributionFloorMilliBb', layer.contributionFloorMilliBb],
      ['contributionCeilingMilliBb', layer.contributionCeilingMilliBb],
    ]) {
      if (!Number.isSafeInteger(amount) || amount < 0
        || amount % state.game.chipUnitMilliBb !== 0) {
        throw new RangeError(`${field} must be a nonnegative aligned safe integer`);
      }
    }
    if (layer.amountMilliBb === 0
      || layer.contributionFloorMilliBb !== previousCeilingMilliBb
      || layer.contributionCeilingMilliBb <= layer.contributionFloorMilliBb) {
      throw new RangeError('Pot layers must be positive, ascending, and non-overlapping');
    }
    if (!Array.isArray(layer.contributorPlayerIds)
      || layer.contributorPlayerIds.length < 2
      || new Set(layer.contributorPlayerIds).size !== layer.contributorPlayerIds.length
      || layer.contributorPlayerIds.some((playerId) => !playerById.has(playerId))) {
      throw new RangeError('A contestable layer requires at least two unique valid contributors');
    }
    if (!Array.isArray(layer.eligiblePlayerIds)
      || new Set(layer.eligiblePlayerIds).size !== layer.eligiblePlayerIds.length
      || layer.eligiblePlayerIds.some((playerId) => (
        !layer.contributorPlayerIds.includes(playerId) || !isPlayerLive(playerById.get(playerId))
      ))) {
      throw new RangeError('Eligible players must be unique live contributors');
    }
    const expectedAmount = (layer.contributionCeilingMilliBb
      - layer.contributionFloorMilliBb) * layer.contributorPlayerIds.length;
    if (layer.amountMilliBb !== expectedAmount) {
      throw new RangeError('Pot layer amount must equal its funded threshold width');
    }
    previousCeilingMilliBb = layer.contributionCeilingMilliBb;
    contestablePotMilliBb += layer.amountMilliBb;
  }

  const unmatched = accounting.unmatchedContribution;
  if (unmatched !== null) {
    if (!unmatched || unmatched.schemaVersion !== POKER_UNMATCHED_CONTRIBUTION_SCHEMA_VERSION
      || !playerById.has(unmatched.playerId)) {
      throw new TypeError(`Expected ${POKER_UNMATCHED_CONTRIBUTION_SCHEMA_VERSION}`);
    }
    if (!Number.isSafeInteger(unmatched.amountMilliBb) || unmatched.amountMilliBb <= 0
      || !Number.isSafeInteger(unmatched.contributionFloorMilliBb)
      || !Number.isSafeInteger(unmatched.contributionCeilingMilliBb)
      || unmatched.contributionFloorMilliBb < 0
      || unmatched.amountMilliBb % state.game.chipUnitMilliBb !== 0
      || unmatched.contributionFloorMilliBb % state.game.chipUnitMilliBb !== 0
      || unmatched.contributionCeilingMilliBb % state.game.chipUnitMilliBb !== 0
      || unmatched.contributionCeilingMilliBb - unmatched.contributionFloorMilliBb
        !== unmatched.amountMilliBb) {
      throw new RangeError('Unmatched contribution must be a positive aligned threshold remainder');
    }
  }
  const unmatchedMilliBb = unmatched === null ? 0 : unmatched.amountMilliBb;
  if (contestablePotMilliBb !== accounting.contestablePotMilliBb
    || unmatchedMilliBb !== accounting.unmatchedMilliBb
    || contestablePotMilliBb + unmatchedMilliBb !== state.potMilliBb) {
    throw new RangeError('Contestable layers plus unmatched excess must equal the canonical pot');
  }

  const expectedLayers = derivePotLayers(state);
  const expectedUnmatched = deriveUnmatchedContribution(state);
  if (expectedLayers.length !== accounting.potLayers.length
    || expectedLayers.some((layer, index) => !samePotLayer(layer, accounting.potLayers[index]))
    || !sameUnmatchedContribution(expectedUnmatched, unmatched)) {
    throw new RangeError('Pot accounting must match canonical contribution derivation');
  }
  return accounting;
}

export function derivePotAccounting(state) {
  const potLayers = derivePotLayers(state);
  const unmatchedContribution = deriveUnmatchedContribution(state);
  const contestablePotMilliBb = potLayers.reduce((sum, layer) => sum + layer.amountMilliBb, 0);
  const accounting = {
    potLayers,
    unmatchedContribution,
    contestablePotMilliBb,
    unmatchedMilliBb: unmatchedContribution === null ? 0 : unmatchedContribution.amountMilliBb,
  };
  validatePotAccounting(state, accounting);
  return deepFreeze(accounting);
}
