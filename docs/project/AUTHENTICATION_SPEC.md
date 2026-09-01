# Riverline authentication, identity linking, and account switching

Status: `ACCOUNT-002A` implementation authority, refined by `ACCOUNT-002AR` and consumed by `ACCOUNT-002B-A`

Date: August 17, 2026

## Scope

ACCOUNT-002A/AR adds real provider authentication, required remote account-profile metadata, explicit identity linking, and discoverable account UX. The implemented signed-out product state is non-persistent **Guest Mode** for account-gated domains. The accepted long-term product model is now a durable anonymous device-local Guest profile, distinct from every authenticated owner; `IDENTITY-LIFECYCLE-001` owns that migration and one cross-surface owner/generation/disposal lifecycle. Guest data remains local unless a later explicit adoption/sync contract says otherwise. `ACCOUNT-002B-A` permits only an authenticated, currently validated session with explicit identity-scoped opt-in to synchronize Saved Hands/Spots.

Explicit sign-out is an access boundary, not deletion: authenticated-owner bytes may remain stored, but every authenticated-owner query, mounted view, late generation, and cached repository must become inaccessible immediately. `AUTH-TRAINING-MEMORY-001` is human/security accepted: Training Memory now resolves an authentication-aware owner and generation instead of treating the account registry's retained storage identity as authorization.

```text
Supabase Auth browser client + public.profiles/RLS
        |
        v
AuthProviderAdapter -> AuthenticationService
                          |
                          v
                 PersistentIdentityGate
        |
        v
ProviderIdentityMapping v1
        |
        v
Riverline account identity service
        |
        v
RiverlineIdentity v1 + identity-scoped local domains
```

An external provider subject is never a Riverline owner ID. Email, display name, username, and provider subject are not poker-domain keys. Legacy Local Profile bytes remain in the account registry solely for explicit claim/recovery and are invisible to Guest.

## Provider selection

The review used official documentation available on August 17, 2026:

