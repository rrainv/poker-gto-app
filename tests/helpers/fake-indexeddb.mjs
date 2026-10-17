// TEST-HYGIENE-001: an in-memory IndexedDB sufficient for Riverline's storage
// adapters (object stores, compound/multiEntry indexes, key ranges, cursors,
// versioned upgrades, auto-committing transactions and abort rollback).

import { Event, EventTarget } from './mini-dom.mjs';

const macrotask = (callback) => setImmediate(callback);

function domError(name, message) {
  const error = new Error(message);
  error.name = name;
  return error;
}

function keyType(key) {
  if (typeof key === 'number' && !Number.isNaN(key)) return 1;
  if (key instanceof Date && !Number.isNaN(key.getTime())) return 2;
  if (typeof key === 'string') return 3;
  if (key instanceof ArrayBuffer || ArrayBuffer.isView(key)) return 4;
  if (Array.isArray(key)) return 5;
  return 0;
}

function validKey(key) {
  const type = keyType(key);
  if (!type) return false;
  if (type === 5) return key.every(validKey);
  return true;
}

export function compareKeys(left, right) {
  const leftType = keyType(left);
  const rightType = keyType(right);
  if (!leftType || !rightType) throw domError('DataError', 'Invalid IndexedDB key');
  if (leftType !== rightType) return leftType - rightType;
  if (leftType === 1) return left === right ? 0 : left < right ? -1 : 1;
  if (leftType === 2) return Math.sign(left.getTime() - right.getTime());
  if (leftType === 3) return left === right ? 0 : left < right ? -1 : 1;
  if (leftType === 5) {
    for (let index = 0; index < Math.min(left.length, right.length); index += 1) {
      const result = compareKeys(left[index], right[index]);
      if (result) return result;
    }
    return Math.sign(left.length - right.length);
  }
  return 0;
}

export class IDBKeyRange {
  constructor(lower, upper, lowerOpen = false, upperOpen = false) {
    this.lower = lower;
    this.upper = upper;
    this.lowerOpen = lowerOpen;
    this.upperOpen = upperOpen;
  }
  static only(value) { return new IDBKeyRange(value, value, false, false); }
  static lowerBound(value, open = false) { return new IDBKeyRange(value, undefined, open, true); }
  static upperBound(value, open = false) { return new IDBKeyRange(undefined, value, true, open); }
  static bound(lower, upper, lowerOpen = false, upperOpen = false) {
    if (compareKeys(lower, upper) > 0) throw domError('DataError', 'Lower bound exceeds upper bound');
    return new IDBKeyRange(lower, upper, lowerOpen, upperOpen);
  }
  includes(key) {
    if (this.lower !== undefined) {
      const result = compareKeys(key, this.lower);
      if (result < 0 || (result === 0 && this.lowerOpen)) return false;
    }
    if (this.upper !== undefined) {
      const result = compareKeys(key, this.upper);
      if (result > 0 || (result === 0 && this.upperOpen)) return false;
    }
    return true;
  }
}

function toRange(query) {
  if (query === undefined || query === null) return null;
  if (query instanceof IDBKeyRange) return query;
  if (!validKey(query)) throw domError('DataError', 'Invalid IndexedDB query');
  return IDBKeyRange.only(query);
}

function extractKey(value, keyPath) {
  if (Array.isArray(keyPath)) {
    const keys = keyPath.map((path) => extractKey(value, path));
    return keys.some((key) => key === undefined) ? undefined : keys;
  }
  if (keyPath === '') return value;
  let current = value;
  for (const segment of keyPath.split('.')) {
    if (current === null || typeof current !== 'object' || !(segment in current)) return undefined;
    current = current[segment];
  }
  return current;
}

function stringList(values) {
  const list = [...values].sort();
  return Object.assign(list, { contains: (name) => list.includes(name), item: (index) => list[index] ?? null });
}

class FakeRequest extends EventTarget {
  constructor(source, transaction) {
    super();
    this.source = source;
    this.transaction = transaction;
    this.readyState = 'pending';
    this.result = undefined;
    this.error = null;
    this.onsuccess = null;
    this.onerror = null;
    this.onupgradeneeded = null;
    this.onblocked = null;
  }
  _eventParent() { return this.transaction || null; }
  // on<type> handler properties run through the mini DOM's dispatch.
  _fire(type, init = {}) {
    const event = Object.assign(new Event(type, { bubbles: type === 'error', cancelable: type === 'error' }), init);
    this.dispatchEvent(event);
    return event;
  }
}

