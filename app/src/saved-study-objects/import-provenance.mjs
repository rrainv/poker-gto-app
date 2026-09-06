export const HAND_IMPORT_PROVENANCE_VERSION = 'hand-import-provenance/v1';
const fields = ['schemaVersion', 'importVersion', 'sourceFormat', 'parserVersion', 'rawTextFingerprint',
  'sourceHandId', 'sourceTimestamp', 'canonicalHandId', 'reconstructionVersion', 'reconstructionStatus',
  'factSummary', 'tableIdentity', 'sourcePlayers', 'rawTextRetention'];
function keys(value, expected) {
  if (!value || typeof value !== 'object' || Array.isArray(value)
    || Object.keys(value).sort().join() !== [...expected].sort().join()) throw new TypeError('Unsupported import provenance fields');
}
function text(value) { if (typeof value !== 'string' || !value.trim() || value.length > 1000) throw new TypeError('Invalid import provenance text'); }
export function validateHandImportProvenance(value, state) {
  keys(value, fields);
  if (value.schemaVersion !== HAND_IMPORT_PROVENANCE_VERSION || value.importVersion !== 'hand-history-import/v1'
    || value.reconstructionStatus !== 'complete' || value.rawTextRetention !== 'not_stored') throw new TypeError('Unsupported or incomplete import provenance');
  for (const field of ['sourceFormat', 'parserVersion', 'canonicalHandId', 'reconstructionVersion']) text(value[field]);
  for (const field of ['sourceHandId', 'sourceTimestamp']) if (value[field] !== null) text(value[field]);
  if (!/^sha256:[0-9a-f]{64}$/.test(value.rawTextFingerprint)
    || value.canonicalHandId !== `import-${value.rawTextFingerprint.slice(7)}`
    || value.canonicalHandId !== state.handId || !state.recordedSettlement) throw new RangeError('Import provenance must match the completely reconstructed Hand');
  keys(value.factSummary, ['exact', 'inferred', 'missing', 'ambiguous', 'unsupported']);
  for (const [kind, refs] of Object.entries(value.factSummary)) {
    if (!Array.isArray(refs) || refs.length > 1000) throw new TypeError('Invalid fact summary');
    refs.forEach(text);
    if (['missing', 'ambiguous', 'unsupported'].includes(kind) && refs.length) throw new RangeError('Incomplete facts cannot be saved as a reconstructed imported Hand');
  }
  keys(value.tableIdentity, ['name', 'capacity', 'currency']); text(value.tableIdentity.name); text(value.tableIdentity.currency);
  if (!Number.isInteger(value.tableIdentity.capacity) || value.tableIdentity.capacity < state.players.length || value.tableIdentity.capacity > 10) throw new RangeError('Invalid source table size');
  if (!Array.isArray(value.sourcePlayers) || value.sourcePlayers.length !== state.players.length) throw new RangeError('Source roster required');
  const seen = new Set();
  for (const player of value.sourcePlayers) {
    keys(player, ['playerId', 'sourceName', 'seat']); text(player.sourceName);
    if (seen.has(player.playerId) || !state.players.some(p => p.playerId === player.playerId && p.seat === player.seat)) throw new RangeError('Source roster mismatch');
    seen.add(player.playerId);
  }
  return value;
}
