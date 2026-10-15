# Riverline terminology (EN / RU / HE)

The i18n source of truth for terms. Decided with the owner on 2026-10-07 (manager chat); installed by DOCS-RESET-001. A guide for consistency: the owner's judgement is final and terms can be revised. The owner is fluent in Russian and Hebrew and judges UI naturalness.

Where this file and the code disagree, this file is the target and the code is i18n debt (see [Applying this sheet](#applying-this-sheet-code-still-differs)). It supersedes `LOCALIZATION_STYLE_GUIDE.md` and `L10N_001_TERMINOLOGY_RESEARCH.md` (archived under `docs/archive/2026-10/`); their non-conflicting style rules are kept below.

## Rules

1. **General UI terms** (Replay, Back, Analyze, Settings, Save, Cancel, Search, Filter…) use **proper standard translations**, the conventions people already know from other apps. Not loanwords, not literal calques.
2. **Poker terms follow real player usage.**
   - **Russian:** transliterated loanwords, except **fold = пас**.
   - **Hebrew:** loanwords throughout.
3. **Abbreviations and position codes stay in Latin script** in every language: UTG, HJ, CO, BTN, SB, BB, 3-bet notation in numbers, SPR, EV, GTO, MDF, bb.
4. **Hebrew RTL**: poker data (cards, ranges, amounts, abbreviations) renders as LTR islands; the 13×13 matrix is never mirrored.
5. Native words may appear as **glosses** in the glossary and tooltips (e.g. «пас: сбросить карты»), never replacing the chosen term in UI.
6. No em/en dashes in user-facing product sentences (commas, colons, parentheses, periods or hyphens instead). Technical IDs, paths, URLs, values and user-authored text keep their identity.
7. Product name: Riverline / Риверлайн / ריברליין in natural product copy.

## Actions

| English | Russian | Hebrew |
|---|---|---|
| Fold | **пас** | פולד |
| Check | чек | צ'ק |
| Call | колл | קול |
| Bet | бет | בט |
| Raise | рейз | רייז |
| 3-bet / 4-bet | 3-бет / 4-бет | 3-בט / 4-בט |
| All-in | олл-ин | אול-אין |
| Limp | лимп | לימפ |
| Open / open-raise | опен / опен-рейз | אופן / אופן-רייז |
| Check-raise | чек-рейз | צ'ק-רייז |
| Squeeze | сквиз | סקוויז |
| Donk bet | донк | דונק |
| Overbet | овербет | אוברבט |
| C-bet | **си-бет** | סי-בט |

Examples: button «Колл 2.5 bb» / «קול 2.5 bb»; history «BTN: рейз до 7.5 bb» / «BTN: רייז ל-7.5 bb».

On an action control, Bet stays бет / בט; in prose, ставка/поставить and הימור/להמר are fine (kept from the old style guide).

## Table, streets, core concepts

| English | Russian | Hebrew |
|---|---|---|
| Preflop / Flop / Turn / River | префлоп / флоп / терн / ривер | פרה-פלופ / פלופ / טרן / ריבר |
| Button / blinds / straddle / ante | баттон / блайнды / страдл / анте | באטן / בליינדים / סטראדל / אנטה |
| Stack / effective stack | стек / эффективный стек | סטאק / סטאק אפקטיבי |
| **Pot** | **банк** | **קופה** |
| **Range** | **диапазон** | **ריינג'** |
| Showdown | шоудаун | שואודאון |
| Board | борд | בורד |
| Hero | Hero | הירו |
| Equity / EV / SPR / GTO | эквити / EV / SPR / GTO | אקוויטי / EV / SPR / GTO |

## Strategy and maths

| English | Russian | Hebrew |
|---|---|---|
| Pot odds | шансы банка | סיכויי קופה |
| Required equity | необходимое эквити | אקוויטי נדרש |
| MDF | MDF | MDF |
| Combos | комбинации | קומבינציות |
| Value | **валью** | ואליו |
| Bluff / semi-bluff | блеф / полублеф | בלוף / סמי-בלוף |
| Outs / draw / nuts | ауты / дро / натс | אאוטים / דרו / נאטס |
| Blockers | блокеры | בלוקרים |
| Hand classes | топ-пара, сет, трипс, флеш-дро, стрит | טופ פייר, סט, טריפס, פלאש דרו, סטרייט |

Further hand, draw and board vocabulary kept from the old style guide (no conflict with the sheet):

- RU hands/draws: топ-пара, средняя пара, нижняя пара, оверпара, сет, трипс, две пары, стрит, флеш, фулл-хаус, каре, флеш-дро, натс-флеш-дро, OESD (двустороннее стрит-дро), гатшот, комбо-дро, нет значимого дро.
- RU boards: радужный, двухмастный, одномастный, спаренный, неспаренный, связанный, несвязанный, координированный, сухой, мокрый, бродвейный, низкий борд.
- RU plain terms where clearer and equally standard: позиция, в позиции, без позиции, готовая рука, старшая карта.
- HE hands/draws: טופ פייר, זוג אמצעי, זוג תחתון, אובר-פייר, סט, טריפס, שני זוגות, סטרייט, פלאש, פול האוס, רביעייה, פלאש דרו, נאטס פלאש דרו, OESD (סטרייט דרו פתוח), גאטשוט, קומבו דרו, אין דרו משמעותי.
- HE boards: ריינבואו, דו-צבעי, חד-צבעי, פיירד, לא פיירד, קונקטד, לא קונקטד, מתואם, יבש, רטוב, בורד עם הרבה ברודוויי, בורד נמוך. Introduce a rare texture with a short explanation in help copy; do not invent an academic term.
- HE plain terms: עמדה, בעמדה, מחוץ לעמדה, גודל הימור, יריב.

## Riverline product terms

| English | Russian | Hebrew |
|---|---|---|
| Hand (workspace) | Раздача | יד |
| Spot | Спот | ספוט |
| Personal Strategy | Личная стратегия | אסטרטגיה אישית |
| **Game** (Personal Strategy container holding Approaches) | **Игра** | **משחק** |
| Approach | Подход | גישה |
| **Table rules** (blinds, rake, stacks, table size; versioned) | **Правила стола** | **חוקי שולחן** |
| Baseline | Базовая стратегия | אסטרטגיית בסיס |
| Exact / Verified / Estimated / Unavailable | Точно / Подтверждено / Оценочно / Недоступно | מדויק / מאומת / משוער / לא זמין |
| Always / Sometimes / Never | Всегда / Иногда / Никогда | תמיד / לפעמים / אף פעם |
| Unsure / Review later / Mistake | Не уверен / Разобрать позже / Ошибка | לא בטוח / לבדיקה בהמשך / טעות |
| Same spot / Similar spot | Тот же спот / Похожий спот | אותו ספוט / ספוט דומה |
| Training / Drill / Orbit | Тренировка / Упражнение / Круг | אימון / תרגיל / סבב |
| Session report / Key moment | Отчёт о сессии / Ключевой момент | דוח סשן / רגע מפתח |
| Saved / Learn / Coverage | Сохранённое / Обучение / Охват | שמורים / למידה / כיסוי |
| Game night (Home Game workspace, user-facing) | Покерный вечер | ערב פוקר |
| Private table (no rake) (Table rules preset) | Частный стол (без рейка) | שולחן פרטי (בלי רייק) |

Notes: «раздача» is a played hand, «рука» means hole cards. «Круг» / «סבב» is how players describe going once around the table; «орбита» is rare in Russian.

## Conventions (decided)

- **Hebrew gendered labels:** masculine default (e.g. «לא בטוח»), the common app convention.
- **Button style follows each language's own convention** (Riverline should never stand out linguistically):
  - **Russian:** infinitive for actions («Сохранить», «Открыть»); conventional nouns for fixed labels («Отмена», «Настройки»).
  - **Hebrew:** masculine singular imperative for actions («שמור», «פתח», «נתח»), which localization guides describe as the Hebrew UI standard; conventional nouns where those are the norm («ביטול», «הגדרות», «חיפוש»).
- **Length budget:** short labels can grow 200–300% in translation; design buttons for the longest locale. Buttons use the shortest unambiguous form; explanations go in help text, not labels.

## Style rules kept from the old style guide

- **Voice:** a concise poker coach and analytical tool, not translated telemetry. Preserve mathematical meaning and source limitations exactly. One short natural sentence over English noun chains. Address the user directly in coaching hints; neutral factual prose in Analysis and provenance.
- **Honesty wording:** never call heuristic output solved GTO, Nash, CFR, exploitability evidence or solver-backed advice; confidence tiers use the terms above.
- **Invariant tokens** (unchanged in every language): `Riverline` (Latin in technical contexts), `AA`, `AKs`, `AKo`, ranks/suits, `UTG`, `HJ`, `CO`, `BTN`, `SB`, `BB`, `bb`, `RFI`, `SPR`, `MDF`, `EV`, percentages, seeds, IDs, schema/version names and canonical card IDs. `OESD` and `C-bet` may be followed by a localized explanation on first use.
- **Hebrew punctuation and direction:** Hebrew sentence order and punctuation (do not mirror English syntax); keep component-level LTR islands for cards, percentages, action mixes, IDs and amount sequences; use the ASCII apostrophe in established spellings such as `צ'ק` consistently.
- **Capitalization and numbers:** RU/HE sentence case follows the locale; poker loanwords are not title-cased because English is. Preserve numeric values and placeholders exactly; do not reorder poker-data tokens inside LTR islands. Russian authored decimal prose uses a comma; runtime-formatted poker amounts stay unchanged.
- **Translation never changes meaning:** localization may adapt wording and order but never changes poker semantics, fact or authority (DecisionContext, StrategyResult, Equity, Training grading). Switching language is presentation-only and keeps everything open where it is.
- **Theme names:** preserve internal theme IDs; localize descriptive parts when natural.

Good and bad literal copy (examples from the old guide; adjust terms to this sheet):

| Literal/awkward | Riverline style |
|---|---|
| RU: `Действие колл является ведущим ответом` | `Чаще всего: колл.` |
| RU: `Запросите обучающую подсказку` | `Показать подсказку тренера` |
| HE: `הפעולה המובילה היא קול` | `קול הוא הפעולה בתדירות הגבוהה ביותר.` |
| HE: `סכום להשוואה` | `סכום הקול` |
| HE: `מרקם הלוח` | `מרקם הבורד` |

## Applying this sheet (code still differs)

Checked 2026-10-15 by search in `app/src/locales/`; the code follows the older style guide in places. These are i18n work for a ticket, not permission to change terms ad hoc:

| Term | This sheet | Current code / old guide | Note |
|---|---|---|---|
| RU fold | пас | Фолд | old guide's action contract |
| RU range | диапазон | рендж (≈100 uses) and диапазон (≈135 uses) mixed | old guide chose рендж; `tests/l10n001_native_terminology.test.mjs` accepts /рендж\|стартов/ for the matrix label |
| RU value | валью | велью | |
| RU C-bet | си-бет | контбет | |
| HE Hero | הירו | `Hero` kept Latin as an invariant token | the sheet wins; confirm with the owner |
| Analyze workspace | RU «Анализ», HE «ניתוח» (owner decision D-19, 2026-10-15) | RU «Разбор», HE «ניתוח» (old house style) | RU label to change in code; HE already matches |

The M1 bar is "complete and natural enough"; native-level polish comes later (NORTH_STAR §7.17).
