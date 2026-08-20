import { calibrationContextKey } from '../personal-strategy/index.mjs';

export const PERSONAL_STRATEGY_SCOPE_LIFECYCLE_VERSION = 'personal-strategy-scope-lifecycle/v1';

function scopeDescriptor(scope) {
  if (typeof scope?.profileId !== 'string' || !scope.profileId.trim()) {
    throw new TypeError('Personal Strategy scope profileId is required');
  }
  if (typeof scope?.modeId !== 'string' || !scope.modeId.trim()) {
    throw new TypeError('Personal Strategy scope modeId is required');
  }
  return Object.freeze({
    profileId: scope.profileId,
    modeId: scope.modeId,
    contextKey: calibrationContextKey(scope.context),
  });
}

function sameDescriptor(left, right) {
  return left?.profileId === right?.profileId
    && left?.modeId === right?.modeId
    && left?.contextKey === right?.contextKey;
}

export function createPersonalStrategyScopeLifecycle({ onInvalidate = null } = {}) {
  if (onInvalidate !== null && typeof onInvalidate !== 'function') {
    throw new TypeError('Personal Strategy scope invalidation callback must be a function');
  }

  let generation = 0;
  let activeScope = null;

  function token() {
    if (!activeScope) return null;
    return Object.freeze({
      schemaVersion: PERSONAL_STRATEGY_SCOPE_LIFECYCLE_VERSION,
      generation,
      ...activeScope,
    });
  }

  function activate(scope) {
    generation += 1;
    activeScope = scopeDescriptor(scope);
    onInvalidate?.(Object.freeze({ generation, scope: activeScope }));
    return token();
  }

  function revise(scope) {
    const nextScope = scopeDescriptor(scope);
    if (!sameDescriptor(activeScope, nextScope)) {
      throw new RangeError('Personal Strategy revision does not match the active scope');
    }
    generation += 1;
    return token();
  }

  function invalidate() {
    generation += 1;
    activeScope = null;
    onInvalidate?.(Object.freeze({ generation, scope: null }));
  }

  function capture(scope = null) {
    if (scope !== null && !sameDescriptor(activeScope, scopeDescriptor(scope))) return null;
    return token();
  }

  function isCurrent(candidate, scope = null) {
    if (!candidate || candidate.schemaVersion !== PERSONAL_STRATEGY_SCOPE_LIFECYCLE_VERSION) {
      return false;
    }
    const expectedScope = scope === null ? activeScope : scopeDescriptor(scope);
    return candidate.generation === generation
      && sameDescriptor(candidate, activeScope)
      && sameDescriptor(candidate, expectedScope);
  }

  function adopt(candidate, scope, callback) {
    if (typeof callback !== 'function') throw new TypeError('Personal Strategy adoption callback is required');
    if (!isCurrent(candidate, scope)) return false;
    callback();
    return true;
  }

  return Object.freeze({
    schemaVersion: PERSONAL_STRATEGY_SCOPE_LIFECYCLE_VERSION,
    activate,
    revise,
    invalidate,
    capture,
    isCurrent,
    adopt,
    getGeneration: () => generation,
  });
}
