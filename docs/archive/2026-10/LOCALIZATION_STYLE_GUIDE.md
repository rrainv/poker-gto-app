# Riverline localization style guide

Authority for Russian and Hebrew product/poker wording. For research evidence
and confidence, see [L10N_001_TERMINOLOGY_RESEARCH.md](L10N_001_TERMINOLOGY_RESEARCH.md).

## User-approved house style

These product decisions are authoritative and override research alternatives:

- RU: poker range = `рендж`; Playbook workspace = `Разбор`.
- HE: poker range = `ריינג'`; Playbook workspace = `ניתוח`.
- HE: pot = `קופה`; pot odds = `סיכויי קופה`; preflop = `פרה-פלופ`.
- HE: top pair = `טופ פייר`; two-tone = `דו-צבעי`; monotone = `חד-צבעי`.

Apply these forms and their natural grammatical derivatives consistently in
navigation, Analysis, Matrix, Training, Equity, Guide, Settings, and accessible
copy. Do not substitute a research-preferred synonym.

## Product voice

- Write like a concise poker coach and analytical tool, not translated telemetry.
- Preserve mathematical meaning and source limitations exactly.
- Prefer one short natural sentence over English noun chains.
- Address the user directly in coaching hints; use neutral factual prose in Analysis and provenance.
- Do not call heuristic output solved GTO, Nash, CFR, exploitability evidence, or solver-backed advice.

## Russian

Use established poker loanwords when Russian players normally use them:
`фолд`, `чек`, `колл`, `бет`, `рейз`, `олл-ин`, `опен-рейз`, `3-бет`,
`рендж`, `эквити`, `фолд-эквити`, `ауты`, `дро`, `борд`, `стек`,
`сайзинг`, `велью`, `блеф`, `контбет`, `шоудаун`, `гатшот`, `блокер`.

Use the normal Russian term when it is clearer and equally standard:
`банк`, `шансы банка`, `позиция`, `в позиции`, `без позиции`,
`эффективный стек`, `готовая рука`, `старшая карта`, `две пары`, `каре`.

Action contract:

| English | Button/label | Natural derived copy |
|---|---|---|
| Fold | Фолд | фолд; сделать фолд |
| Check | Чек | чек; сыграть чек |
| Call | Колл | колл; сумма/цена колла |
| Bet | Бет | бет on an action control; ставка/поставить in prose |
| Raise | Рейз | рейз; размер рейза |
| All-in | Олл-ин | олл-ин; пойти олл-ин |

Hand/draw contract: `топ-пара`, `средняя пара`, `нижняя пара`, `оверпара`,
`сет`, `трипс`, `две пары`, `стрит`, `флеш`, `фулл-хаус`, `каре`,
`флеш-дро`, `натс-флеш-дро`, `OESD (двустороннее стрит-дро)`, `гатшот`,
`комбо-дро`, `нет значимого дро`.

Board contract: `радужный`, `двухмастный`, `одномастный`, `спаренный`,
`неспаренный`, `связанный`, `несвязанный`, `координированный`, `сухой`,
`мокрый`, `бродвейный`, `низкий борд`.

## Hebrew

Use the language Israeli players use at the table. Do not manufacture formal
Hebrew where a poker loanword is established:
`פולד`, `צ'ק`, `קול`, `בט`, `רייז`, `אול-אין`, `אופן-רייז`, `3-בט`,
`ריינג'`, `אקוויטי`, `אאוטים`, `דרו`, `בורד`, `סטאק`, `בלוף`, `שואודאון`,
`גאטשוט`, `בלוקר`, `האדס-אפ`.

Prefer concise natural Hebrew where it is the common analytical form:
`קופה`, `סיכויי קופה`, `עמדה`, `בעמדה`, `מחוץ לעמדה`,
`גודל הימור`, `ערך`, `יריב`.

Action contract:

| English | Button/label | Natural derived copy |
|---|---|---|
| Fold | פולד | לעשות פולד |
| Check | צ'ק | לעשות צ'ק |
| Call | קול | קול; סכום/מחיר הקול |
| Bet | בט | בט on an action control; הימור/להמר in prose |
| Raise | רייז | רייז; גודל הרייז |
| All-in | אול-אין | אול-אין; להיכנס אול-אין |

Hand/draw contract: `טופ פייר`, `זוג אמצעי`, `זוג תחתון`, `אובר-פייר`,
`סט`, `טריפס`, `שני זוגות`, `סטרייט`, `פלאש`, `פול האוס`, `רביעייה`,
`פלאש דרו`, `נאטס פלאש דרו`, `OESD (סטרייט דרו פתוח)`, `גאטשוט`,
`קומבו דרו`, `אין דרו משמעותי`.

Board contract: `ריינבואו`, `דו-צבעי`, `חד-צבעי`, `פיירד`, `לא פיירד`,
`קונקטד`, `לא קונקטד`, `מתואם`, `יבש`, `רטוב`, `בורד עם הרבה ברודוויי`,
`בורד נמוך`. Introduce a rare technical texture with a short explanation in
help copy; do not translate it into an invented academic term.

Hebrew punctuation and direction:

- Use Hebrew sentence order and punctuation; do not mirror English syntax.
- Keep existing component-level LTR islands for cards, percentages, action mixes, IDs, and amount sequences.
- Use the ASCII apostrophe in established UI spellings such as `צ'ק` consistently.

## Invariant tokens

Keep unchanged: `Riverline`, `Hero`, `AA`, `AKs`, `AKo`, ranks/suits, `UTG`,
`HJ`, `CO`, `BTN`, `SB`, `BB`, `bb`, `RFI`, `SPR`, `MDF`, `EV`, percentages,
seeds, IDs, schema/version names, and canonical card IDs. `OESD` and `C-bet`
may be followed by a localized explanation on first use.

`Playbook` remains the English workspace name and an internal code term. Its
user-facing names are `Разбор` in Russian and `ניתוח` in Hebrew.

## Theme display names

- Preserve internal theme IDs and the `Riverline`, `Discord`, and `PioSolver` brands.
- Localize descriptive portions when the result is natural.
- Riverline color/time themes, Matrix, Solver, Action, Home Game, Midnight,
  Cyberpunk, and Casino descriptions use localized display names.
- Keep an individual canonical name only when translation would be less clear;
  `Carbon Slate` remains canonical in RU/HE for that reason.

## Capitalization, numbers, and UI length

- Russian and Hebrew sentence case follows the locale; poker loanwords are not title-cased merely because English is.
- Use a nonbreaking join where the UI already provides one; do not reorder poker-data tokens inside LTR islands.
- Preserve numeric values and placeholders exactly. Russian decimal prose uses a comma when the value is authored text; runtime-formatted poker amounts remain unchanged.
- Keep `bb`, `%`, `SPR`, `MDF`, and `EV` invariant.
- Buttons use the shortest unambiguous form. Put explanations in help text, not button labels.

## Good and bad literal copy

| Literal/awkward | Riverline style |
|---|---|
| RU: `Действие колл является ведущим ответом` | `Чаще всего — колл.` |
| RU: `Запросите обучающую подсказку` | `Показать подсказку тренера` |
| RU: `Источник не предоставляет сравнение EV` | `Источник не сравнивает EV действий.` |
| HE: `הפעולה המובילה היא קול` | `קול הוא הפעולה בתדירות הגבוהה ביותר.` |
| HE: `סכום להשוואה` | `סכום הקול` |
| HE: `מרקם הלוח` | `מרקם הבורד` |
| HE: `אין מקור סולבר מאומת` | `אין לתוצאה מקור מאומת של סולבר.` |
