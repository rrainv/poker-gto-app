// Presentation contract: domain owners supply facts; this module grants no
// poker, source-acceptance, persistence, or assessment authority.
export const NATURAL_LANGUAGE_ENVELOPE_VERSION = 'natural-language-envelope/v1';
export const NATURAL_LANGUAGE_CLAIM_CLASSES = Object.freeze([
  'factual', 'interpretive', 'user_intent_inference', 'strategic_normative',
]);

export function freezeLanguageData(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(freezeLanguageData);
  return Object.freeze(value);
}

export function createNaturalLanguageEnvelope({ claimClass, subject, evidenceRefs = [],
  scope = {}, uncertainty = [], basis = 'current', wordingStrength = 'descriptive',
  derivation = null, permission = null, correctionCommand = null, facts = {} } = {}) {
  if (!NATURAL_LANGUAGE_CLAIM_CLASSES.includes(claimClass)) throw new TypeError('Unsupported language claim class');
  if (!subject || typeof subject.role !== 'string' || !subject.role) throw new TypeError('Language subject role is required');
  if (!Array.isArray(evidenceRefs) || !evidenceRefs.length || evidenceRefs.some((ref) => typeof ref !== 'string' || !ref)) {
    throw new TypeError('Language claims require inspectable evidence references');
  }
  if (!['current', 'historical', 'provisional'].includes(basis)) throw new TypeError('Unsupported language basis');
  if (!['descriptive', 'provisional', 'comparative'].includes(wordingStrength)) {
    // No range assessment owner exists in v1. Action-level permission cannot
    // unlock normative region language, including via a caller-supplied flag.
    throw new RangeError('Normative language requires a separately accepted domain assessment contract');
  }
  if (claimClass === 'user_intent_inference' && (basis !== 'provisional' || wordingStrength !== 'provisional')) {
    throw new RangeError('Intent inference must remain provisional');
  }
  if (claimClass === 'interpretive' && !derivation?.criterion) throw new TypeError('Interpretation requires a named criterion');
  if (claimClass === 'strategic_normative' && (wordingStrength !== 'comparative'
    || permission?.comparison !== true || permission?.normative !== false || !permission?.criterion)) {
    throw new RangeError('Strategic language requires bounded comparative permission');
  }
  return freezeLanguageData(structuredClone({ schemaVersion: NATURAL_LANGUAGE_ENVELOPE_VERSION,
    claimClass, subject, evidenceRefs: [...new Set(evidenceRefs)], scope, uncertainty, basis,
    wordingStrength, derivation, permission, correctionCommand, facts }));
}
