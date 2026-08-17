import {
  PERSONAL_STRATEGY_SYNC_DOMAIN,
  SAVED_STUDY_SYNC_DOMAIN,
  validateRemoteSavedStudyObject,
} from './domain.mjs';
import { validateRemotePersonalStrategyEntity } from './personal-strategy-domain-adapters.mjs';

export class RemoteSyncError extends Error {
  constructor(code, kind, message, cause = null) {
    super(message, cause ? { cause } : undefined);
    this.name = 'RemoteSyncError';
    this.code = code;
    this.kind = kind;
  }
}

function classify(error) {
  const status = error?.status ?? error?.code;
  const message = String(error?.message ?? '');
  if (status === 401 || /expired.*jwt|jwt.*expired|session.*expired|auth session missing/i.test(message)) {
    return new RemoteSyncError('session_expired', 'auth', 'Study sync paused until sign-in is restored.', error);
  }
  if (/network|fetch|offline|timeout|unavailable/i.test(message)) {
    return new RemoteSyncError('network_unavailable', 'transient', 'Study data will sync when the connection returns.', error);
  }
  return new RemoteSyncError(
    status === 403 || status === '42501' ? 'remote_policy_error' : 'remote_schema_or_policy_error',
    'permanent',
    'Study sync could not use the configured remote schema.',
    error,
  );
}

function timeout(promise, milliseconds) {
  let timer;
  const expiry = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new RemoteSyncError(
      'network_timeout', 'transient', 'Study sync timed out.',
    )), milliseconds);
  });
  return Promise.race([promise, expiry]).finally(() => clearTimeout(timer));
}

export function createSupabaseRemoteSyncAdapter({ client, timeoutMs = 8000 } = {}) {
  if (!client?.rpc) throw new TypeError('Supabase RemoteSyncAdapter requires a client');

  async function rpc(name, parameters) {
    let result;
    try { result = await timeout(client.rpc(name, parameters), timeoutMs); }
    catch (error) { throw error instanceof RemoteSyncError ? error : classify(error); }
    if (result?.error) throw classify(result.error);
    return result?.data;
  }

  return Object.freeze({
    schemaVersion: 'supabase-remote-sync-adapter/v1',
    async pushOperation({ domain, identityId, operation }) {
      if (![SAVED_STUDY_SYNC_DOMAIN, PERSONAL_STRATEGY_SYNC_DOMAIN].includes(domain)) {
        throw new RangeError('Unsupported Supabase sync domain');
      }
      const personal = domain === PERSONAL_STRATEGY_SYNC_DOMAIN;
      (personal ? validateRemotePersonalStrategyEntity : validateRemoteSavedStudyObject)(operation.object);
      const data = await rpc(personal ? 'sync_personal_strategy_entity_v1' : 'sync_saved_study_object_v1', {
        p_operation_id: operation.operationId,
        p_riverline_identity_id: identityId,
        p_expected_revision: operation.expectedRemoteRevision,
        p_object: operation.object,
      });
      const value = Array.isArray(data) ? data[0] : data;
      if (!value || !['acknowledged', 'conflict'].includes(value.status)) {
        throw new RemoteSyncError('invalid_remote_response', 'permanent', 'Study sync received an invalid response.');
      }
      if (value.record?.object) {
        (personal ? validateRemotePersonalStrategyEntity : validateRemoteSavedStudyObject)(value.record.object);
      }
      return value;
    },
    async pullChanges({ domain, identityId, cursor = null, limit = 100 }) {
      if (![SAVED_STUDY_SYNC_DOMAIN, PERSONAL_STRATEGY_SYNC_DOMAIN].includes(domain)) {
        throw new RangeError('Unsupported Supabase sync domain');
      }
      const personal = domain === PERSONAL_STRATEGY_SYNC_DOMAIN;
      const rows = await rpc(personal ? 'pull_personal_strategy_entities_v1' : 'pull_saved_study_objects_v1', {
        p_riverline_identity_id: identityId,
        p_after_server_updated_at: cursor?.serverUpdatedAt ?? null,
        [personal ? 'p_after_entity_id' : 'p_after_object_id']: cursor?.objectId ?? null,
        p_limit: limit,
      }) ?? [];
      const records = rows.map((row) => {
        (personal ? validateRemotePersonalStrategyEntity : validateRemoteSavedStudyObject)(row.object_data);
        return { object: row.object_data, serverUpdatedAt: row.server_updated_at };
      });
      const last = records.at(-1);
      return Object.freeze({
        records,
        cursor: last ? { serverUpdatedAt: last.serverUpdatedAt, objectId: last.object.id } : cursor,
        hasMore: records.length === limit,
      });
    },
  });
}
