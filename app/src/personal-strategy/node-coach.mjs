import { createNaturalLanguageEnvelope, freezeLanguageData as freeze } from '../application/natural-language-envelope.mjs';
import { EXACT_RANGE_NODE_VERSION, validateExactRangeNode } from './exact-node-intent.mjs';

export const NODE_COACH_VERSION = 'personal-node-coach/v1';
export const NODE_COACH_HANDOFF_VERSION = 'personal-node-coach-request/v1';

const dependencies = ['handFacts', 'heroWeightedRange', 'opponentWeightedRange', 'opponentResponsePolicy',
  'acceptedReference', 'equityWhenCalled', 'rangeEvolution', 'normativeAssessment'];
// These requirements describe the stronger strategic claim, not the question.
// Reference comparison and normative assessment are independent permission paths.
const conceptDefinitions = [
  ['value', ['handFacts', 'heroWeightedRange', 'opponentWeightedRange', 'opponentResponsePolicy', 'equityWhenCalled', 'rangeEvolution']],
  ['thin_value', ['handFacts', 'heroWeightedRange', 'opponentWeightedRange', 'opponentResponsePolicy', 'equityWhenCalled', 'rangeEvolution']],
  ['when_not_to_bet', ['handFacts', 'heroWeightedRange', 'opponentWeightedRange', 'opponentResponsePolicy', 'equityWhenCalled', 'rangeEvolution']],
  ['semibluff', ['handFacts', 'heroWeightedRange', 'opponentWeightedRange', 'opponentResponsePolicy', 'equityWhenCalled', 'rangeEvolution']],
  ['bluff', ['handFacts', 'heroWeightedRange', 'opponentWeightedRange', 'opponentResponsePolicy', 'rangeEvolution']],
  ['bluff_catch', ['handFacts', 'heroWeightedRange', 'opponentWeightedRange', 'opponentResponsePolicy', 'equityWhenCalled', 'rangeEvolution']],
  ['blocker_quality', ['handFacts', 'opponentWeightedRange', 'opponentResponsePolicy', 'rangeEvolution']],
  ['check_raise', ['handFacts', 'heroWeightedRange', 'opponentWeightedRange', 'opponentResponsePolicy', 'equityWhenCalled', 'rangeEvolution']],
  ['small_block_bet', ['handFacts', 'heroWeightedRange', 'opponentWeightedRange', 'opponentResponsePolicy', 'equityWhenCalled', 'rangeEvolution']],
  ['polarization', ['handFacts', 'heroWeightedRange', 'opponentWeightedRange', 'opponentResponsePolicy', 'rangeEvolution']],
  ['value_bluff_composition', ['handFacts', 'heroWeightedRange', 'opponentWeightedRange', 'opponentResponsePolicy', 'equityWhenCalled', 'rangeEvolution']],
  ['exploit', ['handFacts', 'heroWeightedRange', 'opponentWeightedRange', 'opponentResponsePolicy', 'equityWhenCalled', 'rangeEvolution']],
  ['scare_card', ['handFacts', 'heroWeightedRange', 'rangeEvolution']],
  ['multiway', ['handFacts', 'opponentResponsePolicy']],
];
const permissions = Object.freeze({ normative: false, comparison: false, wholeRangeFrequency: false,
  representativeImpliesRegion: false, assessment: 'none', criterion: 'exact_node_evidence_questions/v1' });
const countKeys = ['eligibleCombos', 'knownPositiveCombos', 'unknownReachCombos', 'mappedCombos', 'exactCombos',
  'dominantCombos', 'conflictingCombos', 'unknownPolicyCombos', 'blockedCombos'];
const regionCountKeys = ['eligibleCombos', 'mappedCombos', 'exactCombos', 'dominantCombos', 'unknownPolicyCombos'];
function stable(value) {
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stable(value[key])}`).join(',')}}`;
  return JSON.stringify(value);
}
function counts(source, keys) {
  return Object.fromEntries(keys.map((key) => {
    if (!Number.isInteger(source?.[key]) || source[key] < 0) throw new TypeError(`Invalid node study count: ${key}`);
    if (key !== 'blockedCombos' && key !== 'eligibleCombos' && source[key] > source.eligibleCombos) {
      throw new RangeError(`Node study count exceeds eligible combinations: ${key}`);
    }
    return [key, source[key]];
  }));
}

