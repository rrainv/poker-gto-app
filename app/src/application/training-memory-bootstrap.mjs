import {
  createTrainingMemoryOwnerResolver,
  createTrainingMemoryService,
} from './training-memory-service.mjs';
import { createTrainingMemoryPresentationGate } from './training-memory-presentation.mjs';

export function installTrainingMemoryBridge(browserWindow, options = {}) {
  if (!browserWindow) return null;
  const identityProvider = options.identityProvider ?? browserWindow.RiverlineAccountIdentity;
  const authentication = options.authentication ?? browserWindow.RiverlineAuthentication;
  if (!identityProvider?.getActiveIdentity || !authentication?.getState) return null;
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
    recordFullHandDecisionShown: (input) => service.recordFullHandDecisionShown(input),
    recordFullHandDecisionAnswered: (input) => service.recordFullHandDecisionAnswered(input),
    updateStudyMetadata: (recordId, changes) => service.updateStudyMetadata(recordId, changes),
    markReviewed: (recordId) => service.markReviewed(recordId),
    reviewAgain: (recordId) => service.reviewAgain(recordId),
    snooze: (recordId, days) => service.snooze(recordId, days),
    getDecision: (recordId) => service.getDecision(recordId),
    listRecentSessions: (queryOptions) => service.listRecentSessions(queryOptions),
    listSessionDecisions: (sessionId, queryOptions) => (
      service.listSessionDecisions(sessionId, queryOptions)
    ),
    listDueReview: (queryOptions) => service.listDueReview(queryOptions),
    createPresentationGate: (session, gateOptions) => (
      createTrainingMemoryPresentationGate(session, gateOptions)
    ),
    createSameSpot: (recordId) => service.createSameSpot(recordId),
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
  return bridge;
}

if (typeof window !== 'undefined') installTrainingMemoryBridge(window);
