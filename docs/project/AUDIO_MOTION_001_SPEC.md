# AUDIO-MOTION-001 semantic experience contract

Status: **COMPLETED / ACCEPTED IMPLEMENTATION CHECKPOINT** on August 24, 2026. Human QA accepts the overall system, materially improved physical poker foley, routing architecture, and ordinary-Training Study/UI versus visible physical poker-world semantics as sufficient to move on. This checkpoint does not claim subjective sound-design perfection; Study/UI and optional Check refinement remain tracked polish debt.

## Outcome

Riverline has one bounded semantic presentation path for live Hand, Replay playback, Training Full Hand, post-hand Review selection, and study feedback:

```text
completed canonical transition or explicit study action
  -> experience-event/v1
  -> one audio authority + one motion policy
  -> SoundFX recorded-foley mixer / TablePresentation-based motion
```

The event selector consumes already-completed canonical transitions and never advances PokerState, calculates poker outcomes, changes strategy, grades Training, or performs accounting.

## Event contract

`experience-event/v1` separates two families:

- `poker_world`: cards, actions, chip commitments, pot collection/award, actor/street/showdown transitions, and neutral hand completion;
- `study`: answer registration, reference/hint disclosure, Review selection, and Replay transport state.

Every event has a deterministic ID, origin, source, transition token, ordinal, and deeply immutable payload. Origins are explicit:

- `live` and `replay_playback` may produce current-event audio;
- `direct_seek`, `initial_render`, `hydration`, and `review_selection` never recreate historical poker-world events;
- direct Replay Previous/Next/seek remains visually authoritative but does not replay historical table motion;
- Replay playback emits only the transition it actually advances through.

The browser bridge deduplicates event IDs. The audio authority also rejects duplicate and stale numeric transition tokens so rerenders or late callbacks cannot double-fire a cue.

## Audio policy

`riverline-audio/v1` is the only sound authority. The locked product decision is:

> Physical poker-world sounds use authored/recorded foley as the primary audible source. Procedural Web Audio is a mixing and presentation layer, not the default substitute for physical card/chip acoustics.

The permanent surface-metaphor decisions are:

A. Physical poker foley is used only when Riverline visibly depicts a physical poker-world interaction.

B. Abstract study/analysis answers use study/UI semantics, even when their labels are Fold, Check, Call, Bet, Raise, or All-in.

C. Variants within one semantic action must preserve one recognizable family identity.

D. Variety is subordinate to semantic clarity.

E. One interaction normally produces one primary audible meaning.

F. Physical hierarchy comes from physical mass and density rather than pitch.

It provides:

- one lazy Web Audio context per enabled lifecycle, reused while running; Full Hand start and Replay Play silently prepare it inside their user gesture before delayed presentation cues;
- fifteen short high-quality Ogg recordings selected from explicitly CC0 Freesound sources, with eleven approved for production selection after the family-coherence audit and four retained as provenance-documented non-production outliers;
- Web Audio buffer decoding, caching, master gain, explicit per-asset gain/window/tail trims, ±0.2% playback-rate movement, ±1% gain movement, at most 1.5 ms timing jitter, and physical-mass layering; oscillators and generated noise are limited to subtle Study/UI cues;
- master enabled, master volume, Table/Poker, and Study/UI preferences;
- a 12-voice polyphony ceiling, per-family cooldowns, event deduplication, hidden-tab suppression, zero-volume silence, and graceful unavailable-audio behavior;
- coherent recorded card placement/fold families; one restrained isolated table/knuckle Check; one-impact small chips; one shared medium-chip source for Bet and layered Raise; trimmed same-author all-in pushes; and one multi-impact pot-gathering recording;
- clearly perceptible `study_positive`, `study_neutral`, `study_corrective`, and `hint` cues whose meaning is derived from canonical grading plus `StrategyClaimPolicy`, never raw StrategyResult probabilities;
- direct Settings previews for Card, Check, Fold, Call, Raise, All-in, Pot, Positive, Neutral, Corrective, and Hint that invoke the exact production cue renderer and obey the matching category policy;
- a mass-based action hierarchy at default 72% master volume: Call uses one small-chip contact, Bet uses one medium placement, Raise layers the same medium material, All-in uses authored stack-push recordings, and Pot uses chip gathering. Pitch is never the source of action hierarchy.

