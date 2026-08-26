# Saved Knowledge and Sharing

> This capability dossier preserves long-term product intent and design direction. It does not own execution priority or current implementation truth. See PRODUCT_BACKLOG.md for capability status and CURRENT_PHASE.md / ROADMAP.md for sequencing. Current implemented contracts remain in subsystem specs/code.

Planning authority remains in the [Product Backlog](../PRODUCT_BACKLOG.md), [Current Phase](../CURRENT_PHASE.md), and [Roadmap](../ROADMAP.md).

## Product purpose

Riverline should turn useful poker work into durable, searchable, portable study knowledge. A saved item should remain a real versioned Riverline object with explicit source, ownership, provenance, and uncertainty—not a screenshot, copied renderer state, or disconnected bookmark.

Sharing should extend that same object model deliberately. It must remain local-first, private by default, and permission-aware. Read-only sharing is an acceptable first product slice; collaboration, forks, comments, challenges, and shared drills can build on it only after object-version and privacy semantics are sound.

## User jobs / why it matters

- Save a Hand or Spot without losing the state and provenance that make it useful.
- Add notes, tags, review intent, and mistake classification from any supported study surface.
- Find prior work by kind, tag, source, date, review state, or poker context.
- Reopen a saved object in the correct study workflow without mutating a live Hand accidentally.
- Preserve revisions and understand what changed over time.
- Export personal data in a validated, portable form and import it without silent loss.
- Share an actual Riverline Hand, Spot, Range, or Drill privately and inspectably.
- Clone or fork shared work while retaining its origin and source version.
- Collaborate later without turning comments or social state into poker authority.

## Existing foundation

- [Saved Study Objects](../SAVED_STUDY_OBJECTS_SPEC.md) owns the current versioned local-first Saved domain, stable IDs, revisions, annotations, tags, review/mistake state, archive tombstones, portability, and current Hand/Spot payloads.
- [Saved Object Sync](../SAVED_OBJECT_SYNC_SPEC.md) adds explicit account sync for complete validated Hand/Spot objects while preserving the local repository as authority.
- [Saved Object Sync](../SAVED_OBJECT_SYNC_SPEC.md) also defines explicit conflict choices. Its conflict-copy provenance is a useful foundation, but it is not a shipped social-fork feature.
- [Home Dashboard](../HOME_DASHBOARD_SPEC.md) consumes Saved facts; it does not own saved-object schemas or persistence.
- [Strategy Source Authority](../STRATEGY_SOURCE_AUTHORITY_SPEC.md) defines what future frozen strategy analysis must preserve if a Saved payload stores a historical judgment.

Current implemented payloads and UI remain bounded. Saved Range, Drill, Session, Review, comments, social sharing, and a complete library experience require their own approved payload or application owners.

## Desired future behavior

### Saved Study Library

The Saved Study Library should provide a dense, calm master-detail workspace rather than a decorative feed. Desired capabilities include:

- Hands and Spots first, followed only by payload types with approved semantic owners;
- search across titles, notes, normalized tags, and supported structured context;
- filters for kind, source, review state, mistake state, lifecycle, date, and supported poker dimensions;
- stable sorting and bounded pagination/query behavior;
- a selected-object inspector with explicit Open, Study, Review, Export, Share, Archive, and other applicable actions;
- compact previews that consume payload-owned projections rather than reconstructing poker facts in the library; for a Saved Spot this may be an observer-safe miniature table/board/Hero/pot representation available through hover, keyboard focus, tap, or detail without making essential facts pointer-only;
- clear unavailable states when an older client cannot interpret a future payload.

Folders or collections may be useful, but tags and search should be proven insufficient before another organizational hierarchy is introduced.

### Notes and tags across study objects

Notes, tags, review state, and mistake metadata should remain one shared annotation language where they apply. A new object type should reuse the Saved annotation model rather than create its own note store. Surface-specific structured annotations may be added only through the payload owner and must not be flattened into ambiguous prose.

### Additional saved types

