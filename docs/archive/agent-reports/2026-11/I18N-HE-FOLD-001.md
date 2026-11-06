# I18N-HE-FOLD-001 — Replace User-Facing Hebrew «קיפול» with «פולד»

- **Date**: 2026-11-06
- **Branch**: `argon/m1-batch-4`
- **Base commit**: `43f3e54be4b46d814ed80522ca3dd198731797ee` (`origin/codex/stabilization`)
- **Tier**: T1
- **Issue**: `I18N-HE-FOLD`

## 1. Outcome
Replaced all 24 user-facing Hebrew occurrences of «קיפול» / «קיפולים» across the locale catalog (`app/src/locales/i18n.js`) and localized copy modules (`app/src/application/exploit-opportunity-language.mjs`, `app/src/application/exploit-review-workspace.mjs`, `app/src/application/exploit-teacher-language.mjs`, `app/src/application/personal-strategy-hand-workspace.mjs`, `app/src/application/study-language.mjs`, and `app/src/personal-strategy/node-coach.mjs`) with the canonical term «פולד» / «פולדים» per `docs/TERMINOLOGY.md`.

## 2. Root Causes / Design Choices
- `I18N-RESIDUE-001` aligned Russian Fold (`пас`), Hebrew Range (`ריינג'`), Hebrew Hero (`הירו`), and Hebrew Value (`ואליו`), leaving 24 occurrences of Hebrew «קיפול» / «קיפולים» tracked under `I18N-HE-FOLD`.
- **Input parsing check**: Verified `app/src/personal-strategy/intent-interpretation.mjs` and all other input parsers across `app/` and `shared/`. None parse «קיפול» as input; no input-parsing regular expressions were removed or weakened.
- **No key or ID changes**: Only user-facing Hebrew string values were updated.
- **Grammatical prefixes preserved**: Where Hebrew prefixes attach to the noun (`לקיפול` → `לפולד`, `לקיפולים` → `לפולדים`, `הקיפולים` → `הפולדים`, `בקיפול` → `בפולד`), the prefix was attached naturally to `פולד` / `פולדים`.

## 3. Changed Strings Table (for Owner Review)

