import { createNaturalLanguageEnvelope } from './natural-language-envelope.mjs';
import { SYNTHETIC_POLICY_ID, SYNTHETIC_POLICY_VERSION, validateSyntheticConfiguration } from './synthetic-opponent-policy.mjs';

export const OPPONENT_POLICY_COPY = {
  en: {
    title: 'Synthetic opponent', calling: 'Calling-heavy', aggressive: 'Aggressive', tight: 'Tight/passive', custom: 'Custom parameters',
    target: 'Apply policy to', all: 'All opponents', bb: 'BB only', seed: 'Policy seed', parameters: 'Behavior assumptions (%)',
    small: 'Call a small price, if not raising', large: 'Call a large price, if not raising',
    free: 'Bet or raise when checking is available', raise: 'Raise when facing a wager',
    scope: 'Synthetic, card-independent practice: these assumptions ignore hand strength. They apply on every betting street. A small call price is at most one third of the current pot (including the wager); larger prices use the large-price setting. Bets and raises use the canonical minimum size. This is not a human model or a strategy recommendation.',
    summary: 'When checking is available, this policy bets or raises {free}% of the time when legal. Facing a wager, it raises {raise}% when legal; otherwise it calls {small}% of small prices and {large}% of large prices. If raising is unavailable, the call setting applies directly.',
    review: 'Opponent assumptions in this hand', history: 'Recorded policy decisions', evidence: 'Policy evidence',
    check_available: 'Checking was available.', small_call_price: 'The call price was small.', large_call_price: 'The call price was large.',
    decision: 'Seat {seat}, {street}: {action}. {reason} The configured action-selection weight was {weight}%.',
    fold: 'fold', check: 'check', call: 'call', bet: 'bet', raiseAction: 'raise',
    preflop: 'preflop', flop: 'flop', turn: 'turn', river: 'river', invalid: 'Use whole percentages from 0 to 100 and a policy seed from 0 to 4294967295.',
  },
  ru: {
    title: 'Синтетический соперник', calling: 'Часто коллирует', aggressive: 'Агрессивный', tight: 'Тайтовый/пассивный', custom: 'Свои параметры',
    target: 'Применить политику к', all: 'Всем соперникам', bb: 'Только BB', seed: 'Сид политики', parameters: 'Допущения поведения (%)',
    small: 'Колл небольшой цены, если нет рейза', large: 'Колл большой цены, если нет рейза',
    free: 'Бет или рейз при доступном чеке', raise: 'Рейз в ответ на ставку',
    scope: 'Синтетическая тренировка без учёта силы карт. Допущения действуют на всех улицах торговли. Небольшая цена колла — не более трети текущего банка, включая ставку; для большей цены действует второй параметр. Беты и рейзы используют канонический минимальный размер. Это не модель человека и не рекомендация по стратегии.',
    summary: 'При доступном чеке политика выбирает бет или рейз в {free}% случаев, когда это разрешено. В ответ на ставку она делает рейз в {raise}% случаев, когда он разрешён; иначе коллирует {small}% небольших цен и {large}% больших. Если рейз недоступен, параметр колла применяется напрямую.',
    review: 'Допущения соперника в этой раздаче', history: 'Записанные решения политики', evidence: 'Данные политики',
    check_available: 'Чек был доступен.', small_call_price: 'Цена колла была небольшой.', large_call_price: 'Цена колла была большой.',
    decision: 'Место {seat}, {street}: {action}. {reason} Настроенный вес выбора действия — {weight}%.',
    fold: 'фолд', check: 'чек', call: 'колл', bet: 'бет', raiseAction: 'рейз',
    preflop: 'префлоп', flop: 'флоп', turn: 'тёрн', river: 'ривер', invalid: 'Введите целые проценты от 0 до 100 и сид политики от 0 до 4294967295.',
  },
  he: {
    title: 'יריב סינתטי', calling: 'מרבה להשוות', aggressive: 'אגרסיבי', tight: 'סלקטיבי/פסיבי', custom: 'פרמטרים מותאמים',
    target: 'החלת המדיניות על', all: 'כל היריבים', bb: 'BB בלבד', seed: 'זרע המדיניות', parameters: 'הנחות התנהגות (%)',
    small: 'השוואת מחיר קטן, ללא העלאה', large: 'השוואת מחיר גדול, ללא העלאה',
    free: 'הימור או העלאה כשאפשר צ׳ק', raise: 'העלאה מול הימור',
    scope: 'תרגול סינתטי שאינו מתחשב בחוזק הקלפים. ההנחות חלות בכל רחובות ההימור. מחיר השוואה קטן הוא עד שליש מהקופה הנוכחית, כולל ההימור; מחיר גדול יותר משתמש בהגדרה השנייה. הימורים והעלאות משתמשים בגודל המינימלי החוקי. זו אינה מודל של אדם או המלצת אסטרטגיה.',
    summary: 'כשאפשר צ׳ק, המדיניות מהמרת או מעלה ב־{free}% מהמקרים שבהם הדבר חוקי. מול הימור היא מעלה ב־{raise}% מהמקרים שבהם העלאה חוקית; אחרת היא משווה {small}% מהמחירים הקטנים ו־{large}% מהגדולים. כשהעלאה אינה זמינה, הגדרת ההשוואה חלה ישירות.',
    review: 'הנחות היריב ביד זו', history: 'החלטות מדיניות מתועדות', evidence: 'נתוני המדיניות',
    check_available: 'צ׳ק היה זמין.', small_call_price: 'מחיר ההשוואה היה קטן.', large_call_price: 'מחיר ההשוואה היה גדול.',
    decision: 'מושב {seat}, {street}: {action}. {reason} משקל בחירת הפעולה שהוגדר היה {weight}%.',
    fold: 'פרישה', check: 'צ׳ק', call: 'השוואה', bet: 'הימור', raiseAction: 'העלאה',
    preflop: 'פריפלופ', flop: 'פלופ', turn: 'טרן', river: 'ריבר', invalid: 'יש להזין אחוזים שלמים מ־0 עד 100 וזרע מדיניות מ־0 עד 4294967295.',
  },
};

