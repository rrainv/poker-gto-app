import test from 'node:test';
import assert from 'node:assert/strict';
import { ACTION_TYPES, CHANCE_TYPES, GAME_MODES, applyAction, applyChance, createAction,
  createGameRulesSnapshotFromLegacyGameConfiguration, initializeHandFromGameRulesSnapshot,
} from '../shared/poker-domain/index.js';
import { deriveDecisionContextFromPokerState } from '../app/src/application/decision-context-from-poker-state.mjs';
import { installStrategyProviderBridge } from '../app/src/application/strategy-provider-bootstrap.mjs';
import { resolveStrategyClaimPolicy } from '../app/src/application/strategy-claim-policy.mjs';
import { attachReferencePackIntegrity, validateReferencePack, matchReferencePackContext } from '../app/src/application/reference-pack-v1.mjs';
import { validateReferenceSourceIntake } from '../app/src/application/reference-source-intake.mjs';
import { createStrategySourceAcceptanceRegistry } from '../app/src/application/strategy-source-authority.mjs';
import { resolveHeuristicStrategy } from '../app/src/strategy/heuristic-strategy.mjs';
import { exactContext, syntheticPack } from './fixtures/reference-pack-synthetic.mjs';

const GAME = Object.freeze({
  mode: GAME_MODES.HOME,
  smallBlindMilliBb: 500,
  bigBlindMilliBb: 1000,
  chipUnitMilliBb: 100,
  ante: { type: 'none', amountMilliBb: 0 },
});

const HOLE_CARDS = Object.freeze({
  P0: ['As', 'Kd'], // UTG: AKo
  P1: ['Qs', 'Jd'], // HJ: QJo
  P2: ['Ah', 'Ad'], // CO: AA
  P3: ['9s', '8s'], // BTN: 98s
  P4: ['Kh', 'Qh'], // SB: KQs
  P5: ['Jc', 'Tc'], // BB: JTs
});

function dealtState(id, bbStack = 100_000) {
  const rulesSnapshot = createGameRulesSnapshotFromLegacyGameConfiguration(GAME, 6);
  const state = initializeHandFromGameRulesSnapshot({
    handId: `pilot-test-${id}`,
    rulesSnapshot,
    buttonSeat: 3, // P3 is BTN (SB is P4, BB is P5, UTG is P0, HJ is P1, CO is P2)
    players: Array.from({ length: 6 }, (_, seat) => ({
      playerId: `P${seat}`,
      seat,
      startingStackMilliBb: seat === 5 ? bbStack : 100_000,
    })),
  });
  return applyChance(state, {
    type: CHANCE_TYPES.DEAL_HOLE,
    cardsByPlayer: HOLE_CARDS,
  });
}

function actingPosition(state) {
  return state.players.find((player) => player.playerId === state.actingPlayerId)?.position;
}

function act(state, type, amountToBb = null) {
  return applyAction(
    state,
    createAction(
      state.actingPlayerId,
      type,
      amountToBb === null ? null : amountToBb * 1000,
    ),
  );
}

function foldTo(state, targetPosition) {
  let current = state;
  let guard = 0;
  while (actingPosition(current) !== targetPosition) {
    current = act(current, ACTION_TYPES.FOLD);
    guard += 1;
    if (guard > 8 || current.terminal.isTerminal) {
      throw new RangeError(`Could not fold to ${targetPosition}`);
    }
  }
  return current;
}


test('default browser provider cannot grant reference claims to generated pilot rows', (t) => {
  let state = foldTo(dealtState('default'), 'BTN');
  state = act(state, ACTION_TYPES.RAISE, 2.5);
  state = act(state, ACTION_TYPES.FOLD);
  const context = deriveDecisionContextFromPokerState(state, state.actingPlayerId);
  const result = installStrategyProviderBridge({}).createProvider().resolve(context);
  const policy = resolveStrategyClaimPolicy(result);
  t.diagnostic(JSON.stringify({ source: result.source, authority: policy.authority, exact: policy.claims.exact_frequencies, ev: policy.claims.action_ev }));
  assert.equal(result.source, 'heuristic_preflop');
  assert.equal(policy.claims.exact_frequencies, false);
  assert.equal(policy.claims.action_ev, false);
});

test('canonical 100bb BTN with 20bb BB cannot obtain exact reference coverage', (t) => {
  const provider = installStrategyProviderBridge({}).createProvider();
  for (const bbStack of [20_000, 100_000]) {
    const context = deriveDecisionContextFromPokerState(foldTo(dealtState('btn', bbStack), 'BTN'), 'P3');
    assert.equal(context.startingStackBb, 100);
    assert.equal(context.effectiveStackBb, null);
    const result = provider.resolve(context);
    const policy = resolveStrategyClaimPolicy(result);
    t.diagnostic(JSON.stringify({ source: result.source, authority: policy.authority, exact: policy.claims.exact_frequencies, ev: policy.claims.action_ev }));
    assert.equal(result.source, 'heuristic_preflop');
    assert.equal(policy.claims.exact_frequencies, false);
    assert.equal(policy.claims.action_ev, false);
  }
});

