import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import {
  ACTION_TYPES,
  GAME_MODES,
  createGameRulesSnapshotFromLegacyGameConfiguration,
} from '../shared/poker-domain/index.js';
import {
  CALIBRATION_CONTEXT_STACK_BASES,
  CALIBRATION_DECISION_FAMILIES,
  CALIBRATION_PRIOR_ACTION_FAMILIES,
  createPreflopCalibrationContextV2,
  createRangeObservation,
  createRfiCalibrationContext,
} from '../app/src/personal-strategy/domain.mjs';
import { createPersonalStrategyEvidenceView } from '../app/src/personal-strategy/evidence-view.mjs';
import { createPersonalStrategySnapshot } from '../app/src/personal-strategy/rfi-inference.mjs';
import { PERSONAL_STRATEGY_MATRIX_STATUSES } from '../app/src/personal-strategy/matrix-projection.mjs';
import { createMemoryPersonalStrategyDatabase } from '../app/src/personal-strategy/indexeddb-storage.mjs';
import { createRangeCalibrationApplication } from '../app/src/application/range-calibration-service.mjs';
import {
  MAX_RFI_TRANSFER_CONTRIBUTORS_PER_HAND,
  RFI_CONTEXT_TRANSFER_BANDS,
  RFI_CONTEXT_TRANSFER_ESTIMATE_STATES,
  RFI_CONTEXT_TRANSFER_REJECTION_REASONS,
  createRfiContextTransferProjection,
  createRfiContextTransferRelationship,
} from '../app/src/personal-strategy/rfi-context-transfer.mjs';

const PROFILE_ID = 'range-intelligence-003a-profile';
const MODE_ID = 'range-intelligence-003a-mode';
const T0 = '2026-08-21T15:00:00.000Z';
let sequence = 0;

function context(overrides = {}) {
  return createRfiCalibrationContext({
    gameRulesId: 'riverline:no-rake-cash:v1',
    tableSize: 6,
    heroPosition: 'BTN',
    effectiveStackBb: 100,
    accounting: {
      anteType: 'none',
      anteBb: 0,
      forcedContributionPerPlayerBb: 0,
      rakeMode: 'off',
    },
    ...overrides,
  });
}

function scope(selectedContext, overrides = {}) {
  return {
    profileId: overrides.profileId ?? PROFILE_ID,
    modeId: overrides.modeId ?? MODE_ID,
    context: selectedContext,
  };
}

function canonicalContext({
  effectiveStackBb = 100,
  tableSize = 6,
  heroPosition = 'BTN',
  allIn = false,
  anteAmountMilliBb = 0,
} = {}) {
  const rulesSnapshot = createGameRulesSnapshotFromLegacyGameConfiguration({
    mode: GAME_MODES.HOME,
    smallBlindMilliBb: 500,
    bigBlindMilliBb: 1000,
    chipUnitMilliBb: 100,
    ante: {
      type: anteAmountMilliBb === 0 ? 'none' : 'per_player',
      amountMilliBb: anteAmountMilliBb,
    },
  }, tableSize);
  return createPreflopCalibrationContextV2({
    decisionFamily: CALIBRATION_DECISION_FAMILIES.PREFLOP_RFI,
    gameRules: {
      identity: { kind: 'semantic_fingerprint', value: rulesSnapshot.semanticFingerprint },
      ante: {
        type: rulesSnapshot.definition.ante.type,
        amountBb: rulesSnapshot.definition.ante.amountMilliBb / 1000,
      },
      collection: { type: 'none', amountPerPlayerBb: 0 },
    },
    tableSize,
    heroPosition,
    opponentCount: heroPosition === 'BTN' ? 2 : tableSize - 1,
    stack: {
      valueBb: effectiveStackBb,
      basis: CALIBRATION_CONTEXT_STACK_BASES.EFFECTIVE_LIVE_POT_CAPACITY,
    },
    priorAction: {
      family: CALIBRATION_PRIOR_ACTION_FAMILIES.UNOPENED,
      actionCount: 0,
      foldCount: 0,
      callCount: 0,
      aggressionCount: 0,
      lastAggression: null,
    },
    facing: { sizeBb: 0, callAmountBb: 0, heroStreetContributionBb: 0 },
    sizing: {
      currentBetBb: 1,
      lastFullRaiseIncrementBb: 1,
      minimumRaiseToBb: 2,
      maximumNonAllInRaiseToBb: Math.max(2, effectiveStackBb - 1),
      allInToBb: allIn ? effectiveStackBb : null,
    },
    legalActions: [
      { type: ACTION_TYPES.FOLD },
      { type: ACTION_TYPES.CALL },
      { type: ACTION_TYPES.RAISE },
      ...(allIn ? [{ type: ACTION_TYPES.ALL_IN }] : []),
    ],
  });
}

