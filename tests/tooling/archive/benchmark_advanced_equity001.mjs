import { performance } from 'node:perf_hooks';
import { calculateWeightedEquity } from '../../shared/poker-domain/weighted-equity.js';
import { createHoldemWeightedRangeFromEntries } from '../../shared/poker-domain/holdem-range.js';
import { HOLDEM_COMBOS } from '../../shared/poker-domain/holdem-combos.js';
import { weightedRangePlayer, parseExplicitEquityRange } from '../../app/src/application/weighted-equity-consumers.mjs';
import { exploreRunouts } from '../../app/src/application/runout-explorer.mjs';
const full = createHoldemWeightedRangeFromEntries({ entries: HOLDEM_COMBOS.map(combo => ({ comboId: combo.id, state: 'known', weight: 1 })) });
const dense = { schemaVersion: 'weighted-equity-request/v1', players: [weightedRangePlayer('A', full), weightedRangePlayer('B', full)],
  board: ['2c', '3d', '4h', '9c'], deadCards: [], method: 'auto', seed: 19, samples: 2000 };
async function measure(name, operation) {
  const start = performance.now(), result = await operation();
  console.log(JSON.stringify({ name, durationMs: Math.round(performance.now() - start), status: result.status,
    method: result.method, trials: result.trials, attempts: result.metadata?.attempts,
    rows: result.rows?.length, serializedBytes: Buffer.byteLength(JSON.stringify(result)) }));
  if (!result.players?.length && !result.rows?.length) process.exitCode = 1;
}
await measure('dense_range_vs_range_2000', () => calculateWeightedEquity(dense));
await measure('all_rivers_exact_hand_vs_range', () => exploreRunouts({ ...dense,
  players: [{ id: 'hero', kind: 'exact', cards: ['As', 'Ad'] },
    weightedRangePlayer('opponent', parseExplicitEquityRange('QQ:1 AKs:0.5', 'known_zero'))] }));