class StoreData {
  constructor(name, keyPath, autoIncrement) {
    this.name = name;
    this.keyPath = keyPath ?? null;
    this.autoIncrement = Boolean(autoIncrement);
    this.records = [];
    this.indexes = new Map();
    this.generator = 1;
  }
  clone() {
    const copy = new StoreData(this.name, this.keyPath, this.autoIncrement);
    copy.records = this.records.map((record) => ({ key: record.key, value: structuredClone(record.value) }));
    copy.indexes = new Map([...this.indexes].map(([name, index]) => [name, { ...index }]));
    copy.generator = this.generator;
    return copy;
  }
  find(key) {
    let low = 0;
    let high = this.records.length - 1;
    while (low <= high) {
      const middle = (low + high) >> 1;
      const result = compareKeys(this.records[middle].key, key);
      if (result === 0) return { found: true, position: middle };
      if (result < 0) low = middle + 1;
      else high = middle - 1;
    }
    return { found: false, position: low };
  }
  inRange(range) { return this.records.filter((record) => !range || range.includes(record.key)); }
  indexEntries(indexName) {
    const index = this.indexes.get(indexName);
    const entries = [];
    for (const record of this.records) {
      const key = extractKey(record.value, index.keyPath);
      if (key === undefined) continue;
      if (index.multiEntry && Array.isArray(key)) {
        for (const item of new Set(key.filter(validKey))) entries.push({ key: item, primaryKey: record.key, value: record.value });
      } else if (validKey(key)) {
        entries.push({ key, primaryKey: record.key, value: record.value });
      }
    }
    return entries.sort((left, right) => compareKeys(left.key, right.key) || compareKeys(left.primaryKey, right.primaryKey));
  }
}

class FakeCursor {
  constructor(request, entries, direction, withValue) {
    this._request = request;
    this._entries = entries;
    this._position = -1;
    this.direction = direction;
    this._withValue = withValue;
    this.source = request.source;
  }
  _advance() {
    this._position += 1;
    const entry = this._entries[this._position];
    this._request.readyState = 'done';
    if (!entry) {
      this._request.result = null;
    } else {
      this.key = entry.key;
      this.primaryKey = entry.primaryKey;
      if (this._withValue) this.value = structuredClone(entry.value);
      this._request.result = this;
    }
    this._request.transaction._deliver(this._request, () => this._request._fire('success'));
  }
  continue() {
    this._request.transaction._assertActive();
    this._request.transaction._pending += 1;
    this._advance();
  }
  advance(count) { this._position += count - 1; this.continue(); }
  update(value) { return this.source._storeApi?.put(value) ?? this.source.put(value); }
  delete() { return (this.source._storeApi ?? this.source).delete(this.primaryKey); }
}

class FakeIndex {
  constructor(store, name) { this._store = store; this.name = name; this.objectStore = store; }
  get keyPath() { return this._store._data().indexes.get(this.name).keyPath; }
  get unique() { return this._store._data().indexes.get(this.name).unique; }
  get multiEntry() { return this._store._data().indexes.get(this.name).multiEntry; }
  _entries(query) {
    const range = toRange(query);
    return this._store._data().indexEntries(this.name).filter((entry) => !range || range.includes(entry.key));
  }
  get(query) { return this._store._transaction._request(this, () => structuredClone(this._entries(query)[0]?.value)); }
  getKey(query) { return this._store._transaction._request(this, () => this._entries(query)[0]?.primaryKey); }
  getAll(query, count) { return this._store._transaction._request(this, () => this._entries(query).slice(0, count || undefined).map((entry) => structuredClone(entry.value))); }
  getAllKeys(query, count) { return this._store._transaction._request(this, () => this._entries(query).slice(0, count || undefined).map((entry) => entry.primaryKey)); }
  count(query) { return this._store._transaction._request(this, () => this._entries(query).length); }
  openCursor(query, direction = 'next') { return this._store._cursor(this, this._entries(query), direction, true); }
  openKeyCursor(query, direction = 'next') { return this._store._cursor(this, this._entries(query), direction, false); }
}

