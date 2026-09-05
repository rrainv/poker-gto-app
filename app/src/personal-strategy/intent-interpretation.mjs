import { createNaturalLanguageEnvelope, freezeLanguageData } from '../application/natural-language-envelope.mjs';

export const PERSONAL_INTENT_INTERPRETATION_VERSION = 'personal-intent-interpretation/v1';
const locale = (language) => ['en', 'ru', 'he'].includes(language) ? language : 'en';
const TOPICS = [
  ['offsuit_boundary', /offsuit|off-suit|разномаст|לא\s+באותו\s+צבע|אוף.?סוט/iu],
  ['suited_boundary', /suited|одномаст|באותו\s+צבע|סוטד/iu],
  ['pair_boundary', /\bpairs?\b|пар[аыу]|זוג/iu],
  ['raise_call_boundary', /3[ -]?bet|three[ -]?bet|трибет|3.?бет|3.?בט/iu],
  ['position_scope', /position|button|позици|баттон|עמדה|כפתור/iu],
  ['stack_scope', /\bshort\b|\bdeep\b|stack|коротк|глубок|стек|קצר|עמוק|סטאק/iu],
];
const NEGATION = /\b(?:not|never|no|don't|doesn't|won't|cannot|can't)\b|(?:^|\s)(?:не|нет|никогда|לא|אין)(?:\s|$)/iu;

// The bounded interpreter preserves entire clauses verbatim. Topic recognition
// only routes clarification; even explicit numbers remain unparsed until the
// user supplies an action through the existing structured action contract.
export function previewPersonalStrategyIntent({ text, language = 'en', scope = {}, statedScope = null } = {}) {
  if (typeof text !== 'string' || !text.trim()) throw new TypeError('An intended-strategy statement is required');
  if (text.length > 4000) throw new RangeError('Intent statement exceeds 4000 characters');
  const originalText = text.trim();
  const clauses = originalText.split(/\s+(?:but|но|אבל)\s+|[;\n]+/iu).map((part) => part.trim()).filter(Boolean);
  const propositions = clauses.map((wording, index) => ({ id: `clause-${index + 1}`,
    kind: 'qualitative_statement', wording, negationPresent: NEGATION.test(wording.replaceAll('’', "'")),
    topic: TOPICS.find(([, pattern]) => pattern.test(wording))?.[0] ?? 'clarify_intent',
    interpretation: { kind: 'verbatim_intent_proposal', text: wording },
    action: null, frequencies: null, precision: 'qualitative', confirmationState: 'provisional' }));
  const unresolvedTerms = ['exact_hand_boundary', 'action_split', 'exact_frequencies'];
  if (/wide|tight|often|usually|weak|aggress|шир|тайт|част|обыч|слаб|агресс|רחב|צר|לרוב|חלש|אגרס/iu.test(originalText)) {
    unresolvedTerms.unshift('qualitative_degree');
  }
  if (statedScope === null) unresolvedTerms.push('statement_scope');
  if (/overfold|too\s+(?:tight|loose)|mistake|ошиб|слишком|перефолд|טעות|יותר\s+מדי/iu.test(originalText)) unresolvedTerms.push('self_assessment_not_validated');
  if (/\b(?:played|folded|called|yesterday|observed)\b|вчера|сыграл|наблюд|אתמול|שיחקתי/iu.test(originalText)) unresolvedTerms.push('observed_or_intended_role');
  const followupTopic = propositions.find((p) => p.topic !== 'clarify_intent')?.topic ?? 'clarify_intent';
  const envelope = createNaturalLanguageEnvelope({ claimClass: 'user_intent_inference',
    subject: { role: 'personal_intent', id: scope.approachId ?? scope.modeId ?? null },
    evidenceRefs: ['current-user-statement'], scope, uncertainty: unresolvedTerms,
    basis: 'provisional', wordingStrength: 'provisional', facts: { propositions } });
  return freezeLanguageData(structuredClone({ schemaVersion: PERSONAL_INTENT_INTERPRETATION_VERSION,
    originalText, language: locale(language), scope, statedScope, inferredScope: {},
    interpretationMethod: 'verbatim-clauses-topic-routing/v1', confirmationState: 'provisional',
    propositions, unresolvedTerms, followupTopic, envelope }));
}

const COPY = {
  en: { prefix: 'Proposed intended statement', uncertainty: 'Exact hands, actions and frequencies remain unresolved. This preview changes no range.',
    followup: 'Give one exact hand example, or clarify where this statement applies.',
    offsuit: 'Which offsuit hand would help clarify your boundary here?' },
  ru: { prefix: 'Предлагаемая формулировка намерения', uncertainty: 'Точные руки, действия и частоты пока не определены. Этот просмотр не изменяет диапазон.',
    followup: 'Приведите пример конкретной руки или уточните, где действует это намерение.',
    offsuit: 'Какая разномастная рука поможет уточнить вашу границу здесь?' },
  he: { prefix: 'ניסוח מוצע לכוונה', uncertainty: 'הידיים, הפעולות והתדירויות המדויקות עדיין לא נקבעו. התצוגה המקדימה אינה משנה טווח.',
    followup: 'תנו דוגמה ליד מסוימת או הבהירו היכן הכוונה הזאת חלה.',
    offsuit: 'איזו יד אוף־סוט תעזור להבהיר את הגבול שלכם כאן?' },
};

export function renderIntentInterpretation(preview, language = preview?.language) {
  if (preview?.schemaVersion !== PERSONAL_INTENT_INTERPRETATION_VERSION) throw new TypeError('Unsupported intent preview');
  const copy = COPY[locale(language)];
  const selectedLanguage = locale(language);
  const cautions = [copy.uncertainty];
  if (preview.unresolvedTerms.includes('self_assessment_not_validated')) cautions.push({
    en: 'Your self-assessment is quoted as your wording; Riverline has not validated it as a strategic judgment.',
    ru: 'Ваша самооценка сохранена как цитата; Riverline не подтверждает её как стратегическую оценку.',
    he: 'ההערכה העצמית מצוטטת כניסוח שלכם; Riverline לא אימת אותה כשיפוט אסטרטגי.',
  }[selectedLanguage]);
  if (preview.unresolvedTerms.includes('observed_or_intended_role')) cautions.push({
    en: 'Clarify whether this describes what you intend to play or a past action. Only intended strategy belongs here.',
    ru: 'Уточните: это намерение или прошлое действие? Здесь сохраняется только намеренная стратегия.',
    he: 'הבהירו אם זו כוונה למשחק או פעולה מהעבר. כאן נשמרת רק אסטרטגיה מכוונת.',
  }[selectedLanguage]);
  return freezeLanguageData({ statements: preview.propositions.map((p) => `${copy.prefix}: “${p.wording}”`),
    uncertainty: cautions.join(' '), followup: preview.followupTopic === 'offsuit_boundary' ? copy.offsuit : copy.followup });
}
