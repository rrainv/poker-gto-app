import { createOpponentPracticeRequest, createSyntheticConfiguration, SYNTHETIC_PRESETS } from './synthetic-opponent-policy.mjs';

// Session-local configuration. Appearance never enters policy requests or random seeds.
export function createTrainingLineup() {
  const entries = new Map();
  let seats = [];
  return Object.freeze({
    reset() { entries.clear(); seats = []; },
    sync(nextSeats) {
      seats = nextSeats;
      for (const seat of entries.keys()) if (!seats.some(player => player.seat === seat && !player.isHero)) entries.delete(seat);
      for (const player of seats.filter(player => !player.isHero)) if (!entries.has(player.seat)) entries.set(player.seat, { character: player.identity, preset: 'calling-heavy', configuration: createSyntheticConfiguration() });
    },
    get(seat) { const entry = entries.get(seat); return entry ? structuredClone(entry) : null; },
    character(seat, character) { if (!entries.has(seat)) throw new RangeError('Unknown opponent seat'); entries.get(seat).character = character; },
    policy(seat, preset, parameters = SYNTHETIC_PRESETS[preset]) {
      if (!entries.has(seat)) throw new RangeError('Unknown opponent seat');
      const configuration = createSyntheticConfiguration(parameters);
      Object.assign(entries.get(seat), { preset, configuration });
    },
    applyAll(seat) { const source = entries.get(seat); if (!source) return; for (const entry of entries.values()) Object.assign(entry, { preset: source.preset, configuration: source.configuration }); },
    requests(policySeed = 0) { return seats.filter(player => !player.isHero).map(player => ({ seat: player.seat,
      request: createOpponentPracticeRequest({ tableSize: seats.length, target: player.position, policySeed, configuration: entries.get(player.seat).configuration }) })); },
  });
}