/** Read-only projection: no provider, evaluator, Equity, inference or persistence calls. */
export function createNodeCoach({ studyFacts, node, approachSnapshot } = {}) {
  const comboContext = node?.schemaVersion === EXACT_RANGE_NODE_VERSION
    && node.decisionContext === null && node.decisionContextAvailability === 'per_physical_combo';
  if (comboContext) validateExactRangeNode(node);
  if (!studyFacts?.fingerprint || !node?.fingerprint || (!node.decisionContext && !comboContext)
    || !['flop', 'turn', 'river'].includes(node.street) || !Array.isArray(node.board)
    || !approachSnapshot || typeof approachSnapshot !== 'object') throw new TypeError('Exact node, study facts and Approach snapshot required');
  if (!Array.isArray(studyFacts.regions) || !Array.isArray(studyFacts.evidenceRefs)
    || studyFacts.evidenceRefs.some((ref) => typeof ref !== 'string' || !ref)) throw new TypeError('Inspectable node study facts required');
  // Only consume the declared projection. Extraneous input (including private
  // opponent data and caller-supplied permission flags) never enters the coach.
  const facts = { ...counts(studyFacts, countKeys), regions: studyFacts.regions.map((region) => {
    if (typeof region.id !== 'string' || !region.id) throw new TypeError('Region identity required');
    return { id: region.id, ...counts(region, regionCountKeys) };
  }), evidenceRefs: [...new Set(studyFacts.evidenceRefs)].sort(), fingerprint: studyFacts.fingerprint };
  for (const key of ['structuralTransitionCombos', 'missedDrawCombos', 'intentWithoutKnownReachCombos']) {
    const value = studyFacts[key] ?? 0;
    if (!Number.isInteger(value) || value < 0 || value > facts.eligibleCombos) throw new RangeError('Invalid contextual study count');
    facts[key] = value;
  }
  const scope = { nodeFingerprint: node.fingerprint, street: node.street, board: [...node.board],
    decisionContextAvailability: comboContext ? 'per_physical_combo' : 'supplied',
    approachSnapshot: structuredClone(approachSnapshot) };
  const evidenceRefs = [...new Set([`node-study:${facts.fingerprint}`, `node:${node.fingerprint}`, ...facts.evidenceRefs])];
  const uncertainty = ['representative_answers_are_not_region_policy',
    ...(facts.unknownReachCombos ? ['partial_reach'] : []), ...(facts.unknownPolicyCombos ? ['partial_node_policy'] : []),
    ...(facts.dominantCombos ? ['exact_frequency_unknown'] : []), ...(facts.conflictingCombos ? ['conflicting_intent'] : [])];
  const subject = { role: 'personal_intended' };
  const opportunities = [];
  function add(kind, region = null, conceptId = null) {
    opportunities.push({ schemaVersion: 'personal-node-coaching-opportunity/v1',
      id: `${kind}:${region?.id ?? conceptId ?? 'node'}`, kind, conceptId, subject, scope,
      evidenceRefs, evidenceFingerprint: facts.fingerprint, region, coverage: facts, uncertainty, permissions,
      reason: kind, allowedTeachingActions: ['teach_riverline', 'concept_lesson'],
      observation: { source: 'exact_node_study_facts', evidenceFingerprint: facts.fingerprint, coverage: facts },
      assumption: { kind: 'fixed_opponent_actions', normativeHeroTruth: false },
      suggestion: { kind: 'personal_intent_question', conceptId, assessment: 'none' },
      normativeClaimPermission: false,
      unavailableReasons: ['normative_assessment_unavailable', 'representative_not_full_range'],
      envelope: createNaturalLanguageEnvelope({ claimClass: 'interpretive', subject, scope, evidenceRefs,
        uncertainty, permission: permissions, derivation: { version: NODE_COACH_VERSION, criterion: permissions.criterion },
        facts: { kind, conceptId, region, coverage: facts } }) });
  }
  for (const region of facts.regions.filter((item) => item.unknownPolicyCombos > 0).slice(0, 2)) add('unmapped_postflop_region', region);
  if (facts.dominantCombos) add('mixed_frequency_ambiguity');
  if (facts.conflictingCombos) add('internal_inconsistency');
  if (facts.unknownPolicyCombos) {
    add('uncertain_value_boundary', null, 'thin_value');
    add('uncertain_bluff_boundary', null, 'bluff');
    add('small_bet_gap', null, 'small_block_bet');
    add('check_raise_gap', null, 'check_raise');
    if (node.street === 'river') add('river_bluff_catch_boundary', null, 'bluff_catch');
  }
  if (facts.dominantCombos) add('sizing_ambiguity', null, 'small_block_bet');
  if (facts.structuralTransitionCombos > 0) add('scare_card_reasoning', null, 'scare_card');
  const dealtPlayers = new Set(node.history?.map(entry => entry.playerId) ?? []);
  for (const entry of node.history ?? []) if (entry.submittedAction?.type === 'fold') dealtPlayers.delete(entry.playerId);
  if (dealtPlayers.size > 2 && facts.unknownPolicyCombos) add('multiway_continuation_gap', null, 'multiway');
  if (facts.unknownReachCombos && facts.mappedCombos) add('action_conditioned_range_uncertainty', null, 'when_not_to_bet');
  if (facts.intentWithoutKnownReachCombos) add('action_conditioned_range_inconsistency', null, 'when_not_to_bet');
  // Missing frequency is a propagation limitation, not a strategic defect.
  if (node.street !== 'river' && (facts.unknownPolicyCombos || facts.dominantCombos || facts.conflictingCombos || facts.unknownReachCombos)) {
    add('turn_river_continuation_gap');
  }
  const availability = { handFacts: 'available', heroWeightedRange: 'partial', rangeEvolution: 'partial',
    opponentWeightedRange: 'unavailable', opponentResponsePolicy: 'unavailable', acceptedReference: 'unavailable',
    equityWhenCalled: 'unavailable', normativeAssessment: 'unavailable' };
  const concepts = conceptDefinitions.map(([id, required]) => ({ id,
    question: { availability: 'available', requires: ['handFacts'], permission: 'reasoning_question_only' },
    strongerClaim: { availability: 'unavailable', missing: required.filter((key) => availability[key] !== 'available'),
      reason: 'stronger_claim_dependencies_missing' },
    dependencies: Object.fromEntries(dependencies.map((key) => [key, { required: required.includes(key), availability: availability[key],
      purpose: key === 'acceptedReference' ? 'reference_comparison_only' : key === 'normativeAssessment' ? 'normative_verdict_only' : 'strategic_claim' }])),
    referenceComparison: { availability: 'unavailable', requires: ['acceptedReference'] },
    normativeAssessment: { availability: 'unavailable', requires: ['normativeAssessment'] }, permissions }));
  // The practical first question does not label any hand as value or bluff.
  add('value_targeting_question', null, 'value');
  const result = { schemaVersion: NODE_COACH_VERSION, subject, scope, studyFacts: facts, evidenceRefs,
    evidenceFingerprint: facts.fingerprint, uncertainty, opportunities, concepts, permissions };
  return freeze({ ...result, fingerprint: `${NODE_COACH_VERSION}:${stable(result)}` });
}

