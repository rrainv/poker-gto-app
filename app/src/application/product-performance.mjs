export const PRODUCT_PERFORMANCE_SCHEMA_VERSION = 'product-performance/v1';

export function createLatestFrameScheduler({ requestFrame, cancelFrame, run } = {}) {
  if (typeof requestFrame !== 'function' || typeof cancelFrame !== 'function') {
    throw new TypeError('Frame scheduler requires requestFrame and cancelFrame functions');
  }
  if (typeof run !== 'function') throw new TypeError('Frame scheduler requires a run function');

  let frameHandle = null;
  let hasPendingValue = false;
  let latestValue;

  function executePending() {
    if (!hasPendingValue) return undefined;
    const value = latestValue;
    hasPendingValue = false;
    latestValue = undefined;
    return run(value);
  }

  return Object.freeze({
    schedule(value) {
      latestValue = value;
      hasPendingValue = true;
      if (frameHandle !== null) return;
      frameHandle = requestFrame(() => {
        frameHandle = null;
        executePending();
      });
    },

    flush() {
      if (frameHandle === null) return undefined;
      cancelFrame(frameHandle);
      frameHandle = null;
      return executePending();
    },

    cancel() {
      if (frameHandle !== null) cancelFrame(frameHandle);
      frameHandle = null;
      hasPendingValue = false;
      latestValue = undefined;
    },

    isPending() {
      return frameHandle !== null;
    },
  });
}

export function createSurfaceInvalidator({ surfaceNames, isVisible, render } = {}) {
  const names = Array.isArray(surfaceNames) ? [...new Set(surfaceNames)] : [];
  if (names.length === 0 || names.some((name) => typeof name !== 'string' || !name)) {
    throw new TypeError('Surface invalidator requires non-empty string surfaceNames');
  }
  if (typeof isVisible !== 'function' || typeof render !== 'function') {
    throw new TypeError('Surface invalidator requires isVisible and render functions');
  }

  const allowed = new Set(names);
  const dirty = new Set(names);

  function requireName(name) {
    if (!allowed.has(name)) throw new RangeError(`Unknown invalidation surface: ${name}`);
  }

  return Object.freeze({
    mark(surfaceNamesToMark = names) {
      const requested = Array.isArray(surfaceNamesToMark)
        ? surfaceNamesToMark
        : [surfaceNamesToMark];
      requested.forEach((name) => {
        requireName(name);
        dirty.add(name);
      });
    },

    renderIfNeeded(name) {
      requireName(name);
      if (!dirty.has(name) || !isVisible(name)) return false;
      render(name);
      dirty.delete(name);
      return true;
    },

    isDirty(name) {
      requireName(name);
      return dirty.has(name);
    },

    dirtySurfaces() {
      return names.filter((name) => dirty.has(name));
    },
  });
}

export function installProductPerformanceBridge(browserWindow) {
  if (!browserWindow) return null;
  const bridge = Object.freeze({
    schemaVersion: PRODUCT_PERFORMANCE_SCHEMA_VERSION,
    createLatestFrameScheduler,
    createSurfaceInvalidator,
  });
  Object.defineProperty(browserWindow, 'RiverlineProductPerformance', {
    configurable: false,
    enumerable: false,
    value: bridge,
    writable: false,
  });
  return bridge;
}

if (typeof window !== 'undefined') installProductPerformanceBridge(window);
