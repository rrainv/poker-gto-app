import test from 'node:test';
import assert from 'node:assert/strict';

import {
  FULL_HAND_HEADER_STATES,
  resolveFullHandHeaderState,
} from '../app/src/application/full-hand-header-state.mjs';

// TRAINING-FULLHAND-001 (OWNER_DECISIONS): the workspace header alone names the
// hand's state, and "Hand complete" appears only when the hand really is complete.

const live = (overrides = {}) => resolveFullHandHeaderState({ phase: 'live', ...overrides });

test('before a hand the header says Ready', () => {
  assert.equal(resolveFullHandHeaderState({ phase: 'setup' }).id, FULL_HAND_HEADER_STATES.READY);
  assert.equal(resolveFullHandHeaderState({}).textKey, 'Ready');
});

test('Hero to act, recording, dealing and opponents acting are distinct states', () => {
  assert.equal(live({ snapshotStatus: 'awaiting_hero', lifecycle: 'ready' }).id, 'your_turn');
  assert.equal(live({ snapshotStatus: 'awaiting_hero', lifecycle: 'ready' }).textKey, 'Your turn');
  assert.equal(live({ snapshotStatus: 'grading', lifecycle: 'grading' }).id, 'recording');
  assert.equal(live({ lifecycle: 'generating' }).id, 'dealing');
  assert.equal(live({ snapshotStatus: 'advancing', lifecycle: 'automating' }).id, 'opponents_acting');
});

test('after a Hero fold the live hand reads as watching, never as complete', () => {
  const watching = live({ snapshotStatus: 'advancing', lifecycle: 'automating', heroFolded: true });
  assert.equal(watching.id, 'watching');
  assert.equal(watching.textKey, 'Watching the rest of this hand');
});

test('"Hand complete" only when the canonical hand really ended', () => {
  const finished = resolveFullHandHeaderState({ phase: 'complete', snapshotStatus: 'terminal', handComplete: true });
  assert.equal(finished.id, 'complete');
  assert.equal(finished.textKey, 'Hand complete');
  // Hero folded: opponents are paused, so the hand is NOT complete.
  const folded = resolveFullHandHeaderState({
    phase: 'complete', snapshotStatus: 'hero_complete', handComplete: false, heroFolded: true,
  });
  assert.equal(folded.id, 'hero_folded');
  assert.notEqual(folded.textKey, 'Hand complete');
  // Even a mislabelled hero_complete snapshot never claims completion.
  assert.equal(resolveFullHandHeaderState({ phase: 'complete', snapshotStatus: 'hero_complete', handComplete: true }).id, 'hero_folded');
});

test('review names itself and every state has a translation key', () => {
  assert.equal(resolveFullHandHeaderState({ phase: 'review' }).textKey, 'Post-hand review');
  for (const id of Object.values(FULL_HAND_HEADER_STATES)) {
    const phase = id === 'review' ? 'review' : id === 'complete' ? 'complete' : 'live';
    assert.ok(resolveFullHandHeaderState({ phase, handComplete: id === 'complete', snapshotStatus: id === 'complete' ? 'terminal' : null }).textKey);
  }
});
