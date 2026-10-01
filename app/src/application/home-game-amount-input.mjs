import { parseMoneyToMinorUnits } from '../home-game/index.mjs';

// Presentation-side reading of Home Game amount fields. Accounting rules stay in
// the Home Game domain; this only decides whether a typed field may be submitted.
export const HOME_GAME_INPUT_MESSAGES = Object.freeze({
  REQUIRED: 'Enter an amount.',
  INVALID: 'Enter a valid amount.',
  POSITIVE: 'Enter an amount greater than zero.',
  REPLACEMENT_POSITIVE: 'Enter an amount greater than zero, or leave it empty to only reverse the entry.',
  CHIPS: 'Enter a whole chip count.',
});

function rawValue(input) {
  // Firefox keeps non-numeric text in a number field but reports value as ''.
  // badInput distinguishes that from a genuinely empty field.
  if (input?.validity?.badInput) return { bad: true, text: '' };
  return { bad: false, text: String(input?.value ?? '').trim() };
}

/**
 * Reads one money field without ever substituting a default amount.
 * required: an empty field is an error; otherwise an empty field yields null.
 * minimumMinor: 0 permits an explicitly typed zero, 1 requires a positive amount.
 */
export function readHomeGameAmount(input, { minorUnit = 2, required = true, minimumMinor = 1, belowMinimumMessage = null } = {}) {
  const { bad, text } = rawValue(input);
  if (bad) return Object.freeze({ ok: false, messageKey: HOME_GAME_INPUT_MESSAGES.INVALID });
  if (text === '') {
    return required
      ? Object.freeze({ ok: false, messageKey: HOME_GAME_INPUT_MESSAGES.REQUIRED })
      : Object.freeze({ ok: true, amountMinor: null });
  }
  let amountMinor;
  try {
    amountMinor = parseMoneyToMinorUnits(text, minorUnit);
  } catch {
    return Object.freeze({ ok: false, messageKey: HOME_GAME_INPUT_MESSAGES.INVALID });
  }
  if (amountMinor < 0) return Object.freeze({ ok: false, messageKey: HOME_GAME_INPUT_MESSAGES.INVALID });
  if (amountMinor < minimumMinor) {
    return Object.freeze({ ok: false, messageKey: belowMinimumMessage || HOME_GAME_INPUT_MESSAGES.POSITIVE });
  }
  return Object.freeze({ ok: true, amountMinor });
}

export function readHomeGameChipCount(input) {
  const { bad, text } = rawValue(input);
  if (bad || !/^\d+$/.test(text)) return Object.freeze({ ok: false, messageKey: HOME_GAME_INPUT_MESSAGES.CHIPS });
  const chipCount = Number(text);
  if (!Number.isSafeInteger(chipCount)) return Object.freeze({ ok: false, messageKey: HOME_GAME_INPUT_MESSAGES.CHIPS });
  return Object.freeze({ ok: true, chipCount });
}

/**
 * In-memory, per-seat typed values that have not been submitted. Keys combine
 * session, participant and field so a re-render can restore what was typed.
 * Nothing here is persisted or reaches the ledger.
 */
export function createHomeGameDraftStore() {
  const drafts = new Map();
  let ownerScope = null;

  function key(sessionId, playerId, field) {
    return `${sessionId}\u0000${playerId}\u0000${field}`;
  }

  return Object.freeze({
    key,
    get(sessionId, playerId, field) {
      return drafts.get(key(sessionId, playerId, field)) || null;
    },
    set(sessionId, playerId, field, patch) {
      const id = key(sessionId, playerId, field);
      const next = { value: '', error: null, ...(drafts.get(id) || {}), ...patch };
      if (next.value === '' && !next.error) drafts.delete(id);
      else drafts.set(id, next);
    },
    clear(sessionId, playerId, field) {
      drafts.delete(key(sessionId, playerId, field));
    },
    // Keep only drafts for seats that can still act in the given active session.
    retain(sessionId, activePlayerIds) {
      const allowed = new Set(activePlayerIds);
      for (const id of [...drafts.keys()]) {
        const [draftSession, playerId] = id.split('\u0000');
        if (draftSession === sessionId && !allowed.has(playerId)) drafts.delete(id);
      }
    },
    clearSession(sessionId) {
      for (const id of [...drafts.keys()]) if (id.split('\u0000')[0] === sessionId) drafts.delete(id);
    },
    // Any owner change (sign-in, sign-out, identity switch) discards every draft.
    setOwnerScope(scope) {
      if (scope === ownerScope) return false;
      ownerScope = scope;
      drafts.clear();
      return true;
    },
    get size() {
      return drafts.size;
    },
  });
}