- [Supabase Auth](https://supabase.com/docs/guides/auth), [password auth](https://supabase.com/docs/guides/auth/passwords), [local development](https://supabase.com/docs/guides/local-development), [pricing](https://supabase.com/pricing), and [native deep linking](https://supabase.com/docs/guides/auth/native-mobile-deep-linking)
- [Firebase Web Auth](https://firebase.google.com/docs/auth/web/start), [Auth Emulator](https://firebase.google.com/docs/emulator-suite/connect_auth), and [pricing](https://firebase.google.com/pricing)
- [Clerk documentation](https://clerk.com/docs) and [pricing](https://clerk.com/pricing)
- [Auth0 pricing](https://auth0.com/pricing)
- [Electron security guidance](https://www.electronjs.org/docs/latest/tutorial/security)

| Criterion | Supabase Auth | Firebase Authentication | Clerk | Auth0 |
|---|---|---|---|---|
| Browser client | First-party `supabase-js`; password, email link/OTP, social providers | Mature Web SDK; password, email link, Google/Apple | Managed JS SDK and hosted/prebuilt account UX | Standards-oriented SPA/native SDKs |
| Electron practicality | Password auth works without redirects; OAuth needs a later external-browser/deep-link flow | Password works; redirect/origin provider flows still need desktop design | Web-centric managed session UX; no clear advantage for the static Electron host | Strong OIDC model, but secure system-browser/callback work is larger |
| Local development | Supabase CLI/local stack and self-host seam | Authentication Emulator | Managed-service development | Managed tenant development |
| Future cloud data | Auth and Postgres/RLS form one coherent future backend option | Natural Firestore/Google Cloud path | Authentication-focused; a separate data backend remains necessary | Authentication-focused; a separate data backend remains necessary |
| Lock-in | Moderate; GoTrue/open-source and standards reduce exit cost | Medium/high across Firebase data services | Higher managed identity/session UX coupling | Medium standards portability, higher operational/pricing coupling |
| Verified free entry point | 50,000 MAU free; Pro listed at US$25/month with 100,000 MAU before overage | 50,000 MAU no-cost for non-phone Identity Platform auth | Free developer entry point; paid accounting uses retained users | 25,000 MAU free; Essentials listed from US$35/month |
| Riverline ID separation | Simple provider-subject mapping | Simple provider-UID mapping | Possible, with more managed-user coupling | Simple OIDC-subject mapping |
| Runtime cost | Official current package `2.112.3`; installed UMD asset is about 212 KB | Comparable modular SDK cost depending on imports | Additional managed UI/session runtime | SDK plus desktop callback integration |

Supabase Auth is selected. It best fits Riverline's local-first model, budget, future cloud-data direction, and independent Riverline identity contract. ACCOUNT-002A enables only email/password sign-in and sign-up. Google, Apple, magic-link, password-recovery, and other redirect flows are deferred until a bounded Electron callback ticket owns them.

## AuthProviderAdapter

The production adapter is `app/src/authentication/supabase-auth-provider.mjs`. Its injectable contract owns:

- `signInWithPassword({ email, password })`;
- `signUpWithPassword({ email, password, username, displayName })`, with profile fields sent only as Auth signup metadata for the database trigger;
- `restoreSession()` and `refreshSession()`;
- `signOut()`;
- a normalized provider identity containing provider, project/tenant, opaque subject, optional email/display-name suggestion, and authentication timestamp.

The adapter uses the official `@supabase/supabase-js` browser client. It never returns access or refresh tokens to Riverline account/domain code. Errors become sanitized categories such as `authentication_failed`, `session_expired`, and `provider_unavailable`.

`app/src/authentication/fake-auth-provider.mjs` supplies deterministic success, cancellation, failure, expired-session, unavailable-provider, and multiple-identity behavior. Tests never use live internet.

## Browser client ownership

Riverline owns one Supabase browser client per configured browser runtime through the browser-level client provider. Authentication is a consumer, not the owner. The Authentication adapter, Account/Profile repository, Saved sync adapter, and Personal Strategy sync adapter all receive the same underlying client instance.

Client identity is the normalized Supabase origin, public publishable key, and the effective Auth persistence/session options, including the Riverline storage namespace. Equivalent normalized configuration and repeated bootstrap acquisition return the existing runtime-local client. Materially different configuration within the same runtime fails closed instead of reusing the wrong tenant or Auth namespace. A new browser runtime receives a new client.

Sign-in, sign-up, refresh, sign-out, identity transitions, navigation, sync refresh/reconnect, and Saved or Personal Strategy activity do not recreate the client. Adapters and services retain their existing lifecycle and listener responsibilities without owning or disposing the shared SDK client. Missing or invalid public configuration creates no client and preserves provider-unavailable Guest behavior plus local-only Saved and Personal Strategy behavior.

This ownership seam does not change public publishable-key handling, sanitized Auth errors, profile binding, session restore, sync opt-in, local-first commits, revisions, conflicts, tombstones, outbox behavior, or identity-generation cancellation.

## ProviderIdentityMapping v1

Schema: `provider-identity-mapping/v1`

```text
ProviderIdentityMapping
  schemaVersion
  mappingId                 derived opaque storage key
  provider                  "supabase" in production
  providerTenantId          Supabase project origin, not a secret
  providerSubject           Supabase user UUID/subject
  riverlineIdentityId       RiverlineIdentity.identityId
  createdAt
  updatedAt
  lastAuthenticatedAt
```

Mappings live in the account IndexedDB database's `providerIdentityMappings` store. The physical account database is version `2`; the v1-to-v2 upgrade adds the store and updates physical metadata without rewriting Saved or Personal Strategy data. Mappings are excluded from normal study-data exports.

Provider email is not persisted in the mapping and is never matched to another mapping. Two provider subjects with the same email create two Riverline identities unless a future explicit provider-link workflow says otherwise.

## AccountProfile v1 and database authority

`public.profiles` is remote account metadata, not study-data sync. It stores the authenticated Auth user UUID, nullable stable Riverline identity ID, normalized unique username, Unicode display name, and timestamps. It stores no password, token, email directory, poker data, or provider secret.

The migration is `supabase/migrations/202608170001_account_profiles.sql`. Database constraints enforce username format/reserved names and unique normalized usernames. RLS permits an authenticated user to select/insert/update only their own row; column grants restrict normal edits to display name. A security-definer Auth trigger with an empty search path creates the required profile during signup, so invalid or conflicting profile metadata aborts signup rather than leaving a partially usable account. A bounded authenticated RPC binds `riverline_identity_id` once and fails on conflicts. Apply and test this migration before enabling production signup.

Username v1 is 3–24 lowercase ASCII letters, digits, or underscores, begins with a letter or digit, contains no whitespace, is normalized case-insensitively to lowercase, and excludes the documented reserved system-name set. Display name is independent, non-unique Unicode text from 1–80 characters and is rendered with `dir=auto`. Username changes are deferred; display-name edits are implemented.

## First authentication

After provider authentication:

1. AuthenticationService looks up the exact provider/project/subject mapping.
2. If found, it refreshes `lastAuthenticatedAt` and activates the same Riverline identity.
3. If no local mapping exists and the remote profile is not yet bound, Riverline activates the hidden legacy identity only inside the authenticated claim decision and requires an explicit choice: claim existing data, start separately, or cancel.
4. No domain ownership changes occur before that choice.
5. If an older authenticated user has no `public.profiles` row, `profile_setup_required` provides a resumable recovery form; account-owned domains remain unavailable until completion.

Provider display metadata is only a bounded initial display-name suggestion for a separately created profile. It never overwrites an existing Riverline display name.

## Link current local data

One strict account-database transaction:

1. verifies the active target is still the expected Local Profile and the provider mapping is new;
2. retains the existing Riverline `identityId`;
3. transitions its existing v1 kind vocabulary from `local` to `authenticated_future`;
4. updates only account ownership bindings' owner type while preserving domain owner IDs and storage scopes;
5. creates a new empty legacy Local identity with fresh namespaced bindings for a possible later explicit claim; it is not Guest Mode and is not exposed on sign-out;
6. adds ProviderIdentityMapping v1 and commits once with the authenticated identity active.

The historical `authenticated_future` value remains in RiverlineIdentity v1 to avoid a semantic schema rewrite; in ACCOUNT-002A it represents an authenticated Riverline identity.

Saved IDs, annotations, revisions, tombstones, Replay sources, Personal Strategy profile/mode/evidence/contradiction/session IDs, and domain records are not rewritten. The remote profile binding is reserved first so another account cannot claim the same stable Riverline ID. If the following IndexedDB transaction fails, all local records roll back, the original bytes remain untouched, and retry safely reuses that same reserved ID; no Guest/account query crosses owners during the incomplete state.

## Start separately and existing accounts

Start separately atomically creates one authenticated Riverline identity, fresh Saved and Personal Strategy bindings/namespaces, one provider mapping, and active-identity metadata. The Local Profile remains untouched. Repeated authentication for the same provider/project/subject activates the existing mapped identity and never duplicates it.

## Guest, account switching, and sign-out

The global top-right account control is the primary discovery surface. Guest sees an explicit Guest/Sign-in affordance. A signed-in account shows its initial/display name, with `@username` and account status in the accessible menu. Account/Profile is a focused modal; Settings retains only a secondary route. “Use another account” signs out to Guest, then requires fresh provider authentication. Locally cached identity knowledge is never enough to reveal account-owned data.

Activation changes only `activeIdentityId`. Saved, Home, Personal Strategy, and Range Calibration resolve their binding again. Object ownership is never mutated merely to switch views.

Range Calibration waits for auth restoration before mounting. A live identity-change event disposes its repository/controller, removes identity-scoped DOM and global listeners, and remounts from the new binding. Home reloads its current-user view model on the same event.

Explicit sign-out first invalidates the local authentication generation and enters Guest Mode, then asks Supabase to invalidate the provider session. Training Memory access is therefore revoked before remote cleanup finishes. Provider sign-out failure may report incomplete cleanup but cannot restore the prior local account scope. Authenticated and legacy bytes remain intact but unreachable through Guest queries; re-authentication of the mapped account makes that account's Training Memory accessible again. No purge or remote deletion is implemented. The durable anonymous Device Guest and generalized cross-surface lifecycle remain future `IDENTITY-LIFECYCLE-001` work.

`PersistentIdentityGate.requirePersistentIdentity({ intent, resumeAction })` is the single durable-feature promotion seam. Saved Study and Range Calibration retain the in-memory action/context, open the Account/Profile flow, execute the durable callback exactly once only after `signed_in`, and reject cancellation with `persistent_identity_cancelled` before any reference or domain record is written. Home returns a dedicated Guest model without issuing user-domain queries.

## Session restoration and offline behavior

Startup order is account registry, bounded provider restoration/profile validation, then guarded identity-scoped consumers. The adapter reads the SDK session and validates the user with a five-second bound. A mapped valid session activates its Riverline identity. Missing, expired, timed-out, offline, malformed, or unconfigured auth enters Guest Mode without querying account-owned domains.

Riverline never blocks general startup indefinitely on auth. Account caches fail closed: without a validated restored session/profile, their bytes remain stored but invisible. Core analysis, Training, Equity, Guide, theme, language, audio, and other device preferences remain available.

## Browser and Electron model

Browser development loads the local official Supabase UMD asset and reads public config from `app/auth-config.js`, copied from the committed example and ignored by Git. A production web host may inject the same `globalThis.RiverlineAuthConfig` object.

Electron keeps `contextIsolation: true`, `nodeIntegration: false`, remote-module access disabled, and denies new renderer windows. The preload exposes only the Supabase URL and publishable key from environment variables. Email/password requests go from the sandboxed renderer directly to Supabase over HTTPS through its SDK.

OAuth and magic-link redirects are not enabled. A later desktop auth ticket must use the system browser and an allowlisted PKCE callback/deep-link flow; Riverline will not open remote OAuth pages inside a privileged renderer.

## Configuration

Electron local development:

```powershell
$env:RIVERLINE_AUTH_SUPABASE_URL='https://YOUR_PROJECT_REF.supabase.co'
$env:RIVERLINE_AUTH_SUPABASE_PUBLISHABLE_KEY='YOUR_PUBLISHABLE_KEY'
npm.cmd --prefix app start
```

Browser local development:

1. copy `app/auth-config.example.js` to ignored `app/auth-config.js`;
2. enter the project URL and publishable key;
3. serve `app/` so `node_modules/@supabase/supabase-js/dist/umd/supabase.js` is reachable;
4. enable email/password in Supabase Auth and configure email confirmation as desired.
5. apply `supabase/migrations/202608170001_account_profiles.sql` and verify signup, uniqueness conflict, own-row RLS, and identity binding in the target project.

The publishable key is intentionally public. Never use a Supabase `service_role` key, OAuth client secret, database password, or other privileged secret. Real configuration remains uncommitted.

## Security and privacy

- Passwords pass directly to the provider SDK for the current call and are not stored or logged by Riverline.
- Supabase owns browser session persistence, refresh, and provider sign-out. SDK session bytes remain in provider-owned browser storage, not mappings or poker domains.
- Tokens, passwords, provider sessions, mapping records, and credentials are absent from Saved/Personal Strategy exports.
- The renderer receives no privileged secret and retains no Node access.
- CSP restricts scripts to local assets, connections to Supabase, workers to local/blob sources, and frames/objects to none. A future custom domain requires an explicit CSP update.
- User display names use text/value APIs and `dir=auto`; provider email fields are LTR islands.
- Errors are sanitized; token/session values are not logged.
- Signing in does not upload study data and does not imply a backup. Saved Study and Personal Strategy / Range Calibration each require a separate explicit identity-scoped opt-in and remain reversible.
- `public.profiles` uses database uniqueness and own-row RLS; the browser receives no service-role key.

## Username login decision

Current Supabase password auth accepts email or phone, not an arbitrary username. ACCOUNT-002AR therefore keeps operational email/password login and does **not** expose a client-side username-to-email lookup or pretend that username login is native. The immediate follow-up is `ACCOUNT-002A2 — Secure username/password login adapter`: a deployed, rate-limited server/Edge Function must resolve a normalized username privately, authenticate through a trusted password path, return only the caller's session result, use enumeration-resistant errors, and keep every service/secret key out of the renderer. This is separate from `ACCOUNT-002B` study-data sync.

## ACCOUNT-002B sync boundary

`ACCOUNT-002B-A` adds optional Saved Hand / Saved Spot sync behind `riverline-sync/v1`. The sync coordinator may run only while AuthenticationService reports `signed_in`, the active Riverline identity matches the bound remote profile, and the identity-scoped preference is enabled. Sign-out/Guest/account switching invalidates the coordinator generation so stale async callbacks cannot write into another identity. Supabase session/RLS remains remote authority; provider tokens never enter sync state or study documents.

`ACCOUNT-002B-B` adds a separate opt-in for Personal Strategy / Range Calibration through the same authenticated transport and cancellation boundary. Its adapter syncs relational profile/mode metadata, immutable evidence, and calibration sessions without serializing credentials or inferred artifacts. Guest Mode never starts either coordinator, and identity switching disposes both before opening the new identity's repositories. See `SAVED_OBJECT_SYNC_SPEC.md` and `PERSONAL_STRATEGY_SYNC_SPEC.md`.

Authentication still does not provide remote account/study deletion, local account forgetting, provider-to-provider linking, email-based merging, password recovery, username changes, username/password login, magic links, Google/Apple OAuth, sharing/social, Training-history sync, or telemetry.
