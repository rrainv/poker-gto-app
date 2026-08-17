-- ACCOUNT-002B-B: opt-in Personal Strategy and Range Calibration sync.
-- Evidence is append-oriented; mutable profile/mode metadata and sessions use
-- expected revisions. Generic Training history and inferred artifacts are absent.

create table if not exists public.personal_strategy_profiles (
  owner_auth_user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  profile_id text not null,
  riverline_identity_id text not null,
  revision bigint not null,
  profile_schema_version text not null,
  profile_data jsonb not null,
  archived_at timestamptz,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  last_operation_id text not null,
  server_updated_at timestamptz not null default clock_timestamp(),
  primary key (owner_auth_user_id, profile_id),
  constraint personal_strategy_profile_revision_positive check (revision > 0),
  constraint personal_strategy_profile_schema check (profile_schema_version = 'strategy-profile/v1'),
  constraint personal_strategy_profile_document check (
    jsonb_typeof(profile_data) = 'object'
    and profile_data ->> 'id' = profile_id
    and profile_data ->> 'schemaVersion' = profile_schema_version
  )
);

create table if not exists public.personal_strategy_modes (
  owner_auth_user_id uuid not null,
  profile_id text not null,
  mode_id text not null,
  riverline_identity_id text not null,
  mode_schema_version text not null,
  display_order integer not null,
  mode_data jsonb not null,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  server_updated_at timestamptz not null default clock_timestamp(),
  primary key (owner_auth_user_id, mode_id),
  foreign key (owner_auth_user_id, profile_id)
    references public.personal_strategy_profiles(owner_auth_user_id, profile_id) on delete cascade,
  constraint personal_strategy_mode_schema check (mode_schema_version = 'strategy-mode/v1'),
  constraint personal_strategy_mode_document check (
    jsonb_typeof(mode_data) = 'object'
    and mode_data ->> 'id' = mode_id
    and mode_data ->> 'profileId' = profile_id
    and mode_data ->> 'schemaVersion' = mode_schema_version
  ),
  unique (owner_auth_user_id, profile_id, display_order)
);

create table if not exists public.personal_strategy_evidence (
  owner_auth_user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  evidence_id text not null,
  riverline_identity_id text not null,
  profile_id text not null,
  mode_id text not null,
  entity_type text not null,
  evidence_schema_version text not null,
  context_key text not null,
  hand_class text not null,
  source_type text not null,
  dominant_action text,
  has_explicit_frequencies boolean,
  calibration_session_id text,
  evidence_data jsonb not null,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  last_operation_id text not null,
  server_updated_at timestamptz not null default clock_timestamp(),
  primary key (owner_auth_user_id, evidence_id),
  foreign key (owner_auth_user_id, profile_id)
    references public.personal_strategy_profiles(owner_auth_user_id, profile_id),
  foreign key (owner_auth_user_id, mode_id)
    references public.personal_strategy_modes(owner_auth_user_id, mode_id),
  constraint personal_strategy_evidence_type
    check (entity_type in ('range_observation', 'training_observation')),
  constraint personal_strategy_evidence_schema check (
    (entity_type = 'range_observation' and evidence_schema_version = 'range-observation/v1')
    or (entity_type = 'training_observation' and evidence_schema_version = 'training-observation/v1')
  ),
  constraint personal_strategy_evidence_document check (
    jsonb_typeof(evidence_data) = 'object'
    and evidence_data ->> 'id' = evidence_id
    and evidence_data ->> 'profileId' = profile_id
    and evidence_data ->> 'modeId' = mode_id
    and evidence_data ->> 'schemaVersion' = evidence_schema_version
  )
);

