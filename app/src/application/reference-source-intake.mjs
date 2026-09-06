import { validateReferencePack, computeReferencePackContentHash, REFERENCE_PACK_ADAPTER_VERSION } from './reference-pack-v1.mjs';
import { createReferenceCoverageMap, queryReferenceCoverage } from './reference-coverage.mjs';
import { isTrustedStrategySourceAcceptance } from './strategy-source-authority.mjs';
import { PREFLOP_HAND_CLASSES } from '../../../shared/poker-domain/index.js';

export const REFERENCE_SOURCE_INTAKE_VERSION = 'reference-source-intake/v1';
export const REFERENCE_SOURCE_PARSER_VERSION = 'reference-source-json-parser/v1';
export const REFERENCE_SOURCE_CLASSES = Object.freeze(['licensed_solver_export', 'private_solver_export',
  'curated_exact_reference', 'reproducible_solver_run', 'public_educational_range', 'synthetic_benchmark']);
export const REFERENCE_SOURCE_MAX_BYTES = 2 * 1024 * 1024;
const validatedIntakes = new WeakSet();
const freeze = (v) => {
  if (v && typeof v === 'object' && !Object.isFrozen(v)) { Object.values(v).forEach(freeze); Object.freeze(v); }
  return v;
};
function exactKeys(v, keys, label) {
  if (!v || typeof v !== 'object' || Array.isArray(v)
    || Object.keys(v).sort().join('|') !== [...keys].sort().join('|')) throw new TypeError(`Invalid ${label} fields`);
}
function text(v, label) {
  if (typeof v !== 'string' || !v.trim() || v.length > 2000) throw new TypeError(`Invalid ${label}`);
  return v;
}
function canonical(v, depth = 0) {
  if (depth > 40) throw new RangeError('Source nesting exceeds the import limit');
  if (v === null || typeof v === 'boolean' || typeof v === 'string') return JSON.stringify(v);
  if (typeof v === 'number' && Number.isFinite(v)) return JSON.stringify(v);
  if (Array.isArray(v)) return `[${v.map((entry) => canonical(entry, depth + 1)).join(',')}]`;
  if (!v || typeof v !== 'object' || ![Object.prototype, null].includes(Object.getPrototypeOf(v))) {
    throw new TypeError('Source intake requires declarative JSON');
  }
  return `{${Object.keys(v).sort().map((key) => {
    if (['__proto__', 'constructor', 'prototype'].includes(key)) throw new TypeError('Unsafe source key');
    const d = Object.getOwnPropertyDescriptor(v, key);
    if (!Object.hasOwn(d, 'value')) throw new TypeError('Source accessors are not permitted');
    return `${JSON.stringify(key)}:${canonical(d.value, depth + 1)}`;
  }).join(',')}}`;
}
async function sha256(serialized) {
  const digest = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(serialized));
  return `sha256:${Array.from(new Uint8Array(digest), (n) => n.toString(16).padStart(2, '0')).join('')}`;
}

// Validation is deliberately not acceptance. Manifest review statements are unverified evidence.
export async function validateReferenceSourceIntake(input) {
  if (validatedIntakes.has(input)) return input;
  const serialized = canonical(input);
  if (new TextEncoder().encode(serialized).length > REFERENCE_SOURCE_MAX_BYTES) throw new RangeError('Source exceeds the import limit');
  const raw = JSON.parse(serialized); // detach before any await
  exactKeys(raw, ['schemaVersion', 'sourceClass', 'visibility', 'displayName', 'localUse', 'pack'], 'source intake');
  if (raw.schemaVersion !== REFERENCE_SOURCE_INTAKE_VERSION) throw new TypeError('Unsupported source intake version');
  if (!REFERENCE_SOURCE_CLASSES.includes(raw.sourceClass)) throw new TypeError('Unsupported source class');
  if (!['private_local', 'redistributable'].includes(raw.visibility)) throw new TypeError('Invalid source visibility');
  exactKeys(raw.localUse, ['status', 'evidence'], 'local use');
  if (!['permitted', 'prohibited', 'unknown'].includes(raw.localUse.status)) throw new TypeError('Invalid local-use status');
  text(raw.localUse.evidence, 'local-use evidence'); text(raw.displayName, 'source name');
  const pack = validateReferencePack(raw.pack);
  const synthetic = pack.manifest.validation.status === 'synthetic_test_only';
  if (synthetic !== (raw.sourceClass === 'synthetic_benchmark')) throw new TypeError('Synthetic source classification must be preserved');
  if (raw.sourceClass === 'private_solver_export' && raw.visibility !== 'private_local') throw new TypeError('Private solver exports must remain local');
  if (raw.visibility === 'redistributable' && (pack.manifest.source.redistribution.status !== 'permitted'
    || !pack.manifest.source.redistribution.repositoryInclusionPermitted)) throw new TypeError('Redistribution permission is missing');
  const fingerprint = await sha256(serialized);
  const nodeIdentity = await sha256(canonical(raw.pack.manifest.gameAssumptions));
  const intake = freeze({ schemaVersion: REFERENCE_SOURCE_INTAKE_VERSION,
    sourceClass: raw.sourceClass, visibility: raw.visibility, displayName: raw.displayName,
    localUse: raw.localUse, fingerprint, legacyPackFingerprint: pack.integrity.contentHash,
    pack, coverage: createReferenceCoverageMap(pack, nodeIdentity),
    parserVersion: REFERENCE_SOURCE_PARSER_VERSION, adapterVersion: REFERENCE_PACK_ADAPTER_VERSION,
    // Runtime activation is intentionally separate from this local inspection foundation.
    activation: raw.visibility === 'private_local' ? 'preview_only' : 'application_owned', cloudUploadPermitted: false,
  });
  validatedIntakes.add(intake);
  return intake;
}

