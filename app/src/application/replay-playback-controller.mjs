export const REPLAY_PLAYBACK_SCHEMA_VERSION = 'replay-playback/v1';
export const REPLAY_PLAYBACK_DELAY_MS = 1050;
export const REPLAY_PLAYBACK_TIMING_POLICY = Object.freeze({
  default: REPLAY_PLAYBACK_DELAY_MS,
  initialization: 950,
  private_deal: 1150,
  private_reveal: 1150,
  action: 1050,
  flop_deal: 1250,
  turn_deal: 1250,
  river_deal: 1250,
  showdown_resolution: 1400,
});

export function replayPlaybackDelayForProjection(
  projection,
  timingPolicy = REPLAY_PLAYBACK_TIMING_POLICY,
) {
  const transitionKind = projection?.selectedFrame?.kind;
  return timingPolicy[transitionKind] || timingPolicy.default;
}

function frozenState({ status, pending, generation, delayMs }) {
  return Object.freeze({
    schemaVersion: REPLAY_PLAYBACK_SCHEMA_VERSION,
    status,
    playing: status === 'playing',
    hasPendingTick: pending,
    generation,
    delayMs,
  });
}

/**
 * Coordinate bounded presentation playback over the existing Replay cursor.
 * The injected advance operation remains the sole historical selection authority.
 */
export function createReplayPlaybackController({
  getProjection,
  advance,
  onAdvance = () => {},
  scheduleTimeout = (callback, delayMs) => globalThis.setTimeout(callback, delayMs),
  clearScheduledTimeout = (handle) => globalThis.clearTimeout(handle),
  delayMs = null,
  getDelayMs = replayPlaybackDelayForProjection,
} = {}) {
  if (typeof getProjection !== 'function' || typeof advance !== 'function') {
    throw new TypeError('Replay playback requires projection and advance functions');
  }
  if (typeof onAdvance !== 'function'
    || typeof scheduleTimeout !== 'function'
    || typeof clearScheduledTimeout !== 'function'
    || typeof getDelayMs !== 'function') {
    throw new TypeError('Replay playback callbacks must be functions');
  }
  if (delayMs !== null && (!Number.isFinite(delayMs) || delayMs <= 0)) {
    throw new RangeError('Replay playback delay must be positive');
  }

  let status = 'idle';
  let timeoutHandle = null;
  let generation = 0;
  let scheduledDelayMs = null;

  const state = () => frozenState({
    status,
    pending: timeoutHandle !== null,
    generation,
    delayMs: scheduledDelayMs,
  });

  const invalidatePendingTick = (nextStatus) => {
    generation += 1;
    if (timeoutHandle !== null) {
      clearScheduledTimeout(timeoutHandle);
      timeoutHandle = null;
    }
    scheduledDelayMs = null;
    status = nextStatus;
  };

  const canAdvance = (projection) => projection?.schemaVersion === 'replay-projection/v1'
    && ['replay', 'saved'].includes(projection.mode)
    && projection.canPlaybackAdvance === true;

  const scheduleNext = () => {
    if (status !== 'playing' || timeoutHandle !== null) return state();
    if (!canAdvance(getProjection())) {
      invalidatePendingTick('paused');
      return state();
    }

    const projection = getProjection();
    const nextDelayMs = delayMs ?? getDelayMs(projection);
    if (!Number.isFinite(nextDelayMs) || nextDelayMs <= 0) {
      throw new RangeError('Replay playback timing policy must return a positive delay');
    }
    const scheduledGeneration = generation;
    scheduledDelayMs = nextDelayMs;
    timeoutHandle = scheduleTimeout(() => {
      timeoutHandle = null;
      scheduledDelayMs = null;
      if (status !== 'playing' || scheduledGeneration !== generation) return;
      if (!canAdvance(getProjection())) {
        invalidatePendingTick('paused');
        return;
      }

      const projection = advance();
      if (!canAdvance(projection)) {
        invalidatePendingTick('paused');
      }
      onAdvance(projection, state());
      if (status === 'playing') scheduleNext();
    }, nextDelayMs);
    return state();
  };

  const controller = {
    start() {
      if (status === 'playing') return state();
      if (!canAdvance(getProjection())) {
        invalidatePendingTick('paused');
        return state();
      }
      invalidatePendingTick('playing');
      return scheduleNext();
    },

    pause() {
      invalidatePendingTick('paused');
      return state();
    },

    cancel() {
      invalidatePendingTick('idle');
      return state();
    },

    scheduleNext,
    getState: state,
  };

  return Object.freeze(controller);
}
