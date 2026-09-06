import { freezeLanguageData as freeze } from './natural-language-envelope.mjs';
import { createTrainingMemoryPresentationGate } from './training-memory-presentation.mjs';
import { deriveTrainingSchedulingProposal } from './training-intelligence.mjs';
import { projectReviewPatterns } from './decision-delta.mjs';

const reasonMap = { manual_review: 'review_later', manual_difficult: 'difficult',
  manual_important: 'important', manual_my_mistake: 'user_marked_mistake',
  user_uncertain_requested_revisit: 'uncertain', normative_remediation: 'normative_remediation' };

export function projectStudyInbox({ training = [], saved = [], conflicts = [], unavailable = [], now = new Date() } = {}) {
  const items = [];
  const savedById = new Map(saved.map(object => [object.id, object]));
  for (const { item, session } of training) {
    if (!session || session.id !== item.record.sessionId || !item.due
      || !createTrainingMemoryPresentationGate(session).revealReviewReasons) continue;
    const record = item.record;
    const reasons = item.reasons.filter(code => reasonMap[code]).map(code => reasonMap[code]);
    if (!reasons.length) continue;
    const proposal = deriveTrainingSchedulingProposal(record, now);
    items.push({ id: `training:${record.id}`, owner: 'training_memory', source: record.id,
      reasons: ['due_review', ...reasons], priority: 100, ownerPriority: item.priority,
      dueAt: item.dueAt, context: record.decisionContext,
      title: { street: record.decisionContext.street, position: record.decisionContext.heroPosition },
      destination: { kind: 'training', recordId: record.id, handoff: proposal?.due ? proposal.handoff : null },
      sourceFacts: { sessionId: record.sessionId, mode: record.mode, lifecycle: item.lifecycleState } });
  }
  for (const object of savedById.values()) {
    if (object.lifecycle.state !== 'active' || !['hand', 'spot'].includes(object.kind)
      || object.annotations.reviewState === 'resolved') continue;
    const review = object.annotations.reviewState === 'review_later';
    items.push({ id: `saved:${object.id}`, owner: 'saved_study_objects', source: object.id,
      title: object.annotations.title, reasons: [review ? 'review_later' : 'saved_study'], priority: review ? 90 : 10,
      ownerPriority: 0, dueAt: null, context: object.payload.decisionContext ?? null,
      destination: { kind: 'saved', objectId: object.id },
      sourceFacts: { source: object.source, handReference: object.payload.handReference ?? null,
        importProvenance: object.payload.importProvenance
          ?? savedById.get(object.payload.handReference?.savedHandObjectId)?.payload.importProvenance ?? null,
        reviewState: object.annotations.reviewState } });
  }
  for (const conflict of conflicts) items.push({ id: `personal:${conflict.id}`, owner: 'personal_strategy',
    source: conflict.id, title: conflict.handClass, context: conflict.context, reasons: ['personal_conflict'],
    priority: 60, ownerPriority: 0, dueAt: null, destination: { kind: 'personal' },
    sourceFacts: { scope: conflict.scope, evidenceIds: conflict.evidenceIds } });
  const ordered = items.sort((a, b) => b.priority - a.priority
    || (Date.parse(a.dueAt) || 0) - (Date.parse(b.dueAt) || 0)
    || b.ownerPriority - a.ownerPriority || a.id.localeCompare(b.id));
  return freeze(structuredClone({ schemaVersion: 'study-inbox/v1', policy: 'study-next/v1',
    persistence: 'projection_only', coverage: 'bounded_loaded_items', unavailable,
    recommendation: ordered[0] ?? null, items: ordered, patterns: projectReviewPatterns(ordered) }));
}

// All readers are existing owner-scoped APIs. The outer lifecycle fence prevents
// mixed-owner aggregation even when one owner finishes its read after a switch.
export function createStudyInboxReader({ captureScope, memory, saved, readConflicts = async () => [], clock = () => new Date() }) {
  return Object.freeze({ async load() {
    const scope = await captureScope(); scope.assertCurrent();
    const results = await Promise.allSettled([
      (async () => {
        const due = await memory().listDueReview({ limit: 25 }); scope.assertCurrent();
        const sessions = new Map();
        for (const id of new Set(due.map(item => item.record.sessionId))) {
          sessions.set(id, await memory().getSession(id)); scope.assertCurrent();
        }
        return due.map(item => ({ item, session: sessions.get(item.record.sessionId) }));
      })(),
      (async () => {
        const [review, recent] = await Promise.all([saved().listForReview({ limit: 25 }), saved().listRecent({ limit: 25 })]);
        scope.assertCurrent(); return [...review, ...recent];
      })(),
      readConflicts(scope),
    ]);
    scope.assertCurrent();
    const names = ['training_memory', 'saved_study_objects', 'personal_strategy'];
    return projectStudyInbox({ training: results[0].status === 'fulfilled' ? results[0].value : [],
      saved: results[1].status === 'fulfilled' ? results[1].value : [],
      conflicts: results[2].status === 'fulfilled' ? results[2].value : [],
      unavailable: results.flatMap((result, i) => result.status === 'rejected' ? [names[i]] : []), now: clock() });
  } });
}
