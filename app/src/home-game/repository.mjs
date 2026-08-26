import {
  HOME_GAME_GROUP_SCHEMA_VERSION,
  HOME_GAME_OWNER_TYPES,
  HOME_GAME_PLAYER_SCHEMA_VERSION,
  HOME_GAME_SESSION_SCHEMA_VERSION,
  HOME_GAME_SESSION_STATUS,
  HOME_GAME_TRANSACTION_SCHEMA_VERSION,
  HOME_GAME_TRANSACTION_TYPES,
  calculateHomeGameAccounting,
  completeHomeGameSession,
  createHomeGameChipSnapshot,
  createHomeGameGroup,
  createHomeGameLedgerHistory,
  createHomeGamePlayer,
  createHomeGameSession,
  createHomeGameSettlement,
  createHomeGameTransaction,
  createSessionFromGroup,
  reopenHomeGameSession,
  startHomeGameSession,
  setHomeGameSessionArchived,
  updateHomeGameGroup,
  updateHomeGameParticipant,
  updateHomeGamePlayer,
  validateHomeGameLedger,
} from './domain.mjs';
import {
  HOME_GAME_BACKEND_SCHEMA_VERSION,
  HOME_GAME_DATABASE_VERSION,
  HOME_GAME_INDEXES,
  HOME_GAME_OBJECT_STORES,
  createIndexedDbHomeGameDatabase,
} from './indexeddb-storage.mjs';

const STORES = HOME_GAME_OBJECT_STORES;
const ALL_STORES = Object.freeze(Object.values(STORES));
const METADATA_KEY = 'state';

function cloneData(value) {
  if (value === undefined) return undefined;
  if (typeof structuredClone === 'function') return structuredClone(value);
  return JSON.parse(JSON.stringify(value));
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
}

function immutable(value) {
  return deepFreeze(cloneData(value));
}

function timestampFrom(clock) {
  const value = clock();
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) throw new TypeError('Home Game clock returned an invalid date');
  return date.toISOString();
}

function timestampNotBefore(clock, prior) {
  const candidate = timestampFrom(clock);
  return Date.parse(candidate) < Date.parse(prior) ? prior : candidate;
}

function sameOwner(left, right) {
  return left?.ownerType === right?.ownerType && left?.ownerId === right?.ownerId;
}

function assertOwner(record, ownerRef, label) {
  if (!sameOwner(record?.ownerRef, ownerRef)) throw new RangeError(`${label} belongs to another Home Game owner`);
}

function withoutPhysicalFields(record) {
  const copy = cloneData(record);
  delete copy.ledgerSequence;
  return copy;
}

function sameRecord(left, right) {
  return JSON.stringify(withoutPhysicalFields(left)) === JSON.stringify(withoutPhysicalFields(right));
}