function direct(selectedContext, handClass, actionType, overrides = {}) {
  sequence += 1;
  return createRangeObservation({
    id: overrides.id ?? `transfer-evidence-${sequence}`,
    profileId: overrides.profileId ?? PROFILE_ID,
    modeId: overrides.modeId ?? MODE_ID,
    context: selectedContext,
    handClass,
    dominantAction: actionType === null ? null : { type: actionType },
    frequencies: overrides.frequencies ?? null,
    createdAt: overrides.createdAt ?? T0,
  });
}

function exact(selectedContext, handClass, fold, raise, overrides = {}) {
  return direct(selectedContext, handClass, fold === raise
    ? null : raise > fold ? ACTION_TYPES.RAISE : ACTION_TYPES.FOLD, {
    ...overrides,
    frequencies: [
      { action: { type: ACTION_TYPES.FOLD }, probability: fold },
      { action: { type: ACTION_TYPES.RAISE }, probability: raise },
    ],
  });
}

function snapshot(selectedContext, observations = [], overrides = {}) {
  return createPersonalStrategySnapshot(createPersonalStrategyEvidenceView({
    profileId: overrides.profileId ?? PROFILE_ID,
    modeId: overrides.modeId ?? MODE_ID,
    context: selectedContext,
    rangeObservations: observations,
  }));
}

function donor(targetContext, donorContext, observations, overrides = {}) {
  const donorScope = scope(donorContext, overrides);
  return {
    relationship: createRfiContextTransferRelationship(donorScope, scope(targetContext)),
    snapshot: snapshot(donorContext, observations, overrides),
  };
}

function estimate(projection, handClass) {
  return projection.estimates.find((entry) => entry.handClass === handClass);
}

function memoryStorage() {
  const values = new Map();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
  };
}

