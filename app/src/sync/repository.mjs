import { cloneSyncData, SAVED_STUDY_SYNC_DOMAIN, SYNC_STATES } from './domain.mjs';
import {
  SYNC_STORES,
  createIndexedDbSyncDatabase,
} from './indexeddb-storage.mjs';

const key = (identityId, domain, suffix = '') => `${identityId}:${domain}${suffix ? `:${suffix}` : ''}`;

export function createSyncRepository({ database = null, domain = SAVED_STUDY_SYNC_DOMAIN } = {}) {
  const durableDatabase = database ?? createIndexedDbSyncDatabase();
  const read = (stores, operation) => durableDatabase.runTransaction(stores, 'readonly', operation);
  const write = (stores, operation) => durableDatabase.runTransaction(stores, 'readwrite', operation);

  return Object.freeze({
    async getPreference(identityId) {
      return read([SYNC_STORES.PREFERENCES], async (transaction) => (
        await transaction.get(SYNC_STORES.PREFERENCES, key(identityId, domain))
        ?? Object.freeze({ enabled: false, decided: false })
      ));
    },
    async setPreference(identityId, enabled, updatedAt) {
      const value = {
        key: key(identityId, domain), identityId, domain, enabled: Boolean(enabled),
        decided: true, updatedAt,
      };
      await write([SYNC_STORES.PREFERENCES], (transaction) => transaction.put(SYNC_STORES.PREFERENCES, value));
      return Object.freeze(cloneSyncData(value));
    },
    async getRecord(identityId, objectId) {
      return read([SYNC_STORES.RECORDS], (transaction) => (
        transaction.get(SYNC_STORES.RECORDS, key(identityId, domain, objectId))
      ));
    },
    async enqueue(operation) {
      const operationKey = key(operation.identityId, domain, operation.objectId);
      return write([SYNC_STORES.OPERATIONS, SYNC_STORES.RECORDS, SYNC_STORES.CONFLICTS], async (transaction) => {
        const [existing, record] = await Promise.all([
          transaction.get(SYNC_STORES.OPERATIONS, operationKey),
          transaction.get(SYNC_STORES.RECORDS, operationKey),
        ]);
        const queued = {
          ...cloneSyncData(operation),
          key: operationKey,
          operationId: existing?.operationId ?? operation.operationId,
          expectedRemoteRevision: existing?.expectedRemoteRevision ?? operation.expectedRemoteRevision,
          createdAt: existing?.createdAt ?? operation.createdAt,
          attempts: 0,
          nextAttemptAt: operation.updatedAt,
          lastErrorCode: null,
        };
        const state = operation.kind.startsWith('tombstone_')
          ? SYNC_STATES.PENDING_DELETE
          : queued.expectedRemoteRevision === 0
            ? SYNC_STATES.PENDING_UPLOAD
            : SYNC_STATES.PENDING_UPDATE;
        await transaction.put(SYNC_STORES.OPERATIONS, queued);
        await transaction.put(SYNC_STORES.RECORDS, {
          ...(record ?? {}), key: operationKey, identityId: operation.identityId, domain,
          objectId: operation.objectId, state, localRevision: operation.object.revision,
          lastErrorCode: null, updatedAt: operation.updatedAt,
        });
        await transaction.delete(SYNC_STORES.CONFLICTS, operationKey);
        return cloneSyncData(queued);
      });
    },
    async listDueOperations(identityId, now, limit = 25, force = false) {
      return read([SYNC_STORES.OPERATIONS], async (transaction) => (
        (await transaction.getAllByIdentityDomain(SYNC_STORES.OPERATIONS, identityId, domain))
          .filter((operation) => force || operation.nextAttemptAt <= now)
          .sort((left, right) => left.createdAt.localeCompare(right.createdAt))
          .slice(0, limit)
      ));
    },
    async acknowledge(identityId, operationId, document, serverUpdatedAt = null) {
      const operationKey = key(identityId, domain, document.id);
      return write([SYNC_STORES.OPERATIONS, SYNC_STORES.RECORDS, SYNC_STORES.CONFLICTS], async (transaction) => {
        const operation = await transaction.get(SYNC_STORES.OPERATIONS, operationKey);
        if (operation && operation.operationId !== operationId) return false;
        await transaction.delete(SYNC_STORES.OPERATIONS, operationKey);
        await transaction.delete(SYNC_STORES.CONFLICTS, operationKey);
        await transaction.put(SYNC_STORES.RECORDS, {
          key: operationKey, identityId, domain, objectId: document.id,
          state: SYNC_STATES.SYNCED, remoteRevision: document.revision,
          localRevision: document.revision, baseObject: cloneSyncData(document),
          lastErrorCode: null, serverUpdatedAt, updatedAt: document.updatedAt,
        });
        return true;
      });
    },
    async markSynced(identityId, document, serverUpdatedAt = null) {
      const operationKey = key(identityId, domain, document.id);
      return write([SYNC_STORES.OPERATIONS, SYNC_STORES.RECORDS, SYNC_STORES.CONFLICTS], async (transaction) => {
        await transaction.delete(SYNC_STORES.OPERATIONS, operationKey);
        await transaction.delete(SYNC_STORES.CONFLICTS, operationKey);
        await transaction.put(SYNC_STORES.RECORDS, {
          key: operationKey, identityId, domain, objectId: document.id,
          state: SYNC_STATES.SYNCED, remoteRevision: document.revision,
          localRevision: document.revision, baseObject: cloneSyncData(document),
          lastErrorCode: null, serverUpdatedAt, updatedAt: document.updatedAt,
        });
        return true;
      });
    },
    async fail(identityId, operation, { code, nextAttemptAt, persistent = false } = {}) {
      const operationKey = key(identityId, domain, operation.objectId);
      return write([SYNC_STORES.OPERATIONS, SYNC_STORES.RECORDS], async (transaction) => {
        const current = await transaction.get(SYNC_STORES.OPERATIONS, operationKey);
        if (!current || current.operationId !== operation.operationId) return false;
        await transaction.put(SYNC_STORES.OPERATIONS, {
          ...current, attempts: current.attempts + 1, nextAttemptAt,
          lastErrorCode: code, persistentError: persistent,
        });
        const record = await transaction.get(SYNC_STORES.RECORDS, operationKey);
        await transaction.put(SYNC_STORES.RECORDS, {
          ...record, state: SYNC_STATES.ERROR, lastErrorCode: code,
        });
        return true;
      });
    },
    async markConflict(identityId, conflict) {
      const conflictKey = key(identityId, domain, conflict.objectId);
      return write([SYNC_STORES.OPERATIONS, SYNC_STORES.RECORDS, SYNC_STORES.CONFLICTS], async (transaction) => {
        await transaction.delete(SYNC_STORES.OPERATIONS, conflictKey);
        await transaction.put(SYNC_STORES.CONFLICTS, {
          ...cloneSyncData(conflict), key: conflictKey, identityId, domain,
        });
        const record = await transaction.get(SYNC_STORES.RECORDS, conflictKey);
        await transaction.put(SYNC_STORES.RECORDS, {
          ...(record ?? {}), key: conflictKey, identityId, domain,
          objectId: conflict.objectId, state: SYNC_STATES.CONFLICT,
          lastErrorCode: null, updatedAt: conflict.createdAt,
        });
      });
    },
    async getConflict(identityId, objectId) {
      return read([SYNC_STORES.CONFLICTS], (transaction) => (
        transaction.get(SYNC_STORES.CONFLICTS, key(identityId, domain, objectId))
      ));
    },
    async listConflicts(identityId) {
      return read([SYNC_STORES.CONFLICTS], async (transaction) => (
        (await transaction.getAllByIdentityDomain(SYNC_STORES.CONFLICTS, identityId, domain))
          .sort((left, right) => left.createdAt.localeCompare(right.createdAt))
      ));
    },
    async getCursor(identityId) {
      return read([SYNC_STORES.CURSORS], async (transaction) => (
        (await transaction.get(SYNC_STORES.CURSORS, key(identityId, domain)))?.cursor ?? null
      ));
    },
    async setCursor(identityId, cursor) {
      return write([SYNC_STORES.CURSORS], (transaction) => transaction.put(SYNC_STORES.CURSORS, {
        key: key(identityId, domain), identityId, domain, cursor: cloneSyncData(cursor),
      }));
    },
    async setDomainError(identityId, errorCode, updatedAt) {
      const recordKey = key(identityId, domain, '__domain__');
      return write([SYNC_STORES.RECORDS], (transaction) => transaction.put(SYNC_STORES.RECORDS, {
        key: recordKey, identityId, domain, objectId: '__domain__',
        state: SYNC_STATES.ERROR, lastErrorCode: errorCode, updatedAt,
      }));
    },
    async clearDomainError(identityId) {
      return write([SYNC_STORES.RECORDS], (transaction) => (
        transaction.delete(SYNC_STORES.RECORDS, key(identityId, domain, '__domain__'))
      ));
    },
    async summary(identityId) {
      return read([SYNC_STORES.OPERATIONS, SYNC_STORES.CONFLICTS, SYNC_STORES.RECORDS], async (transaction) => {
        const [operations, conflicts, records] = await Promise.all([
          transaction.getAllByIdentityDomain(SYNC_STORES.OPERATIONS, identityId, domain),
          transaction.getAllByIdentityDomain(SYNC_STORES.CONFLICTS, identityId, domain),
          transaction.getAllByIdentityDomain(SYNC_STORES.RECORDS, identityId, domain),
        ]);
        return Object.freeze({
          pendingCount: operations.length,
          conflictCount: conflicts.length,
          errorCount: records.filter((record) => record.state === SYNC_STATES.ERROR).length,
          syncedCount: records.filter((record) => record.state === SYNC_STATES.SYNCED).length,
        });
      });
    },
    close: () => durableDatabase.close?.(),
  });
}