class FakeObjectStore {
  constructor(transaction, name) {
    this._transaction = transaction;
    this.name = name;
    this.transaction = transaction;
  }
  _data() { return this._transaction._store(this.name); }
  get keyPath() { return this._data().keyPath; }
  get autoIncrement() { return this._data().autoIncrement; }
  get indexNames() { return stringList(this._data().indexes.keys()); }
  createIndex(name, keyPath, { unique = false, multiEntry = false } = {}) {
    if (this._transaction.mode !== 'versionchange') throw domError('InvalidStateError', 'createIndex outside upgrade');
    this._data().indexes.set(name, { keyPath, unique, multiEntry });
    return new FakeIndex(this, name);
  }
  deleteIndex(name) { this._data().indexes.delete(name); }
  index(name) {
    if (!this._data().indexes.has(name)) throw domError('NotFoundError', `No index ${name}`);
    return new FakeIndex(this, name);
  }
  _write(value, key, overwrite) {
    this._transaction._assertWritable();
    return this._transaction._request(this, () => {
      const data = this._data();
      let primary = data.keyPath !== null ? extractKey(value, data.keyPath) : key;
      if (primary === undefined && data.autoIncrement) primary = data.generator;
      if (!validKey(primary)) throw domError('DataError', 'Missing or invalid key');
      if (typeof primary === 'number' && data.autoIncrement && primary >= data.generator) data.generator = Math.floor(primary) + 1;
      const stored = structuredClone(value);
      if (data.keyPath !== null && typeof data.keyPath === 'string' && extractKey(stored, data.keyPath) === undefined) stored[data.keyPath] = primary;
      const { found, position } = data.find(primary);
      if (found && !overwrite) throw domError('ConstraintError', 'Key already exists');
      for (const [indexName, index] of data.indexes) {
        if (!index.unique) continue;
        const indexKey = extractKey(stored, index.keyPath);
        if (indexKey === undefined) continue;
        const clash = data.indexEntries(indexName).some((entry) => compareKeys(entry.key, indexKey) === 0 && compareKeys(entry.primaryKey, primary) !== 0);
        if (clash) throw domError('ConstraintError', `Unique index ${indexName} violated`);
      }
      if (found) data.records[position] = { key: primary, value: stored };
      else data.records.splice(position, 0, { key: primary, value: stored });
      return primary;
    });
  }
  put(value, key) { this._assertKeyArgument(key); return this._write(value, key, true); }
  add(value, key) { this._assertKeyArgument(key); return this._write(value, key, false); }
  _assertKeyArgument(key) {
    if (key !== undefined && this._data().keyPath !== null) throw domError('DataError', 'An in-line key store does not take an explicit key');
  }
  delete(query) {
    this._transaction._assertWritable();
    return this._transaction._request(this, () => {
      const range = toRange(query);
      const data = this._data();
      data.records = data.records.filter((record) => !range.includes(record.key));
      return undefined;
    });
  }
  clear() {
    this._transaction._assertWritable();
    return this._transaction._request(this, () => { this._data().records = []; return undefined; });
  }
  get(query) {
    return this._transaction._request(this, () => {
      const range = toRange(query);
      return structuredClone(this._data().inRange(range)[0]?.value);
    });
  }
  getKey(query) { return this._transaction._request(this, () => this._data().inRange(toRange(query))[0]?.key); }
  getAll(query, count) {
    return this._transaction._request(this, () => this._data().inRange(toRange(query)).slice(0, count || undefined).map((record) => structuredClone(record.value)));
  }
  getAllKeys(query, count) {
    return this._transaction._request(this, () => this._data().inRange(toRange(query)).slice(0, count || undefined).map((record) => record.key));
  }
  count(query) { return this._transaction._request(this, () => this._data().inRange(toRange(query)).length); }
  _cursor(source, entries, direction, withValue) {
    const ordered = direction.startsWith('prev') ? [...entries].reverse() : entries;
    const request = new FakeRequest(source, this._transaction);
    const cursor = new FakeCursor(request, ordered, direction, withValue);
    if (source === this) cursor.source = this;
    else cursor.source = Object.assign(Object.create(source), { _storeApi: this });
    this._transaction._pending += 1;
    if (this._transaction._started) macrotask(() => cursor._advance());
    else this._transaction._queue.push(() => cursor._advance());
    return request;
  }
  openCursor(query, direction = 'next') {
    const entries = this._data().inRange(toRange(query)).map((record) => ({ key: record.key, primaryKey: record.key, value: record.value }));
    return this._cursor(this, entries, direction, true);
  }
  openKeyCursor(query, direction = 'next') {
    const entries = this._data().inRange(toRange(query)).map((record) => ({ key: record.key, primaryKey: record.key, value: record.value }));
    return this._cursor(this, entries, direction, false);
  }
}