test('v1 rejects multiway and unknown required assumptions before registration', () => {
  for (const mutate of [
    a => { a.opponentBoundary = 'multiway_at_decision'; a.opponentCount = 2; },
    a => { a.effectiveStackBb = null; },
    a => { a.aggressorPosition = null; },
    a => { a.priorActionTree.initialAggressorPosition = null; },
    a => { a.priorActionTree.latestAggressionWasCold = null; },
    a => { a.priorActionTree.heroActionWouldBeCold = null; },
  ]) {
    const pack = structuredClone(syntheticPack());
    mutate(pack.manifest.gameAssumptions);
    assert.throws(() => validateReferencePack(attachReferencePackIntegrity(pack)));
  }
  const context = structuredClone(exactContext());
  context.effectiveStackBb = null;
  assert.equal(matchReferencePackContext(syntheticPack(), context).coverage.kind, 'unsupported');
});

function intakeInput() {
  return {
    schemaVersion: 'reference-source-intake/v1', sourceClass: 'synthetic_benchmark',
    visibility: 'redistributable', displayName: 'Synthetic recovery test fixture',
    localUse: { status: 'permitted', evidence: 'Repository test fixture; no solver provenance' },
    pack: syntheticPack(),
  };
}

function testRegistry(intake, changes = {}) {
  const descriptor = intake.pack.manifest.sourceDescriptor;
  return createStrategySourceAcceptanceRegistry([{
    sourceId: descriptor.id, allowedFamily: descriptor.family,
    acceptedAuthority: descriptor.authority, acceptedVersion: descriptor.version,
    acceptedFingerprint: intake.fingerprint,
    acceptedCapabilities: intake.pack.manifest.capabilities, acceptedCoverageCeiling: 'exact',
    acceptedCoverageIdentity: intake.coverage.nodes[0].nodeIdentity,
    acceptedClaimClasses: ['strategy_presentation', 'reference_match', 'exact_frequencies'],
    validationStatus: 'synthetic_test_only', acceptanceDecisionId: 'recovery-test-only', ...changes,
  }]);
}

test('browser production registration rejects synthetic raw packs and validated intakes', async () => {
  const bridge = installStrategyProviderBridge({});
  const intake = await validateReferenceSourceIntake(intakeInput());
  assert.throws(() => bridge.createProvider({ referencePack: syntheticPack() }), /not eligible/);
  assert.throws(() => bridge.createProvider({ referenceSourceIntake: intake,
    sourceAcceptanceRegistry: testRegistry(intake) }), /not eligible/);
});

test('asynchronous intake leaves default startup independent and preserves explicit test intake compatibility', async () => {
  const raw = intakeInput();
  const pending = validateReferenceSourceIntake(raw);
  raw.displayName = 'mutated during hashing';
  const bridge = installStrategyProviderBridge({});
  assert.equal(bridge.createProvider().resolve(exactContext()).source, 'heuristic_preflop');
  const intake = await pending;
  assert.equal(intake.displayName, 'Synthetic recovery test fixture');
  const result = bridge.createProvider({ referenceSourceIntake: intake,
    allowTestReferencePack: true, sourceAcceptanceRegistry: testRegistry(intake),
  }).resolve(exactContext());
  assert.equal(result.source, intake.pack.manifest.sourceDescriptor.id);
  assert.equal(resolveStrategyClaimPolicy(result).claims.exact_frequencies, true);
  assert.equal(resolveStrategyClaimPolicy(result).claims.normative_grading, false);
  for (const changes of [
    { sourceId: 'reference_pack.different.test' }, { acceptedVersion: 'different' },
    { acceptedFingerprint: `sha256:${'0'.repeat(64)}` },
    { acceptedCoverageIdentity: `sha256:${'0'.repeat(64)}` },
  ]) {
    const mismatched = bridge.createProvider({ referenceSourceIntake: intake,
      allowTestReferencePack: true, sourceAcceptanceRegistry: testRegistry(intake, changes),
    }).resolve(exactContext());
    assert.equal(resolveStrategyClaimPolicy(mismatched).claims.exact_frequencies, false);
  }
});

test('configured test reference falls back once for canonical multiway stacks and unavailable coverage', async () => {
  const intake = await validateReferenceSourceIntake(intakeInput());
  let calls = 0;
  const provider = installStrategyProviderBridge({}).createProvider({ referenceSourceIntake: intake,
    allowTestReferencePack: true, sourceAcceptanceRegistry: testRegistry(intake),
    fallbackResolver(context) { calls += 1; return resolveHeuristicStrategy(context); },
  });
  const unavailable = structuredClone(exactContext());
  unavailable.derivation.source = 'scenario';
  const contexts = [20_000, 100_000].map(stack =>
    deriveDecisionContextFromPokerState(foldTo(dealtState('configured-btn', stack), 'BTN'), 'P3'));
  for (const [index, context] of [...contexts, unavailable].entries()) {
    const result = provider.resolve(context);
    assert.equal(result.source, 'heuristic_preflop');
    const selection = result.details.providerSelection;
    assert.equal(selection.referencePack.coverage, 'unsupported');
    assert.equal(selection.referencePack.coverageQuery.state, index < 2 ? 'incompatible' : 'unavailable');
    assert.equal(selection.selectedSource, 'heuristic_preflop');
    assert.equal(resolveStrategyClaimPolicy(result).claims.exact_frequencies, false);
    assert.equal(calls, index + 1);
  }
});