const destinations = {
  teach_riverline: null, concept_lesson: null, matrix: 'matrix_preflop_only',
  same_spot: 'training_memory_record_required', similar_spot: 'planner_node_target_unsupported',
  controlled_perturbation: 'planner_node_target_unsupported', full_hand: 'full_hand_transfer_unsupported',
};
export function createNodeCoachHandoff(coach, destination) {
  if (coach?.schemaVersion !== NODE_COACH_VERSION) throw new TypeError('Node Coach required');
  if (!Object.hasOwn(destinations, destination)) throw new RangeError('Unsupported node Coach destination');
  const reason = destinations[destination];
  return freeze(structuredClone({ schemaVersion: NODE_COACH_HANDOFF_VERSION, destination,
    availability: reason ? 'unavailable' : 'available', unavailableReason: reason,
    scope: coach.scope, nodeFingerprint: coach.scope.nodeFingerprint, evidenceFingerprint: coach.evidenceFingerprint,
    coachFingerprint: coach.fingerprint, evidenceRefs: coach.evidenceRefs, assessment: 'none',
    intent: 'personal_intent', generatorOwner: 'canonical_training',
    target: { kind: 'exact_node_study', nodeFingerprint: coach.scope.nodeFingerprint },
    permissions: coach.permissions }));
}
export function assertNodeCoachHandoffCurrent(request, coach) {
  if (request?.schemaVersion !== NODE_COACH_HANDOFF_VERSION || coach?.schemaVersion !== NODE_COACH_VERSION) {
    throw new TypeError('Node Coach request and current Coach required');
  }
  if (request.coachFingerprint !== coach.fingerprint || request.nodeFingerprint !== coach.scope.nodeFingerprint
    || request.evidenceFingerprint !== coach.evidenceFingerprint || stable(request.scope) !== stable(coach.scope)) {
    throw new RangeError('stale_node_coach_request');
  }
  return request;
}

