import { createHoldemWeightedRangeFromEntries, validateHoldemWeightedRange } from './holdem-range.js';

/** Quantitative operation only. Application adapters must prove exact context,
 * action/size and source compatibility before invoking it. Unknown x zero stays
 * unknown because a missing operand is not quantitative evidence. */
export function multiplyHoldemRangeByActionFrequencies(priorRange, frequencyRange) {
  validateHoldemWeightedRange(priorRange); validateHoldemWeightedRange(frequencyRange);
  const provenanceSources = [
    ...priorRange.provenance.sources.map(source => ({ ...source, id: `prior:${source.id}` })),
    ...frequencyRange.provenance.sources.map(source => ({ ...source, id: `policy:${source.id}` })),
    ...priorRange.entries.map((prior, index) => ({ id: `multiply:${prior.comboId}`, kind: 'derived_filter',
      sourceId: JSON.stringify({ prior: prior.provenanceId === null ? null : `prior:${prior.provenanceId}`,
        policy: frequencyRange.entries[index].provenanceId === null ? null : `policy:${frequencyRange.entries[index].provenanceId}` }),
      operation: 'prior_weight_times_exact_action_frequency/v1' })),
  ];
  return createHoldemWeightedRangeFromEntries({ provenanceSources,
    entries: priorRange.entries.map((prior, index) => {
      const frequency = frequencyRange.entries[index];
      return prior.state === 'known' && frequency.state === 'known'
        ? { comboId: prior.comboId, state: 'known', weight: prior.weight * frequency.weight, provenanceId: `multiply:${prior.comboId}` }
        : { comboId: prior.comboId, state: 'unknown', provenanceId: `multiply:${prior.comboId}` };
    }) });
}
