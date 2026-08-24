import { createTrainingSessionController } from './training-session-controller.mjs';
import {
  createFullHandTrainingStartConfigurationFromTrainingConfig,
  createFullHandTrainingSessionController,
} from './full-hand-training-session-controller.mjs';
import {
  createTrainingConfigFromLegacyCompatibility,
  resolveTrainingRulesCapability,
} from './training-generator.mjs';
import { createTrainingPresentationModel } from './training-presentation.mjs';
import { createTrainingSessionIntent } from './training-practice-planner.mjs';
import { createTablePresenceViewModel } from './table-presence-view-model.mjs';
import {
  createReplayProjectionController,
  createTablePresenceTransitionMotion,
} from './replay-projection-controller.mjs';
import {
  EXPERIENCE_EVENT_ORIGINS,
  createPokerWorldExperienceEvents,
  installExperienceEventsBridge,
} from './experience-events.mjs';
import { createReplayTimelineViewModel } from './replay-timeline-view-model.mjs';
import {
  TABLE_INTERACTIONS,
  TABLE_PROJECTIONS,
  TABLE_VISUAL_STATES,
  createTablePresentation,
} from './table-presentation.mjs';
import {
  createFullHandTrainingPresentationOrchestrator,
} from './full-hand-training-presentation-orchestrator.mjs';
import {
  createFullHandTrainingSizingModel,
  validateFullHandTrainingSizingInput,
} from './full-hand-training-sizing.mjs';

export const FULL_HAND_TABLE_TRANSITION_PRESENTATION_SCHEMA_VERSION =
  'full-hand-table-transition-presentation/v1';