test('relationship model distinguishes position, table, stack, rules, profile, and mode boundaries', () => {
  const target = context();
  const sameButtonNearbyStack = createRfiContextTransferRelationship(
    scope(context({ effectiveStackBb: 110 })),
    scope(target),
  );
  assert.equal(sameButtonNearbyStack.eligible, true);
  assert.equal(sameButtonNearbyStack.transferBand, RFI_CONTEXT_TRANSFER_BANDS.STRONG);
  assert.equal(sameButtonNearbyStack.dimensions.position.relation, 'same_named_position');
  assert.equal(sameButtonNearbyStack.dimensions.stack.relation, 'near');

  const cutoff = createRfiContextTransferRelationship(scope(context({ heroPosition: 'CO' })), scope(target));
  assert.equal(cutoff.eligible, true);
  assert.equal(cutoff.transferBand, RFI_CONTEXT_TRANSFER_BANDS.MODERATE);
  assert.equal(cutoff.dimensions.position.relation, 'adjacent_position');

  const nearbyTable = createRfiContextTransferRelationship(
    scope(context({ tableSize: 5, heroPosition: 'BTN' })),
    scope(target),
  );
  assert.equal(nearbyTable.eligible, true);
  assert.equal(nearbyTable.dimensions.table.relation, 'nearby');

  const comparableRole = createRfiContextTransferRelationship(
    scope(context({ tableSize: 7, heroPosition: 'LJ' })),
    scope(context({ tableSize: 6, heroPosition: 'UTG' })),
  );
  assert.equal(comparableRole.eligible, true);
  assert.equal(comparableRole.dimensions.position.relation, 'comparable_relative_position');

  const earlyToButton = createRfiContextTransferRelationship(
    scope(context({ heroPosition: 'UTG' })),
    scope(target),
  );
  assert.equal(earlyToButton.eligible, false);
  assert.equal(earlyToButton.rejectionReason,
    RFI_CONTEXT_TRANSFER_REJECTION_REASONS.POSITION_ROLE_INCOMPATIBLE);
  assert.equal(earlyToButton.transferBand, RFI_CONTEXT_TRANSFER_BANDS.WEAK);

  const stackBoundary = createRfiContextTransferRelationship(
    scope(context({ effectiveStackBb: 30 })),
    scope(target),
  );
  assert.equal(stackBoundary.eligible, false);
  assert.equal(stackBoundary.rejectionReason,
    RFI_CONTEXT_TRANSFER_REJECTION_REASONS.STACK_DISTANCE_TOO_LARGE);

  const rulesBoundary = createRfiContextTransferRelationship(
    scope(context({ gameRulesId: 'different-rules' })),
    scope(target),
  );
  assert.equal(rulesBoundary.eligible, false);
  assert.equal(rulesBoundary.rejectionReason,
    RFI_CONTEXT_TRANSFER_REJECTION_REASONS.GAME_RULES_INCOMPATIBLE);

  const profileBoundary = createRfiContextTransferRelationship(
    scope(context({ effectiveStackBb: 110 }), { profileId: 'other-profile' }),
    scope(target),
  );
  assert.equal(profileBoundary.rejectionReason,
    RFI_CONTEXT_TRANSFER_REJECTION_REASONS.PROFILE_MISMATCH);
  const modeBoundary = createRfiContextTransferRelationship(
    scope(context({ effectiveStackBb: 110 }), { modeId: 'other-mode' }),
    scope(target),
  );
  assert.equal(modeBoundary.rejectionReason,
    RFI_CONTEXT_TRANSFER_REJECTION_REASONS.MODE_MISMATCH);
});

test('canonical expanded action sets expose semantic compatibility but remain outside direct transfer', () => {
  const target = canonicalContext();
  const sameMathematics = canonicalContext({ effectiveStackBb: 110 });
  const compatible = createRfiContextTransferRelationship(scope(sameMathematics), scope(target));
  assert.equal(compatible.eligible, false);
  assert.equal(compatible.rejectionReason,
    RFI_CONTEXT_TRANSFER_REJECTION_REASONS.ACTION_SET_INCOMPATIBLE);
  assert.equal(compatible.dimensions.actionSet.compatible, true);
  assert.equal(compatible.dimensions.gameRules.compatible, true);
  assert.equal(compatible.dimensions.gameRules.donor.identity.kind, 'semantic_fingerprint');

  const anteDifference = canonicalContext({ effectiveStackBb: 110, anteAmountMilliBb: 100 });
  const incompatibleRules = createRfiContextTransferRelationship(scope(anteDifference), scope(target));
  assert.equal(incompatibleRules.dimensions.gameRules.compatible, false);
  assert.equal(incompatibleRules.rejectionReason,
    RFI_CONTEXT_TRANSFER_REJECTION_REASONS.ACTION_SET_INCOMPATIBLE);

  const allInActionSet = canonicalContext({ effectiveStackBb: 110, allIn: true });
  const incompatibleActions = createRfiContextTransferRelationship(scope(allInActionSet), scope(target));
  assert.equal(incompatibleActions.dimensions.actionSet.compatible, false);
  assert.equal(incompatibleActions.rejectionReason,
    RFI_CONTEXT_TRANSFER_REJECTION_REASONS.ACTION_SET_INCOMPATIBLE);
});

