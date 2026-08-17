import {
  SYNC_RECONCILIATION_VERSION,
  SYNC_UI_STATES,
  cloneSyncData,
  createSyncOperation,
} from './domain.mjs';

function timestamp(clock) {
  const supplied = clock();
  const date = supplied instanceof Date ? supplied : new Date(supplied);
  if (!Number.isFinite(date.getTime())) throw new TypeError('Sync clock returned an invalid date');
  return date.toISOString();
}

function defaultIdFactory(prefix) {
  return `${prefix}-${globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`}`;
}

function retryDelay(attempts) {
  return Math.min(300_000, 1_000 * (2 ** Math.min(attempts, 8)));
}

export function createSyncCoordinator({
  repository,
  remoteAdapter,
  domainAdapter,
  clock = () => new Date(),
  idFactory = defaultIdFactory,
  online = () => globalThis.navigator?.onLine !== false,
  scheduleTask = (callback, delay) => setTimeout(callback, delay),
  cancelTask = (handle) => clearTimeout(handle),
  onRemoteApplied = () => {},
  batchSize = 25,
  pullLimit = 100,
  maxPullBatches = 5,
} = {}) {
  if (!repository?.getPreference || !repository?.enqueue || !repository?.summary) {
    throw new TypeError('SyncCoordinator requires a durable sync repository');
  }
  if (!remoteAdapter?.pushOperation || !remoteAdapter?.pullChanges) {
    throw new TypeError('SyncCoordinator requires a RemoteSyncAdapter');
  }
  if (!domainAdapter?.listLocalObjects || !domainAdapter?.serialize || !domainAdapter?.applyRemote) {
    throw new TypeError('SyncCoordinator requires a domain adapter');
  }
  const domain = domainAdapter.domain;
  if (typeof domain !== 'string' || !domain) {
    throw new TypeError('SyncCoordinator domain adapter requires a domain');
  }
  const listeners = new Set();
  let generation = 0;
  let context = Object.freeze({ identityId: null, authenticated: false, sessionValid: false });
  let preference = Object.freeze({ enabled: false, decided: false });
  let state = Object.freeze({
    schemaVersion: 'riverline-sync-status/v1', state: SYNC_UI_STATES.DISABLED,
    enabled: false, decided: false, pendingCount: 0, conflictCount: 0, errorCount: 0,
  });
  let timer = null;
  let running = null;

  function publish(nextState, details = {}) {
    state = Object.freeze({ ...state, ...details, state: nextState });
    for (const listener of listeners) listener(state);
    return state;
  }

  function eligible(snapshot = context) {
    return Boolean(snapshot.identityId && snapshot.authenticated && snapshot.sessionValid && preference.enabled);
  }

  function current(identityId, token) {
    return generation === token && context.identityId === identityId && eligible();
  }

  function clearSchedule() {
    if (timer !== null) cancelTask(timer);
    timer = null;
  }

  function schedule(delay = 0, force = false) {
    if (!eligible() || timer !== null) return;
    timer = scheduleTask(() => {
      timer = null;
      void run({ force });
    }, delay);
  }

  async function refreshStatus(fallback = null) {
    if (!context.identityId || !preference.enabled) {
      return publish(preference.decided ? SYNC_UI_STATES.SAVED_LOCALLY : SYNC_UI_STATES.DISABLED, {
        enabled: false, decided: preference.decided,
        pendingCount: 0, conflictCount: 0, errorCount: 0,
      });
    }
    const summary = await repository.summary(context.identityId);
    let next = fallback;
    if (!next) {
      if (summary.conflictCount) next = SYNC_UI_STATES.CONFLICT;
      else if (summary.errorCount) next = SYNC_UI_STATES.ERROR;
      else if (summary.pendingCount) next = online() ? SYNC_UI_STATES.SAVED_LOCALLY : SYNC_UI_STATES.OFFLINE;
      else next = SYNC_UI_STATES.SYNCED;
    }
    return publish(next, { ...summary, enabled: true, decided: true });
  }

  async function enqueueObject(identityId, object) {
    if (domainAdapter.supports && !domainAdapter.supports(object)) return null;
    const objectId = domainAdapter.objectId?.(object) ?? object?.id;
    const record = await repository.getRecord(identityId, objectId);
    const document = domainAdapter.serialize(object, {
      remoteRevision: record?.remoteRevision ?? 0,
      baseObject: record?.baseObject ?? null,
    });
    if (record?.state === 'synced' && record.remoteRevision === document.revision
      && domainAdapter.same(record.baseObject, document)) return null;
    const now = timestamp(clock);
    const operation = createSyncOperation({
      operationId: idFactory('sync-op'), identityId, object: document,
      expectedRemoteRevision: record?.remoteRevision ?? 0, createdAt: now,
      domain,
      kind: domainAdapter.operationKind?.(object, document) ?? 'upsert_object',
      validateObject: domainAdapter.validateRemote,
    });
    return repository.enqueue(operation);
  }

  async function applyRemote(identityId, token, localObject, remoteRecord) {
    if (!current(identityId, token)) return false;
    await domainAdapter.applyRemote(remoteRecord.object, {
      expectedRevision: localObject?.revision ?? null,
    });
    if (!current(identityId, token)) return false;
    await repository.markSynced(identityId, remoteRecord.object, remoteRecord.serverUpdatedAt);
    onRemoteApplied(Object.freeze({ identityId, objectId: remoteRecord.object.id }));
    return true;
  }

  async function createConflict(identityId, localObject, remoteRecord, baseObject = null) {
    await repository.markConflict(identityId, {
      schemaVersion: domainAdapter.conflictSchemaVersion ?? 'saved-study-sync-conflict/v1',
      reconciliationVersion: domainAdapter.reconciliationVersion ?? SYNC_RECONCILIATION_VERSION,
      objectId: remoteRecord.object.id,
      localObject: cloneSyncData(localObject),
      remoteObject: cloneSyncData(remoteRecord.object),
      baseObject: cloneSyncData(baseObject),
      remoteServerUpdatedAt: remoteRecord.serverUpdatedAt,
      createdAt: timestamp(clock),
    });
  }

  async function reconcile(identityId, token, remoteRecord) {
    if (!current(identityId, token)) return;
    const localObject = await domainAdapter.getLocalObject(remoteRecord.object.id);
    if (!current(identityId, token)) return;
    const record = await repository.getRecord(identityId, remoteRecord.object.id);
    if (record?.remoteRevision && remoteRecord.object.revision < record.remoteRevision) return;
    if (!localObject) {
      await applyRemote(identityId, token, null, remoteRecord);
      return;
    }
    const localDocument = domainAdapter.serialize(localObject);
    if (domainAdapter.same(localDocument, remoteRecord.object)) {
      await repository.markSynced(identityId, remoteRecord.object, remoteRecord.serverUpdatedAt);
      return;
    }
    const base = record?.baseObject ?? null;
    if (domainAdapter.mergeRemote) {
      const mergedDocument = await domainAdapter.mergeRemote({
        localObject,
        localDocument,
        remoteDocument: remoteRecord.object,
        baseObject: base,
      });
      if (mergedDocument) {
        await domainAdapter.applyRemote(mergedDocument, {
          expectedRevision: localObject?.revision ?? null,
        });
        if (!current(identityId, token)) return;
        await repository.markSynced(identityId, remoteRecord.object, remoteRecord.serverUpdatedAt);
        if (!domainAdapter.same(mergedDocument, remoteRecord.object)) {
          const mergedLocal = await domainAdapter.getLocalObject(remoteRecord.object.id);
          if (mergedLocal) await enqueueObject(identityId, mergedLocal);
        }
        onRemoteApplied(Object.freeze({ identityId, objectId: remoteRecord.object.id }));
        return;
      }
    }
    if (base) {
      const localChanged = !domainAdapter.same(localDocument, base);
      const remoteChanged = !domainAdapter.same(remoteRecord.object, base);
      if (!localChanged && remoteChanged) {
        await applyRemote(identityId, token, localObject, remoteRecord);
        return;
      }
      if (localChanged && !remoteChanged) {
        await enqueueObject(identityId, localObject);
        return;
      }
    }
    await createConflict(identityId, localObject, remoteRecord, base);
  }

  async function push(identityId, token, { force = false } = {}) {
    const now = timestamp(clock);
    const operations = await repository.listDueOperations(identityId, now, batchSize, force);
    for (const operation of operations) {
      if (!current(identityId, token)) return { stopped: true };
      try {
        const result = await remoteAdapter.pushOperation({
          domain, identityId, operation,
        });
        if (!current(identityId, token)) return { stopped: true };
        if (result.status === 'acknowledged') {
          await repository.acknowledge(
            identityId, operation.operationId, result.record.object, result.record.serverUpdatedAt,
          );
        } else if (result.record) {
          await reconcile(identityId, token, result.record);
        } else {
          throw Object.assign(new Error('Remote conflict record is unavailable'), {
            code: 'invalid_remote_response', kind: 'permanent',
          });
        }
      } catch (error) {
        const kind = error?.kind ?? 'permanent';
        const delay = retryDelay(operation.attempts);
        const nextAttemptAt = new Date(Date.parse(timestamp(clock)) + delay).toISOString();
        await repository.fail(identityId, operation, {
          code: error?.code ?? 'sync_failed', nextAttemptAt, persistent: kind === 'permanent',
        });
        if (kind === 'auth') return { auth: true };
        if (kind === 'transient') {
          schedule(delay);
          return { offline: true };
        }
        return { error: true };
      }
    }
    return {};
  }

  async function pull(identityId, token) {
    let cursor = await repository.getCursor(identityId);
    for (let batch = 0; batch < maxPullBatches; batch += 1) {
      if (!current(identityId, token)) return { stopped: true };
      let result;
      try {
        result = await remoteAdapter.pullChanges({
          domain, identityId, cursor, limit: pullLimit,
        });
      } catch (error) {
        if (error?.kind === 'auth') return { auth: true, errorCode: error?.code };
        if (error?.kind === 'transient') return { offline: true, errorCode: error?.code };
        return { error: true, errorCode: error?.code ?? 'sync_failed' };
      }
      const records = domainAdapter.orderRemoteRecords
        ? domainAdapter.orderRemoteRecords(result.records)
        : result.records;
      for (const remoteRecord of records) await reconcile(identityId, token, remoteRecord);
      if (!current(identityId, token)) return { stopped: true };
      if (result.cursor) {
        cursor = result.cursor;
        await repository.setCursor(identityId, cursor);
      }
      if (!result.hasMore) break;
    }
    return {};
  }

  async function run({ force = false } = {}) {
    if (running) return running;
    if (!eligible()) return refreshStatus();
    if (!online()) return refreshStatus(SYNC_UI_STATES.OFFLINE);
    const identityId = context.identityId;
    const token = generation;
    running = (async () => {
      publish(SYNC_UI_STATES.SYNCING, { enabled: true, decided: true });
      const pushed = await push(identityId, token, { force });
      if (!current(identityId, token)) return state;
      if (pushed.auth) return refreshStatus(SYNC_UI_STATES.AUTH_PAUSED);
      if (pushed.offline) return refreshStatus(SYNC_UI_STATES.OFFLINE);
      if (pushed.error) return refreshStatus(SYNC_UI_STATES.ERROR);
      const pulled = await pull(identityId, token);
      if (!current(identityId, token)) return state;
      if (pulled.auth) return refreshStatus(SYNC_UI_STATES.AUTH_PAUSED);
      if (pulled.offline) {
        schedule(1_000);
        return refreshStatus(SYNC_UI_STATES.OFFLINE);
      }
      if (pulled.error) {
        await repository.setDomainError(identityId, pulled.errorCode, timestamp(clock));
        return refreshStatus(SYNC_UI_STATES.ERROR);
      }
      await repository.clearDomainError(identityId);
      return refreshStatus();
    })().finally(() => { running = null; });
    return running;
  }

  return Object.freeze({
    async activate({ identityId = null, authenticated = false, sessionValid = false } = {}) {
      generation += 1;
      clearSchedule();
      context = Object.freeze({ identityId, authenticated, sessionValid });
      preference = identityId
        ? Object.freeze(await repository.getPreference(identityId))
        : Object.freeze({ enabled: false, decided: false });
      await refreshStatus();
      if (eligible()) schedule(0, true);
      return state;
    },
    async getEnableSummary() {
      if (!context.identityId || !context.authenticated) return Object.freeze({ itemCount: 0 });
      return Object.freeze({ itemCount: (await domainAdapter.listLocalObjects()).length });
    },
    async enable() {
      if (!context.identityId || !context.authenticated || !context.sessionValid) {
        throw new RangeError('A valid authenticated session is required to enable sync');
      }
      preference = Object.freeze(await repository.setPreference(context.identityId, true, timestamp(clock)));
      const objects = await domainAdapter.listLocalObjects();
      for (const object of objects) await enqueueObject(context.identityId, object);
      await refreshStatus();
      schedule(0);
      return Object.freeze({ itemCount: objects.length, state });
    },
    async disable() {
      if (!context.identityId) return state;
      generation += 1;
      clearSchedule();
      preference = Object.freeze(await repository.setPreference(context.identityId, false, timestamp(clock)));
      return refreshStatus();
    },
    async recordLocalMutation(object) {
      if (!eligible()) return Object.freeze({ queued: false });
      try {
        await enqueueObject(context.identityId, object);
      } catch (error) {
        publish(SYNC_UI_STATES.ERROR, { enabled: true, decided: true, errorCount: 1 });
        throw error;
      }
      await refreshStatus(online() ? SYNC_UI_STATES.SAVED_LOCALLY : SYNC_UI_STATES.OFFLINE);
      schedule(0);
      return Object.freeze({ queued: true });
    },
    syncNow: () => run({ force: true }),
    getState: () => state,
    async listConflicts() {
      return context.identityId ? repository.listConflicts(context.identityId) : [];
    },
    async resolveConflict(objectId, choice) {
      if (!eligible()) throw new RangeError('Sync is not active');
      const identityId = context.identityId;
      const conflict = await repository.getConflict(identityId, objectId);
      if (!conflict) throw new RangeError('Sync conflict is unavailable');
      const remoteRecord = {
        object: conflict.remoteObject,
        serverUpdatedAt: conflict.remoteServerUpdatedAt,
      };
      if (choice === 'keep_cloud') {
        await domainAdapter.applyRemote(conflict.remoteObject, {
          expectedRevision: conflict.localObject.revision,
        });
        await repository.markSynced(identityId, conflict.remoteObject, conflict.remoteServerUpdatedAt);
        onRemoteApplied(Object.freeze({ identityId, objectId }));
      } else if (choice === 'keep_device') {
        const winner = await domainAdapter.prepareLocalWinner(conflict.localObject, conflict.remoteObject);
        await domainAdapter.applyRemote(domainAdapter.serialize(winner), {
          expectedRevision: conflict.localObject.revision,
        });
        await repository.markSynced(identityId, conflict.remoteObject, conflict.remoteServerUpdatedAt);
        await enqueueObject(identityId, winner);
      } else if (choice === 'keep_both') {
        await domainAdapter.applyRemote(conflict.remoteObject, {
          expectedRevision: conflict.localObject.revision,
        });
        await repository.markSynced(identityId, conflict.remoteObject, conflict.remoteServerUpdatedAt);
        const copy = await domainAdapter.createConflictCopy(conflict.localObject, idFactory('saved-conflict'));
        await enqueueObject(identityId, copy);
        onRemoteApplied(Object.freeze({ identityId, objectId }));
      } else {
        throw new RangeError(`Unsupported conflict choice: ${choice}`);
      }
      await refreshStatus();
      schedule(0);
      return state;
    },
    subscribe(listener) {
      if (typeof listener !== 'function') throw new TypeError('Sync listener must be a function');
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    close() {
      generation += 1;
      clearSchedule();
      return repository.close?.();
    },
  });
}