export function installTrainingModeBridge(browserWindow, {
  controller = createTrainingSessionController(),
  fullHandController = createFullHandTrainingSessionController(),
} = {}) {
  if (!browserWindow) return null;
  const experienceBridge = installExperienceEventsBridge(browserWindow);
  const fullHandReviewReplayController = createReplayProjectionController();
  let fullHandReviewReplayHandId = null;
  const ensureFullHandReviewReplay = () => {
    const review = fullHandController.getReview();
    if (!review || review.status !== 'ready' || !review.replaySource) return null;
    if (fullHandReviewReplayHandId !== review.handId) {
      fullHandReviewReplayController.replaceFromCanonicalHandReplaySource(
        review.replaySource,
        { readOnly: true },
      );
      fullHandReviewReplayHandId = review.handId;
    }
    return fullHandReviewReplayController.getProjection();
  };
  const bridge = Object.freeze({
    createConfigFromLegacyCompatibility(input) {
      return createTrainingConfigFromLegacyCompatibility(input);
    },
    generate(config, options) {
      return controller.generate(config, options);
    },
    replay(config, options) {
      return controller.replay(config, options);
    },
    createPracticeIntent(input) {
      return createTrainingSessionIntent(input);
    },
    resolveRulesCapability(rulesSnapshot) {
      return resolveTrainingRulesCapability(rulesSnapshot);
    },
    startPracticeSession(intent) {
      return controller.startPracticeSession(intent);
    },
    generatePlanned(options) {
      return controller.generatePlanned(options);
    },
    getPracticePlannerState() {
      return controller.getPracticePlannerState();
    },
    createFullHandStartConfiguration(input) {
      return createFullHandTrainingStartConfigurationFromTrainingConfig(input);
    },
    startFullHand(input, options) {
      controller.reset();
      fullHandReviewReplayController.clear();
      fullHandReviewReplayHandId = null;
      return fullHandController.start(input, options);
    },
    answerFullHand(decisionId, actionInput) {
      return fullHandController.answer(decisionId, actionInput);
    },
    advanceFullHandOneEvent() {
      return fullHandController.advanceOneAutomatedEvent();
    },
    getFullHandSnapshot() {
      return fullHandController.getSnapshot();
    },
    getFullHandReview() {
      return fullHandController.getReview();
    },
    getFullHandReviewReplayProjection() {
      return ensureFullHandReviewReplay();
    },
    selectFullHandReviewFrame(frameIndex) {
      if (!ensureFullHandReviewReplay()) return null;
      return fullHandReviewReplayController.selectFrame(frameIndex);
    },
    previousFullHandReviewFrame() {
      if (!ensureFullHandReviewReplay()) return null;
      return fullHandReviewReplayController.previous();
    },
    nextFullHandReviewFrame() {
      if (!ensureFullHandReviewReplay()) return null;
      return fullHandReviewReplayController.next();
    },
    returnFullHandReviewToEndpoint() {
      if (!ensureFullHandReviewReplay()) return null;
      return fullHandReviewReplayController.returnToEndpoint();
    },
    getFullHandSizingModel() {
      const snapshot = fullHandController.getSnapshot();
      return snapshot?.status === 'awaiting_hero' && snapshot.currentDecision
        ? createFullHandTrainingSizingModel(snapshot.state)
        : null;
    },
    validateFullHandSizingInput(actionType, inputValue) {
      const snapshot = fullHandController.getSnapshot();
      return snapshot?.status === 'awaiting_hero' && snapshot.currentDecision
        ? validateFullHandTrainingSizingInput(snapshot.state, actionType, inputValue)
        : null;
    },
    createFullHandTablePresence(snapshot = fullHandController.getSnapshot()) {
      return createTablePresenceViewModel({
        state: snapshot?.state ?? null,
        heroPlayerId: snapshot?.heroPlayerId ?? null,
      });
    },
    createFullHandTablePresentation(snapshot = fullHandController.getSnapshot(), {
      review = false,
      submissionLocked = false,
      tablePresence: suppliedTablePresence = null,
    } = {}) {
      const reviewReplayProjection = review ? ensureFullHandReviewReplay() : null;
      const tablePresence = reviewReplayProjection?.tablePresence
        || suppliedTablePresence
        || createTablePresenceViewModel({
          state: snapshot?.state ?? null,
          heroPlayerId: snapshot?.heroPlayerId ?? null,
        });
      const terminal = snapshot?.status === 'terminal' || tablePresence.status === 'terminal';
      const heroDecision = snapshot?.status === 'awaiting_hero' && snapshot.currentDecision;
      const projection = review || terminal ? TABLE_PROJECTIONS.REVIEW : TABLE_PROJECTIONS.PLAY;
      const visualState = review
        ? TABLE_VISUAL_STATES.POST_HAND_REVIEW
        : terminal
          ? TABLE_VISUAL_STATES.HAND_COMPLETE
          : heroDecision
            ? TABLE_VISUAL_STATES.LIVE_DECISION
            : TABLE_VISUAL_STATES.ACTION_RESOLUTION;
      const interaction = review
        ? TABLE_INTERACTIONS.REPLAY
        : heroDecision
          ? TABLE_INTERACTIONS.DECISION
          : TABLE_INTERACTIONS.PASSIVE;
      const legalActionSpec = heroDecision ? snapshot.currentDecision.legalActions : null;
      return createTablePresentation({
        projection,
        visualState,
        interaction,
        tablePresence,
        timeline: reviewReplayProjection?.timeline || (snapshot?.state
          ? createReplayTimelineViewModel({
            state: snapshot.state,
            heroPlayerId: snapshot.heroPlayerId,
          })
          : null),
        legalActionSpec,
        chipUnitMilliBb: snapshot?.state?.game?.chipUnitMilliBb ?? null,
        submissionLocked,
      });
    },
    createFullHandTableTransition({
      previousSnapshot,
      snapshot: nextSnapshot,
      event,
      token,
      motionEnabled = true,
    } = {}) {
      const tablePresence = createTablePresenceViewModel({
        state: nextSnapshot?.state ?? null,
        heroPlayerId: nextSnapshot?.heroPlayerId ?? null,
      });
      const previousTablePresence = previousSnapshot?.state
        ? createTablePresenceViewModel({
          state: previousSnapshot.state,
          heroPlayerId: previousSnapshot.heroPlayerId,
        })
        : null;
      const transitionMotion = previousTablePresence && event
        ? createTablePresenceTransitionMotion({
          previousTablePresence,
          tablePresence,
          token,
          transitionKind: event.transitionKind,
          actorPlayerId: event.actor?.playerId ?? null,
          actionType: event.chosenAction?.type ?? null,
          wasAllIn: event.chosenAction?.type === 'all_in',
          boardCards: event.boardCardIds ?? [],
        })
        : null;
      if (transitionMotion && event) {
        experienceBridge.emitBatch(createPokerWorldExperienceEvents({
          origin: EXPERIENCE_EVENT_ORIGINS.LIVE,
          source: `${nextSnapshot?.state?.handId || 'training_full_hand'}:training`,
          token,
          operation: event.transitionKind === 'action' ? 'action' : null,
          transitionKind: event.transitionKind,
          motion: transitionMotion,
          previousState: previousSnapshot?.state ?? null,
          state: nextSnapshot?.state ?? null,
          actorPlayerId: event.actor?.playerId ?? null,
          actionType: event.chosenAction?.type ?? null,
          boardCardIds: event.boardCardIds ?? [],
          holeCardCount: event.transitionKind === 'private_deal'
            ? nextSnapshot?.state?.players?.length * 2
            : null,
        }));
      }
      return Object.freeze({
        schemaVersion: FULL_HAND_TABLE_TRANSITION_PRESENTATION_SCHEMA_VERSION,
        tablePresence,
        motion: motionEnabled ? transitionMotion : null,
      });
    },
    createFullHandPresentationOrchestrator(options) {
      return createFullHandTrainingPresentationOrchestrator(options);
    },
    createFullHandAnalysisHandoff(decisionOrdinal) {
      return fullHandController.createAnalysisHandoff(decisionOrdinal);
    },
    resetFullHand() {
      fullHandReviewReplayController.clear();
      fullHandReviewReplayHandId = null;
      return fullHandController.reset();
    },
    answer(exerciseId, chosenActionType) {
      return controller.answer(exerciseId, chosenActionType);
    },
    getSnapshot() {
      return controller.getSnapshot();
    },
    reset() {
      fullHandReviewReplayController.clear();
      fullHandReviewReplayHandId = null;
      fullHandController.reset();
      return controller.reset();
    },
  });
  Object.defineProperty(browserWindow, 'RiverlineTraining', {
    configurable: true,
    enumerable: false,
    value: bridge,
    writable: false,
  });
  return bridge;
}

export function installTrainingPresentationBridge(browserWindow) {
  if (!browserWindow) return null;
  const bridge = Object.freeze({
    createViewModel(exercise) {
      return createTrainingPresentationModel(exercise);
    },
  });
  Object.defineProperty(browserWindow, 'RiverlineTrainingPresentation', {
    configurable: true,
    enumerable: false,
    value: bridge,
    writable: false,
  });
  return bridge;
}

if (typeof window !== 'undefined') {
  installTrainingModeBridge(window);
  installTrainingPresentationBridge(window);
}
