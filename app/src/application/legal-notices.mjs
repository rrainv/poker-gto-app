// NOTICES-001: the small, calm legal surface. Two pieces of pure logic, no DOM:
//   - the one-time "18 or older, study tool" confirmation, stored locally once;
//   - the per-language problem-gambling help links. The structure is here, the
//     links are NOT: the owner supplies them (register row LEGAL-HELP-LINKS).
//     Until a language has a link, nothing is rendered for it; no URL is invented.

export const AGE_CONFIRMATION_SCHEMA_VERSION = 'age-confirmation/v1';
export const AGE_CONFIRMATION_STORAGE_KEY = 'riverline.ageConfirmation.v1';

function validStored(value) {
  return Boolean(value
    && value.schemaVersion === AGE_CONFIRMATION_SCHEMA_VERSION
    && value.confirmed === true
    && typeof value.confirmedAt === 'string'
    && Number.isFinite(Date.parse(value.confirmedAt)));
}

export function createAgeConfirmation({
  storage = globalThis.localStorage,
  storageKey = AGE_CONFIRMATION_STORAGE_KEY,
  clock = () => new Date().toISOString(),
} = {}) {
  let memory = null;

  function read() {
    if (memory) return memory;
    try {
      const raw = storage?.getItem?.(storageKey);
      const parsed = raw ? JSON.parse(raw) : null;
      memory = validStored(parsed) ? Object.freeze(parsed) : Object.freeze({ confirmed: false });
    } catch {
      memory = Object.freeze({ confirmed: false });
    }
    return memory;
  }

  return Object.freeze({
    schemaVersion: AGE_CONFIRMATION_SCHEMA_VERSION,
    isConfirmed: () => read().confirmed === true,
    /** Stores the confirmation once; later calls change nothing. */
    confirm() {
      if (read().confirmed === true) return true;
      const next = Object.freeze({
        schemaVersion: AGE_CONFIRMATION_SCHEMA_VERSION,
        confirmed: true,
        confirmedAt: clock(),
      });
      memory = next;
      try { storage?.setItem?.(storageKey, JSON.stringify(next)); } catch { /* kept in memory for this session */ }
      return true;
    },
  });
}

// Owner-supplied help organisations, per language: [{ name, href }].
// Intentionally empty (LEGAL-HELP-LINKS). Do not add a URL here without the owner.
export const LEGAL_HELP_LINKS = Object.freeze({
  en: Object.freeze([]),
  ru: Object.freeze([]),
  he: Object.freeze([]),
});

/** Only well-formed https links with a name are ever returned for rendering. */
export function getHelpLinks(language, source = LEGAL_HELP_LINKS) {
  const list = source?.[language] ?? [];
  return list.filter((entry) => {
    if (!entry || typeof entry.name !== 'string' || !entry.name.trim()) return false;
    try { return new URL(entry.href).protocol === 'https:'; } catch { return false; }
  }).map((entry) => Object.freeze({ name: entry.name.trim(), href: entry.href }));
}
