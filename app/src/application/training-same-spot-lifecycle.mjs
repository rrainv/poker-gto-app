export const TRAINING_SAME_SPOT_LIFECYCLE_SCHEMA_VERSION =
  'training-same-spot-lifecycle/v1';

export function createTrainingSameSpotLifecycle() {
  let active = null;

  return Object.freeze({
    schemaVersion: TRAINING_SAME_SPOT_LIFECYCLE_SCHEMA_VERSION,

    begin({ sourceDecisionRecordId } = {}) {
      if (active) throw new RangeError('Same Spot is already active');
      if (typeof sourceDecisionRecordId !== 'string' || !sourceDecisionRecordId) {
        throw new TypeError('Same Spot source decision record ID is required');
      }
      active = {
        sourceDecisionRecordId,
        answered: false,
      };
      return this.getState();
    },

    markAnswered() {
      if (!active) return null;
      active.answered = true;
      return this.getState();
    },

    release() {
      if (!active) return null;
      const released = Object.freeze({
        sourceDecisionRecordId: active.sourceDecisionRecordId,
        answered: active.answered,
      });
      active = null;
      return released;
    },

    getState() {
      if (!active) {
        return Object.freeze({
          schemaVersion: TRAINING_SAME_SPOT_LIFECYCLE_SCHEMA_VERSION,
          active: false,
          answered: false,
          sourceDecisionRecordId: null,
        });
      }
      return Object.freeze({
        schemaVersion: TRAINING_SAME_SPOT_LIFECYCLE_SCHEMA_VERSION,
        active: true,
        answered: active.answered,
        sourceDecisionRecordId: active.sourceDecisionRecordId,
      });
    },
  });
}