create table if not exists public.range_calibration_sessions (
  owner_auth_user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  session_id text not null,
  riverline_identity_id text not null,
  profile_id text not null,
  mode_id text not null,
  revision bigint not null,
  session_schema_version text not null,
  context_key text not null,
  session_state text not null,
  cursor_next_prompt integer not null,
  session_data jsonb not null,
  started_at timestamptz not null,
  updated_at timestamptz not null,
  completed_at timestamptz,
  last_operation_id text not null,
  server_updated_at timestamptz not null default clock_timestamp(),
  primary key (owner_auth_user_id, session_id),
  foreign key (owner_auth_user_id, profile_id)
    references public.personal_strategy_profiles(owner_auth_user_id, profile_id),
  foreign key (owner_auth_user_id, mode_id)
    references public.personal_strategy_modes(owner_auth_user_id, mode_id),
  constraint range_calibration_revision_positive check (revision > 0),
  constraint range_calibration_session_schema check (session_schema_version = 'calibration-session/v1'),
  constraint range_calibration_session_state check (session_state in ('active', 'paused', 'completed')),
  constraint range_calibration_session_document check (
    jsonb_typeof(session_data) = 'object'
    and session_data ->> 'id' = session_id
    and session_data ->> 'profileId' = profile_id
    and session_data ->> 'modeId' = mode_id
    and session_data ->> 'schemaVersion' = session_schema_version
  )
);

create index if not exists personal_strategy_profiles_pull_idx
  on public.personal_strategy_profiles (owner_auth_user_id, riverline_identity_id, server_updated_at, profile_id);
create index if not exists personal_strategy_evidence_pull_idx
  on public.personal_strategy_evidence (owner_auth_user_id, riverline_identity_id, server_updated_at, evidence_id);
create index if not exists personal_strategy_evidence_scope_idx
  on public.personal_strategy_evidence (owner_auth_user_id, profile_id, mode_id, context_key, hand_class);
create index if not exists range_calibration_sessions_pull_idx
  on public.range_calibration_sessions (owner_auth_user_id, riverline_identity_id, server_updated_at, session_id);

alter table public.personal_strategy_profiles enable row level security;
alter table public.personal_strategy_modes enable row level security;
alter table public.personal_strategy_evidence enable row level security;
alter table public.range_calibration_sessions enable row level security;

revoke all on table public.personal_strategy_profiles from public, anon, authenticated;
revoke all on table public.personal_strategy_modes from public, anon, authenticated;
revoke all on table public.personal_strategy_evidence from public, anon, authenticated;
revoke all on table public.range_calibration_sessions from public, anon, authenticated;
grant select on public.personal_strategy_profiles to authenticated;
grant insert on public.personal_strategy_profiles to authenticated;
grant update (revision, profile_data, archived_at, updated_at, last_operation_id)
  on public.personal_strategy_profiles to authenticated;
grant select on public.personal_strategy_modes to authenticated;
grant insert on public.personal_strategy_modes to authenticated;
grant update (display_order, mode_data, updated_at) on public.personal_strategy_modes to authenticated;
grant select, insert on public.personal_strategy_evidence to authenticated;
grant select on public.range_calibration_sessions to authenticated;
grant insert on public.range_calibration_sessions to authenticated;
grant update (revision, session_state, cursor_next_prompt, session_data, updated_at, completed_at, last_operation_id)
  on public.range_calibration_sessions to authenticated;

create or replace function public.riverline_sync_owner_matches(p_owner uuid, p_identity text)
returns boolean language sql stable set search_path = '' as $$
  select p_owner = auth.uid() and p_identity = (
    select profiles.riverline_identity_id from public.profiles
    where profiles.auth_user_id = auth.uid()
  );
$$;
revoke all on function public.riverline_sync_owner_matches(uuid, text) from public, anon;
grant execute on function public.riverline_sync_owner_matches(uuid, text) to authenticated;

drop policy if exists "personal_strategy_profiles_select_own" on public.personal_strategy_profiles;
create policy "personal_strategy_profiles_select_own" on public.personal_strategy_profiles
  for select to authenticated using (public.riverline_sync_owner_matches(owner_auth_user_id, riverline_identity_id));
drop policy if exists "personal_strategy_profiles_insert_own" on public.personal_strategy_profiles;
create policy "personal_strategy_profiles_insert_own" on public.personal_strategy_profiles
  for insert to authenticated with check (public.riverline_sync_owner_matches(owner_auth_user_id, riverline_identity_id));
drop policy if exists "personal_strategy_profiles_update_own" on public.personal_strategy_profiles;
create policy "personal_strategy_profiles_update_own" on public.personal_strategy_profiles
  for update to authenticated using (public.riverline_sync_owner_matches(owner_auth_user_id, riverline_identity_id))
  with check (public.riverline_sync_owner_matches(owner_auth_user_id, riverline_identity_id));

