# Riverline Supabase setup

Riverline uses Supabase for authentication, `AccountProfile v1`, and explicitly opted-in study sync. Signing in alone never uploads study data. Saved Hands/Spots and Personal Strategy/Range Calibration have separate identity-scoped consent.

## Apply migrations in order

Apply all migrations, in filename order, to the same Supabase project configured by `app/auth-config.js`:

1. [`migrations/202608170001_account_profiles.sql`](migrations/202608170001_account_profiles.sql)
2. [`migrations/202608170002_saved_study_object_sync.sql`](migrations/202608170002_saved_study_object_sync.sql)
3. [`migrations/202608170003_personal_strategy_sync.sql`](migrations/202608170003_personal_strategy_sync.sql)

Use the Supabase migration workflow or SQL editor under an administrator account. Never place a service-role key in the renderer, repository, or generated config. Migration 002 depends on the profile table and its bound `riverline_identity_id`.

The migration creates:

- `public.profiles`, keyed to `auth.users(id)` with cascade deletion;
- a stable, unique `riverline_identity_id` binding;
- database-enforced, case-insensitive username uniqueness through `username_normalized`;
- own-profile Row Level Security policies;
- a signup trigger that creates the required profile from trusted auth metadata; and
- `bind_riverline_identity(text)`, which binds the first Riverline identity exactly once.

The Saved Study migration creates:

- `public.saved_study_objects`, keyed by authenticated user plus stable Riverline object ID;
- own-user and bound-Riverline-identity RLS for select/insert/update;
- no authenticated delete grant or policy (archive remains a tombstone update);
- atomic expected-revision/idempotency RPC `sync_saved_study_object_v1`;
- bounded cursor RPC `pull_saved_study_objects_v1`; and
- revision/ownership guards and a pull index.

The Personal Strategy migration creates:

- relational private profile, three-mode, immutable evidence, and calibration-session tables;
- own-user plus bound-Riverline-identity RLS on every table;
- no evidence update/delete grant and no client hard-delete policy;
- atomic expected-revision/idempotency RPC `sync_personal_strategy_entity_v1`;
- bounded cursor RPC `pull_personal_strategy_entities_v1`;
- profile/mode reconstruction without an opaque whole-library JSON document; and
- indexes for owner pulls and profile/mode/context/hand evidence lookup.

## Username contract

Usernames are normalized to lowercase and must contain 3–24 ASCII lowercase letters, digits, or underscores. The first character must be a letter or digit. Whitespace and reserved names (`admin`, `administrator`, `api`, `guest`, `help`, `moderator`, `riverline`, `root`, `staff`, `support`, `system`) are rejected. The database is the final uniqueness authority.

Display names are separate, non-unique Unicode text, trimmed to 1–80 characters. Neither username nor display name is an ownership key.

## Deployment verification

Before accepting a deployment, verify with two non-privileged test users that:

1. signup creates exactly one profile and duplicate normalized usernames fail;
2. each user can read and edit only their own profile;
3. display-name editing cannot alter `auth_user_id`, `riverline_identity_id`, or username;
4. `bind_riverline_identity` is retry-safe and rejects rebinding to another identity;
5. deleting an Auth user cascades to its profile; and
6. no email, password, token, or service credential is stored in `public.profiles`.

Then verify Saved Study sync with two non-privileged users and two browser profiles:

1. the anonymous role cannot select or call either sync RPC;
2. User A can insert/select/update only rows whose Auth UUID and Riverline identity match A's bound profile;
3. User A cannot read or mutate User B's rows, including by supplying B's object or Riverline identity ID;
4. a repeated operation ID acknowledges idempotently without another revision;
5. a stale expected revision returns a conflict record and cannot overwrite/archive-resurrect it;
6. pull returns only the caller's ordered changes and respects the bounded cursor/limit; and
7. archive persists `archivedAt`, no client hard delete is available, and no payload contains tokens/provider mappings.

Then verify Personal Strategy/Range Calibration sync with the same two non-privileged users and two browser profiles:

1. anonymous cannot select the four strategy tables or call either strategy RPC;
2. User A can read/write only A's Auth UUID plus bound Riverline identity and cannot address User B's rows;
3. profile IDs, exactly three mode IDs, evidence IDs, session IDs, provenance, exact mixes, and timestamps survive a cold pull;
4. repeated operation IDs acknowledge idempotently while stale mutable revisions return conflict records;
5. distinct conflicting direct-evidence IDs both insert and pull; evidence cannot be updated/deleted;
6. profile/mode same-field changes produce the expected client metadata conflict and archive cannot be resurrected by a stale active edit;
7. divergent session answers union as evidence and recompute the correct resume cursor on both devices; and
8. payloads contain no auth token, password, provider mapping/subject, email, username authority, or service credential.

Username/password login is intentionally not implemented in the renderer: Supabase password auth accepts email or phone, not an arbitrary handle. `ACCOUNT-002A2` owns the future rate-limited trusted server/Edge Function adapter. Email/password remains operational meanwhile.
