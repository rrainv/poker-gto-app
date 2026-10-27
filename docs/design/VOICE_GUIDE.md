# Riverline voice guide (draft, 2026-10-22)

How Riverline talks: explanations, feedback, takeaways, Chippy, empty states, errors. One voice in every language: **a calm, honest coach.** The owner reviews RU and HE wording; terms always come from TERMINOLOGY.md.

## 1. Principles
1. **Facts first, then the why, then how sure.** "You need 38.5% to call. Against this range you have more, so calling is profitable. Estimated."
2. **Say what it's based on.** Every claim carries its source and tier; never stronger than the evidence.
3. **Describe actions, never judge the person.** "You fold the big blind to small opens more than your plan" (with the sample), never "you're too passive".
4. **No verdict words for heuristic comparisons.** Use: inside / outside the baseline's mix, close, the baseline leans to. Never: mistake, wrong, correct, error, blunder, GTO says, optimal.
5. **Praise the process, not the result or the match.** "You checked the price before calling." Never "Well done, you matched the baseline."
6. **Luck is named as luck.** "The river cost you 146 bb against expectation." Never "bad play" for a lost all-in that was a good call.
7. **Uncertainty is stated plainly, without warning walls.** "Not enough hands yet to say (4 so far)." One line, not a paragraph of caveats.
8. **Quiet copy.** Don't state what people already know; no filler ("Here's the thing", "It's important to note"), no hype, no exclamation marks except real celebrations.
9. **Short by default, deeper on demand.** One line → paragraph → full maths (the "Explain like…" depth).
10. **Claim strength is separate from phrasing.** Personas or Chippy can change tone, never make a claim stronger.

## 2. Patterns
| Situation | Do | Don't |
|---|---|---|
| Answer inside the mix | "Inside the baseline's mix. Suited wheel ace: a natural 3-bet bluff here." | "Correct!" / "Great job!" |
| Answer outside the mix | "Outside the baseline's mix. Calling here is usually a fold: out of position, the big blind behind." | "Mistake." / "Wrong answer." |
| Close spot | "Close: both 3-bet and call are reasonable." | "Either is fine, don't worry." |
| Exact maths | "Exact · price only: 2.5 ÷ (4 + 2.5) = 38.5%." | "The math says you must call." |
| No data | "No answer for this spot yet (unusual multiway line)." | Silent fallback, or a guessed number. |
| Pattern noticed | "Folded 14 of 18 big-blind spots in hands you played; your plan folds about 45%. A possible reading, not a verdict." | "You're a nit in the big blind." |
| Unknown hand | "Not answered yet: unknown, never treated as fold." | "Fold (default)." |
| Luck | "72.7% to win when the money went in; the river cost 146 bb." | "Unlucky! You played it perfectly." |
| Error / invalid input | "Enter a buy-in greater than zero, or leave it empty." | "Invalid value!" / red alarm language |
| Empty state | "Spots and hands you save gather here." + one action | "Nothing here :(" |
| Encouragement after a rough session | "A tough run of cards: your decisions in the all-ins were sound." (only if true) | "Don't give up!" |
| Chippy | Calm, brief, a teacher's tone: "Let's look at one hand together." | Jokes about losses, cheerleading, judging. |

## 3. Takeaway lines (one line that summarises a hand)
Formula: **the decision that mattered + what it was worth + what luck did**, only from known information.
- Do: "Your turn call was worth about +46 bb; the river cost 146."
- Don't: "You lost because of the river." (blames luck without the decision) / "Great hand!" (says nothing)
If information is missing: "Add the turn bet size to judge this river call."

## 4. Numbers in text
- Units always: "2.5 bb", "38.5%", "₪200". Tabular numbers in UI; in sentences, the same formatting per language (Intl).
- Percentages of mixes rounded to 5%; exact maths to one decimal.
- Never "always" or "never" for strategy unless the source is exact (push/fold model).

## 5. Examples in three languages (owner to review RU/HE)
| Case | EN | RU | HE |
|---|---|---|---|
| Inside the mix | Inside the baseline's mix. | В пределах микса базовой стратегии. | בתוך התמהיל של אסטרטגיית הבסיס. |
| Outside the mix | Outside the baseline's mix. | Вне микса базовой стратегии. | מחוץ לתמהיל של אסטרטגיית הבסיס. |
| Price | You need 38.5% to call 2.5 bb. | Чтобы сделать колл 2.5 bb, тебе нужно 38.5%. | צריך 38.5% כדי לעשות קול 2.5 bb. |
| Unknown | Not answered yet: unknown, never treated as fold. | Ещё нет ответа: неизвестно, не считается пасом. | עוד אין תשובה: לא ידוע, ולא נחשב פולד. |
| Pattern | Folded 14 of 18 in hands you played. | Ты пасовал в 14 из 18 сыгранных раздач. | פולד ב-14 מתוך 18 ידיים ששיחקת. |
| Luck | The river cost you 146 bb against expectation. | Ривер стоил тебе 146 bb относительно ожидания. | הריבר עלה לך 146 bb ביחס לציפייה. |
| Empty | Spots and hands you save gather here. | Здесь появятся споты и раздачи, которые ты сохранишь. | ספוטים וידיים שתשמור יופיעו כאן. |
| Error | Enter a buy-in greater than zero, or leave it empty. | Введи бай-ин больше нуля или оставь поле пустым. | הזן באי-אין גדול מאפס, או השאר ריק. |

**Decided (owner, 2026-10-23): casual address in Russian («ты»)**, consistent with the Hebrew masculine singular. The RU examples above use it (rewritten in DOCS-SMALL-001, 2026-10-27); lines with no address («В пределах микса…», «Ещё нет ответа…») need no change. All new RU copy uses «ты» and the imperative «-и/-ь» forms («Введи», «оставь», «попробуй»).

## 6. Banned words in product text
mistake, wrong, correct (for strategy), error (for strategy), blunder, punt, leak (as a label on the person), optimal, GTO-approved, perfect, nit/fish/donk (as labels on people), "you should always", "trust me", exclamation-mark praise.