- **Saved Range:** a versioned canonical weighted-range or Personal Strategy-related payload with exact role, context, provenance, unknown coverage, and history semantics.
- **Saved Drill:** a reproducible study request or approved drill definition, not a bag of generated renderer state.
- **Saved Session:** durable membership and source facts for a Training or review session when the owning history contract exists.
- **Saved Review:** structured review annotations and references to the evidence being reviewed.

No type should be added merely to fill the library. Its subsystem must first define the payload, authority, versioning, reopening behavior, and limits.

### Revisions and history

Users should be able to understand meaningful change over time without mutable-history ambiguity. Future history may support:

- revision timeline and author/source identity;
- compare two versions;
- restore by creating a new revision rather than erasing intervening history;
- object-type-specific diffs;
- conflict provenance and resolution history;
- StrategyProfile or range evolution such as “BTN Standard v2 versus v5.”

Storage revision, domain schema version, source version, and user-visible content version are different concepts and should not be collapsed.

### Export and import

User-visible export/import should build on validated portable domain envelopes. It should:

- make scope explicit;
- preserve stable IDs, schema versions, source/provenance, annotations, lifecycle, and supported history;
- validate the complete input before mutation;
- report skipped, unsupported, conflicting, and imported objects truthfully;
- preserve unknown future objects when safe rather than silently deleting their bytes;
- exclude credentials, provider sessions, device-only indexes, and runtime/controller state;
- never revive arbitrary solver-tree upload through a personal-data button.

### Sharing and collaboration

A shared Spot or Hand should be the actual versioned Riverline object or a privacy-safe projection of that object, including the canonical state and provenance necessary to understand it. A screenshot may accompany the share, but it is not the shared authority.

A restrained evolution path is:

1. explicit private-by-default sharing;
2. read-only link or invite with a clear owner and immutable shared version;
3. clone/fork into the recipient's library with origin object ID/version and source provenance;
4. later comments or review annotations anchored to stable object/revision locations;
5. friend challenges and shared drills without gambling, leaderboard, or engagement pressure.

Revocation, visibility, expiration, account requirements, and recipient capabilities must be explicit. Opening a shared object must never silently upload unrelated local data or grant edit permission.

## Structured facts / evidence required

Common saved-object facts should include or reference, as appropriate:

- stable object ID, kind, payload schema version, and object revision;
- owner identity and lifecycle state;
- created, updated, archived, and relevant historical timestamps;
- source surface and source/provenance identity;
- title, note, normalized tags, review state, and mistake classification;
- payload-specific canonical facts and limitations;
- parent/related object references with relation type and referenced revision;
- import/export origin where applicable;
- sync/conflict state outside the poker payload;
- sharing owner, audience, permission, shared revision, expiration/revocation state, and privacy projection when sharing exists;
- fork origin object ID, origin revision, fork timestamp, and creator identity;
- comment thread identity, author, timestamp, status, and stable evidence/object location when collaboration exists.

If a historical review stores strategy, Personal Strategy, opponent, Equity, or factual-analysis judgment, it must retain the source/version/coverage/limitations needed to understand what was known then. Recomputable projections should not be duplicated unless historical fidelity requires freezing them.

## Authority, provenance and uncertainty rules

- `SavedStudyObject` is the one Saved wrapper authority; consumers do not create parallel bookmark, note, review, or library stores.
- Each payload type retains its subsystem authority. Saved does not become PokerState, Equity, Strategy, Training, Range, or review math.
- Stable ID, object revision, payload schema version, and source version remain distinct.
- A shared screenshot is illustrative only. The versioned object/projection and provenance are authoritative.
- Private is the default. Authentication or sync never silently enables sharing or upload.
- Read access, comment access, fork permission, and edit authority are separate permissions.
- A fork is a new owned object with immutable origin provenance, not a silent mutation of the source.
- Comments and reactions are user content, never poker evidence or strategic authority unless an explicit reviewed-evidence contract says otherwise.
- Unknown future kinds and unavailable facts remain unknown; they are not converted to empty values.
- Historical judgments must not be silently rewritten by a current provider or current inference version.
- Conflict copies created by sync remain explicit conflict resolution, not proof that general collaboration/version control is implemented.