const copy = {
  en: {
    summary: 'Your answers describe this exact board and action history. A representative answer applies only to its stated combinations.',
    coverage: '{mapped}/{eligible} eligible combinations have mapped intent: {exact} exact, {dominant} preferred only, {conflicting} conflicting. {unknownPolicy} have unknown policy; {unknownReach} have unknown reach weight. {positive} have known positive reach. Board removal blocks {blocked} combinations.',
    regionCoverage: '{mapped}/{eligible} combinations mapped; {unknownPolicy} still have unknown policy.',
    partial: 'The known portion remains partial. Unknown weight is not treated as zero or normalized away.',
    exact: 'Intent precision and reach weight are separate. Even a mapped preference does not supply an exact action frequency.',
    change: 'Change one explicit assumption, then study that new context separately.',
    next: 'Teach one eligible combination at this node.', conceptNext: 'State your assumption before choosing an action.',
    conceptWhy: 'A clear purpose connects the action to the response you expect.',
    unavailable: 'A stronger conclusion needs additional evidence; this question does not grade your answer.',
    kinds: {
      unmapped_postflop_region: ['Some eligible combinations are still unmapped.', 'One example can clarify your intention without filling the whole region.', 'What do you intend with the next eligible combination at this exact node?', 'Record its exact action and size; leave unanswered combinations unknown.'],
      mixed_frequency_ambiguity: ['Some answers state a preference without an exact mix.', 'A preferred bet does not say how often you make it.', 'Do you intend a specific mix, or only a preferred action?', 'Keep the preference as it is unless you want to teach exact frequencies.'],
      internal_inconsistency: ['Some active answers conflict at this node.', 'Conflicting intent cannot supply a single action frequency.', 'Has your intention changed, or do the answers describe different conditions?', 'Inspect the original answers and correct the intended one; history remains intact.'],
      turn_river_continuation_gap: ['Part of the next action range is still unknown.', 'Public cards alone cannot show which hands took this exact action.', 'Which combinations take this size, and how often?', 'Continue only the quantitatively known portion; missing reach or action frequency remains unknown.'],
    },
    concepts: {
      scare_card: ['New-card reasoning', 'Which hands that reached this street actually improve?', 'Use the incoming action-conditioned range and structural transitions. A scary-looking card does not prove a strategic advantage.'],
      multiway: ['Multiway continuation', 'Who is still left to act?', 'Account for every remaining opponent before stating a response assumption.'],
      value: ['Value targeting', 'Which worse hands do you expect to call?', 'A value target needs an explicit calling assumption; a pair alone does not establish it.'],
      thin_value: ['Thin value', 'Which weaker calls remain at this size, and what is your plan against a raise?', 'The value boundary depends on the calling range and size.'],
      when_not_to_bet: ['When to check', 'What does betting gain compared with checking?', 'Name the intended benefit before assuming betting is better.'],
      semibluff: ['Draw aggression', 'Which better hands might fold, and how can your hand improve?', 'A draw alone does not establish a profitable semibluff.'],
      bluff: ['Bluff candidates', 'Which better hands are you trying to fold?', 'Name a plausible fold target before treating a combination as a bluff.'],
      bluff_catch: ['Bluff catching', 'Which bluffs can realistically reach this river?', 'Reachable bluffs need the earlier action path and an explicit opponent policy.'],
      blocker_quality: ['Blocker quality', 'Which part of the opponent’s response range does this card remove?', 'Removal matters only in relation to a stated calling, folding or raising range.'],
      check_raise: ['Check-raise plan', 'Which hands do you expect the opponent to bet when checked to?', 'A check-raise plan needs an explicit betting assumption.'],
      small_block_bet: ['Small-bet purpose', 'Which worse hands call this size, and how will you respond to a raise?', 'A small bet is not automatically value or protection.'],
      polarization: ['Range shape', 'Which hands bet for calls, which target folds, and which check?', 'Structural hand categories alone cannot establish polarization.'],
      value_bluff_composition: ['Value and bluff composition', 'Which combinations target worse calls and which target better folds?', 'Composition needs exact frequencies and explicit response partitions.'],
      exploit: ['Opponent-specific adjustment', 'Which stated opponent response would make you change your plan?', 'An exploit claim requires a supported response model and suitable comparison authority.'],
    },
    reasons: { matrix_preflop_only: 'Matrix precision editing currently supports preflop classes.', training_memory_record_required: 'Same Spot needs an existing Training Memory decision record.', planner_node_target_unsupported: 'The Training planner does not support this exact node target.', full_hand_transfer_unsupported: 'Full Hand transfer from node study is not available.' },
    destinationLabels: ['Teach this node', 'Concept lesson', 'Matrix precision', 'Same Spot', 'Similar Spot', 'Controlled variation', 'Full Hand Training'],
    dependencyLabels: ['Current Hand facts', 'Hero weighted range', 'Opponent weighted range', 'Opponent response policy', 'Accepted reference', 'Equity when called', 'Range Evolution', 'Normative assessment authority'],
    statuses: { available: 'Available', partial: 'Partial', unavailable: 'Unavailable' },
  },
  ru: {
    summary: 'Ответы относятся к этой точной доске и истории действий. Ответ на пример относится только к указанным комбинациям.',
    coverage: 'Намерения заданы для {mapped}/{eligible} доступных комбинаций: {exact} точно, {dominant} только предпочтение, {conflicting} с противоречиями. Для {unknownPolicy} неизвестна политика; для {unknownReach} неизвестен вес достижения узла. У {positive} известен положительный вес. Доска блокирует {blocked} комбинаций.',
    regionCoverage: 'Задано {mapped}/{eligible} комбинаций; для {unknownPolicy} политика ещё неизвестна.',
    partial: 'Известная часть остаётся неполной. Неизвестный вес не считается нулём и не исчезает при нормализации.',
    exact: 'Точность намерения и вес достижения узла различаются. Даже заданное предпочтение не определяет точную частоту действия.',
    change: 'Измените одно явное предположение и изучайте новый контекст отдельно.',
    next: 'Задайте намерение для одной доступной комбинации в этом узле.', conceptNext: 'Сформулируйте предположение до выбора действия.',
    conceptWhy: 'Понятная цель связывает действие с ожидаемым ответом соперника.',
    unavailable: 'Для более сильного вывода нужны дополнительные данные; этот вопрос не оценивает правильность ответа.',
    kinds: {
      unmapped_postflop_region: ['Часть доступных комбинаций ещё не описана.', 'Один пример уточняет намерение, но не заполняет весь регион.', 'Что вы намерены делать со следующей доступной комбинацией в этом узле?', 'Укажите точное действие и размер; неописанные комбинации останутся неизвестными.'],
      mixed_frequency_ambiguity: ['Некоторые ответы задают предпочтение без точного микса.', 'Предпочтение ставки не определяет её частоту.', 'Вы хотите задать точный микс или только предпочтительное действие?', 'Сохраните предпочтение, если не хотите указывать точные частоты.'],
      internal_inconsistency: ['Некоторые действующие ответы в этом узле противоречат друг другу.', 'Противоречивые намерения не дают единой частоты действия.', 'Ваше намерение изменилось или ответы относятся к разным условиям?', 'Изучите исходные ответы и внесите исправление; история сохранится.'],
      turn_river_continuation_gap: ['Часть диапазона после следующего действия ещё неизвестна.', 'Одни общие карты не показывают, какие руки выбрали это точное действие.', 'Какие комбинации выбирают этот размер и с какой частотой?', 'Продолжайте только количественно известную часть; неизвестный вес или частота останутся неизвестными.'],
    },
    concepts: {
      scare_card: ['Новая карта', 'Какие руки, дошедшие до этой улицы, действительно улучшаются?', 'Опирайтесь на входящий диапазон и изменения структуры. Страшная карта сама по себе не доказывает преимущество.'],
      multiway: ['Продолжение в мультипоте', 'Кому ещё предстоит действовать?', 'Учтите каждого оставшегося соперника, прежде чем формулировать предположение об ответе.'],
      value: ['Цель ставки на вэлью', 'От каких худших рук вы ожидаете колл?', 'Для вэлью нужно явное предположение о коллах; одной пары недостаточно.'],
      thin_value: ['Тонкое вэлью', 'Какие худшие руки коллируют этот размер и каков ваш план против рейза?', 'Граница вэлью зависит от диапазона колла и размера ставки.'],
      when_not_to_bet: ['Когда чекать', 'Что ставка даёт по сравнению с чеком?', 'Назовите цель, прежде чем считать ставку лучшим действием.'],
      semibluff: ['Агрессия с дро', 'Какие лучшие руки могут сбросить и как ваша рука может усилиться?', 'Наличие дро само по себе не доказывает прибыльность полублефа.'],
      bluff: ['Кандидаты в блеф', 'Какие лучшие руки вы пытаетесь выбить?', 'Назовите реалистичную цель фолда, прежде чем считать комбинацию блефом.'],
      bluff_catch: ['Блеф-кетч', 'Какие блефы реально могут дойти до этого ривера?', 'Для достижимых блефов нужны предыдущие действия и явная политика соперника.'],
      blocker_quality: ['Качество блокеров', 'Какую часть диапазона ответа соперника убирает эта карта?', 'Удаление комбинаций значимо относительно заданного диапазона колла, фолда или рейза.'],
      check_raise: ['План чек-рейза', 'От каких рук соперника вы ожидаете ставку после чека?', 'План чек-рейза требует явного предположения о ставках соперника.'],
      small_block_bet: ['Цель небольшой ставки', 'Какие худшие руки коллируют этот размер и что вы сделаете против рейза?', 'Небольшая ставка не становится автоматически вэлью или защитой.'],
      polarization: ['Структура диапазона', 'Какие руки ставят ради колла, какие — ради фолда, а какие чекают?', 'Одни категории рук не устанавливают поляризацию.'],
      value_bluff_composition: ['Соотношение вэлью и блефов', 'Какие комбинации ждут колла от худших рук, а какие — фолда от лучших?', 'Для состава нужны точные частоты и явные группы ответов соперника.'],
      exploit: ['Подстройка под соперника', 'Какой явно заданный ответ соперника изменит ваш план?', 'Вывод об эксплойте требует обоснованной модели ответов и подходящего основания для сравнения.'],
    },
    reasons: { matrix_preflop_only: 'Точное редактирование матрицы пока поддерживает префлоп-классы.', training_memory_record_required: 'Для той же ситуации нужна существующая запись решения в памяти тренировки.', planner_node_target_unsupported: 'Планировщик тренировок не поддерживает цель в виде этого точного узла.', full_hand_transfer_unsupported: 'Перенос изучения узла в тренировку полной раздачи пока недоступен.' },
    destinationLabels: ['Обучить этому узлу', 'Урок по концепции', 'Точность матрицы', 'Та же ситуация', 'Похожая ситуация', 'Контролируемая вариация', 'Тренировка полной раздачи'],
    dependencyLabels: ['Факты текущей раздачи', 'Взвешенный диапазон героя', 'Взвешенный диапазон соперника', 'Политика ответов соперника', 'Принятый эталон', 'Эквити при колле', 'Эволюция диапазона', 'Полномочия нормативной оценки'],
    statuses: { available: 'Доступно', partial: 'Частично', unavailable: 'Недоступно' },
  },
  he: {
    summary: 'התשובות מתייחסות ללוח ולהיסטוריית הפעולות המדויקים האלה. תשובה לדוגמה חלה רק על הצירופים שצוינו.',
    coverage: 'הכוונה מופתה עבור {mapped}/{eligible} צירופים אפשריים: {exact} מדויקים, {dominant} העדפה בלבד, {conflicting} סותרים. המדיניות לא ידועה עבור {unknownPolicy}; משקל ההגעה לא ידוע עבור {unknownReach}. ל־{positive} משקל הגעה חיובי ידוע. הלוח חוסם {blocked} צירופים.',
    regionCoverage: 'מופו {mapped}/{eligible} צירופים; המדיניות עדיין לא ידועה עבור {unknownPolicy}.',
    partial: 'החלק הידוע נשאר חלקי. משקל לא ידוע אינו נחשב לאפס ואינו נעלם בנרמול.',
    exact: 'דיוק הכוונה ומשקל ההגעה הם דברים נפרדים. גם העדפה שמופתה אינה מספקת תדירות פעולה מדויקת.',
    change: 'שנו הנחה מפורשת אחת ולמדו את ההקשר החדש בנפרד.',
    next: 'למדו כוונה עבור צירוף אפשרי אחד בנקודה הזאת.', conceptNext: 'נסחו את ההנחה לפני בחירת הפעולה.',
    conceptWhy: 'מטרה ברורה מחברת את הפעולה לתגובה שאתם מצפים לה.',
    unavailable: 'מסקנה חזקה יותר דורשת ראיות נוספות; השאלה הזאת אינה נותנת ציון לתשובה.',
    kinds: {
      unmapped_postflop_region: ['חלק מהצירופים האפשריים עדיין לא מופו.', 'דוגמה אחת יכולה להבהיר כוונה בלי למלא את כל הקבוצה.', 'מה בכוונתכם לעשות עם הצירוף האפשרי הבא בנקודה המדויקת הזאת?', 'ציינו פעולה וגודל מדויקים; צירופים שלא נענו יישארו לא ידועים.'],
      mixed_frequency_ambiguity: ['חלק מהתשובות מציינות העדפה בלי תמהיל מדויק.', 'העדפה להימור אינה קובעת באיזו תדירות מבצעים אותו.', 'האם אתם מתכוונים לתמהיל מסוים או רק לפעולה מועדפת?', 'השאירו את ההעדפה כפי שהיא אלא אם תרצו ללמד תדירויות מדויקות.'],
      internal_inconsistency: ['חלק מהתשובות הפעילות סותרות זו את זו בנקודה הזאת.', 'כוונות סותרות אינן מספקות תדירות פעולה אחת.', 'האם הכוונה השתנתה או שהתשובות מתארות תנאים שונים?', 'בדקו את התשובות המקוריות ותקנו את הכוונה; ההיסטוריה תישמר.'],
      turn_river_continuation_gap: ['חלק מהטווח לאחר הפעולה הבאה עדיין לא ידוע.', 'קלפים משותפים לבדם אינם מראים אילו ידיים בחרו בפעולה המדויקת.', 'אילו צירופים בוחרים בגודל הזה ובאיזו תדירות?', 'המשיכו רק עם החלק שידוע כמותית; משקל הגעה או תדירות חסרים יישארו לא ידועים.'],
    },
    concepts: {
      scare_card: ['חשיבה על הקלף החדש', 'אילו ידיים שהגיעו לרחוב הזה באמת משתפרות?', 'השתמשו בטווח שהגיע לאחר הפעולות ובשינויים המבניים. קלף שנראה מפחיד אינו מוכיח יתרון אסטרטגי.'],
      multiway: ['המשך מול כמה יריבים', 'מי עדיין צריך לפעול?', 'התחשבו בכל יריב שנותר לפני שתנסחו הנחה לגבי תגובה.'],
      value: ['מטרת הימור לערך', 'מאילו ידיים חלשות יותר אתם מצפים להשוואה?', 'מטרת ערך דורשת הנחה מפורשת לגבי השוואות; זוג לבדו אינו קובע זאת.'],
      thin_value: ['ערך דק', 'אילו ידיים חלשות יותר עדיין משוות בגודל הזה ומה התוכנית מול העלאה?', 'גבול הערך תלוי בטווח ההשוואה ובגודל.'],
      when_not_to_bet: ['מתי לעשות צ׳ק', 'מה ההימור משיג בהשוואה לצ׳ק?', 'ציינו את התועלת הרצויה לפני שמניחים שהימור עדיף.'],
      semibluff: ['אגרסיביות עם משיכה', 'אילו ידיים טובות יותר עשויות להתקפל ואיך היד שלכם יכולה להשתפר?', 'משיכה לבדה אינה מוכיחה שסמי־בלוף רווחי.'],
      bluff: ['מועמדים לבלוף', 'אילו ידיים טובות יותר אתם מנסים לגרום לקפל?', 'ציינו יעד קיפול סביר לפני שאתם מתייחסים לצירוף כבלוף.'],
      bluff_catch: ['תפיסת בלופים', 'אילו בלופים יכולים להגיע באופן סביר לריבר הזה?', 'בלופים שיכולים להגיע דורשים את מסלול הפעולות הקודם ומדיניות יריב מפורשת.'],
      blocker_quality: ['איכות חוסמים', 'איזה חלק מטווח התגובה של היריב הקלף הזה מסיר?', 'הסרת צירופים משמעותית רק ביחס לטווח השוואה, קיפול או העלאה שהוגדר.'],
      check_raise: ['תוכנית לצ׳ק־רייז', 'עם אילו ידיים אתם מצפים שהיריב יהמר אחרי צ׳ק?', 'תוכנית לצ׳ק־רייז דורשת הנחה מפורשת לגבי הימורי היריב.'],
      small_block_bet: ['מטרת הימור קטן', 'אילו ידיים חלשות יותר משוות לגודל הזה ואיך תגיבו להעלאה?', 'הימור קטן אינו בהכרח ערך או הגנה.'],
      polarization: ['מבנה הטווח', 'אילו ידיים מהמרות כדי לקבל השוואה, אילו מכוונות לקיפול ואילו עושות צ׳ק?', 'קטגוריות מבניות של ידיים לבדן אינן מוכיחות קיטוב.'],
      value_bluff_composition: ['הרכב ערך ובלופים', 'אילו צירופים מכוונים להשוואות חלשות יותר ואילו לקיפולים של ידיים טובות יותר?', 'הרכב דורש תדירויות מדויקות וחלוקה מפורשת של תגובות.'],
      exploit: ['התאמה ליריב', 'איזו תגובה מפורשת של היריב תגרום לכם לשנות את התוכנית?', 'טענה על ניצול חולשה דורשת מודל תגובה מבוסס וסמכות השוואה מתאימה.'],
    },
    reasons: { matrix_preflop_only: 'עריכת דיוק במטריצה תומכת כרגע בקבוצות ידיים לפני הפלופ.', training_memory_record_required: 'אותו מצב דורש רשומת החלטה קיימת בזיכרון האימון.', planner_node_target_unsupported: 'מתכנן האימון אינו תומך ביעד של נקודת ההחלטה המדויקת הזאת.', full_hand_transfer_unsupported: 'העברת לימוד נקודת החלטה לאימון יד מלאה אינה זמינה.' },
    destinationLabels: ['ללמד את הנקודה הזאת', 'שיעור מושג', 'דיוק המטריצה', 'אותו מצב', 'מצב דומה', 'וריאציה מבוקרת', 'אימון יד מלאה'],
    dependencyLabels: ['עובדות היד הנוכחית', 'טווח משוקלל של הגיבור', 'טווח משוקלל של היריב', 'מדיניות תגובות היריב', 'מקור ייחוס מאושר', 'אקוויטי כאשר משווים', 'התפתחות הטווח', 'סמכות להערכה נורמטיבית'],
    statuses: { available: 'זמין', partial: 'חלקי', unavailable: 'לא זמין' },
  },
};
function interpolate(template, facts) {
  const values = { eligible: facts.eligibleCombos, mapped: facts.mappedCombos, exact: facts.exactCombos,
    dominant: facts.dominantCombos, conflicting: facts.conflictingCombos, unknownPolicy: facts.unknownPolicyCombos,
    unknownReach: facts.unknownReachCombos, positive: facts.knownPositiveCombos, blocked: facts.blockedCombos };
  return template.replace(/\{(\w+)\}/g, (_, key) => String(values[key]));
}
export function renderNodeCoach(coach, { language = 'en' } = {}) {
  if (coach?.schemaVersion !== NODE_COACH_VERSION) throw new TypeError('Node Coach required');
  const locale = Object.hasOwn(copy, language) ? language : 'en', t = copy[locale];
  const lessons = coach.opportunities.map((opportunity) => {
    const concept = opportunity.conceptId ? t.concepts[opportunity.conceptId] : null;
    const [noticed, why, question, explanation] = concept
      ? [concept[0], t.conceptWhy, concept[1], concept[2]] : t.kinds[opportunity.kind];
    return { id: opportunity.id, kind: opportunity.kind, regionId: opportunity.region?.id ?? null,
      noticed, why, question, explanation, whatChanges: t.change, next: concept ? t.conceptNext : t.next,
      coverage: interpolate(opportunity.region ? t.regionCoverage : t.coverage, opportunity.region ?? coach.studyFacts),
      unavailable: t.unavailable };
  });
  return freeze({ language: locale, direction: locale === 'he' ? 'rtl' : 'ltr', summary: t.summary,
    coverage: interpolate(t.coverage, coach.studyFacts),
    caution: coach.studyFacts.unknownReachCombos || coach.studyFacts.unknownPolicyCombos ? t.partial : t.exact,
    regions: coach.studyFacts.regions.map((region) => ({ id: region.id, coverage: interpolate(t.regionCoverage, region) })),
    lessons, concepts: coach.concepts.map((concept) => ({ id: concept.id, title: t.concepts[concept.id][0],
      question: t.concepts[concept.id][1], explanation: t.concepts[concept.id][2], why: t.conceptWhy,
      whatChanges: t.change, next: t.conceptNext, unavailable: t.unavailable,
      questionAvailability: t.statuses[concept.question.availability], strongerClaimAvailability: t.statuses[concept.strongerClaim.availability],
      dependencies: dependencies.map((key, index) => ({ id: key, label: t.dependencyLabels[index],
        required: concept.dependencies[key].required, availability: t.statuses[concept.dependencies[key].availability] })) })),
    handoffs: Object.keys(destinations).map((destination, index) => { const request = createNodeCoachHandoff(coach, destination);
      return { destination, label: t.destinationLabels[index], availability: request.availability,
        availabilityLabel: t.statuses[request.availability], unavailableReason: request.unavailableReason ? t.reasons[request.unavailableReason] : null };
    }) });
}
