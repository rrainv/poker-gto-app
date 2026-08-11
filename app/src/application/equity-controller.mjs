import {
  EQUITY_ERROR_CODES,
  calculateEquity,
  createEquityFailure,
} from '../../../shared/poker-domain/index.js';
import { EQUITY_WORKER_MESSAGES } from './equity-worker-runtime.mjs';

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
  calculateInProcess = calculateEquity,
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
        entry.onProgress?.(message.progress);
      } else if (message.type === EQUITY_WORKER_MESSAGES.RESULT) {
        pending.delete(message.requestId);
        if (currentRequestId === message.requestId) currentRequestId = null;
        entry.resolve(message.result);
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
    calculate(request, { onProgress = null } = {}) {
      if (currentRequestId !== null) controller.cancel(currentRequestId);
      const requestId = `equity-${++sequence}`;
      currentRequestId = requestId;
      const seededRequest = requestWithSeed(request, seedSource);
      const activeWorker = ensureWorker();

      if (activeWorker) {
        return new Promise((resolve) => {
          pending.set(requestId, { resolve, onProgress });
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
      inProcessControllers.set(requestId, abortController);
      let calculation;
      try {
        calculation = calculateInProcess(seededRequest, {
          signal: abortController.signal,
          onProgress,
        });
      } catch (error) {
        calculation = createEquityFailure(
          EQUITY_ERROR_CODES.INTERNAL_ERROR,
          error instanceof Error ? error.message : String(error),
        );
      }
      return Promise.resolve(calculation)
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
        try {
          worker.postMessage({ type: EQUITY_WORKER_MESSAGES.CANCEL, requestId });
          return true;
        } catch (error) {
          const entry = pending.get(requestId);
          pending.delete(requestId);
          if (currentRequestId === requestId) currentRequestId = null;
          entry?.resolve(createEquityFailure(
            EQUITY_ERROR_CODES.INTERNAL_ERROR,
            error instanceof Error ? error.message : String(error),
          ));
          return false;
        }
      }
      const abortController = inProcessControllers.get(requestId);
      if (abortController) {
        abortController.abort();
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
