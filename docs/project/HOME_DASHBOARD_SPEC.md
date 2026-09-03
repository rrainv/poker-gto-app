# Home Dashboard v2

Status: `HOME-002A` implementation checkpoint plus `FIRST-USE-HOME-001` and `SAVED-VISUAL-KNOWLEDGE-001` completed / human accepted, August 30, 2026.

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

## Recurring Home and optional orientation

Home is the permanent recurring startup and study destination for first-time and returning use. Welcome is optional orientation presentation state layered separately from routing; it is not another route or workspace authority. While Welcome is visible, no sidebar destination is selected and hidden Home initialization intended for active Home does not run. Dismissing or finishing Welcome activates Home normally, while manually reopening Welcome does not reset or reinitialize the current workspace.

Welcome suppression affects orientation only. A missing, invalid, or new preference shows Welcome and leaves `Don't show Welcome on startup again` unchecked; suppression requires an explicit user opt-in, and an existing explicit saved suppression remains authoritative. Active navigation always reflects the true destination.

Current Riverline identity surfaces reuse one canonical geometric brand-spade asset with context-appropriate presentation. This identity asset is separate from ordinary poker-card suit symbols and rendering.

## Session compositions

### Guest

Current Guest Home does not issue authenticated-account Saved Study, identity, or sync-domain reads. The accepted long-term Guest is a durable anonymous device-local profile under `IDENTITY-LIFECYCLE-001`; it remains distinct from every authenticated owner. Guest Home contains:

- a short Riverline introduction and restrained sign-in promotion;
- useful direct Start/study actions through existing destinations;
- Continue only when an explicit supported resume contract exists.

In the current runtime, Saved, Review, Mistakes, Personal Strategy, and calibration content are absent. The future durable Guest may expose only its own explicitly supported local domains. Explicit sign-out must never present the prior authenticated identity's content.

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

- an active or paused Personal Strategy session;
- a current in-memory canonical Hand exposed by the Playbook bridge only while its canonical state is non-terminal and therefore resumable. Completed showdown, fold, and all-in Hands are not live continuation targets and must produce Start rather than Continue.

When neither exists, the prime Home area presents a useful Start action rather than an empty Continue shell or fabricated recency. Training, Analyze, Equity, and last-route continuation remain unsupported until their owners expose explicit contracts. Home does not infer continuation from old Scenario state, route history, timestamps, or incidental consumer state.

## Loading, invalidation, and identity isolation

Home has explicit loading, guest, authenticated-empty, populated, sync-pending, and recoverable per-section error states. Local bounded queries are composed concurrently; Home does not wait for a cloud round trip.

Identity/authentication changes immediately hide the previous rendered account content, increment the Home generation, and reload current-scope queries. Late generations cannot render. Saved, Personal Strategy, and study-sync invalidations are coalesced before one visible refresh. There is no polling.

## Saved and review behavior

Recent is limited to six items; Review Later and Mistakes are limited to three items each. Each item retains kind, title, useful tags/annotations, timestamp, truthful derivation facts, and canonical reopen behavior.

Saved is a distinct presentation destination over the same bounded Home/Saved application authority. Its human-accepted primary surface is a compact grid of current `SavedStudyObject v1` objects. All / Hands / Spots are always-visible keyboard-accessible categories, including at zero count, and filter only the already-loaded bounded result: All preserves unknown objects as unsupported/unavailable, Hands selects `kind=hand`, and Spots selects `kind=spot`. Training and Equity are not current categories or Saved kinds.

DOM-free `saved-study-preview-facts/v1` supplies observer-safe canonical Hand preview facts and visibly lossy/schematic Scenario Spot facts. Hover and keyboard focus share one viewport-bounded body-level overlay; click/Enter expands one bounded detail surface; card faces reuse `card-presentation/v1`. Identity/account changes clear private Saved preview/detail state before reload. The existing Hand/Spot openers and reopen semantics remain unchanged.

For nested v2 Saved payloads, Home keeps the existing summary shape and derives neutral `off` or fixed-per-player accounting from the immutable rules snapshot. It never requires `game.mode`, infers an operator from provenance, or performs a preset lookup. V1 summaries retain their existing game-mode projection.

The Saved destination does not imply full retrieval: it filters only the already-loaded bounded result. `SAVED-LIBRARY-001` now owns full retrieval, search, broader filters, sorting, and pagination for current Hand/Spot objects. Bulk operations, broader `HOME-002B` master-detail evolution, and additional payload kinds remain later; no new kind is authorized by the retrieval ticket.

## Personal Strategy truth

The summary reads one selected exact scope through the Personal Strategy repository. Direct answered coverage is distinct from the number of active evidence heads. Conflicting active heads are counted separately. Sparse inferred artifacts, confidence, mastery, GTO accuracy, and skill scores are not surfaced.

## Training and Analysis seams

`HomeViewModel v2.sections.history` contains explicit unsupported Training and Analysis history seams. This keeps later composition modular without fabricating persisted statistics or introducing a new persistence authority.

Future Home/dashboard evolution must remain contract-backed. It must not promote unsupported recent activity, recommendations, streaks, cloud/sync claims, or cross-workspace history merely to fill the dashboard.

## Accessibility, localization, and layout

The dashboard uses semantic sections/headings, keyboard buttons, contextual accessible Saved-item labels, visible focus styles, text-plus-color sync state, and a polite atomic sync status. EN/RU/HE copy is structurally complete; usernames and poker/numeric facts remain LTR islands in Hebrew.

The minimum supported desktop is 1366×768, with representative larger desktops through 2560×1600 and 4K. Existing 1024×768 behavior remains compact/mobile-responsive future evidence rather than a current blocker. The account overview is compact, important modules remain high in the grid, and the narrow fallback is a single column. Mobile remains deferred.

`home.first-use` v2 teaches the account/sync overview, Saved reopen, Review, Personal Strategy truth, and Quick Start without creating another help system.

## Preserved future work

- `SAVED-LIBRARY-001` full retrieval/search/filter/sort/pagination for current Hand/Spot objects, then later bulk operations and approved additional payload kinds;
- contract-backed Home continuity over existing Training Memory; sophisticated re-drilling, mastery, and trends remain later and cannot be inferred from heuristic agreement;
- durable recent Analysis history;
- configurable card order, visibility, density, and beginner/expert composition;
- study goals and approved gamification only after a separate product decision.

