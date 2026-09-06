import {
  HAND_REVIEW_FRAME_CONVENTION,
  HAND_REVIEW_SCHEMA_VERSION,
  HAND_REVIEW_SOURCES,
  createHandReviewAnalysisHandoff,
  createHandReviewProjector,
} from './hand-review.mjs';
import { renderExploitReview } from './exploit-review-workspace.mjs';

export function installHandReviewBridge(browserWindow) {
  if (!browserWindow) return null;
  const bridge = Object.freeze({
    schemaVersion: HAND_REVIEW_SCHEMA_VERSION,
    frameConvention: HAND_REVIEW_FRAME_CONVENTION,
    sources: HAND_REVIEW_SOURCES,
    createProjector(options) {
      return createHandReviewProjector(options);
    },
    renderExploitReview,
    createAnalysisHandoff(review, decisionIndex) {
      return createHandReviewAnalysisHandoff(review, decisionIndex);
    },
  });
  Object.defineProperty(browserWindow, 'RiverlineHandReview', {
    configurable: true,
    enumerable: false,
    value: bridge,
    writable: false,
  });
  return bridge;
}

if (typeof window !== 'undefined') installHandReviewBridge(window);