| # | Screen / Module | File:Line | Key | Old Hebrew String | New Hebrew String |
|---|---|---|---|---|---|
| 1 | Exploit Opportunity (Analyze / Personal Strategy) | `app/src/application/exploit-opportunity-language.mjs:5` | `more_calls_less_fold_pressure` | `בהנחות הסינתטיות האלה, שני ענפי המחיר נותנים להשוואות משקל גבוה יותר מהתצורות האחרות כשהעלאה חוקית. כדאי לבדוק מועמדות ל־ואליו דק; לבלופים יש פחות משקל קיפול. תחילה זהו אילו ידיים חלשות יותר מגיעות לכאן ומשוות לגודל הזה.` | `בהנחות הסינתטיות האלה, שני ענפי המחיר נותנים להשוואות משקל גבוה יותר מהתצורות האחרות כשהעלאה חוקית. כדאי לבדוק מועמדות ל־ואליו דק; לבלופים יש פחות משקל פולד. תחילה זהו אילו ידיים חלשות יותר מגיעות לכאן ומשוות לגודל הזה.` |
| 2 | Exploit Opportunity (Analyze / Personal Strategy) | `app/src/application/exploit-opportunity-language.mjs:10` | `more_folds_fewer_value_calls` | `בהנחות הסינתטיות האלה, שני ענפי המחיר נותנים לקיפולים את המשקל הגבוה ביותר בין התצורות כשהעלאה חוקית. בהשוואה למדיניות שמרבה להשוות ובהינתן אותו ריינג' שהגיע לכאן, ייתכנו יותר הזדמנויות לבלוף ופחות השוואות ל־ואליו דק. זהו את הידיים הטובות יותר שעשויות להתקפל לפני בחירת בלוף.` | `בהנחות הסינתטיות האלה, שני ענפי המחיר נותנים לפולדים את המשקל הגבוה ביותר בין התצורות כשהעלאה חוקית. בהשוואה למדיניות שמרבה להשוות ובהינתן אותו ריינג' שהגיע לכאן, ייתכנו יותר הזדמנויות לבלוף ופחות השוואות ל־ואליו דק. זהו את הידיים הטובות יותר שעשויות להתקפל לפני בחירת בלוף.` |
| 3 | Exploit Opportunity (Analyze / Personal Strategy) | `app/src/application/exploit-opportunity-language.mjs:25` | `mixed_response_tradeoff` | `הפרמטרים האלה משנים את היחס בין משקלי השוואה, קיפול והעלאה. השוו כל ענף תואם בנפרד לפני שינוי התוכנית; התצורה אינה מזהה את הידיים שמגיבות.` | `הפרמטרים האלה משנים את היחס בין משקלי השוואה, פולד והעלאה. השוו כל ענף תואם בנפרד לפני שינוי התוכנית; התצורה אינה מזהה את הידיים שמגיבות.` |
| 4 | Exploit Review (Deep Review / Hand Review) | `app/src/application/exploit-review-workspace.mjs:15` | `fold` | `קיפול` | `פולד` |
| 5 | Exploit Teacher (Analyze / Personal Strategy) | `app/src/application/exploit-teacher-language.mjs:21` | `threshold` | `תדירות קיפול נדרשת של כל היריבים (בלוף ללא אקוויטי בהשוואה)` | `תדירות פולד נדרשת של כל היריבים (בלוף ללא אקוויטי בהשוואה)` |
| 6 | Exploit Teacher (Analyze / Personal Strategy) | `app/src/application/exploit-teacher-language.mjs:36` | `unchanged` | `הקלפים, גודל הפעולה, מחיר ההשוואה, סף הקיפולים לבלוף והכוונה השמורה נשארים זהים. המדיניות אינה מייצגת אוכלוסיית שחקנים אמיתית ואינה קובעת משחק נכון של הירו.` | `הקלפים, גודל הפעולה, מחיר ההשוואה, סף הפולדים לבלוף והכוונה השמורה נשארים זהים. המדיניות אינה מייצגת אוכלוסיית שחקנים אמיתית ואינה קובעת משחק נכון של הירו.` |
| 7 | Exploit Teacher (Analyze / Personal Strategy) | `app/src/application/exploit-teacher-language.mjs:41` | `structuralCandidate` | `פעולה אגרסיבית בגודל הזה עם משיכה ישירה היא מועמדת מבנית לסמי־בלוף. קיפולים של ידיים טובות יותר ואקוויטי בהשוואה עדיין אינם ידועים.` | `פעולה אגרסיבית בגודל הזה עם משיכה ישירה היא מועמדת מבנית לסמי־בלוף. פולדים של ידיים טובות יותר ואקוויטי בהשוואה עדיין אינם ידועים.` |
| 8 | Exploit Teacher (Analyze / Personal Strategy) | `app/src/application/exploit-teacher-language.mjs:51` | `LESSONS.multiway[2]` (occurrence 1: `לקיפול`) | `סף בלוף ללא ערך בהצגה מתייחס לקיפול של כל היריבים. אין להכפיל משקלי מדיניות כהסתברויות קיפול עצמאיות.` | `סף בלוף ללא ערך בהצגה מתייחס לפולד של כל היריבים. אין להכפיל משקלי מדיניות כהסתברויות פולד עצמאיות.` |
| 9 | Exploit Teacher (Analyze / Personal Strategy) | `app/src/application/exploit-teacher-language.mjs:51` | `LESSONS.multiway[2]` (occurrence 2: `קיפול`) | (same string as #8, second occurrence `כהסתברויות קיפול עצמאיות`) | (same string as #8, `כהסתברויות פולד עצמאיות`) |
| 10 | Exploit Teacher (Analyze / Personal Strategy) | `app/src/application/exploit-teacher-language.mjs:56` | `LESSONS.bluff[2]` | `סף הקיפולים הוא דרישה, ולא תחזית. השקעה קודמת משפיעה דרך הקופה והמחיר הנוכחיים ואינה סיבה להמשיך להמר.` | `סף הפולדים הוא דרישה, ולא תחזית. השקעה קודמת משפיעה דרך הקופה והמחיר הנוכחיים ואינה סיבה להמשיך להמר.` |
| 11 | Personal Strategy Hand Workspace | `app/src/application/personal-strategy-hand-workspace.mjs:25` | `remainder` | `יתר התדירות היא קיפול. הזינו במפורש את הכוונה שלכם לגודל הזה.` | `יתר התדירות היא פולד. הזינו במפורש את הכוונה שלכם לגודל הזה.` |
| 12 | Personal Strategy Hand Workspace | `app/src/application/personal-strategy-hand-workspace.mjs:39` | `fold` | `קיפול` | `פולד` |
| 13 | Study Inbox / Deep Review | `app/src/application/study-language.mjs:37` | `fold` | `קיפול` | `פולד` |
| 14 | Analyze / Legacy i18n Catalog (block 1) | `app/src/locales/i18n.js:1174` | `"Weak hand with no significant made strength or draws. Usually a fold to any bet."` | `יד חלשה ללא עוצמה עשויה או משיכות. בדרך כלל קיפול לכל הימור.` | `יד חלשה ללא עוצמה עשויה או משיכות. בדרך כלל פולד לכל הימור.` |
| 15 | Analyze / Legacy i18n Catalog (block 1) | `app/src/locales/i18n.js:1369` | `"usually a fold unless in a very specific situation."` | `בדרך כלל קיפול אלא אם כן במצב ספציפי מאוד.` | `בדרך כלל פולד אלא אם כן במצב ספציפי מאוד.` |
| 16 | Analyze / Legacy i18n Catalog (block 1) | `app/src/locales/i18n.js:1372` | `"This hand is generally too weak to continue profitably in this exact spot. Folding preserves your stack for better opportunities."` | `יד זו חלשה מדי כדי להמשיך ברווחיות. קיפול שומר על הערימה שלך.` | `יד זו חלשה מדי כדי להמשיך ברווחיות. פולד שומר על הערימה שלך.` |
| 17 | Analyze / Legacy i18n Catalog (block 2) | `app/src/locales/i18n.js:1547` | `"Weak hand with no significant made strength or draws. Usually a fold to any bet."` | `יד חלשה ללא עוצמה עשויה או משיכות. בדרך כלל קיפול לכל הימור.` | `יד חלשה ללא עוצמה עשויה או משיכות. בדרך כלל פולד לכל הימור.` |
| 18 | Analyze / Legacy i18n Catalog (block 2) | `app/src/locales/i18n.js:1742` | `"usually a fold unless in a very specific situation."` | `בדרך כלל קיפול אלא אם כן במצב ספציפי מאוד.` | `בדרך כלל פולד אלא אם כן במצב ספציפי מאוד.` |
| 19 | Analyze / Legacy i18n Catalog (block 2) | `app/src/locales/i18n.js:1745` | `"This hand is generally too weak to continue profitably in this exact spot. Folding preserves your stack for better opportunities."` | `יד זו חלשה מדי כדי להמשיך ברווחיות. קיפול שומר על הערימה שלך.` | `יד זו חלשה מדי כדי להמשיך ברווחיות. פולד שומר על הערימה שלך.` |
| 20 | Training Full Hand Workspace | `app/src/locales/i18n.js:2517` | `"Hand ended by fold. Hero result: {result}."` | `היד הסתיימה בקיפול. התוצאה של הירו: {result}.` | `היד הסתיימה בפולד. התוצאה של הירו: {result}.` |
| 21 | Hand Review Workspace | `app/src/locales/i18n.js:2706` | `"Ended by fold · Hero {result}"` | `הסתיים בקיפול · הירו {result}` | `הסתיים בפולד · הירו {result}` |
| 22 | Personal Strategy Node Coach | `app/src/personal-strategy/node-coach.mjs:256` | `he.concepts.bluff[2]` | `ציינו יעד קיפול סביר לפני שאתם מתייחסים לצירוף כבלוף.` | `ציינו יעד פולד סביר לפני שאתם מתייחסים לצירוף כבלוף.` |
| 23 | Personal Strategy Node Coach | `app/src/personal-strategy/node-coach.mjs:258` | `he.concepts.blocker_quality[2]` | `הסרת צירופים משמעותית רק ביחס לריינג' השוואה, קיפול או העלאה שהוגדר.` | `הסרת צירופים משמעותית רק ביחס לריינג' השוואה, פולד או העלאה שהוגדר.` |
| 24 | Personal Strategy Node Coach | `app/src/personal-strategy/node-coach.mjs:261` | `he.concepts.polarization[1]` | `אילו ידיים מהמרות כדי לקבל השוואה, אילו מכוונות לקיפול ואילו עושות צ׳ק?` | `אילו ידיים מהמרות כדי לקבל השוואה, אילו מכוונות לפולד ואילו עושות צ׳ק?` |
| 25 | Personal Strategy Node Coach | `app/src/personal-strategy/node-coach.mjs:262` | `he.concepts.value_bluff_composition[1]` | `אילו צירופים מכוונים להשוואות חלשות יותר ואילו לקיפולים של ידיים טובות יותר?` | `אילו צירופים מכוונים להשוואות חלשות יותר ואילו לפולדים של ידיים טובות יותר?` |

*(Note: 24 lines matched `קיפול`, with line 51 of `exploit-teacher-language.mjs` containing 2 occurrences on the same line, totalling 25 replaced occurrences across 24 strings.)*

## 4. Test Updates and Reasons
- `tests/i18n_residue001.test.mjs`: Added assertions verifying that Hebrew `exploitOpportunityCopy`, `exploitCopy`, `personalHandCopy('fold', 'he')`, `STUDY_COPY.fold[2]`, `exploit-review-workspace.mjs`, `node-coach.mjs`, and `i18n.js` use `פולד` / `פולדים` and contain zero occurrences of `קיפול`. Reason: lock in the `I18N-HE-FOLD-001` terminology contract across all 6 touched modules and the locale catalog.

## 5. Verification
- `node --check app/src/application/exploit-opportunity-language.mjs app/src/application/exploit-review-workspace.mjs app/src/application/exploit-teacher-language.mjs app/src/application/personal-strategy-hand-workspace.mjs app/src/application/study-language.mjs app/src/personal-strategy/node-coach.mjs app/src/locales/i18n.js tests/i18n_residue001.test.mjs` -> exit 0
- `node tools/run-tests.mjs --changed` -> `SUMMARY files=110 total=1028 pass=1028 fail=0 skip=0 todo=0 seconds=167.8`
- `node tools/run-tests.mjs --files tests/l10n001_native_terminology.test.mjs` -> `SUMMARY files=1 total=8 pass=8 fail=0 skip=0 todo=0 seconds=0.5`
- `git diff --check` -> clean

## 6. Limitations and Debt
- None.

## 7. Disagreements or Doc Conflicts
- None.

## 8. Files Changed
- `app/src/application/exploit-opportunity-language.mjs`
- `app/src/application/exploit-review-workspace.mjs`
- `app/src/application/exploit-teacher-language.mjs`
- `app/src/application/personal-strategy-hand-workspace.mjs`
- `app/src/application/study-language.mjs`
- `app/src/personal-strategy/node-coach.mjs`
- `app/src/locales/i18n.js`
- `tests/i18n_residue001.test.mjs`
- `docs/ISSUE_REGISTER.md`
- `docs/archive/agent-reports/2026-11/I18N-HE-FOLD-001.md`