export function isValidatedReferenceSourceIntake(value) { return validatedIntakes.has(value); }

export async function importPrivateReferenceSource(file) {
  if (!file || typeof file.text !== 'function' || !Number.isSafeInteger(file.size)
    || file.size < 0 || file.size > REFERENCE_SOURCE_MAX_BYTES) throw new TypeError('Select a bounded local JSON file');
  const content = await file.text();
  if (typeof content !== 'string' || new TextEncoder().encode(content).length > REFERENCE_SOURCE_MAX_BYTES) throw new RangeError('Source exceeds the import limit');
  const raw = JSON.parse(content);
  if (raw.visibility !== 'private_local') throw new TypeError('Private import requires private_local visibility');
  return validateReferenceSourceIntake(raw);
}

function acceptanceFor(intake, registry) {
  const d = intake.pack.manifest.sourceDescriptor;
  const record = registry?.acceptanceFor(d, intake.fingerprint) ?? null;
  return isTrustedStrategySourceAcceptance(record, d, intake.fingerprint)
    && ['comparative_reference', 'validated_reference'].includes(record.acceptedAuthority)
    && record.acceptedCoverageCeiling === 'exact'
    && record.acceptedCoverageIdentity === intake.coverage.nodes[0].nodeIdentity ? record : null;
}

// Append-only, process-local validation observations. No IndexedDB, sync, fetch or filesystem access.
export function createSourceHealthLedger({ now = () => new Date().toISOString() } = {}) {
  const entries = [];
  return Object.freeze({
    async inspect(input, { decisionContext = null, sourceAcceptanceRegistry = null } = {}) {
      let intake;
      try { intake = await validateReferenceSourceIntake(input); }
      catch (error) {
        let integrityStatus = 'unavailable';
        let fingerprint = null;
        try { fingerprint = await sha256(canonical(input)); } catch { /* not portable JSON */ }
        try { integrityStatus = computeReferencePackContentHash(input.pack) === input.pack.integrity.contentHash ? 'checksum_verified' : 'failed'; } catch { /* invalid pack */ }
        const rows = input?.pack?.representation?.rows;
        const present = new Set(Array.isArray(rows) ? rows.map((row) => row?.handClass) : []);
        const missing = PREFLOP_HAND_CLASSES.filter((handClass) => !present.has(handClass));
        const entry = freeze({ schemaVersion: 'source-health-entry/v1', revision: entries.length + 1,
          lastValidation: now(), source: { id: typeof input?.pack?.manifest?.sourceDescriptor?.id === 'string' ? input.pack.manifest.sourceDescriptor.id : null,
            version: typeof input?.pack?.manifest?.sourceDescriptor?.version === 'string' ? input.pack.manifest.sourceDescriptor.version : null,
            fingerprint }, integrityStatus, validationStatus: 'rejected', acceptanceStatus: 'rejected',
          parserVersion: REFERENCE_SOURCE_PARSER_VERSION, adapterVersion: REFERENCE_PACK_ADAPTER_VERSION,
          coverageSummary: { state: 'partial', verified: false, exactNodes: 0,
            declaredHandClassesPresent: 169 - missing.length }, incompatibleAssumptions: [],
          missingFilesOrNodes: missing.length ? missing.map((handClass) => `preflop:${handClass}`) : ['valid_complete_reference_pack'],
          redistribution: 'unknown', independentValidationStatus: 'not_reviewed',
          diagnostic: error instanceof Error ? error.message : 'Invalid source' });
        entries.push(entry); return entry;
      }
      const accepted = acceptanceFor(intake, sourceAcceptanceRegistry);
      const coverage = decisionContext ? queryReferenceCoverage(intake.pack, decisionContext, intake.coverage.nodes[0].nodeIdentity) : null;
      const entry = freeze({ schemaVersion: 'source-health-entry/v1', revision: entries.length + 1,
        lastValidation: now(), source: { id: intake.pack.manifest.sourceDescriptor.id,
          version: intake.pack.manifest.sourceDescriptor.version, fingerprint: intake.fingerprint },
        sourceClass: intake.sourceClass, visibility: intake.visibility,
        integrityStatus: 'sha256_computed_checksum_verified', validationStatus: 'structurally_valid',
        acceptanceStatus: accepted ? 'accepted' : 'pending_review',
        acceptedCoverageIdentity: accepted?.acceptedCoverageIdentity ?? null,
        acceptedClaimClasses: accepted?.acceptedClaimClasses ?? [],
        parserVersion: intake.parserVersion, adapterVersion: intake.adapterVersion,
        coverageSummary: intake.coverage.summary, coverage,
        incompatibleAssumptions: coverage?.incompatibleDimensions ?? [], missingFilesOrNodes: [],
        license: intake.pack.manifest.source.license, redistribution: intake.pack.manifest.source.redistribution,
        localUse: intake.localUse, independentValidationStatus: accepted?.independentValidationStatus ?? 'not_reviewed',
        declaredValidationEvidence: intake.pack.manifest.validation,
        activation: intake.activation, cloudUploadPermitted: false,
      });
      entries.push(entry); return entry;
    },
    snapshot() { return freeze([...entries]); },
  });
}