export function opponentCopy(key, locale = 'en', values = {}) {
  const copy = OPPONENT_POLICY_COPY[locale] ?? OPPONENT_POLICY_COPY.en;
  if (!Object.hasOwn(copy, key)) throw new RangeError(`Unknown opponent copy: ${key}`);
  return copy[key].replace(/\{(\w+)\}/g, (_, name) => {
    const value = String(values[name]);
    return locale === 'he' && /^[\d.]+$/.test(value) ? `\u2066${value}\u2069` : value;
  });
}

export function createOpponentPolicyLanguageFacts(configuration, record = null) {
  const config = validateSyntheticConfiguration(configuration);
  if (record && (record.policyId !== SYNTHETIC_POLICY_ID || record.policyVersion !== SYNTHETIC_POLICY_VERSION)) {
    throw new RangeError('Unsupported historical opponent policy version');
  }
  return createNaturalLanguageEnvelope({ claimClass: 'factual',
    subject: { role: 'synthetic_opponent_policy', policyId: SYNTHETIC_POLICY_ID, policyVersion: SYNTHETIC_POLICY_VERSION },
    evidenceRefs: [`${SYNTHETIC_POLICY_ID}@${SYNTHETIC_POLICY_VERSION}:${JSON.stringify(config.parameters)}`,
      ...(record ? [record.deterministicMetadata.cacheKey] : [])],
    scope: { context: config.context, capability: config.capability },
    uncertainty: ['synthetic_not_population_evidence', 'card_independent', 'range_response_unavailable'],
    basis: record ? 'historical' : 'current',
    facts: { configuration: config, ...(record ? { reason: record.selectionProvenance.reason,
      action: record.chosenAction.type, weights: record.selectionProvenance.weights } : {}) } });
}

export function describeOpponentPolicy(configuration, locale = 'en') {
  const { facts } = createOpponentPolicyLanguageFacts(configuration);
  const p = facts.configuration.parameters;
  return opponentCopy('summary', locale, { small: p.smallPriceCallPercent, large: p.largePriceCallPercent,
    free: p.freeAggressionPercent, raise: p.facingRaisePercent });
}

export function describeOpponentDecision(record, locale = 'en') {
  const { facts } = createOpponentPolicyLanguageFacts(record.policyConfiguration, record);
  return opponentCopy('decision', locale, { seat: record.actor.seat, street: opponentCopy(record.actorInformation.street, locale),
    action: opponentCopy(facts.action === 'raise' ? 'raiseAction' : facts.action, locale),
    reason: opponentCopy(facts.reason, locale), weight: facts.weights.find(item => item.type === facts.action).weight / 100 });
}
