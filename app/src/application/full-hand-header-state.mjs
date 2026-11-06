// TRAINING-FULLHAND-001: the one place that names a Full Hand's state for the
// workspace HEADER (OWNER_DECISIONS: the header alone shows the hand's state;
// badges add only extra information; "Hand complete" only when the hand really
// is complete). Pure: input is what logic.js already knows, output is the
// translation key of the state text and a stable state id.

export const FULL_HAND_HEADER_STATE_SCHEMA_VERSION = 'full-hand-header-state/v1';

export const FULL_HAND_HEADER_STATES = Object.freeze({
  READY: 'ready',
  DEALING: 'dealing',
  YOUR_TURN: 'your_turn',
  RECORDING: 'recording',
  OPPONENTS_ACTING: 'opponents_acting',
  HERO_FOLDED: 'hero_folded',
  WATCHING: 'watching',
  COMPLETE: 'complete',
  REVIEW: 'review',
});

const TEXT_KEYS = Object.freeze({
  ready: 'Ready',
  dealing: 'Dealing',
  your_turn: 'Your turn',
  recording: 'Recording your decision',
  opponents_acting: 'Opponents are acting',
  hero_folded: 'You folded. Opponents are paused',
  watching: 'Watching the rest of this hand',
  complete: 'Hand complete',
  review: 'Post-hand review',
});

/**
 * @param {object} input
 * @param {string} input.phase        'setup' | 'live' | 'complete' | 'review' | 'off'
 * @param {string|null} input.snapshotStatus  canonical snapshot status
 * @param {string|null} input.lifecycle       app.training.lifecycle
 * @param {boolean} input.heroFolded
 * @param {boolean} input.handComplete        the canonical hand reached its end
 */
export function resolveFullHandHeaderState({
  phase = 'off', snapshotStatus = null, lifecycle = null, heroFolded = false, handComplete = false,
} = {}) {
  let id = FULL_HAND_HEADER_STATES.READY;
  if (phase === 'review') id = FULL_HAND_HEADER_STATES.REVIEW;
  else if (phase === 'complete') {
    // "Hand complete" only when the canonical hand ended; a Hero fold pauses the rest.
    id = handComplete && snapshotStatus !== 'hero_complete'
      ? FULL_HAND_HEADER_STATES.COMPLETE
      : FULL_HAND_HEADER_STATES.HERO_FOLDED;
  } else if (phase === 'live') {
    if (snapshotStatus === 'awaiting_hero' && lifecycle === 'ready') id = FULL_HAND_HEADER_STATES.YOUR_TURN;
    else if (lifecycle === 'grading') id = FULL_HAND_HEADER_STATES.RECORDING;
    else if (lifecycle === 'generating') id = FULL_HAND_HEADER_STATES.DEALING;
    else id = heroFolded ? FULL_HAND_HEADER_STATES.WATCHING : FULL_HAND_HEADER_STATES.OPPONENTS_ACTING;
  }
  return Object.freeze({ id, textKey: TEXT_KEYS[id] });
}
