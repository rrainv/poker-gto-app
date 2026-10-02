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

## Destinations removed (SHELL-001)

October 2, 2026 owner decision: Home's Destinations panel is removed because its links duplicated the sidebar navigation, which stays one click away on every workspace. "Review Mistakes" moves into the Review section header as a quiet link, shown under the unchanged rule (at least one item marked as a mistake; `HomeViewModel v2.sections.quickStart.destinations` still carries `review_mistakes`). Because the link now sits inside Review, it opens Saved with the existing "Mistakes only" filter (other filters cleared) instead of scrolling to Review. Home is one main column (next action, Review, Recent); the next-action focal card and two-column Review remain `HOME-HOMEGAME-002` (QA-SHELL-007). The Home description moved from the header into Help (SHELL-001); the header context names the session (Guest Mode, or display name · sync state).

## Recurring Home and optional orientation

Home is the permanent recurring startup and study destination for first-time and returning use. Welcome is optional orientation presentation state layered separately from routing; it is not another route or workspace authority. While Welcome is visible, no sidebar destination is selected and hidden Home initialization intended for active Home does not run. Dismissing or finishing Welcome activates Home normally, while manually reopening Welcome does not reset or reinitialize the current workspace.

Welcome suppression affects orientation only. A missing, invalid, or new preference shows Welcome and leaves `Don't show Welcome on startup again` unchecked; suppression requires an explicit user opt-in, and an existing explicit saved suppression remains authoritative. Active navigation always reflects the true destination.

Current Riverline identity surfaces reuse one canonical geometric brand-spade asset with context-appropriate presentation. This identity asset is separate from ordinary poker-card suit symbols and rendering.

## Session compositions

### Guest

Slice B Guest Home loads current-owner bounded Saved/Review and Personal Strategy summaries through lifecycle scopes. Its account profile remains absent and sync unavailable: no account profile, cloud status, or account sync queries execute for Guest. The Saved destination exposes the same existing local Hand/Spot library and reopen semantics.

Every Home load captures one lifecycle generation, validates before domain queries, and validates before adoption. Owner transitions synchronously clear prior Saved previews/details, account overview, review/continuation/Personal Strategy presentation, and any Saved viewer; delayed results cannot populate the next owner. Returning to Guest restores the same local library and strategy.

Start (an empty next action offers Start a Hand) and genuine runtime Hand continuation remain available. Training/Analysis history remains explicitly unsupported in the existing Home model; this slice does not invent a new dashboard integration or change Home Game persistence.

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

Saved is a distinct destination over the same Saved application authority, but since `SAVED-LIBRARY-001` it no longer reuses Home's Recent section or Home's six-item query. It mounts its own library controller and query (up to 200 active objects, search, filters, sort; see [Saved library query](SAVED_STUDY_OBJECTS_SPEC.md#saved-library-query)), which loads only while Saved is shown. Home Recent keeps its six-item limit, rendering, and Continue behavior unchanged, and the Home load performs no library read. Its human-accepted primary surface is a compact grid of current `SavedStudyObject v1` objects. All / Hands / Spots are always-visible keyboard-accessible categories, including at zero count: All preserves unknown objects as unsupported/unavailable, Hands selects `kind=hand`, and Spots selects `kind=spot`. Training and Equity are not current categories or Saved kinds. The Study Inbox disclosure belongs to Home and is hidden on the Saved destination.

DOM-free `saved-study-preview-facts/v1` supplies observer-safe canonical Hand preview facts and visibly lossy/schematic Scenario Spot facts. Hover and keyboard focus share one viewport-bounded body-level overlay; click/Enter expands one bounded detail surface; card faces reuse `card-presentation/v1`. Identity/account changes clear private Saved preview/detail state before reload. The existing Hand/Spot openers and reopen semantics remain unchanged.

For nested v2 Saved payloads, Home keeps the existing summary shape and derives neutral `off` or fixed-per-player accounting from the immutable rules snapshot. It never requires `game.mode`, infers an operator from provenance, or performs a preset lookup. V1 summaries retain their existing game-mode projection.

The Saved library is bounded to the 200 most recently updated active objects with a visible disclosure at the bound; cursor pagination beyond that bound, bulk operations, broader `HOME-002B` master-detail evolution, and additional payload kinds remain later. No new kind is authorized by the retrieval ticket.

## Personal Strategy truth

The summary reads one selected exact scope through the Personal Strategy repository. Direct answered coverage is distinct from the number of active evidence heads. Conflicting active heads are counted separately. Sparse inferred artifacts, confidence, mastery, GTO accuracy, and skill scores are not surfaced.

## Training and Analysis seams

`HomeViewModel v2.sections.history` contains explicit unsupported Training and Analysis history seams. This keeps later composition modular without fabricating persisted statistics or introducing a new persistence authority.

Future Home/dashboard evolution must remain contract-backed. It must not promote unsupported recent activity, recommendations, streaks, cloud/sync claims, or cross-workspace history merely to fill the dashboard.

## Accessibility, localization, and layout

The dashboard uses semantic sections/headings, keyboard buttons, contextual accessible Saved-item labels, visible focus styles, text-plus-color sync state, and a polite atomic sync status. EN/RU/HE copy is structurally complete; usernames and poker/numeric facts remain LTR islands in Hebrew.

The minimum supported desktop is 1366×768, with representative larger desktops through 2560×1600 and 4K. Existing 1024×768 behavior remains compact/mobile-responsive future evidence rather than a current blocker. The account overview is compact, important modules remain high in the grid, and the narrow fallback is a single column. Mobile remains deferred.

`home.first-use` teaches the account/sync overview, Saved reopen, the Study Inbox, Personal Strategy truth, and where the workspaces live without creating another help system. Since `SHELL-001` its steps spotlight the shown Guest or account panel, Recent, the Study Inbox, and the sidebar navigation (definition version unchanged: only anchors moved).

## Preserved future work

- beyond the implemented bounded `SAVED-LIBRARY-001` library: cursor pagination past 200 items, bulk operations, and approved additional payload kinds;
- contract-backed Home continuity over existing Training Memory; sophisticated re-drilling, mastery, and trends remain later and cannot be inferred from heuristic agreement;
- durable recent Analysis history;
- configurable card order, visibility, density, and beginner/expert composition;
- study goals and approved gamification only after a separate product decision.

