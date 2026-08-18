# Home Dashboard v2

Status: `HOME-002A` implementation checkpoint, August 18, 2026.

## Purpose and ownership

Home is the account-aware study dashboard named **My Riverline**. It answers who is signed in, what can truthfully be resumed, what was saved or marked for review, how Personal Strategy is progressing, and whether enabled study data is synchronized.

Home owns no durable study data. It is a consumer of versioned query boundaries:

```text
AccountProfile / Riverline identity
SavedStudyObject bounded queries
Personal Strategy exact-scope summary
Range Calibration session summary
aggregate study-sync status
current in-memory Playbook continuation
                    ↓
             HomeViewModel v2
                    ↓
              Home renderer
```

The renderer does not inspect IndexedDB, resolve StrategyProvider results, run Equity, infer a 169-hand range, or create Training/Analysis history.

## Session compositions

### Guest

Guest Home does not issue Saved Study, Personal Strategy, calibration, identity, or sync-domain reads. It contains:

- a short Riverline introduction and restrained sign-in promotion;
- Playbook, Training, and Equity Quick Start actions;
- Continue only when the current process has a real in-memory live Hand.

Saved, Review, Mistakes, Personal Strategy, and calibration content are absent. Guest is useful without presenting another identity's content.

### Authenticated

Authenticated Home contains modular sections for:

- compact `displayName` and `@username` from the authenticated AccountProfile;
- aggregate study-sync status and a contextual account issue action for conflict/error;
- resumable active/paused Range Calibration, plus a current in-memory live Hand when present;
- bounded Recent, Review Later, and Mistakes SavedStudyObject previews;
- selected Personal Strategy profile/mode/context, direct answered coverage, direct evidence count, active contradictory head count, and current session state;
- context-aware Quick Start.

Fresh accounts use intentional actions instead of a grid of zero metrics. Saved Hands and Spots use the existing canonical opener, so remote-pulled objects behave exactly like local objects.

## Continue contract

Home may show only explicit resume contracts:

- active or paused Range Calibration below 169 directly answered hand classes;
- a current in-memory canonical live Hand exposed by the Playbook bridge.

Home does not claim that old Scenario, Analysis, or Training state is resumable.

## Loading, invalidation, and identity isolation

Home has explicit loading, guest, authenticated-empty, populated, sync-pending, and recoverable per-section error states. Local bounded queries are composed concurrently; Home does not wait for a cloud round trip.

Identity/authentication changes immediately hide the previous rendered account content, increment the Home generation, and reload current-scope queries. Late generations cannot render. Saved, Personal Strategy, and study-sync invalidations are coalesced before one visible refresh. There is no polling.

## Saved and review behavior

Recent is limited to six items; Review Later and Mistakes are limited to three items each. Each item retains kind, title, useful tags/annotations, timestamp, truthful derivation facts, and canonical reopen behavior.

There is no `View all` destination because a full Saved Library does not yet exist. HOME-002A does not fake one.

## Personal Strategy truth

The summary reads one selected exact scope through the Personal Strategy repository. Direct answered coverage is distinct from the number of active evidence heads. Conflicting active heads are counted separately. Sparse inferred artifacts, confidence, mastery, GTO accuracy, and skill scores are not surfaced.

## Training and Analysis seams

`HomeViewModel v2.sections.history` contains explicit unsupported Training and Analysis history seams. This keeps later composition modular without fabricating persisted statistics or introducing a new persistence authority.

## Accessibility, localization, and layout

The dashboard uses semantic sections/headings, keyboard buttons, contextual accessible Saved-item labels, visible focus styles, text-plus-color sync state, and a polite atomic sync status. EN/RU/HE copy is structurally complete; usernames and poker/numeric facts remain LTR islands in Hebrew.

The responsive grid targets 1024×768 through 2560×1600 without horizontal overflow. The account overview is compact, important modules remain high in the grid, and the narrow fallback is a single column. Mobile remains deferred.

`home.first-use` v2 teaches the account/sync overview, Saved reopen, Review, Personal Strategy truth, and Quick Start without creating another help system.

## Preserved future work

- full Saved Library, View all, search, filters, and tags;
- persistent Training history, mistake re-drilling, mastery, sessions, and trends;
- durable recent Analysis history;
- configurable card order, visibility, density, and beginner/expert composition;
- study goals and approved gamification only after a separate product decision.