test('strong direct donor transfers qualitatively without manufacturing frequency precision', () => {
  const targetContext = context();
  const donorContext = context({ effectiveStackBb: 110 });
  const dominant = direct(donorContext, 'A5s', ACTION_TYPES.RAISE);
  const exactSource = exact(donorContext, 'K9s', 0.25, 0.75);
  const tiedSource = exact(donorContext, 'QTs', 0.5, 0.5);
  const source = donor(targetContext, donorContext, [dominant, exactSource, tiedSource]);
  const projection = createRfiContextTransferProjection({
    targetSnapshot: snapshot(targetContext),
    relationships: [source.relationship],
    donors: [source],
  });

  const dominantTransfer = estimate(projection, 'A5s');
  assert.equal(dominantTransfer.state, RFI_CONTEXT_TRANSFER_ESTIMATE_STATES.TRANSFERRED);
  assert.deepEqual(dominantTransfer.dominantAction, { type: ACTION_TYPES.RAISE });
  assert.equal(dominantTransfer.exactFrequencies, null);
  assert.equal(dominantTransfer.donorContributions[0].sourcePrecision, 'dominant_only');

  const exactTransfer = estimate(projection, 'K9s');
  assert.equal(exactTransfer.state, RFI_CONTEXT_TRANSFER_ESTIMATE_STATES.TRANSFERRED);
  assert.equal(exactTransfer.exactFrequencies, null);
  assert.equal(exactTransfer.donorContributions[0].sourcePrecision, 'exact_mix');
  assert.deepEqual(exactTransfer.donorContributions[0].sourceExactFrequencies,
    snapshot(donorContext, [exactSource]).estimates.find((entry) => entry.handClass === 'K9s')
      .exactFrequencies);

  const tiedTransfer = estimate(projection, 'QTs');
  assert.equal(tiedTransfer.state, RFI_CONTEXT_TRANSFER_ESTIMATE_STATES.UNCERTAIN);
  assert.equal(tiedTransfer.dominantAction, null);
  assert.equal(tiedTransfer.donorContributions[0].sourcePrecision, 'tied_exact_mix');
});

test('smooth synthetic neighbor gains bounded sparse coverage without turning all 169 hands into transfer', () => {
  const targetContext = context();
  const donorContext = context({ effectiveStackBb: 110 });
  const smoothHands = ['AA', 'KK', 'QQ', 'AKs', 'AQs', 'AJs', 'ATs', 'KQs', 'KJs', 'QJs', 'JTs', 'AKo'];
  const observations = smoothHands.map((handClass, index) => direct(
    donorContext,
    handClass,
    ACTION_TYPES.RAISE,
    { id: `smooth-${index}` },
  ));
  const source = donor(targetContext, donorContext, observations);
  const projection = createRfiContextTransferProjection({
    targetSnapshot: snapshot(targetContext),
    relationships: [source.relationship],
    donors: [source],
  });
  assert.equal(projection.summary.transferredCount, smoothHands.length);
  assert.equal(projection.summary.unavailableCount, 169 - smoothHands.length);
  assert.equal(projection.summary.uncertainCount, 0);
  assert.equal(projection.estimates.filter((entry) => (
    entry.state === RFI_CONTEXT_TRANSFER_ESTIMATE_STATES.TRANSFERRED
  )).every((entry) => entry.transferBand === RFI_CONTEXT_TRANSFER_BANDS.STRONG), true);
});

test('multiple donors are order-independent, context-deduplicated, capped, and abstain on contradiction', () => {
  const targetContext = context();
  const donorContexts = [
    context({ effectiveStackBb: 105 }),
    context({ effectiveStackBb: 115 }),
    context({ heroPosition: 'CO' }),
    context({ tableSize: 5, heroPosition: 'BTN' }),
  ];
  const agreeing = donorContexts.map((donorContext, index) => donor(
    targetContext,
    donorContext,
    [direct(donorContext, 'A5s', ACTION_TYPES.RAISE, { id: `agree-${index}` })],
  ));
  const targetSnapshot = snapshot(targetContext);
  const forward = createRfiContextTransferProjection({
    targetSnapshot,
    relationships: agreeing.map((entry) => entry.relationship),
    donors: [...agreeing, agreeing[0]],
  });
  const reverse = createRfiContextTransferProjection({
    targetSnapshot,
    relationships: agreeing.map((entry) => entry.relationship).reverse(),
    donors: [...agreeing].reverse(),
  });
  assert.deepEqual(reverse, forward);
  const combined = estimate(forward, 'A5s');
  assert.equal(combined.state, RFI_CONTEXT_TRANSFER_ESTIMATE_STATES.TRANSFERRED);
  assert.equal(combined.donorContributions.length, MAX_RFI_TRANSFER_CONTRIBUTORS_PER_HAND);
  assert.equal(new Set(combined.donorContributions.map((entry) => entry.donorContextKey)).size,
    combined.donorContributions.length);

  const contraryContext = context({ effectiveStackBb: 108 });
  const contrary = donor(targetContext, contraryContext, [
    direct(contraryContext, 'A5s', ACTION_TYPES.FOLD, { id: 'contrary-fold' }),
  ]);
  const contradicted = createRfiContextTransferProjection({
    targetSnapshot,
    relationships: [agreeing[0].relationship, contrary.relationship],
    donors: [agreeing[0], contrary],
  });
  assert.equal(estimate(contradicted, 'A5s').state,
    RFI_CONTEXT_TRANSFER_ESTIMATE_STATES.UNCERTAIN);
  assert.equal(estimate(contradicted, 'A5s').dominantAction, null);
});