function defaultIdFactory(prefix) {
  const uuid = globalThis.crypto?.randomUUID?.();
  if (uuid) return `${prefix}-${uuid}`;
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 14)}`;
}

function validateMetadata(metadata) {
  if (!metadata || metadata.key !== METADATA_KEY
    || metadata.backendSchemaVersion !== HOME_GAME_BACKEND_SCHEMA_VERSION
    || metadata.databaseVersion !== HOME_GAME_DATABASE_VERSION) {
    throw new HomeGameStorageError('unsupported_database_version', 'Home Game storage uses an unsupported schema and was left untouched.');
  }
  return metadata;
}

function bumpMetadata(metadata, updatedAt) {
  return {
    ...metadata,
    revision: metadata.revision + 1,
    updatedAt,
  };
}

function normalizePlayer(player) {
  if (player?.schemaVersion !== HOME_GAME_PLAYER_SCHEMA_VERSION) throw new TypeError('Unsupported Home Game player schema');
  return createHomeGamePlayer(player);
}

function normalizeGroup(group) {
  if (group?.schemaVersion !== HOME_GAME_GROUP_SCHEMA_VERSION) throw new TypeError('Unsupported Home Game group schema');
  return createHomeGameGroup(group);
}

function normalizeSession(session) {
  if (session?.schemaVersion !== HOME_GAME_SESSION_SCHEMA_VERSION) throw new TypeError('Unsupported Home Game session schema');
  return createHomeGameSession(session);
}

function normalizeTransaction(transaction) {
  if (transaction?.schemaVersion !== HOME_GAME_TRANSACTION_SCHEMA_VERSION) throw new TypeError('Unsupported Home Game transaction schema');
  return createHomeGameTransaction(transaction);
}

function sortUpdatedDescending(records) {
  return records.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt) || a.sessionId?.localeCompare(b.sessionId || '') || 0);
}

function sortLedger(records) {
  return records.sort((a, b) => (a.ledgerSequence ?? 0) - (b.ledgerSequence ?? 0));
}

export class HomeGameStorageError extends Error {
  constructor(code, message, cause = null) {
    super(message, cause ? { cause } : undefined);
    this.name = 'HomeGameStorageError';
    this.code = code;
  }
}

function storageFailure(code, message, cause = null) {
  return new HomeGameStorageError(code, message, cause);
}

export function createHomeGameRepository({
  ownerRef,
  database = null,
  clock = () => new Date(),
  idFactory = defaultIdFactory,
} = {}) {
  if (!ownerRef || typeof ownerRef !== 'object') throw new TypeError('Home Game repository requires an owner reference');
  if (typeof clock !== 'function' || typeof idFactory !== 'function') throw new TypeError('Home Game clock and ID factory must be functions');
  let durableDatabase = database;
  let initializationPromise = null;

  function getDatabase() {
    if (!durableDatabase) durableDatabase = createIndexedDbHomeGameDatabase();
    if (ownerRef.ownerType === HOME_GAME_OWNER_TYPES.GUEST && durableDatabase.durability !== 'memory') {
      throw new HomeGameStorageError('guest_persistence_forbidden', 'Guest Home Game history cannot be saved durably.');
    }
    if (typeof durableDatabase.runTransaction !== 'function') throw new TypeError('Home Game repository requires a transactional database adapter');
    return durableDatabase;
  }

  async function initialize() {
    if (initializationPromise) return initializationPromise;
    initializationPromise = (async () => {
      const databaseAdapter = getDatabase();
      try {
        const existing = await databaseAdapter.runTransaction([STORES.METADATA], 'readonly', (transaction) => transaction.get(STORES.METADATA, METADATA_KEY));
        if (existing) return immutable(validateMetadata(existing));
        const now = timestampFrom(clock);
        return databaseAdapter.runTransaction([STORES.METADATA], 'readwrite', async (transaction) => {
          const raced = await transaction.get(STORES.METADATA, METADATA_KEY);
          if (raced) return immutable(validateMetadata(raced));
          const metadata = {
            key: METADATA_KEY,
            backendSchemaVersion: HOME_GAME_BACKEND_SCHEMA_VERSION,
            databaseVersion: HOME_GAME_DATABASE_VERSION,
            revision: 0,
            createdAt: now,
            updatedAt: now,
          };
          await transaction.add(STORES.METADATA, metadata);
          return immutable(metadata);
        });
      } catch (error) {
        if (error instanceof HomeGameStorageError) throw error;
        throw storageFailure(error?.name === 'VersionError' ? 'unsupported_database_version' : 'open_failed', 'Home Game storage could not be opened.', error);
      }
    })();
    try { return await initializationPromise; } catch (error) { initializationPromise = null; throw error; }
  }

  async function read(stores, operation) {
    await initialize();
    try { return await getDatabase().runTransaction(stores, 'readonly', operation); }
    catch (error) {
      if (error instanceof HomeGameStorageError || error instanceof TypeError || error instanceof RangeError) throw error;
      throw storageFailure('read_failed', 'Home Game data could not be read.', error);
    }
  }

  async function write(stores, operation) {
    await initialize();
    const names = [...new Set([STORES.METADATA, ...stores])];
    try {
      return await getDatabase().runTransaction(names, 'readwrite', async (transaction) => {
        const metadata = validateMetadata(await transaction.get(STORES.METADATA, METADATA_KEY));
        const result = await operation(transaction, metadata);
        return result;
      });
    } catch (error) {
      if (error instanceof HomeGameStorageError || error instanceof TypeError || error instanceof RangeError) throw error;
      throw storageFailure('transaction_failed', 'Home Game changes were not saved.', error);
    }
  }

  async function ownerRecords(transaction, storeName) {
    const records = await transaction.getAllByIndex(storeName, HOME_GAME_INDEXES.OWNER, ownerRef.ownerId);
    return records.filter((entry) => sameOwner(entry.ownerRef, ownerRef));
  }

  async function sessionLedger(transaction, sessionId) {
    const records = await transaction.getAllByIndex(STORES.TRANSACTIONS, HOME_GAME_INDEXES.OWNER_SESSION, [ownerRef.ownerId, sessionId]);
    return sortLedger(records.filter((entry) => sameOwner(entry.ownerRef, ownerRef)))
      .map((entry) => normalizeTransaction(withoutPhysicalFields(entry)));
  }

  async function sessionSnapshots(transaction, sessionId) {
    const records = await transaction.getAllByIndex(STORES.SNAPSHOTS, HOME_GAME_INDEXES.OWNER_SESSION, [ownerRef.ownerId, sessionId]);
    return records.filter((entry) => sameOwner(entry.ownerRef, ownerRef)).sort((a, b) => a.recordedAt.localeCompare(b.recordedAt));
  }

  async function touchMetadata(transaction, metadata, updatedAt) {
    const next = bumpMetadata(metadata, updatedAt);
    await transaction.put(STORES.METADATA, next);
    return next.revision;
  }

  async function saveCreated(storeName, record, idField, label) {
    assertOwner(record, ownerRef, label);
    return write([storeName], async (transaction, metadata) => {
      const existing = await transaction.get(storeName, record[idField]);
      if (existing) {
        if (sameRecord(existing, record)) return immutable({ record: withoutPhysicalFields(existing), idempotent: true, repositoryRevision: metadata.revision });
        throw new RangeError(`${label} ID collision`);
      }
      await transaction.add(storeName, record);
      const repositoryRevision = await touchMetadata(transaction, metadata, record.updatedAt || record.createdAt);
      return immutable({ record, idempotent: false, repositoryRevision });
    });
  }

  async function savePlayer(player) {
    return saveCreated(STORES.PLAYERS, normalizePlayer(player), 'playerId', 'Home Game player');
  }

  async function updatePlayer(playerId, patch) {
    return write([STORES.PLAYERS], async (transaction, metadata) => {
      const existing = await transaction.get(STORES.PLAYERS, playerId);
      if (!existing || !sameOwner(existing.ownerRef, ownerRef)) throw new RangeError('Home Game player is missing');
      const updatedAt = timestampNotBefore(clock, existing.updatedAt);
      const record = updateHomeGamePlayer(normalizePlayer(existing), patch, updatedAt);
      await transaction.put(STORES.PLAYERS, record);
      const repositoryRevision = await touchMetadata(transaction, metadata, updatedAt);
      return immutable({ record, repositoryRevision });
    });
  }

  async function saveGroup(group) {
    const normalized = normalizeGroup(group);
    assertOwner(normalized, ownerRef, 'Home Game group');
    return write([STORES.GROUPS, STORES.PLAYERS], async (transaction, metadata) => {
      for (const playerId of normalized.playerIds) {
        const player = await transaction.get(STORES.PLAYERS, playerId);
        if (!player || !sameOwner(player.ownerRef, ownerRef)) throw new RangeError(`Group references missing player ${playerId}`);
      }
      const existing = await transaction.get(STORES.GROUPS, normalized.groupId);
      if (existing) {
        if (sameRecord(existing, normalized)) return immutable({ record: existing, idempotent: true, repositoryRevision: metadata.revision });
        throw new RangeError('Home Game group ID collision');
      }
      await transaction.add(STORES.GROUPS, normalized);
      const repositoryRevision = await touchMetadata(transaction, metadata, normalized.updatedAt);
      return immutable({ record: normalized, idempotent: false, repositoryRevision });
    });
  }

  async function updateGroup(groupId, patch) {
    return write([STORES.GROUPS, STORES.PLAYERS], async (transaction, metadata) => {
      const existing = await transaction.get(STORES.GROUPS, groupId);
      if (!existing || !sameOwner(existing.ownerRef, ownerRef)) throw new RangeError('Home Game group is missing');
      const updatedAt = timestampNotBefore(clock, existing.updatedAt);
      const record = updateHomeGameGroup(normalizeGroup(existing), patch, updatedAt);
      for (const playerId of record.playerIds) {
        const player = await transaction.get(STORES.PLAYERS, playerId);
        if (!player || !sameOwner(player.ownerRef, ownerRef)) throw new RangeError(`Group references missing player ${playerId}`);
      }
      await transaction.put(STORES.GROUPS, record);
      const repositoryRevision = await touchMetadata(transaction, metadata, updatedAt);
      return immutable({ record, repositoryRevision });
    });
  }

  async function saveSession(session) {
    const normalized = normalizeSession(session);
    assertOwner(normalized, ownerRef, 'Home Game session');
    return write([STORES.SESSIONS, STORES.PLAYERS, STORES.GROUPS], async (transaction, metadata) => {
      for (const participant of normalized.participants) {
        const player = await transaction.get(STORES.PLAYERS, participant.playerId);
        if (!player || !sameOwner(player.ownerRef, ownerRef)) throw new RangeError(`Session references missing player ${participant.playerId}`);
      }
      if (normalized.sourceGroupId) {
        const group = await transaction.get(STORES.GROUPS, normalized.sourceGroupId);
        if (!group || !sameOwner(group.ownerRef, ownerRef)) throw new RangeError('Session source group is missing');
      }
      const existing = await transaction.get(STORES.SESSIONS, normalized.sessionId);
      if (existing) {
        if (sameRecord(existing, normalized)) return immutable({ record: existing, idempotent: true, repositoryRevision: metadata.revision });
        throw new RangeError('Home Game session ID collision');
      }
      await transaction.add(STORES.SESSIONS, normalized);
      const repositoryRevision = await touchMetadata(transaction, metadata, normalized.updatedAt);
      return immutable({ record: normalized, idempotent: false, repositoryRevision });
    });
  }

  async function appendTransaction(transaction) {
    const normalized = normalizeTransaction(transaction);
    assertOwner(normalized, ownerRef, 'Home Game transaction');
    return write([STORES.TRANSACTIONS, STORES.SESSIONS], async (storage, metadata) => {
      const session = await storage.get(STORES.SESSIONS, normalized.sessionId);
      if (!session || !sameOwner(session.ownerRef, ownerRef)) throw new RangeError('Transaction session is missing');
      if (session.status === HOME_GAME_SESSION_STATUS.COMPLETED) throw new RangeError('Completed session must be reopened before adding ledger entries');
      const existing = await storage.get(STORES.TRANSACTIONS, normalized.transactionId);
      if (existing) {
        if (sameRecord(existing, normalized)) return immutable({ transaction: withoutPhysicalFields(existing), session, idempotent: true, repositoryRevision: metadata.revision });
        throw new RangeError('Home Game transaction ID collision');
      }
      const ledger = await sessionLedger(storage, session.sessionId);
      validateHomeGameLedger(session, [...ledger, normalized]);
      const ledgerRecord = { ...normalized, ledgerSequence: ledger.length + 1 };
      const updatedAt = timestampNotBefore(clock, session.updatedAt);
      const touchedSession = createHomeGameSession({ ...session, updatedAt, revision: session.revision + 1 });
      await storage.add(STORES.TRANSACTIONS, ledgerRecord);
      await storage.put(STORES.SESSIONS, touchedSession);
      const repositoryRevision = await touchMetadata(storage, metadata, updatedAt);
      return immutable({ transaction: normalized, session: touchedSession, idempotent: false, repositoryRevision });
    });
  }

  async function appendCorrection({ correction, replacement = null } = {}) {
    const normalizedCorrection = normalizeTransaction(correction);
    const normalizedReplacement = replacement === null ? null : normalizeTransaction(replacement);
    assertOwner(normalizedCorrection, ownerRef, 'Home Game correction');
    if (normalizedReplacement) assertOwner(normalizedReplacement, ownerRef, 'Home Game replacement');
    return write([STORES.TRANSACTIONS, STORES.SESSIONS], async (storage, metadata) => {
      const session = await storage.get(STORES.SESSIONS, normalizedCorrection.sessionId);
      if (!session || !sameOwner(session.ownerRef, ownerRef)) throw new RangeError('Correction session is missing');
      if (session.status === HOME_GAME_SESSION_STATUS.COMPLETED) throw new RangeError('Completed session must be reopened before correcting ledger entries');
      const additions = [normalizedCorrection, ...(normalizedReplacement ? [normalizedReplacement] : [])];
      if (normalizedReplacement?.sessionId !== session.sessionId) throw new RangeError('Replacement belongs to another session');
      for (const entry of additions) {
        if (await storage.get(STORES.TRANSACTIONS, entry.transactionId)) throw new RangeError('Home Game transaction ID collision');
      }
      const ledger = await sessionLedger(storage, session.sessionId);
      validateHomeGameLedger(normalizeSession(session), [...ledger, ...additions]);
      for (const [index, entry] of additions.entries()) {
        await storage.add(STORES.TRANSACTIONS, { ...entry, ledgerSequence: ledger.length + index + 1 });
      }
      const updatedAt = timestampNotBefore(clock, session.updatedAt);
      const touchedSession = createHomeGameSession({ ...normalizeSession(session), updatedAt, revision: session.revision + 1 });
      await storage.put(STORES.SESSIONS, touchedSession);
      const repositoryRevision = await touchMetadata(storage, metadata, updatedAt);
      return immutable({ correction: normalizedCorrection, replacement: normalizedReplacement, session: touchedSession, repositoryRevision });
    });
  }

  async function recordCashOut({ sessionId, playerId, amountMinor, transactionId = idFactory('home-game-transaction'), note = null } = {}) {
    if (!Number.isSafeInteger(amountMinor) || amountMinor < 0) throw new RangeError('Cash-out amount must be a non-negative safe integer');
    return write([STORES.TRANSACTIONS, STORES.SESSIONS], async (storage, metadata) => {
      const session = await storage.get(STORES.SESSIONS, sessionId);
      if (!session || !sameOwner(session.ownerRef, ownerRef)) throw new RangeError('Cash-out session is missing');
      if (session.status !== HOME_GAME_SESSION_STATUS.ACTIVE) throw new RangeError('Cash-out requires an active session');
      const participant = session.participants.find((entry) => entry.playerId === playerId);
      if (!participant) throw new RangeError('Cash-out player is not a participant');
      if (participant.status === 'cashed_out') throw new RangeError('Participant is already cashed out');
      const updatedAt = timestampNotBefore(clock, session.updatedAt);
      let ledger = await sessionLedger(storage, session.sessionId);
      let transaction = null;
      if (amountMinor > 0) {
        transaction = createHomeGameTransaction({
          transactionId,
          sessionId,
          ownerRef,
          playerId,
          type: HOME_GAME_TRANSACTION_TYPES.CASH_OUT,
          amountMinor,
          createdAt: updatedAt,
          note,
        });
        if (await storage.get(STORES.TRANSACTIONS, transaction.transactionId)) throw new RangeError('Home Game transaction ID collision');
        validateHomeGameLedger(session, [...ledger, transaction]);
        await storage.add(STORES.TRANSACTIONS, { ...transaction, ledgerSequence: ledger.length + 1 });
        ledger = [...ledger, transaction];
      }
      const touchedSession = updateHomeGameParticipant(session, playerId, { status: 'cashed_out' }, updatedAt);
      await storage.put(STORES.SESSIONS, touchedSession);
      const repositoryRevision = await touchMetadata(storage, metadata, updatedAt);
      return immutable({ transaction, session: touchedSession, accounting: calculateHomeGameAccounting(touchedSession, ledger), repositoryRevision });
    });
  }

  async function transitionSession(sessionId, transition) {
    return write([STORES.SESSIONS, STORES.TRANSACTIONS], async (storage, metadata) => {
      const session = await storage.get(STORES.SESSIONS, sessionId);
      if (!session || !sameOwner(session.ownerRef, ownerRef)) throw new RangeError('Home Game session is missing');
      const ledger = await sessionLedger(storage, sessionId);
      const changedAt = timestampNotBefore(clock, session.updatedAt);
      const updated = transition(session, ledger, changedAt);
      await storage.put(STORES.SESSIONS, updated);
      const repositoryRevision = await touchMetadata(storage, metadata, changedAt);
      return immutable({ session: updated, accounting: calculateHomeGameAccounting(updated, ledger), repositoryRevision });
    });
  }

  async function saveSnapshot(snapshot) {
    const normalized = createHomeGameChipSnapshot(snapshot);
    assertOwner(normalized, ownerRef, 'Home Game chip snapshot');
    return write([STORES.SNAPSHOTS, STORES.SESSIONS], async (storage, metadata) => {
      const session = await storage.get(STORES.SESSIONS, normalized.sessionId);
      if (!session || !sameOwner(session.ownerRef, ownerRef)) throw new RangeError('Chip snapshot session is missing');
      if (!session.participants.some((entry) => entry.playerId === normalized.playerId)) throw new RangeError('Chip snapshot player is not a participant');
      const existing = await storage.get(STORES.SNAPSHOTS, normalized.snapshotId);
      if (existing) {
        if (sameRecord(existing, normalized)) return immutable({ snapshot: existing, idempotent: true, repositoryRevision: metadata.revision });
        throw new RangeError('Home Game chip snapshot ID collision');
      }
      await storage.add(STORES.SNAPSHOTS, normalized);
      const repositoryRevision = await touchMetadata(storage, metadata, normalized.recordedAt);
      return immutable({ snapshot: normalized, idempotent: false, repositoryRevision });
    });
  }

  async function setSessionArchived(sessionId, archived) {
    return write([STORES.SESSIONS], async (storage, metadata) => {
      const existing = await storage.get(STORES.SESSIONS, sessionId);
      if (!existing || !sameOwner(existing.ownerRef, ownerRef)) throw new RangeError('Home Game session is missing');
      const at = timestampNotBefore(clock, existing.updatedAt);
      const session = setHomeGameSessionArchived(normalizeSession(existing), archived, at);
      if (session === existing) return immutable({ session, repositoryRevision: metadata.revision });
      await storage.put(STORES.SESSIONS, session);
      const repositoryRevision = await touchMetadata(storage, metadata, at);
      return immutable({ session, repositoryRevision });
    });
  }

  return Object.freeze({
    ownerRef: immutable(ownerRef),
    initialize,
    async getRepositoryStatus() {
      const metadata = await initialize();
      return immutable({ ...metadata, ownerRef });
    },
    savePlayer,
    updatePlayer,
    saveGroup,
    updateGroup,
    saveSession,
    appendTransaction,
    appendCorrection,
    recordCashOut,
    saveSnapshot,
    startSession: (sessionId) => transitionSession(sessionId, (session, _ledger, at) => startHomeGameSession(session, at)),
    completeSession: (sessionId) => transitionSession(sessionId, (session, ledger, at) => completeHomeGameSession(session, ledger, at)),
    reopenSession: (sessionId) => transitionSession(sessionId, (session, _ledger, at) => reopenHomeGameSession(session, at)),
    setSessionArchived,
    async getPlayer(playerId) {
      return read([STORES.PLAYERS], async (transaction) => {
        const record = await transaction.get(STORES.PLAYERS, playerId);
        return record && sameOwner(record.ownerRef, ownerRef) ? immutable(normalizePlayer(record)) : null;
      });
    },
    async listPlayers({ includeArchived = false } = {}) {
      return read([STORES.PLAYERS], async (transaction) => {
        const records = await ownerRecords(transaction, STORES.PLAYERS);
        return immutable(records.map(normalizePlayer).filter((entry) => includeArchived || !entry.archived).sort((a, b) => a.displayName.localeCompare(b.displayName)));
      });
    },
    async getGroup(groupId) {
      return read([STORES.GROUPS], async (transaction) => {
        const record = await transaction.get(STORES.GROUPS, groupId);
        return record && sameOwner(record.ownerRef, ownerRef) ? immutable(normalizeGroup(record)) : null;
      });
    },
    async listGroups({ includeArchived = false } = {}) {
      return read([STORES.GROUPS], async (transaction) => immutable(sortUpdatedDescending((await ownerRecords(transaction, STORES.GROUPS))
        .map(normalizeGroup).filter((entry) => includeArchived || !entry.archived))));
    },
    async getSession(sessionId) {
      return read([STORES.SESSIONS], async (transaction) => {
        const record = await transaction.get(STORES.SESSIONS, sessionId);
        return record && sameOwner(record.ownerRef, ownerRef) ? immutable(normalizeSession(record)) : null;
      });
    },
    async listRecentSessions({ limit = 20, includeArchived = false } = {}) {
      if (!Number.isSafeInteger(limit) || limit < 1 || limit > 200) throw new RangeError('Recent session limit must be 1-200');
      return read([STORES.SESSIONS], async (transaction) => immutable(sortUpdatedDescending((await ownerRecords(transaction, STORES.SESSIONS))
        .map(normalizeSession).filter((entry) => includeArchived || !entry.archived)).slice(0, limit)));
    },
    async getSessionBundle(sessionId) {
      return read([STORES.SESSIONS, STORES.TRANSACTIONS, STORES.SNAPSHOTS], async (transaction) => {
        const session = await transaction.get(STORES.SESSIONS, sessionId);
        if (!session || !sameOwner(session.ownerRef, ownerRef)) return null;
        const normalizedSession = normalizeSession(session);
        const transactions = await sessionLedger(transaction, sessionId);
        const snapshots = await sessionSnapshots(transaction, sessionId);
        const accounting = calculateHomeGameAccounting(normalizedSession, transactions);
        const settlement = accounting.balanced ? createHomeGameSettlement(normalizedSession, transactions) : null;
        const ledgerHistory = createHomeGameLedgerHistory(normalizedSession, transactions);
        return immutable({ session: normalizedSession, transactions, snapshots, accounting, settlement, ledgerHistory });
      });
    },
    async createSessionFromGroup({ groupId, sessionId = idFactory('home-game-session'), title, currency, blinds = null } = {}) {
      const [group, players] = await Promise.all([this.getGroup(groupId), this.listPlayers({ includeArchived: true })]);
      if (!group) throw new RangeError('Home Game group is missing');
      if (group.archived) throw new RangeError('Restore this group before starting a session');
      if (players.some((player) => group.playerIds.includes(player.playerId) && player.archived)) {
        throw new RangeError('Restore archived group players before starting a session');
      }
      const session = createSessionFromGroup({ sessionId, ownerRef, title, currency, blinds, group, players, createdAt: timestampFrom(clock) });
      await saveSession(session);
      return session;
    },
    createPlayer(values) {
      const at = timestampFrom(clock);
      return createHomeGamePlayer({ playerId: idFactory('home-game-player'), ownerRef, createdAt: at, ...values });
    },
    createGroup(values) {
      const at = timestampFrom(clock);
      return createHomeGameGroup({ groupId: idFactory('home-game-group'), ownerRef, createdAt: at, ...values });
    },
    createSession(values) {
      const at = timestampFrom(clock);
      return createHomeGameSession({ sessionId: idFactory('home-game-session'), ownerRef, createdAt: at, ...values });
    },
    createTransaction(values) {
      return createHomeGameTransaction({ transactionId: idFactory('home-game-transaction'), ownerRef, createdAt: timestampFrom(clock), ...values });
    },
    async close() {
      if (durableDatabase) await durableDatabase.close();
      initializationPromise = null;
    },
  });
}
