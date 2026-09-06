import {
  EQUITY_ERROR_CODES,
  createEquityFailure,
} from '../../../shared/poker-domain/index.js';
import { EQUITY_WORKER_MESSAGES } from './equity-worker-runtime.mjs';
import { createEquityProgressTracker } from './equity-progress.mjs';
import { calculateEquityRequest, estimateEquityRequest } from './advanced-equity-dispatch.mjs';

function defaultSeedSource() {
  if (globalThis.crypto?.getRandomValues) {
    const value = new Uint32Array(1);
    globalThis.crypto.getRandomValues(value);
    return value[0];
  }
  return Date.now() >>> 0;
}

function defaultWorkerFactory() {
  if (typeof Worker !== 'function') return null;
  return new Worker(new URL('./equity-worker.mjs', import.meta.url), { type: 'module' });
}

function requestWithSeed(request, seedSource) {
  if (request?.seed !== undefined && request?.seed !== null) return request;
  return { ...request, seed: seedSource() >>> 0 };
}

export function createEquityController({
  workerFactory = defaultWorkerFactory,
  seedSource = defaultSeedSource,
  calculateInProcess = calculateEquityRequest,
} = {}) {
  let worker = null;
  let workerUnavailable = false;
  let sequence = 0;
  let currentRequestId = null;
  const pending = new Map();
  const inProcessControllers = new Map();

  const settleAllWithError = (message) => {
    const result = createEquityFailure(EQUITY_ERROR_CODES.INTERNAL_ERROR, message);
    for (const entry of pending.values()) entry.resolve(result);
    pending.clear();
    currentRequestId = null;
  };

  const ensureWorker = () => {
    if (worker || workerUnavailable) return worker;
    try {
      worker = workerFactory();
    } catch {
      worker = null;
    }
    if (!worker) {
      workerUnavailable = true;
      return null;
    }
    worker.onmessage = (event) => {
      const message = event?.data;
      const entry = pending.get(message?.requestId);
      if (!entry) return;
      if (message.type === EQUITY_WORKER_MESSAGES.PROGRESS) {
        if (!entry.cancelled) entry.onProgress?.(message.progress);
      } else if (message.type === EQUITY_WORKER_MESSAGES.RESULT) {
        pending.delete(message.requestId);
        if (currentRequestId === message.requestId) currentRequestId = null;
        entry.resolve(entry.cancelled ? createEquityFailure(EQUITY_ERROR_CODES.ABORTED, 'Equity calculation was cancelled') : message.result);
      }
    };
    worker.onerror = (event) => {
      settleAllWithError(event?.message || 'Equity worker failed');
      worker?.terminate?.();
      worker = null;
      workerUnavailable = true;
    };
    return worker;
  };

  const controller = {
    estimate(request) {
      return estimateEquityRequest(request);
    },

    calculate(request, { onProgress = null } = {}) {
      if (currentRequestId !== null) controller.cancel(currentRequestId);
      const requestId = `equity-${++sequence}`;
      currentRequestId = requestId;
      const seededRequest = requestWithSeed(request, seedSource);
      const estimate = estimateEquityRequest(seededRequest);
      const progressTracker = seededRequest.schemaVersion !== 'equity-request/v1'
        ? Object.freeze({ start() {}, update: progress => onProgress?.(progress) }) : estimate.ok
        ? createEquityProgressTracker({ request: seededRequest, estimate, onProgress })
        : Object.freeze({ start() {}, update() {} });
      progressTracker.start();
      const activeWorker = ensureWorker();

      if (activeWorker) {
        return new Promise((resolve) => {
          pending.set(requestId, {
            resolve,
            onProgress: progressTracker.update,
            cancelled: false,
          });
          try {
            activeWorker.postMessage({
              type: EQUITY_WORKER_MESSAGES.CALCULATE,
              requestId,
              request: seededRequest,
            });
          } catch (error) {
            pending.delete(requestId);
            if (currentRequestId === requestId) currentRequestId = null;
            resolve(createEquityFailure(
              EQUITY_ERROR_CODES.INTERNAL_ERROR,
              error instanceof Error ? error.message : String(error),
            ));
          }
        });
      }

      const abortController = new AbortController();
      const inProcessEntry = { abortController, cancelled: false };
      inProcessControllers.set(requestId, inProcessEntry);
      let calculation;
      try {
        calculation = calculateInProcess(seededRequest, {
          signal: abortController.signal,
          onProgress(progress) {
            if (!inProcessEntry.cancelled) progressTracker.update(progress);
          },
        });
      } catch (error) {
        calculation = createEquityFailure(
          EQUITY_ERROR_CODES.INTERNAL_ERROR,
          error instanceof Error ? error.message : String(error),
        );
      }
      return Promise.resolve(calculation)
        .then(result => inProcessEntry.cancelled ? createEquityFailure(EQUITY_ERROR_CODES.ABORTED, 'Equity calculation was cancelled') : result)
        .catch((error) => createEquityFailure(
          EQUITY_ERROR_CODES.INTERNAL_ERROR,
          error instanceof Error ? error.message : String(error),
        ))
        .finally(() => {
          inProcessControllers.delete(requestId);
          if (currentRequestId === requestId) currentRequestId = null;
        });
    },

    cancel(requestId = currentRequestId) {
      if (requestId === null) return false;
      if (worker && pending.has(requestId)) {
        const entry = pending.get(requestId);
        entry.cancelled = true;
        if (currentRequestId === requestId) currentRequestId = null;
        try {
          worker.postMessage({ type: EQUITY_WORKER_MESSAGES.CANCEL, requestId });
          return true;
        } catch (error) {
          pending.delete(requestId);
          entry?.resolve(createEquityFailure(
            EQUITY_ERROR_CODES.INTERNAL_ERROR,
            error instanceof Error ? error.message : String(error),
          ));
          return false;
        }
      }
      const inProcessEntry = inProcessControllers.get(requestId);
      if (inProcessEntry) {
        inProcessEntry.cancelled = true;
        if (currentRequestId === requestId) currentRequestId = null;
        inProcessEntry.abortController.abort();
        return true;
      }
      return false;
    },

    getCurrentRequestId() {
      return currentRequestId;
    },

    isWorkerBacked() {
      return Boolean(worker);
    },

    dispose() {
      controller.cancel();
      worker?.terminate?.();
      worker = null;
      workerUnavailable = true;
      settleAllWithError('Equity controller was disposed');
    },
  };

  return Object.freeze(controller);
}
