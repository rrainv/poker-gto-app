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
    enabled: false, decided: false, pendingCount: 0, conflictCount: 0, errorCount: 0, syncedCount: 0,
  });
  let timer = null;
  let running = null;
  let activeDomainAdapter = domainAdapter;
  let activeRepository = repository;

  function authorized(snapshot = context) {
    return Boolean(snapshot.identityId && snapshot.authenticated && snapshot.sessionValid
      && (!snapshot.lifecycleScope || (snapshot.lifecycleScope.isCurrent()
        && snapshot.lifecycleScope.identityKind === 'authenticated_account'
        && snapshot.lifecycleScope.identityId === snapshot.identityId)));
  }

  function assertCurrent(identityId, token, { requireEnabled = true } = {}) {
    if (generation !== token || context.identityId !== identityId || !authorized()
      || (requireEnabled && !preference.enabled)) {
      throw Object.assign(new Error('Sync ownership scope is stale'), { code: 'sync_scope_stale' });
    }
  }

  function publish(nextState, details = {}) {
    state = Object.freeze({ ...state, ...details, state: nextState });
    for (const listener of listeners) listener(state);
    return state;
  }

  function eligible(snapshot = context) {
    return authorized(snapshot) && preference.enabled;
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
    const identityId = context.identityId;
    const token = generation;
    if (!authorized() || !preference.enabled) {
      return publish(preference.decided ? SYNC_UI_STATES.SAVED_LOCALLY : SYNC_UI_STATES.DISABLED, {
        enabled: false, decided: preference.decided,
        pendingCount: 0, conflictCount: 0, errorCount: 0, syncedCount: 0,
      });
    }
    let summary;
    try { summary = await activeRepository.summary(context.identityId); } catch (error) {
      if (!current(identityId, token)) return state;
      throw error;
    }
    if (!current(identityId, token)) return state;
    let next = fallback;
    if (!next) {
      if (summary.conflictCount) next = SYNC_UI_STATES.CONFLICT;
      else if (summary.errorCount) next = SYNC_UI_STATES.ERROR;
      else if (summary.pendingCount) next = online() ? SYNC_UI_STATES.SAVED_LOCALLY : SYNC_UI_STATES.OFFLINE;
      else next = SYNC_UI_STATES.SYNCED;
    }
    return publish(next, { ...summary, enabled: true, decided: true });
  }

  async function enqueueObject(identityId, object, token = generation) {
    assertCurrent(identityId, token);
    const adapter = activeDomainAdapter;
    await adapter.preflight?.();
    assertCurrent(identityId, token);
    if (adapter.supports && !adapter.supports(object)) return null;
    const objectId = adapter.objectId?.(object) ?? object?.id;
    const record = await activeRepository.getRecord(identityId, objectId);
    assertCurrent(identityId, token);
    const document = adapter.serialize(object, {
      remoteRevision: record?.remoteRevision ?? 0,
      baseObject: record?.baseObject ?? null,
    });
    if (record?.state === 'synced' && record.remoteRevision === document.revision
      && adapter.same(record.baseObject, document)) return null;
    const now = timestamp(clock);
    const operation = createSyncOperation({
      operationId: idFactory('sync-op'), identityId, object: document,
      expectedRemoteRevision: record?.remoteRevision ?? 0, createdAt: now,
      domain,
      kind: adapter.operationKind?.(object, document) ?? 'upsert_object',
      validateObject: adapter.validateRemote,
    });
    return activeRepository.enqueue(operation);
  }

  async function applyRemote(identityId, token, localObject, remoteRecord) {
    if (!current(identityId, token)) return false;
    await activeDomainAdapter.applyRemote(remoteRecord.object, {
      expectedRevision: localObject?.revision ?? null,
    });
    if (!current(identityId, token)) return false;
    await activeRepository.markSynced(identityId, remoteRecord.object, remoteRecord.serverUpdatedAt);
    if (!current(identityId, token)) return false;
    onRemoteApplied(Object.freeze({ identityId, objectId: remoteRecord.object.id }));
    return true;
  }

  async function createConflict(identityId, localObject, remoteRecord, baseObject = null) {
    await activeRepository.markConflict(identityId, {
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
    const adapter = activeDomainAdapter;
    const localObject = await adapter.getLocalObject(remoteRecord.object.id);
    if (!current(identityId, token)) return;
    const record = await activeRepository.getRecord(identityId, remoteRecord.object.id);
    if (!current(identityId, token)) return;
    if (record?.remoteRevision && remoteRecord.object.revision < record.remoteRevision) return;
    if (!localObject) {
      await applyRemote(identityId, token, null, remoteRecord);
      return;
    }
    const localDocument = adapter.serialize(localObject);
    if (adapter.same(localDocument, remoteRecord.object)) {
      await activeRepository.markSynced(identityId, remoteRecord.object, remoteRecord.serverUpdatedAt);
      return;
    }
    const base = record?.baseObject ?? null;
    if (adapter.mergeRemote) {
      const mergedDocument = await adapter.mergeRemote({
        localObject,
        localDocument,
        remoteDocument: remoteRecord.object,
        baseObject: base,
      });
      if (!current(identityId, token)) return;
      if (mergedDocument) {
        await adapter.applyRemote(mergedDocument, {
          expectedRevision: localObject?.revision ?? null,
        });
        if (!current(identityId, token)) return;
        await activeRepository.markSynced(identityId, remoteRecord.object, remoteRecord.serverUpdatedAt);
        if (!current(identityId, token)) return;
        if (!adapter.same(mergedDocument, remoteRecord.object)) {
          const mergedLocal = await adapter.getLocalObject(remoteRecord.object.id);
          if (!current(identityId, token)) return;
          if (mergedLocal) await enqueueObject(identityId, mergedLocal, token);
        }
        if (!current(identityId, token)) return;
        onRemoteApplied(Object.freeze({ identityId, objectId: remoteRecord.object.id }));
        return;
      }
    }
    if (base) {
      const localChanged = !adapter.same(localDocument, base);
      const remoteChanged = !adapter.same(remoteRecord.object, base);
      if (!localChanged && remoteChanged) {
        await applyRemote(identityId, token, localObject, remoteRecord);
        return;
      }
      if (localChanged && !remoteChanged) {
        await enqueueObject(identityId, localObject, token);
        return;
      }
    }
    await createConflict(identityId, localObject, remoteRecord, base);
  }

  async function push(identityId, token, { force = false } = {}) {
    const now = timestamp(clock);
    const operations = await activeRepository.listDueOperations(identityId, now, batchSize, force);
    for (const operation of operations) {
      if (!current(identityId, token)) return { stopped: true };
      try {
        // Revalidate local schema even for operations queued before a migration.
        await activeDomainAdapter.preflight?.();
        if (!current(identityId, token)) return { stopped: true };
        const result = await remoteAdapter.pushOperation({
          domain, identityId, operation,
        });
        if (!current(identityId, token)) return { stopped: true };
        if (result.status === 'acknowledged') {
          await activeRepository.acknowledge(
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
        if (!current(identityId, token)) return { stopped: true };
        const kind = error?.kind ?? 'permanent';
        const delay = retryDelay(operation.attempts);
        const nextAttemptAt = new Date(Date.parse(timestamp(clock)) + delay).toISOString();
        await activeRepository.fail(identityId, operation, {
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
    let cursor = await activeRepository.getCursor(identityId);
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
      if (!current(identityId, token)) return { stopped: true };
      const records = activeDomainAdapter.orderRemoteRecords
        ? activeDomainAdapter.orderRemoteRecords(result.records)
        : result.records;
      for (const remoteRecord of records) await reconcile(identityId, token, remoteRecord);
      if (!current(identityId, token)) return { stopped: true };
      if (result.cursor) {
        cursor = result.cursor;
        await activeRepository.setCursor(identityId, cursor);
      }
      if (!result.hasMore) break;
    }
    return {};
  }

  async function run({ force = false } = {}) {
    if (running?.generation === generation) return running.promise;
    if (!eligible()) return refreshStatus();
    if (!online()) return refreshStatus(SYNC_UI_STATES.OFFLINE);
    const identityId = context.identityId;
    const token = generation;
    const operation = (async () => {
      publish(SYNC_UI_STATES.SYNCING, { enabled: true, decided: true });
      try {
        await activeDomainAdapter.preflight?.();
      } catch (error) {
        if (!current(identityId, token)) return state;
        await activeRepository.setDomainError(identityId, error?.code ?? 'sync_failed', timestamp(clock));
        if (!current(identityId, token)) return state;
        return refreshStatus(SYNC_UI_STATES.ERROR);
      }
      if (!current(identityId, token)) return state;
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
        await activeRepository.setDomainError(identityId, pulled.errorCode, timestamp(clock));
        if (!current(identityId, token)) return state;
        return refreshStatus(SYNC_UI_STATES.ERROR);
      }
      await activeRepository.clearDomainError(identityId);
      if (!current(identityId, token)) return state;
      return refreshStatus();
    })().catch((error) => {
      if (!current(identityId, token)) return state;
      throw error;
    }).finally(() => { if (running?.generation === token) running = null; });
    running = { generation: token, promise: operation };
    return operation;
  }

  return Object.freeze({
    async activate({ identityId = null, authenticated = false, sessionValid = false,
      lifecycleScope = null, domainAdapter: nextAdapter = domainAdapter } = {}) {
      generation += 1;
      const token = generation;
      clearSchedule();
      context = Object.freeze({ identityId, authenticated, sessionValid, lifecycleScope });
      activeDomainAdapter = nextAdapter;
      activeRepository = lifecycleScope && repository.forLifecycleScope
        ? repository.forLifecycleScope(lifecycleScope) : repository;
      preference = Object.freeze({ enabled: false, decided: false });
      publish(SYNC_UI_STATES.DISABLED, {
        enabled: false, decided: false, pendingCount: 0, conflictCount: 0, errorCount: 0, syncedCount: 0,
      });
      if (!authorized()) return state;
      let loaded;
      try { loaded = await activeRepository.getPreference(identityId); } catch (error) {
        if (generation !== token || !authorized()) return state;
        throw error;
      }
      if (generation !== token || !authorized()) return state;
      preference = Object.freeze(loaded);
      if (preference.enabled) {
        try { await activeDomainAdapter.preflight?.(); } catch (error) {
          if (!current(identityId, token)) return state;
          await activeRepository.setDomainError(identityId, error?.code ?? 'sync_failed', timestamp(clock));
          if (!current(identityId, token)) return state;
          return refreshStatus(SYNC_UI_STATES.ERROR);
        }
      }
      await refreshStatus();
      if (current(identityId, token)) schedule(0, true);
      return state;
    },
    async getEnableSummary() {
      if (!authorized()) return Object.freeze({ itemCount: 0 });
      const identityId = context.identityId;
      const token = generation;
      const objects = await activeDomainAdapter.listLocalObjects();
      assertCurrent(identityId, token, { requireEnabled: false });
      return Object.freeze({ itemCount: objects.length });
    },
    async enable() {
      if (!authorized()) throw new RangeError('A valid authenticated session is required to enable sync');
      const identityId = context.identityId;
      const token = generation;
      const adapter = activeDomainAdapter;
      const updated = await activeRepository.setPreference(identityId, true, timestamp(clock));
      assertCurrent(identityId, token, { requireEnabled: false });
      preference = Object.freeze(updated);
      let objects;
      try {
        await adapter.preflight?.();
        assertCurrent(identityId, token);
        objects = await adapter.listLocalObjects();
      } catch (error) {
        if (!current(identityId, token)) throw error;
        await activeRepository.setDomainError(identityId, error?.code ?? 'sync_failed', timestamp(clock));
        if (current(identityId, token)) await refreshStatus(SYNC_UI_STATES.ERROR);
        throw error;
      }
      assertCurrent(identityId, token);
      for (const object of objects) await enqueueObject(identityId, object, token);
      assertCurrent(identityId, token);
      await refreshStatus();
      if (current(identityId, token)) schedule(0);
      return Object.freeze({ itemCount: objects.length, state });
    },
    async disable() {
      if (!authorized()) return state;
      generation += 1;
      const identityId = context.identityId;
      const token = generation;
      clearSchedule();
      const updated = await activeRepository.setPreference(identityId, false, timestamp(clock));
      assertCurrent(identityId, token, { requireEnabled: false });
      preference = Object.freeze(updated);
      return refreshStatus();
    },
    async recordLocalMutation(object, { lifecycleScope = null } = {}) {
      if (!eligible() || (lifecycleScope && (!lifecycleScope.isCurrent()
        || lifecycleScope.identityId !== context.identityId))) return Object.freeze({ queued: false });
      const identityId = context.identityId;
      const token = generation;
      try {
        await enqueueObject(identityId, object, token);
      } catch (error) {
        if (!current(identityId, token)) return Object.freeze({ queued: false });
        await activeRepository.setDomainError(identityId, error?.code ?? 'sync_failed', timestamp(clock));
        if (!current(identityId, token)) return Object.freeze({ queued: false });
        publish(SYNC_UI_STATES.ERROR, { enabled: true, decided: true, errorCount: 1 });
        throw error;
      }
      if (!current(identityId, token)) return Object.freeze({ queued: false });
      await refreshStatus(online() ? SYNC_UI_STATES.SAVED_LOCALLY : SYNC_UI_STATES.OFFLINE);
      if (current(identityId, token)) schedule(0);
      return Object.freeze({ queued: current(identityId, token) });
    },
    syncNow: () => run({ force: true }),
    getState: () => state,
    async listConflicts() {
      if (!eligible()) return [];
      const identityId = context.identityId;
      const token = generation;
      let conflicts;
      try { conflicts = await activeRepository.listConflicts(identityId); } catch (error) {
        if (!current(identityId, token)) return [];
        throw error;
      }
      return current(identityId, token) ? conflicts : [];
    },
    async resolveConflict(objectId, choice) {
      if (!eligible()) throw new RangeError('Sync is not active');
      const identityId = context.identityId;
      const token = generation;
      const adapter = activeDomainAdapter;
      const guard = () => assertCurrent(identityId, token);
      const conflict = await activeRepository.getConflict(identityId, objectId);
      guard();
      if (!conflict) throw new RangeError('Sync conflict is unavailable');
      if (choice === 'keep_cloud' || choice === 'keep_both') {
        await adapter.applyRemote(conflict.remoteObject, {
          expectedRevision: conflict.localObject.revision,
        });
        guard();
        await activeRepository.markSynced(identityId, conflict.remoteObject, conflict.remoteServerUpdatedAt);
        guard();
        if (choice === 'keep_both') {
          const copy = await adapter.createConflictCopy(conflict.localObject, idFactory('saved-conflict'));
          guard();
          await enqueueObject(identityId, copy, token);
          guard();
        }
        onRemoteApplied(Object.freeze({ identityId, objectId }));
      } else if (choice === 'keep_device') {
        const winner = await adapter.prepareLocalWinner(conflict.localObject, conflict.remoteObject);
        guard();
        await adapter.applyRemote(adapter.serialize(winner), {
          expectedRevision: conflict.localObject.revision,
        });
        guard();
        await activeRepository.markSynced(identityId, conflict.remoteObject, conflict.remoteServerUpdatedAt);
        guard();
        await enqueueObject(identityId, winner, token);
        guard();
      } else {
        throw new RangeError(`Unsupported conflict choice: ${choice}`);
      }
      await refreshStatus();
      if (current(identityId, token)) schedule(0);
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
      return activeRepository.close?.();
    },
  });
}
