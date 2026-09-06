const copy = {
  path: ['Hypothetical BTN open → flop → turn → river study', 'Гипотетическое открытие BTN → флоп → тёрн → ривер', 'לימוד היפותטי: פתיחת BTN ← פלופ ← טרן ← ריבר'],
  noReach: ['No known positive combos reach this branch. Revisit the prior node to teach exact frequencies, or select another action/card. Unknown reach remains unknown.', 'В этой ветке нет комбинаций с известным положительным весом. Вернитесь к предыдущему узлу для точных частот или выберите другое действие/карту. Неизвестный вес остаётся неизвестным.', 'אין צירופים במשקל חיובי ידוע שמגיעים לענף הזה. חזרו לנקודה הקודמת כדי ללמד תדירויות מדויקות, או בחרו פעולה או קלף אחרים. הגעה לא ידועה נשארת לא ידועה.'],
  selectedBranch: ['Selected exact action: {positive} known positive combos; {unknown} unknown weights. This is a partial range, not value/bluff composition.', 'Выбранное точное действие: {positive} комбинаций с известным положительным весом; {unknown} неизвестных весов. Это неполный диапазон, а не состав вэлью/блефов.', 'הפעולה המדויקת שנבחרה: {positive} צירופים במשקל חיובי ידוע; {unknown} משקלים לא ידועים. זהו טווח חלקי, ולא הרכב ערך ובלופים.'],
  preflop: ['Preflop', 'Префлоп', 'פרפלופ'],
  context: ['Current hand context', 'Контекст раздачи', 'הקשר היד הנוכחית'],
  range: ['Current range', 'Текущий диапазон', 'הטווח הנוכחי'],
  teach: ['Teach Riverline', 'Обучить Riverline', 'ללמד את Riverline'],
  flop: ['Flop', 'Флоп', 'פלופ'], turn: ['Turn', 'Тёрн', 'טרן'], river: ['River', 'Ривер', 'ריבר'],
  call: ['Call', 'Колл', 'השוואה'],
  save: ['Adopt this intention', 'Принять это намерение', 'אימוץ הכוונה הזאת'],
  advance: ['Continue selected branch', 'Продолжить выбранную ветку', 'המשך בענף שנבחר'],
  another: ['Teach another region', 'Обучить другой регион', 'ללמד אזור נוסף'],
  inspect: ['Inspect range facts', 'Посмотреть факты диапазона', 'בדיקת עובדות הטווח'],
  region: ['{region}: {mapped}/{total} reached combos mapped; {unknown} unanswered.', '{region}: описано {mapped}/{total} достигших комбинаций; {unknown} без ответа.', '{region}: מופו {mapped}/{total} צירופים שהגיעו; {unknown} ללא תשובה.'],
  history: ['Exact prior actions', 'Точные предыдущие действия', 'פעולות קודמות מדויקות'],
  previous: ['Revisit a prior node / vary the next card or size', 'Вернуться к узлу / изменить следующую карту или размер', 'חזרה לנקודה קודמת / שינוי הקלף הבא או הגודל'],
  card: ['Next public card', 'Следующая общая карта', 'הקלף המשותף הבא'],
  opponent: ['Next street: BB checks, or enter an exact BB bet (bb)', 'Следующая улица: BB чекает, либо задайте точную ставку BB (bb)', 'ברחוב הבא: BB עושה צ׳ק, או הזינו הימור BB מדויק (bb)'],
  branchNote: ['Hypothetical branch. BB calls your wager; its next check or bet is your explicit assumption. Exploring does not save intent. Adopt an answer explicitly to save it.', 'Гипотетическая ветка. BB коллирует вашу ставку; его следующий чек или ставка — ваше явное предположение. Просмотр не сохраняет намерение. Для сохранения явно примите ответ.', 'ענף היפותטי. BB משווה את ההימור שלכם; הצ׳ק או ההימור הבא שלו הוא הנחה מפורשת שלכם. חקירה אינה שומרת כוונה. לשמירה יש לאמץ תשובה במפורש.'],
  terminal: ['This branch has no further Hero decision. Revisit an earlier node to study a different branch.', 'В этой ветке больше нет решений Hero. Вернитесь к предыдущему узлу для другой ветки.', 'בענף הזה אין החלטה נוספת לגיבור. חזרו לנקודה קודמת כדי ללמוד ענף אחר.'],
  invalid: ['This card, action or size is not legal here. Nothing changed.', 'Эта карта, действие или размер здесь недопустимы. Ничего не изменено.', 'הקלף, הפעולה או הגודל אינם חוקיים כאן. דבר לא השתנה.'],
  custom: ['Add exact size (bb, total on this street)', 'Добавить точный размер (bb, всего на улице)', 'הוספת גודל מדויק (bb, סך הכול ברחוב)'],
  add: ['Add size', 'Добавить размер', 'הוספת גודל'],
  note: ['Context / exception', 'Контекст / исключение', 'הקשר / חריג'],
  noteHelp: ['Saved as your explanation for this combo and node. A conditional exception needs a separately studied context; text never supplies frequencies.', 'Сохраняется как ваше объяснение для этой комбинации и узла. Условное исключение требует отдельного контекста; текст не задаёт частоты.', 'נשמר כהסבר שלכם לצירוף ולנקודה הזאת. חריג מותנה דורש הקשר שנלמד בנפרד; טקסט אינו מספק תדירויות.'],
  comparison: ['Compare another Approach at this node', 'Сравнить другой Подход в этом узле', 'השוואת גישה אחרת בנקודה הזאת'],
  comparisonNote: ['Comparison is read-only. Different mapped intentions are not a grade.', 'Сравнение только для чтения. Различия намерений не являются оценкой.', 'ההשוואה לקריאה בלבד. כוונות שונות אינן ציון.'],
  compared: ['{comparableCombos} combos have mapped intent and known positive reach in both Approaches: {intentionDifferences} intention differences, {precisionDifferences} precision differences. Comparison is unavailable for {unavailableCombos} combos.', 'У {comparableCombos} комбинаций есть намерение и известный положительный вес в обоих Подходах: {intentionDifferences} различий намерений, {precisionDifferences} различий точности. Для {unavailableCombos} комбинаций сравнение недоступно.', 'ל־{comparableCombos} צירופים יש כוונה ממופה והגעה חיובית ידועה בשתי הגישות: {intentionDifferences} הבדלי כוונה, {precisionDifferences} הבדלי דיוק. ההשוואה אינה זמינה עבור {unavailableCombos} צירופים.'],
  potStack: ['Pot {pot}bb · Hero {stack}bb · {position}', 'Банк {pot}bb · Hero {stack}bb · {position}', 'קופה {pot}bb · גיבור {stack}bb · {position}'],
  coverage: ['Known positive reach: {positive}. Unknown reach: {unknown}. Mapped intent: {mapped}; unanswered: {unmapped}.', 'Известный положительный вес: {positive}. Неизвестный вес: {unknown}. Намерение задано: {mapped}; без ответа: {unmapped}.', 'הגעה חיובית ידועה: {positive}. הגעה לא ידועה: {unknown}. כוונה ממופה: {mapped}; ללא תשובה: {unmapped}.'],
  actionChange: ['Action conditioning at the prior node leaves {positive} known positive combos; {unknown} action-conditioned weights remain unknown.', 'После учёта действия в предыдущем узле остаётся {positive} комбинаций с известным положительным весом; {unknown} весов неизвестны.', 'התניה בפעולה בנקודה הקודמת משאירה {positive} צירופים במשקל חיובי ידוע; {unknown} משקלים נשארים לא ידועים.'],
  cardChange: ['New public cards remove {removed} physical combos, including {unknown} whose weight was unknown.', 'Новые общие карты исключают {removed} физических комбинаций, включая {unknown} с неизвестным весом.', 'הקלפים המשותפים החדשים מסירים {removed} צירופים פיזיים, כולל {unknown} שמשקלם לא היה ידוע.'],
  evidenceChange: ['Your answers map {mapped} combos at this node ({exact} exact, {preferred} preferred). They do not change the incoming reach range.', 'Ваши ответы описывают {mapped} комбинаций в этом узле ({exact} точно, {preferred} предпочтение). Они не меняют входящий диапазон.', 'התשובות שלכם ממפות {mapped} צירופים בנקודה הזאת ({exact} מדויקים, {preferred} מועדפים). הן אינן משנות את טווח ההגעה.'],
  transition: ['The new card changes the made-hand relationship or draw facts for {count} known reached combos. This does not assign value or bluff roles.', 'Новая карта меняет структуру готовой руки или дро для {count} известных достигших комбинаций. Это не назначает роли вэлью или блефа.', 'הקלף החדש משנה את מבנה היד או עובדות המשיכה עבור {count} צירופים ידועים שהגיעו. אין בכך קביעה של תפקידי ערך או בלוף.'],
  missed: ['{count} known reached combos had a turn draw that the river card did not complete. Bluff intent still needs an explicit answer.', 'У {count} известных достигших комбинаций было дро на тёрне, которое ривер не закрыл. Намерение блефовать требует явного ответа.', 'ל־{count} צירופים ידועים שהגיעו הייתה משיכה בטרן שקלף הריבר לא השלים. כוונת בלוף עדיין דורשת תשובה מפורשת.'],
  dormant: ['{count} previously taught combos no longer have known positive reach through this branch. Their intent history is retained; revisit the prior action evidence.', 'У {count} ранее описанных комбинаций больше нет известного положительного веса в этой ветке. История намерений сохранена; проверьте предыдущие действия.', 'ל־{count} צירופים שנלמדו קודם אין עוד הגעה חיובית ידועה דרך הענף הזה. היסטוריית הכוונות נשמרת; בדקו את ראיות הפעולה הקודמת.'],
  contradiction: ['These answers conflict. Which intention should apply to this exact combo and node?', 'Ответы противоречат друг другу. Какое намерение относится к этой комбинации и узлу?', 'התשובות סותרות. איזו כוונה חלה על הצירוף והנקודה המדויקים?'],
  sizing_boundary: ['Do you intend this exact size, another size, or a mix?', 'Вы намерены выбрать этот точный размер, другой или микс?', 'האם הכוונה היא לגודל המדויק הזה, לגודל אחר או לתמהיל?'],
  missed_draw: ['Which missed draws do you intend to bluff? Start with this combo and choose an exact size or check.', 'Какие незакрывшиеся дро вы намерены блефовать? Начните с этой комбинации и выберите точный размер или чек.', 'באילו משיכות שהוחמצו אתם מתכוונים לבלף? התחילו בצירוף הזה ובחרו גודל מדויק או צ׳ק.'],
  call_boundary: ['What is the weakest hand you intend to call here? Where does this combo sit relative to that boundary?', 'С какой самой слабой рукой вы намерены коллировать? Где эта комбинация относительно границы?', 'מהי היד החלשה ביותר שבכוונתכם להשוות איתה כאן? היכן הצירוף הזה ביחס לגבול?'],
  value_boundary: ['What is the weakest hand you still value bet at this size? Does this combo bet, bluff, or check back in your plan?', 'Какую самую слабую руку вы ещё ставите на вэлью этим размером? Эта комбинация ставит, блефует или чекает по вашему плану?', 'מהי היד החלשה ביותר שעדיין תהמרו איתה לערך בגודל הזה? האם הצירוף מהמר, מבלף או עושה צ׳ק לפי התוכנית שלכם?'],
  card_transition: ['Which hands that reached this street actually improve? Does this combo change your plan?', 'Какие руки, дошедшие до этой улицы, действительно улучшаются? Меняет ли эта комбинация ваш план?', 'אילו ידיים שהגיעו לרחוב הזה באמת משתפרות? האם הצירוף הזה משנה את התוכנית שלכם?'],
  draw_plan: ['Do you intend to check or use aggression with this draw, and what is your plan against a raise?', 'Вы намерены чекать или играть агрессивно с этим дро, и каков план против рейза?', 'האם בכוונתכם לעשות צ׳ק או לשחק באגרסיביות עם המשיכה הזאת, ומה התוכנית מול העלאה?'],
  action_boundary: ['Which hands bet and which check here in your plan? Start with this exact combo.', 'Какие руки ставят, а какие чекают по вашему плану? Начните с этой точной комбинации.', 'אילו ידיים מהמרות ואילו עושות צ׳ק בתוכנית שלכם? התחילו בצירוף המדויק הזה.'],
};
const regions = {
  high_card: ['High card', 'Старшая карта', 'קלף גבוה'], one_pair: ['One pair', 'Одна пара', 'זוג אחד'],
  overpair: ['Overpair', 'Оверпара', 'זוג מעל הלוח'], pocket_pair: ['Pocket pair', 'Карманная пара', 'זוג ביד'],
  top_pair: ['Top pair', 'Топ-пара', 'זוג עליון'], middle_pair: ['Middle pair', 'Средняя пара', 'זוג אמצעי'],
  lower_pair: ['Lower pair', 'Нижняя пара', 'זוג נמוך'], two_pair: ['Two pair', 'Две пары', 'שני זוגות'],
  set: ['Set', 'Сет', 'סט'], trips: ['Trips', 'Трипс', 'שלישייה'], three_of_a_kind: ['Three of a kind', 'Тройка', 'שלישייה'],
  straight: ['Straight', 'Стрит', 'רצף'], flush: ['Flush', 'Флеш', 'צבע'], full_house: ['Full house', 'Фулл-хаус', 'פול האוס'],
  four_of_a_kind: ['Four of a kind', 'Каре', 'רביעייה'], straight_flush: ['Straight flush', 'Стрит-флеш', 'רצף בצבע'],
  board_pair: ['Board pair', 'Пара на доске', 'זוג בלוח'], board_two_pair: ['Board two pair', 'Две пары на доске', 'שני זוגות בלוח'],
  board_trips: ['Board trips', 'Тройка на доске', 'שלישייה בלוח'], plays_board: ['Plays the board', 'Играет доска', 'משחק את הלוח'],
  draw: ['Draw', 'Дро', 'משיכה'], missed_draw: ['Missed draw', 'Незакрывшееся дро', 'משיכה שהוחמצה'],
};
export function personalNodeRegionLabel(region, language = 'en') {
  return region.split(':').map(key => regions[key]?.[{ en: 0, ru: 1, he: 2 }[language] ?? 0] ?? key).join(' · ');
}
export function continuationCopy(key, language = 'en', values = {}) {
  const text = copy[key]?.[{ en: 0, ru: 1, he: 2 }[language] ?? 0];
  if (!text) throw new RangeError(`Missing continuation copy: ${key}`);
  return text.replace(/\{(\w+)\}/g, (_, name) => String(values[name]));
}
export function renderPersonalRangeMutations(facts, language = 'en') {
  const t = (key, values) => continuationCopy(key, language, values);
  return [t('actionChange', { positive: facts.actionConditioning.positiveAfter, unknown: facts.actionConditioning.unknownAfter }),
    t('cardChange', { removed: facts.cardRemoval.removedCombos, unknown: facts.cardRemoval.removedUnknownCombos }),
    t('evidenceChange', { mapped: facts.userIntent.mappedCombos, exact: facts.userIntent.exactCombos, preferred: facts.userIntent.preferredCombos }),
    ...(facts.structuralTransitions ? [t('transition', { count: facts.structuralTransitions })] : []),
    ...(facts.missedDrawCombos ? [t('missed', { count: facts.missedDrawCombos })] : []),
    ...(facts.intentWithoutKnownReachCombos ? [t('dormant', { count: facts.intentWithoutKnownReachCombos })] : [])];
}
