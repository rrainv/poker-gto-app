import {
  createTrainingMemoryOwnerResolver,
  createTrainingMemoryService,
} from './training-memory-service.mjs';
import { createTrainingMemoryPresentationGate } from './training-memory-presentation.mjs';
import { deriveTrainingSchedulingProposal } from './training-intelligence.mjs';

const pendingBridgeInstalls = new WeakMap();

function clearPendingBridgeInstall(browserWindow) {
  const pending = pendingBridgeInstalls.get(browserWindow);
  if (!pending) return;
  browserWindow.removeEventListener?.('riverline:authchange', pending.retry);
  browserWindow.removeEventListener?.('riverline:identitychange', pending.retry);
  pendingBridgeInstalls.delete(browserWindow);
}

function retryTrainingMemoryBridgeInstall(browserWindow, options) {
  if (!browserWindow?.addEventListener || pendingBridgeInstalls.has(browserWindow)) return;
  const retry = () => {
    if (installTrainingMemoryBridge(browserWindow, options)) {
      clearPendingBridgeInstall(browserWindow);
    }
  };
  pendingBridgeInstalls.set(browserWindow, { retry });
  browserWindow.addEventListener('riverline:authchange', retry);
  browserWindow.addEventListener('riverline:identitychange', retry);
}

export function installTrainingMemoryBridge(browserWindow, options = {}) {
  if (!browserWindow) return null;
  if (browserWindow.RiverlineTrainingMemory) {
    clearPendingBridgeInstall(browserWindow);
    return browserWindow.RiverlineTrainingMemory;
  }
  const identityProvider = options.identityProvider ?? browserWindow.RiverlineAccountIdentity;
  const authentication = options.authentication ?? browserWindow.RiverlineAuthentication;
  if (!identityProvider?.getActiveIdentity || !authentication?.getState) {
    retryTrainingMemoryBridgeInstall(browserWindow, options);
    return null;
  }
  const ownerProvider = options.ownerProvider ?? createTrainingMemoryOwnerResolver({
    authentication,
    identityProvider,
  });
  const service = options.service ?? createTrainingMemoryService({
    ownerProvider,
    database: options.database,
    repositoryFactory: options.repositoryFactory,
    clock: options.clock,
    idFactory: options.idFactory,
    generateSimilarExercise: options.generateSimilarExercise,
  });
  const bridge = Object.freeze({
    schemaVersion: 'training-memory-bridge/v1',
    startSession: (input) => service.startSession(input),
    finishSession: (sessionId, status, finishOptions) => (
      service.finishSession(sessionId, status, finishOptions)
    ),
    recordExerciseShown: (input) => service.recordExerciseShown(input),
    recordExerciseAnswered: (input) => service.recordExerciseAnswered(input),
    requestUncertainRevisit: (recordId) => service.requestUncertainRevisit(recordId),
    listLearningRevisits: () => service.listLearningRevisits(),
    changeLearningRevisit: (handoff, action) => service.changeLearningRevisit(handoff, action),
    learningProposal: (record) => deriveTrainingSchedulingProposal(record),
    recordFullHandDecisionShown: (input) => service.recordFullHandDecisionShown(input),
    recordFullHandDecisionAnswered: (input) => service.recordFullHandDecisionAnswered(input),
    updateStudyMetadata: (recordId, changes) => service.updateStudyMetadata(recordId, changes),
    markReviewed: (recordId) => service.markReviewed(recordId),
    reviewAgain: (recordId) => service.reviewAgain(recordId),
    snooze: (recordId, days) => service.snooze(recordId, days),
    getDecision: (recordId) => service.getDecision(recordId),
    getSession: (sessionId) => service.getSession(sessionId),
    listRecentSessions: (queryOptions) => service.listRecentSessions(queryOptions),
    listSessionDecisions: (sessionId, queryOptions) => (
      service.listSessionDecisions(sessionId, queryOptions)
    ),
    listDueReview: (queryOptions) => service.listDueReview(queryOptions),
    createPresentationGate: (session, gateOptions) => (
      createTrainingMemoryPresentationGate(session, gateOptions)
    ),
    createSameSpot: (recordId, sameOptions) => service.createSameSpot(recordId, sameOptions),
    generateSimilarSpot: (recordId, generateOptions) => (
      service.generateSimilarSpot(recordId, generateOptions)
    ),
    getOwnerState: () => ownerProvider.getState?.() ?? null,
  });
  Object.defineProperty(browserWindow, 'RiverlineTrainingMemory', {
    configurable: true,
    enumerable: false,
    value: bridge,
    writable: false,
  });
  clearPendingBridgeInstall(browserWindow);
  browserWindow.dispatchEvent?.(new Event('riverline:trainingmemoryready'));
  return bridge;
}

if (typeof window !== 'undefined') installTrainingMemoryBridge(window);