test('target direct, local inferred, uncertain, and conflicting states all outrank transfer', () => {
  const targetContext = context();
  const donorContext = context({ effectiveStackBb: 110 });
  const donorSource = donor(targetContext, donorContext, [
    direct(donorContext, 'A5s', ACTION_TYPES.RAISE, { id: 'donor-a5s' }),
    direct(donorContext, 'AJs', ACTION_TYPES.RAISE, { id: 'donor-ajs' }),
  ]);
  const localEvidence = [
    direct(targetContext, 'A5s', ACTION_TYPES.FOLD, { id: 'target-direct' }),
    ...['AQs', 'ATs', 'A9s', 'KJs', 'KTs', 'QJs', 'QTs', 'JTs'].map((handClass, index) => (
      direct(targetContext, handClass, ACTION_TYPES.RAISE, { id: `target-neighbor-${index}` })
    )),
  ];
  const projection = createRfiContextTransferProjection({
    targetSnapshot: snapshot(targetContext, localEvidence),
    relationships: [donorSource.relationship],
    donors: [donorSource],
  });
  assert.equal(estimate(projection, 'A5s').state,
    RFI_CONTEXT_TRANSFER_ESTIMATE_STATES.LOCAL_PRECEDENCE);
  assert.equal(estimate(projection, 'AJs').state,
    RFI_CONTEXT_TRANSFER_ESTIMATE_STATES.LOCAL_PRECEDENCE);
  assert.equal(estimate(projection, 'A5s').sourceEvidenceIds.length, 0);
});

test('profile and mode display-name changes are outside semantic transfer identity', () => {
  const targetContext = context();
  const donorContext = context({ effectiveStackBb: 110 });
  const beforeRename = createRfiContextTransferRelationship(scope(donorContext), scope(targetContext));
  const profile = { id: PROFILE_ID, displayName: 'Before' };
  const mode = { id: MODE_ID, displayName: 'Normal' };
  profile.displayName = 'After';
  mode.displayName = 'Renamed mode';
  const afterRename = createRfiContextTransferRelationship(
    scope(donorContext, { profileId: profile.id, modeId: mode.id }),
    scope(targetContext, { profileId: profile.id, modeId: mode.id }),
  );
  assert.deepEqual(afterRename, beforeRename);
});

