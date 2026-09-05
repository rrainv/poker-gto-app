export const QUALITATIVE_EVIDENCE_SCHEMA_VERSION = 'personal-qualitative-evidence/v1';

function freeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.values(value).forEach(freeze); Object.freeze(value);
  }
  return value;
}
function text(value, field) {
  if (typeof value !== 'string' || !value.trim()) throw new TypeError(`${field} is required`);
}
function json(value, field) {
  if (value === undefined || typeof value === 'function' || typeof value === 'symbol'
    || typeof value === 'bigint' || (typeof value === 'number' && !Number.isFinite(value))) {
    throw new TypeError(`${field} must be JSON data`);
  }
  if (value && typeof value === 'object') Object.values(value).forEach((entry) => json(entry, field));
}
export function validateQualitativeEvidence(record) {
  if (record?.schemaVersion !== QUALITATIVE_EVIDENCE_SCHEMA_VERSION) throw new TypeError('Unsupported qualitative evidence schema');
  for (const field of ['id', 'profileId', 'modeId', 'originalWording', 'language', 'createdAt']) text(record[field], field);
  if (!Number.isInteger(record.approachVersion) || record.approachVersion < 1) throw new RangeError('Approach version is required');
  if (!Number.isFinite(Date.parse(record.createdAt))) throw new TypeError('Invalid evidence timestamp');
  if (record.confirmation?.state !== 'confirmed'
    || !Number.isFinite(Date.parse(record.confirmation.confirmedAt))) throw new RangeError('Only user-confirmed qualitative intent may be durable');
  if (!Array.isArray(record.unresolvedTerms) || !Array.isArray(record.supersedesEvidenceIds)
    || new Set(record.supersedesEvidenceIds).size !== record.supersedesEvidenceIds.length) throw new TypeError('Invalid qualitative terms or correction lineage');
  record.supersedesEvidenceIds.forEach((id) => text(id, 'superseded evidence ID'));
  if (record.supersedesEvidenceIds.includes(record.id)) throw new RangeError('Evidence cannot supersede itself');
  if (record.supersedesEvidenceIds.length) text(record.correctionGroupId, 'correctionGroupId');
  for (const field of ['statedScope', 'inferredScope', 'interpretation', 'provenance']) json(record[field], field);
  if (record.provenance?.source !== 'user_intent') throw new RangeError('Qualitative intended evidence requires user-intent provenance');
  if (record.explicitFrequencies !== undefined || record.dominantAction !== undefined) throw new RangeError('Qualitative evidence cannot encode quantitative range actions');
  return record;
}

export function createQualitativeEvidence({ id, profileId, modeId, approachVersion = 1,
  originalWording, language, statedScope = {}, inferredScope = {}, unresolvedTerms = [],
  interpretation, confirmation, supersedesEvidenceIds = [], correctionGroupId = null,
  provenance = { source: 'user_intent' }, createdAt = confirmation?.confirmedAt } = {}) {
  const record = structuredClone({ schemaVersion: QUALITATIVE_EVIDENCE_SCHEMA_VERSION,
    id, profileId, modeId, approachVersion, originalWording, language, statedScope, inferredScope,
    unresolvedTerms, interpretation, confirmation, supersedesEvidenceIds, correctionGroupId, provenance, createdAt });
  validateQualitativeEvidence(record); return freeze(record);
}

export function qualitativeEvidenceHeads(records) {
  const superseded = new Set(records.flatMap((record) => record.supersedesEvidenceIds));
  return records.filter((record) => !superseded.has(record.id));
}

export function validateQualitativeEvidenceHistory(records) {
  const byId = new Map(records.map((record) => [record.id, record]));
  if (byId.size !== records.length) throw new RangeError('Qualitative evidence IDs must be unique');
  records.forEach(validateQualitativeEvidence);
  for (const record of records) {
    const visit = (id, seen) => {
      if (seen.has(id)) throw new RangeError('Qualitative correction history cannot contain cycles');
      const parent = byId.get(id);
      if (!parent || parent.profileId !== record.profileId || parent.modeId !== record.modeId
        || Date.parse(parent.createdAt) > Date.parse(record.createdAt)) throw new RangeError('Qualitative correction references incompatible history');
      parent.supersedesEvidenceIds.forEach((next) => visit(next, new Set([...seen, id])));
    };
    record.supersedesEvidenceIds.forEach((id) => visit(id, new Set([record.id])));
  }
  return records;
}