Decoded buffers are cached by asset URL and never fetched or decoded repeatedly. Session/Replay user gestures may warm the bounded cache without producing sound. Loading is asynchronous and never gates poker state or UI presentation. Missing, undecodable, or unavailable assets resolve to silence; the rejected synthesized poker cue set is not a fallback.

Study/UI feedback must register clearly at the normal default 72% master volume: restrained does not mean inaudible. Positive, Neutral, Corrective, and Hint form one coherent rounded tonal family with short envelopes and a limited frequency range. Their upward, flat, downward, and disclosure contours carry semantic distinction without casino reward, punitive error, arcade, or operating-system-notification character. Physical poker foley and abstract Study feedback intentionally remain separate audio languages.

Hand completion has no success/failure sound of its own. Pot movement is neutral. Ordinary Varied/Focused Training is an abstract study surface: after canonical evaluation and presentation establish the authorized `optimal`, `acceptable`, or `mistake` comparison meaning, one `decision_submitted` study event resolves respectively to positive, neutral, or corrective feedback. It never emits physical foley merely because the answer label is a poker action. Unsupported claim semantics stay silent.

Full Hand Training uses the visible table metaphor, so its canonical action transition emits physical Fold/Check/Call/Bet/Raise/All-in foley and does not stack an immediate study-result sound over it. Live Hand, normal Replay playback, visible card handling, chip movement, and pot movement keep their physical routing. Calibration and Matrix labels do not create poker-world audio.

At faster Replay pacing, low-value check/card-reveal cues may be suppressed. Playback never produces dense historical cue bursts from a direct seek.

## Motion policy

`riverline-motion/v1` maps semantic events to named intents with one compact duration scale:

- instant: 0 ms in policy / 1 ms CSS compatibility token;
- fast: 110 ms;
- normal: 170 ms;
- poker settle: 240 ms.

Motion includes restrained card/street settling, fold retreat, actor/action/value emphasis, stack-to-contribution chip travel, contribution-to-pot convergence, pot-to-winner travel, neutral hand completion, and Review selection. Paths consume normalized TablePresentation seat, contribution, and pot anchors; they do not inspect DOM geometry or infer poker math. Poker geometry remains LTR under RTL UI.

With `prefers-reduced-motion: reduce`, travel intents are inactive and instantaneous. Essential state still appears immediately. Sound preferences and motion preferences remain independent.

## Competitive reference decision

The in-app browser had no available browser instance during this ticket, so no new live competitor interaction was claimed. The bounded decision used the accepted `TABLE_PRESENCE_COMPETITIVE_REFERENCE.md` evidence:

- **ADOPT:** immediate event consequence and clear distinction between card, passive action, aggression, and pot movement;
- **ADAPT:** compress dry recorded foley into low-fatigue, bounded playback and low-hundreds-of-milliseconds motion suitable for repeated study;
- **DIFFERENTIATE:** keep study feedback authority-safe, calm, and non-celebratory while allowing the canonical presentation's aligned/close/corrective distinction;
- **REJECT:** casino ambience, reward loops, copied/proprietary samples, dense replay cacophony, fake 3D spectacle, and unsupported strategy meaning.

## Verification boundary

Automated coverage owns event determinism/immutability, surface-metaphor routing, authority-safe ordinary-Training study meaning, one-cue submission behavior, physical Full Hand/Hand/Replay routing, Calibration/Matrix non-routing, origin suppression, direct seek versus playback, reduced motion, audio lifecycle/preferences/categories, live volume changes, production-preview parity, the sample manifest/schema, CC0 provenance records, asset byte hashes, production membership, per-asset trims/windows, deterministic bounded variation, buffer/negative caching, graceful silence, hidden/unavailable behavior, cooldown, polyphony, and duplicate/stale rejection.

Automated checks are not subjective listening or visual sign-off. Human QA accepted this implementation checkpoint without claiming subjective perfection. Further Study/UI refinement, Check refinement if still desired, fatigue review, and unperformed Firefox visual/audio acceptance remain in `QA-AUDIO-MOTION-001` and `RET-AUDIO-001`; they no longer block the next ticket.
