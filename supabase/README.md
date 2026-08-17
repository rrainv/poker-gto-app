# Riverline Supabase setup

Riverline currently uses Supabase only for authentication and `AccountProfile v1`. Poker study objects remain local and account-scoped; this setup does not provide cloud backup or sync.

## Apply the profile migration

Apply [`migrations/202608170001_account_profiles.sql`](migrations/202608170001_account_profiles.sql) to the same Supabase project configured by `app/auth-config.js`. Use the Supabase migration workflow or SQL editor under an administrator account. Never place a service-role key in the renderer, repository, or generated config.

The migration creates:

- `public.profiles`, keyed to `auth.users(id)` with cascade deletion;
- a stable, unique `riverline_identity_id` binding;
- database-enforced, case-insensitive username uniqueness through `username_normalized`;
- own-profile Row Level Security policies;
- a signup trigger that creates the required profile from trusted auth metadata; and
- `bind_riverline_identity(uuid)`, which binds the first Riverline identity exactly once.

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

Username/password login is intentionally not implemented in the renderer: Supabase password auth accepts email or phone, not an arbitrary handle. `ACCOUNT-002A2` owns the future rate-limited trusted server/Edge Function adapter. Email/password remains operational meanwhile.
