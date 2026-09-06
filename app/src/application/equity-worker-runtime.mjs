import {
  EQUITY_ERROR_CODES,
  createEquityFailure,
} from '../../../shared/poker-domain/index.js';
import { calculateEquityRequest } from './advanced-equity-dispatch.mjs';

export const EQUITY_WORKER_MESSAGES = Object.freeze({
  CALCULATE: 'equity/calculate',
  CANCEL: 'equity/cancel',
  PROGRESS: 'equity/progress',
  RESULT: 'equity/result',
});

export function createEquityWorkerMessageHandler({
  postMessage,
  calculate = calculateEquityRequest,
  AbortControllerClass = AbortController,
} = {}) {
  if (typeof postMessage !== 'function') throw new TypeError('postMessage is required');
  const active = new Map();

  return async function handleEquityWorkerMessage(eventOrData) {
    const message = eventOrData?.data ?? eventOrData;
    if (!message || typeof message !== 'object') return;

    if (message.type === EQUITY_WORKER_MESSAGES.CANCEL) {
      active.get(message.requestId)?.abort();
      return;
    }
    if (message.type !== EQUITY_WORKER_MESSAGES.CALCULATE) return;

    const requestId = message.requestId;
    if (typeof requestId !== 'string' || !requestId) {
      postMessage({
        type: EQUITY_WORKER_MESSAGES.RESULT,
        requestId: requestId ?? null,
        result: createEquityFailure(
          EQUITY_ERROR_CODES.INVALID_REQUEST,
          'Worker requestId must be a non-empty string',
        ),
      });
      return;
    }

    active.get(requestId)?.abort();
    const abortController = new AbortControllerClass();
    active.set(requestId, abortController);
    try {
      const result = await calculate(message.request, {
        signal: abortController.signal,
        onProgress(progress) {
          postMessage({
            type: EQUITY_WORKER_MESSAGES.PROGRESS,
            requestId,
            progress,
          });
        },
      });
      postMessage({ type: EQUITY_WORKER_MESSAGES.RESULT, requestId, result });
    } catch (error) {
      postMessage({
        type: EQUITY_WORKER_MESSAGES.RESULT,
        requestId,
        result: createEquityFailure(
          EQUITY_ERROR_CODES.INTERNAL_ERROR,
          error instanceof Error ? error.message : String(error),
        ),
      });
    } finally {
      if (active.get(requestId) === abortController) active.delete(requestId);
    }
  };
}

export function installEquityWorkerRuntime(workerScope) {
  if (!workerScope || typeof workerScope.postMessage !== 'function') return null;
  const handler = createEquityWorkerMessageHandler({
    postMessage: (message) => workerScope.postMessage(message),
  });
  workerScope.onmessage = handler;
  return Object.freeze({ handler });
}