class FakeTransaction extends EventTarget {
  constructor(database, storeNames, mode) {
    super();
    this.db = database;
    this.mode = mode;
    this._names = storeNames;
    this._pending = 0;
    this._state = 'active';
    this._snapshot = new Map();
    this.error = null;
    this.oncomplete = null;
    this.onerror = null;
    this.onabort = null;
    this.durability = 'default';
    this._started = false;
    this._queue = [];
    // As in browsers, a transaction is active only in the task that created it
    // and while its request events dispatch (until control returns to the
    // event loop). Requests made outside those windows throw
    // TransactionInactiveError; an inactive transaction with no pending
    // requests auto-commits.
    this._activations = 1;
    this._commitRequested = false;
    macrotask(() => this._deactivate());
    // Real IndexedDB runs transactions with overlapping scopes in creation
    // order when either side writes; later ones wait (and queue requests).
    database._backing.transactions.push(this);
    database._backing.schedule();
  }
  _conflictsWith(other) {
    if (this.mode === 'readonly' && other.mode === 'readonly') return false;
    if (this.mode === 'versionchange' || other.mode === 'versionchange') return true;
    return this._names.some((name) => other._names.includes(name));
  }
  _start() {
    this._started = true;
    const queued = this._queue;
    this._queue = [];
    for (const run of queued) macrotask(run);
    macrotask(() => this._maybeCommit());
  }
  get objectStoreNames() { return stringList(this._names); }
  _eventParent() { return this.db; }
  _store(name) {
    const stores = this.db._backing.stores;
    if (!stores.has(name)) throw domError('NotFoundError', `No object store ${name}`);
    if (this.mode !== 'readonly' && !this._snapshot.has(name)) this._snapshot.set(name, stores.get(name).clone());
    return stores.get(name);
  }
  objectStore(name) {
    if (!this._names.includes(name)) throw domError('NotFoundError', `Store ${name} is not in this transaction`);
    if (this._state !== 'active') throw domError('TransactionInactiveError', 'Transaction has finished');
    return new FakeObjectStore(this, name);
  }
  _assertActive() {
    if (this._state !== 'active') throw domError('TransactionInactiveError', 'Transaction has finished');
    if (this._activations === 0 || this._commitRequested) {
      throw domError('TransactionInactiveError', 'Transaction is not active (a request was made after control returned to the event loop)');
    }
  }
  _deactivate() {
    this._activations -= 1;
    this._maybeCommit();
  }
  _assertWritable() {
    if (this.mode === 'readonly') throw domError('ReadOnlyError', 'Read-only transaction');
    this._assertActive();
  }
  _request(source, operation) {
    this._assertActive();
    const request = new FakeRequest(source, this);
    this._pending += 1;
    const run = () => {
      if (this._state !== 'active') { this._pending -= 1; return; }
      try {
        request.result = operation();
        request.readyState = 'done';
        this._deliver(request, () => request._fire('success'));
      } catch (error) {
        request.error = error;
        request.readyState = 'done';
        this._deliver(request, () => {
          const event = request._fire('error');
          if (!event.defaultPrevented) this._abort(error);
        });
      }
    };
    if (this._started) macrotask(run);
    else this._queue.push(run);
    return request;
  }
  _deliver(request, fire) {
    this._pending -= 1;
    this._activations += 1;
    try {
      fire();
    } finally {
      macrotask(() => this._deactivate());
    }
  }
  _maybeCommit() {
    if (!this._started || this._state !== 'active' || this._pending > 0) return;
    if (this._activations > 0 && !this._commitRequested) return;
    this._state = 'finished';
    this._snapshot.clear();
    this._fire('complete');
    this.db._transactionDone(this);
  }
  // on<type> handler properties run through the mini DOM's dispatch.
  _fire(type) {
    this.dispatchEvent(new Event(type, { bubbles: type === 'abort' }));
  }
  _abort(error) {
    if (this._state !== 'active') return;
    this._state = 'finished';
    this.error = error ?? domError('AbortError', 'Transaction aborted');
    for (const [name, snapshot] of this._snapshot) {
      if (snapshot === null) this.db._backing.stores.delete(name);
      else this.db._backing.stores.set(name, snapshot);
    }
    this._snapshot.clear();
    if (this.mode === 'versionchange') this.db._backing.version = this.db._previousVersion;
    this._fire('abort');
    this.db._transactionDone(this);
  }
  abort() {
    if (this._state !== 'active') throw domError('InvalidStateError', 'Transaction already finished');
    this._abort(domError('AbortError', 'Transaction aborted'));
  }
  commit() {
    this._assertActive();
    this._commitRequested = true;
    macrotask(() => this._maybeCommit());
  }
}