drop policy if exists "personal_strategy_modes_select_own" on public.personal_strategy_modes;
create policy "personal_strategy_modes_select_own" on public.personal_strategy_modes
  for select to authenticated using (public.riverline_sync_owner_matches(owner_auth_user_id, riverline_identity_id));
drop policy if exists "personal_strategy_modes_insert_own" on public.personal_strategy_modes;
create policy "personal_strategy_modes_insert_own" on public.personal_strategy_modes
  for insert to authenticated with check (public.riverline_sync_owner_matches(owner_auth_user_id, riverline_identity_id));
drop policy if exists "personal_strategy_modes_update_own" on public.personal_strategy_modes;
create policy "personal_strategy_modes_update_own" on public.personal_strategy_modes
  for update to authenticated using (public.riverline_sync_owner_matches(owner_auth_user_id, riverline_identity_id))
  with check (public.riverline_sync_owner_matches(owner_auth_user_id, riverline_identity_id));

drop policy if exists "personal_strategy_evidence_select_own" on public.personal_strategy_evidence;
create policy "personal_strategy_evidence_select_own" on public.personal_strategy_evidence
  for select to authenticated using (public.riverline_sync_owner_matches(owner_auth_user_id, riverline_identity_id));
drop policy if exists "personal_strategy_evidence_insert_own" on public.personal_strategy_evidence;
create policy "personal_strategy_evidence_insert_own" on public.personal_strategy_evidence
  for insert to authenticated with check (public.riverline_sync_owner_matches(owner_auth_user_id, riverline_identity_id));

drop policy if exists "range_calibration_sessions_select_own" on public.range_calibration_sessions;
create policy "range_calibration_sessions_select_own" on public.range_calibration_sessions
  for select to authenticated using (public.riverline_sync_owner_matches(owner_auth_user_id, riverline_identity_id));
drop policy if exists "range_calibration_sessions_insert_own" on public.range_calibration_sessions;
create policy "range_calibration_sessions_insert_own" on public.range_calibration_sessions
  for insert to authenticated with check (public.riverline_sync_owner_matches(owner_auth_user_id, riverline_identity_id));
drop policy if exists "range_calibration_sessions_update_own" on public.range_calibration_sessions;
create policy "range_calibration_sessions_update_own" on public.range_calibration_sessions
  for update to authenticated using (public.riverline_sync_owner_matches(owner_auth_user_id, riverline_identity_id))
  with check (public.riverline_sync_owner_matches(owner_auth_user_id, riverline_identity_id));

create or replace function public.guard_personal_strategy_mutable_revision()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.owner_auth_user_id <> old.owner_auth_user_id
    or new.riverline_identity_id <> old.riverline_identity_id then
    raise exception 'personal strategy ownership is immutable' using errcode = '22023';
  end if;
  if tg_table_name in ('personal_strategy_profiles', 'range_calibration_sessions')
    and new.revision <= old.revision then
    raise exception 'personal strategy revision must advance' using errcode = '40001';
  end if;
  new.server_updated_at = clock_timestamp();
  return new;
end;
$$;
drop trigger if exists personal_strategy_profiles_guard on public.personal_strategy_profiles;
create trigger personal_strategy_profiles_guard before update on public.personal_strategy_profiles
  for each row execute procedure public.guard_personal_strategy_mutable_revision();
drop trigger if exists personal_strategy_modes_guard on public.personal_strategy_modes;
create trigger personal_strategy_modes_guard before update on public.personal_strategy_modes
  for each row execute procedure public.guard_personal_strategy_mutable_revision();
drop trigger if exists range_calibration_sessions_guard on public.range_calibration_sessions;
create trigger range_calibration_sessions_guard before update on public.range_calibration_sessions
  for each row execute procedure public.guard_personal_strategy_mutable_revision();