## Preserved interactions and microfeatures

- One consistent Save/Saved bookmark language backed by exact Saved authority.
- Notes and tags editable through explicit Save/Cancel transactions.
- Review Later, Mistake, resolved state, and archive with accessible confirmation.
- Search with normalized tags and explicit active filters.
- Master-detail selection that never mutates a live Hand until the user chooses an applicable Open/Study action.
- Rich visual preview for supported objects through their payload-owned projection, preserving observer safety, rank+suit inspectability, keyboard/touch access, and truthful unavailable states.
- Version history, compare, and restore-as-new-revision.
- User-visible export/import with dry-run or summary-quality feedback where useful.
- Share action with explicit object version, visibility, permission, and privacy preview.
- Read-only shared view as a complete first step.
- Fork/Clone action that displays origin and creates a new local/account-owned object.
- Comments anchored to a stable object revision or structured review location.
- Friend challenge/shared drill invitations with no gambling or leaderboard pressure.
- Consistent provenance, uncertainty, unknown, and unavailable presentation across library and originating surfaces.

## Cross-surface applicability

- **Hand / Replay:** Save Hand, edit annotations, reopen detached review, and share only observer-safe canonical content.
- **Scenario / Analyze:** Save or share an explicitly lossy Spot with its declared limitations; never imply missing canonical history.
- **Equity:** save/share only after an approved payload defines request, result, method, seed, ranges, and historical-fidelity semantics.
- **Training:** Saved Drill, Session, Review, and mistake relations only after Training Memory owns durable records.
- **Personal Strategy / Matrix / Range Builder:** Saved Range or profile-version relations only through approved range/evidence contracts.
- **Deep Hand Review:** structured annotations and related Saved objects; a review renderer does not own persistence.
- **Home:** recent, review, mistakes, Continue, and library navigation as a consumer.
- **Accounts/sync:** identity, transfer, conflict, and privacy infrastructure; not Saved semantic authority.

Applicability should be recorded explicitly. A shared action should not appear on a surface whose payload, privacy projection, or reopen behavior is undefined.

## Presentation depth

- **Facts:** object type/version/revision, owner, source, dates, tags, relations, sharing permissions, provenance, and payload limitations.
- **Explain:** why an object can or cannot reopen, what changed between revisions, what a shared recipient can do, and what information is omitted.
- **Coach / Summary:** recurring study themes or cross-object synthesis only when [Learning Evidence Foundation](LEARNING_EVIDENCE_FOUNDATION.md) supplies enough structured evidence. Social activity alone is not learning progress.

Advanced users should be able to use dense library facts and filters without narrative or social UI taking over the workspace.

## Dependencies

- Stable Saved wrapper/repository and payload-specific contracts.
- Approved payload owners for Range, Drill, Session, Review, Equity, or other future kinds.
- [Learning Evidence Foundation](LEARNING_EVIDENCE_FOUNDATION.md) for durable evidence and historical-source identity.
- [Deep Hand Review](DEEP_HAND_REVIEW.md), [Training Intelligence](TRAINING_INTELLIGENCE.md), [Personal Strategy Intelligence](PERSONAL_STRATEGY_INTELLIGENCE.md), and [Range Evolution](RANGE_EVOLUTION.md) for structured saved payloads and relations.
- Account identity, privacy, authorization, revocation, and abuse/security design before external sharing.
- Version-aware import/export and conflict behavior.
- [Interaction Grammar](../INTERACTION_GRAMMAR.md) for Save, inspect, provenance, unavailable, and fork interactions across surfaces.

## Suggested implementation slices

These are possible future boundaries, not execution priority:

