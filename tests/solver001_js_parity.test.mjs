import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import {
  canonicalParitySnapshot,
  replayCanonical,
} from '../solver/tools/canonical_js_parity.mjs';

const fixtures = JSON.parse(fs.readFileSync(
  new URL('../solver/fixtures/hu_preflop_parity_v1.json', import.meta.url),
  'utf8',
));

test('SOLVER-001 neutral fixtures remain pinned to canonical JS PokerState', () => {
  assert.equal(fixtures.schemaVersion, 'riverline-hu-preflop-parity-fixtures/v1');
  for (const fixture of fixtures.cases) {
    const snapshot = canonicalParitySnapshot(replayCanonical(fixture.actions));
    const common = {
      actor: snapshot.actor,
      potMilliBb: snapshot.potMilliBb,
      stacksMilliBb: snapshot.stacksMilliBb,
      contributionsMilliBb: snapshot.contributionsMilliBb,
      currentBetMilliBb: snapshot.currentBetMilliBb,
      boundaryStatus: snapshot.boundaryStatus,
    };
    const implementation = {
      terminal: snapshot.terminal,
      terminalReason: snapshot.terminalReason,
      phase: snapshot.phase,
      legalFamilies: snapshot.legalFamilies,
    };
    assert.deepEqual(common, fixture.expectedCommon, fixture.name);
    assert.deepEqual(implementation, fixture.expectedCanonical, fixture.name);
  }
});

test('SOLVER-001 fixtures expose rather than hide the preflop leaf abstraction', () => {
  const closed = fixtures.cases.filter((fixture) => (
    fixture.expectedCommon.boundaryStatus === 'preflop_closed'
  ));
  assert.ok(closed.length > 0);
  for (const fixture of closed) {
    assert.equal(fixture.expectedCanonical.terminal, false);
    assert.equal(fixture.expectedCanonical.phase, 'chance');
    assert.equal(fixture.expectedSolver.terminal, true);
    assert.equal(fixture.expectedSolver.terminalReason, 'showdown_equity');
  }
  const boundedFourBet = fixtures.cases.find((fixture) => fixture.name === 'open-4bet-20');
  assert.ok(boundedFourBet.expectedCanonical.legalFamilies.includes('raise'));
  assert.ok(!boundedFourBet.expectedSolver.legalFamilies.includes('raise'));
});

