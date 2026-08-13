const DEFAULT_UPDATE_INTERVAL_MS = 180;
const MIN_RATE_ELAPSED_MS = 750;
const MIN_RATE_COMPLETED = 1_000;
const MIN_ETA_ELAPSED_MS = 1_500;
const MIN_ETA_COMPLETED = 5_000;
const MIN_ETA_FRACTION = 0.03;

function defaultNow() {
  return globalThis.performance?.now?.() ?? Date.now();
}

export function resolveEquityProgressMethod(request, estimate) {
  const fullyKnownRiver = request?.board?.length === 5
    && request?.players?.every((player) => player.cards !== null);
  if (fullyKnownRiver) return 'exact';
  if (request?.method === 'exact' || request?.method === 'monte_carlo') return request.method;
  return estimate?.ok && estimate.exactFeasible ? 'exact' : 'monte_carlo';
}

export function createEquityProgressTracker({
  request,
  estimate,
  onProgress,
  now = defaultNow,
  updateIntervalMs = DEFAULT_UPDATE_INTERVAL_MS,
} = {}) {
  const method = resolveEquityProgressMethod(request, estimate);
  let calculationStartedAt = null;
  let lastEmittedAt = null;
  let started = false;

  const notify = (snapshot) => {
    if (typeof onProgress !== 'function') return;
    try {
      onProgress(Object.freeze(snapshot));
    } catch {
      // Presentation callbacks must not interrupt canonical Equity work.
    }
  };

  const start = () => {
    if (started) return;
    started = true;
    const timestamp = now();
    lastEmittedAt = timestamp;
    notify({
      phase: 'preparing',
      mode: 'indeterminate',
      method,
      completed: 0,
      total: null,
      fraction: null,
      percentage: null,
      throughputPerSecond: null,
      etaSeconds: null,
    });
  };

  const update = (progress) => {
    if (!started) start();
    const completed = Math.max(0, Number(progress?.completed) || 0);
    const total = Math.max(0, Number(progress?.total) || 0);
    const timestamp = now();

    if (calculationStartedAt === null) calculationStartedAt = timestamp;
    if (completed <= 0 || total <= 0) return;

    const fraction = Math.min(1, completed / total);
    const finished = completed >= total;
    if (!finished && lastEmittedAt !== null && timestamp - lastEmittedAt < updateIntervalMs) return;

    const elapsedMs = Math.max(0, timestamp - calculationStartedAt);
    let throughputPerSecond = null;
    let etaSeconds = null;
    if (method === 'monte_carlo'
      && elapsedMs >= MIN_RATE_ELAPSED_MS
      && completed >= MIN_RATE_COMPLETED) {
      throughputPerSecond = completed / (elapsedMs / 1_000);
      if (!finished
        && elapsedMs >= MIN_ETA_ELAPSED_MS
        && completed >= MIN_ETA_COMPLETED
        && fraction >= MIN_ETA_FRACTION
        && throughputPerSecond > 0) {
        etaSeconds = (total - completed) / throughputPerSecond;
      }
    }

    lastEmittedAt = timestamp;
    notify({
      phase: 'calculating',
      mode: 'determinate',
      method,
      completed,
      total,
      fraction,
      percentage: fraction * 100,
      throughputPerSecond,
      etaSeconds,
    });
  };

  return Object.freeze({ method, start, update });
}

export const EQUITY_PROGRESS_RULES = Object.freeze({
  updateIntervalMs: DEFAULT_UPDATE_INTERVAL_MS,
  minRateElapsedMs: MIN_RATE_ELAPSED_MS,
  minRateCompleted: MIN_RATE_COMPLETED,
  minEtaElapsedMs: MIN_ETA_ELAPSED_MS,
  minEtaCompleted: MIN_ETA_COMPLETED,
  minEtaFraction: MIN_ETA_FRACTION,
});