1. Saved Study Library for current Hand/Spot objects with search, filter, tags, and master-detail inspection.
2. User-visible export/import over existing validated portability contracts.
3. Revision/history projection for current types, including compare and restore-as-new-revision.
4. One new payload type only when its owning subsystem contract is ready.
5. Privacy and share-projection contract plus read-only sharing for one canonical object type.
6. Explicit clone/fork with origin provenance and permission checks.
7. Comments/review threads anchored to stable object revisions.
8. Restrained shared drills or friend challenges after Training records and sharing privacy are mature.

## Competitive/reference lessons

Existing Riverline work supports a local-first, versioned object model rather than screenshot-only study history or cloud-first lock-in. Current conflict handling shows the value of stable IDs, revisions, explicit choices, and parent provenance, while also showing why a conflict copy must not be mislabeled as collaboration. Current Saved Hand replay demonstrates that canonical transition sources should be stored and presentation frames recomputed.

No new web research is introduced by this dossier.

## Failure modes / non-goals

- No second Saved store in Home, Training, Review, Matrix, or a sharing service.
- No premature Range/Drill/Session/Review payload without a semantic owner and versioned contract.
- No screenshot-only “shareable Spot” presented as reusable Riverline state.
- No public-by-default objects or authentication-triggered silent upload.
- No editable shared object that obscures ownership, revision, or conflict semantics.
- No fork that drops origin/source provenance.
- No comments treated as solver, reference, opponent, or poker authority.
- No social feed, follower metric, leaderboard, gambling challenge, or engagement-pressure loop by default.
- No arbitrary solver-tree import through personal-data portability.
- No freezing giant redundant projections when canonical evidence can derive them deterministically.
- No silently re-evaluating historical judgments with today's source and presenting them as the original result.

## Open product questions

- Are folders/collections justified beyond search and tags?
- Which object type should be shared first, and should the first surface be a public link, private invite, friend-only share, downloadable file, or a subset?
- Should read-only be the universal first sharing mode?
- Which shared objects may be cloned/forked, and is that permission on or off by default?
- Should comments be attached to the whole object, a revision, a decision, a card/runout, or structured review annotations?
- What revocation, expiration, deletion, and recipient-copy semantics are required?
- Is an account required to create, view, or fork a share?
- Which revision/history events are user-visible, and how should restore create a new head?
- How should large or unknown future payloads be exported, preserved, and reopened?
- When are friend challenges or shared drills useful without becoming gamification pressure?

## Legacy/recovered IDs and ideas

- `NOTES-TAGS-001` — **IMPLEMENTED foundation** for current Saved objects; preserved across future approved payloads.
- `EXPORT-IMPORT-001` — **PRESERVED** as a complete user-visible personal-data workflow; domain portability primitives already exist.
- `SOCIAL-SHARE-001` — **PRESERVED**, private-by-default and permission-aware.
- `SHAREABLE-SPOT-001` — **PRESERVED**: share actual versioned Riverline state/provenance, not merely a screenshot.
- `SOCIAL-FORK-001` — **PRESERVED** with new-object ownership and immutable origin provenance.
- `COLLAB-REVIEW-001` — **PRESERVED** for later comments and structured collaborative review.
- Saved Range, Saved Drill, Saved Session, Saved Review, revisions/history, friend challenges, and shared drills remain preserved only behind their owning contracts.

## Related specs/capabilities

- [Saved Study Objects](../SAVED_STUDY_OBJECTS_SPEC.md)
- [Saved Object Sync](../SAVED_OBJECT_SYNC_SPEC.md)
- [Home Dashboard](../HOME_DASHBOARD_SPEC.md)
- [Strategy Source Authority](../STRATEGY_SOURCE_AUTHORITY_SPEC.md)
- [Learning Evidence Foundation](LEARNING_EVIDENCE_FOUNDATION.md)
- [Deep Hand Review](DEEP_HAND_REVIEW.md)
- [Training Intelligence](TRAINING_INTELLIGENCE.md)
- [Personal Strategy Intelligence](PERSONAL_STRATEGY_INTELLIGENCE.md)
- [Range Evolution](RANGE_EVOLUTION.md)
- [Interaction Grammar](../INTERACTION_GRAMMAR.md)