class FakeDatabase extends EventTarget {
  constructor(backing) {
    super();
    this._backing = backing;
    this.name = backing.name;
    this._closed = false;
    this.onversionchange = null;
    this.onclose = null;
  }
  get version() { return this._backing.version; }
  get objectStoreNames() { return stringList(this._backing.stores.keys()); }
  createObjectStore(name, { keyPath = null, autoIncrement = false } = {}) {
    if (this._backing.stores.has(name)) throw domError('ConstraintError', `Store ${name} exists`);
    this._backing.stores.set(name, new StoreData(name, keyPath, autoIncrement));
    this._upgrade?._snapshot.set(name, null);
    this._upgrade?._names.push(name);
    return new FakeObjectStore(this._upgrade, name);
  }
  deleteObjectStore(name) { this._backing.stores.delete(name); }
  transaction(names, mode = 'readonly') {
    if (this._closed) throw domError('InvalidStateError', 'Database is closed');
    const list = Array.isArray(names) ? [...names] : [names];
    for (const name of list) if (!this._backing.stores.has(name)) throw domError('NotFoundError', `No object store ${name}`);
    return new FakeTransaction(this, list, mode);
  }
  close() { this._closed = true; this._backing.connections.delete(this); }
  _transactionDone(transaction) {
    const list = this._backing.transactions;
    const index = list.indexOf(transaction);
    if (index >= 0) list.splice(index, 1);
    this._backing.schedule();
  }
}

export function createFakeIndexedDB() {
  const databases = new Map();
  const factory = {
    _databases: databases,
    open(name, version) {
      const request = new FakeRequest(null, null);
      macrotask(() => {
        let backing = databases.get(name);
        if (!backing) {
          backing = { name, version: 0, stores: new Map(), connections: new Set(), transactions: [] };
          backing.schedule = () => {
            const waiting = backing.transactions;
            waiting.forEach((transaction, position) => {
              if (transaction._started) return;
              const blocked = waiting.slice(0, position).some((earlier) => earlier._conflictsWith(transaction));
              if (!blocked) transaction._start();
            });
          };
          databases.set(name, backing);
        }
        const requested = version ?? Math.max(1, backing.version);
        if (requested < backing.version) {
          request.error = domError('VersionError', 'Requested version is lower than the current version');
          request._fire('error');
          return;
        }
        const database = new FakeDatabase(backing);
        backing.connections.add(database);
        request.result = database;
        request.readyState = 'done';
        if (requested > backing.version) {
          const oldVersion = backing.version;
          database._previousVersion = oldVersion;
          backing.version = requested;
          const upgrade = new FakeTransaction(database, [...backing.stores.keys()], 'versionchange');
          database._upgrade = upgrade;
          request.transaction = upgrade;
          upgrade._pending += 1;
          request._fire('upgradeneeded', { oldVersion, newVersion: requested });
          upgrade._pending -= 1;
          upgrade.addEventListener('complete', () => {
            database._upgrade = null;
            request.transaction = null;
            request._fire('success');
          }, { once: true });
          upgrade.addEventListener('abort', () => {
            database._upgrade = null;
            request.error = upgrade.error;
            request._fire('error');
          }, { once: true });
          macrotask(() => upgrade._maybeCommit());
          return;
        }
        request._fire('success');
      });
      return request;
    },
    deleteDatabase(name) {
      const request = new FakeRequest(null, null);
      macrotask(() => {
        databases.delete(name);
        request.readyState = 'done';
        request._fire('success', { oldVersion: 0, newVersion: null });
      });
      return request;
    },
    async databases() { return [...databases.values()].map(({ name, version }) => ({ name, version })); },
    cmp: compareKeys,
  };
  return factory;
}