create or replace function public.personal_strategy_profile_entity_v1(
  p_owner uuid, p_profile_id text
) returns jsonb language sql stable set search_path = '' as $$
  select jsonb_build_object(
    'schemaVersion', 'remote-personal-strategy-entity/v1',
    'entityType', 'profile_bundle',
    'entitySchemaVersion', profiles.profile_schema_version,
    'id', profiles.profile_id,
    'profileId', profiles.profile_id,
    'revision', profiles.revision,
    'createdAt', to_char(profiles.created_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
    'updatedAt', to_char(profiles.updated_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
    'payload', jsonb_build_object(
      'profile', profiles.profile_data,
      'modes', coalesce((
        select jsonb_agg(modes.mode_data order by modes.display_order)
        from public.personal_strategy_modes as modes
        where modes.owner_auth_user_id = profiles.owner_auth_user_id
          and modes.profile_id = profiles.profile_id
      ), '[]'::jsonb)
    )
  )
  from public.personal_strategy_profiles as profiles
  where profiles.owner_auth_user_id = p_owner and profiles.profile_id = p_profile_id;
$$;

create or replace function public.personal_strategy_stored_entity_v1(
  p_owner uuid, p_entity_type text, p_entity_id text
) returns jsonb language plpgsql stable set search_path = '' as $$
declare result jsonb;
begin
  if p_entity_type = 'profile_bundle' then
    return public.personal_strategy_profile_entity_v1(p_owner, p_entity_id);
  elsif p_entity_type in ('range_observation', 'training_observation') then
    select jsonb_build_object(
      'schemaVersion', 'remote-personal-strategy-entity/v1',
      'entityType', evidence.entity_type,
      'entitySchemaVersion', evidence.evidence_schema_version,
      'id', evidence.evidence_id,
      'profileId', evidence.profile_id,
      'revision', 1,
      'createdAt', to_char(evidence.created_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
      'updatedAt', to_char(evidence.updated_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
      'payload', evidence.evidence_data
    ) into result from public.personal_strategy_evidence as evidence
    where evidence.owner_auth_user_id = p_owner and evidence.evidence_id = p_entity_id;
    return result;
  elsif p_entity_type = 'calibration_session' then
    select jsonb_build_object(
      'schemaVersion', 'remote-personal-strategy-entity/v1',
      'entityType', 'calibration_session',
      'entitySchemaVersion', sessions.session_schema_version,
      'id', sessions.session_id,
      'profileId', sessions.profile_id,
      'revision', sessions.revision,
      'createdAt', to_char(sessions.started_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
      'updatedAt', to_char(sessions.updated_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
      'payload', sessions.session_data
    ) into result from public.range_calibration_sessions as sessions
    where sessions.owner_auth_user_id = p_owner and sessions.session_id = p_entity_id;
    return result;
  end if;
  return null;
end;
$$;

create or replace function public.sync_personal_strategy_entity_v1(
  p_operation_id text,
  p_riverline_identity_id text,
  p_expected_revision bigint,
  p_object jsonb
) returns jsonb language plpgsql set search_path = '' as $$
declare
  caller_id uuid := auth.uid();
  entity_type text := p_object ->> 'entityType';
  entity_id text := p_object ->> 'id';
  incoming_revision bigint := (p_object ->> 'revision')::bigint;
  existing_revision bigint;
  existing_operation text;
  existing_object jsonb;
  profile jsonb;
  mode jsonb;
  evidence jsonb;
  session jsonb;
  stored_at timestamptz;
begin
  if caller_id is null or not public.riverline_sync_owner_matches(caller_id, p_riverline_identity_id) then
    raise exception 'authentication or Riverline identity mismatch' using errcode = '42501';
  end if;
  if p_operation_id is null or p_expected_revision is null or p_expected_revision < 0
    or jsonb_typeof(p_object) <> 'object'
    or p_object ->> 'schemaVersion' <> 'remote-personal-strategy-entity/v1'
    or entity_type not in ('profile_bundle', 'range_observation', 'training_observation', 'calibration_session')
    or entity_id is null or incoming_revision < 1 then
    raise exception 'invalid Personal Strategy sync operation' using errcode = '22023';
  end if;

  if entity_type = 'profile_bundle' then
    select revision, last_operation_id into existing_revision, existing_operation
    from public.personal_strategy_profiles where owner_auth_user_id = caller_id and profile_id = entity_id for update;
  elsif entity_type in ('range_observation', 'training_observation') then
    select 1, last_operation_id into existing_revision, existing_operation
    from public.personal_strategy_evidence where owner_auth_user_id = caller_id and evidence_id = entity_id;
  else
    select revision, last_operation_id into existing_revision, existing_operation
    from public.range_calibration_sessions where owner_auth_user_id = caller_id and session_id = entity_id for update;
  end if;

  if found and existing_operation = p_operation_id then
    existing_object := public.personal_strategy_stored_entity_v1(caller_id, entity_type, entity_id);
    return jsonb_build_object('status', 'acknowledged', 'record', jsonb_build_object(
      'object', existing_object, 'serverUpdatedAt', clock_timestamp(), 'operationId', existing_operation));
  end if;
  if (found and existing_revision <> p_expected_revision) or (not found and p_expected_revision <> 0) then
    existing_object := public.personal_strategy_stored_entity_v1(caller_id, entity_type, entity_id);
    return jsonb_build_object('status', 'conflict', 'record', case when existing_object is null then null else
      jsonb_build_object('object', existing_object, 'serverUpdatedAt', clock_timestamp(), 'operationId', existing_operation) end);
  end if;

  if entity_type = 'profile_bundle' then
    profile := p_object #> '{payload,profile}';
    if jsonb_typeof(profile) <> 'object' or jsonb_array_length(p_object #> '{payload,modes}') <> 3 then
      raise exception 'invalid profile bundle' using errcode = '22023';
    end if;
    insert into public.personal_strategy_profiles (
      owner_auth_user_id, profile_id, riverline_identity_id, revision, profile_schema_version,
      profile_data, archived_at, created_at, updated_at, last_operation_id
    ) values (
      caller_id, entity_id, p_riverline_identity_id, incoming_revision, p_object ->> 'entitySchemaVersion',
      profile, case when profile ->> 'state' = 'archived' then (p_object ->> 'updatedAt')::timestamptz else null end,
      (p_object ->> 'createdAt')::timestamptz, (p_object ->> 'updatedAt')::timestamptz, p_operation_id
    ) on conflict (owner_auth_user_id, profile_id) do update set
      revision = excluded.revision, profile_data = excluded.profile_data,
      archived_at = excluded.archived_at, updated_at = excluded.updated_at,
      last_operation_id = excluded.last_operation_id;
    for mode in select value from jsonb_array_elements(p_object #> '{payload,modes}') loop
      insert into public.personal_strategy_modes (
        owner_auth_user_id, profile_id, mode_id, riverline_identity_id, mode_schema_version,
        display_order, mode_data, created_at, updated_at
      ) values (
        caller_id, entity_id, mode ->> 'id', p_riverline_identity_id, mode ->> 'schemaVersion',
        (mode ->> 'displayOrder')::integer, mode,
        (mode ->> 'createdAt')::timestamptz, (mode ->> 'updatedAt')::timestamptz
      ) on conflict (owner_auth_user_id, mode_id) do update set
        display_order = excluded.display_order,
        mode_data = excluded.mode_data,
        updated_at = excluded.updated_at;
    end loop;
  elsif entity_type in ('range_observation', 'training_observation') then
    evidence := p_object -> 'payload';
    insert into public.personal_strategy_evidence (
      owner_auth_user_id, evidence_id, riverline_identity_id, profile_id, mode_id,
      entity_type, evidence_schema_version, context_key, hand_class, source_type,
      dominant_action, has_explicit_frequencies, calibration_session_id, evidence_data,
      created_at, updated_at, last_operation_id
    ) values (
      caller_id, entity_id, p_riverline_identity_id, evidence ->> 'profileId', evidence ->> 'modeId',
      entity_type, p_object ->> 'entitySchemaVersion', md5((evidence -> 'context')::text),
      evidence ->> 'handClass', evidence #>> '{provenance,type}',
      evidence #>> '{dominantAction,type}', nullif(evidence ->> 'hasExplicitFrequencies', '')::boolean,
      evidence #>> '{provenance,calibrationSessionId}', evidence,
      (p_object ->> 'createdAt')::timestamptz, (p_object ->> 'updatedAt')::timestamptz, p_operation_id
    );
  else
    session := p_object -> 'payload';
    insert into public.range_calibration_sessions (
      owner_auth_user_id, session_id, riverline_identity_id, profile_id, mode_id, revision,
      session_schema_version, context_key, session_state, cursor_next_prompt, session_data,
      started_at, updated_at, completed_at, last_operation_id
    ) values (
      caller_id, entity_id, p_riverline_identity_id, session ->> 'profileId', session ->> 'modeId', incoming_revision,
      p_object ->> 'entitySchemaVersion', md5((session -> 'contextScope')::text), session ->> 'state',
      (session #>> '{cursor,nextPromptIndex}')::integer, session,
      (session ->> 'startedAt')::timestamptz, (session ->> 'updatedAt')::timestamptz,
      nullif(session ->> 'completedAt', '')::timestamptz, p_operation_id
    ) on conflict (owner_auth_user_id, session_id) do update set
      revision = excluded.revision, session_state = excluded.session_state,
      cursor_next_prompt = excluded.cursor_next_prompt, session_data = excluded.session_data,
      updated_at = excluded.updated_at, completed_at = excluded.completed_at,
      last_operation_id = excluded.last_operation_id;
  end if;

  existing_object := public.personal_strategy_stored_entity_v1(caller_id, entity_type, entity_id);
  select greatest(
    coalesce((select server_updated_at from public.personal_strategy_profiles where owner_auth_user_id = caller_id and profile_id = entity_id), '-infinity'),
    coalesce((select server_updated_at from public.personal_strategy_evidence where owner_auth_user_id = caller_id and evidence_id = entity_id), '-infinity'),
    coalesce((select server_updated_at from public.range_calibration_sessions where owner_auth_user_id = caller_id and session_id = entity_id), '-infinity')
  ) into stored_at;
  return jsonb_build_object('status', 'acknowledged', 'record', jsonb_build_object(
    'object', existing_object, 'serverUpdatedAt', stored_at, 'operationId', p_operation_id));
end;
$$;

create or replace function public.pull_personal_strategy_entities_v1(
  p_riverline_identity_id text,
  p_after_server_updated_at timestamptz default null,
  p_after_entity_id text default null,
  p_limit integer default 100
) returns table (object_data jsonb, server_updated_at timestamptz)
language plpgsql stable set search_path = '' as $$
begin
  if auth.uid() is null or not public.riverline_sync_owner_matches(auth.uid(), p_riverline_identity_id) then
    raise exception 'authentication or Riverline identity mismatch' using errcode = '42501';
  end if;
  if p_limit < 1 or p_limit > 500 then raise exception 'invalid pull limit' using errcode = '22023'; end if;
  return query
  with entities as (
    select profiles.profile_id as entity_id,
      public.personal_strategy_profile_entity_v1(profiles.owner_auth_user_id, profiles.profile_id) as object_data,
      profiles.server_updated_at
    from public.personal_strategy_profiles as profiles
    where profiles.owner_auth_user_id = auth.uid() and profiles.riverline_identity_id = p_riverline_identity_id
    union all
    select evidence.evidence_id,
      public.personal_strategy_stored_entity_v1(evidence.owner_auth_user_id, evidence.entity_type, evidence.evidence_id),
      evidence.server_updated_at
    from public.personal_strategy_evidence as evidence
    where evidence.owner_auth_user_id = auth.uid() and evidence.riverline_identity_id = p_riverline_identity_id
    union all
    select sessions.session_id,
      public.personal_strategy_stored_entity_v1(sessions.owner_auth_user_id, 'calibration_session', sessions.session_id),
      sessions.server_updated_at
    from public.range_calibration_sessions as sessions
    where sessions.owner_auth_user_id = auth.uid() and sessions.riverline_identity_id = p_riverline_identity_id
  )
  select entities.object_data, entities.server_updated_at from entities
  where p_after_server_updated_at is null
    or (entities.server_updated_at, entities.entity_id)
      > (p_after_server_updated_at, coalesce(p_after_entity_id, ''))
  order by entities.server_updated_at, entities.entity_id
  limit p_limit;
end;
$$;

revoke all on function public.personal_strategy_profile_entity_v1(uuid, text) from public, anon;
grant execute on function public.personal_strategy_profile_entity_v1(uuid, text) to authenticated;
revoke all on function public.personal_strategy_stored_entity_v1(uuid, text, text) from public, anon;
grant execute on function public.personal_strategy_stored_entity_v1(uuid, text, text) to authenticated;
revoke all on function public.sync_personal_strategy_entity_v1(text, text, bigint, jsonb) from public, anon;
grant execute on function public.sync_personal_strategy_entity_v1(text, text, bigint, jsonb) to authenticated;
revoke all on function public.pull_personal_strategy_entities_v1(text, timestamptz, text, integer) from public, anon;
grant execute on function public.pull_personal_strategy_entities_v1(text, timestamptz, text, integer) to authenticated;
