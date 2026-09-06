(function installTutorialTranslations(global) {
  const en = {
    'Inspect ranges and hypothetical cards': 'Inspect ranges and hypothetical cards',
    'Open Ranges & runouts to enter explicit weights or keep exact hands. Unknown combinations remain unknown; allow known-only Equity explicitly for a partial range. Inspect next cards or selected turn and river sequences, then focus a card to see the best five. Hand improvement and Equity improvement are separate facts.': 'Open Ranges & runouts to enter explicit weights or keep exact hands. Unknown combinations remain unknown; allow known-only Equity explicitly for a partial range. Inspect next cards or selected turn and river sequences, then focus a card to see the best five. Hand improvement and Equity improvement are separate facts.',
    'Tutorial': 'Tutorial',
    'Restart tutorial': 'Restart tutorial',
    'Guided tour available': 'Guided tour available',
    'Start tutorial': 'Start tutorial',
    'Continue tutorial': 'Continue tutorial',
    'Skip': 'Skip',
    'Back': 'Back',
    'Next': 'Next',
    'Finish': 'Finish',
    'Step {current} of {total}': 'Step {current} of {total}',
    'A quick tour of Home': 'A quick tour of Home',
    'See how Home keeps useful study work close without turning it into another task list.': 'See how Home keeps useful study work close without turning it into another task list.',
    'Your study starts with context': 'Your study starts with context',
    'Home brings saved study, review work, and the next useful action into one place, so returning to Riverline starts with context instead of setup.': 'Home brings saved study, review work, and the next useful action into one place, so returning to Riverline starts with context instead of setup.',
    'My Riverline shows your account identity, study sync, saved work, and next useful action without owning or recomputing that data.': 'My Riverline shows your account identity, study sync, saved work, and next useful action without owning or recomputing that data.',
    'Return to important decisions': 'Return to important decisions',
    'Saved hands and study spots appear in Recent so you can reopen decisions worth studying without rebuilding them.': 'Saved hands and study spots appear in Recent so you can reopen decisions worth studying without rebuilding them.',
    'Build a focused review habit': 'Build a focused review habit',
    'Review groups the hands and spots you marked to revisit or as mistakes, turning saved material into a focused study queue.': 'Review groups the hands and spots you marked to revisit or as mistakes, turning saved material into a focused study queue.',
    'Move into the right tool': 'Move into the right tool',
    "Quick Start opens Riverline's main workspaces. Use it when you know whether you want to analyze, practise, calculate Equity, or build a personal range.": "Quick Start opens Riverline's main workspaces. Use it when you know whether you want to analyze, practise, calculate Equity, or build a personal range.",
  };

  const ru = {
    'Inspect ranges and hypothetical cards': 'Изучайте диапазоны и гипотетические карты',
    'Open Ranges & runouts to enter explicit weights or keep exact hands. Unknown combinations remain unknown; allow known-only Equity explicitly for a partial range. Inspect next cards or selected turn and river sequences, then focus a card to see the best five. Hand improvement and Equity improvement are separate facts.': 'Откройте «Диапазоны и ранауты», чтобы ввести веса или оставить точные руки. Неизвестные комбинации остаются неизвестными; явно разрешите Equity по известной части частичного диапазона. Изучайте следующие карты или выбранные последовательности тёрна и ривера; фокус на карте покажет лучшие пять. Улучшение руки и рост Equity — разные факты.',
    'Tutorial': 'Обучение',
    'Restart tutorial': 'Перезапустить обучение',
    'Guided tour available': 'Доступно краткое обучение',
    'Start tutorial': 'Начать обучение',
    'Continue tutorial': 'Продолжить обучение',
    'Skip': 'Пропустить',
    'Back': 'Назад',
    'Next': 'Далее',
    'Finish': 'Завершить',
    'Step {current} of {total}': 'Шаг {current} из {total}',
    'A quick tour of Home': 'Краткий обзор Главной',
    'See how Home keeps useful study work close without turning it into another task list.': 'Посмотрите, как Главная держит важные учебные материалы под рукой, не превращаясь в ещё один список задач.',
    'Your study starts with context': 'Учёба начинается с контекста',
    'Home brings saved study, review work, and the next useful action into one place, so returning to Riverline starts with context instead of setup.': 'Главная объединяет сохранённые материалы, очередь на разбор и следующий полезный шаг, чтобы при возвращении в Riverline не настраивать всё заново.',
    'My Riverline shows your account identity, study sync, saved work, and next useful action without owning or recomputing that data.': '«Мой Riverline» показывает вашу учётную запись, состояние синхронизации, сохранённые материалы и следующий полезный шаг, не создавая и не пересчитывая эти данные.',
    'Return to important decisions': 'Возвращайтесь к важным решениям',
    'Saved hands and study spots appear in Recent so you can reopen decisions worth studying without rebuilding them.': 'Сохранённые раздачи и учебные споты появляются в «Недавних», чтобы вы могли снова открыть важное решение, не собирая ситуацию заново.',
    'Build a focused review habit': 'Разбирайте отмеченное без лишнего поиска',
    'Review groups the hands and spots you marked to revisit or as mistakes, turning saved material into a focused study queue.': '«Разбор» собирает раздачи и споты, отмеченные для повторного просмотра или как ошибки, и превращает сохранённое в понятную учебную очередь.',
    'Move into the right tool': 'Переходите сразу к нужному инструменту',
    "Quick Start opens Riverline's main workspaces. Use it when you know whether you want to analyze, practise, calculate Equity, or build a personal range.": '«Быстрый старт» открывает основные разделы Riverline. Используйте его, когда уже знаете, хотите ли разобрать спот, потренироваться, рассчитать эквити или собрать личный рендж.',
  };

  const he = {
    'Inspect ranges and hypothetical cards': 'בדקו טווחים וקלפים היפותטיים',
    'Open Ranges & runouts to enter explicit weights or keep exact hands. Unknown combinations remain unknown; allow known-only Equity explicitly for a partial range. Inspect next cards or selected turn and river sequences, then focus a card to see the best five. Hand improvement and Equity improvement are separate facts.': 'פתחו טווחים וקלפי המשך כדי להזין משקלים מפורשים או לשמור ידיים מדויקות. צירופים לא ידועים נשארים לא ידועים; אשרו במפורש חישוב לפי החלק הידוע לטווח חלקי. בדקו קלף הבא או רצפי טרן וריבר נבחרים, והתמקדו בקלף כדי לראות את חמשת הטובים. שיפור היד ושיפור האקוויטי הם עובדות נפרדות.',
    'Tutorial': 'הדרכה',
    'Restart tutorial': 'הפעלת ההדרכה מחדש',
    'Guided tour available': 'זמינה הדרכה קצרה',
    'Start tutorial': 'התחלת ההדרכה',
    'Continue tutorial': 'המשך ההדרכה',
    'Skip': 'דילוג',
    'Back': 'הקודם',
    'Next': 'הבא',
    'Finish': 'סיום',
    'Step {current} of {total}': 'שלב {current} מתוך {total}',
    'A quick tour of Home': 'סיור קצר בדף הבית',
    'See how Home keeps useful study work close without turning it into another task list.': 'ראו כיצד דף הבית שומר את חומרי הלימוד החשובים בהישג יד, בלי להפוך לעוד רשימת משימות.',
    'Your study starts with context': 'הלימוד מתחיל עם הקשר',
    'Home brings saved study, review work, and the next useful action into one place, so returning to Riverline starts with context instead of setup.': 'דף הבית מרכז חומר שמור, פריטים לסקירה ואת הפעולה השימושית הבאה, כך שהחזרה ל-Riverline מתחילה מההקשר ולא מהגדרה מחדש.',
    'My Riverline shows your account identity, study sync, saved work, and next useful action without owning or recomputing that data.': 'Riverline שלי מציג את זהות החשבון, מצב הסנכרון, החומר השמור והפעולה השימושית הבאה בלי להיות הבעלים של הנתונים או לחשב אותם מחדש.',
    'Return to important decisions': 'חזרו להחלטות החשובות',
    'Saved hands and study spots appear in Recent so you can reopen decisions worth studying without rebuilding them.': 'ידיים וספוטים שמורים מופיעים באזור האחרונים, כדי לפתוח שוב החלטות שכדאי ללמוד בלי לבנות את המצב מחדש.',
    'Build a focused review habit': 'בנו הרגל סקירה ממוקד',
    'Review groups the hands and spots you marked to revisit or as mistakes, turning saved material into a focused study queue.': 'אזור הסקירה מרכז ידיים וספוטים שסימנתם לחזרה או כטעויות, והופך את החומר השמור לתור לימוד ממוקד.',
    'Move into the right tool': 'עברו לכלי המתאים',
    "Quick Start opens Riverline's main workspaces. Use it when you know whether you want to analyze, practise, calculate Equity, or build a personal range.": 'התחלה מהירה פותחת את סביבות העבודה המרכזיות של Riverline. השתמשו בה כשברור אם ברצונכם לנתח, לתרגל, לחשב אקוויטי או לבנות ריינג\' אישי.',
  };

  const expansionKeys = [
    'Keep personal strategy claims grounded',
    'Personal Strategy summarizes your direct Range Calibration work. Riverline stores those observations, but experimental sparse inference is not presented here as finished confidence or a production range source.',
    'Scenario basics',
    'Build a quick what-if decision without claiming a reconstructed hand history.',
    'Choose the right Playbook workflow',
    'Scenario is a fast, lossy study snapshot for exploring what-if decisions. Use Hand Mode instead when legal action history and canonical PokerState matter.',
    'Set the known cards',
    'Choose Hero cards, board cards, and any known dead cards. These inputs describe the study snapshot; they do not reconstruct how the hand reached it.',
    'Describe the objective spot',
    'Set table, stack, position, prior action, pot, and facing size to match the decision you want to study. Scenario values are supplied facts, not trusted call history.',
    'Read the recommendation with its source',
    'The action mix is Riverline’s current StrategyProvider result. Keep the source and provenance visible: heuristic guidance is useful study input, not solved GTO or proof of an optimum.',
    'Place the decision in context',
    'Use Decision for the exact spot, Range Matrix for surrounding preflop hand classes, and Range Category Comparison for a coarse descriptive board comparison.',
    'Save the study snapshot',
    'Save Spot preserves this Scenario for later review. Reopening it restores the supplied decision facts, but Riverline does not invent canonical history or Replay for a Scenario-derived spot.',
    'A reopened Scenario stays a snapshot',
    'This banner marks a restored study spot. Its Scenario facts are available again, while canonical action history remains unavailable.',
    'Hand Mode essentials',
    'Start and progress a legal canonical hand, then save or replay its history.',
    'Hand Mode owns legal progression',
    'Hand Mode advances canonical PokerState through dealt cards and legal actions. Unlike Scenario, its stacks, contributions, pot, actor, and history come from the real hand state.',
    'Start the canonical hand',
    'Choose seats, stacks, button, Hero, and forced contributions, then start. Riverline establishes the initial state before any decision controls become available.',
    'Follow trusted table facts',
    'Street, current actor, pot, player stacks, and contributions are projections of canonical state. Use them to understand whose legal decision is next.',
    'Deal cards and take legal actions',
    'Only controls valid for the current phase are shown. Dealing and betting progress the hand street by street; the tutorial never submits a poker action for you.',
    'Replay grows with the hand',
    'Actions and chance events are added to a read-only timeline as the hand progresses. Replay projects earlier states without mutating the live PokerState.',
    'Preserve canonical history',
    'Save Hand stores the durable canonical snapshot and replay source when available. The saved viewer can be opened later without replacing a separate live hand.',
    'Using Replay',
    'Inspect canonical actions and chance events without changing the live hand.',
    'This saved hand is read-only',
    'The viewer reconstructs durable canonical hand history. Any separate live Hand Mode session is preserved and can be returned to independently.',
    'Read the canonical timeline',
    'The timeline records betting actions and chance events by street. It is a historical projection, not a second poker-state authority.',
    'Move through history',
    'Previous and Next step deterministically through available frames. Play and Pause advance the same read-only cursor at a restrained pace.',
    'Return to the correct endpoint',
    'Return to live restores the current live decision; in a saved viewer it returns to the saved endpoint. Neither path rewrites canonical history.',
    'Analysis remains tied to the live decision',
    'While an earlier Replay frame is displayed, current Strategy and Analysis remain tied to the live or saved decision endpoint. Do not read them as recommendations for every historical frame.',
    'Understanding Playbook analysis',
    'Interpret the current recommendation, Matrix, and coarse category comparison truthfully.',
    'Choose the question you are asking',
    'Decision explains the selected spot, Range Matrix adds preflop surrounding-range context, and Range Category Comparison describes fixed heuristic samples on a board.',
    'Start with the exact decision',
    'Read the recommendation mix together with trusted context facts, explanation, warnings, and provider provenance. Current Analysis explains the present result; it cannot prove universal optimality or exploitability.',
    'See the surrounding preflop range',
    'The 13×13 Matrix organizes pairs, suited hands, and offsuit hands. Cell tint shows the dominant action and its band shows the full provider mix; cells are not claimed as independently solver-resolved.',
    'Inspect one hand class',
    'Select a cell to read its exact action frequencies in the inspector. Full postflop range expansion is unavailable when the current source cannot provide it.',
    'Compare coarse hand categories',
    'This view compares fixed heuristic preflop samples by made-hand and draw category on the supplied board. It supplements the spot; it is not weighted range-versus-range analysis.',
    'Equity calculator basics',
    'Supply known and unknown cards, calculate, and interpret outcome share.',
    'Describe the players',
    'Add opponents and mark each hand known or unknown. Known hands need two cards; unknown hands are sampled or enumerated from the remaining deck.',
    'Set board and dead cards',
    'Enter zero to five board cards in deal order and exclude any known dead or burnt cards. Incomplete boards leave future runouts to the calculation.',
    'Choose a truthful calculation method',
    'Auto uses exact enumeration when practical and Monte Carlo otherwise. Exact visits every supported realization; Monte Carlo is a seeded estimate whose sample count controls precision.',
    'Calculate or cancel safely',
    'Readiness explains missing inputs. Start when the scenario is valid; progress reflects real work, and Cancel stops the run without clearing your cards.',
    'Interpret Equity, Win, and Tie',
    'Equity is outcome share under the supplied known and assumed cards, including split pots. It is useful evidence, but it is not by itself a complete strategy recommendation.',
    'Advanced Equity controls',
    'Use multiway, dead-card, method, progress, and reproducibility controls.',
    'Model multiway uncertainty',
    'Use two to ten players and mix known with unknown hands. More players and missing cards increase the realization space and may make simulation the practical method.',
    'Exclude information you actually know',
    'Dead or burnt cards are removed from every remaining hand and runout. Add them only when they are genuinely known.',
    'Reuse a Monte Carlo seed when needed',
    'Advanced settings let you keep or reroll a seed. Reusing the same seed makes a simulated calculation reproducible; it does not make the estimate exact.',
    'Check method provenance in the result',
    'The result identifies the actual method, workload, samples, seed, and ties. Use those facts when comparing exact and simulated outcomes.',
    'Your first Training spot',
    'Generate a legal decision, answer before feedback, and continue the drill.',
    'Choose a focused drill',
    'Select the important decision family, street, position, and assistance level, then generate a reachable legal spot. Filters shape the drill without changing poker rules.',
    'Read the spot before answering',
    'Hero cards, board, pot, stack, position, and facing action come from the generated canonical trajectory. Form your answer before Riverline reveals its reference.',
    'Choose one legal action',
    'Only legal actions are offered. Your answer is compared once with Riverline’s current StrategyResult according to the Training contract.',
    'Use hints as coaching prompts',
    'Optional hints reveal one prompt at a time without exposing the full reference strategy before your answer.',
    'Continue the workflow',
    'After review, generate the next exercise or adjust the drill. Session progress summarizes this browser run; it is not a future mistake-history or spaced-review system.',
    'Understanding Training feedback',
    'Read the verdict, reference frequencies, explanation, and next action after answering.',
    'Interpret the grade narrowly',
    '“Correct” means your answer matched Riverline’s current reference under the Training grading contract. It is not a claim of mathematically proven universal optimality.',
    'Compare with the displayed source',
    'Reference frequencies come from the named strategy source. They show its mix and do not imply EV loss, solver accuracy, or confidence percentages.',
    'Use the explanation to review the spot',
    'The shared Analysis organizes trusted hand facts and reasons behind the current result. Treat it as study guidance from the current authority, with the same provenance limits.',
    'Apply the review, then move on',
    'Generate the next spot once you understand the mismatch or agreement. Replay can revisit this generated trajectory without turning the session into saved mistake history.',
    'Range Calibration setup',
    'Define the real environment, three named modes, and objective RFI context.',
    'Teach direct observations, not inferred confidence',
    'Range Calibration stores how you say you play specific RFI hands. The experimental sparse-inference research is not presented here as a finished user-facing range or confidence system.',
    'Name a real poker environment',
    'A Profile represents a recognizable game or player-pool identity. Each Profile has exactly three discrete Modes named in your own words; they are not points on a numeric style slider.',
    'Choose objective RFI facts',
    'Set environment, table size, Hero position, effective stack, and accounting for an unopened preflop range. These facts identify the direct range you are calibrating.',
    'Start a bounded direct-answer session',
    'Answer only as much as is useful and pause whenever needed. The 169-hand loop is a direct calibration fallback, not the product’s claim about an ideal learning journey.',
    'Answering and exact mixes',
    'Record dominant actions, optional exact frequencies, and resumable direct progress.',
    'Answer for the named Profile and Mode',
    'The displayed hand belongs to the selected real environment, Mode, and RFI context. Choose what best represents that identity, not a generic poker answer.',
    'Quick answers mean dominant action',
    'Fold or Raise records the preferred or dominant action for this hand. It never means the action is played at a pure 100% frequency.',
    'Use exact mixes only when you know them',
    'Set Frequencies stores an explicit Fold/Raise mix separately from a quick answer. An exact tie is valid and has no dominant action.',
    'Progress records direct observations',
    'Every accepted answer is saved before the next hand. Progress counts direct answers for this exact range; it is not inferred coverage or confidence.',
    'Pause, resume, or undo safely',
    'Pause returns to context without discarding saved answers, and Undo removes the immediately previous direct observation when available.',
    'Settings essentials',
    'Adjust language, theme, cards, and sound without touring every toggle.',
    'Preferences change presentation',
    'Settings controls presentation rather than poker state. Language is available from the global rail; this dialog groups theme, card, and sound preferences.',
    'Choose theme and card presentation',
    'Choose an immutable built-in theme or a named custom theme. Riverline preserves exact accent, surface, and table colors while deriving readable dependent colors; density, layout, card IDs, and poker calculations stay independent.',
    'Authentication is not cloud sync',
    'Sign-in links a provider identity to a Riverline identity. Study data remains on this device until a later explicit cloud-sync feature says otherwise.',
    'Keep sound under your control',
    'Sound effects can be disabled here or from the rail. Tutorial motion continues to respect the system reduced-motion preference.',
  ];

  const expansionRu = [
    'Не преувеличивайте возможности личной стратегии',
    '«Личная стратегия» суммирует ваши прямые ответы в калибровке. Riverline хранит их, но экспериментальный разреженный вывод не выдаётся за готовую уверенность или рабочий источник ренджа.',
    'Основы режима «Сценарий»',
    'Быстро соберите решение «что, если», не заявляя о восстановленной истории раздачи.',
    'Выберите подходящий режим Playbook',
    '«Сценарий» — быстрый, неполный снимок для вопросов «что, если». Если важны легальная история действий и канонический PokerState, используйте режим раздачи.',
    'Укажите известные карты',
    'Выберите карты Героя, борд и известные мёртвые карты. Они описывают снимок, но не восстанавливают путь раздачи к нему.',
    'Опишите объективный спот',
    'Задайте стол, стек, позицию, предыдущее действие, банк и размер ставки. Это введённые факты, а не достоверная история коллов.',
    'Читайте рекомендацию вместе с источником',
    'Микс действий — текущий результат StrategyProvider Riverline. Эвристика полезна для учёбы, но это не решённый GTO и не доказательство оптимума.',
    'Рассмотрите решение в контексте',
    '«Решение» показывает точный спот, матрица — соседние префлоп-классы, а сравнение категорий — грубое описание борда.',
    'Сохраните учебный снимок',
    '«Сохранить спот» оставляет сценарий для разбора. При открытии факты вернутся, но Riverline не выдумывает каноническую историю или Replay.',
    'Открытый сценарий остаётся снимком',
    'Эта плашка отмечает восстановленный спот. Факты сценария доступны, каноническая история действий — нет.',
    'Основы режима раздачи',
    'Начните и проведите легальную каноническую раздачу, затем сохраните или просмотрите её историю.',
    'Легальный ход раздачи задаёт режим Hand',
    'Режим Hand развивает канонический PokerState через карты и легальные действия. Стеки, вклады, банк, актёр и история берутся из реального состояния.',
    'Начните каноническую раздачу',
    'Выберите места, стеки, баттон, Героя и обязательные взносы. Riverline создаст исходное состояние до появления решений.',
    'Следите за достоверными фактами стола',
    'Улица, актёр, банк, стеки и вклады — проекции канонического состояния. По ним видно, чьё легальное решение следующее.',
    'Раздавайте карты и совершайте легальные действия',
    'Показаны только допустимые сейчас элементы. Карты и ставки ведут раздачу по улицам; обучение никогда не действует за вас.',
    'Replay растёт вместе с раздачей',
    'Действия и случайные события входят в хронологию только для чтения. Replay показывает прошлые состояния, не меняя живой PokerState.',
    'Сохраните каноническую историю',
    '«Сохранить раздачу» хранит канонический снимок и источник Replay. Позже просмотр можно открыть, не заменяя отдельную живую раздачу.',
    'Работа с Replay',
    'Изучайте канонические действия и случайные события, не меняя живую раздачу.',
    'Сохранённая раздача доступна только для чтения',
    'Просмотр восстанавливает долговечную каноническую историю. Отдельная живая сессия Hand сохраняется и доступна независимо.',
    'Читайте каноническую хронологию',
    'Хронология записывает ставки и случайные события по улицам. Это историческая проекция, а не второй авторитет состояния.',
    'Перемещайтесь по истории',
    '«Назад» и «Далее» детерминированно меняют кадры. «Воспроизвести» и «Пауза» двигают тот же курсор только для чтения.',
    'Вернитесь к правильной конечной точке',
    'Возврат в live восстанавливает текущее решение, а в сохранённом просмотре — сохранённую конечную точку. История не переписывается.',
    'Анализ остаётся привязан к живому решению',
    'При показе раннего кадра Strategy и Analysis относятся к живой или сохранённой конечной точке, а не к каждому кадру истории.',
    'Как понимать анализ Playbook',
    'Корректно трактуйте рекомендацию, матрицу и грубое сравнение категорий.',
    'Выберите свой вопрос',
    '«Решение» объясняет спот, матрица добавляет префлоп-контекст, а сравнение категорий описывает фиксированные эвристические выборки на борде.',
    'Начните с точного решения',
    'Читайте микс вместе с фактами, объяснением, предупреждениями и происхождением источника. Анализ не доказывает всеобщую оптимальность или эксплойтабельность.',
    'Посмотрите окружающий префлоп-рендж',
    'Матрица 13×13 размещает пары, одномастные и разномастные руки. Оттенок показывает главное действие, полоса — весь микс; независимое solver-решение ячеек не заявляется.',
    'Изучите один класс рук',
    'Выберите ячейку для точных частот. Полный постфлоп-рендж недоступен, если текущий источник его не предоставляет.',
    'Сравните грубые категории рук',
    'Вид сравнивает фиксированные эвристические префлоп-выборки по готовым рукам и дро. Это не взвешенный анализ рендж против ренджа.',
    'Основы калькулятора эквити',
    'Укажите известные и неизвестные карты, рассчитайте и прочитайте долю исходов.',
    'Опишите игроков',
    'Добавьте соперников и отметьте известные/неизвестные руки. Известной нужны две карты; неизвестная берётся из оставшейся колоды.',
    'Задайте борд и мёртвые карты',
    'Введите от нуля до пяти карт борда по порядку и исключите известные мёртвые карты. Недостающие улицы рассчитываются как будущие ранауты.',
    'Выберите честный метод расчёта',
    'Auto использует точный перебор, когда это практично, иначе Monte Carlo. Точный метод перебирает все реализации, симуляция даёт оценку по заданному числу выборок.',
    'Безопасно запускайте и отменяйте расчёт',
    'Готовность укажет недостающие данные. Прогресс отражает реальную работу, а отмена останавливает её, не очищая карты.',
    'Трактуйте Equity, Win и Tie',
    'Эквити — доля исходов при заданных картах и предположениях, включая делёж банка. Это данные, но не полная стратегическая рекомендация.',
    'Расширенные настройки эквити',
    'Используйте мультивей, мёртвые карты, метод, прогресс и воспроизводимость.',
    'Моделируйте мультивей-неопределённость',
    'Задайте от двух до десяти игроков с известными и неизвестными руками. Больше игроков и пропусков расширяют пространство, поэтому симуляция может быть практичнее.',
    'Исключайте только реально известное',
    'Мёртвые карты удаляются из всех рук и ранаутов. Добавляйте их только при достоверном знании.',
    'При необходимости повторяйте seed Monte Carlo',
    'В расширенных настройках seed можно сохранить или сменить. Одинаковый seed делает симуляцию воспроизводимой, но не точной.',
    'Проверьте происхождение метода в результате',
    'Результат показывает фактический метод, объём, выборки, seed и ничьи. Учитывайте это при сравнении точного и simulated результата.',
    'Ваш первый спот в Training',
    'Создайте легальное решение, ответьте до подсказки и продолжите тренировку.',
    'Выберите целевую тренировку',
    'Задайте семейство решений, улицу, позицию и помощь, затем создайте достижимый легальный спот. Фильтры не меняют правил покера.',
    'Прочитайте спот до ответа',
    'Карты, борд, банк, стек, позиция и ставка взяты из канонической траектории. Сформулируйте ответ до показа эталона Riverline.',
    'Выберите одно легальное действие',
    'Показаны только легальные варианты. Ответ один раз сравнивается с текущим StrategyResult по контракту Training.',
    'Используйте подсказки как ориентиры',
    'Необязательные подсказки дают по одному направляющему вопросу, не раскрывая полный эталон до ответа.',
    'Продолжайте рабочий цикл',
    'После разбора создайте следующее упражнение или измените тренировку. Прогресс относится к этой сессии браузера, а не к будущей истории ошибок.',
    'Как понимать обратную связь Training',
    'После ответа прочитайте вердикт, эталонные частоты, объяснение и следующий шаг.',
    'Трактуйте оценку узко',
    '«Верно» означает совпадение с текущим эталоном Riverline по контракту Training, а не математически доказанную универсальную оптимальность.',
    'Сравните с показанным источником',
    'Частоты приходят из названного источника стратегии. Они не означают потерю EV, точность solver или процент уверенности.',
    'Используйте объяснение для разбора',
    'Общий Analysis собирает достоверные факты и причины текущего результата. Это учебная помощь с теми же ограничениями происхождения.',
    'Примените разбор и двигайтесь дальше',
    'После понимания совпадения или ошибки создайте новый спот. Replay вернёт траекторию, но не создаёт сохранённую историю ошибок.',
    'Настройка Range Calibration',
    'Определите реальную среду, три именованных режима и объективный контекст RFI.',
    'Обучайте прямым ответам, а не мнимой уверенности',
    'Range Calibration хранит ваши ответы для конкретных RFI-рук. Экспериментальный разреженный вывод не показан как готовый рендж или система уверенности.',
    'Назовите реальную покерную среду',
    'Профиль — узнаваемая игра или пул. В нём ровно три дискретных режима с вашими названиями, а не точки числового слайдера.',
    'Выберите объективные факты RFI',
    'Задайте среду, стол, позицию Героя, эффективный стек и учёт для неоткрытого префлоп-ренджа. Они определяют калибруемый прямой рендж.',
    'Начните ограниченную сессию прямых ответов',
    'Отвечайте столько, сколько полезно, и ставьте на паузу. Цикл из 169 рук — резервный прямой процесс, а не идеальная учебная модель.',
    'Ответы и точные миксы',
    'Записывайте доминирующие действия, необязательные точные частоты и возобновляемый прогресс.',
    'Отвечайте для выбранных Профиля и Режима',
    'Рука относится к выбранной среде, Режиму и RFI-контексту. Отвечайте за эту идентичность, а не за абстрактный покер.',
    'Быстрый ответ означает доминирующее действие',
    'Fold или Raise записывает предпочтительное действие. Это никогда не означает чистую частоту 100%.',
    'Указывайте точный микс только когда знаете его',
    '«Задать частоты» хранит явный микс Fold/Raise отдельно от быстрого ответа. Точная ничья допустима и не имеет доминирующего действия.',
    'Прогресс считает прямые наблюдения',
    'Ответ сохраняется до следующей руки. Прогресс считает прямые ответы для этого ренджа, а не выведенное покрытие или уверенность.',
    'Безопасно ставьте на паузу, продолжайте и отменяйте',
    'Пауза возвращает к контексту без потери ответов, а Undo удаляет последнее прямое наблюдение, если оно есть.',
    'Основные настройки',
    'Настройте язык, тему, карты и звук без тура по каждому переключателю.',
    'Настройки меняют представление',
    'Настройки не меняют покерное состояние. Язык доступен на общей панели, а здесь собраны тема, карты и звук.',
    'Выберите тему и вид карт',
    'Выберите неизменяемую встроенную тему или именованную пользовательскую тему. Riverline сохраняет точные цвета акцента, поверхностей и стола, одновременно подбирая читаемые зависимые цвета; плотность, компоновка, идентификаторы карт и покерные расчёты остаются независимыми.',
    'Аутентификация — не облачная синхронизация',
    'Вход связывает идентичность провайдера с идентичностью Riverline. Учебные данные остаются на этом устройстве до появления отдельной явной функции облачной синхронизации.',
    'Управляйте звуком',
    'Эффекты отключаются здесь или на панели. Движение обучения продолжает учитывать системную настройку уменьшения анимации.',
  ];

  const expansionHe = [
    'שמרו על טענות מדויקות לגבי אסטרטגיה אישית',
    'האסטרטגיה האישית מסכמת תשובות ישירות מכיול הטווח. Riverline שומרת אותן, אך ההסקה הדלילה הניסיונית אינה מוצגת כביטחון מוגמר או כמקור טווח פעיל.',
    'יסודות מצב תרחיש',
    'בנו במהירות החלטת “מה אם” בלי לטעון ששוחזרה היסטוריית יד.',
    'בחרו את תהליך העבודה המתאים ב-Playbook',
    'תרחיש הוא תמונת לימוד מהירה וחלקית לשאלות “מה אם”. כשחשובים רצף חוקי ו-PokerState קנוני, השתמשו במצב יד.',
    'הגדירו את הקלפים הידועים',
    'בחרו קלפי Hero, לוח וקלפים מתים ידועים. הקלט מתאר תמונת מצב ואינו משחזר כיצד היד הגיעה אליה.',
    'תארו את הספוט העובדתי',
    'הגדירו שולחן, ערימה, עמדה, פעולה קודמת, קופה וגודל שמולכם. אלה עובדות שהוזנו, לא היסטוריית תשלומים מהימנה.',
    'קראו את ההמלצה יחד עם המקור',
    'תמהיל הפעולות הוא תוצאת StrategyProvider הנוכחית. היוריסטיקה מועילה ללימוד, אך אינה GTO פתור או הוכחת אופטימום.',
    'מקמו את ההחלטה בהקשר',
    'Decision מציג את הספוט המדויק, Matrix מוסיף הקשר לידיים סמוכות בפרה-פלופ, והשוואת קטגוריות נותנת תיאור גס על הלוח.',
    'שמרו את תמונת הלימוד',
    'Save Spot שומר את התרחיש לעיון. פתיחה מחדש מחזירה את העובדות, אך Riverline אינה ממציאה היסטוריה קנונית או Replay.',
    'תרחיש שנפתח מחדש נשאר תמונת מצב',
    'הכרזה מסמנת ספוט ששוחזר. עובדות התרחיש זמינות, אך היסטוריית פעולות קנונית אינה זמינה.',
    'יסודות מצב יד',
    'התחילו וקידמו יד קנונית חוקית, ואז שמרו או נגנו את ההיסטוריה שלה.',
    'מצב יד אחראי להתקדמות החוקית',
    'מצב יד מקדם PokerState קנוני דרך קלפים ופעולות חוקיות. הערימות, התרומות, הקופה, השחקן וההיסטוריה באים מהמצב האמיתי.',
    'התחילו את היד הקנונית',
    'בחרו מושבים, ערימות, כפתור, Hero ותשלומי חובה. Riverline יוצרת את המצב ההתחלתי לפני שבקרי החלטה זמינים.',
    'עקבו אחר עובדות שולחן מהימנות',
    'הרחוב, השחקן הנוכחי, הקופה, הערימות והתרומות הם הקרנה של המצב הקנוני ומראים מי מחליט כחוק כעת.',
    'חלקו קלפים ובצעו פעולות חוקיות',
    'מוצגים רק בקרים חוקיים לשלב הנוכחי. חלוקה והימורים מקדמים רחוב אחר רחוב; ההדרכה לעולם אינה פועלת במקומכם.',
    'Replay גדל עם היד',
    'פעולות ואירועי מזל מתווספים לציר זמן לקריאה בלבד. Replay מקרין מצבים קודמים בלי לשנות PokerState חי.',
    'שמרו היסטוריה קנונית',
    'Save Hand שומר תמונה קנונית ומקור Replay. אפשר לפתוח את הצופה מאוחר יותר בלי להחליף יד חיה נפרדת.',
    'שימוש ב-Replay',
    'בדקו פעולות קנוניות ואירועי מזל בלי לשנות את היד החיה.',
    'היד השמורה היא לקריאה בלבד',
    'הצופה משחזר היסטוריית יד קנונית ועמידה. הפעלת Hand חיה נפרדת נשמרת וניתן לחזור אליה בנפרד.',
    'קראו את ציר הזמן הקנוני',
    'ציר הזמן מתעד פעולות הימור ואירועי מזל לפי רחוב. זו הקרנה היסטורית, לא סמכות מצב שנייה.',
    'נועו לאורך ההיסטוריה',
    'Previous ו-Next עוברים באופן דטרמיניסטי בין מסגרות. Play ו-Pause מקדמים את אותו סמן לקריאה בלבד.',
    'חזרו לנקודת הקצה הנכונה',
    'Return to live מחזיר להחלטה החיה; בצופה שמור הוא מחזיר לקצה השמור. אף נתיב אינו משכתב היסטוריה.',
    'הניתוח נשאר קשור להחלטה החיה',
    'בעת הצגת מסגרת מוקדמת, Strategy ו-Analysis שייכים לנקודת ההחלטה החיה או השמורה, לא לכל מסגרת היסטורית.',
    'הבנת הניתוח ב-Playbook',
    'פרשו נכון את ההמלצה, המטריצה והשוואת הקטגוריות הגסה.',
    'בחרו איזו שאלה אתם שואלים',
    'Decision מסביר את הספוט, Matrix מוסיף הקשר פרה-פלופ, והשוואת קטגוריות מתארת דגימות היוריסטיות קבועות על לוח.',
    'התחילו בהחלטה המדויקת',
    'קראו את התמהיל עם העובדות, ההסבר, האזהרות ומקור הספק. Analysis מסביר תוצאה נוכחית ואינו מוכיח אופטימליות או exploitability כללית.',
    'ראו את טווח הפרה-פלופ הסובב',
    'מטריצת 13×13 מסדרת זוגות, ידיים suited ו-offsuited. הגוון מציג פעולה דומיננטית והפס את התמהיל המלא; אין טענה שכל תא נפתר עצמאית.',
    'בדקו מחלקת יד אחת',
    'בחרו תא כדי לקרוא תדירויות מדויקות. הרחבת טווח מלאה בפוסט-פלופ אינה זמינה כשהמקור אינו מספק אותה.',
    'השוו קטגוריות יד גסות',
    'התצוגה משווה דגימות פרה-פלופ היוריסטיות קבועות לפי יד מוכנה ודרו. זה אינו ניתוח משוקלל טווח מול טווח.',
    'יסודות מחשבון האקוויטי',
    'הזינו קלפים ידועים ולא ידועים, חשבו ופרשו את חלק התוצאות.',
    'תארו את השחקנים',
    'הוסיפו יריבים וסמנו כל יד כידועה או לא. יד ידועה דורשת שני קלפים; יד לא ידועה נלקחת מהחפיסה הנותרת.',
    'הגדירו לוח וקלפים מתים',
    'הזינו אפס עד חמישה קלפי לוח לפי הסדר והוציאו קלפים מתים ידועים. לוח חלקי משאיר runouts עתידיים לחישוב.',
    'בחרו שיטת חישוב אמינה',
    'Auto משתמש במנייה מדויקת כשמעשי וב-Monte Carlo אחרת. Exact מבקר בכל מימוש נתמך; Monte Carlo הוא אומדן עם seed ומספר דגימות.',
    'חשבו או בטלו בבטחה',
    'מצב המוכנות מסביר קלט חסר. ההתקדמות משקפת עבודה אמיתית, ו-Cancel עוצר בלי לנקות את הקלפים.',
    'פרשו Equity, Win ו-Tie',
    'אקוויטי הוא חלק התוצאה תחת הקלפים וההנחות שסופקו, כולל קופה מפוצלת. זו ראיה שימושית, לא המלצת אסטרטגיה מלאה.',
    'בקרי אקוויטי מתקדמים',
    'השתמשו במולטי-וויי, קלפים מתים, שיטה, התקדמות ושחזור.',
    'דגמו אי-ודאות במולטי-וויי',
    'הגדירו שניים עד עשרה שחקנים עם ידיים ידועות ולא ידועות. יותר שחקנים וקלפים חסרים מגדילים את המרחב ועשויים להצדיק סימולציה.',
    'הוציאו רק מידע שידוע באמת',
    'קלפים מתים מוצאים מכל יד ו-runout נותרים. הוסיפו אותם רק כשהם ידועים בוודאות.',
    'השתמשו שוב ב-seed של Monte Carlo לפי הצורך',
    'בהגדרות המתקדמות אפשר לשמור או להחליף seed. שימוש חוזר משחזר סימולציה, אך אינו הופך אותה למדויקת.',
    'בדקו את מקור השיטה בתוצאה',
    'התוצאה מזהה שיטה בפועל, עומס, דגימות, seed ותיקו. השתמשו בכך בהשוואת תוצאות מדויקות ומדומות.',
    'ספוט ה-Training הראשון שלכם',
    'צרו החלטה חוקית, ענו לפני המשוב והמשיכו בתרגול.',
    'בחרו תרגול ממוקד',
    'בחרו משפחת החלטות, רחוב, עמדה ורמת סיוע, ואז צרו ספוט חוקי ובר-השגה. המסננים אינם משנים את חוקי הפוקר.',
    'קראו את הספוט לפני המענה',
    'קלפי Hero, הלוח, הקופה, הערימה, העמדה והפעולה שמולכם באים ממסלול קנוני. גבשו תשובה לפני חשיפת המקור.',
    'בחרו פעולה חוקית אחת',
    'מוצגות רק פעולות חוקיות. התשובה מושווית פעם אחת ל-StrategyResult הנוכחי לפי חוזה Training.',
    'השתמשו ברמזים כשאלות מכוונות',
    'רמזים אופציונליים חושפים הכוונה אחת בכל פעם בלי לחשוף את אסטרטגיית המקור המלאה לפני המענה.',
    'המשיכו בתהליך',
    'לאחר הסקירה צרו תרגיל חדש או התאימו את התרגול. התקדמות ההפעלה אינה מערכת עתידית של היסטוריית טעויות או חזרה מרווחת.',
    'הבנת משוב Training',
    'לאחר המענה קראו את הפסיקה, התדירויות, ההסבר והפעולה הבאה.',
    'פרשו את הציון באופן צר',
    '“נכון” פירושו התאמה למקור Riverline הנוכחי לפי חוזה Training, לא אופטימליות אוניברסלית שהוכחה מתמטית.',
    'השוו למקור המוצג',
    'התדירויות מגיעות ממקור האסטרטגיה הנקוב. הן אינן מרמזות על הפסד EV, דיוק solver או אחוז ביטחון.',
    'השתמשו בהסבר לסקירת הספוט',
    'Analysis המשותף מארגן עובדות מהימנות וסיבות לתוצאה. התייחסו אליו כהכוונת לימוד עם אותן מגבלות מקור.',
    'יישמו את הסקירה והמשיכו',
    'אחרי שהבנתם התאמה או פער, צרו ספוט חדש. Replay יכול להחזיר את המסלול בלי ליצור היסטוריית טעויות שמורה.',
    'הגדרת Range Calibration',
    'הגדירו סביבה אמיתית, שלושה מצבים בעלי שם והקשר RFI עובדתי.',
    'למדו תצפיות ישירות, לא ביטחון מוסק',
    'Range Calibration שומר כיצד אמרתם שאתם משחקים ידיים מסוימות ב-RFI. המחקר הדליל אינו מוצג כטווח מוגמר או כמערכת ביטחון.',
    'תנו שם לסביבת פוקר אמיתית',
    'Profile מייצג משחק או מאגר שחקנים מזוהה. בכל Profile בדיוק שלושה Modes נפרדים בשמות שלכם, לא נקודות על מחוון מספרי.',
    'בחרו עובדות RFI אובייקטיביות',
    'הגדירו סביבה, גודל שולחן, עמדת Hero, ערימה אפקטיבית וחשבונאות לטווח פרה-פלופ שלא נפתח. אלה מזהים את הטווח הישיר.',
    'התחילו הפעלת תשובות ישירות תחומה',
    'ענו רק ככל שמועיל ועצרו כשצריך. לולאת 169 הידיים היא תהליך ישיר חלופי, לא טענה למסע לימוד אידאלי.',
    'מענה ותמהילים מדויקים',
    'שמרו פעולות דומיננטיות, תדירויות מדויקות אופציונליות והתקדמות ישירה שניתן לחדש.',
    'ענו עבור ה-Profile וה-Mode הנבחרים',
    'היד שייכת לסביבה, ל-Mode ולהקשר RFI שנבחרו. בחרו את שמייצג זהות זו, לא תשובת פוקר כללית.',
    'תשובה מהירה פירושה פעולה דומיננטית',
    'Fold או Raise שומר את הפעולה המועדפת ליד. לעולם אין פירושו תדירות טהורה של 100%.',
    'השתמשו בתמהיל מדויק רק כשאתם יודעים אותו',
    'Set Frequencies שומר תמהיל Fold/Raise מפורש בנפרד מתשובה מהירה. תיקו מדויק תקין ואין לו פעולה דומיננטית.',
    'ההתקדמות סופרת תצפיות ישירות',
    'כל תשובה נשמרת לפני היד הבאה. ההתקדמות סופרת תשובות ישירות לטווח זה, לא כיסוי מוסק או ביטחון.',
    'עצרו, חדשו או בטלו בבטחה',
    'Pause מחזיר להקשר בלי למחוק תשובות, ו-Undo מסיר את התצפית הישירה הקודמת כשהיא זמינה.',
    'יסודות ההגדרות',
    'התאימו שפה, ערכת נושא, קלפים וצליל בלי לסייר בכל מתג.',
    'העדפות משנות את התצוגה',
    'ההגדרות אינן משנות מצב פוקר. השפה זמינה בסרגל הכללי, ובחלון זה מרוכזים ערכת נושא, קלפים וצליל.',
    'בחרו ערכת נושא ותצוגת קלפים',
    'בחרו ערכת נושא מובנית שאינה ניתנת לשינוי או ערכת נושא מותאמת אישית עם שם. Riverline שומר את הצבעים המדויקים של ההדגשה, המשטחים והשולחן ובו בזמן גוזר צבעים נלווים קריאים; הצפיפות, הפריסה, מזהי הקלפים וחישובי הפוקר נשארים בלתי תלויים.',
    'אימות אינו סנכרון לענן',
    'הכניסה מקשרת זהות ספק לזהות Riverline. נתוני הלימוד נשארים במכשיר עד שתכונת סנכרון ענן מפורשת תציין אחרת.',
    'שמרו את הצליל בשליטתכם',
    'אפשר לכבות אפקטים כאן או בסרגל. תנועת ההדרכה ממשיכה לכבד את העדפת המערכת להפחתת תנועה.',
  ];

  if (expansionKeys.length !== expansionRu.length || expansionKeys.length !== expansionHe.length) {
    throw new Error('Tutorial translation expansion is incomplete');
  }
  expansionKeys.forEach((key, index) => {
    en[key] = key;
    ru[key] = expansionRu[index];
    he[key] = expansionHe[index];
  });
  Object.assign(en, {
    'Tutorials': 'Tutorials',
    'Choose a tutorial for this workspace.': 'Choose a tutorial for this workspace.',
    'Close tutorials': 'Close tutorials',
  });
  Object.assign(ru, {
    'Tutorials': 'Обучение',
    'Choose a tutorial for this workspace.': 'Выберите обучение для текущего раздела.',
    'Close tutorials': 'Закрыть список обучения',
  });
  Object.assign(he, {
    'Tutorials': 'הדרכות',
    'Choose a tutorial for this workspace.': 'בחרו הדרכה לסביבת העבודה הנוכחית.',
    'Close tutorials': 'סגירת רשימת ההדרכות',
  });

  Object.assign(en, {
    'Define the real environment, choose a question goal, and let current evidence guide the session.': 'Define the real environment, choose a question goal, and let current evidence guide the session.',
    'Riverline chooses informative hands': 'Riverline chooses informative hands',
    'Riverline selects high-value hands from current direct evidence and the derived uncertainty model. You do not need to answer all 169; direct answers remain yours.': 'Riverline selects high-value hands from current direct evidence and the derived uncertainty model. You do not need to answer all 169; direct answers remain yours.',
    'Choose a session depth': 'Choose a session depth',
    'Quick, Standard, and Deep are question-count goals. Pause anytime; Riverline recomputes the next question from saved evidence when you resume.': 'Quick, Standard, and Deep are question-count goals. Pause anytime; Riverline recomputes the next question from saved evidence when you resume.',
    'Answer adaptive questions, add exact frequencies when useful, and keep direct evidence distinct from inference.': 'Answer adaptive questions, add exact frequencies when useful, and keep direct evidence distinct from inference.',
    'See why each hand matters': 'See why each hand matters',
    'The reason points to a boundary, sparse region, nearby disagreement, or coverage gain. It explains question value, not poker confidence.': 'The reason points to a boundary, sparse region, nearby disagreement, or coverage gain. It explains question value, not poker confidence.',
    'Read progress by category': 'Read progress by category',
    'Direct, inferred-high, inferred-medium, uncertain, conflicting, and unknown stay separate. These counts are coverage facts, not a confidence percentage.': 'Direct, inferred-high, inferred-medium, uncertain, conflicting, and unknown stay separate. These counts are coverage facts, not a confidence percentage.',
    'Pause, stop, skip, or undo safely': 'Pause, stop, skip, or undo safely',
    'Pause preserves the session, Stop ends it, and Skip or I’m not sure records no poker evidence. Undo retracts the immediately previous direct observation when available.': 'Pause preserves the session, Stop ends it, and Skip or I’m not sure records no poker evidence. Undo retracts the immediately previous direct observation when available.',
  });
  Object.assign(ru, {
    'Define the real environment, choose a question goal, and let current evidence guide the session.': 'Определите реальную игровую среду, выберите объём вопросов и позвольте текущим данным направлять сессию.',
    'Riverline chooses informative hands': 'Riverline выбирает информативные руки',
    'Riverline selects high-value hands from current direct evidence and the derived uncertainty model. You do not need to answer all 169; direct answers remain yours.': 'Riverline выбирает наиболее полезные руки по текущим прямым ответам и производной модели неопределённости. Не нужно отвечать на все 169 рук; ваши прямые ответы остаются вашими.',
    'Choose a session depth': 'Выберите объём сессии',
    'Quick, Standard, and Deep are question-count goals. Pause anytime; Riverline recomputes the next question from saved evidence when you resume.': 'Quick, Standard и Deep задают целевое число вопросов. Сессию можно приостановить в любой момент; при продолжении Riverline заново выбирает следующий вопрос по сохранённым данным.',
    'Answer adaptive questions, add exact frequencies when useful, and keep direct evidence distinct from inference.': 'Отвечайте на адаптивные вопросы, при необходимости задавайте точные частоты и отличайте прямые данные от вывода.',
    'See why each hand matters': 'Узнайте, почему важна каждая рука',
    'The reason points to a boundary, sparse region, nearby disagreement, or coverage gain. It explains question value, not poker confidence.': 'Причина указывает на границу, разреженную область, расхождение соседей или прирост покрытия. Она объясняет ценность вопроса, а не уверенность в покерном решении.',
    'Read progress by category': 'Читайте прогресс по категориям',
    'Direct, inferred-high, inferred-medium, uncertain, conflicting, and unknown stay separate. These counts are coverage facts, not a confidence percentage.': 'Прямые, выведенные с высокой и средней опорой, неопределённые, конфликтующие и неизвестные руки показаны отдельно. Это данные о покрытии, а не процент уверенности.',
    'Pause, stop, skip, or undo safely': 'Безопасно ставьте на паузу, завершайте, пропускайте и отменяйте',
    'Pause preserves the session, Stop ends it, and Skip or I’m not sure records no poker evidence. Undo retracts the immediately previous direct observation when available.': 'Пауза сохраняет сессию, Stop завершает её, а Skip и «Не уверен» не записывают покерных данных. Undo отзывает последний прямой ответ, если он есть.',
  });
  Object.assign(he, {
    'Define the real environment, choose a question goal, and let current evidence guide the session.': 'הגדירו סביבת משחק אמיתית, בחרו יעד שאלות ותנו לנתונים הקיימים לכוון את הסשן.',
    'Riverline chooses informative hands': 'Riverline בוחרת ידיים אינפורמטיביות',
    'Riverline selects high-value hands from current direct evidence and the derived uncertainty model. You do not need to answer all 169; direct answers remain yours.': 'Riverline בוחרת ידיים בעלות ערך גבוה לפי התשובות הישירות הקיימות ומודל אי־הוודאות הנגזר. אין צורך לענות על כל 169 הידיים; התשובות הישירות נשארות שלכם.',
    'Choose a session depth': 'בחרו את עומק הסשן',
    'Quick, Standard, and Deep are question-count goals. Pause anytime; Riverline recomputes the next question from saved evidence when you resume.': 'Quick, Standard ו־Deep הם יעדים למספר שאלות. אפשר להשהות בכל עת; בחזרה לסשן Riverline מחשבת מחדש את השאלה הבאה לפי הנתונים השמורים.',
    'Answer adaptive questions, add exact frequencies when useful, and keep direct evidence distinct from inference.': 'ענו על שאלות מסתגלות, הוסיפו תדירויות מדויקות כשזה מועיל ושמרו על ההפרדה בין נתונים ישירים להסקה.',
    'See why each hand matters': 'ראו למה כל יד חשובה',
    'The reason points to a boundary, sparse region, nearby disagreement, or coverage gain. It explains question value, not poker confidence.': 'הסיבה מצביעה על גבול, אזור דל, מחלוקת בין שכנים או שיפור בכיסוי. היא מסבירה את ערך השאלה, לא ביטחון בהחלטת פוקר.',
    'Read progress by category': 'קראו את ההתקדמות לפי קטגוריה',
    'Direct, inferred-high, inferred-medium, uncertain, conflicting, and unknown stay separate. These counts are coverage facts, not a confidence percentage.': 'יש הפרדה בין ישיר, מוסק עם תמיכה גבוהה, מוסק עם תמיכה בינונית, לא ודאי, סותר ולא ידוע. אלה נתוני כיסוי, לא אחוז ביטחון.',
    'Pause, stop, skip, or undo safely': 'השהו, עצרו, דלגו או בטלו בבטחה',
    'Pause preserves the session, Stop ends it, and Skip or I’m not sure records no poker evidence. Undo retracts the immediately previous direct observation when available.': 'Pause שומר את הסשן, Stop מסיים אותו, ו־Skip או „לא בטוח” אינם שומרים ראיית פוקר. Undo מבטל את התשובה הישירה האחרונה כשיש כזו.',
  });

  const personalStrategyMatrixTutorial = {
    en: {
      'Inspect the model as a matrix': 'Inspect the model as a matrix',
      'The Matrix summarizes this exact Profile, Mode, and RFI context. Action fill stays separate from direct, inferred, uncertain, conflicting, and unknown status.': 'The Matrix summarizes this exact Profile, Mode, and RFI context. Action fill stays separate from direct, inferred, uncertain, conflicting, and unknown status.',
      'Inspect and correct Riverline': 'Inspect and correct Riverline',
      'Select a Matrix cell to see direct history, contributing neighbors, and boundary facts. Confirming an inference records only a dominant action; exact mixes remain explicit.': 'Select a Matrix cell to see direct history, contributing neighbors, and boundary facts. Confirming an inference records only a dominant action; exact mixes remain explicit.',
      'Build the same strategy directly': 'Build the same strategy directly',
      'Range Builder selects or paints many Matrix hands at once. Builder edits become direct evidence, exact mixes stay explicit, Undo preserves history, and Calibration immediately uses the updated model.': 'Range Builder selects or paints many Matrix hands at once. Builder edits become direct evidence, exact mixes stay explicit, Undo preserves history, and Calibration immediately uses the updated model.',
    },
    ru: {
      'Inspect the model as a matrix': 'Изучайте модель в виде матрицы',
      'The Matrix summarizes this exact Profile, Mode, and RFI context. Action fill stays separate from direct, inferred, uncertain, conflicting, and unknown status.': 'Матрица обобщает именно этот профиль, режим и контекст RFI. Заливка действия отделена от прямого, выведенного, неопределённого, конфликтующего и неизвестного статуса.',
      'Inspect and correct Riverline': 'Проверяйте и исправляйте Riverline',
      'Select a Matrix cell to see direct history, contributing neighbors, and boundary facts. Confirming an inference records only a dominant action; exact mixes remain explicit.': 'Выберите ячейку матрицы, чтобы увидеть историю прямых данных, влияющих соседей и факты о границе. Подтверждение вывода записывает только доминирующее действие; точные миксы остаются явными.',
      'Build the same strategy directly': 'Редактируйте ту же стратегию напрямую',
      'Range Builder selects or paints many Matrix hands at once. Builder edits become direct evidence, exact mixes stay explicit, Undo preserves history, and Calibration immediately uses the updated model.': 'Конструктор диапазона выбирает или закрашивает сразу много рук матрицы. Правки становятся прямыми свидетельствами, точные миксы остаются явными, отмена сохраняет историю, а калибровка сразу использует обновлённую модель.',
    },
    he: {
      'Inspect the model as a matrix': 'בדקו את המודל כמטריצה',
      'The Matrix summarizes this exact Profile, Mode, and RFI context. Action fill stays separate from direct, inferred, uncertain, conflicting, and unknown status.': 'המטריצה מסכמת את הפרופיל, המצב והקשר ה־RFI המדויקים האלה. מילוי הפעולה נשאר נפרד ממצב ישיר, מוסק, לא ודאי, סותר או לא ידוע.',
      'Inspect and correct Riverline': 'בדקו ותקנו את Riverline',
      'Select a Matrix cell to see direct history, contributing neighbors, and boundary facts. Confirming an inference records only a dominant action; exact mixes remain explicit.': 'בחרו תא במטריצה כדי לראות היסטוריה ישירה, שכנים תורמים ועובדות גבול. אישור הסקה מתעד רק פעולה דומיננטית; תמהילים מדויקים נשארים מפורשים.',
      'Build the same strategy directly': 'בנו את אותה אסטרטגיה ישירות',
      'Range Builder selects or paints many Matrix hands at once. Builder edits become direct evidence, exact mixes stay explicit, Undo preserves history, and Calibration immediately uses the updated model.': 'בונה הטווחים בוחר או צובע ידיים רבות במטריצה בבת אחת. עריכות הופכות לראיות ישירות, מיקסים מדויקים נשארים מפורשים, ביטול שומר היסטוריה והכיול משתמש מיד במודל המעודכן.',
    },
  };
  Object.assign(en, personalStrategyMatrixTutorial.en);
  Object.assign(ru, personalStrategyMatrixTutorial.ru);
  Object.assign(he, personalStrategyMatrixTutorial.he);

  const rangeAnalysisTutorial = {
    en: {
      'Read exact-hand, draw, blocker, range, strategy, and source facts without overstating what Riverline knows.': 'Read exact-hand, draw, blocker, range, strategy, and source facts without overstating what Riverline knows.',
      'Decision explains one selected spot. Range Matrix remains provider-backed preflop context, while Range Category Comparison remains a separate coarse heuristic sample view.': 'Decision explains one selected spot. Range Matrix remains provider-backed preflop context, while Range Category Comparison remains a separate coarse heuristic sample view.',
      'Separate hand facts from strategy': 'Separate hand facts from strategy',
      'Open “What goes into this decision?” to see the exact made hand, pair relationship, overlapping flop or turn draws, and board structure. These facts come from the known cards and canonical evaluator, not from the recommendation.': 'Open “What goes into this decision?” to see the exact made hand, pair relationship, overlapping flop or turn draws, and board structure. These facts come from the known cards and canonical evaluator, not from the recommendation.',
      'Open “What goes into this decision?” to see the exact made hand, pair relationship, overlapping flop or turn draws, their structural completion cards, and board structure. Shared completion cards are shown once in the unique total. These facts come from the known cards and canonical evaluator, not from the recommendation.': 'Open “What goes into this decision?” to see the exact made hand, pair relationship, overlapping flop or turn draws, their structural completion cards, and board structure. Shared completion cards are shown once in the unique total. These facts come from the known cards and canonical evaluator, not from the recommendation.',
      'Read blocker effects structurally': 'Read blocker effects structurally',
      'Hero-card blockers report exact card removal. If an opponent range is explicitly supplied, Analysis also reports the known combo mass removed; it does not call a blocker good or bad for bluffing.': 'Hero-card blockers report exact card removal. If an opponent range is explicitly supplied, Analysis also reports the known combo mass removed; it does not call a blocker good or bad for bluffing.',
      'Ranges appear only when supplied': 'Ranges appear only when supplied',
      'Without an explicit canonical weighted range, the Range section stays unavailable instead of estimating one from heuristic samples or Matrix hands. Partial ranges keep unknown combos unknown and show coverage without whole-range percentages.': 'Without an explicit canonical weighted range, the Range section stays unavailable instead of estimating one from heuristic samples or Matrix hands. Partial ranges keep unknown combos unknown and show coverage without whole-range percentages.',
      'Without an explicit canonical weighted range, the Range section stays unavailable instead of estimating one from heuristic samples or Matrix hands. Partial ranges keep unknown combos unknown and show coverage without whole-range percentages. Exact cards, board, range, StrategyResult, and Equity sources remain separate.': 'Without an explicit canonical weighted range, the Range section stays unavailable instead of estimating one from heuristic samples or Matrix hands. Partial ranges keep unknown combos unknown and show coverage without whole-range percentages. Exact cards, board, range, StrategyResult, and Equity sources remain separate.',
      'Keep each source and limitation attached': 'Keep each source and limitation attached',
      'Exact cards, board facts, a supplied range, StrategyResult, and any canonical Equity result retain separate provenance. Composition does not prove range advantage, nut advantage, solver frequency, or EV.': 'Exact cards, board facts, a supplied range, StrategyResult, and any canonical Equity result retain separate provenance. Composition does not prove range advantage, nut advantage, solver frequency, or EV.'
    },
    ru: {
      'Read exact-hand, draw, blocker, range, strategy, and source facts without overstating what Riverline knows.': 'Читайте факты о точной руке, дро, блокерах, рендже, стратегии и источниках без преувеличения возможностей Riverline.',
      'Decision explains one selected spot. Range Matrix remains provider-backed preflop context, while Range Category Comparison remains a separate coarse heuristic sample view.': '«Решение» объясняет один выбранный спот. Матрица остаётся префлоп-контекстом от текущего провайдера, а сравнение категорий — отдельным грубым эвристическим представлением выборок.',
      'Separate hand facts from strategy': 'Отделяйте факты о руке от стратегии',
      'Open “What goes into this decision?” to see the exact made hand, pair relationship, overlapping flop or turn draws, and board structure. These facts come from the known cards and canonical evaluator, not from the recommendation.': 'Откройте «Что влияет на это решение?», чтобы увидеть точную готовую руку, тип пары, пересекающиеся дро на флопе или тёрне и структуру борда. Эти факты получены из известных карт и канонического оценщика, а не из рекомендации.',
      'Open “What goes into this decision?” to see the exact made hand, pair relationship, overlapping flop or turn draws, their structural completion cards, and board structure. Shared completion cards are shown once in the unique total. These facts come from the known cards and canonical evaluator, not from the recommendation.': 'Откройте «Что влияет на это решение?», чтобы увидеть точную готовую руку, тип пары, пересекающиеся дро на флопе или тёрне, структурные карты их завершения и структуру борда. Общие карты завершения учитываются один раз в уникальном итоге. Эти факты получены из известных карт и канонического оценщика, а не из рекомендации.',
      'Read blocker effects structurally': 'Читайте блокеры как структурные факты',
      'Hero-card blockers report exact card removal. If an opponent range is explicitly supplied, Analysis also reports the known combo mass removed; it does not call a blocker good or bad for bluffing.': 'Блокеры Hero показывают точный кард-ремувал. Если явно задан рендж оппонента, анализ также покажет исключённую известную массу комбо, но не назовёт блокер хорошим или плохим для блефа.',
      'Ranges appear only when supplied': 'Рендж появляется только из явного источника',
      'Without an explicit canonical weighted range, the Range section stays unavailable instead of estimating one from heuristic samples or Matrix hands. Partial ranges keep unknown combos unknown and show coverage without whole-range percentages.': 'Без явного канонического взвешенного ренджа раздел остаётся недоступным и не строит оценку из эвристических выборок или рук Матрицы. В частичном рендже неизвестные комбо остаются неизвестными, а покрытие показывается без процентов от всего ренджа.',
      'Without an explicit canonical weighted range, the Range section stays unavailable instead of estimating one from heuristic samples or Matrix hands. Partial ranges keep unknown combos unknown and show coverage without whole-range percentages. Exact cards, board, range, StrategyResult, and Equity sources remain separate.': 'Без явного канонического взвешенного ренджа раздел остаётся недоступным и не строит оценку из эвристических выборок или рук Матрицы. В частичном рендже неизвестные комбо остаются неизвестными, а покрытие показывается без процентов от всего ренджа. Источники точных карт, борда, ренджа, StrategyResult и Equity остаются раздельными.',
      'Keep each source and limitation attached': 'Сохраняйте источник и ограничения каждого факта',
      'Exact cards, board facts, a supplied range, StrategyResult, and any canonical Equity result retain separate provenance. Composition does not prove range advantage, nut advantage, solver frequency, or EV.': 'Точные карты, факты борда, заданный рендж, StrategyResult и канонический результат Equity сохраняют отдельные источники. Состав не доказывает преимущество ренджа или натсов, частоты солвера либо EV.'
    },
    he: {
      'Read exact-hand, draw, blocker, range, strategy, and source facts without overstating what Riverline knows.': "קראו עובדות על היד המדויקת, דרואים, בלוקרים, ריינג', אסטרטגיה ומקורות בלי להפריז במה ש־Riverline יודע.",
      'Decision explains one selected spot. Range Matrix remains provider-backed preflop context, while Range Category Comparison remains a separate coarse heuristic sample view.': "החלטה מסבירה ספוט אחד שנבחר. מטריצת הריינג' נשארת הקשר פרה-פלופ ממקור האסטרטגיה, והשוואת קטגוריות הריינג' נשארת תצוגה נפרדת וגסה של דגימות היוריסטיות.",
      'Separate hand facts from strategy': 'הפרידו בין עובדות היד לאסטרטגיה',
      'Open “What goes into this decision?” to see the exact made hand, pair relationship, overlapping flop or turn draws, and board structure. These facts come from the known cards and canonical evaluator, not from the recommendation.': 'פתחו „מה משפיע על ההחלטה?” כדי לראות את היד המוכנה המדויקת, סוג הזוג, דרואים חופפים בפלופ או בטרן ומבנה הבורד. העובדות מגיעות מהקלפים הידועים ומהמעריך הקנוני, לא מההמלצה.',
      'Open “What goes into this decision?” to see the exact made hand, pair relationship, overlapping flop or turn draws, their structural completion cards, and board structure. Shared completion cards are shown once in the unique total. These facts come from the known cards and canonical evaluator, not from the recommendation.': 'פתחו „מה משפיע על ההחלטה?” כדי לראות את היד המוכנה המדויקת, סוג הזוג, דרואים חופפים בפלופ או בטרן, קלפי ההשלמה המבניים שלהם ומבנה הבורד. קלף השלמה משותף נספר פעם אחת בסיכום הייחודי. העובדות מגיעות מהקלפים הידועים ומהמעריך הקנוני, לא מההמלצה.',
      'Read blocker effects structurally': 'קראו את השפעת הבלוקרים כעובדה מבנית',
      'Hero-card blockers report exact card removal. If an opponent range is explicitly supplied, Analysis also reports the known combo mass removed; it does not call a blocker good or bad for bluffing.': "הבלוקרים של Hero מדווחים על הסרת קלפים מדויקת. אם סופק במפורש ריינג' יריב, הניתוח מציג גם את מסת הקומבואים הידועה שהוסרה; הוא אינו קובע שבלוקר טוב או רע לבלוף.",
      'Ranges appear only when supplied': "ריינג' מופיע רק כשמספקים אותו",
      'Without an explicit canonical weighted range, the Range section stays unavailable instead of estimating one from heuristic samples or Matrix hands. Partial ranges keep unknown combos unknown and show coverage without whole-range percentages.': "בלי ריינג' קנוני ומשוקלל שסופק במפורש, מדור הריינג' נשאר לא זמין ואינו מעריך ריינג' מדגימות היוריסטיות או מידי המטריצה. בריינג' חלקי, קומבואים לא ידועים נשארים לא ידועים והכיסוי מוצג בלי אחוזים מכל הריינג'.",
      'Without an explicit canonical weighted range, the Range section stays unavailable instead of estimating one from heuristic samples or Matrix hands. Partial ranges keep unknown combos unknown and show coverage without whole-range percentages. Exact cards, board, range, StrategyResult, and Equity sources remain separate.': "בלי ריינג' קנוני ומשוקלל שסופק במפורש, מדור הריינג' נשאר לא זמין ואינו מעריך ריינג' מדגימות היוריסטיות או מידי המטריצה. בריינג' חלקי, קומבואים לא ידועים נשארים לא ידועים והכיסוי מוצג בלי אחוזים מכל הריינג'. מקורות הקלפים המדויקים, הבורד, הריינג', StrategyResult ו־Equity נשארים נפרדים.",
      'Keep each source and limitation attached': 'שמרו כל מקור ומגבלה צמודים לעובדה',
      'Exact cards, board facts, a supplied range, StrategyResult, and any canonical Equity result retain separate provenance. Composition does not prove range advantage, nut advantage, solver frequency, or EV.': "הקלפים המדויקים, עובדות הבורד, ריינג' שסופק, StrategyResult וכל תוצאת Equity קנונית שומרים על מקורות נפרדים. ההרכב אינו מוכיח יתרון ריינג', יתרון נאטס, תדירות סולבר או EV."
    }
  };
  Object.assign(en, rangeAnalysisTutorial.en);
  Object.assign(ru, rangeAnalysisTutorial.ru);
  Object.assign(he, rangeAnalysisTutorial.he);

  const bluffAnalysisTutorial = {
    en: {
      'Read pressure math, exact-hand, draw, blocker, range, strategy, and source facts without overstating what Riverline knows.': 'Read pressure math, exact-hand, draw, blocker, range, strategy, and source facts without overstating what Riverline knows.',
      'Read bluff pressure as a requirement': 'Read bluff pressure as a requirement',
      'Bluff & Pressure derives break-even folds from Hero’s trusted incremental risk and the pot available before the action. It also separates semibluff structure from the recommendation. 33% required folds does not mean Villain folds 33%; Riverline has no opponent fold-frequency model.': 'Bluff & Pressure derives break-even folds from Hero’s trusted incremental risk and the pot available before the action. It also separates semibluff structure from the recommendation. 33% required folds does not mean Villain folds 33%; Riverline has no opponent fold-frequency model.',
      'Read bluff pressure and blockers structurally': 'Read bluff pressure and blockers structurally',
      'Bluff & Pressure derives break-even folds from Hero’s trusted incremental risk and the pot available before the action, while semibluff structure stays separate from the recommendation. 33% required folds does not mean Villain folds 33%; Riverline has no opponent fold-frequency model. Hero-card blockers remain neutral removal facts unless an explicit strategic range partition is supplied.': 'Bluff & Pressure derives break-even folds from Hero’s trusted incremental risk and the pot available before the action, while semibluff structure stays separate from the recommendation. 33% required folds does not mean Villain folds 33%; Riverline has no opponent fold-frequency model. Hero-card blockers remain neutral removal facts unless an explicit strategic range partition is supplied.',
    },
    ru: {
      'Read pressure math, exact-hand, draw, blocker, range, strategy, and source facts without overstating what Riverline knows.': 'Читайте математику давления, факты о точной руке, дро, блокерах, рендже, стратегии и источниках без преувеличения возможностей Riverline.',
      'Read bluff pressure as a requirement': 'Читайте давление блефа как требование',
      'Bluff & Pressure derives break-even folds from Hero’s trusted incremental risk and the pot available before the action. It also separates semibluff structure from the recommendation. 33% required folds does not mean Villain folds 33%; Riverline has no opponent fold-frequency model.': 'Раздел «Блеф и давление» выводит порог фолдов из достоверного дополнительного риска Hero и банка до действия, а структуру полублефа отделяет от рекомендации. Требуемые 33% фолдов не означают, что Villain сделает фолд в 33% случаев: у Riverline нет модели частоты фолдов оппонента.',
      'Read bluff pressure and blockers structurally': 'Читайте давление блефа и блокеры как структурные факты',
      'Bluff & Pressure derives break-even folds from Hero’s trusted incremental risk and the pot available before the action, while semibluff structure stays separate from the recommendation. 33% required folds does not mean Villain folds 33%; Riverline has no opponent fold-frequency model. Hero-card blockers remain neutral removal facts unless an explicit strategic range partition is supplied.': 'Раздел «Блеф и давление» выводит порог фолдов из достоверного дополнительного риска Hero и банка до действия, а структуру полублефа отделяет от рекомендации. Требуемые 33% фолдов не означают, что Villain сделает фолд в 33% случаев: у Riverline нет модели частоты фолдов оппонента. Блокеры Hero остаются нейтральными фактами кард-ремувала без явного стратегического разделения ренджа.',
    },
    he: {
      'Read pressure math, exact-hand, draw, blocker, range, strategy, and source facts without overstating what Riverline knows.': 'קראו את מתמטיקת הלחץ, עובדות היד המדויקת, דרואים, בלוקרים, ריינג׳, אסטרטגיה ומקורות בלי להפריז במה ש־Riverline יודע.',
      'Read bluff pressure as a requirement': 'קראו את לחץ הבלוף כדרישה',
      'Bluff & Pressure derives break-even folds from Hero’s trusted incremental risk and the pot available before the action. It also separates semibluff structure from the recommendation. 33% required folds does not mean Villain folds 33%; Riverline has no opponent fold-frequency model.': '„בלוף ולחץ” גוזר את דרישת הפולד מהסיכון הנוסף והמהימן של Hero ומהקופה הזמינה לפני הפעולה, ומפריד את מבנה הסמי־בלוף מההמלצה. דרישה ל־33% פולדים אינה אומרת ש־Villain עושה פולד ב־33%; ל־Riverline אין מודל לתדירות הפולד של היריב.',
      'Read bluff pressure and blockers structurally': 'קראו את לחץ הבלוף ואת הבלוקרים כעובדות מבניות',
      'Bluff & Pressure derives break-even folds from Hero’s trusted incremental risk and the pot available before the action, while semibluff structure stays separate from the recommendation. 33% required folds does not mean Villain folds 33%; Riverline has no opponent fold-frequency model. Hero-card blockers remain neutral removal facts unless an explicit strategic range partition is supplied.': '„בלוף ולחץ” גוזר את דרישת הפולד מהסיכון הנוסף והמהימן של Hero ומהקופה הזמינה לפני הפעולה, ומפריד את מבנה הסמי־בלוף מההמלצה. דרישה ל־33% פולדים אינה אומרת ש־Villain עושה פולד ב־33%; ל־Riverline אין מודל לתדירות הפולד של היריב. הבלוקרים של Hero נשארים עובדות ניטרליות של הסרת קלפים בלי חלוקת ריינג׳ אסטרטגית מפורשת.',
    },
  };
  Object.assign(en, bluffAnalysisTutorial.en);
  Object.assign(ru, bluffAnalysisTutorial.ru);
  Object.assign(he, bluffAnalysisTutorial.he);

  const savedSyncTutorial = {
    en: {
      'Saved Study sync is always opt-in': 'Saved Study sync is always opt-in',
      'Sign-in does not upload study data. In Account / Profile, choose Saved Hands and Spots and Personal Strategy / Range Calibration separately; each remains local-first.': 'Sign-in does not upload study data. In Account / Profile, choose Saved Hands and Spots and Personal Strategy / Range Calibration separately; each remains local-first.',
    },
    ru: {
      'Saved Study sync is always opt-in': 'Синхронизация сохранённых материалов включается только по вашему выбору',
      'Sign-in does not upload study data. In Account / Profile, choose Saved Hands and Spots and Personal Strategy / Range Calibration separately; each remains local-first.': 'Вход не загружает учебные данные. В разделе «Аккаунт / Профиль» отдельно выберите сохранённые раздачи и ситуации, а также личную стратегию и калибровку диапазонов; каждый раздел остаётся локальным в первую очередь.',
    },
    he: {
      'Saved Study sync is always opt-in': 'סנכרון נתוני לימוד שמורים מופעל רק בבחירה מפורשת',
      'Sign-in does not upload study data. In Account / Profile, choose Saved Hands and Spots and Personal Strategy / Range Calibration separately; each remains local-first.': 'הכניסה אינה מעלה נתוני לימוד. בחשבון / פרופיל יש לבחור בנפרד ידיים ומצבים שמורים ואסטרטגיה אישית / כיול טווחים; כל תחום נשאר מקומי תחילה.',
    },
  };
  Object.assign(en, savedSyncTutorial.en);
  Object.assign(ru, savedSyncTutorial.ru);
  Object.assign(he, savedSyncTutorial.he);

  const homeGameTutorial = {
    en: {
      'Running a Home Game': 'Running a Home Game',
      'Track real cash-game money truthfully and finish with a clear settlement.': 'Track real cash-game money truthfully and finish with a clear settlement.',
      'Home Game is separate from poker analysis': 'Home Game is separate from poker analysis',
      'This workspace organizes a real poker night. Its players, money ledger, chip snapshots, and settlement do not change PokerState or Riverline strategy.': 'This workspace organizes a real poker night. Its players, money ledger, chip snapshots, and settlement do not change PokerState or Riverline strategy.',
      'Start with the real roster and currency': 'Start with the real roster and currency',
      'Enter players in seat order and an optional initial buy-in. Guest sessions stay in memory; sign in before starting a game you need to keep.': 'Enter players in seat order and an optional initial buy-in. Guest sessions stay in memory; sign in before starting a game you need to keep.',
      'Reuse a group without copying players': 'Reuse a group without copying players',
      'Signed-in accounts can save an ordered roster and start another independent session from it. Group membership only references saved players.': 'Signed-in accounts can save an ordered roster and start another independent session from it. Group membership only references saved players.',
      'Let the ledger explain every result': 'Let the ledger explain every result',
      'Record rebuys, add-ons, cash-outs, and optional chip counts. Money and chips stay separate; completion and settlement remain blocked until the exact money balance is zero.': 'Record rebuys, add-ons, cash-outs, and optional chip counts. Money and chips stay separate; completion and settlement remain blocked until the exact money balance is zero.',
    },
    ru: {
      'Running a Home Game': 'Проведение домашней игры',
      'Track real cash-game money truthfully and finish with a clear settlement.': 'Честно учитывайте деньги в кэш-игре и завершайте её понятными расчётами.',
      'Home Game is separate from poker analysis': 'Домашняя игра отделена от покерного анализа',
      'This workspace organizes a real poker night. Its players, money ledger, chip snapshots, and settlement do not change PokerState or Riverline strategy.': 'Этот раздел помогает провести реальный покерный вечер. Игроки, денежный журнал, снимки стеков и расчёты не меняют PokerState или стратегию Riverline.',
      'Start with the real roster and currency': 'Начните с реального состава и валюты',
      'Enter players in seat order and an optional initial buy-in. Guest sessions stay in memory; sign in before starting a game you need to keep.': 'Введите игроков в порядке мест и при необходимости начальный бай-ин. Гостевая сессия остаётся в памяти; войдите до начала игры, которую нужно сохранить.',
      'Reuse a group without copying players': 'Используйте группу повторно без копирования игроков',
      'Signed-in accounts can save an ordered roster and start another independent session from it. Group membership only references saved players.': 'Аккаунт может сохранить упорядоченный состав и начать из него новую независимую сессию. Группа только ссылается на сохранённых игроков.',
      'Let the ledger explain every result': 'Пусть журнал объясняет каждый результат',
      'Record rebuys, add-ons, cash-outs, and optional chip counts. Money and chips stay separate; completion and settlement remain blocked until the exact money balance is zero.': 'Записывайте ребаи, аддоны, кэшауты и при необходимости фишки. Деньги и фишки разделены; завершение и расчёты заблокированы, пока точный денежный баланс не равен нулю.',
    },
    he: {
      'Running a Home Game': 'ניהול משחק ביתי',
      'Track real cash-game money truthfully and finish with a clear settlement.': 'נהלו רישום כספי אמין של משחק קאש וסיימו בהתחשבנות ברורה.',
      'Home Game is separate from poker analysis': 'המשחק הביתי נפרד מניתוח פוקר',
      'This workspace organizes a real poker night. Its players, money ledger, chip snapshots, and settlement do not change PokerState or Riverline strategy.': 'המרחב הזה מנהל ערב פוקר אמיתי. השחקנים, יומן הכספים, ספירות הצ׳יפים וההתחשבנות אינם משנים את PokerState או את אסטרטגיית Riverline.',
      'Start with the real roster and currency': 'התחילו עם ההרכב והמטבע האמיתיים',
      'Enter players in seat order and an optional initial buy-in. Guest sessions stay in memory; sign in before starting a game you need to keep.': 'הזינו שחקנים לפי סדר המושבים וכניסה התחלתית לפי הצורך. סשן אורח נשאר בזיכרון; התחברו לפני משחק שצריך לשמור.',
      'Reuse a group without copying players': 'השתמשו שוב בקבוצה בלי להעתיק שחקנים',
      'Signed-in accounts can save an ordered roster and start another independent session from it. Group membership only references saved players.': 'חשבון מחובר יכול לשמור הרכב מסודר ולפתוח ממנו סשן עצמאי חדש. החברות בקבוצה רק מפנה לשחקנים השמורים.',
      'Let the ledger explain every result': 'תנו ליומן להסביר כל תוצאה',
      'Record rebuys, add-ons, cash-outs, and optional chip counts. Money and chips stay separate; completion and settlement remain blocked until the exact money balance is zero.': 'רשמו ריביי, אד-און, פדיון וספירת צ׳יפים לפי הצורך. כסף וצ׳יפים נשארים נפרדים; סיום והתחשבנות חסומים עד שהמאזן הכספי המדויק הוא אפס.',
    },
  };
  Object.assign(en, homeGameTutorial.en);
  Object.assign(ru, homeGameTutorial.ru);
  Object.assign(he, homeGameTutorial.he);

  const rangeTeacherTutorial = {
    en: {
      'Learn from your own strategy': 'Learn from your own strategy',
      'Range Teacher explains boundaries, conflicts, unknown regions, and qualitative transfers from compatible nearby RFI contexts in your own Personal Strategy evidence. Transfers remain derived, and its suggestions never grade you against GTO or a reference strategy.': 'Range Teacher explains boundaries, conflicts, unknown regions, and qualitative transfers from compatible nearby RFI contexts in your own Personal Strategy evidence. Transfers remain derived, and its suggestions never grade you against GTO or a reference strategy.',
    },
    ru: {
      'Learn from your own strategy': 'Изучайте собственную стратегию',
      'Range Teacher explains boundaries, conflicts, unknown regions, and qualitative transfers from compatible nearby RFI contexts in your own Personal Strategy evidence. Transfers remain derived, and its suggestions never grade you against GTO or a reference strategy.': 'Учитель диапазонов объясняет границы, противоречия, неизвестные области и качественный перенос из совместимых соседних RFI-контекстов в данных вашей личной стратегии. Перенос остаётся производным, а рекомендации никогда не оценивают вас относительно GTO или эталонной стратегии.',
    },
    he: {
      'Learn from your own strategy': 'למדו מהאסטרטגיה שלכם',
      'Range Teacher explains boundaries, conflicts, unknown regions, and qualitative transfers from compatible nearby RFI contexts in your own Personal Strategy evidence. Transfers remain derived, and its suggestions never grade you against GTO or a reference strategy.': 'מורה הטווחים מסביר גבולות, סתירות, אזורים לא ידועים והעברות איכותניות מהקשרי RFI סמוכים ותואמים בראיות האסטרטגיה האישית שלכם. ההעברות נשארות נגזרות, וההמלצות לעולם אינן מדרגות אתכם מול GTO או אסטרטגיית ייחוס.',
    },
  };
  Object.assign(en, rangeTeacherTutorial.en);
  Object.assign(ru, rangeTeacherTutorial.ru);
  Object.assign(he, rangeTeacherTutorial.he);

  const trainingVariedTutorial = {
    en: {
      'Choose a session style': 'Choose a session style',
      'Varied Session chooses useful legal variety across streets, positions, tables, stacks, and facing sizes. Focused Drill keeps the exact controls when you want one decision family.': 'Varied Session chooses useful legal variety across streets, positions, tables, stacks, and facing sizes. Focused Drill keeps the exact controls when you want one decision family.',
    },
    ru: {
      'Choose a session style': 'Выберите стиль сессии',
      'Varied Session chooses useful legal variety across streets, positions, tables, stacks, and facing sizes. Focused Drill keeps the exact controls when you want one decision family.': 'Разнообразная сессия подбирает полезное легальное разнообразие по улицам, позициям, столам, стекам и размерам ставок. Целевой тренажёр сохраняет точные настройки, когда нужна одна семья решений.',
    },
    he: {
      'Choose a session style': 'בחרו סגנון סשן',
      'Varied Session chooses useful legal variety across streets, positions, tables, stacks, and facing sizes. Focused Drill keeps the exact controls when you want one decision family.': 'סשן מגוון בוחר גיוון חוקי ושימושי בין רחובות, עמדות, שולחנות, סטאקים וגדלי הימור. תרגול ממוקד שומר את הבקרים המדויקים כשרוצים משפחת החלטות אחת.',
    },
  };
  Object.assign(en, trainingVariedTutorial.en);
  Object.assign(ru, trainingVariedTutorial.ru);
  Object.assign(he, trainingVariedTutorial.he);

  const tablePresenceTutorial = {
    en: {
      'The compact timeline records actions and chance events by street. Select any event to seek a read-only Replay frame without mutating live PokerState.': 'The compact timeline records actions and chance events by street. Select any event to seek a read-only Replay frame without mutating live PokerState.',
    },
    ru: {
      'The compact timeline records actions and chance events by street. Select any event to seek a read-only Replay frame without mutating live PokerState.': 'Компактная хронология показывает действия и события раздачи по улицам. Выберите любое событие, чтобы перейти к кадру повтора только для чтения, не изменяя текущий PokerState.',
    },
    he: {
      'The compact timeline records actions and chance events by street. Select any event to seek a read-only Replay frame without mutating live PokerState.': 'ציר הזמן הקומפקטי מציג פעולות ואירועי חלוקה לפי רחוב. בחרו אירוע כדי לעבור לפריים חזרה לקריאה בלבד, בלי לשנות את PokerState החי.',
    },
  };
  Object.assign(en, tablePresenceTutorial.en);
  Object.assign(ru, tablePresenceTutorial.ru);
  Object.assign(he, tablePresenceTutorial.he);

  const settingsIaTutorial = {
    en: {
      'Settings groups device preferences by type. Use the category list to move between appearance, audio and motion, language and help, and account and data.': 'Settings groups device preferences by type. Use the category list to move between appearance, audio and motion, language and help, and account and data.',
      'Appearance': 'Appearance',
      'Choose how Riverline looks without changing cards, poker state, or study results.': 'Choose how Riverline looks without changing cards, poker state, or study results.',
      'Language & Help': 'Language & Help',
      'Language remains available from the global sidebar. This is the same device preference, plus secondary learning routes.': 'Language remains available from the global sidebar. This is the same device preference, plus secondary learning routes.',
    },
    ru: {
      'Settings groups device preferences by type. Use the category list to move between appearance, audio and motion, language and help, and account and data.': 'Настройки устройства сгруппированы по типу. Используйте список категорий, чтобы переходить между внешним видом, звуком и движением, языком и помощью, а также аккаунтом и данными.',
      'Appearance': 'Внешний вид',
      'Choose how Riverline looks without changing cards, poker state, or study results.': 'Настройте внешний вид Riverline, не меняя карты, состояние покера или результаты обучения.',
      'Language & Help': 'Язык и помощь',
      'Language remains available from the global sidebar. This is the same device preference, plus secondary learning routes.': 'Язык по-прежнему можно выбрать на глобальной боковой панели. Здесь используется та же настройка устройства и доступны дополнительные пути к обучению.',
    },
    he: {
      'Settings groups device preferences by type. Use the category list to move between appearance, audio and motion, language and help, and account and data.': 'העדפות המכשיר מקובצות לפי סוג. השתמשו ברשימת הקטגוריות כדי לעבור בין מראה, שמע ותנועה, שפה ועזרה, וחשבון ונתונים.',
      'Appearance': 'מראה',
      'Choose how Riverline looks without changing cards, poker state, or study results.': 'בחרו כיצד Riverline תיראה בלי לשנות קלפים, מצב פוקר או תוצאות לימוד.',
      'Language & Help': 'שפה ועזרה',
      'Language remains available from the global sidebar. This is the same device preference, plus secondary learning routes.': 'בחירת השפה נשארת זמינה בסרגל הצד הכללי. כאן נעשה שימוש באותה העדפת מכשיר, לצד נתיבי למידה משניים.',
    },
  };
  Object.assign(en, settingsIaTutorial.en);
  Object.assign(ru, settingsIaTutorial.ru);
  Object.assign(he, settingsIaTutorial.he);

  const audioMotionTutorial = {
    en: {
      'Sound is optional: set the master level, then enable Table / Poker and Study / UI cues separately. Motion is controlled independently and respects the system reduced-motion preference.': 'Sound is optional: set the master level, then enable Table / Poker and Study / UI cues separately. Motion is controlled independently and respects the system reduced-motion preference.',
    },
    ru: {
      'Sound is optional: set the master level, then enable Table / Poker and Study / UI cues separately. Motion is controlled independently and respects the system reduced-motion preference.': 'Звук необязателен: задайте общую громкость, затем отдельно включите сигналы «Стол / Покер» и «Обучение / Интерфейс». Анимация настраивается независимо и учитывает системное предпочтение уменьшенного движения.',
    },
    he: {
      'Sound is optional: set the master level, then enable Table / Poker and Study / UI cues separately. Motion is controlled independently and respects the system reduced-motion preference.': 'הצליל הוא אופציונלי: הגדירו עוצמה כללית, ולאחר מכן הפעילו בנפרד צלילי שולחן / פוקר ולימוד / ממשק. התנועה נשלטת בנפרד ומכבדת את העדפת המערכת להפחתת תנועה.',
    },
  };
  Object.assign(en, audioMotionTutorial.en);
  Object.assign(ru, audioMotionTutorial.ru);
  Object.assign(he, audioMotionTutorial.he);

  const handReviewTutorial = {
    en: {
      'Review every Hero decision after the Hand': 'Review every Hero decision after the Hand',
      'After completion, Hand Review keeps the canonical result and Replay intact while comparing each recorded Hero action with the displayed source. Source limitations remain visible, and review priority is a probability disagreement—not EV loss.': 'After completion, Hand Review keeps the canonical result and Replay intact while comparing each recorded Hero action with the displayed source. Source limitations remain visible, and review priority is a probability disagreement—not EV loss.',
    },
    ru: {
      'Review every Hero decision after the Hand': 'Разберите каждое решение Hero после раздачи',
      'After completion, Hand Review keeps the canonical result and Replay intact while comparing each recorded Hero action with the displayed source. Source limitations remain visible, and review priority is a probability disagreement—not EV loss.': 'После завершения разбор сохраняет канонический результат и повтор, сравнивая каждое записанное действие Hero с показанным источником. Ограничения источника остаются видимыми, а приоритет означает расхождение вероятностей, а не потерю EV.',
    },
    he: {
      'Review every Hero decision after the Hand': 'סקרו כל החלטה של Hero לאחר היד',
      'After completion, Hand Review keeps the canonical result and Replay intact while comparing each recorded Hero action with the displayed source. Source limitations remain visible, and review priority is a probability disagreement—not EV loss.': 'לאחר השלמת היד, הסקירה שומרת על התוצאה הקנונית ועל החזרה ומשווה כל פעולה מתועדת של Hero למקור המוצג. מגבלות המקור נשארות גלויות, ועדיפות הסקירה היא פער הסתברויות ולא הפסד EV.',
    },
  };
  Object.assign(en, handReviewTutorial.en);
  Object.assign(ru, handReviewTutorial.ru);
  Object.assign(he, handReviewTutorial.he);

  const savedTutorial = {
    en: {
      'Using Saved study': 'Using Saved study',
      'Reopen profile-scoped Hands and Spots without mixing Saved with the Home dashboard.': 'Reopen profile-scoped Hands and Spots without mixing Saved with the Home dashboard.',
      'Saved has its own study job': 'Saved has its own study job',
      'Saved belongs to the signed-in Riverline profile. Signing in selects that profile on this device; it does not enable sync or cloud backup.': 'Saved belongs to the signed-in Riverline profile. Signing in selects that profile on this device; it does not enable sync or cloud backup.',
      'Reopen the exact study object': 'Reopen the exact study object',
      'Open a Saved Hand for canonical Replay or a Saved Spot for its supplied study context. Saved does not invent missing history.': 'Open a Saved Hand for canonical Replay or a Saved Spot for its supplied study context. Saved does not invent missing history.',
      'Return to items you marked': 'Return to items you marked',
      'Review and Mistake group the same Saved objects you explicitly classified; they are study intent, not an objective strategy grade.': 'Review and Mistake group the same Saved objects you explicitly classified; they are study intent, not an objective strategy grade.',
    },
    ru: {
      'Using Saved study': '\u0420\u0430\u0431\u043e\u0442\u0430 \u0441 \u0441\u043e\u0445\u0440\u0430\u043d\u0451\u043d\u043d\u044b\u043c\u0438 \u043c\u0430\u0442\u0435\u0440\u0438\u0430\u043b\u0430\u043c\u0438',
      'Reopen profile-scoped Hands and Spots without mixing Saved with the Home dashboard.': '\u041e\u0442\u043a\u0440\u044b\u0432\u0430\u0439\u0442\u0435 \u0440\u0430\u0437\u0434\u0430\u0447\u0438 \u0438 \u0441\u043f\u043e\u0442\u044b \u0432\u044b\u0431\u0440\u0430\u043d\u043d\u043e\u0433\u043e \u043f\u0440\u043e\u0444\u0438\u043b\u044f \u043e\u0442\u0434\u0435\u043b\u044c\u043d\u043e \u043e\u0442 Home.',
      'Saved has its own study job': '\u0423 Saved \u0441\u0432\u043e\u044f \u0443\u0447\u0435\u0431\u043d\u0430\u044f \u0437\u0430\u0434\u0430\u0447\u0430',
      'Saved belongs to the signed-in Riverline profile. Signing in selects that profile on this device; it does not enable sync or cloud backup.': '\u0421\u043e\u0445\u0440\u0430\u043d\u0451\u043d\u043d\u044b\u0435 \u043c\u0430\u0442\u0435\u0440\u0438\u0430\u043b\u044b \u043f\u0440\u0438\u043d\u0430\u0434\u043b\u0435\u0436\u0430\u0442 \u0432\u043e\u0448\u0435\u0434\u0448\u0435\u043c\u0443 \u043f\u0440\u043e\u0444\u0438\u043b\u044e Riverline. \u0412\u0445\u043e\u0434 \u0432\u044b\u0431\u0438\u0440\u0430\u0435\u0442 \u043f\u0440\u043e\u0444\u0438\u043b\u044c \u043d\u0430 \u044d\u0442\u043e\u043c \u0443\u0441\u0442\u0440\u043e\u0439\u0441\u0442\u0432\u0435, \u043d\u043e \u043d\u0435 \u0432\u043a\u043b\u044e\u0447\u0430\u0435\u0442 \u0441\u0438\u043d\u0445\u0440\u043e\u043d\u0438\u0437\u0430\u0446\u0438\u044e \u0438\u043b\u0438 \u043e\u0431\u043b\u0430\u0447\u043d\u0443\u044e \u0440\u0435\u0437\u0435\u0440\u0432\u043d\u0443\u044e \u043a\u043e\u043f\u0438\u044e.',
      'Reopen the exact study object': '\u041e\u0442\u043a\u0440\u043e\u0439\u0442\u0435 \u0442\u043e\u0447\u043d\u044b\u0439 \u0443\u0447\u0435\u0431\u043d\u044b\u0439 \u043e\u0431\u044a\u0435\u043a\u0442',
      'Open a Saved Hand for canonical Replay or a Saved Spot for its supplied study context. Saved does not invent missing history.': '\u041e\u0442\u043a\u0440\u043e\u0439\u0442\u0435 \u0441\u043e\u0445\u0440\u0430\u043d\u0451\u043d\u043d\u0443\u044e \u0440\u0430\u0437\u0434\u0430\u0447\u0443 \u0434\u043b\u044f \u043a\u0430\u043d\u043e\u043d\u0438\u0447\u0435\u0441\u043a\u043e\u0433\u043e Replay \u0438\u043b\u0438 \u0441\u043f\u043e\u0442 \u0434\u043b\u044f \u0435\u0433\u043e \u0438\u0441\u0445\u043e\u0434\u043d\u043e\u0433\u043e \u043a\u043e\u043d\u0442\u0435\u043a\u0441\u0442\u0430. Saved \u043d\u0435 \u0432\u044b\u0434\u0443\u043c\u044b\u0432\u0430\u0435\u0442 \u043e\u0442\u0441\u0443\u0442\u0441\u0442\u0432\u0443\u044e\u0449\u0443\u044e \u0438\u0441\u0442\u043e\u0440\u0438\u044e.',
      'Return to items you marked': '\u0412\u0435\u0440\u043d\u0438\u0442\u0435\u0441\u044c \u043a \u043e\u0442\u043c\u0435\u0447\u0435\u043d\u043d\u044b\u043c \u043c\u0430\u0442\u0435\u0440\u0438\u0430\u043b\u0430\u043c',
      'Review and Mistake group the same Saved objects you explicitly classified; they are study intent, not an objective strategy grade.': 'Review \u0438 Mistake \u0433\u0440\u0443\u043f\u043f\u0438\u0440\u0443\u044e\u0442 \u0442\u0435 \u0436\u0435 \u043e\u0431\u044a\u0435\u043a\u0442\u044b Saved, \u043a\u043e\u0442\u043e\u0440\u044b\u0435 \u0432\u044b \u044f\u0432\u043d\u043e \u043e\u0442\u043c\u0435\u0442\u0438\u043b\u0438; \u044d\u0442\u043e \u0446\u0435\u043b\u044c \u043e\u0431\u0443\u0447\u0435\u043d\u0438\u044f, \u0430 \u043d\u0435 \u043e\u0431\u044a\u0435\u043a\u0442\u0438\u0432\u043d\u0430\u044f \u043e\u0446\u0435\u043d\u043a\u0430 \u0441\u0442\u0440\u0430\u0442\u0435\u0433\u0438\u0438.',
    },
    he: {
      'Using Saved study': '\u05e9\u05d9\u05de\u05d5\u05e9 \u05d1\u05dc\u05d9\u05de\u05d5\u05d3 \u05e9\u05de\u05d5\u05e8',
      'Reopen profile-scoped Hands and Spots without mixing Saved with the Home dashboard.': '\u05e4\u05ea\u05d7\u05d5 \u05d9\u05d3\u05d9\u05d9\u05dd \u05d5\u05e1\u05e4\u05d5\u05d8\u05d9\u05dd \u05e9\u05dc \u05d4\u05e4\u05e8\u05d5\u05e4\u05d9\u05dc \u05d1\u05dc\u05d9 \u05dc\u05e2\u05e8\u05d1\u05d1 \u05d0\u05ea Saved \u05e2\u05dd \u05dc\u05d5\u05d7 Home.',
      'Saved has its own study job': '\u05dc-Saved \u05d9\u05e9 \u05ea\u05e4\u05e7\u05d9\u05d3 \u05dc\u05d9\u05de\u05d5\u05d3\u05d9 \u05de\u05e9\u05dc\u05d5',
      'Saved belongs to the signed-in Riverline profile. Signing in selects that profile on this device; it does not enable sync or cloud backup.': '\u05d4\u05dc\u05d9\u05de\u05d5\u05d3 \u05d4\u05e9\u05de\u05d5\u05e8 \u05e9\u05d9\u05d9\u05da \u05dc\u05e4\u05e8\u05d5\u05e4\u05d9\u05dc Riverline \u05d4\u05de\u05d7\u05d5\u05d1\u05e8. \u05d4\u05d4\u05ea\u05d7\u05d1\u05e8\u05d5\u05ea \u05d1\u05d5\u05d7\u05e8\u05ea \u05d0\u05ea \u05d4\u05e4\u05e8\u05d5\u05e4\u05d9\u05dc \u05d1\u05de\u05db\u05e9\u05d9\u05e8 \u05d4\u05d6\u05d4; \u05d4\u05d9\u05d0 \u05d0\u05d9\u05e0\u05d4 \u05de\u05e4\u05e2\u05d9\u05dc\u05d4 \u05e1\u05e0\u05db\u05e8\u05d5\u05df \u05d0\u05d5 \u05d2\u05d9\u05d1\u05d5\u05d9 \u05d1\u05e2\u05e0\u05df.',
      'Reopen the exact study object': '\u05e4\u05ea\u05d7\u05d5 \u05d0\u05ea \u05e4\u05e8\u05d9\u05d8 \u05d4\u05dc\u05d9\u05de\u05d5\u05d3 \u05d4\u05de\u05d3\u05d5\u05d9\u05e7',
      'Open a Saved Hand for canonical Replay or a Saved Spot for its supplied study context. Saved does not invent missing history.': '\u05e4\u05ea\u05d7\u05d5 \u05d9\u05d3 \u05e9\u05de\u05d5\u05e8\u05d4 \u05dc-Replay \u05e7\u05e0\u05d5\u05e0\u05d9 \u05d0\u05d5 \u05e1\u05e4\u05d5\u05d8 \u05e9\u05de\u05d5\u05e8 \u05dc\u05d4\u05e7\u05e9\u05e8 \u05d4\u05dc\u05d9\u05de\u05d5\u05d3 \u05e9\u05e1\u05d5\u05e4\u05e7. Saved \u05d0\u05d9\u05e0\u05d5 \u05de\u05de\u05e6\u05d9\u05d0 \u05d4\u05d9\u05e1\u05d8\u05d5\u05e8\u05d9\u05d4 \u05d7\u05e1\u05e8\u05d4.',
      'Return to items you marked': '\u05d7\u05d6\u05e8\u05d5 \u05dc\u05e4\u05e8\u05d9\u05d8\u05d9\u05dd \u05e9\u05e1\u05d9\u05de\u05e0\u05ea\u05dd',
      'Review and Mistake group the same Saved objects you explicitly classified; they are study intent, not an objective strategy grade.': 'Review \u05d5-Mistake \u05de\u05e7\u05d1\u05e6\u05d9\u05dd \u05d0\u05ea \u05d0\u05d5\u05ea\u05dd \u05e4\u05e8\u05d9\u05d8\u05d9 Saved \u05e9\u05e1\u05d9\u05d5\u05d5\u05d2\u05ea\u05dd \u05d1\u05de\u05e4\u05d5\u05e8\u05e9; \u05d6\u05d5\u05d4\u05d9 \u05db\u05d5\u05d5\u05e0\u05ea \u05dc\u05d9\u05de\u05d5\u05d3 \u05d5\u05dc\u05d0 \u05d4\u05e6\u05d9\u05d5\u05df \u05d0\u05d5\u05d1\u05d9\u05d9\u05e7\u05d8\u05d9\u05d1\u05d9 \u05dc\u05d0\u05e1\u05d8\u05e8\u05d8\u05d2\u05d9\u05d4.',
    },
  };
  Object.assign(en, savedTutorial.en);
  Object.assign(ru, savedTutorial.ru);
  Object.assign(he, savedTutorial.he);
  const analysisFactsTutorial = 'Use the visible Facts for exact decision context, then open Explain for supported hand, draw, board, source, and limitation detail. Facts come from canonical inputs and the canonical evaluator, not from the recommendation.';
  en[analysisFactsTutorial] = analysisFactsTutorial;
  ru[analysisFactsTutorial] = 'Сначала используйте видимые «Факты» для точного контекста решения, затем откройте «Объяснение» для подтверждённых деталей руки, дро, борда, источника и ограничений. Факты поступают из канонических входных данных и оценщиков, а не из рекомендации.';
  he[analysisFactsTutorial] = 'השתמשו תחילה ב„עובדות” הגלויות להקשר המדויק של ההחלטה, ואז פתחו את „הסבר” לפרטים נתמכים על היד, הדרואים, הלוח, המקור והמגבלות. העובדות מגיעות מהקלטים ומהמעריכים הקנוניים, לא מההמלצה.';

  const uncertaintyRevisitKey = 'Optionally mark your answer unsure before submitting. After answering, request an exact revisit in 24 hours. Open Training Memory while idle to practice, snooze, or stop reminders. A revisit does not prove retention.';
  en[uncertaintyRevisitKey] = uncertaintyRevisitKey;
  ru[uncertaintyRevisitKey] = 'Перед ответом можно отметить неуверенность. После ответа запланируйте повтор той же ситуации через 24 часа. Вне сессии откройте историю тренировок, чтобы повторить, отложить или отключить напоминания. Сам повтор не доказывает закрепление навыка.';
  he[uncertaintyRevisitKey] = 'אפשר לסמן חוסר ודאות לפני שליחת התשובה. לאחר התשובה ניתן לבקש חזרה על אותו מצב בעוד 24 שעות. מחוץ לאימון, פתח את זיכרון האימונים כדי לתרגל, לדחות או להפסיק תזכורות. עצם החזרה אינה מוכיחה שימור מיומנות.';

  const truthTutorialCopy = [
    ['Hero cards, board, pot, stack, position, and facing action come from the generated canonical trajectory. Form your answer before Riverline reveals the source comparison.', 'Карты Hero, борд, банк, стек, позиция и действие соперника берутся из сгенерированной канонической раздачи. Выберите ответ до показа сравнения с источником.', 'קלפי Hero, הלוח, הקופה, הערימה, העמדה והפעולה שמולך מגיעים מהמהלך הקנוני שנוצר. בחר תשובה לפני הצגת ההשוואה למקור.'],
    ['Optional hints reveal one prompt at a time without exposing the full source distribution before your answer.', 'Подсказки открываются по одной, не раскрывая полное распределение источника до ответа.', 'הרמזים האופציונליים נחשפים אחד בכל פעם בלי להציג את התפלגות המקור המלאה לפני התשובה.'],
    ['Read the source comparison, explanation, and next action after answering.', 'После ответа изучите сравнение с источником, объяснение и следующий шаг.', 'לאחר התשובה, קרא את ההשוואה למקור, ההסבר והצעד הבא.'],
    ['Understand the comparison', 'Разберитесь в сравнении', 'הבן את ההשוואה'],
    ['Heuristic comparisons describe agreement, not correctness. Only an accepted assessment can judge whether an action is supported.', 'Сравнение с эвристикой показывает совпадение, а не правильность. Только принятый критерий оценки позволяет судить, поддерживается ли действие.', 'השוואה היוריסטית מתארת התאמה, לא נכונות. רק הערכה מאושרת יכולה לקבוע אם פעולה נתמכת.'],
    ['Displayed frequencies come from the named strategy source. They show its mix and do not imply EV loss, solver accuracy, or confidence percentages.', 'Показанные частоты взяты из указанного источника стратегии. Они описывают его смесь, но не потери EV, точность солвера или проценты уверенности.', 'התדירויות המוצגות מגיעות ממקור האסטרטגיה המצוין. הן מתארות את התמהיל שלו ואינן מעידות על אובדן EV, דיוק סולבר או אחוזי ביטחון.'],
  ];
  for (const [key, russian, hebrew] of truthTutorialCopy) { en[key] = key; ru[key] = russian; he[key] = hebrew; }
  const personalUnderstandingTutorial = [
    ['Teach Riverline your intended strategy', 'Обучите Riverline своей задуманной стратегии', 'למדו את Riverline את האסטרטגיה הרצויה שלכם'],
    ['Describe, confirm, and correct what Riverline understands about your intended play.', 'Опишите, подтвердите и исправьте то, как Riverline понимает вашу задуманную игру.', 'תארו, אשרו ותקנו את מה ש־Riverline מבינה לגבי המשחק הרצוי שלכם.'],
    ['Build an understanding you can correct', 'Создайте понимание, которое можно исправить', 'בנו הבנה שאפשר לתקן'],
    ['Personal Strategy keeps your intended play separate from observed behavior and strategy sources. Describe your intention, teach exact examples, and inspect what remains unknown.', 'Личная стратегия отделяет вашу задуманную игру от наблюдаемого поведения и источников стратегии. Опишите намерение, дайте точные примеры и посмотрите, что остаётся неизвестным.', 'האסטרטגיה האישית שומרת בנפרד את המשחק הרצוי שלכם, ההתנהגות שנצפתה ומקורות האסטרטגיה. תארו כוונה, למדו דוגמאות מדויקות ובדקו מה עדיין לא ידוע.'],
    ['Start with one Game Setup and one Approach', 'Начните с одних игровых условий и одного подхода', 'התחילו ממערך משחק אחד וגישה אחת'],
    ['Name a game you recognize and one intended way of playing there. Add independent Approaches whenever useful. Game names do not select poker mathematics; inspect the actual decision context and accounting.', 'Назовите знакомую игру и один задуманный способ игры в ней. Добавляйте независимые подходы при необходимости. Названия игр не выбирают покерную математику: проверяйте фактический контекст решения и расчёт взносов.', 'תנו שם למשחק מוכר ולדרך אחת שבה תרצו לשחק בו. הוסיפו גישות עצמאיות לפי הצורך. שמות המשחקים אינם קובעים את מתמטיקת הפוקר; בדקו את הקשר ההחלטה ואת חישוב הכספים בפועל.'],
    ['Inspect what Riverline understands', 'Проверьте, что понимает Riverline', 'בדקו מה Riverline מבינה'],
    ['Confirmed tendencies, exact answers, estimates, unknowns, and conflicts remain distinct. Expand evidence when needed; a qualitative tendency never becomes an exact range or frequency.', 'Подтверждённые тенденции, точные ответы, оценки, неизвестные области и противоречия остаются раздельными. Раскрывайте данные при необходимости: качественная тенденция не превращается в точный диапазон или частоту.', 'נטיות מאושרות, תשובות מדויקות, הערכות, אזורים לא ידועים וסתירות נשארים נפרדים. פתחו את הראיות לפי הצורך; נטייה איכותנית אינה הופכת לטווח מדויק או לתדירות.'],
    ['Confirm the meaning before saving', 'Подтвердите смысл перед сохранением', 'אשרו את המשמעות לפני השמירה'],
    ['Use your own words and preview the interpretation. Confirm intended meaning, correct a misunderstanding, narrow its scope, or add an exception. Unconfirmed wording can guide a clarification but does not change saved intent.', 'Пишите своими словами и просматривайте интерпретацию. Подтвердите смысл, исправьте недопонимание, сузьте область действия или добавьте исключение. Неподтверждённый текст может направлять уточнение, но не меняет сохранённое намерение.', 'כתבו במילים שלכם והציגו את הפרשנות. אשרו את המשמעות הרצויה, תקנו אי־הבנה, צמצמו את התחולה או הוסיפו חריגה. ניסוח שטרם אושר יכול לכוון שאלת הבהרה, אך אינו משנה כוונה שנשמרה.'],
    ['Use Matrix Edit for precise examples', 'Используйте редактор матрицы для точных примеров', 'השתמשו בעריכת מטריצה לדוגמאות מדויקות'],
    ['Matrix Edit feeds the same intended evidence. Inspect a hand, correct its dominant action, or enter an explicit exact mix. Corrections preserve history; preferred actions never imply 100% frequency.', 'Редактор матрицы дополняет те же данные о намерениях. Проверьте руку, исправьте предпочитаемое действие или введите явную точную смесь. Исправления сохраняют историю; предпочитаемое действие не означает частоту 100%.', 'עריכת המטריצה מוסיפה לאותן ראיות על הכוונה. בדקו יד, תקנו את הפעולה המועדפת או הזינו תמהיל מדויק ומפורש. תיקונים שומרים את ההיסטוריה; פעולות מועדפות אינן מציינות תדירות של 100%.'],
    ['Answer for this Game Setup and Approach', 'Отвечайте для этих игровых условий и подхода', 'ענו לפי מערך המשחק והגישה האלה'],
    ['The hand belongs to the selected Game Setup, Approach, and decision context. Choose how you intend to play there; this is intended evidence, not an observation of your behavior.', 'Рука относится к выбранным игровым условиям, подходу и контексту решения. Выберите, как вы хотите играть в этой ситуации: это данные о намерении, а не наблюдение за вашим поведением.', 'היד שייכת למערך המשחק, לגישה ולהקשר ההחלטה שנבחרו. בחרו איך אתם רוצים לשחק שם; זו ראיה על כוונה, ולא תצפית על ההתנהגות שלכם.'],
    ['Selecting an action records your preferred or dominant action for this hand. It never means the action is played at a pure 100% frequency.', 'Выбор действия записывает предпочитаемое или доминирующее действие для этой руки. Это никогда не означает, что действие выполняется с чистой частотой 100%.', 'בחירת פעולה שומרת את הפעולה המועדפת או הדומיננטית שלכם ביד הזאת. היא לעולם אינה אומרת שהפעולה מתבצעת בתדירות מלאה של 100%.'],
    ['Set Frequencies stores an explicit mix over the available actions separately from a quick answer. An exact tie is valid and has no dominant action.', '«Задать частоты» сохраняет явную смесь доступных действий отдельно от быстрого ответа. Точное равенство допустимо и не имеет доминирующего действия.', '«הגדרת תדירויות» שומרת תמהיל מפורש של הפעולות הזמינות בנפרד מתשובה מהירה. שוויון מדויק תקין, ואין בו פעולה דומיננטית.'],
  ];
  personalUnderstandingTutorial.push(
    ['Name a game and check the table size and effective stack. Extra setup options are secondary. Add independent Approaches whenever useful. Game names do not select poker mathematics; the decision context preserves the actual accounting.', 'Назовите игру и проверьте размер стола и эффективный стек. Дополнительные настройки вторичны. Добавляйте независимые подходы при необходимости. Названия игр не выбирают покерную математику: контекст решения сохраняет фактический расчёт взносов.', 'תנו שם למשחק ובדקו את מספר השחקנים ואת הערימה האפקטיבית. אפשרויות ההגדרה הנוספות משניות. הוסיפו גישות עצמאיות לפי הצורך. שמות המשחקים אינם קובעים את מתמטיקת הפוקר; הקשר ההחלטה שומר את חישוב הכספים בפועל.'],
    ['Answer concrete poker questions to map hand families and boundaries, then refine what remains uncertain.', 'Отвечайте на конкретные покерные вопросы, чтобы исследовать семейства рук и их границы, а затем уточняйте оставшиеся неопределённости.', 'ענו על שאלות פוקר קונקרטיות כדי למפות משפחות ידיים וגבולות, ואז דייקו את מה שנותר לא ודאי.'],
    ['Map how you intend to play', 'Исследуйте, как вы хотите играть', 'מפו איך אתם רוצים לשחק'],
    ['Start with a concrete hand and choose what you would usually do. Riverline uses your answers to build a structural range map. Intended play stays separate from observed behavior and strategy sources.', 'Начните с конкретной руки и выберите, как вы обычно сыграли бы. Riverline использует ответы для построения структурной карты диапазона. Задуманная игра остаётся отдельной от наблюдаемого поведения и источников стратегии.', 'התחילו מיד מסוימת ובחרו מה הייתם עושים בדרך כלל. Riverline משתמשת בתשובות כדי לבנות מפה של מבנה הטווח. המשחק הרצוי נשאר נפרד מההתנהגות שנצפתה וממקורות האסטרטגיה.'],
    ['Explore families and their boundaries', 'Исследуйте семейства и их границы', 'בדקו משפחות ידיים וגבולות'],
    ['Questions adapt to your answers, exploring hand families and nearby action boundaries. One example does not establish a region. There is no fixed question quota; stop whenever you want and return to refine the map.', 'Вопросы подстраиваются под ответы и исследуют семейства рук и соседние границы действий. Одного примера недостаточно, чтобы описать область. Фиксированной нормы вопросов нет: остановитесь в любой момент и вернитесь для уточнения карты.', 'השאלות מסתגלות לתשובות שלכם ובודקות משפחות ידיים וגבולות פעולה סמוכים. דוגמה אחת אינה מגדירה אזור. אין מכסת שאלות קבועה; אפשר לעצור בכל רגע ולחזור כדי לדייק את המפה.'],
    ['Read coverage, not a completion score', 'Оценивайте охват, а не балл завершения', 'קראו כיסוי, ולא ציון השלמה'],
    ['Coverage shows which families have an initial map, remain partly mapped, or are not explored. A sampled region is not a complete range. Exact answers, estimates, unknowns, and conflicts stay distinct.', 'Охват показывает, какие семейства уже получили начальную карту, исследованы частично или ещё не изучены. Проверенные примеры не означают полного диапазона. Точные ответы, оценки, неизвестные области и противоречия остаются раздельными.', 'הכיסוי מראה אילו משפחות מופו לראשונה, אילו מופו חלקית ואילו טרם נבדקו. אזור שנבדקו בו דוגמאות אינו טווח מלא. תשובות מדויקות, הערכות, אזורים לא ידועים וסתירות נשארים נפרדים.'],
    ['Add context only when it helps', 'Добавляйте контекст, когда он полезен', 'הוסיפו הקשר רק כשזה עוזר'],
    ['Concrete answers lead. Add context, an exception, or a correction when needed, then preview and confirm the meaning. Unconfirmed wording can guide a clarification but does not change saved intent.', 'Главное — конкретные ответы. При необходимости добавьте контекст, исключение или исправление, затем просмотрите и подтвердите смысл. Неподтверждённый текст может направлять уточнение, но не меняет сохранённое намерение.', 'תשובות קונקרטיות מובילות. הוסיפו הקשר, חריגה או תיקון לפי הצורך, ואז הציגו ואשרו את המשמעות. ניסוח שטרם אושר יכול לכוון שאלת הבהרה, אך אינו משנה כוונה שנשמרה.'],
    ['Follow family coverage and boundaries', 'Следите за охватом семейств и границами', 'עקבו אחר כיסוי המשפחות והגבולות'],
    ['Progress follows the evidence across hand families and action boundaries, not a fixed number of questions. Sparse families remain uncertain. You can stop early and resume mapping or refinement later.', 'Прогресс отражает данные о семействах рук и границах действий, а не фиксированное число вопросов. Малоизученные семейства остаются неопределёнными. Можно остановиться раньше и продолжить исследование или уточнение позже.', 'ההתקדמות משקפת את הראיות במשפחות הידיים ובגבולות הפעולה, ולא מספר שאלות קבוע. משפחות עם מעט ראיות נשארות לא ודאיות. אפשר לעצור מוקדם ולחזור בהמשך למיפוי או לדיוק.'],
  );
  personalUnderstandingTutorial.push(
    ['Your next learning step', 'Следующий шаг обучения', 'הצעד הבא בלמידה'],
    ['Coach connects an evidence gap or a comparison difference to one reasoning question. Teach the suggested hand, inspect a conflicting answer, or try a nearby hand. These prompts do not grade your strategy.', 'Coach связывает пробел в данных или различие при сравнении с одним вопросом для размышления. Опишите предложенную руку, проверьте противоречивый ответ или рассмотрите соседнюю руку. Эти вопросы не оценивают качество вашей стратегии.', 'המאמן מחבר פער בראיות או הבדל בהשוואה לשאלת חשיבה אחת. תארו את היד המוצעת, בדקו תשובה סותרת או נסו יד סמוכה. השאלות האלה אינן מדרגות את האסטרטגיה שלכם.'],
  );
  for (const [key, russian, hebrew] of personalUnderstandingTutorial) { en[key] = key; ru[key] = russian; he[key] = hebrew; }
  for (const [key, russian, hebrew] of [
    ['Teach through a hand', 'Обучение через раздачу', 'ללמד דרך יד'],
    ['Teach an exact BTN opening size, then follow selected actions and public cards through flop, turn and river. Inspect partial ranges, adopt combo intentions, and revisit earlier nodes for variations. Coach asks reasoning questions without grading your strategy.', 'Откройте изучение раздачи, укажите частоту для размера открытия BTN, затем опишите точные комбинации на достигнутом флопе. Неописанные руки остаются неизвестными. Coach задаёт вопросы для размышления без оценки качества стратегии.', 'פתחו לימוד יד כדי ללמד גודל פתיחה מ־BTN, ואז תארו צירופים מדויקים בפלופ שאליו הגעתם. ידיים שלא מופו נשארות לא ידועות. המאמן שואל שאלות לחשיבה בלי לדרג את האסטרטגיה שלכם.'],
  ]) { en[key] = key; ru[key] = russian; he[key] = hebrew; }
  const guestStudyBoundary = 'Saved study, Personal Strategy, and Training Memory stay on this device in Guest Mode. Guest data does not sync.';
  en[guestStudyBoundary] = guestStudyBoundary;
  ru[guestStudyBoundary] = 'Сохранённые материалы, личная стратегия и память тренировок остаются на этом устройстве в гостевом режиме. Данные гостя не синхронизируются.';
  he[guestStudyBoundary] = 'הלימוד השמור, האסטרטגיה האישית וזיכרון האימונים נשארים במכשיר הזה במצב אורח. נתוני אורח אינם מסתנכרנים.';
  const opponentTutorial = [
    ['Compare synthetic policies and choose a study question for a new Full Hand. Questions do not guarantee a situation or change grading. After the hand, inspect the frozen policy, actor inputs and decisions. Teach through a hand connects policy questions to your existing Approach regions without changing intent.',
      'Сравните синтетические политики и выберите вопрос для новой полной раздачи. Вопросы не гарантируют ситуацию и не меняют оценивание. После раздачи изучите зафиксированную политику, входные данные соперника и решения. Обучение через раздачу связывает вопросы о политике с регионами вашего Approach, не меняя замысел.',
      'השוו מדיניות סינתטית ובחרו שאלת לימוד ליד מלאה חדשה. שאלות אינן מבטיחות מצב ואינן משנות הערכה. לאחר היד, בדקו את המדיניות שנשמרה, את הקלט לשחקן ואת החלטותיו. לימוד דרך יד מחבר שאלות על המדיניות לאזורים הקיימים בגישה שלכם בלי לשנות כוונה.'],
    ['Choose a synthetic opponent', 'Выберите синтетического соперника', 'בחרו יריב סינתטי'],
    ['Full Hand offers explicit opponent parameters for all opponents or BB only. Read the assumptions before starting; these card-independent policies describe synthetic behavior, not correct strategy or real people.',
      'В полной раздаче можно задать параметры для всех соперников или только BB. Перед началом прочитайте допущения: эти политики не учитывают силу карт и описывают синтетическое поведение, а не правильную стратегию или реальных людей.',
      'ביד מלאה אפשר להגדיר פרמטרים לכל היריבים או רק ל־BB. קראו את ההנחות לפני ההתחלה: המדיניות אינה מתחשבת בחוזק הקלפים ומתארת התנהגות סינתטית, ולא אסטרטגיה נכונה או אנשים אמיתיים.'],
  ];
  opponentTutorial.forEach(([key, russian, hebrew]) => { en[key] = key; ru[key] = russian; he[key] = hebrew; });
  const exploitTutorial = [
    ['Explore why an action might work', 'Разберите, почему действие может сработать', 'בדקו למה פעולה עשויה לעבוד'],
    ['Explore an action and size in Why might this action work? Compare how synthetic policies change value, bluff and raise-response questions. In Teach through a hand, inspect candidates or keep your strategy. Practice this node explains unsupported targets. Completed Full Hand Review keeps opponent assumptions separate from the observed action and reference.',
      'Разберите действие и размер в «Почему это действие может сработать?». Сравните, как синтетические политики меняют вопросы о вэлью, блефах и ответах на рейз. В обучении через раздачу изучите кандидатов или оставьте свою стратегию. «Тренировать этот узел» объясняет неподдерживаемые цели. Review завершённой полной раздачи разделяет предположения об оппоненте, наблюдаемое действие и референс.',
      'בדקו פעולה וגודל ב«למה הפעולה הזאת עשויה לעבוד?». השוו כיצד מדיניות סינתטית משנה שאלות על ערך, בלופים ותגובה להעלאה. בלימוד דרך יד, בדקו מועמדות או שמרו על האסטרטגיה שלכם. «תרגול הצומת הזה» מסביר מטרות שאינן נתמכות. סקירת יד מלאה שהסתיימה מפרידה בין הנחות על היריב, הפעולה שנצפתה והייחוס.'],
  ];
  exploitTutorial.forEach(([key, russian, hebrew]) => { en[key] = key; ru[key] = russian; he[key] = hebrew; });
  const handImportCopy = [
  [
    "Import hand history",
    "Импорт истории раздачи",
    "ייבוא היסטוריית יד"
  ],
  [
    "Paste one PokerStars English NLHE cash hand. Parsing stays on this device.",
    "Вставьте одну кеш-раздачу NLHE PokerStars на английском. Обработка выполняется на этом устройстве.",
    "הדביקו יד קאש NLHE אחת מ־PokerStars באנגלית. העיבוד מתבצע במכשיר הזה."
  ],
  [
    "Hand history",
    "История раздачи",
    "היסטוריית יד"
  ],
  [
    "Import file",
    "Импорт файла",
    "ייבוא קובץ"
  ],
  [
    "Preview reconstruction",
    "Предпросмотр восстановления",
    "תצוגה מקדימה של השחזור"
  ],
  [
    "Open in Review",
    "Открыть разбор",
    "פתיחה בסקירה"
  ],
  [
    "Hand reconstructed",
    "Раздача восстановлена",
    "היד שוחזרה"
  ],
  [
    "Reconstruction unavailable",
    "Восстановление недоступно",
    "השחזור אינו זמין"
  ],
  [
    "Inspect import details",
    "Сведения об импорте",
    "בדיקת פרטי הייבוא"
  ],
  [
    "Imported hand",
    "Импортированная раздача",
    "יד מיובאת"
  ],
  [
    "Import evidence",
    "Данные импорта",
    "ראיות הייבוא"
  ],
  [
    "Format",
    "Формат",
    "פורמט"
  ],
  [
    "Source hand",
    "Исходная раздача",
    "יד המקור"
  ],
  [
    "Source timestamp",
    "Время в источнике",
    "זמן המקור"
  ],
  [
    "Parser version",
    "Версия парсера",
    "גרסת המפענח"
  ],
  [
    "Reconstruction version",
    "Версия восстановления",
    "גרסת השחזור"
  ],
  [
    "Canonical hand",
    "Каноническая раздача",
    "היד הקנונית"
  ],
  [
    "Import facts: exact",
    "Факты импорта: точные",
    "עובדות ייבוא: מדויקות"
  ],
  [
    "Import facts: inferred",
    "Факты импорта: выведенные",
    "עובדות ייבוא: מוסקות"
  ],
  [
    "Import facts: missing",
    "Факты импорта: отсутствующие",
    "עובדות ייבוא: חסרות"
  ],
  [
    "Import facts: ambiguous",
    "Факты импорта: неоднозначные",
    "עובדות ייבוא: עמומות"
  ],
  [
    "Import facts: unsupported",
    "Факты импорта: неподдерживаемые",
    "עובדות ייבוא: לא נתמכות"
  ],
  [
    "Raw hand-history text is not stored with Saved Hands.",
    "Исходный текст истории не сохраняется вместе с раздачей.",
    "טקסט ההיסטוריה המקורי אינו נשמר עם היד."
  ],
  [
    "Raises are interpreted as the total committed on this street, as defined by this format.",
    "Рейзы означают общий вклад на текущей улице, согласно правилам формата.",
    "העלאות מציינות את סך ההשקעה ברחוב הנוכחי, כפי שמגדיר הפורמט."
  ],
  [
    "Gross pot",
    "Банк до рейка",
    "קופה לפני רייק"
  ],
  [
    "Recorded rake",
    "Рейк из истории",
    "רייק מתועד"
  ],
  [
    "Awarded",
    "Выплачено",
    "שולם"
  ],
  [
    "Line",
    "Строка",
    "שורה"
  ],
  [
    "Reconstructing hand…",
    "Восстанавливаем раздачу…",
    "משחזר את היד…"
  ],
  [
    "The import was cancelled or is unavailable. Try again.",
    "Импорт отменён или недоступен. Попробуйте ещё раз.",
    "הייבוא בוטל או אינו זמין. נסו שוב."
  ],
  [
    "Paste one hand history of at most 250,000 characters.",
    "Вставьте одну историю раздачи длиной до 250 000 символов.",
    "הדביקו היסטוריית יד אחת עד 250,000 תווים."
  ],
  [
    "Use one PokerStars English cash No Limit Hold’em hand.",
    "Нужна одна кеш-раздача PokerStars No Limit Hold’em на английском.",
    "נדרשת יד קאש No Limit Hold’em אחת מ־PokerStars באנגלית."
  ],
  [
    "The game header is missing or unsupported.",
    "Заголовок игры отсутствует или не поддерживается.",
    "כותרת המשחק חסרה או אינה נתמכת."
  ],
  [
    "The table, button or seats are missing.",
    "Не указан стол, баттон или места игроков.",
    "חסרים שולחן, כפתור או מושבים."
  ],
  [
    "This history does not identify Hero and two Hero cards.",
    "История не указывает Hero и две его карты.",
    "ההיסטוריה אינה מזהה את Hero ושני קלפיו."
  ],
  [
    "The history must state the total pot and rake explicitly.",
    "История должна явно указывать общий банк и рейк.",
    "ההיסטוריה חייבת לציין במפורש את הקופה הכוללת והרייק."
  ],
  [
    "This line contains information Riverline cannot safely interpret.",
    "Эта строка содержит данные, которые Riverline не может однозначно прочитать.",
    "שורה זו מכילה מידע ש־Riverline אינו יכול לפרש בוודאות."
  ],
  [
    "A card is repeated or invalid. Riverline cannot reconstruct this hand safely.",
    "Карта повторяется или недопустима. Riverline не может достоверно восстановить раздачу.",
    "קלף חוזר או אינו תקין. Riverline אינו יכול לשחזר את היד בבטחה."
  ],
  [
    "A player’s showdown cards are missing. The final result cannot be verified.",
    "Отсутствуют карты игрока на вскрытии. Итог нельзя проверить.",
    "חסרים קלפי שחקן בחשיפה. לא ניתן לאמת את התוצאה."
  ],
  [
    "These amounts cannot be represented exactly in Riverline’s chip units.",
    "Эти суммы нельзя точно представить в единицах фишек Riverline.",
    "לא ניתן לייצג סכומים אלה בדיוק ביחידות הצ׳יפים של Riverline."
  ],
  [
    "The raise increment does not agree with the raise-to amount.",
    "Прибавка рейза не совпадает с итоговым размером рейза.",
    "תוספת ההעלאה אינה תואמת לסכום ההעלאה הכולל."
  ],
  [
    "The recorded call does not match the amount legally owed.",
    "Записанный колл не совпадает с суммой к доплате.",
    "ההשוואה המתועדת אינה תואמת לסכום הנדרש כחוק."
  ],
  [
    "The uncalled refund does not match the canonical contributions.",
    "Возврат непринятой ставки не совпадает с каноническими вкладами.",
    "החזר ההימור שלא הושווה אינו תואם להשקעות הקנוניות."
  ],
  [
    "The history is missing an uncalled refund required by the actions.",
    "В истории нет возврата непринятой ставки, следующего из действий.",
    "חסר בהיסטוריה החזר של הימור שלא הושווה, הנדרש לפי הפעולות."
  ],
  [
    "A join or leave notice does not change the players dealt into this hand.",
    "Сообщение о входе или выходе не меняет состав игроков этой раздачи.",
    "הודעת הצטרפות או עזיבה אינה משנה את משתתפי היד."
  ],
  [
    "The recorded action or settlement does not reconcile with the legal hand.",
    "Записанное действие или расчёт не согласуется с легальной раздачей.",
    "הפעולה או התשלום המתועדים אינם מתיישבים עם היד החוקית."
  ],
  [
    "The source facts conflict or are incomplete. Inspect the indicated line.",
    "Исходные факты противоречат друг другу или неполны. Проверьте указанную строку.",
    "עובדות המקור סותרות או חסרות. בדקו את השורה המצוינת."
  ]
];
  handImportCopy.push(...[
  [
    "Recorded settlement",
    "Расчёт по истории",
    "תשלום מתועד"
  ],
  [
    "Imported hand. Choose a recorded Hero decision to study.",
    "Импортированная раздача. Выберите записанное решение Hero для изучения.",
    "יד מיובאת. בחרו החלטת Hero מתועדת ללימוד."
  ],
  [
    "Study this decision",
    "Изучить это решение",
    "לימוד ההחלטה"
  ],
  [
    "Recorded play, personal intent, and reference comparison are separate evidence.",
    "Записанная игра, личное намерение и сравнение с источником — отдельные данные.",
    "משחק מתועד, כוונה אישית והשוואה למקור הם ראיות נפרדות."
  ],
  [
    "Inspect personal intent",
    "Посмотреть личное намерение",
    "בדיקת הכוונה האישית"
  ],
  [
    "Refine context or update intent",
    "Уточнить контекст или изменить намерение",
    "דיוק ההקשר או עדכון הכוונה"
  ],
  [
    "Mark as situational",
    "Отметить как ситуативное",
    "סימון כתלוי מצב"
  ],
  [
    "Recorded action",
    "Записанное действие",
    "פעולה מתועדת"
  ],
  [
    "Intended action",
    "Задуманное действие",
    "פעולה מתוכננת"
  ],
  [
    "The action types agree; this is not a correctness assessment.",
    "Типы действий совпадают; это не оценка правильности.",
    "סוגי הפעולות תואמים; זו אינה הערכת נכונות."
  ],
  [
    "The action types differ; context and intent need human interpretation.",
    "Типы действий различаются; контекст и намерение требуют вашей интерпретации.",
    "סוגי הפעולות שונים; ההקשר והכוונה דורשים פרשנות אנושית."
  ],
  [
    "Imported decision practice has no compatible Training request.",
    "Для тренировки импортированного решения пока нет совместимого запроса Training.",
    "אין בקשת אימון תואמת לתרגול ההחלטה המיובאת."
  ],
  [
    "Recorded rake does not establish a compatible Personal Strategy rake model.",
    "Рейк из истории не задаёт совместимую модель рейка для Personal Strategy.",
    "רייק מתועד אינו מגדיר מודל רייק תואם לאסטרטגיה האישית."
  ],
  [
    "Personal intent lookup for this imported postflop decision is unavailable.",
    "Поиск личного намерения для этого импортированного постфлоп-решения недоступен.",
    "חיפוש כוונה אישית להחלטה מיובאת זו אחרי הפלופ אינו זמין."
  ],
  [
    "This canonical decision has no supported Personal Strategy context.",
    "У этого канонического решения нет поддерживаемого контекста Personal Strategy.",
    "להחלטה קנונית זו אין הקשר נתמך באסטרטגיה האישית."
  ],
  [
    "Choose a Game Setup and Approach in Personal Strategy.",
    "Выберите конфигурацию игры и подход в Personal Strategy.",
    "בחרו הגדרת משחק וגישה באסטרטגיה האישית."
  ],
  [
    "The selected Personal Strategy context does not match this decision.",
    "Выбранный контекст Personal Strategy не совпадает с этим решением.",
    "ההקשר שנבחר באסטרטגיה האישית אינו תואם להחלטה."
  ],
  [
    "No compatible direct personal intent is recorded.",
    "Совместимое прямое личное намерение не записано.",
    "לא תועדה כוונה אישית ישירה תואמת."
  ],
  [
    "Personal intent has an unresolved conflict.",
    "В личном намерении есть неразрешённое противоречие.",
    "קיימת סתירה לא פתורה בכוונה האישית."
  ],
  [
    "Personal Strategy is unavailable for this owner.",
    "Personal Strategy недоступна для этого владельца данных.",
    "האסטרטגיה האישית אינה זמינה לבעל הנתונים הזה."
  ]
]);
  handImportCopy.push(
    ['Saving this decision also preserves its source Hand.', 'Сохранение решения также сохраняет исходную раздачу.', 'שמירת ההחלטה שומרת גם את יד המקור.'],
    ['Gross payouts before recorded rake', 'Выплаты до учёта рейка из истории', 'תשלומים ברוטו לפני הרייק המתועד'],
    ['Choose seats, stacks, button, Hero and forced contributions to start a legal hand. Or use Import hand history to paste a PokerStars English cash hand, preview its reconstruction and open the same Review.',
      'Выберите места, стеки, баттон, Hero и обязательные взносы для легальной раздачи. Или импортируйте историю кеш-раздачи PokerStars на английском, проверьте восстановление и откройте тот же разбор.',
      'בחרו מושבים, ערימות, כפתור, Hero ותשלומי חובה כדי להתחיל יד חוקית. או ייבאו היסטוריית יד קאש מ־PokerStars באנגלית, בדקו את השחזור ופתחו את אותה סקירה.']
  );
  handImportCopy.forEach(([key, russian, hebrew]) => { en[key] = key; ru[key] = russian; he[key] = hebrew; });
  const deepStudyTutorial = [
    ['Deep Review highlights up to three decisions with explicit study reasons. Inspect separate observed, Personal, reference, baseline and opponent evidence. Review later uses Saved; supported practice uses Training Memory. Home Study Inbox suggests one next item from existing sources.',
      'Глубокий разбор выделяет до трёх решений с явными причинами изучения. Проверяйте раздельно наблюдаемое действие, личное намерение, референс, эвристический ориентир и данные оппонента. «Разобрать позже» использует сохранения; доступная практика — память тренировок. Очередь изучения на главной предлагает следующий материал из существующих источников.',
      'סקירה מעמיקה מדגישה עד שלוש החלטות עם סיבות לימוד מפורשות. בדקו בנפרד פעולה שנצפתה, כוונה אישית, ייחוס, בסיס היוריסטי וראיות על היריב. סקירה מאוחרת משתמשת בשמורים; תרגול נתמך משתמש בזיכרון האימון. תיבת הלימוד בדף הבית מציעה פריט הבא ממקורות קיימים.'],
    ['Open Study Inbox for one next recommendation and an inspectable queue from Training Memory, Saved and selected Personal conflicts. Due and review reasons stay visible. The queue covers a bounded loaded selection and never changes your intended strategy.',
      'Откройте очередь изучения: одна следующая рекомендация и проверяемая очередь из памяти тренировок, сохранений и конфликтов выбранной личной стратегии. Сроки и причины разбора видны. Очередь охватывает ограниченную загруженную выборку и не изменяет намеренную стратегию.',
      'פתחו את תיבת הלימוד להמלצה הבאה ולתור הניתן לבדיקה מזיכרון האימון, משמורים ומסתירות בכוונה שנבחרה. מועדים וסיבות סקירה נשארים גלויים. התור מכסה בחירה מוגבלת שנטענה ואינו משנה את האסטרטגיה המכוונת שלכם.'],
  ];
  deepStudyTutorial.forEach(([key, russian, hebrew]) => { en[key] = key; ru[key] = russian; he[key] = hebrew; });
  global.riverlineTutorialTranslations = Object.freeze({
    en: Object.freeze(en),
    ru: Object.freeze(ru),
    he: Object.freeze(he),
  });
}(window));
