// SETTINGS-001 workspace copy (EN/RU/HE). Data only; i18n.js owns lookup.
// Terms follow docs/TERMINOLOGY.md (RU пас, колл, рейз, борд, эквити; HE פולד,
// קול, רייז, בורד, אקוויטי). Hebrew actions use the masculine singular
// convention. Keys are the English strings used in app/index.html and
// application/settings-*.mjs.
(function registerRiverlineSettingsTranslations(global) {
  const en = {};
  const ru = {};
  const he = {};
  for (const [key, russian, hebrew] of [
    ['Search settings', 'Поиск по настройкам', 'חיפוש בהגדרות'],
    ['Theme and cards', 'Тема и карты', 'ערכת נושא וקלפים'],
    ['Sounds, volume, motion', 'Звуки, громкость, анимация', 'צלילים, עוצמה, תנועה'],
    ['Help & guide', 'Справка и руководство', 'עזרה ומדריך'],
    ['Answering, tutorials, guide', 'Ответы, обучение, руководство', 'מענה, הדרכות, מדריך'],
    ['Shortcuts', 'Горячие клавиши', 'קיצורי מקשים'],
    ['Keys for every workspace', 'Клавиши для каждого раздела', 'מקשים לכל אזור עבודה'],
    ['Sign-in, local data, delete', 'Вход, локальные данные, удаление', 'כניסה, נתונים מקומיים, מחיקה'],
    ['Nothing modified', 'Изменений нет', 'אין שינויים'],
    ['Modified · {count}', 'Изменено · {count}', 'שונו · {count}'],
    ['No settings match “{query}”.', 'Ничего не найдено по запросу «{query}».', 'לא נמצאו הגדרות עבור “{query}”.'],
    ['Nothing is changed from the defaults.', 'Все настройки стоят по умолчанию.', 'כל ההגדרות בברירת המחדל.'],
    ['Clear search', 'Очистить поиск', 'נקה חיפוש'],
    ['{count} settings shown', 'Показано настроек: {count}', 'מוצגות הגדרות: {count}'],
    ['Reset', 'Сбросить', 'אפס'],
    ['Reset to default', 'Сброшено к значению по умолчанию', 'אופס לברירת המחדל'],
    ['Theme', 'Тема', 'ערכת נושא'],
    ['Built-in themes never change. Duplicate one to make your own.', 'Встроенные темы не меняются. Скопируйте одну, чтобы сделать свою.', 'ערכות נושא מובנות לא משתנות. אפשר לשכפל אחת וליצור ערכה משלך.'],
    ['Duplicate & customise', 'Копировать и настроить', 'שכפל והתאם'],
    ['Sound', 'Звук', 'צליל'],
    ['Scales every Riverline sound.', 'Меняет громкость всех звуков Riverline.', 'קובע את עוצמת כל הצלילים ב-Riverline.'],
    ['Interface language', 'Язык интерфейса', 'שפת הממשק'],
    ['Each card shows a real line in that language.', 'На каждой карточке настоящая строка на этом языке.', 'בכל כרטיס מופיעה שורה אמיתית באותה שפה.'],
    ['Hebrew reads right to left. Cards, boards, positions, sizes and numbers stay left to right.', 'Иврит читается справа налево. Карты, борды, позиции, размеры и числа остаются слева направо.', 'עברית נקראת מימין לשמאל. קלפים, בורדים, עמדות, גדלים ומספרים נשארים משמאל לימין.'],
    ['How Riverline asks for your answers, and where to learn more.', 'Как Riverline принимает ваши ответы и где узнать больше.', 'איך Riverline מבקש את התשובות שלך והיכן ללמוד עוד.'],
    ['While you study', 'Во время учёбы', 'בזמן הלימוד'],
    ['Guide', 'Руководство', 'מדריך'],
    ['A short tour of what each workspace is for.', 'Коротко о том, для чего нужен каждый раздел.', 'סיור קצר במטרת כל אזור עבודה.'],
    ['Settings tour', 'Обзор настроек', 'סיור בהגדרות'],
    ['Replay the short walkthrough of this page.', 'Пройти короткий обзор этой страницы ещё раз.', 'הפעלה חוזרת של הסיור הקצר בעמוד הזה.'],
    ['Keys never animate. They work on the letters shown, so use the English keyboard layout.', 'Клавиши работают без анимации. Они реагируют на показанные латинские буквы, поэтому включите английскую раскладку.', 'המקשים פועלים בלי אנימציה. הם מגיבים לאותיות המוצגות, לכן עבור לפריסת מקלדת אנגלית.'],
    ['Training drill', 'Упражнение в тренировке', 'תרגיל באימון'],
    ['Check or call', 'Чек или колл', 'צ\'ק או קול'],
    ['Bet or raise', 'Бет или рейз', 'בט או רייז'],
    ['Confirm, then next hand', 'Подтвердить, затем следующая раздача', 'אשר ואז ליד הבאה'],
    ['Mark as unsure', 'Отметить «Не уверен»', 'סמן “לא בטוח”'],
    ['Explain', 'Объяснить', 'הסבר'],
    ['Review later', 'Разобрать позже', 'לבדיקה בהמשך'],
    ['Pick an answer by position', 'Выбрать ответ по номеру', 'בחר תשובה לפי מספר'],
    ['Analyze and Equity', 'Анализ и эквити', 'ניתוח ואקוויטי'],
    ['Choose your hand', 'Выбрать ваши карты', 'בחר את הקלפים שלך'],
    ['Choose the board', 'Выбрать борд', 'בחר את הבורד'],
    ['Clear your hand', 'Очистить ваши карты', 'נקה את הקלפים שלך'],
    ['Calculate Equity', 'Рассчитать эквити', 'חשב אקוויטי'],
    ['Show or hide the explanation', 'Показать или скрыть объяснение', 'הצג או הסתר את ההסבר'],
    ['Switch between views', 'Переключать вкладки', 'עבור בין תצוגות'],
    ['Switch between Midnight and Daylight', 'Переключать Midnight и Daylight', 'עבור בין Midnight ל-Daylight'],
    ['Paint the selected cells fold or raise', 'Закрасить выбранные клетки как пас или рейз', 'צבע את התאים שנבחרו כפולד או רייז'],
    ['Undo the last paint', 'Отменить последнюю покраску', 'בטל את הצביעה האחרונה'],
    ['On this device', 'На этом устройстве', 'במכשיר הזה'],
    ['Saved items', 'Сохранённое', 'פריטים שמורים'],
    ['Training sessions', 'Тренировочные сессии', 'סשני אימון'],
    ['Training answers', 'Ответы в тренировках', 'תשובות באימונים'],
    ['Personal Strategy setups', 'Настройки Личной стратегии', 'הגדרות אסטרטגיה אישית'],
    ['Game nights', 'Покерные вечера', 'ערבי פוקר'],
    ['Some counts could not be read in this browser.', 'Часть счётчиков не удалось прочитать в этом браузере.', 'לא ניתן היה לקרוא חלק מהספירות בדפדפן הזה.'],
    ['Preview', 'Предпросмотр', 'תצוגה מקדימה'],
    ['Sample spot', 'Пример спота', 'ספוט לדוגמה'],
    ['Updates as you change settings. The numbers are an example, not a recommendation.', 'Меняется вместе с настройками. Числа даны для примера, это не рекомендация.', 'מתעדכן תוך כדי שינוי ההגדרות. המספרים הם דוגמה, לא המלצה.'],
    ['Sample actions', 'Пример действий', 'פעולות לדוגמה'],
    ['Sample mix', 'Пример микса', 'תמהיל לדוגמה'],
  ]) {
    en[key] = key;
    ru[key] = russian;
    he[key] = hebrew;
  }
  global.riverlineSettingsTranslations = { en, ru, he };
}(window));
