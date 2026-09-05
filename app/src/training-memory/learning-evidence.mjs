export const TRAINING_LEARNING_DECISION_VERSION = 'training-decision-record/v1.1';
export const TRAINING_LEARNING_EVIDENCE_VERSION = 'training-learning-evidence/v1';
export const UNCERTAIN_REVISIT_POLICY_VERSION = 'uncertain-exact-revisit/v1';

function exact(value, keys) {
  if (!value || typeof value !== 'object' || Array.isArray(value)
    || Object.keys(value).sort().join('|') !== [...keys].sort().join('|')) {
    throw new TypeError('Incompatible Training learning evidence');
  }
}

function timestamp(value) {
  if (typeof value !== 'string' || !Number.isFinite(Date.parse(value))
    || new Date(value).toISOString() !== value) throw new TypeError('Invalid learning timestamp');
}

export function emptyTrainingLearningEvidence() {
  return {
    schemaVersion: TRAINING_LEARNING_EVIDENCE_VERSION,
    uncertainty: null,
    revisitRequest: null,
    revisit: null,
  };
}

export function validateTrainingLearningEvidence(evidence, record) {
  exact(evidence, ['schemaVersion', 'uncertainty', 'revisitRequest', 'revisit']);
  if (evidence.schemaVersion !== TRAINING_LEARNING_EVIDENCE_VERSION) {
    throw new TypeError('Unsupported Training learning evidence version');
  }
  if (evidence.uncertainty !== null) {
    exact(evidence.uncertainty, ['value', 'phase', 'capturedAt']);
    const { value, phase, capturedAt } = evidence.uncertainty;
    timestamp(capturedAt);
    if (value !== 'uncertain' || phase !== 'before_reveal' || record.status !== 'answered'
      || Date.parse(capturedAt) > Date.parse(record.answeredAt)
      || !['varied', 'focused'].includes(record.mode)
      || record.decisionSource.kind !== 'generated_exercise'
      || record.decisionSource.redrillKind !== null) {
      throw new TypeError('Uncertainty requires an ordinary pre-reveal answer');
    }
    // The UI capture may precede a queued shown write; persistence time is not exposure time.
  }
  if (evidence.revisitRequest !== null) {
    exact(evidence.revisitRequest, ['requestedAt', 'policyVersion']);
    timestamp(evidence.revisitRequest.requestedAt);
    if (!evidence.uncertainty
      || evidence.revisitRequest.policyVersion !== UNCERTAIN_REVISIT_POLICY_VERSION
      || Date.parse(evidence.revisitRequest.requestedAt) < Date.parse(record.answeredAt)) {
      throw new TypeError('A revisit request requires answered uncertainty');
    }
  }
  if (evidence.revisit !== null) {
    exact(evidence.revisit, ['sourceDecisionRecordId', 'requestedAt', 'dueAt', 'startedAt']);
    const revisit = evidence.revisit;
    for (const key of ['requestedAt', 'dueAt', 'startedAt']) timestamp(revisit[key]);
    if (typeof revisit.sourceDecisionRecordId !== 'string' || !revisit.sourceDecisionRecordId
      || revisit.sourceDecisionRecordId !== record.decisionSource.parentDecisionRecordId
      || record.decisionSource.redrillKind !== 'same_spot' || record.mode !== 'review') {
      throw new TypeError('A revisit must reference its exact Same Spot parent');
    }
  }
  return evidence;
}

export function withTrainingLearningEvidence(record) {
  return {
    ...structuredClone(record),
    schemaVersion: TRAINING_LEARNING_DECISION_VERSION,
    learningEvidence: structuredClone(record.learningEvidence ?? emptyTrainingLearningEvidence()),
  };
}
