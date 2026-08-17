import {
  SAVED_STUDY_SYNC_DOMAIN,
  cloneSyncData,
  validateRemoteSavedStudyObject,
} from './domain.mjs';

export function createFakeRemoteSyncBackend() {
  return { records: new Map(), acknowledgements: new Map(), sequence: 0 };
}

export function createFakeRemoteSyncAdapter({
  backend = createFakeRemoteSyncBackend(),
  clock = () => new Date(),
  validators = {},
} = {}) {
  const failures = [];
  const calls = [];
  const identityKey = (domain, identityId, objectId) => `${domain}:${identityId}:${objectId}`;
  const operationKey = (domain, identityId, operationId) => `${domain}:${identityId}:${operationId}`;

  function validate(domain, object) {
    if (domain === SAVED_STUDY_SYNC_DOMAIN) return validateRemoteSavedStudyObject(object);
    const validator = validators[domain];
    if (!validator) throw new RangeError('Unsupported fake sync domain');
    return validator(object);
  }

  function timestamp() {
    const supplied = clock();
    const date = supplied instanceof Date ? supplied : new Date(supplied);
    const milliseconds = Math.max(date.getTime(), backend.sequence + 1);
    backend.sequence = milliseconds;
    return new Date(milliseconds).toISOString();
  }

  function maybeFail(method) {
    const index = failures.findIndex((failure) => failure.method === method || failure.method === '*');
    if (index < 0) return;
    const [failure] = failures.splice(index, 1);
    const error = new Error(failure.code);
    error.code = failure.code;
    error.kind = failure.kind;
    throw error;
  }

  return Object.freeze({
    schemaVersion: 'fake-remote-sync-adapter/v1',
    async pushOperation({ domain, identityId, operation }) {
      calls.push({ method: 'push', domain, identityId, operationId: operation.operationId });
      maybeFail('push');
      validate(domain, operation.object);
      const acknowledged = backend.acknowledgements.get(operationKey(domain, identityId, operation.operationId));
      if (acknowledged) return cloneSyncData(acknowledged);
      const recordKey = identityKey(domain, identityId, operation.objectId);
      const existing = backend.records.get(recordKey) ?? null;
      if ((existing?.object.revision ?? 0) !== operation.expectedRemoteRevision) {
        return Object.freeze({ status: 'conflict', record: cloneSyncData(existing) });
      }
      if (existing && operation.object.revision <= existing.object.revision) {
        const error = new Error('Remote revision must advance');
        error.code = 'invalid_revision';
        error.kind = 'permanent';
        throw error;
      }
      const record = Object.freeze({
        object: cloneSyncData(operation.object),
        serverUpdatedAt: timestamp(),
        operationId: operation.operationId,
      });
      backend.records.set(recordKey, record);
      const result = Object.freeze({ status: 'acknowledged', record: cloneSyncData(record) });
      backend.acknowledgements.set(operationKey(domain, identityId, operation.operationId), result);
      return result;
    },
    async pullChanges({ domain, identityId, cursor = null, limit = 100 }) {
      calls.push({ method: 'pull', domain, identityId });
      maybeFail('pull');
      if (domain !== SAVED_STUDY_SYNC_DOMAIN && !validators[domain]) {
        throw new RangeError('Unsupported fake sync domain');
      }
      const after = cursor ? [cursor.serverUpdatedAt, cursor.objectId] : ['', ''];
      const records = [...backend.records.entries()]
        .filter(([recordKey]) => recordKey.startsWith(`${domain}:${identityId}:`))
        .map(([, record]) => cloneSyncData(record))
        .filter((record) => {
          const pair = [record.serverUpdatedAt, record.object.id];
          return pair[0] > after[0] || (pair[0] === after[0] && pair[1] > after[1]);
        })
        .sort((left, right) => left.serverUpdatedAt.localeCompare(right.serverUpdatedAt)
          || left.object.id.localeCompare(right.object.id))
        .slice(0, limit);
      const last = records.at(-1);
      return Object.freeze({
        records,
        cursor: last ? { serverUpdatedAt: last.serverUpdatedAt, objectId: last.object.id } : cursor,
        hasMore: records.length === limit,
      });
    },
    failNext({ method = '*', code = 'network_unavailable', kind = 'transient' } = {}) {
      failures.push({ method, code, kind });
    },
    seed(identityId, object, { serverUpdatedAt = timestamp(), domain = SAVED_STUDY_SYNC_DOMAIN } = {}) {
      validate(domain, object);
      backend.records.set(identityKey(domain, identityId, object.id), {
        object: cloneSyncData(object), serverUpdatedAt, operationId: null,
      });
    },
    get(identityId, objectId, domain = SAVED_STUDY_SYNC_DOMAIN) {
      return cloneSyncData(backend.records.get(identityKey(domain, identityId, objectId)) ?? null);
    },
    getCalls() { return cloneSyncData(calls); },
    backend,
  });
}
