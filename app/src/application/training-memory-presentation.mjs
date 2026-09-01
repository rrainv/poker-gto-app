export const TRAINING_MEMORY_PRESENTATION_GATE_SCHEMA_VERSION =
  'training-memory-presentation-gate/v1';

export function createTrainingMemoryPresentationGate(session, { fullHandReviewUnlocked = false } = {}) {
  const feedbackEmbargoed = session?.mode === 'full_hand'
    && session?.status === 'active'
    && fullHandReviewUnlocked !== true;
  return Object.freeze({
    schemaVersion: TRAINING_MEMORY_PRESENTATION_GATE_SCHEMA_VERSION,
    feedbackEmbargoed,
    revealAnswerAndReference: !feedbackEmbargoed,
    revealReviewReasons: !feedbackEmbargoed,
    revealSessionVerdict: !feedbackEmbargoed,
  });
}
