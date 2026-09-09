import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { importHandHistory } from '../app/src/application/hand-history-import.mjs';
import { reconstructCanonicalHandReplaySource } from '../app/src/application/canonical-hand-replay-source.mjs';
const raw = readFileSync(new URL('./fixtures/hand-history/AllInCall.txt', import.meta.url), 'utf8');

const cases = {
  exact: raw,
  ordinary: raw.replace('Villain ($10', 'Villain ($20').replace('calls $9 and is all-in', 'calls $9'),
  short: raw.replace('Villain ($10', 'Villain ($7').replace('calls $9', 'calls $6')
    .replace('*** FLOP ***', 'Uncalled bet ($3) returned to Hero\n*** FLOP ***').replaceAll('$20', '$14'),
  bet: raw.replace('Hero: raises $9 to $10 and is all-in\nVillain: calls $9 and is all-in\n*** FLOP *** [2c 3d 4h]',
    'Hero: calls $0.50\nVillain: checks\n*** FLOP *** [2c 3d 4h]\nVillain: bets $9 and is all-in\nHero: calls $9 and is all-in'),
};
for (const [name, text] of Object.entries(cases)) test(`import preserves ${name} call semantics and exact settlement`, async () => {
  const result = await importHandHistory(text);
  assert.equal(result.status, 'complete', JSON.stringify(result.diagnostics));
  const calls = result.pokerState.actionHistory.filter(a => a.submittedAction.type === 'call');
  assert.ok(calls.length);
  assert.equal(calls.at(-1).wasAllIn, name !== 'ordinary');
  assert.equal(calls.at(-1).committedMilliBb, name === 'short' ? 6000 : 9000);
  assert.equal(result.pokerState.players[0].currentStackMilliBb, name === 'short' ? 17000 : 20000);
  assert.deepEqual(reconstructCanonicalHandReplaySource(result.replaySource).finalState, result.pokerState);
});
for (const [name, text] of Object.entries({
  wrongCall: raw.replace('calls $9', 'calls $8.94'),
  falseExhaustion: raw.replace('Villain ($10', 'Villain ($20'),
  missingMarker: raw.replace('calls $9 and is all-in', 'calls $9'),
  wrongRaise: raw.replace('raises $9', 'raises $8'),
})) test(`malformed ${name} import still fails closed`, async () => {
  const result = await importHandHistory(text);
  assert.equal(result.status, 'partial');
  assert.equal(result.pokerState, null);
  assert.equal(result.replaySource, null);
});