test('repository discovery, Matrix, and Teacher expose transfer without durable or sync writes', async () => {
  let id = 0;
  let tick = 0;
  const mutations = [];
  const application = createRangeCalibrationApplication({
    storage: memoryStorage(),
    database: createMemoryPersonalStrategyDatabase({ name: 'range-intelligence-003a-integration' }),
    idFactory: (prefix) => `${prefix}-${++id}`,
    clock: () => new Date(Date.parse(T0) + tick++ * 1000),
    onLocalMutation: (mutation) => mutations.push(mutation),
  });
  const bundle = await application.createProfile({
    displayName: 'Transfer profile',
    description: '',
    environment: 'home',
    modeNames: ['Normal', 'Cautious', 'Pressure'],
  });
  const donorContext = context({ effectiveStackBb: 110 });
  const targetContext = context();
  const donorScope = {
    profileId: bundle.profile.id,
    modeId: bundle.modes[0].id,
    context: donorContext,
  };
  const targetScope = { ...donorScope, context: targetContext };
  await application.recordPersonalStrategyMatrixEvidence(null, {
    ...donorScope,
    handClass: 'A5s',
    actionType: ACTION_TYPES.RAISE,
  });
  mutations.length = 0;
  const before = await application.repository.loadSnapshot();

  const catalog = await application.repository.loadEvidenceScopeCatalog(donorScope);
  assert.equal(catalog.scopes.length, 1);
  assert.equal(catalog.scopes[0].activeHeadIds.length, 1);
  const transferProjection = await application.getTransferProjection(targetScope);
  assert.equal(estimate(transferProjection, 'A5s').state,
    RFI_CONTEXT_TRANSFER_ESTIMATE_STATES.TRANSFERRED);
  const matrix = await application.getPersonalStrategyMatrixProjection(targetScope);
  const transferredCell = matrix.cells.find((entry) => entry.handClass === 'A5s');
  assert.equal(transferredCell.status, PERSONAL_STRATEGY_MATRIX_STATUSES.TRANSFERRED);
  assert.equal(transferredCell.localStatus, 'unknown');
  assert.equal(transferredCell.provenance, 'transferred');
  assert.equal(transferredCell.statusMarker, 'T');
  assert.equal(transferredCell.action.kind, 'raise');
  assert.equal(transferredCell.action.exactFrequencies, null);
  assert.equal(transferredCell.transfer.donorContributions.length, 1);

  const teacher = await application.getRangeTeacherView(targetScope, { selectedHandClass: 'A5s' });
  assert.equal(teacher.summary.transferredCount, 1);
  assert.equal(teacher.transferredInsights[0].handClass, 'A5s');
  assert.equal(teacher.selectedHand.transfer.state,
    RFI_CONTEXT_TRANSFER_ESTIMATE_STATES.TRANSFERRED);
  assert.match(teacher.transferredInsights[0].whyKey, /compatible nearby RFI contexts/);

  const after = await application.repository.loadSnapshot();
  assert.deepEqual(after, before, 'derived transfer reads do not mutate the repository');
  assert.equal(mutations.length, 0, 'derived transfer reads do not emit local sync mutations');
  const portable = await application.exportPortable();
  const syncEntities = await application.repository.listSyncEntities();
  assert.doesNotMatch(JSON.stringify(portable), /rfi-transfer|transferredInsights|donorContributions/);
  assert.doesNotMatch(JSON.stringify(syncEntities), /rfi-transfer|transferredInsights|donorContributions/);
  const metrics = application.getProjectionCacheMetrics();
  assert.ok(metrics.transferCatalogLoads >= 1);
  assert.equal(metrics.cachedScopeCount <= 2, true);
});

test('Matrix and Teacher visible seams label transferred provenance in EN, RU, and HE structure', async () => {
  const [workspace, html, css, translations] = await Promise.all([
    readFile(new URL('../app/src/application/range-calibration-workspace.mjs', import.meta.url), 'utf8'),
    readFile(new URL('../app/index.html', import.meta.url), 'utf8'),
    readFile(new URL('../app/styles.css', import.meta.url), 'utf8'),
    readFile(new URL('../app/src/locales/range-calibration-translations.js', import.meta.url), 'utf8'),
  ]);
  assert.match(html, /data-matrix-status="transferred"><i>T<\/i>/);
  assert.match(html, /id="calibrationTeacherTransferred"/);
  assert.match(html, /id="calibrationTeacherTransferredList"/);
  assert.match(css, /data-matrix-status="transferred"/);
  assert.match(workspace, /transferred:\s*'Transferred'/);
  assert.match(workspace, /cell\.status === 'transferred'/);
  assert.match(workspace, /rangeTeacherView\.transferredInsights/);
  assert.match(translations, /'Transferred':\s*'Перенесено'/);
  assert.match(translations, /'Transferred':\s*'מועבר'/);
});
