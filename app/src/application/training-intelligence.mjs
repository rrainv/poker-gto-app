import { validateTrainingDecisionRecord } from '../training-memory/domain.mjs';
import { UNCERTAIN_REVISIT_POLICY_VERSION } from '../training-memory/learning-evidence.mjs';
import { historicalStrategyTruth } from './strategy-truth.mjs';

export function deriveTrainingLearningEligibility(record) {
  validateTrainingDecisionRecord(record);
  const truth = historicalStrategyTruth(record.strategyEvidence);
  return Object.freeze({ schemaVersion: 'training-learning-eligibility/v1', truthState: truth.state,
    userRequestedRevisit: Boolean(record.studyMetadata.review || record.studyMetadata.difficult || record.learningEvidence?.revisitRequest),
    uncertaintyRevisit: Boolean(record.learningEvidence?.uncertainty && record.learningEvidence?.revisitRequest),
    heuristicComparison: truth.state === 'heuristic_comparison',
    acceptedReferenceComparison: truth.claims.reference,
    remediation: truth.state === 'normative_assessment' && truth.learningEligibility.remediation,
    retention: false, transfer: false,
  });
}

export function deriveTrainingRevisitEligibility(record) {
  validateTrainingDecisionRecord(record);
  const eligible = record.status === 'answered'
    && record.decisionSource.kind === 'generated_exercise'
    && record.learningEvidence?.uncertainty?.value === 'uncertain'
    && record.learningEvidence?.revisitRequest?.policyVersion === UNCERTAIN_REVISIT_POLICY_VERSION;
  return Object.freeze({
    schemaVersion: 'training-revisit-eligibility/v1',
    eligible,
    reasonCodes: eligible ? ['user_uncertain_requested_revisit'] : [],
    allowedRevisitKinds: eligible ? ['exact_same_spot'] : [],
    evidenceRefs: [record.id],
    unavailableReasons: eligible ? [] : ['explicit_uncertain_revisit_required'],
    assessmentAvailability: 'unavailable',
    learningEligibility: deriveTrainingLearningEligibility(record),
  });
}

export function deriveTrainingSchedulingProposal(record, now = new Date()) {
  const eligibility = deriveTrainingRevisitEligibility(record);
  if (!eligibility.eligible || !['pending', 'snoozed'].includes(record.reviewState.state)) return null;
  const dueAt = record.reviewState.dueAt;
  if (!dueAt) return null;
  const request = record.learningEvidence.revisitRequest;
  return Object.freeze({
    schemaVersion: 'training-scheduling-proposal/v1',
    proposalId: `${record.id}:${request.requestedAt}:${dueAt}`,
    decisionRecordId: record.id,
    ownerRef: Object.freeze({ ...record.ownerRef }),
    policyVersion: request.policyVersion,
    dueAt,
    due: Date.parse(dueAt) <= new Date(now).getTime(),
    revisitKind: 'exact_same_spot',
    reasonCodes: eligibility.reasonCodes,
    evidenceRefs: eligibility.evidenceRefs,
    handoff: Object.freeze({
      schemaVersion: 'training-learning-handoff/v1',
      kind: 'exact_same_spot',
      sourceDecisionRecordId: record.id,
      requestedAt: request.requestedAt,
      dueAt,
    }),
    limitations: ['learning_assessment_unavailable', 'bounded_memory_page'],
  });
}

export function projectTrainingRevisits(records, now = new Date()) {
  return records.map((record) => deriveTrainingSchedulingProposal(record, now))
    .filter((proposal) => proposal?.due)
    .sort((left, right) => left.dueAt.localeCompare(right.dueAt)
      || left.decisionRecordId.localeCompare(right.decisionRecordId));
}

export function requireTrainingRevisitProposal(record, handoff, now = new Date()) {
  if (!handoff || handoff.schemaVersion !== 'training-learning-handoff/v1' || handoff.kind !== 'exact_same_spot'
    || Object.keys(handoff).sort().join('|') !== ['schemaVersion', 'kind', 'sourceDecisionRecordId', 'requestedAt', 'dueAt'].sort().join('|')) {
    throw new TypeError('Unsupported Training learning handoff');
  }
  const proposal = deriveTrainingSchedulingProposal(record, now);
  if (!proposal || handoff.sourceDecisionRecordId !== record.id
    || handoff.requestedAt !== proposal.handoff.requestedAt || handoff.dueAt !== proposal.dueAt) {
    throw new RangeError('The revisit request changed; reopen it from review.');
  }
  return proposal;
}
