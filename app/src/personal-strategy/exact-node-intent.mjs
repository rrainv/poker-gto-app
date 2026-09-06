import { applyAction, applyPrivateReveal, createAction, getLegalActionSpec,
  getHoldemComboById, getHoldemCombosForHandClass, isHiddenHoleCards } from '../../../shared/poker-domain/index.js';
import { reconstructCanonicalHandReplaySource } from '../application/canonical-hand-replay-source.mjs';
import { deriveDecisionContextFromPokerState } from '../application/decision-context-from-poker-state.mjs';
import { freezeLanguageData as freeze } from '../application/natural-language-envelope.mjs';

export const EXACT_NODE_INTENT_VERSION = 'personal-exact-node-intent/v1';
export const EXACT_RANGE_NODE_VERSION = 'personal-exact-range-node/v1';
export function canonicalIntentContent(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalIntentContent).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonicalIntentContent(value[key])}`).join(',')}}`;
  if (value === undefined || typeof value === 'function' || typeof value === 'symbol'
    || typeof value === 'bigint' || typeof value === 'number' && !Number.isFinite(value)) throw new TypeError('Finite JSON intent data required');
  return JSON.stringify(value);
}
// Compact deterministic content locator, never acceptance/security authority.
// Compatibility also compares canonical content, so a locator collision cannot transfer evidence.
export function exactIntentFingerprint(value) {
  const content = canonicalIntentContent(value); let a = 2166136261, b = 2246822507;
  for (let i = 0; i < content.length; i++) { const c = content.charCodeAt(i); a = Math.imul(a ^ c, 16777619); b = Math.imul(b ^ c, 3266489909); }
  return `personal-intent-content/v1:${(a >>> 0).toString(16)}:${(b >>> 0).toString(16)}:${content.length}`;
}
function signed(value) { return freeze(structuredClone({ ...value, fingerprint: exactIntentFingerprint(value) })); }
function string(value, name) { if (typeof value !== 'string' || !value.trim()) throw new TypeError(`${name} required`); }
function keys(value, fields) {
  if (!value || canonicalIntentContent(Object.keys(value).sort()) !== canonicalIntentContent([...fields].sort())) throw new TypeError('Unsupported or missing exact intent fields');
}
export function exactNodeState(node) { return reconstructCanonicalHandReplaySource(node.replaySource).finalState; }
export function createExactRangeNode({ replaySource } = {}) {
  const reconstruction = reconstructCanonicalHandReplaySource(replaySource), state = reconstruction.finalState;
  if (state.phase !== 'betting' || state.actingPlayerId !== replaySource.heroPlayerId) throw new RangeError('Range node requires the subject decision');
  // This bounded subject-range branch deliberately contains no physical private hand.
  if (reconstruction.frames.some(frame => frame.state.players.some(player => Array.isArray(player.holeCards)))) throw new RangeError('Range node requires hidden private cards throughout its replay');
  if (!state.players.every(player => isHiddenHoleCards(player.holeCards))) throw new RangeError('Range node requires a completed hidden hole deal');
  return signed({ schemaVersion: EXACT_RANGE_NODE_VERSION, derivationVersion: EXACT_RANGE_NODE_VERSION,
    replaySource, handId: state.handId, actorId: state.actingPlayerId, street: state.street,
    board: state.board, deadCards: state.deadCards, history: state.actionHistory,
    decisionContext: null, decisionContextAvailability: 'per_physical_combo',
    branch: 'explicit_hypothetical_personal_range_study' });
}
export function validateExactRangeNode(node) {
  const expected = createExactRangeNode({ replaySource: node?.replaySource });
  if (canonicalIntentContent(node) !== canonicalIntentContent(expected)) throw new RangeError('Stale or incompatible exact range node');
  return node;
}
export function sameExactRangeNode(left, right) { return left?.fingerprint === right?.fingerprint && canonicalIntentContent(left) === canonicalIntentContent(right); }
export function exactComboDecisionContext(node, comboId) {
  const state = exactNodeState(node), combo = getHoldemComboById(comboId);
  return deriveDecisionContextFromPokerState(applyPrivateReveal(state, { playerId: node.actorId, cards: combo.cards }), node.actorId);
}
export function createExactIntentAction(node, type, amountToMilliBb = null) {
  const state = exactNodeState(node), action = createAction(node.actorId, type, amountToMilliBb);
  applyAction(state, action); // Canonical legality and amount alignment; no local poker accounting.
  const legal = getLegalActionSpec(state);
  const amountSemantics = ['bet', 'raise', 'all_in'].includes(type) ? 'street_total_to'
    : type === 'call' ? 'incremental_call' : 'none';
  const amountMilliBb = type === 'all_in' ? legal.allIn.amountToMilliBb
    : type === 'call' ? legal.call.commitMilliBb : amountToMilliBb;
  return freeze({ schemaVersion: 'personal-exact-action/v1', action, amountSemantics, amountMilliBb });
}
export function validateExactIntentAction(node, value) {
  const expected = createExactIntentAction(node, value?.action?.type, value?.action?.amountToMilliBb);
  if (canonicalIntentContent(value) !== canonicalIntentContent(expected)) throw new RangeError('Incompatible exact action/size');
  return value;
}
export const exactActionKey = action => canonicalIntentContent(action);
function normalizedSubject(node, subject) {
  if (subject?.kind === 'combo') {
    keys(subject, ['kind', 'comboId']); const combo = getHoldemComboById(subject.comboId);
    if (combo.cards.some(card => [...node.board, ...node.deadCards].includes(card))) throw new RangeError('Blocked physical combo');
  } else if (subject?.kind === 'hand_class' && node.street === 'preflop') {
    keys(subject, ['kind', 'handClass']); getHoldemCombosForHandClass(subject.handClass);
  } else throw new RangeError('Exact combo required postflop; class expansion is preflop only');
  return subject;
}
export function createExactNodeIntent(input = {}) {
  const { id, profileId, modeId, approachVersion, setupVersion, node, subject, precision,
    distribution = null, preferredAction = null, provenance = { source: 'user_intent' },
    supersedesEvidenceIds = [], createdAt } = input;
  validateExactRangeNode(node); normalizedSubject(node, subject);
  const record = { schemaVersion: EXACT_NODE_INTENT_VERSION, derivationVersion: EXACT_NODE_INTENT_VERSION,
    id, profileId, modeId, approachVersion, setupVersion, node, subject, precision,
    distribution: distribution === null ? null : [...distribution].sort((a, b) => exactActionKey(a.action).localeCompare(exactActionKey(b.action), 'en')),
    preferredAction, provenance, supersedesEvidenceIds: [...supersedesEvidenceIds].sort(), createdAt,
    decisionContext: subject.kind === 'combo' ? exactComboDecisionContext(node, subject.comboId) : null,
    expansion: subject.kind === 'hand_class' ? 'explicit_all_physical_combos_at_this_preflop_node' : 'this_physical_combo_only' };
  const result = signed(record); validateExactNodeIntent(result); return result;
}
export function validateExactNodeIntent(record) {
  keys(record, ['schemaVersion','derivationVersion','id','profileId','modeId','approachVersion','setupVersion','node','subject','precision','distribution','preferredAction','provenance','supersedesEvidenceIds','createdAt','decisionContext','expansion','fingerprint']);
  if (record.schemaVersion !== EXACT_NODE_INTENT_VERSION || record.derivationVersion !== EXACT_NODE_INTENT_VERSION) throw new TypeError('Exact-node intent version required');
  for (const name of ['id','profileId','modeId','createdAt']) string(record[name], name);
  if (!Number.isFinite(Date.parse(record.createdAt))) throw new TypeError('Intent timestamp required');
  for (const name of ['approachVersion','setupVersion']) if (!Number.isSafeInteger(record[name]) || record[name] < 1) throw new RangeError('Intent snapshot version required');
  validateExactRangeNode(record.node); normalizedSubject(record.node, record.subject);
  if (record.provenance?.source !== 'user_intent') throw new RangeError('Personal intended provenance required');
  if (!Array.isArray(record.supersedesEvidenceIds) || new Set(record.supersedesEvidenceIds).size !== record.supersedesEvidenceIds.length) throw new TypeError('Unique correction references required');
  record.supersedesEvidenceIds.forEach(id => { string(id, 'correction reference'); if (id === record.id) throw new RangeError('Self correction'); });
  if (record.precision === 'dominant') {
    if (record.distribution !== null) throw new RangeError('Preferred is not an exact frequency');
    validateExactIntentAction(record.node, record.preferredAction);
  } else if (record.precision === 'exact') {
    if (record.preferredAction !== null || !Array.isArray(record.distribution) || !record.distribution.length) throw new RangeError('Exact mix required');
    const seen = new Set(); let total = 0;
    for (const entry of record.distribution) {
      keys(entry, ['action','probability']); validateExactIntentAction(record.node, entry.action);
      const key = exactActionKey(entry.action);
      if (seen.has(key) || !Number.isFinite(entry.probability) || entry.probability < 0 || entry.probability > 1) throw new RangeError('Invalid exact action frequency');
      seen.add(key); total += entry.probability;
    }
    if (Math.abs(total - 1) > 1e-12) throw new RangeError('Exact action mix must sum to one');
  } else throw new RangeError('Unsupported intended precision');
  const context = record.subject.kind === 'combo' ? exactComboDecisionContext(record.node, record.subject.comboId) : null;
  if (canonicalIntentContent(context) !== canonicalIntentContent(record.decisionContext)) throw new RangeError('Intent DecisionContext mismatch');
  const expansion = record.subject.kind === 'combo' ? 'this_physical_combo_only' : 'explicit_all_physical_combos_at_this_preflop_node';
  if (record.expansion !== expansion) throw new RangeError('Intent scope expansion mismatch');
  const { fingerprint, ...content } = record;
  if (fingerprint !== exactIntentFingerprint(content)) throw new RangeError('Stale exact intent fingerprint');
  return record;
}
export function exactNodeIntentKey(record) {
  return canonicalIntentContent({ profileId: record.profileId, modeId: record.modeId, node: record.node,
    setupVersion: record.setupVersion, approachVersion: record.approachVersion, subject: record.subject });
}
export function exactNodeIntentHeads(records) {
  const superseded = new Set(records.flatMap(record => record.supersedesEvidenceIds));
  return records.filter(record => !superseded.has(record.id));
}
export function validateExactNodeIntentHistory(records) {
  if (!Array.isArray(records)) throw new TypeError('Exact-node history array required');
  records.forEach(validateExactNodeIntent);
  const byId = new Map(records.map(record => [record.id, record]));
  if (byId.size !== records.length) throw new RangeError('Duplicate intent IDs');
  for (const record of records) {
    const visit = (id, seen) => {
      const parent = byId.get(id);
      if (!parent || seen.has(id) || exactNodeIntentKey(parent) !== exactNodeIntentKey(record)
        || Date.parse(parent.createdAt) > Date.parse(record.createdAt)) throw new RangeError('Incompatible exact-node correction history');
      parent.supersedesEvidenceIds.forEach(next => visit(next, new Set([...seen, id])));
    };
    record.supersedesEvidenceIds.forEach(id => visit(id, new Set([record.id])));
  }
  return records;
}
