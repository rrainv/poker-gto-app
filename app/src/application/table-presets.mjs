import { normalizeCanonicalHandConfiguration } from './canonical-live-controller.mjs';
import { deriveSeatAssignments } from '../../../shared/poker-domain/positions.js';

export function handSetupPositions(tableSize, buttonSeat = 0) {
  return deriveSeatAssignments(Array.from({ length: tableSize }, (_, seat) => ({ seat, playerId: `seat-${seat}` })), buttonSeat);
}

// Convenience only: validate through the live draft normalizer, without initializing a Hand.
export function tablePresetConfiguration(input) {
  const configuration = { tableSize: input.tableSize, stackBb: input.stackBb,
    collectionType: input.collectionType ?? 'none', anteType: input.anteType ?? 'none', anteBb: input.anteBb ?? 0 };
  normalizeCanonicalHandConfiguration({ ...configuration, heroSeat: 0, buttonSeat: 0, straddleBb: 0 });
  return Object.freeze(configuration);
}

export function normalizeTablePresetName(value) {
  const name = String(value ?? '').normalize('NFC').trim().replace(/\s+/gu, ' ');
  if (!name || [...name].length > 60) throw new RangeError('preset_name');
  return name;
}

export function createTablePresetRepository({ storage, ownerId, idFactory = () => crypto.randomUUID(), clock = () => new Date().toISOString() }) {
  if (!ownerId) throw new TypeError('Preset owner required');
  const key = `riverline:table-presets:v1:${encodeURIComponent(ownerId)}`;
  function list() {
    const raw = storage.getItem(key);
    if (!raw) return [];
    const envelope = JSON.parse(raw);
    if (envelope.schemaVersion !== 'table-presets/v1' || !Array.isArray(envelope.items)) throw new TypeError('Invalid preset storage');
    // Preserve unreadable records on disk; expose them as unavailable, never silently repair rules.
    return envelope.items.map(item => {
      try {
        if (typeof item.id !== 'string' || !item.id || envelope.items.filter(other => other.id === item.id).length !== 1
          || Object.keys(item.configuration).sort().join(',') !== 'anteBb,anteType,collectionType,stackBb,tableSize') throw new RangeError('Invalid preset');
        return { ...item, name: normalizeTablePresetName(item.name), configuration: tablePresetConfiguration(item.configuration), available: true };
      }
      catch { return { ...item, available: false }; }
    });
  }
  function write(items) { storage.setItem(key, JSON.stringify({ schemaVersion: 'table-presets/v1', items: items.map(({ available, ...item }) => item) })); }
  return Object.freeze({ list,
    save({ id = null, name, configuration }) {
      const items = list(), existing = id ? items.find(item => item.id === id) : null;
      if (id && !existing) throw new RangeError('Unknown preset');
      const item = { id: id ?? idFactory(), name: normalizeTablePresetName(name), configuration: tablePresetConfiguration(configuration), createdAt: existing?.createdAt ?? clock(), updatedAt: clock() };
      write(existing ? items.map(old => old.id === id ? item : old) : [...items, item]);
      return item;
    },
    remove(id) { write(list().filter(item => item.id !== id)); },
  });
}
