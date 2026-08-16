export const TUTORIAL_PREFERENCES_SCHEMA_VERSION = 'tutorial-preferences/v1';
export const TUTORIAL_PREFERENCES_STORAGE_KEY = 'riverline.tutorialPreferences.v1';

function emptyState() {
  return {
    schemaVersion: TUTORIAL_PREFERENCES_SCHEMA_VERSION,
    localOwnerId: 'local',
    tutorials: {},
  };
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function validState(value) {
  return Boolean(value
    && value.schemaVersion === TUTORIAL_PREFERENCES_SCHEMA_VERSION
    && value.localOwnerId === 'local'
    && value.tutorials
    && typeof value.tutorials === 'object'
    && !Array.isArray(value.tutorials));
}

export function createTutorialPersistence({
  storage = globalThis.localStorage,
  storageKey = TUTORIAL_PREFERENCES_STORAGE_KEY,
  clock = () => new Date().toISOString(),
} = {}) {
  let memory = null;
  let recoveredInvalidState = false;
  let storageError = null;

  function read() {
    if (memory) return memory;
    try {
      const raw = storage?.getItem?.(storageKey);
      if (!raw) return (memory = emptyState());
      const parsed = JSON.parse(raw);
      if (!validState(parsed)) {
        recoveredInvalidState = true;
        return (memory = emptyState());
      }
      return (memory = parsed);
    } catch (error) {
      recoveredInvalidState = true;
      storageError = error;
      return (memory = emptyState());
    }
  }

  function write(mutator) {
    const state = clone(read());
    const result = mutator(state);
    memory = state;
    try {
      storage?.setItem?.(storageKey, JSON.stringify(state));
      storageError = null;
    } catch (error) {
      storageError = error;
    }
    return result;
  }

  function recordFor(state, definition, create = false) {
    let tutorial = state.tutorials[definition.id];
    if (!tutorial && create) {
      tutorial = { tutorialId: definition.id, versions: {} };
      state.tutorials[definition.id] = tutorial;
    }
    const key = String(definition.version);
    let record = tutorial?.versions?.[key] ?? null;
    if (!record && create) {
      record = {
        tutorialVersion: definition.version,
        firstUseStatus: 'in_progress',
        lastRunStatus: 'active',
        lastRunKind: 'first_use',
        lastStepId: definition.steps[0].id,
        updatedAt: clock(),
        completedAt: null,
        skippedAt: null,
      };
      tutorial.versions[key] = record;
    }
    return record;
  }

  function update(definition, updater) {
    return write((state) => {
      const record = recordFor(state, definition, true);
      updater(record);
      record.updatedAt = clock();
      return clone(record);
    });
  }

  return Object.freeze({
    schemaVersion: 'tutorial-persistence/v1',
    getRecord(definition) {
      const record = recordFor(read(), definition, false);
      return record ? clone(record) : null;
    },
    shouldOffer(definition) {
      if (definition.firstUsePolicy !== 'prompt') return false;
      const record = recordFor(read(), definition, false);
      return !record || record.firstUseStatus === 'in_progress';
    },
    begin(definition, { manualRestart = false, resume = false, stepId = null } = {}) {
      return update(definition, (record) => {
        const terminal = record.firstUseStatus === 'completed' || record.firstUseStatus === 'skipped';
        if (!manualRestart || !terminal) record.firstUseStatus = 'in_progress';
        record.lastRunStatus = 'active';
        record.lastRunKind = manualRestart ? 'manual' : 'first_use';
        if (!resume || !record.lastStepId) record.lastStepId = stepId || definition.steps[0].id;
      });
    },
    progress(definition, stepId) {
      return update(definition, (record) => {
        record.lastRunStatus = 'active';
        record.lastStepId = stepId;
      });
    },
    complete(definition) {
      return update(definition, (record) => {
        record.firstUseStatus = 'completed';
        record.lastRunStatus = 'completed';
        record.lastStepId = definition.steps.at(-1).id;
        record.completedAt = clock();
      });
    },
    skip(definition) {
      return update(definition, (record) => {
        const terminal = record.firstUseStatus === 'completed' || record.firstUseStatus === 'skipped';
        if (!(record.lastRunKind === 'manual' && terminal)) record.firstUseStatus = 'skipped';
        record.lastRunStatus = 'skipped';
        record.skippedAt = clock();
      });
    },
    cancel(definition) {
      return update(definition, (record) => {
        record.lastRunStatus = 'cancelled';
      });
    },
    snapshot() { return clone(read()); },
    diagnostics() {
      return Object.freeze({ recoveredInvalidState, storageError: storageError ? String(storageError) : null });
    },
  });
}

