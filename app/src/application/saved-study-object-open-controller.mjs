import {
  validateSavedStudyObject,
} from '../saved-study-objects/index.mjs';
import {
  canonicalPokerStatesEqual,
  reconstructCanonicalHandReplaySource,
} from './canonical-hand-replay-source.mjs';

function requireActiveObject(object, id) {
  if (!object || object.id !== id || object.lifecycle?.state !== 'active') {
    throw new RangeError('Saved study item is unavailable');
  }
  validateSavedStudyObject(object);
  return object;
}

export function createSavedStudyObjectOpenController({ application, playbookBridge } = {}) {
  if (!application || typeof application.getById !== 'function') {
    throw new TypeError('Saved Study opener requires the application query boundary');
  }
  if (!playbookBridge || typeof playbookBridge.openSavedHand !== 'function') {
    throw new TypeError('Saved Study opener requires the Playbook bridge');
  }

  return Object.freeze({
    async open(id, { lifecycleScope = null } = {}) {
      lifecycleScope?.assertCurrent();
      if (typeof id !== 'string' || !id) throw new TypeError('Saved study item ID is required');
      const object = requireActiveObject(await application.getById(id, { includeArchived: false }), id);
      lifecycleScope?.assertCurrent();
      if (object.kind === 'hand') {
        const reconstruction = reconstructCanonicalHandReplaySource(object.payload.replaySource);
        if (reconstruction.heroPlayerId !== object.payload.heroPlayerId
          || !canonicalPokerStatesEqual(reconstruction.finalState, object.payload.pokerState)) {
          throw new RangeError('Saved Hand replay reconstruction does not match its canonical snapshot');
        }
        const projection = playbookBridge.openSavedHand({
          objectId: object.id,
          title: object.annotations.title,
          pokerState: object.payload.pokerState,
          heroPlayerId: object.payload.heroPlayerId,
          replaySource: object.payload.replaySource,
          importProvenance: object.payload.importProvenance ?? null,
        });
        if (projection?.schemaVersion !== 'replay-projection/v1'
          || projection?.viewerContext?.kind !== 'saved_hand'
          || projection.readOnly !== true) {
          throw new Error('Saved Hand could not be opened as a read-only Replay');
        }
        return Object.freeze({ kind: 'hand', object, projection });
      }
      if (object.kind === 'spot') {
        return Object.freeze({
          kind: 'spot',
          derivation: object.payload.derivation,
          object,
          scenarioInput: object.payload.scenarioInput,
          decisionContext: object.payload.decisionContext,
          truth: object.payload.truth,
          handReference: object.payload.handReference,
          ...(Object.hasOwn(object.payload, 'rulesSnapshot')
            ? { rulesSnapshot: object.payload.rulesSnapshot }
            : {}),
        });
      }
      throw new RangeError(`Unsupported saved study item kind: ${object.kind}`);
    },
  });
}
